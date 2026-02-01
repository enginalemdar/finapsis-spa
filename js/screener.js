// js/screener.js

const METRIC_DEFINITIONS = [
    { id: 'fk', label: 'DÜŞÜK F/K', dataKey: 'F/K', direction: 'low', icon: 'fa-tag' },
    { id: 'pddd', label: 'DÜŞÜK PD/DD', dataKey: 'PD/DD', direction: 'low', icon: 'fa-layer-group' },
    { id: 'pd', label: 'YÜKSEK PİYASA DEĞ.', dataKey: 'Piyasa Değeri', direction: 'high', icon: 'fa-building' },
    { id: 'ps', label: 'DÜŞÜK FİYAT/SATIŞ', dataKey: 'Fiyat/Satışlar', direction: 'low', icon: 'fa-percent' },
    { id: 'ev_sales', label: 'DÜŞÜK FD/SATIŞ', dataKey: 'Gelir Çarpanı', direction: 'low', icon: 'fa-money-bill-wave' },
    { id: 'ev_ebitda', label: 'DÜŞÜK FD/FAVÖK', dataKey: 'FVÖK Çarpanı', direction: 'low', icon: 'fa-chart-pie' },
    { id: 'margin_op', label: 'YÜKSEK FAAL. KAR MARJI', dataKey: 'Faaliyet Kâr Marjı', direction: 'high', icon: 'fa-chart-line', isPercent: true },
    { id: 'margin_gross', label: 'YÜKSEK BRÜT MARJ', dataKey: 'Brüt Kar Marjı', direction: 'high', icon: 'fa-basket-shopping', isPercent: true },
    { id: 'roic', label: 'YÜKSEK ROIC', dataKey: 'ROIC', direction: 'high', icon: 'fa-crown', isPercent: true },
    { id: 'roa', label: 'YÜKSEK ROA', dataKey: 'ROA', direction: 'high', icon: 'fa-warehouse', isPercent: true },
    { id: 'roe', label: 'YÜKSEK ROE', dataKey: 'ROE', direction: 'high', icon: 'fa-trophy', isPercent: true },
    { id: 'growth_sales', label: 'YÜKSEK SATIŞ BÜYÜMESİ', dataKey: 'Satış Büyümesi TTM', direction: 'high', icon: 'fa-arrow-trend-up', isPercent: true },
    { id: 'growth_op', label: 'YÜKSEK FAAL. KAR BÜYÜMESİ', dataKey: 'Faaliyet Kar Büyümesi TTM', direction: 'high', icon: 'fa-rocket', isPercent: true },
    { id: 'acid', label: 'YÜKSEK ASİT TEST ORANI', dataKey: 'Asit Test Oranı', direction: 'high', icon: 'fa-flask' },
    { id: 'current', label: 'YÜKSEK CARİ ORAN', dataKey: 'Cari Oran', direction: 'high', icon: 'fa-battery-full' },
    { id: 'debteq', label: 'DÜŞÜK BORÇ/ÖZ KAYNAK', dataKey: 'Borç/Öz Kaynak', direction: 'low', icon: 'fa-scale-unbalanced' },
    { id: 'netdebt_ebitda', label: 'DÜŞÜK NET BORÇ/FAVÖK', dataKey: 'Net Borç/FAVÖK', direction: 'low', icon: 'fa-file-invoice-dollar' },
    { id: 'beta', label: 'DÜŞÜK BETA', dataKey: 'Beta', direction: 'low', icon: 'fa-heart-pulse' }, 
    { id: 'inv_turn', label: 'YÜKSEK STOK DEVİR HIZI', dataKey: 'Stok Devir Hızı', direction: 'high', icon: 'fa-boxes-stacked' },
    { id: 'rec_turn', label: 'YÜKSEK ALACAK DEVİR HIZI', dataKey: 'Alacak Devir Hızı', direction: 'high', icon: 'fa-hand-holding-dollar' },
    { id: 'pay_turn', label: 'DÜŞÜK BORÇ DEVİR HIZI', dataKey: 'Borç Devir Hızı', direction: 'low', icon: 'fa-file-invoice-dollar' },
    { id: 'ccc', label: 'DÜŞÜK NAKİT DÖNGÜSÜ', dataKey: 'Nakit Döngüsü', direction: 'low', icon: 'fa-arrows-rotate' },
    { id: 'revenue', label: 'YÜKSEK SATIŞ GELİRİ', dataKey: 'Satış Gelirleri', direction: 'high', icon: 'fa-sack-dollar' },
    { id: 'fcf', label: 'YÜKSEK SERBEST NAKİT AKIŞI', dataKey: 'Serbest Nakit Akışı', direction: 'high', icon: 'fa-faucet' },
    { id: 'cash', label: 'YÜKSEK NAKİT VARLIĞI', dataKey: 'Nakit ve Nakit Benzerleri', direction: 'high', icon: 'fa-wallet' },
    { id: 'equity', label: 'YÜKSEK ÖZ KAYNAK', dataKey: 'Ana Ortaklığa Ait Özkaynaklar', direction: 'high', icon: 'fa-landmark' }
];

