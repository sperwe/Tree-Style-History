
document.addEvent('domready', function () {

    // Updated/Installed

    if (localStorage['rh-version-' + getVersion()] !== 'true') {
        alertUser(returnLang('successfullyInstalled') + '<span>v' + getVersion() + '</span>', 'open');
        localStorage['rh-version-' + getVersion()] = 'true';
    }

    // if (localStorage['show-popup'] != 'yes') {
    //     window.open("history2.html");
    //     window.close();
    // }

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

        case 'notes':
            window.open("notes.html");
            window.close();
            break;

        case 'options':
            window.open("options.html");
            window.close();
            break;

    }


    // Ctrl listener

    $(document.body).addEvent('keydown', function (e) {
        if (e.event.keyCode == 17 && ctrlState == 'false') {
            ctrlState = 'true';
        }
    });
    $(document.body).addEvent('keyup', function (e) {
        if (e.event.keyCode == 17) {
            ctrlState = 'false';
        }
    });

    // Popup structure

    var rhporder = localStorage['rh-list-order'].split(',');
    
    // Ensure new items from default are included (for users with existing settings)
    var defaultOrder = "nm-order,rh-order,rct-order,rn-order,rb-order,mv-order,rt-order".split(',');
    
    // Special handling for nm-order - ensure it's at the beginning
    var nmIndex = rhporder.indexOf('nm-order');
    if (nmIndex === -1) {
        // Not found, add at beginning
        rhporder.unshift('nm-order');
    } else if (nmIndex > 0) {
        // Found but not at beginning, move to beginning
        rhporder.splice(nmIndex, 1);
        rhporder.unshift('nm-order');
    }
    
    // Add other missing items at the end
    for (var i in defaultOrder) {
        if (defaultOrder[i] !== 'nm-order' && rhporder.indexOf(defaultOrder[i]) < 0) {
            rhporder.push(defaultOrder[i]);
        }
    }

    for (var o in rhporder) {
        if (rhporder[o] == 'rh-order') {
            if ((localStorage['rh-itemsno'] * 1) > 0) {
                new Element('div', { id: 'rh-inject', html: '<div id="rh-inject-title" class="popup-title"><span>' + returnLang('recentHistory') + '	- <a href="#"  id="show-all-history" target="_blank">' + returnLang('more') + '🕑</a></span></div>' }).inject('popup-insert', 'bottom');
            }
        } else if (rhporder[o] == 'rct-order') {
            if ((localStorage['rct-itemsno'] * 1) > 0 ) {
                if (navigator.userAgent.toLowerCase().indexOf('edg') > 0) {
                    new Element('div', { id: 'rct-inject', html: '<div id="rct-inject-title" class="popup-title"><span>' + returnLang('recentlyClosedTabs') + '	- <a href="#"  id="show-all-closed" target="_blank">' + returnLang('more') + '...</a></span></div>' }).inject('popup-insert', 'bottom');
                } else {
                    new Element('div', { id: 'rct-inject', html: '<div id="rct-inject-title" class="popup-title"><span>' + returnLang('recentlyClosedTabs') + '</span></div>' }).inject('popup-insert', 'bottom');
                }
            }
        } else if (rhporder[o] == 'rb-order') {
            if ((localStorage['rb-itemsno'] * 1) > 0) {
                new Element('div', { id: 'rb-inject', html: '<div id="rb-inject-title" class="popup-title"><span>' + returnLang('recentBookmarks') + '	- <a href="#"  id="show-all-bookmark" target="_blank">' + returnLang('more') + '...</a></span></div>' }).inject('popup-insert', 'bottom');
            }
        } else if (rhporder[o] == 'mv-order') {
            if ((localStorage['mv-itemsno'] * 1) > 0) {
                new Element('div', { id: 'mv-inject', html: '<div id="mv-inject-title" class="popup-title"><span>' + returnLang('mostVisited') + '</span></div>' }).inject('popup-insert', 'bottom');
            }
        }  else if (rhporder[o] == 'rt-order') {
            // rt = recent tab
            if ((localStorage['rt-itemsno'] * 1) > 0 && chrome.extension.getBackgroundPage().recentTabs.length > 0) {
               new Element('div', { id: 'rt-inject', html: '<div id="rt-inject-title" class="popup-title"><span>' + returnLang('recentTabs') + '</span></div>' }).inject('popup-insert', 'bottom');
            }
        } else if (rhporder[o] == 'rn-order') {
            // rn = recent notes
            if ((localStorage['rn-itemsno'] * 1) > 0) {
                new Element('div', { id: 'rn-inject', html: '<div id="rn-inject-title" class="popup-title"><span>' + returnLang('recentNotes') + ' - <a href="#" id="show-all-notes" target="_blank">' + returnLang('more') + '📝</a></span></div>' }).inject('popup-insert', 'bottom');
            }
        } else if (rhporder[o] == 'nm-order') {
            // nm = note manager
            new Element('div', { 
                id: 'nm-inject', 
                html: '<div id="nm-inject-title" class="popup-title"><span>' + returnLang('noteManager') + '</span></div>' +
                      '<div class="manager-buttons">' +
                      '<button class="manager-btn icon-only" id="floating-manager-btn" title="' + returnLang('floatingManager') + '">📝</button>' +
                      '<button class="manager-btn icon-only" id="tab-manager-btn" title="' + returnLang('tabManager') + '">📑</button>' +
                      '</div>'
            }).inject('popup-insert', 'bottom');
        }
    }

    // Assign events

    if ($('show-all-history') != undefined)
        $('show-all-history').addEvent('click', function () {
            if (localStorage['rm-click'] == 'this')
                chromeURL('/history2.html');
            else
                chromeURL('chrome://history/');
        });

    if ($('show-all-bookmark') != undefined)
        $('show-all-bookmark').addEvent('click', function () {
            if (localStorage['rm-click'] == 'this')
                chromeURL('/bookmark.html');
            else
                chromeURL('chrome://favorites/');
        });

    if ($('show-all-closed') != undefined)
        $('show-all-closed').addEvent('click', function () {
            if (localStorage['rm-click'] == 'this')
                chromeURL('/closed.html');
            else
                chromeURL('chrome://history/recentlyClosed');
        });

    if ($('show-all-notes') != undefined)
        $('show-all-notes').addEvent('click', function () {
            if (localStorage['rm-click'] == 'this')
                chromeURL('/notes.html');
            else
                window.open('/notes.html');
        });

    // Note Manager buttons
    if ($('floating-manager-btn') != undefined)
        $('floating-manager-btn').addEvent('click', function () {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs && tabs.length > 0) {
                    // 某些特殊页面（如chrome://或edge://）不能注入content script
                    const tab = tabs[0];
                    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || 
                        tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://'))) {
                        // 特殊页面，直接在新标签页打开
                        chrome.tabs.create({url: chrome.extension.getURL('note-manager.html')});
                        window.close();
                    } else {
                        // 尝试发送消息到content script
                        chrome.tabs.sendMessage(tab.id, {action: 'openNoteManager', mode: 'floating'}, function(response) {
                            if (chrome.runtime.lastError) {
                                console.error('Failed to send message:', chrome.runtime.lastError);
                                // 如果content script未加载，在新标签页打开
                                chrome.tabs.create({url: chrome.extension.getURL('note-manager.html')});
                            }
                            window.close();
                        });
                    }
                } else {
                    // 没有活动标签页，在新标签页打开
                    chrome.tabs.create({url: chrome.extension.getURL('note-manager.html')});
                    window.close();
                }
            });
        });

    if ($('tab-manager-btn') != undefined)
        $('tab-manager-btn').addEvent('click', function () {
            chrome.tabs.create({url: chrome.extension.getURL('note-manager.html')});
            window.close();
        });

    // Popup init

    // -- Insert
    if ($('rh-inject')) { recentHistory(); }
    if ($('rct-inject')) { recentlyClosedTabs(); }
    if ($('rt-inject')) { showRecentTabs(); }
    if ($('rb-inject')) { recentBookmarks(); }
    if ($('mv-inject')) { mostVisited(); }
    if ($('rn-inject')) { recentNotes(); }

    // $$("#rt-inject-title .item[target]").each(function (el, i) {
    //     if (i !== 0) {
    //         el.addEvent('click', function () {
    //             openTab(el.tabId);
    //         });
    //     }
    // });
    
    

    // -- Functions
    $$('.favicon').addEvent('error', function () {
        this.setProperty('src', 'images/blank.png');
    });

    // -- Width
    $(document.body).setStyle('width', localStorage['rh-width']);

    // -- Titles
    $$('.popup-title').each(function (el, i) {
        if (i !== 0) {
            el.setStyle('margin-top', '6px');
        }
    });

    // -- Search
    if (localStorage['rh-search'] == 'yes') {
        $('popup-search-input').addEvent('keyup', function () {
            var sv = this.get('value');
            if (sv.length + sv.replace(/[0-9a-zA-Z]+/g, '').length >= 2) {
                popupSearch(sv);
                $('popup-insert').setStyle('display', 'none');
                $('popup-search-insert').setStyle('display', 'block');
            } else {
                $('popup-insert').setStyle('display', 'block');
                $('popup-search-insert').setStyle('display', 'none');
            }
        });
        $('popup-search-clear').addEvent('click', function () {
            $('popup-search-input').set('value', '');
            $('popup-search-input').focus();
            $('popup-insert').setStyle('display', 'block');
            $('popup-search-insert').setStyle('display', 'none');
            $('popup-search-insert').set('text', '');
        });
        $('popup-search-input').focus();
    } else {
        $('popup-header').setStyle('display', 'none');
        if ($$('.popup-title').length > 0) {
            $$('.popup-title')[0].setStyle('margin-top', '10px');
        }
    }

    // -- Alert holder
    $('alert-holder').addEvent('click', function () {
        this.setStyle('display', 'none');
    });

    // -- Scrollbar fix
    //popup_scrollbar_fix.periodical(250);

});

