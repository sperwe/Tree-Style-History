/**
 * Research Navigator - Search Engine
 * 移植自 Tree Style History 的模糊搜索功能
 */

import { HistoryNode, AccessRecord } from './historyTracker';

export interface SearchResult {
  id: string;
  title: string;
  type: string;
  highlights: string[];
  score: number;
  timestamp: number;
}

export class SearchEngine {
  private metaCharRegex = /[\[\]\\^$.|?*+()]/g;

  /**
   * 模糊搜索历史记录 - 移植自 fuzzysearch.js
   */
  fuzzySearchHistory(
    query: string, 
    records: AccessRecord[], 
    options: {
      highlightMatches?: boolean;
      maxResults?: number;
      scoreThreshold?: number;
    } = {}
  ): SearchResult[] {
    const { 
      highlightMatches = true, 
      maxResults = 50, 
      scoreThreshold = 0.1 
    } = options;

    if (!query.trim()) {
      return records.slice(0, maxResults).map(record => ({
        id: record.id,
        title: record.title,
        type: record.itemType,
        highlights: [],
        score: 1,
        timestamp: record.timestamp
      }));
    }

    const searchTerm = this.escapeMetaCharacters(query.toLowerCase());
    const regex = new RegExp(searchTerm, 'gi');
    const results: SearchResult[] = [];

    for (const record of records) {
      const score = this.calculateScore(record, query);
      if (score < scoreThreshold) continue;

      const highlights: string[] = [];
      let title = record.title;

      if (highlightMatches) {
        // 高亮匹配的文本
        title = title.replace(regex, (match) => {
          highlights.push(match);
          return `<span class="search-highlight">${match}</span>`;
        });

        // 同时搜索标签
        if (record.tags) {
          for (const tag of record.tags) {
            if (tag.toLowerCase().includes(query.toLowerCase())) {
              highlights.push(tag);
            }
          }
        }
      }

      results.push({
        id: record.id,
        title: highlightMatches ? title : record.title,
        type: record.itemType,
        highlights,
        score,
        timestamp: record.timestamp
      });
    }

    // 按评分排序
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, maxResults);
  }

  /**
   * 树状数据的模糊搜索 - 移植并改进原 ztreeFilter 功能
   */
  filterTreeNodes(
    nodes: HistoryNode[], 
    query: string,
    options: {
      highlightMatches?: boolean;
      expandMatched?: boolean;
    } = {}
  ): HistoryNode[] {
    const { highlightMatches = true, expandMatched = false } = options;

    if (!query.trim()) {
      return this.expandAllNodes(nodes);
    }

    const searchTerm = this.escapeMetaCharacters(query.toLowerCase());
    const filteredNodes: HistoryNode[] = [];

    for (const node of nodes) {
      const filteredNode = this.filterNode(node, searchTerm, highlightMatches);
      if (filteredNode) {
        filteredNodes.push(filteredNode);
      }
    }

    return filteredNodes;
  }

  /**
   * 过滤单个节点
   */
  private filterNode(
    node: HistoryNode, 
    searchTerm: string, 
    highlightMatches: boolean
  ): HistoryNode | null {
    const nodeMatches = this.nodeMatchesQuery(node, searchTerm);
    const filteredChildren: HistoryNode[] = [];

    // 递归过滤子节点
    if (node.children) {
      for (const child of node.children) {
        const filteredChild = this.filterNode(child, searchTerm, highlightMatches);
        if (filteredChild) {
          filteredChildren.push(filteredChild);
        }
      }
    }

    // 如果节点匹配或有匹配的子节点，则保留
    if (nodeMatches || filteredChildren.length > 0) {
      const newNode: HistoryNode = {
        ...node,
        children: filteredChildren.length > 0 ? filteredChildren : undefined
      };

      // 高亮匹配文本
      if (nodeMatches && highlightMatches) {
        newNode.title = this.highlightText(node.title, searchTerm);
      }

      return newNode;
    }

    return null;
  }

  /**
   * 检查节点是否匹配查询
   */
  private nodeMatchesQuery(node: HistoryNode, searchTerm: string): boolean {
    const title = node.title.toLowerCase();
    return title.includes(searchTerm.toLowerCase());
  }

  /**
   * 高亮匹配的文本
   */
  private highlightText(text: string, searchTerm: string): string {
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
  }

  /**
   * 展开所有节点
   */
  private expandAllNodes(nodes: HistoryNode[]): HistoryNode[] {
    return nodes.map(node => ({
      ...node,
      children: node.children ? this.expandAllNodes(node.children) : undefined
    }));
  }

  /**
   * 计算搜索评分
   */
  private calculateScore(record: AccessRecord, query: string): number {
    const title = record.title.toLowerCase();
    const queryLower = query.toLowerCase();
    let score = 0;

    // 完全匹配得分最高
    if (title === queryLower) {
      score += 1.0;
    }
    // 开始匹配得分较高
    else if (title.startsWith(queryLower)) {
      score += 0.8;
    }
    // 包含匹配
    else if (title.includes(queryLower)) {
      score += 0.6;
    }

    // 标签匹配
    if (record.tags) {
      for (const tag of record.tags) {
        if (tag.toLowerCase().includes(queryLower)) {
          score += 0.4;
        }
      }
    }

    // 最近访问的项目得分更高
    const daysSinceAccess = (Date.now() - record.timestamp) / (1000 * 60 * 60 * 24);
    if (daysSinceAccess < 1) {
      score += 0.3;
    } else if (daysSinceAccess < 7) {
      score += 0.2;
    } else if (daysSinceAccess < 30) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * 转义正则表达式元字符
   */
  private escapeMetaCharacters(text: string): string {
    return text.replace(this.metaCharRegex, '\\$&');
  }

  /**
   * 智能建议 - 基于历史记录提供搜索建议
   */
  getSuggestions(
    query: string, 
    records: AccessRecord[], 
    limit: number = 5
  ): string[] {
    if (!query.trim()) return [];

    const suggestions = new Set<string>();
    const queryLower = query.toLowerCase();

    // 从标题中提取建议
    for (const record of records) {
      const words = record.title.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.startsWith(queryLower) && word.length > query.length) {
          suggestions.add(word);
          if (suggestions.size >= limit) break;
        }
      }
      if (suggestions.size >= limit) break;
    }

    // 从标签中提取建议
    for (const record of records) {
      if (record.tags) {
        for (const tag of record.tags) {
          if (tag.toLowerCase().startsWith(queryLower)) {
            suggestions.add(tag);
            if (suggestions.size >= limit) break;
          }
        }
      }
      if (suggestions.size >= limit) break;
    }

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * 高级搜索 - 支持多种搜索条件
   */
  advancedSearch(
    records: AccessRecord[],
    criteria: {
      title?: string;
      tags?: string[];
      itemType?: string;
      dateRange?: { start: Date; end: Date };
      minScore?: number;
    }
  ): SearchResult[] {
    let filteredRecords = records;

    // 按条目类型过滤
    if (criteria.itemType) {
      filteredRecords = filteredRecords.filter(
        record => record.itemType === criteria.itemType
      );
    }

    // 按日期范围过滤
    if (criteria.dateRange) {
      filteredRecords = filteredRecords.filter(
        record => record.timestamp >= criteria.dateRange!.start.getTime() &&
                  record.timestamp <= criteria.dateRange!.end.getTime()
      );
    }

    // 按标签过滤
    if (criteria.tags && criteria.tags.length > 0) {
      filteredRecords = filteredRecords.filter(
        record => record.tags?.some(tag => 
          criteria.tags!.some(searchTag => 
            tag.toLowerCase().includes(searchTag.toLowerCase())
          )
        )
      );
    }

    // 按标题搜索
    if (criteria.title) {
      return this.fuzzySearchHistory(criteria.title, filteredRecords, {
        scoreThreshold: criteria.minScore || 0.1
      });
    }

    // 转换为搜索结果格式
    return filteredRecords.map(record => ({
      id: record.id,
      title: record.title,
      type: record.itemType,
      highlights: [],
      score: 1,
      timestamp: record.timestamp
    }));
  }
}