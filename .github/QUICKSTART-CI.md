# 🚀 GitHub Actions 快速开始

## 立即开始自动构建

### 1️⃣ 启用Actions
1. 进入GitHub仓库页面
2. 点击 **Actions** 标签
3. 如果首次使用，点击 **I understand my workflows, go ahead and enable them**

### 2️⃣ 第一次构建（手动触发）
1. 在Actions页面，选择 **Manual Build**
2. 点击 **Run workflow** 按钮
3. 选择构建选项：
   - **Build type**: `both` (同时构建EXE和ZIP)
   - **Upload artifacts**: ✅ (上传构建产物)
4. 点击绿色的 **Run workflow** 按钮

### 3️⃣ 等待构建完成
- 构建时间：约10-15分钟
- 可以实时查看构建日志
- 完成后在 **Artifacts** 部分下载文件

### 4️⃣ 发布正式版本
```bash
# 确保代码已提交
git add .
git commit -m "准备发布 v1.0.0"
git push

# 创建版本标签
git tag v1.0.0
git push origin v1.0.0
```
🎉 **自动发生**：GitHub会自动构建并创建Release！

## 📁 构建产物说明

### 📦 便携版EXE
- **文件**: `提瓦特浏览器.exe`
- **大小**: ~150MB
- **使用**: 双击运行，无需安装
- **适合**: 快速使用、测试

### 🗜️ 完整版ZIP  
- **文件**: `提瓦特浏览器-完整版.zip`
- **大小**: ~200MB
- **使用**: 解压后运行exe
- **适合**: 完整部署、分发

## ⚡ 快速命令

### 本地测试构建
```bash
# 安装依赖
npm install

# 构建原生模块
npm run build-native

# 构建应用
npm run build:win
```

### 创建预发布版本
```bash
git tag v1.0.0-beta.1
git push origin v1.0.0-beta.1
```

### 查看构建状态
- 🟢 **成功**: 可以下载构建产物
- 🟡 **进行中**: 请耐心等待
- 🔴 **失败**: 查看日志，通常是依赖问题

## 🛠️ 常见问题解决

### Q: 构建失败怎么办？
A: 
1. 查看Actions日志中的错误信息
2. 通常是原生模块编译问题
3. 可以尝试重新运行构建

### Q: 没有生成Release？
A: 
1. 确保推送了版本标签：`git push origin v1.0.0`
2. 标签必须以 `v` 开头
3. 构建成功后会自动创建

### Q: 下载的文件打不开？
A: 
1. 确保以管理员身份运行
2. 添加到杀毒软件白名单
3. 检查Windows Defender设置

## 🎯 自动化流程图

```
代码推送 → 自动构建 → 上传产物 → 可下载
    ↓
创建标签 → 自动构建 → 创建Release → 自动发布
```

## 📞 需要帮助？

- 🐛 **构建问题**: 查看Actions日志
- 💬 **使用问题**: QQ群 1003862782  
- 📝 **功能建议**: 提交Issue

---

**提示**: 第一次构建可能需要更长时间，因为需要下载和缓存依赖。后续构建会更快！