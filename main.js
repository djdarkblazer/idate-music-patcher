const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const axios = require('axios');
const crypto = require('crypto');

let mainWindow;

// Configuration - Update these with your GitHub repo details
const GITHUB_CONFIG = {
  owner: 'djdarkblazer',
  repo: 'idate-music-patcher',
  branch: 'main',
  folder: 'Media' // Folder in repo containing music files
};

const CACHE_FILE = path.join(app.getPath('userData'), 'file-cache.json');

function createWindow() {
  const iconPath = path.join(__dirname, '/images/icon-idate-emulator.ico'); 
  mainWindow = new BrowserWindow({
    width: 800,
    height: 900,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: true,
    icon: iconPath
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  if (process.platform === 'darwin') {
    // macOS dock icon uses .png format generally
    app.dock.setIcon(path.join(__dirname, '/images/icon-idate-emulator.ico'));
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Get file hash for comparison
function getFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fsSync.createReadStream(filePath);
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// Load cached file info
async function loadCache() {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// Save cache
async function saveCache(cache) {
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// Recursively get all files from GitHub repo (including subdirectories)
async function getGitHubFiles(folderPath = GITHUB_CONFIG.folder) {
  const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${folderPath}?ref=${GITHUB_CONFIG.branch}`;
  
  console.log('Fetching from URL:', url);
  
  try {
    const response = await axios.get(url, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    
    let allFiles = [];
    
    for (const item of response.data) {
      if (item.type === 'file') {
        // It's a file, add it to our list with relative path
        const relativePath = item.path.replace(`${GITHUB_CONFIG.folder}/`, '');
        allFiles.push({
          ...item,
          relativePath: relativePath
        });
      } else if (item.type === 'dir') {
        // It's a directory, recursively get files from it
        console.log('Found directory:', item.name);
        const subFiles = await getGitHubFiles(item.path);
        allFiles = allFiles.concat(subFiles);
      }
    }
    
    console.log('Total files found:', allFiles.length);
    return allFiles;
  } catch (error) {
    console.error('GitHub API Error:', error.response?.data || error.message);
    throw new Error(`Failed to fetch files from GitHub: ${error.message}`);
  }
}

// Browse for path
ipcMain.handle('browse-path', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select iDate Revival Installation Path',
    defaultPath: 'C:\\Program Files'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Check for updates
ipcMain.handle('check-updates', async (event, targetPath) => {
  try {
    // Check if target path exists
    try {
      await fs.access(targetPath);
    } catch {
      return {
        success: false,
        error: 'Selected path does not exist. Please choose a valid installation directory.'
      };
    }

    const githubFiles = await getGitHubFiles();
    const cache = await loadCache();
    const updates = [];
    const newFiles = [];
    const existingFiles = [];

    for (const file of githubFiles) {
      // Use relative path to maintain folder structure
      const targetFile = path.join(targetPath, file.relativePath);
      const fileExists = fsSync.existsSync(targetFile);
      
      if (!fileExists) {
        // Brand new file not in local directory
        newFiles.push(file.relativePath);
        updates.push({
          name: file.name,
          relativePath: file.relativePath,
          sha: file.sha,
          download_url: file.download_url,
          size: file.size,
          isNew: true
        });
      } else if (cache[file.relativePath] !== file.sha) {
        // File exists but has been updated
        existingFiles.push(file.relativePath);
        updates.push({
          name: file.name,
          relativePath: file.relativePath,
          sha: file.sha,
          download_url: file.download_url,
          size: file.size,
          isNew: false
        });
      }
    }

    return {
      success: true,
      updates,
      newFiles,
      existingFiles,
      totalFiles: githubFiles.length,
      upToDateCount: githubFiles.length - updates.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Download and patch files
ipcMain.handle('patch-files', async (event, updates, targetPath) => {
  try {
    // Ensure target directory exists
    await fs.mkdir(targetPath, { recursive: true });

    const cache = await loadCache();
    let completed = 0;

    for (const file of updates) {
      try {
        // Download file
        const response = await axios.get(file.download_url, {
          responseType: 'arraybuffer',
          onDownloadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            mainWindow.webContents.send('download-progress', {
              fileName: file.relativePath,
              progress
            });
          }
        });

        // Write to target path, creating subdirectories if needed
        const targetFile = path.join(targetPath, file.relativePath);
        const targetDir = path.dirname(targetFile);
        
        // Ensure subdirectory exists
        await fs.mkdir(targetDir, { recursive: true });
        await fs.writeFile(targetFile, response.data);

        // Update cache with relative path
        cache[file.relativePath] = file.sha;
        completed++;

        mainWindow.webContents.send('file-completed', {
          fileName: file.relativePath,
          completed,
          total: updates.length
        });
      } catch (fileError) {
        // Check if it's a permission error
        if (fileError.code === 'EPERM' || fileError.code === 'EACCES') {
          throw new Error('Permission denied. Please run the patcher as Administrator.\n\nRight-click the app → "Run as administrator"');
        }
        throw fileError;
      }
    }

    await saveCache(cache);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});