    await pfOnTransferFromChange(defFrom);
  };

  window.pfCloseTransferModal = function() {
    document.getElementById('transferModal').style.display = 'none';
  };

  // Portfolio cash helper (portföy bazlı varsa onu, yoksa user cash)
const getPortfolioCash = (pfId) => {
  const d = state.portfolioCache?.[pfId];
  return (typeof d?.cash_balance === "number") ? d.cash_balance : (state.cashBalance || 0);
};

const getDetailUrl = (ticker) => {
  const item = getItem(ticker) || (window.companies || []).find(c => c.ticker === ticker);
  if(!item) return null;

  const slug = (item.slug || ticker || "").toString().toLowerCase();
  const isCompany = (item.group === "bist" || item.group === "sp");
  const root = isCompany ? "https://finapsis.co/comdetail/" : "https://finapsis.co/itemdetail/";
  return root + encodeURIComponent(slug);
};


window.pfOnTransferFromChange = async function(fromId) {
  await getPortfolioDetailCached(fromId);

  const detail = state.portfolioCache[fromId] || {};
  const positions = (detail.positions || []).filter(p => (Number(p.quantity) || 0) > 0);

  const tickerSel = document.getElementById('trTicker');

  // Nakit opsiyonu (₺) en üste
  const cashOption = `<option value="__CASH__">Nakit (₺)</option>`;
  const posOptions = positions.length
    ? positions.map(p => `<option value="${p.ticker}">${p.ticker}</option>`).join('')
    : '';

  tickerSel.innerHTML = cashOption + posOptions;

  const qtyInput = document.getElementById('trQty');
  qtyInput.value = '';
  qtyInput.placeholder = "Tutar (₺) giriniz..."; // default nakit seçili

  pfUpdateTransferLimit();
  pfValidateTransfer();
};


  window.pfUpdateTransferLimit = function() {
  const fromId = document.getElementById('trFrom').value;
  const t = document.getElementById('trTicker').value;
  const qtyInput = document.getElementById('trQty');

  if (t === "__CASH__") {
    const maxCash = getPortfolioCash(fromId);
    document.getElementById('trLimit').innerText = `Eldeki: ₺${maxCash.toLocaleString('tr-TR')}`;
    qtyInput.placeholder = "Tutar (₺) giriniz...";
    return;
  }

  const d = state.portfolioCache[fromId];
  const pos = d?.positions?.find(p => p.ticker === t);
  const maxQty = pos ? pos.quantity : 0;

  document.getElementById('trLimit').innerText = `Eldeki: ${maxQty}`;
  qtyInput.placeholder = "Miktar giriniz...";
};


  window.pfValidateTransfer = function() {
  const btn = document.getElementById('btnConfirmTransfer');

  const fromId = document.getElementById('trFrom').value;
  const toId = document.getElementById('trTo').value;
  const t = document.getElementById('trTicker').value;
  const qty = parseFloat(document.getElementById('trQty').value);

  if (!fromId || !toId || !t || !qty || qty <= 0) { btn.disabled = true; return; }
  if (fromId === toId) { btn.disabled = true; return; }

  if (t === "__CASH__") {
    const maxCash = getPortfolioCash(fromId);
    btn.disabled = !(qty <= maxCash);
    return;
  }

  const d = state.portfolioCache[fromId];
  const pos = d?.positions?.find(p => p.ticker === t);
  const maxQty = pos ? pos.quantity : 0;

  btn.disabled = !(qty <= maxQty);
};


  window.pfSubmitTransfer = async function() {
  const btn = document.getElementById('btnConfirmTransfer');
  const fromId = document.getElementById('trFrom').value;
  const toId = document.getElementById('trTo').value;
  const t = document.getElementById('trTicker').value;
  const qty = parseFloat(document.getElementById('trQty').value);

  if (!fromId || !toId || !t || !qty || qty <= 0 || fromId === toId) return;

  btn.disabled = true;
  btn.innerText = "İŞLENİYOR...";

  // Nakit transferi
  if (t === "__CASH__") {
    const ticker = "CASH";
    const price = 1;
    const currency = "TRY";
    const rate = 1;
    const tryPrice = 1;

    const sellRes = await api('transaction-single', {
      portfolio: fromId,
      ticker,
      price,
      quantity: qty,
      side: "sell",
      m: -1,
      currency,
      rate,
      TRY_price: tryPrice
    });

    if (sellRes.status !== "success") {
      alert(sellRes.message || "Virman (1/2) - Nakit çıkışı hatası.");
      btn.innerText = "VİRMAN YAP";
      btn.disabled = false;
      return;
    }

    const buyRes = await api('transaction-single', {
      portfolio: toId,
      ticker,
      price,
      quantity: qty,
      side: "buy",
      m: 1,
      currency,
      rate,
      TRY_price: tryPrice
    });

    if (buyRes.status !== "success") {
      alert(buyRes.message || "Virman (2/2) - Nakit girişi hatası. (Çıkış gerçekleşti)");
      btn.innerText = "VİRMAN YAP";
      btn.disabled = false;
      return;
    }

    // cache refresh
    delete state.portfolioCache[fromId];
    delete state.portfolioCache[toId];
    await getPortfolioDetailCached(fromId);
    await getPortfolioDetailCached(toId);

    if (state.activePortfolioId === ALL_KEY) await loadAllPortfolios();
    else await loadPortfolioDetail(state.activePortfolioId);

    pfCloseTransferModal();
    return;
  }

  // Varlık transferi (mevcut davranış)
  const price = prices[t] || 0;
  if (price <= 0) {
    alert("Fiyat bulunamadı.");
    btn.innerText = "VİRMAN YAP";
    btn.disabled = false;
    return;
  }

  const isU = isUSD(t);
  const usdRate = prices['USDTRY'] || 1;
  const currency = isU ? "USD" : "TRY";
  const rate = isU ? usdRate : 1;
  const tryPrice = price * rate;

  const sellRes = await api('transaction-single', {
    portfolio: fromId, ticker: t, price, quantity: qty, side: "sell", m: -1,
    currency, rate, TRY_price: tryPrice
  });

  if (sellRes.status !== "success") {
    alert(sellRes.message || "Virman (1/2) - Kaynak satım hatası.");
    btn.innerText = "VİRMAN YAP";
    btn.disabled = false;
    return;
  }

  const buyRes = await api('transaction-single', {
    portfolio: toId, ticker: t, price, quantity: qty, side: "buy", m: 1,
    currency, rate, TRY_price: tryPrice
  });

  if (buyRes.status !== "success") {
    alert(buyRes.message || "Virman (2/2) - Hedef alım hatası. (Kaynak satımı gerçekleşti)");
    btn.innerText = "VİRMAN YAP";
    btn.disabled = false;
    return;
  }

  delete state.portfolioCache[fromId];
  delete state.portfolioCache[toId];
  await getPortfolioDetailCached(fromId);
  await getPortfolioDetailCached(toId);

  if (state.activePortfolioId === ALL_KEY) await loadAllPortfolios();
  else await loadPortfolioDetail(state.activePortfolioId);

  pfCloseTransferModal();
};


  // --- AUTH / PF CREATE ---
  window.pfAuthAction = async function() {
    const email = document.getElementById('emailInput').value,
          pass = document.getElementById('passInput').value,
          name = document.getElementById('nameInput')?.value;
    if(!email || !pass) return;
    const res = await api(state.isLogin ? 'login' : 'create-user', { email, password: pass, name });
    if(res.status === "success" || res.status === "ok") {
      const d = { user: { id: res.user.id||res.user_id, name: name||"User" }, token: res.token };
      localStorage.setItem('finapsis_real_user', JSON.stringify(d));
      state.user = d.user; state.token = d.token;
      refreshData();
    } else alert("Hata");
  };

  window.pfCreatePfAction = async function() {
    const name = document.getElementById('pfName').value;
    if(!name) return;
    const res = await api('portfolio', { user: state.user.id, name, note: "Web" });
    if(res.status === "success") {
      // clear all cache, refresh list
      state.portfolioCache = {};
      state.allCombined = null;
      await refreshData();
    }
  };

  window.pfLogout = function() {
    localStorage.removeItem('finapsis_real_user');
    state.user = null;
    state.token = null;
    state.portfolios = [];
    state.activePortfolio = null;
    state.activePortfolioId = null;
    state.cashBalance = 0;
    state.portfolioCache = {};
    state.allCombined = null;
    pfRenderAuth();
  };

  window.pfGoogleLogin = function() {
    try { localStorage.setItem('finapsis_active_main_tab', 'portfolio.html'); } catch(e) {}
    if(!GOOGLE_CLIENT_ID){
      alert('Google ile giriş için GOOGLE_CLIENT_ID eksik. window.FINAPSIS_CONFIG.GOOGLE_CLIENT_ID set edilmeli.');
      return;
    }
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}&access_type=offline&response_type=code&prompt=consent&scope=${encodeURIComponent('email profile')}`;
    window.top.location.href = authUrl;
  };

  // --- CHARTS ---
  function initCharts(pos, cash, usdRate) {
    if(charts.alloc) charts.alloc.destroy();
    if(charts.pnl) charts.pnl.destroy();

    Chart.defaults.color = '#666';
    Chart.defaults.borderColor = '#222';
    Chart.defaults.font.family = "'Inter', sans-serif";

    const ctxAlloc = document.getElementById('chartAllocation');
    if(ctxAlloc && (pos.length > 0 || cash > 0)) {
      const lbl = pos.map(p=>p.ticker);
      const dt = pos.map(p=>{
        const cur = prices[p.ticker]||0;
        const val = cur*p.quantity;
        return isUSD(p.ticker)?val*usdRate:val;
      });
      lbl.push('Nakit'); dt.push(cash);

      charts.alloc = new Chart(ctxAlloc, {
        type: 'doughnut',
        data: { labels: lbl, datasets: [{ data: dt, backgroundColor: ['#c2f50e', '#00e676', '#2979ff', '#ff1744', '#aa00ff', '#333'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, color:'#888' } } } }
      });
    }

    const ctxPnl = document.getElementById('chartPnL');
    if(ctxPnl && pos.length > 0) {
      const plbl = pos.map(p=>p.ticker);
      const pdt = pos.map(p=>{
        const cur=prices[p.ticker]||0;
        const diff=(cur*p.quantity)-(p.avg_cost*p.quantity);
        return isUSD(p.ticker)?diff*usdRate:diff;
      });

      charts.pnl = new Chart(ctxPnl, {
        type: 'bar',
        data: { labels: plbl, datasets: [{ label: 'K/Z (TL)', data: pdt, backgroundColor: pdt.map(v=>v>=0?'#00e676':'#ff1744'), borderRadius: 4 }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true, grid: { color:'#222' } }, x: { grid: { display:false } } },
          plugins: { legend: { display: false } }
        }
      });
    }
  }
// --- IFRAME AUTO-RESIZE (CHILD SENDER) ---
(function () {
  function readHeight() {
    return Math.max(
      document.documentElement.scrollHeight || 0,
      document.body ? document.body.scrollHeight : 0,
      document.documentElement.offsetHeight || 0,
      document.body ? document.body.offsetHeight : 0
    );
  }

  function postHeight() {
    const h = readHeight();
    try {
      (window.parent || window.top).postMessage({ type: "resize-iframe", height: h }, "*");
    } catch (e) {}
  }

  // ilk açılış / chart render
  window.addEventListener("load", () => {
    postHeight();
    setTimeout(postHeight, 150);
    setTimeout(postHeight, 600);
  });

  // ✅ Donmayı bitiren resize: MutationObserver + setInterval yok
let __pfResizeRaf = 0;

function pfScheduleResize(){
  if (__pfResizeRaf) return;
  __pfResizeRaf = requestAnimationFrame(() => {
    __pfResizeRaf = 0;
    try { postHeight(); } catch(e) {}
  });
}

window.addEventListener("resize", pfScheduleResize, { passive: true });

// Dışarıdan çağırmak için (tab switch / tablo render sonrası çağıracağız)
window.pfFinapsisResize = pfScheduleResize;

// ilk açılışta 2 kez ölç
window.addEventListener("load", () => {
  pfScheduleResize();
  setTimeout(pfScheduleResize, 250);
}, { once:true });

})();

  init();
})();

// ============================================
    // GLOBAL BAŞLATICI
    // ============================================
    // Not: Fonksiyonu async yaptık
    // ============================================
// GLOBAL BAŞLATICI (VERİ MOTORU)
// ============================================
document.addEventListener("DOMContentLoaded", async function() {

  // 1. TEMEL LİSTELERİ ÇEK (Şirketler Listesi + Fiyatlar)
  await loadFinapsisData();

  // 2. METRİK VERİLERİNİ BAŞLAT (ARKA PLANDA)
  // Kullanıcı sekmeye gitmese bile veriler inmeye başlasın.
  if (typeof finBuildMapForActiveGroup === "function") {
      console.log("🚀 [System] Veri motoru başlatılıyor...");
      finBuildMapForActiveGroup(() => {
          console.log("✅ [System] Tüm veriler hazır.");
          // Eğer şu an açık olan bir sekme veri bekliyorsa onu tetikle
          const activeTab = localStorage.getItem('finapsis_active_main_tab');
          if (activeTab === 'karsilastirma.html' && window.cmpRender) window.cmpRender();
          if (activeTab === 'screener.html' && typeof renderScreenerResults === "function") renderScreenerResults();
      });
  }

  // Yükleme ekranını gizle
  const hidePL = () => {
    const pl = document.getElementById("preloader");
    if (pl) pl.style.display = "none";
  };

  // --- TAB RESTORE & INIT ---
  try {
    const params = new URLSearchParams(window.location.search);
    const hasCode = params.get('code');
    const forced = (params.get('tab') || '').toLowerCase().trim();
    const saved = (localStorage.getItem('finapsis_active_main_tab') || '').trim();

    let target = 'screener.html';
    if (forced in {'portfolio':1,'portfolio.html':1,'pf':1}) target = 'portfolio.html';
    else if (forced in {'companies':1,'companieslist':1,'companieslist.html':1,'list':1}) target = 'companieslist.html';
    else if (forced in {'sectors':1,'sector':1}) target = 'sectors';
    else if (forced in {'diagrams':1,'diyagramlar':1,'diyagram':1}) target = 'diagrams';
    else if (forced in {'detail':1,'detail.html':1,'comdetail':1}) target = 'detail';
    else if (forced in {'karsilastirma':1,'karsilastirma.html':1,'compare':1}) target = 'karsilastirma.html';
    else if (hasCode) target = 'portfolio.html';
    else if (saved) target = saved;

    setTimeout(() => {
        // ✅ Free ise Skorlama hedeflenmişse Companies'e düş
        if (finIsFree() && target === "screener.html") target = "companieslist.html";

        // ✅ Free ise Skorlama tab butonuna kilit görünümü ver
        if (finIsFree()) {
          const scrBtn =
            document.querySelector('nav.app-tabs .tab-btn[data-tab="screener.html"]') ||
            Array.from(document.querySelectorAll("nav.app-tabs .tab-btn")).find(b => (b.getAttribute("onclick") || "").includes("screener.html"));

          if (scrBtn) {
            scrBtn.classList.add("locked");
            scrBtn.title = "Pro üyelik gerektirir";
            scrBtn.classList.remove("active");
          }
        }

        switchTab(target);
        requestAnimationFrame(hidePL);
    }, 10);


  } catch(e) {
    requestAnimationFrame(hidePL);
  }
}, { once: true });

// ============================================
// ✅ DIYAGRAMLAR MODÜLÜ (STATE & DATA SYNC FIX)
// ============================================

(function(){
  let dgInited = false;
  let chartObj = null;

  // Analiz Türleri
  const ANALYSIS_OPTS = [
    { id: 'pe_margin', label: 'F/K vs Net Kâr Marjı' },
    { id: 'ccc', label: 'Nakit Döngüsü (Gün)' },
    { id: 'assets_roa', label: 'Toplam Varlıklar vs ROA' },
    { id: 'roic_wacc', label: 'ROIC vs AOSM' },
    { id: 'np_fcf', label: 'Net Kar vs Serbest Nakit Akışı' },
    { id: 'growth', label: 'Gelir vs Kar Büyümesi' },
    { id: 'de_roe', label: 'Borç/Öz Kaynak vs ROE' },
    { id: 'roa_profit', label: 'Kar Marjı vs Varlık Devir Hızı' },
    { id: 'capex', label: 'Varlık Alımları vs Gelir Büyümesi' }
  ];

  // ✅ STATE BAŞLANGIÇ AYARI
  window.dgState = { 
      analysis: 'pe_margin', // Varsayılan analiz kesin olarak atandı
      sector: 'all',
      industry: 'all' 
  };

  const colors = {
    green: 'rgba(194, 245, 14, 0.12)',
    red: 'rgba(255, 60, 60, 0.08)',
    neutral: 'rgba(255, 255, 255, 0.02)'
  };

  function updateHeight(){
    try{ if (window.pfFinapsisResize) window.pfFinapsisResize(); }catch(e){}
  }

  function dgCompanies(){
    const list = Array.isArray(window.companies) ? window.companies : [];
    return list.filter(c => (c.group || 'bist') === activeGroup);
  }

  // --- BADGE RENDER ---
  window.dgUpdateBadges = function() {
      const area = document.getElementById("dgBadgeArea");
      if(!area) return;

      let groupLabel = "BIST";
      if(activeGroup === 'nyse') groupLabel = "NYSE";
      if(activeGroup === 'nasdaq') groupLabel = "NASDAQ";

      // State'ten okuyoruz
      const currentAnalysisObj = ANALYSIS_OPTS.find(x => x.id === window.dgState.analysis) || ANALYSIS_OPTS[0];
      
      const currentSector = window.dgState.sector === 'all' ? 'TÜMÜ' : window.dgState.sector;
      const isSectorActive = window.dgState.sector !== 'all';

      const currentIndustry = window.dgState.industry === 'all' ? 'TÜMÜ' : window.dgState.industry;
      const isIndustryActive = window.dgState.industry !== 'all';
      const indStyle = isSectorActive ? '' : 'opacity:0.4; pointer-events:none; filter:grayscale(1);';

      let html = '';

      // A. BORSA
      html += `
          <div style="position:relative;">
              <div class="sc-badge market-badge" onclick="dgTogglePopup('market', event)">
                  <i class="fa-solid fa-globe"></i>
                  BORSA: ${groupLabel} <i class="fa-solid fa-chevron-down" style="font-size:9px; opacity:0.5; margin-left:4px;"></i>
              </div>
              <div id="dgPopup_market" class="cl-popup-menu" onclick="event.stopPropagation()">
                  <div class="cl-popup-list">
                      <div class="cl-popup-item ${activeGroup==='bist'?'selected':''}" onclick="setGroup('bist')">BIST (İstanbul)</div>
                      <div class="cl-popup-item ${activeGroup==='nyse'?'selected':''}" onclick="setGroup('nyse')">NYSE (New York)</div>
                      <div class="cl-popup-item ${activeGroup==='nasdaq'?'selected':''}" onclick="setGroup('nasdaq')">NASDAQ</div>
                  </div>
              </div>
          </div>
      `;

      // B. ANALİZ (State'e göre seçili gelir)
      html += `
          <div style="position:relative;">
              <div class="sc-badge active" onclick="dgTogglePopup('analysis', event)">
                  <i class="fa-solid fa-chart-scatter"></i>
                  ANALİZ: <span style="color:#fff;">${currentAnalysisObj.label}</span>
                  <i class="fa-solid fa-chevron-down" style="font-size:9px; opacity:0.5; margin-left:4px;"></i>
              </div>
              <div id="dgPopup_analysis" class="cl-popup-menu" onclick="event.stopPropagation()">
                  <div class="cl-popup-list">
                      ${ANALYSIS_OPTS.map(opt => `
                          <div class="cl-popup-item ${window.dgState.analysis === opt.id ? 'selected' : ''}" 
                               onclick="dgSelectAnalysis('${opt.id}')">
                               ${opt.label}
                          </div>
                      `).join('')}
                  </div>
              </div>
          </div>
      `;

      // C. SEKTÖR
      html += `
          <div style="position:relative;">
              <div class="sc-badge ${isSectorActive ? 'active' : ''}" onclick="dgTogglePopup('sector', event)">
                  <i class="fa-solid fa-layer-group"></i>
                  SEKTÖR: <span style="color:#fff;">${currentSector}</span>
                  ${isSectorActive 
                      ? `<div class="sc-badge-close" onclick="event.stopPropagation(); dgSelectSector('all')"><i class="fa-solid fa-xmark"></i></div>` 
                      : '<i class="fa-solid fa-chevron-down" style="font-size:9px; opacity:0.5; margin-left:4px;"></i>'}
              </div>
              <div id="dgPopup_sector" class="cl-popup-menu" onclick="event.stopPropagation()">
                  <div class="cl-popup-search">
                      <input type="text" class="cl-popup-input" placeholder="Sektör ara..." oninput="dgFilterListInPopup('sector', this.value)">
                  </div>
                  <div id="dgList_sector" class="cl-popup-list"></div>
              </div>
          </div>
      `;

      // D. ALT SEKTÖR
      html += `
          <div style="position:relative;">
              <div class="sc-badge ${isIndustryActive ? 'active' : ''}" style="${indStyle}" onclick="dgTogglePopup('industry', event)">
                  <i class="fa-solid fa-industry"></i>
                  ALT SEKTÖR: <span style="color:#fff;">${currentIndustry}</span>
                  ${isIndustryActive 
                      ? `<div class="sc-badge-close" onclick="event.stopPropagation(); dgSelectIndustry('all')"><i class="fa-solid fa-xmark"></i></div>` 
                      : '<i class="fa-solid fa-chevron-down" style="font-size:9px; opacity:0.5; margin-left:4px;"></i>'}
              </div>
              <div id="dgPopup_industry" class="cl-popup-menu" onclick="event.stopPropagation()">
                  <div class="cl-popup-search">
                      <input type="text" class="cl-popup-input" placeholder="Alt Sektör ara..." oninput="dgFilterListInPopup('industry', this.value)">
                  </div>
                  <div id="dgList_industry" class="cl-popup-list"></div>
              </div>
          </div>
      `;

      area.innerHTML = html;
  };

  // --- POPUP FONKSİYONLARI ---
  window.dgTogglePopup = function(type, e) {
      if(e) e.stopPropagation();
      const targetId = `dgPopup_${type}`;
      const target = document.getElementById(targetId);
      const wasOpen = target.style.display === 'block';

      document.querySelectorAll('#view-diagrams .cl-popup-menu').forEach(el => el.style.display = 'none');

      if (!wasOpen) {
          if (type === 'sector' || type === 'industry') {
              const listEl = document.getElementById(`dgList_${type}`);
              let items = [];

              if (type === 'sector') {
                  items = [...new Set(dgCompanies().map(c => c.sector))].filter(Boolean).sort((a,b) => a.localeCompare(b,'tr'));
              } else {
                  items = [...new Set(dgCompanies()
                      .filter(c => c.sector === window.dgState.sector)
                      .map(c => c.industry))]
                      .filter(Boolean)
                      .sort((a,b) => a.localeCompare(b,'tr'));
              }
              
              const currentVal = type === 'sector' ? window.dgState.sector : window.dgState.industry;
              const clickFn = type === 'sector' ? 'dgSelectSector' : 'dgSelectIndustry';

              let html = `<div class="cl-popup-item" onclick="${clickFn}('all')">TÜMÜ</div>`;
              html += items.map(s => {
                  const isSel = currentVal === s;
                  const safeS = s.replace(/"/g, '&quot;');
                  return `<div class="cl-popup-item ${isSel?'selected':''}" onclick="${clickFn}('${safeS}')">${s}</div>`;
              }).join('');
              
              listEl.innerHTML = html;
              const inp = document.getElementById(`dgPopup_${type}`).querySelector('input');
              if(inp) inp.value = "";
          }
          target.style.display = 'block';
      }
  };

  // SEÇİM FONKSİYONLARI
  window.dgSelectAnalysis = function(id) {
      window.dgState.analysis = id;
      dgUpdateBadges();
      dgStartAnalysis();
  };

  window.dgSelectSector = function(sec) {
      window.dgState.sector = sec;
      window.dgState.industry = 'all';
      dgUpdateBadges();
      dgStartAnalysis();
  };

  window.dgSelectIndustry = function(ind) {
      window.dgState.industry = ind;
      dgUpdateBadges();
      dgStartAnalysis();
  };

  window.dgFilterListInPopup = function(type, term) {
      const t = String(term||"").toLocaleLowerCase('tr');
      const items = document.querySelectorAll(`#dgList_${type} .cl-popup-item`);
      items.forEach(el => {
          const txt = el.textContent.toLocaleLowerCase('tr');
          el.style.display = (txt.includes(t) || el.textContent === "TÜMÜ") ? "block" : "none";
      });
  };

  document.addEventListener('click', (e) => {
      if(!e.target.closest('.sc-badge') && !e.target.closest('.cl-popup-menu')) {
          document.querySelectorAll('#view-diagrams .cl-popup-menu').forEach(el => el.style.display = 'none');
      }
  });

  // --- ANALİZ MANTIĞI & ÇİZİM ---
  function cleanValue(v){
    if (typeof finParseBenchmarkValue === "function") {
      const n = finParseBenchmarkValue(v);
      return Number.isFinite(n) ? n : NaN;
    }
    const n = Number(String(v ?? "").replace(",", ".").replace(/[^0-9.\-]/g,""));
    return Number.isFinite(n) ? n : NaN;
  }

  function calculateSmartLimit(values) {
    const sorted = [...values].filter(v => !isNaN(v)).sort((a, b) => a - b);
    if (!sorted.length) return 100;
    const p50 = sorted[Math.floor(sorted.length * 0.50)];
    let limit = p50 > 0 ? p50 * 1.1 : Math.max(...sorted) * 1.1;
    return limit || 100;
  }

  function getMedian(values) {
    const sorted = [...values].filter(v => !isNaN(v)).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const mid = Math.floor(sorted.length / 2);
    return (sorted.length % 2) ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2;
  }

  const ANALYSES = {
    pe_margin: {
      titleX: 'Net Kâr Marjı (%)', titleY: 'F/K Oranı (x)',
      zoneType: 'quadrant', qConfig: [2,0,1,0],
      calc: (d) => {
        let x = cleanValue(d["Faaliyet Kâr Marjı"]); let y = cleanValue(d["F/K"]);
        return (isNaN(x) || isNaN(y)) ? null : { x: x*100, y: y };
      }
    },
    ccc: {
      titleX: 'Borç Ödeme Süresi', titleY: 'Stok+Alacak Süresi',
      greenZone: 'below-diagonal', 
      calc: (d) => {
        let x = cleanValue(d["Borç Süresi"]); let y1 = cleanValue(d["Stok Süresi"]); let y2 = cleanValue(d["Alacak Süresi"]);
        return (isNaN(x) || isNaN(y1) || isNaN(y2)) ? null : { x: x, y: y1 + y2 };
      }
    },
    roic_wacc: {
      titleX: 'WACC (%)', titleY: 'ROIC (%)',
      greenZone: 'top-left', 
      calc: (d) => {
        let y = cleanValue(d["ROIC"]); let x = cleanValue(d["WACC"]);
        return (isNaN(y) || isNaN(x)) ? null : { x: x*100, y: y*100 };
      }
    },
    np_fcf: {
      titleX: 'Net Kar', titleY: 'Serbest Nakit Akışı',
      greenZone: 'top-left',
      calc: (d) => {
        let x = cleanValue(d["Dönem Karı (Zararı)"]); let y = cleanValue(d["Serbest Nakit Akışı"]);
        return (isNaN(x) || isNaN(y)) ? null : { x: x/1e6, y: y/1e6 };
      }
    },
    assets_roa: {
      titleX: 'Toplam Varlıklar', titleY: 'ROA (%)',
      zoneType: 'quadrant', qConfig: [2,0,0,1],
      calc: (d) => {
        let x = cleanValue(d["Toplam Varlıklar"]); let y = cleanValue(d["ROA"]);
        return (isNaN(x) || isNaN(y)) ? null : { x: x/1e6, y: y*100 };
      }
    },
    growth: {
      titleX: 'Gelir Büyümesi (%)', titleY: 'Faaliyet Kar Büyümesi (%)',
      greenZone: 'top-left',
      calc: (d) => {
        let x = cleanValue(d["Satış Büyümesi TTM"]); let y = cleanValue(d["Faaliyet Kar Büyümesi TTM"]);
        return (isNaN(x) || isNaN(y)) ? null : { x: x*100, y: y*100 };
      }
    },
    de_roe: {
      titleX: 'Borç/Öz Kaynak', titleY: 'ROE',
      zoneType: 'quadrant', qConfig: [2,0,0,1],
      calc: (d) => {
        let x = cleanValue(d["Borç/Öz Kaynak"]); let y = cleanValue(d["ROE"]);
        return (isNaN(x) || isNaN(y)) ? null : { x: x, y: y*100 };
      }
    },
    roa_profit: {
      titleX: 'Varlık Devir Hızı', titleY: 'Faaliyet Kar Marjı (%)',
      zoneType: 'quadrant', qConfig: [0,2,1,0],
      calc: (d) => {
        let x = cleanValue(d["Satış Gelirleri"]) / cleanValue(d["Toplam Varlıklar"]); let y = cleanValue(d["Faaliyet Kâr Marjı"]);
        return (isNaN(x) || isNaN(y)) ? null : { x: x, y: y*100 };
      }
    },
    capex: {
      titleX: 'Varlık Alımları', titleY: 'Gelir Büyümesi',
      greenZone: 'top-left',
      calc: (d) => {
        let x = cleanValue(d["Varlık Alımları"]); let y = cleanValue(d["Satış Büyümesi Net"]);
        return (isNaN(x) || isNaN(y)) ? null : { x: x/1e6, y: y/1e6 };
      }
    }
  };

  function buildDataMap(){ return window.__FIN_MAP || {}; }

  function drawZones(ctx, chart, config, dMaxX, dMaxY){
    const area = chart.chartArea;
    if (!area) return;

    const left = area.left, right = area.right, top = area.top, bottom = area.bottom;
    const midX = config.currentMidX ?? dMaxX/2;
    const midY = config.currentMidY ?? dMaxY/2;

    ctx.save();

    if (config.zoneType === 'quadrant') {
      const q = config.qConfig || [0,0,0,0];
      const xMidPx = chart.scales.x.getPixelForValue(midX);
      const yMidPx = chart.scales.y.getPixelForValue(midY);

      const rects = [
        { x:left, y:top, w:xMidPx-left, h:yMidPx-top, c:q[0] },         
        { x:xMidPx, y:top, w:right-xMidPx, h:yMidPx-top, c:q[1] },      
        { x:left, y:yMidPx, w:xMidPx-left, h:bottom-yMidPx, c:q[2] },   
        { x:xMidPx, y:yMidPx, w:right-xMidPx, h:bottom-yMidPx, c:q[3] } 
      ];

      rects.forEach(r => {
        if (r.c === 2) ctx.fillStyle = colors.green;
        else if (r.c === 1) ctx.fillStyle = colors.red;
        else ctx.fillStyle = colors.neutral;
        ctx.fillRect(r.x, r.y, r.w, r.h);
      });

      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6,6]);
      ctx.beginPath();
      ctx.moveTo(xMidPx, top); ctx.lineTo(xMidPx, bottom);
      ctx.moveTo(left, yMidPx); ctx.lineTo(right, yMidPx);
      ctx.stroke();
      ctx.setLineDash([]);

    } else {
      ctx.fillStyle = colors.neutral;
      ctx.fillRect(left, top, right-left, bottom-top);

      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6,6]);
      ctx.beginPath();
      ctx.moveTo(chart.scales.x.getPixelForValue(0), chart.scales.y.getPixelForValue(0));
      ctx.lineTo(chart.scales.x.getPixelForValue(dMaxX), chart.scales.y.getPixelForValue(dMaxY));
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(left, bottom); 
      ctx.lineTo(left, top);
      ctx.lineTo(right, top);
      ctx.closePath();
      
      if (config.greenZone === 'top-left') {
          ctx.fillStyle = colors.green;
          ctx.fill();
      } else if (config.greenZone === 'below-diagonal') {
          ctx.fillStyle = colors.red; 
          ctx.fill();
      }

      ctx.beginPath();
      ctx.moveTo(left, bottom);
      ctx.lineTo(right, bottom);
      ctx.lineTo(right, top);
      ctx.closePath();

      if (config.greenZone === 'below-diagonal') {
          ctx.fillStyle = colors.green;
          ctx.fill();
      } else if (config.greenZone === 'top-left') {
          ctx.fillStyle = colors.red;
          ctx.fill();
      }
    }
    ctx.restore();
  }

  function draw(points, config, dMaxX, dMaxY){
    const canvas = document.getElementById('matrixChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartObj) chartObj.destroy();

    chartObj = new Chart(ctx, {
      type: 'scatter',
      data: { datasets: [{ data: points, backgroundColor: '#c2f50e', borderWidth: 1, pointRadius: 6, pointHoverRadius: 12 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { onComplete: () => setTimeout(updateHeight, 50) },
        onClick: (evt, elements) => {
          if (!elements?.length) return;
          const p = elements[0];
          const row = chartObj.data.datasets[p.datasetIndex].data[p.index];
          if (row?.ticker && window.finOpenDetail) window.finOpenDetail(row.ticker);
        },
        layout: { padding: { top: 20, right: 30, bottom: 10, left: 10 } },
        scales: {
          x: { min: 0, max: dMaxX, title: { display: true, text: config.titleX, color: '#888' }, grid: { color: '#1a1a1a' }, ticks: { color: '#555' } },
          y: { min: 0, max: dMaxY, title: { display: true, text: config.titleY, color: '#888' }, grid: { color: '#1a1a1a' }, ticks: { color: '#555' } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111', borderColor: '#333', borderWidth: 1, padding: 12,
            callbacks: {
              label: (c) => [
                `Şirket: ${c.raw.ticker}`,
                `${config.titleX}: ${Number(c.raw.origX).toFixed(2)}${config.unitX || ''}`,
                `${config.titleY}: ${Number(c.raw.origY).toFixed(2)}${config.unitY || ''}`
              ]
            }
          }
        }
      },
      plugins: [{
        id: 'zone-bg',
        beforeDraw: (chart) => {
          const ctx = chart.ctx;
          drawZones(ctx, chart, config, dMaxX, dMaxY);
        }
      }]
    });

    setTimeout(updateHeight, 100);
  }

  window.dgStartAnalysis = function(){
    const type = window.dgState.analysis;
    const sector = window.dgState.sector;
    const industry = window.dgState.industry;
    
    const config = ANALYSES[type];
    if (!config) return;

    const companies = dgCompanies();
    const map = buildDataMap();

    const validPoints = companies
      .filter(c => {
          if (sector !== 'all' && c.sector !== sector) return false;
          if (industry !== 'all' && c.industry !== industry) return false;
          return true;
      })
      .map(c => {
        const d = map[String(c.ticker).toUpperCase()] || {};
        const res = config.calc(d);
        return res ? { x: res.x, y: res.y, origX: res.x, origY: res.y, ticker: String(c.ticker).toUpperCase() } : null;
      })
      .filter(Boolean);

    // Boş veri olsa da grafiği çizelim ki (0,0) eksenleri ve arka plan görünsün
    if (validPoints.length === 0) {
        draw([], config, 100, 100);
        return;
    }

    let curMaxX = config.maxX || calculateSmartLimit(validPoints.map(p => p.origX));
    let curMaxY = config.maxY || calculateSmartLimit(validPoints.map(p => p.origY));

    if (config.zoneType !== 'quadrant') {
      const unifiedMax = Math.max(curMaxX, curMaxY);
      curMaxX = unifiedMax;
      curMaxY = unifiedMax;
    }

    if (config.zoneType === 'quadrant') {
      config.currentMidX = getMedian(validPoints.map(p => p.origX));
      config.currentMidY = getMedian(validPoints.map(p => p.origY));
    }

    const finalDataset = validPoints.map(p => ({
      x: Math.max(0, Math.min(p.origX, curMaxX)),
      y: Math.max(0, Math.min(p.origY, curMaxY)),
      origX: p.origX,
      origY: p.origY,
      ticker: p.ticker
    }));

    draw(finalDataset, config, curMaxX, curMaxY);

    const interp = document.getElementById('interp-content');
    if (interp && window.INTERPRETATIONS) interp.innerHTML = window.INTERPRETATIONS[type] || '';
    
    setTimeout(updateHeight, 100);
  };

  // Metin Sabitleri
  window.INTERPRETATIONS = {
    pe_margin: `<b>Analiz:</b> Değerleme vs. Kârlılık analizi.<br><br><b style="color: #c2f50e;">Yeşil Bölge (Kelepir):</b> Sektör ortalamasından daha yüksek kârlılığa sahip olmasına rağmen, piyasanın henüz "pahalı" fiyatlamadığı şirketler.<br><br><b style="color: #ff4444;">Kırmızı Bölge (Riskli):</b> Kâr marjı düşük olmasına rağmen, fiyatı (F/K) çok yükselmiş şirketler.`,
    ccc: `<b>Analiz:</b> Nakit yönetim verimliliği.<br><br><b style="color: #c2f50e;">Çaprazın Altı (Verimli):</b> Borç ödeme süresi, stok ve alacak süresinden uzundur. Şirket faizsiz krediyle işini döndürüyor demektir.<br><br><b style="color: #ff4444;">Çaprazın Üstü (Sıkışık):</b> Şirket sattığı malın parasını tahsil etmeden ödeme yapmak zorunda kalıyor.`,
    roic_wacc: `<b>Analiz:</b> Ekonomik Katma Değer (EVA).<br><br><b style="color: #c2f50e;">ROIC > WACC (Değer Yaratan):</b> Şirket sermaye maliyetinin üzerinde getiri sağlıyor.<br><br><b style="color: #ff4444;">ROIC < WACC (Değer Yıkıcı):</b> Şirket hissedarın parasını reel olarak eritiyor olabilir.`,
    np_fcf: `<b>Analiz:</b> Kârın Nakit Kalitesi.<br><br><b style="color: #c2f50e;">Çaprazın Üstü (Güçlü):</b> Serbest nakit akışı net kârdan yüksek. Nakit üretebilen şirket.<br><br><b style="color: #ff4444;">Çaprazın Altı (Zayıf):</b> Kâr var ama nakit yok. Tahsilat/sermaye harcaması baskısı olabilir.`,
    assets_roa: `<b>Analiz:</b> Ölçek vs. Verimlilik.<br><br><b style="color: #c2f50e;">Sağ-Üst (İyi):</b> Büyük ölçek ve yüksek ROA.<br><br><b style="color: #ff4444;">Sol-Alt (Zayıf):</b> Küçük ölçek ve düşük ROA.`,
    growth: `<b>Analiz:</b> Büyüme Kalitesi.<br><br><b style="color: #c2f50e;">Sağ-Üst (Kaliteli):</b> Hem gelir hem kâr büyüyor.<br><br><b style="color: #ff4444;">Sol-Alt (Zayıf):</b> Büyüme düşük / kâr büyümüyor.`,
    de_roe: `<b>Analiz:</b> Finansal Sağlık vs. Getiri.<br><br><b style="color: #c2f50e;">Sol-Üst (İdeal):</b> Düşük borç, yüksek ROE.<br><br><b style="color: #ff4444;">Sağ-Alt (Riskli):</b> Yüksek borç, düşük ROE.`,
    roa_profit: `<b>Analiz:</b> DuPont Verimlilik Analizi.<br><br><b style="color: #c2f50e;">Sağ-Üst:</b> Yüksek devir + yüksek marj.<br><br><b style="color: #ff4444;">Sol-Alt:</b> Düşük devir + düşük marj.`,
    capex: `<b>Analiz:</b> Yatırımın Geri Dönüşü.<br><br><b style="color: #c2f50e;">Sağ-Üst (İyi):</b> Yatırım var ve büyüme geliyor.<br><br><b style="color: #ff4444;">Sol-Alt (Zayıf):</b> Yatırım var ama büyüme yok.`
  };

  window.dgRender = function(){
    dgUpdateBadges();
    window.dgStartAnalysis();
    updateHeight();
  };

  // ✅ INIT: Veri Beklemeli
  window.dgInitOnce = function(){
    finEnsureCompanies();
    finEnsureBenchmarks();
    
    // Veri (Map) henüz yoksa bekleyelim
    if(typeof finBuildMapForActiveGroup === "function") {
        finBuildMapForActiveGroup(() => {
            if (dgInited) return;
            dgInited = true;
            window.dgRender();
        });
    } else {
        // Fallback
        if (dgInited) return;
        dgInited = true;
        window.dgRender();
    }
  };

})();    // ============================================
    // KARŞILAŞTIRMA (BIST/SP) - window.benchmarks + window.companies
    // ============================================

    (function(){
      let cmpInited = false;
      let cmpMapData = {};
      let cmpSelected = [];

      const CMP_DEFAULTS = {
        bist: ['ASELS','THYAO','ENKAI','EREGL'],
        nyse: ['BABA','TSM','JPM','V'],
        nasdaq: ['AAPL','NVDA','MSFT','GOOGL'] // Defaultlar eklendi
      };
      const CMP_MAX = 8;

      // --- BADGE RENDER (BORSA SEÇİMİ) ---
      window.cmpUpdateMarketBadge = function() {
          const area = document.getElementById("cmpMarketBadge");
          if(!area) return;

          let groupLabel = "BIST";
          if(activeGroup === 'nyse') groupLabel = "NYSE";
          if(activeGroup === 'nasdaq') groupLabel = "NASDAQ";

          // HTML: Sadece Borsa Badge'i
          area.innerHTML = `
              <div style="position:relative;">
                  <div class="sc-badge market-badge" onclick="cmpToggleMarketPopup(event)" title="Borsa Değiştir">
                      <i class="fa-solid fa-globe"></i>
                      BORSA: ${groupLabel} <i class="fa-solid fa-chevron-down" style="font-size:9px; opacity:0.5; margin-left:4px;"></i>
                  </div>
                  <div id="cmpPopup_market" class="cl-popup-menu" onclick="event.stopPropagation()">
                      <div class="cl-popup-list">
                          <div class="cl-popup-item ${activeGroup==='bist'?'selected':''}" onclick="setGroup('bist')">BIST (İstanbul)</div>
                          <div class="cl-popup-item ${activeGroup==='nyse'?'selected':''}" onclick="setGroup('nyse')">NYSE (New York)</div>
                          <div class="cl-popup-item ${activeGroup==='nasdaq'?'selected':''}" onclick="setGroup('nasdaq')">NASDAQ</div>
                      </div>
                  </div>
              </div>
          `;
      };

      window.cmpToggleMarketPopup = function(e) {
          if(e) e.stopPropagation();
          const pop = document.getElementById("cmpPopup_market");
          if(pop) {
              // Diğer açık popupları kapat (global class)
              document.querySelectorAll('.cl-popup-menu').forEach(el => {
                  if(el !== pop) el.style.display = 'none';
              });
              const isVisible = pop.style.display === "block";
              pop.style.display = isVisible ? "none" : "block";
          }
      };

      // Dışarı tıklayınca kapat
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

      // Aktif grup şirketlerini getir
      function cmpCompanies() {
        const list = Array.isArray(window.companies) ? window.companies : [];
        return list.filter(c => c.group === activeGroup); // activeGroup globalden gelir
      }

      function cmpRebuildMap() {
        cmpMapData = window.__FIN_MAP || {};
      }

      function cmpEnsureSelection() {
        const allowed = new Set(cmpCompanies().map(c => c.ticker));
        cmpSelected = cmpSelected.filter(t => allowed.has(t) && cmpMapData[t]);

        if (cmpSelected.length === 0) {
          cmpSelected = cmpLoadSelection(activeGroup);
          // Tekrar filtrele (yeni grup verisi yüklenmemiş olabilir)
          cmpSelected = cmpSelected.filter(t => allowed.has(t) && cmpMapData[t]);
        }

        if (cmpSelected.length > CMP_MAX) cmpSelected = cmpSelected.slice(0, CMP_MAX);
        cmpSaveSelection(activeGroup);
      }

      function cmpUpdateHeight() {
        try {
          const root = document.getElementById('cmpHeightWrapper') || document.getElementById('view-compare');
          const h = Math.max(600, Math.ceil((root && root.scrollHeight) ? root.scrollHeight : 800) + 20);
          if(window.parent) window.parent.postMessage({ type: 'resize-iframe', height: h }, '*');
        } catch(e) {}
      }

      // --- SEARCH LOGIC (FIXED) ---
      function cmpInitSearch() {
        const input = document.getElementById('cmpSearch');
        const results = document.getElementById('cmpSearchResults');
        if (!input || !results) return;

        input.addEventListener('input', (e) => {
          cmpRebuildMap(); // __FIN_MAP güncelse onu yakala
          const term = (e.target.value || '').toLocaleLowerCase('tr').trim();
          results.innerHTML = '';
          
          if (term.length < 1) { 
              results.style.display = 'none'; 
              return; 
          }

          // Aktif gruptaki şirketlerde ara
          const filtered = cmpCompanies()
            .filter(c => {
              const nameMatch = String(c.name || '').toLocaleLowerCase('tr').includes(term);
              const tickerMatch = String(c.ticker || '').toLocaleLowerCase('tr').includes(term);
              // Sadece verisi olanları getir
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
                  if (cmpSelected.length >= CMP_MAX) cmpSelected.shift(); // FIFO
                  cmpSelected.push(c.ticker);
                  cmpSaveSelection(activeGroup);
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
        cmpSaveSelection(activeGroup);
        window.cmpRender();
      }

      // --- RENDER ---
      window.cmpRender = function cmpRender() {
        const view = document.getElementById('view-compare');
        if (!view || !view.classList.contains('active')) return;

        // Badge'i güncelle (Grup değişmiş olabilir)
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

        // Header
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

        // Remove buttons
        badgeArea.querySelectorAll('button.cmp-xbtn[data-x]').forEach(btn => {
          btn.addEventListener('click', () => cmpRemoveTicker(btn.getAttribute('data-x')));
        });

        // Config & Rows
        const sym = (activeGroup === 'sp' || activeGroup === 'nyse' || activeGroup === 'nasdaq') ? '$' : '₺';
        
        // Helper funcs
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

          // Sıralama (Renk) için değerleri al
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

      // Grup değişince tetiklenir (setGroup içinden)
      window.cmpOnGroupChange = function(group){
        // Seçimleri yenile
        cmpSelected = cmpLoadSelection(group);
        
        // Search kutusunu temizle ve placeholder güncelle
        const inp = document.getElementById('cmpSearch');
        if(inp) {
            inp.value = '';
            if(group === 'nasdaq') inp.placeholder = "Şirket ara (örn: AAPL, NVDA...)";
            else if(group === 'nyse') inp.placeholder = "Şirket ara (örn: BABA, TSM...)";
            else inp.placeholder = "Şirket ara (örn: MGROS, THYAO...)";
        }
        
        // Badge'i güncelle
        if(window.cmpUpdateMarketBadge) window.cmpUpdateMarketBadge();
      };

      // INIT
      // INIT (Veri Beklemeli)
      window.cmpInitOnce = function cmpInitOnce() {
        finEnsureCompanies();
        finEnsureBenchmarks();

        // 1. UI Başlat (Search, Badge vb. veri gerektirmez)
        if (!cmpInited) {
            cmpInited = true;
            cmpInitSearch();
            if(window.cmpUpdateMarketBadge) window.cmpUpdateMarketBadge();
        }

        // 2. Tabloyu Çiz (Veri Gerektirir)
        // Eğer global fetch zaten bitmişse callback hemen çalışır.
        // Bitmemişse, bitince çalışır.
        if (typeof finBuildMapForActiveGroup === "function") {
            // Yükleniyor göstergesi
            const tbody = document.getElementById('cmpTbody');
            if(tbody && (!cmpSelected.length || Object.keys(cmpMapData).length === 0)) {
                 document.getElementById('cmp-preloader').style.display = 'flex';
            }

            finBuildMapForActiveGroup(() => {
                if (window.cmpRender) window.cmpRender();
            });
        } else {
            // Fallback
            setTimeout(() => { if (window.cmpRender) window.cmpRender(); }, 0);
        }
      };

    })();    // =============================
// ✅ FINAL OVERRIDES (STABLE)
// =============================

// Header highlight
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

// Header click sort bağla (1 kere)
function clBindHeaderSortOnce(){
  document.querySelectorAll("#cl-thead th").forEach(th => {
    if (th.__clSortBound) return;
    th.__clSortBound = true;

    th.onclick = () => {
      const k = th.getAttribute("data-key");
      if (!k) return;

      // aynı kolon => ters çevir, yeni kolon => name asc, diğerleri desc
      currentSort.asc = (currentSort.key === k) ? !currentSort.asc : (k === "name");
      currentSort.key = k;

      // infinite scroll varsa limit resetlemek istiyorsan:
      if (typeof clLimit !== "undefined") clLimit = 200;

      clUpdateSortHeaderUI();
      renderCompanyList();

      // tablo wrapper yukarı (opsiyonel)
      const w = document.getElementById("fin-container");
      if (w) w.scrollTop = 0;
    };
  });
}



// ✅ Companies init override: ilk yükte BIST map build + sort çalışsın
// ✅ Companies init override: İlk yükte sıralamayı ve veriyi garantiye al
window.initCompaniesList = function(){
  // Eğer zaten init edildiyse tekrar etme
  if (window.__companiesListInited) return;
  window.__companiesListInited = true;

  // 1. Veri kaynaklarını kontrol et
  try { finEnsureCompanies && finEnsureCompanies(); } catch(e){}
  
  // 2. Sektör dropdown'ını doldur
  try { updateCompanyListSectorDropdown(); } catch(e){}

  // 3. Varsayılan Sıralamayı KİLİTLE (Piyasa Değeri - Azalan)
  currentSort = { key: 'Piyasa Değeri', asc: false };
  
  // 4. Header UI'ını buna göre güncelle (Ok işaretini koy)
  clBindHeaderSortOnce();
  clUpdateSortHeaderUI();
  // 5. Badge'leri Çiz
  if(window.clUpdateFilterBadges) window.clUpdateFilterBadges();

  // 5. Tabloya "Yükleniyor..." koy (Kullanıcı yanlış liste görmesin)
  const tbody = document.getElementById("cl-tbody");
  if(tbody) tbody.innerHTML = '<tr><td colspan="20" style="text-align:center; padding:50px; color:#666;"><div class="spinner" style="margin:0 auto 10px auto;"></div>Veriler Analiz Ediliyor...</td></tr>';

  // 6. Map verisini indir ve bitince tabloyu çiz
  if (typeof finBuildMapForActiveGroup === "function") {
    finBuildMapForActiveGroup(() => {
      // Veri indi, şimdi sıralı şekilde çiz
      clUpdateSortHeaderUI(); // UI'ı tazele
      renderCompanyList();    // Tabloyu çiz
    });
  } else {
    // Fonksiyon yoksa (fallback) direkt çiz
    renderCompanyList();
  }

  // Infinite scroll'u başlat
  try { clSetupInfiniteScroll(); } catch(e){}
};// ✅ Companies List search fix (duplicate mainSearch id sorunu)
window.applyMainSearch = function(src){
  clearTimeout(__clSearchT);
  __clSearchT = setTimeout(() => {
    // state reset
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



// ============================================
// GÖSTERGELER (INDICATORS) JS LOGIC
// ============================================
window.indCleanNum = function(v) {
    if (v === null || v === undefined || v === "" || v === "null") return null;
    let n = parseFloat(v.toString().replace(",", "."));
    return isNaN(n) ? null : n;
};

window.indFormatDisplay = function(item, fieldType = 'current') {
