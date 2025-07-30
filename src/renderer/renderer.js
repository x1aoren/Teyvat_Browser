// 提瓦特浏览器 - 渲染进程

// 当前活动视图
let currentView = 'homeView';

// DOM元素
const homeBtn = document.getElementById('homeBtn');
const toggleBrowserBtn = document.getElementById('toggleBrowserBtn');
const settingsBtn = document.getElementById('settingsBtn');
const aboutBtn = document.getElementById('aboutBtn');
const backBtn = document.getElementById('backBtn');
const aboutBackBtn = document.getElementById('aboutBackBtn');
const resetBtn = document.getElementById('resetBtn');
const opacitySlider = document.getElementById('opacitySlider');
const opacityValue = document.getElementById('opacityValue');
const decreaseOpacityBtn = document.getElementById('decreaseOpacityBtn');
const increaseOpacityBtn = document.getElementById('increaseOpacityBtn');

// 视图元素
const views = {
  homeView: document.getElementById('homeView'),
  settingsView: document.getElementById('settingsView'),
  aboutView: document.getElementById('aboutView')
};

// 快捷键配置
const defaultShortcuts = {
  toggleBrowser: 'Insert',
  playPause: 'Space',
  rewind: 'Left',
  forward: 'Right',
  increaseOpacity: 'Control+Up',
  decreaseOpacity: 'Control+Down'
};

let shortcuts = { ...defaultShortcuts };
let listeningForShortcut = false;
let currentShortcutButton = null;

// 初始化函数
function init() {
  // 设置事件监听器
  setupEventListeners();
  
  // 更新快捷键显示
  updateShortcutButtons();
  
  // 初始化透明度滑块
  opacitySlider.value = 0.8;
  opacityValue.textContent = opacitySlider.value;
}

// 设置事件监听器
function setupEventListeners() {
  // 浏览器控制按钮
  toggleBrowserBtn.addEventListener('click', () => {
    window.electron.send('toggle-browser');
  });
  
  // 导航按钮
  homeBtn.addEventListener('click', () => {
    showView('homeView');
  });
  
  settingsBtn.addEventListener('click', () => {
    showView('settingsView');
  });
  
  aboutBtn.addEventListener('click', () => {
    showView('aboutView');
  });
  
  backBtn.addEventListener('click', () => {
    showView('homeView');
  });
  
  aboutBackBtn.addEventListener('click', () => {
    showView('homeView');
  });
  
  // 重置按钮
  resetBtn.addEventListener('click', resetShortcuts);
  
  // 透明度控制
  opacitySlider.addEventListener('input', () => {
    const newOpacity = parseFloat(opacitySlider.value);
    opacityValue.textContent = newOpacity.toFixed(1);
    window.electron.send('adjust-opacity', newOpacity);
  });
  
  decreaseOpacityBtn.addEventListener('click', () => {
    let newOpacity = parseFloat(opacitySlider.value) - 0.1;
    newOpacity = Math.max(0.2, newOpacity);
    opacitySlider.value = newOpacity;
    opacitySlider.dispatchEvent(new Event('input'));
  });
  
  increaseOpacityBtn.addEventListener('click', () => {
    let newOpacity = parseFloat(opacitySlider.value) + 0.1;
    newOpacity = Math.min(1.0, newOpacity);
    opacitySlider.value = newOpacity;
    opacitySlider.dispatchEvent(new Event('input'));
  });
  
  // 快捷键设置按钮
  document.querySelectorAll('.shortcut-button').forEach(button => {
    button.addEventListener('click', () => {
      if (listeningForShortcut) return;
      
      startListeningForShortcut(button);
    });
  });
  
  // 主进程消息监听
  window.electron.receive('browser-window-closed', () => {
    updateBrowserButtonState(false);
  });
  
  window.electron.receive('browser-window-created', () => {
    updateBrowserButtonState(true);
  });
  
  window.electron.receive('browser-opacity-changed', (opacity) => {
    opacitySlider.value = opacity;
    opacityValue.textContent = opacity.toFixed(1);
  });
  
  window.electron.receive('shortcut-triggered', (action) => {
    highlightShortcutAction(action);
  });
  
  window.electron.receive('navigate', (view) => {
    showView(`${view}View`);
  });
}

// 显示指定视图
function showView(viewId) {
  if (!views[viewId]) return;
  
  // 隐藏所有视图
  Object.values(views).forEach(view => {
    view.classList.remove('active');
  });
  
  // 显示指定视图
  views[viewId].classList.add('active');
  currentView = viewId;
}

