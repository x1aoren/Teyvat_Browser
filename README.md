# 提瓦特浏览器

一个基于Electron的原神风格B站视频浏览器，支持透明度调节和全局快捷键控制。

## 功能特点

- **原神风格UI**：蓝白金配色方案，角色剪影装饰
- **浏览器视图控制**：可显示/隐藏浏览器视图
- **视频控制**：支持播放/暂停、快进/后退操作
- **透明度调节**：支持0.2-1.0范围内的透明度调节
- **快捷键自定义**：所有功能都支持自定义快捷键

## 默认快捷键

- **空格**：播放/暂停
- **←**：后退5秒
- **→**：前进5秒
- **Ctrl+↑/↓**：调节透明度
- **Insert**：显示/隐藏浏览器

## 安装与使用

### 从源代码运行

```bash
# 克隆仓库
git clone https://github.com/your-username/teyvat-browser.git

# 进入目录
cd teyvat-browser

# 安装依赖
npm install

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

## 技术栈

- **Electron**: 跨平台桌面应用框架
- **HTML/CSS/JavaScript**: 前端开发
- **electron-store**: 配置存储

## 开发说明

项目结构：

```
teyvat-browser/
├── src/
│   ├── main/        # 主进程代码
│   │   ├── main.js  # 主入口文件
│   │   └── preload.js
│   └── renderer/    # 渲染进程代码
│       ├── assets/  # 资源文件
│       ├── components/ # 组件
│       ├── pages/   # 页面
│       ├── index.html  # 主页面
│       └── renderer.js # 渲染进程逻辑
├── package.json
└── README.md
```

## 版权说明

- 原神(Genshin Impact)是米哈游开发的游戏，其相关内容版权归米哈游所有
- 本应用仅用于学习和研究目的

## 许可证

ISC