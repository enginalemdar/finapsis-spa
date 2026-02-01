// js/sectors.js

let secMap = {}; 
let secSort = { key: 'Piyasa Değeri', asc: false };
let secInited = false;

const sectorIcons = {
    "Alkolsüz İçecek Üreticileri": "fa-solid fa-bottle-water",
    "Ambalajlı Gıdalar": "fa-solid fa-bowl-food",
    "Bira ve Alkollü İçecek Üreticileri": "fa-solid fa-beer-mug-empty",
    "Şekerleme ve Çikolata Üretimi": "fa-solid fa-candy-cane",
    "Tahıl ve Değirmencilik Üretimi": "fa-solid fa-wheat-awn",
    "Tarım Ürünleri": "fa-solid fa-seedling",
    "Gıda Dağıtımı": "fa-solid fa-truck-ramp-box",
    "Altyapı Yazılımları": "fa-solid fa-server",
    "Bilgi Teknolojileri Hizmetleri": "fa-solid fa-laptop-code",
    "Uygulama Yazılımları": "fa-solid fa-window-maximize",
    "İnternet İçerik Platformları": "fa-solid fa-icons",
    "İletişim Ekipmanları": "fa-solid fa-tower-broadcast",
    "Telekom Hizmetleri": "fa-solid fa-phone-volume",
    "Sağlık Bilgi Hizmetleri": "fa-solid fa-notes-medical",
    "Ambalaj ve Konteyner": "fa-solid fa-box",
    "Bakır Üretimi": "fa-solid fa-cubes",
    "Çelik": "fa-solid fa-industry",
    "Metal İşleme": "fa-solid fa-gears",
    "Metal Madenciliği": "fa-solid fa-pickaxe",
    "Diğer Endüstriyel Metaller & Madencilik": "fa-solid fa-bore-hole",
    "Uzmanlaşmış Endüstriyel Makineler": "fa-solid fa-screwdriver-wrench",
    "Tarım ve Ağır İş Makineleri": "fa-solid fa-tractor",
    "Elektrik Ekipmanları": "fa-solid fa-plug-circle-bolt",
    "Bağımsız Enerji Üreticileri": "fa-solid fa-charging-station",
    "Güneş Enerjisi": "fa-solid fa-solar-panel",
    "Yenilenebilir Enerji": "fa-solid fa-leaf",
    "Elektrik Dağıtım ve İletim": "fa-solid fa-tower-observation",
    "Doğalgaz Dağıtım ve İletim": "fa-solid fa-pipeline",
    "Düzenlenen Elektrik Şirketleri": "fa-solid fa-bolt",
    "Düzenlenen Gaz Dağıtım": "fa-solid fa-fire-flame-simple",
    "Termal Kömür": "fa-solid fa-mound",
    "Bölgesel Bankalar": "fa-solid fa-building-columns",
    "Ticari Bankalar": "fa-solid fa-landmark",
    "Sermaye Piyasası Kuruluşları": "fa-solid fa-building-ngo",
    "Kredi Hizmetleri": "fa-solid fa-credit-card",
    "Varlık Yönetimi": "fa-solid fa-vault",
    "Finansal Veri Hizmetleri & Borsalar": "fa-solid fa-chart-line",
    "Hayat Sigortası": "fa-solid fa-heart-pulse",
    "Yangın & Kaza Sigortası": "fa-solid fa-house-chimney-crack",
    "Sigorta (Çok Alanlı)": "fa-solid fa-shield-halved",
    "GYO – Çeşitlendirilmiş": "fa-solid fa-city",
    "GYO – Konut": "fa-solid fa-house-chimney",
    "GYO – Ofis": "fa-solid fa-building",
    "GYO – Otel & Konaklama": "fa-solid fa-hotel",
    "GYO – Perakende": "fa-solid fa-store",
    "GYO – Sanayi": "fa-solid fa-warehouse",
    "GYO – Uzmanlaşmış": "fa-solid fa-tree-city",
    "Gayrimenkul Geliştirme": "fa-solid fa-trowel-bricks",
    "Gayrimenkul Hizmetleri": "fa-solid fa-handshake-angle",
    "Otomotiv Üreticileri": "fa-solid fa-car-side",
    "Oto Yedek Parça": "fa-solid fa-oil-can",
    "Oto ve Ticari Araç Bayileri": "fa-solid fa-car-rear",
    "Havayolu Şirketleri": "fa-solid fa-plane-up",
    "Havalimanı ve Hava Hizmetleri": "fa-solid fa-plane-arrival",
    "Demiryolu Taşımacılığı": "fa-solid fa-train",
    "Deniz Taşımacılığı": "fa-solid fa-ship",
    "Entegre Lojistik & Kargo": "fa-solid fa-truck-fast",
    "Market Zincirleri / Süpermarketler": "fa-solid fa-basket-shopping",
    "Gıda & İlaç Perakendesi": "fa-solid fa-prescription-bottle-medical",
    "Hazır Giyim Perakendesi": "fa-solid fa-bag-shopping",
    "Büyük Mağazalar / AVM Perakendesi": "fa-solid fa-shop",
    "Restoranlar": "fa-solid fa-utensils",
    "Konaklama Hizmetleri": "fa-solid fa-bed",
    "Tatil Köyleri ve Kumarhaneler": "fa-solid fa-clover",
    "Seyahat Hizmetleri": "fa-solid fa-map-location-dot",
    "Tıbbi Cihazlar": "fa-solid fa-stethoscope",
    "Tıbbi Araç Gereçler": "fa-solid fa-kit-medical",
    "Tıbbi Bakım Tesisleri": "fa-solid fa-hospital",
    "İlaç Üreticileri (Jenerik & Özel)": "fa-solid fa-pills",
    "Tıbbi Ürün Dağıtımı": "fa-solid fa-truck-medical",
    "Biyoteknoloji": "fa-solid fa-dna",
    "Holdingler": "fa-solid fa-briefcase",
    "Sportif Faaliyetler": "fa-solid fa-volleyball",
    "Reklam Ajansları": "fa-solid fa-rectangle-ad",
    "Yayıncılık": "fa-solid fa-book-open",
    "Eğitim Hizmetleri": "fa-solid fa-graduation-cap",
    "Savunma Sanayii": "fa-solid fa-shield-hawk",
    "Havacılık ve Savunma Sanayii": "fa-solid fa-jet-fighter",
    "Kimya": "fa-solid fa-flask",
    "Özel Kimyasallar": "fa-solid fa-flask-vial",
    "Tekstil Üretimi": "fa-solid fa-scissors",
    "Mobilya, Ev Gereçleri ve Beyaz Eşya": "fa-solid fa-couch",
    "Yapı Malzemeleri": "fa-solid fa-hammer",
    "Diğer": "fa-solid fa-ellipsis"
};

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
  secMap = window.__FIN_MAP || {};
}

