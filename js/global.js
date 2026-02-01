// js/global.js

// --- ORTAK GLOBAL VERİLER & SABİTLER ---
window.COMPANIES_DATA_URL = "https://finapsis-data.nameless-dream-696b.workers.dev/static/companies.min.v1.json";
window.FIN_DATA_BASE = "https://finapsis-data.nameless-dream-696b.workers.dev";

// Kısa kod (JSON) -> Uzun isim (Uygulama) Haritası
const METRIC_KEY_MAP = {
  "sh": "Hisse Adedi",
  "ev": "Firma Değeri",
  "evs": "Gelir Çarpanı",
  "eve": "FVÖK Çarpanı",
  "cr": "Cari Oran",
  "gm": "Brüt Kar Marjı",
  "om": "Faaliyet Kâr Marjı",
  "qr": "Asit Test Oranı",
  "de": "Borç/Öz Kaynak",
  "itr": "Stok Devir Hızı",
  "itd": "Stok Süresi",
  "rtr": "Alacak Devir Hızı",
  "roic": "ROIC",
  "roa": "ROA",
  "roe": "ROE",
  "ptr": "Borç Devir Hızı",
  "rds": "Alacak Süresi",
  "pds": "Borç Süresi",
  "ccc": "Nakit Döngüsü",
  "fcf": "Serbest Nakit Akışı",
  "ni": "Dönem Karı (Zararı)",
  "wacc": "WACC",
  "ta": "Toplam Varlıklar",
  "rev": "Satış Gelirleri",
  "rg3y": "Satış Büyümesi 3Y",
  "rgttm": "Satış Büyümesi TTM",
  "opgttm": "Faaliyet Kar Büyümesi TTM",
  "capex": "Varlık Alımları",
  "rgnet": "Satış Büyümesi Net",
  "cash": "Nakit ve Nakit Benzerleri",
  "eq": "Ana Ortaklığa Ait Özkaynaklar",
  "beta": "Beta"
};

// Global Veri Yükleyici (Şirketler + Fiyatlar)
async function loadFinapsisData() {
  const pCompanies = fetch(window.COMPANIES_DATA_URL);
  const pPrices = fetch(`${window.FIN_DATA_BASE}/price/detail.v1.json`);
  const pIndMap = fetch(`${window.FIN_DATA_BASE}/indicators/indicatorsmap.json`);
  const pIndSum = fetch(`${window.FIN_DATA_BASE}/indicators/summary.v1.json`);

  try {
    const [resComp, resPrice, resIndMap, resIndSum] = await Promise.all([
      pCompanies, pPrices, pIndMap, pIndSum
    ]);

    if (resIndMap.ok) window.__INDICATORS_MAP = await resIndMap.json();
    if (resIndSum.ok) {
      const s = await resIndSum.json();
      if (Array.isArray(s)) {
        window.__INDICATORS_SUMMARY = {
          asOf: null,
          items: s
        };
      } else {
        window.__INDICATORS_SUMMARY = {
          asOf: s?.asOf || null,
          items: Array.isArray(s?.items) ? s.items : []
        };
      }
    }

    window.__INDICATORS_LAST = {};

    if (resComp.ok) {
      const data = await resComp.json();
      window.companies = Array.isArray(data) ? data : (data.companies || []);
    } else {
      window.companies = [];
    }

    if (resPrice.ok) {
      const rawDetail = await resPrice.json();
      const detailList =
        (rawDetail && Array.isArray(rawDetail.data)) ? rawDetail.data :
        (Array.isArray(rawDetail) && rawDetail[0]?.data && Array.isArray(rawDetail[0].data)) ? rawDetail[0].data :
        (Array.isArray(rawDetail)) ? rawDetail : [];

      window.currentPriceData = {};
      window.prevPriceData = {};
      window.__FIN_MAP = window.__FIN_MAP || {};

      detailList.forEach(item => {
        if (item.ticker) {
          const t = String(item.ticker).trim().toUpperCase();
          const p = Number(item.price);
          const prev = Number(item.prev);

          window.currentPriceData[t] = p;
          window.prevPriceData[t] = prev;

          if (!window.__FIN_MAP[t]) window.__FIN_MAP[t] = {};
          const target = window.__FIN_MAP[t];

          target["price"] = p;
          target["prev"] = prev;

          const shares = target["Hisse Adedi"] || target["sh"] || target["Total Common Shares Outstanding"];

          if (p > 0 && shares > 0) {
            let finalShares = shares;
            if (window.__ADR_CACHE && window.__ADR_CACHE[t]) {
              finalShares = shares / window.__ADR_CACHE[t];
            }
            target["Piyasa Değeri"] = p * finalShares;
          }
        }
      });

      console.log(`[DATA] ${detailList.length} detaylı fiyat yüklendi.`);

      if (typeof window.renderCompanyList === "function") {
        window.renderCompanyList();
      }
    }

  } catch (e) {
    console.error("[DATA] Yükleme hatası:", e);
    window.companies = window.companies || [];
    window.currentPriceData = window.currentPriceData || {};
  }
}

