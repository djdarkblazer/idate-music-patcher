let currentUpdates = [];
let isPatching = false;

const statusText = document.getElementById('statusText');
const fileName = document.getElementById('fileName');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const actionBtn = document.getElementById('actionBtn');
const infoBox = document.getElementById('infoBox');

async function handleAction() {
  if (!isPatching) {
    await checkForUpdates();
  } else {
    await startPatching();
  }
}

async function checkForUpdates() {
  actionBtn.disabled = true;
  statusText.textContent = 'Checking for updates...';
  fileName.textContent = '';
  infoBox.style.display = 'none';

  const result = await window.patcher.checkUpdates();

  if (!result.success) {
    statusText.textContent = `Error: ${result.error}`;
    actionBtn.disabled = false;
    return;
  }

  currentUpdates = result.updates;

  if (currentUpdates.length === 0) {
    statusText.textContent = '✓ All files are up to date!';
    infoBox.style.display = 'block';
    infoBox.textContent = `Total files: ${result.totalFiles}`;
    actionBtn.disabled = false;
  } else {
    const newFiles = currentUpdates.filter(u => u.isNew).length;
    const updateFiles = currentUpdates.length - newFiles;
    
    statusText.textContent = `Found ${currentUpdates.length} file(s) to patch`;
    infoBox.style.display = 'block';
    infoBox.textContent = `New: ${newFiles} | Updates: ${updateFiles}`;
    
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

  const result = await window.patcher.patchFiles(currentUpdates);

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
    statusText.textContent = `Error: ${result.error}`;
    progressBar.style.display = 'none';
    actionBtn.disabled = false;
  }
}