window.secGoToCompanyList = function(sectorName){
  switchTab('companieslist.html');
  setTimeout(() => {
    if(window.clSelectSector) {
        window.clSelectSector(sectorName);
    }
  }, 50);
};

window.secRenderTable = function(){
    const tbody = document.getElementById("sec-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    // Her render'da map'ı taze al — grup değişince stale kalmasın
    secMap = window.__FIN_MAP || {};

    if(window.secUpdateBadges) window.secUpdateBadges();
    updateSecSortHeaderUI();

    const companies = (window.companies || []).filter(c => c.group === window.activeGroup);
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

    const num = (v) => (v === null || v === undefined) ? `<span class="muted">-</span>` : Number(v).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
    const pct = (v) => (v === null || v === undefined) ? `<span class="muted">-</span>` : (Number(v) * 100).toFixed(1) + "%";
    const cls = (v) => (v > 0 ? "pos" : (v < 0 ? "neg" : ""));
    const money = (v) => (v === null || v === undefined) ? `<span class="muted">-</span>` : finFormatMoneyCompact(v, { decimals: 1 });

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

    const frag = document.createDocumentFragment();

    sectorList.forEach((secNode, secIdx) => {
        const secId = `sec_${secIdx}`;
        const totalComps = secNode.industries.reduce((acc, curr) => acc + curr.tickers.length, 0);

        const secTr = document.createElement("tr");
        secTr.className = "sec-row-level-1";
        secTr.setAttribute("data-id", secId);
        
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
        frag.appendChild(secTr);

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
            frag.appendChild(indTr);

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

                frag.appendChild(compTr);
            });
        });
    });

    // Tüm satırları tek seferinde DOM'a yaz — reflow sayısını minimuma indir
    tbody.appendChild(frag);
};

