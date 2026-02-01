            el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', m.id); el.style.opacity = '0.5'; });
            el.addEventListener('dragend', () => el.style.opacity = '1');
            fragment.appendChild(el);
        });
        pool.innerHTML = '';
        pool.appendChild(fragment);
    }
    // --- SCREENER POPUP LOGIC ---
    // =========================================================
    // ✅ SCREENER SEKTÖR & ALT SEKTÖR YÖNETİMİ
    // =========================================================

    window.scSectorSelection = "";
    window.scIndustrySelection = ""; // Yeni State

    // 1. Liste Oluşturucu (Generic: type = 'sector' veya 'industry')
    window.scBuildList = function(type){
        const listEl = document.getElementById(type === 'sector' ? "scSectorList" : "scIndustryList");
        if(!listEl) return;

        let items = [];
        
        if (type === 'sector') {
            // Tüm sektörler
            items = [...new Set(window.companies
                .filter(c => c.group === activeGroup)
                .map(c => c.sector))]
                .filter(Boolean)
                .sort((a,b) => a.localeCompare(b,'tr'));
        } else {
            // Sadece seçili sektörün alt sektörleri
            if(!window.scSectorSelection) return;
            items = [...new Set(window.companies
                .filter(c => c.group === activeGroup && c.sector === window.scSectorSelection)
                .map(c => c.industry))]
                .filter(Boolean)
                .sort((a,b) => a.localeCompare(b,'tr'));
        }

        // HTML oluştur
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

    // 2. Sektör Popup Aç/Kapa
    window.scToggleSectorPopup = function(e) {
        if(e) e.stopPropagation();
        scCloseAllPopups(); // Önce diğerlerini kapat

        const pop = document.getElementById("scSectorPopup");
        const isOpen = (pop.style.display === 'block');
        
        if (!isOpen) {
            scBuildList('sector');
            const inp = document.getElementById("scSectorSearchInput");
            if(inp) { inp.value = ""; scFilterListInPopup('sector', ""); }
            pop.style.display = 'block';
        }
    };

    // 3. Alt Sektör Popup Aç/Kapa
    window.scToggleIndustryPopup = function(e) {
        if(e) e.stopPropagation();
        // Eğer sektör seçili değilse açma (Gerçi HTML'de disabled yaptık ama güvenlik olsun)
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

    // 4. Sektör Seçimi
    window.scSelectSector = function(sec){
        window.scSectorSelection = sec;
        window.scIndustrySelection = ""; // Sektör değişirse alt sektör sıfırlanır!
        
        renderScreenerResults();
        scUpdateFilterBadges();
    };

    // 5. Alt Sektör Seçimi
    window.scSelectIndustry = function(ind){
        window.scIndustrySelection = ind;
        
        renderScreenerResults();
        scUpdateFilterBadges();
    };

    // 6. Temizleyiciler
    window.scClearSectorFilter = function(e){
        if(e) { e.preventDefault(); e.stopPropagation(); }
        scSelectSector(""); // Bu işlem alt sektörü de temizler
    };

    window.scClearIndustryFilter = function(e){
        if(e) { e.preventDefault(); e.stopPropagation(); }
        scSelectIndustry("");
    };

    // 7. Popup İçi Arama
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

    // Helper: Tüm popupları kapat
    function scCloseAllPopups() {
        document.querySelectorAll('.sc-sector-popup, .sc-market-popup').forEach(el => el.style.display = 'none');
    }

    // Dışarı tıklama (Popup kapat)
    document.addEventListener("click", (e) => {
        if (!e.target.closest('.sc-badge') && !e.target.closest('.sc-sector-popup') && !e.target.closest('.sc-market-popup')) {
            scCloseAllPopups();
        }
    });

    window.scToggleSectorPopup = function(e){
      // Varsa Market popup'ını kapat
   const mPop = document.getElementById("scMarketPopup");
   if(mPop) mPop.style.display = "none";
        if(e) e.stopPropagation();
        const pop = document.getElementById("scSectorPopup");
        if(!pop) return;

        // Listeyi oluştur
        scBuildSectorList();
        
        // Input temizle
        const inp = document.getElementById("scSectorSearchInput");
        if(inp) { inp.value = ""; scFilterSectorListInPopup(""); }

        const isOpen = (pop.style.display === "block");
        pop.style.display = isOpen ? "none" : "block";
    };

    window.scCloseSectorPopup = function(e){
        if(e) e.stopPropagation();
        const pop = document.getElementById("scSectorPopup");
        if(pop) pop.style.display = "none";
    };

    window.scBuildSectorList = function(){
        const list = document.getElementById("scSectorList");
        if(!list) return;

        // Aktif gruptaki sektörleri al
        const sectors = [...new Set(window.companies
            .filter(c => c.group === activeGroup)
            .map(c => c.sector))]
            .filter(Boolean)
            .sort((a,b) => a.localeCompare(b,'tr'));

        let html = `<div class="sc-sector-item ${window.scSectorSelection==="" ? "active":""}" onclick="scSelectSector('')">Tüm Sektörler</div>`;
        html += sectors.map(s => {
            const isActive = (s === window.scSectorSelection) ? "active" : "";
            const safeS = s.replace(/"/g, '&quot;');
            return `<div class="sc-sector-item ${isActive}" onclick="scSelectSector('${safeS}')">${s}</div>`;
        }).join("");

        list.innerHTML = html;
        // Not: Buton rengini artık scUpdateFilterBadges fonksiyonu hallediyor.
    };

    window.scSelectSector = function(sec){
        window.scSectorSelection = sec;
        renderScreenerResults(); // Tabloyu yeniden çiz (Filtreli)
        scCloseSectorPopup();
        scBuildSectorList(); 
        scUpdateFilterBadges(); // ✅ Badge'leri güncelle
    };
    

  
    window.scFilterSectorListInPopup = function(term){
        const t = String(term || "").toLocaleLowerCase('tr');
        const items = document.querySelectorAll("#scSectorList .sc-sector-item");
        items.forEach(el => {
            const txt = el.textContent.toLocaleLowerCase('tr');
            if(el.textContent === "Tüm Sektörler" || txt.includes(t)) el.style.display = "block";
            else el.style.display = "none";
        });
    };
    
    // Dışarı tıklayınca kapat
    document.addEventListener("click", (e) => {
        const pop = document.getElementById("scSectorPopup");
        const btn = document.getElementById("scSectorBtn");
        if(pop && pop.style.display === "block") {
            if(!pop.contains(e.target) && !btn.contains(e.target)) {
                pop.style.display = "none";
            }
        }
    });
    function filterMetrics() { renderMetricsPool(); }

    function renderScreenerResults() {
        const tbody = document.getElementById('screener-results-body');
        if (!tbody) return;

        // 1. Metrik Kontrolü
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

        // 2. İstatistikleri Hesapla
        ensureScreenerStats();

        // 3. Puanlama ve Veri Hazırlığı
        const rankedData = processedData.map(comp => {
            let score = 0;
            let matchDetails = [];
            
            // Sektör filtresi varsa sadece o sektörü işle (Performans)
            if (window.scSectorSelection && comp.sector !== window.scSectorSelection) {
                return null; // Filtreye takılanı hesaplama
            }
            // Alt Sektör filtresi varsa (Industry)
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
                    
                    // --- KRİTİK DÜZELTME 1: NEGATİF DEĞER KONTROLÜ ---
                    // Düşük F/K, PD/DD gibi oranlarda negatif değer "iyi" değildir, zarardır.
                    // Bu yüzden "Low" ararken değerin 0'dan büyük olmasını şart koşuyoruz.
                    if (metric.direction === 'low') {
                        if (val > 0 && val < avg) isGood = true; 
                    } 
                    // Yüksek ararken (High) normal mantık (val > avg)
                    else if (metric.direction === 'high') {
                        if (val > avg) isGood = true;
                    }

                    if (isGood) score++;
                    matchDetails.push({ 
                        id: metric.id, // Sıralama için ID lazım
                        shortLabel: metric.dataKey, 
                        val, 
                        avg, 
                        good: isGood, 
                        isPercent: metric.isPercent 
                    });
                }
            });
            return { ...comp, score, matchDetails };
        }).filter(Boolean); // Null dönenleri (sektör dışı) temizle

        // --- KRİTİK DÜZELTME 2: AKILLI SIRALAMA (Smart Sort) ---
        // Kural 1: Skoru yüksek olan en üste.
        // Kural 2: Skorlar eşitse, kullanıcının seçtiği İLK metriğe göre en iyi olan üste.
        // Kural 3: O da eşitse ikinci metriğe bak...
        
        rankedData.sort((a, b) => {
            // 1. Önce Skora Bak (Büyükten küçüğe)
            if (b.score !== a.score) return b.score - a.score;

            // 2. Skorlar eşitse, Seçili Metrik Sırasına Göre Karşılaştır
            for (const metric of activeMetrics) {
                const valA = a[metric.dataKey];
                const valB = b[metric.dataKey];

                // Verisi olmayan alta düşsün
                const aValid = (valA !== null && valA !== undefined);
                const bValid = (valB !== null && valB !== undefined);
                if (!aValid && bValid) return 1;
                if (aValid && !bValid) return -1;
                if (!aValid && !bValid) continue;

                // Değerler farklıysa sırala
                if (valA !== valB) {
                    // Eğer "Düşük" iyiyse (F/K gibi): Küçük olan (A) öne geçsin (a - b)
                    // Eğer "Yüksek" iyiyse (ROE gibi): Büyük olan (A) öne geçsin (b - a)
                    
                    // Not: Negatifleri yukarıda eledik ama sıralarken de
                    // pozitif küçükler, pozitif büyüklerden iyidir mantığı güdüyoruz.
                    if (metric.direction === 'low') {
                        // Pozitif olan negatiften her zaman iyidir (Sıralamada)
                        if (valA > 0 && valB <= 0) return -1;
                        if (valA <= 0 && valB > 0) return 1;
                        return valA - valB; 
                    } else {
                        return valB - valA;
                    }
                }
            }
            
            // 3. Her şey eşitse isme göre
            return a.ticker.localeCompare(b.ticker);
        });

        // Ekrana Basma (Limitli)
        const displayLimit = 50; 
        const dataToRender = rankedData.slice(0, displayLimit);

        const htmlRows = dataToRender.map((comp, index) => {
            // Detay kutularını, activeMetrics sırasına göre dizelim ki
            // kullanıcı neyi öne koyduysa tabloda da o sıra olsun.
            let detailsHtml = '';
            
            // matchDetails içinde veriyi bulup activeMetrics sırasına göre render ediyoruz
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
            
            // Şirket Logosunu Güvenli Al
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
            // Sadece soldan (yeni) geliyorsa yeşil yak, içeridekine karışma
            // Bunu anlamak zor olduğu için genel olarak class ekleyebiliriz
            document.getElementById('active-criteria').classList.add('drag-over'); 
        };
        
        container.ondragleave = () => document.getElementById('active-criteria').classList.remove('drag-over');
        
        container.ondrop = e => { 
            e.preventDefault(); 
            document.getElementById('active-criteria').classList.remove('drag-over'); 
            
            // Veriyi al
            const rawData = e.dataTransfer.getData('text/plain');
            
            // Eğer JSON ise (içerideki sıralama işlemidir), updateDropZoneUI içindeki listener halleder.
            // Biz sadece "ID" stringi gelirse (soldan yeni ekleme) yakalayalım.
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

    // ✅ METRİK HAVUZU & SIRALAMA YÖNETİCİSİ
    function updateDropZoneUI() {
        const zone = document.getElementById('active-criteria');
        zone.innerHTML = '';
        
        if (activeMetrics.length === 0) {
            zone.innerHTML = '<span style="width:100%; text-align:center; font-size:11px; color:rgba(255,255,255,0.2); font-style:italic; pointer-events:none; margin-top:10px;">METRİKLERİ BURAYA SÜRÜKLEYİN</span>';
        } else {
            activeMetrics.forEach((m, index) => {
                const el = document.createElement('div');
                el.className = 'active-metric-tag';
                el.draggable = true; // Sürüklenebilir yap
                el.dataset.index = index; // Sırasını bil
                
                el.innerHTML = `
                    <i class="fa-solid fa-grip-lines" style="opacity:0.3; cursor:grab; margin-right:4px;"></i>
                    <i class="fa-solid ${m.icon}" style="font-size:10px;"></i>
                    <span>${m.label}</span>
                    <i class="fa-solid fa-times remove-btn" onclick="removeMetric('${m.id}')"></i>
                `;

                // --- KENDİ İÇİNDE SIRALAMA EVENTLERİ ---
                
                // Sürükleme Başladı
                el.addEventListener('dragstart', (e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'reorder', fromIndex: index }));
                    el.style.opacity = '0.4';
                });

                // Sürükleme Bitti
                el.addEventListener('dragend', () => {
                    el.style.opacity = '1';
                });

                // Üzerine Gelindi (Hedef)
                el.addEventListener('dragover', (e) => {
                    e.preventDefault(); // Drop'a izin ver
                    el.style.borderColor = '#c2f50e'; // Görsel ipucu
                });

                // Üzerinden Ayrıldı
                el.addEventListener('dragleave', () => {
                    el.style.borderColor = 'rgba(194, 245, 14, 0.2)'; // Eski haline dön
                });

                // Bırakıldı (Değişimi Yap)
                el.addEventListener('drop', (e) => {
                    e.preventDefault();
                    el.style.borderColor = 'rgba(194, 245, 14, 0.2)';
                    
                    try {
                        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                        
                        // Sadece "reorder" tipindeyse işlem yap (Soldan yeni geleni karıştırma)
                        if (data && data.type === 'reorder') {
                            const fromIdx = data.fromIndex;
                            const toIdx = index;

                            if (fromIdx !== toIdx) {
                                // Dizide yer değiştir
                                const item = activeMetrics.splice(fromIdx, 1)[0];
                                activeMetrics.splice(toIdx, 0, item);
                                
                                // UI ve Tabloyu Yenile
                                updateDropZoneUI();
                                renderScreenerResults();
                            }
                        }
                    } catch (err) {
                        // Eğer JSON parse edilemezse (Soldan yeni metrik geliyordur),
                        // bu olayı drop-zone-container'a bırak (propagation), o halletsin.
                        // Bir şey yapmaya gerek yok.
                    }
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
    window.scIndustrySelection = ""; // ✅ Eklendi
    
    updateDropZoneUI(); 
    scUpdateFilterBadges(); 
}

    // ===== SEKTORLER TAB STATE =====
let secMap = {}; // ticker -> { metric:value }
let secSort = { key: 'Piyasa Değeri', asc: false };
let secInited = false;

function secParseNumber(v){
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  let s = String(v).replace(/[₺$€%]/g, "").replace(/,/g, ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
function secMedian(arr){
  const values = (arr || []).filter(v => v !== null && v !== undefined).sort((a,b)=>a-b);
  if (!values.length) return null;
  const half = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[half - 1] + values[half]) / 2 : values[half];
}
function secSum(arr){
  return (arr || []).reduce((acc, curr) => acc + (secParseNumber(curr) || 0), 0);
}

function secBuildMap(){
  // Artık benchmarks array yok, direkt dolu olan __FIN_MAP'i kullanıyoruz.
  // __FIN_MAP zaten { TICKER: { "Piyasa Değeri": 123, ... } } formatında.
  // Sektör hesaplaması için bunu klonlamaya gerek yok, direkt kullanabiliriz 
  // ama mevcut yapı secMap üzerinden yürüyor, onu referanslayalım.
  secMap = window.__FIN_MAP || {};
}
// ✅ YENİ: Sektöre tıklayınca Şirketler listesine filtreli git
window.secGoToCompanyList = function(sectorName){
  // 1. Şirketler sekmesine geç
  switchTab('companieslist.html');

  // 2. Sekme değişiminden hemen sonra filtreyi uygula
  // (DOM elementlerinin görünür olması için minik bir gecikme iyidir)
  setTimeout(() => {
    if(window.clSelectSector) {
        window.clSelectSector(sectorName);
    }
  }, 50);
};

function secRenderTable(){
  const tbody = document.getElementById("sec-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  // aktif gruba göre şirketler (BIST/SP)
  const companies = (window.companies || []).filter(c => c.group === activeGroup);

  // sector -> tickers
  const sectorGroups = {};
  companies.forEach(c => {
    const s = (c.sector && String(c.sector).trim()) ? c.sector : "Diğer";
    if (!sectorGroups[s]) sectorGroups[s] = [];
    sectorGroups[s].push(String(c.ticker).toUpperCase());
  });

  const medianKeys = ["Cari Oran","Asit Test Oranı","Brüt Kar Marjı","Faaliyet Kâr Marjı","Borç/Öz Kaynak",
    "Stok Devir Hızı","Alacak Devir Hızı","Borç Devir Hızı","Nakit Döngüsü","Stok Süresi","Alacak Süresi","Borç Süresi",
    "ROIC","ROA","ROE"
  ];

  let sectorStats = Object.keys(sectorGroups).map(name => {
    const tickers = sectorGroups[name];
    const st = { name, count: tickers.length };
    st.iconClass = sectorIcons[name] || "fa-solid fa-briefcase";

    st["Piyasa Değeri"] = secSum(tickers.map(t => secMap[t]?.["Piyasa Değeri"] ?? 0));
    st["Firma Değeri"]  = secSum(tickers.map(t => secMap[t]?.["Firma Değeri"] ?? 0));

    medianKeys.forEach(k => {
      const vals = tickers.map(t => (secMap[t] ? secMap[t][k] : null));
      st[k] = secMedian(vals);
    });

    return st;
  });

  // sort
  sectorStats.sort((a,b) => {
    let va = a[secSort.key];
    let vb = b[secSort.key];
    if (secSort.key === "name") { va = a.name; vb = b.name; }
    if (va === null) return 1;
    if (vb === null) return -1;
    const res = (typeof va === "string") ? va.localeCompare(vb, "tr") : (va - vb);
    return secSort.asc ? res : -res;
  });

  // format helpers (gün / % / normal)
  const num = (v) => (v === null || v === undefined) ? `<span class="muted">-</span>` : Number(v).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  const pct = (v) => (v === null || v === undefined) ? `<span class="muted">-</span>` : (Number(v) * 100).toFixed(1) + "%";
  const cls = (v) => (v > 0 ? "pos" : (v < 0 ? "neg" : ""));
  const money = (v) => (v === null || v === undefined) ? `<span class="muted">-</span>` : finFormatMoneyCompact(v, { decimals: 1 });

  // render rows
  // render rows
  sectorStats.forEach(s => {
    // Link oluşturma kodlarını sildik çünkü artık sayfa değiştirmeyeceğiz.

    const tr = document.createElement("tr");
    // Tırnak işaretleri sorun çıkarmasın diye escape yapıyoruz
    const safeName = s.name.replace(/'/g, "\\'"); 

    tr.innerHTML = `
      <td>
        <div class="sector-link" onclick="secGoToCompanyList('${safeName}')">
          <div class="indicator-icon"><i class="${s.iconClass}"></i></div>
          <div style="display:flex;flex-direction:column;">
            <span class="sector-name" style="line-height:1.2;">${s.name}</span>
            <span class="comp-count" style="margin-top:2px;">${s.count} Şirket</span>
          </div>
        </div>
      </td>

      <td data-label="Toplam Piyasa Değeri">${money(s["Piyasa Değeri"])}</td>
      <td data-label="Toplam Firma Değeri">${money(s["Firma Değeri"])}</td>

      <td data-label="Medyan Brüt Kar Marjı" class="${cls(s["Brüt Kar Marjı"])}">${pct(s["Brüt Kar Marjı"])}</td>
      <td data-label="Medyan Faaliyet Marjı" class="${cls(s["Faaliyet Kâr Marjı"])}">${pct(s["Faaliyet Kâr Marjı"])}</td>

      <td data-label="Medyan Cari Oran">${num(s["Cari Oran"])}</td>
      <td data-label="Medyan Asit Test Oranı">${num(s["Asit Test Oranı"])}</td>
      <td data-label="Medyan Borç/Özkaynak">${num(s["Borç/Öz Kaynak"])}</td>

      <td data-label="Medyan Nakit Döngüsü">${num(s["Nakit Döngüsü"])} Gün</td>
      <td data-label="Medyan Stok Devir Hızı">${num(s["Stok Devir Hızı"])}</td>
      <td data-label="Medyan Stok Süresi">${num(s["Stok Süresi"])} Gün</td>

      <td data-label="Medyan Alacak Devir Hızı">${num(s["Alacak Devir Hızı"])}</td>
      <td data-label="Medyan Alacak Süresi">${num(s["Alacak Süresi"])} Gün</td>

      <td data-label="Medyan Borç Devir Hızı">${num(s["Borç Devir Hızı"])}</td>
      <td data-label="Medyan Borç Süresi">${num(s["Borç Süresi"])} Gün</td>

      <td data-label="Medyan ROIC" class="${cls(s["ROIC"])}">${pct(s["ROIC"])}</td>
      <td data-label="Medyan ROA" class="${cls(s["ROA"])}">${pct(s["ROA"])}</td>
      <td data-label="Medyan ROE" class="${cls(s["ROE"])}">${pct(s["ROE"])}</td>
    `;
    tbody.appendChild(tr);
  });

  // sort header highlight
  document.querySelectorAll("#sec-thead th").forEach(th => {
    th.classList.remove("active-sort");
    if (th.dataset.key === secSort.key){
      th.classList.add("active-sort");
      th.setAttribute("data-icon", secSort.asc ? " ↑" : " ↓");
    }
  });
}

// ✅ SEKTÖRLER BADGE YÖNETİMİ
    window.secUpdateBadges = function() {
        const area = document.getElementById("secBadgeArea");
        if(!area) return;

        let groupLabel = "BIST";
        if(activeGroup === 'nyse') groupLabel = "NYSE";
        if(activeGroup === 'nasdaq') groupLabel = "NASDAQ";

        // Market Popup HTML'i
        const marketPopupHTML = `
            <div id="secMarketPopup" class="sc-market-popup" onclick="event.stopPropagation()">
                <div class="sc-market-item ${activeGroup==='bist'?'active':''}" onclick="setGroup('bist')">BIST (İstanbul)</div>
                <div class="sc-market-item ${activeGroup==='nyse'?'active':''}" onclick="setGroup('nyse')">NYSE (New York)</div>
                <div class="sc-market-item ${activeGroup==='nasdaq'?'active':''}" onclick="setGroup('nasdaq')">NASDAQ</div>
            </div>
        `;

        area.innerHTML = `
            <div style="position:relative; display:inline-block;">
                <div class="sc-badge market-badge" onclick="secToggleMarketPopup(event)" title="Borsa Değiştir">
                    <i class="fa-solid fa-globe"></i>
                    BORSA: ${groupLabel} <i class="fa-solid fa-chevron-down" style="font-size:9px; opacity:0.5; margin-left:4px;"></i>
                </div>
                ${marketPopupHTML}
            </div>
        `;
    };

    window.secToggleMarketPopup = function(e) {
        if(e) e.stopPropagation();
        const pop = document.getElementById("secMarketPopup");
        if(pop) {
            const isVisible = pop.style.display === "block";
            // Diğer popupları kapatma mantığı eklenebilir
            pop.style.display = isVisible ? "none" : "block";
        }
    };

    // Dışarı tıklayınca kapat
    document.addEventListener('click', (e) => {
        const pop = document.getElementById("secMarketPopup");
        if(pop && pop.style.display === "block" && !e.target.closest('.market-badge')) {
            pop.style.display = "none";
        }
    });

// ✅ YENİ: Sektör tablosunu isme göre filtrele
// ✅ DÜZELTİLMİŞ SEKTÖR FİLTRELEME (Tree View Korumalı)
window.secFilterTable = function(term){
  const t = String(term || "").toLocaleLowerCase('tr').trim();
  const allRows = document.querySelectorAll("#sec-tbody tr");

  // 1. DURUM: Arama Kutusunu Temizlediyse -> AĞACI KAPAT (Sadece Ana Sektörler)
  if (t.length < 1) {
      allRows.forEach(row => {
          if (row.classList.contains("sec-row-level-1")) {
              row.style.display = ""; // Ana sektörler görünsün
              // Caret'i kapat
              const caret = row.querySelector(".sec-caret");
              if(caret && caret.parentElement) {
                  caret.parentElement.parentElement.classList.remove("sec-expanded");
              }
          } else {
              row.style.display = "none"; // Alt sektör ve şirketler gizlensin
          }
      });
      
      // Master caret'i de sıfırla
      const master = document.getElementById("secMasterCaret");
      if(master) master.classList.remove("sec-expanded");
      
      return; 
  }

  // 2. DURUM: Arama Yapılıyorsa -> Eşleşenleri ve Ebeveynlerini Aç
  // Önce hepsini gizle
  allRows.forEach(r => r.style.display = "none");

  // Eşleşenleri bul
  const matchedRows = [];
  allRows.forEach(row => {
      // Sektör/Şirket ismi (cell-inner içindeki span)
      const nameSpan = row.querySelector(".sec-cell-inner span"); 
      // Veya direkt textContent (biraz kirli olabilir ama çalışır)
      const txt = nameSpan ? nameSpan.textContent.toLocaleLowerCase('tr') : "";
      
      if(txt.includes(t)){
          matchedRows.push(row);
      }
  });

  // Eşleşenleri ve ebeveynlerini aç
  matchedRows.forEach(row => {
      // Kendisini göster
      row.style.display = "";

      // Eğer bu bir şirketse (Level 3), Level 2 (Ind) ve Level 1 (Sec) açılmalı
      // Eğer bu bir alt sektörse (Level 2), Level 1 (Sec) açılmalı
      
      const parentId = row.getAttribute("data-parent");
      if(parentId){
          // Ebeveyn satırını bul (ör: ind_0_1 veya sec_0)
          const parentRow = document.querySelector(`tr[data-id="${parentId}"]`);
          if(parentRow) {
              parentRow.style.display = "";
              // Ebeveynin caret'ini "açık" yap
              const pCaret = parentRow.querySelector(".sec-caret");
              if(pCaret) pCaret.parentElement.parentElement.classList.add("sec-expanded");

              // Eğer ebeveynin de ebeveyni varsa (Level 3 -> Level 2 -> Level 1)
              const grandParentId = parentRow.getAttribute("data-parent");
              if(grandParentId){
                  const grandParentRow = document.querySelector(`tr[data-id="${grandParentId}"]`);
                  if(grandParentRow) {
                      grandParentRow.style.display = "";
                      const gpCaret = grandParentRow.querySelector(".sec-caret");
                      if(gpCaret) gpCaret.parentElement.parentElement.classList.add("sec-expanded");
                  }
              }
          }
      }
  });
};
// ✅ MASTER TOGGLE: Hepsini Aç / Kapat
window.secToggleAllRows = function(e){
    // Sıralama (sorting) çalışmasın diye eventi durdur
    if(e) e.stopPropagation();

    const masterBtn = document.getElementById("secMasterCaret");
    const isExpanded = masterBtn.classList.contains("sec-expanded");
    
    const level1Rows = document.querySelectorAll(".sec-row-level-1");
    const level2Rows = document.querySelectorAll(".sec-row-level-2");
    
    // NOT: Level 3 (Şirketler) çok fazla yer kapladığı için "Hepsini Aç"ta sadece 
    // Sektör -> Alt Sektör seviyesini açmak daha performanslı ve şıktır.
    // Eğer şirketleri de açmak istersen level3Rows ekleyebilirsin.

    if (isExpanded) {
        // --- HEPSİNİ KAPAT ---
        masterBtn.classList.remove("sec-expanded");
        
        // 1. Ana sektör caretlerini düzelt
        level1Rows.forEach(row => {
            const caret = row.querySelector(".sec-caret");
            if(caret) caret.parentElement.parentElement.classList.remove("sec-expanded");
        });

        // 2. Alt satırları gizle
        level2Rows.forEach(row => {
            row.style.display = "none";
            // Alt sektör caretlerini de kapat
            const caret = row.querySelector(".sec-caret");
            if(caret) caret.parentElement.parentElement.classList.remove("sec-expanded");
        });
        
        // Şirketleri gizle
        document.querySelectorAll(".sec-row-level-3").forEach(r => r.style.display = "none");

    } else {
        // --- HEPSİNİ AÇ (Sektör ve Alt Sektörleri) ---
        masterBtn.classList.add("sec-expanded");

        // 1. Ana sektörleri "açık" işaretle
        level1Rows.forEach(row => {
            const caret = row.querySelector(".sec-caret");
            if(caret) caret.parentElement.parentElement.classList.add("sec-expanded");
        });

        // 2. Alt sektörleri göster
        level2Rows.forEach(row => row.style.display = "");
        
        // İstersen şirketleri de açmak için:
        // document.querySelectorAll(".sec-row-level-3").forEach(r => r.style.display = "");
        // level2Rows.forEach(r => r.querySelector(".sec-caret")...add("sec-expanded"));
    }
};

// ✅ YENİ: Şirket ismi girilince sektörünü bul ve filtrele
window.secFindSectorByCompany = function(val){
  const t = String(val || "").toLocaleLowerCase('tr').trim();
  const secInput = document.getElementById("secSearchName");

  // Arama boşsa filtreyi temizle
  if(t.length < 2) { 
      if(secInput.value !== "") {
          secInput.value = "";
          secFilterTable(""); 
      }
      return; 
  }

  // Aktif gruptaki şirketlerde ara (Ticker veya İsim)
  const found = (window.companies || []).find(c => 
      c.group === activeGroup && 
      (c.ticker.toLocaleLowerCase('tr').includes(t) || c.name.toLocaleLowerCase('tr').includes(t))
  );

  if(found && found.sector) {
      // Şirket bulunduysa, sektörünü diğer kutuya yaz ve filtrele
      secInput.value = found.sector;
      secFilterTable(found.sector);
  }
};

// ✅ SECTORS INIT (Header Click Binding)
function initSectorList(){
  // Header click sort bağla
  document.querySelectorAll("#sec-thead th").forEach(th => {
    // Daha önce bağlandıysa geç
    if(th.__secBound) return;
    th.__secBound = true;

    th.onclick = () => {
      const key = th.dataset.key;
      if(!key) return;

      // Aynı sütuna tıklandıysa ters çevir, farklıysa default (Desc)
      if (secSort.key === key) {
          secSort.asc = !secSort.asc;
      } else {
          secSort.key = key;
          secSort.asc = (key === 'name'); // İsimse A-Z, Rakam ise Büyükten Küçüğe
      }
      
      secRenderTable();
    };
  });

  secRenderTable();
}
// ✅ SECTORS INIT (VERİ YÜKLEME GARANTİLİ)
// ✅ SECTORS INIT (VERİ YÜKLEME & SPINNER FIX)
window.secInitOnce = function(){
  // 1. Temel şirket listesini kontrol et
  finEnsureCompanies();
  finEnsureBenchmarks();
  
  // 2. Eğer veri (Map) henüz yoksa kullanıcıya "Yükleniyor" göster
  const tbody = document.getElementById("sec-tbody");
  const isMapEmpty = !window.__FIN_MAP || Object.keys(window.__FIN_MAP).length === 0;

  if (tbody && isMapEmpty) {
      // ✅ FIX: colspan="18" olan hücreye inline style ile genişlik ve pozisyon sıfırlaması yapıyoruz.
      // Böylece CSS'teki "ilk sütun 360px olsun" kuralını eziyoruz.
      tbody.innerHTML = `
        <tr>
            <td colspan="18" style="text-align:center; padding:60px; color:#666; width:100% !important; max-width:none !important; position:static !important; background:transparent !important;">
                <div class="spinner" style="margin:0 auto 15px auto;"></div>
                <div style="font-size:14px; font-weight:600;">Sektör Verileri Analiz Ediliyor...</div>
            </td>
        </tr>`;
  }

  // 3. Veriyi İndir
  if (typeof finBuildMapForActiveGroup === "function") {
    finBuildMapForActiveGroup(() => {
      secMap = window.__FIN_MAP || {};
      if (!secInited) { 
          secInited = true; 
          initSectorList(); 
      } else { 
          secRenderTable(); 
      }
    });
  } else {
    if (!secInited) { secInited = true; initSectorList(); }
    else secRenderTable();
  }
};
// ✅ HİYERARŞİK SEKTÖR TABLOSU (Sektör -> Alt Sektör -> Şirket)
    // ✅ GÜNCELLENMİŞ & SIRALAMA DESTEKLİ SEKTÖR TABLOSU
    // ✅ HİYERARŞİK SEKTÖR TABLOSU (HİZALAMA SORUNU GİDERİLDİ)
    window.secRenderTable = function(){
        const tbody = document.getElementById("sec-tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        if(window.secUpdateBadges) window.secUpdateBadges();
        updateSecSortHeaderUI();

        const companies = (window.companies || []).filter(c => c.group === activeGroup);
        const tree = {};

        companies.forEach(c => {
            const secName = (c.sector && String(c.sector).trim()) ? c.sector : "Diğer";
            const indName = (c.industry && String(c.industry).trim()) ? c.industry : "Diğer";
            const t = String(c.ticker).toUpperCase();

            if (!tree[secName]) tree[secName] = { name: secName, companies: [], industries: {} };
            tree[secName].companies.push(t);
            if (!tree[secName].industries[indName]) tree[secName].industries[indName] = [];
            tree[secName].industries[indName].push(t);
        });

        const calcStats = (tickerList) => {
            const stats = {};
            const keys = ["Brüt Kar Marjı","Faaliyet Kâr Marjı","Cari Oran","Asit Test Oranı","Borç/Öz Kaynak",
                "Nakit Döngüsü","Stok Devir Hızı","Stok Süresi","Alacak Devir Hızı","Alacak Süresi",
                "Borç Devir Hızı","Borç Süresi","ROIC","ROA","ROE"];
            
            stats["Piyasa Değeri"] = secSum(tickerList.map(t => secMap[t]?.["Piyasa Değeri"] ?? 0));
            stats["Firma Değeri"]  = secSum(tickerList.map(t => secMap[t]?.["Firma Değeri"] ?? 0));

            keys.forEach(k => {
                const vals = tickerList.map(t => (secMap[t] ? secMap[t][k] : null));
                stats[k] = secMedian(vals);
            });
            return stats;
        };

        let sectorList = Object.values(tree).map(secNode => {
            const secStats = calcStats(secNode.companies);
            let industryList = Object.keys(secNode.industries).map(indName => {
                const indTickers = secNode.industries[indName];
                return { name: indName, tickers: indTickers, stats: calcStats(indTickers) };
            });
            return { name: secNode.name, stats: secStats, industries: industryList };
        });

        const sortFn = (a, b) => {
            let valA, valB;
            if (secSort.key === 'name') {
                valA = a.name; valB = b.name;
                return secSort.asc ? valA.localeCompare(valB, 'tr') : valB.localeCompare(valA, 'tr');
            } else {
                valA = a.stats[secSort.key]; valB = b.stats[secSort.key];
                if (valA === null || valA === undefined) return 1;
                if (valB === null || valB === undefined) return -1;
                return secSort.asc ? valA - valB : valB - valA;
            }
        };

        sectorList.sort(sortFn);

        const renderRowCells = (st) => `
            <td data-label="Piyasa Değeri">${money(st["Piyasa Değeri"])}</td>
            <td data-label="Firma Değeri">${money(st["Firma Değeri"])}</td>
            <td class="${cls(st["Brüt Kar Marjı"])}">${pct(st["Brüt Kar Marjı"])}</td>
            <td class="${cls(st["Faaliyet Kâr Marjı"])}">${pct(st["Faaliyet Kâr Marjı"])}</td>
            <td>${num(st["Cari Oran"])}</td>
            <td>${num(st["Asit Test Oranı"])}</td>
            <td>${num(st["Borç/Öz Kaynak"])}</td>
            <td>${num(st["Nakit Döngüsü"])} Gün</td>
            <td>${num(st["Stok Devir Hızı"])}</td>
            <td>${num(st["Stok Süresi"])} Gün</td>
            <td>${num(st["Alacak Devir Hızı"])}</td>
            <td>${num(st["Alacak Süresi"])} Gün</td>
            <td>${num(st["Borç Devir Hızı"])}</td>
            <td>${num(st["Borç Süresi"])} Gün</td>
            <td class="${cls(st["ROIC"])}">${pct(st["ROIC"])}</td>
            <td class="${cls(st["ROA"])}">${pct(st["ROA"])}</td>
            <td class="${cls(st["ROE"])}">${pct(st["ROE"])}</td>
        `;

        sectorList.forEach((secNode, secIdx) => {
            const secId = `sec_${secIdx}`;
            const totalComps = secNode.industries.reduce((acc, curr) => acc + curr.tickers.length, 0);

            const secTr = document.createElement("tr");
            secTr.className = "sec-row-level-1";
            secTr.setAttribute("data-id", secId);
            
            // DÜZELTME: td style="display:flex" KALDIRILDI -> div class="sec-cell-inner" EKLENDİ
            secTr.innerHTML = `
                <td onclick="secToggleRow('${secId}')">
                    <div class="sec-cell-inner">
                        <i class="fa-solid fa-chevron-right sec-caret" id="caret_${secId}"></i>
                        <span class="sector-name" title="${secNode.name}">${secNode.name}</span>
                        <span class="comp-count">${totalComps}</span>
                    </div>
                </td>
                ${renderRowCells(secNode.stats)}
            `;
            tbody.appendChild(secTr);

            secNode.industries.sort(sortFn);

            secNode.industries.forEach((indNode, indIdx) => {
                const indId = `ind_${secIdx}_${indIdx}`;
                const indTr = document.createElement("tr");
                indTr.className = "sec-row-level-2";
                indTr.setAttribute("data-parent", secId);
                indTr.setAttribute("data-id", indId);
                indTr.style.display = "none";
                
                indTr.innerHTML = `
                    <td onclick="secToggleRow('${indId}')">
                        <div class="sec-cell-inner">
                            <i class="fa-solid fa-chevron-right sec-caret" id="caret_${indId}"></i>
                            <span title="${indNode.name}">${indNode.name}</span>
                            <span class="comp-count">${indNode.tickers.length}</span>
                        </div>
                    </td>
                    ${renderRowCells(indNode.stats)}
                `;
                tbody.appendChild(indTr);

                // Level 3 Sort
                indNode.tickers.sort((tA, tB) => {
                    if(secSort.key === 'name') return secSort.asc ? tA.localeCompare(tB) : tB.localeCompare(tA);
                    const vA = secMap[tA] ? secMap[tA][secSort.key] : null;
                    const vB = secMap[tB] ? secMap[tB][secSort.key] : null;
                    if (vA === null) return 1; if (vB === null) return -1;
                    return secSort.asc ? vA - vB : vB - vA;
                });

                indNode.tickers.forEach(ticker => {
                    const cData = secMap[ticker] || {};
                    const cInfo = companies.find(x => x.ticker === ticker) || {};
                    const compTr = document.createElement("tr");
                    compTr.className = "sec-row-level-3";
                    compTr.setAttribute("data-parent", indId);
                    compTr.style.display = "none";
                    // ✅ Şirkete tıklayınca Varlık Detay’a git
compTr.style.cursor = "pointer";
compTr.addEventListener("click", (e) => {
  e.stopPropagation();
  if (window.finOpenDetail) window.finOpenDetail(ticker);
});

                    const logoHtml = cInfo.logourl ? `<img src="${cInfo.logourl}" class="sec-comp-logo">` : '';
                    
                    compTr.innerHTML = `
  <td>
    <div class="sec-cell-inner">
      ${logoHtml}
      <span>${ticker}</span>
      <span class="muted" style="margin-left:6px; font-size:10px;">${cInfo.name || ''}</span>

      <!-- ✅ sağdaki aksiyon menüsü -->
      <span class="sec-row-actions">
        <span class="fp-menu-btn" title="İşlemler"
              onclick="event.stopPropagation(); fpOpenRowMenu('${ticker}', event);">
          <i class="fa-solid fa-ellipsis"></i>
        </span>
      </span>
    </div>
  </td>
  ${renderRowCells(cData)}
`;

                    tbody.appendChild(compTr);
                });
            });
        });
    };
    // Format Helpers (Scope içinde veya global tanımlı olmalı)
    const num = (v) => (v === null || v === undefined) ? `<span class="muted">-</span>` : Number(v).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
    const pct = (v) => (v === null || v === undefined) ? `<span class="muted">-</span>` : (Number(v) * 100).toFixed(1) + "%";
    const cls = (v) => (v > 0 ? "pos" : (v < 0 ? "neg" : ""));
    const money = (v) => (v === null || v === undefined) ? `<span class="muted">-</span>` : finFormatMoneyCompact(v, { decimals: 1 });

    // UI Helper: Header Oklarını Güncelle
    function updateSecSortHeaderUI(){
        document.querySelectorAll("#sec-thead th").forEach(th => {
            th.classList.remove("active-sort");
            th.removeAttribute("data-icon");
            
            // Eğer key eşleşiyorsa (veya varsayılan Name ise)
            if (th.dataset.key === secSort.key) {
                th.classList.add("active-sort");
                th.setAttribute("data-icon", secSort.asc ? " ↑" : " ↓");
            }
        });
    }
    // ✅ TOGGLE (AÇ/KAPA) FONKSİYONU
    window.secToggleRow = function(id) {
        const caret = document.getElementById(`caret_${id}`);
        const rows = document.querySelectorAll(`tr[data-parent="${id}"]`);
        
        // Durumu caret class'ından anla
        const isExpanded = caret.parentElement.parentElement.classList.contains("sec-expanded");
        
        if (isExpanded) {
            // KAPAT (Collapse)
            caret.parentElement.parentElement.classList.remove("sec-expanded");
            rows.forEach(row => {
                row.style.display = "none";
                // Eğer bu bir alt sektörse, onun çocuklarını da kapat (Recursive kapa)
                const childId = row.getAttribute("data-id");
                if (childId) { // Eğer bu satırın da çocukları varsa (yani Level 2 ise)
                    const childCaret = document.getElementById(`caret_${childId}`);
                    if(childCaret) {
                        childCaret.parentElement.parentElement.classList.remove("sec-expanded");
                        const childRows = document.querySelectorAll(`tr[data-parent="${childId}"]`);
                        childRows.forEach(cr => cr.style.display = "none");
                    }
                }
            });
        } else {
            // AÇ (Expand)
            caret.parentElement.parentElement.classList.add("sec-expanded");
            rows.forEach(row => row.style.display = "table-row");
        }
    };


    // ============================================
    // COMPANIES LIST JAVASCRIPT
    // ============================================
    
    // ✅ Companies List, global benchmark map’i kullanır
const map = window.__FIN_MAP || (window.__FIN_MAP = Object.create(null));

    let clLimit = 200; // ilk açılışta 200 satır
    let __clLastKey = "";
let __clRenderedCount = 0;
let __clAppendRequested = false;

function clLoadMore(){
  __clAppendRequested = true;   // ✅ yeni satırlar eklenecek
  clLimit += 200;
  renderCompanyList();
}


let __clIO = null;
let __clLoading = false;

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

    // render bitince tekrar izin ver (küçük gecikme yeterli)
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


    let currentSort = { key: 'Piyasa Değeri', asc: false };
  

    let activeFilters = { name: "", sector: "", ranges: {} };
    const filterKeys = ["Piyasa Değeri", "Firma Değeri", "Satış Gelirleri", "Cari Oran", "Borç/Öz Kaynak", "Brüt Kar Marjı", "Faaliyet Kâr Marjı", "ROIC", "ROE", "PD/DD", "F/K"];

    function toggleFilter() {
        const overlay = document.getElementById("filterOverlay");
        const isVisible = overlay.style.display === "block";
        overlay.style.display = isVisible ? "none" : "block";
    }

    const parseNumber = (v) => finParseBenchmarkValue(v);
    // const num = (v) => (v === null || v === undefined) ? "-" : v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const mlnTL = (v) => (v === null || v === undefined) ? "-" : finFormatMoneyCompact(v);
    // const pct = (v) => (v === null || v === undefined) ? "-" : "% " + (v * 100).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const days = (v) => (v === null || v === undefined) ? "-" : Math.round(v) + " Gün";
    // const cls = (v) => v > 0 ? "val-up" : (v < 0 ? "val-down" : "");

    let __clSearchT = 0;

    
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


  // ✅ Filtre/sort/group değişti mi? Key ile anlayalım
  const keyObj = {
    g: activeGroup,
    sKey: currentSort.key,
    sAsc: currentSort.asc,
    name: (activeFilters.name || "").toLowerCase(),
    sector: activeFilters.sector || "",
    ranges: activeFilters.ranges || {}
  };
  const key = JSON.stringify(keyObj);

  const append = (__clAppendRequested && key === __clLastKey);
  __clAppendRequested = false;

  // ✅ append değilse tabloyu sıfırla (filtre/sort değişmiş demektir)
  if (!append) {
    tbody.innerHTML = "";
    __clRenderedCount = 0;
    __clLastKey = key;
  }


        // BURADA FILTRELEME EKLENDI: c.group === activeGroup
        let filtered = window.companies.filter(c => {
            // 1. Grup Kontrolü
            if(c.group !== activeGroup) return false;

            // 2. Sektör Filtresi (Varsa)
            if (window.clFilters && window.clFilters.sector) {
                if (c.sector !== window.clFilters.sector) return false;
            }

            // 3. Alt Sektör Filtresi (Varsa)
            if (window.clFilters && window.clFilters.industry) {
                if (c.industry !== window.clFilters.industry) return false;
            }

            const d = map[c.ticker] || {};
            
            const q = String(activeFilters.name || "").toLocaleLowerCase('tr').trim();
const nm = String(c.name || "").toLocaleLowerCase('tr');
const tk = String(c.ticker || "").toLocaleLowerCase('tr');

const matchName = (q.length < 1)
  ? true
  : (nm.includes(q) || tk.includes(q));


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
            // İsim sıralaması ise özel işlem
            if (currentSort.key === 'name') {
                return currentSort.asc 
