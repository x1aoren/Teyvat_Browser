const { app, BrowserWindow, ipcMain, Menu, globalShortcut, screen, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');

// 尝试加载C++模块
let highPriorityShortcut = null;
let highPriorityTopmost = null;
try {
  highPriorityShortcut = require('../native/lib/binding.js');
  console.log('Successfully loaded high-priority shortcut module');
} catch (err) {
  console.log('Failed to load high-priority shortcut module:', err);
  // 提供一个后备实现，避免破坏应用功能
  highPriorityShortcut = {
    installHook: () => { console.warn('C++ shortcuts not available, using fallback'); },
    registerShortcuts: () => { console.warn('C++ shortcuts not available'); },
    uninstallHook: () => { console.warn('C++ shortcuts not available'); }
  };
}

try {
  highPriorityTopmost = require('../native/lib/topmost.js');
  console.log('Successfully loaded high-priority topmost module');
} catch (err) {
  console.log('Failed to load high-priority topmost module:', err);
  // 提供一个后备实现
  highPriorityTopmost = {
    startMonitoring: () => { console.warn('C++ topmost not available'); return false; },
    stopMonitoring: () => { console.warn('C++ topmost not available'); return false; },
    setTopmost: () => { console.warn('C++ topmost not available'); return false; },
    isAvailable: () => false
  };
}

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
      decreaseOpacity: 'Control+Down',
      // 鼠标侧键示例（可选，用户可自定义）
      // mouseSide1Action: 'XButton1',  // 鼠标侧键1
      // mouseSide2Action: 'Shift+XButton2',  // Shift+鼠标侧键2
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

// 快捷键处理函数
function handleShortcut(action) {
  console.log('Shortcut triggered:', action);
  
  switch (action) {
    case 'toggleBrowser':
      toggleBrowserVisibility();
      break;
    case 'playPause':
    case 'rewind':
    case 'forward':
      executeMediaAction(action);
      break;
    case 'increaseOpacity':
      adjustBrowserOpacity(0.1);
      break;
    case 'decreaseOpacity':
      adjustBrowserOpacity(-0.1);
      break;
    default:
      console.log('Unknown shortcut action:', action);
  }
}

// 执行媒体操作
function executeMediaAction(action) {
  if (!browserWindow) {
    console.log('Browser window not available for media action:', action);
    return;
  }

  // 检查浏览器窗口是否有效
  if (browserWindow.isDestroyed()) {
    console.log('Browser window is destroyed');
    return;
  }

  // 确保浏览器窗口可见并获得焦点
  try {
    if (!browserWindow.isVisible()) {
      browserWindow.show();
    }
    if (browserWindow.isMinimized()) {
      browserWindow.restore();
    }
  } catch (err) {
    console.error('Failed to manage browser window:', err);
    return;
  }

  // 向浏览器窗口发送媒体控制指令
  switch (action) {
    case 'playPause':
      executeMediaScript(`
        (function() {
          try {
            // 尝试查找B站播放器的播放/暂停按钮
            const bilibiliPlayBtn = document.querySelector('.bpx-player-ctrl-play, .bilibili-player-video-btn-start');
            if (bilibiliPlayBtn) {
              bilibiliPlayBtn.click();
              return 'B站播放器: 播放/暂停';
            } else {
              // 通用视频元素控制
              const videos = document.querySelectorAll('video');
              if (videos.length > 0) {
                const video = videos[0];
                if (video.paused) {
                  video.play();
                  return '通用视频: 播放';
                } else {
                  video.pause();
                  return '通用视频: 暂停';
                }
              } else {
                return '未找到可控制的媒体元素';
              }
            }
          } catch (e) {
            return 'Error: ' + e.message;
          }
        })();
      `, action);
      break;

    case 'rewind':
      executeMediaScript(`
        (function() {
          try {
            const videos = document.querySelectorAll('video');
            if (videos.length > 0) {
              const video = videos[0];
              video.currentTime = Math.max(0, video.currentTime - 5);
              return '视频后退5秒';
            } else {
              return '未找到视频元素';
            }
          } catch (e) {
            return 'Error: ' + e.message;
          }
        })();
      `, action);
      break;

    case 'forward':
      executeMediaScript(`
        (function() {
          try {
            const videos = document.querySelectorAll('video');
            if (videos.length > 0) {
              const video = videos[0];
              video.currentTime = Math.min(video.duration || video.currentTime + 5, video.currentTime + 5);
              return '视频快进5秒';
            } else {
              return '未找到视频元素';
            }
          } catch (e) {
            return 'Error: ' + e.message;
          }
        })();
      `, action);
      break;

    default:
      console.log('Unknown media action:', action);
  }
}

// 安全执行媒体脚本的辅助函数
function executeMediaScript(script, action) {
  if (!browserWindow || browserWindow.isDestroyed()) {
    console.log('Browser window unavailable for', action);
    return;
  }

  browserWindow.webContents.executeJavaScript(script)
    .then(result => {
      console.log('Media action result:', result);
    })
    .catch(err => {
      console.error(`媒体控制失败 (${action}):`, err.message);
      // 尝试重新获得窗口焦点
      try {
        if (browserWindow && !browserWindow.isDestroyed()) {
          browserWindow.focus();
        }
      } catch (focusErr) {
        console.error('Failed to focus browser window:', focusErr.message);
      }
    });
}

// 初始化C++快捷键模块
function initializeHighPriorityShortcuts() {
  if (!highPriorityShortcut) {
    console.log('Using fallback Electron shortcuts');
    return false;
  }
  
  try {
    // 安装钩子
    highPriorityShortcut.installHook((action) => {
      handleShortcut(action);
    });
    
    // 注册快捷键
    const shortcuts = store.get('shortcuts');
    highPriorityShortcut.registerShortcuts(shortcuts);
    
    console.log('High-priority shortcuts initialized successfully');
    return true;
  } catch (err) {
    console.error('Failed to initialize high-priority shortcuts:', err);
    return false;
  }
}

// 更新快捷键
function updateShortcuts(newShortcuts) {
  store.set('shortcuts', newShortcuts);
  
  if (highPriorityShortcut) {
    try {
      highPriorityShortcut.registerShortcuts(newShortcuts);
      console.log('Shortcuts updated successfully');
    } catch (err) {
      console.error('Failed to update shortcuts:', err);
    }
  }
}

function createMainWindow() {
  const { width, height } = store.get('mainWindowBounds');

  mainWindow = new BrowserWindow({
    width,
    height,
    title: '提瓦特浏览器 - 控制台',
    icon: path.join(__dirname, '../renderer/assets/logo.png'), // 设置窗口图标
    alwaysOnTop: false, // 确保主窗口不置顶
    skipTaskbar: false, // 确保在任务栏显示
    show: true, // 确保窗口显示
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.removeMenu(); // 彻底移除菜单栏，包括Electron默认的菜单

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
  
  // 确保主窗口在任务栏正常显示且不被置顶
  mainWindow.once('ready-to-show', () => {
    mainWindow.setSkipTaskbar(false);
    mainWindow.setAlwaysOnTop(false);
    console.log('Main window configured: taskbar=true, topmost=false');
  });
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
    fullscreenable: false, // 禁止窗口进入OS全屏，以优化网页内视频的全屏体验
    icon: path.join(__dirname, '../renderer/assets/logo.png'), // 设置窗口图标
    alwaysOnTop: false, // 初始不置顶，由高级置顶模块控制
    skipTaskbar: false, // 在任务栏显示浏览器窗口
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  browserWindow.once('ready-to-show', () => {
    browserWindow.show();
    
    console.log('Browser window ready, setting topmost');
    
    // 设置浏览器窗口置顶
    setBrowserWindowTopmost();
    
    // 确保主窗口不置顶
    if (mainWindow) {
      mainWindow.setAlwaysOnTop(false);
      console.log('Main window topmost disabled');
    }
    
    // 启用高级置顶功能（如果可用，延迟启动）
    if (highPriorityTopmost && highPriorityTopmost.isAvailable()) {
      setTimeout(() => {
        console.log('Starting advanced topmost monitoring');
        try {
          const result = startAdvancedTopmost();
          console.log('Advanced topmost result:', result);
        } catch (err) {
          console.error('Advanced topmost error:', err);
        }
      }, 2000);
    }
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
    // 停止topmost监控
    if (highPriorityTopmost && highPriorityTopmost.isAvailable()) {
      try {
        highPriorityTopmost.stopMonitoring();
        console.log('Stopped topmost monitoring for browser window');
      } catch (err) {
        console.error('Error stopping topmost monitoring:', err);
      }
    }
    
    browserWindow = null;
    if (mainWindow) {
      mainWindow.webContents.send('browser-window-closed');
    }
  });
  
  if (mainWindow) {
    mainWindow.webContents.send('browser-window-created');
  }
  

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

// 启动高级置顶功能（带重试机制）
function startAdvancedTopmost(retryCount = 3) {
  if (!browserWindow || !highPriorityTopmost || !highPriorityTopmost.isAvailable()) {
    return false;
  }
  
  // 获取所有可见窗口用于调试
  try {
    const allWindows = highPriorityTopmost.getVisibleWindows();
    console.log('Available windows:', allWindows.map(w => w.title).slice(0, 5)); // 只显示前5个
    
    // 尝试多种窗口标题匹配策略
    const actualTitle = browserWindow.getTitle();
    console.log('Current browser window title:', actualTitle);
    
    const titleVariants = [
      actualTitle,             // 当前网页的实际标题
      '提瓦特浏览器',           // 原始中文标题
      'Teyvat Browser',        // 英文标题
      'Teyvat'                // 部分匹配
    ];
    
    let success = false;
    for (const title of titleVariants) {
      if (title && title.trim()) {
        try {
          console.log(`Trying to monitor window with title: "${title}"`);
          success = highPriorityTopmost.startMonitoring(title);
          if (success) {
            console.log(`Advanced topmost monitoring started successfully with title: "${title}"`);
            break;
          }
        } catch (err) {
          console.log(`Failed to monitor "${title}":`, err.message);
        }
      }
    }
    
    if (success) {
      return true;
    } else if (retryCount > 0) {
      console.log(`Retrying advanced topmost in 2 seconds... (${retryCount} attempts left)`);
      setTimeout(() => startAdvancedTopmost(retryCount - 1), 2000);
      return false;
    } else {
      console.log('All advanced topmost attempts failed, using basic topmost');
      browserWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      return false;
    }
  } catch (err) {
    console.error('Error in startAdvancedTopmost:', err);
    // 确保基本置顶功能
    browserWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    return false;
  }
}

// 简单设置浏览器窗口置顶
function setBrowserWindowTopmost() {
  if (!browserWindow || browserWindow.isDestroyed()) {
    console.log('Browser window not available');
    return false;
  }
  
  console.log('Setting browser window topmost');
  browserWindow.setAlwaysOnTop(true);
  console.log('Browser window topmost status:', browserWindow.isAlwaysOnTop());
  
  return browserWindow.isAlwaysOnTop();
}

// 简化的置顶功能控制（仅针对浏览器窗口）
function toggleAdvancedTopmost(enable = null) {
  if (!browserWindow) {
    console.log('No browser window to apply topmost');
    return false;
  }
  
  const currentTopmost = store.get('advancedTopmost', true);
  const newTopmost = enable !== null ? enable : !currentTopmost;
  
  store.set('advancedTopmost', newTopmost);
  
  if (newTopmost) {
    // 设置基本置顶
    setBrowserWindowTopmost();
    
    // 尝试高级置顶（如果可用）
    if (highPriorityTopmost && highPriorityTopmost.isAvailable()) {
      try {
        const result = startAdvancedTopmost();
        console.log('Advanced topmost result:', result);
      } catch (err) {
        console.error('Error with advanced topmost:', err);
      }
    }
    return true;
  } else {
    // 禁用置顶
    if (highPriorityTopmost && highPriorityTopmost.isAvailable()) {
      highPriorityTopmost.stopMonitoring();
    }
    browserWindow.setAlwaysOnTop(false);
    console.log('Topmost disabled for browser window');
    return true;
  }
}





ipcMain.on('update-shortcuts', (_, newShortcuts) => {
  updateShortcuts(newShortcuts);
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

ipcMain.on('open-external-link', (event, url) => {
  shell.openExternal(url);
});

ipcMain.on('set-gpu-acceleration', (event, enabled) => {
  store.set('enableGpuAcceleration', enabled);
});

ipcMain.on('toggle-advanced-topmost', (event, enabled) => {
  const success = toggleAdvancedTopmost(enabled);
  event.reply('advanced-topmost-result', {
    success,
    enabled: store.get('advancedTopmost', true),
    hasModule: highPriorityTopmost && highPriorityTopmost.isAvailable()
  });
});

ipcMain.on('get-topmost-status', (event) => {
  event.reply('topmost-status', {
    enabled: store.get('advancedTopmost', true),
    hasModule: highPriorityTopmost && highPriorityTopmost.isAvailable(),
    isWindowTopmost: browserWindow ? browserWindow.isAlwaysOnTop() : false
  });
});

app.whenReady().then(() => {
  createMainWindow();
  initializeHighPriorityShortcuts();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // 清理快捷键资源
  if (highPriorityShortcut) {
    try {
      highPriorityShortcut.uninstallHook();
    } catch (err) {
      console.error('Failed to uninstall shortcut hook:', err);
    }
  }
  
  // 清理topmost监控资源
  if (highPriorityTopmost && highPriorityTopmost.isAvailable()) {
    try {
      highPriorityTopmost.stopMonitoring();
      console.log('Cleaned up topmost monitoring resources');
    } catch (err) {
      console.error('Failed to cleanup topmost resources:', err);
    }
  }
  
  globalShortcut.unregisterAll();
});