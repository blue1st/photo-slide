const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const tagCache = new Map();

async function fetchTagsFromFile(filePath) {
  if (tagCache.has(filePath)) return tagCache.get(filePath);

  try {
    const { stdout } = await execPromise(`xattr -p com.apple.metadata:_kMDItemUserTags "${filePath}"`);
    const tags = stdout.trim() ? stdout.trim().split(',') : [];
    tagCache.set(filePath, tags);
    return tags;
  } catch (error) {
    tagCache.set(filePath, []);
    return [];
  }
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('get-tags', async (event, filePath) => {
  return await fetchTagsFromFile(filePath);
});

ipcMain.handle('set-tags', async (event, { filePath, tags }) => {
  const tagString = tags.join(',');
  try {
    await execPromise(`xattr -w com.apple.metadata:_kMDItemUserTags "${tagString}" "${filePath}"`);
    tagCache.set(filePath, tags);
    return true;
  } catch (error) {
    return false;
  }
});

ipcMain.handle('get-all-tags', async (event, { imagePaths }) => {
  const results = {};
  for (const filePath of imagePaths) {
    results[filePath] = await fetchTagsFromFile(filePath);
  }
  return results;
});

ipcMain.handle('open-directory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (canceled) return null;
  return filePaths[0];
});

ipcMain.handle('read-images', async (event, dirPath) => {
  const files = fs.readdirSync(dirPath);
  return files
    .filter(file => /\.(jpg|jpeg|png|gif|webp|jfif|avif|bmp|svg|ico|pjpeg|pjp)$/i.test(file))
    .map(file => path.join(dirPath, file));
});

// ファイル名変更
ipcMain.handle('rename-file', async (event, { oldPath, newName }) => {
  try {
    const dir = path.dirname(oldPath);
    const ext = path.extname(oldPath);
    const newPath = path.join(dir, newName + ext);
    
    if (fs.existsSync(newPath)) {
      throw new Error('同じ名前のファイルが既に存在します');
    }
    
    fs.renameSync(oldPath, newPath);
    return { success: true, newPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
