/**
 * Research Navigator - Simplified Entry Point
 * 简化的JavaScript入口文件
 */

console.log('Research Navigator: Loading...');

// 简单的历史跟踪器
class SimpleHistoryTracker {
  constructor() {
    this.accessHistory = [];
    this.maxHistorySize = 100;
    this.prefsPrefix = 'extensions.zotero.researchnavigator';
    
    this.loadFromStorage();
    this.initializeListeners();
  }

  initializeListeners() {
    try {
      if (typeof Zotero !== 'undefined' && Zotero.Notifier) {
        Zotero.Notifier.registerObserver(this, ['item', 'collection'], 'researchNavigator');
        console.log('Research Navigator: Event listeners registered');
      }
    } catch (error) {
      console.error('Research Navigator: Failed to register listeners:', error);
    }
  }

  notify(event, type, ids) {
    try {
      if (event === 'select' || event === 'open') {
        for (const id of ids) {
          this.onItemAccessed(type, id);
        }
      }
    } catch (error) {
      console.error('Research Navigator: Error in notify:', error);
    }
  }

  onItemAccessed(itemType, itemId) {
    try {
      let item;
      if (itemType === 'item' && typeof Zotero !== 'undefined' && Zotero.Items) {
        item = Zotero.Items.get(itemId);
      } else if (itemType === 'collection' && typeof Zotero !== 'undefined' && Zotero.Collections) {
        item = Zotero.Collections.get(itemId);
      }

      if (item) {
        const record = {
          id: `${itemType}_${itemId}`,
          itemType,
          itemId,
          title: item.title || item.name || 'Untitled',
          timestamp: Date.now()
        };

        this.addAccessRecord(record);
        console.log('Research Navigator: Recorded access:', record.title);
      }
    } catch (error) {
      console.error('Research Navigator: Error recording access:', error);
    }
  }

  addAccessRecord(record) {
    this.accessHistory.unshift(record);
    
    if (this.accessHistory.length > this.maxHistorySize) {
      this.accessHistory = this.accessHistory.slice(0, this.maxHistorySize);
    }
    
    this.saveToStorage();
  }

  buildHistoryTree() {
    const groups = new Map();
    const now = new Date();
    
    for (const record of this.accessHistory) {
      const recordDate = new Date(record.timestamp);
      const daysDiff = Math.floor((now.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let timeLabel;
      if (daysDiff === 0) {
        timeLabel = '今天';
      } else if (daysDiff === 1) {
        timeLabel = '昨天';
      } else if (daysDiff < 7) {
        timeLabel = `${daysDiff}天前`;
      } else {
        timeLabel = recordDate.toLocaleDateString();
      }
      
      if (!groups.has(timeLabel)) {
        groups.set(timeLabel, []);
      }
      groups.get(timeLabel).push(record);
    }
    
    return Array.from(groups.entries()).map(([timeLabel, records]) => ({
      id: `time_${timeLabel}`,
      title: timeLabel,
      itemType: 'timeGroup',
      timestamp: records[0]?.timestamp || 0,
      children: records.map(record => ({
        id: record.id,
        title: record.title,
        itemType: record.itemType,
        timestamp: record.timestamp,
        accessCount: 1,
        lastAccessed: record.timestamp
      })),
      accessCount: records.length,
      lastAccessed: records[0]?.timestamp || 0
    }));
  }

  loadFromStorage() {
    try {
      if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
        const historyData = Zotero.Prefs.get(`${this.prefsPrefix}.accessHistory`);
        if (historyData) {
          this.accessHistory = JSON.parse(historyData);
        }
      }
    } catch (error) {
      console.error('Research Navigator: Error loading from storage:', error);
    }
  }

  saveToStorage() {
    try {
      if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
        Zotero.Prefs.set(`${this.prefsPrefix}.accessHistory`, JSON.stringify(this.accessHistory));
      }
    } catch (error) {
      console.error('Research Navigator: Error saving to storage:', error);
    }
  }

  clearHistory() {
    this.accessHistory = [];
    this.saveToStorage();
  }
}

// 简单的UI管理器
class SimpleUI {
  constructor(historyTracker) {
    this.historyTracker = historyTracker;
    this.panel = null;
    this.isVisible = false;
  }

  async initialize() {
    try {
      await this.waitForZotero();
      this.createSidebarPanel();
      console.log('Research Navigator: UI initialized');
    } catch (error) {
      console.error('Research Navigator: UI initialization failed:', error);
    }
  }

