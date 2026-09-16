(function(){
  function setup(){
    const container=document.getElementById('pdfContainer');
    if(!container || document.getElementById('bulkDeleteBar')) return;
    const bar=document.createElement('div');
    bar.id='bulkDeleteBar';
    bar.style.cssText='display:none;align-items:center;gap:12px;margin:0 0 15px;padding:12px 16px;background:#fff;border-radius:14px;box-shadow:0 4px 14px rgba(0,0,0,.06);font-weight:700;';
    bar.innerHTML='<input id="selectAllFiles" type="checkbox" style="width:18px;height:18px;cursor:pointer"><span id="selectedFilesCount">0 selezionati</span><button id="bulkDeleteBtn" type="button" style="margin-left:auto;border:0;border-radius:10px;padding:10px 16px;background:#cc0000;color:#fff;font-weight:700;cursor:pointer"><i class="fa-solid fa-trash-can"></i> Elimina selezionati</button>';
    container.parentNode.insertBefore(bar,container);
    const count=()=>{const boxes=[...container.querySelectorAll('.bulk-file-checkbox')];const selected=boxes.filter(x=>x.checked);document.getElementById('selectedFilesCount').textContent=selected.length+' selezionati';bar.style.display=selected.length?'flex':'none';document.getElementById('selectAllFiles').checked=boxes.length>0&&selected.length===boxes.length;};
    container.addEventListener('change',e=>{if(e.target.classList.contains('bulk-file-checkbox'))count();});
    document.getElementById('selectAllFiles').addEventListener('change',e=>{container.querySelectorAll('.bulk-file-checkbox').forEach(x=>x.checked=e.target.checked);count();});
    document.getElementById('bulkDeleteBtn').addEventListener('click',async()=>{
      const selected=[...container.querySelectorAll('.bulk-file-checkbox:checked')].map(x=>({name:x.dataset.fileName,sha:x.dataset.fileSha}));
      if(!selected.length)return;
      if(!confirm(`Vuoi eliminare definitivamente ${selected.length} file selezionati?`))return;
      const token=window.GITHUB_TOKEN||''; const owner=window.OWNER||'laminetallth'; const repo=window.REPO||'TOP-HOUSE'; const folder=window.FOLDER_PATH||'';
      if(!token){alert('Token GitHub non disponibile.');return;}
      const btn=document.getElementById('bulkDeleteBtn');btn.disabled=true;btn.textContent='Eliminazione in corso...';
      let errors=0;
      for(const file of selected){
        try{const r=await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${folder}/${encodeURIComponent(file.name)}`,{method:'DELETE',headers:{Authorization:`token ${token}`,'Content-Type':'application/json'},body:JSON.stringify({message:`Eliminati file: ${file.name}`,sha:file.sha})});if(!r.ok)errors++;}catch(e){errors++;}
      }
      alert(errors?`Operazione completata con ${errors} errore/i.`:'File eliminati con successo.');
      if(typeof window.loadFiles==='function')window.loadFiles();else location.reload();
    });
  }
  function decorate(){
    const container=document.getElementById('pdfContainer'); if(!container)return;
    container.querySelectorAll('.file-item-wrapper').forEach(row=>{
      if(row.querySelector('.bulk-file-checkbox'))return;
      const link=row.querySelector('.file-link'); const del=row.querySelector('.delete-btn');
      if(!link||!del)return;
      const name=link.querySelector('.file-name')?.textContent?.trim()||'';
      const icon=link.querySelector('.file-icon');
      const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.className='bulk-file-checkbox';checkbox.dataset.fileName=name;checkbox.dataset.fileSha=del.closest('.file-item-wrapper')?.dataset?.fileSha||'';checkbox.style.cssText='width:18px;height:18px;cursor:pointer;flex:0 0 auto;margin-right:12px;';
      link.insertBefore(checkbox,link.firstChild);
    });
  }
  setup();
  new MutationObserver(decorate).observe(document.getElementById('pdfContainer')||document.body,{childList:true,subtree:true});
  setInterval(decorate,500);
})();