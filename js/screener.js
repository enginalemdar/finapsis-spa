// js/screener.js (ULTRA FAST - NO CALCULATION)

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

        // Veri indirmeyi tetikle
        if(typeof finBuildMapForActiveGroup === 'function') {
            finBuildMapForActiveGroup(() => {
                _renderScreenerUI(); 
            });
        }
    }
}

function _renderScreenerUI() {
    processScreenerData();
    renderMetricsPool();
    renderScreenerResults();
    setupDragAndDrop();
    scUpdateFilterBadges();
}

// ------------------------------------------------
// PERFORMANS OPTİMİZASYONU: Veri Hazırlığı
// ------------------------------------------------
function processScreenerData() {
    // Sadece aktif grubu filtrele
    // Map'ten verileri KOPYALAMAK yok. Sadece pointer tutacağız.
    processedData = (window.companies || []).filter(c => c.group === window.activeGroup);
}

// ------------------------------------------------
// ASIL OPTİMİZASYON: Lookup from JSON
// ------------------------------------------------
function getStatValue(sector, metricKey, method) {
    // 🚀 GLOBAL JSON'DAN OKU (HESAPLAMA YOK!)
    const stats = window.__SCREENER_STATS_CACHE || {};
    const groupData = stats[window.activeGroup] || {}; // "bist", "nyse" vb.

    let statObj = null;

    if (comparisonMode === 'global') {
        // Genel istatistik
        statObj = groupData.global ? groupData.global[metricKey] : null;
    } else {
        // Sektör bazlı istatistik
        const sec = sector || "Diğer";
        if (groupData.sectors && groupData.sectors[sec]) {
            statObj = groupData.sectors[sec][metricKey];
        }
    }

    if (!statObj) return null;
    
    // Method: 'median' veya 'mean'
    return statObj[method];
}

// ------------------------------------------------
// ASYNC RENDER & CHUNKING
// ------------------------------------------------
let __renderTimeout;

// js/screener.js

// ... (önceki kodlar) ...

function renderScreenerResults() {
    // 1. Veri Hazır mı Kontrolü
    // global.js'de tanımladığımız bayrağı kontrol ediyoruz.
    // Eğer false ise, global.js zaten "Yükleniyor" ekranını gösteriyor, biz çıkalım.
    if (window.isFinDataReady === false) {
        console.log("Veri henüz hazır değil, bekleniyor...");
        return; 
    }

    if (__renderTimeout) clearTimeout(__renderTimeout);

    const tbody = document.getElementById('screener-results-body');
    if (!tbody) return;

    if (!isScreenerComputing) tbody.style.opacity = "0.5";

    __renderTimeout = setTimeout(() => {
        _renderScreenerResultsAsync(tbody);
    }, 100); 
}

// ... (kalan kodlar aynı) ...

async function _renderScreenerResultsAsync(tbody) {
    isScreenerComputing = true;

    if (!activeMetrics || activeMetrics.length === 0) {
        tbody.innerHTML = `
            <tr>
              <td colspan="5" style="padding:40px; color:rgba(255,255,255,0.4); font-weight:600; text-align:center;">
                <i class="fa-solid fa-filter" style="font-size:24px; margin-bottom:10px; display:block;"></i>
                Sonuçları görmek için soldan metrik sürükleyip ekleyin.
              </td>
            </tr>`;
        tbody.style.opacity = "1";
        isScreenerComputing = false;
        return;
    }

    const map = window.__FIN_MAP || {};
    const sectorFilter = window.scSectorSelection;
    const industryFilter = window.scIndustrySelection;
    
    // Chunking: Hesaplamayı parçalara böl
    const chunkSize = 200; 
    let rankedData = [];
    
    // 1. ADIM: HESAPLAMA (Chunked Loop)
    for (let i = 0; i < processedData.length; i += chunkSize) {
        const chunk = processedData.slice(i, i + chunkSize);
        
        const chunkResults = chunk.map(comp => {
            // FİLTRELEME
            if (sectorFilter && comp.sector !== sectorFilter) return null;
            if (industryFilter && comp.industry !== industryFilter) return null;

            let score = 0;
            let matchDetails = [];
            const d = map[comp.ticker] || {}; 

            for (const metric of activeMetrics) {
                let val = d[metric.dataKey];
                
                // Yüzde düzeltmesi
                if (metric.isPercent && val !== undefined && val !== null && Math.abs(val) < 5) {
                    val = val * 100;
                }

                // 🚀 BROWSERDA HESAP YOK, JSON'DAN OKU
                const avg = getStatValue(comp.sector, metric.dataKey, calculationMethod);

                if (val !== undefined && val !== null && avg !== undefined && avg !== null) {
                    let isGood = false;
                    
                    if (metric.direction === 'low') {
                        // Düşük iyiyse (F/K): Pozitif olmalı ve ortalamadan küçük olmalı
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
            }
            
            return { 
                ticker: comp.ticker, 
                name: comp.name, 
                sector: comp.sector, 
                logourl: comp.logourl,
                score, 
                matchDetails 
            };
        }).filter(Boolean);

        rankedData = rankedData.concat(chunkResults);

        // UI'a nefes aldır (her chunk sonrası)
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    // 2. ADIM: SIRALAMA
    rankedData.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;

        // Eşitlik durumunda ilk metriğe göre sırala
        for (const metric of activeMetrics) {
            const detA = a.matchDetails.find(x => x.id === metric.id);
            const detB = b.matchDetails.find(x => x.id === metric.id);

            const valA = detA ? detA.val : null;
            const valB = detB ? detB.val : null;

            const aValid = (valA !== null);
            const bValid = (valB !== null);
            
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

    // 3. ADIM: HTML OLUŞTURMA (Sadece ilk 50)
    const displayLimit = 50; 
    const dataToRender = rankedData.slice(0, displayLimit);

    const htmlRows = dataToRender.map((comp, index) => {
        const sortedDetails = [];
        for(const m of activeMetrics) {
            const d = comp.matchDetails.find(x => x.id === m.id);
            if(d) sortedDetails.push(d);
        }

        let detailsHtml = '';
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
    
    tbody.style.opacity = "1";
    isScreenerComputing = false;
}

// ------------------------------------------------
// UI EVENTS
// ------------------------------------------------

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
    
    // Aktif gruptaki şirketlerden listeyi oluştur
    if (type === 'sector') {
        items = [...new Set((window.companies || [])
            .filter(c => c.group === window.activeGroup)
            .map(c => c.sector))]
            .filter(Boolean)
            .sort((a,b) => a.localeCompare(b,'tr'));
    } else {
        if(!window.scSectorSelection) return;
        items = [...new Set((window.companies || [])
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

function setupDragAndDrop() {
    const container = document.querySelector('.drop-zone-container');
    if(!container) return;
    
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