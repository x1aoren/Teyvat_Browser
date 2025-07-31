const path = require('path');

let native = null;

try {
  // 尝试加载编译后的C++模块
  native = require('../build/Release/high_priority_shortcut.node');
} catch (err) {
  // 如果加载失败，给出错误信息
  console.error('Failed to load high_priority_shortcut module:', err);
  // 提供回退实现
  native = {
    start: () => { console.warn('C++ module not available, shortcuts disabled'); },
    stop: () => { console.warn('C++ module not available'); }
  };
}

// 包装函数以提供更友好的API
const api = {
  installHook: function(callback) {
    if (!native || !native.start) {
      throw new Error('C++ module not available');
    }
    this.callback = callback;
  },
  
  registerShortcuts: function(shortcuts) {
    if (!native || !native.start) {
      console.warn('C++ module not available, shortcuts registration skipped');
      return;
    }
    
    if (!this.callback) {
      throw new Error('必须先调用installHook()设置回调函数');
    }
    
    // 停止之前的监听
    native.stop();
    
    // 启动新的快捷键监听
    native.start(shortcuts, this.callback);
  },
  
  uninstallHook: function() {
    if (native && native.stop) {
      native.stop();
    }
    this.callback = null;
  }
};

module.exports = api;