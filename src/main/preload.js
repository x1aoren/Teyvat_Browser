const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API到渲染进程
contextBridge.exposeInMainWorld('electron', {
  // 发送消息到主进程
  send: (channel, data) => {
    const validChannels = ['toggle-browser', 'update-shortcuts', 'adjust-opacity'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  // 监听主进程消息
  receive: (channel, func) => {
    const validChannels = ['browser-visibility-changed', 'browser-opacity-changed', 'shortcut-triggered', 'navigate'];
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