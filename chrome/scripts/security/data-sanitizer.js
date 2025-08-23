/**
 * 数据清理和验证安全模块
 * 负责处理用户输入的验证、清理和安全检查
 */

class DataSanitizer {
    // 最大内容长度限制 (1MB)
    static MAX_CONTENT_LENGTH = 1000000;
    static MAX_TITLE_LENGTH = 200;
    static MAX_SEARCH_LENGTH = 100;

    /**
     * 清理笔记内容，防止XSS攻击
     * @param {string} content - 原始内容
     * @returns {string} 清理后的安全内容
     */
    static sanitizeNoteContent(content) {
        if (!content || typeof content !== 'string') {
            return '';
        }

        // 修复编码问题
        try {
            content = this.fixEncoding(content);
        } catch (error) {
            console.warn('笔记内容编码修复失败:', error);
        }

        // 长度限制检查
        if (content.length > this.MAX_CONTENT_LENGTH) {
            throw new Error(`笔记内容过大，请缩减至 ${Math.round(this.MAX_CONTENT_LENGTH / 1000)}KB 以内`);
        }

        // 移除危险的HTML标签和脚本
        let sanitized = content
            // 移除script标签
            .replace(/<script[^>]*>.*?<\/script>/gis, '')
            // 移除事件处理器
            .replace(/on\w+\s*=\s*['"'][^'"]*['"]/gi, '')
            // 移除javascript协议
            .replace(/javascript:/gi, '')
            // 移除data协议 (防止数据URI攻击)
            .replace(/data:/gi, '')
            // 移除vbscript协议
            .replace(/vbscript:/gi, '')
            // 移除style标签 (防止CSS注入)
            .replace(/<style[^>]*>.*?<\/style>/gis, '')
            // 移除link标签 (防止外部资源加载)
            .replace(/<link[^>]*>/gi, '')
            // 移除meta标签 (防止重定向)
            .replace(/<meta[^>]*>/gi, '')
            // 移除iframe标签
            .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '')
            // 移除object和embed标签
            .replace(/<(object|embed)[^>]*>.*?<\/\1>/gis, '');

        return sanitized.trim();
    }

    /**
     * 清理标题内容
     * @param {string} title - 原始标题
     * @returns {string} 清理后的标题
     */
    static sanitizeTitle(title) {
        if (!title || typeof title !== 'string') {
            return '';
        }

        // 确保字符串是正确编码的
        try {
            // 检查是否有编码问题并修复
            title = this.fixEncoding(title);
        } catch (error) {
            console.warn('标题编码修复失败:', error);
        }

        // 长度限制
        if (title.length > this.MAX_TITLE_LENGTH) {
            title = title.substring(0, this.MAX_TITLE_LENGTH - 3) + '...';
        }

        // HTML实体编码危险字符（但保留中文字符）
        return title.replace(/[<>'"&]/g, (match) => {
            const entities = {
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#x27;',
                '&': '&amp;'
            };
            return entities[match];
        });
    }

    /**
     * 修复字符编码问题
     * @param {string} text - 原始文本
     * @returns {string} 修复后的文本
     */
    static fixEncoding(text) {
        if (!text) return '';

        try {
            // 检测常见的UTF-8乱码模式并修复
            if (text.includes('æ') || text.includes('å') || text.includes('ç') || text.includes('è')) {
                // 方法1: 尝试直接字节转换
                try {
                    const bytes = new Uint8Array(text.length);
                    for (let i = 0; i < text.length; i++) {
                        bytes[i] = text.charCodeAt(i) & 0xFF;
                    }
                    const fixed = new TextDecoder('utf-8').decode(bytes);
                    
                    if (this.isValidText(fixed)) {
                        console.log('[DataSanitizer] 编码修复成功:', text.substring(0, 20), '->', fixed.substring(0, 20));
                        return fixed;
                    }
                } catch (e) {
                    // 忽略转换错误，继续下一种方法
                }
            }

            // 方法2: 处理已知的乱码模式
            const patterns = {
                'æœªå'½åç¬"è®°': '未命名笔记',
                'Proofâ€"of': 'Proof-of',
                'â€"': '—',
                'â€™': ''',
                'â€œ': '"',
                'â€': '"',
                'Â®': '®',
                'Ã¡': 'á',
                'Ã©': 'é',
                'Ã­': 'í',
                'Ã³': 'ó',
                'Ãº': 'ú'
            };

            let result = text;
            for (const [corrupt, correct] of Object.entries(patterns)) {
                if (result.includes(corrupt)) {
                    result = result.replace(new RegExp(corrupt, 'g'), correct);
                }
            }

            // 检查是否有改进
            if (result !== text && this.isValidText(result)) {
                console.log('[DataSanitizer] 模式修复成功:', text.substring(0, 20), '->', result.substring(0, 20));
                return result;
            }

        } catch (error) {
            console.warn('[DataSanitizer] 编码修复失败:', error);
        }

        return text;
    }

    /**
     * 验证文本是否有效（无乱码）
     * @param {string} text - 文本
     * @returns {boolean} 是否有效
     */
    static isValidText(text) {
        // 检查是否包含常见的乱码字符
        const invalidChars = /[\uFFFD\u00C3\u00A0-\u00FF]{2,}/;
        return !invalidChars.test(text);
    }

    /**
     * 验证标签值
     * @param {string} tag - 标签值
     * @returns {string} 验证后的标签
     */
    static validateTag(tag) {
        const validTags = [
            'important_very', 'important_somewhat', 'important_general',
            'interesting_very', 'interesting_somewhat', 'interesting_general',
            'needed_very', 'needed_somewhat', 'needed_general'
        ];

        if (!tag || !validTags.includes(tag)) {
            return 'general_general'; // 默认标签
        }

        return tag;
    }

    /**
     * 验证URL格式
     * @param {string} url - URL字符串
     * @returns {string} 验证后的URL
     */
    static validateUrl(url) {
        if (!url || typeof url !== 'string') {
            return '';
        }

        try {
            const urlObj = new URL(url);
            
            // 只允许http和https协议
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return '';
            }

            // 检查主机名是否合法
            if (!urlObj.hostname || urlObj.hostname.length > 253) {
                return '';
            }

            return url;
        } catch (error) {
            // URL格式无效
            return '';
        }
    }

    /**
     * 清理搜索查询
     * @param {string} query - 搜索查询
     * @returns {string} 清理后的查询
     */
    static sanitizeSearchQuery(query) {
        if (!query || typeof query !== 'string') {
            return '';
        }

        // 长度限制
        if (query.length > this.MAX_SEARCH_LENGTH) {
            query = query.substring(0, this.MAX_SEARCH_LENGTH);
        }

        // 移除特殊字符，保留字母、数字、空格、中文
        return query.replace(/[^\w\s\u4e00-\u9fa5]/g, '').trim();
    }

    /**
     * 生成安全的随机ID
     * @returns {string} 唯一ID
     */
    static generateSecureId() {
        // 使用Crypto API生成安全随机数
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * 生成数据校验和
     * @param {Object} data - 数据对象
     * @returns {string} 校验和
     */
    static generateChecksum(data) {
        try {
            const str = JSON.stringify(data);
            let hash = 0;
            
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // 转换为32位整数
            }
            
            return Math.abs(hash).toString(16);
        } catch (error) {
            console.error('生成校验和失败:', error);
            return '0';
        }
    }

    /**
     * 验证笔记数据完整性
     * @param {Object} noteData - 笔记数据
     * @returns {boolean} 是否有效
     */
    static validateNoteData(noteData) {
        if (!noteData || typeof noteData !== 'object') {
            return false;
        }

        // 必需字段检查
        const requiredFields = ['title', 'note'];
        for (const field of requiredFields) {
            if (!(field in noteData)) {
                return false;
            }
        }

        // 数据类型检查
        if (typeof noteData.title !== 'string' || typeof noteData.note !== 'string') {
            return false;
        }

        // 长度检查
        if (noteData.title.length > this.MAX_TITLE_LENGTH || 
            noteData.note.length > this.MAX_CONTENT_LENGTH) {
            return false;
        }

        return true;
    }

    /**
     * 清理导出数据
     * @param {Array} notes - 笔记数组
     * @param {boolean} maskSensitive - 是否遮盖敏感信息
     * @returns {Array} 清理后的笔记数组
     */
    static sanitizeExportData(notes, maskSensitive = false) {
        if (!Array.isArray(notes)) {
            return [];
        }

        return notes.map(note => {
            const cleanNote = {
                id: note.id,
                title: this.sanitizeTitle(note.title || ''),
                note: this.sanitizeNoteContent(note.note || ''),
                tag: this.validateTag(note.tag),
                url: this.validateUrl(note.url || ''),
                createdAt: note.createdAt,
                updatedAt: note.updatedAt
            };

            // 遮盖敏感信息
            if (maskSensitive) {
                cleanNote.title = this.maskSensitiveInfo(cleanNote.title);
                cleanNote.note = this.maskSensitiveInfo(cleanNote.note);
            }

            return cleanNote;
        });
    }

    /**
     * 遮盖敏感信息
     * @param {string} content - 原始内容
     * @returns {string} 遮盖后的内容
     */
    static maskSensitiveInfo(content) {
        if (!content) return content;

        return content
            // 信用卡号
            .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '****-****-****-****')
            // 身份证号（简单模式）
            .replace(/\b\d{15}(\d{2}[0-9xX])?\b/g, '****************')
            // 电话号码
            .replace(/\b1[3-9]\d{9}\b/g, '***********')
            // 邮箱地址
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***')
            // 密码相关文本
            .replace(/(password|密码|pwd)\s*[:=]\s*\S+/gi, '$1: ****')
            // Token或密钥
            .replace(/(token|key|secret)\s*[:=]\s*\S+/gi, '$1: ****');
    }

    /**
     * 检测敏感信息
     * @param {string} content - 内容
     * @returns {boolean} 是否包含敏感信息
     */
    static containsSensitiveInfo(content) {
        if (!content) return false;

        const sensitivePatterns = [
            /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // 信用卡
            /\b\d{15}(\d{2}[0-9xX])?\b/, // 身份证
            /\b1[3-9]\d{9}\b/, // 手机号
            /(password|密码|pwd)\s*[:=]/i, // 密码
            /(token|key|secret)\s*[:=]/i, // 密钥
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/ // 邮箱
        ];

        return sensitivePatterns.some(pattern => pattern.test(content));
    }

    /**
     * 频率限制检查
     * @param {string} operation - 操作类型
     * @param {number} limitMs - 限制时间间隔（毫秒）
     * @returns {boolean} 是否允许操作
     */
    static rateLimitCheck(operation, limitMs = 1000) {
        const now = Date.now();
        const key = `rateLimit_${operation}`;
        const lastTime = localStorage.getItem(key);

        if (lastTime && (now - parseInt(lastTime)) < limitMs) {
            return false;
        }

        localStorage.setItem(key, now.toString());
        return true;
    }

    /**
     * 清理localStorage中的频率限制记录
     */
    static cleanupRateLimits() {
        const keys = Object.keys(localStorage);
        const rateLimitKeys = keys.filter(key => key.startsWith('rateLimit_'));
        const now = Date.now();
        const expireTime = 24 * 60 * 60 * 1000; // 24小时

        rateLimitKeys.forEach(key => {
            const timestamp = parseInt(localStorage.getItem(key));
            if (isNaN(timestamp) || (now - timestamp) > expireTime) {
                localStorage.removeItem(key);
            }
        });
    }
}

// 页面加载时清理过期的频率限制记录
document.addEventListener('DOMContentLoaded', () => {
    DataSanitizer.cleanupRateLimits();
});

// 导出供其他模块使用
window.DataSanitizer = DataSanitizer;