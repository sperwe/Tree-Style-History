// Service Worker for Manifest V3
// Global variables
let openedTabs = {};
let recentTabs = [];
let db = null;
let oid = 1;

// Initialize database
function openDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("TreeStyleHistory", 1);
        
        request.onerror = function(event) {
            console.error("Database error:", event.target.error);
            reject(event.target.error);
        };
        
        request.onsuccess = function(event) {
            db = event.target.result;
            console.log("Database opened successfully");
            resolve(db);
        };
        
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            
            // Create object stores
            if (!db.objectStoreNames.contains("closed")) {
                const closedStore = db.createObjectStore("closed", { keyPath: "id" });
                closedStore.createIndex("close", "close", { unique: false });
            }
            
            if (!db.objectStoreNames.contains("VisitItem")) {
                const visitStore = db.createObjectStore("VisitItem", { keyPath: "visitId" });
                visitStore.createIndex("url", "url", { unique: false });
                visitStore.createIndex("visitTime", "visitTime", { unique: false });
            }
        };
    });
}

// Opened tab handler
function openedTab(tab) {
    openedTabs[tab.id] = tab;
    addCloseRecord(tab.id, tab.url, tab.title, 0, -1);
}

// Closed tab handler
function closedTab(id) {
    if (openedTabs[id] !== undefined) {
        console.log('close ' + id + ' ' + openedTabs[id].url);
        addCloseRecord(id, openedTabs[id].url, openedTabs[id].title, (new Date()).getTime(), 0);
        openedTabs[id].time = timeNow(0);
        
        const i = recentTabs.indexOf(id);
        if (i >= 0) {
            recentTabs.splice(i, 1);
        }
    }
}

// Add close record to database
function addCloseRecord(tid, url, title, time, close) {
    if ((/^(http|https)\:\/\/(.*)/).test(url) && url != title && title != '') {
        const transaction = db.transaction(["closed"], "readwrite");
        const objectStore = transaction.objectStore("closed");
        
        objectStore.put({
            id: oid + '_' + tid,
            oid: oid - 1,
            tid: tid,
            url: url,
            title: title,
            closeTime: time,
            close: close
        });
    }
}

// Update closed records
function updateClosed() {
    const time = (new Date()).getTime();
    const transaction = db.transaction(['closed'], 'readonly');
    const store = transaction.objectStore('closed');
    const index = store.index('close');
    const range = IDBKeyRange.upperBound(-1);
    
    index.openCursor(range).onsuccess = function(e) {
        const cursor = e.target.result;
        if (cursor) {
            const v = cursor.value;
            v.closeTime = time;
            v.close = 0 - v.close;
            
            const request = db.transaction(['closed'], 'readwrite')
                .objectStore('closed')
                .put(v);
                
            request.onsuccess = function(event) {
                console.log('updateClosed() succeed ' + v.id);
            };
            
            request.onerror = function(event) {
                console.log('updateClosed() fail ' + v.id);
            };
            
            cursor.continue();
        }
    };
}

// Updated tab handler
function updatedTab(tab) {
    if (openedTabs[tab.id] !== undefined) {
        openedTabs[tab.id] = tab;
        
        const i = recentTabs.indexOf(tab.id);
        if (i >= 0) {
            recentTabs.splice(i, 1);
        }
        recentTabs.unshift(tab.id);
        
        if (recentTabs.length > 100) {
            recentTabs.pop();
        }
    }
}

// Time utility function
function timeNow(st) {
    const now = new Date();
    if (st == 0) {
        return now.getTime();
    } else {
        return now.getTime() + st * 24 * 3600 * 1000;
    }
}

// Delete database
function deleteDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase("TreeStyleHistory");
        
        request.onerror = function(event) {
            console.error("Error deleting database:", event.target.error);
            reject(event.target.error);
        };
        
        request.onsuccess = function(event) {
            console.log("Database deleted successfully");
            resolve();
        };
    });
}

// Context menu setup
function setupContextMenu() {
    chrome.contextMenus.removeAll(() => {
        const options = {
            type: 'normal',
            id: 'tree_style_history_' + getVersion(),
            title: returnLang('searchSite'),
            contexts: ["link", "page"],
            visible: true,
        };

        if (localStorage['use-contextmenu'] == 'yes') {
            chrome.contextMenus.create(options, () => {
                console.log('select ' + options.id);
            });
        }
    });
}

// Context menu click handler
function handleContextMenuClick(info) {
    let url = info.linkUrl;
    if (url != undefined) {
        chrome.tabs.create({ url: 'history.html?' + url });
    } else {
        url = info.pageUrl;
        if (url != undefined) {
            chrome.tabs.create({ url: 'history.html?' + url });
        }
    }
}

// Get version
function getVersion() {
    return '3.1.13';
}

// Return language text (simplified version)
function returnLang(key) {
    // This would need to be implemented with proper i18n
    const messages = {
        'searchSite': 'Search Site History',
        'treeOpen': 'Open Tree Style History',
        'showAllHistory': 'Show All History',
        'OpenClosedHistory': 'Open Closed History',
        'OpenBookMark': 'Open Bookmarks'
    };
    return messages[key] || key;
}

// Command handler
function handleCommand(command) {
    switch (command) {
        case 'open_history2':
            chrome.tabs.create({ url: 'history2.html' });
            break;
        case 'open_history1':
            chrome.tabs.create({ url: 'history.html' });
            break;
        case 'open_closed':
            chrome.tabs.create({ url: 'closed.html' });
            break;
        case 'open_bookmark':
            chrome.tabs.create({ url: 'bookmark.html' });
            break;
    }
}

// Initialize Service Worker
async function initialize() {
    try {
        await openDb();
        setupContextMenu();
        console.log("Service Worker initialized successfully");
    } catch (error) {
        console.error("Failed to initialize Service Worker:", error);
    }
}

// Event listeners
chrome.runtime.onInstalled.addListener(() => {
    initialize();
});

chrome.runtime.onStartup.addListener(() => {
    initialize();
});

// Tab events
chrome.tabs.onCreated.addListener((tab) => {
    openedTab(tab);
});

chrome.tabs.onRemoved.addListener((tabId) => {
    closedTab(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        updatedTab(tab);
    }
});

// Context menu events
chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

// Command events
chrome.commands.onCommand.addListener(handleCommand);

// Message handling for communication with other parts of extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'getRecentTabs':
            sendResponse({ recentTabs: recentTabs });
            break;
        case 'deleteDb':
            deleteDb().then(() => {
                sendResponse({ success: true });
            }).catch((error) => {
                sendResponse({ success: false, error: error.message });
            });
            return true; // Keep message channel open for async response
        case 'getVersion':
            sendResponse({ version: getVersion() });
            break;
        default:
            sendResponse({ error: 'Unknown action' });
    }
});

// Initialize when Service Worker loads
initialize();