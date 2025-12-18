let currentUpdates = [];
let isPatching = false;
let selectedPath = '';

const statusText = document.getElementById('statusText');
const fileName = document.getElementById('fileName');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const actionBtn = document.getElementById('actionBtn');
const infoBox = document.getElementById('infoBox');
const pathInput = document.getElementById('pathInput');

// Preset paths
const PRESET_PATHS = {
  online: 'C:\\Program Files\\iDate Revival\\Media',
  offline: 'C:\\Program Files (x86)\\iDate Revival Project\\Media'
};

function selectPreset(type) {
  selectedPath = PRESET_PATHS[type];
  pathInput.value = selectedPath;
  statusText.textContent = 'Path selected. Click "Check for Updates" to begin';
  fileName.textContent = '';
  infoBox.style.display = 'none';
}

async function browsePath() {
  const result = await window.patcher.browsePath();
  if (result) {
    selectedPath = result;
    pathInput.value = result;
    statusText.textContent = 'Path selected. Click "Check for Updates" to begin';
    fileName.textContent = '';
    infoBox.style.display = 'none';
  }
}

async function handleAction() {
  if (!isPatching) {
    await checkForUpdates();
  } else {
    await startPatching();
  }
}

async function checkForUpdates() {
  if (!selectedPath) {
    statusText.textContent = 'Please select an installation path first';
    fileName.textContent = '';
    return;
  }

  actionBtn.disabled = true;
  statusText.textContent = 'Checking for updates...';
  fileName.textContent = '';
  infoBox.style.display = 'none';

  const result = await window.patcher.checkUpdates(selectedPath);

  if (!result.success) {
    statusText.textContent = `Error: ${result.error}`;
    actionBtn.disabled = false;
    return;
  }

  currentUpdates = result.updates;

  if (currentUpdates.length === 0) {
    statusText.textContent = '✓ All files are up to date!';
    infoBox.style.display = 'block';
    infoBox.innerHTML = `
      Total files in repo: ${result.totalFiles}<br>
      All files are already patched and up to date
    `;
    actionBtn.disabled = false;
  } else {
    statusText.textContent = `Found ${currentUpdates.length} file(s) to patch`;
    infoBox.style.display = 'block';
    
    let infoHTML = `<strong>Summary:</strong><br>`;
    if (result.newFiles.length > 0) {
      infoHTML += `📦 New files to download: ${result.newFiles.length}<br>`;
      infoHTML += `<small style="opacity:0.8">${result.newFiles.join(', ')}</small><br>`;
    }
    if (result.existingFiles.length > 0) {
      infoHTML += `🔄 Files to update: ${result.existingFiles.length}<br>`;
      infoHTML += `<small style="opacity:0.8">${result.existingFiles.join(', ')}</small><br>`;
    }
    if (result.upToDateCount > 0) {
      infoHTML += `✓ Up to date: ${result.upToDateCount}`;
    }
    
    infoBox.innerHTML = infoHTML;
    
    actionBtn.textContent = 'Start Patching';
    actionBtn.disabled = false;
    isPatching = true;
  }
}

async function startPatching() {
  actionBtn.disabled = true;
  progressBar.style.display = 'block';
  statusText.textContent = 'Downloading and patching files...';

  window.patcher.onDownloadProgress((data) => {
    fileName.textContent = `Downloading: ${data.fileName}`;
    progressFill.style.width = `${data.progress}%`;
    progressFill.textContent = `${data.progress}%`;
  });

  window.patcher.onFileCompleted((data) => {
    statusText.textContent = `Patching... (${data.completed}/${data.total})`;
  });

  const result = await window.patcher.patchFiles(currentUpdates, selectedPath);

  if (result.success) {
    statusText.textContent = '✓ Patching completed successfully!';
    fileName.textContent = `All ${currentUpdates.length} file(s) have been patched`;
    progressFill.style.width = '100%';
    progressFill.textContent = '100%';
    
    setTimeout(() => {
      progressBar.style.display = 'none';
      fileName.textContent = '';
      actionBtn.textContent = 'Check for Updates';
      actionBtn.disabled = false;
      isPatching = false;
      currentUpdates = [];
    }, 3000);
  } else {
    statusText.textContent = `Error during patching`;
    fileName.textContent = result.error;
    fileName.style.color = '#ff6b6b';
    fileName.style.fontSize = '13px';
    fileName.style.marginTop = '10px';
    progressBar.style.display = 'none';
    actionBtn.disabled = false;
  }
}