// Global Varsayılanlar
window.__CALENDAR_LIST_RAW = window.__CALENDAR_LIST_RAW || `[
  { "id": "101", "name": "ABD Tarım Dışı İstihdam", "country_code": "us", "date_full": "07 Şubat 2026 - 16:30", "timestamp": "2026-02-07T16:30:00", "impact": 3, "expected": "185K", "actual": "", "prev": "216K" },
  { "id": "102", "name": "TCMB Faiz Kararı", "country_code": "tr", "date_full": "20 Şubat 2026 - 14:00", "timestamp": "2026-02-20T14:00:00", "impact": 3, "expected": "%45", "actual": "", "prev": "%42.5" },
  { "id": "103", "name": "Euro Bölgesi TÜFE (Yıllık)", "country_code": "eu", "date_full": "15 Şubat 2026 - 13:00", "timestamp": "2026-02-15T13:00:00", "impact": 2, "expected": "%2.8", "actual": "", "prev": "%2.9" }
]`;
window.__INDICATORS_RAW = window.__INDICATORS_RAW || ``;

window.currentPriceData = window.currentPriceData || {};
window.prevPriceData = window.prevPriceData || {};

window.FINAPSIS_CONFIG = Object.assign({
    BUBBLE_USER_ID: "",
    BUBBLE_USER_NAME: "",
    BUBBLE_API_TOKEN: "",
    API_BASE: "https://eap-35848.bubbleapps.io/api/1.1/wf",
    GOOGLE_CLIENT_ID: "",
    REDIRECT_URI: "https://finapsis.co/portfolio/",
    MIDAS_PROXY_URL: "https://unitplan.app.n8n.cloud/webhook/31d8bf64-8c6d-4573-9c4f-e947db8d7041",
    PRICE_PROXY_URL: "https://script.google.com/macros/s/AKfycbwRt12DlJcWkIE5Vn3Cg8LLyDAhf7PYPeuzH9Do3FYfoMEukwhhDHav7e7IkLZna4cfIA/exec"
  },
  (window.FINAPSIS_CONFIG || {})
);
window.FINAPSIS_CONFIG.PRICE_PROXY_URL = "https://script.google.com/macros/s/AKfycbwRt12DlJcWkIE5Vn3Cg8LLyDAhf7PYPeuzH9Do3FYfoMEukwhhDHav7e7IkLZna4cfIA/exec";

// Yardımcı Fonksiyonlar
function finDecodeHtmlEntities(s) {
  if (typeof s !== "string") return "";
  if (!s.includes("&")) return s;
  const ta = document.createElement("textarea");
  ta.innerHTML = s;
  return ta.value;
}

function finGetRawJson(raw, fallback = "[]") {
  return finDecodeHtmlEntities(String(raw ?? fallback)).trim();
}

function finEnsureCompanies() {
  if (!window.companies) window.companies = [];
}

function finEnsureIndicators() {
  if (Array.isArray(window.indicators) && window.indicators.length) return;
  try {
    window.indicators = JSON.parse(finGetRawJson(window.__INDICATORS_RAW, "[]"));
  } catch (e) {
    console.error("indicators JSON.parse failed", e);
    window.indicators = [];
  }
}

function finEnsureBenchmarks() {
  if (Array.isArray(window.benchmarks) && window.benchmarks.length) return;
  try {
    window.benchmarks = JSON.parse(finGetRawJson(window.__BENCHMARKS_RAW, "[]"));
  } catch (e) {
    console.error("benchmarks JSON.parse failed", e);
    window.benchmarks = [];
  }
}

