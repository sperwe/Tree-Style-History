/**
 * 备份管理模块
 * 负责数据备份、导出、导入和恢复功能
 */

class BackupManager {
    // 备份配置
    static BACKUP_CONFIG = {
        maxBackups: 10,           // 最大备份数量
        autoBackupInterval: 24,   // 自动备份间隔（小时）
        compressionLevel: 0.8,    // 压缩级别
        encryptBackups: false     // 是否加密备份（暂未实现）
    };

    // 支持的导出格式
    static EXPORT_FORMATS = {
        JSON: 'json',
        MARKDOWN: 'markdown',
        CSV: 'csv',
        HTML: 'html',
        ZOTERO_RDF: 'zotero_rdf',    // Zotero RDF 格式
        BIBTEX: 'bibtex',            // BibTeX 格式（Zotero也支持）
        RIS: 'ris'                   // RIS 格式（Reference Manager）
    };

    /**
     * 创建自动备份
     * @returns {Promise<Object>} 备份结果
     */
    static async createAutoBackup() {
        try {
            console.info('开始创建自动备份...');
            
            // 检查是否需要备份
            const lastBackup = localStorage.getItem('lastAutoBackup');
            const now = Date.now();
            const backupInterval = this.BACKUP_CONFIG.autoBackupInterval * 60 * 60 * 1000;
            
            if (lastBackup && (now - parseInt(lastBackup)) < backupInterval) {
                console.info('距离上次备份时间未到，跳过自动备份');
                return { success: false, reason: 'interval_not_reached' };
            }

            // 获取所有笔记数据
            const allNotes = await this.getAllNotes();
            if (!allNotes || allNotes.length === 0) {
                console.info('没有笔记数据，跳过备份');
                return { success: false, reason: 'no_data' };
            }

            // 创建备份数据
            const backup = {
                id: DataSanitizer.generateSecureId(),
                timestamp: new Date().toISOString(),
                version: chrome.runtime.getManifest().version,
                type: 'auto',
                notesCount: allNotes.length,
                data: allNotes,
                checksum: this.generateBackupChecksum(allNotes),
                metadata: {
                    userAgent: navigator.userAgent,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    language: navigator.language
                }
            };

            // 保存备份
            await this.saveBackup(backup);
            
            // 清理旧备份
            await this.cleanOldBackups();
            
            // 更新最后备份时间
            localStorage.setItem('lastAutoBackup', now.toString());
            
            console.info('自动备份创建成功', { id: backup.id, count: backup.notesCount });
            return { success: true, backup: backup };

        } catch (error) {
            console.error('自动备份失败:', error);
            PermissionManager.logSecurityEvent('backup_failed', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * 创建手动备份
     * @param {Array} selectedNotes - 选定的笔记数组
     * @param {Object} options - 备份选项
     * @returns {Promise<Object>} 备份结果
     */
    static async createManualBackup(selectedNotes = null, options = {}) {
        try {
            console.info('开始创建手动备份...');

            // 检查权限
            if (!await PermissionManager.checkOperationPermission('export')) {
                throw new Error('没有导出权限');
            }

            // 获取要备份的数据
            const notesToBackup = selectedNotes || await this.getAllNotes();
            
            if (!notesToBackup || notesToBackup.length === 0) {
                throw new Error('没有可备份的笔记');
            }

            // 验证批量操作大小
            if (!PermissionManager.validateBatchSize(notesToBackup, 500)) {
                throw new Error('选择的笔记数量过多');
            }

            // 创建备份数据
            const backup = {
                id: DataSanitizer.generateSecureId(),
                timestamp: new Date().toISOString(),
                version: chrome.runtime.getManifest().version,
                type: 'manual',
                notesCount: notesToBackup.length,
                data: DataSanitizer.sanitizeExportData(notesToBackup, options.maskSensitive),
                checksum: this.generateBackupChecksum(notesToBackup),
                options: options,
                metadata: {
                    userAgent: navigator.userAgent,
                    selectedCount: selectedNotes ? selectedNotes.length : 'all'
                }
            };

            console.info('手动备份创建成功', { id: backup.id, count: backup.notesCount });
            return { success: true, backup: backup };

        } catch (error) {
            console.error('手动备份失败:', error);
            PermissionManager.logSecurityEvent('manual_backup_failed', { error: error.message });
            throw error;
        }
    }

    /**
     * 导出备份文件
     * @param {Object} backup - 备份数据
     * @param {string} format - 导出格式
     * @returns {Promise<Blob>} 导出的文件Blob
     */
    static async exportBackup(backup, format = this.EXPORT_FORMATS.JSON) {
        try {
            let content;
            let mimeType;
            let filename;

            switch (format) {
                case this.EXPORT_FORMATS.JSON:
                    content = JSON.stringify(backup, null, 2);
                    mimeType = 'application/json';
                    filename = `notes-backup-${this.formatTimestamp(backup.timestamp)}.json`;
                    break;

                case this.EXPORT_FORMATS.MARKDOWN:
                    content = this.convertToMarkdown(backup);
                    mimeType = 'text/markdown';
                    filename = `notes-backup-${this.formatTimestamp(backup.timestamp)}.md`;
                    break;

                case this.EXPORT_FORMATS.CSV:
                    content = this.convertToCSV(backup);
                    mimeType = 'text/csv';
                    filename = `notes-backup-${this.formatTimestamp(backup.timestamp)}.csv`;
                    break;

                case this.EXPORT_FORMATS.HTML:
                    content = this.convertToHTML(backup);
                    mimeType = 'text/html';
                    filename = `notes-backup-${this.formatTimestamp(backup.timestamp)}.html`;
                    break;

                case this.EXPORT_FORMATS.ZOTERO_RDF:
                    content = this.convertToZoteroRDF(backup);
                    mimeType = 'application/rdf+xml';
                    filename = `notes-zotero-${this.formatTimestamp(backup.timestamp)}.rdf`;
                    break;

                case this.EXPORT_FORMATS.BIBTEX:
                    content = this.convertToBibTeX(backup);
                    mimeType = 'application/x-bibtex';
                    filename = `notes-bibtex-${this.formatTimestamp(backup.timestamp)}.bib`;
                    break;

                case this.EXPORT_FORMATS.RIS:
                    content = this.convertToRIS(backup);
                    mimeType = 'application/x-research-info-systems';
                    filename = `notes-ris-${this.formatTimestamp(backup.timestamp)}.ris`;
                    break;

                default:
                    throw new Error(`不支持的导出格式: ${format}`);
            }

            const blob = new Blob([content], { type: mimeType });
            blob.filename = filename; // 添加文件名属性
            
            console.info(`备份导出成功: ${filename}`, { size: blob.size, format });
            return blob;

        } catch (error) {
            console.error('导出备份失败:', error);
            throw error;
        }
    }

    /**
     * 导入备份文件
     * @param {File} file - 备份文件
     * @param {Object} options - 导入选项
     * @returns {Promise<Object>} 导入结果
     */
    static async importBackup(file, options = {}) {
        try {
            console.info('开始导入备份...', { filename: file.name, size: file.size });

            // 检查权限
            if (!await PermissionManager.checkOperationPermission('import')) {
                throw new Error('没有导入权限');
            }

            // 验证文件
            if (!PermissionManager.validateFileSize(file, 50)) { // 50MB限制
                throw new Error('文件过大，无法导入');
            }

            if (!PermissionManager.validateFileType(file)) {
                throw new Error('不支持的文件类型');
            }

            // 读取文件内容
            const content = await this.readFileContent(file);
            
            // 解析备份数据
            let backupData;
            try {
                backupData = XSSProtection.safeJsonParse(content);
            } catch (error) {
                throw new Error('备份文件格式无效');
            }

            // 验证备份数据
            await this.validateImportData(backupData);

            // 处理导入选项
            const importOptions = {
                overwrite: options.overwrite || false,
                mergeDuplicates: options.mergeDuplicates || true,
                preserveIds: options.preserveIds || false,
                ...options
            };

            // 执行导入
            const result = await this.performImport(backupData, importOptions);

            console.info('备份导入成功', result);
            PermissionManager.logSecurityEvent('backup_imported', {
                filename: file.name,
                notesCount: result.importedCount
            });

            return result;

        } catch (error) {
            console.error('导入备份失败:', error);
            PermissionManager.logSecurityEvent('import_failed', { 
                filename: file.name, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * 保存备份到本地存储
     * @param {Object} backup - 备份数据
     */
    static async saveBackup(backup) {
        try {
            const backups = this.getStoredBackups();
            backups.unshift(backup);

            // 只保留最新的备份
            if (backups.length > this.BACKUP_CONFIG.maxBackups) {
                backups.splice(this.BACKUP_CONFIG.maxBackups);
            }

            localStorage.setItem('noteBackups', JSON.stringify(backups));
            
        } catch (error) {
            console.error('保存备份失败:', error);
            throw error;
        }
    }

    /**
     * 获取存储的备份列表
     * @returns {Array} 备份列表
     */
    static getStoredBackups() {
        try {
            const backups = localStorage.getItem('noteBackups');
            return backups ? JSON.parse(backups) : [];
        } catch (error) {
            console.error('获取备份列表失败:', error);
            return [];
        }
    }

    /**
     * 清理旧备份
     */
    static async cleanOldBackups() {
        try {
            const backups = this.getStoredBackups();
            const now = Date.now();
            const maxAge = 30 * 24 * 60 * 60 * 1000; // 30天

            const validBackups = backups.filter(backup => {
                const backupTime = new Date(backup.timestamp).getTime();
                return (now - backupTime) < maxAge;
            });

            // 保持最少3个备份
            const backupsToKeep = Math.max(validBackups.length, 3);
            const finalBackups = validBackups.slice(0, backupsToKeep);

            if (finalBackups.length !== backups.length) {
                localStorage.setItem('noteBackups', JSON.stringify(finalBackups));
                console.info(`清理了 ${backups.length - finalBackups.length} 个过期备份`);
            }

        } catch (error) {
            console.error('清理备份失败:', error);
        }
    }

    /**
     * 生成备份校验和
     * @param {Array} notes - 笔记数组
     * @returns {string} 校验和
     */
    static generateBackupChecksum(notes) {
        try {
            const dataString = JSON.stringify(notes.map(note => ({
                id: note.id,
                title: note.title,
                note: note.note,
                updatedAt: note.updatedAt
            })));
            
            return DataSanitizer.generateChecksum({ data: dataString, count: notes.length });
        } catch (error) {
            console.error('生成备份校验和失败:', error);
            return '0';
        }
    }

    /**
     * 验证导入数据
     * @param {Object} importData - 导入的数据
     * @returns {Promise<boolean>} 是否有效
     */
    static async validateImportData(importData) {
        if (!importData || typeof importData !== 'object') {
            throw new Error('无效的备份文件格式');
        }

        if (!importData.data || !Array.isArray(importData.data)) {
            throw new Error('备份文件中没有找到笔记数据');
        }

        // 验证每个笔记的数据结构
        for (const note of importData.data) {
            if (!DataSanitizer.validateNoteData(note)) {
                throw new Error('备份文件中包含无效的笔记数据');
            }
        }

        // 验证校验和（如果存在）
        if (importData.checksum) {
            const calculatedChecksum = this.generateBackupChecksum(importData.data);
            if (calculatedChecksum !== importData.checksum) {
                console.warn('备份文件校验和不匹配，数据可能已损坏');
            }
        }

        return true;
    }

    /**
     * 执行导入操作
     * @param {Object} backupData - 备份数据
     * @param {Object} options - 导入选项
     * @returns {Promise<Object>} 导入结果
     */
    static async performImport(backupData, options) {
        const result = {
            totalNotes: backupData.data.length,
            importedCount: 0,
            skippedCount: 0,
            errorCount: 0,
            errors: []
        };

        // 设置批量操作锁
        PermissionManager.setBatchOperationLock();

        try {
            for (const noteData of backupData.data) {
                try {
                    // 清理和验证数据
                    const cleanNote = {
                        id: options.preserveIds ? noteData.id : DataSanitizer.generateSecureId(),
                        title: DataSanitizer.sanitizeTitle(noteData.title),
                        note: DataSanitizer.sanitizeNoteContent(noteData.note),
                        tag: DataSanitizer.validateTag(noteData.tag),
                        url: DataSanitizer.validateUrl(noteData.url || ''),
                        createdAt: noteData.createdAt || new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        importedAt: new Date().toISOString()
                    };

                    // 检查是否存在重复
                    const existingNote = await this.findExistingNote(cleanNote);
                    
                    if (existingNote && !options.overwrite) {
                        if (options.mergeDuplicates) {
                            // 合并重复笔记
                            await this.mergeNotes(existingNote, cleanNote);
                            result.importedCount++;
                        } else {
                            result.skippedCount++;
                        }
                    } else {
                        // 导入新笔记或覆盖现有笔记
                        await this.saveImportedNote(cleanNote);
                        result.importedCount++;
                    }

                } catch (error) {
                    result.errorCount++;
                    result.errors.push({
                        note: noteData.title || '未命名',
                        error: error.message
                    });
                }
            }

        } finally {
            PermissionManager.clearBatchOperationLock();
        }

        return result;
    }

    /**
     * 转换为Markdown格式
     * @param {Object} backup - 备份数据
     * @returns {string} Markdown内容
     */
    static convertToMarkdown(backup) {
        let content = `# 笔记备份\n\n`;
        content += `**备份时间**: ${backup.timestamp}\n`;
        content += `**笔记数量**: ${backup.notesCount}\n`;
        content += `**版本**: ${backup.version}\n\n`;
        content += `---\n\n`;

        for (const note of backup.data) {
            // 智能获取标题
            let title = note.title;
            if (!title || title.trim() === '') {
                const noteContent = note.note || '';
                if (noteContent.trim()) {
                    title = noteContent.trim().substring(0, 30).replace(/\n/g, ' ');
                    if (noteContent.length > 30) title += '...';
                } else {
                    title = 'Untitled Note';
                }
            }
            
            content += `## ${title}\n\n`;
            
            if (note.url) {
                content += `**来源**: ${note.url}\n`;
            }
            
            if (note.tag) {
                content += `**标签**: ${this.getTagDisplayName(note.tag)}\n`;
            }
            
            content += `**创建时间**: ${note.createdAt}\n`;
            content += `**更新时间**: ${note.updatedAt}\n\n`;
            content += `${note.note}\n\n`;
            content += `---\n\n`;
        }

        return content;
    }

    /**
     * 转换为CSV格式
     * @param {Object} backup - 备份数据
     * @returns {string} CSV内容
     */
    static convertToCSV(backup) {
        const headers = ['标题', '内容', '标签', '网址', '创建时间', '更新时间'];
        let content = headers.join(',') + '\n';

        for (const note of backup.data) {
            const row = [
                this.escapeCSV(note.title || ''),
                this.escapeCSV(note.note || ''),
                this.escapeCSV(this.getTagDisplayName(note.tag)),
                this.escapeCSV(note.url || ''),
                note.createdAt || '',
                note.updatedAt || ''
            ];
            content += row.join(',') + '\n';
        }

        return content;
    }

    /**
     * 转换为HTML格式
     * @param {Object} backup - 备份数据
     * @returns {string} HTML内容
     */
    static convertToHTML(backup) {
        let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>笔记备份 - ${this.formatTimestamp(backup.timestamp)}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { border-bottom: 2px solid #eee; margin-bottom: 30px; padding-bottom: 20px; }
        .note { border: 1px solid #ddd; border-radius: 8px; margin-bottom: 20px; padding: 20px; }
        .note-title { color: #333; margin: 0 0 10px 0; }
        .note-meta { color: #666; font-size: 0.9em; margin-bottom: 15px; }
        .note-content { white-space: pre-wrap; }
        .tag { background: #f0f8ff; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📝 笔记备份</h1>
        <p><strong>备份时间:</strong> ${backup.timestamp}</p>
        <p><strong>笔记数量:</strong> ${backup.notesCount}</p>
        <p><strong>版本:</strong> ${backup.version}</p>
    </div>`;

        for (const note of backup.data) {
            // 智能获取标题
            let title = note.title;
            if (!title || title.trim() === '') {
                const noteContent = note.note || '';
                if (noteContent.trim()) {
                    title = noteContent.trim().substring(0, 30).replace(/\n/g, ' ');
                    if (noteContent.length > 30) title += '...';
                } else {
                    title = 'Untitled Note';
                }
            }
            
            html += `
    <div class="note">
        <h2 class="note-title">${XSSProtection.escapeHtml(title)}</h2>
        <div class="note-meta">
            ${note.tag ? `<span class="tag">${this.getTagDisplayName(note.tag)}</span> ` : ''}
            ${note.url ? `<a href="${note.url}" target="_blank">🔗 查看原页面</a> ` : ''}
            <span>📅 ${note.createdAt}</span>
        </div>
        <div class="note-content">${XSSProtection.escapeHtml(note.note || '')}</div>
    </div>`;
        }

        html += `
</body>
</html>`;

        return html;
    }

    /**
     * 获取所有笔记（模拟接口）
     * @returns {Promise<Array>} 笔记数组
     */
    static async getAllNotes() {
        // 这里应该调用实际的数据库查询
        try {
            if (window.noteDatabase) {
                return await window.noteDatabase.getAllNotes();
            }
            return [];
        } catch (error) {
            console.error('获取笔记失败:', error);
            return [];
        }
    }

    /**
     * 读取文件内容
     * @param {File} file - 文件对象
     * @returns {Promise<string>} 文件内容
     */
    static readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsText(file);
        });
    }

    /**
     * 格式化时间戳
     * @param {string} timestamp - ISO时间戳
     * @returns {string} 格式化的时间
     */
    static formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toISOString().slice(0, 19).replace(/:/g, '-');
    }

    /**
     * 转换为 Zotero RDF 格式
     * @param {Object} backup - 备份数据
     * @returns {string} RDF 格式内容
     */
    static convertToZoteroRDF(backup) {
        let rdf = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:z="http://www.zotero.org/namespaces/export#"
         xmlns:dc="http://purl.org/dc/elements/1.1/"
         xmlns:dcterms="http://purl.org/dc/terms/">`;

        const notes = backup.data || backup.notes || [];
        notes.forEach((note, index) => {
            const itemId = `item_${index + 1}`;
            const noteId = `note_${index + 1}`;
            const noteDate = new Date(note.updatedAt || note.createdAt);
            
            // 创建网页条目
            rdf += `
    <z:Item rdf:about="#${itemId}">
        <z:itemType>webpage</z:itemType>
        <dc:title>${this.escapeXML(note.title || '无标题笔记')}</dc:title>
        <z:url>${this.escapeXML(note.url)}</z:url>
        <dc:date>${noteDate.toISOString()}</dc:date>
        <z:accessDate>${noteDate.toISOString()}</z:accessDate>`;
            
            // 添加标签
            const tagName = this.getTagDisplayName(note.tag);
            if (tagName) {
                rdf += `
        <z:tags>
            <rdf:Seq>
                <rdf:li>${this.escapeXML(tagName)}</rdf:li>
            </rdf:Seq>
        </z:tags>`;
            }
            
            rdf += `
    </z:Item>`;
            
            // 创建笔记条目（如果有笔记内容）
            if (note.note && note.note.trim()) {
                rdf += `
    <z:Item rdf:about="#${noteId}">
        <z:itemType>note</z:itemType>
        <rdf:value>${this.escapeXML(note.note)}</rdf:value>
        <z:parentItem rdf:resource="#${itemId}"/>
    </z:Item>`;
            }
        });
        
        rdf += `
</rdf:RDF>`;
        
        return rdf;
    }

    /**
     * 转换为 BibTeX 格式
     * @param {Object} backup - 备份数据
     * @returns {string} BibTeX 格式内容
     */
    static convertToBibTeX(backup) {
        let bibtex = '';
        
        const notes = backup.data || backup.notes || [];
        notes.forEach((note, index) => {
            const noteDate = new Date(note.updatedAt || note.createdAt);
            const year = noteDate.getFullYear();
            const month = noteDate.getMonth() + 1;
            
            // 生成引用键
            const citeKey = `tsh_note_${year}_${index + 1}`;
            
            bibtex += `@misc{${citeKey},
  title = {${this.escapeBibTeX(note.title || '无标题笔记')}},
  author = {Tree Style History},
  year = {${year}},
  month = {${month}},
  url = {${note.url}},
  note = {${this.escapeBibTeX(note.note)}},
  keywords = {${this.getTagDisplayName(note.tag) || 'web-note'}}
}

`;
        });
        
        return bibtex;
    }

    /**
     * 转换为 RIS 格式
     * @param {Object} backup - 备份数据
     * @returns {string} RIS 格式内容
     */
    static convertToRIS(backup) {
        let ris = '';
        
        const notes = backup.data || backup.notes || [];
        notes.forEach(note => {
            const noteDate = new Date(note.updatedAt || note.createdAt);
            
            ris += `TY  - ELEC
T1  - ${note.title || '无标题笔记'}
AU  - Tree Style History
PY  - ${noteDate.getFullYear()}
DA  - ${noteDate.toISOString().split('T')[0]}
UR  - ${note.url}
N1  - ${note.note.replace(/\n/g, ' ')}
KW  - ${this.getTagDisplayName(note.tag) || 'web-note'}
ER  - 

`;
        });
        
        return ris;
    }

    /**
     * 转义 XML 特殊字符
     */
    static escapeXML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * 转义 BibTeX 特殊字符
     */
    static escapeBibTeX(str) {
        if (!str) return '';
        return str
            .replace(/\\/g, '\\textbackslash{}')
            .replace(/[{}]/g, m => '\\' + m)
            .replace(/[#$%&_]/g, m => '\\' + m)
            .replace(/\^/g, '\\textasciicircum{}')
            .replace(/~/g, '\\textasciitilde{}');
    }

    /**
     * 获取标签显示名称
     */
    static getTagDisplayName(tag) {
        const tagMap = {
            'important_very': '非常重要',
            'important_somewhat': '比较重要',
            'important_general': '一般重要',
            'interesting_very': '非常有趣',
            'interesting_somewhat': '比较有趣',
            'interesting_general': '一般有趣',
            'needed_very': '非常需要',
            'needed_somewhat': '比较需要',
            'needed_general': '一般需要'
        };
        return tagMap[tag] || tag;
    }

    /**
     * 转义CSV字符
     * @param {string} text - 原始文本
     * @returns {string} 转义后的文本
     */
    static escapeCSV(text) {
        if (!text) return '';
        const escaped = text.replace(/"/g, '""');
        return `"${escaped}"`;
    }
}

// 页面加载时初始化自动备份
document.addEventListener('DOMContentLoaded', () => {
    // 延迟5秒后检查是否需要自动备份
    setTimeout(() => {
        BackupManager.createAutoBackup().catch(error => {
            console.error('自动备份初始化失败:', error);
        });
    }, 5000);
});

// 导出供其他模块使用
window.BackupManager = BackupManager;