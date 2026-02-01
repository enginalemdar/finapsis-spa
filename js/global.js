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
// js/global.js (Sadece loadFinapsisData kısmını değiştirin, diğer kısımlar aynı kalsın)

// ... (Üstteki sabitler ve METRIC_KEY_MAP aynı kalsın) ...

// js/global.js içindeki loadFinapsisData fonksiyonunun DOĞRU hali:

async function loadFinapsisData() {
  console.log("📥 [Data] Veri indirme başladı...");
  
  const pCompanies = fetch(window.COMPANIES_DATA_URL);
  const pPrices = fetch(`${window.FIN_DATA_BASE}/price/detail.v1.json`); // Fiyatlar burada!
  const pIndMap = fetch(`${window.FIN_DATA_BASE}/indicators/indicatorsmap.json`);
  const pIndSum = fetch(`${window.FIN_DATA_BASE}/indicators/summary.v1.json`);
  
  // İstatistik Dosyasını Çek
  const pStats = fetch(`${window.FIN_DATA_BASE}/static/screener_stats.v1.json`)
                  .then(res => res.ok ? res.json() : {})
                  .catch(() => ({})); 

  try {
    const [resComp, resPrice, resIndMap, resIndSum, statsData] = await Promise.all([
      pCompanies, pPrices, pIndMap, pIndSum, pStats
    ]);

    // İstatistikleri Ata
    window.__SCREENER_STATS_CACHE = statsData || {};

    if (resIndMap.ok) window.__INDICATORS_MAP = await resIndMap.json();
    if (resIndSum.ok) {
      const s = await resIndSum.json();
      window.__INDICATORS_SUMMARY = Array.isArray(s) ? { asOf: null, items: s } : { asOf: s?.asOf, items: s?.items || [] };
    }
    window.__INDICATORS_LAST = {};

    if (resComp.ok) {
      const data = await resComp.json();
      window.companies = Array.isArray(data) ? data : (data.companies || []);
    } else {
      window.companies = [];
    }

    // 🛑 DÜZELTME BURADA BAŞLIYOR: FİYAT DOSYASINI İŞLEME 🛑
    if (resPrice.ok) {
      const rawDetail = await resPrice.json();
      
      // JSON formatını normalize et (Array içinde data vs.)
      const detailList =
        (rawDetail && Array.isArray(rawDetail.data)) ? rawDetail.data :
        (Array.isArray(rawDetail) && rawDetail[0]?.data && Array.isArray(rawDetail[0].data)) ? rawDetail[0].data :
        (Array.isArray(rawDetail)) ? rawDetail : [];

      window.currentPriceData = {};
      window.prevPriceData = {};
      
      // __FIN_MAP'i başlat veya koru
      window.__FIN_MAP = window.__FIN_MAP || {};

      detailList.forEach(item => {
        if (item.ticker) {
          const t = String(item.ticker).trim().toUpperCase();
          const p = Number(item.price);
          const prev = Number(item.prev);

          // 1. Global Fiyat Değişkenlerini Güncelle
          window.currentPriceData[t] = p;
          window.prevPriceData[t] = prev;

          // 2. Map Verisini Güncelle (Screener ve Listeler için)
          if (!window.__FIN_MAP[t]) window.__FIN_MAP[t] = {};
          const target = window.__FIN_MAP[t];

          target["price"] = p;
          target["prev"] = prev;

          // 3. PİYASA DEĞERİ (MCAP) HESAPLAMA
          // Eğer metrik verileri (Hisse Adedi) fiyattan önce indiyse, fiyat gelince MC'yi hemen hesapla.
          // Metriklerde hisse adedi 'sh', 'Hisse Adedi' veya 'Total Common Shares Outstanding' olarak gelebilir.
          const shares = target["Hisse Adedi"] || target["sh"] || target["Total Common Shares Outstanding"];

          if (p > 0 && shares > 0) {
            let finalShares = shares;
            // ADR kontrolü (varsa)
            if (window.__ADR_CACHE && window.__ADR_CACHE[t]) {
              finalShares = shares / window.__ADR_CACHE[t];
            }
            target["Piyasa Değeri"] = p * finalShares;
            
            // F/K gibi fiyat bazlı metrikleri de güncellemek gerekebilir
            if(target["ni"]) target["F/K"] = target["Piyasa Değeri"] / target["ni"];
          }
        }
      });

      console.log(`[Data] ${detailList.length} detaylı fiyat işlendi ve map'e yazıldı.`);

      // Tabloyu hemen güncelle!
      if (typeof window.renderCompanyList === "function") {
        window.renderCompanyList();
      }
    }
    // 🛑 DÜZELTME BİTTİ 🛑

  } catch (e) {
    console.error("[Data] Yükleme hatası:", e);
    window.companies = window.companies || [];
    window.currentPriceData = window.currentPriceData || {};
  }
}

