// MV3 compatible popup.js
// Global variables for communication with Service Worker
let recentTabs = [];

// Initialize popup
document.addEventListener('DOMContentLoaded', function () {
    // Get recent tabs from Service Worker
    chrome.runtime.sendMessage({ action: 'getRecentTabs' }, function(response) {
        if (response && response.recentTabs) {
            recentTabs = response.recentTabs;
        }
        initializePopup();
    });
});

function initializePopup() {
    // Updated/Installed
    if (localStorage['rh-version-' + getVersion()] !== 'true') {
        alertUser(returnLang('successfullyInstalled') + '<span>v' + getVersion() + '</span>', 'open');
        localStorage['rh-version-' + getVersion()] = 'true';
    }

    switch (localStorage['show-popup']) {
        case 'history2':
            window.open("history2.html");
            window.close();
            break;
        case 'history':
            window.open("history.html");
            window.close();
            break;
        case 'closed':
            window.open("closed.html");
            window.close();
            break;
        case 'bookmark':
            window.open("bookmark.html");
            window.close();
            break;
        case 'options':
            window.open("options.html");
            window.close();
            break;
    }

    // Popup structure
    var rhporder = localStorage['rh-list-order'].split(',');

    for (var o in rhporder) {
        if (rhporder[o] == 'rh-order') {
            if ((localStorage['rh-itemsno'] * 1) > 0) {
                createElement('div', { id: 'rh-inject', innerHTML: '<div id="rh-inject-title" class="popup-title"><span>' + returnLang('recentHistory') + '	- <a href="#"  id="show-all-history" target="_blank">' + returnLang('more') + '🕑</a></span></div>' }, 'popup-insert');
            }
        } else if (rhporder[o] == 'rct-order') {
            if ((localStorage['rct-itemsno'] * 1) > 0 ) {
                if (navigator.userAgent.toLowerCase().indexOf('edg') > 0) {
                    createElement('div', { id: 'rct-inject', innerHTML: '<div id="rct-inject-title" class="popup-title"><span>' + returnLang('recentlyClosedTabs') + '	- <a href="#"  id="show-all-closed" target="_blank">' + returnLang('more') + '...</a></span></div>' }, 'popup-insert');
                } else {
                    createElement('div', { id: 'rct-inject', innerHTML: '<div id="rct-inject-title" class="popup-title"><span>' + returnLang('recentlyClosedTabs') + '</span></div>' }, 'popup-insert');
                }
            }
        } else if (rhporder[o] == 'rb-order') {
            if ((localStorage['rb-itemsno'] * 1) > 0) {
                createElement('div', { id: 'rb-inject', innerHTML: '<div id="rb-inject-title" class="popup-title"><span>' + returnLang('recentBookmarks') + '	- <a href="#"  id="show-all-bookmark" target="_blank">' + returnLang('more') + '...</a></span></div>' }, 'popup-insert');
            }
        } else if (rhporder[o] == 'mv-order') {
            if ((localStorage['mv-itemsno'] * 1) > 0) {
                createElement('div', { id: 'mv-inject', innerHTML: '<div id="mv-inject-title" class="popup-title"><span>' + returnLang('mostVisited') + '</span></div>' }, 'popup-insert');
            }
        } else if (rhporder[o] == 'rt-order') {
            // rt = recent tab
            if ((localStorage['rt-itemsno'] * 1) > 0 && recentTabs.length > 0) {
               createElement('div', { id: 'rt-inject', innerHTML: '<div id="rt-inject-title" class="popup-title"><span>' + returnLang('recentTabs') + '</span></div>' }, 'popup-insert');
            }
        }
    }

    // Assign events
    if (document.getElementById('show-all-history')) {
        document.getElementById('show-all-history').addEventListener('click', function () {
            if (localStorage['rm-click'] == 'this')
                chromeURL('/history2.html');
            else
                chromeURL('chrome://history/');
        });
    }

    if (document.getElementById('show-all-bookmark')) {
        document.getElementById('show-all-bookmark').addEventListener('click', function () {
            if (localStorage['rm-click'] == 'this')
                chromeURL('/bookmark.html');
            else
                chromeURL('chrome://favorites/');
        });
    }

    if (document.getElementById('show-all-closed')) {
        document.getElementById('show-all-closed').addEventListener('click', function () {
            if (localStorage['rm-click'] == 'this')
                chromeURL('/closed.html');
            else
                chromeURL('chrome://history/recentlyClosed');
        });
    }

    // Popup init
    if (document.getElementById('rh-inject')) { recentHistory(); }
    if (document.getElementById('rct-inject')) { recentlyClosedTabs(); }
    if (document.getElementById('rt-inject')) { showRecentTabs(); }
    if (document.getElementById('rb-inject')) { recentBookmarks(); }
    if (document.getElementById('mv-inject')) { mostVisited(); }

    // Favicon error handling
    document.querySelectorAll('.favicon').forEach(function(el) {
        el.addEventListener('error', function () {
            this.src = 'images/blank.png';
        });
    });

    // Width
    document.body.style.width = localStorage['rh-width'];

    // Titles
    document.querySelectorAll('.popup-title').forEach(function(el, i) {
        if (i !== 0) {
            el.style.marginTop = '6px';
        }
    });

    // Search
    if (localStorage['rh-search'] == 'yes') {
        document.getElementById('popup-search-input').addEventListener('keyup', function () {
            var sv = this.value;
            if (sv.length + sv.replace(/[0-9a-zA-Z]+/g, '').length >= 2) {
                popupSearch(sv);
                document.getElementById('popup-insert').style.display = 'none';
                document.getElementById('popup-search-insert').style.display = 'block';
            } else {
                document.getElementById('popup-insert').style.display = 'block';
                document.getElementById('popup-search-insert').style.display = 'none';
            }
        });
        
        document.getElementById('popup-search-clear').addEventListener('click', function () {
            document.getElementById('popup-search-input').value = '';
            document.getElementById('popup-search-input').focus();
            document.getElementById('popup-insert').style.display = 'block';
            document.getElementById('popup-search-insert').style.display = 'none';
            document.getElementById('popup-search-insert').textContent = '';
        });
        
        document.getElementById('popup-search-input').focus();
    } else {
        document.getElementById('popup-header').style.display = 'none';
        var titles = document.querySelectorAll('.popup-title');
        if (titles.length > 0) {
            titles[0].style.marginTop = '10px';
        }
    }

    // Alert holder
    document.getElementById('alert-holder').addEventListener('click', function () {
        this.style.display = 'none';
    });
}

