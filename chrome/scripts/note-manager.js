/**
 * 笔记管理器主逻辑
 * 实现完整的笔记管理功能，包括标签系统、搜索、过滤、编辑等
 */

class NoteManager {
    constructor() {
        this.notes = [];
        this.filteredNotes = [];
        this.selectedNotes = new Set();
        this.currentNote = null;
        this.searchEngine = new FullTextSearchEngine();
        this.isInitialized = false;
        
        // 标签系统配置
        this.tagSystem = {
            categories: {
                important: { name: '重要', icon: '🔥', color: '#ff4757' },
                interesting: { name: '有趣', icon: '💡', color: '#3742fa' },
                needed: { name: '需要', icon: '⚡', color: '#2ed573' }
            },
            priorities: {
                very: { name: '非常', weight: 3 },
                somewhat: { name: '比较', weight: 2 },
                general: { name: '一般', weight: 1 }
            }
        };

        // 当前过滤条件
        this.filters = {
            search: '',
            tag: '',
            date: '',
            site: ''
        };

        // 当前排序方式
        this.sortBy = 'priority'; // priority, updated, created, title, site

        // 初始化
        this.init();
    }

    /**
     * 初始化笔记管理器
     */
    async init() {
        try {
            console.info('初始化笔记管理器...');
            
            // 加载笔记数据
            await this.loadNotes();
            
            // 初始化搜索引擎
            this.searchEngine.buildIndex(this.notes);
            
            // 绑定事件
            this.bindEvents();
            
            // 渲染界面
            this.render();
            
            // 填充网站过滤器
            this.populateSiteFilter();
            
            this.isInitialized = true;
            console.info('笔记管理器初始化完成', { notesCount: this.notes.length });
            
        } catch (error) {
            console.error('初始化失败:', error);
            this.showNotification('初始化失败：' + error.message, 'error');
        }
    }

    /**
     * 加载笔记数据
     */
    async loadNotes() {
        try {
            // 这里应该从IndexedDB或background script加载数据
            // 暂时使用模拟数据
            this.notes = await this.fetchNotesFromBackground();
            this.filteredNotes = [...this.notes];
            
            // 更新笔记计数
            this.updateNoteCount();
            
        } catch (error) {
            console.error('加载笔记失败:', error);
            this.notes = [];
            this.filteredNotes = [];
        }
    }

    /**
     * 从background script获取笔记
     */
    async fetchNotesFromBackground() {
        return new Promise((resolve) => {
            if (chrome && chrome.runtime) {
                chrome.runtime.sendMessage({
                    action: 'getAllNotes'
                }, (response) => {
                    if (response && response.notes) {
                        resolve(response.notes);
                    } else {
                        resolve([]);
                    }
                });
            } else {
                // 开发环境模拟数据
                resolve(this.generateMockNotes());
            }
        });
    }

    /**
     * 生成模拟数据（开发用）
     */
    generateMockNotes() {
        const mockNotes = [
            {
                id: '1',
                title: 'React Hooks 学习笔记',
                note: '# React Hooks\n\n## useState\n使用useState来管理组件状态...\n\n## useEffect\n用于处理副作用...',
                tag: 'important_very',
                url: 'https://github.com/facebook/react',
                createdAt: '2024-01-15T10:30:00.000Z',
                updatedAt: '2024-01-15T14:20:00.000Z'
            },
            {
                id: '2',
                title: 'API 设计最佳实践',
                note: 'RESTful API设计原则：\n1. 使用HTTP方法\n2. 合理的状态码\n3. 统一的响应格式',
                tag: 'needed_somewhat',
                url: 'https://developer.mozilla.org/docs',
                createdAt: '2024-01-14T09:15:00.000Z',
                updatedAt: '2024-01-14T16:45:00.000Z'
            },
            {
                id: '3',
                title: '有趣的CSS技巧',
                note: '一些有用的CSS技巧：\n- CSS Grid布局\n- Flexbox对齐\n- 自定义属性（CSS变量）',
                tag: 'interesting_general',
                url: 'https://css-tricks.com',
                createdAt: '2024-01-13T15:20:00.000Z',
                updatedAt: '2024-01-13T15:20:00.000Z'
            }
        ];
        return mockNotes;
    }

    /**
     * 绑定所有事件
     */
    bindEvents() {
        // 搜索事件
        const searchInput = document.getElementById('global-search');
        const clearSearch = document.getElementById('clear-search');
        
        if (searchInput) {
            XSSProtection.safeAddEventListener(searchInput, 'input', 
                this.debounce((e) => this.handleSearch(e.target.value), 300)
            );
        }
        
        if (clearSearch) {
            XSSProtection.safeAddEventListener(clearSearch, 'click', 
                () => this.clearSearch()
            );
        }

        // 过滤器事件
        this.bindFilterEvents();
        
        // 工具栏按钮事件
        this.bindToolbarEvents();
        
        // 编辑器事件
        this.bindEditorEvents();
        
        // 模态框事件
        this.bindModalEvents();
        
        // 全选事件
        const selectAllCheckbox = document.getElementById('select-all-notes');
        if (selectAllCheckbox) {
            XSSProtection.safeAddEventListener(selectAllCheckbox, 'change', 
                (e) => this.handleSelectAll(e.target.checked)
            );
        }
    }

