/**
 * Zotero API TypeScript Definitions
 * 为 Research Navigator 提供必要的类型定义
 */

declare global {
  const Zotero: ZoteroAPI;
  const window: Window & {
    ResearchNavigator: any;
  };
  
  interface Window {
    ResearchNavigator: any;
  }
}

interface ZoteroAPI {
  initializationPromise: Promise<void>;
  Items: ZoteroItems;
  Collections: ZoteroCollections;
  Reader: ZoteroReader;
  Notifier: ZoteroNotifier;
  Prefs: ZoteroPrefs;
  DB: ZoteroDB;
}

interface ZoteroItems {
  get(id: number): ZoteroItem | null;
  getAll(): ZoteroItem[];
}

interface ZoteroCollections {
  get(id: number): ZoteroCollection | null;
  getAll(): ZoteroCollection[];
}

interface ZoteroReader {
  open(itemID: number, location?: any): Promise<any>;
}

interface ZoteroNotifier {
  registerObserver(observer: any, types: string[], id: string): void;
  unregisterObserver(id: string): void;
}

interface ZoteroPrefs {
  get(key: string): any;
  set(key: string, value: any): void;
}

interface ZoteroDB {
  queryAsync(sql: string, params?: any[]): Promise<any[]>;
  executeTransaction(func: () => Promise<any>): Promise<any>;
}

interface ZoteroItem {
  id: number;
  title: string;
  parentID?: number;
  itemType: string;
  getTags(): ZoteroTag[];
  getCreators(): ZoteroCreator[];
  getField(field: string): string;
  setField(field: string, value: string): void;
  save(): Promise<number>;
}

interface ZoteroCollection {
  id: number;
  name: string;
  parentID?: number;
  getItems(): ZoteroItem[];
  getChildCollections(): ZoteroCollection[];
}

interface ZoteroTag {
  tag: string;
  type?: number;
}

interface ZoteroCreator {
  firstName?: string;
  lastName?: string;
  name?: string;
  creatorType: string;
}

// XUL 元素类型
declare global {
  interface Document {
    createXULElement(tagName: string): XULElement;
  }
}

interface XULElement extends Element {
  setAttribute(name: string, value: string): void;
  style: CSSStyleDeclaration;
}

// 导出空对象以确保这是一个模块
export {};