// ... (Dosyanın geri kalanı aynı) ...

// Global Varsayılanlar
window.__CALENDAR_LIST_RAW = window.__CALENDAR_LIST_RAW || `[]`;
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

// js/global.js içindeki finBuildMapForActiveGroup

window.isFinDataReady = false; // Global bayrak

async function finBuildMapForActiveGroup(done) {
  // Çok çağrılır: callback topla
  if (typeof done === "function") window.__FIN_METRICS_WAITERS.push(done);

  // ✅ Eğer zaten hazırsa: network yok, bekleyenleri hemen boşalt
  if (window.isFinDataReady && window.__FIN_METRICS_LOADED_ALL) {
    const waiters = (window.__FIN_METRICS_WAITERS || []).splice(0);
    waiters.forEach(fn => { try { fn(); } catch (e) {} });
    return;
  }

  // Zaten indiriliyorsa sadece waiter ekleyip çık
  if (__loadingMetrics) return;

  __loadingMetrics = true;
  window.isFinDataReady = false;

  // UI: Yükleniyor Göster
  try { updateScreenerLoadingState(true); } catch (e) {}

  // Yield helper: ana thread'i bırak (donmayı azaltır)
  const yieldToMain = () => new Promise(res => {
    try {
      if (typeof requestIdleCallback === "function") requestIdleCallback(() => res(), { timeout: 60 });
      else requestAnimationFrame(() => res());
    } catch (e) { setTimeout(res, 0); }
  });

  window.__FIN_MAP = window.__FIN_MAP || Object.create(null);

  try {
    console.time("VeriIndirme");

    // 1) ADR cache
    if (!window.__ADR_CACHE) {
      try {
        const adrRes = await fetch(`${window.FIN_DATA_BASE}/static/drs.json`, { cache: "force-cache" });
        if (adrRes.ok) {
          const rawAdr = await adrRes.json();
          window.__ADR_CACHE = Object.create(null);
          for (const [tick, ratio] of Object.entries(rawAdr || {})) {
            window.__ADR_CACHE[String(tick).trim().toUpperCase()] = Number(ratio) || 1;
          }
        } else {
          window.__ADR_CACHE = Object.create(null);
        }
      } catch (e) {
        window.__ADR_CACHE = Object.create(null);
      }
    }

    // 2) totalPages (state yoksa 32)
    let totalPages = 32;
    try {
      const st = await fetch(`${window.FIN_DATA_BASE}/metrics/state.v1.json`, { cache: "no-store" });
      if (st.ok) {
        const j = await st.json();
        const c = Number(j?.pages || j?.count || j?.totalPages || 0);
        if (c && c > 0 && c < 999) totalPages = c;
      }
    } catch (e) {}

    const pageIds = [];
    for (let i = 0; i < totalPages; i++) pageIds.push(String(i).padStart(3, "0"));

    const processItem = (item) => {
      if (!item || !item.t) return;
      const ticker = String(item.t).trim().toUpperCase();
      if (!ticker) return;

      if (!window.__FIN_MAP[ticker]) window.__FIN_MAP[ticker] = Object.create(null);
      const target = window.__FIN_MAP[ticker];
      const vals = item.v || {};

      // short->long key map
      for (const [shortKey, val] of Object.entries(vals)) {
        if (val === null || val === undefined) continue;
        const longKey = METRIC_KEY_MAP[shortKey];
        if (longKey) target[longKey] = val;
      }

      // Fiyat (loadFinapsisData yazmış olabilir)
      const p = Number(window.currentPriceData?.[ticker] ?? target.price);
      if (Number.isFinite(p)) target.price = p;

      // Derived: Piyasa Değeri, F/K, PD/DD
      const sh = Number(target["Hisse Adedi"]);
      const ni = Number(target["Dönem Karı (Zararı)"]);
      const eq = Number(target["Ana Ortaklığa Ait Özkaynaklar"]);
      const adr = Number(window.__ADR_CACHE?.[ticker] || 1);

      if (Number.isFinite(p) && Number.isFinite(sh) && sh > 0) {
        const mcap = p * sh * adr;
        if (Number.isFinite(mcap)) target["Piyasa Değeri"] = mcap;

        if (Number.isFinite(ni) && ni !== 0) {
          const pe = mcap / ni;
          if (Number.isFinite(pe)) target["F/K"] = pe;
        }

        if (Number.isFinite(eq) && eq !== 0) {
          const pb = mcap / eq;
          if (Number.isFinite(pb)) target["PD/DD"] = pb;
        }
      }
    };

    // 3) Pages fetch (batch + yield)
    const BATCH_SIZE = 4;
    for (let i = 0; i < pageIds.length; i += BATCH_SIZE) {
      const batch = pageIds.slice(i, i + BATCH_SIZE);
      const promises = batch.map(pid =>
        fetch(`${window.FIN_DATA_BASE}/metrics/page/${pid}.v1.json`, { cache: "force-cache" })
          .then(r => (r.ok ? r.json() : null))
          .catch(() => null)
      );

      const results = await Promise.all(promises);

      for (const arr of results) {
        if (!arr) continue;
        const items = Array.isArray(arr) ? arr : (Array.isArray(arr?.items) ? arr.items : []);
        // büyük loop -> ara ara yield
        for (let k = 0; k < items.length; k++) {
          processItem(items[k]);
          if (k % 500 === 0) { /* ~500 item'da bir */ }
        }
      }

      // batch sonrası: UI'ı bırak
      await yieldToMain();
    }

    console.timeEnd("VeriIndirme");

    window.__FIN_METRICS_LOADED_ALL = true;
    window.isFinDataReady = true;

  } catch (e) {
    console.error("[METRICS] Map build failed:", e);
    window.isFinDataReady = true; // en azından UI kilidi aç
  } finally {
    __loadingMetrics = false;

    // UI: Yükleniyor kapat
    try { updateScreenerLoadingState(false); } catch (e) {}

    // waiters
    const waiters = (window.__FIN_METRICS_WAITERS || []).splice(0);
    waiters.forEach(fn => { try { fn(); } catch (e) {} });
  }
}

