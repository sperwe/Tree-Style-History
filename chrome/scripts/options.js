
document.addEvent('domready', function () {

    // Fade in

    var optionsFx = new Fx.Morph('options', { duration: 250 });
    if (chrome.i18n.getMessage("@@bidi_dir") == 'rtl' && chrome.i18n.getMessage("@@ui_locale") !== 'en') {
        var oo = {
            'margin-right': [150, 180],
            'opacity': [0, 1]
        };
    } else {
        var oo = {
            'margin-left': [150, 180],
            'opacity': [0, 1]
        };
    }
    optionsFx.start(oo);


    $("version").set('text',getVersion());

    // URL Vars

    var vars = getUrlVars();

    if (vars['p'] == undefined) {
        $('tab-options-content').setStyle('display', 'block');
        $('tab-options').addClass('tab-current');
    } else {
        $('tab-' + vars['p'] + '-content').setStyle('display', 'block');
        $('tab-' + vars['p']).addClass('tab-current');
    }

    // Options tabs

    $$('.tab').addEvent('click', function (e) {
        e.stop();
        $$('.tab-content').setStyle('display', 'none');
        $$('.tab').removeClass('tab-current');
        $(this.get('id') + '-content').setStyle('display', 'block');
        this.addClass('tab-current');
    });

    // Load translated text

    loadOptionsLang();

    // Load saved options

    loadOptions(true);

    // Save options

    $('save').addEvent('click', function () {
        saveOptions(false);
    });

    $('defaultConfig').set('value', returnLang('defaultConfig'));
    $('defaultConfig').addEvent('click', function () {
        defaultConfig(true);
        location.reload();
        // loadOptions();
        // localStorage.clear();
        // window.open('options.html');
    });

    $('deleteCache').addEvent('click', function () {
        var bg = chrome.extension.getBackgroundPage();
        bg.deleteDb();
    });


    // $('shortcuts').set('value', returnLang('shortcuts'));
    $('shortcuts').addEvent('click', function () {
        chromeURL('chrome://extensions/shortcuts');
    });

    $('saveUpload').set('value', returnLang('saveUpload'));
    $('saveUpload').addEvent('click', function () {
        saveOptions(true);
    });

    $('downloadConfig').set('value', returnLang('downloadConfig'));
    $('downloadConfig').addEvent('click', function () {
        downloadOptions();
    });

    $('downloadConfig2').set('value', returnLang('downloadConfig2'));
    $('downloadConfig2').addEvent('click', function () {
    });

    // Sliders
    // recent-history
    loadSlider('rhitemsno', 0, 100, 'rh-itemsno');
    // recent-closed
    loadSlider('rctitemsno', 0, 100, 'rct-itemsno');
    // recent-tab
    loadSlider('rtitemsno', 0, 100, 'rt-itemsno');
    // most visited
    loadSlider('mvitemsno', 0, 100, 'mv-itemsno');
    // recent-bookmark
    loadSlider('rbitemsno', 0, 100, 'rb-itemsno');
    loadSlider('rhwidth', 225, 800, 'rh-width');
    loadSlider('loadrange', 3, 300, 'load-range');
    loadSlider('loadrange2', 1, 100, 'load-range2');
    loadSlider('loadrange3', 0, 900, 'load-range3');
    loadSlider('loadrange4', 0, 9000, 'load-range4');
    // Load translations iframe
    //$('translations-iframe').set('html', '<iframe onerror="$(\'translations-iframe\').set(\'text\', \'Currently Unavailable\');" src="http://www.indezinez.com/api/recenthistory/translations.php?l='+chrome.i18n.getMessage("@@ui_locale")+'" frameborder="0" scrolling="no"></iframe>');
    //$('translations-iframe').set('html', '<a target="_blank" href="http://www.indezinez.com/api/ext/recenthistory/?l='+chrome.i18n.getMessage("@@ui_locale")+'">Click here to view form</a> (opens external link in new window)');

    // Assign events

    $('flist-add-b').addEvent('click', function () { addFilteredItem(); });
    $('flist-add-i').addEvent('keyup', function (event) { if (event.keyCode == 13) { addFilteredItem(); } });
    $('advance-options').addEvent('submit', function () { return false; });

    $('deleteList').addEvent('click', function () { $('flist-table').set('html',''); });

    $('mergeList').addEvent('click', function () {mergeList(); });
    
    

    // var UserAgent = navigator.userAgent.toLowerCase();
    // if(UserAgent.indexOf('edg')>0)
    {
        $('select_history_page').set('style','display:none');
    }

	// Export/Import Notes (Markdown)
	$('exportNotesMd') && $('exportNotesMd').addEvent('click', function(){ exportNotesAsMarkdown(); });
	$('importNotesMd') && $('importNotesMd').addEvent('click', function(){ $('notesImportFile').click(); });
	$('notesImportFile') && $('notesImportFile').addEvent('change', function(){ importNotesFromMarkdown(this); });

});


