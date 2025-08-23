/**
 * Research Navigator - History Tree View Component
 * 结合树状视图和卡片预览的主要界面组件
 */

import React, { useState, useEffect, useCallback } from 'react';
import { HistoryNode, AccessRecord } from '../modules/historyTracker';
import { SearchEngine, SearchResult } from '../modules/searchEngine';

interface HistoryTreeViewProps {
  historyData: HistoryNode[];
  onItemSelected?: (item: AccessRecord) => void;
  onItemOpened?: (item: AccessRecord) => void;
  searchEngine: SearchEngine;
}

interface TreeNodeProps {
  node: HistoryNode;
  depth: number;
  expanded: boolean;
  onToggle: (nodeId: string) => void;
  onSelect: (node: HistoryNode) => void;
  selectedId?: string;
}

export const HistoryTreeView: React.FC<HistoryTreeViewProps> = ({
  historyData,
  onItemSelected,
  onItemOpened,
  searchEngine
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredData, setFilteredData] = useState<HistoryNode[]>(historyData);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<HistoryNode | null>(null);
  const [showCardPreview, setShowCardPreview] = useState(true);

  // 搜索建议
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // 更新过滤的数据
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = searchEngine.filterTreeNodes(historyData, searchQuery, {
        highlightMatches: true,
        expandMatched: true
      });
      setFilteredData(filtered);
      
      // 自动展开搜索结果
      const newExpanded = new Set<string>();
      const expandSearchResults = (nodes: HistoryNode[]) => {
        nodes.forEach(node => {
          newExpanded.add(node.id);
          if (node.children) {
            expandSearchResults(node.children);
          }
        });
      };
      expandSearchResults(filtered);
      setExpandedNodes(newExpanded);
    } else {
      setFilteredData(historyData);
    }
  }, [searchQuery, historyData, searchEngine]);

  // 搜索建议
  useEffect(() => {
    if (searchQuery.trim()) {
      // 这里需要从historyData提取AccessRecord数组
      const records = extractAccessRecords(historyData);
      const newSuggestions = searchEngine.getSuggestions(searchQuery, records);
      setSuggestions(newSuggestions);
    } else {
      setSuggestions([]);
    }
  }, [searchQuery, historyData, searchEngine]);

  const handleToggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(nodeId)) {
        newExpanded.delete(nodeId);
      } else {
        newExpanded.add(nodeId);
      }
      return newExpanded;
    });
  }, []);

  const handleSelectNode = useCallback((node: HistoryNode) => {
    setSelectedNode(node);
    if (onItemSelected && node.itemType !== 'timeGroup') {
      // 构造AccessRecord格式
      const accessRecord: AccessRecord = {
        id: node.id,
        itemType: node.itemType as any,
        itemId: parseInt(node.id.split('_')[1]) || 0,
        title: node.title,
        timestamp: node.timestamp,
        tags: []
      };
      onItemSelected(accessRecord);
    }
  }, [onItemSelected]);

  const handleDoubleClick = useCallback((node: HistoryNode) => {
    if (onItemOpened && node.itemType !== 'timeGroup') {
      const accessRecord: AccessRecord = {
        id: node.id,
        itemType: node.itemType as any,
        itemId: parseInt(node.id.split('_')[1]) || 0,
        title: node.title,
        timestamp: node.timestamp,
        tags: []
      };
      onItemOpened(accessRecord);
    }
  }, [onItemOpened]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowSuggestions(value.trim().length > 0);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
  };

  return (
    <div className="history-tree-container">
      {/* 搜索栏 */}
      <div className="search-container">
        <div className="search-input-wrapper">
          <input
            type="text"
            placeholder="搜索历史记录..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="search-input"
            onFocus={() => setShowSuggestions(searchQuery.trim().length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          />
          <button 
            className="search-clear"
            onClick={() => setSearchQuery('')}
            style={{ display: searchQuery ? 'block' : 'none' }}
          >
            ✕
          </button>
        </div>
        
        {/* 搜索建议 */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="search-suggestions">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="suggestion-item"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="main-content">
        {/* 左侧：树状视图 */}
        <div className="tree-panel">
          <div className="tree-header">
            <h3>访问历史</h3>
            <div className="tree-controls">
              <button
                onClick={() => setExpandedNodes(new Set())}
                className="control-btn"
                title="折叠全部"
              >
                📁
              </button>
              <button
                onClick={() => {
                  const allNodes = new Set<string>();
                  const collectIds = (nodes: HistoryNode[]) => {
                    nodes.forEach(node => {
                      allNodes.add(node.id);
                      if (node.children) collectIds(node.children);
                    });
                  };
                  collectIds(filteredData);
                  setExpandedNodes(allNodes);
                }}
                className="control-btn"
                title="展开全部"
              >
                📂
              </button>
            </div>
          </div>
          
          <div className="tree-content">
            {filteredData.length > 0 ? (
              filteredData.map(node => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  expanded={expandedNodes.has(node.id)}
                  onToggle={handleToggleNode}
                  onSelect={handleSelectNode}
                  selectedId={selectedNode?.id}
                />
              ))
            ) : (
              <div className="empty-state">
                {searchQuery ? '未找到匹配的记录' : '暂无访问历史'}
              </div>
            )}
          </div>
        </div>

        {/* 右侧：卡片预览 */}
        {showCardPreview && selectedNode && (
          <div className="card-preview-panel">
            <CardPreview 
              node={selectedNode}
              onClose={() => setShowCardPreview(false)}
              onOpen={() => handleDoubleClick(selectedNode)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// 树节点组件
const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  depth,
  expanded,
  onToggle,
  onSelect,
  selectedId
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  const handleClick = () => {
    onSelect(node);
    if (hasChildren) {
      onToggle(node.id);
    }
  };

  const getNodeIcon = (itemType: string) => {
    switch (itemType) {
      case 'timeGroup': return '📅';
      case 'item': return '📖';
      case 'note': return '📝';
      case 'collection': return '📁';
      case 'search': return '🔍';
      default: return '📄';
    }
  };

  const getNodeClass = () => {
    let className = 'tree-node';
    if (isSelected) className += ' selected';
    if (node.itemType === 'timeGroup') className += ' time-group';
    return className;
  };

  return (
    <div className="tree-node-container">
      <div
        className={getNodeClass()}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={handleClick}
      >
        <span className="node-toggle">
          {hasChildren ? (expanded ? '▼' : '▶') : '　'}
        </span>
        <span className="node-icon">{getNodeIcon(node.itemType)}</span>
        <span 
          className="node-title"
          dangerouslySetInnerHTML={{ __html: node.title }}
        />
        <span className="node-meta">
          <span className="access-count">({node.accessCount})</span>
          <span className="timestamp">
            {new Date(node.lastAccessed).toLocaleTimeString()}
          </span>
        </span>
      </div>
      
      {hasChildren && expanded && (
        <div className="tree-children">
          {node.children!.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// 卡片预览组件 - 借鉴ZotCard的设计思路
interface CardPreviewProps {
  node: HistoryNode;
  onClose: () => void;
  onOpen: () => void;
}

const CardPreview: React.FC<CardPreviewProps> = ({ node, onClose, onOpen }) => {
  const getCardTypeClass = (itemType: string) => {
    return `card-preview ${itemType}-card`;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className={getCardTypeClass(node.itemType)}>
      <div className="card-header">
        <h4>项目预览</h4>
        <button onClick={onClose} className="close-btn">×</button>
      </div>
      
      <div className="card-content">
        <div className="card-title" title={node.title}>
          {node.title}
        </div>
        
        <div className="card-meta">
          <div className="meta-item">
            <span className="meta-label">类型:</span>
            <span className="meta-value">{getTypeDisplayName(node.itemType)}</span>
          </div>
          
          <div className="meta-item">
            <span className="meta-label">访问次数:</span>
            <span className="meta-value">{node.accessCount}</span>
          </div>
          
          <div className="meta-item">
            <span className="meta-label">最后访问:</span>
            <span className="meta-value">{formatTimestamp(node.lastAccessed)}</span>
          </div>
        </div>
        
        <div className="card-actions">
          <button onClick={onOpen} className="primary-btn">
            打开项目
          </button>
          <button className="secondary-btn">
            查看详情
          </button>
        </div>
      </div>
    </div>
  );
};

// 辅助函数
function extractAccessRecords(nodes: HistoryNode[]): AccessRecord[] {
  const records: AccessRecord[] = [];
  
  const extractFromNode = (node: HistoryNode) => {
    if (node.itemType !== 'timeGroup') {
      records.push({
        id: node.id,
        itemType: node.itemType as any,
        itemId: parseInt(node.id.split('_')[1]) || 0,
        title: node.title,
        timestamp: node.timestamp,
        tags: []
      });
    }
    
    if (node.children) {
      node.children.forEach(extractFromNode);
    }
  };
  
  nodes.forEach(extractFromNode);
  return records;
}

function getTypeDisplayName(itemType: string): string {
  const typeNames = {
    item: '文献条目',
    note: '笔记',
    collection: '分类集合',
    search: '搜索结果',
    timeGroup: '时间分组'
  };
  return typeNames[itemType] || itemType;
}