  async waitForZotero() {
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts) {
      if (typeof Zotero !== 'undefined' && Zotero.initializationPromise) {
        await Zotero.initializationPromise;
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    throw new Error('Zotero not ready');
  }

  createSidebarPanel() {
    try {
      const doc = document;
      let container = doc.body;

      this.panel = doc.createElement('div');
      this.panel.id = 'research-navigator-panel';
      this.panel.style.cssText = `
        position: fixed;
        top: 0;
        right: -400px;
        width: 400px;
        height: 100vh;
        background: white;
        border-left: 1px solid #ccc;
        z-index: 10000;
        transition: right 0.3s ease;
        overflow: hidden;
        box-shadow: -2px 0 10px rgba(0,0,0,0.1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;

      this.panel.innerHTML = `
        <div style="padding: 16px; border-bottom: 1px solid #eee; background: #f8f9fa;">
          <h3 style="margin: 0; font-size: 16px; color: #333;">Research Navigator</h3>
          <button id="rn-close-btn" style="float: right; background: none; border: none; font-size: 18px; cursor: pointer; margin-top: -24px;">×</button>
        </div>
        
        <div style="padding: 16px; border-bottom: 1px solid #eee;">
          <input type="text" id="rn-search-input" placeholder="搜索历史记录..." style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
        </div>
        
        <div style="padding: 8px 16px; border-bottom: 1px solid #eee; display: flex; gap: 8px;">
          <button id="rn-clear-history" style="padding: 4px 8px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer; font-size: 12px;">清除历史</button>
          <button id="rn-refresh" style="padding: 4px 8px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer; font-size: 12px;">刷新</button>
        </div>
        
        <div id="rn-history-list" style="flex: 1; overflow-y: auto; padding: 16px; height: calc(100vh - 150px);">
          <div style="text-align: center; color: #666; padding: 20px;">加载历史记录...</div>
        </div>
      `;

      container.appendChild(this.panel);

      this.setupEventListeners();
      this.loadHistoryData();

      console.log('Research Navigator: Panel created');
    } catch (error) {
      console.error('Research Navigator: Failed to create panel:', error);
    }
  }

  setupEventListeners() {
    if (!this.panel) return;

    const closeBtn = this.panel.querySelector('#rn-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hidePanel());
    }

    const clearBtn = this.panel.querySelector('#rn-clear-history');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('确定要清除所有历史记录吗？')) {
          this.historyTracker.clearHistory();
          this.loadHistoryData();
        }
      });
    }

    const refreshBtn = this.panel.querySelector('#rn-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadHistoryData());
    }

    const searchInput = this.panel.querySelector('#rn-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.handleSearch(e.target.value);
      });
    }
  }

  loadHistoryData() {
    try {
      const historyTree = this.historyTracker.buildHistoryTree();
      this.renderHistoryTree(historyTree);
    } catch (error) {
      console.error('Research Navigator: Error loading history:', error);
      this.showError('加载历史数据失败');
    }
  }

  renderHistoryTree(historyTree) {
    const container = this.panel?.querySelector('#rn-history-list');
    if (!container) return;

    if (historyTree.length === 0) {
      container.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">暂无访问历史</div>';
      return;
    }

    let html = '';
    
    for (const timeGroup of historyTree) {
      html += `
        <div style="margin-bottom: 16px;">
          <div style="font-weight: 600; padding: 8px 0; color: #555; border-bottom: 1px solid #ddd; margin-bottom: 8px; cursor: pointer;" data-group="${timeGroup.id}">
            📅 ${timeGroup.title} (${timeGroup.accessCount})
          </div>
          <div id="group-${timeGroup.id}">
      `;
      
      if (timeGroup.children) {
        for (const item of timeGroup.children) {
          html += `
            <div style="padding: 8px; border-bottom: 1px solid #eee; cursor: pointer; border-radius: 4px; margin-bottom: 4px;" data-item-id="${item.id}" onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='white'">
              <div style="font-weight: 500; color: #333; margin-bottom: 4px;">${item.title}</div>
              <div style="font-size: 12px; color: #666;">
                ${new Date(item.lastAccessed).toLocaleString()}
              </div>
            </div>
          `;
        }
      }
      
      html += `
          </div>
        </div>
      `;
    }

    container.innerHTML = html;

    // 添加事件监听器
    container.querySelectorAll('[data-item-id]').forEach(item => {
      item.addEventListener('click', (e) => {
        const itemId = e.currentTarget.dataset.itemId;
        this.handleItemClick(itemId);
      });
    });

    container.querySelectorAll('[data-group]').forEach(group => {
      group.addEventListener('click', (e) => {
        const groupId = e.currentTarget.dataset.group;
        this.toggleGroup(groupId);
      });
    });
  }

  handleItemClick(itemId) {
    console.log('Research Navigator: Clicking item:', itemId);
    
    const parts = itemId.split('_');
    if (parts.length >= 2) {
      const itemType = parts[0];
      const zoteroId = parseInt(parts[1]);
      
      try {
        if (itemType === 'item' && zoteroId && typeof Zotero !== 'undefined' && Zotero.Reader) {
          Zotero.Reader.open(zoteroId);
        }
      } catch (error) {
        console.error('Research Navigator: Failed to open item:', error);
      }
    }
  }

  toggleGroup(groupId) {
    const group = this.panel?.querySelector(`#group-${groupId}`);
    if (group) {
      group.style.display = group.style.display === 'none' ? 'block' : 'none';
    }
  }

  handleSearch(query) {
    const items = this.panel?.querySelectorAll('[data-item-id]');
    items?.forEach(item => {
      const title = item.querySelector('div').textContent || '';
      const isMatch = title.toLowerCase().includes(query.toLowerCase());
      item.style.display = isMatch ? 'block' : 'none';
    });
  }

  showError(message) {
    const container = this.panel?.querySelector('#rn-history-list');
    if (container) {
      container.innerHTML = `<div style="text-align: center; color: #dc3545; padding: 20px;">${message}</div>`;
    }
  }

  showPanel() {
    if (this.panel) {
      this.panel.style.right = '0px';
      this.isVisible = true;
      this.loadHistoryData();
    }
  }

  hidePanel() {
    if (this.panel) {
      this.panel.style.right = '-400px';
      this.isVisible = false;
    }
  }

  togglePanel() {
    if (this.isVisible) {
      this.hidePanel();
    } else {
      this.showPanel();
    }
  }

  destroy() {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
    this.isVisible = false;
  }
}

// 主插件类
class SimpleResearchNavigator {
  constructor() {
    this.historyTracker = new SimpleHistoryTracker();
    this.ui = new SimpleUI(this.historyTracker);
    this.initialized = false;
  }

  async startup() {
    if (this.initialized) return;

    try {
      console.log('Research Navigator: Starting up...');
      
      await this.ui.initialize();
      this.registerMenuItems();
      this.setupToolbarButton();
      
      this.initialized = true;
      console.log('Research Navigator: Startup completed');
    } catch (error) {
      console.error('Research Navigator: Startup failed:', error);
    }
  }

  registerMenuItems() {
    try {
      // 只在有document的情况下注册菜单
      if (typeof document !== 'undefined') {
        // 这里可以添加菜单项，但现在保持简单
        console.log('Research Navigator: Menu items registration skipped (simplified version)');
      }
    } catch (error) {
      console.error('Research Navigator: Failed to register menu items:', error);
    }
  }

  setupToolbarButton() {
    try {
      if (typeof document !== 'undefined') {
        // 尝试找到工具栏并添加按钮
        setTimeout(() => {
          const toolbar = document.getElementById('zotero-toolbar') || 
                         document.querySelector('.toolbar') ||
                         document.querySelector('toolbar');
          
          if (toolbar) {
            const button = document.createElement('button');
            button.textContent = '🔍';
            button.title = 'Research Navigator';
            button.style.cssText = `
              padding: 4px 8px;
              margin: 2px;
              border: 1px solid #ccc;
              background: white;
              border-radius: 3px;
              cursor: pointer;
              font-size: 14px;
            `;
            
            button.addEventListener('click', () => this.togglePanel());
            toolbar.appendChild(button);
            
            console.log('Research Navigator: Toolbar button added');
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Research Navigator: Failed to setup toolbar button:', error);
    }
  }

  togglePanel() {
    this.ui.togglePanel();
  }

  showPanel() {
    this.ui.showPanel();
  }

  hidePanel() {
    this.ui.hidePanel();
  }

  clearHistory() {
    this.historyTracker.clearHistory();
    this.ui.loadHistoryData();
  }

  async shutdown() {
    try {
      if (typeof Zotero !== 'undefined' && Zotero.Notifier) {
        Zotero.Notifier.unregisterObserver('researchNavigator');
      }
      
      this.ui.destroy();
      this.initialized = false;
      
      console.log('Research Navigator: Shutdown completed');
    } catch (error) {
      console.error('Research Navigator: Shutdown failed:', error);
    }
  }
}

// 全局实例
let researchNavigatorInstance;

// 全局访问接口
if (typeof window !== 'undefined') {
  window.ResearchNavigator = {
    togglePanel() {
      if (researchNavigatorInstance) {
        researchNavigatorInstance.togglePanel();
      }
    },
    
    showPanel() {
      if (researchNavigatorInstance) {
        researchNavigatorInstance.showPanel();
      }
    },
    
    hidePanel() {
      if (researchNavigatorInstance) {
        researchNavigatorInstance.hidePanel();
      }
    },
    
    clearHistory() {
      if (researchNavigatorInstance) {
        researchNavigatorInstance.clearHistory();
      }
    }
  };
}

// 启动函数
async function startResearchNavigator() {
  try {
    if (!researchNavigatorInstance) {
      researchNavigatorInstance = new SimpleResearchNavigator();
      await researchNavigatorInstance.startup();
    }
  } catch (error) {
    console.error('Research Navigator: Failed to start:', error);
  }
}

// 关闭函数
async function stopResearchNavigator() {
  try {
    if (researchNavigatorInstance) {
      await researchNavigatorInstance.shutdown();
      researchNavigatorInstance = null;
    }
  } catch (error) {
    console.error('Research Navigator: Failed to stop:', error);
  }
}

// 如果在浏览器环境中，延迟启动
if (typeof window !== 'undefined') {
  setTimeout(startResearchNavigator, 2000);
}

console.log('Research Navigator: Simple version loaded');

// 导出用于Node.js环境
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    startResearchNavigator,
    stopResearchNavigator,
    SimpleResearchNavigator
  };
}