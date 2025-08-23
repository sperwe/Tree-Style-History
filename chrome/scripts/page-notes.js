/**
 * Tree Style Tab - 页面快速笔记功能
 * Content Script for Page Notes
 */

(function() {
    'use strict';
    
    // 避免重复注入
    if (window.tstPageNotesInjected) {
        return;
    }
    window.tstPageNotesInjected = true;

    // 全局变量
    let floatingButton = null;
    let quickNoteModal = null;
    let isModalOpen = false;
    
    // 窗口状态
    let windowState = {
        isDragging: false,
        isResizing: false,
        dragStartX: 0,
        dragStartY: 0,
        windowStartX: 0,
        windowStartY: 0,
        resizeStartWidth: 0,
        resizeStartHeight: 0,
        position: { x: 20, y: 100 },
        size: { width: 380, height: 500 }
    };

    /**
     * 创建浮动按钮
     */
    function createFloatingButton() {
        if (floatingButton) return;

        floatingButton = document.createElement('button');
        floatingButton.id = 'tst-page-note-btn';
        floatingButton.innerHTML = '📝';
        floatingButton.title = '新建页面笔记';
        
        floatingButton.addEventListener('click', openQuickNoteModal);
        
        document.body.appendChild(floatingButton);
        
        // 检查是否有历史笔记并更新按钮状态（使用延迟检查确保数据库已初始化）
        delayedCheckHistoryNoteStatus();
    }

    /**
     * 检查历史笔记状态并更新按钮显示
     */
    function checkHistoryNoteStatus() {
        const pageUrl = window.location.href;
        
        console.log('[TST Notes] 检查历史笔记状态:', pageUrl);
        
        chrome.runtime.sendMessage({
            action: 'checkPageNote',
            data: { url: pageUrl }
        }, (response) => {
            console.log('[TST Notes] 历史笔记检查结果:', response);
            
            if (response && response.success && response.hasNote) {
                // 有历史笔记，更新按钮样式
                if (floatingButton) {
                    floatingButton.innerHTML = '📝💡';
                    floatingButton.title = '页面笔记（有历史记录）';
                    floatingButton.classList.add('has-history');
                    console.log('[TST Notes] 按钮已更新为历史状态');
                }
            } else {
                console.log('[TST Notes] 当前页面无历史笔记');
                if (chrome.runtime.lastError) {
                    console.log('[TST Notes] Runtime error:', chrome.runtime.lastError);
                }
            }
        });
    }
    
    /**
     * 延迟检查历史笔记状态（在数据库完全初始化后）
     */
    function delayedCheckHistoryNoteStatus() {
        // 立即检查一次
        checkHistoryNoteStatus();
        
        // 2秒后再检查一次，确保数据库已初始化
        setTimeout(() => {
            console.log('[TST Notes] 延迟检查历史笔记状态');
            checkHistoryNoteStatus();
        }, 2000);
        
        // 5秒后最后检查一次
        setTimeout(() => {
            console.log('[TST Notes] 最终检查历史笔记状态');
            checkHistoryNoteStatus();
        }, 5000);
    }

    /**
     * 创建快速笔记弹窗
     */
    function createQuickNoteModal() {
        if (quickNoteModal) return;

        const pageTitle = document.title || '无标题页面';
        const pageUrl = window.location.href;

        quickNoteModal = document.createElement('div');
        quickNoteModal.id = 'tst-quick-note-modal';
        
        quickNoteModal.innerHTML = `
            <div id="tst-quick-note-content">
                <div id="tst-quick-note-header">
                    <h3 id="tst-quick-note-title">📝 页面笔记</h3>
                    <div class="tst-window-controls">
                        <button class="tst-window-btn" id="tst-minimize-btn" title="最小化">−</button>
                        <button class="tst-window-btn" id="tst-quick-note-close" title="关闭">×</button>
                    </div>
                </div>
                
                <div id="tst-page-info">
                    <div id="tst-page-info-title">${escapeHtml(pageTitle)}</div>
                    <div id="tst-page-info-url">${escapeHtml(pageUrl)}</div>
                </div>
                
                <div id="tst-note-content-area">
                    <textarea id="tst-quick-note-textarea" 
                              placeholder="在这里输入笔记内容...支持 Markdown 格式

💡 提示：
• 拖拽页面文本到此处自动添加引用摘录
• 支持多次摘录和想法交替编辑
• Ctrl+Enter 快速保存"></textarea>
                    <div class="tst-drag-hint">📝 松开鼠标添加摘录</div>
                </div>
                
                <div id="tst-quick-note-actions">
                    <button class="tst-btn tst-btn-secondary" id="tst-clear-btn">清空</button>
                    <button class="tst-btn tst-btn-primary" id="tst-save-btn">保存笔记</button>
                </div>
                
                <!-- 调整大小控制点 -->
                <div class="tst-resizer tst-resizer-se"></div>
                <div class="tst-resizer tst-resizer-s"></div>
                <div class="tst-resizer tst-resizer-e"></div>
            </div>
        `;

        // 绑定基础事件
        const closeBtn = quickNoteModal.querySelector('#tst-quick-note-close');
        const minimizeBtn = quickNoteModal.querySelector('#tst-minimize-btn');
        const clearBtn = quickNoteModal.querySelector('#tst-clear-btn');
        const saveBtn = quickNoteModal.querySelector('#tst-save-btn');
        const textarea = quickNoteModal.querySelector('#tst-quick-note-textarea');
        const header = quickNoteModal.querySelector('#tst-quick-note-header');

        closeBtn.addEventListener('click', closeQuickNoteModal);
        minimizeBtn.addEventListener('click', minimizeWindow);
        clearBtn.addEventListener('click', clearNote);
        saveBtn.addEventListener('click', saveQuickNote);

        // 窗口拖拽
        header.addEventListener('mousedown', startDragging);
        
        // 窗口调整大小
        quickNoteModal.querySelectorAll('.tst-resizer').forEach(resizer => {
            resizer.addEventListener('mousedown', startResizing);
        });

        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isModalOpen) {
                closeQuickNoteModal();
            }
        });

        // Ctrl+Enter 保存
        textarea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                saveQuickNote();
            }
        });

        // 拖拽摘录功能
        setupDragAndDrop();
        
        // 复制粘贴格式化功能
        setupCopyPasteFormat();

        document.body.appendChild(quickNoteModal);
    }

    /**
     * 打开快速笔记窗口
     */
    function openQuickNoteModal() {
        if (isModalOpen) return;

        createQuickNoteModal();
        
        // 恢复窗口位置和大小
        updateWindowTransform();
        quickNoteModal.style.display = 'block';
        isModalOpen = true;

        // 聚焦到文本框并加载历史笔记
        const textarea = quickNoteModal.querySelector('#tst-quick-note-textarea');
        setTimeout(() => {
            // 先加载历史笔记内容
            loadHistoryNotes();
            
            // 然后聚焦并设置光标位置
            setTimeout(() => {
                textarea.focus();
                // 将光标移到末尾，方便继续编辑
                textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            }, 200);
        }, 100);
    }

    /**
     * 关闭快速笔记窗口
     */
    function closeQuickNoteModal() {
        if (!isModalOpen || !quickNoteModal) return;

        quickNoteModal.style.display = 'none';
        isModalOpen = false;
        
        // 保存窗口状态
        saveWindowState();
    }

    /**
     * 最小化窗口
     */
    function minimizeWindow() {
        if (!quickNoteModal) return;
        quickNoteModal.style.display = 'none';
        isModalOpen = false;
        
        // 显示通知
        showNotification('笔记窗口已最小化，点击按钮重新打开', 'info');
    }

    /**
     * 清空笔记内容
     */
    function clearNote() {
        if (!quickNoteModal) return;
        
        const textarea = quickNoteModal.querySelector('#tst-quick-note-textarea');
        if (textarea.value.trim() && !confirm('确定要清空所有笔记内容吗？')) {
            return;
        }
        
        textarea.value = '';
        textarea.focus();
        showNotification('笔记内容已清空', 'info');
    }

    /**
     * 窗口拖拽开始
     */
    function startDragging(e) {
        if (e.target.closest('.tst-window-btn')) return; // 避免按钮区域触发拖拽
        
        windowState.isDragging = true;
        windowState.dragStartX = e.clientX;
        windowState.dragStartY = e.clientY;
        windowState.windowStartX = windowState.position.x;
        windowState.windowStartY = windowState.position.y;
        
        quickNoteModal.classList.add('dragging');
        
        document.addEventListener('mousemove', handleDragging);
        document.addEventListener('mouseup', stopDragging);
        
        e.preventDefault();
    }

    /**
     * 处理窗口拖拽
     */
    function handleDragging(e) {
        if (!windowState.isDragging) return;
        
        const deltaX = e.clientX - windowState.dragStartX;
        const deltaY = e.clientY - windowState.dragStartY;
        
        windowState.position.x = windowState.windowStartX + deltaX;
        windowState.position.y = windowState.windowStartY + deltaY;
        
        // 限制窗口不能拖拽出屏幕
        const maxX = window.innerWidth - windowState.size.width;
        const maxY = window.innerHeight - windowState.size.height;
        
        windowState.position.x = Math.max(0, Math.min(maxX, windowState.position.x));
        windowState.position.y = Math.max(0, Math.min(maxY, windowState.position.y));
        
        updateWindowTransform();
    }

    /**
     * 停止窗口拖拽
     */
    function stopDragging() {
        windowState.isDragging = false;
        quickNoteModal.classList.remove('dragging');
        
        document.removeEventListener('mousemove', handleDragging);
        document.removeEventListener('mouseup', stopDragging);
        
        saveWindowState();
    }

    /**
     * 开始调整窗口大小
     */
    function startResizing(e) {
        windowState.isResizing = true;
        windowState.dragStartX = e.clientX;
        windowState.dragStartY = e.clientY;
        windowState.resizeStartWidth = windowState.size.width;
        windowState.resizeStartHeight = windowState.size.height;
        
        const resizer = e.target;
        windowState.resizeDirection = resizer.classList.contains('tst-resizer-se') ? 'se' :
                                    resizer.classList.contains('tst-resizer-s') ? 's' : 'e';
        
        quickNoteModal.classList.add('resizing');
        
        document.addEventListener('mousemove', handleResizing);
        document.addEventListener('mouseup', stopResizing);
        
        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * 处理窗口大小调整
     */
    function handleResizing(e) {
        if (!windowState.isResizing) return;
        
        const deltaX = e.clientX - windowState.dragStartX;
        const deltaY = e.clientY - windowState.dragStartY;
        
        if (windowState.resizeDirection.includes('e')) {
            windowState.size.width = Math.max(300, windowState.resizeStartWidth + deltaX);
        }
        
        if (windowState.resizeDirection.includes('s')) {
            windowState.size.height = Math.max(400, windowState.resizeStartHeight + deltaY);
        }
        
        updateWindowTransform();
    }

    /**
     * 停止调整窗口大小
     */
    function stopResizing() {
        windowState.isResizing = false;
        quickNoteModal.classList.remove('resizing');
        
        document.removeEventListener('mousemove', handleResizing);
        document.removeEventListener('mouseup', stopResizing);
        
        saveWindowState();
    }

    /**
     * 更新窗口变换
     */
    function updateWindowTransform() {
        if (!quickNoteModal) return;
        
        quickNoteModal.style.transform = `translate(${windowState.position.x}px, ${windowState.position.y}px)`;
        quickNoteModal.style.width = `${windowState.size.width}px`;
        quickNoteModal.style.height = `${windowState.size.height}px`;
    }

    /**
     * 保存窗口状态
     */
    function saveWindowState() {
        try {
            localStorage.setItem('tstPageNoteWindow', JSON.stringify({
                position: windowState.position,
                size: windowState.size
            }));
        } catch (e) {
            console.log('无法保存窗口状态:', e);
        }
    }

    /**
     * 加载窗口状态
     */
    function loadWindowState() {
        try {
            const saved = localStorage.getItem('tstPageNoteWindow');
            if (saved) {
                const state = JSON.parse(saved);
                windowState.position = state.position || windowState.position;
                windowState.size = state.size || windowState.size;
                
                // 确保窗口在屏幕内
                const maxX = window.innerWidth - windowState.size.width;
                const maxY = window.innerHeight - windowState.size.height;
                
                windowState.position.x = Math.max(0, Math.min(maxX, windowState.position.x));
                windowState.position.y = Math.max(0, Math.min(maxY, windowState.position.y));
            }
        } catch (e) {
            console.log('无法加载窗口状态:', e);
        }
    }

    /**
     * 设置拖拽摘录功能
     */
    function setupDragAndDrop() {
        const contentArea = quickNoteModal.querySelector('#tst-note-content-area');
        const dragHint = quickNoteModal.querySelector('.tst-drag-hint');
        
        // 防止默认拖拽行为
        contentArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            quickNoteModal.classList.add('drag-over');
            dragHint.style.display = 'block';
        });

        contentArea.addEventListener('dragleave', (e) => {
            if (!contentArea.contains(e.relatedTarget)) {
                quickNoteModal.classList.remove('drag-over');
                dragHint.style.display = 'none';
            }
        });

        contentArea.addEventListener('drop', (e) => {
            e.preventDefault();
            quickNoteModal.classList.remove('drag-over');
            dragHint.style.display = 'none';
            
            const droppedText = e.dataTransfer.getData('text/plain');
            if (droppedText) {
                insertExcerpt(droppedText);
            }
        });

        // 监听页面选中文本的拖拽
        document.addEventListener('dragstart', (e) => {
            const selection = window.getSelection();
            if (selection.toString().trim()) {
                e.dataTransfer.setData('text/plain', selection.toString());
            }
        });
    }

    /**
     * 插入摘录内容
     */
    function insertExcerpt(text) {
        const textarea = quickNoteModal.querySelector('#tst-quick-note-textarea');
        const pageTitle = document.title || '无标题页面';
        const pageUrl = window.location.href;
        
        // 格式化摘录内容
        const timestamp = new Date().toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const excerpt = `> ${text.trim()}\n> \n> *摘录自: [${pageTitle}](${pageUrl}) - ${timestamp}*\n\n`;
        
        // 插入到光标位置
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentValue = textarea.value;
        
        // 如果光标不在末尾，且前面有内容，添加换行
        const prefix = (start > 0 && !currentValue.substring(start - 2, start).includes('\n\n')) ? '\n\n' : '';
        
        textarea.value = currentValue.substring(0, start) + prefix + excerpt + currentValue.substring(end);
        
        // 将光标移到插入内容的末尾
        const newPosition = start + prefix.length + excerpt.length;
        textarea.setSelectionRange(newPosition, newPosition);
        textarea.focus();
        
        showNotification('摘录已添加到笔记', 'success');
    }

    /**
     * 加载历史笔记内容
     */
    function loadHistoryNotes() {
        const pageUrl = window.location.href;
        
        // 发送消息到background脚本查询历史笔记
        chrome.runtime.sendMessage({
            action: 'loadPageNote',
            data: { url: pageUrl }
        }, (response) => {
            if (response && response.success && response.note) {
                const textarea = quickNoteModal.querySelector('#tst-quick-note-textarea');
                if (!textarea.value.trim()) {
                    // 只有当前没有内容时才加载历史笔记
                    textarea.value = response.note;
                    showNotification('已加载页面历史笔记', 'info');
                } else {
                    // 如果已有内容，提示用户是否要加载历史笔记
                    if (confirm('发现该页面的历史笔记，是否要加载？（当前内容将被替换）')) {
                        textarea.value = response.note;
                        showNotification('已加载页面历史笔记', 'info');
                    }
                }
            }
        });
    }

    /**
     * 实现复制粘贴文本自动格式化
     */
    function setupCopyPasteFormat() {
        const textarea = quickNoteModal.querySelector('#tst-quick-note-textarea');
        
        textarea.addEventListener('paste', (e) => {
            // 检查是否是纯文本粘贴
            const clipboardData = e.clipboardData || window.clipboardData;
            const pastedText = clipboardData.getData('text/plain');
            
            if (!pastedText || pastedText.trim().length === 0) {
                return; // 如果没有文本内容，使用默认行为
            }
            
            // 检查粘贴的文本是否已经是引用格式
            if (pastedText.startsWith('>') || pastedText.includes('*摘录自:')) {
                return; // 如果已经是格式化的内容，使用默认行为
            }
            
            // 检查是否是从其他地方复制的普通文本（可能是摘录）
            const lines = pastedText.split('\n');
            const isLikelyExcerpt = pastedText.length > 10 && 
                                  !pastedText.includes('\n\n') && 
                                  lines.length <= 3;
            
            if (isLikelyExcerpt) {
                e.preventDefault(); // 阻止默认粘贴行为
                
                // 使用摘录格式
                const pageTitle = document.title || '无标题页面';
                const pageUrl = window.location.href;
                const timestamp = new Date().toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                const formattedText = `> ${pastedText.trim()}\n> \n> *摘录自: [${pageTitle}](${pageUrl}) - ${timestamp}*\n\n`;
                
                // 插入格式化的文本
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const currentValue = textarea.value;
                
                const prefix = (start > 0 && !currentValue.substring(start - 2, start).includes('\n\n')) ? '\n\n' : '';
                
                textarea.value = currentValue.substring(0, start) + prefix + formattedText + currentValue.substring(end);
                
                const newPosition = start + prefix.length + formattedText.length;
                textarea.setSelectionRange(newPosition, newPosition);
                
                showNotification('文本已格式化为摘录格式', 'success');
            }
            // 对于其他情况，使用默认粘贴行为
        });
    }

    /**
     * 保存快速笔记
     */
    function saveQuickNote() {
        const textarea = quickNoteModal.querySelector('#tst-quick-note-textarea');
        const noteContent = textarea.value.trim();

        if (!noteContent) {
            alert('请输入笔记内容');
            textarea.focus();
            return;
        }

        const saveBtn = quickNoteModal.querySelector('#tst-save-btn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '保存中...';
        saveBtn.disabled = true;

        // 获取页面信息
        const pageData = {
            title: document.title || '无标题页面',
            url: window.location.href,
            note: noteContent,
            timestamp: new Date().toISOString()
        };

        // 发送消息到background脚本
        chrome.runtime.sendMessage({
            action: 'savePageNote',
            data: pageData
        }, (response) => {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;

            if (response && response.success) {
                showNotification('笔记保存成功！', 'success');
                closeQuickNoteModal();
            } else {
                const errorMsg = response ? response.error : '保存失败，请重试';
                showNotification('保存失败: ' + errorMsg, 'error');
            }
        });
    }

    /**
     * 显示通知
     */
    function showNotification(message, type = 'info') {
        // 创建简单的通知提示
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            animation: slideIn 0.3s ease;
            ${type === 'success' ? 'background: #28a745;' : 
              type === 'error' ? 'background: #dc3545;' : 'background: #17a2b8;'}
        `;
        notification.textContent = message;

        // 添加滑入动画
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        // 3秒后自动消失
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                if (style.parentNode) {
                    style.parentNode.removeChild(style);
                }
            }, 300);
        }, 3000);
    }

    /**
     * HTML转义函数
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 检查是否应该显示浮动按钮
     */
    function shouldShowFloatingButton() {
        // 检查是否是特殊页面（扩展页面、about页面等）
        const url = window.location.href;
        if (url.startsWith('chrome://') || 
            url.startsWith('chrome-extension://') || 
            url.startsWith('moz-extension://') ||
            url.startsWith('about:')) {
            return false;
        }

        // 检查是否是iframe
        if (window.self !== window.top) {
            return false;
        }

        return true;
    }

    /**
     * 初始化
     */
    function initialize() {
        // 等待页面加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialize);
            return;
        }

        // 检查是否应该显示按钮
        if (!shouldShowFloatingButton()) {
            return;
        }

        // 加载窗口状态
        loadWindowState();

        // 延迟创建，避免影响页面加载
        setTimeout(() => {
            createFloatingButton();
        }, 1000);
    }

    // 启动初始化
    initialize();

})();