    /**
     * 绑定过滤器事件
     */
    bindFilterEvents() {
        const tagFilter = document.getElementById('tag-filter');
        const dateFilter = document.getElementById('date-filter');
        const siteFilter = document.getElementById('site-filter');
        const sortBy = document.getElementById('sort-by');

        if (tagFilter) {
            XSSProtection.safeAddEventListener(tagFilter, 'change', 
                (e) => this.handleTagFilter(e.target.value)
            );
        }
        
        if (dateFilter) {
            XSSProtection.safeAddEventListener(dateFilter, 'change', 
                (e) => this.handleDateFilter(e.target.value)
            );
        }
        
        if (siteFilter) {
            XSSProtection.safeAddEventListener(siteFilter, 'change', 
                (e) => this.handleSiteFilter(e.target.value)
            );
        }
        
        if (sortBy) {
            XSSProtection.safeAddEventListener(sortBy, 'change', 
                (e) => this.handleSortChange(e.target.value)
            );
        }
    }

    /**
     * 绑定工具栏按钮事件
     */
    bindToolbarEvents() {
        const buttons = {
            'refresh-notes': () => this.refreshNotes(),
            'batch-export': () => this.handleBatchExport(),
            'new-note': () => this.createNewNote(),
            'open-window': () => this.openInNewWindow(),
            'settings': () => this.openSettings()
        };

        Object.entries(buttons).forEach(([id, handler]) => {
            const button = document.getElementById(id);
            if (button) {
                XSSProtection.safeAddEventListener(button, 'click', handler);
            }
        });
    }

    /**
     * 绑定编辑器事件
     */
    bindEditorEvents() {
        const noteTitle = document.getElementById('note-title');
        const noteEditor = document.getElementById('note-editor');
        const buttons = {
            'preview-mode': () => this.switchToPreview(),
            'edit-mode': () => this.switchToEdit(),
            'tag-button': () => this.openTagSelector(),
            'reference-note': () => this.openReferenceModal(),
            'copy-note': () => this.copyCurrentNote(),
            'delete-note': () => this.deleteCurrentNote(),
            'save-note': () => this.saveCurrentNote()
        };

        if (noteTitle) {
            XSSProtection.safeAddEventListener(noteTitle, 'input', 
                this.debounce(() => this.updateWordCount(), 100)
            );
        }
        
        if (noteEditor) {
            XSSProtection.safeAddEventListener(noteEditor, 'input', 
                this.debounce(() => this.updateWordCount(), 100)
            );
        }

        Object.entries(buttons).forEach(([id, handler]) => {
            const button = document.getElementById(id);
            if (button) {
                XSSProtection.safeAddEventListener(button, 'click', handler);
            }
        });
    }

    /**
     * 绑定模态框事件
     */
    bindModalEvents() {
        // 关闭按钮
        document.querySelectorAll('.modal-close').forEach(button => {
            XSSProtection.safeAddEventListener(button, 'click', 
                () => this.closeModal(button.closest('.modal'))
            );
        });

        // 标签选择器
        this.bindTagSelectorEvents();
        
        // 引用模态框
        this.bindReferenceModalEvents();
        
        // 导出模态框
        this.bindExportModalEvents();
    }

    /**
     * 绑定标签选择器事件
     */
    bindTagSelectorEvents() {
        const tagRadios = document.querySelectorAll('input[name="category"], input[name="priority"]');
        const tagConfirm = document.getElementById('tag-confirm');
        const tagCancel = document.getElementById('tag-cancel');

        tagRadios.forEach(radio => {
            XSSProtection.safeAddEventListener(radio, 'change', 
                () => this.updateTagPreview()
            );
        });

        if (tagConfirm) {
            XSSProtection.safeAddEventListener(tagConfirm, 'click', 
                () => this.confirmTagSelection()
            );
        }
        
        if (tagCancel) {
            XSSProtection.safeAddEventListener(tagCancel, 'click', 
                () => this.closeModal(document.getElementById('tag-selector-modal'))
            );
        }
    }

    /**
     * 绑定引用模态框事件
     */
    bindReferenceModalEvents() {
        const refRadios = document.querySelectorAll('input[name="ref-format"]');
        const copyReference = document.getElementById('copy-reference');
        const referenceCancel = document.getElementById('reference-cancel');

        refRadios.forEach(radio => {
            XSSProtection.safeAddEventListener(radio, 'change', 
                () => this.updateReferencePreview()
            );
        });

        if (copyReference) {
            XSSProtection.safeAddEventListener(copyReference, 'click', 
                () => this.copyReference()
            );
        }
        
        if (referenceCancel) {
            XSSProtection.safeAddEventListener(referenceCancel, 'click', 
                () => this.closeModal(document.getElementById('reference-modal'))
            );
        }
    }

    /**
     * 绑定导出模态框事件
     */
    bindExportModalEvents() {
        const confirmExport = document.getElementById('confirm-export');
        const exportCancel = document.getElementById('export-cancel');

        if (confirmExport) {
            XSSProtection.safeAddEventListener(confirmExport, 'click', 
                () => this.confirmExport()
            );
        }
        
        if (exportCancel) {
            XSSProtection.safeAddEventListener(exportCancel, 'click', 
                () => this.closeModal(document.getElementById('export-modal'))
            );
        }
    }

