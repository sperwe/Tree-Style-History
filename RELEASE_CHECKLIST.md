# 发布检查清单 - v4.9.8

## 发布前检查

- [x] 版本号已更新 (manifest.json)
- [x] 版本描述已更新
- [x] updates.xml 已配置正确的扩展ID
- [ ] 功能测试完成
- [ ] 无控制台错误

## 打包步骤

1. **使用Chrome打包功能**：
   - 打开 chrome://extensions/
   - 点击"打包扩展"
   - 扩展程序根目录：选择 `chrome` 文件夹
   - 私有密钥文件：如果有之前的.pem文件，选择它（保持ID不变）
   - 点击"打包扩展"

2. **文件命名**：
   - 将生成的 `chrome.crx` 重命名为 `tree-style-history-v4.9.8.crx`

3. **创建GitHub Release**：
   - 标签：v4.9.8
   - 标题：Release v4.9.8
   - 使用 RELEASE_TEMPLATE.md 的内容
   - 上传 .crx 文件

4. **更新 updates.xml**（如需要）：
   - 确认版本号和下载链接正确
   - 提交并推送

## 发布后验证

- [ ] Release 页面可访问
- [ ] .crx 文件可下载
- [ ] 自动更新检查正常（在已安装的扩展上测试）

## 备注

- 保存好 .pem 私钥文件，下次打包需要使用
- 扩展ID只在使用相同私钥时保持不变