window.__FIN_MAP = window.__FIN_MAP || Object.create(null);
let __mapGroup = "";

// --- MAP BUILDER (METRICS LOAD) ---
let __loadingMetrics = false;
window.__ADR_CACHE = null;
window.__FIN_METRICS_WAITERS = window.__FIN_METRICS_WAITERS || [];

async function finMapWithConcurrency(items, limit, worker) {
  const safeLimit = Math.max(1, Number(limit) || 1);
  let next = 0;

  const runners = Array.from({
    length: safeLimit
  }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  });

  await Promise.all(runners);
}

async function finBuildMapForActiveGroup(done) {
  if (typeof done === "function") window.__FIN_METRICS_WAITERS.push(done);
  if (__loadingMetrics) return;
  __loadingMetrics = true;

  const g = String(window.activeGroup || "bist");
  window.__FIN_MAP = window.__FIN_MAP || {};

  const activeTickers = new Set(
    (window.companies || [])
    .filter(c => {
      if (c.group === g) return true;
      if ((g === 'nyse' || g === 'nasdaq') && c.group === 'sp') return true;
      return false;
    })
    .map(c => String(c.ticker).trim().toUpperCase())
  );

  try {
    console.time("VeriIndirme");

    if (!window.__ADR_CACHE) {
      try {
        const adrRes = await fetch(`${window.FIN_DATA_BASE}/static/drs.json`);
        if (adrRes.ok) {
          const rawAdr = await adrRes.json();
          window.__ADR_CACHE = {};
          for (const [tick, ratioStr] of Object.entries(rawAdr)) {
            const parts = ratioStr.split(':');
            if (parts.length === 2) window.__ADR_CACHE[tick] = parseFloat(parts[1]) / parseFloat(parts[0]);
          }
        }
      } catch (e) {
        window.__ADR_CACHE = {};
      }
    }

    let totalPages = 1;
    try {
      const stateRes = await fetch(`${window.FIN_DATA_BASE}/__state/metrics_v1.json?t=${Date.now()}`);
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        if (stateData.page) {
          totalPages = stateData.page;
        }
      }
    } catch (e) {
      console.warn("State okunamadı, varsayılan 1.");
    }

    console.log(`[METRICS] Toplam ${totalPages} sayfa paralel indirilecek.`);

    const pageIds = [];
    for (let i = 0; i < totalPages; i++) pageIds.push(String(i).padStart(3, '0'));

    const CONCURRENCY = 6;

    await finMapWithConcurrency(pageIds, CONCURRENCY, async (pageId) => {
      const pageUrl = `${window.FIN_DATA_BASE}/metrics/page/${pageId}.v1.json`;
      const res = await fetch(pageUrl);
      if (!res.ok) return;

      const arr = await res.json();
      if (!Array.isArray(arr)) return;

      arr.forEach(item => {
        if (!item || !item.t) return;

        const ticker = String(item.t).trim().toUpperCase();
        if (!activeTickers.has(ticker)) return;

        if (!window.__FIN_MAP[ticker]) window.__FIN_MAP[ticker] = {};
        const target = window.__FIN_MAP[ticker];
        const vals = item.v || {};

        for (const [shortKey, val] of Object.entries(vals)) {
          if (val === null) continue;
          const longKey = METRIC_KEY_MAP[shortKey];
          if (longKey) target[longKey] = val;
        }

        const price = (window.currentPriceData && window.currentPriceData[ticker]) ?
          Number(window.currentPriceData[ticker]) : 0;

        let shares = vals.sh;
        if (shares && window.__ADR_CACHE && window.__ADR_CACHE[ticker]) {
          shares = shares / window.__ADR_CACHE[ticker];
        }

        if (price > 0 && shares) {
          const mc = price * shares;
          target["Piyasa Değeri"] = mc;

          if (vals.ni) target["F/K"] = mc / vals.ni;
          if (vals.rev) target["Fiyat/Satışlar"] = mc / vals.rev;

          if (vals.eq && vals.eq > 0) {
            target["PD/DD"] = mc / vals.eq;
          } else if (vals.ta && vals.de !== undefined) {
            const equity = vals.ta / (1 + vals.de);
            if (equity > 0) target["PD/DD"] = mc / equity;
          }
        }
      });
    });

    console.timeEnd("VeriIndirme");

  } catch (e) {
    console.error("[METRICS] Kritik Hata:", e);
  } finally {
    __loadingMetrics = false;
    const q = (window.__FIN_METRICS_WAITERS || []).splice(0);
    q.forEach(fn => {
      try {
        fn();
      } catch (e) {}
    });
  }
}