    /**
     * 处理搜索
     */
    async handleSearch(query) {
        try {
            if (!await PermissionManager.checkOperationPermission('search')) {
                return;
            }

            this.filters.search = DataSanitizer.sanitizeSearchQuery(query);
            
            // 显示/隐藏清除按钮
            const clearBtn = document.getElementById('clear-search');
            if (clearBtn) {
                clearBtn.style.display = this.filters.search ? 'block' : 'none';
            }
            
            this.applyFilters();
        } catch (error) {
            console.error('搜索失败:', error);
        }
    }

    /**
     * 清除搜索
     */
    clearSearch() {
        const searchInput = document.getElementById('global-search');
        if (searchInput) {
            searchInput.value = '';
        }
        this.handleSearch('');
    }

    /**
     * 处理标签过滤
     */
    handleTagFilter(tag) {
        this.filters.tag = tag;
        this.applyFilters();
    }

    /**
     * 处理日期过滤
     */
    handleDateFilter(dateRange) {
        this.filters.date = dateRange;
        this.applyFilters();
    }

    /**
     * 处理网站过滤
     */
    handleSiteFilter(site) {
        this.filters.site = site;
        this.applyFilters();
    }

    /**
     * 处理排序变更
     */
    handleSortChange(sortBy) {
        this.sortBy = sortBy;
        this.applyFilters();
    }

    /**
     * 应用所有过滤条件
     */
    applyFilters() {
        let filtered = [...this.notes];

        // 搜索过滤
        if (this.filters.search) {
            filtered = this.searchEngine.search(this.filters.search, filtered);
        }

        // 标签过滤
        if (this.filters.tag) {
            filtered = filtered.filter(note => note.tag === this.filters.tag);
        }

        // 日期过滤
        if (this.filters.date) {
            filtered = this.filterByDate(filtered, this.filters.date);
        }

        // 网站过滤
        if (this.filters.site) {
            filtered = filtered.filter(note => {
                try {
                    const url = new URL(note.url || '');
                    return url.hostname === this.filters.site;
                } catch {
                    return false;
                }
            });
        }

        // 排序
        filtered = this.sortNotes(filtered, this.sortBy);

        this.filteredNotes = filtered;
        this.renderNoteList();
        this.updateNoteCount();
    }

    /**
     * 按日期过滤
     */
    filterByDate(notes, dateRange) {
        const now = new Date();
        let startDate;

        switch (dateRange) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'quarter':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                return notes;
        }

