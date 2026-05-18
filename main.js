const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, execFile } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const execFilePromise = util.promisify(execFile);

const tagCache = new Map();

async function fetchTagsFromFilesBatch(filePaths) {
  const results = {};
  const filesToFetch = [];
  
  for (const fp of filePaths) {
    if (tagCache.has(fp)) {
      results[fp] = tagCache.get(fp);
    } else {
      filesToFetch.push(fp);
      results[fp] = []; // Default to empty array
    }
  }

  if (filesToFetch.length === 0) return results;

  const chunkSize = 500;
  for (let i = 0; i < filesToFetch.length; i += chunkSize) {
    const chunk = filesToFetch.slice(i, i + chunkSize);
    let stdout = '';
    try {
      const res = await execFilePromise('xattr', ['-p', 'com.apple.metadata:_kMDItemUserTags', ...chunk]);
      stdout = res.stdout;
    } catch (e) {
      stdout = e.stdout || '';
    }

    if (stdout) {
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        if (!line) continue;
        if (chunk.length === 1) {
          const tags = line.trim() ? line.trim().split(',') : [];
          results[chunk[0]] = tags;
        } else {
          const colonIndex = line.indexOf(': ');
          if (colonIndex !== -1) {
            const filePath = line.substring(0, colonIndex);
            const tagString = line.substring(colonIndex + 2);
            if (results[filePath] !== undefined) {
              results[filePath] = tagString.trim() ? tagString.trim().split(',') : [];
            }
          }
        }
      }
    }
    
    for (const fp of chunk) {
      tagCache.set(fp, results[fp]);
    }
  }

  return results;
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
  const res = await fetchTagsFromFilesBatch([filePath]);
  return res[filePath];
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
  return await fetchTagsFromFilesBatch(imagePaths);
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

// ファイル操作: コピー、移動、削除
ipcMain.handle('select-directory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'コピー・移動先のフォルダを選択'
  });
  if (canceled) return null;
  return filePaths[0];
});

ipcMain.handle('copy-file', async (event, { src, destDir }) => {
  try {
    const fileName = path.basename(src);
    const destPath = path.join(destDir, fileName);
    fs.copyFileSync(src, destPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('move-file', async (event, { src, destDir }) => {
  try {
    const fileName = path.basename(src);
    const destPath = path.join(destDir, fileName);
    fs.renameSync(src, destPath);
    return { success: true, destPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-file', async (event, src) => {
  try {
    fs.unlinkSync(src);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('trash-file', async (event, src) => {
  try {
    const { shell } = require('electron');
    await shell.trashItem(src);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

