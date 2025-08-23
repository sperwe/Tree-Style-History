/**
 * XSS防护模块
 * 提供安全的DOM操作和内容渲染功能
 */

class XSSProtection {
    /**
     * HTML实体编码
     * @param {string} text - 原始文本
     * @returns {string} 编码后的安全文本
     */
    static escapeHtml(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 安全创建DOM元素
     * @param {string} tagName - 标签名
     * @param {string} content - 文本内容
     * @param {Object} attributes - 属性对象
     * @returns {Element} 创建的DOM元素
     */
    static createSafeElement(tagName, content = '', attributes = {}) {
        // 验证标签名
        const allowedTags = [
            'div', 'span', 'p', 'a', 'button', 'input', 'textarea', 'select', 'option',
            'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'strong', 'em', 'code', 'pre', 'blockquote', 'br', 'hr',
            'table', 'thead', 'tbody', 'tr', 'th', 'td'
        ];

        if (!allowedTags.includes(tagName.toLowerCase())) {
            throw new Error(`不安全的标签: ${tagName}`);
        }

        const element = document.createElement(tagName);
        
        // 安全设置文本内容
        if (content) {
            element.textContent = content;
        }
        
        // 验证并设置属性
        for (const [key, value] of Object.entries(attributes)) {
            if (this.isSafeAttribute(key, value)) {
                element.setAttribute(key, value);
            } else {
                console.warn(`跳过不安全的属性: ${key}=${value}`);
            }
        }
        
        return element;
    }

    /**
     * 检查属性是否安全
     * @param {string} name - 属性名
     * @param {string} value - 属性值
     * @returns {boolean} 是否安全
     */
    static isSafeAttribute(name, value) {
        if (!name || !value) return false;

        const nameLower = name.toLowerCase();
        
        // 危险属性黑名单
        const dangerousAttrs = [
            'onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur',
            'onchange', 'onsubmit', 'onreset', 'onselect', 'onkeydown', 'onkeyup',
            'onkeypress', 'onmousedown', 'onmouseup', 'onmousemove', 'onmouseout',
            'onmousein', 'ondblclick', 'oncontextmenu', 'onwheel', 'onscroll',
            'onresize', 'ondrag', 'ondrop', 'oncut', 'oncopy', 'onpaste'
        ];
        
        if (dangerousAttrs.includes(nameLower)) {
            return false;
        }

        // 检查值是否包含危险内容
        const valueStr = String(value);
        const dangerousPatterns = [
            /javascript:/i,
            /data:/i,
            /vbscript:/i,
            /on\w+\s*=/i,
            /<script/i,
            /expression\s*\(/i
        ];

        return !dangerousPatterns.some(pattern => pattern.test(valueStr));
    }

    /**
     * 安全显示笔记内容
     * @param {string} content - 笔记内容
     * @param {Element} container - 容器元素
     */
    static safeDisplayContent(content, container) {
        if (!container || !container.nodeType) {
            throw new Error('无效的容器元素');
        }

        // 清空容器
        container.innerHTML = '';

        if (!content) {
            return;
        }

        // 如果是简单文本，直接设置
        if (!this.containsHtmlTags(content)) {
            container.textContent = content;
            return;
        }

        // 如果包含HTML，进行安全解析
        const safeHtml = this.sanitizeHtml(content);
        container.innerHTML = safeHtml;
    }

    /**
     * 检查内容是否包含HTML标签
     * @param {string} content - 内容
     * @returns {boolean} 是否包含HTML
     */
    static containsHtmlTags(content) {
        return /<[^>]+>/.test(content);
    }

    /**
     * 清理HTML内容，只保留安全标签
     * @param {string} html - 原始HTML
     * @returns {string} 清理后的HTML
     */
    static sanitizeHtml(html) {
        if (!html) return '';

        // 白名单标签
        const allowedTags = [
            'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'code', 'pre',
            'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr'
        ];

        // 白名单属性
        const allowedAttributes = {
            'a': ['href', 'title', 'target'],
            'img': ['src', 'alt', 'title', 'width', 'height'],
            '*': ['class', 'id']
        };

        // 创建临时容器
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // 递归清理元素
        this.cleanElement(temp, allowedTags, allowedAttributes);

        return temp.innerHTML;
    }

    /**
     * 递归清理DOM元素
     * @param {Element} element - 要清理的元素
     * @param {Array} allowedTags - 允许的标签
     * @param {Object} allowedAttributes - 允许的属性
     */
    static cleanElement(element, allowedTags, allowedAttributes) {
        const children = Array.from(element.children);
        
        for (const child of children) {
            const tagName = child.tagName.toLowerCase();
            
            if (!allowedTags.includes(tagName)) {
                // 不允许的标签，保留文本内容
                const textContent = child.textContent;
                const textNode = document.createTextNode(textContent);
                element.replaceChild(textNode, child);
                continue;
            }

            // 清理属性
            const attrs = Array.from(child.attributes);
            for (const attr of attrs) {
                const attrName = attr.name.toLowerCase();
                const tagAllowedAttrs = allowedAttributes[tagName] || [];
                const globalAllowedAttrs = allowedAttributes['*'] || [];
                
                if (!tagAllowedAttrs.includes(attrName) && 
                    !globalAllowedAttrs.includes(attrName)) {
                    child.removeAttribute(attr.name);
                } else {
                    // 验证属性值安全性
                    if (!this.isSafeAttribute(attr.name, attr.value)) {
                        child.removeAttribute(attr.name);
                    }
                }
            }

            // 递归处理子元素
            this.cleanElement(child, allowedTags, allowedAttributes);
        }
    }

    /**
     * 安全设置innerHTML
     * @param {Element} element - 目标元素
     * @param {string} html - HTML内容
     */
    static safeSetInnerHTML(element, html) {
        if (!element || !element.nodeType) {
            throw new Error('无效的DOM元素');
        }

        const cleanHtml = this.sanitizeHtml(html);
        element.innerHTML = cleanHtml;
    }

    /**
     * 创建安全的链接元素
     * @param {string} url - 链接地址
     * @param {string} text - 链接文本
     * @param {Object} options - 选项
     * @returns {Element} 链接元素
     */
    static createSafeLink(url, text, options = {}) {
        // 验证URL安全性
        if (!this.isValidUrl(url)) {
            throw new Error(`不安全的URL: ${url}`);
        }

        const link = document.createElement('a');
        link.textContent = text || url;
        link.href = url;
        
        // 设置安全属性
        if (options.target === '_blank') {
            link.target = '_blank';
            link.rel = 'noopener noreferrer'; // 安全措施
        }

        if (options.title) {
            link.title = this.escapeHtml(options.title);
        }

        return link;
    }

    /**
     * 验证URL是否安全
     * @param {string} url - URL字符串
     * @returns {boolean} 是否安全
     */
    static isValidUrl(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }

        try {
            const urlObj = new URL(url);
            
            // 只允许安全协议
            const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
            if (!safeProtocols.includes(urlObj.protocol)) {
                return false;
            }

            // 防止恶意重定向
            if (urlObj.hostname === 'localhost' || 
                urlObj.hostname.startsWith('127.') ||
                urlObj.hostname.startsWith('192.168.') ||
                urlObj.hostname.startsWith('10.') ||
                urlObj.hostname.includes('file://')) {
                return false;
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 安全的事件监听器绑定
     * @param {Element} element - 目标元素
     * @param {string} eventType - 事件类型
     * @param {Function} handler - 事件处理函数
     * @param {Object} options - 选项
     */
    static safeAddEventListener(element, eventType, handler, options = {}) {
        if (!element || typeof handler !== 'function') {
            throw new Error('无效的元素或处理函数');
        }

        // 包装处理函数，添加错误处理
        const safeHandler = (event) => {
            try {
                // 防止默认行为（如果需要）
                if (options.preventDefault) {
                    event.preventDefault();
                }

                // 停止事件冒泡（如果需要）
                if (options.stopPropagation) {
                    event.stopPropagation();
                }

                return handler(event);
            } catch (error) {
                console.error('事件处理器错误:', error);
                if (options.onError) {
                    options.onError(error);
                }
            }
        };

        element.addEventListener(eventType, safeHandler, options);
        
        // 返回清理函数
        return () => {
            element.removeEventListener(eventType, safeHandler, options);
        };
    }

    /**
     * 创建安全的表单输入元素
     * @param {string} type - 输入类型
     * @param {Object} attributes - 属性
     * @returns {Element} 输入元素
     */
    static createSafeInput(type, attributes = {}) {
        const allowedTypes = [
            'text', 'password', 'email', 'url', 'search', 'tel',
            'number', 'range', 'date', 'time', 'datetime-local',
            'month', 'week', 'color', 'checkbox', 'radio',
            'file', 'hidden', 'submit', 'reset', 'button'
        ];

        if (!allowedTypes.includes(type)) {
            throw new Error(`不支持的输入类型: ${type}`);
        }

        const input = document.createElement('input');
        input.type = type;

        // 设置安全属性
        const safeAttributes = ['name', 'value', 'placeholder', 'maxlength', 
                               'min', 'max', 'step', 'pattern', 'required', 
                               'readonly', 'disabled', 'autocomplete'];

        for (const [key, value] of Object.entries(attributes)) {
            if (safeAttributes.includes(key.toLowerCase()) && 
                this.isSafeAttribute(key, value)) {
                input.setAttribute(key, value);
            }
        }

        return input;
    }

    /**
     * 安全的JSON解析
     * @param {string} jsonString - JSON字符串
     * @param {Function} reviver - 可选的reviver函数
     * @returns {*} 解析后的对象
     */
    static safeJsonParse(jsonString, reviver = null) {
        if (!jsonString || typeof jsonString !== 'string') {
            throw new Error('无效的JSON字符串');
        }

        try {
            // 基本验证，防止原型污染
            if (jsonString.includes('__proto__') || 
                jsonString.includes('constructor') ||
                jsonString.includes('prototype')) {
                throw new Error('检测到潜在的原型污染攻击');
            }

            return JSON.parse(jsonString, reviver);
        } catch (error) {
            console.error('JSON解析失败:', error);
            throw new Error('JSON格式无效');
        }
    }

    /**
     * 清理和验证CSS样式
     * @param {string} cssText - CSS文本
     * @returns {string} 清理后的CSS
     */
    static sanitizeCss(cssText) {
        if (!cssText) return '';

        // 移除危险的CSS内容
        return cssText
            .replace(/expression\s*\(/gi, '') // IE expression
            .replace(/javascript:/gi, '') // JavaScript URLs
            .replace(/data:/gi, '') // Data URLs
            .replace(/vbscript:/gi, '') // VBScript URLs
            .replace(/@import/gi, '') // CSS imports
            .replace(/binding:/gi, '') // Mozilla binding
            .replace(/behavior:/gi, ''); // IE behavior
    }
}

// 导出供其他模块使用
window.XSSProtection = XSSProtection;