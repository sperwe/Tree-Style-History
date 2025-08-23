/**
 * 权限管理模块
 * 负责验证用户操作权限和实施安全限制
 */

class PermissionManager {
    // 操作频率限制配置（毫秒）
    static RATE_LIMITS = {
        'save': 500,        // 保存操作：500ms间隔
        'delete': 2000,     // 删除操作：2秒间隔
        'export': 5000,     // 导出操作：5秒间隔
        'search': 300,      // 搜索操作：300ms间隔
        'copy': 100,        // 复制操作：100ms间隔
        'create': 1000,     // 创建操作：1秒间隔
        'batch': 10000      // 批量操作：10秒间隔
    };

    // 操作权限级别
    static PERMISSION_LEVELS = {
        'READ': 1,          // 读取权限
        'WRITE': 2,         // 写入权限
        'DELETE': 3,        // 删除权限
        'ADMIN': 4          // 管理员权限
    };

    // 当前用户权限级别（扩展内默认为管理员）
    static currentPermissionLevel = PermissionManager.PERMISSION_LEVELS.ADMIN;

    /**
     * 检查操作权限
     * @param {string} operation - 操作类型
     * @param {string} noteId - 笔记ID（可选）
     * @returns {Promise<boolean>} 是否有权限
     */
    static async checkOperationPermission(operation, noteId = null) {
        try {
            // 基础权限检查
            if (!this.hasBasicPermission(operation)) {
                console.warn(`权限不足，无法执行操作: ${operation}`);
                return false;
            }

            // 频率限制检查
            if (!this.checkRateLimit(operation)) {
                console.warn(`操作过于频繁: ${operation}`);
                return false;
            }

            // 特定操作的额外检查
            switch (operation) {
                case 'update':
                    return await this.checkUpdatePermission(noteId);
                case 'delete':
                    return await this.checkDeletePermission(noteId);
                case 'export':
                    return await this.checkExportPermission();
                case 'import':
                    return await this.checkImportPermission();
                case 'batch':
                    return await this.checkBatchPermission();
                default:
                    return true;
            }
        } catch (error) {
            console.error('权限检查失败:', error);
            return false;
        }
    }

    /**
     * 检查基础权限
     * @param {string} operation - 操作类型
     * @returns {boolean} 是否有基础权限
     */
    static hasBasicPermission(operation) {
        const requiredLevels = {
            'read': this.PERMISSION_LEVELS.READ,
            'search': this.PERMISSION_LEVELS.read,
            'copy': this.PERMISSION_LEVELS.READ,
            'create': this.PERMISSION_LEVELS.WRITE,
            'update': this.PERMISSION_LEVELS.WRITE,
            'save': this.PERMISSION_LEVELS.WRITE,
            'delete': this.PERMISSION_LEVELS.DELETE,
            'export': this.PERMISSION_LEVELS.WRITE,
            'import': this.PERMISSION_LEVELS.WRITE,
            'batch': this.PERMISSION_LEVELS.ADMIN
        };

        const requiredLevel = requiredLevels[operation] || this.PERMISSION_LEVELS.READ;
        return this.currentPermissionLevel >= requiredLevel;
    }

    /**
     * 频率限制检查
     * @param {string} operation - 操作类型
     * @returns {boolean} 是否通过频率检查
     */
    static checkRateLimit(operation) {
        const now = Date.now();
        const key = `rateLimit_${operation}`;
        const lastTime = localStorage.getItem(key);
        const limitMs = this.RATE_LIMITS[operation] || 1000;

        if (lastTime && (now - parseInt(lastTime)) < limitMs) {
            return false;
        }

        localStorage.setItem(key, now.toString());
        return true;
    }

    /**
     * 检查更新权限
     * @param {string} noteId - 笔记ID
     * @returns {Promise<boolean>} 是否有更新权限
     */
    static async checkUpdatePermission(noteId) {
        if (!noteId) {
            return true; // 新建笔记
        }

        try {
            // 检查笔记是否存在
            const note = await this.getNoteById(noteId);
            if (!note) {
                console.warn(`笔记不存在: ${noteId}`);
                return false;
            }

            // 检查是否为只读笔记（如果有此属性）
            if (note.readonly) {
                console.warn(`笔记为只读: ${noteId}`);
                return false;
            }

            return true;
        } catch (error) {
            console.error('检查更新权限失败:', error);
            return false;
        }
    }