// --- PARA FORMATLAYICILAR ---
function finCurrencySuffix() {
  return (['sp', 'nyse', 'nasdaq'].includes(window.activeGroup)) ? '$' : '₺';
}

function finFormatMoneyCompact(v, opts = {}) {
  if (v === null || v === undefined) return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  const abs = Math.abs(n);
  const sym = finCurrencySuffix();

  let div = 1;
  let suf = '';
  if (abs >= 1e12) {
    div = 1e12;
    suf = 'T';
  } else if (abs >= 1e9) {
    div = 1e9;
    suf = 'B';
  } else if (abs >= 1e6) {
    div = 1e6;
    suf = 'M';
  } else if (abs >= 1e3) {
    div = 1e3;
    suf = 'K';
  }

  if (!suf) {
    return n.toLocaleString('tr-TR', {
      maximumFractionDigits: 2
    });
  }

  const decimals = ('decimals' in opts) ? opts.decimals : (abs >= 1e9 ? 1 : 0);
  const scaled = n / div;
  const s = scaled.toLocaleString('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  return `${s}${suf}${sym}`;
}

function finParseBenchmarkValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;

  let s = String(v).trim();
  if (!s || s === '-' || s === '—') return null;

  s = s.replace(/\s+/g, '');
  s = s.replace(/₺|\$|€|TL|TRY|USD|USDT|EUR/gi, '');

  let mult = 1;
  const m = s.match(/([KMBT])$/i);
  if (m) {
    const suf = m[1].toUpperCase();
    if (suf === 'K') mult = 1e3;
    else if (suf === 'M') mult = 1e6;
    else if (suf === 'B') mult = 1e9;
    else if (suf === 'T') mult = 1e12;
    s = s.slice(0, -1);
  }

  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    const cnt = (s.match(/,/g) || []).length;
    s = (cnt > 1) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (s.includes('.')) {
    const cnt = (s.match(/\./g) || []).length;
    if (cnt > 1) s = s.replace(/\./g, '');
  }

  const n = Number(s.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? (n * mult) : null;
}

function hidePreloader() {
  const p = document.getElementById('preloader');
  if (p) p.style.display = 'none';
}

// --- TAB KONTROLÜ ---
window.__fpInit = window.__fpInit || {
  screener: false,
  companies: false
};

function fpEnsureInit(tabName) {
  if (tabName === 'screener.html' && !window.__fpInit.screener) {
    window.__fpInit.screener = true;
    try {
      initScreener();
    } catch (e) {}
  }
  if (tabName === 'companieslist.html' && !window.__fpInit.companies) {
    window.__fpInit.companies = true;
    try {
      initCompaniesList();
    } catch (e) {}
  }
}

function switchTab(tabName) {
  if (typeof finEnsureCompanies === "function") finEnsureCompanies();
  if (typeof finEnsureBenchmarks === "function") finEnsureBenchmarks();
  if (typeof finEnsureIndicators === "function") finEnsureIndicators();
  try {
    localStorage.setItem('finapsis_active_main_tab', tabName);
  } catch (e) {}

  const navBtns = document.querySelectorAll('nav.app-tabs .tab-btn');
  navBtns.forEach((b) => b.classList.remove('active'));

  const scr = document.getElementById('view-screener');
  const cl = document.getElementById('view-companies');
  const cmp = document.getElementById('view-compare');
  const pf = document.getElementById('view-portfolio');
  const det = document.getElementById('view-detail');
  const sec = document.getElementById('view-sectors');
  const subTabs = document.querySelector('.sub-tabs-container');
  const dia = document.getElementById('view-diagrams');
  const ind = document.getElementById('view-indicators');
  const calList = document.getElementById('view-calendar-list');
  const newsView = document.getElementById('view-news');

  if (scr) scr.classList.remove('active');
  if (cl) cl.classList.remove('active');
  if (cmp) cmp.classList.remove('active');
  if (pf) pf.classList.remove('active');
  if (det) det.classList.remove('active');
  if (sec) sec.classList.remove('active');
  if (dia) dia.classList.remove('active');
  if (ind) ind.classList.remove('active');
  if (calList) calList.classList.remove('active');
  if (newsView) newsView.classList.remove('active');

  // Screener
  if (tabName === 'screener.html') {
    navBtns[0]?.classList.add('active');
    if (scr) scr.classList.add('active');
    if (subTabs) subTabs.style.display = 'flex';
    fpEnsureInit('screener.html');
    window.pfFinapsisResize?.();
    return;
  }

  // Companies List
  if (tabName === 'companieslist.html') {
    navBtns[1]?.classList.add('active');
    if (cl) cl.classList.add('active');
    if (subTabs) subTabs.style.display = 'flex';
    fpEnsureInit('companieslist.html');
    window.pfFinapsisResize?.();
    return;
  }

  // Sektörler
  if (tabName === 'sectors') {
    navBtns[2]?.classList.add('active');
    if (sec) sec.classList.add('active');
    if (subTabs) subTabs.style.display = 'flex';
    if (window.secInitOnce) window.secInitOnce();
    else if (window.secRenderTable) window.secRenderTable();
    return;
  }

  // Diyagramlar
  if (tabName === 'diagrams') {
    navBtns[3]?.classList.add('active');
    if (dia) dia.classList.add('active');
    if (subTabs) subTabs.style.display = 'flex';
    if (window.dgInitOnce) window.dgInitOnce();
    else if (window.dgRender) window.dgRender();
    return;
  }

  // Karşılaştırma
  if (tabName === 'karsilastirma.html') {
    navBtns[4]?.classList.add('active');
    if (cmp) cmp.classList.add('active');
    if (subTabs) subTabs.style.display = 'flex';
    if (window.cmpInitOnce) window.cmpInitOnce();
    if (window.cmpRender) window.cmpRender();
    return;
  }

  // Portföy
  if (tabName === 'portfolio.html') {
    navBtns[5]?.classList.add('active');
    if (pf) pf.classList.add('active');
    if (subTabs) subTabs.style.display = 'none';
    if (window.pfFinapsisResize) setTimeout(window.pfFinapsisResize, 50);
    return;
  }

  // Detay
  if (tabName === 'detail') {
    navBtns[6]?.classList.add('active');
    if (det) det.classList.add('active');
    if (subTabs) subTabs.style.display = 'none';
    if (window.finDetailBootOnce) window.finDetailBootOnce();
    return;
  }

  // Göstergeler
  if (tabName === 'indicators') {
    const btnInd = Array.from(navBtns).find(b => b.textContent.trim().toLowerCase().includes("göstergeler"));
    if (btnInd) btnInd.classList.add('active');
    if (ind) ind.classList.add('active');
    if (subTabs) subTabs.style.display = 'none';
    const tbody = document.getElementById("indicators-tbody");
    if (window.__INDICATORS_MAP && window.__INDICATORS_SUMMARY) {
      if (typeof window.renderIndicators === "function") window.renderIndicators();
    } else {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:50px;"><div class="spinner"></div></td></tr>';
      }
    }
    return;
  }

  // Takvim
  if (tabName === 'calendarlist') {
    const btnCal = Array.from(navBtns).find(b => b.textContent.includes("Takvim"));
    if (btnCal) btnCal.classList.add('active');
    if (calList) calList.classList.add('active');
    if (subTabs) subTabs.style.display = 'none';
    if (window.renderCalendarList) window.renderCalendarList();
    return;
  }

  // Haberler
  if (tabName === 'news') {
    const btnNews = Array.from(navBtns).find(b => b.textContent.includes("Haberler"));
    if (btnNews) btnNews.classList.add('active');
    if (newsView) newsView.classList.add('active');
    if (subTabs) subTabs.style.display = 'none';
    if (window.finNewsBootOnce) window.finNewsBootOnce();
    return;
  }
}