        return notes.filter(note => {
            const noteDate = new Date(note.updatedAt || note.createdAt);
            return noteDate >= startDate;
        });
    }

    /**
     * 排序笔记
     */
    sortNotes(notes, sortBy) {
        return notes.sort((a, b) => {
            switch (sortBy) {
                case 'priority':
                    return this.getTagPriority(b.tag) - this.getTagPriority(a.tag);
                case 'updated':
                    return new Date(b.updatedAt) - new Date(a.updatedAt);
                case 'created':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                case 'title':
                    return (a.title || '').localeCompare(b.title || '');
                case 'site':
                    const siteA = this.extractHostname(a.url);
                    const siteB = this.extractHostname(b.url);
                    return siteA.localeCompare(siteB);
                default:
                    return 0;
            }
        });
    }

    /**
     * 获取标签优先级
     */
    getTagPriority(tag) {
        if (!tag) return 0;
        
        const [category, priority] = tag.split('_');
        const categoryWeight = category === 'important' ? 100 : 
                              category === 'needed' ? 50 : 
                              category === 'interesting' ? 25 : 0;
        const priorityWeight = priority === 'very' ? 3 : 
                              priority === 'somewhat' ? 2 : 1;
        
        return categoryWeight + priorityWeight;
    }

    /**
     * 提取主机名
     */
    extractHostname(url) {
        try {
            return new URL(url || '').hostname;
        } catch {
            return '';
        }
    }

    /**
     * 渲染界面
     */
    render() {
        this.renderNoteList();
        this.renderEditor();
        this.updateNoteCount();
    }

    /**
     * 渲染笔记列表
     */
    renderNoteList() {
        const noteList = document.getElementById('note-list');
        const loading = document.getElementById('loading-notes');
        const emptyState = document.getElementById('empty-state');
        
        if (!noteList) return;

        // 隐藏加载状态
        if (loading) loading.style.display = 'none';

        // 清空现有内容
        noteList.innerHTML = '';

        if (this.filteredNotes.length === 0) {
            if (emptyState) {
                emptyState.style.display = 'block';
                noteList.appendChild(emptyState);
            }
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        // 渲染笔记项
        this.filteredNotes.forEach(note => {
            const noteItem = this.createNoteItem(note);
            noteList.appendChild(noteItem);
        });
    }

    /**
     * 创建笔记列表项
     */
    createNoteItem(note) {
        const item = XSSProtection.createSafeElement('div', '', {
            'class': 'note-item',
            'data-note-id': note.id
        });

        // 选择框
        const checkbox = XSSProtection.createSafeElement('input', '', {
            'type': 'checkbox',
            'class': 'note-checkbox'
        });
        
        if (this.selectedNotes.has(note.id)) {
            checkbox.checked = true;
            item.classList.add('selected');
        }
        
        XSSProtection.safeAddEventListener(checkbox, 'change', 
            (e) => this.handleNoteSelection(note.id, e.target.checked)
        );

        // 笔记内容容器
        const content = XSSProtection.createSafeElement('div', '', {
            'class': 'note-content'
        });

        // 标题
        const title = XSSProtection.createSafeElement('div', 
            note.title || '未命名笔记', 
            { 'class': 'note-title' }
        );

        // 预览
        const preview = XSSProtection.createSafeElement('div', 
            this.getPreviewText(note.note), 
            { 'class': 'note-preview' }
        );

        // 元数据
        const meta = XSSProtection.createSafeElement('div', '', {
            'class': 'note-meta'
        });

        // 标签
        if (note.tag) {
            const tagSpan = this.createTagElement(note.tag);
            meta.appendChild(tagSpan);
        }

        // 时间
        const timeSpan = XSSProtection.createSafeElement('span', 
            this.formatTime(note.updatedAt || note.createdAt)
        );
        meta.appendChild(timeSpan);

        // 网站
        if (note.url) {
            const siteSpan = XSSProtection.createSafeElement('span', 
                this.extractHostname(note.url)
            );
            meta.appendChild(siteSpan);
        }

        // 组装元素
        content.appendChild(title);
        content.appendChild(preview);
        content.appendChild(meta);
        
        item.appendChild(checkbox);
        item.appendChild(content);

        // 点击事件
        XSSProtection.safeAddEventListener(item, 'click', (e) => {
            if (e.target.type !== 'checkbox') {
                this.selectNote(note);
            }
        });

        return item;
    }

    /**
     * 创建标签元素
     */
    createTagElement(tag) {
        const displayName = this.getTagDisplayName(tag);
        const tagClass = `note-tag tag-${tag}`;
        
        return XSSProtection.createSafeElement('span', displayName, {
            'class': tagClass
        });
    }

    /**
     * 获取标签显示名称
     */
    getTagDisplayName(tag) {
        const tagMap = {
            'important_very': '🔥 非常重要',
            'important_somewhat': '🔥 比较重要', 
            'important_general': '🔥 一般重要',
            'interesting_very': '💡 非常有趣',
            'interesting_somewhat': '💡 比较有趣',
            'interesting_general': '💡 一般有趣',
            'needed_very': '⚡ 非常需要',
            'needed_somewhat': '⚡ 比较需要',
            'needed_general': '⚡ 一般需要'
        };
        return tagMap[tag] || '无标签';
    }

    /**
     * 获取预览文本
     */
    getPreviewText(content) {
        if (!content) return '';
        
        // 移除Markdown标记
        const cleanText = content
            .replace(/#{1,6}\s+/g, '') // 标题
            .replace(/\*\*(.*?)\*\*/g, '$1') // 粗体
            .replace(/\*(.*?)\*/g, '$1') // 斜体
            .replace(/`(.*?)`/g, '$1') // 代码
            .replace(/\[(.*?)\]\(.*?\)/g, '$1') // 链接
            .replace(/\n+/g, ' ') // 换行
            .trim();
        
        return cleanText.length > 100 ? cleanText.substring(0, 100) + '...' : cleanText;
    }

    /**
     * 格式化时间
     */
    formatTime(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        // 一天内显示相对时间
        if (diff < 24 * 60 * 60 * 1000) {
            if (diff < 60 * 1000) return '刚刚';
            if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}分钟前`;
            return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
        }
        
        // 超过一天显示具体日期
        return date.toLocaleDateString('zh-CN');
    }

    /**
     * 防抖函数
     */
    debounce(func, wait) {
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

    /**
     * 处理笔记选择
     */
    handleNoteSelection(noteId, selected) {
        if (selected) {
            this.selectedNotes.add(noteId);
        } else {
            this.selectedNotes.delete(noteId);
        }
        
        this.updateSelectionUI();
    }

    /**
     * 处理全选
     */
    handleSelectAll(selectAll) {
        this.selectedNotes.clear();
        
        if (selectAll) {
            this.filteredNotes.forEach(note => {
                this.selectedNotes.add(note.id);
            });
        }
        
        // 更新UI
        document.querySelectorAll('.note-checkbox').forEach(checkbox => {
            checkbox.checked = selectAll;
        });
        
        document.querySelectorAll('.note-item').forEach(item => {
            if (selectAll) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
        
        this.updateSelectionUI();
    }

    /**
     * 更新选择状态UI
     */
    updateSelectionUI() {
        const selectedCount = document.getElementById('selected-count');
        const selectedNumber = document.getElementById('selected-number');
        const selectAllCheckbox = document.getElementById('select-all-notes');
        
        if (selectedCount && selectedNumber) {
            if (this.selectedNotes.size > 0) {
                selectedCount.style.display = 'inline';
                selectedNumber.textContent = this.selectedNotes.size;
            } else {
                selectedCount.style.display = 'none';
            }
        }
        
        if (selectAllCheckbox) {
            selectAllCheckbox.indeterminate = this.selectedNotes.size > 0 && 
                                           this.selectedNotes.size < this.filteredNotes.length;
            selectAllCheckbox.checked = this.selectedNotes.size === this.filteredNotes.length && 
                                       this.filteredNotes.length > 0;
        }
    }

    /**
     * 更新笔记计数
     */
    updateNoteCount() {
        const totalNotes = document.getElementById('total-notes');
        if (totalNotes) {
            totalNotes.textContent = this.filteredNotes.length;
        }
    }

    /**
     * 填充网站过滤器
     */
    populateSiteFilter() {
        const siteFilter = document.getElementById('site-filter');
        if (!siteFilter) return;

        const sites = new Set();
        this.notes.forEach(note => {
            if (note.url) {
                try {
                    sites.add(new URL(note.url).hostname);
                } catch {
                    // 忽略无效URL
                }
            }
        });

        // 清空现有选项（保留"全部网站"）
        const options = siteFilter.querySelectorAll('option:not(:first-child)');
        options.forEach(option => option.remove());

        // 添加网站选项
        Array.from(sites).sort().forEach(site => {
            const option = XSSProtection.createSafeElement('option', site, {
                'value': site
            });
            siteFilter.appendChild(option);
        });
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notification-text');
        
        if (!notification || !notificationText) return;

        notificationText.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'flex';

        // 自动隐藏
        setTimeout(() => {
            notification.style.display = 'none';
        }, 5000);
    }

    /**
     * 选择笔记
     */
    selectNote(note) {
        this.currentNote = note;
        
        // 更新列表项激活状态
        document.querySelectorAll('.note-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const noteItem = document.querySelector(`[data-note-id="${note.id}"]`);
        if (noteItem) {
            noteItem.classList.add('active');
        }
        
        // 渲染编辑器
        this.renderEditor();
        
        // 显示删除按钮
        const deleteBtn = document.getElementById('delete-note');
        if (deleteBtn) {
            deleteBtn.style.display = 'inline-flex';
        }
    }

    /**
     * 渲染编辑器
     */
    renderEditor() {
        const noteTitle = document.getElementById('note-title');
        const noteEditor = document.getElementById('note-editor');
        const currentTag = document.getElementById('current-tag');
        const noteUrl = document.getElementById('note-url');
        const noteDates = document.getElementById('note-dates');
        
        if (this.currentNote) {
            if (noteTitle) noteTitle.value = this.currentNote.title || '';
            if (noteEditor) noteEditor.value = this.currentNote.note || '';
            if (currentTag) {
                currentTag.textContent = this.getTagDisplayName(this.currentNote.tag);
                currentTag.className = `current-tag tag-${this.currentNote.tag}`;
            }
            if (noteUrl) {
                if (this.currentNote.url) {
                    noteUrl.innerHTML = `🔗 <a href="${this.currentNote.url}" target="_blank">${this.currentNote.url}</a>`;
                } else {
                    noteUrl.textContent = '';
                }
            }
            if (noteDates) {
                const created = this.formatFullTime(this.currentNote.createdAt);
                const updated = this.formatFullTime(this.currentNote.updatedAt);
                noteDates.textContent = `创建：${created} | 更新：${updated}`;
            }
        } else {
            if (noteTitle) noteTitle.value = '';
            if (noteEditor) noteEditor.value = '';
            if (currentTag) {
                currentTag.textContent = '无标签';
                currentTag.className = 'current-tag';
            }
            if (noteUrl) noteUrl.textContent = '';
            if (noteDates) noteDates.textContent = '';
        }
        
        this.updateWordCount();
    }

    /**
     * 格式化完整时间
     */
    formatFullTime(timestamp) {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleString('zh-CN');
    }

    /**
     * 更新字数统计
     */
    updateWordCount() {
        const noteTitle = document.getElementById('note-title');
        const noteEditor = document.getElementById('note-editor');
        const wordCount = document.getElementById('word-count');
        
        if (wordCount) {
            const titleLength = noteTitle ? noteTitle.value.length : 0;
            const contentLength = noteEditor ? noteEditor.value.length : 0;
            const totalLength = titleLength + contentLength;
            
            wordCount.textContent = `${totalLength} 字符`;
        }
    }

    /**
     * 刷新笔记
     */
    async refreshNotes() {
        try {
            this.showNotification('正在刷新笔记...', 'info');
            await this.loadNotes();
            this.searchEngine.buildIndex(this.notes);
            this.applyFilters();
            this.populateSiteFilter();
            this.showNotification('笔记已刷新', 'success');
        } catch (error) {
            console.error('刷新失败:', error);
            this.showNotification('刷新失败：' + error.message, 'error');
        }
    }

    /**
     * 创建新笔记
     */
    async createNewNote() {
        try {
            if (!await PermissionManager.checkOperationPermission('create')) {
                this.showNotification('没有创建权限', 'error');
                return;
            }

            const newNote = {
                id: DataSanitizer.generateSecureId(),
                title: '',
                note: '',
                tag: 'general_general',
                url: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            this.currentNote = newNote;
            this.renderEditor();
            
            // 聚焦到标题输入框
            const noteTitle = document.getElementById('note-title');
            if (noteTitle) {
                noteTitle.focus();
            }
            
            this.showNotification('已创建新笔记', 'success');
        } catch (error) {
            console.error('创建笔记失败:', error);
            this.showNotification('创建失败：' + error.message, 'error');
        }
    }

    /**
     * 保存当前笔记
     */
    async saveCurrentNote() {
        try {
            if (!this.currentNote) {
                this.showNotification('没有要保存的笔记', 'warning');
                return;
            }

            if (!await PermissionManager.checkOperationPermission('save', this.currentNote.id)) {
                this.showNotification('保存过于频繁，请稍后再试', 'warning');
                return;
            }

            const noteTitle = document.getElementById('note-title');
            const noteEditor = document.getElementById('note-editor');
            
            // 获取并清理数据
            const title = DataSanitizer.sanitizeTitle(noteTitle ? noteTitle.value : '');
            const content = DataSanitizer.sanitizeNoteContent(noteEditor ? noteEditor.value : '');
            
            if (!title && !content) {
                this.showNotification('标题和内容不能都为空', 'warning');
                return;
            }

            // 更新笔记数据
            this.currentNote.title = title || '未命名笔记';
            this.currentNote.note = content;
            this.currentNote.updatedAt = new Date().toISOString();

            // 保存到数据库
            await this.saveNoteToDatabase(this.currentNote);
            
            // 更新本地数据
            const existingIndex = this.notes.findIndex(note => note.id === this.currentNote.id);
            if (existingIndex >= 0) {
                this.notes[existingIndex] = { ...this.currentNote };
            } else {
                this.notes.unshift({ ...this.currentNote });
            }

            // 重新构建搜索索引
            this.searchEngine.buildIndex(this.notes);
            
            // 重新应用过滤器
            this.applyFilters();
            
            // 更新网站过滤器
            this.populateSiteFilter();
            
            // 更新状态显示
            const saveStatus = document.getElementById('save-status');
            if (saveStatus) {
                saveStatus.textContent = '✓ 已保存';
                setTimeout(() => {
                    saveStatus.textContent = '';
                }, 2000);
            }
            
            this.showNotification('笔记已保存', 'success');
        } catch (error) {
            console.error('保存失败:', error);
            this.showNotification('保存失败：' + error.message, 'error');
        }
    }

    /**
     * 保存笔记到数据库
     */
    async saveNoteToDatabase(note) {
        return new Promise((resolve, reject) => {
            if (chrome && chrome.runtime) {
                chrome.runtime.sendMessage({
                    action: 'saveNote',
                    note: note
                }, (response) => {
                    if (response && response.success) {
                        resolve(response);
                    } else {
                        reject(new Error(response ? response.error : '保存失败'));
                    }
                });
            } else {
                // 开发环境模拟
                console.log('模拟保存笔记:', note);
                resolve({ success: true });
            }
        });
    }

    /**
     * 删除当前笔记
     */
    async deleteCurrentNote() {
        try {
            if (!this.currentNote) return;

            if (!await PermissionManager.checkOperationPermission('delete', this.currentNote.id)) {
                return;
            }

            // 从数据库删除
            await this.deleteNoteFromDatabase(this.currentNote.id);
            
            // 从本地数据删除
            this.notes = this.notes.filter(note => note.id !== this.currentNote.id);
            this.filteredNotes = this.filteredNotes.filter(note => note.id !== this.currentNote.id);
            
            // 清除选择
            this.selectedNotes.delete(this.currentNote.id);
            this.currentNote = null;
            
            // 重新构建搜索索引
            this.searchEngine.buildIndex(this.notes);
            
            // 重新渲染界面
            this.renderNoteList();
            this.renderEditor();
            this.updateNoteCount();
            this.updateSelectionUI();
            
            // 隐藏删除按钮
            const deleteBtn = document.getElementById('delete-note');
            if (deleteBtn) {
                deleteBtn.style.display = 'none';
            }
            
            this.showNotification('笔记已删除', 'success');
        } catch (error) {
            console.error('删除失败:', error);
            this.showNotification('删除失败：' + error.message, 'error');
        }
    }

    /**
     * 从数据库删除笔记
     */
    async deleteNoteFromDatabase(noteId) {
        return new Promise((resolve, reject) => {
            if (chrome && chrome.runtime) {
                chrome.runtime.sendMessage({
                    action: 'deleteNote',
                    noteId: noteId
                }, (response) => {
                    if (response && response.success) {
                        resolve(response);
                    } else {
                        reject(new Error(response ? response.error : '删除失败'));
                    }
                });
            } else {
                // 开发环境模拟
                console.log('模拟删除笔记:', noteId);
                resolve({ success: true });
            }
        });
    }

    /**
     * 复制当前笔记
     */
    async copyCurrentNote() {
        try {
            if (!this.currentNote) {
                this.showNotification('没有要复制的笔记', 'warning');
                return;
            }

            if (!await PermissionManager.checkOperationPermission('copy')) {
                this.showNotification('复制过于频繁，请稍后再试', 'warning');
                return;
            }

            const content = `# ${this.currentNote.title || '未命名笔记'}\n\n${this.currentNote.note || ''}`;
            
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(content);
                this.showNotification('笔记内容已复制到剪贴板', 'success');
            } else {
                // 降级方案
                const textArea = document.createElement('textarea');
                textArea.value = content;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.showNotification('笔记内容已复制到剪贴板', 'success');
            }
        } catch (error) {
            console.error('复制失败:', error);
            this.showNotification('复制失败：' + error.message, 'error');
        }
    }

    /**
     * 切换到预览模式
     */
    switchToPreview() {
        const editMode = document.getElementById('edit-mode');
        const previewMode = document.getElementById('preview-mode');
        const noteEditor = document.getElementById('note-editor');
        const notePreview = document.getElementById('note-preview');
        
        if (editMode) editMode.classList.remove('active');
        if (previewMode) previewMode.classList.add('active');
        
        if (noteEditor) noteEditor.style.display = 'none';
        if (notePreview) {
            notePreview.style.display = 'block';
            this.renderMarkdownPreview();
        }
    }

    /**
     * 切换到编辑模式
     */
    switchToEdit() {
        const editMode = document.getElementById('edit-mode');
        const previewMode = document.getElementById('preview-mode');
        const noteEditor = document.getElementById('note-editor');
        const notePreview = document.getElementById('note-preview');
        
        if (editMode) editMode.classList.add('active');
        if (previewMode) previewMode.classList.remove('active');
        
        if (noteEditor) noteEditor.style.display = 'block';
        if (notePreview) notePreview.style.display = 'none';
    }

    /**
     * 渲染Markdown预览
     */
    renderMarkdownPreview() {
        const noteEditor = document.getElementById('note-editor');
        const notePreview = document.getElementById('note-preview');
        
        if (!noteEditor || !notePreview) return;

        const content = noteEditor.value;
        if (!content) {
            notePreview.innerHTML = '<div class="preview-placeholder"><div class="preview-icon">👁️</div><p>没有内容可预览</p></div>';
            return;
        }

        // 简单的Markdown渲染（基础版）
        let html = content
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
            .replace(/\n/g, '<br>');

        XSSProtection.safeSetInnerHTML(notePreview, html);
    }

    /**
     * 打开标签选择器
     */
    openTagSelector() {
        const modal = document.getElementById('tag-selector-modal');
        if (!modal) return;

        // 重置选择
        document.querySelectorAll('input[name="category"]').forEach(radio => {
            radio.checked = false;
        });
        document.querySelectorAll('input[name="priority"]').forEach(radio => {
            radio.checked = false;
        });

        // 如果有当前笔记，设置当前标签
        if (this.currentNote && this.currentNote.tag) {
            const [category, priority] = this.currentNote.tag.split('_');
            const categoryRadio = document.querySelector(`input[name="category"][value="${category}"]`);
            const priorityRadio = document.querySelector(`input[name="priority"][value="${priority}"]`);
            
            if (categoryRadio) categoryRadio.checked = true;
            if (priorityRadio) priorityRadio.checked = true;
        }

        this.updateTagPreview();
        modal.style.display = 'flex';
    }

    /**
     * 更新标签预览
     */
    updateTagPreview() {
        const categoryRadio = document.querySelector('input[name="category"]:checked');
        const priorityRadio = document.querySelector('input[name="priority"]:checked');
        const tagPreview = document.getElementById('tag-preview-display');
        
        if (!tagPreview) return;

        if (categoryRadio && priorityRadio) {
            const tag = `${categoryRadio.value}_${priorityRadio.value}`;
            const displayName = this.getTagDisplayName(tag);
            
            tagPreview.textContent = displayName;
            tagPreview.className = `tag-badge tag-${tag}`;
        } else {
            tagPreview.textContent = '请选择标签';
            tagPreview.className = 'tag-badge';
        }
    }

    /**
     * 确认标签选择
     */
    confirmTagSelection() {
        const categoryRadio = document.querySelector('input[name="category"]:checked');
        const priorityRadio = document.querySelector('input[name="priority"]:checked');
        
        if (!categoryRadio || !priorityRadio) {
            this.showNotification('请选择完整的标签组合', 'warning');
            return;
        }

        if (this.currentNote) {
            this.currentNote.tag = `${categoryRadio.value}_${priorityRadio.value}`;
            
            // 更新UI
            const currentTag = document.getElementById('current-tag');
            if (currentTag) {
                currentTag.textContent = this.getTagDisplayName(this.currentNote.tag);
                currentTag.className = `current-tag tag-${this.currentNote.tag}`;
            }
        }

        this.closeModal(document.getElementById('tag-selector-modal'));
        this.showNotification('标签已更新', 'success');
    }

    /**
     * 打开引用模态框
     */
    openReferenceModal() {
        if (!this.currentNote) {
            this.showNotification('请先选择一个笔记', 'warning');
            return;
        }

        const modal = document.getElementById('reference-modal');
        if (!modal) return;

        this.updateReferencePreview();
        modal.style.display = 'flex';
    }

    /**
     * 更新引用预览
     */
    updateReferencePreview() {
        if (!this.currentNote) return;

        const formatRadio = document.querySelector('input[name="ref-format"]:checked');
        const previewText = document.getElementById('reference-preview-text');
        
        if (!formatRadio || !previewText) return;

        const format = formatRadio.value;
        let reference = '';

        switch (format) {
            case 'full':
                reference = `[📝 ${this.currentNote.title}](tst://note/${this.currentNote.id}) - ${this.formatTime(this.currentNote.updatedAt)}`;
                break;
            case 'quote':
                const preview = this.getPreviewText(this.currentNote.note);
                reference = `> 来自 [📝 ${this.currentNote.title}](tst://note/${this.currentNote.id})：\n> ${preview}`;
                break;
            case 'simple':
                reference = `[[${this.currentNote.title}]]`;
                break;
            case 'link':
                reference = `tst://note/${this.currentNote.id}`;
                break;
        }

        previewText.textContent = reference;
    }

    /**
     * 复制引用
     */
    async copyReference() {
        try {
            const previewText = document.getElementById('reference-preview-text');
            if (!previewText) return;

            const reference = previewText.textContent;
            
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(reference);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = reference;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }

            this.closeModal(document.getElementById('reference-modal'));
            this.showNotification('引用已复制到剪贴板', 'success');
        } catch (error) {
            console.error('复制引用失败:', error);
            this.showNotification('复制失败：' + error.message, 'error');
        }
    }

    /**
     * 处理批量导出
     */
    async handleBatchExport() {
        try {
            if (this.selectedNotes.size === 0) {
                this.showNotification('请先选择要导出的笔记', 'warning');
                return;
            }

            if (!await PermissionManager.checkOperationPermission('export')) {
                this.showNotification('没有导出权限', 'error');
                return;
            }

            const modal = document.getElementById('export-modal');
            if (!modal) return;

            // 更新导出数量
            const exportCount = document.getElementById('export-count');
            if (exportCount) {
                exportCount.textContent = this.selectedNotes.size;
            }

            // 检查敏感信息
            const selectedNoteObjects = this.notes.filter(note => this.selectedNotes.has(note.id));
            const hasSensitive = selectedNoteObjects.some(note => 
                DataSanitizer.containsSensitiveInfo(note.title) || 
                DataSanitizer.containsSensitiveInfo(note.note)
            );

            const sensitiveWarning = document.getElementById('sensitive-warning');
            if (sensitiveWarning) {
                sensitiveWarning.style.display = hasSensitive ? 'block' : 'none';
            }

            modal.style.display = 'flex';
        } catch (error) {
            console.error('准备导出失败:', error);
            this.showNotification('准备导出失败：' + error.message, 'error');
        }
    }

    /**
     * 确认导出
     */
    async confirmExport() {
        try {
            const formatRadio = document.querySelector('input[name="export-format"]:checked');
            const includeMetadata = document.getElementById('include-metadata').checked;
            const maskSensitive = document.getElementById('mask-sensitive').checked;
            
            const format = formatRadio ? formatRadio.value : 'json';
            
            // 获取要导出的笔记
            const selectedNoteObjects = this.notes.filter(note => this.selectedNotes.has(note.id));
            
            if (selectedNoteObjects.length === 0) {
                this.showNotification('没有可导出的笔记', 'warning');
                return;
            }

            // 创建备份
            const backup = await BackupManager.createManualBackup(selectedNoteObjects, {
                includeMetadata,
                maskSensitive
            });

            if (!backup.success) {
                throw new Error(backup.error || '创建备份失败');
            }

            // 导出文件
            const blob = await BackupManager.exportBackup(backup.backup, format);
            
            // 创建下载链接
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = blob.filename || `notes-export-${Date.now()}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.closeModal(document.getElementById('export-modal'));
            this.showNotification(`已导出 ${selectedNoteObjects.length} 条笔记`, 'success');

        } catch (error) {
            console.error('导出失败:', error);
            this.showNotification('导出失败：' + error.message, 'error');
        }
    }

    /**
     * 在新窗口中打开
     */
    openInNewWindow() {
        if (chrome && chrome.windows) {
            chrome.windows.create({
                url: chrome.runtime.getURL('note-manager.html'),
                type: 'popup',
                width: 1200,
                height: 800
            });
        } else {
            // 降级方案
            window.open('note-manager.html', '_blank', 'width=1200,height=800');
        }
    }

    /**
     * 打开设置
     */
    openSettings() {
        this.showNotification('设置功能开发中...', 'info');
    }

    /**
     * 关闭模态框
     */
    closeModal(modal) {
        if (modal) {
            modal.style.display = 'none';
        }
    }
}

/**
 * 全文搜索引擎
 */
class FullTextSearchEngine {
    constructor() {
        this.searchIndex = {};
        this.noteMap = new Map();
    }

    /**
     * 构建搜索索引
     */
    buildIndex(notes) {
        this.searchIndex = {};
        this.noteMap.clear();
        
        notes.forEach(note => {
            this.noteMap.set(note.id, note);
            const words = this.tokenize(note.title + ' ' + note.note);
            
            words.forEach(word => {
                if (!this.searchIndex[word]) {
                    this.searchIndex[word] = new Set();
                }
                this.searchIndex[word].add(note.id);
            });
        });
    }

    /**
     * 分词
     */
    tokenize(text) {
        if (!text) return [];
        
        return text.toLowerCase()
            .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 1);
    }

    /**
     * 搜索
     */
    search(query, notes) {
        if (!query) return notes;
        
        const queryWords = this.tokenize(query);
        if (queryWords.length === 0) return notes;
        
        const results = new Map();
        
        queryWords.forEach(word => {
            // 精确匹配
            if (this.searchIndex[word]) {
                this.searchIndex[word].forEach(noteId => {
                    results.set(noteId, (results.get(noteId) || 0) + 2);
                });
            }
            
            // 模糊匹配
            Object.keys(this.searchIndex).forEach(indexWord => {
                if (indexWord.includes(word) && indexWord !== word) {
                    this.searchIndex[indexWord].forEach(noteId => {
                        results.set(noteId, (results.get(noteId) || 0) + 1);
                    });
                }
            });
        });
        
        // 按相关性排序
        const sortedResults = Array.from(results.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([noteId]) => this.noteMap.get(noteId))
            .filter(Boolean);
        
        return sortedResults;
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.noteManager = new NoteManager();
});

// 导出供其他模块使用
window.NoteManager = NoteManager;
window.FullTextSearchEngine = FullTextSearchEngine;