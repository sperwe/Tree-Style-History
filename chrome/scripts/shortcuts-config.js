// 快捷键配置管理
(function() {
    'use strict';
    
    // 在options.js中添加快捷键设置功能
    document.addEventListener('DOMContentLoaded', function() {
        // 查找快捷键设置区域
        const shortcutsLabel = document.getElementById('shortcuts');
        if (shortcutsLabel) {
            // 创建打开快捷键设置的按钮
            const shortcutsButton = document.createElement('button');
            shortcutsButton.textContent = '打开快捷键设置';
            shortcutsButton.className = 'shortcuts-button';
            shortcutsButton.style.cssText = `
                margin-left: 10px;
                padding: 5px 15px;
                background: #4CAF50;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            `;
            
            shortcutsButton.addEventListener('click', function() {
                // 打开Chrome的快捷键设置页面
                chrome.tabs.create({
                    url: 'chrome://extensions/shortcuts'
                });
            });
            
            // 添加按钮到标签旁边
            const td = shortcutsLabel.parentElement.nextElementSibling;
            if (td) {
                td.appendChild(shortcutsButton);
                
                // 添加当前快捷键列表
                const shortcutsList = document.createElement('div');
                shortcutsList.style.cssText = `
                    margin-top: 10px;
                    padding: 10px;
                    background: #f5f5f5;
                    border-radius: 4px;
                    font-size: 12px;
                    line-height: 1.5;
                `;
                
                shortcutsList.innerHTML = `
                    <strong>当前快捷键：</strong><br>
                    Alt+Shift+H - 打开树状历史<br>
                    Alt+Shift+G - 最近关闭的标签<br>
                    Alt+Shift+N - 浮动笔记管理器<br>
                    Alt+Shift+S - 保存选中文本为笔记<br>
                    Alt+Shift+Q - 新建快速笔记
                `;
                
                td.appendChild(shortcutsList);
            }
        }
    });
})();