# Tree Style History - Manifest V3 Migration

## 📋 迁移概述

本项目成功将 Tree Style History 扩展从 Manifest V2 迁移到 Manifest V3，保持了所有核心功能的同时，采用了新的架构和 API。

## 🔄 主要变更

### 1. Manifest 文件变更

**原文件**: `manifest.json` (MV2)
**新文件**: `manifest-v3.json` (MV3)

#### 关键变更：
- `manifest_version`: 2 → 3
- `background.page` → `background.service_worker`
- `browser_action` → `action`
- 移除了 `chrome://favicon/` 权限，改用 `host_permissions`

### 2. Background Script 重构

**原文件**: `background.html` + `background.js`
**新文件**: `background-sw.js`

#### 主要改进：
- 移除了对 `moo.js` 的依赖（DOM 操作库）
- 使用 Service Worker 替代 Background Page
- 实现了消息传递机制与前台页面通信
- 保持了所有核心功能：标签页跟踪、历史记录管理、右键菜单等

### 3. Popup 页面重构

**原文件**: `popup.html` + `popup.js`
**新文件**: `popup-mv3.html` + `popup-mv3.js`

#### 主要改进：
- 移除了对 `moo.js` 的依赖
- 使用原生 JavaScript DOM API
- 通过 `chrome.runtime.sendMessage()` 与 Service Worker 通信
- 保持了所有用户界面功能

### 4. Options 页面重构

**原文件**: `options.html` + `options.js`
**新文件**: `options-mv3.html` + `options-mv3.js`

#### 主要改进：
- 移除了对 `moo.js` 的依赖
- 使用原生 JavaScript 事件处理
- 通过消息传递与 Service Worker 通信
- 保持了所有配置选项功能

## 🛠️ 技术实现

### Service Worker 架构

```javascript
// 事件监听器
chrome.runtime.onInstalled.addListener(() => {
    initialize();
});

chrome.tabs.onCreated.addListener((tab) => {
    openedTab(tab);
});

// 消息处理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'getRecentTabs':
            sendResponse({ recentTabs: recentTabs });
            break;
        case 'deleteDb':
            deleteDb().then(() => {
                sendResponse({ success: true });
            });
            return true; // 保持消息通道开放
    }
});
```

### 前台页面通信

```javascript
// 获取最近标签页
chrome.runtime.sendMessage({ action: 'getRecentTabs' }, function(response) {
    if (response && response.recentTabs) {
        recentTabs = response.recentTabs;
    }
    initializePopup();
});

// 删除缓存
chrome.runtime.sendMessage({ action: 'deleteDb' }, function(response) {
    if (response && response.success) {
        alert('Cache deleted successfully');
    }
});
```

## 📁 文件结构

```
chrome/
├── manifest-v3.json          # MV3 清单文件
├── background-sw.js          # Service Worker
├── popup-mv3.html           # 弹出窗口 HTML
├── popup-mv3.js             # 弹出窗口脚本
├── options-mv3.html         # 选项页面 HTML
├── options-mv3.js           # 选项页面脚本
├── scripts/                 # 其他脚本文件
├── css/                     # 样式文件
├── images/                  # 图标文件
└── _locales/               # 国际化文件
```

## ✅ 功能验证

### 测试覆盖范围

1. **Service Worker 初始化** ✅
2. **Manifest 结构验证** ✅
3. **Background Script 功能** ✅
4. **Popup Script 功能** ✅
5. **Options Script 功能** ✅
6. **文件结构完整性** ✅

### 核心功能保持

- ✅ 历史记录管理
- ✅ 最近关闭的标签页
- ✅ 书签管理
- ✅ 右键菜单集成
- ✅ 快捷键支持
- ✅ 多语言支持
- ✅ 选项配置
- ✅ 数据存储（IndexedDB）

## 🚀 部署说明

### 1. 安装扩展

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 启用"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择包含 `manifest-v3.json` 的目录

### 2. 验证功能

1. 点击扩展图标，确认弹出窗口正常显示
2. 右键点击网页，确认上下文菜单正常显示
3. 访问扩展选项页面，确认配置功能正常
4. 测试快捷键功能

### 3. 故障排除

如果遇到问题：

1. 检查浏览器控制台是否有错误信息
2. 确认所有文件路径正确
3. 验证 Service Worker 是否正常加载
4. 检查权限设置是否正确

## 🔧 开发说明

### 本地开发

```bash
# 克隆项目
git clone <repository-url>
cd Tree-Style-History

# 运行测试
node test-mv3.js

# 在浏览器中加载扩展
# 1. 打开 chrome://extensions/
# 2. 启用开发者模式
# 3. 加载已解压的扩展程序
# 4. 选择 chrome/ 目录
```

### 调试技巧

1. **Service Worker 调试**:
   - 访问 `chrome://extensions/`
   - 找到扩展，点击"Service Worker"链接
   - 在开发者工具中调试

2. **Popup 调试**:
   - 右键点击扩展图标
   - 选择"检查弹出内容"

3. **Options 页面调试**:
   - 在选项页面右键选择"检查"

## 📝 注意事项

### MV3 限制

1. **Service Worker 限制**:
   - 不支持 DOM 操作
   - 不支持同步 API
   - 生命周期管理更严格

2. **权限变更**:
   - `chrome://favicon/` 权限已移除
   - 需要显式声明 `host_permissions`

3. **API 变更**:
   - `chrome.extension.getBackgroundPage()` 不可用
   - 需要使用消息传递进行通信

### 兼容性

- **最低 Chrome 版本**: 88.0
- **推荐 Chrome 版本**: 90.0+
- **其他基于 Chromium 的浏览器**: Edge, Brave, Opera 等

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 📄 许可证

本项目基于原始 Tree Style History 扩展，遵循相同的许可证条款。

## 🙏 致谢

- 原始扩展作者: Tumuyan
- 基于的扩展: Recent History by Umar Sheikh
- 所有贡献者和用户

---

**迁移完成时间**: 2024年
**迁移状态**: ✅ 完成
**测试状态**: ✅ 通过