window.secUpdateBadges = function() {
    const area = document.getElementById("secBadgeArea");
    if(!area) return;

    let groupLabel = "BIST";
    if(window.activeGroup === 'nyse') groupLabel = "NYSE";
    if(window.activeGroup === 'nasdaq') groupLabel = "NASDAQ";

    const marketPopupHTML = `
        <div id="secMarketPopup" class="sc-market-popup" onclick="event.stopPropagation()">
            <div class="sc-market-item ${window.activeGroup==='bist'?'active':''}" onclick="setGroup('bist')">BIST (İstanbul)</div>
            <div class="sc-market-item ${window.activeGroup==='nyse'?'active':''}" onclick="setGroup('nyse')">NYSE (New York)</div>
            <div class="sc-market-item ${window.activeGroup==='nasdaq'?'active':''}" onclick="setGroup('nasdaq')">NASDAQ</div>
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
        pop.style.display = isVisible ? "none" : "block";
    }
};

document.addEventListener('click', (e) => {
    const pop = document.getElementById("secMarketPopup");
    if(pop && pop.style.display === "block" && !e.target.closest('.market-badge')) {
        pop.style.display = "none";
    }
});

window.secFilterTable = function(term){
  const t = String(term || "").toLocaleLowerCase('tr').trim();
  const allRows = document.querySelectorAll("#sec-tbody tr");

  if (t.length < 1) {
      allRows.forEach(row => {
          if (row.classList.contains("sec-row-level-1")) {
              row.style.display = ""; 
              const caret = row.querySelector(".sec-caret");
              if(caret && caret.parentElement) {
                  caret.parentElement.parentElement.classList.remove("sec-expanded");
              }
          } else {
              row.style.display = "none"; 
          }
      });
      const master = document.getElementById("secMasterCaret");
      if(master) master.classList.remove("sec-expanded");
      return; 
  }

  allRows.forEach(r => r.style.display = "none");

  const matchedRows = [];
  allRows.forEach(row => {
      const nameSpan = row.querySelector(".sec-cell-inner span"); 
      const txt = nameSpan ? nameSpan.textContent.toLocaleLowerCase('tr') : "";
      
      if(txt.includes(t)){
          matchedRows.push(row);
      }
  });

  matchedRows.forEach(row => {
      row.style.display = "";
      const parentId = row.getAttribute("data-parent");
      if(parentId){
          const parentRow = document.querySelector(`tr[data-id="${parentId}"]`);
          if(parentRow) {
              parentRow.style.display = "";
              const pCaret = parentRow.querySelector(".sec-caret");
              if(pCaret) pCaret.parentElement.parentElement.classList.add("sec-expanded");

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

window.secToggleAllRows = function(e){
    if(e) e.stopPropagation();

    const masterBtn = document.getElementById("secMasterCaret");
    const isExpanded = masterBtn.classList.contains("sec-expanded");
    
    const level1Rows = document.querySelectorAll(".sec-row-level-1");
    const level2Rows = document.querySelectorAll(".sec-row-level-2");
    
    if (isExpanded) {
        masterBtn.classList.remove("sec-expanded");
        level1Rows.forEach(row => {
            const caret = row.querySelector(".sec-caret");
            if(caret) caret.parentElement.parentElement.classList.remove("sec-expanded");
        });
        level2Rows.forEach(row => {
            row.style.display = "none";
            const caret = row.querySelector(".sec-caret");
            if(caret) caret.parentElement.parentElement.classList.remove("sec-expanded");
        });
        document.querySelectorAll(".sec-row-level-3").forEach(r => r.style.display = "none");
    } else {
        masterBtn.classList.add("sec-expanded");
        level1Rows.forEach(row => {
            const caret = row.querySelector(".sec-caret");
            if(caret) caret.parentElement.parentElement.classList.add("sec-expanded");
        });
        level2Rows.forEach(row => row.style.display = "");
    }
};

window.secFindSectorByCompany = function(val){
  const t = String(val || "").toLocaleLowerCase('tr').trim();
  const secInput = document.getElementById("secSearchName");

  if(t.length < 2) { 
      if(secInput.value !== "") {
          secInput.value = "";
          secFilterTable(""); 
      }
      return; 
  }

  const found = (window.companies || []).find(c => 
      c.group === window.activeGroup && 
      (c.ticker.toLocaleLowerCase('tr').includes(t) || c.name.toLocaleLowerCase('tr').includes(t))
  );

  if(found && found.sector) {
      secInput.value = found.sector;
      secFilterTable(found.sector);
  }
};

function initSectorList(){
  document.querySelectorAll("#sec-thead th").forEach(th => {
    if(th.__secBound) return;
    th.__secBound = true;

    th.onclick = () => {
      const key = th.dataset.key;
      if(!key) return;

      if (secSort.key === key) {
          secSort.asc = !secSort.asc;
      } else {
          secSort.key = key;
          secSort.asc = (key === 'name'); 
      }
      
      secRenderTable();
    };
  });

  secRenderTable();
}

window.secInitOnce = function(){
  finEnsureCompanies();
  finEnsureBenchmarks();
  
  const tbody = document.getElementById("sec-tbody");
  const isMapEmpty = !window.__FIN_MAP || Object.keys(window.__FIN_MAP).length === 0;

  if (tbody && isMapEmpty) {
      tbody.innerHTML = `
        <tr>
            <td colspan="18" style="text-align:center; padding:60px; color:#666; width:100% !important; max-width:none !important; position:static !important; background:transparent !important;">
                <div class="spinner" style="margin:0 auto 15px auto;"></div>
                <div style="font-size:14px; font-weight:600;">Sektör Verileri Analiz Ediliyor...</div>
            </td>
        </tr>`;
  }

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

function updateSecSortHeaderUI(){
    document.querySelectorAll("#sec-thead th").forEach(th => {
        th.classList.remove("active-sort");
        th.removeAttribute("data-icon");
        
        if (th.dataset.key === secSort.key) {
            th.classList.add("active-sort");
            th.setAttribute("data-icon", secSort.asc ? " ↑" : " ↓");
        }
    });
}

window.secToggleRow = function(id) {
    const caret = document.getElementById(`caret_${id}`);
    const rows = document.querySelectorAll(`tr[data-parent="${id}"]`);
    
    const isExpanded = caret.parentElement.parentElement.classList.contains("sec-expanded");
    
    if (isExpanded) {
        caret.parentElement.parentElement.classList.remove("sec-expanded");
        rows.forEach(row => {
            row.style.display = "none";
            const childId = row.getAttribute("data-id");
            if (childId) { 
                const childCaret = document.getElementById(`caret_${childId}`);
                if(childCaret) {
                    childCaret.parentElement.parentElement.classList.remove("sec-expanded");
                    const childRows = document.querySelectorAll(`tr[data-parent="${childId}"]`);
                    childRows.forEach(cr => cr.style.display = "none");
                }
            }
        });
    } else {
        caret.parentElement.parentElement.classList.add("sec-expanded");
        rows.forEach(row => row.style.display = "table-row");
    }
};
