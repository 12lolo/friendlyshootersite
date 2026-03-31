(function(){
  function formatTime(ts){
    if(!ts) return '';
    var dt = new Date(ts*1000);
    return dt.toLocaleString();
  }
  function render(container, data, opts){
    container.innerHTML = '';
      // player badge (will be filled by init flow)
      var playerBadge = document.createElement('div'); playerBadge.className = 'lb-player'; container.appendChild(playerBadge);
      var h = document.createElement('div'); h.className='lb-header'; h.textContent = opts.title||'Leaderboard'; container.appendChild(h);
    var table = document.createElement('table'); table.className='lb-table';
    var thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>#</th><th>Player</th><th>Score</th><th>When</th></tr>';
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    data.slice(0, opts.maxEntries||10).forEach(function(e,i){
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>'+(i+1)+'</td><td>'+escapeHtml(e.playerName||e.playerId||'')+'</td><td>'+e.score+'</td><td>'+formatTime(e.timestamp)+'</td>';
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
    var footer = document.createElement('div'); footer.className='lb-footer'; footer.textContent = opts.footerText||'';
    container.appendChild(footer);
  }
  function escapeHtml(s){ return String(s).replace(/[&<>\"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; }); }
  function fetchAndRender(container, opts){
    fetch(opts.apiUrl, {cache:'no-store'}).then(function(res){
      if(!res.ok) throw new Error('HTTP '+res.status);
      return res.json();
    }).then(function(json){
      var data = Array.isArray(json) ? json : (json.entries||[]);
      render(container, data, opts);
    }).catch(function(err){
      container.innerHTML = '<div class="lb-error">Error loading leaderboard: '+escapeHtml(err.message)+'</div>';
    });
  }
  window.initLeaderboard = function(containerId, options){
    var container = typeof containerId==='string' ? document.getElementById(containerId) : containerId;
    if(!container) throw new Error('Container not found');
    var opts = Object.assign({apiUrl:'example-data.json',maxEntries:10,refreshSeconds:30,title:'Leaderboard'}, options||{});
      // resolve player name (from options, url param, fetch endpoint, or localStorage)
      resolvePlayerName(opts).then(function(name){
        var badge = container.querySelector('.lb-player');
        if(!badge){ badge = document.createElement('div'); badge.className='lb-player'; container.insertBefore(badge, container.firstChild); }
        if(name) badge.textContent = 'Player: ' + name;
        else badge.style.display = 'none';
      }).catch(function(){ /* ignore */ });
      fetchAndRender(container, opts);
    if(opts.refreshSeconds>0){
      setInterval(function(){ fetchAndRender(container, opts); }, opts.refreshSeconds*1000);
    }
  };
})();
