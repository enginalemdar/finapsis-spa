// js/screener.js (FIXED PERCENTAGE DISPLAY & COMPARISON)

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
let activeMetrics = [];
let comparisonMode = 'sector';
let calculationMethod = 'median';

// UI State
let isScreenerComputing = false;
let localStatsCache = {}; 
let localStatsKey = "";

function initScreener() {
    try { scUpdateFilterBadges(); } catch(e){ console.error(e); }

    const isMapLoaded = window.__FIN_MAP && Object.keys(window.__FIN_MAP).length > 0;

    if (isMapLoaded) {
        processScreenerData(); 
        renderMetricsPool(); 
        renderScreenerResults();
        setupDragAndDrop(); 
    } else {
        const tbody = document.getElementById('screener-results-body');
        if(tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:#666;"><div class="spinner" style="margin:0 auto 10px auto;"></div>Veriler Yükleniyor...</td></tr>';
    }
}

function _renderScreenerUI() {
    processScreenerData();
    renderMetricsPool();
    renderScreenerResults();
    setupDragAndDrop();
    scUpdateFilterBadges();
}

function processScreenerData() {
    processedData = (window.companies || []).filter(c => c.group === window.activeGroup);
}

// ------------------------------------------------
// LOOKUP (JSON -> Local Fallback)
// ------------------------------------------------
function getStatValue(sector, metricKey, method) {
    const stats = window.__SCREENER_STATS_CACHE || {};
    const groupData = stats[window.activeGroup];

    if (groupData) {
        let statObj = null;
        if (comparisonMode === 'global') {
            statObj = groupData.global ? groupData.global[metricKey] : null;
        } else {
            const sec = sector || "Diğer";
            if (groupData.sectors && groupData.sectors[sec]) {
                statObj = groupData.sectors[sec][metricKey];
            }
        }
        if (statObj && statObj[method] !== null) return statObj[method];
    }
    
    // Fallback: Local Cache (Eğer worker dosyası yoksa)
    return null;
}

// ------------------------------------------------
// ASYNC RENDER & CHUNKING
// ------------------------------------------------
let __renderTimeout;

function renderScreenerResults() {
    if (window.isFinDataReady === false) return; 

    if (__renderTimeout) clearTimeout(__renderTimeout);
    const tbody = document.getElementById('screener-results-body');
    if (!tbody) return;

    if (!isScreenerComputing) {
        tbody.style.opacity = "0.5";
        if (tbody.children.length < 2) {
             tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:50px; color:#c2f50e;"><div class="spinner" style="margin:0 auto 10px auto;"></div>Hesaplanıyor...</td></tr>';
             tbody.style.opacity = "1";
        }
    }

    __renderTimeout = setTimeout(() => {
        _renderScreenerResultsAsync(tbody);
    }, 100); 
}

async function _renderScreenerResultsAsync(tbody) {
    isScreenerComputing = true;

    if (!activeMetrics || activeMetrics.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px; color:rgba(255,255,255,0.4);">Metrik sürükleyin.</td></tr>`;
        tbody.style.opacity = "1";
        isScreenerComputing = false;
        return;
    }

    const map = window.__FIN_MAP || {};
    const sectorFilter = window.scSectorSelection;
    const industryFilter = window.scIndustrySelection;
    
    const chunkSize = 500; 
    let rankedData = [];
    
    // 1. HESAPLAMA
    for (let i = 0; i < processedData.length; i += chunkSize) {
        const chunk = processedData.slice(i, i + chunkSize);
        
        const chunkResults = chunk.map(comp => {
            if (sectorFilter && comp.sector !== sectorFilter) return null;
            if (industryFilter && comp.industry !== industryFilter) return null;

            let score = 0;
            let matchDetails = [];
            const d = map[comp.ticker] || {}; 

            for (const metric of activeMetrics) {
                let val = d[metric.dataKey]; // Şirket değeri (Ham: 0.23)
                let avg = getStatValue(comp.sector, metric.dataKey, calculationMethod); // İstatistik (Ham: 0.20)
                
                // Eğer stat bulunamazsa atla
                if (val !== undefined && val !== null && avg !== undefined && avg !== null) {
                    
                    // --- YÜZDE DÜZELTMESİ ---
                    // Eğer metrik yüzde ise (örn: Brüt Kar Marjı) ve değerler küçükse (0.23), 
                    // bunları 100 ile çarpıp %23 formatına getirelim ki UI'da düzgün görünsün.
                    // Hem val hem avg aynı formatta olmalı.
                    
                    let compareVal = val;
                    let compareAvg = avg;

                    // Eğer ham veri 0.xx formatındaysa ve biz %xx görmek istiyorsak:
                    if (metric.isPercent) {
                        if (Math.abs(compareVal) < 5) compareVal *= 100;
                        if (Math.abs(compareAvg) < 5) compareAvg *= 100;
                    }

                    let isGood = false;
                    if (metric.direction === 'low') {
                        if (compareVal > 0 && compareVal < compareAvg) isGood = true; 
                    } else if (metric.direction === 'high') {
                        if (compareVal > compareAvg) isGood = true;
                    }

                    if (isGood) score++;
                    
                    matchDetails.push({ 
                        id: metric.id, shortLabel: metric.dataKey, 
                        val: compareVal, // Düzeltilmiş (yüzdelik) değer
                        avg: compareAvg, // Düzeltilmiş (yüzdelik) ortalama
                        good: isGood, isPercent: metric.isPercent 
                    });
                }
            }
            
            return { 
                ticker: String(comp.ticker || ""), 
                name: comp.name, 
                sector: comp.sector, 
                logourl: comp.logourl,
                score, 
                matchDetails 
            };
        }).filter(Boolean);

        rankedData = rankedData.concat(chunkResults);
        await new Promise(r => setTimeout(r, 0));
    }

    // 2. SIRALAMA
    rankedData.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        
        for (const metric of activeMetrics) {
            const detA = a.matchDetails.find(x => x.id === metric.id);
            const detB = b.matchDetails.find(x => x.id === metric.id);
            const valA = detA ? detA.val : null;
            const valB = detB ? detB.val : null;

            if (valA !== null && valB === null) return -1;
            if (valA === null && valB !== null) return 1;
            if (valA === null && valB === null) continue;

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
        return String(a.ticker).localeCompare(String(b.ticker));
    });

    // 3. RENDER
    const displayLimit = 100; 
    const dataToRender = rankedData.slice(0, displayLimit);
    let html = '';
    const htmlChunkSize = 20;

    for (let i = 0; i < dataToRender.length; i += htmlChunkSize) {
        const chunk = dataToRender.slice(i, i + htmlChunkSize);
        
        chunk.forEach((comp, idx) => {
            const realIdx = i + idx + 1;
            
            // Detay kutularını, activeMetrics sırasına göre diz
            const sortedDetails = [];
            activeMetrics.forEach(m => {
                const d = comp.matchDetails.find(x => x.id === m.id);
                if(d) sortedDetails.push(d);
            });
            
            let detailsHtml = '';
            if(sortedDetails.length > 0) {
                 const boxes = sortedDetails.map(d => {
                     const className = d.good ? 'result-box good' : 'result-box bad';
                     
                     // Formatlama: Sayılar artık düzeltilmiş (compareVal) geldiği için direkt basılabilir
                     // Ancak çok büyük sayılar (piyasa değeri) için compact lazım.
                     
                     let valStr, avgStr;
                     
                     if (d.isPercent) {
                         // Zaten 100 ile çarpılmış durumda
                         valStr = `%${Number(d.val).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
                         avgStr = `%${Number(d.avg).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
                     } else {
                         // Normal sayı (Milyon/Milyar formatla)
                         valStr = finFormatMoneyCompact(d.val, { decimals: 1 });
                         avgStr = finFormatMoneyCompact(d.avg, { decimals: 1 });
                     }
                     
                     return `<div class="${className}"><div class="res-label">${d.shortLabel}</div><div class="res-val">${valStr}</div><div class="res-avg">${avgStr}</div></div>`;
                 }).join('');
                 detailsHtml = `<div style="display:flex; gap:4px; justify-content:flex-end; flex-wrap:wrap;">${boxes}</div>`;
            }

            const badgeClass = comp.score > 0 ? "score-badge active" : "score-badge inactive";
            const logo = comp.logourl || ""; 

            html += `<tr>
                <td style="text-align:center; color:rgba(255,255,255,0.3); font-size:10px;">${realIdx}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${logo}" style="width:24px; height:24px; object-fit:contain; background:#fff; border-radius:4px; padding:2px;" onerror="this.style.display='none'">
                        <div>
                            <div style="font-weight:700; color:#eee; font-size:13px;">${comp.ticker}</div>
                            <div style="margin-top:4px;">
                                <button class="fp-menu-btn" onclick="event.stopPropagation(); fpOpenRowMenu('${comp.ticker}', event)"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                            </div>
                            <div style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; margin-top:2px;">${comp.name}</div>
                        </div>
                    </div>
                </td>
                <td><span style="font-size:9px; font-weight:700; background:rgba(255,255,255,0.06); padding:4px 8px; border-radius:4px; color:rgba(255,255,255,0.6); text-transform:uppercase;">${comp.sector}</span></td>
                <td style="text-align:center;"><div class="${badgeClass}">${comp.score}</div></td>
                <td style="text-align:right;">${detailsHtml}</td>
            </tr>`;
        });
        
        await new Promise(r => setTimeout(r, 0));
    }

    if (rankedData.length > displayLimit) {
        html += `<tr><td colspan="5" style="text-align:center; padding:10px; font-size:10px; color:#555;">...ve ${rankedData.length - displayLimit} şirket daha</td></tr>`;
    }

    tbody.innerHTML = html;
    tbody.style.opacity = "1";
    isScreenerComputing = false;
}

// ... (UI Event Functions) ...
// (Buradan sonrası aynı)
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

    let html = `
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

        <div style="position:relative; display:inline-block;">
            <div class="sc-badge ${hasSector ? 'active' : ''}" onclick="scToggleSectorPopup(event)" title="Sektör Filtrele">
                <i class="fa-solid fa-layer-group"></i>
                SEKTÖR: <span style="color:#fff;">${currentSec}</span>
                ${hasSector ? `<div class="sc-badge-close" onclick="event.stopPropagation(); scClearSectorFilter(event)"><i class="fa-solid fa-xmark"></i></div>` : '<i class="fa-solid fa-chevron-down" style="font-size:9px; opacity:0.5; margin-left:4px;"></i>'}
            </div>
            <div id="scSectorPopup" class="sc-sector-popup" onclick="event.stopPropagation()">
                <div class="sc-sector-head"><div class="sc-sector-title">Sektör Seçimi</div><div class="sc-sector-actions"><button class="sc-sector-clear" onclick="scClearSectorFilter(event)">Temizle</button></div></div>
                <div style="padding:8px; border-bottom:1px solid rgba(255,255,255,0.1);"><input type="text" id="scSectorSearchInput" placeholder="Sektör ara..." style="width:100%; background:#1a1a1a; border:1px solid #333; color:#fff; padding:8px 10px; border-radius:8px; font-size:12px; outline:none; font-weight:600;" oninput="scFilterListInPopup('sector', this.value)"></div>
                <div class="sc-sector-list" id="scSectorList"></div>
            </div>
        </div>

        <div style="position:relative; display:inline-block;">
            <div class="sc-badge ${hasIndustry ? 'active' : ''}" style="${!hasSector ? 'opacity:0.4; pointer-events:none;' : ''}" onclick="scToggleIndustryPopup(event)" title="Alt Sektör Filtrele">
                <i class="fa-solid fa-industry"></i>
                ALT SEKTÖR: <span style="color:#fff;">${currentInd}</span>
                ${hasIndustry ? `<div class="sc-badge-close" onclick="event.stopPropagation(); scClearIndustryFilter(event)"><i class="fa-solid fa-xmark"></i></div>` : '<i class="fa-solid fa-chevron-down" style="font-size:9px; opacity:0.5; margin-left:4px;"></i>'}
            </div>
            <div id="scIndustryPopup" class="sc-sector-popup" onclick="event.stopPropagation()">
                <div class="sc-sector-head"><div class="sc-sector-title">Alt Sektör Seçimi</div><div class="sc-sector-actions"><button class="sc-sector-clear" onclick="scClearIndustryFilter(event)">Temizle</button></div></div>
                <div style="padding:8px; border-bottom:1px solid rgba(255,255,255,0.1);"><input type="text" id="scIndustrySearchInput" placeholder="Alt sektör ara..." style="width:100%; background:#1a1a1a; border:1px solid #333; color:#fff; padding:8px 10px; border-radius:8px; font-size:12px; outline:none; font-weight:600;" oninput="scFilterListInPopup('industry', this.value)"></div>
                <div class="sc-sector-list" id="scIndustryList"></div>
            </div>
        </div>

        <div class="sc-badge" onclick="scToggleCompMode()" title="Kıyaslama: Sektör mü Genel mi?"><i class="fa-solid fa-scale-balanced"></i> KIYAS: <span style="color:#fff;">${compLabel}</span> <i class="fa-solid fa-rotate" style="font-size:9px; opacity:0.5; margin-left:4px;"></i></div>
        <div class="sc-badge" onclick="scToggleCalcMethod()" title="Hesaplama: Ortalama mı Medyan mı?"><i class="fa-solid fa-calculator"></i> HESAP: <span style="color:#fff;">${calcLabel}</span> <i class="fa-solid fa-rotate" style="font-size:9px; opacity:0.5; margin-left:4px;"></i></div>
        <div class="sc-badge reset-btn" onclick="resetApp()" title="Tüm filtreleri temizle"><i class="fa-solid fa-rotate-left"></i> SIFIRLA</div>
    `;
    area.innerHTML = html;
}