function finOpenAddToPortfolio(ticker) {
  if (!ticker) return;
  try {
    localStorage.setItem('finapsis_active_main_tab', 'portfolio.html');
  } catch (e) {}
  try {
    switchTab('portfolio.html');
  } catch (e) {}
  setTimeout(() => {
    try {
      if (window.pfOpenTradeModal) window.pfOpenTradeModal(ticker, 'buy');
    } catch (e) {}
  }, 80);
};

function fpGetWatchlist() {
  try {
    return JSON.parse(localStorage.getItem("finapsis_watchlist") || "[]");
  } catch (e) {
    return [];
  }
}

function fpSetWatchlist(arr) {
  try {
    localStorage.setItem("finapsis_watchlist", JSON.stringify(arr || []));
  } catch (e) {}
}

window.fpOpenRowMenu = function(ticker, ev) {
  const t = String(ticker || "").toUpperCase();
  const ov = document.getElementById("fpRowMenuOverlay");
  const menu = document.getElementById("fpRowMenu");
  const elT = document.getElementById("fpMenuTicker");
  if (!ov || !menu || !elT) return;

  ov.dataset.ticker = t;
  elT.textContent = t;

  const canSell = (window.pfHasPosition ? !!window.pfHasPosition(t) : false);
  const sellBtn = document.getElementById("fpMenuSell");
  if (sellBtn) sellBtn.classList.toggle("disabled", !canSell);

  const wl = fpGetWatchlist();
  const watching = wl.includes(t);
  const watchBtn = document.getElementById("fpMenuWatch");
  if (watchBtn) watchBtn.innerHTML = `<div class="fpMenuIcon"><i class="fa-solid ${watching ? 'fa-eye-slash' : 'fa-eye'}"></i></div>${watching ? 'İzleme' : 'İzle'}`;

  ov.style.display = "block";

  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;

  if (ev && ev.currentTarget && ev.currentTarget.getBoundingClientRect) {
    const r = ev.currentTarget.getBoundingClientRect();
    x = r.right + 8;
    y = r.top;
  } else if (ev && typeof ev.clientX === "number") {
    x = ev.clientX;
    y = ev.clientY;
  }

  const pad = 10;
  const mw = menu.offsetWidth || 260;
  const mh = menu.offsetHeight || 220;

  if (x + mw + pad > window.innerWidth) x = window.innerWidth - mw - pad;
  if (y + mh + pad > window.innerHeight) y = window.innerHeight - mh - pad;
  if (x < pad) x = pad;
  if (y < pad) y = pad;

  menu.style.left = x + "px";
  menu.style.top = y + "px";
};

