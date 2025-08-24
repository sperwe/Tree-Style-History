# 自动更新指南

## 如何设置自动更新

### 1. 获取扩展ID
首次安装扩展后，在Chrome/Edge扩展管理页面（chrome://extensions/）找到您的扩展ID。
它看起来像这样：`abcdefghijklmnopqrstuvwxyz123456`

### 2. 更新updates.xml
编辑`updates.xml`文件，将`你的扩展ID`替换为实际的扩展ID：
```xml
<app appid='你的实际扩展ID'>
```

### 3. 发布新版本时的步骤

1. **更新版本号**
   - 在`manifest.json`中更新`version`和`version_name`
   
2. **打包扩展**
   - 在扩展管理页面点击"打包扩展"
   - 选择`chrome`文件夹作为扩展根目录
   - 生成`.crx`文件

3. **创建GitHub Release**
   - 在GitHub仓库创建新的Release
   - 标签名使用版本号，如`v4.9.8`
   - 上传打包好的`.crx`文件
   - 文件名格式：`tree-style-history-v4.9.8.crx`

4. **更新updates.xml**
   ```xml
   <updatecheck codebase='https://github.com/sperwe/Tree-Style-History/releases/download/v新版本号/tree-style-history-v新版本号.crx' 
                version='新版本号' />
   ```

5. **提交并推送更改**
   ```bash
   git add updates.xml manifest.json
   git commit -m "Release v新版本号"
   git push origin main
   ```

## 用户如何获取更新

### 自动检查（需要开发者模式）
- Chrome/Edge会定期检查`update_url`指定的地址
- 发现新版本时会自动下载并更新
- 更新频率：通常每隔几小时检查一次

### 手动检查更新
1. 打开扩展管理页面（chrome://extensions/）
2. 开启"开发者模式"
3. 点击"更新"按钮

### 注意事项
- 非商店扩展的自动更新功能在某些情况下可能受限
- 建议用户定期手动检查更新
- 可以在扩展的选项页面添加"检查更新"功能

## 替代方案

如果自动更新不工作，用户可以：
1. 在GitHub Releases页面下载最新的`.crx`文件
2. 拖拽到扩展管理页面进行安装
3. 或者克隆仓库并以开发者模式加载未打包的扩展