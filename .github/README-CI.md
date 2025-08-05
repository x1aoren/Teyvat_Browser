# GitHub Actions CI/CD 配置说明

## 🚀 自动化构建系统

本项目配置了完整的GitHub Actions自动化构建系统，能够自动构建Windows版本的提瓦特浏览器。

## 📋 工作流说明

### 1. 主构建工作流 (`build.yml`)

**触发条件：**
- 推送到 `main` 或 `master` 分支
- 创建版本标签 (如 `v1.0.0`)
- Pull Request 到主分支
- 手动触发

**构建产物：**
- ✅ **便携版EXE** - 单个可执行文件，无需安装
- ✅ **完整版ZIP** - 包含所有文件的压缩包
- ✅ **目录版本** - 未压缩的完整应用目录

**自动发布：**
- 当推送版本标签时（如 `git tag v1.0.0 && git push origin v1.0.0`）
- 自动创建GitHub Release
- 自动上传构建产物

### 2. 手动构建工作流 (`manual-build.yml`)

**使用场景：**
- 测试构建
- 紧急修复版本
- 自定义构建选项

**如何使用：**
1. 进入GitHub仓库页面
2. 点击 `Actions` 标签
3. 选择 `Manual Build` 工作流
4. 点击 `Run workflow`
5. 选择构建类型和选项

## 🛠️ 构建过程详解

### 环境准备
- Windows Server 2022 (最新版)
- Node.js 18.x
- Python 3.11 (用于node-gyp)
- MSBuild 工具
- Visual Studio Build Tools

### 构建步骤
1. **环境设置** - 安装Node.js、Python、MSBuild
2. **依赖安装** - 安装主项目和原生模块依赖
3. **原生模块编译** - 编译C++快捷键和置顶模块
4. **应用打包** - 使用electron-builder创建不同格式
5. **文件验证** - 确保所有必要文件都已生成
6. **产物上传** - 上传到GitHub Actions或Release

## 📦 发布新版本

### 创建新版本发布
```bash
# 1. 确保代码已提交并推送
git add .
git commit -m "发布版本 v1.0.0"
git push origin main

# 2. 创建并推送版本标签
git tag v1.0.0
git push origin v1.0.0

# 3. GitHub Actions会自动构建并创建Release
```

### 版本号规范
- 使用语义化版本：`v主版本.次版本.修订版本`
- 例如：`v1.0.0`, `v1.1.0`, `v1.0.1`
- 预发布版本：`v1.0.0-beta.1`, `v1.0.0-rc.1`

## 🔧 故障排除

### 常见构建失败原因

1. **原生模块编译失败**
   - 检查C++代码语法
   - 确保Windows SDK版本兼容
   - 查看MSBuild详细日志

2. **依赖安装失败**
   - 检查package.json配置
   - 确保npm源可访问
   - 查看网络连接问题

3. **Electron打包失败**
   - 检查electron-builder配置
   - 确保代码签名设置正确
   - 查看文件路径和权限

### 调试构建问题

1. **查看构建日志**
   - 进入Actions页面
   - 点击失败的构建
   - 查看详细错误信息

2. **本地复现问题**
   ```bash
   npm install
   npm run build-native
   npm run build:win
   ```

3. **手动构建测试**
   - 使用Manual Build工作流
   - 启用详细日志输出

## ⚙️ 配置文件说明

### `build.yml` 关键配置
- `matrix.node-version`: Node.js版本
- `windows-build-tools`: Windows构建工具版本
- `electron-builder`: 打包配置

### 环境变量
- `GH_TOKEN`: GitHub令牌（自动提供）
- `GITHUB_TOKEN`: 用于创建Release

## 🔒 安全说明

- 所有敏感信息使用GitHub Secrets
- 构建过程在隔离环境中运行
- 自动扫描依赖安全问题
- 代码签名配置（如需要）

## 📝 维护更新

### 定期维护任务
1. 更新Node.js版本
2. 更新构建工具版本
3. 检查依赖安全更新
4. 优化构建性能

### 配置更新
- 修改构建触发条件
- 调整构建环境配置
- 更新发布说明模板

---

## 💡 提示

- 构建大约需要 10-15 分钟
- 构建产物保留 30 天
- Release发布是自动的，无需手动操作
- 如有问题，请查看Actions日志或提交Issue