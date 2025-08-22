document.addEvent('domready', function(){
	var $jq = jQuery.noConflict();
	var bg = chrome.extension.getBackgroundPage();
	var db = bg && bg.db;
	var all = [];
	var listEl = $('notes-list');
	var searchEl = $('notes-search');
	function fmt(ts){ if(!ts) return ''; try{ return new Date(ts).toLocaleString(); } catch(e){ return ''; } }
	function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
	function render(items){
		listEl.set('html','');
		if (items.length===0){ listEl.set('html','<div class="no-results"><span>'+returnLang('noResults')+'</span></div>'); return; }
		items.forEach(function(m){
			var url = m.note.url || '';
			var title = (m.title && m.title.trim()!=='') ? m.title : url;
			var noteText = m.note.note || '';
			var firstLine = noteText.split(/\r?\n/)[0];
			if (firstLine.length>140) firstLine = firstLine.slice(0,140)+'…';
			
			// Render first line as Markdown if available
			var renderedFirstLine = '';
			if (typeof marked !== 'undefined' && firstLine.trim()) {
				try {
					renderedFirstLine = marked.parseInline(firstLine);
				} catch (e) {
					renderedFirstLine = escapeHtml(firstLine);
				}
			} else {
				renderedFirstLine = escapeHtml(firstLine);
			}
			
			var eid = 'edit-'+m.note.visitId;
			var did = 'del-'+m.note.visitId;
			var cid = 'copy-'+m.note.visitId;
			var vid = 'view-'+m.note.visitId;
			var html = '';
			html += '<div class="item">';
			html += '<a class="link" href="'+url+'" target="_blank">'+escapeHtml(title)+'</a>';
			html += '<span class="info">'+(fmt(m.note.updatedAt)||'')+'</span>';
			html += '<div class="desc">'+renderedFirstLine+'</div>';
			html += '<div class="ops"><a href="#" id="'+eid+'">'+escapeHtml(returnLang('notesEdit')||'Edit')+'</a> · <a href="#" id="'+vid+'">'+escapeHtml(returnLang('notesView')||'View')+'</a> · <a href="#" id="'+did+'">'+escapeHtml(returnLang('notesDelete')||'Delete')+'</a> · <a href="#" id="'+cid+'">'+escapeHtml(returnLang('copy')||'Copy')+'</a></div>';
			html += '</div>';
			var el = new Element('div', { 'html': html }).inject(listEl);
			$(eid).addEvent('click', function(e){ e.stop(); openEditor(m.note.visitId, m.note.url, m.title, m.note.note||''); });
			$(vid).addEvent('click', function(e){ e.stop(); openViewer(m.note.visitId, m.note.url, m.title, m.note.note||''); });
			$(did).addEvent('click', function(e){ e.stop(); deleteNote(m.note.visitId, function(){ load(); }); });
			$(cid).addEvent('click', function(e){ e.stop(); var text = (title?('Title: '+title+'\n'):'') + (url?('URL: '+url+'\n'):'') + '\n' + (m.note.note||''); Clipboard.copy(text); });
		});
	}
	function load(){
		if (!db){ render([]); return; }
		var tx = db.transaction(["VisitNote"], "readonly");
		var store = tx.objectStore("VisitNote");
		var req = store.getAll ? store.getAll() : null;
		if (req){
			req.onsuccess=function(e){ enrich(e.target.result||[]); };
			req.onerror=function(){ render([]); };
		}else{
			var out=[]; store.openCursor().onsuccess=function(e){ var c=e.target.result; if(c){ out.push(c.value); c.continue(); } else { enrich(out); } };
		}
	}
	function enrich(list){
		if (list.length===0){ all=[]; render(all); return; }
		var i=0; all=[];
		(function next(){
			if (i>=list.length){ all.sort(function(a,b){ return (b.note.updatedAt||0)-(a.note.updatedAt||0); }); render(all); return; }
			var n=list[i++];
			var meta = { note:n, title:'', visitTime:0 };
			if (!n.visitId){ all.push(meta); next(); return; }
			var tx2=db.transaction(["VisitItem"],"readonly");
			var st=tx2.objectStore("VisitItem");
			var r=st.get(n.visitId);
			r.onsuccess=function(ev){ var v=ev.target.result; if(v){ meta.title=v.title||''; meta.visitTime=v.visitTime||0; } all.push(meta); next(); };
			r.onerror=function(){ all.push(meta); next(); };
		})();
	}
	function openEditor(visitId, url, title, text){
		var mm = $('note-modal'); if(!mm){ mm = new Element('div', { id:'note-modal', style:'display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.35); z-index:9999; align-items:center; justify-content:center;' }).inject(document.body); new Element('div',{ id:'note-modal-content', style:'background:#fff; padding:12px; width:720px; max-width:95%; border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,0.2); margin:0 auto;' , html:'<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"><h3 id="note-modal-title" style="margin:0; font-size:16px;">📝</h3><div style="display:flex; gap:8px;"><button id="note-mode-edit" class="button" style="padding:4px 8px; font-size:12px;">Edit</button><button id="note-mode-preview" class="button" style="padding:4px 8px; font-size:12px;">Preview</button></div></div><div id="note-editor-container" style="display:flex; gap:8px; height:200px;"><div id="note-edit-pane" style="flex:1;"><textarea id="note-text" style="width:100%; height:100%; box-sizing:border-box; resize:none; font-family:monospace; font-size:13px;" placeholder="Enter your note in Markdown format..."></textarea></div><div id="note-preview-pane" style="flex:1; border:1px solid #ddd; padding:8px; overflow-y:auto; background:#f9f9f9; display:none;"><div id="note-preview-content"></div></div></div><div style="margin-top:8px; font-size:11px; color:#666;">Supports Markdown: **bold**, *italic*, `code`, [links](url), # headers, - lists</div><div style="margin-top:8px; text-align:right; display:flex; gap:8px; justify-content:flex-end;"><input id="note-delete" type="button" class="button" value="'+escapeHtml(returnLang('notesDelete')||'Delete')+'"><input id="note-cancel" type="button" class="button" value="'+escapeHtml(returnLang('notesCancel')||'Cancel')+'"><input id="note-save" type="button" class="button" value="'+escapeHtml(returnLang('notesSave')||'Save')+'"></div>'}).inject(mm); }
		$('note-modal-title').set('text', (title||url||''));
		$('note-text').set('value', text||'');
		
		// Setup Markdown editor modes
		var currentMode = 'edit';
		var editPane = $('note-edit-pane');
		var previewPane = $('note-preview-pane');
		var previewContent = $('note-preview-content');
		var editModeBtn = $('note-mode-edit');
		var previewModeBtn = $('note-mode-preview');
		var textArea = $('note-text');
		
		function setEditorMode(mode) {
			currentMode = mode;
			editModeBtn.removeClass('active');
			previewModeBtn.removeClass('active');
			
			if (mode === 'edit') {
				editModeBtn.addClass('active');
				editPane.setStyle('display', 'block');
				previewPane.setStyle('display', 'none');
			} else if (mode === 'preview') {
				previewModeBtn.addClass('active');
				editPane.setStyle('display', 'none');
				previewPane.setStyle('display', 'block');
				updatePreview();
			}
		}
		
		function updatePreview() {
			if (typeof marked !== 'undefined') {
				var markdownText = textArea.get('value') || '';
				try {
					var html = marked.parse(markdownText);
					previewContent.set('html', html);
				} catch (e) {
					previewContent.set('html', '<em>Error parsing Markdown: ' + e.message + '</em>');
				}
			} else {
				previewContent.set('html', '<em>Markdown parser not available</em>');
			}
		}
		
		setEditorMode('edit');
		editModeBtn.addEvent('click', function(){ setEditorMode('edit'); });
		previewModeBtn.addEvent('click', function(){ setEditorMode('preview'); });
		textArea.addEvent('input', function(){ if(currentMode === 'preview') updatePreview(); });
		
		$('note-modal').setStyle('display', 'flex');
		$('note-cancel').onclick=function(){ $('note-modal').setStyle('display','none'); };
		$('note-delete').onclick=function(){ deleteNote(visitId, function(){ $('note-modal').setStyle('display','none'); load(); }); };
		$('note-save').onclick=function(){ saveNote(visitId, url, $('note-text').get('value'), function(){ $('note-modal').setStyle('display','none'); load(); }); };
	}
	
	function openViewer(visitId, url, title, text) {
		var mm = $('note-viewer-modal'); 
		if(!mm){ 
			mm = new Element('div', { 
				id:'note-viewer-modal', 
				style:'display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.35); z-index:9999; align-items:center; justify-content:center;' 
			}).inject(document.body); 
			new Element('div',{ 
				id:'note-viewer-content', 
				style:'background:#fff; padding:20px; width:720px; max-width:95%; max-height:80%; border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,0.2); margin:0 auto; overflow-y:auto;' , 
				html:'<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid #eee; padding-bottom:8px;"><h3 id="note-viewer-title" style="margin:0; font-size:18px;">📖</h3><button id="note-viewer-close" class="button" style="padding:4px 8px;">Close</button></div><div id="note-viewer-rendered" style="line-height:1.6; font-size:14px;"></div>'
			}).inject(mm); 
		}
		$('note-viewer-title').set('text', (title||url||'Note'));
		
		// Render Markdown content
		var renderedContent = '';
		if (typeof marked !== 'undefined' && text) {
			try {
				renderedContent = marked.parse(text);
			} catch (e) {
				renderedContent = '<pre>' + escapeHtml(text) + '</pre>';
			}
		} else {
			renderedContent = '<pre>' + escapeHtml(text || 'No content') + '</pre>';
		}
		$('note-viewer-rendered').set('html', renderedContent);
		
		$('note-viewer-modal').setStyle('display', 'flex');
		$('note-viewer-close').onclick=function(){ $('note-viewer-modal').setStyle('display','none'); };
	}
	function saveNote(visitId, url, text, cb){
		if (!db){ cb&&cb(false); return; }
		var tx = db.transaction(["VisitNote"], "readwrite");
		var store = tx.objectStore("VisitNote");
		var now = Date.now();
		store.put({ visitId: visitId, url: url, note: text||'', updatedAt: now });
		tx.oncomplete=function(){ cb&&cb(true); };
		tx.onerror=function(){ cb&&cb(false); };
	}
	function deleteNote(visitId, cb){
		if (!db){ cb&&cb(false); return; }
		var tx = db.transaction(["VisitNote"], "readwrite");
		var store = tx.objectStore("VisitNote");
		store.delete(visitId);
		tx.oncomplete=function(){ cb&&cb(true); };
		tx.onerror=function(){ cb&&cb(false); };
	}
	searchEl && searchEl.addEvent('keyup', function(){
		var q=this.get('value').toLowerCase();
		if (!q){ render(all); return; }
		var f=all.filter(function(m){ return (m.note.url||'').toLowerCase().indexOf(q)>=0 || (m.title||'').toLowerCase().indexOf(q)>=0 || (m.note.note||'').toLowerCase().indexOf(q)>=0; });
		render(f);
	});
	load();
});