# Zotero Research Navigator - 部署指南

本文档提供将 Tree Style History 插件重构为 Zotero Research Navigator 的完整部署指南。

## 📋 前置要求

### 开发环境
- **Node.js**: 16.0+ 
- **npm**: 8.0+
- **Git**: 2.0+
- **代码编辑器**: VS Code (推荐) 或其他支持 TypeScript 的编辑器

### 目标环境  
- **Zotero**: 6.0.27+ (支持最新的插件 API)
- **操作系统**: Windows 10+, macOS 10.15+, Linux (Ubuntu 20.04+)

## 🚀 快速开始

### 步骤 1: 创建新 GitHub 仓库

1. **登录 GitHub** 并创建新仓库
   ```
   仓库名: zotero-research-navigator
   描述: A Zotero plugin for tracking research history and enhanced note navigation
   可见性: Public (推荐) 或 Private
   初始化: 不要初始化，我们将推送现有代码
   ```

2. **克隆现有代码**
   ```bash
   # 在本地创建新目录
   mkdir zotero-research-navigator
   cd zotero-research-navigator
   
   # 复制项目文件 (从 /workspace/zotero-research-navigator/)
   # 您需要手动复制以下文件和目录:
   # ├── src/
   # ├── _locales/
   # ├── addon/
   # ├── package.json
   # ├── manifest.json
   # ├── tsconfig.json
   # ├── webpack.config.js
   # └── README.md
   ```