function scToggleCompMode() { setComparisonMode(comparisonMode === 'sector' ? 'global' : 'sector'); }
function scToggleCalcMethod() { setCalcMethod(calculationMethod === 'median' ? 'mean' : 'median'); }
function scToggleMarketPopup(e) { if(e) e.stopPropagation(); const p=document.getElementById("scMarketPopup"); if(p){ scCloseAllPopups(); p.style.display=p.style.display==="block"?"none":"block"; } }
function setComparisonMode(mode) { comparisonMode=mode; const l=document.getElementById('comp-label'); if(l)l.innerText=mode==='sector'?'SEKTÖR':'GENEL'; scUpdateFilterBadges(); renderScreenerResults(); }
function setCalcMethod(method) { calculationMethod=method; const l=document.getElementById('calc-label'); if(l)l.innerText=method==='mean'?'ORT':'MEDYAN'; scUpdateFilterBadges(); renderScreenerResults(); }
function renderMetricsPool() {
    const pool = document.getElementById('metrics-pool'); const term = document.getElementById('metric-search').value.toLowerCase();
    const frag = document.createDocumentFragment();
    METRIC_DEFINITIONS.forEach(m => {
        if (activeMetrics.find(am => am.id === m.id) || (term && !m.label.toLowerCase().includes(term))) return;
        const el = document.createElement('div'); el.className = 'metric-item'; el.draggable = true;
        const iconColor = m.direction === 'high' ? 'var(--finapsis-neon)' : 'var(--finapsis-red)';
        el.innerHTML = `<div class="metric-icon" style="color:${iconColor}"><i class="fa-solid ${m.icon}"></i></div><div style="font-size:10px; font-weight:600; color:rgba(255,255,255,0.7);">${m.label}</div>`;
        el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', m.id); el.style.opacity = '0.5'; });
        el.addEventListener('dragend', () => el.style.opacity = '1');
        frag.appendChild(el);
    });
    pool.innerHTML = ''; pool.appendChild(frag);
}
window.scSectorSelection = ""; window.scIndustrySelection = ""; 
window.scBuildList = function(type){
    const listEl = document.getElementById(type === 'sector' ? "scSectorList" : "scIndustryList"); if(!listEl) return;
    let items = [];
    if (type === 'sector') { items = [...new Set((window.companies || []).filter(c => c.group === window.activeGroup).map(c => c.sector))].filter(Boolean).sort((a,b) => a.localeCompare(b,'tr')); } 
    else { if(!window.scSectorSelection) return; items = [...new Set((window.companies || []).filter(c => c.group === window.activeGroup && c.sector === window.scSectorSelection).map(c => c.industry))].filter(Boolean).sort((a,b) => a.localeCompare(b,'tr')); }
    const currentVal = type === 'sector' ? window.scSectorSelection : window.scIndustrySelection;
    const selectFn = type === 'sector' ? 'scSelectSector' : 'scSelectIndustry';
    const label = type === 'sector' ? 'Tüm Sektörler' : 'Tüm Alt Sektörler';
    let html = `<div class="sc-sector-item ${currentVal==="" ? "active":""}" onclick="${selectFn}('')">${label}</div>`;
    html += items.map(s => { const isActive = (s === currentVal) ? "active" : ""; const safeS = s.replace(/"/g, '&quot;'); return `<div class="sc-sector-item ${isActive}" onclick="${selectFn}('${safeS}')">${s}</div>`; }).join("");
    listEl.innerHTML = html;
};
window.scToggleSectorPopup = function(e) { if(e) e.stopPropagation(); scCloseAllPopups(); const pop=document.getElementById("scSectorPopup"); if(pop && pop.style.display!=="block") { scBuildList('sector'); const inp=document.getElementById("scSectorSearchInput"); if(inp){inp.value="";scFilterListInPopup('sector',"");} pop.style.display="block"; } else if(pop) pop.style.display="none"; };
window.scToggleIndustryPopup = function(e) { if(e) e.stopPropagation(); if(!window.scSectorSelection)return; scCloseAllPopups(); const pop=document.getElementById("scIndustryPopup"); if(pop && pop.style.display!=="block") { scBuildList('industry'); const inp=document.getElementById("scIndustrySearchInput"); if(inp){inp.value="";scFilterListInPopup('industry',"");} pop.style.display="block"; } else if(pop) pop.style.display="none"; };
window.scSelectSector = function(sec){ window.scSectorSelection=sec; window.scIndustrySelection=""; renderScreenerResults(); scUpdateFilterBadges(); };
window.scSelectIndustry = function(ind){ window.scIndustrySelection=ind; renderScreenerResults(); scUpdateFilterBadges(); };
window.scClearSectorFilter = function(e){ if(e){e.preventDefault();e.stopPropagation();} scSelectSector(""); };
window.scClearIndustryFilter = function(e){ if(e){e.preventDefault();e.stopPropagation();} scSelectIndustry(""); };
window.scFilterListInPopup = function(type, term){ const t=String(term||"").toLocaleLowerCase('tr'); const listId=type==='sector'?"scSectorList":"scIndustryList"; document.querySelectorAll(`#${listId} .sc-sector-item`).forEach(el=>{ const txt=el.textContent.toLocaleLowerCase('tr'); if(el.textContent.includes("Tüm")||txt.includes(t)) el.style.display="block"; else el.style.display="none"; }); };
function scCloseAllPopups() { document.querySelectorAll('.sc-sector-popup, .sc-market-popup').forEach(el => el.style.display = 'none'); }
document.addEventListener("click", (e) => { if (!e.target.closest('.sc-badge') && !e.target.closest('.sc-sector-popup') && !e.target.closest('.sc-market-popup')) scCloseAllPopups(); });
function filterMetrics() { renderMetricsPool(); }
function setupDragAndDrop() {
    const container = document.querySelector('.drop-zone-container'); if(!container) return;
    container.ondragover = e => { e.preventDefault(); document.getElementById('active-criteria').classList.add('drag-over'); };
    container.ondragleave = () => document.getElementById('active-criteria').classList.remove('drag-over');
    container.ondrop = e => { e.preventDefault(); document.getElementById('active-criteria').classList.remove('drag-over'); const rawData = e.dataTransfer.getData('text/plain'); if (!rawData.startsWith('{')) addMetric(rawData); };
    updateDropZoneUI();
}
function addMetric(id) { if (!activeMetrics.find(m => m.id === id)) { const def = METRIC_DEFINITIONS.find(m => m.id === id); if(def) activeMetrics.push(def); updateDropZoneUI(); } }
function removeMetric(id) { activeMetrics = activeMetrics.filter(m => m.id !== id); updateDropZoneUI(); }
function updateDropZoneUI() {
    const zone = document.getElementById('active-criteria'); zone.innerHTML = '';
    if (activeMetrics.length === 0) { zone.innerHTML = '<span style="width:100%; text-align:center; font-size:11px; color:rgba(255,255,255,0.2); font-style:italic; pointer-events:none; margin-top:10px;">METRİKLERİ BURAYA SÜRÜKLEYİN</span>'; } 
    else {
        activeMetrics.forEach((m, index) => {
            const el = document.createElement('div'); el.className = 'active-metric-tag'; el.draggable = true; el.dataset.index = index;
            el.innerHTML = `<i class="fa-solid fa-grip-lines" style="opacity:0.3; cursor:grab; margin-right:4px;"></i><i class="fa-solid ${m.icon}" style="font-size:10px;"></i><span>${m.label}</span><i class="fa-solid fa-times remove-btn" onclick="removeMetric('${m.id}')"></i>`;
            el.addEventListener('dragstart', (e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'reorder', fromIndex: index })); el.style.opacity = '0.4'; });
            el.addEventListener('dragend', () => el.style.opacity = '1');
            el.addEventListener('dragover', (e) => { e.preventDefault(); el.style.borderColor = '#c2f50e'; });
            el.addEventListener('dragleave', () => el.style.borderColor = 'rgba(194, 245, 14, 0.2)');
            el.addEventListener('drop', (e) => { e.preventDefault(); el.style.borderColor = 'rgba(194, 245, 14, 0.2)'; try { const data = JSON.parse(e.dataTransfer.getData('text/plain')); if (data && data.type === 'reorder') { const fromIdx = data.fromIndex; const toIdx = index; if (fromIdx !== toIdx) { const item = activeMetrics.splice(fromIdx, 1)[0]; activeMetrics.splice(toIdx, 0, item); updateDropZoneUI(); renderScreenerResults(); } } } catch (err) {} });
            zone.appendChild(el);
        });
    }
    renderMetricsPool(); renderScreenerResults();
}
function resetApp() { activeMetrics = []; comparisonMode = 'sector'; calculationMethod = 'median'; window.scSectorSelection = ""; window.scIndustrySelection = ""; updateDropZoneUI(); scUpdateFilterBadges(); }
