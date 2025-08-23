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
            // Ctrl+Shift+N 打开笔记管理器（独立窗口）
            if (e.ctrlKey && e.shiftKey && e.key === 'N') {
                e.preventDefault();
                openNoteManager('window');
            }
            // Ctrl+Shift+F 打开笔记管理器（浮动窗口）
            if (e.ctrlKey && e.shiftKey && e.key === 'F') {
                e.preventDefault();
                openNoteManager('floating');
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
                    <h3 id="tst-quick-note-title">📝 页面笔记</h3>
                    <div class="tst-window-controls">
                        <button class="tst-window-btn" id="tst-minimize-btn" title="最小化">−</button>
                        <button class="tst-window-btn" id="tst-quick-note-close" title="关闭">×</button>
                    </div>
                </div>
                
                <!-- 历史笔记加载区域 -->
                <div id="tst-history-notes-panel" style="display: none; margin: 0 10px 10px 10px; padding: 8px; background: #f8f9fa; border-radius: 6px; border-left: 3px solid #007bff;">
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                        <span style="font-weight: bold; color: #007bff; font-size: 13px;">📚 历史笔记</span>
                        <button id="tst-hide-history" style="margin-left: auto; background: none; border: none; color: #666; cursor: pointer; font-size: 16px;" title="隐藏">&times;</button>
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
                ${index === 0 ? 'background: #e3f2fd; border: 1px solid #2196f3;' : 'background: white; border: 1px solid #e0e0e0;'}
            `;
            
            noteItem.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                    <span style="font-weight: bold; color: ${index === 0 ? '#1976d2' : '#666'};">${index === 0 ? '💡 最新' : `#${index + 1}`}</span>
                    <span style="font-size: 10px; color: #999;">${updateTime.split(' ')[1] || updateTime}</span>
                </div>
                <div style="color: #555; line-height: 1.3; font-size: 11px;">${escapeHtml(preview)}</div>
            `;
            
            noteItem.addEventListener('click', () => {
                loadSelectedNote(note, textarea, updateTime);
                historyPanel.style.display = 'none'; // 加载后隐藏面板
            });
            
            noteItem.addEventListener('mouseenter', () => {
                if (index !== 0) noteItem.style.backgroundColor = '#f5f5f5';
            });
            
            noteItem.addEventListener('mouseleave', () => {
                if (index !== 0) noteItem.style.backgroundColor = 'white';
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
                text: '📚 笔记管理器 (独立窗口)',
                action: () => openNoteManager('window'),
                shortcut: 'Ctrl+Shift+N'
            },
            {
                text: '🎈 笔记管理器 (浮动窗口)',
                action: () => openNoteManager('floating'),
                shortcut: 'Ctrl+Shift+F'
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
            background: white;
            border: 1px solid #ddd;
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
    function openNoteManager(mode = 'window') {
        try {
            if (mode === 'floating') {
                // 创建浮动窗口模式
                createFloatingNoteManager();
            } else if (chrome && chrome.runtime) {
                // 通过background script打开独立窗口
                chrome.runtime.sendMessage({
                    action: 'openNoteManager',
                    mode: mode
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('打开笔记管理器失败:', chrome.runtime.lastError);
                        // 降级方案：直接打开页面
                        fallbackOpenNoteManager();
                    } else if (response && response.success) {
                        console.log('笔记管理器已打开');
                    }
                });
            } else {
                fallbackOpenNoteManager();
            }
        } catch (error) {
            console.error('打开笔记管理器出错:', error);
            fallbackOpenNoteManager();
        }
    }

    /**
     * 降级方案：直接打开笔记管理器页面
     */
    function fallbackOpenNoteManager() {
        const url = chrome.runtime ? chrome.runtime.getURL('note-manager.html') : '/note-manager.html';
        window.open(url, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
    }

    /**
     * 创建浮动笔记管理器
     */
    function createFloatingNoteManager() {
        // 检查是否已有浮动管理器
        const existingManager = document.getElementById('tst-floating-note-manager');
        if (existingManager) {
            // 如果已存在，显示并聚焦
            existingManager.style.display = 'block';
            existingManager.style.zIndex = '999999';
            return;
        }

        // 创建浮动容器
        const floatingManager = document.createElement('div');
        floatingManager.id = 'tst-floating-note-manager';
        floatingManager.className = 'tst-floating-manager';
        
        // 设置样式
        floatingManager.style.cssText = `
            position: fixed;
            top: 50px;
            right: 50px;
            width: 900px;
            height: 700px;
            background: white;
            border: 2px solid #007bff;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 999999;
            display: flex;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            resize: both;
            overflow: hidden;
            min-width: 600px;
            min-height: 400px;
        `;

        // 创建标题栏
        const titleBar = document.createElement('div');
        titleBar.className = 'floating-title-bar';
        titleBar.style.cssText = `
            background: linear-gradient(90deg, #007bff, #0056b3);
            color: white;
            padding: 8px 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
            user-select: none;
            border-radius: 6px 6px 0 0;
            font-weight: 500;
        `;

        const titleText = document.createElement('span');
        titleText.textContent = '🎈 笔记管理器 (浮动窗口)';
        titleBar.appendChild(titleText);

        // 窗口控制按钮
        const controls = document.createElement('div');
        controls.style.cssText = 'display: flex; gap: 8px;';

        const minimizeBtn = createControlButton('−', '最小化', () => {
            floatingManager.style.display = 'none';
        });

        const maximizeBtn = createControlButton('□', '最大化', () => {
            if (floatingManager.dataset.maximized === 'true') {
                // 还原
                floatingManager.style.width = '900px';
                floatingManager.style.height = '700px';
                floatingManager.style.top = '50px';
                floatingManager.style.right = '50px';
                floatingManager.dataset.maximized = 'false';
                maximizeBtn.textContent = '□';
            } else {
                // 最大化
                floatingManager.style.width = '100vw';
                floatingManager.style.height = '100vh';
                floatingManager.style.top = '0';
                floatingManager.style.left = '0';
                floatingManager.style.right = 'auto';
                floatingManager.dataset.maximized = 'true';
                maximizeBtn.textContent = '❐';
            }
        });

        const closeBtn = createControlButton('✖', '关闭', () => {
            floatingManager.remove();
        });

        controls.appendChild(minimizeBtn);
        controls.appendChild(maximizeBtn);
        controls.appendChild(closeBtn);
        titleBar.appendChild(controls);

        // 创建iframe加载笔记管理器
        const iframe = document.createElement('iframe');
        iframe.style.cssText = `
            flex: 1;
            border: none;
            background: white;
        `;
        
        const managerUrl = chrome.runtime ? chrome.runtime.getURL('note-manager.html') : '/note-manager.html';
        iframe.src = managerUrl + '?mode=floating';

        // 组装窗口
        floatingManager.appendChild(titleBar);
        floatingManager.appendChild(iframe);
        document.body.appendChild(floatingManager);

        // 添加拖拽功能
        makeDraggable(floatingManager, titleBar);

        // 添加键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && floatingManager.style.display !== 'none') {
                floatingManager.style.display = 'none';
            }
        });

        console.log('浮动笔记管理器已创建');
    }

    /**
     * 创建控制按钮
     */
    function createControlButton(text, title, onclick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.title = title;
        btn.style.cssText = `
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            transition: background-color 0.2s;
        `;
        btn.addEventListener('mouseenter', () => {
            btn.style.backgroundColor = 'rgba(255,255,255,0.3)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.backgroundColor = 'rgba(255,255,255,0.2)';
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