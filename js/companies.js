// js/companies.js

const map = window.__FIN_MAP || (window.__FIN_MAP = Object.create(null));

let clLimit = 200; 
let __clLastKey = "";
let __clRenderedCount = 0;
let __clAppendRequested = false;
let currentSort = { key: 'Piyasa Değeri', asc: false };
let activeFilters = { name: "", sector: "", ranges: {} };
const filterKeys = ["Piyasa Değeri", "Firma Değeri", "Satış Gelirleri", "Cari Oran", "Borç/Öz Kaynak", "Brüt Kar Marjı", "Faaliyet Kâr Marjı", "ROIC", "ROE", "PD/DD", "F/K"];
let __clSearchT = 0;
let __clIO = null;
let __clLoading = false;

window.clFilters = {
    sector: "",
    industry: "" 
};

function clLoadMore(){
  __clAppendRequested = true;
  clLimit += 200;
  renderCompanyList();
}

function clSetupInfiniteScroll(){
  const wrapper = document.querySelector('#view-companies .table-wrapper');
  const sentinel = document.getElementById('clSentinel');
  if (!wrapper || !sentinel) return;

  if (__clIO) { try { __clIO.disconnect(); } catch(e){} }

  __clIO = new IntersectionObserver((entries) => {
    const e = entries[0];
    if (!e || !e.isIntersecting) return;
    if (__clLoading) return;

    __clLoading = true;
    clLoadMore();

    setTimeout(() => { __clLoading = false; }, 150);
  }, { root: wrapper, rootMargin: '600px 0px 600px 0px', threshold: 0.01 });

  __clIO.observe(sentinel);
}

function clRoot(){
  return document.querySelector('#view-companies.view-section.active')
      || document.querySelector('#view-companies.view-section')
      || document.getElementById('view-companies');
}
function clQ(sel){
  const r = clRoot();
  return r ? r.querySelector(sel) : null;
}
function clQA(sel){
  const r = clRoot();
  return r ? Array.from(r.querySelectorAll(sel)) : [];
}

const mlnTL = (v) => (v === null || v === undefined) ? "-" : finFormatMoneyCompact(v);
const days = (v) => (v === null || v === undefined) ? "-" : Math.round(v) + " Gün";
const num = (v) => (v === null || v === undefined) ? "-" : v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v) => (v === null || v === undefined) ? "-" : "% " + (v * 100).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const cls = (v) => v > 0 ? "val-up" : (v < 0 ? "val-down" : "");

function toggleFilter() {
    const overlay = document.getElementById("filterOverlay");
    const isVisible = overlay.style.display === "block";
    overlay.style.display = isVisible ? "none" : "block";
}

function clearFilters() {
    document.getElementById("f_sector").value = "";
    filterKeys.forEach(k => { 
        const minEl = document.getElementById(`min_${k}`);
        const maxEl = document.getElementById(`max_${k}`);
        if(minEl) minEl.value = ""; 
        if(maxEl) maxEl.value = ""; 
    });
    activeFilters.ranges = {};
    renderCompanyList();
}

function applyFilters() {
    activeFilters.sector = document.getElementById("f_sector").value;
    filterKeys.forEach(k => {
        const minEl = document.getElementById(`min_${k}`);
        const maxEl = document.getElementById(`max_${k}`);
        activeFilters.ranges[k] = {
            min: minEl ? (parseFloat(minEl.value) || null) : null,
            max: maxEl ? (parseFloat(maxEl.value) || null) : null
        };
    });
    toggleFilter();
    renderCompanyList();
}

