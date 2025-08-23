/**
 * Research Navigator - Bootstrap
 * Zotero插件引导文件
 */

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var ResearchNavigatorAddon = class {
  constructor() {
    this.initialized = false;
    this.researchNavigator = null;
  }

  async startup() {
    if (this.initialized) return;
    
    try {
      // 等待Zotero初始化
      await this.waitForZotero();
      
      // 加载主脚本
      await this.loadMainScript();
      
      this.initialized = true;
      console.log("Research Navigator: Addon started successfully");
    } catch (error) {
      console.error("Research Navigator: Failed to start addon:", error);
    }
  }

  async waitForZotero() {
    let attempts = 0;
    const maxAttempts = 100;
    
    while (attempts < maxAttempts) {
      if (typeof Zotero !== 'undefined' && Zotero.initializationPromise) {
        await Zotero.initializationPromise;
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    throw new Error("Zotero not available after maximum attempts");
  }

  async loadMainScript() {
    try {
      // 加载编译后的主脚本
      const scriptPath = "chrome://research-navigator/content/index.js";
      Services.scriptloader.loadSubScript(scriptPath, this);
      
      console.log("Research Navigator: Main script loaded");
    } catch (error) {
      console.error("Research Navigator: Failed to load main script:", error);
      
      // 如果主脚本加载失败，尝试加载简化版本
      this.loadFallbackScript();
    }
  }

  loadFallbackScript() {
    // 简化版本的插件功能
    if (typeof window !== 'undefined' && window.document) {
      this.createSimpleFallback();
    }
  }

  createSimpleFallback() {
    console.log("Research Navigator: Loading fallback version");
    
    // 创建简单的工具栏按钮
    const doc = window.document || document;
    
    // 查找工具栏
    const toolbar = doc.getElementById('zotero-toolbar') || 
                   doc.querySelector('.toolbar') ||
                   doc.querySelector('toolbar');
    
    if (toolbar) {
      const button = doc.createElement('toolbarbutton');
      button.setAttribute('id', 'research-navigator-fallback-button');
      button.setAttribute('label', 'Research Navigator');
      button.setAttribute('tooltiptext', 'Research Navigator - Fallback Mode');
      button.style.cssText = `
        -moz-appearance: toolbarbutton;
        padding: 2px 6px;
        margin: 2px;
        border: 1px solid #ccc;
        background: linear-gradient(#fff, #f0f0f0);
        border-radius: 3px;
        cursor: pointer;
      `;
      
      button.addEventListener('click', () => {
        this.showFallbackMessage();
      });
      
      toolbar.appendChild(button);
      console.log("Research Navigator: Fallback button created");
    }
  }

  showFallbackMessage() {
    const message = `Research Navigator (Fallback Mode)
    
该插件正在降级模式运行。完整功能需要：
1. 确保Zotero版本 6.0.27+
2. 重启Zotero
3. 检查插件是否正确安装

当前功能有限，但插件已成功加载。
更多信息请查看开发者控制台。`;

    if (typeof alert !== 'undefined') {
      alert(message);
    } else if (typeof Zotero !== 'undefined' && Zotero.alert) {
      Zotero.alert(null, "Research Navigator", message);
    } else {
      console.log("Research Navigator Fallback Message:", message);
    }
  }

  shutdown() {
    try {
      // 清理UI元素
      const fallbackButton = document.getElementById('research-navigator-fallback-button');
      if (fallbackButton) {
        fallbackButton.remove();
      }

      // 清理主插件实例
      if (this.researchNavigator && typeof this.researchNavigator.shutdown === 'function') {
        this.researchNavigator.shutdown();
      }

      this.initialized = false;
      console.log("Research Navigator: Addon shutdown completed");
    } catch (error) {
      console.error("Research Navigator: Error during shutdown:", error);
    }
  }
};

// 全局实例
var researchNavigatorAddon;

// Zotero 插件生命周期函数
function install(data, reason) {
  console.log("Research Navigator: Installing...");
}

function startup(data, reason) {
  console.log("Research Navigator: Starting up...");
  
  researchNavigatorAddon = new ResearchNavigatorAddon();
  researchNavigatorAddon.startup();
}

function shutdown(data, reason) {
  console.log("Research Navigator: Shutting down...");
  
  if (researchNavigatorAddon) {
    researchNavigatorAddon.shutdown();
    researchNavigatorAddon = null;
  }
}

function uninstall(data, reason) {
  console.log("Research Navigator: Uninstalling...");
}