window.fpCloseRowMenu = function() {
  const ov = document.getElementById("fpRowMenuOverlay");
  if (ov) ov.style.display = "none";
};

function fpMenuTicker() {
  const ov = document.getElementById("fpRowMenuOverlay");
  return String(ov?.dataset?.ticker || "").toUpperCase();
}

window.finMenuTrade = function(ticker, side) {
  const t = String(ticker || "").toUpperCase();
  try {
    localStorage.setItem('finapsis_active_main_tab', 'portfolio.html');
  } catch (e) {}
  try {
    switchTab('portfolio.html');
  } catch (e) {}
  setTimeout(() => {
    try {
      if (window.pfOpenTradeModal) window.pfOpenTradeModal(t, side);
    } catch (e) {}
  }, 120);
};

window.finToggleWatch = function(ticker) {
  const t = String(ticker || "").toUpperCase();
  const wl = fpGetWatchlist();
  const idx = wl.indexOf(t);
  if (idx >= 0) wl.splice(idx, 1);
  else wl.push(t);
  fpSetWatchlist(wl);
};

document.addEventListener("DOMContentLoaded", () => {
  const d = document.getElementById("fpMenuDetail");
  const b = document.getElementById("fpMenuBuy");
  const s = document.getElementById("fpMenuSell");
  const w = document.getElementById("fpMenuWatch");

  if (d) d.onclick = () => {
    finOpenDetail(fpMenuTicker());
    fpCloseRowMenu();
  };
  if (b) b.onclick = () => {
    finMenuTrade(fpMenuTicker(), "buy");
    fpCloseRowMenu();
  };
  if (s) s.onclick = () => {
    finMenuTrade(fpMenuTicker(), "sell");
    fpCloseRowMenu();
  };
  if (w) w.onclick = () => {
    finToggleWatch(fpMenuTicker());
    fpCloseRowMenu();
  };
});

window.activeGroup = 'bist';

