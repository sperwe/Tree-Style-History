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
        
        // 绑定各种事件
        bindFloatingButtonEvents();
        
        document.body.appendChild(floatingButton);
        
        // 检查是否有历史笔记并更新按钮状态（使用延迟检查确保数据库已初始化）
        delayedCheckHistoryNoteStatus();
    }

    /**
     * 绑定浮动按钮的所有事件
     */
    function bindFloatingButtonEvents() {
        let longPressTimer = null;
        let isLongPress = false;
        let contextMenuVisible = false;

        // 单击事件
        floatingButton.addEventListener('click', (e) => {
            if (!isLongPress && !contextMenuVisible) {
                openQuickNoteModal();
            }
            isLongPress = false;
        });

        // 长按开始
        floatingButton.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // 左键
                isLongPress = false;
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    showContextMenu(e);
                }, 800); // 800ms长按
            }
        });

        // 长按结束
        floatingButton.addEventListener('mouseup', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });

        // 鼠标离开时清除长按
        floatingButton.addEventListener('mouseleave', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });

        // 右键菜单
        floatingButton.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e);
        });

        // 触摸设备支持
        let touchStartTime = 0;
        
        floatingButton.addEventListener('touchstart', (e) => {
            touchStartTime = Date.now();
            isLongPress = false;
            longPressTimer = setTimeout(() => {
                isLongPress = true;
                showContextMenu(e.touches[0]);
            }, 800);
        });

        floatingButton.addEventListener('touchend', (e) => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            
            const touchDuration = Date.now() - touchStartTime;
            if (touchDuration < 800 && !isLongPress && !contextMenuVisible) {
                openQuickNoteModal();
            }
            isLongPress = false;
        });

        // 监听点击其他地方关闭上下文菜单
        document.addEventListener('click', (e) => {
            if (contextMenuVisible && !e.target.closest('#tst-context-menu')) {
                hideContextMenu();
            }
        });

        // 监听键盘事件
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+N 打开笔记管理器（浮动窗口）
            if (e.ctrlKey && e.shiftKey && e.key === 'N') {
                e.preventDefault();
                openNoteManager('floating');
            }
            // Ctrl+Shift+F 打开笔记管理器（独立窗口）
            if (e.ctrlKey && e.shiftKey && e.key === 'F') {
                e.preventDefault();
                openNoteManager('window');
            }
            // Ctrl+Shift+T 打开笔记管理器（新标签页）
            if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                openNoteManager('tab');
            }
            // Ctrl+Shift+Q 快速新建笔记
            if (e.ctrlKey && e.shiftKey && e.key === 'Q') {
                e.preventDefault();
                openQuickNoteModal();
            }
            // ESC 关闭上下文菜单
            if (e.key === 'Escape' && contextMenuVisible) {
                hideContextMenu();
            }
        });

        // 更新上下文菜单可见性状态的辅助函数
        function updateContextMenuVisibility(visible) {
            contextMenuVisible = visible;
        }

        // 将函数绑定到全局作用域以便其他函数使用
        window.updateContextMenuVisibility = updateContextMenuVisibility;
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
                    <div class="tst-apple-controls">
                        <button class="tst-apple-control-btn tst-close" title="关闭">●</button>
                        <button class="tst-apple-control-btn tst-minimize" title="最小化">●</button>
                        <button class="tst-apple-control-btn tst-maximize" title="最大化" disabled style="opacity: 0.3;">●</button>
                    </div>
                    <h3 id="tst-quick-note-title">📝 页面笔记</h3>
                </div>
                
                <!-- 历史笔记加载区域 -->
                <div id="tst-history-notes-panel" class="tst-history-panel" style="display: none; margin: 0 10px 10px 10px; padding: 8px; border-radius: 6px;">
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                        <span class="tst-history-title" style="font-weight: bold; font-size: 13px;">📚 历史笔记</span>
                        <button id="tst-hide-history" class="tst-history-close-btn" style="margin-left: auto; background: none; border: none; cursor: pointer; font-size: 16px;" title="隐藏">&times;</button>
                    </div>
                    <div id="tst-history-notes-list" style="max-height: 120px; overflow-y: auto;"></div>
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
        const closeBtn = quickNoteModal.querySelector('.tst-close');
        const minimizeBtn = quickNoteModal.querySelector('.tst-minimize');
        const clearBtn = quickNoteModal.querySelector('#tst-clear-btn');
        const saveBtn = quickNoteModal.querySelector('#tst-save-btn');
        const textarea = quickNoteModal.querySelector('#tst-quick-note-textarea');
        const header = quickNoteModal.querySelector('#tst-quick-note-header');
        
        // 苹果风格交通灯悬停效果
        const appleControls = quickNoteModal.querySelectorAll('.tst-apple-control-btn');
        appleControls.forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                if (btn.classList.contains('tst-close')) {
                    btn.textContent = '✕';
                } else if (btn.classList.contains('tst-minimize')) {
                    btn.textContent = '−';
                } else if (btn.classList.contains('tst-maximize')) {
                    btn.textContent = '+';
                }
            });
            
            btn.addEventListener('mouseleave', () => {
                btn.textContent = '●';
            });
        });

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
            console.log('[TST Notes] 加载笔记响应:', response);
            
            if (response && response.success && response.note) {
                const notesData = response.note;
                const textarea = quickNoteModal.querySelector('#tst-quick-note-textarea');
                
                if (notesData.count === 1) {
                    // 只有一个笔记，直接加载
                    loadSingleNote(notesData.latest, textarea);
                } else if (notesData.count > 1) {
                    // 多个笔记，在窗口内显示简洁列表
                    showInlineNotesPanel(notesData.notes, textarea);
                }
            } else {
                console.log('[TST Notes] 未找到历史笔记或加载失败');
            }
        });
    }
    
    /**
     * 加载单个笔记
     */
    function loadSingleNote(note, textarea) {
        const noteContent = note.note || '';
        const updateTime = note.updatedAt ? new Date(note.updatedAt).toLocaleString() : '未知时间';
        
        if (!textarea.value.trim()) {
            // 当前没有内容，直接加载
            textarea.value = noteContent;
            showNotification(`已加载历史笔记 (${updateTime})`, 'info');
        } else {
            // 当前有内容，询问是否替换
            if (confirm(`发现历史笔记 (${updateTime})，是否要加载？\n当前内容将被替换。`)) {
                textarea.value = noteContent;
                showNotification(`已加载历史笔记 (${updateTime})`, 'info');
            }
        }
    }
    
    /**
     * 在笔记窗口内显示简洁的历史笔记面板
     */
    function showInlineNotesPanel(notes, textarea) {
        const historyPanel = quickNoteModal.querySelector('#tst-history-notes-panel');
        const notesList = quickNoteModal.querySelector('#tst-history-notes-list');
        
        if (!historyPanel || !notesList) return;
        
        // 清空列表
        notesList.innerHTML = '';
        
        // 添加笔记项
        notes.forEach((note, index) => {
            const updateTime = note.updatedAt ? new Date(note.updatedAt).toLocaleString() : '未知时间';
            const preview = (note.note || '').substring(0, 40) + (note.note && note.note.length > 40 ? '...' : '');
            
            const noteItem = document.createElement('div');
            noteItem.style.cssText = `
                padding: 6px 8px;
                margin-bottom: 4px;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.2s;
                font-size: 12px;
                ${index === 0 ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'background: #2a4a5c; border: 1px solid #4a90e2; color: #ffffff;' : 'background: #e3f2fd; border: 1px solid #2196f3;') : ''}
            `;
            
            noteItem.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                    <span class="tst-history-item-label ${index === 0 ? 'current' : ''}" style="font-weight: bold; ${index === 0 && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'color: #ffffff;' : ''}">${index === 0 ? '💡 最新' : `#${index + 1}`}</span>
                    <span class="tst-history-item-time" style="font-size: 10px; ${index === 0 && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'color: #ffffff;' : ''}">${updateTime.split(' ')[1] || updateTime}</span>
                </div>
                <div class="tst-history-item-preview" style="line-height: 1.3; font-size: 11px; ${index === 0 && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'color: #e0e0e0;' : ''}">${escapeHtml(preview)}</div>
            `;
            
            noteItem.addEventListener('click', () => {
                loadSelectedNote(note, textarea, updateTime);
                historyPanel.style.display = 'none'; // 加载后隐藏面板
            });
            
            noteItem.addEventListener('mouseenter', () => {
                if (index !== 0) noteItem.classList.add('tst-history-item-hover');
            });
            
            noteItem.addEventListener('mouseleave', () => {
                if (index !== 0) noteItem.classList.remove('tst-history-item-hover');
            });
            
            notesList.appendChild(noteItem);
        });
        
        // 添加快捷按钮
        const quickActions = document.createElement('div');
        quickActions.style.cssText = `
            display: flex; 
            gap: 6px; 
            margin-top: 8px; 
            padding-top: 6px; 
            border-top: 1px solid #e0e0e0;
        `;
        
        const loadLatestBtn = document.createElement('button');
        loadLatestBtn.textContent = '⚡ 加载最新';
        loadLatestBtn.style.cssText = `
            flex: 1;
            padding: 4px 8px;
            font-size: 11px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
        `;
        loadLatestBtn.addEventListener('click', () => {
            loadSelectedNote(notes[0], textarea, notes[0].updatedAt ? new Date(notes[0].updatedAt).toLocaleString() : '未知时间');
            historyPanel.style.display = 'none';
        });
        
        const mergeBtn = document.createElement('button');
        mergeBtn.textContent = '📋 合并全部';
        mergeBtn.style.cssText = `
            flex: 1;
            padding: 4px 8px;
            font-size: 11px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
        `;
        mergeBtn.addEventListener('click', () => {
            mergeAllNotes(notes, textarea);
            historyPanel.style.display = 'none';
        });
        
        quickActions.appendChild(loadLatestBtn);
        quickActions.appendChild(mergeBtn);
        notesList.appendChild(quickActions);
        
        // 显示面板
        historyPanel.style.display = 'block';
        
        // 隐藏按钮事件
        const hideBtn = quickNoteModal.querySelector('#tst-hide-history');
        if (hideBtn) {
            hideBtn.onclick = () => {
                historyPanel.style.display = 'none';
            };
        }
        
        showNotification(`发现${notes.length}条历史笔记`, 'info');
    }
    
    /**
     * 加载选中的笔记
     */
    function loadSelectedNote(note, textarea, timeStr) {
        const noteContent = note.note || '';
        
        if (!textarea.value.trim()) {
            // 当前没有内容，直接加载
            textarea.value = noteContent;
            showNotification(`已加载笔记 (${timeStr})`, 'success');
        } else {
            // 当前有内容，询问是否替换
            if (confirm(`是否要加载此笔记？\n创建时间: ${timeStr}\n当前内容将被替换。`)) {
                textarea.value = noteContent;
                showNotification(`已加载笔记 (${timeStr})`, 'success');
            }
        }
    }
    
    /**
     * 合并所有历史笔记
     */
    function mergeAllNotes(notes, textarea) {
        if (!notes || notes.length === 0) return;
        
        const currentContent = textarea.value.trim();
        const separator = '\n\n---\n\n';
        
        // 按时间倒序排列笔记（最新的在前）
        const sortedNotes = notes.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        
        let mergedContent = '';
        
        // 如果当前有内容，先保留
        if (currentContent) {
            mergedContent += `📝 当前编辑内容\n${currentContent}${separator}`;
        }
        
        // 添加所有历史笔记
        sortedNotes.forEach((note, index) => {
            const noteContent = note.note || '';
            const updateTime = note.updatedAt ? new Date(note.updatedAt).toLocaleString() : '未知时间';
            
            if (noteContent.trim()) {
                mergedContent += `📚 历史笔记 ${index + 1} (${updateTime})\n${noteContent}`;
                if (index < sortedNotes.length - 1) {
                    mergedContent += separator;
                }
            }
        });
        
        if (currentContent && !confirm(`合并后将包含当前内容和${notes.length}条历史笔记，是否继续？`)) {
            return;
        }
        
        textarea.value = mergedContent;
        showNotification(`已合并${notes.length}条历史笔记`, 'success');
        
        // 滚动到顶部
        textarea.scrollTop = 0;
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
     * 显示上下文菜单
     */
    function showContextMenu(event) {
        // 移除现有的上下文菜单
        hideContextMenu();

        // 创建上下文菜单
        const contextMenu = document.createElement('div');
        contextMenu.id = 'tst-context-menu';
        contextMenu.className = 'tst-context-menu';
        
        // 菜单项数据
        const menuItems = [
            {
                text: '📝 新建笔记',
                action: openQuickNoteModal,
                shortcut: 'Ctrl+Shift+Q'
            },
            {
                text: '🎈 浮动笔记管理器',
                action: () => openNoteManager('floating'),
                shortcut: 'Ctrl+Shift+N'
            },
            {
                text: '📚 笔记管理器 (独立窗口)',
                action: () => openNoteManager('window'),
                shortcut: 'Ctrl+Shift+F'
            },
            {
                text: '📑 笔记管理器 (新标签页)',
                action: () => openNoteManager('tab'),
                shortcut: 'Ctrl+Shift+T'
            },
            {
                text: '🔍 搜索笔记',
                action: () => openNoteManager('search'),
                shortcut: ''
            },
            'separator',
            {
                text: '⚙️ 设置',
                action: openSettings,
                shortcut: ''
            }
        ];

        // 创建菜单项
        menuItems.forEach(item => {
            if (item === 'separator') {
                const separator = document.createElement('div');
                separator.className = 'menu-separator';
                contextMenu.appendChild(separator);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = 'menu-item';
                
                const text = document.createElement('span');
                text.textContent = item.text;
                menuItem.appendChild(text);
                
                if (item.shortcut) {
                    const shortcut = document.createElement('span');
                    shortcut.className = 'menu-shortcut';
                    shortcut.textContent = item.shortcut;
                    menuItem.appendChild(shortcut);
                }
                
                menuItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    hideContextMenu();
                    item.action();
                });
                
                contextMenu.appendChild(menuItem);
            }
        });

        // 设置菜单位置
        const x = event.clientX || event.pageX;
        const y = event.clientY || event.pageY;
        
        contextMenu.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;

            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 999999;
            min-width: 200px;
            padding: 4px 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 14px;
        `;

        // 添加菜单项样式
        const style = document.createElement('style');
        style.textContent = `
            .tst-context-menu .menu-item {
                padding: 8px 16px;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
                transition: background-color 0.2s;
            }
            .tst-context-menu .menu-item:hover {
                background-color: #f5f5f5;
            }
            .tst-context-menu .menu-separator {
                height: 1px;
                background-color: #eee;
                margin: 4px 0;
            }
            .tst-context-menu .menu-shortcut {
                color: #666;
                font-size: 12px;
                margin-left: 16px;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(contextMenu);
        
        // 调整菜单位置以确保在视窗内
        const rect = contextMenu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        if (rect.right > viewportWidth) {
            contextMenu.style.left = (viewportWidth - rect.width - 10) + 'px';
        }
        if (rect.bottom > viewportHeight) {
            contextMenu.style.top = (viewportHeight - rect.height - 10) + 'px';
        }

        // 更新可见性状态
        if (window.updateContextMenuVisibility) {
            window.updateContextMenuVisibility(true);
        }
    }

    /**
     * 隐藏上下文菜单
     */
    function hideContextMenu() {
        const existingMenu = document.getElementById('tst-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // 更新可见性状态
        if (window.updateContextMenuVisibility) {
            window.updateContextMenuVisibility(false);
        }
    }

    /**
     * 打开笔记管理器
     */
    async function openNoteManager(mode = 'window') {
        try {
            if (mode === 'floating') {
                // 创建页面内浮动窗口
                await createFloatingNoteManager();
            } else if (mode === 'tab') {
                // 在新标签页中打开笔记管理器
                openNoteManagerInTab();
            } else if (chrome && chrome.runtime) {
                // 通过background script打开独立窗口
                chrome.runtime.sendMessage({
                    action: 'openNoteManager',
                    mode: mode
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('打开笔记管理器失败:', chrome.runtime.lastError);
                        // 降级方案：直接打开页面
                        fallbackOpenNoteManager(mode);
                    } else if (response && response.success) {
                        console.log('笔记管理器已打开');
                    }
                });
            } else {
                fallbackOpenNoteManager(mode);
            }
        } catch (error) {
            console.error('打开笔记管理器出错:', error);
            fallbackOpenNoteManager(mode);
        }
    }

    /**
     * 在新标签页中打开笔记管理器 - 通过background script
     */
    function openNoteManagerInTab() {
        if (chrome && chrome.runtime) {
            // 通过background script创建新标签页（推荐方案）
            chrome.runtime.sendMessage({
                action: 'openNoteManager',
                mode: 'tab'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('通过background打开标签页失败:', chrome.runtime.lastError);
                    showFloatingNotification('打开标签页失败，请重试', 'error');
                } else if (response && response.success) {
                    console.log('笔记管理器已在新标签页中打开');
                    showFloatingNotification('笔记管理器已在新标签页中打开', 'success');
                } else {
                    console.error('Background响应错误:', response);
                    showFloatingNotification('打开失败，请重试', 'error');
                }
            });
        } else {
            console.error('Chrome runtime不可用');
            showFloatingNotification('浏览器环境不支持', 'error');
        }
    }

    /**
     * 降级方案：直接打开笔记管理器页面
     */
    function fallbackOpenNoteManager(mode = 'window') {
        const url = chrome.runtime ? chrome.runtime.getURL('note-manager.html') : '/note-manager.html';
        if (mode === 'tab') {
            // 新标签页模式
            window.open(url, '_blank');
        } else {
            // 独立窗口模式
            window.open(url, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
        }
        console.log(`笔记管理器已以${mode}模式打开 (降级方案)`);
    }

    /**
     * 生成note-manager.html的完整内容用于iframe srcdoc
     * 这样浮动窗口可以100%复用独立窗口的功能
     */
    function getNoteManagerHTML() {
        // 获取extension资源的完整URL
        const cssUrl = chrome.runtime ? chrome.runtime.getURL('css/note-manager.css') : '';
        const mooToolsUrl = chrome.runtime ? chrome.runtime.getURL('scripts/moo.js') : '';
        const funcUrl = chrome.runtime ? chrome.runtime.getURL('scripts/func.js') : '';
        const jqueryUrl = chrome.runtime ? chrome.runtime.getURL('scripts/jquery-3.6.0.min.js') : '';
        const dataSanitizerUrl = chrome.runtime ? chrome.runtime.getURL('scripts/security/data-sanitizer.js') : '';
        const xssProtectionUrl = chrome.runtime ? chrome.runtime.getURL('scripts/security/xss-protection.js') : '';
        const permissionManagerUrl = chrome.runtime ? chrome.runtime.getURL('scripts/security/permission-manager.js') : '';
        const backupManagerUrl = chrome.runtime ? chrome.runtime.getURL('scripts/security/backup-manager.js') : '';
        const noteManagerUrl = chrome.runtime ? chrome.runtime.getURL('scripts/note-manager.js') : '';
        
        console.log('[Floating] CSS URL:', cssUrl);
        console.log('[Floating] Note Manager URL:', noteManagerUrl);
        
                return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>笔记管理器</title>
    <link rel="stylesheet" href="${cssUrl}">
    <script src="${mooToolsUrl}"></script>
    <script src="${funcUrl}"></script>
    <script src="${jqueryUrl}"></script>
    <style>
        /* 浮动窗口专用样式调整 */
        html, body {
            margin: 0;
            padding: 0;
            height: 100%;
            overflow: hidden;
        }
        .note-manager-container {
            height: 100vh;
            max-height: 100vh;
        }
        /* 隐藏"新窗口"按钮，因为已经在浮动窗口中 */
        #open-window {
            display: none !important;
        }
    </style>
</head>
<body>
    <div class="note-manager-container">
        <!-- 顶部工具栏 -->
        <div class="toolbar">
            <div class="toolbar-left">
                <div class="search-box">
                    <input type="text" id="global-search" placeholder="🔍 搜索笔记标题和内容..." maxlength="100">
                    <button id="clear-search" class="clear-btn" style="display: none;">✖️</button>
                </div>
            </div>
            
            <div class="toolbar-center">
                <div class="filters">
                    <select id="tag-filter" title="按标签过滤">
                        <option value="">🏷️ 全部标签</option>
                        <option value="important_very">🔥 非常重要</option>
                        <option value="important_somewhat">🔥 比较重要</option>
                        <option value="important_general">🔥 一般重要</option>
                        <option value="interesting_very">💡 非常有趣</option>
                        <option value="interesting_somewhat">💡 比较有趣</option>
                        <option value="interesting_general">💡 一般有趣</option>
                        <option value="needed_very">⚡ 非常需要</option>
                        <option value="needed_somewhat">⚡ 比较需要</option>
                        <option value="needed_general">⚡ 一般需要</option>
                    </select>
                    
                    <select id="date-filter" title="按时间过滤">
                        <option value="">📅 全部时间</option>
                        <option value="today">今天</option>
                        <option value="week">本周</option>
                        <option value="month">本月</option>
                        <option value="quarter">三个月内</option>
                        <option value="year">一年内</option>
                    </select>
                    
                    <select id="site-filter" title="按网站过滤">
                        <option value="">🌐 全部网站</option>
                    </select>
                </div>
            </div>
            
            <div class="toolbar-right">
                <div class="actions">
                    <button id="refresh-notes" title="刷新笔记列表">🔄</button>
                    <button id="batch-export" title="批量导出选中的笔记">📦 导出</button>
                    <button id="new-note" title="新建笔记">📝 新建</button>
                    <button id="open-window" title="在新窗口中打开">🗗 新窗口</button>
                    <button id="settings" title="设置">⚙️</button>
                </div>
            </div>
        </div>

        <!-- 主内容区 -->
        <div class="main-content">
            <!-- 左侧笔记列表 -->
            <div class="note-list-panel">
                <div class="list-header">
                    <div class="list-stats">
                        <span class="note-count">共 <span id="total-notes">0</span> 条笔记</span>
                        <span class="selected-count" id="selected-count" style="display: none;">已选 <span id="selected-number">0</span> 条</span>
                    </div>
                    <div class="list-controls">
                        <label class="select-all-container">
                            <input type="checkbox" id="select-all-notes">
                            <span>全选</span>
                        </label>
                        <select id="sort-by" title="排序方式">
                            <option value="priority">按优先级</option>
                            <option value="updated">按更新时间</option>
                            <option value="created">按创建时间</option>
                            <option value="title">按标题</option>
                            <option value="site">按网站</option>
                        </select>
                    </div>
                </div>
                
                <div class="note-list" id="note-list">
                    <div class="loading" id="loading-notes">
                        <div class="spinner"></div>
                        <span>正在加载笔记...</span>
                    </div>
                    <div class="empty-state" id="empty-state" style="display: none;">
                        <div class="empty-icon">📝</div>
                        <h3>暂无笔记</h3>
                        <p>点击右上角"新建"按钮开始记录</p>
                    </div>
                </div>
            </div>

            <!-- 右侧编辑/预览区 -->
            <div class="editor-panel">
                <div class="editor-header">
                    <div class="note-meta">
                        <input type="text" id="note-title" placeholder="请输入笔记标题..." maxlength="200">
                        <div class="tag-selector">
                            <button id="tag-button" class="tag-btn">🏷️ 选择标签</button>
                            <span id="current-tag" class="current-tag">无标签</span>
                        </div>
                        <div class="note-info">
                            <span id="note-url" class="note-url"></span>
                            <span id="note-dates" class="note-dates"></span>
                        </div>
                    </div>
                    <div class="editor-actions">
                        <button id="preview-mode" class="mode-btn" title="预览模式">👁️ 预览</button>
                        <button id="edit-mode" class="mode-btn active" title="编辑模式">✏️ 编辑</button>
                        <button id="reference-note" class="action-btn" title="生成引用链接">📌 引用</button>
                        <button id="copy-note" class="action-btn" title="复制笔记内容">📋 复制</button>
                        <button id="delete-note" class="action-btn danger" title="删除当前笔记" style="display: none;">🗑️ 删除</button>
                        <button id="save-note" class="action-btn primary" title="保存笔记">💾 保存</button>
                    </div>
                </div>
                
                <div class="editor-content">
                    <textarea id="note-editor" placeholder="开始编写你的笔记... 
                    
💡 支持 Markdown 格式
📝 自动保存功能
🔍 支持全文搜索
🏷️ 使用标签分类管理"></textarea>
                    <div id="note-preview" class="markdown-preview" style="display: none;">
                        <div class="preview-placeholder">
                            <div class="preview-icon">👁️</div>
                            <p>在左侧选择笔记查看预览</p>
                        </div>
                    </div>
                </div>
                
                <div class="editor-status">
                    <span id="word-count">0 字符</span>
                    <span id="save-status"></span>
                    <span id="security-status" title="数据安全状态">🔒 安全</span>
                </div>
            </div>
        </div>
    </div>

    <!-- 标签选择器模态框 -->
    <div id="tag-selector-modal" class="modal" style="display: none;">
        <div class="modal-content">
            <div class="modal-header">
                <h3>🏷️ 选择笔记标签</h3>
                <button class="modal-close">✖️</button>
            </div>
            <div class="modal-body">
                <div class="tag-categories">
                    <div class="tag-category">
                        <h4>📋 分类维度</h4>
                        <div class="tag-options">
                            <label><input type="radio" name="category" value="important"> 🔥 重要</label>
                            <label><input type="radio" name="category" value="interesting"> 💡 有趣</label>
                            <label><input type="radio" name="category" value="needed"> ⚡ 需要</label>
                        </div>
                    </div>
                    <div class="tag-category">
                        <h4>📊 程度维度</h4>
                        <div class="tag-options">
                            <label><input type="radio" name="priority" value="very"> 非常</label>
                            <label><input type="radio" name="priority" value="somewhat"> 比较</label>
                            <label><input type="radio" name="priority" value="general"> 一般</label>
                        </div>
                    </div>
                </div>
                <div class="tag-preview">
                    <span>预览：</span>
                    <span id="tag-preview-display" class="tag-badge">请选择标签</span>
                </div>
            </div>
            <div class="modal-footer">
                <button id="tag-confirm" class="btn-primary">确定</button>
                <button id="tag-cancel" class="btn-secondary">取消</button>
            </div>
        </div>
    </div>

    <!-- 引用选择器模态框 -->
    <div id="reference-modal" class="modal" style="display: none;">
        <div class="modal-content">
            <div class="modal-header">
                <h3>📌 生成笔记引用</h3>
                <button class="modal-close">✖️</button>
            </div>
            <div class="modal-body">
                <div class="reference-formats">
                    <label><input type="radio" name="ref-format" value="full" checked> 完整引用（标题+链接+日期）</label>
                    <label><input type="radio" name="ref-format" value="quote"> 内容片段（带来源标注）</label>
                    <label><input type="radio" name="ref-format" value="simple"> 快速引用（仅标题）</label>
                    <label><input type="radio" name="ref-format" value="link"> 纯链接</label>
                </div>
                <div class="reference-preview">
                    <h4>预览：</h4>
                    <pre id="reference-preview-text"></pre>
                </div>
            </div>
            <div class="modal-footer">
                <button id="copy-reference" class="btn-primary">📋 复制引用</button>
                <button id="reference-cancel" class="btn-secondary">取消</button>
            </div>
        </div>
    </div>

    <!-- 导出确认模态框 -->
    <div id="export-modal" class="modal" style="display: none;">
        <div class="modal-content">
            <div class="modal-header">
                <h3>📦 批量导出笔记</h3>
                <button class="modal-close">✖️</button>
            </div>
            <div class="modal-body">
                <div class="export-summary">
                    <p>准备导出 <strong id="export-count">0</strong> 条笔记</p>
                    <div id="sensitive-warning" class="warning" style="display: none;">
                        ⚠️ 检测到可能包含敏感信息的笔记，请确认是否继续导出。
                    </div>
                </div>
                                 <div class="export-formats">
                     <label><input type="radio" name="export-format" value="json" checked> JSON格式（完整数据）</label>
                     <label><input type="radio" name="export-format" value="markdown"> Markdown格式（纯文本）</label>
                 </div>
                <div class="export-options">
                    <label><input type="checkbox" id="include-metadata" checked> 包含元数据（标签、时间等）</label>
                    <label><input type="checkbox" id="mask-sensitive"> 自动遮盖敏感信息</label>
                </div>
            </div>
            <div class="modal-footer">
                <button id="confirm-export" class="btn-primary">📥 确认导出</button>
                <button id="export-cancel" class="btn-secondary">取消</button>
            </div>
        </div>
    </div>

    <!-- 通知提示 -->
    <div id="notification" class="notification" style="display: none;">
        <span id="notification-text"></span>
        <button id="notification-close">✖️</button>
    </div>

    <!-- 加载安全模块和主脚本 -->
    <script src="${dataSanitizerUrl}"></script>
    <script src="${xssProtectionUrl}"></script>
    <script src="${permissionManagerUrl}"></script>
    <script src="${backupManagerUrl}"></script>
    <script src="${noteManagerUrl}"></script>
</body>
</html>`;
    }

    /**
     * 注入浮动窗口所需的CSS样式
     */
    async function injectFloatingWindowCSS() {
        // 检查是否已经注入过CSS
        if (document.getElementById('tst-floating-window-css')) {
            return;
        }

        console.log('[Floating] 开始注入CSS样式...');

        try {
            // 直接使用降级CSS方案，确保苹果风格应用
            console.log('[Floating] 使用优化的苹果风格降级CSS');
            injectBasicFloatingCSS();
            return;
            
            // 备用：通过background script获取CSS内容
            const cssContent = await getCSSContentFromBackground();
            
            if (!cssContent) {
                console.warn('[Floating] 无法获取完整CSS，使用降级方案');
                injectBasicFloatingCSS();
                return;
            }

            // 创建style标签并添加CSS作用域
            const styleElement = document.createElement('style');
            styleElement.id = 'tst-floating-window-css';
            
            // 为CSS添加作用域，避免污染主页面
            const scopedCSS = cssContent.replace(/([^{}]+)\s*{/g, (match, selector) => {
                const cleanSelector = selector.trim();
                
                // 跳过@规则、伪元素和特殊选择器
                if (cleanSelector.startsWith('@') || 
                    cleanSelector.includes('::') ||
                    cleanSelector.includes(':root') ||
                    cleanSelector.match(/^(html|body)(\s|$)/)) {
                    return match;
                }
                
                // 分割多个选择器（逗号分隔）
                const selectors = cleanSelector.split(',').map(sel => {
                    const trimmedSel = sel.trim();
                    // 为每个选择器添加作用域前缀
                    return `#tst-floating-note-manager ${trimmedSel}`;
                }).join(', ');
                
                return `${selectors} {`;
            });

            styleElement.textContent = scopedCSS;
            document.head.appendChild(styleElement);

            console.log('[Floating] CSS样式注入完成');
        } catch (error) {
            console.error('[Floating] CSS注入失败:', error);
            // 降级方案：使用基础内联样式
            injectBasicFloatingCSS();
        }
    }

    /**
     * 通过background script获取CSS内容
     */
    function getCSSContentFromBackground() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: 'getNoteManagerCSS'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('[Floating] 获取CSS失败:', chrome.runtime.lastError);
                    resolve(null);
                } else if (response && response.success) {
                    resolve(response.css);
                } else {
                    resolve(null);
                }
            });
        });
    }

    /**
     * 降级方案：注入基础的浮动窗口样式
     */
    function injectBasicFloatingCSS() {
        console.log('[Floating] 使用降级CSS方案...');
        
        const styleElement = document.createElement('style');
        styleElement.id = 'tst-floating-window-css';
        
        // 现代苹果/macOS风格的CSS样式
        styleElement.textContent = `
            /* CSS变量定义 */
            #tst-floating-note-manager {
                --floating-bg-primary: #ffffff;
                --floating-bg-secondary: #f8f9fa;
                --floating-text-primary: #1d1d1f;
                --floating-text-secondary: #666;
                --floating-border: rgba(0, 0, 0, 0.04);
            }
            
            /* 全局重置和基础样式 */
            #tst-floating-note-manager * {
                box-sizing: border-box;
            }
            
            #tst-floating-note-manager .note-manager-container {
                display: flex;
                flex-direction: column;
                height: 100%;
                background: #ffffff;
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Helvetica, Arial, sans-serif;
                line-height: 1.47;
                color: #1d1d1f;
                font-weight: 400;
                letter-spacing: -0.003em;
            }
            
            /* 工具栏样式 - macOS风格 */
            #tst-floating-note-manager .toolbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 20px;
                background: rgba(255, 255, 255, 0.8);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border-bottom: 0.5px solid rgba(0, 0, 0, 0.04);
                z-index: 100;
                min-height: 64px;
                flex-shrink: 0;
            }
            
            #tst-floating-note-manager .toolbar-left,
            #tst-floating-note-manager .toolbar-center,
            #tst-floating-note-manager .toolbar-right {
                display: flex;
                align-items: center;
                gap: 14px;
            }
            
            #tst-floating-note-manager .toolbar-left {
                flex: 1;
            }
            
            /* 搜索框样式 - iOS/macOS风格 */
            #tst-floating-note-manager .search-box {
                position: relative;
                display: flex;
                align-items: center;
            }
            
            #tst-floating-note-manager .search-box input {
                padding: 10px 16px 10px 36px;
                border: none;
                border-radius: 10px;
                font-size: 15px;
                font-weight: 400;
                width: 300px;
                background: rgba(142, 142, 147, 0.12);
                color: #1d1d1f;
                transition: all 0.2s ease;
                font-family: inherit;
            }
            
            #tst-floating-note-manager .search-box input::placeholder {
                color: rgba(60, 60, 67, 0.6);
                font-weight: 400;
            }
            
            #tst-floating-note-manager .search-box input:focus {
                outline: none;
                background: rgba(142, 142, 147, 0.16);
                box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.16);
            }
            
            #tst-floating-note-manager .search-box::before {
                content: "🔍";
                position: absolute;
                left: 12px;
                color: rgba(60, 60, 67, 0.6);
                font-size: 14px;
                pointer-events: none;
            }
            
            /* 过滤器样式 - macOS风格 */
            #tst-floating-note-manager .filters select {
                padding: 8px 12px;
                border: none;
                border-radius: 8px;
                background: rgba(142, 142, 147, 0.12);
                font-size: 14px;
                font-weight: 400;
                cursor: pointer;
                min-width: 130px;
                color: #1d1d1f;
                font-family: inherit;
                transition: all 0.2s ease;
            }
            
            #tst-floating-note-manager .filters select:focus {
                outline: none;
                background: rgba(142, 142, 147, 0.16);
                box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.16);
            }
            
            /* 按钮样式 - iOS/macOS风格 */
            #tst-floating-note-manager button {
                padding: 10px 16px;
                border: none;
                border-radius: 8px;
                background: rgba(142, 142, 147, 0.12);
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                color: #007AFF;
                transition: all 0.2s ease;
                white-space: nowrap;
                font-family: inherit;
                letter-spacing: -0.01em;
            }
            
            #tst-floating-note-manager button:hover {
                background: rgba(142, 142, 147, 0.2);
                transform: scale(0.98);
            }
            
            #tst-floating-note-manager button.btn-primary {
                background: #007AFF;
                color: white;
            }
            
            #tst-floating-note-manager button.btn-primary:hover {
                background: #0056CC;
                transform: scale(0.98);
            }
            
            #tst-floating-note-manager button.danger {
                color: #FF3B30;
            }
            
            #tst-floating-note-manager button.danger:hover {
                background: rgba(255, 59, 48, 0.1);
            }
            
            /* 主内容区域 */
            #tst-floating-note-manager .main-content {
                display: flex;
                flex: 1;
                overflow: hidden;
                background: #ffffff;
            }
            
            /* 左侧笔记列表面板 - macOS侧边栏风格 */
            #tst-floating-note-manager .note-list-panel {
                width: 360px;
                min-width: 280px;
                max-width: 480px;
                border-right: 0.5px solid rgba(0, 0, 0, 0.04);
                background: rgba(246, 246, 246, 0.6);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                display: flex;
                flex-direction: column;
                resize: horizontal;
                overflow: hidden;
            }
            
            #tst-floating-note-manager .list-header {
                padding: 16px 20px;
                border-bottom: 0.5px solid rgba(0, 0, 0, 0.04);
                background: rgba(255, 255, 255, 0.4);
                flex-shrink: 0;
            }
            
            #tst-floating-note-manager .list-stats {
                display: flex;
                align-items: center;
                gap: 16px;
                margin-bottom: 10px;
                font-size: 13px;
                font-weight: 500;
                color: rgba(60, 60, 67, 0.8);
            }
            
            #tst-floating-note-manager .list-controls {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }
            
            #tst-floating-note-manager .list-controls select {
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 12px;
                background: #fff;
            }
            
            /* 笔记列表 */
            #tst-floating-note-manager .note-list {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
            }
            
            #tst-floating-note-manager .note-item {
                padding: 12px 16px;
                border-bottom: 1px solid #f0f0f0;
                cursor: pointer;
                transition: background-color 0.15s;
                position: relative;
            }
            
            #tst-floating-note-manager .note-item:hover,
            #tst-floating-note-manager .floating-note-item-hover:hover {
                background: #f8f9fa;
            }
            
            #tst-floating-note-manager .note-item.active {
                background: #e3f2fd;
                border-left: 3px solid #2196f3;
            }
            
            #tst-floating-note-manager .note-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 6px;
            }
            
            #tst-floating-note-manager .note-title {
                font-weight: 500;
                color: #333;
                font-size: 14px;
                line-height: 1.3;
                flex: 1;
                margin-right: 8px;
                word-break: break-word;
            }
            
            #tst-floating-note-manager .note-actions {
                display: flex;
                gap: 4px;
                opacity: 0;
                transition: opacity 0.2s;
            }
            
            #tst-floating-note-manager .note-item:hover .note-actions {
                opacity: 1;
            }
            
            #tst-floating-note-manager .note-action-btn {
                padding: 2px 4px;
                font-size: 12px;
                border: none;
                background: rgba(0,0,0,0.1);
                border-radius: 3px;
                cursor: pointer;
            }
            
            #tst-floating-note-manager .note-preview {
                color: #666;
                font-size: 13px;
                line-height: 1.4;
                margin-bottom: 6px;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
            
            #tst-floating-note-manager .note-meta {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                color: #999;
            }
            
            /* 右侧编辑器面板 */
            #tst-floating-note-manager .editor-panel {
                flex: 1;
                display: flex;
                flex-direction: column;
                background: #fff;
                min-width: 400px;
            }
            
            #tst-floating-note-manager .editor-header {
                padding: 16px;
                border-bottom: 1px solid #e0e0e0;
                background: #fafafa;
                flex-shrink: 0;
            }
            
            #tst-floating-note-manager .note-meta {
                margin-bottom: 12px;
            }
            
            #tst-floating-note-manager #note-title {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 16px;
                font-weight: 500;
                margin-bottom: 12px;
                background: #fff;
            }
            
            #tst-floating-note-manager #note-title:focus {
                outline: none;
                border-color: #007bff;
                box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
            }
            
            #tst-floating-note-manager .tag-selector {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
            }
            
            #tst-floating-note-manager .editor-actions {
                display: flex;
                gap: 8px;
                margin-top: 12px;
            }
            
            #tst-floating-note-manager .editor-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            
            #tst-floating-note-manager #note-editor {
                flex: 1;
                border: none;
                padding: 24px;
                font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
                font-size: 15px;
                line-height: 1.6;
                resize: none;
                outline: none;
                background: #ffffff;
                color: #1d1d1f;
                overflow-y: auto;
                font-weight: 400;
                letter-spacing: 0.01em;
            }
            
            #tst-floating-note-manager .editor-status {
                padding: 8px 16px;
                background: var(--floating-bg-secondary);
                border-top: 1px solid var(--floating-border);
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 12px;
                color: var(--floating-text-secondary);
                flex-shrink: 0;
            }
            
            /* 浮动窗口状态提示 */
            #tst-floating-note-manager .tst-floating-loading {
                color: var(--floating-text-secondary);
            }
            
            #tst-floating-note-manager .tst-floating-empty {
                color: var(--floating-text-secondary);
            }
            
            #tst-floating-note-manager .tst-floating-error {
                color: #dc3545;
            }
            
            /* 状态样式 */
            #tst-floating-note-manager .loading {
                padding: 60px 20px;
                text-align: center;
                color: #666;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
            }
            
            #tst-floating-note-manager .spinner {
                width: 24px;
                height: 24px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #007bff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            #tst-floating-note-manager .empty-state {
                padding: 60px 20px;
                text-align: center;
                color: #999;
            }
            
            #tst-floating-note-manager .empty-icon {
                font-size: 48px;
                margin-bottom: 16px;
                opacity: 0.5;
            }
            
            #tst-floating-note-manager .empty-state h3 {
                margin: 0 0 8px 0;
                font-size: 18px;
                color: #666;
            }
            
            #tst-floating-note-manager .empty-state p {
                margin: 0;
                font-size: 14px;
                color: #999;
            }
            
            /* 滚动条样式 - macOS风格 */
            #tst-floating-note-manager .note-list::-webkit-scrollbar,
            #tst-floating-note-manager #note-editor::-webkit-scrollbar {
                width: 6px;
            }
            
            #tst-floating-note-manager .note-list::-webkit-scrollbar-track,
            #tst-floating-note-manager #note-editor::-webkit-scrollbar-track {
                background: transparent;
            }
            
            #tst-floating-note-manager .note-list::-webkit-scrollbar-thumb,
            #tst-floating-note-manager #note-editor::-webkit-scrollbar-thumb {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 10px;
                border: 2px solid transparent;
                background-clip: content-box;
            }
            
            #tst-floating-note-manager .note-list::-webkit-scrollbar-thumb:hover,
            #tst-floating-note-manager #note-editor::-webkit-scrollbar-thumb:hover {
                background: rgba(0, 0, 0, 0.3);
                background-clip: content-box;
            }
            
            /* 模态框样式 */
            #tst-floating-note-manager .modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            }
            
            #tst-floating-note-manager .modal-content {
                background: white;
                border-radius: 8px;
                max-width: 500px;
                width: 90%;
                max-height: 80%;
                overflow-y: auto;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            }
            
            #tst-floating-note-manager .modal-header {
                padding: 16px 20px;
                border-bottom: 1px solid #e0e0e0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            #tst-floating-note-manager .modal-body {
                padding: 20px;
            }
            
            #tst-floating-note-manager .modal-footer {
                padding: 16px 20px;
                border-top: 1px solid #e0e0e0;
                display: flex;
                gap: 8px;
                justify-content: flex-end;
            }
            
            /* 通知样式 */
            #tst-floating-note-manager .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #007bff;
                color: white;
                padding: 12px 16px;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                z-index: 1001;
                display: flex;
                align-items: center;
                gap: 8px;
                max-width: 300px;
            }
            
            /* 响应式调整 */
            @media (max-width: 900px) {
                #tst-floating-note-manager .note-list-panel {
                    width: 300px;
                    min-width: 250px;
                }
                
                #tst-floating-note-manager .toolbar-left,
                #tst-floating-note-manager .toolbar-center,
                #tst-floating-note-manager .toolbar-right {
                    gap: 8px;
                }
                
                #tst-floating-note-manager .search-box input {
                    width: 200px;
                }
            }
            
            /* 深色模式支持 */
            @media (prefers-color-scheme: dark) {
                #tst-floating-note-manager {
                    --floating-bg-primary: #1a1a1a;
                    --floating-bg-secondary: #2d2d2d;
                    --floating-text-primary: #e0e0e0;
                    --floating-text-secondary: #b0b0b0;
                    --floating-border: rgba(255, 255, 255, 0.08);
                }
                
                #tst-floating-note-manager .note-manager-container,
                #tst-floating-note-manager .main-content {
                    background: var(--floating-bg-primary);
                    color: var(--floating-text-primary);
                }
                
                #tst-floating-note-manager .toolbar {
                    background: rgba(45, 45, 45, 0.8);
                    border-bottom-color: rgba(255, 255, 255, 0.08);
                }
                
                #tst-floating-note-manager .note-list-panel {
                    background: rgba(35, 35, 35, 0.6);
                    border-right-color: rgba(255, 255, 255, 0.08);
                }
                
                #tst-floating-note-manager .list-header {
                    background: rgba(45, 45, 45, 0.4);
                    border-bottom-color: rgba(255, 255, 255, 0.08);
                }
                
                #tst-floating-note-manager .list-stats {
                    color: rgba(180, 180, 180, 0.8);
                }
                
                #tst-floating-note-manager .note-item {
                    background: #2d2d2d;
                    color: #e0e0e0;
                    border-bottom-color: rgba(255, 255, 255, 0.06);
                }
                
                #tst-floating-note-manager .note-item:hover,
                #tst-floating-note-manager .floating-note-item-hover:hover {
                    background: #3a3a3a;
                }
                
                /* 深色模式下的状态提示 */
                #tst-floating-note-manager .tst-floating-error {
                    color: #ff6b6b;
                }
                
                #tst-floating-note-manager .note-item.active {
                    background: #1e3a5f;
                    border-left-color: #4a90e2;
                }
                
                #tst-floating-note-manager .note-title {
                    color: #e0e0e0;
                }
                
                #tst-floating-note-manager .note-preview {
                    color: #b0b0b0;
                }
                
                #tst-floating-note-manager .note-meta {
                    color: #888;
                }
                
                #tst-floating-note-manager .editor-panel {
                    background: #1a1a1a;
                }
                
                #tst-floating-note-manager .editor-header {
                    background: #2d2d2d;
                    border-bottom-color: rgba(255, 255, 255, 0.08);
                }
                
                #tst-floating-note-manager #note-title,
                #tst-floating-note-manager #note-editor {
                    background: #1e1e1e;
                    color: #e0e0e0;
                    border-color: #404040;
                }
                
                #tst-floating-note-manager #note-title:focus,
                #tst-floating-note-manager #note-editor:focus {
                    border-color: #4a90e2;
                    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.3);
                }
                
                #tst-floating-note-manager .search-box input,
                #tst-floating-note-manager .filters select {
                    background: rgba(255, 255, 255, 0.1);
                    color: #e0e0e0;
                    border-color: #404040;
                }
                
                #tst-floating-note-manager .search-box input::placeholder {
                    color: rgba(180, 180, 180, 0.6);
                }
                
                #tst-floating-note-manager .search-box input:focus,
                #tst-floating-note-manager .filters select:focus {
                    background: rgba(255, 255, 255, 0.15);
                    box-shadow: 0 0 0 4px rgba(74, 144, 226, 0.3);
                }
                
                #tst-floating-note-manager button {
                    background: rgba(255, 255, 255, 0.1);
                    color: #4a90e2;
                }
                
                #tst-floating-note-manager button:hover {
                    background: rgba(255, 255, 255, 0.15);
                }
                
                #tst-floating-note-manager button.btn-primary {
                    background: #4a90e2;
                    color: white;
                }
                
                #tst-floating-note-manager button.btn-primary:hover {
                    background: #357abd;
                }
                
                #tst-floating-note-manager button.danger {
                    color: #ff6b6b;
                }
                
                #tst-floating-note-manager button.danger:hover {
                    background: rgba(255, 107, 107, 0.1);
                }
                
                #tst-floating-note-manager .modal-content {
                    background: #2d2d2d;
                    color: #e0e0e0;
                }
                
                #tst-floating-note-manager .modal-header,
                #tst-floating-note-manager .modal-footer {
                    border-color: rgba(255, 255, 255, 0.08);
                }
                
                #tst-floating-note-manager .empty-state {
                    color: #666;
                }
                
                #tst-floating-note-manager .empty-state h3 {
                    color: #888;
                }
                
                #tst-floating-note-manager .empty-state p {
                    color: #666;
                }
                
                /* 深色模式下的滚动条 */
                #tst-floating-note-manager .note-list::-webkit-scrollbar-thumb,
                #tst-floating-note-manager #note-editor::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.2);
                }
                
                #tst-floating-note-manager .note-list::-webkit-scrollbar-thumb:hover,
                #tst-floating-note-manager #note-editor::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.3);
                }
            }
        `;
        
        document.head.appendChild(styleElement);
        console.log('[Floating] 基础CSS样式注入完成');
    }

    /**
     * 创建浮动窗口标题栏
     */
    function createFloatingTitleBar(floatingManager) {
        const titleBar = document.createElement('div');
        titleBar.className = 'floating-title-bar';
        titleBar.style.cssText = `
            background: rgba(246, 246, 246, 0.8);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            color: #1d1d1f;
            padding: 12px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
            user-select: none;
            border-radius: 12px 12px 0 0;
            font-weight: 600;
            font-size: 14px;
            border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
        `;

        // 窗口控制按钮 - 苹果风格（左侧）
        const controls = document.createElement('div');
        controls.style.cssText = 'display: flex; gap: 8px; padding-left: 12px; align-items: center;';

        const closeBtn = createMacControlButton('●', '关闭', '#FF5F57', () => {
            floatingManager.remove();
        });

        const minimizeBtn = createMacControlButton('●', '最小化', '#FFBD2E', () => {
            floatingManager.style.display = 'none';
        });

        const maximizeBtn = createMacControlButton('●', '最大化', '#28CA42', () => {
            if (floatingManager.dataset.maximized === 'true') {
                // 还原
                floatingManager.style.width = '920px';
                floatingManager.style.height = '720px';
                floatingManager.style.top = '60px';
                floatingManager.style.right = '60px';
                floatingManager.style.left = 'auto';
                floatingManager.dataset.maximized = 'false';
            } else {
                // 最大化
                floatingManager.style.width = '100vw';
                floatingManager.style.height = '100vh';
                floatingManager.style.top = '0';
                floatingManager.style.left = '0';
                floatingManager.style.right = 'auto';
                floatingManager.dataset.maximized = 'true';
            }
        });

        controls.appendChild(closeBtn);
        controls.appendChild(minimizeBtn);
        controls.appendChild(maximizeBtn);
        titleBar.appendChild(controls);

        const titleText = document.createElement('span');
        titleText.textContent = '🎈 笔记管理器 (浮动窗口)';
        titleText.style.cssText = `
            flex: 1;
            text-align: center;
            margin-right: 90px; /* 平衡左侧按钮的空间 */
            font-weight: 600;
            font-size: 14px;
            color: #1d1d1f;
        `;
        titleBar.appendChild(titleText);

        return titleBar;
    }

    /**
     * 创建笔记管理器的内容DOM结构
     */
    async function createNoteManagerContent(container) {
        console.log('[Floating] 开始创建笔记管理器DOM结构...');

        // 创建主要的笔记管理器结构
        container.innerHTML = `
            <div class="note-manager-container">
                <!-- 顶部工具栏 -->
                <div class="toolbar">
                    <div class="toolbar-left">
                        <div class="search-box">
                            <input type="text" id="global-search" placeholder="🔍 搜索笔记标题和内容..." maxlength="100">
                            <button id="clear-search" class="clear-btn" style="display: none;">✖️</button>
                        </div>
                    </div>
                    
                    <div class="toolbar-center">
                        <div class="filters">
                            <select id="tag-filter" title="按标签过滤">
                                <option value="">🏷️ 全部标签</option>
                                <option value="important_very">🔥 非常重要</option>
                                <option value="important_somewhat">🔥 比较重要</option>
                                <option value="important_general">🔥 一般重要</option>
                                <option value="interesting_very">💡 非常有趣</option>
                                <option value="interesting_somewhat">💡 比较有趣</option>
                                <option value="interesting_general">💡 一般有趣</option>
                                <option value="needed_very">⚡ 非常需要</option>
                                <option value="needed_somewhat">⚡ 比较需要</option>
                                <option value="needed_general">⚡ 一般需要</option>
                            </select>
                            
                            <select id="date-filter" title="按时间过滤">
                                <option value="">📅 全部时间</option>
                                <option value="today">今天</option>
                                <option value="week">本周</option>
                                <option value="month">本月</option>
                                <option value="quarter">三个月内</option>
                                <option value="year">一年内</option>
                            </select>
                            
                            <select id="site-filter" title="按网站过滤">
                                <option value="">🌐 全部网站</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="toolbar-right">
                        <div class="actions">
                            <button id="refresh-notes" title="刷新笔记列表">🔄</button>
                            <button id="batch-export" title="批量导出选中的笔记">📦 导出</button>
                            <button id="new-note" title="新建笔记">📝 新建</button>
                            <button id="settings" title="设置">⚙️</button>
                        </div>
                    </div>
                </div>

                <!-- 主内容区 -->
                <div class="main-content">
                    <!-- 左侧笔记列表 -->
                    <div class="note-list-panel">
                        <div class="list-header">
                            <div class="list-stats">
                                <span class="note-count">共 <span id="total-notes">0</span> 条笔记</span>
                                <span class="selected-count" id="selected-count" style="display: none;">已选 <span id="selected-number">0</span> 条</span>
                            </div>
                            <div class="list-controls">
                                <label class="select-all-container">
                                    <input type="checkbox" id="select-all-notes">
                                    <span>全选</span>
                                </label>
                                <select id="sort-by" title="排序方式">
                                    <option value="priority">按优先级</option>
                                    <option value="updated">按更新时间</option>
                                    <option value="created">按创建时间</option>
                                    <option value="title">按标题</option>
                                    <option value="site">按网站</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="note-list" id="note-list">
                            <div class="loading" id="loading-notes">
                                <div class="spinner"></div>
                                <span>正在加载笔记...</span>
                            </div>
                            <div class="empty-state" id="empty-state" style="display: none;">
                                <div class="empty-icon">📝</div>
                                <h3>暂无笔记</h3>
                                <p>点击右上角"新建"按钮开始记录</p>
                            </div>
                        </div>
                    </div>

                    <!-- 右侧编辑/预览区 -->
                    <div class="editor-panel">
                        <div class="editor-header">
                            <div class="note-meta">
                                <input type="text" id="note-title" placeholder="请输入笔记标题..." maxlength="200">
                                <div class="tag-selector">
                                    <button id="tag-button" class="tag-btn">🏷️ 选择标签</button>
                                    <span id="current-tag" class="current-tag">无标签</span>
                                </div>
                                <div class="note-info">
                                    <span id="note-url" class="note-url"></span>
                                    <span id="note-dates" class="note-dates"></span>
                                </div>
                            </div>
                            <div class="editor-actions">
                                <button id="preview-mode" class="mode-btn" title="预览模式">👁️ 预览</button>
                                <button id="edit-mode" class="mode-btn active" title="编辑模式">✏️ 编辑</button>
                                <button id="reference-note" class="action-btn" title="生成引用链接">📌 引用</button>
                                <button id="copy-note" class="action-btn" title="复制笔记内容">📋 复制</button>
                                <button id="delete-note" class="action-btn danger" title="删除当前笔记" style="display: none;">🗑️ 删除</button>
                                <button id="save-note" class="action-btn primary" title="保存笔记">💾 保存</button>
                            </div>
                        </div>
                        
                        <div class="editor-content">
                            <textarea id="note-editor" placeholder="开始编写你的笔记... 

💡 支持 Markdown 格式
📝 自动保存功能
🔍 支持全文搜索
🏷️ 使用标签分类管理"></textarea>
                            <div id="note-preview" class="markdown-preview" style="display: none;">
                                <div class="preview-placeholder">
                                    <div class="preview-icon">👁️</div>
                                    <p>在左侧选择笔记查看预览</p>
                                </div>
                            </div>
                        </div>
                        
                        <div class="editor-status">
                            <span id="word-count">0 字符</span>
                            <span id="save-status"></span>
                            <span id="security-status" title="数据安全状态">🔒 安全</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 标签选择器模态框 -->
            <div id="tag-selector-modal" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>🏷️ 选择笔记标签</h3>
                        <button class="modal-close">✖️</button>
                    </div>
                    <div class="modal-body">
                        <div class="tag-categories">
                            <div class="tag-category">
                                <h4>📋 分类维度</h4>
                                <div class="tag-options">
                                    <label><input type="radio" name="category" value="important"> 🔥 重要</label>
                                    <label><input type="radio" name="category" value="interesting"> 💡 有趣</label>
                                    <label><input type="radio" name="category" value="needed"> ⚡ 需要</label>
                                </div>
                            </div>
                            <div class="tag-category">
                                <h4>📊 程度维度</h4>
                                <div class="tag-options">
                                    <label><input type="radio" name="priority" value="very"> 非常</label>
                                    <label><input type="radio" name="priority" value="somewhat"> 比较</label>
                                    <label><input type="radio" name="priority" value="general"> 一般</label>
                                </div>
                            </div>
                        </div>
                        <div class="tag-preview">
                            <span>预览：</span>
                            <span id="tag-preview-display" class="tag-badge">请选择标签</span>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="tag-confirm" class="btn-primary">确定</button>
                        <button id="tag-cancel" class="btn-secondary">取消</button>
                    </div>
                </div>
            </div>

            <!-- 通知区域 -->
            <div id="notification" class="notification" style="display: none;">
                <span id="notification-text"></span>
                <button id="notification-close">✖️</button>
            </div>
        `;

        console.log('[Floating] 笔记管理器DOM结构创建完成');
    }

    /**
     * 添加浮动窗口键盘快捷键
     */
    function addFloatingWindowKeyboardShortcuts(floatingManager) {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && floatingManager.style.display !== 'none') {
                floatingManager.style.display = 'none';
            }
        });
    }

    /**
     * 初始化浮动笔记管理器功能
     */
    async function initializeFloatingNoteManager(container) {
        console.log('[Floating] 开始初始化笔记管理器功能...');

        try {
            // 动态加载必要的脚本
            await loadFloatingWindowScripts();
            
            // 初始化笔记管理器的核心功能
            // 这里需要将note-manager.js的功能适配到浮动窗口环境
            initializeNoteManagerCore(container);
            
            console.log('[Floating] 笔记管理器功能初始化完成');
        } catch (error) {
            console.error('[Floating] 初始化笔记管理器功能失败:', error);
        }
    }

    /**
     * 加载浮动窗口所需的脚本
     */
    async function loadFloatingWindowScripts() {
        // 这里可以动态加载jQuery等依赖，如果需要的话
        console.log('[Floating] 脚本加载完成');
    }

    /**
     * 初始化笔记管理器核心功能
     */
    function initializeNoteManagerCore(container) {
        console.log('[Floating] 开始初始化核心功能...');
        
        // 绑定所有按钮事件
        bindFloatingWindowEvents(container);
        
        // 加载笔记列表
        loadFloatingNotesData(container);
        
        console.log('[Floating] 核心功能初始化完成');
    }

    /**
     * 绑定浮动窗口的所有事件处理器
     */
    function bindFloatingWindowEvents(container) {
        // 刷新按钮
        const refreshBtn = container.querySelector('#refresh-notes');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log('[Floating] 刷新笔记列表');
                loadFloatingNotesData(container);
            });
        }

        // 新建笔记按钮
        const newNoteBtn = container.querySelector('#new-note');
        if (newNoteBtn) {
            newNoteBtn.addEventListener('click', () => {
                console.log('[Floating] 新建笔记');
                createNewFloatingNote(container);
            });
        }

        // 搜索功能
        const searchInput = container.querySelector('#global-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                console.log('[Floating] 搜索:', e.target.value);
                filterFloatingNotes(container, e.target.value);
            });
        }

        // 标签过滤
        const tagFilter = container.querySelector('#tag-filter');
        if (tagFilter) {
            tagFilter.addEventListener('change', (e) => {
                console.log('[Floating] 标签过滤:', e.target.value);
                filterFloatingNotesByTag(container, e.target.value);
            });
        }

        // 保存按钮
        const saveBtn = container.querySelector('#save-note');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                console.log('[Floating] 保存笔记');
                saveCurrentFloatingNote(container);
            });
        }

        // 删除按钮
        const deleteBtn = container.querySelector('#delete-note');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                console.log('[Floating] 删除当前笔记');
                deleteCurrentFloatingNote(container);
            });
        }

        // 标签选择器按钮
        const tagButton = container.querySelector('#tag-button');
        if (tagButton) {
            tagButton.addEventListener('click', () => {
                console.log('[Floating] 打开标签选择器');
                openFloatingTagSelector(container);
            });
        }

        // 预览/编辑模式切换
        const previewBtn = container.querySelector('#preview-mode');
        const editBtn = container.querySelector('#edit-mode');
        if (previewBtn && editBtn) {
            previewBtn.addEventListener('click', () => {
                console.log('[Floating] 切换到预览模式');
                switchToFloatingPreview(container);
            });
            editBtn.addEventListener('click', () => {
                console.log('[Floating] 切换到编辑模式');
                switchToFloatingEdit(container);
            });
        }

        // 复制按钮
        const copyBtn = container.querySelector('#copy-note');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                console.log('[Floating] 复制笔记内容');
                copyFloatingNote(container);
            });
        }

        // 引用按钮
        const referenceBtn = container.querySelector('#reference-note');
        if (referenceBtn) {
            referenceBtn.addEventListener('click', () => {
                console.log('[Floating] 生成引用链接');
                generateFloatingReference(container);
            });
        }

        // 字数统计
        const noteEditor = container.querySelector('#note-editor');
        const noteTitle = container.querySelector('#note-title');
        if (noteEditor) {
            noteEditor.addEventListener('input', () => updateFloatingWordCount(container));
        }
        if (noteTitle) {
            noteTitle.addEventListener('input', () => updateFloatingWordCount(container));
        }

        // 标签选择器模态框事件
        bindFloatingTagSelectorEvents(container);

        console.log('[Floating] 事件绑定完成');
    }

    /**
     * 加载浮动窗口的笔记数据
     */
    function loadFloatingNotesData(container) {
        console.log('[Floating] 开始加载笔记数据...');
        
        const loadingEl = container.querySelector('#loading-notes');
        const noteListEl = container.querySelector('#note-list');
        const emptyStateEl = container.querySelector('#empty-state');
        
        // 显示加载状态
        if (loadingEl) loadingEl.style.display = 'block';
        if (emptyStateEl) emptyStateEl.style.display = 'none';
        
        // 通过background script获取所有笔记
        chrome.runtime.sendMessage({
            action: 'getAllNotes'
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[Floating] 加载笔记失败:', chrome.runtime.lastError);
                return;
            }
            
            console.log('[Floating] 笔记数据响应:', response);
            
            // 隐藏加载状态
            if (loadingEl) loadingEl.style.display = 'none';
            
            if (response && response.success && response.notes && response.notes.length > 0) {
                renderFloatingNotesList(container, response.notes);
            } else {
                // 显示空状态
                if (emptyStateEl) emptyStateEl.style.display = 'block';
                console.log('[Floating] 暂无笔记数据');
            }
        });
    }

    /**
     * 渲染浮动窗口的笔记列表
     */
    function renderFloatingNotesList(container, notes) {
        console.log('[Floating] 渲染笔记列表, 共', notes.length, '条笔记');
        
        const noteListEl = container.querySelector('#note-list');
        const totalNotesEl = container.querySelector('#total-notes');
        
        if (!noteListEl) {
            console.error('[Floating] 未找到笔记列表容器');
            return;
        }
        
        // 更新笔记总数
        if (totalNotesEl) {
            totalNotesEl.textContent = notes.length;
        }
        
        // 清除现有内容
        noteListEl.innerHTML = '';
        
        // 渲染每个笔记项
        notes.forEach((note, index) => {
            const noteItem = createFloatingNoteItem(note, index);
            noteListEl.appendChild(noteItem);
        });
        
        console.log('[Floating] 笔记列表渲染完成');
    }

    /**
     * 创建浮动窗口的笔记项元素
     */
    function createFloatingNoteItem(note, index) {
        const noteItem = document.createElement('div');
        noteItem.className = 'note-item';
        noteItem.dataset.noteId = note.id || index;
        
        const title = generateNoteTitle(note.title, note.note);
        const content = note.note || '';
        const date = note.updatedAt ? new Date(note.updatedAt).toLocaleString() : 'Unknown Time';
        const url = note.url || '';
        const hostname = url ? new URL(url).hostname : '';
        
        noteItem.innerHTML = `
            <div class="note-header">
                <div class="note-title">${title}</div>
                <div class="note-actions">
                    <button class="note-action-btn" data-action="edit" title="编辑">✏️</button>
                    <button class="note-action-btn" data-action="delete" title="删除">🗑️</button>
                </div>
            </div>
            <div class="note-preview">${content.substring(0, 100)}${content.length > 100 ? '...' : ''}</div>
            <div class="note-meta">
                <span class="note-date">${date}</span>
                <span class="note-site">${hostname}</span>
            </div>
        `;
        
        // 绑定点击事件
        noteItem.addEventListener('click', async (e) => {
            const actionBtn = e.target.closest('.note-action-btn');
            const container = noteItem.closest('.floating-content-container');
            
            if (actionBtn) {
                const action = actionBtn.dataset.action;
                if (action === 'edit') {
                    loadFloatingNoteContent(container, note);
                } else if (action === 'delete') {
                    if (confirm('确定要删除这条笔记吗？')) {
                        try {
                            await deleteFloatingNote(note.id);
                            
                            // 更新本地数据
                            const notes = window.floatingNotes || [];
                            window.floatingNotes = notes.filter(n => n.id !== note.id);
                            
                            // 重新加载列表
                            await loadFloatingNotesData(container);
                            
                            // 如果删除的是当前选中的笔记，清空编辑器
                            if (floatingCurrentNote && floatingCurrentNote.id === note.id) {
                                floatingCurrentNote = null;
                                const titleInput = container.querySelector('#note-title');
                                const editor = container.querySelector('#note-editor');
                                if (titleInput) titleInput.value = '';
                                if (editor) editor.value = '';
                            }
                            
                            showFloatingNotification('笔记删除成功', 'success');
                        } catch (error) {
                            console.error('[Floating] 删除失败:', error);
                            showFloatingNotification('删除失败: ' + error.message, 'error');
                        }
                    }
                }
            } else {
                loadFloatingNoteContent(container, note);
            }
        });
        
        return noteItem;
    }

    /**
     * 加载笔记内容到编辑器
     */
    function loadFloatingNoteContent(container, note) {
        console.log('[Floating] 加载笔记内容:', note.title);
        
        const titleInput = container.querySelector('#note-title');
        const editor = container.querySelector('#note-editor');
        const urlSpan = container.querySelector('#note-url');
        const datesSpan = container.querySelector('#note-dates');
        const deleteBtn = container.querySelector('#delete-note');
        
        if (titleInput) titleInput.value = note.title || '';
        if (editor) editor.value = note.note || '';
        if (urlSpan) urlSpan.textContent = note.url || '';
        if (datesSpan) {
            const created = note.createdAt ? new Date(note.createdAt).toLocaleString() : '';
            const updated = note.updatedAt ? new Date(note.updatedAt).toLocaleString() : '';
            datesSpan.textContent = `创建: ${created} | 更新: ${updated}`;
        }
        
        // 显示删除按钮
        if (deleteBtn) deleteBtn.style.display = '';
        
        // 更新当前笔记变量
        floatingCurrentNote = note;
        
        // 更新标签显示
        const currentTagEl = container.querySelector('#current-tag');
        if (currentTagEl) {
            if (note.tag) {
                const tagInfo = getTagDisplayInfo(note.tag);
                currentTagEl.textContent = `${tagInfo.icon} ${tagInfo.text}`;
                currentTagEl.className = `current-tag ${tagInfo.className}`;
            } else {
                currentTagEl.textContent = '无标签';
                currentTagEl.className = 'current-tag';
            }
        }
        
        // 更新笔记项的选中状态
        const noteItems = container.querySelectorAll('.note-item');
        noteItems.forEach(item => {
            if (item.dataset.noteId === note.id) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        // 存储当前笔记ID用于保存
        container.dataset.currentNoteId = note.id || '';
    }

    // 浮动管理器核心功能实现（复刻自独立管理器）
    let floatingNotes = [];
    let floatingCurrentNote = null;
    let floatingFilters = { search: '', tag: '', date: '', site: '' };

    /**
     * 创建新笔记 - 修复版本，与原有系统兼容
     */
    function createNewFloatingNote(container) {
        console.log('[Floating] 创建新笔记');
        
        const newNote = {
            id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            title: '',
            note: '',
            url: window.location.href,
            tag: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        floatingCurrentNote = newNote;
        
        // 清空并显示编辑器区域
        const titleInput = container.querySelector('#note-title');
        const editor = container.querySelector('#note-editor');
        
        if (titleInput) titleInput.value = '';
        if (editor) {
            editor.value = '';
            editor.focus();
        }
        
        console.log('[Floating] 新建笔记准备完成');
        
        console.log('[Floating] 新笔记创建完成:', newNote.id);
    }

    /**
     * 搜索笔记
     */
    function filterFloatingNotes(container, searchTerm) {
        console.log('[Floating] 搜索笔记:', searchTerm);
        
        floatingFilters.search = searchTerm.toLowerCase();
        applyFloatingFilters(container);
    }

    /**
     * 按标签过滤笔记
     */
    function filterFloatingNotesByTag(container, tag) {
        console.log('[Floating] 标签过滤:', tag);
        
        floatingFilters.tag = tag;
        applyFloatingFilters(container);
    }

    /**
     * 应用过滤条件
     */
    function applyFloatingFilters(container) {
        let filtered = [...floatingNotes];
        
        // 搜索过滤
        if (floatingFilters.search) {
            filtered = filtered.filter(note => {
                const searchText = (note.title + ' ' + note.note + ' ' + note.url).toLowerCase();
                return searchText.includes(floatingFilters.search);
            });
        }
        
        // 标签过滤
        if (floatingFilters.tag) {
            filtered = filtered.filter(note => note.tag === floatingFilters.tag);
        }
        
        renderFloatingNotesList(container, filtered);
    }

    /**
     * 保存当前笔记 - 修复版本，与原有系统兼容
     */
    async function saveCurrentFloatingNote(container) {
        console.log('[Floating] 保存笔记');
        
        if (!floatingCurrentNote) {
            console.warn('[Floating] 没有要保存的笔记');
            showFloatingNotification('请先选择一个笔记', 'warning');
            return;
        }
        
        // 从编辑器获取数据
        const titleInput = container.querySelector('#note-title');
        const textarea = container.querySelector('#note-editor');
        
        const title = titleInput ? titleInput.value.trim() : '';
        const content = textarea ? textarea.value.trim() : '';
        
        if (!title && !content) {
            showFloatingNotification('请输入标题或内容', 'warning');
            return;
        }
        
        // 更新笔记数据
        const updatedNote = {
            ...floatingCurrentNote,
            title: title || generateNoteTitle('', content),
            note: content,
            updatedAt: new Date().toISOString()
        };
        
        try {
            // 使用增强错误处理的保存函数
            await saveFloatingNoteToDatabase(updatedNote);
            
            // 更新原有系统的数据
            const notes = window.floatingNotes || [];
            const existingIndex = notes.findIndex(note => note.id === updatedNote.id);
            if (existingIndex >= 0) {
                notes[existingIndex] = updatedNote;
            } else {
                notes.push(updatedNote);
            }
            window.floatingNotes = notes;
            
            // 重新加载列表以保持数据一致性
            await loadFloatingNotesData(container);
            
            showFloatingNotification('笔记保存成功', 'success');
            console.log('[Floating] 笔记保存成功:', updatedNote.id);
            
        } catch (error) {
            console.error('[Floating] 保存失败:', error);
            showFloatingNotification('保存失败: ' + error.message, 'error');
        }
    }
    
    /**
     * 删除当前笔记
     */
    async function deleteCurrentFloatingNote(container) {
        if (!floatingCurrentNote) {
            showFloatingNotification('请先选择一个笔记', 'warning');
            return;
        }
        
        if (!confirm('确定要删除这条笔记吗？')) {
            return;
        }
        
        try {
            await deleteFloatingNote(floatingCurrentNote.id);
            
            // 更新原有系统的数据
            const notes = window.floatingNotes || [];
            window.floatingNotes = notes.filter(note => note.id !== floatingCurrentNote.id);
            
            // 重新加载列表
            await loadFloatingNotesData(container);
            
            // 清空编辑器
            const editorContent = container.querySelector('#floating-editor-content');
            if (editorContent) {
                editorContent.innerHTML = `
                    <div style="text-align: center; padding: 50px; color: #666;">
                        <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                        <div style="font-size: 18px; margin-bottom: 8px;">笔记已删除</div>
                        <div style="font-size: 14px;">选择其他笔记或创建新笔记</div>
                    </div>
                `;
            }
            
            floatingCurrentNote = null;
            showFloatingNotification('笔记删除成功', 'success');
            
        } catch (error) {
            console.error('[Floating] 删除失败:', error);
            showFloatingNotification('删除失败: ' + error.message, 'error');
        }
    }

    /**
     * 保存笔记到数据库
     */
    async function saveFloatingNoteToDatabase(note) {
        return new Promise((resolve, reject) => {
            if (chrome && chrome.runtime) {
                try {
                    chrome.runtime.sendMessage({
                        action: 'saveNote',
                        note: note
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.warn('[Floating] Extension context error during save, using localStorage:', chrome.runtime.lastError);
                            saveToLocalStorage();
                        } else if (response && response.success) {
                            resolve(response);
                        } else {
                            console.warn('[Floating] Save failed via runtime, using localStorage');
                            saveToLocalStorage();
                        }
                    });
                } catch (error) {
                    console.warn('[Floating] Runtime error during save, using localStorage:', error);
                    saveToLocalStorage();
                }
            } else {
                saveToLocalStorage();
            }
            
            function saveToLocalStorage() {
                try {
                    const notes = JSON.parse(localStorage.getItem('tst_floating_notes') || '[]');
                    const existingIndex = notes.findIndex(n => n.id === note.id);
                    if (existingIndex >= 0) {
                        notes[existingIndex] = note;
                    } else {
                        notes.push(note);
                    }
                    localStorage.setItem('tst_floating_notes', JSON.stringify(notes));
                    console.log('[Floating] 笔记已保存到localStorage');
                    resolve({ success: true });
                } catch (error) {
                    console.error('[Floating] localStorage保存失败:', error);
                    reject(error);
                }
            }
        });
    }

    /**
     * 从数据库加载笔记
     */
    async function loadFloatingNotesFromDatabase() {
        return new Promise((resolve) => {
            if (chrome && chrome.runtime) {
                try {
                    chrome.runtime.sendMessage({
                        action: 'getAllNotes'
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.warn('[Floating] Extension context error, using localStorage:', chrome.runtime.lastError);
                            // 降级到localStorage
                            loadFromLocalStorage();
                        } else if (response && response.notes) {
                            resolve(response.notes);
                        } else {
                            console.warn('[Floating] No notes in response, using localStorage');
                            loadFromLocalStorage();
                        }
                    });
                } catch (error) {
                    console.warn('[Floating] Runtime error, using localStorage:', error);
                    loadFromLocalStorage();
                }
            } else {
                loadFromLocalStorage();
            }
            
            function loadFromLocalStorage() {
                try {
                    const notes = JSON.parse(localStorage.getItem('tst_floating_notes') || '[]');
                    console.log('[Floating] 从localStorage加载到', notes.length, '条笔记');
                    resolve(notes);
                } catch (error) {
                    console.error('[Floating] localStorage加载失败:', error);
                    resolve([]);
                }
            }
        });
    }

    /**
     * 删除笔记
     */
    async function deleteFloatingNote(noteId) {
        return new Promise((resolve, reject) => {
            if (chrome && chrome.runtime) {
                chrome.runtime.sendMessage({
                    action: 'deleteNote',
                    noteId: noteId
                }, (response) => {
                    if (response && response.success) {
                        resolve(response);
                    } else {
                        reject(new Error('删除失败'));
                    }
                });
            } else {
                // 备用方案：使用localStorage
                try {
                    const notes = JSON.parse(localStorage.getItem('tst_floating_notes') || '[]');
                    const filtered = notes.filter(n => n.id !== noteId);
                    localStorage.setItem('tst_floating_notes', JSON.stringify(filtered));
                    resolve({ success: true });
                } catch (error) {
                    reject(error);
                }
            }
        });
    }



    /**
     * 获取标签图标
     */
    function getTagIcon(tag) {
        if (!tag) return '📝';
        if (tag.includes('important')) return '🔥';
        if (tag.includes('interesting')) return '💡';
        if (tag.includes('needed')) return '⚡';
        return '📝';
    }

    /**
     * 选择笔记进行编辑 - 修复版本，使用原有系统的数据
     */
    function selectFloatingNote(noteId, container) {
        const notes = window.floatingNotes || [];
        const note = notes.find(n => n.id === noteId);
        if (!note) {
            console.warn('[Floating] 未找到笔记:', noteId);
            return;
        }

        // 使用原有系统的数据结构
        floatingCurrentNote = note;
        
        // 填充编辑器 - 使用正确的元素ID
        const titleInput = container.querySelector('#note-title');
        const textarea = container.querySelector('#note-editor');
        
        if (titleInput) titleInput.value = note.title || '';
        if (textarea) textarea.value = note.note || note.content || '';
        
        // 设置标签（如果存在）
        if (note.tag) {
            const [category, level] = note.tag.split('_');
            const categoryRadio = container.querySelector(`input[name="category"][value="${category}"]`);
            const levelRadio = container.querySelector(`input[name="level"][value="${level}"]`);
            if (categoryRadio) categoryRadio.checked = true;
            if (levelRadio) levelRadio.checked = true;
        }
        
        // 显示编辑器区域
        const editorHeader = container.querySelector('#floating-editor-header');
        const editorContent = container.querySelector('#floating-editor-content');
        
        if (editorHeader) editorHeader.style.display = 'block';
        if (editorContent) {
            editorContent.innerHTML = `
                <textarea id="floating-note-content" placeholder="开始编写笔记..." style="
                    width: 100%;
                    height: 100%;
                    border: none;
                    outline: none;
                    resize: none;
                    padding: 16px;
                    font-family: inherit;
                    font-size: 14px;
                    line-height: 1.6;
                ">${note.note || note.content || ''}</textarea>
                <div style="
                    position: absolute;
                    bottom: 16px;
                    right: 16px;
                    display: flex;
                    gap: 8px;
                ">
                    <button id="save-current-note" style="
                        padding: 8px 16px;
                        background: #007bff;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    ">💾 保存</button>
                    <button id="delete-current-note" style="
                        padding: 8px 16px;
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    ">🗑️ 删除</button>
                </div>
            `;
            
            // 绑定保存按钮事件
            const saveBtn = editorContent.querySelector('#save-current-note');
            const deleteBtn = editorContent.querySelector('#delete-current-note');
            
            if (saveBtn) {
                saveBtn.addEventListener('click', () => saveCurrentFloatingNote(container));
            }
            
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => deleteCurrentFloatingNote(container));
            }
        }
        
        console.log('[Floating] 选择笔记:', noteId, note);
    }

    /**
     * 打开标签选择器
     */
    function openFloatingTagSelector(container) {
        const modal = container.querySelector('#tag-selector-modal');
        if (!modal) return;
        
        modal.style.display = 'block';
        
        // 重置选择
        const categoryInputs = modal.querySelectorAll('input[name="category"]');
        const priorityInputs = modal.querySelectorAll('input[name="priority"]');
        categoryInputs.forEach(input => input.checked = false);
        priorityInputs.forEach(input => input.checked = false);
        
        // 如果当前笔记有标签，预选中
        if (floatingCurrentNote && floatingCurrentNote.tag) {
            const parts = floatingCurrentNote.tag.split('_');
            if (parts.length === 2) {
                const category = parts[0];
                const priority = parts[1];
                
                const categoryInput = modal.querySelector(`input[name="category"][value="${category}"]`);
                const priorityInput = modal.querySelector(`input[name="priority"][value="${priority}"]`);
                
                if (categoryInput) categoryInput.checked = true;
                if (priorityInput) priorityInput.checked = true;
                
                updateFloatingTagPreview(container);
            }
        }
    }

    /**
     * 绑定标签选择器事件
     */
    function bindFloatingTagSelectorEvents(container) {
        const modal = container.querySelector('#tag-selector-modal');
        if (!modal) return;
        
        // 关闭按钮
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        
        // 标签选项变化
        const categoryInputs = modal.querySelectorAll('input[name="category"]');
        const priorityInputs = modal.querySelectorAll('input[name="priority"]');
        
        categoryInputs.forEach(input => {
            input.addEventListener('change', () => updateFloatingTagPreview(container));
        });
        
        priorityInputs.forEach(input => {
            input.addEventListener('change', () => updateFloatingTagPreview(container));
        });
        
        // 确定按钮
        const confirmBtn = modal.querySelector('#tag-confirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => saveFloatingTag(container));
        }
        
        // 取消按钮
        const cancelBtn = modal.querySelector('#tag-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
    }

    /**
     * 更新标签预览
     */
    function updateFloatingTagPreview(container) {
        const modal = container.querySelector('#tag-selector-modal');
        const preview = modal.querySelector('#tag-preview-display');
        
        const selectedCategory = modal.querySelector('input[name="category"]:checked');
        const selectedPriority = modal.querySelector('input[name="priority"]:checked');
        
        if (selectedCategory && selectedPriority) {
            const tag = `${selectedCategory.value}_${selectedPriority.value}`;
            const tagInfo = getTagDisplayInfo(tag);
            preview.textContent = `${tagInfo.icon} ${tagInfo.text}`;
            preview.className = `tag-badge ${tagInfo.className}`;
        } else {
            preview.textContent = '请选择标签';
            preview.className = 'tag-badge';
        }
    }

    /**
     * 保存标签
     */
    function saveFloatingTag(container) {
        const modal = container.querySelector('#tag-selector-modal');
        const selectedCategory = modal.querySelector('input[name="category"]:checked');
        const selectedPriority = modal.querySelector('input[name="priority"]:checked');
        
        if (selectedCategory && selectedPriority && floatingCurrentNote) {
            floatingCurrentNote.tag = `${selectedCategory.value}_${selectedPriority.value}`;
            
            // 更新显示
            const currentTagEl = container.querySelector('#current-tag');
            if (currentTagEl) {
                const tagInfo = getTagDisplayInfo(floatingCurrentNote.tag);
                currentTagEl.textContent = `${tagInfo.icon} ${tagInfo.text}`;
                currentTagEl.className = `current-tag ${tagInfo.className}`;
            }
            
            modal.style.display = 'none';
            showFloatingNotification('标签已更新', 'success');
        } else {
            showFloatingNotification('请选择分类和程度', 'warning');
        }
    }

    /**
     * 获取标签显示信息
     */
    function getTagDisplayInfo(tag) {
        const tagMap = {
            'important_very': { icon: '🔥', text: '非常重要', className: 'tag-important-very' },
            'important_somewhat': { icon: '🔥', text: '比较重要', className: 'tag-important-somewhat' },
            'important_general': { icon: '🔥', text: '一般重要', className: 'tag-important-general' },
            'interesting_very': { icon: '💡', text: '非常有趣', className: 'tag-interesting-very' },
            'interesting_somewhat': { icon: '💡', text: '比较有趣', className: 'tag-interesting-somewhat' },
            'interesting_general': { icon: '💡', text: '一般有趣', className: 'tag-interesting-general' },
            'needed_very': { icon: '⚡', text: '非常需要', className: 'tag-needed-very' },
            'needed_somewhat': { icon: '⚡', text: '比较需要', className: 'tag-needed-somewhat' },
            'needed_general': { icon: '⚡', text: '一般需要', className: 'tag-needed-general' }
        };
        
        return tagMap[tag] || { icon: '', text: '无标签', className: '' };
    }

    /**
     * 切换到预览模式
     */
    function switchToFloatingPreview(container) {
        const editMode = container.querySelector('#edit-mode');
        const previewMode = container.querySelector('#preview-mode');
        const noteEditor = container.querySelector('#note-editor');
        const notePreview = container.querySelector('#note-preview');
        
        if (!noteEditor || !notePreview) return;
        
        const content = noteEditor.value;
        
        // 切换按钮状态
        if (editMode) editMode.classList.remove('active');
        if (previewMode) previewMode.classList.add('active');
        
        // 显示预览，隐藏编辑器
        noteEditor.style.display = 'none';
        notePreview.style.display = 'block';
        
        // 渲染Markdown内容
        if (content) {
            // 简单的Markdown渲染
            let html = content
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n\n/g, '<br><br>')
                .replace(/\n/g, '<br>')
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                .replace(/^\- (.+)$/gm, '<li>$1</li>');
            
            notePreview.innerHTML = `<div class="markdown-content">${html}</div>`;
        } else {
            notePreview.innerHTML = '<div class="preview-placeholder"><p>暂无内容</p></div>';
        }
    }

    /**
     * 切换到编辑模式
     */
    function switchToFloatingEdit(container) {
        const editMode = container.querySelector('#edit-mode');
        const previewMode = container.querySelector('#preview-mode');
        const noteEditor = container.querySelector('#note-editor');
        const notePreview = container.querySelector('#note-preview');
        
        if (!noteEditor || !notePreview) return;
        
        // 切换按钮状态
        if (editMode) editMode.classList.add('active');
        if (previewMode) previewMode.classList.remove('active');
        
        // 显示编辑器，隐藏预览
        noteEditor.style.display = 'block';
        notePreview.style.display = 'none';
    }

    /**
     * 复制笔记内容
     */
    function copyFloatingNote(container) {
        if (!floatingCurrentNote) {
            showFloatingNotification('请先选择一个笔记', 'warning');
            return;
        }
        
        const title = floatingCurrentNote.title || '';
        const content = floatingCurrentNote.note || '';
        const url = floatingCurrentNote.url || '';
        
        const text = `${title}\n\n${content}\n\n来源: ${url}`;
        
        navigator.clipboard.writeText(text).then(() => {
            showFloatingNotification('笔记内容已复制到剪贴板', 'success');
        }).catch(err => {
            console.error('[Floating] 复制失败:', err);
            showFloatingNotification('复制失败，请重试', 'error');
        });
    }

    /**
     * 生成引用链接
     */
    function generateFloatingReference(container) {
        if (!floatingCurrentNote) {
            showFloatingNotification('请先选择一个笔记', 'warning');
            return;
        }
        
        const title = floatingCurrentNote.title || '未命名笔记';
        const url = floatingCurrentNote.url || window.location.href;
        const noteId = floatingCurrentNote.id;
        
        const reference = `[${title}](${url}#note-${noteId})`;
        
        navigator.clipboard.writeText(reference).then(() => {
            showFloatingNotification('引用链接已复制到剪贴板', 'success');
        }).catch(err => {
            console.error('[Floating] 复制引用失败:', err);
            showFloatingNotification('复制失败，请重试', 'error');
        });
    }

    /**
     * 更新字数统计
     */
    function updateFloatingWordCount(container) {
        const titleInput = container.querySelector('#note-title');
        const editor = container.querySelector('#note-editor');
        const wordCountEl = container.querySelector('#word-count');
        
        if (!wordCountEl) return;
        
        const titleLength = titleInput ? titleInput.value.length : 0;
        const contentLength = editor ? editor.value.length : 0;
        const totalLength = titleLength + contentLength;
        
        wordCountEl.textContent = `${totalLength} 字符`;
    }

    /**
     * 显示浮动通知
     */
    function showFloatingNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 4px;
            color: white;
            font-size: 14px;
            z-index: 10000;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        // 设置颜色
        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#4CAF50';
                break;
            case 'error':
                notification.style.backgroundColor = '#f44336';
                break;
            case 'warning':
                notification.style.backgroundColor = '#ff9800';
                break;
            default:
                notification.style.backgroundColor = '#2196F3';
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // 自动消失
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    /**
     * 创建浮动笔记管理器 - 使用直接DOM注入方法
     */
    async function createFloatingNoteManager() {
        // 检查是否已有浮动管理器
        const existingManager = document.getElementById('tst-floating-note-manager');
        if (existingManager) {
            // 如果已存在，显示并聚焦
            existingManager.style.display = 'block';
            existingManager.style.zIndex = '999999';
            return;
        }

        console.log('[Floating] 开始创建直接注入式浮动窗口...');

        // 1. 先注入CSS样式
        await injectFloatingWindowCSS();

        // 2. 创建浮动容器
        const floatingManager = document.createElement('div');
        floatingManager.id = 'tst-floating-note-manager';
        floatingManager.className = 'tst-floating-manager';
        
        // 设置苹果风格容器样式
        floatingManager.style.cssText = `
            position: fixed;
            top: 60px;
            right: 60px;
            width: 920px;
            height: 720px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(40px);
            -webkit-backdrop-filter: blur(40px);
            border: 0.5px solid rgba(0, 0, 0, 0.08);
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 8px 20px rgba(0, 0, 0, 0.08);
            z-index: 999999;
            display: flex;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Helvetica, Arial, sans-serif;
            resize: both;
            overflow: hidden;
            min-width: 680px;
            min-height: 480px;
        `;

        // 3. 创建标题栏
        const titleBar = createFloatingTitleBar(floatingManager);
        
        // 4. 创建笔记管理器内容区域
        const contentContainer = document.createElement('div');
        contentContainer.className = 'floating-content-container';
        contentContainer.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background: var(--floating-bg-secondary, #f8f9fa);
        `;

        // 5. 直接创建笔记管理器的DOM结构
        await createNoteManagerContent(contentContainer);

        // 6. 组装窗口
        floatingManager.appendChild(titleBar);
        floatingManager.appendChild(contentContainer);
        document.body.appendChild(floatingManager);

        // 7. 添加窗口交互功能
        makeDraggable(floatingManager, titleBar);
        addFloatingWindowKeyboardShortcuts(floatingManager);

        // 8. 初始化笔记管理器功能
        await initializeFloatingNoteManager(contentContainer);

        console.log('[Floating] 直接注入式浮动窗口创建完成');
    }

    /**
     * 创建苹果风格的控制按钮（红、黄、绿圆点）
     */
    function createMacControlButton(text, title, color, onclick) {
        const btn = document.createElement('button');
        btn.title = title;
        btn.style.cssText = `
            background: ${color};
            border: none;
            color: transparent;
            width: 13px;
            height: 13px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 8px;
            font-weight: 500;
            transition: all 0.2s ease;
            position: relative;
            margin: 0;
            padding: 0;
            outline: none;
            flex-shrink: 0;
        `;
        
        // 悬停时显示符号
        btn.addEventListener('mouseenter', () => {
            btn.style.color = 'rgba(0, 0, 0, 0.6)';
            if (title === '关闭') btn.textContent = '✕';
            else if (title === '最小化') btn.textContent = '−';
            else if (title === '最大化') btn.textContent = '+';
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.color = 'transparent';
            btn.textContent = '●';
        });
        
        btn.addEventListener('click', onclick);
        return btn;
    }

    /**
     * 创建控制按钮（备用）
     */
    function createControlButton(text, title, onclick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.title = title;
        btn.style.cssText = `
            background: rgba(142, 142, 147, 0.12);
            border: none;
            color: #1d1d1f;
            width: 28px;
            height: 28px;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s ease;
        `;
        btn.addEventListener('mouseenter', () => {
            btn.style.backgroundColor = 'rgba(142, 142, 147, 0.2)';
            btn.style.transform = 'scale(0.95)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.backgroundColor = 'rgba(142, 142, 147, 0.12)';
            btn.style.transform = 'scale(1)';
        });
        btn.addEventListener('click', onclick);
        return btn;
    }

    /**
     * 使元素可拖拽
     */
    function makeDraggable(element, handle) {
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = element.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const newLeft = startLeft + (e.clientX - startX);
            const newTop = startTop + (e.clientY - startY);

            // 限制在视窗内
            const maxLeft = window.innerWidth - element.offsetWidth;
            const maxTop = window.innerHeight - element.offsetHeight;

            element.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
            element.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
            element.style.right = 'auto'; // 移除right定位
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    /**
     * 加载浮动管理器内容
     */
    async function loadFloatingManagerContent(container) {
        try {
            // 创建简化的笔记管理器界面
            const managerHTML = `
                <div class="floating-manager-header" style="
                    padding: 12px 16px;
                    background: var(--floating-bg-secondary);
                    border-bottom: 1px solid var(--floating-border);
                    display: flex;
                    gap: 12px;
                    align-items: center;
                ">
                    <input type="text" id="floating-search" placeholder="🔍 搜索笔记..." style="
                        flex: 1;
                        padding: 8px 12px;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        font-size: 14px;
                    ">
                    <button id="floating-new-note" style="
                        padding: 8px 16px;
                        background: #007bff;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">📝 新建</button>
                    <button id="floating-refresh" style="
                        padding: 8px 12px;
                        background: #28a745;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">🔄</button>
                </div>
                <div class="floating-manager-content" style="
                    flex: 1;
                    display: flex;
                    overflow: hidden;
                ">
                    <div class="floating-note-list" style="
                        width: 40%;
                        border-right: 1px solid #dee2e6;
                        overflow-y: auto;
                        background: white;
                    ">
                        <div id="floating-notes-container" style="padding: 8px;">
                            <div class="tst-floating-loading" style="text-align: center; padding: 20px;">
                                <div style="font-size: 24px; margin-bottom: 8px;">📋</div>
                                <div>加载笔记中...</div>
                            </div>
                        </div>
                    </div>
                    <div class="floating-note-editor" style="
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        background: white;
                    ">
                        <div id="floating-editor-header" style="
                            padding: 12px 16px;
                            background: var(--floating-bg-secondary);
                            border-bottom: 1px solid var(--floating-border);
                            display: none;
                        ">
                            <input type="text" id="floating-note-title" placeholder="笔记标题..." style="
                                width: 100%;
                                padding: 8px;
                                border: 1px solid #ddd;
                                border-radius: 4px;
                                font-size: 16px;
                                font-weight: 500;
                            ">
                        </div>
                        <div id="floating-editor-content" style="
                            flex: 1;
                            padding: 16px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: #666;
                        ">
                            <div style="text-align: center;">
                                <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                                <div style="font-size: 18px; margin-bottom: 8px;">选择笔记开始编辑</div>
                                <div style="font-size: 14px;">或点击"新建"创建新笔记</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            container.innerHTML = managerHTML;

            // 绑定事件
            bindFloatingManagerEvents(container);

            // 延迟加载笔记列表，确保DOM完全就绪
            setTimeout(async () => {
                await loadFloatingNotesData(container);
            }, 100);

        } catch (error) {
            console.error('加载浮动管理器内容失败:', error);
            container.innerHTML = `
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    text-align: center;
                    color: #dc3545;
                ">
                    <div>
                        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                        <div style="font-size: 18px; margin-bottom: 8px;">加载失败</div>
                        <div style="font-size: 14px;">请尝试重新打开</div>
                    </div>
                </div>
            `;
        }
    }

    /**
     * 绑定浮动管理器事件
     */
    function bindFloatingManagerEvents(container) {
        // 搜索功能
        const searchInput = container.querySelector('#floating-search');
        if (searchInput) {
            searchInput.addEventListener('input', debounceFunction(() => {
                const query = searchInput.value.trim();
                filterFloatingNotes(query);
            }, 300));
        }

        // 新建笔记
        const newNoteBtn = container.querySelector('#floating-new-note');
        if (newNoteBtn) {
            newNoteBtn.addEventListener('click', () => {
                createNewFloatingNote(container);
            });
        }

        // 刷新按钮
        const refreshBtn = container.querySelector('#floating-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                loadFloatingNotesData(refreshBtn.closest('.floating-content-container'));
            });
        }
    }

    /**
     * 加载浮动窗口笔记列表
     */
    async function loadFloatingNotesList() {
        try {
            const container = document.querySelector('#floating-notes-container');
            if (!container) return;

            container.innerHTML = '<div class="tst-floating-loading" style="text-align: center; padding: 20px;">加载中...</div>';

            // 从background获取笔记 - 增强错误处理版本
            const notes = await new Promise((resolve) => {
                if (chrome && chrome.runtime) {
                    try {
                        chrome.runtime.sendMessage({
                            action: 'getAllNotes'
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                console.warn('[TST Floating] Extension context error, trying localStorage:', chrome.runtime.lastError);
                                loadFromLocalStorage();
                            } else if (response && response.success && response.notes) {
                                console.log('[TST Floating] 从background加载到', response.notes.length, '条笔记');
                                resolve(response.notes);
                            } else {
                                console.warn('[TST Floating] 响应格式异常，尝试localStorage:', response);
                                loadFromLocalStorage();
                            }
                        });
                    } catch (error) {
                        console.warn('[TST Floating] Runtime调用异常，使用localStorage:', error);
                        loadFromLocalStorage();
                    }
                } else {
                    console.log('[TST Floating] Chrome runtime不可用，使用localStorage');
                    loadFromLocalStorage();
                }
                
                function loadFromLocalStorage() {
                    try {
                        const localNotes = JSON.parse(localStorage.getItem('tst_floating_notes') || '[]');
                        console.log('[TST Floating] 从localStorage加载到', localNotes.length, '条笔记');
                        resolve(localNotes);
                    } catch (error) {
                        console.error('[TST Floating] localStorage加载失败:', error);
                        resolve([]);
                    }
                }
            });

            if (notes.length === 0) {
                container.innerHTML = `
                    <div class="tst-floating-empty" style="text-align: center; padding: 20px;">
                        <div style="font-size: 24px; margin-bottom: 8px;">📝</div>
                        <div>暂无笔记</div>
                        <div style="font-size: 12px; margin-top: 4px;">点击"新建"创建第一条笔记</div>
                    </div>
                `;
                return;
            }

            // 渲染笔记列表
            const notesHTML = notes.map(note => {
                const title = generateNoteTitle(note.title, note.note);
                const preview = getFloatingNotePreview(note.note);
                const time = formatFloatingTime(note.createdAt || note.updatedAt);
                
                return `
                    <div class="floating-note-item" data-note-id="${note.id}" style="
                        padding: 12px;
                        border-bottom: 1px solid #eee;
                        cursor: pointer;
                        transition: background-color 0.2s;
                    " class="floating-note-item-hover"
                       onclick="selectFloatingNote('${note.id}')">
                        <div style="
                            font-weight: 500;
                            font-size: 14px;
                            margin-bottom: 4px;
                            color: #333;
                            word-break: break-word;
                        ">${escapeHtmlContent(title)}</div>
                        <div style="
                            font-size: 12px;
                            color: #666;
                            margin-bottom: 4px;
                            line-height: 1.4;
                            word-break: break-word;
                        ">${escapeHtmlContent(preview)}</div>
                        <div style="
                            font-size: 11px;
                            color: #999;
                        ">${time}</div>
                    </div>
                `;
            }).join('');

            container.innerHTML = notesHTML;

            // 存储笔记数据供后续使用
            window.floatingNotes = notes;

        } catch (error) {
            console.error('加载浮动笔记列表失败:', error);
            const container = document.querySelector('#floating-notes-container');
            if (container) {
                container.innerHTML = `
                    <div class="tst-floating-error" style="text-align: center; padding: 20px;">
                        <div style="font-size: 20px; margin-bottom: 8px;">⚠️</div>
                        <div>加载失败</div>
                    </div>
                `;
            }
        }
    }

    /**
     * 获取笔记预览文本
     */
    function getFloatingNotePreview(content) {
        if (!content) return '无内容';
        
        // 移除Markdown标记和多余空白
        const cleanText = content
            .replace(/[#*_`~\[\]()]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        return cleanText.length > 60 ? cleanText.substring(0, 60) + '...' : cleanText;
    }

    /**
     * 格式化时间显示
     */
    function formatFloatingTime(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60 * 1000) return '刚刚';
        if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}分钟前`;
        if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
        
        return date.toLocaleDateString('zh-CN');
    }

    /**
     * 智能生成笔记标题
     * @param {string} title - 原始标题
     * @param {string} content - 笔记内容
     * @returns {string} 生成的标题
     */
    function generateNoteTitle(title, content) {
        if (title && title.trim() !== '') {
            return title.trim();
        }
        
        const cleanContent = (content || '').trim();
        if (cleanContent) {
            // 从内容提取前30个字符作为标题
            let extractedTitle = cleanContent.substring(0, 30).replace(/\n/g, ' ');
            if (cleanContent.length > 30) {
                extractedTitle += '...';
            }
            return extractedTitle;
        }
        
        return 'Untitled Note';
    }

    /**
     * HTML转义
     */
    function escapeHtmlContent(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 防抖函数
     */
    function debounceFunction(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }



    // 全局函数供HTML调用 - 现在已实现
    window.selectFloatingNote = function(noteId) {
        const container = document.getElementById('tst-floating-note-manager');
        if (container) {
            selectFloatingNote(noteId, container);
        }
    };

    window.createFloatingNewNote = function() {
        const container = document.getElementById('tst-floating-note-manager');
        if (container) {
            createNewFloatingNote(container);
        }
    };

    window.filterFloatingNotes = function(query) {
        const container = document.getElementById('tst-floating-note-manager');
        if (container) {
            filterFloatingNotes(container, query);
        }
    };

    /**
     * 打开设置
     */
    function openSettings() {
        try {
            if (chrome && chrome.runtime) {
                chrome.runtime.sendMessage({
                    action: 'openSettings'
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('打开设置失败:', chrome.runtime.lastError);
                    }
                });
            }
        } catch (error) {
            console.error('打开设置出错:', error);
        }
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