/**
 * Research Navigator - Main UI Controller
 * 处理 Zotero 界面集成和面板管理
 */

import { HistoryTracker } from '../modules/historyTracker';
import { SearchEngine } from '../modules/searchEngine';

export class ResearchNavigatorUI {
  private historyTracker: HistoryTracker;
  private searchEngine: SearchEngine;
  private panel: HTMLElement | null = null;
  private isVisible: boolean = false;

  constructor(historyTracker: HistoryTracker, searchEngine: SearchEngine) {
    this.historyTracker = historyTracker;
    this.searchEngine = searchEngine;
  }

  /**
   * 初始化UI
   */
  async initialize(): Promise<void> {
    try {
      // 等待Zotero完全加载
      await this.waitForZoteroReady();
      
      // 创建侧边栏面板
      this.createSidebarPanel();
      
      // 初始化React组件
      await this.initializeReactComponent();
      
      console.log('Research Navigator UI initialized');
    } catch (error) {
      console.error('Failed to initialize Research Navigator UI:', error);
    }
  }

  /**
   * 等待Zotero准备完成
   */
  private async waitForZoteroReady(): Promise<void> {
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
    
    throw new Error('Zotero not ready after maximum attempts');
  }

  /**
   * 创建侧边栏面板
   */
  private createSidebarPanel(): void {
    try {
      // 获取Zotero主窗口
      const doc = document;
      
      // 查找合适的容器
      let container = doc.getElementById('zotero-pane') || 
                     doc.getElementById('zotero-layout') ||
                     doc.querySelector('#zotero-main-window') ||
                     doc.body;

      if (!container) {
        console.warn('Could not find suitable container, using body');
        container = doc.body;
      }

      // 创建面板容器
      this.panel = doc.createElement('div');
      this.panel.id = 'research-navigator-panel';
      this.panel.className = 'research-navigator-sidebar';
      
      // 设置面板样式
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
      `;

      // 添加面板内容容器
      const content = doc.createElement('div');
      content.id = 'research-navigator-content';
      content.style.cssText = `
        width: 100%;
        height: 100%;
        padding: 0;
        margin: 0;
      `;

      this.panel.appendChild(content);
      container.appendChild(this.panel);

      console.log('Sidebar panel created successfully');
    } catch (error) {
      console.error('Failed to create sidebar panel:', error);
    }
  }

  /**
   * 初始化React组件
   */
  private async initializeReactComponent(): Promise<void> {
    if (!this.panel) {
      throw new Error('Panel not created');
    }

    const content = this.panel.querySelector('#research-navigator-content');
    if (!content) {
      throw new Error('Content container not found');
    }

    // 创建简化版的历史视图（不依赖React）
    this.createSimpleHistoryView(content as HTMLElement);
  }

  /**
   * 创建简化版历史视图
   */
  private createSimpleHistoryView(container: HTMLElement): void {
    container.innerHTML = `
      <div class="research-navigator-header">
        <h3>Research Navigator</h3>
        <button id="rn-close-btn" style="float: right; background: none; border: none; font-size: 18px; cursor: pointer;">×</button>
      </div>
      
      <div class="research-navigator-search">
        <input type="text" id="rn-search-input" placeholder="搜索历史记录..." style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
      </div>
      
      <div class="research-navigator-controls">
        <button id="rn-expand-all">展开全部</button>
        <button id="rn-collapse-all">折叠全部</button>
        <button id="rn-clear-history">清除历史</button>
      </div>
      
      <div id="rn-history-list" class="research-navigator-list">
        <div class="loading">加载历史记录...</div>
      </div>
      
      <style>
        .research-navigator-header {
          padding: 16px;
          border-bottom: 1px solid #eee;
          background: #f8f9fa;
        }
        .research-navigator-header h3 {
          margin: 0;
          font-size: 16px;
          color: #333;
        }
        .research-navigator-search {
          padding: 16px;
          border-bottom: 1px solid #eee;
        }
        .research-navigator-controls {
          padding: 8px 16px;
          border-bottom: 1px solid #eee;
          display: flex;
          gap: 8px;
        }
        .research-navigator-controls button {
          padding: 4px 8px;
          border: 1px solid #ccc;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }
        .research-navigator-controls button:hover {
          background: #f0f0f0;
        }
        .research-navigator-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }
        .history-item {
          padding: 8px;
          border-bottom: 1px solid #eee;
          cursor: pointer;
          border-radius: 4px;
          margin-bottom: 4px;
        }
        .history-item:hover {
          background: #f0f0f0;
        }
        .history-item-title {
          font-weight: 500;
          color: #333;
          margin-bottom: 4px;
        }
        .history-item-meta {
          font-size: 12px;
          color: #666;
        }
        .history-group {
          margin-bottom: 16px;
        }
        .history-group-title {
          font-weight: 600;
          padding: 8px 0;
          color: #555;
          border-bottom: 1px solid #ddd;
          margin-bottom: 8px;
          cursor: pointer;
        }
        .loading {
          text-align: center;
          color: #666;
          padding: 20px;
        }
      </style>
    `;

    // 添加事件监听器
    this.setupEventListeners();
    
    // 加载历史数据
    this.loadHistoryData();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.panel) return;

    // 关闭按钮
    const closeBtn = this.panel.querySelector('#rn-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hidePanel());
    }

    // 搜索输入
    const searchInput = this.panel.querySelector('#rn-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value;
        this.handleSearch(query);
      });
    }

    // 控制按钮
    const expandBtn = this.panel.querySelector('#rn-expand-all');
    const collapseBtn = this.panel.querySelector('#rn-collapse-all');
    const clearBtn = this.panel.querySelector('#rn-clear-history');

    if (expandBtn) {
      expandBtn.addEventListener('click', () => this.expandAll());
    }
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => this.collapseAll());
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearHistory());
    }
  }

  /**
   * 加载历史数据
   */
  private async loadHistoryData(): Promise<void> {
    try {
      const historyTree = this.historyTracker.buildHistoryTree();
      this.renderHistoryTree(historyTree);
    } catch (error) {
      console.error('Failed to load history data:', error);
      this.showError('加载历史数据失败');
    }
  }

  /**
   * 渲染历史树
   */
  private renderHistoryTree(historyTree: any[]): void {
    const container = this.panel?.querySelector('#rn-history-list');
    if (!container) return;

    if (historyTree.length === 0) {
      container.innerHTML = '<div class="loading">暂无访问历史</div>';
      return;
    }

    let html = '';
    
    for (const timeGroup of historyTree) {
      html += `
        <div class="history-group">
          <div class="history-group-title" data-group="${timeGroup.id}">
            📅 ${timeGroup.title} (${timeGroup.accessCount})
          </div>
          <div class="history-group-items" id="group-${timeGroup.id}">
      `;
      
      if (timeGroup.children) {
        for (const typeGroup of timeGroup.children) {
          html += `<div class="history-type-group">`;
          html += `<div class="history-item-title">${typeGroup.title}</div>`;
          
          if (typeGroup.children) {
            for (const item of typeGroup.children) {
              html += `
                <div class="history-item" data-item-id="${item.id}">
                  <div class="history-item-title">${item.title}</div>
                  <div class="history-item-meta">
                    访问次数: ${item.accessCount} | 
                    最后访问: ${new Date(item.lastAccessed).toLocaleString()}
                  </div>
                </div>
              `;
            }
          }
          html += `</div>`;
        }
      }
      
      html += `
          </div>
        </div>
      `;
    }

    container.innerHTML = html;

    // 添加项目点击事件
    container.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const itemId = (e.currentTarget as HTMLElement).dataset.itemId;
        if (itemId) {
          this.handleItemClick(itemId);
        }
      });
    });

    // 添加分组切换事件
    container.querySelectorAll('.history-group-title').forEach(title => {
      title.addEventListener('click', (e) => {
        const groupId = (e.currentTarget as HTMLElement).dataset.group;
        if (groupId) {
          this.toggleGroup(groupId);
        }
      });
    });
  }

  /**
   * 处理项目点击
   */
  private handleItemClick(itemId: string): void {
    console.log('Opening item:', itemId);
    
    // 解析itemId获取实际的Zotero条目ID
    const parts = itemId.split('_');
    if (parts.length >= 2) {
      const itemType = parts[0];
      const zoteroId = parseInt(parts[1]);
      
      try {
        if (itemType === 'item' && zoteroId) {
          // 打开Zotero条目
          if (Zotero.Reader) {
            Zotero.Reader.open(zoteroId);
          }
        }
      } catch (error) {
        console.error('Failed to open item:', error);
      }
    }
  }

  /**
   * 处理搜索
   */
  private handleSearch(query: string): void {
    // 简化的搜索实现
    const items = this.panel?.querySelectorAll('.history-item');
    items?.forEach(item => {
      const title = item.querySelector('.history-item-title')?.textContent || '';
      const isMatch = title.toLowerCase().includes(query.toLowerCase());
      (item as HTMLElement).style.display = isMatch ? 'block' : 'none';
    });
  }

  /**
   * 展开所有分组
   */
  private expandAll(): void {
    const groups = this.panel?.querySelectorAll('.history-group-items');
    groups?.forEach(group => {
      (group as HTMLElement).style.display = 'block';
    });
  }

  /**
   * 折叠所有分组
   */
  private collapseAll(): void {
    const groups = this.panel?.querySelectorAll('.history-group-items');
    groups?.forEach(group => {
      (group as HTMLElement).style.display = 'none';
    });
  }

  /**
   * 切换分组显示
   */
  private toggleGroup(groupId: string): void {
    const group = this.panel?.querySelector(`#group-${groupId}`) as HTMLElement;
    if (group) {
      group.style.display = group.style.display === 'none' ? 'block' : 'none';
    }
  }

  /**
   * 清除历史
   */
  private clearHistory(): void {
    if (confirm('确定要清除所有历史记录吗？')) {
      this.historyTracker.clearHistory();
      this.loadHistoryData();
    }
  }

  /**
   * 显示错误信息
   */
  private showError(message: string): void {
    const container = this.panel?.querySelector('#rn-history-list');
    if (container) {
      container.innerHTML = `<div class="loading" style="color: #dc3545;">${message}</div>`;
    }
  }

  /**
   * 显示面板
   */
  showPanel(): void {
    if (this.panel) {
      this.panel.style.right = '0px';
      this.isVisible = true;
      this.loadHistoryData(); // 刷新数据
    }
  }

  /**
   * 隐藏面板
   */
  hidePanel(): void {
    if (this.panel) {
      this.panel.style.right = '-400px';
      this.isVisible = false;
    }
  }

  /**
   * 切换面板显示
   */
  togglePanel(): void {
    if (this.isVisible) {
      this.hidePanel();
    } else {
      this.showPanel();
    }
  }

  /**
   * 刷新视图
   */
  refreshView(): void {
    if (this.isVisible) {
      this.loadHistoryData();
    }
  }

  /**
   * 销毁UI
   */
  async destroy(): Promise<void> {
    try {
      if (this.panel) {
        this.panel.remove();
        this.panel = null;
      }
      this.isVisible = false;
      console.log('Research Navigator UI destroyed');
    } catch (error) {
      console.error('Failed to destroy Research Navigator UI:', error);
    }
  }
}