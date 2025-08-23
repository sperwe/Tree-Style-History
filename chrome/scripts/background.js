
// Set global vars

var openedTabs = {};
// var closedTabs = [];

// 最近访问的tab的tabId构成的数组
var recentTabs = [];


// Opened tab

function openedTab(tab) {
    openedTabs[tab.id] = tab;
    addCloseRedord(tab.id, tab.url, tab.title, 0, -1);
}


// Closed tab

function closedTab(id) {
    if (openedTabs[id] !== undefined) {
        console.log('close ' + id + ' ' + openedTabs[id].url);
        addCloseRedord(id, openedTabs[id].url, openedTabs[id].title, (new Date()).getTime(), 0);
        openedTabs[id].time = timeNow(0);
        // closedTabs.unshift(openedTabs[id]);

        var i = recentTabs.indexOf(id);
        if (i >= 0) {
            recentTabs.splice(i, 1);
        }
    }
}


// 正常添加关闭页面的记录的方法。自动记录时间
// close<0 未关闭页面  close==0 正常关闭  close >0 不正常关闭
function addCloseRedord(tid, url, title, time, close) {

    if ((/^(http|https)\:\/\/(.*)/).test(url) && url != title && title != '') {

        var transaction = db.transaction(["closed"], "readwrite");
        transaction.oncomplete = function (event) {

        };

        transaction.onerror = function (event) {

        };
        var objectStore = transaction.objectStore("closed");

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


function updateClosed() {

    let time = (new Date()).getTime();

    var t = db.transaction(['closed'], 'readonly');
    var store = t.objectStore('closed');
    var index = store.index('close');

    var range = IDBKeyRange.upperBound(-1);

    index.openCursor(range).onsuccess = function (e) {
        var cursor = e.target.result;
        if (cursor) {
            /*         console.log(cursor.key + ':');
                
                    for (var field in cursor.value) {
                      console.log(cursor.value[field]);
                    } */

            let v = cursor.value;
            v.closeTime = time;
            v.close = 0 - v.close;
            {
                var request = db.transaction(['closed'], 'readwrite')
                    .objectStore('closed')
                    .put(v);

                request.onsuccess = function (event) {
                    console.log('updateClosed() succeed ' + v.id);
                };

                request.onerror = function (event) {
                    console.log('updateClosed() fail ' + v.id);
                }
            }
            cursor.continue();
        } else {
            console.log('updateClosed() done ');
        }
    }

}

// Updated tab

function updatedTab(tab) {
    if (tab.status == 'complete') {
        if (openedTabs[tab.id] !== undefined) {

            if (openedTabs[tab.id].url != tab.url || openedTabs[tab.id].title != tab.title) {
                addCloseRedord(tab.id, tab.url, tab.title, 0, -2);
            }
            openedTabs[tab.id].title = tab.title;
            openedTabs[tab.id].url = tab.url;
        }
    }
}



console.log("loading...");

// 初始化oid参数
var oid = localStorage['oid'];
if (oid == undefined)
    oid = 1;
else
    oid++;
localStorage['oid'] = oid;


// 

var DAY = 24 * 3600 * 1000;
var date = new Date();
date.setHours(23); date.setMinutes(59); date.setSeconds(59); date.setMilliseconds(999);

var calendar_str = localStorage['calendar-storage'];

var calendar = {};

var calendar_r = {};

if (calendar_str) {
    calendar = JSON.parse(calendar_str);
}


var MAX = Number.MAX_VALUE - 1;
var urls_wait_load = new Array();

var request, db;
openDb();


function openDb() {
    request = window.indexedDB.open("testDB", 7);
    request.onerror = function (event) {
        console.log("Error opening DB", event);
    }
    request.onupgradeneeded = function (event) {
        console.log("Upgrading");
        db = event.target.result;

        try {
            var objectStore = db.createObjectStore("VisitItem", { keyPath: "visitId" });
            objectStore.createIndex('url', 'url', { unique: false });
            objectStore.createIndex('visitTime', 'visitTime', { unique: false });
            objectStore.createIndex('referringVisitId', 'referringVisitId', { unique: false });
            objectStore.createIndex('title', 'title', { unique: false });
            objectStore.createIndex('transition', 'transition', { unique: false });
        } catch {
            console.log('Error in createObjectStore("VisitItem", { keyPath: "visitId" });');
        }

        try {
            var objectStore2 = db.createObjectStore("urls", { keyPath: "id" });
            objectStore2.createIndex('url', 'url', { unique: false });
            objectStore2.createIndex('lastVisitTime', 'lastVisitTime', { unique: false });
            // objectStore2.createIndex('visitCount', 'visitCount', { unique: false });
            objectStore2.createIndex('title', 'title', { unique: false });
            objectStore2.createIndex('from_to', ['loadfrom', 'loadto'], { unique: false });
        } catch {
            console.log('Error in createObjectStore("urls", { keyPath: "id" })');
        }

        try {
            // closed表  记录关闭的标签页，自动递增主键
            var objectStore3 = db.createObjectStore("closed", { keyPath: "id"/* , autoIncrement: true */ });
            objectStore3.createIndex('url', 'url', { unique: false });
            objectStore3.createIndex('title', 'title', { unique: false });
            // objectStore3.createIndex('oid', 'oid', { unique: false });
            // objectStore3.createIndex('tid', 'tid', { unique: false });
            objectStore3.createIndex('closeTime', 'closeTime', { unique: false });
            // objectStore3.createIndex('normalClose', 'normalClose', { unique: false });
            objectStore3.createIndex('close', 'close', { unique: false });
        } catch {
            console.log('Error in createObjectStore("closed", { autoIncrement: true }');
        }

        try {
            // VisitNote: key is visitId to match VisitItem, store note text and url
            var noteStore = db.createObjectStore("VisitNote", { keyPath: "visitId" });
            noteStore.createIndex('url', 'url', { unique: false });
            noteStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        } catch (e) {
            console.log('VisitNote store may already exist:', e && e.message);
        }

    };
    request.onsuccess = function (event) {
        console.log("Success opening DB");
        db = event.target.result;

        // only for debug
        if (db != undefined){
            updateClosed();
            loadDate(date.getTime(), 0);
        }

    }
}



function deleteDb() {
    db.close();
    localStorage['calendar-storage'] = '';
    var DBDeleteRequest = window.indexedDB.deleteDatabase('testDB');

    DBDeleteRequest.onerror = function (event) {
        // console.log('Error deleteDb');
        alert(returnLang('saveFail'));

    };

    DBDeleteRequest.onsuccess = function (event) {
        // console.log('success deleteDb');
        alert(returnLang('done'));
        openDb();
    };

}


// Most visited init

var mostVisitedInit = function () {

    var mv = [];
    var infmv = 45;
    var r = 0;




    chrome.history.search({ text: '', maxResults: 0, startTime: (new Date()).getTime() - (28 * 24 * 3600 * 1000), endTime: (new Date()).getTime() }, function (hi) {



        if (hi.length > 0) {

            hi.sort(function (a, b) { return b.visitCount - a.visitCount });

            for (i = 0; i < 99; i++) {

                if (r == infmv) { break; }

                if (hi[i] !== undefined) {

                    if ((/^(http|https|ftp|ftps|file|chrome|chrome-extension|chrome-devtools)\:\/\/(.*)/).test(hi[i].title) == false && (/^(ftp|ftps|file|chrome|chrome-extension)\:\/\/(.*)/).test(hi[i].url) == false) {

                        var currentTime = new Date(hi[i].lastVisitTime);
                        var hours = currentTime.getHours();
                        var minutes = currentTime.getMinutes();
                        if (hours < 10) { hours = '0' + hours; }
                        if (minutes < 10) { minutes = '0' + minutes; }
                        var time = hours + ':' + minutes;

                        var title = hi[i].title;
                        var url = hi[i].url;
                        var furl = 'chrome://favicon/' + hi[i].url;

                        if (title == '') {
                            title = url;
                        }

                        //    add_history(url,title);
                        // add_url(hi[i].id, url, title, hi[i].lastVisitTime, hi[i].visitCount);
                        //    console.log("url="+url+" ");
                        mv.push({ url: url, favicon: furl, title: title.replace(/\"/g, '&#34;'), visitCount: hi[i].visitCount });

                        r++;
                    }

                }

            }

            localStorage['mv-cache'] = JSON.encode(mv);

        } else {
            localStorage['mv-cache'] = 'false';
        }

    });

};


// Default values

defaultConfig(false);
// updateFilter();

// Listeners


chrome.commands.onCommand.addListener(function (command) {
    console.log('Command:', command);
    if (command == "open_history2") {
        window.open("history2.html");
    } else if (command == "open_history1") {
        window.open("history.html");
    } else if (command == "open_closed") {
        window.open("closed.html");
    } else if (command == "open_bookmark") {
        window.open("bookmark.html");
    }
});

// 实时 新建tab时生成记录从哪个tab打开的，读取其url并计入缓存.使用一次后销毁
// 实时 tab更新时更新tab的url
// 延迟 tab载入成功后存储visitItem，并记录载入url的visitId，如果需要补充ref

var openerJson = {};    // tab.id : url
var tabUrlJson = {};    // tab.id : tab.url
var tabUrl0Json = {};    // tab.id :  tab.url 0
var urlIdJson = {};     // url : visitId 
var idUrlJson = {};     // visitId : url
// var HistoryItem


chrome.tabs.onRemoved.addListener(function (id) { closedTab(id) });
chrome.tabs.onCreated.addListener(function (tab) {
    openedTab(tab);

    if (tab.openerTabId != undefined && (/^(ftp|ftps|file|chrome|edge|chrome-extension)\:\/\/(.*)/).test(tab.url) == false
    ) {
        if (tab.openerTabId > 0 && tab.id != tab.openerTabId) {
            if (tabUrlJson[tab.openerTabId.toString()] != undefined) {
                openerJson[tab.id.toString()] = tabUrlJson[tab.openerTabId.toString()];
                console.log("chrome.tabs.onCreated " + tab.openerTabId + " -> " + tab.id + "; " + openerJson[tab.id.toString()] + " -> " + tab.url + ";");
            }
        }
    }

    // visitTab(tab,tabJson[tab.openerTabId.toString()]);
    /*     
    屏蔽替换默认历史页的功能
    if (localStorage['rh-historypage'] == 'yes' && (tab.url == 'chrome://history/' || ('pendingUrl' in tab && tab.pendingUrl == 'chrome://history/'))) {
        chrome.tabs.update(tab.id, { url: 'history2.html', selected: true }, function () { });
    } */
});


var tabActive = 0;
var tab

chrome.tabs.onUpdated.addListener(function (id, info, tab) {
    // console.log("chrome.tabs.onUpdated "+tab.id +" "+id);

    if (tabUrlJson[id.toString()] != tab.url) {
        if (tabUrlJson[id.toString()] != undefined)
            tabUrl0Json[id.toString()] = tabUrlJson[id.toString()];
        tabUrlJson[id.toString()] = tab.url;
    }

    if (info.status == "complete") {
        console.log("chrome.tabs.onUpdated v " + tab.openerTabId + " -> " + tab.id + "; " + openerJson[tab.id.toString()] + " -> " + tab.url + "; title=" + tab.title);
        visitTab(tab);
    } else {
        // console.log("chrome.tabs.onUpdated - " + tab.openerTabId + " -> " + tab.id + "; "  + openerJson[tab.id.toString()] + " -> " + tab.url + "; title=" + tab.title);
    }

    updatedTab(tab);

    if (getVersionType() == 'pageAction') {
        chrome.pageAction.show(id);
    }
});



chrome.tabs.onActivated.addListener(function (activeInfo) {
    var i = recentTabs.indexOf(activeInfo.tabId);
    if (i >= 0) {
        recentTabs.splice(i, 1);
    }
    recentTabs.unshift(activeInfo.tabId);
});



/* 
only get historyItem, not visitItem, without visitId, useless
chrome.history.onVisited.addListener(function(historyItem) {
    console.log("chrome.tabs.onUpdated onVisited [" + historyItem.id  + " url=" + historyItem.url + "; title=" + historyItem.title);

});
 */
// Startup

mostVisitedInit();
mostVisitedInit.periodical(3 * 60 * 1000);

if (getVersionType() == 'pageAction') {
    chrome.windows.getAll({}, function (wins) {
        for (var i in wins) {
            if (wins[i].id !== undefined) {
                chrome.tabs.getAllInWindow(wins[i].id, function (tabs) {
                    for (var n in tabs) {
                        if (tabs[n].id !== undefined) {
                            chrome.pageAction.show(tabs[n].id);
                            openedTab(tabs[n]);
                        }
                    }
                });
            }
        }
    });



}





// 对访问历史逐天进行查询，并保存到localStorage中。由于数据库异步操作，通过add_urls()嵌套调用查询全部历史

function loadDate(date, dateId) {

    if (dateId > localStorage['load-range']) {

        console.log("loadDate done. dateId = " + dateId + ">" + localStorage['load-range']);

        localStorage['calendar-storage'] = JSON.encode(calendar_r);
        chrome.browserAction.setBadgeText({ text: "Url" });
        loadHistory();
        return;
    }


    chrome.browserAction.setBadgeText({ text: "D" + (localStorage['load-range'] - dateId) });



    // dateId=0 , date = toDay.end.ms
    // dateId=1 , date = lastDay.end.ms ,
    let dday = "d" + (date + DAY).toString();
    let qday = "d" + date;



    if (dateId > 1) {
        calendar[dday] = true;
    }

    // if(calendar[dday]==undefined){

    calendar_r[dday] = calendar[dday];


    if (calendar[qday]) {
        console.log("skip dday=" + dday + ":" + calendar[dday] + " qday=" + qday + ":" + calendar[qday]);
        add_urls([], date, dateId, 0);
    } else {
        console.log("load dday=" + dday + ":" + calendar[dday] + " qday=" + qday + ":" + calendar[qday]);
        let obj = { text: '', maxResults: 0, startTime: date - (24 * 3600 * 1000), endTime: date };
        chrome.history.search(obj, function (hi) {

            if (hi.length > 0) {
                hi.sort(function (a, b) { return b.visitCount - a.visitCount });
                save_calendar_storage2(obj, hi.length, false);
            }

            add_urls(hi, date, dateId, 0);
        });
    }
}

// 对访问历史进行解析，并保存到数据库中。由于数据库异步操作，每次调用只解析一笔，通过嵌套调用解析全部历史
// hi 搜索列表   i 处理哪笔url 
// date 日期（毫秒）  dateID 第几天 这2个参数用于传递给嵌套的方法 
function add_urls(urls, date_ms, dateId, i) {

    let h_len = urls.length;

    if (i >= h_len) {
        if (h_len < 1)
            console.log("dateId=" + dateId + " loadDate(" + (new Date(date_ms)).toString() + ") no data");
        else
            console.log("dateId=" + dateId + " loadDate(" + (new Date(date_ms)).toString() + ") done");
        loadDate(date_ms - DAY, dateId + 1);
    } else if (urls[i] != undefined) {


        if ((/^(http|https|ftp|ftps|file|chrome|chrome-extension|chrome-devtools)\:\/\/(.*)/).test(urls[i].title) == false && (/^(ftp|ftps|file|chrome|chrome-extension)\:\/\/(.*)/).test(urls[i].url) == false) {

            var title = urls[i].title;
            var url = urls[i].url;

            if (title == '') {
                title = url;
            }


            var transaction = db.transaction(["urls"], "readwrite");
            transaction.oncomplete = function (event) {
                // console.log("v dateId=" + dateId + " i=" + i +"/" + h_len + " url=" + url);
                add_urls(urls, date_ms, dateId, i + 1);
            };

            transaction.onerror = function (event) {
                console.log("add_url Error :( [" + visitCount + "] " + url);
            };

            var objectStore = transaction.objectStore("urls");

            objectStore.put({
                id: urls[i].id,
                url: url,
                lastVisitTime: urls[i].lastVisitTime,
                visitCount: urls[i].visitCount,
                title: title
            });

        } else {
            console.log("x dateId=" + dateId + " i=" + i + "/" + h_len + " url=" + url);
            add_urls(urls, date_ms, dateId, i + 1);
        }

    } else {
        console.log("add_urls hi[i] = null, i=" + i);
    }
}


// 对一个url全部解析完成后，更新数据库记录，下次自动跳过
function update_urls(u, loadfrom, loadto, urls_p) {

    var transaction = db.transaction(["urls"], "readwrite");
    transaction.oncomplete = function (event) {
        // console.log("v dateId=" + dateId + " i=" + i +"/" + h_len + " url=" + url);
        // add_urls(hi, date, dateId, i + 1);
        // 这里有错误应该
        getVisits(urls_p + 1);
    };

    transaction.onerror = function (event) {
        console.log("update_urls Error :( " + u.url);
    };

    var objectStore = transaction.objectStore("urls");

    u.loadfrom = loadfrom;
    u.loadto = loadto;
    objectStore.put(u);
}

// 把合乎条件的url塞到列表中，如果在数据库中检索后确认需要更新，再进行更新。此方法只完成列表。

function loadHistory() {

    var transaction = db.transaction(["urls"], "readwrite");
    var objectStore = transaction.objectStore("urls");
    // 索引，最后的访问时间大于日期上限
    let result = objectStore.index('lastVisitTime');
    let time = (new Date()).getTime() - DAY * (localStorage["load-range"]);
    console.log("loadHistory time from " + new Date(time).toString());
    // 打开游标
    let c = result.openCursor(IDBKeyRange.lowerBound(time));
    c.onsuccess = function (e) {
        var cursor = e.target.result;
        if (cursor != undefined) {

            // loadto是url缓存的最新时间。未缓存，需要补充；已缓存，处理下个url
            let time2 = cursor.value.loadto;

            if (time2 == undefined)
                urls_wait_load.push(cursor.value);
            else if (time2 < cursor.value.lastVisitTime)
                urls_wait_load.push(cursor.value);

            cursor.continue();
        } else {
            getVisits(0);
        }

    }

    c.onerror = function (event) {
        console.log(" loadHistory() Error :( " + event);
    };


}

var visitItems_wait_remove = new Array();

function removeHistory() {

    chrome.browserAction.setBadgeText({ text: "Del" });


    var transaction = db.transaction(["VisitItem"], "readwrite");
    var objectStore = transaction.objectStore("VisitItem");
    // 索引，最后的访问时间小于日期上限
    let result = objectStore.index('visitTime');
    let time = (new Date()).getTime() - DAY * (localStorage["load-range3"]);
    console.log("removeHistory time from " + new Date(time).toString());

    let c = result.openCursor(IDBKeyRange.upperBound(time));

    c.onsuccess = function (e) {
        var cursor = e.target.result;

        if (cursor == undefined) {

            if (visitItems_wait_remove.length < 1) {
                console.log(" removeHistory() done.");
                chrome.browserAction.setBadgeText({ text: " " });
            } else {
                console.log(" removeHistory() removing " + visitItems_wait_remove.length);
                removeVisitItem(0);
            }

        } else if (visitItems_wait_remove.length > 200) {

            console.log(" removeHistory() removing " + visitItems_wait_remove.length);
            removeVisitItem(0);

        } else {

            visitItems_wait_remove.push(cursor.value);
            cursor.continue();

        }
    }

    c.onerror = function (event) {
        console.log(" removeHistory() Error :( " + event);
    };


}

function removeVisitItem(i) {

    if (i >= visitItems_wait_remove.length) {
        removeHistory();
    } else {

        var transaction = db.transaction(["VisitItem"], "readwrite");
        transaction.oncomplete = function (event) {
            console.log("del Success :) ");
            removeVisitItem(i);
        };

        transaction.onerror = function (event) {
            console.log("del Error :( " + event);
        };
        var objectStore = transaction.objectStore("VisitItem");
        objectStore.delete(visitItems_wait_remove[i].visitId);;
    }
}




// 解析url的每次访问记录
// h  此url的访问列表  i 进度  v 此url对应的json对象 
// function add_history(h, i, v, hi, date, dateId) {

// urls_p  urls_wait_load的指针
function getVisits(urls_p) {
    if (urls_p >= MAX) {
        console.log("visitTab done.");
        return;
    }
    if (urls_p >= urls_wait_load.length) {
        chrome.browserAction.setBadgeText({ text: "" });
        console.log("getVisits done.");
        return;
    }
    chrome.browserAction.setBadgeText({ text: (urls_wait_load.length - urls_p).toString() });

    let url_item = urls_wait_load[urls_p];
    let details = { url: url_item.url };
    chrome.history.getVisits(details, function (h) {
        let h_len = h.length;
        if (h_len < 1)
            console.log("getVisits() no data, url=" + details.url);
        else {
            h.sort(function (a, b) { return b.visitTime - a.visitTime });

            let loadfrom = (new Date()).getTime() - DAY * (localStorage["load-range"]);

            add_history(urls_p, 0, h, loadfrom, url_item);
        }

    })

}

// 解析1个url的全部访问记录
// urls_p 第几个url
// i 第几个访问记录
// visitItems 访问记录列表
// loadfrom 解析时间深度（不处理早于这个时间的访问记录）
// url_item url对象（因为visitItems不包含标题）


function add_history(urls_p, i, visitItems, loadfrom, url_item) {

    if (visitItems.length > i) {

        // if (visitItems[i] != undefined) {
        // h[i].visitId, h[i].referringVisitId, h[i].visitTime
        // console.log("referringVisitId = " + referringVisitId);

        let visitTime = visitItems[i].visitTime;
        let visitId = visitItems[i].visitId;
        let refer = visitItems[i].referringVisitId;

        // let timeStr = (new Date(visitTime)).toLocaleString();
        let transition = visitItems[i].transition;


        if (transition == "typed" || transition == "auto_bookmark" || transition == "keyword" || transition == "keyword_generated") {
            console.log("change refer " + visitItems[i].referringVisitId + "->0 cause transition=" + transition);
            refer = 0;
        }

        if (refer == undefined)
            refer = 0;

        console.log("refer " + visitItems[i].referringVisitId + ", transition=" + transition);


        if (visitTime < loadfrom) {
            console.log("add_history() time=" + visitTime + " < " + loadfrom.toString + ", url=" + visitItems[i].url);
            update_urls(url_item, loadfrom, visitItems[0].visitTime, urls_p);
            return;
        }

        var transaction = db.transaction(["VisitItem"], "readwrite");
        transaction.oncomplete = function (event) {
            console.log("Success :) " + refer + " -> " + visitId + " [" + url_item.visitCount + "] " + url_item.url);
            add_history(urls_p, i + 1, visitItems, loadfrom, url_item);
        };

        transaction.onerror = function (event) {
            console.log("Error :( [" + visitId + "] " + url_item.url + " " + event);
            add_history(urls_p, i + 1, visitItems, loadfrom, url_item);
        };
        var objectStore = transaction.objectStore("VisitItem");

        // console.log("referringVisitId = " + refer);
        // objectStore.put({
        objectStore.add({
            visitId: visitId,
            referringVisitId: refer,
            url: url_item.url,
            visitTime: visitTime,
            title: url_item.title,
            transition: transition,
            // time: timeStr
        });
    } else {
        update_urls(url_item, loadfrom, visitItems[0].visitTime, urls_p);
        console.log("add_history i=" + i + " > visitItems.length");
    }

}


// 即时缓存浏览器记录
function visitTab(tab) {

    let url = tab.url;

    if (url == undefined || url == "")
        return;

    /* 
if(referTabId>0 && tab.id != referTabId){
    // tabJson[tab.id.toString()]=tab.openerTabId;   
    console.log("chrome.tabs.onCreated id="+tab.openerTabId+" -> "+tab.id );
}else{
    console.log("chrome.tabs ??? id="+tab.openerTabId+" -> "+tab.id );
}
*/
    console.log("visitTab()  tabId=" + tab.openerTabId + " -> " + tab.id + " url=" + url);

    if ((/^(http|https|ftp|ftps|file|chrome|chrome-extension|chrome-devtools)\:\/\/(.*)/).test(tab.title) == false && (/^(ftp|ftps|file|chrome|chrome-extension)\:\/\/(.*)/).test(tab.url) == false) {
        let now = new Date();
        if (new Date() - date > DAY)
            date = date + DAY;

        let details = { url: tab.url };
        chrome.history.getVisits(details, function (h) {
            let h_len = h.length;
            if (h_len < 1)
                console.log("visitTab(" + tab.id + ") no data, url=" + tab.url);
            else {
                h.sort(function (a, b) { return b.visitTime - a.visitTime })
                let loadfrom = (new Date()).getTime() - 1000000;
                // console.log("time="+loadfrom);
                // add_history(MAX, 0, h, loadfrom, { id: tab.id, url: tab.url, title: tab.title, lastVisitTime: now });
                add_tab_history(h, 0, loadfrom, { id: tab.id, url: tab.url, title: tab.title, lastVisitTime: now });
            }

        })

    }

}


// 解析1个url的全部访问记录
// urls_p 第几个url
// i 第几个访问记录
// visitItems 访问记录列表
// loadfrom 解析时间深度（不处理早于这个时间的访问记录）
// url_item url对象（因为visitItems不包含标题）


function add_tab_history(visitItems, i, loadfrom, url_item) {
    let refer2;
    let tabstr = url_item.id.toString();
    if (openerJson[tabstr] != undefined) {
        refer2 = urlIdJson[openerJson[tabstr]];
        delete openerJson[tabstr];
    }

    if (refer2 == undefined)
        refer2 = 0;

    if (visitItems.length > i) {

        let visitTime = visitItems[i].visitTime;
        let visitId = visitItems[i].visitId;
        let refer = visitItems[i].referringVisitId;
        let transition = visitItems[i].transition;

        // 对实时更新的数据来说，超时一定是bug
        if (visitTime < loadfrom) {
            console.log("[Err] add_tab_history() time=" + visitTime + " < " + loadfrom.toString + ", url=" + visitItems[i].url);
            return;
        }

        // 刷新url的visitID。只要url正确，即使tab错误，对展示结果也没有明显影响
        if (idUrlJson[visitId.toString()] == undefined) {
            urlIdJson[url_item.url] = visitId;
            idUrlJson[visitId.toString()] = url_item.url;
            console.log("visitJson " + refer + "->" + visitId + " transition=" + transition + " " + url_item.url);
        }

        if (refer == undefined || refer <= 0) {
            // 当refer信息为空，且可能由
            if (refer2 == undefined || refer2 <= 0) {
                refer = 0;
                // console.log("refer2 fix fail, refer2=" + refer2);
            } else {
                refer = refer2;
            }
        }


        if (idUrlJson[refer.toString()] == undefined) {
            if (idUrlJson[refer2.toString()] != undefined) {
                refer = refer2;
            } else if (transition == "link" && tabUrl0Json[tabstr] != undefined) {
                refer = urlIdJson[tabUrl0Json[tabstr]];
            }
        }

        if (refer == undefined)
            refer = 0;
        else if (transition == "typed" || transition == "auto_bookmark" || transition == "keyword" || transition == "keyword_generated") {
            // 输入、搜索、书签产生的新标签页，不需要refer
            console.log("change refer " + visitItems[i].referringVisitId + "->0 cause transition=" + transition);
            refer = 0;
        }

        console.log("refer referringVisitId/refer2/tabUrl0/result=" + visitItems[i].referringVisitId + "/" + refer2 + "/" + idUrlJson[tabUrl0Json[tabstr]] + "/" + refer + ", transition=" + transition
            + " " + tabUrl0Json[tabstr] + " ->" + url_item.url);

        var transaction = db.transaction(["VisitItem"], "readwrite");
        transaction.oncomplete = function (event) {
            // console.log("Success :) " + new Date(visitTime) + " " + refer + " -> " + visitId + " [" + url_item.visitCount + "] " + url_item.url);
            // add_tab_history(visitItems, i + 1, loadfrom, url_item);
        };

        transaction.onerror = function (event) {
            // console.log("Error :( " + new Date(visitTime) + " [" + visitId + "] " + url_item.url + " " + event);
            // add_tab_history(visitItems, i + 1, loadfrom, url_item);
        };
        var objectStore = transaction.objectStore("VisitItem");

        objectStore.add({
            visitId: visitId,
            referringVisitId: refer,
            url: url_item.url,
            visitTime: visitTime,
            title: url_item.title,
            transition: transition,
        });
    } else {
        console.log("add_tab_history() no_result ");
    }



}

chrome.contextMenus.removeAll(() => {
    const options = {
        type: 'normal',
        id: 'tree_style_history_' + getVersion(),
        title: returnLang('searchSite'),
        contexts: ["link", "page"],
        visible: true,
    }

    if (localStorage['use-contextmenu'] == 'yes') {
        chrome.contextMenus.create(options, () => {
            console.log('select ' + options.id);
        });

        // Combined context menu handler
        chrome.contextMenus.onClicked.addListener((info) => {
            // Handle main context menu
            if (info.menuItemId === options.id) {
                let url = info.linkUrl;
                if (url != undefined) {
                    window.open('history.html?' + url);
                } else {
                    url = info.pageUrl;
                    if (url != undefined) {
                        window.open('history.html?' + url);
                    }
                }
            }
            // Handle save selection as note
            else if (info.menuItemId === 'tsh_save_selection_as_note') {
                const selectedText = info.selectionText || '';
                const pageUrl = info.pageUrl || '';
                if (!selectedText) return;
                saveSelectionAsNote(pageUrl, selectedText);
            }
        });
    }

    // Add: save selection as note
    try {
        chrome.contextMenus.create({
            id: 'tsh_save_selection_as_note',
            title: returnLang('saveSelectionAsNote'),
            contexts: ['selection']
        });
    } catch(e) { console.log('contextMenus create selection failed', e); }
});

function saveSelectionAsNote(pageUrl, selectedText){
    if (!pageUrl || !selectedText) return;
    if (!db){ 
        console.log('DB not ready for saveSelectionAsNote'); 
        return; 
    }
    
    console.log('Saving selection as note:', {pageUrl, selectedText: selectedText.substring(0, 50) + '...'});
    
    // Step 1: Find latest visitId for the URL
    findLatestVisitId(pageUrl)
        .then(visitId => {
            console.log('Found visitId:', visitId);
            return saveNoteToDatabase(visitId, pageUrl, selectedText);
        })
        .then((isDuplicate) => {
            if (isDuplicate) {
                console.log('Duplicate text not saved');
                if (chrome.notifications) {
                    chrome.notifications.create({
                        type: 'basic',
                        iconUrl: 'images/tree-48.png',
                        title: 'Tree Style History',
                        message: 'Selected text already exists in notes'
                    });
                }
            } else {
                console.log('Note saved successfully');
                if (chrome.notifications) {
                    chrome.notifications.create({
                        type: 'basic',
                        iconUrl: 'images/tree-48.png',
                        title: 'Tree Style History',
                        message: 'Selected text added to notes'
                    });
                }
            }
        })
        .catch(error => {
            console.error('Error saving selection as note:', error);
        });
}

function findLatestVisitId(pageUrl) {
    return new Promise((resolve, reject) => {
        try {
            if (!db) {
                console.error('Database not initialized in findLatestVisitId');
                reject(new Error('Database not initialized'));
                return;
            }
            
            console.log('[TST Background] 查找visitId for URL:', pageUrl);
            
            var latestVisitId = 0;
            var latestVisitTime = 0;
            var tx = db.transaction(["VisitItem"], "readonly");
            var st = tx.objectStore("VisitItem");
            var idx = st.index('url');
            var c = idx.openCursor(IDBKeyRange.only(pageUrl));
            
            c.onsuccess = function(e){
                var cur = e.target.result;
                if (cur){
                    var v = cur.value;
                    if ((v.visitTime||0) > latestVisitTime){ 
                        latestVisitTime = v.visitTime||0; 
                        latestVisitId = v.visitId; 
                    }
                    cur.continue();
                } else {
                    // If no visitId found, create a pseudo one
                    if (!latestVisitId) {
                        latestVisitId = Date.now();
                    }
                    resolve(latestVisitId);
                }
            };
            
            c.onerror = function(err){ 
                console.log('openCursor url index error', err);
                // Fallback: create a pseudo visitId
                resolve(Date.now());
            };
            
            tx.onerror = function(err) {
                console.error('Transaction error in findLatestVisitId:', err);
                reject(err);
            };
        } catch (error) {
            console.error('Exception in findLatestVisitId:', error);
            reject(error);
        }
    });
}

function saveNoteToDatabase(visitId, pageUrl, selectedText) {
    return new Promise((resolve, reject) => {
        try {
            var tx = db.transaction(["VisitNote"], "readwrite");
            var ns = tx.objectStore("VisitNote");
            
            var getReq = ns.get(visitId);
            getReq.onsuccess = function(ev){
                try {
                    var existed = ev.target.result;
                    var now = Date.now();
                    var noteData;
                    
                    // Get merge mode from settings
                    var mergeMode = localStorage['notes-merge-mode'] || 'append';
                    
                    if (existed){
                        var existingNote = existed.note || '';
                        
                        // Check for duplicates unless in replace mode
                        if (mergeMode !== 'replace' && existingNote.indexOf(selectedText) !== -1) {
                            console.log('Selected text already exists in note, skipping duplicate');
                            resolve(true); // Return true to indicate duplicate
                            return;
                        }
                        
                        switch(mergeMode) {
                            case 'append':
                                // Append with timestamp separator
                                var timeString = new Date(now).toLocaleDateString() + ' ' + new Date(now).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                                var separator = existingNote ? "\n\n---\n*Added on " + timeString + "*\n\n" : "";
                                noteData = {
                                    visitId: visitId,
                                    url: pageUrl,
                                    note: existingNote + separator + selectedText,
                                    updatedAt: now
                                };
                                break;
                                
                            case 'separate':
                                // Create a new note with unique visitId
                                var newVisitId = Date.now();
                                noteData = {
                                    visitId: newVisitId,
                                    url: pageUrl,
                                    note: selectedText,
                                    updatedAt: now
                                };
                                break;
                                
                            case 'replace':
                                // Replace existing note completely
                                noteData = {
                                    visitId: visitId,
                                    url: pageUrl,
                                    note: selectedText,
                                    updatedAt: now
                                };
                                break;
                                
                            default:
                                // Default to append mode
                                var timeString = new Date(now).toLocaleDateString() + ' ' + new Date(now).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                                var separator = existingNote ? "\n\n---\n*Added on " + timeString + "*\n\n" : "";
                                noteData = {
                                    visitId: visitId,
                                    url: pageUrl,
                                    note: existingNote + separator + selectedText,
                                    updatedAt: now
                                };
                        }
                    } else {
                        // Create new note (first selection doesn't need timestamp)
                        noteData = { 
                            visitId: visitId, 
                            url: pageUrl, 
                            note: selectedText, 
                            updatedAt: now 
                        };
                    }
                    
                                         var putReq = ns.put(noteData);
                     putReq.onsuccess = function() {
                         resolve(false); // Return false to indicate successful save
                     };
                     putReq.onerror = function(err) {
                         console.error('Put request error:', err);
                         reject(err);
                     };
                } catch (error) {
                    console.error('Exception in getReq.onsuccess:', error);
                    reject(error);
                }
            };
            
            getReq.onerror = function(err){
                console.error('Get request error:', err);
                // Try to save anyway
                try {
                    var noteData = { 
                        visitId: visitId, 
                        url: pageUrl, 
                        note: selectedText, 
                        updatedAt: Date.now() 
                    };
                                         var putReq = ns.put(noteData);
                     putReq.onsuccess = function() {
                         resolve(false); // Return false to indicate successful save
                     };
                     putReq.onerror = function(putErr) {
                         reject(putErr);
                     };
                } catch (error) {
                    reject(error);
                }
            };
            
            tx.onerror = function(err) {
                console.error('Transaction error in saveNoteToDatabase:', err);
                reject(err);
            };
        } catch (error) {
            console.error('Exception in saveNoteToDatabase:', error);
            reject(error);
        }
    });
}

// Handle messages from content scripts (for page notes feature)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'savePageNote') {
        savePageNoteFromContentScript(request.data)
            .then((result) => {
                sendResponse({ success: true, result: result });
            })
            .catch((error) => {
                console.error('Error saving page note:', error);
                sendResponse({ success: false, error: error.message || 'Unknown error' });
            });
        
        // Return true to indicate we will send a response asynchronously
        return true;
    }
    
    if (request.action === 'loadPageNote') {
        loadPageNoteFromContentScript(request.data)
            .then((note) => {
                sendResponse({ success: true, note: note });
            })
            .catch((error) => {
                console.error('Error loading page note:', error);
                sendResponse({ success: false, error: error.message || 'Unknown error' });
            });
        
        // Return true to indicate we will send a response asynchronously
        return true;
    }
    
    if (request.action === 'checkPageNote') {
        checkPageNoteExists(request.data)
            .then((hasNote) => {
                sendResponse({ success: true, hasNote: hasNote });
            })
            .catch((error) => {
                console.error('Error checking page note:', error);
                sendResponse({ success: false, error: error.message || 'Unknown error' });
            });
        
        // Return true to indicate we will send a response asynchronously
        return true;
    }
    
    // 打开笔记管理器
    if (request.action === 'openNoteManager') {
        try {
            const url = chrome.runtime.getURL('note-manager.html');
            const mode = request.mode || '';
            const fullUrl = mode ? `${url}?mode=${mode}` : url;
            
            // 检查是否已有笔记管理器窗口打开
            chrome.windows.getAll({ populate: true }, (windows) => {
                let managerWindow = null;
                
                for (const window of windows) {
                    for (const tab of window.tabs) {
                        if (tab.url && tab.url.includes('note-manager.html')) {
                            managerWindow = window;
                            break;
                        }
                    }
                    if (managerWindow) break;
                }
                
                if (managerWindow) {
                    // 如果已有窗口，聚焦到该窗口
                    chrome.windows.update(managerWindow.id, { focused: true }, () => {
                        sendResponse({ success: true, action: 'focused' });
                    });
                } else {
                    // 创建新窗口
                    chrome.windows.create({
                        url: fullUrl,
                        type: 'popup',
                        width: 1200,
                        height: 800,
                        focused: true
                    }, (window) => {
                        if (chrome.runtime.lastError) {
                            console.error('Error creating note manager window:', chrome.runtime.lastError);
                            sendResponse({ success: false, error: chrome.runtime.lastError.message });
                        } else {
                            sendResponse({ success: true, action: 'created', windowId: window.id });
                        }
                    });
                }
            });
        } catch (error) {
            console.error('Error opening note manager:', error);
            sendResponse({ success: false, error: error.message });
        }
        
        return true; // 异步响应
    }
    
    // 获取所有笔记
    if (request.action === 'getAllNotes') {
        getAllNotesFromDatabase()
            .then((notes) => {
                sendResponse({ success: true, notes: notes });
            })
            .catch((error) => {
                console.error('Error getting all notes:', error);
                sendResponse({ success: false, error: error.message || 'Unknown error' });
            });
        
        return true;
    }
    
    // 保存笔记（从笔记管理器）
    if (request.action === 'saveNote') {
        saveNoteFromManager(request.note)
            .then((result) => {
                sendResponse({ success: true, result: result });
            })
            .catch((error) => {
                console.error('Error saving note from manager:', error);
                sendResponse({ success: false, error: error.message || 'Unknown error' });
            });
        
        return true;
    }
    
    // 删除笔记
    if (request.action === 'deleteNote') {
        deleteNoteFromDatabase(request.noteId)
            .then((result) => {
                sendResponse({ success: true, result: result });
            })
            .catch((error) => {
                console.error('Error deleting note:', error);
                sendResponse({ success: false, error: error.message || 'Unknown error' });
            });
        
        return true;
    }
    
    // 打开设置
    if (request.action === 'openSettings') {
        try {
            chrome.tabs.create({
                url: chrome.runtime.getURL('options.html')
            }, (tab) => {
                sendResponse({ success: true, tabId: tab.id });
            });
        } catch (error) {
            console.error('Error opening settings:', error);
            sendResponse({ success: false, error: error.message });
        }
        
        return true;
    }
});

/**
 * Save page note from content script
 */
async function savePageNoteFromContentScript(pageData) {
    try {
        // Find or create a visitId for this URL
        const visitId = await findLatestVisitId(pageData.url);
        
        // Save the note to database
        const isDuplicate = await saveNoteToDatabase(visitId, pageData.url, pageData.note);
        
        if (isDuplicate) {
            console.log('Duplicate note content, not saved');
            return 'duplicate';
        }
        
        // Send notification
        const notificationId = 'page-note-saved-' + Date.now();
        chrome.notifications.create(notificationId, {
            type: 'basic',
            iconUrl: chrome.extension.getURL('images/tree-48.png'),
            title: '页面笔记',
            message: `已保存笔记: ${pageData.title}`
        });
        
        // Clear notification after 3 seconds
        setTimeout(() => {
            chrome.notifications.clear(notificationId);
        }, 3000);
        
        return 'success';
    } catch (error) {
        console.error('Error in savePageNoteFromContentScript:', error);
        throw error;
    }
}

/**
 * Load page note from content script
 */
async function loadPageNoteFromContentScript(pageData) {
    try {
        // 先尝试直接通过URL查找笔记
        const notes = await loadNotesByUrl(pageData.url);
        
        if (notes && notes.length > 0) {
            // 返回所有笔记，让前端决定如何显示
            return {
                notes: notes,
                count: notes.length,
                latest: notes[0]
            };
        }
        
        // 如果没找到，回退到原来的方法
        const visitId = await findLatestVisitId(pageData.url);
        const note = await loadNoteFromDatabase(visitId);
        
        if (note && note.note) {
            return {
                notes: [note],
                count: 1,
                latest: note
            };
        }
        
        return null;
    } catch (error) {
        console.error('Error in loadPageNoteFromContentScript:', error);
        throw error;
    }
}

/**
 * Check if page note exists
 */
async function checkPageNoteExists(pageData) {
    try {
        console.log('[TST Background] 检查页面笔记是否存在:', pageData.url);
        
        // 直接通过URL查找笔记，更可靠
        const hasNote = await checkNoteExistsByUrl(pageData.url);
        console.log('[TST Background] 笔记存在状态:', hasNote);
        
        return hasNote;
    } catch (error) {
        console.error('Error in checkPageNoteExists:', error);
        return false;
    }
}

/**
 * Check if note exists in database by visitId
 */
function checkNoteExists(visitId) {
    return new Promise((resolve) => {
        try {
            if (!db) {
                resolve(false);
                return;
            }
            
            const tx = db.transaction(['VisitNote'], 'readonly');
            const ns = tx.objectStore('VisitNote');
            const getReq = ns.get(visitId);
            
            getReq.onsuccess = function() {
                try {
                    const result = getReq.result;
                    resolve(result && result.note && result.note.trim().length > 0);
                } catch (error) {
                    console.error('Exception in checkNoteExists:', error);
                    resolve(false);
                }
            };
            
            getReq.onerror = function(err) {
                console.error('Get request error in checkNoteExists:', err);
                resolve(false);
            };
            
            tx.onerror = function(err) {
                console.error('Transaction error in checkNoteExists:', err);
                resolve(false);
            };
        } catch (error) {
            console.error('Exception in checkNoteExists:', error);
            resolve(false);
        }
    });
}

/**
 * Check if note exists in database by URL (more reliable)
 */
function checkNoteExistsByUrl(pageUrl) {
    return new Promise((resolve) => {
        try {
            if (!db) {
                console.log('[TST Background] Database not initialized');
                resolve(false);
                return;
            }
            
            console.log('[TST Background] 通过URL查找笔记:', pageUrl);
            
            const tx = db.transaction(['VisitNote'], 'readonly');
            const ns = tx.objectStore('VisitNote');
            const urlIndex = ns.index('url');
            
            // 首先尝试精确匹配
            const getReq = urlIndex.getAll(pageUrl);
            
            getReq.onsuccess = function() {
                try {
                    let results = getReq.result || [];
                    console.log('[TST Background] 精确匹配找到笔记数量:', results.length);
                    
                    // 如果精确匹配没找到，尝试模糊匹配
                    if (results.length === 0) {
                        console.log('[TST Background] 尝试模糊匹配...');
                        // 获取所有笔记进行模糊匹配
                        const allReq = ns.getAll();
                        allReq.onsuccess = function() {
                            const allNotes = allReq.result || [];
                            console.log('[TST Background] 总笔记数量:', allNotes.length);
                            
                            // 模糊匹配：去除查询参数和fragment进行比较
                            const normalizeUrl = (url) => {
                                try {
                                    const urlObj = new URL(url);
                                    return urlObj.origin + urlObj.pathname;
                                } catch (e) {
                                    return url;
                                }
                            };
                            
                            const normalizedPageUrl = normalizeUrl(pageUrl);
                            console.log('[TST Background] 标准化URL:', normalizedPageUrl);
                            
                            const matchingNotes = allNotes.filter(note => {
                                if (!note || !note.url) return false;
                                const normalizedNoteUrl = normalizeUrl(note.url);
                                return normalizedNoteUrl === normalizedPageUrl;
                            });
                            
                            console.log('[TST Background] 模糊匹配找到笔记数量:', matchingNotes.length);
                            results = matchingNotes;
                            
                            // 检查是否有任何非空笔记
                            const hasValidNote = results.some(note => 
                                note && note.note && note.note.trim().length > 0
                            );
                            
                            console.log('[TST Background] 有效笔记存在:', hasValidNote);
                            resolve(hasValidNote);
                        };
                        allReq.onerror = function() {
                            console.error('Error getting all notes for fuzzy matching');
                            resolve(false);
                        };
                    } else {
                        // 检查是否有任何非空笔记
                        const hasValidNote = results.some(note => 
                            note && note.note && note.note.trim().length > 0
                        );
                        
                        console.log('[TST Background] 有效笔记存在:', hasValidNote);
                        resolve(hasValidNote);
                    }
                } catch (error) {
                    console.error('Exception in checkNoteExistsByUrl:', error);
                    resolve(false);
                }
            };
            
            getReq.onerror = function(err) {
                console.error('Get request error in checkNoteExistsByUrl:', err);
                resolve(false);
            };
            
            tx.onerror = function(err) {
                console.error('Transaction error in checkNoteExistsByUrl:', err);
                resolve(false);
            };
        } catch (error) {
            console.error('Exception in checkNoteExistsByUrl:', error);
            resolve(false);
        }
    });
}

/**
 * Load notes from database by URL
 */
function loadNotesByUrl(pageUrl) {
    return new Promise((resolve) => {
        try {
            if (!db) {
                resolve([]);
                return;
            }
            
            console.log('[TST Background] 通过URL加载笔记:', pageUrl);
            
            const tx = db.transaction(['VisitNote'], 'readonly');
            const ns = tx.objectStore('VisitNote');
            const urlIndex = ns.index('url');
            
            // 首先尝试精确匹配
            const getReq = urlIndex.getAll(pageUrl);
            
            getReq.onsuccess = function() {
                try {
                    let results = getReq.result || [];
                    console.log('[TST Background] 精确匹配找到笔记数量:', results.length);
                    
                    // 如果精确匹配没找到，尝试模糊匹配
                    if (results.length === 0) {
                        console.log('[TST Background] 尝试模糊匹配...');
                        const allReq = ns.getAll();
                        allReq.onsuccess = function() {
                            const allNotes = allReq.result || [];
                            
                            // 模糊匹配：去除查询参数和fragment进行比较
                            const normalizeUrl = (url) => {
                                try {
                                    const urlObj = new URL(url);
                                    return urlObj.origin + urlObj.pathname;
                                } catch (e) {
                                    return url;
                                }
                            };
                            
                            const normalizedPageUrl = normalizeUrl(pageUrl);
                            const matchingNotes = allNotes.filter(note => {
                                if (!note || !note.url) return false;
                                const normalizedNoteUrl = normalizeUrl(note.url);
                                return normalizedNoteUrl === normalizedPageUrl && 
                                       note.note && note.note.trim().length > 0;
                            });
                            
                            // 按更新时间排序，最新的在前
                            matchingNotes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                            
                            console.log('[TST Background] 模糊匹配找到有效笔记数量:', matchingNotes.length);
                            resolve(matchingNotes);
                        };
                        allReq.onerror = function() {
                            console.error('Error getting all notes for fuzzy matching');
                            resolve([]);
                        };
                    } else {
                        // 过滤非空笔记并按更新时间排序
                        const validNotes = results.filter(note => 
                            note && note.note && note.note.trim().length > 0
                        );
                        validNotes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                        
                        console.log('[TST Background] 找到有效笔记数量:', validNotes.length);
                        resolve(validNotes);
                    }
                } catch (error) {
                    console.error('Exception in loadNotesByUrl:', error);
                    resolve([]);
                }
            };
            
            getReq.onerror = function(err) {
                console.error('Get request error in loadNotesByUrl:', err);
                resolve([]);
            };
            
            tx.onerror = function(err) {
                console.error('Transaction error in loadNotesByUrl:', err);
                resolve([]);
            };
        } catch (error) {
            console.error('Exception in loadNotesByUrl:', error);
            resolve([]);
        }
    });
}

/**
 * Load note from database by visitId
 */
function loadNoteFromDatabase(visitId) {
    return new Promise((resolve, reject) => {
        try {
            if (!db) {
                reject(new Error('Database not initialized'));
                return;
            }
            
            const tx = db.transaction(['VisitNote'], 'readonly');
            const ns = tx.objectStore('VisitNote');
            const getReq = ns.get(visitId);
            
            getReq.onsuccess = function() {
                try {
                    const result = getReq.result;
                    if (result && result.note) {
                        resolve(result.note);
                    } else {
                        resolve(null); // No note found
                    }
                } catch (error) {
                    console.error('Exception in getReq.onsuccess for loadNoteFromDatabase:', error);
                    reject(error);
                }
            };
            
            getReq.onerror = function(err) {
                console.error('Get request error in loadNoteFromDatabase:', err);
                resolve(null); // Return null instead of rejecting to avoid blocking the UI
            };
            
            tx.onerror = function(err) {
                console.error('Transaction error in loadNoteFromDatabase:', err);
                resolve(null);
            };
        } catch (error) {
            console.error('Exception in loadNoteFromDatabase:', error);
            resolve(null);
        }
    });
}

/**
 * 获取所有笔记
 */
async function getAllNotesFromDatabase() {
    return new Promise((resolve) => {
        const transaction = db.transaction(['VisitNote'], 'readonly');
        const objectStore = transaction.objectStore('VisitNote');
        const request = objectStore.getAll();
        
        request.onsuccess = function() {
            const notes = request.result || [];
            
            // 转换数据格式，确保兼容性
            const formattedNotes = notes.map(note => ({
                id: note.id || note.visitId,
                title: note.title || '未命名笔记',
                note: note.note || '',
                tag: note.tag || 'general_general',
                url: note.url || '',
                createdAt: note.createdAt || note.time,
                updatedAt: note.updatedAt || note.time
            }));
            
            console.log('[TST Background] 获取所有笔记:', formattedNotes.length);
            resolve(formattedNotes);
        };
        
        request.onerror = function(error) {
            console.error('获取所有笔记失败:', error);
            resolve([]);
        };
    });
}

/**
 * 从笔记管理器保存笔记
 */
async function saveNoteFromManager(noteData) {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['VisitNote'], 'readwrite');
            const objectStore = transaction.objectStore('VisitNote');
            
            // 准备笔记数据
            const note = {
                id: noteData.id,
                visitId: noteData.id, // 兼容性
                title: noteData.title || '未命名笔记',
                note: noteData.note || '',
                tag: noteData.tag || 'general_general',
                url: noteData.url || '',
                time: noteData.updatedAt || new Date().toISOString(),
                createdAt: noteData.createdAt || new Date().toISOString(),
                updatedAt: noteData.updatedAt || new Date().toISOString()
            };
            
            const request = objectStore.put(note);
            
            request.onsuccess = function() {
                console.log('[TST Background] 笔记保存成功:', note.id);
                resolve({ noteId: note.id, action: 'saved' });
            };
            
            request.onerror = function(error) {
                console.error('保存笔记失败:', error);
                reject(new Error('保存笔记失败'));
            };
            
        } catch (error) {
            console.error('保存笔记异常:', error);
            reject(error);
        }
    });
}

/**
 * 删除笔记
 */
async function deleteNoteFromDatabase(noteId) {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['VisitNote'], 'readwrite');
            const objectStore = transaction.objectStore('VisitNote');
            
            const request = objectStore.delete(noteId);
            
            request.onsuccess = function() {
                console.log('[TST Background] 笔记删除成功:', noteId);
                resolve({ noteId: noteId, action: 'deleted' });
            };
            
            request.onerror = function(error) {
                console.error('删除笔记失败:', error);
                reject(new Error('删除笔记失败'));
            };
            
        } catch (error) {
            console.error('删除笔记异常:', error);
            reject(error);
        }
    });
}
