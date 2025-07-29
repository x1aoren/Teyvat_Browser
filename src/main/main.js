const { app, BrowserWindow, BrowserView, ipcMain, Menu, globalShortcut } = require('electron');
const path = require('path');
const Store = require('electron-store');

// 配置存储
const store = new Store({
  defaults: {
    windowBounds: { width: 1000, height: 800 },
    shortcuts: {
      toggleBrowser: 'Insert',
      playPause: 'Space',
      rewind: 'Left',
      forward: 'Right',
      increaseOpacity: 'Control+Up',
      decreaseOpacity: 'Control+Down'
    },
    browserOpacity: 0.8,
    browserVisible: false
  }
});

// 主窗口
let mainWindow = null;
// 浏览器视图
let browserView = null;

function createWindow() {
  // 从配置中恢复窗口尺寸
  const { width, height } = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width,
    height,
    title: '提瓦特浏览器',
    icon: path.join(__dirname, '../renderer/assets/icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // 加载主页面
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // 窗口尺寸变化时存储配置
  mainWindow.on('resize', () => {
    const { width, height } = mainWindow.getBounds();
    store.set('windowBounds', { width, height });
  });

  // 创建菜单
  createMenu();

  // 注册全局快捷键
  registerShortcuts();
  
  // 创建浏览器视图
  createBrowserView();
}

// 创建浏览器视图
function createBrowserView() {
  if (mainWindow === null) return;
  
  browserView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  mainWindow.setBrowserView(browserView);
  
  // 设置浏览器视图的初始大小和位置
  const contentBounds = mainWindow.getContentBounds();
  browserView.setBounds({
    x: 0,
    y: 80,
    width: contentBounds.width,
    height: contentBounds.height - 80
  });
  
  // 设置浏览器视图的透明度
  const opacity = store.get('browserOpacity');
  browserView.webContents.executeJavaScript(`
    document.documentElement.style.opacity = ${opacity};
  `);
  
  // 加载B站
  browserView.webContents.loadURL('https://www.bilibili.com');
  
  // 初始化隐藏浏览器视图
  const isVisible = store.get('browserVisible');
  toggleBrowserVisibility(isVisible);
  
  // 窗口大小变化时调整浏览器视图大小
  mainWindow.on('resize', () => {
    if (!browserView) return;
    const contentBounds = mainWindow.getContentBounds();
    browserView.setBounds({
      x: 0,
      y: 80,
      width: contentBounds.width,
      height: contentBounds.height - 80
    });
  });
}

// 切换浏览器视图的可见性
function toggleBrowserVisibility(visible = null) {
  if (!browserView) return;
  
  const newVisibility = visible !== null ? visible : !store.get('browserVisible');
  store.set('browserVisible', newVisibility);
  
  if (newVisibility) {
    browserView.webContents.executeJavaScript(`
      document.documentElement.style.opacity = ${store.get('browserOpacity')};
    `);
  } else {
    browserView.webContents.executeJavaScript(`
      document.documentElement.style.opacity = 0;
    `);
  }
  
  // 通知渲染进程更新UI
  if (mainWindow) {
    mainWindow.webContents.send('browser-visibility-changed', newVisibility);
  }
}

// 调整浏览器视图的透明度
function adjustBrowserOpacity(delta) {
  if (!browserView) return;
  
  let opacity = store.get('browserOpacity');
  opacity = Math.max(0.2, Math.min(1.0, opacity + delta));
  store.set('browserOpacity', opacity);
  
  if (store.get('browserVisible')) {
    browserView.webContents.executeJavaScript(`
      document.documentElement.style.opacity = ${opacity};
    `);
  }
  
  // 通知渲染进程更新UI
  if (mainWindow) {
    mainWindow.webContents.send('browser-opacity-changed', opacity);
  }
}

// 创建应用菜单
function createMenu() {
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
          label: '显示/隐藏浏览器',
          click: () => { toggleBrowserVisibility(); }
        },
        {
          label: '刷新',
          accelerator: 'CmdOrCtrl+R',
          click: (_, focusedWindow) => {
            if (focusedWindow) focusedWindow.reload();
          }
        },
        {
          label: '开发者工具',
          accelerator: 'F12',
          click: (_, focusedWindow) => {
            if (focusedWindow) focusedWindow.webContents.toggleDevTools();
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
function registerShortcuts() {
  const shortcuts = store.get('shortcuts');
  
  // 取消注册所有快捷键
  globalShortcut.unregisterAll();
  
  // 注册显示/隐藏浏览器快捷键
  if (shortcuts.toggleBrowser) {
    globalShortcut.register(shortcuts.toggleBrowser, () => {
      toggleBrowserVisibility();
    });
  }
  
  // 注册播放/暂停快捷键
  if (shortcuts.playPause) {
    globalShortcut.register(shortcuts.playPause, () => {
      if (browserView && store.get('browserVisible')) {
        browserView.webContents.executeJavaScript(`
          (function() {
            const video = document.querySelector('video');
            if (video) {
              if (video.paused) video.play();
              else video.pause();
              return true;
            }
            return false;
          })();
        `).then(result => {
          if (result) {
            mainWindow.webContents.send('shortcut-triggered', 'playPause');
          }
        });
      }
    });
  }
  
  // 注册后退快捷键
  if (shortcuts.rewind) {
    globalShortcut.register(shortcuts.rewind, () => {
      if (browserView && store.get('browserVisible')) {
        browserView.webContents.executeJavaScript(`
          (function() {
            const video = document.querySelector('video');
            if (video) {
              video.currentTime = Math.max(0, video.currentTime - 5);
              return true;
            }
            return false;
          })();
        `).then(result => {
          if (result) {
            mainWindow.webContents.send('shortcut-triggered', 'rewind');
          }
        });
      }
    });
  }
  
  // 注册前进快捷键
  if (shortcuts.forward) {
    globalShortcut.register(shortcuts.forward, () => {
      if (browserView && store.get('browserVisible')) {
        browserView.webContents.executeJavaScript(`
          (function() {
            const video = document.querySelector('video');
            if (video) {
              video.currentTime += 5;
              return true;
            }
            return false;
          })();
        `).then(result => {
          if (result) {
            mainWindow.webContents.send('shortcut-triggered', 'forward');
          }
        });
      }
    });
  }
  
  // 注册增加透明度快捷键
  if (shortcuts.increaseOpacity) {
    globalShortcut.register(shortcuts.increaseOpacity, () => {
      adjustBrowserOpacity(0.1);
      mainWindow.webContents.send('shortcut-triggered', 'increaseOpacity');
    });
  }
  
  // 注册减少透明度快捷键
  if (shortcuts.decreaseOpacity) {
    globalShortcut.register(shortcuts.decreaseOpacity, () => {
      adjustBrowserOpacity(-0.1);
      mainWindow.webContents.send('shortcut-triggered', 'decreaseOpacity');
    });
  }
}

// 监听快捷键更新事件
ipcMain.on('update-shortcuts', (_, newShortcuts) => {
  store.set('shortcuts', newShortcuts);
  registerShortcuts();
});

// 监听浏览器视图切换事件
ipcMain.on('toggle-browser', () => {
  toggleBrowserVisibility();
});

// 监听调整透明度事件
ipcMain.on('adjust-opacity', (_, delta) => {
  adjustBrowserOpacity(delta);
});

// 应用准备就绪时创建窗口
app.whenReady().then(createWindow);

// 所有窗口关闭时退出应用（macOS除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用激活且没有窗口时，创建窗口（macOS）
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 应用退出前取消注册所有快捷键
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
}); 