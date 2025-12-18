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
  infoBox.classList.add('hidden');
}

async function browsePath() {
  const result = await window.patcher.browsePath();
  if (result) {
    selectedPath = result;
    pathInput.value = result;
    statusText.textContent = 'Path selected. Click "Check for Updates" to begin';
    fileName.textContent = '';
    infoBox.classList.add('hidden');
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
    statusText.textContent = '⚠️ Please select an installation path first';
    fileName.textContent = '';
    return;
  }

  actionBtn.disabled = true;
  statusText.textContent = '🔍 Checking for updates...';
  fileName.textContent = '';
  infoBox.classList.add('hidden');

  const result = await window.patcher.checkUpdates(selectedPath);

  if (!result.success) {
    statusText.textContent = `❌ Error: ${result.error}`;
    actionBtn.disabled = false;
    return;
  }

  currentUpdates = result.updates;

  if (currentUpdates.length === 0) {
    statusText.textContent = '✅ All files are up to date!';
    infoBox.classList.remove('hidden');
    infoBox.innerHTML = `
      <div class="font-semibold mb-2">📊 Summary</div>
      <div>Total files in repo: <span class="font-bold">${result.totalFiles}</span></div>
      <div class="text-green-300 mt-1">All files are already patched and up to date! 🎉</div>
    `;
    actionBtn.disabled = false;
  } else {
    statusText.textContent = `📦 Found ${currentUpdates.length} file(s) to patch`;
    infoBox.classList.remove('hidden');
    
    let infoHTML = `<div class="font-semibold mb-3">📊 Summary</div>`;
    if (result.newFiles.length > 0) {
      infoHTML += `
        <div class="text-left mb-2">
          <span class="font-semibold text-blue-300">📥 New files to download:</span> ${result.newFiles.length}
          <div class="text-xs opacity-80 mt-1 pl-4">${result.newFiles.join(', ')}</div>
        </div>
      `;
    }
    if (result.existingFiles.length > 0) {
      infoHTML += `
        <div class="text-left mb-2">
          <span class="font-semibold text-yellow-300">🔄 Files to update:</span> ${result.existingFiles.length}
          <div class="text-xs opacity-80 mt-1 pl-4">${result.existingFiles.join(', ')}</div>
        </div>
      `;
    }
    if (result.upToDateCount > 0) {
      infoHTML += `
        <div class="text-left">
          <span class="font-semibold text-green-300">✅ Up to date:</span> ${result.upToDateCount}
        </div>
      `;
    }
    
    infoBox.innerHTML = infoHTML;
    
    actionBtn.textContent = '🚀 Start Patching';
    actionBtn.disabled = false;
    isPatching = true;
  }
}

async function startPatching() {
  actionBtn.disabled = true;
  progressBar.classList.remove('hidden');
  statusText.textContent = '⬇️ Downloading and patching files...';

  window.patcher.onDownloadProgress((data) => {
    fileName.textContent = `📂 Downloading: ${data.fileName}`;
    progressFill.style.width = `${data.progress}%`;
    progressFill.textContent = `${data.progress}%`;
  });

  window.patcher.onFileCompleted((data) => {
    statusText.textContent = `⚙️ Patching... (${data.completed}/${data.total})`;
  });

  const result = await window.patcher.patchFiles(currentUpdates, selectedPath);

  if (result.success) {
    statusText.textContent = '✅ Patching completed successfully!';
    fileName.textContent = `🎉 All ${currentUpdates.length} file(s) have been patched`;
    fileName.classList.remove('text-red-400');
    fileName.classList.add('text-green-300');
    progressFill.style.width = '100%';
    progressFill.textContent = '100%';
    
    setTimeout(() => {
      progressBar.classList.add('hidden');
      fileName.textContent = '';
      fileName.classList.remove('text-green-300');
      actionBtn.textContent = 'Check for Updates';
      actionBtn.disabled = false;
      isPatching = false;
      currentUpdates = [];
    }, 3000);
  } else {
    statusText.textContent = `❌ Error during patching`;
    fileName.textContent = result.error;
    fileName.classList.add('text-red-400', 'text-sm', 'mt-2');
    progressBar.classList.add('hidden');
    actionBtn.disabled = false;
  }
}