    /**
     * 检查删除权限
     * @param {string} noteId - 笔记ID
     * @returns {Promise<boolean>} 是否有删除权限
     */
    static async checkDeletePermission(noteId) {
        if (!noteId) {
            return false;
        }

        try {
            const note = await this.getNoteById(noteId);
            if (!note) {
                return false;
            }

            // 检查是否为受保护的笔记
            if (note.protected) {
                console.warn(`受保护的笔记不能删除: ${noteId}`);
                return false;
            }

            // 添加确认机制
            return await this.confirmDeletion(note);
        } catch (error) {
            console.error('检查删除权限失败:', error);
            return false;
        }
    }

    /**
     * 检查导出权限
     * @returns {Promise<boolean>} 是否有导出权限
     */
    static async checkExportPermission() {
        // 检查是否有pending的导出操作
        const pendingExports = localStorage.getItem('pendingExports');
        if (pendingExports && parseInt(pendingExports) > 0) {
            console.warn('有正在进行的导出操作');
            return false;
        }

        // 检查存储空间
        const usage = await this.getStorageUsage();
        if (usage.quota && usage.usage > usage.quota * 0.9) {
            console.warn('存储空间不足，无法导出');
            return false;
        }

        return true;
    }

    /**
     * 检查导入权限
     * @returns {Promise<boolean>} 是否有导入权限
     */
    static async checkImportPermission() {
        // 检查存储空间
        const usage = await this.getStorageUsage();
        if (usage.quota && usage.usage > usage.quota * 0.8) {
            console.warn('存储空间不足，无法导入');
            return false;
        }

        return true;
    }

    /**
     * 检查批量操作权限
     * @returns {Promise<boolean>} 是否有批量操作权限
     */
    static async checkBatchPermission() {
        // 检查是否有其他批量操作正在进行
        const batchLock = localStorage.getItem('batchOperationLock');
        if (batchLock) {
            const lockTime = parseInt(batchLock);
            if (Date.now() - lockTime < 30000) { // 30秒锁定
                console.warn('有其他批量操作正在进行');
                return false;
            }
        }

        return true;
    }

    /**
     * 设置批量操作锁
     */
    static setBatchOperationLock() {
        localStorage.setItem('batchOperationLock', Date.now().toString());
    }

    /**
     * 清除批量操作锁
     */
    static clearBatchOperationLock() {
        localStorage.removeItem('batchOperationLock');
    }

    /**
     * 确认删除操作
     * @param {Object} note - 笔记对象
     * @returns {Promise<boolean>} 用户是否确认删除
     */
    static async confirmDeletion(note) {
        return new Promise((resolve) => {
                    // 智能获取标题
        let title = note.title;
        if (!title || title.trim() === '') {
            const content = note.note || '';
            if (content.trim()) {
                title = content.trim().substring(0, 30).replace(/\n/g, ' ');
                if (content.length > 30) title += '...';
            } else {
                title = 'Untitled Note';
            }
        }
        const truncatedTitle = title.length > 50 ? title.substring(0, 50) + '...' : title;
        
        const confirmed = confirm(`确定要删除笔记"${truncatedTitle}"吗？\n\n此操作不可撤销。`);
            resolve(confirmed);
        });
    }

    /**
     * 获取笔记（模拟接口）
     * @param {string} noteId - 笔记ID
     * @returns {Promise<Object>} 笔记对象
     */
    static async getNoteById(noteId) {
        // 这里应该调用实际的数据库查询
        // 暂时返回模拟数据
        try {
            if (window.noteDatabase) {
                return await window.noteDatabase.getNote(noteId);
            }
            return null;
        } catch (error) {
            console.error('获取笔记失败:', error);
            return null;
        }
    }

