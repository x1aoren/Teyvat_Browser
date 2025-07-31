# 提瓦特浏览器

一个基于Electron的原神风格B站视频浏览器，支持透明度调节和全局快捷键控制。

## 功能特点

- **原神风格UI**：蓝白金配色方案，角色剪影装饰
- **浏览器视图控制**：可显示/隐藏浏览器视图
- **视频控制**：支持播放/暂停、快进/后退操作
- **透明度调节**：支持0.2-1.0范围内的透明度调节
- **快捷键自定义**：所有功能都支持自定义快捷键
- **全屏游戏支持**：使用C++模块实现系统级快捷键，可在全屏游戏中正常工作
- **智能透明度**：焦点在窗口时100%不透明，失去焦点时自动应用透明度设置

## 默认快捷键

- **Insert**：显示/隐藏浏览器
- **Shift+F1**：播放/暂停
- **Shift+F2**：后退5秒
- **Shift+F3**：前进5秒
- **Ctrl+↑/↓**：调节透明度

## 技术特性

### 系统级快捷键
- 使用C++编写的Windows API钩子
- 基于`RegisterHotKey`和低级键盘钩子
- 可在全屏游戏、其他应用程序中正常工作
- 不会与游戏快捷键冲突

### 媒体控制
- 专门针对B站播放器优化
- 支持B站播放按钮和通用视频元素控制
- 智能窗口焦点管理

## 安装与使用

### 从源代码运行

```bash
# 克隆仓库
git clone https://github.com/x1aoren/teyvat-browser.git

# 进入目录
cd teyvat-browser

# 安装依赖
npm install

# 构建C++模块
cd src/native
npm install
npm run build
cd ../..

# 启动应用
npm start
```

### 构建安装包

```bash
# 构建所有平台
npm run build

# 仅构建Windows版本
npm run build:win
```

## 项目结构

```
teyvat-browser/
├── src/
│   ├── main/        # 主进程代码
│   │   ├── main.js  # 主入口文件
│   │   └── preload.js
│   ├── native/      # C++快捷键模块
│   │   ├── src/
│   │   │   └── high_priority_shortcut.cc
│   │   ├── binding.gyp
│   │   └── package.json
│   └── renderer/    # 渲染进程代码
│       ├── assets/  # 资源文件
│       ├── components/ # 组件
│       ├── pages/   # 页面
│       ├── index.html  # 主页面
│       └── renderer.js # 渲染进程逻辑
├── package.json
└── README.md
```

## 配置说明

### 快捷键配置
- 配置文件位置：`%APPDATA%/teyvat-browser/config.json`
- 支持组合键：Shift、Control、Alt + 功能键
- 支持功能键：F1-F12、方向键、Insert、Delete等

### 窗口设置
- 浏览器窗口位置和大小会自动保存
- 透明度设置会持久化
- 支持GPU硬件加速开关

## 故障排除

### C++模块加载失败
如果出现"C++模块加载失败"错误：
1. 确保已安装Visual Studio Build Tools
2. 重新构建C++模块：`cd src/native && npm run build`
3. 检查Node.js版本兼容性

### 快捷键不工作
1. 检查快捷键是否被其他程序占用
2. 确保以管理员权限运行（某些游戏需要）
3. 尝试重新设置快捷键

### 视频控制不工作
1. 确保浏览器窗口已打开并加载了B站页面
2. 检查B站页面是否完全加载
3. 尝试刷新页面后再次测试

## 开发说明

### 构建C++模块
```bash
cd src/native
npm install
npm run build
```

### 调试模式
在设置中启用调试模式可以看到详细的快捷键触发日志。

## 版权说明

- 原神(Genshin Impact)是米哈游开发的游戏，其相关内容版权归米哈游所有
- 本应用仅用于学习和研究目的

## 许可证

ISC