// Recent Notes Function
function recentNotes() {
    var bg = chrome.extension.getBackgroundPage();
    var db = bg && bg.db;
    var itemsno = localStorage['rn-itemsno'] * 1;
    
    if (!db || itemsno <= 0) return;
    
    var tx = db.transaction(["VisitNote"], "readonly");
    var store = tx.objectStore("VisitNote");
    var req = store.getAll ? store.getAll() : null;
    
    if (req) {
        req.onsuccess = function(e) {
            var notes = e.target.result || [];
            renderNotesInPopup(notes, itemsno);
        };
        req.onerror = function() {
            console.error('Failed to load notes for popup');
        };
    } else {
        var out = [];
        store.openCursor().onsuccess = function(e) {
            var c = e.target.result;
            if (c) {
                out.push(c.value);
                c.continue();
            } else {
                renderNotesInPopup(out, itemsno);
            }
        };
    }
}

function renderNotesInPopup(notes, itemsno) {
    if (notes.length === 0) return;
    
    // Sort by updatedAt desc
    notes.sort(function(a, b) {
        return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    
    // Limit to itemsno
    notes = notes.slice(0, itemsno);
    
    // Get titles for notes
    var bg = chrome.extension.getBackgroundPage();
    var db = bg && bg.db;
    if (!db) return;
    
    var tx = db.transaction(["VisitItem"], "readonly");
    var store = tx.objectStore("VisitItem");
    var processed = 0;
    
    notes.forEach(function(note, index) {
        var req = store.get(note.visitId);
        req.onsuccess = function(e) {
            var visitItem = e.target.result;
            var title = (visitItem && visitItem.title) ? visitItem.title : note.url;
            var url = note.url || '';
            
            // Format first line as preview
            var noteText = note.note || '';
            var firstLine = noteText.split(/\r?\n/)[0];
            if (firstLine.length > 50) firstLine = firstLine.slice(0, 50) + '…';
            
            // Count selections
            var excerptCount = 0;
            excerptCount += (noteText.match(/---\n\*Added on /g) || []).length;
            excerptCount += (noteText.match(/\*摘录自:/g) || []).length;
            if (excerptCount === 0 && noteText.trim()) excerptCount = 1;
            
            var displayTitle = title;
            if (firstLine) {
                displayTitle = title + ': ' + firstLine;
            }
            if (excerptCount > 1) {
                displayTitle += ' [' + excerptCount + ' selections]';
            }
            
            // Format time
            var timeStr = '';
            if (note.updatedAt) {
                try {
                    timeStr = new Date(note.updatedAt).toLocaleString();
                } catch (e) {
                    timeStr = '';
                }
            }
            
            // Create formatted item for popup
            var formattedItem = formatItem({
                type: 'rn',
                url: url,
                title: displayTitle,
                favicon: 'chrome://favicon/' + url,
                time: timeStr
            });
            
            formattedItem.inject('rn-inject', 'bottom');
            
            processed++;
        };
        req.onerror = function() {
            processed++;
        };
    });
}