// GLOBAL BAŞLATICI (DÜZELTİLMİŞ)
// ============================================

async function bootFinapsis() {
  console.log("🚀 [Global] bootFinapsis çalıştı.");
  
  await loadFinapsisData();

  if (typeof finBuildMapForActiveGroup === "function") {
    console.log("🚀 [System] Veri motoru başlatılıyor...");
    finBuildMapForActiveGroup(() => {
      console.log("✅ [System] Tüm veriler hazır.");
      const activeTab = localStorage.getItem('finapsis_active_main_tab');
      // Veri geldiğinde açık olan sekmeyi tetikle
      if (activeTab === 'karsilastirma.html' && window.cmpRender) window.cmpRender();
      if (activeTab === 'screener.html' && typeof renderScreenerResults === "function") renderScreenerResults();
      if (activeTab === 'companieslist.html' && typeof renderCompanyList === "function") renderCompanyList();
    });
  }

  const hidePL = () => {
    const pl = document.getElementById("preloader");
    if (pl) pl.style.display = "none";
  };

  // Tab Restore Logic
  try {
    const params = new URLSearchParams(window.location.search);
    const hasCode = params.get('code');
    const forced = (params.get('tab') || '').toLowerCase().trim();
    const saved = (localStorage.getItem('finapsis_active_main_tab') || '').trim();

    let target = 'screener.html';
    
    if (forced in {
        'portfolio': 1, 'portfolio.html': 1, 'pf': 1
      }) target = 'portfolio.html';
    else if (forced in {
        'companies': 1, 'companieslist': 1, 'companieslist.html': 1, 'list': 1
      }) target = 'companieslist.html';
    else if (forced in {
        'sectors': 1, 'sector': 1
      }) target = 'sectors';
    else if (forced in {
        'diagrams': 1, 'diyagramlar': 1, 'diyagram': 1
      }) target = 'diagrams';
    else if (forced in {
        'detail': 1, 'detail.html': 1, 'comdetail': 1
      }) target = 'detail';
    else if (forced in {
        'karsilastirma': 1, 'karsilastirma.html': 1, 'compare': 1
      }) target = 'karsilastirma.html';
    else if (hasCode) target = 'portfolio.html';
    else if (saved) target = saved;

    setTimeout(() => {
      switchTab(target);
      requestAnimationFrame(hidePL);
    }, 100);

  } catch (e) {
    console.error(e);
    requestAnimationFrame(hidePL);
  }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootFinapsis);
} else {
    bootFinapsis();
}