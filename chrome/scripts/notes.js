document.addEvent('domready', function(){
	var $jq = jQuery.noConflict();
	var bg = chrome.extension.getBackgroundPage();
	var db = bg && bg.db;
	var all = [];
	var listEl = $('rh-views-insert');
	var searchEl = $('notes-search');
	
	// Date filtering variables
	var selectedDateRange = null;
	var currentSearchQuery = '';
	var dataLoaded = false; // Flag to prevent rendering before data is loaded
	
	// Initialize calendar and search functionality
	initializeDateFilter();
	initializeSearch();
	
	// Load notes and initialize calendar display
	load();
	
	// Add button event listener for opening notes manager
	var openNotesManagerBtn = document.getElementById('open-notes-manager');
	if (openNotesManagerBtn) {
		openNotesManagerBtn.addEventListener('click', function() {
			chrome.tabs.create({ url: chrome.extension.getURL('note-manager.html') });
		});
	}
	
	// Tree structure variables (similar to history2.js)
	var treeObj;
	var zNodes = [];
	var setting = {
		view: {
			nameIsHTML: true,
			selectedMulti: false,
			addDiyDom: function (treeId, treeNode) {
				var aObj = $jq("#" + treeNode.tId + "_a");
				if ($jq("#editBtn_" + treeNode.id).length > 0) return;
				
				// Add edit, copy and delete buttons only for note items (not domain or page groups)
				if (treeNode.isNote) {
					var editBtn = $jq('<span class="note-edit-btn" id="editBtn_' + treeNode.id + '" title="Edit Note" style="margin-left:6px; cursor:pointer;">✏️</span>');
					var copyBtn = $jq('<span class="note-copy-btn" id="copyBtn_' + treeNode.id + '" title="Copy Note" style="margin-left:3px; cursor:pointer;">📋</span>');
					var deleteBtn = $jq('<span class="note-delete-btn" id="deleteBtn_' + treeNode.id + '" title="Delete Note" style="margin-left:3px; cursor:pointer;">🗑️</span>');
					editBtn.appendTo(aObj);
					copyBtn.appendTo(aObj);
					deleteBtn.appendTo(aObj);
					
					// Add event handlers
					editBtn.click(function(e) {
						e.stopPropagation();
						var note = treeNode.noteData;
						openEditor(note.visitId, note.url, treeNode.pageTitle || treeNode.title, note.note||'');
					});
					
					copyBtn.click(function(e) {
						e.stopPropagation();
						var note = treeNode.noteData;
						var title = treeNode.pageTitle || treeNode.title || '';
						var url = note.url || '';
						var noteText = note.note || '';
						var text = (title ? ('Title: ' + title + '\n') : '') + 
								  (url ? ('URL: ' + url + '\n') : '') + 
								  '\n' + noteText;
						if (typeof Clipboard !== 'undefined' && Clipboard.copy) {
							Clipboard.copy(text);
							alert('Note copied to clipboard!');
						} else {
							// Fallback for modern browsers
							navigator.clipboard.writeText(text).then(function() {
								alert('Note copied to clipboard!');
							}).catch(function() {
								alert('Failed to copy note to clipboard');
							});
						}
					});
					
					deleteBtn.click(function(e) {
						e.stopPropagation();
						if (confirm('Delete this note?')) {
							deleteNote(treeNode.noteData.visitId, function(){ load(); });
						}
					});
				}
			}
		},
		data: {
			simpleData: {
				enable: true,
				pIdKey: "pId"
			}
		},
		callback: {
			onClick: function(event, treeId, treeNode) {
				if (treeNode.isNote && treeNode.noteData) {
					// Open note in viewer for reading
					var note = treeNode.noteData;
					openViewer(note.visitId, note.url, treeNode.pageTitle || treeNode.title, note.note||'');
				} else if (treeNode.isPage) {
					// Open page URL for page groups
					window.open(treeNode.t, "_blank");
				} else if (treeNode.isDomain) {
					// Open domain URL for domain groups
					window.open(treeNode.t, "_blank");
				}
			}
		}
	};
	
	function fmt(ts){ if(!ts) return ''; try{ return new Date(ts).toLocaleString(); } catch(e){ return ''; } }
	function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
	
	function render(items){
		console.log('render called with', items.length, 'items');
		
		// Initialize tree if not already done
		if (!treeObj) {
			try {
				$jq.fn.zTree.init($jq("#notesTreeDemo"), setting, []);
				treeObj = $jq.fn.zTree.getZTreeObj("notesTreeDemo");
				
				// Hide fallback flat structure
				if ($('rh-views-tube')) {
					$('rh-views-tube').setStyle('display', 'none');
				}
			} catch (e) {
				console.error('Failed to initialize tree, using fallback:', e);
				// Use fallback flat structure
				if ($('rh-views-tube')) {
					$('rh-views-tube').setStyle('display', 'block');
				}
				renderFlat(items);
				return;
			}
		}
		
		// Clear existing tree
		var nodes = treeObj.getNodes();
		while (nodes && nodes.length > 0) {
			treeObj.removeNode(nodes[0], false);
		}
		
		if (items.length === 0) { 
			var emptyNode = [{
				id: 'empty',
				pId: 0,
				name: '📝 ' + (returnLang('noResults') || 'No notes found'),
				isNote: false,
				open: true
			}];
			treeObj.addNodes(null, emptyNode, false);
			return; 
		}
		
		// Group notes by domain -> page -> notes (3-level structure)
		zNodes = [];
		var domainGroups = {};
		var pageGroups = {};
		var nodeId = 1;
		
		// Sort items by updatedAt desc first
		items.sort(function(a, b) { 
			return (b.note.updatedAt || 0) - (a.note.updatedAt || 0); 
		});
		
		// Process each note
		for (var i = 0; i < items.length; i++) {
			var m = items[i];
			var url = m.note.url || '';
			var domain = '';
			
			try {
				if (url && url.trim()) {
					var urlObj = new URL(url);
					domain = urlObj.hostname || url;
				} else {
					domain = 'Unknown';
				}
			} catch (e) {
				domain = url.split('/')[0] || 'Unknown';
			}
			
			// Create domain group if it doesn't exist
			if (!domainGroups[domain]) {
				domainGroups[domain] = {
					id: 'domain_' + nodeId++,
					pId: 0,
					name: '🌐 ' + domain,
					isNote: false,
					isDomain: true,
					open: true,
					t: 'https://' + domain
				};
				zNodes.push(domainGroups[domain]);
			}
			
			// Create page group (second level)
			var pageTitle = (m.title && m.title.trim()!=='') ? m.title : url;
			var pageKey = domain + '||' + url; // Unique key for each page
			
			if (!pageGroups[pageKey]) {
				// Truncate long page titles
				var displayPageTitle = pageTitle;
				if (displayPageTitle.length > 80) {
					displayPageTitle = displayPageTitle.slice(0, 80) + '…';
				}
				
				pageGroups[pageKey] = {
					id: 'page_' + nodeId++,
					pId: domainGroups[domain].id,
					name: '📄 ' + escapeHtml(displayPageTitle),
					isNote: false,
					isPage: true,
					open: true,
					t: url,
					icon: 'chrome://favicon/' + escapeHtml(url),
					fullTitle: pageTitle,
					notesCount: 0
				};
				zNodes.push(pageGroups[pageKey]);
			}
			
			// Update notes count for this page
			pageGroups[pageKey].notesCount++;
			
			var noteText = m.note.note || '';
			var firstLine = noteText.split(/\r?\n/)[0];
			if (firstLine.length > 60) firstLine = firstLine.slice(0,60)+'…';
			
			// Count selections
			var excerptCount = 0;
			excerptCount += (noteText.match(/---\n\*Added on /g) || []).length;
			excerptCount += (noteText.match(/\*摘录自:/g) || []).length;
			if (excerptCount === 0 && noteText.trim()) excerptCount = 1;
			
			var countBadge = excerptCount > 1 ? ' [' + excerptCount + ' selections]' : '';
			var timeStr = fmt(m.note.updatedAt) || '';
			
			var displayNoteTitle = firstLine || 'Note';
			if (firstLine && firstLine !== pageTitle) {
				displayNoteTitle = firstLine;
			} else if (!firstLine) {
				// If no first line, show excerpt from content
				var excerpt = noteText.replace(/\n/g, ' ').trim();
				if (excerpt.length > 50) excerpt = excerpt.slice(0, 50) + '…';
				displayNoteTitle = excerpt || 'Empty note';
			}
			
			// Create note node (third level)
			var noteNode = {
				id: 'note_' + nodeId++,
				pId: pageGroups[pageKey].id,
				name: '📝 ' + timeStr + ' - ' + escapeHtml(displayNoteTitle) + countBadge,
				isNote: true,
				open: false,
				noteData: m.note,
				title: pageTitle,
				pageTitle: pageTitle,
				t: url,
				icon: 'chrome://favicon/' + escapeHtml(url)
			};
			
			zNodes.push(noteNode);
		}
		
		// Update page names to include note counts
		for (var pageKey in pageGroups) {
			var page = pageGroups[pageKey];
			if (page.notesCount > 1) {
				page.name = page.name + ' (' + page.notesCount + ' notes)';
			}
		}
		
		// Add nodes to tree
		if (zNodes.length > 0) {
			treeObj.addNodes(null, zNodes, false);
		}
		
		// Setup search functionality for tree
		if (typeof fuzzySearch === 'function') {
			fuzzySearch('notesTreeDemo', '#rh-search', null, false);
		}
		
		// Update total count
		if ($('calendar-total-value')) {
			$('calendar-total-value').set('text', items.length);
		}
	}
	
	// Fallback flat rendering function with hierarchical grouping
	function renderFlat(items) {
		if (!listEl) return;
		
		listEl.set('html','');
		console.log('renderFlat called with', items.length, 'items');
		if (items.length===0){ 
			listEl.set('html','<div class="no-results"><span>'+returnLang('noResults')+'</span></div>'); 
			return; 
		}
		
		// Group items by domain and page
		var grouped = {};
		items.forEach(function(m) {
			var url = m.note.url || '';
			var domain = '';
			
			try {
				if (url && url.trim()) {
					var urlObj = new URL(url);
					domain = urlObj.hostname || url;
				} else {
					domain = 'Unknown';
				}
			} catch (e) {
				domain = url.split('/')[0] || 'Unknown';
			}
			
			var pageTitle = (m.title && m.title.trim()!=='') ? m.title : url;
			var pageKey = domain + '||' + url;
			
			if (!grouped[domain]) {
				grouped[domain] = {};
			}
			if (!grouped[domain][pageKey]) {
				grouped[domain][pageKey] = {
					pageTitle: pageTitle,
					url: url,
					notes: []
				};
			}
			grouped[domain][pageKey].notes.push(m);
		});
		
		// Render grouped structure
		var rel = 'white';
		for (var domain in grouped) {
			// Domain header
			var domainHeader = new Element('div', {
				'class': 'domain-group',
				'html': '<h3 style="margin:8px 0; color:#666;">🌐 ' + escapeHtml(domain) + '</h3>'
			});
			domainHeader.inject(listEl);
			
			for (var pageKey in grouped[domain]) {
				var page = grouped[domain][pageKey];
				
				// Page header
				var pageTitle = page.pageTitle;
				if (pageTitle.length > 80) pageTitle = pageTitle.slice(0, 80) + '…';
				var pageHeader = new Element('div', {
					'class': 'page-group',
					'html': '<h4 style="margin:4px 0 4px 20px; color:#888;">📄 ' + escapeHtml(pageTitle) + 
							(page.notes.length > 1 ? ' (' + page.notes.length + ' notes)' : '') + '</h4>'
				});
				pageHeader.inject(listEl);
				
				// Notes under this page
				page.notes.forEach(function(m) {
					var url = m.note.url || '';
					var noteText = m.note.note || '';
					var firstLine = noteText.split(/\r?\n/)[0];
					if (firstLine.length > 60) firstLine = firstLine.slice(0,60)+'…';
					
					var excerptCount = 0;
					excerptCount += (noteText.match(/---\n\*Added on /g) || []).length;
					excerptCount += (noteText.match(/\*摘录自:/g) || []).length;
					if (excerptCount === 0 && noteText.trim()) excerptCount = 1;
					
					var countBadge = excerptCount > 1 ? ' [' + excerptCount + ' selections]' : '';
					var timeStr = fmt(m.note.updatedAt) || '';
					
					var displayNoteTitle = firstLine || 'Note';
					if (!firstLine) {
						var excerpt = noteText.replace(/\n/g, ' ').trim();
						if (excerpt.length > 50) excerpt = excerpt.slice(0, 50) + '…';
						displayNoteTitle = excerpt || 'Empty note';
					}
					displayNoteTitle += countBadge;
					
					var item = '';
					item += '<div class="item" style="margin-left:40px;">';
					item += '<span class="time">' + timeStr + '</span>';
					item += '<a target="_blank" class="link" href="' + url + '">';
					item += '<img class="favicon" alt="Favicon" src="chrome://favicon/' + escapeHtml(url) + '">';
					item += '<span class="title" title="' + escapeHtml(url + ' - ' + noteText.substring(0, 200)) + '">📝 ' + escapeHtml(displayNoteTitle) + '</span>';
					item += '</a>';
					item += '<span class="note-actions" style="float:right;">';
					item += '<a href="#" onclick="openEditor(\''+m.note.visitId+'\', \''+escapeHtml(url)+'\', \''+escapeHtml(page.pageTitle)+'\', \''+escapeHtml(noteText)+'\'); return false;">✏️</a>';
					item += '<a href="#" onclick="copyNoteToClipboard(\''+escapeHtml(page.pageTitle)+'\', \''+escapeHtml(url)+'\', \''+escapeHtml(noteText)+'\'); return false;">📋</a>';
					item += '<a href="#" onclick="if(confirm(\'Delete note?\')) deleteNote(\''+m.note.visitId+'\', function(){load();}); return false;">🗑️</a>';
					item += '</span>';
					item += '</div>';
					
					var noteElement = new Element('div', { 
						'rel': rel, 
						'class': 'item-holder',
						'html': item + '<div class="clearitem" style="clear:both;"></div>'
					});
					noteElement.inject(listEl);
					
					rel = (rel === 'white') ? 'grey' : 'white';
				});
			}
		}
	}

	// Global copy function for fallback rendering
	window.copyNoteToClipboard = function(title, url, noteText) {
		var text = (title ? ('Title: ' + title + '\n') : '') + 
				  (url ? ('URL: ' + url + '\n') : '') + 
				  '\n' + noteText;
		if (typeof Clipboard !== 'undefined' && Clipboard.copy) {
			Clipboard.copy(text);
			alert('Note copied to clipboard!');
		} else {
			// Fallback for modern browsers
			navigator.clipboard.writeText(text).then(function() {
				alert('Note copied to clipboard!');
			}).catch(function() {
				alert('Failed to copy note to clipboard');
			});
		}
	};
	
	// Removed addNoteEventHandlers - now handled in tree structure
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
		console.log('enrich called with', list.length, 'notes from database');
		if (list.length===0){ 
			all=[]; 
			dataLoaded = true;
			renderNotesCalendar();
			render(all); 
			return; 
		}
		var i=0; all=[];
		(function next(){
			if (i>=list.length){ 
				console.log('enrichment complete, final all array has', all.length, 'items');
				all.sort(function(a,b){ return (b.note.updatedAt||0)-(a.note.updatedAt||0); }); 
				dataLoaded = true;
				// Update calendar with note counts
				renderNotesCalendar();
				// Show all notes initially (no filters)
				render(all); 
				return; 
			}
			var n=list[i++];
			console.log('processing note', i-1, ':', n.url, 'visitId:', n.visitId);
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
		var mm = $('note-modal'); if(!mm){ mm = new Element('div', { id:'note-modal', style:'display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.35); z-index:9999; align-items:center; justify-content:center;' }).inject(document.body); new Element('div',{ id:'note-modal-content', style:'padding:12px; width:720px; max-width:95%; background:#ffffff; border:1px solid #ccc; border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,0.2); margin:0 auto;' , html:'<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"><h3 id="note-modal-title" style="margin:0; font-size:16px;">📝</h3><div style="display:flex; gap:8px;"><button id="note-mode-edit" class="button" style="padding:4px 8px; font-size:12px;">Edit</button><button id="note-mode-preview" class="button" style="padding:4px 8px; font-size:12px;">Preview</button></div></div><div id="note-editor-container" style="display:flex; gap:8px; height:200px;"><div id="note-edit-pane" style="flex:1;"><textarea id="note-text" style="width:100%; height:100%; box-sizing:border-box; resize:none; font-family:monospace; font-size:13px;" placeholder="Enter your note in Markdown format..."></textarea></div><div id="note-preview-pane" style="flex:1; padding:8px; overflow-y:auto; display:none;"><div id="note-preview-content"></div></div></div><div style="margin-top:8px; font-size:11px;">Supports Markdown: **bold**, *italic*, `code`, [links](url), # headers, - lists</div><div style="margin-top:8px; text-align:right; display:flex; gap:8px; justify-content:flex-end;"><input id="note-delete" type="button" class="button" value="'+escapeHtml(returnLang('notesDelete')||'Delete')+'"><input id="note-cancel" type="button" class="button" value="'+escapeHtml(returnLang('notesCancel')||'Cancel')+'"><input id="note-save" type="button" class="button" value="'+escapeHtml(returnLang('notesSave')||'Save')+'"></div>'}).inject(mm); }
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
				style:'padding:20px; width:720px; max-width:95%; max-height:80%; background:#ffffff; border:1px solid #ccc; border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,0.2); margin:0 auto; overflow-y:auto;' , 
				html:'<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:8px;"><h3 id="note-viewer-title" style="margin:0; font-size:18px;">📖</h3><button id="note-viewer-close" class="button" style="padding:4px 8px;">Close</button></div><div id="note-viewer-rendered" style="line-height:1.6; font-size:14px;"></div>'
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
	// Search functionality is now handled by the unified filter system
	// Original search event handler removed - now handled in initializeSearch()

	
	// Date filtering functionality
	function initializeDateFilter() {
		// Show calendar toggle
		if ($('showCalendar')) {
			$('showCalendar').addEvent('click', function(e) {
				e.stop();
				showCalendar();
			});
		}
		
		// Initialize date selectors
		var dateFormat = localStorage['rh-date'] || 'dd/mm/yyyy';
		if (dateFormat) {
			var derhdf = dateFormat;
			derhdf = derhdf.replace('dd', 'dsdi').replace('mm', 'dsmi').replace('yyyy', 'dsyi');
			derhdf = derhdf.split('/');
			
			if ($(derhdf[0])) $(derhdf[0]).set('html', '<select class="select" id="date-select-day"></select>');
			if ($(derhdf[1])) $(derhdf[1]).set('html', '<select class="select" id="date-select-month"><option value="01">01</option><option value="02">02</option><option value="03">03</option><option value="04">04</option><option value="05">05</option><option value="06">06</option><option value="07">07</option><option value="08">08</option><option value="09">09</option><option value="10">10</option><option value="11">11</option><option value="12">12</option></select>');
			if ($(derhdf[2])) $(derhdf[2]).set('html', '<select class="select" id="date-select-year"></select>');
			
			// Add change events
			if ($('date-select-day')) {
				$('date-select-day').addEvent('change', function () {
					updateDateFilter();
				});
			}
			if ($('date-select-month')) {
				$('date-select-month').addEvent('change', function () {
					updateDateFilter();
					renderNotesCalendar();
				});
			}
			if ($('date-select-year')) {
				$('date-select-year').addEvent('change', function () {
					updateDateFilter();
					renderNotesCalendar();
				});
			}
			
			// Initialize calendar
			initializeCalendar();
			
			// Setup date range filtering
			setupDateRangeFiltering();
			
			// Note: renderNotesCalendar() will be called after data loads
		}
	}
	
	function initializeCalendar() {
		var currentDate = new Date();
		var currentYear = currentDate.getFullYear();
		
		// Populate year selector
		if ($('date-select-year')) {
			$('date-select-year').set('html', '');
			for (var i = 0; i <= 1; i++) {
				var year = currentYear - i;
				var option = new Element('option', {
					'value': year,
					'text': year
				});
				if (i === 0) option.set('selected', 'selected');
				option.inject($('date-select-year'));
			}
		}
		
		// Set current month
		if ($('date-select-month')) {
			var currentMonth = currentDate.getMonth() + 1;
			$$('#date-select-month option').each(function(el) {
				if (parseInt(el.get('value')) === currentMonth) {
					el.set('selected', 'selected');
				}
			});
		}
		
		// Populate day selector and set current day
		updateDaySelector();
	}
	
	function updateDaySelector() {
		if (!$('date-select-day') || !$('date-select-month') || !$('date-select-year')) return;
		
		var yearSelect = $('date-select-year');
		var monthSelect = $('date-select-month');
		var year = parseInt(yearSelect.value || yearSelect.options[yearSelect.selectedIndex].value);
		var month = parseInt(monthSelect.value || monthSelect.options[monthSelect.selectedIndex].value);
		var currentDate = new Date();
		var currentDay = currentDate.getDate();
		
		// Days in month
		var daysInMonth = new Date(year, month, 0).getDate();
		
		$('date-select-day').set('html', '');
		for (var day = 1; day <= daysInMonth; day++) {
			var dayStr = day < 10 ? '0' + day : '' + day;
			var option = new Element('option', {
				'value': dayStr,
				'text': dayStr
			});
			if (day === currentDay && month === (currentDate.getMonth() + 1) && year === currentDate.getFullYear()) {
				option.set('selected', 'selected');
			}
			option.inject($('date-select-day'));
		}
	}
	
	function updateDateFilter() {
		if (!$('date-select-day') || !$('date-select-month') || !$('date-select-year')) return;
		
		// Use value property directly instead of getSelected()
		var yearSelect = $('date-select-year');
		var monthSelect = $('date-select-month');
		var daySelect = $('date-select-day');
		
		if (!yearSelect || !monthSelect || !daySelect) {
			console.error('[updateDateFilter] Date selectors not found');
			return;
		}
		
		var year = parseInt(yearSelect.value || (yearSelect.options && yearSelect.options[yearSelect.selectedIndex] && yearSelect.options[yearSelect.selectedIndex].value));
		var month = parseInt(monthSelect.value || (monthSelect.options && monthSelect.options[monthSelect.selectedIndex] && monthSelect.options[monthSelect.selectedIndex].value)) - 1; // JavaScript months are 0-based
		var day = parseInt(daySelect.value || (daySelect.options && daySelect.options[daySelect.selectedIndex] && daySelect.options[daySelect.selectedIndex].value));
		
		// Check if values are valid
		if (isNaN(year) || isNaN(month) || isNaN(day)) {
			console.error('[updateDateFilter] Invalid date values:', year, month, day);
			return;
		}
		
		var startDate = new Date(year, month, day, 0, 0, 0, 0);
		var endDate = new Date(year, month, day, 23, 59, 59, 999);
		
		selectedDateRange = {
			start: startDate.getTime(),
			end: endDate.getTime()
		};
		
		// Update day selector in case month/year changed
		updateDaySelector();
		
		// Only refilter if data is already loaded
		if (dataLoaded) {
			applyFilters();
		}
	}
	
	// Search functionality
	function initializeSearch() {
		// Main search box
		if (searchEl) {
			searchEl.addEvent('keyup', function() {
				currentSearchQuery = this.get('value').toLowerCase();
				applyFilters();
			});
		}
		
		// Advanced search box
		if ($('rh-search')) {
			$('rh-search').addEvent('keyup', function() {
				currentSearchQuery = this.get('value').toLowerCase();
				applyFilters();
			});
		}
		
		// Search tags
		$$('#search-tag a').each(function(tag) {
			tag.addEvent('click', function(e) {
				e.stop();
				var tagText = this.get('text');
				if ($('rh-search')) {
					$('rh-search').set('value', tagText);
					currentSearchQuery = tagText.toLowerCase();
					applyFilters();
				}
			});
		});
	}
	
	function applyFilters() {
		var filteredNotes = all.slice(); // Copy all notes
		
		// Apply date filter
		if (selectedDateRange) {
			filteredNotes = filteredNotes.filter(function(item) {
				var updatedAt = item.note.updatedAt;
				if (!updatedAt) return false;
				
				// Handle both timestamp and ISO string formats
				var noteTime;
				if (typeof updatedAt === 'string') {
					// ISO string format
					noteTime = new Date(updatedAt).getTime();
				} else {
					// Timestamp format
					noteTime = updatedAt;
				}
				
				var inRange = noteTime >= selectedDateRange.start && noteTime <= selectedDateRange.end;
				return inRange;
			});
		}
		
		// Apply search filter
		if (currentSearchQuery) {
			filteredNotes = filteredNotes.filter(function(item) {
				var url = (item.note.url || '').toLowerCase();
				var title = (item.title || '').toLowerCase();
				var noteText = (item.note.note || '').toLowerCase();
				return url.indexOf(currentSearchQuery) >= 0 || 
					   title.indexOf(currentSearchQuery) >= 0 || 
					   noteText.indexOf(currentSearchQuery) >= 0;
			});
		}
		
		render(filteredNotes);
		
		// Update total count
		if ($('calendar-total-value')) {
			$('calendar-total-value').set('text', filteredNotes.length);
		}
	}
	
	// Calendar display toggle
	function showCalendar() {
		if ($('calendar')) {
			var calendar = $('calendar');
			var currentDisplay = calendar.getStyle('display');
			if (currentDisplay === 'none' || currentDisplay === '') {
				calendar.setStyle('display', 'block');
			} else {
				calendar.setStyle('display', 'none');
			}
		}
	}
	
	// Clear all filters
	function clearFilters() {
		selectedDateRange = null;
		currentSearchQuery = '';
		
		if ($('rh-search')) $('rh-search').set('value', '');
		if (searchEl) searchEl.set('value', '');
		
		applyFilters();
	}
	
	// Export clear function globally for possible UI use
	window.clearNotesFilters = clearFilters;
	
	// Custom calendar rendering for notes with date statistics
	function renderNotesCalendar() {
		if (!$('calendar-days')) return;
		
		// Get selected year and month
		var yearSelect = $('date-select-year');
		var monthSelect = $('date-select-month');
		var year = parseInt(yearSelect.value || yearSelect.options[yearSelect.selectedIndex].value);
		var month = parseInt(monthSelect.value || monthSelect.options[monthSelect.selectedIndex].value) - 1; // JavaScript month is 0-based
		
		// Calculate notes count by date
		var notesCountByDate = {};
		all.forEach(function(item) {
			if (item.note && item.note.updatedAt) {
				var noteDate = new Date(item.note.updatedAt);
				if (noteDate.getFullYear() === year && noteDate.getMonth() === month) {
					var day = noteDate.getDate();
					notesCountByDate[day] = (notesCountByDate[day] || 0) + 1;

				}
			}
		});
		
		// Clear existing calendar days
		$('calendar-days').set('html', '');
		
		// Calculate days in month
		var daysInMonth = new Date(year, month + 1, 0).getDate();
		var firstDayOfWeek = new Date(year, month, 1).getDay();
		var currentDate = new Date();
		var currentDay = currentDate.getDate();
		var isCurrentMonth = currentDate.getFullYear() === year && currentDate.getMonth() === month;
		
		// Add empty days for alignment
		for (var i = 0; i < firstDayOfWeek; i++) {
			new Element('span', { html: '&nbsp;', 'class': 'day' }).inject('calendar-days');
		}
		
		// Add calendar days
		for (var day = 1; day <= daysInMonth; day++) {
			var dayEl = new Element('a', {
				href: '#',
				text: day,
				'class': 'day',
				rel: day + '|' + (month + 1) + '|' + year
			});
			
			// Mark current day
			if (isCurrentMonth && day === currentDay) {
				dayEl.set('id', 'selected');
			}
			
			// Add notes count indicator
			if (notesCountByDate[day]) {
				dayEl.addClass('has-notes');
				dayEl.set('title', notesCountByDate[day] + ' 笔记');
				// Add visual indicator style
				dayEl.setStyle('position', 'relative');
				dayEl.setStyle('font-weight', 'bold');
				dayEl.setStyle('color', '#4CAF50');
				
				// Add small count text
				var countText = new Element('span', {
					text: '(' + notesCountByDate[day] + ')',
					styles: {
						'font-size': '10px',
						'margin-left': '2px'
					}
				});
				countText.inject(dayEl);
			}
			
			// Add click handler
			dayEl.addEvent('click', function(e) {
				e.stop();
				var rel = this.get('rel').split('|');
				var selectedDay = parseInt(rel[0]);
				var selectedMonth = parseInt(rel[1]);
				var selectedYear = parseInt(rel[2]);
				
				// Update UI selected state
				$$('#calendar-days a#selected').removeProperty('id');
				this.set('id', 'selected');
				
				// Update date selectors
				// Format day and month as two-digit strings
				var dayStr = selectedDay < 10 ? '0' + selectedDay : '' + selectedDay;
				var monthStr = selectedMonth < 10 ? '0' + selectedMonth : '' + selectedMonth;
				
				$('date-select-day').set('value', dayStr);
				$('date-select-month').set('value', monthStr);
				$('date-select-year').set('value', selectedYear);
				
				// Trigger date filter update
				updateDateFilter();
			});
			
			dayEl.inject('calendar-days');
		}
		
		// Add empty days at the end for alignment
		var lastDayOfWeek = new Date(year, month, daysInMonth).getDay();
		for (var i = lastDayOfWeek; i < 6; i++) {
			new Element('span', { html: '&nbsp;', 'class': 'day' }).inject('calendar-days');
		}
	}
	
	// Setup date range filtering
	function setupDateRangeFiltering() {
		var rangeButton = $('delete-range-button');
		if (rangeButton) {
			rangeButton.set('value', '筛选日期');
			rangeButton.removeEvents('click');
			rangeButton.addEvent('click', function() {
				var startInput = $('delete-range-one').get('value');
				var endInput = $('delete-range-two').get('value');
				
				if (startInput && endInput) {
					// Parse dates (assuming format: yyyy-mm-dd or dd/mm/yyyy)
					var startDate, endDate;
					if (startInput.indexOf('-') > -1) {
						// yyyy-mm-dd format
						startDate = new Date(startInput);
						endDate = new Date(endInput);
					} else if (startInput.indexOf('/') > -1) {
						// dd/mm/yyyy format
						var startParts = startInput.split('/');
						var endParts = endInput.split('/');
						startDate = new Date(startParts[2], startParts[1]-1, startParts[0]);
						endDate = new Date(endParts[2], endParts[1]-1, endParts[0]);
					}
					
					if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
						selectedDateRange = {
							start: new Date(startDate.setHours(0, 0, 0, 0)),
							end: new Date(endDate.setHours(23, 59, 59, 999))
						};
						applyFilters();
						// Clear selected day highlight
						$$('#calendar-days a#selected').removeProperty('id');
					} else {
						alert('请输入有效的日期格式 (dd/mm/yyyy 或 yyyy-mm-dd)');
					}
				}
			});
		}
		
			// Add placeholders for date inputs
	if ($('delete-range-one')) $('delete-range-one').set('placeholder', '开始日期');
	if ($('delete-range-two')) $('delete-range-two').set('placeholder', '结束日期');
}
});