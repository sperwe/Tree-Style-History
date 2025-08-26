/**
 * WebDAV 客户端
 * 用于与坚果云等 WebDAV 服务进行交互
 */

class WebDAVClient {
    constructor(config = {}) {
        this.server = config.server || 'https://dav.jianguoyun.com/dav';
        this.username = config.username || '';
        this.password = config.password || '';
        this.basePath = config.basePath || '/Tree-Style-History/';
        
        // 创建认证头 - 确保正确编码
        const authString = `${this.username}:${this.password}`;
        this.authHeader = 'Basic ' + btoa(unescape(encodeURIComponent(authString)));
    }

    /**
     * 测试连接
     * @returns {Promise<boolean>} 连接是否成功
     */
    async testConnection() {
        try {
            // 测试根目录访问权限
            const response = await fetch(this.server + '/', {
                method: 'PROPFIND',
                headers: {
                    'Authorization': this.authHeader,
                    'Depth': '0'
                }
            });
            
            if (response.status === 207 || response.status === 200) {
                console.log('[WebDAV] 连接测试成功');
                return true;
            } else if (response.status === 401) {
                console.error('[WebDAV] 认证失败，请检查用户名和密码');
                return false;
            } else {
                console.error('[WebDAV] 连接测试失败:', response.status);
                return false;
            }
        } catch (error) {
            console.error('[WebDAV] 连接错误:', error);
            return false;
        }
    }

    /**
     * 创建目录（支持递归创建）
     * @param {string} path - 目录路径
     * @returns {Promise<boolean>} 是否成功
     */
    async createDirectory(path) {
        try {
            console.log('[WebDAV] 尝试创建目录:', path);
            
            // 首先检查目录是否已存在
            const checkResponse = await fetch(this.server + path, {
                method: 'PROPFIND',
                headers: {
                    'Authorization': this.authHeader,
                    'Depth': '0'
                }
            });
            
            if (checkResponse.status === 207 || checkResponse.status === 200) {
                console.log('[WebDAV] 目录已存在:', path);
                return true;
            }
            
            // 尝试创建目录
            const response = await fetch(this.server + path, {
                method: 'MKCOL',
                headers: {
                    'Authorization': this.authHeader
                }
            });
            
            if (response.status === 201 || response.status === 200) {
                console.log('[WebDAV] 目录创建成功:', path);
                return true;
            } else if (response.status === 409) {
                // 409 表示父目录不存在，递归创建父目录
                const parentPath = path.substring(0, path.lastIndexOf('/', path.length - 2) + 1);
                if (parentPath && parentPath !== '/' && parentPath !== path) {
                    console.log('[WebDAV] 先创建父目录:', parentPath);
                    await this.createDirectory(parentPath);
                    // 再次尝试创建当前目录
                    const retryResponse = await fetch(this.server + path, {
                        method: 'MKCOL',
                        headers: {
                            'Authorization': this.authHeader
                        }
                    });
                    return retryResponse.status === 201 || retryResponse.status === 200;
                }
            }
            
            console.error('[WebDAV] 创建目录失败，状态码:', response.status);
            return false;
        } catch (error) {
            console.error('[WebDAV] 创建目录异常:', error);
            return false;
        }
    }

