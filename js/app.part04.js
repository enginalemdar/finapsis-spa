                    ? a.name.localeCompare(b.name, "tr") 
                    : b.name.localeCompare(a.name, "tr");
            }

            // Metrik sıralaması (Piyasa Değeri vs.)
            // map[ticker] yoksa boş obje {}, oradan da değeri al
            const dataA = map[a.ticker] || {};
            const dataB = map[b.ticker] || {};
            
            let valA = dataA[currentSort.key];
            let valB = dataB[currentSort.key];

            // Değer yoksa (null/undefined) en düşüğü ver ki en alta gitsin
            // Not: Infinity kullanmıyoruz, null kontrolü yapıyoruz.
            const hasA = (valA !== null && valA !== undefined);
            const hasB = (valB !== null && valB !== undefined);

            if (!hasA && !hasB) return 0;
            if (!hasA) return 1;  // A yoksa, A büyüktür (alta git)
            if (!hasB) return -1; // B yoksa, B büyüktür (alta git)

            // Sayısal karşılaştırma
            return currentSort.asc ? valA - valB : valB - valA;
        });
        // Arama varken limit uygulama: NVDA gibi sonuçlar scroll istemeden gelsin
const __q = String(activeFilters.name || "").trim();
if (__q) {
  // arama sonuçlarını göster (çok büyürse diye üst sınır)
  filtered = filtered.slice(0, 5000);
} else {
  const __q = String(activeFilters.name || "").trim();
if (__q) {
  // arama sonuçlarını göster (çok büyürse diye üst sınır)
  filtered = filtered.slice(0, 5000);
} else {
  // Arama varken limit uygulama (NVDA/GOOGL/TSLA scroll'suz gelsin)
const __q = String(activeFilters.name || "").trim();
if (__q) {
  filtered = filtered.slice(0, 5000);
} else {
  filtered = filtered.slice(0, clLimit);
}

}

}



       // ✅ Chunk render: büyük listelerde donmayı keser
window.__clRenderToken = (window.__clRenderToken || 0) + 1;
const token = window.__clRenderToken;

let i = __clRenderedCount;
const BATCH = 70;

function pump(){
  if (token !== window.__clRenderToken) return;

  const frag = document.createDocumentFragment();
  const end = Math.min(i + BATCH, filtered.length);

  for (; i < end; i++){
    const c = filtered[i];
    const d = map[c.ticker] || {};
    
    // --- FİYAT HESAPLAMA ---
    const price = window.currentPriceData[c.ticker] || 0;
    const prev = window.prevPriceData[c.ticker] || price;
    
    let priceHtml = '<span class="muted">-</span>';
    if (price > 0) {
        const diff = price - prev;
        const isUp = diff > 0;
        const isDown = diff < 0;
        
        // Renk ve İkon Belirleme
        const color = isUp ? 'color:#c2f50e;' : (isDown ? 'color:#ff4d4d;' : 'color:#eee;');
        const icon = isUp ? '<i class="fa-solid fa-caret-up"></i>' : (isDown ? '<i class="fa-solid fa-caret-down"></i>' : '');
        const sym = (['sp','nyse','nasdaq','doviz','emtia','kripto'].includes(c.group)) ? '$' : '₺';

        priceHtml = `
            <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px; font-weight:700; ${color}">
                ${icon} <span>${sym}${price.toLocaleString("tr-TR", {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
            </div>
        `;
    }
    // -----------------------

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>
        <div style="display:flex; align-items:center; gap:12px;">
          <img src="${c.logourl}" loading="lazy" style="width:32px; height:32px; object-fit:contain; background:#111; border-radius:6px; flex-shrink: 0;" onerror="this.style.display='none'">
          <div style="display: flex; flex-direction: column; justify-content: center; gap: 4px; overflow: hidden;">
            <a href="https://finapsis.co/comdetail/${c.slug}" target="_top" style="font-weight:600; font-size:14px; color:#fff; text-decoration:none;">${c.name}</a>
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

  // ara ara iframe ölç
  if (i % (BATCH*3) === 0) window.pfFinapsisResize?.();

  if (i < filtered.length) requestAnimationFrame(pump);
else {
  __clRenderedCount = filtered.length;   // ✅ kaç satır basıldı hatırla
  window.pfFinapsisResize?.();
}

}

requestAnimationFrame(pump);

    }
  // ==========================================
// YENİ COMPANIES FILTER LOGIC (PORTFOLIO STYLE)
// ==========================================

// Popup Aç/Kapa

// Popup Kapat
window.clCloseSectorPopup = function(e){
  if(e) e.stopPropagation();
  const pop = document.getElementById("clSectorPopup");
  if(pop) pop.style.display = "none";
};

// Listeyi Oluştur

// Sektör Seçimi
window.clSelectSector = function(sec){
  // activeFilters global değişkenini güncelle
  if(!activeFilters) activeFilters = {};
  activeFilters.sector = sec;
  
  // Listeyi yeniden çiz
  renderCompanyList();
  
  // Popup'ı kapat ve listeyi güncelle (buton rengi için)
  clCloseSectorPopup();
  clBuildSectorList(); 
};

// Filtreyi Temizle
window.clClearSectorFilter = function(e){
  if(e) e.stopPropagation();
  clSelectSector("");
};

// Popup İçi Arama
window.clFilterSectorListInPopup = function(term){
  const t = String(term || "").toLocaleLowerCase('tr');
  const items = document.querySelectorAll("#clSectorList .cl-sector-item");
  
  items.forEach(el => {
    const txt = el.textContent.toLocaleLowerCase('tr');
    // "Tüm Sektörler" seçeneği her zaman görünsün veya eşleşme varsa
    if(el.textContent === "Tüm Sektörler" || txt.includes(t)) {
      el.style.display = "block";
    } else {
      el.style.display = "none";
    }
  });
};

