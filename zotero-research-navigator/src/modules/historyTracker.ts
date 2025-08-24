/**
 * Research Navigator - History Tracker
 * 移植自 Tree Style History 的核心历史跟踪逻辑
 */

const config = {
  prefsPrefix: 'extensions.zotero.researchnavigator'
};

export interface AccessRecord {
  id: string;
  itemType: 'item' | 'note' | 'collection' | 'search';
  itemId: number;
  title: string;
  url?: string;
  timestamp: number;
  duration?: number;
  parentId?: number;
  tags?: string[];
}

export interface HistoryNode {
  id: string;
  title: string;
  itemType: string;
  timestamp: number;
  children?: HistoryNode[];
  parentId?: string;
  accessCount: number;
  lastAccessed: number;
}

export class HistoryTracker {
  private openedItems: Map<string, AccessRecord> = new Map();
  private recentItems: string[] = [];
  private accessHistory: AccessRecord[] = [];
  private maxHistorySize: number = 1000;
  private maxRecentSize: number = 50;

  constructor() {
    this.loadFromStorage();
    this.initializeListeners();
  }

  /**
   * 初始化事件监听器 - 适配 Zotero 事件
   */
  private initializeListeners(): void {
    // 监听条目选择事件
    Zotero.Notifier.registerObserver(this, ['item', 'collection'], 'researchNavigator');
    
    // 监听标签页切换
    if (Zotero.Reader) {
      // 监听 PDF 阅读器事件
      this.setupReaderListeners();
    }

    // 监听搜索事件
    this.setupSearchListeners();
  }

  /**
   * 设置 PDF 阅读器监听器
   */
  private setupReaderListeners(): void {
    // 监听 PDF 阅读器打开/关闭
    const originalOpenReader = Zotero.Reader.open;
    Zotero.Reader.open = (itemID: number, location?: any) => {
      this.onItemOpened('item', itemID);
      return originalOpenReader.call(Zotero.Reader, itemID, location);
    };
  }

  /**
   * 设置搜索监听器
   */
  private setupSearchListeners(): void {
    // 这里可以监听搜索相关事件
    // 具体实现取决于 Zotero 的搜索 API
  }

  /**
   * Zotero Notifier 回调 - 处理数据库事件
   */
  notify(event: string, type: string, ids: number[], extraData: any): void {
    if (event === 'select') {
      for (const id of ids) {
        this.onItemOpened(type as any, id);
      }
    }
  }

  /**
   * 记录条目打开事件 - 核心功能移植自原 openedTab 函数
   */
  onItemOpened(itemType: 'item' | 'collection' | 'search', itemId: number): void {
    const item = this.getZoteroItem(itemType, itemId);
    if (!item) return;

    const recordId = `${itemType}_${itemId}`;
    const timestamp = Date.now();
    
    const record: AccessRecord = {
      id: recordId,
      itemType,
      itemId,
      title: item.title || item.name || 'Untitled',
      timestamp,
      parentId: item.parentID,
      tags: item.getTags ? item.getTags().map((tag: any) => tag.tag) : []
    };

    // 添加到打开的条目映射
    this.openedItems.set(recordId, record);
    
    // 更新最近访问列表 - 移植自原 recentTabs 逻辑
    this.updateRecentItems(recordId);
    
    // 添加到访问历史
    this.addAccessRecord(record);
    
    console.log('Research Navigator: Item opened', record);
  }

  /**
   * 记录条目关闭事件 - 移植自原 closedTab 函数
   */
  onItemClosed(itemType: string, itemId: number): void {
    const recordId = `${itemType}_${itemId}`;
    const openedRecord = this.openedItems.get(recordId);
    
    if (openedRecord) {
      // 计算访问时长
      const duration = Date.now() - openedRecord.timestamp;
      openedRecord.duration = duration;
      
      // 从最近访问列表中移除
      const index = this.recentItems.indexOf(recordId);
      if (index >= 0) {
        this.recentItems.splice(index, 1);
      }
      
      console.log('Research Navigator: Item closed', openedRecord);
    }
  }

  /**
   * 更新最近访问列表 - 移植自原插件逻辑
   */
  private updateRecentItems(recordId: string): void {
    // 如果已存在，先移除
    const existingIndex = this.recentItems.indexOf(recordId);
    if (existingIndex >= 0) {
      this.recentItems.splice(existingIndex, 1);
    }
    
    // 添加到开头
    this.recentItems.unshift(recordId);
    
    // 限制列表大小
    if (this.recentItems.length > this.maxRecentSize) {
      this.recentItems = this.recentItems.slice(0, this.maxRecentSize);
    }
  }

  /**
   * 添加访问记录 - 移植自原 addCloseRecord 函数
   */
  private addAccessRecord(record: AccessRecord): void {
    // 检查是否是有效记录
    if (!record.title || record.title === 'Untitled') return;
    
    this.accessHistory.unshift(record);
    
    // 限制历史记录大小
    if (this.accessHistory.length > this.maxHistorySize) {
      this.accessHistory = this.accessHistory.slice(0, this.maxHistorySize);
    }
    
    // 保存到存储
    this.saveToStorage();
  }