// 开始监听快捷键
function startListeningForShortcut(button) {
  if (listeningForShortcut) return;
  
  // 设置为监听状态
  listeningForShortcut = true;
  currentShortcutButton = button;
  button.classList.add('listening');
  const actionName = button.dataset.action;
  button.textContent = '按下新快捷键...';
  
  // 键盘监听函数
  const keydownListener = (e) => {
    // 阻止默认行为，例如按下空格键滚动页面
    e.preventDefault();

    // 忽略单独的修饰键事件
    const key = e.code;
    if (['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].includes(key)) {
      return;
    }
    
    // 构建快捷键字符串
    const modifiers = [];
    if (e.ctrlKey) modifiers.push('Control');
    if (e.shiftKey) modifiers.push('Shift');
    if (e.altKey) modifiers.push('Alt');
    if (e.metaKey) modifiers.push('Meta');

    // 格式化按键码
    let keyName = key.replace('Key', '').replace('Digit', '');
    if (keyName === 'Space') keyName = 'Space';
    else if (keyName === 'ArrowLeft') keyName = 'Left';
    else if (keyName === 'ArrowRight') keyName = 'Right';
    else if (keyName === 'ArrowUp') keyName = 'Up';
    else if (keyName === 'ArrowDown') keyName = 'Down';
    else if (keyName === 'Insert' || keyName === 'Delete' || keyName === 'Home' || keyName === 'End' || keyName === 'PageUp' || keyName === 'PageDown') {
      // 保持原样
    } else if (keyName.length === 1 && (keyName < 'A' || keyName > 'Z')) {
      // 对非字母键做额外处理，如果需要
    }
    
    const shortcutString = [...modifiers, keyName].join('+');
    
    // 检查快捷键冲突
    if (checkShortcutConflict(shortcutString, actionName)) {
      alert('此快捷键已被占用，请选择其他组合！');
      button.textContent = shortcuts[actionName] || '设置'; // 恢复按钮文本
    } else {
      // 设置新快捷键
      shortcuts[actionName] = shortcutString;
      button.textContent = shortcutString;
      
      // 通知主进程更新快捷键
      window.electron.send('update-shortcuts', shortcuts);
    }
    
    // 停止监听
    stopListeningForShortcut(keydownListener);
    
    // 更新快捷键显示
    updateShortcutDisplay();
  };
  
  // 监听按键
  window.addEventListener('keydown', keydownListener);
  
  // 点击其他位置取消监听
  const cancelHandler = (e) => {
    if (e.target !== button) {
      stopListeningForShortcut(keydownListener);
      button.textContent = shortcuts[button.dataset.action] || '设置';
    }
  };
  
  window.addEventListener('click', cancelHandler, { once: true });
  
  // 存储取消函数以便清理
  button._cancelHandler = cancelHandler;
  button._keydownListener = keydownListener;
}

// 停止监听快捷键
function stopListeningForShortcut() {
  if (!listeningForShortcut || !currentShortcutButton) return;
  
  if (currentShortcutButton._keydownListener) {
    window.removeEventListener('keydown', currentShortcutButton._keydownListener);
  }
  
  currentShortcutButton.classList.remove('listening');
  if (currentShortcutButton._cancelHandler) {
    window.removeEventListener('click', currentShortcutButton._cancelHandler);
  }

  listeningForShortcut = false;
  currentShortcutButton = null;
}

// 检查快捷键冲突
function checkShortcutConflict(shortcut, actionToIgnore) {
  for (const [action, key] of Object.entries(shortcuts)) {
    if (action !== actionToIgnore && key === shortcut) {
      return true;
    }
  }
  return false;
}

// 重置所有快捷键到默认值
function resetShortcuts() {
  shortcuts = { ...defaultShortcuts };
  updateShortcutButtons();
  window.electron.send('update-shortcuts', shortcuts);
}

// 更新快捷键按钮显示
function updateShortcutButtons() {
  document.querySelectorAll('.shortcut-button').forEach(button => {
    const action = button.dataset.action;
    if (shortcuts[action]) {
      button.textContent = shortcuts[action];
    }
  });
}

// 更新快捷键显示
function updateShortcutDisplay() {
  const shortcutItems = document.querySelectorAll('.shortcut-item .key');
  shortcutItems[0].textContent = shortcuts.playPause;
  shortcutItems[1].textContent = shortcuts.rewind;
  shortcutItems[2].textContent = shortcuts.forward;
  shortcutItems[3].textContent = `${shortcuts.increaseOpacity.replace('+Up', '')}+↑/↓`;
  shortcutItems[4].textContent = shortcuts.toggleBrowser;
}

// 更新浏览器按钮状态
function updateBrowserButtonState(isOpen) {
  toggleBrowserBtn.classList.toggle('active', isOpen);
  toggleBrowserBtn.textContent = isOpen ? '关闭浏览器' : '打开浏览器';
}

// 突出显示触发的快捷键动作
function highlightShortcutAction(action) {
  const actionMap = {
    playPause: 0,
    rewind: 1,
    forward: 2,
    increaseOpacity: 3,
    decreaseOpacity: 3,
    toggleBrowser: 4
  };
  
  const index = actionMap[action];
  if (index !== undefined) {
    const item = document.querySelectorAll('.shortcut-item')[index];
    item.classList.add('highlight');
    setTimeout(() => {
      item.classList.remove('highlight');
    }, 200);
  }
}

// 初始化时请求一次初始状态
document.addEventListener('DOMContentLoaded', () => {
  init();
  // 注意：由于无法直接从渲染进程知道播放器窗口是否已打开，
  // 我们依赖主进程在窗口关闭时发送的消息来更新状态。
  // 启动时，我们假定窗口是关闭的。
  updateBrowserButtonState(false);
}); 