3. **初始化 Git 并推送**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Zotero Research Navigator v1.0.0"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/zotero-research-navigator.git
   git push -u origin main
   ```

### 步骤 2: 配置项目

1. **更新项目信息**
   编辑 `package.json`:
   ```json
   {
     "repository": {
       "url": "https://github.com/YOUR_USERNAME/zotero-research-navigator.git"
     },
     "author": "YOUR_NAME",
     "bugs": {
       "url": "https://github.com/YOUR_USERNAME/zotero-research-navigator/issues"
     },
     "homepage": "https://github.com/YOUR_USERNAME/zotero-research-navigator#readme"
   }
   ```

2. **更新 Webpack 配置**
   编辑 `webpack.config.js` 中的替换规则:
   ```javascript
   {
     search: /YOUR_USERNAME/g,
     replace: 'your-github-username',  // 替换为您的 GitHub 用户名
   },
   {
     search: /YOUR_NAME/g,
     replace: 'Your Real Name',        // 替换为您的真实姓名
   }
   ```

3. **更新 manifest.json**
   ```json
   {
     "homepage_url": "https://github.com/your-username/zotero-research-navigator",
     "author": "Your Name",
     "applications": {
       "zotero": {
         "update_url": "https://github.com/your-username/zotero-research-navigator/releases/latest/download/update.json"
       }
     }
   }
   ```

### 步骤 3: 安装和构建

1. **安装依赖**
   ```bash
   npm install
   ```

2. **开发构建**
   ```bash
   npm run build
   ```

3. **生产构建**
   ```bash
   npm run build-prod
   ```

## 🔧 开发工作流

### 本地开发

1. **启动开发模式**
   ```bash
   npm run watch  # 监听文件变化，自动重建
   ```

2. **代码规范检查**
   ```bash
   npm run lint      # 检查代码规范
   npm run lint:fix  # 自动修复问题
   ```

3. **测试插件**
   - 构建后，`build/` 目录包含完整的插件文件
   - 将目录压缩为 `.zip` 文件
   - 重命名为 `.xpi` 后缀
   - 在 Zotero 中安装测试

### 版本管理

1. **版本号规范**
   使用语义化版本 (Semantic Versioning):
   - `1.0.0`: 主要版本 (破坏性变更)
   - `1.1.0`: 次要版本 (新功能)
   - `1.0.1`: 补丁版本 (Bug 修复)

2. **发布流程**
   ```bash
   # 更新版本号
   npm version patch  # 或 minor/major
   
   # 构建生产版本
   npm run build-prod
   
   # 创建发布包
   cd build
   zip -r ../zotero-research-navigator-v1.0.0.xpi .
   cd ..
   
   # 提交和标签
   git add .
   git commit -m "Release v1.0.0"
   git tag v1.0.0
   git push origin main --tags
   ```

## 📦 发布到 GitHub Releases

### 自动发布 (推荐)

1. **创建 GitHub Actions 工作流**
   创建 `.github/workflows/release.yml`:
   ```yaml
   name: Release
   
   on:
     push:
       tags:
         - 'v*'
   
   jobs:
     release:
       runs-on: ubuntu-latest
       steps:
       - uses: actions/checkout@v3
       
       - name: Setup Node.js
         uses: actions/setup-node@v3
         with:
           node-version: '18'
           
       - name: Install dependencies
         run: npm ci
         
       - name: Build plugin
         run: npm run build-prod
         
       - name: Create XPI package
         run: |
           cd build
           zip -r ../zotero-research-navigator-${{ github.ref_name }}.xpi .
           
       - name: Create Release
         uses: softprops/action-gh-release@v1
         with:
           files: zotero-research-navigator-${{ github.ref_name }}.xpi
           generate_release_notes: true
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
   ```

2. **创建发布**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

### 手动发布

1. **在 GitHub 上创建 Release**
   - 访问仓库的 Releases 页面
   - 点击 "Create a new release"
   - 标签版本: `v1.0.0`
   - 发布标题: `Research Navigator v1.0.0`
   - 描述发布内容和更新日志

2. **上传 XPI 文件**
   - 将构建的 `.xpi` 文件上传为 Release 资产
   - 确保文件名包含版本号

## 🌍 社区推广

### 1. Zotero 社区

- **Zotero 论坛**: 在官方论坛发布插件介绍
- **Zotero 中文社区**: 在中文社区分享插件
- **学术社交媒体**: Twitter, 学术微博等

### 2. 文档网站

使用 GitHub Pages 创建插件文档网站:

1. **创建 `docs/` 目录**
   ```bash
   mkdir docs
   cd docs
   ```

2. **创建简单的 HTML 页面**
   ```html
   <!DOCTYPE html>
   <html lang="zh-CN">
   <head>
     <meta charset="UTF-8">
     <title>Zotero Research Navigator</title>
   </head>
   <body>
     <h1>Zotero Research Navigator</h1>
     <!-- 插件介绍和使用指南 -->
   </body>
   </html>
   ```

3. **启用 GitHub Pages**
   - 仓库设置 → Pages
   - Source: Deploy from a branch
   - Branch: main / docs

## 🐛 故障排除

### 常见构建问题

1. **Node.js 版本不兼容**
   ```bash
   # 检查版本
   node --version
   npm --version
   
   # 升级到推荐版本
   npm install -g npm@latest
   ```

2. **依赖安装失败**
   ```bash
   # 清除缓存并重新安装
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **TypeScript 编译错误**
   ```bash
   # 检查 TypeScript 配置
   npx tsc --noEmit
   
   # 更新类型定义
   npm update @types/*
   ```

### Zotero 集成问题

1. **插件无法加载**
   - 检查 manifest.json 格式
   - 确认 Zotero 版本兼容性
   - 查看 Zotero 错误控制台

2. **API 调用失败**
   - 确认 Zotero API 版本
   - 检查权限配置
   - 添加错误处理逻辑

## 📈 后续维护

### 版本更新策略

1. **Bug 修复**: 及时发布补丁版本
2. **功能增强**: 每季度发布次要版本
3. **重大更新**: 年度发布主要版本

### 用户反馈收集

1. **GitHub Issues**: 主要的反馈渠道
2. **用户调研**: 定期进行功能需求调研
3. **使用统计**: 分析用户使用模式 (隐私友好)

### 代码维护

1. **依赖更新**: 定期更新依赖包
2. **安全检查**: 运行安全扫描
3. **性能优化**: 持续优化插件性能

---

## 🎯 完成清单

部署完成后，确认以下项目：

- [ ] ✅ GitHub 仓库已创建并推送代码
- [ ] ✅ 项目信息已更新 (作者、链接等)
- [ ] ✅ 本地构建成功
- [ ] ✅ 在 Zotero 中测试插件功能
- [ ] ✅ 创建首个 GitHub Release
- [ ] ✅ 文档网站已建立
- [ ] ✅ 社区推广已开始

**恭喜！您的 Zotero Research Navigator 插件已成功部署！** 🎉