function setGroup(group) {
  window.activeGroup = group;
  document.querySelectorAll('.group-toggle-btn').forEach(btn => {
    if (btn.dataset.grp === group) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  const dgSel = document.getElementById('dgGroupSelect');
  if (dgSel) dgSel.value = group;

  finEnsureCompanies();
  finEnsureBenchmarks();

  const scrBody = document.getElementById('screener-results-body');
  if (scrBody) scrBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#888;">Veriler Güncelleniyor...</td></tr>';

  try {
    updateCompanyListSectorDropdown();
  } catch (e) {}
  try {
    if (window.secUpdateBadges) window.secUpdateBadges();
  } catch (e) {}
  try {
    if (window.dgUpdateBadges) window.dgUpdateBadges();
  } catch (e) {}
  try {
    if (window.dgStartAnalysis) window.dgStartAnalysis();
  } catch (e) {}
  try {
    if (window.cmpOnGroupChange) window.cmpOnGroupChange(window.activeGroup);
  } catch (e) {}
  try {
    if (window.clUpdateFilterBadges) window.clUpdateFilterBadges();
  } catch (e) {}

  try {
    clLimit = 200;
  } catch (e) {}
  try {
    __clRenderedCount = 0;
    __clLastKey = "";
  } catch (e) {}

  try {
    if (typeof finBuildMapForActiveGroup === "function") {
      finBuildMapForActiveGroup(() => {
        try {
          if (typeof initScreener === "function") initScreener();
        } catch (e) {
          console.error(e);
        }
        try {
          scUpdateFilterBadges();
        } catch (e) {}
        try {
          if (typeof clBindHeaderSortOnce === "function") clBindHeaderSortOnce();
        } catch (e) {}
        try {
          if (typeof clUpdateSortHeaderUI === "function") clUpdateSortHeaderUI();
        } catch (e) {}
        try {
          if (typeof renderCompanyList === "function") renderCompanyList();
        } catch (e) {}
        try {
          if (window.secRenderTable) window.secRenderTable();
        } catch (e) {}
        try {
          if (window.dgRender) window.dgRender();
        } catch (e) {}
        try {
          if (window.cmpRender) window.cmpRender();
        } catch (e) {}
        try {
          clSetupInfiniteScroll();
        } catch (e) {}
      });
    }
  } catch (e) {
    console.error(e);
  }

  if (window.cmpOnGroupChange) window.cmpOnGroupChange(window.activeGroup);
}

// Global Başlatıcı
document.addEventListener("DOMContentLoaded", async function() {
  await loadFinapsisData();

  if (typeof finBuildMapForActiveGroup === "function") {
    console.log("🚀 [System] Veri motoru başlatılıyor...");
    finBuildMapForActiveGroup(() => {
      console.log("✅ [System] Tüm veriler hazır.");
      const activeTab = localStorage.getItem('finapsis_active_main_tab');
      if (activeTab === 'karsilastirma.html' && window.cmpRender) window.cmpRender();
      if (activeTab === 'screener.html' && typeof renderScreenerResults === "function") renderScreenerResults();
    });
  }

  const hidePL = () => {
    const pl = document.getElementById("preloader");
    if (pl) pl.style.display = "none";
  };

  try {
    const params = new URLSearchParams(window.location.search);
    const hasCode = params.get('code');
    const forced = (params.get('tab') || '').toLowerCase().trim();
    const saved = (localStorage.getItem('finapsis_active_main_tab') || '').trim();

    let target = 'screener.html';
    if (forced in {
        'portfolio': 1,
        'portfolio.html': 1,
        'pf': 1
      }) target = 'portfolio.html';
    else if (forced in {
        'companies': 1,
        'companieslist': 1,
        'companieslist.html': 1,
        'list': 1
      }) target = 'companieslist.html';
    else if (forced in {
        'sectors': 1,
        'sector': 1
      }) target = 'sectors';
    else if (forced in {
        'diagrams': 1,
        'diyagramlar': 1,
        'diyagram': 1
      }) target = 'diagrams';
    else if (forced in {
        'detail': 1,
        'detail.html': 1,
        'comdetail': 1
      }) target = 'detail';
    else if (forced in {
        'karsilastirma': 1,
        'karsilastirma.html': 1,
        'compare': 1
      }) target = 'karsilastirma.html';
    else if (hasCode) target = 'portfolio.html';
    else if (saved) target = saved;

    setTimeout(() => {
      switchTab(target);
      requestAnimationFrame(hidePL);
    }, 10);

  } catch (e) {
    requestAnimationFrame(hidePL);
  }
}, {
  once: true
});