function exportNotesAsMarkdown(){
	var bg = chrome.extension.getBackgroundPage();
	var db = bg && bg.db;
	if (!db){ alert(returnLang('exportNotesFailed')); return; }
	var tx = db.transaction(["VisitNote"], "readonly");
	var store = tx.objectStore("VisitNote");
	var req = store.getAll ? store.getAll() : (function(){
		var out=[]; store.openCursor().onsuccess=function(e){var c=e.target.result; if(c){ out.push(c.value); c.continue(); } else { enrich(out); } }; return { onsuccess:null };
	})();
	if (req.onsuccess!==undefined){
		req.onsuccess = function(e){ var list = e.target.result || []; enrich(list); };
	}

	function enrich(list){
		var i = 0, enriched = [];
		if (list.length === 0){ return build(enriched); }
		(function next(){
			if (i >= list.length){ build(enriched); return; }
			var n = list[i++];
			var meta = { note: n, title: '', visitTime: 0, transition: '', refUrl: '', first: 0, last: 0, total: 0 };
			var done1=false, done2=false, done3=true;
			var tx2 = db.transaction(["VisitItem"], "readonly");
			var st = tx2.objectStore("VisitItem");
			// 1) get by visitId for precise visit info
			var r1 = st.get(n.visitId);
			r1.onsuccess = function(ev){ var v=ev.target.result; if (v){ meta.title=v.title||''; meta.visitTime=v.visitTime||0; meta.transition=v.transition||''; if (v.referringVisitId>0){ done3=false; var rp=st.get(v.referringVisitId); rp.onsuccess=function(e2){ var pv=e2.target.result; if (pv && pv.url) meta.refUrl=pv.url; done3=true; check(); }; rp.onerror=function(){ done3=true; check(); }; } } done1=true; check(); };
			r1.onerror = function(){ done1=true; check(); };
			// 2) aggregate by URL to get first/last/total and fallback title
			if (n.url){
				var idx = st.index('url');
				var c = idx.openCursor(IDBKeyRange.only(n.url));
				c.onsuccess = function(e){ var cur=e.target.result; if(cur){ var vv=cur.value; meta.total++; var t=vv.visitTime||0; if (!meta.first||t<meta.first) meta.first=t; if (!meta.last||t>meta.last) meta.last=t; if(!meta.title && vv.title) meta.title=vv.title; cur.continue(); } else { done2=true; check(); } };
				c.onerror = function(){ done2=true; check(); };
			} else { done2=true; }
			function check(){ if (done1 && done2 && done3){ enriched.push(meta); next(); } }
		})();
	}

	function fmt(ts){ if(!ts) return ''; try{ return new Date(ts).toLocaleString(); } catch(e){ return ''; } }
	function esc(s){ return (s||'').replace(/\r?\n/g,' ').replace(/\|/g,'\\|'); }

	function build(items){
		var exportedAt = new Date().toLocaleString();
		var lines = [
			'# Tree Style History Notes',
			'',
			'- Exported: ' + exportedAt,
			'- Notes: ' + items.length,
			''
		];
		items.forEach(function(m){
			var url = m.note.url || '';
			var title = (m.title && m.title.trim()!=='') ? m.title : url;
			lines.push('## ' + (title && url ? ('['+title+']('+url+')') : (title||url)) );
			if (url) lines.push('- URL: ' + url);
			if (m.note.visitId) lines.push('- VisitId: ' + m.note.visitId);
			if (m.visitTime) lines.push('- Visited: ' + fmt(m.visitTime));
			if (m.first) lines.push('- FirstVisited: ' + fmt(m.first));
			if (m.last) lines.push('- LastVisited: ' + fmt(m.last));
			if (m.total) lines.push('- TotalVisits: ' + m.total);
			if (m.transition) lines.push('- Transition: ' + m.transition);
			if (m.refUrl) lines.push('- Referrer: ' + m.refUrl);
			if (m.note.updatedAt) lines.push('- Updated: ' + new Date(m.note.updatedAt).toISOString());
			lines.push('', '```', (m.note.note||''), '```', '');
		});
		var blob = new Blob([lines.join('\n')], {type:'text/markdown;charset=utf-8'});
		var url = URL.createObjectURL(blob);
		var a = document.createElement('a');
		a.href = url; a.download = 'tree-style-history-notes.md';
		document.body.appendChild(a); a.click(); document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
}

function importNotesFromMarkdown(fileInput){
	var file = fileInput.files && fileInput.files[0];
	if (!file){ return; }
	var reader = new FileReader();
	reader.onload = function(){ parseAndImport(reader.result || ''); };
	reader.readAsText(file);
	function parseAndImport(text){
		var sections = text.split(/\n##\s+/).slice(1);
		var bg = chrome.extension.getBackgroundPage();
		var db = bg && bg.db;
		if (!db){ alert(returnLang('importNotesFailed')); return; }
		var tx = db.transaction(["VisitNote"], "readwrite");
		var store = tx.objectStore("VisitNote");
		sections.forEach(function(sec){
			var lines = sec.split('\n');
			var url = lines[0].trim();
			var vid = 0;
			var note = '';
			for (var i=1;i<lines.length;i++){
				var L = lines[i];
				if (/^VisitId:\s*/i.test(L)) { vid = parseInt(L.replace(/^VisitId:\s*/i,''))||0; }
				else if (L.trim()==='```'){ // start or end
					var j=i+1; var buf=[];
					while (j<lines.length && lines[j].trim()!=='```'){ buf.push(lines[j]); j++; }
					note = buf.join('\n'); i=j; // jump to closing fence
				}
			}
			if (vid>0 || url){
				var id = vid>0 ? vid : (Date.now() + Math.floor(Math.random()*1000));
				store.put({ visitId:id, url:url, note:note||'', updatedAt: Date.now() });
			}
		});
		tx.oncomplete = function(){ alert(returnLang('importNotesSuccess')); };
		tx.onerror = function(){ alert(returnLang('importNotesFailed')); };
	}
}
