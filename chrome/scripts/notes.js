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
			var firstLine = (m.note.note||'').split(/\r?\n/)[0];
			if (firstLine.length>140) firstLine = firstLine.slice(0,140)+'…';
			var html = '';
			html += '<div class="item">';
			html += '<a class="link" href="'+url+'" target="_blank">'+escapeHtml(title)+'</a>';
			html += '<span class="info">'+(fmt(m.note.updatedAt)||'')+'</span>';
			html += '<div class="desc">'+escapeHtml(firstLine)+'</div>';
			html += '</div>';
			new Element('div', { 'html': html }).inject(listEl);
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
	searchEl && searchEl.addEvent('keyup', function(){
		var q=this.get('value').toLowerCase();
		if (!q){ render(all); return; }
		var f=all.filter(function(m){ return (m.note.url||'').toLowerCase().indexOf(q)>=0 || (m.title||'').toLowerCase().indexOf(q)>=0 || (m.note.note||'').toLowerCase().indexOf(q)>=0; });
		render(f);
	});
	load();
});