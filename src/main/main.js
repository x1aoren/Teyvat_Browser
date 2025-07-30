const { app, BrowserWindow, ipcMain, Menu, globalShortcut, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');

// 防抖工具函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 配置存储
const store = new Store({
  defaults: {
    mainWindowBounds: { width: 800, height: 600 },
    browserWindowBounds: { width: 400, height: 300, x: 50, y: 50 },
    shortcuts: {
      toggleBrowser: 'Insert',
      playPause: 'Space',
      rewind: 'Left',
      forward: 'Right',
      increaseOpacity: 'Control+Up',
      decreaseOpacity: 'Control+Down'
    },
    browserOpacity: 0.8,
  }
});

// 主窗口和播放器窗口
let mainWindow = null;
let browserWindow = null;

function createMainWindow() {
  const { width, height } = store.get('mainWindowBounds');

  mainWindow = new BrowserWindow({
    width,
    height,
    title: '提瓦特浏览器 - 控制台',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('resize', () => {
    const { width, height } = mainWindow.getBounds();
    store.set('mainWindowBounds', { width, height });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    // 主窗口关闭时，也关闭播放器窗口
    if (browserWindow) {
      browserWindow.close();
    }
  });

  createMenu();
  registerGlobalShortcuts();
}

// 创建播放器窗口
function createBrowserWindow() {
  if (browserWindow) {
    browserWindow.focus();
    return;
  }
  
  let { width, height, x, y } = store.get('browserWindowBounds');

  // 验证窗口大小，避免为0
  if (!width || !height) {
    const defaultBounds = store.get('defaults.browserWindowBounds');
    width = defaultBounds.width;
    height = defaultBounds.height;
  }
  
  // 检查窗口是否在屏幕内
  const displays = screen.getAllDisplays();
  const aDisplay = displays.find(d => {
    return x >= d.bounds.x && y >= d.bounds.y &&
           x + width <= d.bounds.x + d.bounds.width &&
           y + height <= d.bounds.y + d.bounds.height;
  });

  if (!aDisplay) {
    // 如果窗口不在任何一个屏幕内，重置到主屏幕的中央
    const primaryDisplay = screen.getPrimaryDisplay();
    x = primaryDisplay.bounds.x + (primaryDisplay.bounds.width - width) / 2;
    y = primaryDisplay.bounds.y + (primaryDisplay.bounds.height - height) / 2;
  }
  
  browserWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    title: '提瓦特浏览器',
    frame: true, // 使用原生边框
    transparent: false, // 禁用透明
    alwaysOnTop: true, // 始终置顶
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  browserWindow.loadURL('https://www.bilibili.com');
  
  browserWindow.once('ready-to-show', () => {
    browserWindow.show();
  });
  
  // 设置透明度
  browserWindow.setOpacity(store.get('browserOpacity'));

  browserWindow.on('resize', () => {
    const { width, height } = browserWindow.getBounds();
    store.set('browserWindowBounds', { ...store.get('browserWindowBounds'), width, height });
  });

  browserWindow.on('move', () => {
    const { x, y } = browserWindow.getBounds();
    store.set('browserWindowBounds', { ...store.get('browserWindowBounds'), x, y });
  });

  browserWindow.on('closed', () => {
    browserWindow = null;
    if (mainWindow) {
      mainWindow.webContents.send('browser-window-closed');
    }
  });
  
  if (mainWindow) {
    mainWindow.webContents.send('browser-window-created');
  }
  
  // 监听最小化和恢复事件，以动态更新快捷键
  browserWindow.on('minimize', () => registerShortcuts());
  browserWindow.on('restore', () => registerShortcuts());
}

function toggleBrowserVisibility() {
  if (browserWindow) {
    if (browserWindow.isVisible()) {
      browserWindow.hide();
      if (mainWindow) {
        mainWindow.webContents.send('browser-window-closed');
      }
    } else {
      browserWindow.show();
      if (mainWindow) {
        mainWindow.webContents.send('browser-window-created');
      }
    }
    registerShortcuts(); // 切换可见性后重新注册快捷键
  } else {
    createBrowserWindow();
  }
}

// 最小化或恢复浏览器窗口
function minimizeOrRestoreBrowserWindow() {
  if (browserWindow && browserWindow.isVisible()) {
    if (browserWindow.isMinimized()) {
      browserWindow.restore();
    } else {
      browserWindow.minimize();
    }
  }
}
const debouncedMinimizeOrRestore = debounce(minimizeOrRestoreBrowserWindow, 300);

function adjustBrowserOpacity(delta) {
  if (!browserWindow) return;
  
  let opacity = browserWindow.getOpacity();
  opacity = Math.max(0.2, Math.min(1.0, parseFloat((opacity + delta).toFixed(1))));
  store.set('browserOpacity', opacity);
  browserWindow.setOpacity(opacity);
  
  if (mainWindow) {
    mainWindow.webContents.send('browser-opacity-changed', opacity);
  }
}

const mediaActions = {
  playPause: `
    const video = document.querySelector('video');
    if (video) {
      if (video.paused) video.play(); else video.pause();
      true;
    } else { false; }
  `,
  rewind: `
    const video = document.querySelector('video');
    if (video) { video.currentTime -= 5; true; } else { false; }
  `,
  forward: `
    const video = document.querySelector('video');
    if (video) { video.currentTime += 5; true; } else { false; }
  `
};

// 创建应用菜单
function createMenu() {
  const shortcuts = store.get('shortcuts');
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          click: () => { app.quit(); }
        }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '打开/关闭浏览器',
          click: () => { toggleBrowserVisibility(); }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
      ]
    },
    {
      label: '控制',
      submenu: [
        {
          label: '播放/暂停',
          accelerator: shortcuts.playPause,
          click: () => {
            if (browserWindow) {
              browserWindow.webContents.executeJavaScript(mediaActions.playPause)
                .then(result => {
                  if (result && mainWindow) mainWindow.webContents.send('shortcut-triggered', 'playPause');
                })
                .catch(err => console.error('Failed to execute play/pause action:', err));
            }
          }
        },
        {
          label: '后退',
          accelerator: shortcuts.rewind,
          click: () => {
            if (browserWindow) {
              browserWindow.webContents.executeJavaScript(mediaActions.rewind)
                .then(result => {
                  if (result && mainWindow) mainWindow.webContents.send('shortcut-triggered', 'rewind');
                })
                .catch(err => console.error('Failed to execute rewind action:', err));
            }
          }
        },
        {
          label: '前进',
          accelerator: shortcuts.forward,
          click: () => {
            if (browserWindow) {
              browserWindow.webContents.executeJavaScript(mediaActions.forward)
                .then(result => {
                  if (result && mainWindow) mainWindow.webContents.send('shortcut-triggered', 'forward');
                })
                .catch(err => console.error('Failed to execute forward action:', err));
            }
          }
        }
      ]
    },
    {
      label: '设置',
      submenu: [
        {
          label: '快捷键设置',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('navigate', 'settings');
          }
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('navigate', 'about');
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 注册全局快捷键
function registerGlobalShortcuts() {
  const shortcuts = store.get('shortcuts');
  
  globalShortcut.unregisterAll();
  
  if (shortcuts.toggleBrowser) {
    globalShortcut.register(shortcuts.toggleBrowser, debouncedMinimizeOrRestore);
  }
  
  if (shortcuts.increaseOpacity) {
    globalShortcut.register(shortcuts.increaseOpacity, () => adjustBrowserOpacity(0.1));
  }
  
  if (shortcuts.decreaseOpacity) {
    globalShortcut.register(shortcuts.decreaseOpacity, () => adjustBrowserOpacity(-0.1));
  }
}

function registerShortcuts() {
  const shortcuts = store.get('shortcuts');
  globalShortcut.unregisterAll();

  // 切换快捷键改为调用最小化/恢复功能
  if (shortcuts.toggleBrowser) {
    globalShortcut.register(shortcuts.toggleBrowser, debouncedMinimizeOrRestore);
  }

  // 仅当浏览器窗口可见且未最小化时，才注册媒体控制快捷键
  if (browserWindow && browserWindow.isVisible() && !browserWindow.isMinimized()) {
    const mediaActions = {
      playPause: `
        const video = document.querySelector('video');
        if (video) {
          if (video.paused) video.play(); else video.pause();
          true;
        } else { false; }
      `,
      rewind: `
        const video = document.querySelector('video');
        if (video) { video.currentTime -= 5; true; } else { false; }
      `,
      forward: `
        const video = document.querySelector('video');
        if (video) { video.currentTime += 5; true; } else { false; }
      `
    };

    Object.keys(mediaActions).forEach(action => {
      if (shortcuts[action]) {
        globalShortcut.register(shortcuts[action], () => {
          if (browserWindow) {
            browserWindow.webContents.executeJavaScript(mediaActions[action])
              .then(result => {
                if (result && mainWindow) {
                  mainWindow.webContents.send('shortcut-triggered', action);
                }
              })
              .catch(err => {
                console.error(`快捷键脚本执行失败 (${action}):`, err.message);
              });
          }
        });
      }
    });

    if (shortcuts.increaseOpacity) {
      globalShortcut.register(shortcuts.increaseOpacity, () => adjustBrowserOpacity(0.1));
    }
    
    if (shortcuts.decreaseOpacity) {
      globalShortcut.register(shortcuts.decreaseOpacity, () => adjustBrowserOpacity(-0.1));
    }
  }
}

ipcMain.on('update-shortcuts', (_, newShortcuts) => {
  store.set('shortcuts', newShortcuts);
  registerGlobalShortcuts();
  createMenu();
});

ipcMain.on('toggle-browser', toggleBrowserVisibility);

ipcMain.on('adjust-opacity', (_, newOpacity) => {
  if (browserWindow) {
    store.set('browserOpacity', newOpacity);
    browserWindow.setOpacity(newOpacity);
  }
});

app.whenReady().then(() => {
  createMainWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
}); 