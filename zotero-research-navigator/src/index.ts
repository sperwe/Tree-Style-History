/**
 * Research Navigator - Main Entry Point
 * Zotero插件主入口文件
 */

import { HistoryTracker } from './modules/historyTracker';
import { SearchEngine } from './modules/searchEngine';
import { ResearchNavigatorUI } from './ui/mainUI';
import { config } from "../package.json";

class ResearchNavigator {
  private historyTracker: HistoryTracker;
  private searchEngine: SearchEngine;
  private ui: ResearchNavigatorUI;
  private initialized: boolean = false;

  constructor() {
    this.historyTracker = new HistoryTracker();
    this.searchEngine = new SearchEngine();
    this.ui = new ResearchNavigatorUI(this.historyTracker, this.searchEngine);
  }

  /**
   * 插件启动时调用
   */
  async startup(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('Research Navigator: Starting up...');
      
      // 初始化UI
      await this.ui.initialize();
      
      // 注册菜单项
      this.registerMenuItems();
      
      // 注册快捷键
      this.registerShortcuts();
      
      // 设置工具栏按钮
      this.setupToolbarButton();
      
      this.initialized = true;
      console.log('Research Navigator: Startup completed');
      
    } catch (error) {
      console.error('Research Navigator: Startup failed', error);
    }
  }

  /**
   * 插件关闭时调用
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    try {
      console.log('Research Navigator: Shutting down...');
      
      // 清理UI
      await this.ui.destroy();
      
      // 注销事件监听器
      Zotero.Notifier.unregisterObserver('researchNavigator');
      
      this.initialized = false;
      console.log('Research Navigator: Shutdown completed');
      
    } catch (error) {
      console.error('Research Navigator: Shutdown failed', error);
    }
  }

  /**
   * 注册菜单项
   */
  private registerMenuItems(): void {
    // 添加到工具菜单
    const menuItem = document.createXULElement('menuitem');
    menuItem.setAttribute('id', 'research-navigator-menu');
    menuItem.setAttribute('label', 'Research Navigator');
    menuItem.setAttribute('oncommand', 'ResearchNavigator.togglePanel()');
    
    const toolsMenu = document.getElementById('menu_ToolsPopup');
    if (toolsMenu) {
      toolsMenu.appendChild(menuItem);
    }

    // 添加到视图菜单
    const viewMenuItem = document.createXULElement('menuitem');
    viewMenuItem.setAttribute('id', 'research-navigator-view-menu');
    viewMenuItem.setAttribute('label', 'Research History Panel');
    viewMenuItem.setAttribute('type', 'checkbox');
    viewMenuItem.setAttribute('oncommand', 'ResearchNavigator.togglePanel()');
    
    const viewMenu = document.getElementById('menu_ViewPopup');
    if (viewMenu) {
      viewMenu.appendChild(viewMenuItem);
    }
  }

  /**
   * 注册快捷键
   */
  private registerShortcuts(): void {
    // Ctrl+Shift+H 打开历史面板
    const shortcut = document.createXULElement('key');
    shortcut.setAttribute('id', 'research-navigator-shortcut');
    shortcut.setAttribute('key', 'H');
    shortcut.setAttribute('modifiers', 'accel shift');
    shortcut.setAttribute('oncommand', 'ResearchNavigator.togglePanel()');
    
    const keyset = document.getElementById('mainKeyset');
    if (keyset) {
      keyset.appendChild(shortcut);
    }
  }

  /**
   * 设置工具栏按钮
   */
  private setupToolbarButton(): void {
    const button = document.createXULElement('toolbarbutton');
    button.setAttribute('id', 'research-navigator-button');
    button.setAttribute('class', 'zotero-tb-button');
    button.setAttribute('tooltiptext', 'Research Navigator');
    button.setAttribute('oncommand', 'ResearchNavigator.togglePanel()');
    
    // 设置图标
    button.style.listStyleImage = 'url("chrome://research-navigator/skin/icon.png")';
    
    const toolbar = document.getElementById('zotero-toolbar');
    if (toolbar) {
      toolbar.appendChild(button);
    }
  }

  /**
   * 切换面板显示/隐藏
   */
  togglePanel(): void {
    this.ui.togglePanel();
  }

  /**
   * 显示历史面板
   */
  showPanel(): void {
    this.ui.showPanel();
  }

  /**
   * 隐藏历史面板
   */
  hidePanel(): void {
    this.ui.hidePanel();
  }

  /**
   * 获取历史跟踪器实例
   */
  getHistoryTracker(): HistoryTracker {
    return this.historyTracker;
  }

  /**
   * 获取搜索引擎实例
   */
  getSearchEngine(): SearchEngine {
    return this.searchEngine;
  }

  /**
   * 清除所有历史记录
   */
  clearHistory(): void {
    this.historyTracker.clearHistory();
    this.ui.refreshView();
  }
}

// 全局实例
let researchNavigatorInstance: ResearchNavigator;

// 全局访问接口
window.ResearchNavigator = {
  togglePanel(): void {
    if (researchNavigatorInstance) {
      researchNavigatorInstance.togglePanel();
    }
  },
  
  showPanel(): void {
    if (researchNavigatorInstance) {
      researchNavigatorInstance.showPanel();
    }
  },
  
  hidePanel(): void {
    if (researchNavigatorInstance) {
      researchNavigatorInstance.hidePanel();
    }
  },
  
  clearHistory(): void {
    if (researchNavigatorInstance) {
      researchNavigatorInstance.clearHistory();
    }
  }
};

// Zotero 插件生命周期钩子
export async function install(data: any, reason: any): Promise<void> {
  console.log('Research Navigator: Installing...');
}

export async function startup(data: any, reason: any): Promise<void> {
  console.log('Research Navigator: Starting...');
  
  // 等待 Zotero 完全加载
  await Zotero.initializationPromise;
  
  // 创建插件实例
  researchNavigatorInstance = new ResearchNavigator();
  
  // 启动插件
  await researchNavigatorInstance.startup();
}

export async function shutdown(data: any, reason: any): Promise<void> {
  console.log('Research Navigator: Shutting down...');
  
  if (researchNavigatorInstance) {
    await researchNavigatorInstance.shutdown();
  }
}

export async function uninstall(data: any, reason: any): Promise<void> {
  console.log('Research Navigator: Uninstalling...');
  
  // 清理数据（可选）
  if (reason === 'ADDON_UNINSTALL') {
    const shouldClearData = confirm('是否清除 Research Navigator 的所有数据？');
    if (shouldClearData && researchNavigatorInstance) {
      researchNavigatorInstance.clearHistory();
    }
  }
}

// 类型声明
declare global {
  interface Window {
    ResearchNavigator: {
      togglePanel(): void;
      showPanel(): void;
      hidePanel(): void;
      clearHistory(): void;
    };
  }
}