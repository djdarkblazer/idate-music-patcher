const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const axios = require('axios');
const crypto = require('crypto');

let mainWindow;

// Configuration - Update these with your GitHub repo details
const GITHUB_CONFIG = {
  owner: 'YOUR_GITHUB_USERNAME',
  repo: 'YOUR_REPO_NAME',
  branch: 'main',
  folder: 'Media' // Folder in repo containing music files
};

const TARGET_PATH = 'C:\\Program Files (x86)\\iDate Revival Project\\Media';
const CACHE_FILE = path.join(app.getPath('userData'), 'file-cache.json');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 500,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: true
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

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

// Get files from GitHub repo
async function getGitHubFiles() {
  const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.folder}?ref=${GITHUB_CONFIG.branch}`;
  
  try {
    const response = await axios.get(url, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    
    return response.data.filter(file => file.type === 'file');
  } catch (error) {
    throw new Error(`Failed to fetch files from GitHub: ${error.message}`);
  }
}

// Check for updates
ipcMain.handle('check-updates', async () => {
  try {
    // Check if target path exists
    try {
      await fs.access(TARGET_PATH);
    } catch {
      return {
        success: false,
        error: 'Game installation not found. Please install the game first.'
      };
    }

    const githubFiles = await getGitHubFiles();
    const cache = await loadCache();
    const updates = [];

    for (const file of githubFiles) {
      const targetFile = path.join(TARGET_PATH, file.name);
      const fileExists = fsSync.existsSync(targetFile);
      
      // Check if file needs update
      if (!fileExists || cache[file.name] !== file.sha) {
        updates.push({
          name: file.name,
          sha: file.sha,
          download_url: file.download_url,
          size: file.size,
          isNew: !fileExists
        });
      }
    }

    return {
      success: true,
      updates,
      totalFiles: githubFiles.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Download and patch files
ipcMain.handle('patch-files', async (event, updates) => {
  try {
    // Ensure target directory exists
    await fs.mkdir(TARGET_PATH, { recursive: true });

    const cache = await loadCache();
    let completed = 0;

    for (const file of updates) {
      // Download file
      const response = await axios.get(file.download_url, {
        responseType: 'arraybuffer',
        onDownloadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          mainWindow.webContents.send('download-progress', {
            fileName: file.name,
            progress
          });
        }
      });

      // Write to target path
      const targetFile = path.join(TARGET_PATH, file.name);
      await fs.writeFile(targetFile, response.data);

      // Update cache
      cache[file.name] = file.sha;
      completed++;

      mainWindow.webContents.send('file-completed', {
        fileName: file.name,
        completed,
        total: updates.length
      });
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