    /**
     * 获取存储使用情况
     * @returns {Promise<Object>} 存储使用情况
     */
    static async getStorageUsage() {
        try {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                return await navigator.storage.estimate();
            }
            
            // 备用方案：估算LocalStorage使用量
            let totalSize = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length + key.length;
                }
            }
            
            return {
                usage: totalSize,
                quota: 5 * 1024 * 1024 // 5MB估算
            };
        } catch (error) {
            console.error('获取存储使用情况失败:', error);
            return { usage: 0, quota: null };
        }
    }

    /**
     * 验证批量操作的数据量
     * @param {Array} items - 要处理的项目数组
     * @param {number} maxItems - 最大允许项目数
     * @returns {boolean} 是否在允许范围内
     */
    static validateBatchSize(items, maxItems = 100) {
        if (!Array.isArray(items)) {
            return false;
        }

        if (items.length > maxItems) {
            console.warn(`批量操作项目过多: ${items.length} > ${maxItems}`);
            return false;
        }

        return true;
    }

    /**
     * 检查文件大小限制
     * @param {File} file - 文件对象
     * @param {number} maxSizeMB - 最大文件大小（MB）
     * @returns {boolean} 是否在大小限制内
     */
    static validateFileSize(file, maxSizeMB = 10) {
        if (!file || !file.size) {
            return false;
        }

        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            console.warn(`文件过大: ${file.size} bytes > ${maxSizeBytes} bytes`);
            return false;
        }

        return true;
    }

    /**
     * 验证文件类型
     * @param {File} file - 文件对象
     * @param {Array} allowedTypes - 允许的MIME类型
     * @returns {boolean} 是否为允许的类型
     */
    static validateFileType(file, allowedTypes = ['application/json', 'text/plain', 'text/markdown']) {
        if (!file || !file.type) {
            return false;
        }

        return allowedTypes.includes(file.type);
    }

    /**
     * 记录安全事件
     * @param {string} eventType - 事件类型
     * @param {Object} details - 事件详情
     */
    static logSecurityEvent(eventType, details = {}) {
        const event = {
            timestamp: new Date().toISOString(),
            type: eventType,
            details: details,
            userAgent: navigator.userAgent
        };

        // 记录到控制台（生产环境可能需要发送到服务器）
        console.info('安全事件:', event);

        // 存储到本地（仅保留最近100条）
        try {
            const events = JSON.parse(localStorage.getItem('securityEvents') || '[]');
            events.unshift(event);
            
            // 只保留最近100条事件
            if (events.length > 100) {
                events.splice(100);
            }
            
            localStorage.setItem('securityEvents', JSON.stringify(events));
        } catch (error) {
            console.error('记录安全事件失败:', error);
        }
    }

    /**
     * 清理过期的权限数据
     */
    static cleanupExpiredData() {
        const now = Date.now();
        const expireTime = 24 * 60 * 60 * 1000; // 24小时

        // 清理频率限制记录
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('rateLimit_')) {
                const timestamp = parseInt(localStorage.getItem(key));
                if (isNaN(timestamp) || (now - timestamp) > expireTime) {
                    localStorage.removeItem(key);
                }
            }
        });

        // 清理过期的批量操作锁
        const batchLock = localStorage.getItem('batchOperationLock');
        if (batchLock) {
            const lockTime = parseInt(batchLock);
            if (now - lockTime > 30000) { // 30秒
                localStorage.removeItem('batchOperationLock');
            }
        }

        // 清理过期的安全事件
        try {
            const events = JSON.parse(localStorage.getItem('securityEvents') || '[]');
            const validEvents = events.filter(event => {
                const eventTime = new Date(event.timestamp).getTime();
                return (now - eventTime) < (7 * 24 * 60 * 60 * 1000); // 7天
            });
            
            if (validEvents.length !== events.length) {
                localStorage.setItem('securityEvents', JSON.stringify(validEvents));
            }
        } catch (error) {
            console.error('清理安全事件失败:', error);
        }
    }

    /**
     * 获取权限状态报告
     * @returns {Object} 权限状态信息
     */
    static getPermissionStatus() {
        return {
            currentLevel: this.currentPermissionLevel,
            rateLimits: this.RATE_LIMITS,
            hasActiveLocks: !!localStorage.getItem('batchOperationLock'),
            storageUsage: this.getStorageUsage(),
            lastCleanup: localStorage.getItem('lastPermissionCleanup')
        };
    }

    /**
     * 重置所有权限限制（仅用于调试）
     */
    static resetAllLimits() {
        if (process.env.NODE_ENV !== 'development') {
            console.warn('权限重置仅在开发环境中可用');
            return;
        }

        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('rateLimit_') || key === 'batchOperationLock') {
                localStorage.removeItem(key);
            }
        });

        console.info('所有权限限制已重置');
    }
}

// 页面加载时清理过期数据
document.addEventListener('DOMContentLoaded', () => {
    PermissionManager.cleanupExpiredData();
    localStorage.setItem('lastPermissionCleanup', Date.now().toString());
});

// 导出供其他模块使用
window.PermissionManager = PermissionManager;