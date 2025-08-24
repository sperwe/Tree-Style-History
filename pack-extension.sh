#!/bin/bash

# 打包Chrome扩展脚本
# 使用方法: ./pack-extension.sh

# 获取当前版本号
VERSION=$(grep '"version"' chrome/manifest.json | sed 's/.*"version": "\(.*\)".*/\1/')
echo "当前版本: $VERSION"

# 创建临时目录
TEMP_DIR="temp_pack"
OUTPUT_DIR="releases"

# 确保输出目录存在
mkdir -p $OUTPUT_DIR

# 清理临时目录
rm -rf $TEMP_DIR
mkdir -p $TEMP_DIR

# 复制chrome文件夹到临时目录
cp -r chrome/* $TEMP_DIR/

# 打包为zip文件（可以直接作为crx使用）
cd $TEMP_DIR
zip -r "../$OUTPUT_DIR/tree-style-history-v$VERSION.zip" . -x "*.DS_Store" "*/.DS_Store"
cd ..

# 清理临时目录
rm -rf $TEMP_DIR

echo "✅ 打包完成！"
echo "📦 输出文件: $OUTPUT_DIR/tree-style-history-v$VERSION.zip"
echo ""
echo "下一步:"
echo "1. 在Chrome扩展管理页面使用'打包扩展'功能"
echo "2. 选择 'chrome' 文件夹作为根目录"
echo "3. 如果有私钥文件(.pem)，请选择它以保持相同的扩展ID"
echo "4. 将生成的.crx文件重命名为: tree-style-history-v$VERSION.crx"
echo "5. 上传到GitHub Release"