// js/compare.js

(function(){
  let cmpInited = false;
  let cmpMapData = {};
  let cmpSelected = [];

  const CMP_DEFAULTS = {
    bist: ['ASELS','THYAO','ENKAI','EREGL'],
    nyse: ['BABA','TSM','JPM','V'],
    nasdaq: ['AAPL','NVDA','MSFT','GOOGL']
  };
  const CMP_MAX = 8;

  // --- BADGE RENDER (BORSA SEÇİMİ) ---
  window.cmpUpdateMarketBadge = function() {
      const area = document.getElementById("cmpMarketBadge");
      if(!area) return;

      let groupLabel = "BIST";
      if(window.activeGroup === 'nyse') groupLabel = "NYSE";
      if(window.activeGroup === 'nasdaq') groupLabel = "NASDAQ";

      area.innerHTML = `
          <div style="position:relative;">
              <div class="sc-badge market-badge" onclick="cmpToggleMarketPopup(event)" title="Borsa Değiştir">
                  <i class="fa-solid fa-globe"></i>
                  BORSA: ${groupLabel} <i class="fa-solid fa-chevron-down" style="font-size:9px; opacity:0.5; margin-left:4px;"></i>
              </div>
              <div id="cmpPopup_market" class="cl-popup-menu" onclick="event.stopPropagation()">
                  <div class="cl-popup-list">
                      <div class="cl-popup-item ${window.activeGroup==='bist'?'selected':''}" onclick="setGroup('bist')">BIST (İstanbul)</div>
                      <div class="cl-popup-item ${window.activeGroup==='nyse'?'selected':''}" onclick="setGroup('nyse')">NYSE (New York)</div>
                      <div class="cl-popup-item ${window.activeGroup==='nasdaq'?'selected':''}" onclick="setGroup('nasdaq')">NASDAQ</div>
                  </div>
              </div>
          </div>
      `;
  };

  window.cmpToggleMarketPopup = function(e) {
      if(e) e.stopPropagation();
      const pop = document.getElementById("cmpPopup_market");
      if(pop) {
          document.querySelectorAll('.cl-popup-menu').forEach(el => {
              if(el !== pop) el.style.display = 'none';
          });
          const isVisible = pop.style.display === "block";
          pop.style.display = isVisible ? "none" : "block";
      }
  };

  document.addEventListener('click', (e) => {
      if(!e.target.closest('.sc-badge') && !e.target.closest('.cl-popup-menu')) {
          const pop = document.getElementById("cmpPopup_market");
          if(pop) pop.style.display = 'none';
      }
  });

  // --- CORE LOGIC ---

  function cmpStorageKey(group){ return 'finapsis_cmp_selected_' + group; }

  function cmpLoadSelection(group){
    try{
      const raw = localStorage.getItem(cmpStorageKey(group));
      if(raw){
        const arr = JSON.parse(raw);
        if(Array.isArray(arr)) return arr.filter(Boolean);
      }
    }catch(e){}
    return (CMP_DEFAULTS[group] || []).slice();
  }

  function cmpSaveSelection(group){
    try{ localStorage.setItem(cmpStorageKey(group), JSON.stringify(cmpSelected)); }catch(e){}
  }

  function cmpCompanies() {
    const list = Array.isArray(window.companies) ? window.companies : [];
    return list.filter(c => c.group === window.activeGroup);
  }

  function cmpRebuildMap() {
    cmpMapData = window.__FIN_MAP || {};
  }

  function cmpEnsureSelection() {
    const allowed = new Set(cmpCompanies().map(c => c.ticker));
    cmpSelected = cmpSelected.filter(t => allowed.has(t) && cmpMapData[t]);

    if (cmpSelected.length === 0) {
      cmpSelected = cmpLoadSelection(window.activeGroup);
      cmpSelected = cmpSelected.filter(t => allowed.has(t) && cmpMapData[t]);
    }

    if (cmpSelected.length > CMP_MAX) cmpSelected = cmpSelected.slice(0, CMP_MAX);
    cmpSaveSelection(window.activeGroup);
  }

  function cmpUpdateHeight() {
    try {
      const root = document.getElementById('cmpHeightWrapper') || document.getElementById('view-compare');
      const h = Math.max(600, Math.ceil((root && root.scrollHeight) ? root.scrollHeight : 800) + 20);
      if(window.parent) window.parent.postMessage({ type: 'resize-iframe', height: h }, '*');
    } catch(e) {}
  }

  // --- SEARCH LOGIC ---
  function cmpInitSearch() {
    const input = document.getElementById('cmpSearch');
    const results = document.getElementById('cmpSearchResults');
    if (!input || !results) return;

    input.addEventListener('input', (e) => {
      cmpRebuildMap();
      const term = (e.target.value || '').toLocaleLowerCase('tr').trim();
      results.innerHTML = '';
      
      if (term.length < 1) { 
          results.style.display = 'none'; 
          return; 
      }

      const filtered = cmpCompanies()
        .filter(c => {
          const nameMatch = String(c.name || '').toLocaleLowerCase('tr').includes(term);
          const tickerMatch = String(c.ticker || '').toLocaleLowerCase('tr').includes(term);
              return (nameMatch || tickerMatch) && cmpMapData[c.ticker];

        })
        .slice(0, 10);

      if (filtered.length) {
        filtered.forEach(c => {
          const div = document.createElement('div');
          div.className = 'cmp-result-item';
          div.innerHTML = `
            <img src="${c.logourl || ''}" onerror="this.style.display='none'">
            <span>${c.ticker} <small style="color:rgba(255,255,255,0.4); margin-left:6px; font-weight:400;">${c.name || ''}</small></span>
          `;
          div.onclick = () => {
            if (!cmpSelected.includes(c.ticker)) {
              if (cmpSelected.length >= CMP_MAX) cmpSelected.shift();
              cmpSelected.push(c.ticker);
              cmpSaveSelection(window.activeGroup);
              window.cmpRender();
            }
            input.value = '';
            results.style.display = 'none';
          };
          results.appendChild(div);
        });
        results.style.display = 'block';
      } else {
        results.style.display = 'none';
      }
    });
  }

  function cmpRemoveTicker(t) {
    cmpSelected = cmpSelected.filter(x => x !== t);
    cmpSaveSelection(window.activeGroup);
    window.cmpRender();
  }

  // --- RENDER ---
  window.cmpRender = function cmpRender() {
    const view = document.getElementById('view-compare');
    if (!view || !view.classList.contains('active')) return;

    if(window.cmpUpdateMarketBadge) window.cmpUpdateMarketBadge();

    document.getElementById('cmp-preloader').style.display = 'flex';

    cmpRebuildMap();
    cmpEnsureSelection();

    const thead = document.getElementById('cmpThead');
    const tbody = document.getElementById('cmpTbody');
    const badgeArea = document.getElementById('cmpBadgeArea');
    if (!thead || !tbody || !badgeArea) return;

    badgeArea.innerHTML = '';
    thead.innerHTML = '';
    tbody.innerHTML = '';

    if (!cmpSelected.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:60px; color:#666;">Karşılaştırmak için şirket arayın.</td></tr>';
      document.getElementById('cmp-preloader').style.display = 'none';
      cmpUpdateHeight();
      return;
    }

    const comps = cmpCompanies();

    let hRow = '<tr><th>GÖSTERGELER</th>';
    cmpSelected.forEach(t => {
      const c = comps.find(x => x.ticker === t) || (window.companies||[]).find(x => x.ticker === t);
      const logoUrl = c ? (c.logourl || '') : '';
      
      hRow += `<th>
        <img src="${logoUrl}" class="cmp-flag-head" onerror="this.style.display='none'">
        <span class="cmp-country-title">${t}</span>
        <div style="margin-top:6px; display:flex; justify-content:center;">
            <button class="fp-add-btn" onclick="event.stopPropagation(); finOpenAddToPortfolio('${t}')" title="Portföye ekle"><i class="fa-solid fa-plus"></i></button>
        </div>
      </th>`;

      const b = document.createElement('div');
      b.className = 'cmp-badge';
      b.innerHTML = `${t} <button type="button" class="cmp-xbtn" data-x="${t}" title="Kaldır">×</button>`;
      badgeArea.appendChild(b);
    });
    hRow += '</tr>';
    thead.innerHTML = hRow;

    badgeArea.querySelectorAll('button.cmp-xbtn[data-x]').forEach(btn => {
      btn.addEventListener('click', () => cmpRemoveTicker(btn.getAttribute('data-x')));
    });

    const money = (v) => {
        if(v===null||v===undefined) return '<span class="muted">-</span>';
        return finFormatMoneyCompact(v);
    };
    const num = (v) => {
        if(v===null||v===undefined) return '<span class="muted">-</span>';
        return Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
    };

    const cfg = [
      { label: 'Piyasa Değeri', key: 'Piyasa Değeri', format: v => money(v), better: 'high' },
      { label: 'Firma Değeri', key: 'Firma Değeri', format: v => money(v), better: 'high' },
      { label: 'Gelirler (12 Ay)', key: 'Satış Gelirleri', format: v => money(v), better: 'high' },
      { label: 'Brüt Kar Marjı', key: 'Brüt Kar Marjı', format: v => `% ${num(v*100)}`, better: 'high' },
      { label: 'Faaliyet Marjı', key: 'Faaliyet Kâr Marjı', format: v => `% ${num(v*100)}`, better: 'high' },
      { label: 'F/K', key: 'F/K', format: v => num(v), better: 'low' },
      { label: 'PD/DD', key: 'PD/DD', format: v => num(v), better: 'low' },
      { label: 'Cari Oran', key: 'Cari Oran', format: v => num(v), better: 'high' },
      { label: 'Borç/Öz Kaynak', key: 'Borç/Öz Kaynak', format: v => num(v), better: 'low' },
      { label: 'ROE', key: 'ROE', format: v => `% ${num(v*100)}`, better: 'high' },
      { label: 'ROIC', key: 'ROIC', format: v => `% ${num(v*100)}`, better: 'high' }
    ];

    cfg.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="label-text">${row.label}</td>`;

      const rowValues = cmpSelected
        .map(t => ({ ticker: t, val: (cmpMapData[t] ? cmpMapData[t][row.key] : null) }))
        .filter(x => x.val !== null && !Number.isNaN(Number(x.val)));

      if (rowValues.length > 1 && row.better) {
        rowValues.sort((a,b) => row.better === 'high' ? (b.val - a.val) : (a.val - b.val));
      }

      cmpSelected.forEach(t => {
        const val = (cmpMapData[t] ? cmpMapData[t][row.key] : null);
        const formatted = row.format(val);
        const c = comps.find(x => x.ticker === t);
        const logoUrl = c ? (c.logourl || '') : '';

        let colorClass = '';
        if (rowValues.length > 1 && val !== null) {
          const rank = rowValues.findIndex(x => x.ticker === t);
          if (rank === 0) colorClass = 'cell-green';
          else if (rank === rowValues.length - 1) colorClass = 'cell-red';
        }

        tr.innerHTML += `<td class="${colorClass}">
          <div class="cmp-mobile-meta">
            <img src="${logoUrl}" onerror="this.style.display='none'">
            <span>${t}</span>
          </div>
          ${formatted}
        </td>`;
      });

      tbody.appendChild(tr);
    });

    document.getElementById('cmp-preloader').style.display = 'none';
    cmpUpdateHeight();
  };

  window.cmpOnGroupChange = function(group){
    cmpSelected = cmpLoadSelection(group);
    
    const inp = document.getElementById('cmpSearch');
    if(inp) {
        inp.value = '';
        if(group === 'nasdaq') inp.placeholder = "Şirket ara (örn: AAPL, NVDA...)";
        else if(group === 'nyse') inp.placeholder = "Şirket ara (örn: BABA, TSM...)";
        else inp.placeholder = "Şirket ara (örn: MGROS, THYAO...)";
    }
    
    if(window.cmpUpdateMarketBadge) window.cmpUpdateMarketBadge();
  };

  // INIT
  window.cmpInitOnce = function cmpInitOnce() {
    finEnsureCompanies();
    finEnsureBenchmarks();

    if (!cmpInited) {
        cmpInited = true;
        cmpInitSearch();
        if(window.cmpUpdateMarketBadge) window.cmpUpdateMarketBadge();
    }

    if (typeof finBuildMapForActiveGroup === "function") {
        const tbody = document.getElementById('cmpTbody');
        if(tbody && (!cmpSelected.length || Object.keys(cmpMapData).length === 0)) {
             document.getElementById('cmp-preloader').style.display = 'flex';
        }

        finBuildMapForActiveGroup(() => {
            if (window.cmpRender) window.cmpRender();
        });
    } else {
        setTimeout(() => { if (window.cmpRender) window.cmpRender(); }, 0);
    }
  };

})();