  /**
   * 获取 Zotero 条目信息
   */
  private getZoteroItem(itemType: string, itemId: number): any {
    try {
      switch (itemType) {
        case 'item':
          return Zotero.Items.get(itemId);
        case 'collection':
          return Zotero.Collections.get(itemId);
        default:
          return null;
      }
    } catch (error) {
      console.error('Error getting Zotero item:', error);
      return null;
    }
  }

  /**
   * 构建历史树 - 移植自原 history2.js 的树构建逻辑
   */
  buildHistoryTree(): HistoryNode[] {
    const nodeMap = new Map<string, HistoryNode>();
    const rootNodes: HistoryNode[] = [];
    
    // 按时间分组
    const timeGroups = this.groupByTime(this.accessHistory);
    
    for (const [timeLabel, records] of timeGroups) {
      const timeNode: HistoryNode = {
        id: `time_${timeLabel}`,
        title: timeLabel,
        itemType: 'timeGroup',
        timestamp: records[0]?.timestamp || 0,
        children: [],
        accessCount: records.length,
        lastAccessed: records[0]?.timestamp || 0
      };
      
      // 按类型分组
      const typeGroups = this.groupByType(records);
      
      for (const [itemType, typeRecords] of typeGroups) {
        const typeNode: HistoryNode = {
          id: `${timeLabel}_${itemType}`,
          title: this.getTypeDisplayName(itemType),
          itemType,
          timestamp: typeRecords[0]?.timestamp || 0,
          children: [],
          parentId: timeNode.id,
          accessCount: typeRecords.length,
          lastAccessed: typeRecords[0]?.timestamp || 0
        };
        
        // 添加具体条目
        for (const record of typeRecords) {
          const itemNode: HistoryNode = {
            id: record.id,
            title: record.title,
            itemType: record.itemType,
            timestamp: record.timestamp,
            parentId: typeNode.id,
            accessCount: 1,
            lastAccessed: record.timestamp
          };
          
          typeNode.children!.push(itemNode);
        }
        
        timeNode.children!.push(typeNode);
      }
      
      rootNodes.push(timeNode);
      nodeMap.set(timeNode.id, timeNode);
    }
    
    return rootNodes;
  }

  /**
   * 按时间分组记录
   */
  private groupByTime(records: AccessRecord[]): Map<string, AccessRecord[]> {
    const groups = new Map<string, AccessRecord[]>();
    const now = new Date();
    
    for (const record of records) {
      const recordDate = new Date(record.timestamp);
      let timeLabel: string;
      
      const daysDiff = Math.floor((now.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
      
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
      groups.get(timeLabel)!.push(record);
    }
    
    return groups;
  }

  /**
   * 按类型分组记录
   */
  private groupByType(records: AccessRecord[]): Map<string, AccessRecord[]> {
    const groups = new Map<string, AccessRecord[]>();
    
    for (const record of records) {
      if (!groups.has(record.itemType)) {
        groups.set(record.itemType, []);
      }
      groups.get(record.itemType)!.push(record);
    }
    
    return groups;
  }

  /**
   * 获取类型显示名称
   */
  private getTypeDisplayName(itemType: string): string {
    const typeNames: {[key: string]: string} = {
      item: '📖 文献条目',
      note: '📝 笔记',
      collection: '📁 分类集合',
      search: '🔍 搜索结果'
    };
    return typeNames[itemType] || itemType;
  }

  /**
   * 获取最近访问的条目
   */
  getRecentItems(limit: number = 10): AccessRecord[] {
    return this.recentItems
      .slice(0, limit)
      .map(id => this.openedItems.get(id))
      .filter(record => record !== undefined) as AccessRecord[];
  }

  /**
   * 搜索历史记录 - 移植模糊搜索功能
   */
  searchHistory(query: string): AccessRecord[] {
    if (!query.trim()) return this.accessHistory.slice(0, 50);
    
    const lowerQuery = query.toLowerCase();
    return this.accessHistory.filter(record => 
      record.title.toLowerCase().includes(lowerQuery) ||
      record.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * 从存储加载数据
   */
  private loadFromStorage(): void {
    try {
      const historyData = Zotero.Prefs.get(`${config.prefsPrefix}.accessHistory`);
      if (historyData) {
        this.accessHistory = JSON.parse(historyData);
      }
      
      const recentData = Zotero.Prefs.get(`${config.prefsPrefix}.recentItems`);
      if (recentData) {
        this.recentItems = JSON.parse(recentData);
      }
    } catch (error) {
      console.error('Error loading history from storage:', error);
    }
  }

  /**
   * 保存数据到存储
   */
  private saveToStorage(): void {
    try {
      Zotero.Prefs.set(`${config.prefsPrefix}.accessHistory`, JSON.stringify(this.accessHistory));
      Zotero.Prefs.set(`${config.prefsPrefix}.recentItems`, JSON.stringify(this.recentItems));
    } catch (error) {
      console.error('Error saving history to storage:', error);
    }
  }

  /**
   * 清除历史记录
   */
  clearHistory(): void {
    this.accessHistory = [];
    this.recentItems = [];
    this.openedItems.clear();
    this.saveToStorage();
  }
}