let processedData = [];
let sectorStats = {};
let globalStats = {};
let activeMetrics = [];
let comparisonMode = 'sector';
let calculationMethod = 'median';

function initScreener() {
    try { scUpdateFilterBadges(); } catch(e){ console.error(e); }

    const isMapLoaded = window.__FIN_MAP && Object.keys(window.__FIN_MAP).length > 0;

    if (isMapLoaded) {
        console.log("[Screener] Veri hazır, tablo çiziliyor.");
        try { processScreenerData(); } catch(e) { console.error(e); }
        try { renderMetricsPool(); } catch(e) {}
        try { renderScreenerResults(); } catch(e) {}
        try { setupDragAndDrop(); } catch(e) {}
    } else {
        console.log("[Screener] Metrics indiriliyor...");
        const tbody = document.getElementById('screener-results-body');
        if(tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:#666;"><div class="spinner" style="margin:0 auto 10px auto;"></div>Veriler Yükleniyor...</td></tr>';

        finBuildMapForActiveGroup(() => {
            _renderScreenerUI(); 
        });
    }
}

function scUpdateFilterBadges() {
    const area = document.getElementById("scActiveFiltersArea");
    if(!area) return;

    let groupLabel = "BIST";
    if(window.activeGroup === 'nyse') groupLabel = "NYSE";
    if(window.activeGroup === 'nasdaq') groupLabel = "NASDAQ";

    const currentSec = window.scSectorSelection || "TÜMÜ";
    const hasSector = !!window.scSectorSelection;
    
    const currentInd = window.scIndustrySelection || "TÜMÜ";
    const hasIndustry = !!window.scIndustrySelection;

    const compLabel = (comparisonMode === 'global') ? 'GENEL' : 'SEKTÖR';
    const calcLabel = (calculationMethod === 'mean') ? 'ORTALAMA' : 'MEDYAN';

    let html = '';

    // A. BORSA BADGE
    html += `
        <div style="position:relative; display:inline-block;">
            <div class="sc-badge market-badge" onclick="scToggleMarketPopup(event)" title="Borsa Değiştir">
                <i class="fa-solid fa-globe"></i>
                BORSA: ${groupLabel} <i class="fa-solid fa-chevron-down" style="font-size:9px; opacity:0.5; margin-left:4px;"></i>
            </div>
            <div id="scMarketPopup" class="sc-market-popup" onclick="event.stopPropagation()">
                <div class="sc-market-item ${window.activeGroup==='bist'?'active':''}" onclick="setGroup('bist')">BIST (İstanbul)</div>
                <div class="sc-market-item ${window.activeGroup==='nyse'?'active':''}" onclick="setGroup('nyse')">NYSE (New York)</div>
                <div class="sc-market-item ${window.activeGroup==='nasdaq'?'active':''}" onclick="setGroup('nasdaq')">NASDAQ</div>
            </div>
        </div>
    `;

    // B. SEKTÖR BADGE
    html += `
        <div style="position:relative; display:inline-block;">
            <div class="sc-badge ${hasSector ? 'active' : ''}" onclick="scToggleSectorPopup(event)" title="Sektör Filtrele">
                <i class="fa-solid fa-layer-group"></i>
                SEKTÖR: <span style="color:#fff;">${currentSec}</span>
                ${hasSector 
                    ? `<div class="sc-badge-close" onclick="event.stopPropagation(); scClearSectorFilter(event)"><i class="fa-solid fa-xmark"></i></div>` 
                    : '<i class="fa-solid fa-chevron-down" style="font-size:9px; opacity:0.5; margin-left:4px;"></i>'}
            </div>
            
            <div id="scSectorPopup" class="sc-sector-popup" onclick="event.stopPropagation()">
                <div class="sc-sector-head">
                    <div class="sc-sector-title">Sektör Seçimi</div>
                    <div class="sc-sector-actions">
                        <button class="sc-sector-clear" onclick="scClearSectorFilter(event)">Temizle</button>
                    </div>
                </div>
                <div style="padding:8px; border-bottom:1px solid rgba(255,255,255,0.1);">
                    <input type="text" id="scSectorSearchInput" placeholder="Sektör ara..." 
                           style="width:100%; background:#1a1a1a; border:1px solid #333; color:#fff; padding:8px 10px; border-radius:8px; font-size:12px; outline:none; font-weight:600;" 
                           oninput="scFilterListInPopup('sector', this.value)">
                </div>
                <div class="sc-sector-list" id="scSectorList"></div>
            </div>
        </div>
    `;

    // C. ALT SEKTÖR BADGE
    const indDisabledClass = !hasSector ? 'opacity-50 pointer-events-none grayscale' : '';
    
    html += `
        <div style="position:relative; display:inline-block;">
            <div class="sc-badge ${hasIndustry ? 'active' : ''}" style="${!hasSector ? 'opacity:0.4; pointer-events:none;' : ''}"
                 onclick="scToggleIndustryPopup(event)" title="Alt Sektör Filtrele">
                <i class="fa-solid fa-industry"></i>
                ALT SEKTÖR: <span style="color:#fff;">${currentInd}</span>
                ${hasIndustry 
                    ? `<div class="sc-badge-close" onclick="event.stopPropagation(); scClearIndustryFilter(event)"><i class="fa-solid fa-xmark"></i></div>` 
                    : '<i class="fa-solid fa-chevron-down" style="font-size:9px; opacity:0.5; margin-left:4px;"></i>'}
            </div>
            
            <div id="scIndustryPopup" class="sc-sector-popup" onclick="event.stopPropagation()">
                <div class="sc-sector-head">
                    <div class="sc-sector-title">Alt Sektör Seçimi</div>
                    <div class="sc-sector-actions">
                        <button class="sc-sector-clear" onclick="scClearIndustryFilter(event)">Temizle</button>
                    </div>
                </div>
                <div style="padding:8px; border-bottom:1px solid rgba(255,255,255,0.1);">
                    <input type="text" id="scIndustrySearchInput" placeholder="Alt sektör ara..." 
                           style="width:100%; background:#1a1a1a; border:1px solid #333; color:#fff; padding:8px 10px; border-radius:8px; font-size:12px; outline:none; font-weight:600;" 
                           oninput="scFilterListInPopup('industry', this.value)">
                </div>
                <div class="sc-sector-list" id="scIndustryList"></div>
            </div>
        </div>
    `;

    // D. KIYASLAMA BADGE
    html += `
        <div class="sc-badge" onclick="scToggleCompMode()" title="Kıyaslama: Sektör mü Genel mi?">
            <i class="fa-solid fa-scale-balanced"></i>
            KIYAS: <span style="color:#fff;">${compLabel}</span>
            <i class="fa-solid fa-rotate" style="font-size:9px; opacity:0.5; margin-left:4px;"></i>
        </div>
    `;

    // E. HESAPLAMA BADGE
    html += `
        <div class="sc-badge" onclick="scToggleCalcMethod()" title="Hesaplama: Ortalama mı Medyan mı?">
            <i class="fa-solid fa-calculator"></i>
            HESAP: <span style="color:#fff;">${calcLabel}</span>
            <i class="fa-solid fa-rotate" style="font-size:9px; opacity:0.5; margin-left:4px;"></i>
        </div>
    `;

    // F. SIFIRLA BUTONU
    html += `
        <div class="sc-badge reset-btn" onclick="resetApp()" title="Tüm filtreleri temizle">
            <i class="fa-solid fa-rotate-left"></i> SIFIRLA
        </div>
    `;

    area.innerHTML = html;
}

function _renderScreenerUI() {
    try { processScreenerData(); } catch(e) { console.error(e); }
    try { renderMetricsPool(); } catch(e) {}
    try { renderScreenerResults(); } catch(e) {}
    try { setupDragAndDrop(); } catch(e) {}
    try { scUpdateFilterBadges(); } catch(e) { console.error("Badge hatası:", e); }
}

function scToggleCompMode() {
    const newMode = (comparisonMode === 'sector') ? 'global' : 'sector';
    setComparisonMode(newMode);
}

function scToggleCalcMethod() {
    const newMethod = (calculationMethod === 'median') ? 'mean' : 'median';
    setCalcMethod(newMethod);
}

function scToggleMarketPopup(e) {
    if(e) e.stopPropagation();
    const pop = document.getElementById("scMarketPopup");
    if(pop) {
        scCloseAllPopups();
        const isVisible = pop.style.display === "block";
        pop.style.display = isVisible ? "none" : "block";
    }
}

function processScreenerData() {
    const map = window.__FIN_MAP || {};
    const defMap = {};
    METRIC_DEFINITIONS.forEach(m => defMap[m.dataKey] = m);

    processedData = window.companies
        .filter(c => c.group === window.activeGroup) 
        .map(comp => {
            const ticker = comp.ticker;
            const rawMetrics = map[ticker] || {};
            const preparedMetrics = {};

            for (const [key, val] of Object.entries(rawMetrics)) {
                if (val === null || val === undefined) continue;
                
                let finalVal = val;
                const def = defMap[key];
                
                if (def && def.isPercent && Math.abs(finalVal) < 5) {
                    finalVal = finalVal * 100;
                }
                
                preparedMetrics[key] = finalVal;
            }

            return { ...comp, ...preparedMetrics, score: 0, matches: [] };
        });
}

let __screenerStatsKey = "";

function ensureScreenerStats(){
  const keys = (activeMetrics || []).map(m => m.dataKey).filter(Boolean);
  keys.sort();

  const keyStr = `${window.activeGroup}|${keys.join(",")}`;
  if (__screenerStatsKey === keyStr) return;   
  __screenerStatsKey = keyStr;

  sectorStats = {};
  globalStats = {};

  if (!keys.length) return;

  const secValues = {};
  const globValues = {};

  for (const comp of (processedData || [])) {
    const sec = comp.sector || "Diğer";
    if (!secValues[sec]) secValues[sec] = {};
    const secObj = secValues[sec];

    for (let i=0; i<keys.length; i++){
      const k = keys[i];
      const v = comp[k];
      if (v === undefined || v === null) continue;

      (secObj[k] ||= []).push(v);
      (globValues[k] ||= []).push(v);
    }
  }

  const getStats = (arr) => {
    if (!arr || arr.length === 0) return { mean: null, median: null };
    arr.sort((a,b) => a-b);
    let sum = 0;
    for (let i=0;i<arr.length;i++) sum += arr[i];
    const mid = Math.floor(arr.length/2);
    const median = (arr.length % 2) ? arr[mid] : (arr[mid-1] + arr[mid]) / 2;
    return { mean: sum / arr.length, median };
  };

  for (const sec in secValues){
    sectorStats[sec] = {};
    for (let i=0;i<keys.length;i++){
      const k = keys[i];
      if (secValues[sec][k]) sectorStats[sec][k] = getStats(secValues[sec][k]);
    }
  }

  for (let i=0;i<keys.length;i++){
    const k = keys[i];
    if (globValues[k]) globalStats[k] = getStats(globValues[k]);
  }
}

function setComparisonMode(mode) {
    comparisonMode = mode;
    const lbl = document.getElementById('comp-label');
    if(lbl) lbl.innerText = mode === 'sector' ? 'SEKTÖR' : 'GENEL';
    scUpdateFilterBadges(); 
    renderScreenerResults();
}

function setCalcMethod(method) {
    calculationMethod = method;
    const lbl = document.getElementById('calc-label');
    if(lbl) lbl.innerText = method === 'mean' ? 'ORT' : 'MEDYAN';
    scUpdateFilterBadges(); 
    renderScreenerResults();
}

function renderMetricsPool() {
    const pool = document.getElementById('metrics-pool');
    const term = document.getElementById('metric-search').value.toLowerCase();
    
    const fragment = document.createDocumentFragment();
    METRIC_DEFINITIONS.forEach(m => {
        if (activeMetrics.find(am => am.id === m.id) || (term && !m.label.toLowerCase().includes(term))) return;
        const el = document.createElement('div');
        el.className = 'metric-item';
        el.draggable = true;
        const iconColor = m.direction === 'high' ? 'var(--finapsis-neon)' : 'var(--finapsis-red)';
        el.innerHTML = `<div class="metric-icon" style="color:${iconColor}"><i class="fa-solid ${m.icon}"></i></div><div style="font-size:10px; font-weight:600; color:rgba(255,255,255,0.7);">${m.label}</div>`;
        el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', m.id); el.style.opacity = '0.5'; });
        el.addEventListener('dragend', () => el.style.opacity = '1');
        fragment.appendChild(el);
    });
    pool.innerHTML = '';
    pool.appendChild(fragment);
}

window.scSectorSelection = "";
window.scIndustrySelection = ""; 

window.scBuildList = function(type){
    const listEl = document.getElementById(type === 'sector' ? "scSectorList" : "scIndustryList");
    if(!listEl) return;

    let items = [];
    
    if (type === 'sector') {
        items = [...new Set(window.companies
            .filter(c => c.group === window.activeGroup)
            .map(c => c.sector))]
            .filter(Boolean)
            .sort((a,b) => a.localeCompare(b,'tr'));
    } else {
        if(!window.scSectorSelection) return;
        items = [...new Set(window.companies
            .filter(c => c.group === window.activeGroup && c.sector === window.scSectorSelection)
            .map(c => c.industry))]
            .filter(Boolean)
            .sort((a,b) => a.localeCompare(b,'tr'));
    }

    const currentVal = type === 'sector' ? window.scSectorSelection : window.scIndustrySelection;
    const selectFn = type === 'sector' ? 'scSelectSector' : 'scSelectIndustry';
    const label = type === 'sector' ? 'Tüm Sektörler' : 'Tüm Alt Sektörler';

    let html = `<div class="sc-sector-item ${currentVal==="" ? "active":""}" onclick="${selectFn}('')">${label}</div>`;
    html += items.map(s => {
        const isActive = (s === currentVal) ? "active" : "";
        const safeS = s.replace(/"/g, '&quot;');
        return `<div class="sc-sector-item ${isActive}" onclick="${selectFn}('${safeS}')">${s}</div>`;
    }).join("");

    listEl.innerHTML = html;
};

window.scToggleSectorPopup = function(e) {
    if(e) e.stopPropagation();
    scCloseAllPopups(); 

    const pop = document.getElementById("scSectorPopup");
    const isOpen = (pop.style.display === 'block');
    
    if (!isOpen) {
        scBuildList('sector');
        const inp = document.getElementById("scSectorSearchInput");
        if(inp) { inp.value = ""; scFilterListInPopup('sector', ""); }
        pop.style.display = 'block';
    }
};

window.scToggleIndustryPopup = function(e) {
    if(e) e.stopPropagation();
    if(!window.scSectorSelection) return;

    scCloseAllPopups();

    const pop = document.getElementById("scIndustryPopup");
    const isOpen = (pop.style.display === 'block');
    
    if (!isOpen) {
        scBuildList('industry');
        const inp = document.getElementById("scIndustrySearchInput");
        if(inp) { inp.value = ""; scFilterListInPopup('industry', ""); }
        pop.style.display = 'block';
    }
};

window.scSelectSector = function(sec){
    window.scSectorSelection = sec;
    window.scIndustrySelection = ""; 
    
    renderScreenerResults();
    scUpdateFilterBadges();
};

window.scSelectIndustry = function(ind){
    window.scIndustrySelection = ind;
    
    renderScreenerResults();
    scUpdateFilterBadges();
};

window.scClearSectorFilter = function(e){
    if(e) { e.preventDefault(); e.stopPropagation(); }
    scSelectSector(""); 
};

window.scClearIndustryFilter = function(e){
    if(e) { e.preventDefault(); e.stopPropagation(); }
    scSelectIndustry("");
};

window.scFilterListInPopup = function(type, term){
    const t = String(term || "").toLocaleLowerCase('tr');
    const listId = type === 'sector' ? "scSectorList" : "scIndustryList";
    const items = document.querySelectorAll(`#${listId} .sc-sector-item`);
    
    items.forEach(el => {
        const txt = el.textContent.toLocaleLowerCase('tr');
        if(el.textContent.includes("Tüm") || txt.includes(t)) {
            el.style.display = "block";
        } else {
            el.style.display = "none";
        }
    });
};

function scCloseAllPopups() {
    document.querySelectorAll('.sc-sector-popup, .sc-market-popup').forEach(el => el.style.display = 'none');
}

document.addEventListener("click", (e) => {
    if (!e.target.closest('.sc-badge') && !e.target.closest('.sc-sector-popup') && !e.target.closest('.sc-market-popup')) {
        scCloseAllPopups();
    }
});

function filterMetrics() { renderMetricsPool(); }

function renderScreenerResults() {
    const tbody = document.getElementById('screener-results-body');
    if (!tbody) return;

    if (!activeMetrics || activeMetrics.length === 0) {
        tbody.innerHTML = `
            <tr>
              <td colspan="5" style="padding:40px; color:rgba(255,255,255,0.4); font-weight:600; text-align:center;">
                <i class="fa-solid fa-filter" style="font-size:24px; margin-bottom:10px; display:block;"></i>
                Sonuçları görmek için soldan metrik sürükleyip ekleyin.
              </td>
            </tr>`;
        return;
    }

    ensureScreenerStats();

    const rankedData = processedData.map(comp => {
        let score = 0;
        let matchDetails = [];
        
        if (window.scSectorSelection && comp.sector !== window.scSectorSelection) {
            return null; 
        }
        if (window.scIndustrySelection && comp.industry !== window.scIndustrySelection) {
            return null;
        }

        activeMetrics.forEach(metric => {
            const val = comp[metric.dataKey];
            const statObj = comparisonMode === 'sector' 
                ? (sectorStats[comp.sector] ? sectorStats[comp.sector][metric.dataKey] : null) 
                : globalStats[metric.dataKey];
            
            const avg = statObj ? statObj[calculationMethod] : null;

            if (val !== undefined && val !== null && avg !== undefined && avg !== null) {
                let isGood = false;
                
                if (metric.direction === 'low') {
                    if (val > 0 && val < avg) isGood = true; 
                } 
                else if (metric.direction === 'high') {
                    if (val > avg) isGood = true;
                }

                if (isGood) score++;
                matchDetails.push({ 
                    id: metric.id,
                    shortLabel: metric.dataKey, 
                    val, 
                    avg, 
                    good: isGood, 
                    isPercent: metric.isPercent 
                });
            }
        });
        return { ...comp, score, matchDetails };
    }).filter(Boolean);

    rankedData.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;

        for (const metric of activeMetrics) {
            const valA = a[metric.dataKey];
            const valB = b[metric.dataKey];

            const aValid = (valA !== null && valA !== undefined);
            const bValid = (valB !== null && valB !== undefined);
            if (!aValid && bValid) return 1;
            if (aValid && !bValid) return -1;
            if (!aValid && !bValid) continue;

            if (valA !== valB) {
                if (metric.direction === 'low') {
                    if (valA > 0 && valB <= 0) return -1;
                    if (valA <= 0 && valB > 0) return 1;
                    return valA - valB; 
                } else {
                    return valB - valA;
                }
            }
        }
        
        return a.ticker.localeCompare(b.ticker);
    });

    const displayLimit = 50; 
    const dataToRender = rankedData.slice(0, displayLimit);

    const htmlRows = dataToRender.map((comp, index) => {
        let detailsHtml = '';
        
        const sortedDetails = activeMetrics.map(m => comp.matchDetails.find(d => d.id === m.id)).filter(Boolean);

        if(sortedDetails.length > 0) {
             const boxes = sortedDetails.map(d => {
                 const className = d.good ? 'result-box good' : 'result-box bad';
                 let valStr, avgStr;

                 if (d.isPercent) {
                     valStr = `%${Number(d.val).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
                     avgStr = `%${Number(d.avg).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
                 } else {
                     valStr = finFormatMoneyCompact(d.val, { decimals: 1 });
                     avgStr = finFormatMoneyCompact(d.avg, { decimals: 1 });
                 }
                 
                 return `
                    <div class="${className}">
                        <div class="res-label" title="${d.shortLabel}">${d.shortLabel}</div>
                        <div class="res-val">${valStr}</div>
                        <div class="res-avg">${calculationMethod==='mean'?'ORT':'MED'}: ${avgStr}</div>
                    </div>`;
             }).join('');
             detailsHtml = `<div style="display:flex; gap:4px; justify-content:flex-end; flex-wrap:wrap; align-items:center;">${boxes}</div>`;
        }

        const badgeClass = comp.score > 0 ? "score-badge active" : "score-badge inactive";
        const logo = comp.logourl || ""; 

        return `
            <tr>
                <td style="text-align:center; color:rgba(255,255,255,0.3); font-size:10px;">${index + 1}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${logo}" style="width:24px; height:24px; object-fit:contain; background:#fff; border-radius:4px; padding:2px;" onerror="this.style.display='none'">
                        <div>
                            <div style="font-weight:700; color:#eee; font-size:13px;">${comp.ticker}</div>
                            <div style="margin-top:4px;">
                                <button class="fp-menu-btn" title="İşlemler" onclick="event.stopPropagation(); fpOpenRowMenu('${comp.ticker}', event)">
                                    <i class="fa-solid fa-ellipsis-vertical"></i>
                                </button>
                            </div>
                            <div style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; margin-top:2px;">${comp.name}</div>
                        </div>
                    </div>
                </td>
                <td><span style="font-size:9px; font-weight:700; background:rgba(255,255,255,0.06); padding:4px 8px; border-radius:4px; color:rgba(255,255,255,0.6); text-transform:uppercase;">${comp.sector}</span></td>
                <td style="text-align:center;"><div class="${badgeClass}">${comp.score}</div></td>
                <td style="text-align:right;">${detailsHtml}</td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = htmlRows;
    if (rankedData.length > displayLimit) {
        tbody.innerHTML += `<tr><td colspan="5" style="text-align:center; padding:10px; font-size:10px; color:#555;">...ve ${rankedData.length - displayLimit} şirket daha</td></tr>`;
    }
}

function setupDragAndDrop() {
    const container = document.querySelector('.drop-zone-container');
    
    container.ondragover = e => { 
        e.preventDefault(); 
        document.getElementById('active-criteria').classList.add('drag-over'); 
    };
    
    container.ondragleave = () => document.getElementById('active-criteria').classList.remove('drag-over');
    
    container.ondrop = e => { 
        e.preventDefault(); 
        document.getElementById('active-criteria').classList.remove('drag-over'); 
        
        const rawData = e.dataTransfer.getData('text/plain');
        
        if (!rawData.startsWith('{')) {
            addMetric(rawData);
        }
    };
    
    updateDropZoneUI();
}

function addMetric(id) {
    if (!activeMetrics.find(m => m.id === id)) { 
        const def = METRIC_DEFINITIONS.find(m => m.id === id);
        if(def) activeMetrics.push(def);
        updateDropZoneUI();
    }
}

function removeMetric(id) {
    activeMetrics = activeMetrics.filter(m => m.id !== id);
    updateDropZoneUI();
}

function updateDropZoneUI() {
    const zone = document.getElementById('active-criteria');
    zone.innerHTML = '';
    
    if (activeMetrics.length === 0) {
        zone.innerHTML = '<span style="width:100%; text-align:center; font-size:11px; color:rgba(255,255,255,0.2); font-style:italic; pointer-events:none; margin-top:10px;">METRİKLERİ BURAYA SÜRÜKLEYİN</span>';
    } else {
        activeMetrics.forEach((m, index) => {
            const el = document.createElement('div');
            el.className = 'active-metric-tag';
            el.draggable = true; 
            el.dataset.index = index; 
            
            el.innerHTML = `
                <i class="fa-solid fa-grip-lines" style="opacity:0.3; cursor:grab; margin-right:4px;"></i>
                <i class="fa-solid ${m.icon}" style="font-size:10px;"></i>
                <span>${m.label}</span>
                <i class="fa-solid fa-times remove-btn" onclick="removeMetric('${m.id}')"></i>
            `;

            el.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'reorder', fromIndex: index }));
                el.style.opacity = '0.4';
            });

            el.addEventListener('dragend', () => {
                el.style.opacity = '1';
            });

            el.addEventListener('dragover', (e) => {
                e.preventDefault(); 
                el.style.borderColor = '#c2f50e'; 
            });

            el.addEventListener('dragleave', () => {
                el.style.borderColor = 'rgba(194, 245, 14, 0.2)'; 
            });

            el.addEventListener('drop', (e) => {
                e.preventDefault();
                el.style.borderColor = 'rgba(194, 245, 14, 0.2)';
                
                try {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    if (data && data.type === 'reorder') {
                        const fromIdx = data.fromIndex;
                        const toIdx = index;

                        if (fromIdx !== toIdx) {
                            const item = activeMetrics.splice(fromIdx, 1)[0];
                            activeMetrics.splice(toIdx, 0, item);
                            
                            updateDropZoneUI();
                            renderScreenerResults();
                        }
                    }
                } catch (err) {}
            });

            zone.appendChild(el);
        });
    }
    
    renderMetricsPool(); 
    renderScreenerResults();
}

function resetApp() { 
    activeMetrics = []; 
    comparisonMode = 'sector';
    calculationMethod = 'median';
    window.scSectorSelection = "";
    window.scIndustrySelection = ""; 
    
    updateDropZoneUI(); 
    scUpdateFilterBadges(); 
}