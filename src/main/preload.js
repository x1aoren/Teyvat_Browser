const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API到渲染进程
contextBridge.exposeInMainWorld('electron', {
  // 从渲染器到主进程
  send: (channel, data) => {
    const validChannels = ['toggle-browser', 'adjust-opacity', 'update-shortcuts', 'navigate-browser', 'get-initial-settings', 'set-gpu-acceleration', 'open-external-link'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  // 监听主进程消息
  receive: (channel, func) => {
    const validChannels = ['browser-window-created', 'browser-window-closed', 'browser-opacity-changed', 'shortcut-triggered', 'navigate', 'initial-settings'];
    if (validChannels.includes(channel)) {
      // 删除旧的事件监听器以避免重复
      ipcRenderer.removeAllListeners(channel);
      // 添加新的事件监听器
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  // 获取版本信息
  getAppVersion: () => {
    return process.env.npm_package_version || '1.0.0';
  }
}); 