    /**
     * 上传文件
     * @param {string} filename - 文件名
     * @param {string|Blob} content - 文件内容
     * @param {string} folder - 文件夹路径（可选）
     * @returns {Promise<Object>} 上传结果
     */
    async uploadFile(filename, content, folder = '') {
        try {
            const fullPath = this.basePath + folder + filename;
            
            // 确保基础目录和文件夹存在
            await this.createDirectory(this.basePath);
            if (folder) {
                await this.createDirectory(this.basePath + folder);
            }
            
            const response = await fetch(this.server + fullPath, {
                method: 'PUT',
                headers: {
                    'Authorization': this.authHeader,
                    'Content-Type': 'application/octet-stream'
                },
                body: content
            });
            
            if (response.status === 201 || response.status === 204 || response.status === 200) {
                console.log('[WebDAV] 文件上传成功:', filename);
                return {
                    success: true,
                    path: fullPath,
                    url: this.server + fullPath
                };
            } else {
                throw new Error(`上传失败: ${response.status}`);
            }
        } catch (error) {
            console.error('[WebDAV] 上传文件失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 下载文件
     * @param {string} path - 文件路径
     * @returns {Promise<Blob|null>} 文件内容
     */
    async downloadFile(path) {
        try {
            const response = await fetch(this.server + path, {
                method: 'GET',
                headers: {
                    'Authorization': this.authHeader
                }
            });
            
            if (response.ok) {
                return await response.blob();
            } else {
                throw new Error(`下载失败: ${response.status}`);
            }
        } catch (error) {
            console.error('[WebDAV] 下载文件失败:', error);
            return null;
        }
    }

    /**
     * 列出文件
     * @param {string} path - 目录路径
     * @returns {Promise<Array>} 文件列表
     */
    async listFiles(path = '') {
        try {
            const fullPath = this.basePath + path;
            const response = await fetch(this.server + fullPath, {
                method: 'PROPFIND',
                headers: {
                    'Authorization': this.authHeader,
                    'Depth': '1',
                    'Content-Type': 'application/xml'
                }
            });
            
            if (!response.ok) {
                throw new Error(`列出文件失败: ${response.status}`);
            }
            
            const text = await response.text();
            return this.parseWebDAVResponse(text);
        } catch (error) {
            console.error('[WebDAV] 列出文件失败:', error);
            return [];
        }
    }

    /**
     * 删除文件
     * @param {string} path - 文件路径
     * @returns {Promise<boolean>} 是否成功
     */
    async deleteFile(path) {
        try {
            const response = await fetch(this.server + path, {
                method: 'DELETE',
                headers: {
                    'Authorization': this.authHeader
                }
            });
            
            return response.status === 204 || response.status === 200;
        } catch (error) {
            console.error('[WebDAV] 删除文件失败:', error);
            return false;
        }
    }

    /**
     * 解析 WebDAV PROPFIND 响应
     * @param {string} xmlText - XML 响应文本
     * @returns {Array} 文件信息数组
     */
    parseWebDAVResponse(xmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'application/xml');
        const responses = doc.getElementsByTagNameNS('DAV:', 'response');
        const files = [];
        
        for (let i = 0; i < responses.length; i++) {
            const response = responses[i];
            const href = response.getElementsByTagNameNS('DAV:', 'href')[0]?.textContent;
            const displayName = response.getElementsByTagNameNS('DAV:', 'displayname')[0]?.textContent;
            const lastModified = response.getElementsByTagNameNS('DAV:', 'getlastmodified')[0]?.textContent;
            const contentLength = response.getElementsByTagNameNS('DAV:', 'getcontentlength')[0]?.textContent;
            const resourceType = response.getElementsByTagNameNS('DAV:', 'resourcetype')[0];
            const isDirectory = resourceType?.getElementsByTagNameNS('DAV:', 'collection').length > 0;
            
            if (href && displayName) {
                files.push({
                    href: href,
                    name: displayName,
                    lastModified: lastModified ? new Date(lastModified) : null,
                    size: contentLength ? parseInt(contentLength) : 0,
                    isDirectory: isDirectory
                });
            }
        }
        
        return files;
    }

    /**
     * 自动备份
     * @param {Object} backupData - 备份数据
     * @param {string} format - 导出格式
     * @returns {Promise<Object>} 备份结果
     */
    async autoBackup(backupData, format = 'json') {
        try {
            // 生成文件名
            const date = new Date();
            const dateStr = date.toISOString().split('T')[0];
            const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
            const folder = `auto-backups/${dateStr}/`;
            const filename = `backup_${dateStr}_${timeStr}.${format}`;
            
            console.log('[WebDAV] 准备备份到:', this.basePath + folder + filename);
            
            // 准备内容
            let content;
            if (format === 'json') {
                content = JSON.stringify(backupData, null, 2);
            } else {
                // 其他格式的处理
                content = backupData;
            }
            
            // 上传文件
            const result = await this.uploadFile(filename, content, folder);
            
            if (result.success) {
                // 清理旧备份
                await this.cleanOldBackups(folder);
            }
            
            return result;
        } catch (error) {
            console.error('[WebDAV] 自动备份失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 清理旧备份
     * @param {string} folder - 备份文件夹
     * @param {number} keepDays - 保留天数
     */
    async cleanOldBackups(folder, keepDays = 7) {
        try {
            const files = await this.listFiles(folder);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - keepDays);
            
            for (const file of files) {
                if (!file.isDirectory && file.lastModified < cutoffDate) {
                    await this.deleteFile(file.href);
                    console.log('[WebDAV] 删除旧备份:', file.name);
                }
            }
        } catch (error) {
            console.error('[WebDAV] 清理旧备份失败:', error);
        }
    }
}

// 导出给其他模块使用
window.WebDAVClient = WebDAVClient;