function renderCompanyList() {
  const tbody = clQ("#cl-tbody");
  if (!tbody) return;

  const keyObj = {
    g: window.activeGroup,
    sKey: currentSort.key,
    sAsc: currentSort.asc,
    name: (activeFilters.name || "").toLowerCase(),
    sector: activeFilters.sector || "",
    ranges: activeFilters.ranges || {}
  };
  const key = JSON.stringify(keyObj);

  const append = (__clAppendRequested && key === __clLastKey);
  __clAppendRequested = false;

  if (!append) {
    tbody.innerHTML = "";
    __clRenderedCount = 0;
    __clLastKey = key;
  }

  let filtered = window.companies.filter(c => {
      if(c.group !== window.activeGroup) return false;

      if (window.clFilters && window.clFilters.sector) {
          if (c.sector !== window.clFilters.sector) return false;
      }

      if (window.clFilters && window.clFilters.industry) {
          if (c.industry !== window.clFilters.industry) return false;
      }

      const d = map[c.ticker] || {};
      
      const q = String(activeFilters.name || "").toLocaleLowerCase('tr').trim();
      const nm = String(c.name || "").toLocaleLowerCase('tr');
      const tk = String(c.ticker || "").toLocaleLowerCase('tr');

      const matchName = (q.length < 1) ? true : (nm.includes(q) || tk.includes(q));
      const matchSector = activeFilters.sector === "" || c.sector === activeFilters.sector;
      let matchRanges = true;
      for (let key in activeFilters.ranges) {
          const val = d[key]; const range = activeFilters.ranges[key];
          let compareVal = val;
          if (key.includes("Değeri") && val) compareVal = val / 1_000_000;
          else if ((key.includes("Marjı") || key.includes("RO")) && val) compareVal = val * 100;
          if (range.min !== null && (val === null || compareVal < range.min)) matchRanges = false;
          if (range.max !== null && (val === null || compareVal > range.max)) matchRanges = false;
      }
      return matchName && matchSector && matchRanges;
  });

  filtered.sort((a, b) => {
      if (currentSort.key === 'name') {
          return currentSort.asc 
              ? a.name.localeCompare(b.name, "tr") 
              : b.name.localeCompare(a.name, "tr");
      }

      const dataA = map[a.ticker] || {};
      const dataB = map[b.ticker] || {};
      
      let valA = dataA[currentSort.key];
      let valB = dataB[currentSort.key];

      const hasA = (valA !== null && valA !== undefined);
      const hasB = (valB !== null && valB !== undefined);

      if (!hasA && !hasB) return 0;
      if (!hasA) return 1;  
      if (!hasB) return -1; 

      return currentSort.asc ? valA - valB : valB - valA;
  });

  const __q = String(activeFilters.name || "").trim();
  if (__q) {
    filtered = filtered.slice(0, 5000);
  } else {
    filtered = filtered.slice(0, clLimit);
  }

  window.__clRenderToken = (window.__clRenderToken || 0) + 1;
  const token = window.__clRenderToken;

  let i = __clRenderedCount;
  const BATCH = 25;

  function pump(){
    if (token !== window.__clRenderToken) return;

    // İlk batch: overlay loader'ı gizle
    if (i === 0) {
      const loader = document.getElementById('cl-loader');
      if (loader) loader.style.display = 'none';
    }

    const frag = document.createDocumentFragment();
    const end = Math.min(i + BATCH, filtered.length);

    for (; i < end; i++){
      const c = filtered[i];
      const d = map[c.ticker] || {};
      
      const price = window.currentPriceData[c.ticker] || 0;
      const prev = window.prevPriceData[c.ticker] || price;
      
      let priceHtml = '<span class="muted">-</span>';
      if (price > 0) {
          const diff = price - prev;
          const isUp = diff > 0;
          const isDown = diff < 0;
          const color = isUp ? 'color:#c2f50e;' : (isDown ? 'color:#ff4d4d;' : 'color:#eee;');
          const icon = isUp ? '<i class="fa-solid fa-caret-up"></i>' : (isDown ? '<i class="fa-solid fa-caret-down"></i>' : '');
          const sym = (['sp','nyse','nasdaq','doviz','emtia','kripto'].includes(c.group)) ? '$' : '₺';

          priceHtml = `
              <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px; font-weight:700; ${color}">
                  ${icon} <span>${sym}${price.toLocaleString("tr-TR", {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
              </div>
          `;
      }

      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="${c.logourl}" loading="lazy" style="width:32px; height:32px; object-fit:contain; background:#111; border-radius:6px; flex-shrink: 0;" onerror="this.style.display='none'">
            <div style="display: flex; flex-direction: column; justify-content: center; gap: 4px; overflow: hidden;">
              <a href="#" onclick="event.preventDefault(); if(window.finOpenDetail) window.finOpenDetail('${c.ticker}'); else { localStorage.setItem('finapsis_detail_ticker','${c.ticker}'); switchTab('detail'); }" style="font-weight:600; font-size:14px; color:#fff; text-decoration:none; cursor:pointer;">${c.name}</a>
              <div style="font-size:11px; color:#666;">${c.ticker} • ${c.sector}</div>
            </div>
            <button class="fp-menu-btn" title="İşlemler" onclick="event.stopPropagation(); fpOpenRowMenu('${c.ticker}', event)">
              <i class="fa-solid fa-ellipsis-vertical"></i>
            </button>
          </div>
        </td>

        <td data-label="Fiyat">${priceHtml}</td>

        <td data-label="Piyasa Değeri">${mlnTL(d["Piyasa Değeri"])}</td>
        <td data-label="Firma Değeri">${mlnTL(d["Firma Değeri"])}</td>
        <td data-label="Satış Gelirleri">${mlnTL(d["Satış Gelirleri"])}</td>

        <td data-label="Brüt Kar Marjı" class="${cls(d["Brüt Kar Marjı"])}">${pct(d["Brüt Kar Marjı"])}</td>
        <td data-label="Faaliyet Kâr Marjı" class="${cls(d["Faaliyet Kâr Marjı"])}">${pct(d["Faaliyet Kâr Marjı"])}</td>

        <td data-label="Cari Oran">${num(d["Cari Oran"])}</td>
        <td data-label="Asit Test Oranı">${num(d["Asit Test Oranı"])}</td>
        <td data-label="Borç/Öz Kaynak">${num(d["Borç/Öz Kaynak"])}</td>

        <td data-label="Nakit Döngüsü">${days(d["Nakit Döngüsü"])}</td>
        <td data-label="Stok Devir Hızı">${num(d["Stok Devir Hızı"])}</td>
        <td data-label="Stok Süresi">${days(d["Stok Süresi"])}</td>
        <td data-label="Alacak Devir Hızı">${num(d["Alacak Devir Hızı"])}</td>
        <td data-label="Alacak Süresi">${days(d["Alacak Süresi"])}</td>
        <td data-label="Borç Devir Hızı">${num(d["Borç Devir Hızı"])}</td>
        <td data-label="Borç Süresi">${days(d["Borç Süresi"])}</td>

        <td data-label="ROIC" class="${cls(d["ROIC"])}">${pct(d["ROIC"])}</td>
        <td data-label="ROA" class="${cls(d["ROA"])}">${pct(d["ROA"])}</td>
        <td data-label="ROE" class="${cls(d["ROE"])}">${pct(d["ROE"])}</td>

        <td data-label="PD/DD">${num(d["PD/DD"])}</td>
        <td data-label="F/K">${num(d["F/K"])}</td>
        <td data-label="Fiyat/Satışlar">${num(d["Fiyat/Satışlar"])}</td>
      `;

      frag.appendChild(tr);
    }

    tbody.appendChild(frag);

    if (i < filtered.length) {
      // setTimeout ile ana thread'e nefes ver - scroll takılmayı önler
      setTimeout(pump, 0);
    } else {
      __clRenderedCount = filtered.length; 
      window.pfFinapsisResize?.();
      clSetupInfiniteScroll();
    }
  }

  // İlk batch hemen çalış
  pump();
}

window.clCloseSectorPopup = function(e){
  if(e) e.stopPropagation();
  const pop = document.getElementById("clSectorPopup");
  if(pop) pop.style.display = "none";
};

window.clSelectSector = function(sec){
  if(!window.clFilters) window.clFilters = {};
  window.clFilters.sector = sec;
  
  renderCompanyList();
  
  clCloseSectorPopup();
  clBuildSectorList(); 
};

window.clClearSectorFilter = function(e){
  if(e) e.stopPropagation();
  clSelectSector("");
};

window.clFilterSectorListInPopup = function(term){
  const t = String(term || "").toLocaleLowerCase('tr');
  const items = document.querySelectorAll("#clSectorList .cl-sector-item");
  
  items.forEach(el => {
    const txt = el.textContent.toLocaleLowerCase('tr');
    if(el.textContent === "Tüm Sektörler" || txt.includes(t)) {
      el.style.display = "block";
    } else {
      el.style.display = "none";
    }
  });
};

document.addEventListener("click", (e) => {
  const pop = document.getElementById("clSectorPopup");
  const btn = document.getElementById("clSectorBtn");
  if(pop && pop.style.display === "block") {
    if(!pop.contains(e.target) && !btn.contains(e.target)) {
      pop.style.display = "none";
    }
  }
});  

function updateCompanyListSectorDropdown() {
    const s = document.getElementById("f_sector");
    if(!s) return;
    s.innerHTML = '<option value="">Tüm Sektörler</option>'; 
    
    const sectors = [...new Set(window.companies
        .filter(c => c.group === window.activeGroup)
        .map(c => c.sector))]
        .filter(Boolean)
        .sort();

    sectors.forEach(sec => {
        let o = document.createElement("option"); 
        o.value = sec; 
        o.innerText = sec; 
        s.appendChild(o);
    });
}

function clUpdateSortHeaderUI(){
  clQA("#cl-thead th").forEach(th => {
    th.classList.remove("active-sort");
    th.removeAttribute("data-icon");
    const key = th.getAttribute("data-key");
    if (key === currentSort.key){
      th.classList.add("active-sort");
      th.setAttribute("data-icon", currentSort.asc ? " ↑" : " ↓");
    }
  });
}

function clBindHeaderSortOnce(){
  document.querySelectorAll("#cl-thead th").forEach(th => {
    if (th.__clSortBound) return;
    th.__clSortBound = true;

    th.onclick = () => {
      const k = th.getAttribute("data-key");
      if (!k) return;

      currentSort.asc = (currentSort.key === k) ? !currentSort.asc : (k === "name");
      currentSort.key = k;

      if (typeof clLimit !== "undefined") clLimit = 200;

      clUpdateSortHeaderUI();
      renderCompanyList();

      const w = document.getElementById("fin-container");
      if (w) w.scrollTop = 0;
    };
  });
}

window.initCompaniesList = function(){
  if (window.__companiesListInited) return;
  window.__companiesListInited = true;

  try { finEnsureCompanies && finEnsureCompanies(); } catch(e){}
  
  try { updateCompanyListSectorDropdown(); } catch(e){}

  currentSort = { key: 'Piyasa Değeri', asc: false };
  
  clBindHeaderSortOnce();
  clUpdateSortHeaderUI();
  
  if(window.clUpdateFilterBadges) window.clUpdateFilterBadges();

  if (typeof finBuildMapForActiveGroup === "function") {
    finBuildMapForActiveGroup(() => {
      clUpdateSortHeaderUI(); 
      renderCompanyList();    
    });
  } else {
    renderCompanyList();
  }

  try { clSetupInfiniteScroll(); } catch(e){}
};

window.applyMainSearch = function(src){
  clearTimeout(__clSearchT);
  __clSearchT = setTimeout(() => {
    try { __clAppendRequested = false; __clRenderedCount = 0; } catch(e){}
    try { clLimit = 200; } catch(e){}

    const el =
      (src && src.tagName === "INPUT") ? src :
      (src && src.target && src.target.tagName === "INPUT") ? src.target :
      document.querySelector('#view-companies.view-section.active #mainSearch') ||
      document.querySelector('#view-companies #mainSearch') ||
      document.getElementById("mainSearch");

    const val = el ? String(el.value || "") : "";

    try { if (typeof activeFilters === "object" && activeFilters) activeFilters.name = val; } catch(e){}

    try { if (typeof renderCompanyList === "function") renderCompanyList(); } catch(e){}
    try { if (typeof clSetupInfiniteScroll === "function") clSetupInfiniteScroll(); } catch(e){}
  }, 180);
};

window.clUpdateFilterBadges = function() {
    const area = document.getElementById("clFilterBadges");
    if(!area) return;

    const secName = window.clFilters.sector || "TÜMÜ";
    const indName = window.clFilters.industry || "TÜMÜ";
    const isSecSelected = !!window.clFilters.sector;
    
    let marketLabel = "BIST";
    if(window.activeGroup === 'nyse') marketLabel = "NYSE";
    if(window.activeGroup === 'nasdaq') marketLabel = "NASDAQ";

    let html = "";

    html += `
        <div style="position:relative;">
            <div class="cl-badge market-badge" onclick="clTogglePopup('market', event)">
                <i class="fa-solid fa-globe"></i>
                BORSA: ${marketLabel}
                <i class="fa-solid fa-chevron-down" style="font-size:10px; opacity:0.5;"></i>
            </div>
            <div id="clPopup_market" class="cl-popup-menu" onclick="event.stopPropagation()">
                <div class="cl-popup-list">
                    <div class="cl-popup-item ${window.activeGroup==='bist'?'selected':''}" onclick="setGroup('bist')">BIST (İstanbul)</div>
                    <div class="cl-popup-item ${window.activeGroup==='nyse'?'selected':''}" onclick="setGroup('nyse')">NYSE (New York)</div>
                    <div class="cl-popup-item ${window.activeGroup==='nasdaq'?'selected':''}" onclick="setGroup('nasdaq')">NASDAQ</div>
                </div>
            </div>
        </div>
    `;

    html += `
        <div style="position:relative;">
            <div class="cl-badge ${isSecSelected ? 'active' : ''}" onclick="clTogglePopup('sector', event)">
                <i class="fa-solid fa-layer-group"></i>
                SEKTÖR: ${secName}
                ${isSecSelected ? '<i class="fa-solid fa-xmark" onclick="clClearFilter(\'sector\', event)" style="opacity:0.6;"></i>' : '<i class="fa-solid fa-chevron-down" style="font-size:10px; opacity:0.5;"></i>'}
            </div>
            <div id="clPopup_sector" class="cl-popup-menu" onclick="event.stopPropagation()">
                <div class="cl-popup-search">
                    <input type="text" class="cl-popup-input" placeholder="Sektör ara..." oninput="clFilterPopupList('sector', this.value)">
                </div>
                <div id="clList_sector" class="cl-popup-list"></div>
            </div>
        </div>
    `;

    html += `
        <div style="position:relative;">
            <div class="cl-badge ${!isSecSelected ? 'disabled' : (window.clFilters.industry ? 'active' : '')}" 
                 onclick="${isSecSelected ? "clTogglePopup('industry', event)" : ''}">
                <i class="fa-solid fa-industry"></i>
                ALT SEKTÖR: ${indName}
                ${window.clFilters.industry ? '<i class="fa-solid fa-xmark" onclick="clClearFilter(\'industry\', event)" style="opacity:0.6;"></i>' : '<i class="fa-solid fa-chevron-down" style="font-size:10px; opacity:0.5;"></i>'}
            </div>
            <div id="clPopup_industry" class="cl-popup-menu" onclick="event.stopPropagation()">
                <div class="cl-popup-search">
                    <input type="text" class="cl-popup-input" placeholder="Alt sektör ara..." oninput="clFilterPopupList('industry', this.value)">
                </div>
                <div id="clList_industry" class="cl-popup-list"></div>
            </div>
        </div>
    `;

    area.innerHTML = html;
};

window.clTogglePopup = function(type, e) {
    if(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    const targetPopup = document.getElementById(`clPopup_${type}`);
    if(!targetPopup) return;

    const isAlreadyOpen = (targetPopup.style.display === 'block');

    document.querySelectorAll('.cl-popup-menu').forEach(el => el.style.display = 'none');

    if (!isAlreadyOpen) {
        
        if (type === 'market') {
            targetPopup.style.display = 'block';
            return;
        }

        const listEl = document.getElementById(`clList_${type}`);
        let items = [];
        
        if (type === 'sector') {
            items = [...new Set(window.companies
                .filter(c => c.group === window.activeGroup)
                .map(c => c.sector))].filter(Boolean).sort((a,b) => a.localeCompare(b,'tr'));
        } 
        else if (type === 'industry') {
            if(!window.clFilters.sector) return; 
            items = [...new Set(window.companies
                .filter(c => c.group === window.activeGroup && c.sector === window.clFilters.sector)
                .map(c => c.industry))].filter(Boolean).sort((a,b) => a.localeCompare(b,'tr'));
        }

        let listHtml = `<div class="cl-popup-item" onclick="clSelectFilter('${type}', '')">TÜMÜ</div>`;
        listHtml += items.map(i => {
            const isSel = (window.clFilters[type] === i);
            const safeVal = i.replace(/"/g, '&quot;');
            return `<div class="cl-popup-item ${isSel?'selected':''}" onclick="clSelectFilter('${type}', '${safeVal}')">${i}</div>`;
        }).join('');

        if(listEl) listEl.innerHTML = listHtml;

        const inp = targetPopup.querySelector('input');
        if(inp) inp.value = "";

        targetPopup.style.display = "block";
    }
};

window.clSelectFilter = function(type, val) {
    window.clFilters[type] = val;

    if (type === 'sector') {
        window.clFilters.industry = ""; 
    }

    clUpdateFilterBadges();
    renderCompanyList(); 
    
    document.querySelectorAll('.cl-popup-menu').forEach(el => el.style.display = 'none');
};

window.clClearFilter = function(type, e) {
    if(e) e.stopPropagation();
    clSelectFilter(type, "");
};

window.clFilterPopupList = function(type, term) {
    const t = term.toLocaleLowerCase('tr');
    const items = document.querySelectorAll(`#clList_${type} .cl-popup-item`);
    items.forEach(el => {
        const txt = el.textContent.toLocaleLowerCase('tr');
        el.style.display = (txt.includes(t) || el.textContent === "TÜMÜ") ? "block" : "none";
    });
};

document.addEventListener('click', () => {
    document.querySelectorAll('.cl-popup-menu').forEach(el => el.style.display = 'none');
});
