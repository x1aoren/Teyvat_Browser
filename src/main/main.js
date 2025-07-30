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
    browserWindowBounds: { width: 400, height: 720, x: 50, y: 50 },
    lastUrl: 'https://www.bilibili.com',
    shortcuts: {
      toggleBrowser: 'Insert',
      playPause: 'Shift+F1',
      rewind: 'Shift+F2',
      forward: 'Shift+F3',
      increaseOpacity: 'Control+Up',
      decreaseOpacity: 'Control+Down'
    },
    browserOpacity: 0.8,
    enableGpuAcceleration: false
  }
});

// 根据设置决定是否禁用GPU硬件加速
if (!store.get('enableGpuAcceleration')) {
  app.disableHardwareAcceleration();
}

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
function createBrowserWindow(url) {
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
    frame: true, // 改回带边框的窗口以确保稳定性
    transparent: false, // 禁用透明
    autoHideMenuBar: true, // 隐藏菜单栏 (文件, 视图等)
    alwaysOnTop: true, // 始终置顶
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  browserWindow.once('ready-to-show', () => {
    browserWindow.show();
  });
  
  const urlToLoad = url || store.get('lastUrl');
  browserWindow.loadURL(urlToLoad);
  store.set('lastUrl', urlToLoad);
  
  // 设置初始透明度
  browserWindow.setOpacity(store.get('browserOpacity'));

  // 根据焦点状态智能调整透明度
  browserWindow.on('focus', () => {
    browserWindow.setOpacity(1.0);
  });
  browserWindow.on('blur', () => {
    browserWindow.setOpacity(store.get('browserOpacity'));
  });

  // 使用防抖保存窗口位置和大小
  const debouncedSaveBounds = debounce(() => {
    const bounds = browserWindow.getBounds();
    store.set('browserWindowBounds', bounds);
  }, 500);

  browserWindow.on('resize', debouncedSaveBounds);
  browserWindow.on('move', debouncedSaveBounds);

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
    createBrowserWindow(); // 调用时不带URL，使用默认值
  }
}

// 快捷键功能：最小化/恢复/显示窗口
function handleToggleShortcut() {
  if (!browserWindow) {
    return; // 如果窗口不存在，则不执行任何操作
  }

  if (browserWindow.isMinimized()) {
    browserWindow.restore();
  } else if (!browserWindow.isVisible()) {
    browserWindow.show();
  } else {
    browserWindow.minimize();
  }
  
  // 确保窗口在操作后获得焦点
  if (browserWindow.isVisible() && !browserWindow.isMinimized()) {
    browserWindow.focus();
  }
}
const debouncedToggleShortcut = debounce(handleToggleShortcut, 150);

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
    globalShortcut.register(shortcuts.toggleBrowser, debouncedToggleShortcut);
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

  // 切换快捷键改为调用新的处理函数
  if (shortcuts.toggleBrowser) {
    globalShortcut.register(shortcuts.toggleBrowser, debouncedToggleShortcut);
  }

  // 仅当浏览器窗口可见且未最小化时，才注册媒体控制快捷键
  if (browserWindow && browserWindow.isVisible() && !browserWindow.isMinimized()) {
    const mediaActions = {
      playPause: `
        (() => {
          const playButton = document.querySelector('.bpx-player-ctrl-play');
          if (playButton) {
            playButton.click();
            return true;
          }
          const video = document.querySelector('video');
          if (video) {
            if (video.paused) video.play(); else video.pause();
            return true;
          }
          return false;
        })()
      `,
      rewind: `
        (() => {
          const video = document.querySelector('.bpx-player-video-wrap video, video');
          if (video) {
            video.currentTime = Math.max(0, video.currentTime - 5);
            return true;
          }
          return false;
        })()
      `,
      forward: `
        (() => {
          const video = document.querySelector('.bpx-player-video-wrap video, video');
          if (video) {
            video.currentTime += 5;
            return true;
          }
          return false;
        })()
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

ipcMain.on('navigate-browser', (event, url) => {
  if (browserWindow) {
    browserWindow.loadURL(url);
    store.set('lastUrl', url);
    // 确保窗口可见
    if (!browserWindow.isVisible()) browserWindow.show();
    if (browserWindow.isMinimized()) browserWindow.restore();
    browserWindow.focus();
  } else {
    // 如果窗口不存在，则创建并加载URL
    createBrowserWindow(url);
  }
});

ipcMain.on('adjust-opacity', (_, newOpacity) => {
  if (browserWindow) {
    store.set('browserOpacity', newOpacity);
    browserWindow.setOpacity(newOpacity);
  }
});

ipcMain.on('get-initial-settings', (event) => {
  event.reply('initial-settings', {
    shortcuts: store.get('shortcuts'),
    opacity: store.get('browserOpacity'),
    enableGpu: store.get('enableGpuAcceleration')
  });
});

ipcMain.on('set-gpu-acceleration', (event, enabled) => {
  store.set('enableGpuAcceleration', enabled);
});

app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
}); 