// Helper function to create elements
function createElement(tag, attributes, parentId) {
    var element = document.createElement(tag);
    for (var key in attributes) {
        if (key === 'innerHTML') {
            element.innerHTML = attributes[key];
        } else {
            element.setAttribute(key, attributes[key]);
        }
    }
    document.getElementById(parentId).appendChild(element);
    return element;
}

// Get version
function getVersion() {
    return '3.1.13';
}

// Return language text (simplified version)
function returnLang(key) {
    const messages = {
        'successfullyInstalled': 'Successfully Installed',
        'recentHistory': 'Recent History',
        'recentlyClosedTabs': 'Recently Closed Tabs',
        'recentBookmarks': 'Recent Bookmarks',
        'mostVisited': 'Most Visited',
        'recentTabs': 'Recent Tabs',
        'more': 'More'
    };
    return messages[key] || key;
}

// Chrome URL helper
function chromeURL(url) {
    if (url.startsWith('/')) {
        chrome.tabs.create({ url: chrome.runtime.getURL(url.substring(1)) });
    } else {
        chrome.tabs.create({ url: url });
    }
}

// Alert user function
function alertUser(msg, action) {
    var alertHolder = document.getElementById('alert-holder');
    alertHolder.innerHTML = msg;
    alertHolder.style.display = 'block';
    
    if (action === 'open') {
        setTimeout(function() {
            alertHolder.style.display = 'none';
        }, 3000);
    }
}

// Include the rest of the functions from func.js that are needed
// These would need to be adapted for MV3 compatibility
function recentHistory() {
    // Implementation would go here
    console.log('Recent history function called');
}

function recentlyClosedTabs() {
    // Implementation would go here
    console.log('Recently closed tabs function called');
}

function showRecentTabs() {
    // Implementation would go here
    console.log('Show recent tabs function called');
}

function recentBookmarks() {
    // Implementation would go here
    console.log('Recent bookmarks function called');
}

function mostVisited() {
    // Implementation would go here
    console.log('Most visited function called');
}

function popupSearch(query) {
    // Implementation would go here
    console.log('Popup search function called with query:', query);
}