// Dışarı tıklayınca kapat
document.addEventListener("click", (e) => {
  const pop = document.getElementById("clSectorPopup");
  const btn = document.getElementById("clSectorBtn");
  const inp = document.getElementById("clSectorSearchInput"); // Inputa tıklayınca kapanmasın

  if(pop && pop.style.display === "block") {
    if(!pop.contains(e.target) && !btn.contains(e.target)) {
      pop.style.display = "none";
    }
  }
});  

    // Sektör dropdown'unu aktif gruba göre yenileme
    function updateCompanyListSectorDropdown() {
        const s = document.getElementById("f_sector");
        s.innerHTML = '<option value="">Tüm Sektörler</option>'; // Reset
        
        // Sadece aktif gruptaki şirketlerin sektörlerini al
        const sectors = [...new Set(window.companies
            .filter(c => c.group === activeGroup)
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

    function initCompaniesList() {
  if (window.__companiesListInited) return;
  window.__companiesListInited = true;

  finEnsureCompanies();
  finEnsureBenchmarks();

  // sektör dropdown önce companies ile dolsun
  updateCompanyListSectorDropdown();

  // map arkada dolsun; dolunca tabloyu tekrar çiz
  finBuildMapForActiveGroup(() => {
    renderCompanyList();
  });

  // ilk etapta tabloyu çiz (map henüz dolmamış olabilir)
  renderCompanyList();
  clSetupInfiniteScroll();


  // search input event (1 kere bağla)
  const searchEl = clQ("#mainSearch");
  if (searchEl && !searchEl.__fpBound) {
    searchEl.__fpBound = true;
    searchEl.addEventListener("input", applyMainSearch);
  }
}


    

    // ============================================
    // PORTFOLYO (İZOLE) SCRIPT
    // ============================================

(function() {
  // --- CONFIG KAYNAKLARI ---
  // 1) window.FINAPSIS_CONFIG (önerilen)
  // 2) Bubble'ın global değişkenleri (window.BUBBLE_USER_ID / window.BUBBLE_USERNAME vb.)
  const CFG = window.FINAPSIS_CONFIG || {};

  const BUBBLE_USER_ID = String((CFG.BUBBLE_USER_ID || window.BUBBLE_USER_ID || window.BUBBLE_USERID || '')).trim();
  const BUBBLE_USER_NAME = String((CFG.BUBBLE_USER_NAME || window.BUBBLE_USERNAME || window.BUBBLE_USER_NAME || '')).trim();
  const BUBBLE_API_TOKEN = String((CFG.BUBBLE_API_TOKEN || window.BUBBLE_API_TOKEN || '')).trim();

  const API_BASE = String((CFG.API_BASE || 'https://eap-35848.bubbleapps.io/api/1.1/wf')).replace(/\/\s*$/, '');
  const GOOGLE_CLIENT_ID = String((CFG.GOOGLE_CLIENT_ID || '')).trim();
  const REDIRECT_URI = String((CFG.REDIRECT_URI || window.location.href.split('?')[0])).trim();

  const currentPriceData = window.currentPriceData || {};
  const prevPriceData = window.prevPriceData || {};

  let prices = {}, prevPrices = {};
  for(let k in currentPriceData) prices[k] = parseFloat(currentPriceData[k]);
  for(let k in prevPriceData) prevPrices[k] = parseFloat(prevPriceData[k]);

  // ===== MIDAS (BIST) PRICE REFRESH via n8n proxy =====
// ===== PRICE REFRESH via Google Apps Script (ALL groups) =====
// ARTIK KULLANILMIYOR - Fiyatlar başlangıçta R2'dan yükleniyor.
// ===== PRICE REFRESH via Google Apps Script (ALL groups) =====
// ARTIK KULLANILMIYOR - Fiyatlar başlangıçta R2'dan yükleniyor.
// ===== PRICE REFRESH via R2 (Detail JSON) =====

// ✅ DEĞİŞKEN TANIMI
let __priceInFlight = false; 

// Fonksiyonu doğrudan window'a atayarak veya declare ederek tekilleştiriyoruz
window.pfRefreshPricesFromProxy = async function(){
  if (__priceInFlight) return;
  __priceInFlight = true;

  try{
    console.log("[PriceUpdate] Fiyatlar detail.v1.json üzerinden güncelleniyor...");
    
    // Proxy yerine yeni detail dosyasını çekiyoruz (Cache-busting için time parametresi ekledik)
    const res = await fetch(`${window.FIN_DATA_BASE}/price/detail.v1.json?t=${Date.now()}`);
    
    if (res.ok) {
        const rawDetail = await res.json();
        const detailList = (Array.isArray(rawDetail) && rawDetail[0]?.data) ? rawDetail[0].data : [];

        // Global değişkenleri güncelle
        detailList.forEach(item => {
            if (item.ticker) {
                const t = String(item.ticker).trim().toUpperCase();
                const p = Number(item.price);
                const prev = Number(item.prev);

                window.currentPriceData[t] = p;
                window.prevPriceData[t] = prev;

                // Map ve Sıralama verilerini güncelle
                if(!window.__FIN_MAP) window.__FIN_MAP = {};
                if(!window.__FIN_MAP[t]) window.__FIN_MAP[t] = {};
                
                window.__FIN_MAP[t]["price"] = p;
                window.__FIN_MAP[t]["prev"] = prev;
            }
        });

        // UI Yenilemeleri
        try { if(window.pfRenderMarketList) window.pfRenderMarketList(); } catch(e){}
        try { if(window.pfRenderDashboard) window.pfRenderDashboard(); } catch(e){}
        
        // Eğer Şirketler listesi açıksa orayı da güncelle (Fiyat sütunu için)
        try { 
            const cl = document.getElementById("view-companies");
            if (cl && cl.classList.contains("active") && window.renderCompanyList) {
                window.renderCompanyList();
            }
        } catch(e){}

        // Detay sayfası açıksa fiyatı tazele
        try {
          const det = document.getElementById("view-detail");
          if (det && det.classList.contains("active")) {
            if (window.finDetailRefreshHeaderPrice) window.finDetailRefreshHeaderPrice();
          }
        } catch(e){}
        
        console.log(`[PriceUpdate] ${detailList.length} enstrüman güncellendi.`);
    }
  } catch(e){
    console.warn("[PriceUpdate] Güncelleme hatası:", e);
  } finally{
    __priceInFlight = false;
  }
}


// debug için dışarı aç (opsiyonel)
window.pfRefreshPricesFromProxy = pfRefreshPricesFromProxy;

  

  const ALL_KEY = "__ALL__";

  // state
  let state = {
    user: null,
    token: null,
    portfolios: [],
    activePortfolio: null,       // only for single view
    activePortfolioId: null,     // can be ALL_KEY
    cashBalance: 0,
    activeGroup: 'bist',
    sectorFilter: "",
    trade: { ticker: null, side: 'buy', inputMode: 'qty', portfolioId: null },
    isLogin: true,
    activeTab: 'assets',
    // caches
    portfolioCache: {},          // { [portfolioId]: detailResponse }
    allCombined: null            // { positions:[], transactions:[], portfolioNamesById:{} }
  };

  let charts = {};

  const getItem = (ticker) => (window.companies || []).find(c => c.ticker === ticker);
  const getGroup = (ticker) => getItem(ticker)?.group;

  const isUSD = (ticker) => {
    const item = getItem(ticker);
    return item && (item.group === 'sp' || item.group === 'emtia' || item.group === 'kripto');
  };

  const getSym = (ticker) => isUSD(ticker) ? '$' : '₺';

  const getQtyUnitLabel = (ticker) => {
    const item = getItem(ticker);
    const g = item?.group;

    // Sadece emtia unit
    if (g === 'emtia') return item?.unit || 'Birim';

    // Döviz qty modunda baz dövizi göster (USDTRY -> USD)
    if (g === 'doviz') return (typeof ticker === 'string' && ticker.length >= 3) ? ticker.slice(0,3) : 'Birim';

    // Hisse/fon/sp
    return 'Adet';
  };

  const getDefaultInputMode = (ticker) => {
    if (getGroup(ticker) === 'doviz') return 'amount';
    return 'qty';
  };

  const setTradePlaceholder = () => {
    const t = state.trade.ticker;
    const input = document.getElementById('tradeQty');
    if (!t || !input) return;

    const sym = getSym(t);
    const g = getGroup(t);

    if (state.trade.inputMode === 'amount') {
      input.placeholder = `Tutar (${sym}) giriniz...`;
    } else {
      if (g === 'doviz') input.placeholder = `Miktar (${getQtyUnitLabel(t)}) giriniz...`;
      else input.placeholder = `${getQtyUnitLabel(t)} giriniz...`;
    }
  };

  async function api(ep, body) {
    const headers = { "Content-Type": "application/json" };
    const token = state.token || BUBBLE_API_TOKEN;
    if(token) headers["Authorization"] = "Bearer " + token;
    try {
      return await (await fetch(`${API_BASE}/${ep}/`, { method: "POST", headers, body: JSON.stringify(body) })).json();
    } catch(e) {
      return { status: "error" };
    }
  }

  async function getPortfolioDetailCached(pfId) {
    if (!pfId) return null;
    if (state.portfolioCache[pfId]) return state.portfolioCache[pfId];
    const res = await api('portfolio-detail', { portfolio: pfId });
    if (res.status === "success") state.portfolioCache[pfId] = res.response;
    return state.portfolioCache[pfId] || null;
  }

  function combineAll(detailsList, portfolioNamesById) {
    const map = {}; // ticker -> { ticker, quantity, costSum, anyAvgCostRef }
    const allTx = [];

    detailsList.forEach(d => {
      if (!d) return;
      const pfId = d.portfolio?.portfolio_id;
      const pfName = portfolioNamesById[pfId] || d.portfolio?.name || "Portföy";
      const positions = (d.positions || []).filter(pos => (Number(pos.quantity) || 0) > 0);
      const transactions = d.transactions || [];

      positions.forEach(p => {
        const t = p.ticker;
        const q = Number(p.quantity) || 0;
        const avg = Number(p.avg_cost) || 0;
        if (!map[t]) map[t] = { ticker: t, quantity: 0, costSum: 0 };
        map[t].quantity += q;
        map[t].costSum += (avg * q);
      });

      transactions.forEach(tx => {
        allTx.push({
          ...tx,
          __pf_id: pfId,
          __pf_name: pfName
        });
      });
    });

    const combinedPositions = Object.values(map)
      .filter(x => x.quantity > 0)
      .map(x => ({
        ticker: x.ticker,
        quantity: x.quantity,
        avg_cost: x.quantity > 0 ? (x.costSum / x.quantity) : 0
      }));

    const combinedTransactions = allTx
      .slice()
      .sort((a,b) => new Date(b.executed_at) - new Date(a.executed_at));

    return { positions: combinedPositions, transactions: combinedTransactions, portfolioNamesById };
  }

  async function loadAllPortfolios() {
    state.activePortfolioId = ALL_KEY;
    state.activePortfolio = null;

    // preload all details
    const nameMap = {};
    state.portfolios.forEach(p => nameMap[p.portfolio_id] = p.name);

    const ids = state.portfolios.map(p => p.portfolio_id);
    const details = await Promise.all(ids.map(id => getPortfolioDetailCached(id)));

    state.allCombined = combineAll(details, nameMap);
    pfRenderDashboard();
  }

  async function loadPortfolioDetail(pfId) {
    state.activePortfolioId = pfId;
    const detail = await getPortfolioDetailCached(pfId);
    if (detail) {
      state.activePortfolio = detail;
      pfRenderDashboard();
    } else {
      pfRenderCreate();
    }
  }

  async function refreshData() {
    document.getElementById('mainPanel').innerHTML = `<div class="loader-wrap"><div class="spinner"></div><p>Veriler Yükleniyor...</p></div>`;
    const res = await api('portfolio-list', { user: state.user.id });

    if(res.status === "success") {
      state.portfolios = res.response.portfolios || [];
      state.cashBalance = res.response.cash_balance || 0;

      if (state.portfolios.length === 0) {
        pfRenderCreate();
        return;
      }

      // If active not set, default first portfolio
      if (!state.activePortfolioId) state.activePortfolioId = state.portfolios[0].portfolio_id;

      if (state.activePortfolioId === ALL_KEY) {
        await loadAllPortfolios();
      } else {
        // ensure it still exists
        const exists = state.portfolios.some(p => p.portfolio_id === state.activePortfolioId);
        const targetId = exists ? state.activePortfolioId : state.portfolios[0].portfolio_id;
        await loadPortfolioDetail(targetId);
      }
    } else {
      pfRenderCreate();
    }
  }

  function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const saved = localStorage.getItem('finapsis_real_user');

    if (code) {
      fetch(`${API_BASE}/google-auth-callback/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code })
      })
      .then(res => res.json())
      .then(data => {
        if (data.status === "success" || data.status === "ok") {
          const userData = { user: { id: data.user.id, name: data.user.name || "Google User" }, token: data.token };
          localStorage.setItem('finapsis_real_user', JSON.stringify(userData));
          try { localStorage.setItem('finapsis_active_main_tab', 'portfolio.html'); } catch(e) {}
          state.user = userData.user; state.token = userData.token;
          window.history.replaceState({}, document.title, window.location.pathname);
          refreshData();
        } else {
          alert("Hata: " + data.message);
          pfRenderAuth();
        }
      }).catch(() => pfRenderAuth());
    } else if (BUBBLE_USER_ID) {
      state.user = { id: BUBBLE_USER_ID, name: BUBBLE_USER_NAME || "User" };
      if(BUBBLE_API_TOKEN) state.token = BUBBLE_API_TOKEN;
      refreshData();
    } else if (saved) {
      const parsed = JSON.parse(saved);
      state.user = parsed.user; state.token = parsed.token;
      refreshData();
    } else {
      pfRenderAuth();
    }

    // ilk açılışta bir kez çek
pfRefreshPricesFromProxy();

// 15 dakikada bir yenile (tab görünmüyorken çalıştırma)
setInterval(() => {
  if (document.visibilityState === "hidden") return;
  pfRefreshPricesFromProxy();
}, 15 * 60 * 1000);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") pfRefreshPricesFromProxy();
});


  }

  function pfNormSector(s){
  const v = String(s || "").trim();
  return v ? v : "Diğer";
}
function pfCanSectorFilter(){
  return state.activeGroup === "bist" || state.activeGroup === "sp";
}

window.pfBuildSectorList = function(){
  const list = document.getElementById("pfSectorList");
  const btn  = document.getElementById("pfSectorBtn");
  if (!list || !btn) return;

  // sadece bist/sp için aktif
  if (!pfCanSectorFilter()){
    btn.classList.add("disabled");
    btn.classList.remove("active");
    list.innerHTML = `<div style="padding:12px;color:#777;font-size:12px;">Bu grupta sektör filtresi yok.</div>`;
    return;
  }

  btn.classList.remove("disabled");
  const comps = (window.companies || []).filter(c => c.group === state.activeGroup);
  const sectors = Array.from(new Set(comps.map(c => pfNormSector(c.sector)))).sort((a,b)=>a.localeCompare(b,"tr"));

  const cur = state.sectorFilter || "";
  let html = `<div class="pf-sector-item ${cur==="" ? "active":""}" data-sec="">Tüm Sektörler</div>`;
  html += sectors.map(s => {
    const on = (s === cur) ? "active" : "";
    return `<div class="pf-sector-item ${on}" data-sec="${s.replace(/"/g,'&quot;')}">${s}</div>`;
  }).join("");

  list.innerHTML = html;

  // buton highlight
  if (cur) btn.classList.add("active");
  else btn.classList.remove("active");
};
// ✅ YENİ EKLENEN: Sektör listesi içinde arama yapma fonksiyonu
window.pfFilterSectorList = function(term){
  const t = String(term || "").toLocaleLowerCase('tr'); // Türkçe karakter uyumlu küçük harf
  const items = document.querySelectorAll("#pfSectorList .pf-sector-item");
  
  items.forEach(el => {
    const secName = el.textContent.toLocaleLowerCase('tr');
    const isAllOption = el.getAttribute("data-sec") === ""; // "Tüm Sektörler" seçeneği
    
    // "Tüm Sektörler" her zaman görünsün veya arama terimi içeriyorsa göster
    if (isAllOption || secName.includes(t)) {
      el.style.display = "block";
    } else {
      el.style.display = "none";
    }
  });
};

window.pfToggleSectorPopup = function(e){
  if (e) e.stopPropagation();
  try { window.finEnsureCompanies && window.finEnsureCompanies(); } catch(_){}

  const pop = document.getElementById("pfSectorPopup");
  if (!pop) return;

  
  // listeyi her açılışta güncelle
  pfBuildSectorList();

  // ✅ YENİ EKLENEN: Popup açılırken arama kutusunu temizle
  const inp = document.getElementById("pfSectorSearchInput");
  if(inp) { 
      inp.value = ""; 
      if(window.pfFilterSectorList) window.pfFilterSectorList(""); 
  }

  const open = (pop.style.display === "block");
  pop.style.display = open ? "none" : "block";
};

window.pfCloseSectorPopup = function(e){
  if (e) e.stopPropagation();
  const pop = document.getElementById("pfSectorPopup");
  if (pop) pop.style.display = "none";
};

window.pfClearSectorFilter = function(e){
  if (e) e.stopPropagation();
  state.sectorFilter = "";
  pfBuildSectorList();
  pfRenderMarketList();
};

// seçenek tıklama
document.addEventListener("click", (e) => {
  const pop = document.getElementById("pfSectorPopup");
  if (!pop || pop.style.display !== "block") return;

  // popup içindeki item seçimi
  const item = e.target.closest("#pfSectorList .pf-sector-item");
  if (item) {
    const sec = item.getAttribute("data-sec") || "";
    state.sectorFilter = sec;
    pfBuildSectorList();
    pfRenderMarketList();
    pop.style.display = "none";
    return;
  }

  // popup dışına tıklanınca kapat
  const within = e.target.closest("#pfSearchBox");
  if (!within) pop.style.display = "none";
});

  window.pfSetGroup = function(g, el) {
  state.activeGroup = g;

  // ✅ grup değişince sektör filtresi reset
  state.sectorFilter = "";
  try { pfBuildSectorList(); } catch(e){}

  document.querySelectorAll('.cat-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  pfRenderMarketList();
};


  window.pfRenderMarketList = function() {
    try { window.finEnsureCompanies && window.finEnsureCompanies(); } catch(e){}
    const term = document.getElementById('searchInput')?.value.toLowerCase() || "";
    const list = document.getElementById('marketList');
    const sector = state.sectorFilter || "";

const filtered = (window.companies || []).filter(c => {
  if (c.group !== state.activeGroup) return false;

  // ✅ sektör filtresi sadece bist/sp
  if (pfCanSectorFilter() && sector) {
    if (pfNormSector(c.sector) !== sector) return false;
  }

  return (c.ticker.toLowerCase().includes(term) || c.name.toLowerCase().includes(term));
});

    list.innerHTML = filtered.map(c => {
      const cur = prices[c.ticker] || 0; const prev = prevPrices[c.ticker] || cur;
      let change = 0; if (prev > 0) change = ((cur - prev) / prev) * 100;
      const color = change >= 0 ? 'text-green' : 'text-red';
      const sign = change > 0 ? '+' : '';
      const sym = getSym(c.ticker);
      return `<div class="market-item" onclick="pfOpenTradeModal('${c.ticker}')">
        <img src="${c.logourl}" class="ticker-logo" onerror="this.style.display='none'">
        <div style="flex:1;">
          <span class="ticker-symbol">${c.ticker}</span>
          <span class="ticker-name">${c.name}</span>
        </div>
        <div style="text-align:right;">
          <span class="price-val">${sym}${cur.toFixed(2)}</span>
          <span class="price-change ${color}">${sign}${change.toFixed(2)}%</span>
        </div>
        <button class="fp-menu-btn"
  title="İşlemler"
  onclick="event.stopPropagation(); fpOpenRowMenu('${c.ticker}', event)">
  <i class="fa-solid fa-ellipsis-vertical"></i>
</button>

      </div>`;
    }).join('');
  };

  function getActiveData() {
    // returns {positions, transactions, portfolioObjForHeader?}
    if (state.activePortfolioId === ALL_KEY) {
      const d = state.allCombined || { positions: [], transactions: [] };
      return { positions: d.positions || [], transactions: d.transactions || [], isAll: true };
    }
    const p = state.activePortfolio || { positions: [], transactions: [] };
    return { positions: p.positions || [], transactions: p.transactions || [], isAll: false, portfolio: p.portfolio };
  }
window.pfHasPosition = function(ticker){
  try{
    const t = String(ticker||"").toUpperCase();
    const data = getActiveData(); // IIFE içindeki fonksiyon
    const pos = (data.positions || []).find(p => String(p.ticker||"").toUpperCase() === t);
    return !!pos && (Number(pos.quantity) || 0) > 0;
  } catch(e){
    return false;
  }
};

  // --- DASHBOARD ---
  window.pfRenderDashboard = function() {
    if (!state.user) { pfRenderAuth(); return; }
    if (state.portfolios.length === 0) { pfRenderCreate(); return; }

    const data = getActiveData();
    const positions = (data.positions || []).filter(p => (Number(p.quantity) || 0) > 0);
    const transactions = data.transactions || [];
    const cash = state.cashBalance;
    const usdRate = prices['USDTRY'] || 1;

    let stockValTRY = 0, totalCostTRY = 0, dayGainTRY = 0;

    positions.forEach(pos => {
      const curPrice = prices[pos.ticker] || pos.avg_cost;
      const prevPrice = prevPrices[pos.ticker] || curPrice;
      const isU = isUSD(pos.ticker);

      const mVal = curPrice * pos.quantity;
      const costVal = pos.avg_cost * pos.quantity;
      const prevMVal = prevPrice * pos.quantity;

      const mValTRY = isU ? mVal * usdRate : mVal;
      const costValTRY = isU ? costVal * usdRate : costVal;
      const prevMValTRY = isU ? prevMVal * usdRate : prevMVal;

      stockValTRY += mValTRY;
      totalCostTRY += costValTRY;
      dayGainTRY += (mValTRY - prevMValTRY);
    });

    const totalEquity = cash + stockValTRY;
    const totalPnl = stockValTRY - totalCostTRY;
    const totalPnlPerc = totalCostTRY > 0 ? (totalPnl/totalCostTRY)*100 : 0;

    // asset rows (all mode: clicking should open trade modal but sell will require portfolio selection)
    const assetRows = positions.map(pos => {
      const sym = getSym(pos.ticker);
      const isU = isUSD(pos.ticker);
      const cur = prices[pos.ticker] || pos.avg_cost;
      const item = getItem(pos.ticker) || {};
const nm = item.name || "";

      const totalVal = cur * pos.quantity;
      const totalValTRY = isU ? totalVal * usdRate : totalVal;

      const pnl = (cur * pos.quantity) - (pos.avg_cost * pos.quantity);
      const pnlPerc = (pnl / (pos.avg_cost * pos.quantity)) * 100;
      const color = pnl >= 0 ? 'text-green' : 'text-red';

      // in ALL mode, force open with buy (sell requires choosing portfolio)
      const clickSide = (state.activePortfolioId === ALL_KEY) ? 'buy' : 'sell';

      return `
      <tr onclick="pfOpenTradeModal('${pos.ticker}', '${clickSide}')">
        <td>
  <div class="table-ticker">
    <div style="width:6px; height:6px; border-radius:50%; background:${color==='text-green'?'var(--success)':'var(--danger)'}"></div>

    <div class="asset-id">
      <div class="asset-ticker">${pos.ticker}</div>
      <div class="asset-name">${nm || pos.ticker}</div>
    </div>

    <!-- ✅ Tarihçe ikonu (row click'i bozmasın) -->
    <button class="pf-hist-btn" title="Tarihçe"
      onclick="event.stopPropagation(); pfOpenHistoryModal('${pos.ticker}')">
      <i class="fa-solid fa-clock-rotate-left"></i>
    </button>
  </div>
</td>
        <td>${pos.quantity}</td>
        <td>${sym}${pos.avg_cost.toFixed(2)}</td>
        <td>${sym}${cur.toFixed(2)}</td>
        <td>${sym}${totalVal.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:0})}</td>
        <td>₺${totalValTRY.toLocaleString('tr-TR', {minimumFractionDigits:0, maximumFractionDigits:0})}</td>
        <td style="text-align:right;" class="${color}">${pnl>=0?'+':''}${sym}${pnl.toFixed(0)} (%${pnlPerc.toFixed(1)})</td>
      </tr>`;
    }).join('');

    // transactions rows: ALL mode show pf name in date column
    const sortedTrans = transactions.slice().sort((a,b) => new Date(b.executed_at) - new Date(a.executed_at));
    const transRows = sortedTrans.map(tx => {
      const sideStr = (tx.side || "").toString().toLowerCase().trim();
      let isBuy = true;
      if(sideStr === 'sell') isBuy = false;
      else if(tx.quantity < 0) isBuy = false;
      else if(sideStr === 'buy') isBuy = true;

      const color = isBuy ? 'text-green' : 'text-red';
      const type = isBuy ? 'ALIM' : 'SATIM';

      const dateBase = new Date(tx.executed_at).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
      const date = (state.activePortfolioId === ALL_KEY && tx.__pf_name) ? `${dateBase} · ${tx.__pf_name}` : dateBase;

      const sym = getSym(tx.ticker);
      const isU = isUSD(tx.ticker);

      const total = Math.abs(tx.quantity * tx.price);
      const totalTRY = isU ? total * usdRate : total;

      return `
      <tr>
        <td><span style="font-weight:700; color:#fff;">${tx.ticker}</span></td>
        <td><span class="${color}" style="font-weight:600; font-size:11px; border:1px solid; padding:2px 6px; border-radius:4px;">${type}</span></td>
        <td>${Math.abs(tx.quantity)}</td>
        <td>${sym}${tx.price.toFixed(2)}</td>
        <td>${sym}${total.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        <td>₺${totalTRY.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        <td>${date}</td>
      </tr>`;
    }).join('');

    const pfOptions =
      `<option value="${ALL_KEY}" ${state.activePortfolioId===ALL_KEY?'selected':''}>TÜMÜ</option>` +
      state.portfolios.map(port => `<option value="${port.portfolio_id}" ${port.portfolio_id === state.activePortfolioId ? 'selected' : ''}>${port.name}</option>`).join('');

    const showAssets = state.activeTab === 'assets';
    const headerTitle = (state.activePortfolioId === ALL_KEY) ? "Portföy Özeti (Tümü)" : "Portföy Özeti";

    document.getElementById('mainPanel').innerHTML = `
      <div class="dash-header">
        <div>
          <h2 style="margin:0; font-size:24px;">${headerTitle}</h2>
          <span style="color:#666; font-size:12px;">Hoş geldin, ${state.user.name}</span>
        </div>

        <div style="display:flex; gap:10px; align-items:center;">
          <select class="portfolio-select" onchange="pfSwitchPortfolio(this.value)">${pfOptions}</select>

          <div class="settings-wrap">
  <button class="portfolio-select settings-btn" style="width:auto; background:#222;" onclick="pfToggleSettingsMenu(event)">
    <i class="fa-solid fa-gear"></i>
  </button>
  <div id="settingsMenu" class="settings-menu">
    <div class="settings-item" onclick="pfOpenTransferModal(); pfCloseSettingsMenu();">
      <i class="fa-solid fa-right-left"></i> Virman
    </div>
    <div class="settings-item" onclick="pfRenderCreate(); pfCloseSettingsMenu();">
      <i class="fa-solid fa-plus"></i> Yeni Portföy
    </div>
    <div class="settings-item danger" onclick="pfLogout(); pfCloseSettingsMenu();">
      <i class="fa-solid fa-power-off"></i> Çıkış
    </div>
  </div>
</div>

        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card primary">
          <span class="stat-label">Toplam Varlık (TL)</span>
          <span class="stat-val">₺${totalEquity.toLocaleString('tr-TR', {minimumFractionDigits:0, maximumFractionDigits:0})}</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Günlük Değişim</span>
          <span class="stat-val ${dayGainTRY>=0?'text-green':'text-red'}">${dayGainTRY>=0?'+':''}₺${Math.abs(dayGainTRY).toLocaleString('tr-TR', {maximumFractionDigits:0})}</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Kar/Zarar</span>
          <span class="stat-val ${totalPnl>=0?'text-green':'text-red'}">${totalPnl>=0?'+':''}₺${Math.abs(totalPnl).toLocaleString('tr-TR', {maximumFractionDigits:0})}</span>
          <span class="stat-sub ${totalPnl>=0?'text-green':'text-red'}">%${Math.abs(totalPnlPerc).toFixed(2)}</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Nakit Bakiye</span>
          <span class="stat-val">₺${cash.toLocaleString('tr-TR', {maximumFractionDigits:0})}</span>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-box">
          <div class="chart-title">Varlık Dağılımı</div>
          <div class="chart-wrapper"><canvas id="chartAllocation"></canvas></div>
        </div>
        <div class="chart-box">
          <div class="chart-title">Kar/Zarar Analizi</div>
          <div class="chart-wrapper"><canvas id="chartPnL"></canvas></div>
        </div>
      </div>

      <div class="tab-header">
        <div class="tab-btn ${showAssets?'active':''}" onclick="pfSetTab('assets')">Varlıklarım</div>
        <div class="tab-btn ${!showAssets?'active':''}" onclick="pfSetTab('transactions')">Geçmiş İşlemler</div>
      </div>

      <div class="asset-table-wrap">
        <table class="asset-table" style="display:${showAssets?'table':'none'}">
          <thead>
            <tr>
              <th>HİSSE</th><th>ADET</th><th>MALİYET</th><th>FİYAT</th><th>TOPLAM</th><th>TOPLAM (TL)</th><th style="text-align:right;">K/Z</th>
            </tr>
          </thead>
          <tbody>${assetRows || '<tr><td colspan="7" style="text-align:center; padding:30px; color:#555;">Henüz varlığınız bulunmuyor.</td></tr>'}</tbody>
        </table>

        <table class="asset-table" style="display:${!showAssets?'table':'none'}">
          <thead>
            <tr>
              <th>ENSTRÜMAN</th><th>İŞLEM</th><th>ADET</th><th>FİYAT</th><th>TOPLAM</th><th>TOPLAM (TL)</th><th>TARİH</th>
            </tr>
          </thead>
          <tbody>${transRows || '<tr><td colspan="7" style="text-align:center; padding:30px; color:#555;">İşlem geçmişi boş.</td></tr>'}</tbody>
        </table>
      </div>
    `;

    setTimeout(() => initCharts(positions, cash, usdRate), 100);
    if (window.pfFinapsisResize) setTimeout(window.pfFinapsisResize, 50);

  };

  // --- CREATE SCREEN ---
  window.pfRenderCreate = function() {
    const isFirst = state.portfolios.length === 0;
    const cancelBtn = isFirst ? '' : `<button class="btn" style="width:100%; background:#222; color:#fff; margin-top:10px;" onclick="pfRenderDashboard()">İptal</button>`;
    const title = isFirst ? "Hoş Geldiniz!" : "Yeni Portföy";
    const msg = isFirst ? "Başlamak için ilk portföyünüzü oluşturun." : "Portföyünü isimlendir.";
    document.getElementById('mainPanel').innerHTML = `
      <div class="center-card">
        <h2>${title}</h2>
        <p style="color:#888; margin-bottom:30px;">${msg}</p>
        <input type="text" id="pfName" class="form-input" placeholder="Örn: Temettü Portföyü">
        <button class="btn btn-primary" style="width:100%;" onclick="pfCreatePfAction()">Oluştur</button>
        ${cancelBtn}
      </div>`;
  };
  window.pfToggleSettingsMenu = function(e){
  if(e) e.stopPropagation();
  const m = document.getElementById('settingsMenu');
  if(!m) return;
  m.classList.toggle('show');
};

window.pfCloseSettingsMenu = function(){
  const m = document.getElementById('settingsMenu');
  if(m) m.classList.remove('show');
};

// sayfada herhangi yere tıklayınca kapat
document.addEventListener('click', function(){
  window.pfCloseSettingsMenu();
});


  // --- AUTH RENDER & ACTIONS ---
  window.pfToggleAuthMode = function() { state.isLogin = !state.isLogin; pfRenderAuth(); };
  window.pfRenderAuth = function() {
    document.getElementById('mainPanel').innerHTML = `
      <div class="center-card">
        <h2>Finapsis Pro</h2>
        <p style="color:var(--text-muted); font-size:14px; margin-bottom:40px;">Profesyonel portföy yönetimi.</p>
        ${!state.isLogin ? `<input type="text" id="nameInput" class="form-input" placeholder="Ad Soyad">` : ''}
        <input type="email" id="emailInput" class="form-input" placeholder="E-posta adresi">
        <input type="password" id="passInput" class="form-input" placeholder="Şifre">
        <button class="btn btn-primary" style="width:100%;" onclick="pfAuthAction()">${state.isLogin ? 'Giriş Yap' : 'Hesap Oluştur'}</button>
        <button class="btn btn-google" onclick="pfGoogleLogin()">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18"> Google ile Devam Et
        </button>
        <div style="margin-top:25px; font-size:13px; color:#666; cursor:pointer;" onclick="pfToggleAuthMode()">
          ${state.isLogin ? 'Hesabın yok mu? Kayıt Ol' : 'Giriş Yap'}
        </div>
      </div>`;
  };

  window.pfSetTab = function(t) { state.activeTab = t; pfRenderDashboard(); };

  // --- PORTFOLIO SWITCH (including ALL) ---
  window.pfSwitchPortfolio = async function(id) {
    if (id === ALL_KEY) {
      document.getElementById('mainPanel').innerHTML = `<div class="loader-wrap"><div class="spinner"></div><p>Portföyler Birleştiriliyor...</p></div>`;
      await loadAllPortfolios();
    } else {
      document.getElementById('mainPanel').innerHTML = `<div class="loader-wrap"><div class="spinner"></div><p>Portföy Yükleniyor...</p></div>`;
      await loadPortfolioDetail(id);
    }
  };

  // --- TRADE FLOW ---
  window.pfUserClickSide = function(s) {
    const t = state.trade.ticker;

    // determine available qty from selected portfolio
    const pfId = state.trade.portfolioId;
    let pos = null;
    if (state.activePortfolioId === ALL_KEY) {
      const d = state.portfolioCache[pfId];
      pos = d?.positions?.find(p => p.ticker === t);
    } else {
      pos = state.activePortfolio?.positions?.find(p => p.ticker === t);
    }

    if (s === 'sell' && (!pos || pos.quantity <= 0)) return;
    pfSetSide(s);
  };

  window.pfSetTradePortfolio = function(pfId) {
    state.trade.portfolioId = pfId;
    pfUpdateModalLimit();
    // if sell tab is currently selected but user has 0, force buy
    const t = state.trade.ticker;
    const d = state.portfolioCache[pfId];
    const pos = d?.positions?.find(p => p.ticker === t);
    if (state.trade.side === 'sell' && (!pos || pos.quantity <= 0)) {
      pfSetSide('buy');
    } else {
      // update sell tab availability visuals
      const tSell = document.getElementById('tabSell');
      if (tSell) {
        if (!pos || pos.quantity <= 0) { tSell.style.opacity = '0.3'; tSell.style.cursor = 'not-allowed'; }
        else { tSell.style.opacity = '1'; tSell.style.cursor = 'pointer'; }
      }
    }
  };

  window.pfSetInputMode = function(mode) {
    state.trade.inputMode = mode;

    const mq = document.getElementById('modeQty');
    const ma = document.getElementById('modeAmt');

    if (mq && ma) {
      if (mode === 'qty') {
        mq.style.background = 'rgba(194,245,14,0.15)'; mq.style.color = '#fff';
        ma.style.background = 'transparent'; ma.style.color = '#666';
      } else {
        ma.style.background = 'rgba(194,245,14,0.15)'; ma.style.color = '#fff';
        mq.style.background = 'transparent'; mq.style.color = '#666';
      }
    }

    const input = document.getElementById('tradeQty');
    if (input) input.value = '';
    document.getElementById('tradeTotal').innerText = '0.00';
    document.getElementById('tradeTotalTry').innerText = '';
    const hint = document.getElementById('tradeHint');
    if (hint) hint.innerText = '';

    const btn = document.getElementById('btnConfirmTrade');
    if (btn) btn.disabled = true;

    setTradePlaceholder();
    pfUpdateModalLimit();
  };

  window.pfOpenTradeModal = async function(t, s='buy') {
    if(!state.user) { pfRenderAuth(); return; }

    state.trade.ticker = t;

    const item = getItem(t);
    const sym = getSym(t);

    document.getElementById('tradeModal').style.display = 'flex';
    document.getElementById('modalTicker').innerText = t;
    document.getElementById('modalPrice').innerText = `${sym}${(prices[t]||0).toFixed(2)}`;
    document.getElementById('modalImg').src = item ? item.logourl : '';

    const pfSelect = document.getElementById('modalPortfolioSelect');

    if (state.activePortfolioId === ALL_KEY) {
      // show portfolio selector
      pfSelect.style.display = 'block';
      pfSelect.innerHTML = state.portfolios.map(p => `<option value="${p.portfolio_id}">${p.name}</option>`).join('');

      // default to first portfolio
      const defaultPfId = state.portfolios[0]?.portfolio_id;
      state.trade.portfolioId = defaultPfId;
      pfSelect.value = defaultPfId;

      // ensure cached detail
      await getPortfolioDetailCached(defaultPfId);

      // set sell availability based on selected pf
      const d = state.portfolioCache[defaultPfId];
      const pos = d?.positions?.find(p => p.ticker === t);
      const qtyOwned = pos ? pos.quantity : 0;
      const tSell = document.getElementById('tabSell');
      if(qtyOwned <= 0) {
        tSell.style.opacity = '0.3'; tSell.style.cursor = 'not-allowed';
        if(s==='sell') s='buy';
      } else {
        tSell.style.opacity = '1'; tSell.style.cursor = 'pointer';
      }
    } else {
      // single portfolio mode
      pfSelect.style.display = 'none';
      state.trade.portfolioId = state.activePortfolio?.portfolio?.portfolio_id;

      const pos = state.activePortfolio?.positions?.find(p => p.ticker === t);
      const qtyOwned = pos ? pos.quantity : 0;
      const tSell = document.getElementById('tabSell');
      if(qtyOwned <= 0) {
        tSell.style.opacity = '0.3'; tSell.style.cursor = 'not-allowed';
        if(s==='sell') s='buy';
      } else {
        tSell.style.opacity = '1'; tSell.style.cursor = 'pointer';
      }
    }

    const defMode = getDefaultInputMode(t);
    pfSetInputMode(defMode);
    pfSetSide(s);
    if (window.pfFinapsisResize) setTimeout(window.pfFinapsisResize, 50);

  };

  window.pfSetSide = function(s) {
    state.trade.side = s;
    const tb = document.getElementById('tabBuy'),
          ts = document.getElementById('tabSell'),
          btn = document.getElementById('btnConfirmTrade');

    if(s === 'buy') {
      tb.style.background = 'var(--success)'; tb.style.color = '#000';
      ts.style.background = 'transparent'; ts.style.color = '#666';
      btn.style.background = 'var(--primary)'; btn.innerText = 'ALIŞ EMRİ GÖNDER';
    } else {
      tb.style.background = 'transparent'; tb.style.color = '#666';
      ts.style.background = 'var(--danger)'; ts.style.color = '#fff';
      btn.style.background = 'var(--danger)'; btn.innerText = 'SATIŞ EMRİ GÖNDER';
    }

    document.getElementById('tradeQty').value = '';
    document.getElementById('tradeTotal').innerText = '0.00';
    document.getElementById('tradeTotalTry').innerText = '';
    const hint = document.getElementById('tradeHint');
    if (hint) hint.innerText = '';
    btn.disabled = true;

    pfUpdateModalLimit();
    setTradePlaceholder();
  };

  window.pfUpdateModalLimit = function() {
    const t = state.trade.ticker;
    const pfId = state.trade.portfolioId;

    if(state.trade.side === 'buy') {
      document.getElementById('modalLimit').innerText = `Nakit: ₺${state.cashBalance.toLocaleString('tr-TR')}`;
    } else {
      let pos = null;
      if (state.activePortfolioId === ALL_KEY) {
        const d = state.portfolioCache[pfId];
        pos = d?.positions?.find(p => p.ticker === t);
      } else {
        pos = state.activePortfolio?.positions?.find(p => p.ticker === t);
      }
      document.getElementById('modalLimit').innerText = `Eldeki: ${pos?pos.quantity:0}`;
    }
  };

  window.pfCalcTotal = function() {
    const raw = parseFloat(document.getElementById('tradeQty').value);
    const t = state.trade.ticker;
    const price = prices[t] || 0;
    const sym = getSym(t);
    const isU = isUSD(t);
    const usdRate = prices['USDTRY'] || 1;

    const el = document.getElementById('tradeTotal');
    const elTry = document.getElementById('tradeTotalTry');
    const hint = document.getElementById('tradeHint');
    const btn = document.getElementById('btnConfirmTrade');

    if (!raw || raw <= 0 || price <= 0) {
      el.innerText = '0.00';
      elTry.innerText = '';
      if (hint) hint.innerText = '';
      btn.disabled = true;
      el.style.color = '#888';
      return;
    }

    let qty = 0;
    let totalAssetCur = 0;

    if (state.trade.inputMode === 'amount') {
      totalAssetCur = raw;
      qty = totalAssetCur / price;
    } else {
      qty = raw;
      totalAssetCur = qty * price;
    }

    const totalTRY = isU ? totalAssetCur * usdRate : totalAssetCur;

    el.innerText = `${sym}${totalAssetCur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (isU && totalAssetCur > 0) elTry.innerText = `≈ ₺${totalTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    else elTry.innerText = '';

    if (hint) {
      if (state.trade.inputMode === 'amount') {
        const unit = getQtyUnitLabel(t);
        hint.innerText = `≈ ${qty.toLocaleString('tr-TR', { maximumFractionDigits: 6 })} ${unit}`.trim();
      } else {
        hint.innerText = '';
      }
    }

    let ok = false;

    if (state.trade.side === 'buy') {
      if (totalTRY > state.cashBalance) {
        el.style.color = 'var(--danger)';
        ok = false;
      } else {
        el.style.color = '#fff';
        ok = true;
      }
    } else {
      const pfId = state.trade.portfolioId;
      let pos = null;

      if (state.activePortfolioId === ALL_KEY) {
        const d = state.portfolioCache[pfId];
        pos = d?.positions?.find(p => p.ticker === t);
      } else {
        pos = state.activePortfolio?.positions?.find(p => p.ticker === t);
      }

      const maxQty = pos ? pos.quantity : 0;
      if (qty > maxQty) {
        el.style.color = 'var(--danger)';
        ok = false;
      } else {
        el.style.color = '#fff';
        ok = true;
      }
    }

    btn.disabled = !ok;
  };

  window.pfSubmitTrade = async function() {
    const raw = parseFloat(document.getElementById('tradeQty').value);
    const btn = document.getElementById('btnConfirmTrade');
    const side = state.trade.side;
    const ticker = state.trade.ticker;
    const portfolioId = state.trade.portfolioId;

    const price = prices[ticker] || 0;
    if (!raw || raw <= 0 || price <= 0) { alert("Geçersiz giriş."); return; }

    const qty = (state.trade.inputMode === 'amount') ? (raw / price) : raw;

    const isU = isUSD(ticker);
    const usdRate = prices['USDTRY'] || 1;
    const currency = isU ? "USD" : "TRY";
    const rate = isU ? usdRate : 1;
    const tryPrice = price * rate;

    btn.innerText = "İŞLENİYOR...";
    btn.disabled = true;

    const payload = {
      portfolio: portfolioId,
      ticker: ticker,
      price: price,
      quantity: qty,
      side: side,
      m: side === 'buy' ? 1 : -1,
      currency: currency,
      rate: rate,
      TRY_price: tryPrice
    };

    const res = await api('transaction-single', payload);

    if(res.status === "success") {
      if(res.response.cash_balance !== undefined) state.cashBalance = res.response.cash_balance;

      // refresh cache for affected portfolio
      state.portfolioCache[portfolioId] = null;
      delete state.portfolioCache[portfolioId];
      await getPortfolioDetailCached(portfolioId);

      // refresh view
      if (state.activePortfolioId === ALL_KEY) await loadAllPortfolios();
      else await loadPortfolioDetail(portfolioId);

      pfCloseTradeModal();
    } else {
      alert(res.message || "İşlem hatası.");
      btn.innerText = side === 'buy' ? 'ALIŞ EMRİ GÖNDER' : 'SATIŞ EMRİ GÖNDER';
      btn.disabled = false;
    }
  };

  window.pfCloseTradeModal = function() { document.getElementById('tradeModal').style.display = 'none'; if (window.pfFinapsisResize) setTimeout(window.pfFinapsisResize, 50);
};
// =====================
// PORTFOLIO HISTORY CHART
// =====================
let __pfHistChart = null;
const __pfHistCache = Object.create(null);

function pfIsBuyTx(tx){
  const side = String(tx?.side || "").toLowerCase().trim();
  if (side === "buy") return true;
  if (side === "sell") return false;
  return (Number(tx?.quantity) || 0) > 0;
}

function pfParseDateAny(s){
  if (!s) return null;
  // varsa mevcut helper'ını kullan
  try { if (typeof parseMMDDYYYY === "function") { const d = parseMMDDYYYY(s); if (d) return d; } } catch(e){}
  const d2 = new Date(s);
  if (!isNaN(d2)) return d2;
  return null;
}

function pfSafeNum(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pfFirstBuyDateForTicker(ticker){
  try{
    const t = String(ticker||"").toUpperCase();
    const data = getActiveData();
    const txs = Array.isArray(data?.transactions) ? data.transactions : [];
    const buys = txs.filter(tx => String(tx?.ticker||"").toUpperCase() === t && pfIsBuyTx(tx));
    if (!buys.length) return null;
    let min = null;
    for (const tx of buys){
      const d = pfParseDateAny(tx.executed_at);
      if (!d) continue;
      if (!min || d < min) min = d;
    }
    return min; // Date
  } catch(e){
    return null;
  }
}

async function pfGetPriceHistory(ticker){
  const t = String(ticker||"").toUpperCase();
  if (__pfHistCache[t]) return __pfHistCache[t];

  // ✅ En pratik: mevcut comdetail endpoint'inden price_history al
  const fn = window.fetchComDetail;
if (typeof fn !== "function") throw new Error("fetchComDetail not available");
const d = await fn(t);

  const ph = Array.isArray(d?.price_history) ? d.price_history : [];
  __pfHistCache[t] = ph;
  return ph;
}

window.pfCloseHistoryModal = function(){
  const m = document.getElementById("pfHistModal");
  if (m) m.style.display = "none";
  const l = document.getElementById("pfHistLoading");
  if (l) l.innerText = "";
  if (__pfHistChart) { try { __pfHistChart.destroy(); } catch(e){} __pfHistChart = null; }
};

window.pfOpenHistoryModal = async function(ticker){
  const t = String(ticker||"").toUpperCase().trim();
  if (!t) return;

  const m = document.getElementById("pfHistModal");
  const titleEl = document.getElementById("pfHistTitle");
  const subEl = document.getElementById("pfHistSub");
  const loadingEl = document.getElementById("pfHistLoading");
  const canvas = document.getElementById("pfHistCanvas");

  if (!m || !titleEl || !subEl || !loadingEl || !canvas) return;

  m.style.display = "flex";
  titleEl.innerText = `${t} • Tarihçe`;
  loadingEl.innerText = "Yükleniyor...";
  subEl.innerText = "";

  // ilk alım tarihi
  const buyDate = pfFirstBuyDateForTicker(t);
  const buyText = buyDate ? buyDate.toLocaleDateString("tr-TR") : "bilinmiyor";

  try{
    const hist = await pfGetPriceHistory(t);

    // normalize: {date, price}
    const pts = (hist || [])
      .map(p => {
        const d = pfParseDateAny(p?.date);
        const price = pfSafeNum(p?.price);
        return { d, price };
      })
      .filter(x => x.d && x.price !== null)
      .sort((a,b) => a.d - b.d);

    // satın alma tarihinden itibaren filtrele
    const filtered = buyDate ? pts.filter(x => x.d >= buyDate) : pts;
    subEl.innerText = `İlk alım: ${buyText} • Nokta: ${filtered.length}`;

    if (!filtered.length){
      loadingEl.innerText = "Bu varlık için yeterli fiyat verisi bulunamadı.";
      return;
    }

    // chart hazırlık
    const labels = filtered.map(x => x.d.toLocaleDateString("tr-TR", { day:"2-digit", month:"2-digit", year:"2-digit" }));
    const data = filtered.map(x => x.price);

    if (__pfHistChart) { try { __pfHistChart.destroy(); } catch(e){} __pfHistChart = null; }

    loadingEl.innerText = "";

    __pfHistChart = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: t,
          data,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.25,
          borderColor: "#c2f50e"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxTicksLimit: 8 }, grid: { display: false } },
          y: { ticks: { maxTicksLimit: 6 }, grid: { color: "rgba(255,255,255,0.06)" } }
        }
      }
    });

  } catch(err){
    loadingEl.innerText = "Tarihçe yüklenemedi.";
    subEl.innerText = `İlk alım: ${buyText}`;
    console.error(err);
  }
};


  // --- VIRMAN (TRANSFER) ---
  window.pfOpenTransferModal = async function() {
    if (!state.user) { pfRenderAuth(); return; }
    if (!state.portfolios || state.portfolios.length < 2) { alert("Virman için en az 2 portföy gerekir."); return; }

    document.getElementById('transferModal').style.display = 'flex';

    const fromSel = document.getElementById('trFrom');
    const toSel = document.getElementById('trTo');

    const options = state.portfolios.map(p => `<option value="${p.portfolio_id}">${p.name}</option>`).join('');
    fromSel.innerHTML = options;
    toSel.innerHTML = options;

    // default from: active if single else first
    const defFrom = (state.activePortfolioId && state.activePortfolioId !== ALL_KEY) ? state.activePortfolioId : state.portfolios[0].portfolio_id;
    fromSel.value = defFrom;

    // default to: first different
    const defTo = state.portfolios.find(p => p.portfolio_id !== defFrom)?.portfolio_id || state.portfolios[0].portfolio_id;
    toSel.value = defTo;

    document.getElementById('trQty').value = '';
    document.getElementById('btnConfirmTransfer').disabled = true;

