

// --- ORTAK GLOBAL VERİLER & SABİTLER ---
    // Şirket veri yapısı örn: { ticker, name, group: "bist"|"sp"|"doviz"|"emtia"|"kripto", logourl, slug, unit }
// --- CLOUDFLARE DATA URL ---
    window.COMPANIES_DATA_URL = "https://finapsis-data.nameless-dream-696b.workers.dev/static/companies.min.v1.json";

    // --- METRİKLER İÇİN AYARLAR ---
    window.FIN_DATA_BASE = "https://finapsis-data.nameless-dream-696b.workers.dev";    
    // Kısa kod (JSON) -> Uzun isim (Uygulama) Haritası
    // Not: Hesaplananlar (mc, pe, pb vs.) burada yok, onlar kod içinde üretilecek.
    // Kısa kod (JSON) -> Uzun isim (Uygulama) Haritası
const METRIC_KEY_MAP = {
    // Ham Veriler (WANT Listesinin TERSİ)
    "sh": "Hisse Adedi", // Veya "Total Common Shares Outstanding"
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

    // Global Veri Yükleyici (Async)
    // Global Veri Yükleyici (Şirketler + Fiyatlar)
    async function loadFinapsisData() {
        // İkisini paralel başlat (biri diğerini beklemesin)
        const pCompanies = fetch(window.COMPANIES_DATA_URL);
        
        // Fiyatları artık R2'dan çekiyoruz (ÇOK HIZLI)
// Fiyatları ve Göstergeleri paralel çekiyoruz
        const pPrices = fetch(`${window.FIN_DATA_BASE}/price/detail.v1.json`);
        const pIndMap = fetch(`${window.FIN_DATA_BASE}/indicators/indicatorsmap.json`);
        const pIndSum = fetch(`${window.FIN_DATA_BASE}/indicators/summary.v1.json`);
        

        try {
            const [resComp, resPrice, resIndMap, resIndSum] = await Promise.all([
  pCompanies, pPrices, pIndMap, pIndSum
]);

// Gösterge Verilerini Global Değişkenlere Ata
if (resIndMap.ok) window.__INDICATORS_MAP = await resIndMap.json();
if (resIndSum.ok) {
  const s = await resIndSum.json();

  // ✅ Geriye dönük uyum:
  // - eski format: Array
  // - yeni format: { asOf, items }
  if (Array.isArray(s)) {
    window.__INDICATORS_SUMMARY = { asOf: null, items: s };
  } else {
    window.__INDICATORS_SUMMARY = {
      asOf: s?.asOf || null,
      items: Array.isArray(s?.items) ? s.items : []
    };
  }
}


// Artık last yok (geriye dönük kırılmasın diye boş bırakıyoruz)
window.__INDICATORS_LAST = {};


            if (resComp.ok) {
                const data = await resComp.json();
                window.companies = Array.isArray(data) ? data : (data.companies || []);
            } else {
                window.companies = [];
            }

            if (resPrice.ok) {
                const rawDetail = await resPrice.json();
                
                // Yeni format: [{ asOf: "...", data: [...] }]
                // Veri array içinde ilk elemanda geliyor
                const detailList =
  (rawDetail && Array.isArray(rawDetail.data)) ? rawDetail.data :
  (Array.isArray(rawDetail) && rawDetail[0]?.data && Array.isArray(rawDetail[0].data)) ? rawDetail[0].data :
  (Array.isArray(rawDetail)) ? rawDetail :
  [];


                window.currentPriceData = {};
                window.prevPriceData = {};

                // Map'i doldur ve window.__FIN_MAP içine de fiyatı enjekte et (Sıralama çalışsın diye)
                window.__FIN_MAP = window.__FIN_MAP || {};

                detailList.forEach(item => {
                    if (item.ticker) {
                        // 1. Ticker'ı temizle ve büyük harf yap (Eşleşme Garantisi)
                        const t = String(item.ticker).trim().toUpperCase();
                        const p = Number(item.price);
                        const prev = Number(item.prev);

                        // 2. Global Fiyatları Güncelle
                        window.currentPriceData[t] = p;
                        window.prevPriceData[t] = prev;

                        // 3. Map Verisini Güncelle
                        if(!window.__FIN_MAP[t]) window.__FIN_MAP[t] = {};
                        const target = window.__FIN_MAP[t];
                        
                        target["price"] = p;
                        target["prev"] = prev;

                        // 4. KRİTİK: PİYASA DEĞERİ HESAPLAMA (Fix)
                        // Eğer metrik verileri (Hisse Adedi) fiyattan önce indiyse, fiyat gelince MC'yi hemen hesapla.
                        // Metriklerde hisse adedi 'sh', 'Hisse Adedi' veya 'Shares Outstanding' olarak gelebilir.
                        const shares = target["Hisse Adedi"] || target["sh"] || target["Total Common Shares Outstanding"];
                        
                        if (p > 0 && shares > 0) {
                            let finalShares = shares;
                            // ADR kontrolü (varsa)
                            if (window.__ADR_CACHE && window.__ADR_CACHE[t]) {
                                finalShares = shares / window.__ADR_CACHE[t];
                            }
                            target["Piyasa Değeri"] = p * finalShares;
                        }
                    }
                });
                
                console.log(`[DATA] ${detailList.length} detaylı fiyat yüklendi.`);
                
                // 5. ZORLA YENİLEME: Fiyatlar yüklendi, tabloyu hemen güncelle!
                if (typeof window.renderCompanyList === "function") {
                    window.renderCompanyList();
                }
            }

        } catch (e) {
            console.error("[DATA] Yükleme hatası:", e);
            // Hata olsa bile uygulama açılsın
            window.companies = window.companies || [];
            window.currentPriceData = window.currentPriceData || {};
        }
    }

window.__CALENDAR_LIST_RAW = window.__CALENDAR_LIST_RAW || `[
  { "id": "101", "name": "ABD Tarım Dışı İstihdam", "country_code": "us", "date_full": "07 Şubat 2026 - 16:30", "timestamp": "2026-02-07T16:30:00", "impact": 3, "expected": "185K", "actual": "", "prev": "216K" },
  { "id": "102", "name": "TCMB Faiz Kararı", "country_code": "tr", "date_full": "20 Şubat 2026 - 14:00", "timestamp": "2026-02-20T14:00:00", "impact": 3, "expected": "%45", "actual": "", "prev": "%42.5" },
  { "id": "103", "name": "Euro Bölgesi TÜFE (Yıllık)", "country_code": "eu", "date_full": "15 Şubat 2026 - 13:00", "timestamp": "2026-02-15T13:00:00", "impact": 2, "expected": "%2.8", "actual": "", "prev": "%2.9" }
]`
window.__INDICATORS_RAW = window.__INDICATORS_RAW || ``;

    // Fiyat verileri: { TICKER: price } formatında
    window.currentPriceData = window.currentPriceData || {};
    window.prevPriceData = window.prevPriceData || {};

    // Portfolio API / Auth sabitleri
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

// ====== STABLE DATA LOADER (RESTORE + DECODE) ======

function finDecodeHtmlEntities(s){
  if (typeof s !== "string") return "";
  if (!s.includes("&")) return s;
  const ta = document.createElement("textarea");
  ta.innerHTML = s;
  return ta.value;
}

function finGetRawJson(raw, fallback="[]"){
  return finDecodeHtmlEntities(String(raw ?? fallback)).trim();
}

function finEnsureCompanies(){
  // Artık veri asenkron yükleniyor. 
  // Eğer veri henüz gelmediyse boş dizi döndürür, uygulama patlamaz.
  if (!window.companies) window.companies = [];
}
// ✅ YENİ: Göstergeler verisini hazırla
function finEnsureIndicators(){
  if (Array.isArray(window.indicators) && window.indicators.length) return;
  try {
    // Bubble HTML entity decode + JSON parse
    window.indicators = JSON.parse(finGetRawJson(window.__INDICATORS_RAW, "[]"));
  } catch(e){
    console.error("indicators JSON.parse failed", e);
    window.indicators = [];
  }
}

function finEnsureBenchmarks(){
  if (Array.isArray(window.benchmarks) && window.benchmarks.length) return;
  try {
    window.benchmarks = JSON.parse(finGetRawJson(window.__BENCHMARKS_RAW, "[]"));
  } catch(e){
    console.error("benchmarks JSON.parse failed", e);
    window.benchmarks = [];
  }
}



// Companies List için hızlı lookup map (ticker -> {type:value})
window.__FIN_MAP = window.__FIN_MAP || Object.create(null);

let __mapGroup = "";



// --- YENİ MAP BUILDER (DRS.JSON OTO-HESAPLAMA) ---
let __loadingMetrics = false;
window.__ADR_CACHE = null; // ADR verisini hafızada tutmak için

// ✅ Map yükleme sırasında gelen talepleri sıraya al
window.__FIN_METRICS_WAITERS = window.__FIN_METRICS_WAITERS || [];

// ✅ OPTİMİZE EDİLMİŞ MAP BUILDER (DOĞRU SAYFA SAYISI & PARALEL FETCH)

// EKLE: Concurrency limitli işleyici
async function finMapWithConcurrency(items, limit, worker) {
  const safeLimit = Math.max(1, Number(limit) || 1);
  let next = 0;

  const runners = Array.from({ length: safeLimit }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  });

  await Promise.all(runners);
}

async function finBuildMapForActiveGroup(done) {
    // Kuyruğa ekle
    if (typeof done === "function") window.__FIN_METRICS_WAITERS.push(done);
    
    // Zaten çalışıyorsa tekrar başlatma
    if (__loadingMetrics) return; 
    __loadingMetrics = true;

    const g = String(window.activeGroup || "bist");

    // 1. Map'i hazırla
    window.__FIN_MAP = window.__FIN_MAP || {};
    
    // Aktif gruptaki tickerları performans için set'e al
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

        // A. ADR Verisini Çek (Cache yoksa)
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
            } catch (e) { window.__ADR_CACHE = {}; }
        }

        // ---------------------------------------------------------
        // B. SAYFA SAYISINI ÖĞREN (DÜZELTİLDİ: .page OKUNUYOR)
        // ---------------------------------------------------------
        let totalPages = 1;
        try {
            const stateRes = await fetch(`${window.FIN_DATA_BASE}/__state/metrics_v1.json?t=${Date.now()}`);
            if (stateRes.ok) {
                const stateData = await stateRes.json();
                // ✅ DÜZELTME BURADA: Senin JSON yapın "page": 32 döndürüyor.
                // 32 demek 0'dan 31'e kadar dosya var demek.
                if (stateData.page) {
                    totalPages = stateData.page; 
                }
            }
        } catch (e) { 
            console.warn("State okunamadı, varsayılan 1."); 
        }

        console.log(`[METRICS] Toplam ${totalPages} sayfa paralel indirilecek.`);

        // ---------------------------------------------------------
       // ---------------------------------------------------------
// ✅ CONTROLLED FETCH (CONCURRENCY LIMIT)
// ---------------------------------------------------------
const pageIds = [];
for (let i = 0; i < totalPages; i++) pageIds.push(String(i).padStart(3, '0'));

const CONCURRENCY = 6;

// Sayfa geldikçe işle (memory şişmesin)
await finMapWithConcurrency(pageIds, CONCURRENCY, async (pageId) => {
  const pageUrl = `${window.FIN_DATA_BASE}/metrics/page/${pageId}.v1.json`;
  const res = await fetch(pageUrl);
  if (!res.ok) return;

  const arr = await res.json();
  if (!Array.isArray(arr)) return;

  // ✅ ESKİ allPagesData.flat().forEach(...) bloğunun içini aynen buraya taşıyoruz:
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

    const price = (window.currentPriceData && window.currentPriceData[ticker])
      ? Number(window.currentPriceData[ticker]) : 0;

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


        // ---------------------------------------------------------
        // VERİYİ İŞLEME (Senkron)
        // ---------------------------------------------------------
        
    } catch (e) {
        console.error("[METRICS] Kritik Hata:", e);
    } finally {
        __loadingMetrics = false;
        // İndirme bitti, bekleyen çizim işlemlerini (render) başlat
        const q = (window.__FIN_METRICS_WAITERS || []).splice(0);
        q.forEach(fn => { try { fn(); } catch (e) {} });
    }
}

// --- GLOBAL AYARLAR ---
    let activeGroup = 'bist'; // Varsayılan grup
    window.activeGroup = activeGroup;

    // =====================
// CALENDAR REMINDER MODAL (GLOBAL)
// =====================
window.__calSelectedEventId = null;

// Popup aç
window.calOpenListModal = function (eventId) {
  window.__calSelectedEventId = String(eventId || "");

  const ov = document.getElementById("calListModalOverlay");
  const form = document.getElementById("calFormContainer");
  const ok = document.getElementById("calSuccessContainer");

  if (!ov || !form || !ok) return;

  // form görünür, success gizli
  form.style.display = "";
  ok.style.display = "none";

  ov.style.display = "flex";
  // ilk inputa focus
  const nameEl = document.getElementById("calUserName");
  if (nameEl) setTimeout(() => nameEl.focus(), 0);

  // buton enable/disable güncelle
  window.__calUpdateSendBtn?.();
};

// Popup kapat
window.calCloseListModal = function () {
  const ov = document.getElementById("calListModalOverlay");
  if (ov) ov.style.display = "none";
  window.__calSelectedEventId = null;
};

// =====================
// CALENDAR REMINDERS (POST)
// =====================
window.__CAL_REMINDER_ENDPOINT = "https://finapsis-data.nameless-dream-696b.workers.dev/calendar/reminders";

// (İstersen ileride dropdown yaparız; şimdilik sabit 5 dk)
window.__CAL_DEFAULT_NOTIFY_OFFSET_MIN = 5;

window.__calSubmitReminder = async function () {
  const eventId = String(window.__calSelectedEventId || "").trim();

  const nameEl = document.getElementById("calUserName");
  const emailEl = document.getElementById("calUserEmail");
  const consentEl = document.getElementById("calCheckConsent");
  const sendBtn = document.getElementById("calSendBtn");

  const form = document.getElementById("calFormContainer");
  const ok = document.getElementById("calSuccessContainer");

  const name = String(nameEl?.value || "").trim();
  const email = String(emailEl?.value || "").trim().toLowerCase();
  const consent = !!consentEl?.checked;

  // Güvenlik: modal eventId set edilmemişse
  if (!eventId) {
    alert("Etkinlik bulunamadı. Lütfen tekrar deneyin.");
    return;
  }

  // Validasyon (buton zaten disable oluyor ama burada da kontrol edelim)
  if (!name || name.length < 3) { alert("Lütfen ad soyad girin."); return; }
  if (!email || !email.includes("@")) { alert("Lütfen geçerli bir e-posta girin."); return; }
  if (!consent) { alert("Devam etmek için onay vermen gerekiyor."); return; }

  const payload = {
    eventId,
    email,
    name,
    consent: true,
    notifyOffsetMin: Number(window.__CAL_DEFAULT_NOTIFY_OFFSET_MIN || 5)
  };

  // UI: gönderim sırasında kilitle
  const oldTxt = sendBtn?.textContent;
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = "Kaydediliyor...";
  }

  try {
    const res = await fetch(window.__CAL_REMINDER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    // Hata gövdesini okumaya çalış (debug için)
    if (!res.ok) {
      let msg = `Hata: ${res.status}`;
      try {
        const t = await res.text();
        if (t) msg += `\n${t}`;
      } catch (_) {}
      throw new Error(msg);
    }

    // Başarılı: success ekranını göster
    if (form) form.style.display = "none";
    if (ok) ok.style.display = "";

    // İsteğe bağlı: alanları sıfırla (bir sonraki açılış temiz olsun)
    if (nameEl) nameEl.value = "";
    if (emailEl) emailEl.value = "";
    if (consentEl) consentEl.checked = false;

    // eventId’i temizleme (istersen kapatınca temizleniyor zaten)
    // window.__calSelectedEventId = null;

  } catch (err) {
    console.error("[CAL] reminder submit failed:", err);
    alert("Hatırlatıcı oluşturulamadı. Lütfen tekrar deneyin.\n\n" + (err?.message || ""));
    // Hata olursa tekrar enable et
    if (sendBtn) sendBtn.disabled = false;
  } finally {
    if (sendBtn && oldTxt) sendBtn.textContent = oldTxt;
  }
};

// Buton click
(function bindCalReminderSubmitOnce(){
  const btn = document.getElementById("calSendBtn");
  if (!btn) return;
  if (btn.__bound) return;
  btn.__bound = true;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    window.__calSubmitReminder?.();
  });
})();


// Overlay’e tıklayınca kapat (içerik tıklanınca kapanmasın)
document.addEventListener("click", (e) => {
  const ov = document.getElementById("calListModalOverlay");
  const content = document.getElementById("calListModalContent");
  if (!ov || !content) return;

  if (ov.style.display !== "flex") return;

  // sadece overlay boşluğuna tıklayınca kapat
  if (e.target === ov) window.calCloseListModal();
});

// Form validasyonu -> send butonunu aç
window.__calUpdateSendBtn = function () {
  const btn = document.getElementById("calSendBtn");
  const nm = document.getElementById("calUserName");
  const em = document.getElementById("calUserEmail");
  const cs = document.getElementById("calCheckConsent");

  if (!btn || !nm || !em || !cs) return;

  const nameOk = nm.value.trim().length >= 3;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value.trim());
  const consentOk = !!cs.checked;
  const eventOk = !!(window.__calSelectedEventId && window.__calSelectedEventId.length);

  btn.disabled = !(nameOk && emailOk && consentOk && eventOk);
};

// Input değişince butonu güncelle
["calUserName", "calUserEmail", "calCheckConsent"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", window.__calUpdateSendBtn);
  if (el) el.addEventListener("change", window.__calUpdateSendBtn);
});



    // --- PARA FORMATLAYICILAR ---
    function finCurrencySuffix() {
        // NYSE, NASDAQ veya SP ise Dolar, yoksa TL
        return (['sp', 'nyse', 'nasdaq'].includes(activeGroup)) ? '$' : '₺';
    }

    // 1.2M₺ / 3.4B$ gibi compact format
    function finFormatMoneyCompact(v, opts = {}) {
        if (v === null || v === undefined) return '-';
        const n = Number(v);
        if (!Number.isFinite(n)) return '-';
        const abs = Math.abs(n);
        const sym = finCurrencySuffix();

        let div = 1;
        let suf = '';
        if (abs >= 1e12) { div = 1e12; suf = 'T'; }
        else if (abs >= 1e9) { div = 1e9; suf = 'B'; }
        else if (abs >= 1e6) { div = 1e6; suf = 'M'; }
        else if (abs >= 1e3) { div = 1e3; suf = 'K'; }

        if (!suf) {
            // küçük sayılarda currency işareti eklemiyoruz (oran vs. bozulmasın)
            return n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
        }

        const decimals = ('decimals' in opts) ? opts.decimals : (abs >= 1e9 ? 1 : 0);
        const scaled = n / div;
        const s = scaled.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        return `${s}${suf}${sym}`;
    }

    // "1.2M", "3,4B", "5.600.000" gibi değerleri sayıya çevirir
    function finParseBenchmarkValue(v) {
        if (v === null || v === undefined) return null;
        if (typeof v === 'number') return Number.isFinite(v) ? v : null;

        let s = String(v).trim();
        if (!s || s === '-' || s === '—') return null;

        s = s.replace(/\s+/g, '');
        // remove currency labels/symbols but keep K/M/B/T
        s = s.replace(/₺|\$|€|TL|TRY|USD|USDT|EUR/gi, '');

        // suffix multiplier
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

        // normalize separators
        if (s.includes(',') && s.includes('.')) {
            // decimal separator is the last of , or .
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
// ✅ Lazy init bayrakları
window.__fpInit = window.__fpInit || { screener:false, companies:false };

function fpEnsureInit(tabName){
  // Screener ilk kez açılınca init
  if (tabName === 'screener.html' && !window.__fpInit.screener) {
    window.__fpInit.screener = true;
    try { initScreener(); } catch(e) {}
  }

  // Companies List ilk kez açılınca init
  if (tabName === 'companieslist.html' && !window.__fpInit.companies) {
    window.__fpInit.companies = true;
    try { initCompaniesList(); } catch(e) {}
  }
}
// ✅ Bubble -> SPA iframe session bridge
window.__SESSION__ = window.__SESSION__ || null;

// finapsis.co dışında bir domain kullanıyorsan burayı güncelle
const FIN_ALLOWED_PARENTS = new Set([
  "https://finapsis.co",
  "https://www.finapsis.co",
  // Bubble test domain’in varsa ekle (ör: https://finapsis.bubbleapps.io)
]);

function finApplyPlanLockUI() {
  const plan = finGetPlan();
  const isFree = (plan === "free");

  const scrBtn =
    document.querySelector('nav.app-tabs .tab-btn[data-tab="screener.html"]') ||
    Array.from(document.querySelectorAll("nav.app-tabs .tab-btn"))
      .find(b => (b.getAttribute("onclick") || "").includes("screener.html"));

  if (!scrBtn) return;

  if (isFree) {
    scrBtn.classList.add("locked");
    scrBtn.title = "Pro üyelik gerektirir";
  } else {
    scrBtn.classList.remove("locked");
    scrBtn.title = "";
  }
}

window.addEventListener("message", (ev) => {
  if (!FIN_ALLOWED_PARENTS.has(ev.origin)) return;

  const msg = ev.data || {};
  if (msg.type === "FIN_SESSION" && msg.payload) {
    window.__SESSION__ = msg.payload;
    console.log("[SESSION OK]", window.__SESSION__);
    finApplyPlanLockUI();
  }
});

function finGetPlan() {
  try {
    const s = window.__SESSION__ || null;
    if (s?.plan) return String(s.plan).toLowerCase();
  } catch (e) {}
  return "free";
}


function finIsFree() {
  return finGetPlan() === "free";
}

function finPaywall(msg) {
  alert(msg || "Bu özellik Pro üyelik gerektirir.");
}


    function switchTab(tabName) {
        // ✅ Free kullanıcı Skorlama'ya girmesin (kilitli)
  if (finIsFree() && String(tabName || "") === "screener.html") {
    finPaywall("Skorlama (Screener) Pro üyelik gerektirir.");
    return; // hiçbir yere geçme
  }

      if(typeof finEnsureCompanies === "function") finEnsureCompanies();
        if(typeof finEnsureBenchmarks === "function") finEnsureBenchmarks();
        if(typeof finEnsureIndicators === "function") finEnsureIndicators();
        try { localStorage.setItem('finapsis_active_main_tab', tabName); } catch(e) {}
        // sadece üst menü tabları
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



        // tüm view'ları kapat
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
  // BUTON INDEX: Screener(0), Companies(1), Sektörler(2), Compare(3), Portfolio(4), Detail(5)
  navBtns[2]?.classList.add('active');
  if (sec) sec.classList.add('active');

  // Sektörler BIST/SP’ye bağlı olacağı için subTabs açık kalsın
  if (subTabs) subTabs.style.display = 'flex';

  // İlk açılışta init, sonra sadece render
  if (window.secInitOnce) window.secInitOnce();
  else if (window.secRenderTable) window.secRenderTable();

  return;
}

// Diyagramlar
if (tabName === 'diagrams') {
  // BUTON INDEX: Skorlama(0), Şirketler(1), Sektörler(2), Diyagramlar(3), Compare(4), Portfolio(5), Detail(6)
  navBtns[3]?.classList.add('active');
  if (dia) dia.classList.add('active');

  // Diyagramlar BIST/SP’ye bağlı olacağı için subTabs açık kalsın
  if (subTabs) subTabs.style.display = 'flex';

  // İlk açılışta init, sonra render
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
        // Göstergeler
if (tabName === 'indicators') {
  // ✅ Üst tab highlight (index yerine daha sağlam: text ile bul)
  const btnInd = Array.from(navBtns).find(b => b.textContent.trim().toLowerCase().includes("göstergeler"));
  if (btnInd) btnInd.classList.add('active');

  // ✅ View aç
  if (ind) ind.classList.add('active');

  // ✅ Göstergelerde alt subTabs gerekmiyor
  if (subTabs) subTabs.style.display = 'none';

  // ✅ tbody referansı (undefined olmasın)
  const tbody = document.getElementById("indicators-tbody");

  // Veri henüz inmemişse loading göster, inmişse render et
  if (window.__INDICATORS_MAP && window.__INDICATORS_SUMMARY) {
    if (typeof window.renderIndicators === "function") window.renderIndicators();
  } else {
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center; padding:50px;"><div class="spinner"></div></td></tr>';
    }
  }
  return;
}


        // Takvim Listesi
        if (tabName === 'calendarlist') {
            const btnCal = Array.from(navBtns).find(b => b.textContent.includes("Takvim"));
            if(btnCal) btnCal.classList.add('active');

            if (calList) calList.classList.add('active');
            if (subTabs) subTabs.style.display = 'none';
            
            // İlk kez render
            if(window.renderCalendarList) window.renderCalendarList();
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





    // Dış ekranlardan (Screener/List/Compare) Portföye Ekle
    window.finOpenAddToPortfolio = function(ticker) {
        if (!ticker) return;
        try { localStorage.setItem('finapsis_active_main_tab', 'portfolio.html'); } catch(e) {}
        try { switchTab('portfolio.html'); } catch(e) {}
        setTimeout(() => {
            try {
                if (window.pfOpenTradeModal) window.pfOpenTradeModal(ticker, 'buy');
            } catch(e) {}
        }, 80);
    };
function fpGetWatchlist(){
  try { return JSON.parse(localStorage.getItem("finapsis_watchlist") || "[]"); }
  catch(e){ return []; }
}
function fpSetWatchlist(arr){
  try { localStorage.setItem("finapsis_watchlist", JSON.stringify(arr||[])); } catch(e){}
}

window.fpOpenRowMenu = function(ticker, ev){
  const t = String(ticker||"").toUpperCase();
  const ov = document.getElementById("fpRowMenuOverlay");
  const menu = document.getElementById("fpRowMenu");
  const elT = document.getElementById("fpMenuTicker");
  if (!ov || !menu || !elT) return;

  ov.dataset.ticker = t;
  elT.textContent = t;

  // Sat aktif mi?
  const canSell = (window.pfHasPosition ? !!window.pfHasPosition(t) : false);
  const sellBtn = document.getElementById("fpMenuSell");
  if (sellBtn) sellBtn.classList.toggle("disabled", !canSell);

  // İzle label
  const wl = fpGetWatchlist();
  const watching = wl.includes(t);
  const watchBtn = document.getElementById("fpMenuWatch");
  if (watchBtn) watchBtn.innerHTML = `<div class="fpMenuIcon"><i class="fa-solid ${watching ? 'fa-eye-slash' : 'fa-eye'}"></i></div>${watching ? 'İzleme' : 'İzle'}`;

  // ✅ overlay aç
  ov.style.display = "block";

  // ✅ ikonun yanına konumlandır
  // ev yoksa fallback: ekran ortası
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

  // viewport taşmasını engelle
  const pad = 10;
  const mw = menu.offsetWidth || 260;
  const mh = menu.offsetHeight || 220;

  if (x + mw + pad > window.innerWidth) x = window.innerWidth - mw - pad;
  if (y + mh + pad > window.innerHeight) y = window.innerHeight - mh - pad;
  if (x < pad) x = pad;
  if (y < pad) y = pad;

  menu.style.left = x + "px";
  menu.style.top  = y + "px";
};


window.fpCloseRowMenu = function(){
  const ov = document.getElementById("fpRowMenuOverlay");
  if (ov) ov.style.display = "none";
};

function fpMenuTicker(){
  const ov = document.getElementById("fpRowMenuOverlay");
  return String(ov?.dataset?.ticker || "").toUpperCase();
}

// Detaya git: Detail sekmesine geç + ticker'ı yükle

// Al / Sat: Portfolio modalını aç
window.finMenuTrade = function(ticker, side){
  const t = String(ticker||"").toUpperCase();
  try { localStorage.setItem('finapsis_active_main_tab', 'portfolio.html'); } catch(e){}
  try { switchTab('portfolio.html'); } catch(e){}
  setTimeout(() => {
    try {
      if (window.pfOpenTradeModal) window.pfOpenTradeModal(t, side);
    } catch(e){}
  }, 120);
};

// İzle toggle
window.finToggleWatch = function(ticker){
  const t = String(ticker||"").toUpperCase();
  const wl = fpGetWatchlist();
  const idx = wl.indexOf(t);
  if (idx >= 0) wl.splice(idx, 1);
  else wl.push(t);
  fpSetWatchlist(wl);
};

// Menü buton handler’ları (1 kere bağla)
document.addEventListener("DOMContentLoaded", () => {
  const d = document.getElementById("fpMenuDetail");
  const b = document.getElementById("fpMenuBuy");
  const s = document.getElementById("fpMenuSell");
  const w = document.getElementById("fpMenuWatch");

  if (d) d.onclick = () => { finOpenDetail(fpMenuTicker()); fpCloseRowMenu(); };
  if (b) b.onclick = () => { finMenuTrade(fpMenuTicker(), "buy"); fpCloseRowMenu(); };
  if (s) s.onclick = () => { finMenuTrade(fpMenuTicker(), "sell"); fpCloseRowMenu(); };
  if (w) w.onclick = () => { finToggleWatch(fpMenuTicker()); fpCloseRowMenu(); };
});

// --- GRUP KONTROLÜ (BIST/SP) ---
 // --- GRUP KONTROLÜ (BIST/NYSE/NASDAQ) ---
    // --- GRUP KONTROLÜ (BIST/NYSE/NASDAQ) ---
    function setGroup(group) {
        activeGroup = group;
        window.activeGroup = group;

        // 1. Tüm sayfalardaki 'group-toggle-btn' butonlarını güncelle
        document.querySelectorAll('.group-toggle-btn').forEach(btn => {
            if(btn.dataset.grp === group) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // 2. Diyagram sayfasındaki select kutusunu güncelle
        const dgSel = document.getElementById('dgGroupSelect');
        if(dgSel) dgSel.value = group;

        // 3. Verileri Yenile (Screener'ı burada çağırmıyoruz! Bekletiyoruz.)
        finEnsureCompanies();
        finEnsureBenchmarks();
        
        // Screener tablosunu geçici olarak "Yükleniyor" moduna alalım ki kullanıcı dondu sanmasın
        const scrBody = document.getElementById('screener-results-body');
        if(scrBody) scrBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#888;">Veriler Güncelleniyor...</td></tr>';

        // Sektör dropdown'ını güncelle
        try { updateCompanyListSectorDropdown(); } catch(e){}
        // Sektörler sekmesi için badge güncelle
        try { if(window.secUpdateBadges) window.secUpdateBadges(); } catch(e){}
        // Diyagramlar sekmesi için badge güncelle
        try { if(window.dgUpdateBadges) window.dgUpdateBadges(); } catch(e){}
        // Diyagram çizimini yenile
        try { if(window.dgStartAnalysis) window.dgStartAnalysis(); } catch(e){}
        // Karşılaştırma sekmesi güncelle (Badge ve Search)
        try { if(window.cmpOnGroupChange) window.cmpOnGroupChange(activeGroup); } catch(e){}
        // Companies List badge'lerini güncelle (Borsa değiştiği için)
        try { if(window.clUpdateFilterBadges) window.clUpdateFilterBadges(); } catch(e){}

        // Companies List state'i sıfırla
        try { clLimit = 200; } catch(e){}
        try { __clRenderedCount = 0; __clLastKey = ""; } catch(e){}

        // ✅ KRİTİK NOKTA: Map dolmadan kimseyi sahneye çıkarma!
        try {
            if (typeof finBuildMapForActiveGroup === "function") {
                finBuildMapForActiveGroup(() => {
                    // --- BURASI "VERİ İNDİ VE HAZIR" DEMEKTİR ---
                    
                    // 1. Screener'ı ARTIK başlatabiliriz (Map dolu)
                    try { if(typeof initScreener === "function") initScreener(); } catch(e){ console.error(e); }
                    try { scUpdateFilterBadges(); } catch(e){} // ✅ Badge'leri güncelle

                    // 2. Diğer listeleri güncelle
                    try { if(typeof clBindHeaderSortOnce === "function") clBindHeaderSortOnce(); } catch(e){}
                    try { if(typeof clUpdateSortHeaderUI === "function") clUpdateSortHeaderUI(); } catch(e){}
                    try { if(typeof renderCompanyList === "function") renderCompanyList(); } catch(e){}
                    try { if(window.secRenderTable) window.secRenderTable(); } catch(e){}
                    try { if(window.dgRender) window.dgRender(); } catch(e){}
                    try { if(window.cmpRender) window.cmpRender(); } catch(e){}
                    try { clSetupInfiniteScroll(); } catch(e){}
                });
            }
        } catch(e){ console.error(e); }

        if (window.cmpOnGroupChange) window.cmpOnGroupChange(activeGroup);
    }

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
    // ============================================
    // DETAIL (EMBEDDED) JAVASCRIPT
    // ============================================

(function(){
/* ============================
   CONFIG
============================ */
/* ============================
   CONFIG (R2 UPDATE)
============================ */
// Base URL global window.FIN_DATA_BASE üzerinden gelir
const DEFAULT_TICKER = "AAPL";

// Cache for large about file
window.__ABOUT_CACHE = null; 

/* globals */
window.benchmarks = window.benchmarks || [];
window.companies = window.companies || [];

/* ============================
   STATE
============================ */
let currentTicker = DEFAULT_TICKER;

let apiCompany = null;        // from /comdetail
let apiPriceHistory = [];     // from /comdetail
let apiNews = [];             // from /comdetail
let apiFinancials = [];       // from /comfinancials

let derived52w = { low: 0, high: 0, current: 0 };

let chartInstance = null;
let chartFull = { points: [] }; // [{x:ms,y:number}]
let activeRange = "1Y";

/* race control */
let loadSeq = 0;

/* ============================
   HELPERS
============================ */


function getTickerFromQuery(){
  const href = String(window.location.href || "");
  // Bubble HTML element often runs under about:blank
  if (href.startsWith("about:")){
    try{
      const t = (localStorage.getItem("finapsis_detail_ticker") || "").trim();
      return t ? t.toUpperCase() : DEFAULT_TICKER;
    }catch(e){
      return DEFAULT_TICKER;
    }
  }
  try{
    const u = new URL(window.location.href);
    const t = (u.searchParams.get("ticker") || "").trim();
    return t ? t.toUpperCase() : DEFAULT_TICKER;
  }catch(e){
    return DEFAULT_TICKER;
  }
}
function sanitizeTicker(input){
  const t = String(input || "").toUpperCase().trim();
  const clean = t.replace(/[^A-Z0-9.\-]/g, "");
  return clean || DEFAULT_TICKER;
}
function safeNum(v){
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function formatInt(val){
  const n = safeNum(val);
  if (n === null) return "-";
  return Math.round(n).toLocaleString("tr-TR");
}
function formatPrice(val){
  const n = safeNum(val);
  if (n === null) return "-";
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function getLivePriceFromGlobal(ticker){
  const t = String(ticker||"").toUpperCase();
  const cur = window.currentPriceData ? Number(window.currentPriceData[t]) : NaN;
  const prev = window.prevPriceData ? Number(window.prevPriceData[t]) : NaN;
  return {
    cur: Number.isFinite(cur) ? cur : null,
    prev: Number.isFinite(prev) ? prev : null
  };
}

function formatFinancial(val, valueType){
  if (val === null || val === undefined || val === "") return "-";
  const n = safeNum(val);
  if (n === null) return "-";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  const sym = currencySymbolForTicker(currentTicker);
  if (valueType === "ratio") return sign + abs.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  if (abs >= 1_000_000_000) return sign + (abs/1_000_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + " Mr" + sym;
if (abs >= 1_000_000)     return sign + (abs/1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + " M" + sym;
if (abs >= 1_000)         return sign + abs.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + sym;
return sign + abs.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + sym;

  
}
function parseMMDDYYYY(s){
  const str = String(s || "").trim();
  if (str.length !== 8) return null;
  const mm = Number(str.slice(0,2));
  const dd = Number(str.slice(2,4));
  const yy = Number(str.slice(4,8));
  if (!Number.isFinite(mm) || !Number.isFinite(dd) || !Number.isFinite(yy)) return null;
  const d = new Date(yy, mm - 1, dd);
  return Number.isNaN(d.getTime()) ? null : d;
}
function fmtISODate(ms){
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function setYearHeaders(){
  const y = new Date().getFullYear();
  document.getElementById("y1Head").innerText = y - 1;
  document.getElementById("y2Head").innerText = y - 2;
  document.getElementById("y3Head").innerText = y - 3;
}
function setLoadingState(isLoading){
  const btn = document.getElementById("searchBtn");
  const inp = document.getElementById("tickerSearch");
  if (btn) btn.disabled = !!isLoading;
  if (inp) inp.disabled = !!isLoading;

  // ✅ overlay spinner
  const ov = document.getElementById("detailLoadingOverlay");
  if (ov) ov.style.display = isLoading ? "flex" : "none";
}

function updateUrlTicker(ticker){
  try{ localStorage.setItem("finapsis_detail_ticker", String(ticker||"").toUpperCase()); }catch(e){}
  const href = String(window.location.href || "");
  if (href.startsWith("about:")) return;
  try{
    const u = new URL(window.location.href);
    u.searchParams.set("ticker", ticker);
    window.history.replaceState({}, "", u.toString());
  }catch(e){
    // ignore
  }
}
function getActiveTab(){
  const active = document.querySelector('#financialTabs button.tab-btn.active');
  return active?.dataset?.tab || "income";
}
function groupLabel(g){
  const s = String(g || "").toLowerCase();
  if (s === "bist") return "BIST";
  if (s === "sp" || s === "s&p" || s === "sp500") return "S&P";
  return "TICKER";
}
function findCompanyInList(ticker){
  const t = String(ticker || "").toUpperCase();
  const list = Array.isArray(window.companies) ? window.companies : [];
  return list.find(c => String(c.ticker || "").toUpperCase() === t) || null;
}
function currencySymbolForTicker(ticker){
  const c = findCompanyInList(ticker);
  const g = String(c?.group || "").toLowerCase();
  
  // Sadece BIST ise TL, geri kalan her şey (ABD, Emtia, Kripto) Dolar
  if (g === "bist") return "₺";
  return "$";
}

function getBenchmarkValue(ticker, types){
  const t = String(ticker||"").toUpperCase();
  const arr = Array.isArray(window.benchmarks) ? window.benchmarks : [];
  const typeSet = new Set((types || []).map(x => String(x||"").toLowerCase().trim()));

  const hit = arr.find(b =>
    String(b.ticker||"").toUpperCase() === t &&
    typeSet.has(String(b.type||"").toLowerCase().trim())
  );

  if (!hit) return null;

  if (typeof finParseBenchmarkValue === "function") {
    const n = finParseBenchmarkValue(hit.value);
    return Number.isFinite(n) ? n : null;
  }

  const n = Number(String(hit.value||"").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formatCompactWithSymbol(n, sym){
  const v = Number(n);
  if (!Number.isFinite(v)) return "-";
  const abs = Math.abs(v);

  let div = 1, suf = "";
  if (abs >= 1e12) { div = 1e12; suf = "T"; }
  else if (abs >= 1e9) { div = 1e9; suf = "B"; }
  else if (abs >= 1e6) { div = 1e6; suf = "M"; }
  else if (abs >= 1e3) { div = 1e3; suf = "K"; }

  const scaled = v / div;
  const s = scaled.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  return suf ? `${s}${suf}${sym}` : `${s}${sym}`;
}

function getFinancialsEndpointForTicker(ticker){
  const c = findCompanyInList(ticker);
  const g = String(c?.group || "").toLowerCase();

  // bist -> TR
  if (g === "bist") return API_COMFIN_TR;

  // sp -> US
  if (g === "sp") return API_COMFIN_US_N;

  // default: TR (istersen başka default seçebiliriz)
  return API_COMFIN_TR;
}


/* ============================
   API (2 calls)
============================ */
/* ============================
   DATA FETCHING (R2 JSON)
============================ */

// OHLCV verisi için bölge belirleme (us/tr)
function getMarketCode(ticker) {
    const c = findCompanyInList(ticker);
    const g = c ? String(c.group || "").toLowerCase() : "";
    
    return 'us'; // Fallback
}

async function fetchComDetail(ticker) {
    const t = String(ticker).toUpperCase();
    const market = getMarketCode(t);
    const companyInfo = findCompanyInList(t) || {};

    // 1. About Verisi (Cacheli)
    if (!window.__ABOUT_CACHE) {
        try {
            const res = await fetch(`${window.FIN_DATA_BASE}/static/companies.about.v1.json`);
            if (res.ok) window.__ABOUT_CACHE = await res.json();
            else window.__ABOUT_CACHE = [];
        } catch (e) { window.__ABOUT_CACHE = []; }
    }
    const aboutObj = window.__ABOUT_CACHE.find(x => x.ticker === t);

    
    // 2. Price History (OHLCV)
    let price_history = [];
    try {
        let historyUrl = "";
        
        // Grup Kontrolü: Sadece hisse senetleri standart yolu kullanır
        const g = companyInfo ? (companyInfo.group || "").toLowerCase() : "";
        const isStock = ['bist', 'nyse', 'nasdaq', 'sp'].includes(g);

        if (isStock) {
             // Hisse Senedi: Büyük harf ticker, /1d.v1.json uzantısı, market kodu dinamik (tr/us)
             historyUrl = `${window.FIN_DATA_BASE}/ohlcv/ticker/${market}/${t}/1d.v1.json`;
        } else {
             // Gösterge (Döviz, Emtia vb.): Küçük harf ticker, direkt .json uzantısı, sabit 'us' klasörü
             historyUrl = `${window.FIN_DATA_BASE}/ohlcv/ticker/us/${t.toLowerCase()}.json`;
        }

        const histRes = await fetch(historyUrl);
        if (histRes.ok) {
            const histJson = await histRes.json();
            // JSON formatı: { rows: [{t, o, h, l, c, v}, ...] }
            price_history = histJson.rows || [];
        }
    } catch (e) { console.warn("History fetch failed", e); }

    // 3. Şirket Objesini Oluştur (UI için uyumlu hale getir)
    const apiCompany = {
        ticker: t,
        name: companyInfo.name,
        // About JSON'dan gelen about_tr, yoksa fallback
        about: aboutObj ? (aboutObj.about_tr || aboutObj.about) : "Şirket açıklaması bulunamadı.",
        founded: companyInfo.founded,
        employees: companyInfo.employees,
        sector: companyInfo.sector_tr || companyInfo.sector,
        industry: companyInfo.industry_tr || companyInfo.industry,
        market_cap: null // Hesaplanan değerler UI tarafında hallediliyor
    };

    return {
        company: apiCompany,
        price_history: price_history,
        news: [] // R2'da haber kaynağı olmadığı için boş dizi
    };
}
// ✅ Portföy tarihçe için dışarı aç
window.fetchComDetail = fetchComDetail;

async function fetchComFinancials(ticker) {
    const t = String(ticker).toUpperCase();
    try {
        // URL oluştur (Proxy varsa proxyUrl fonksiyonunu kullanır, yoksa direkt)
        // Eğer proxyUrl fonksiyonu tanımlı değilse direkt string birleştirme yaparız.
        const path = `${window.FIN_DATA_BASE}/financials/${t}.json`;
        const url = (typeof proxyUrl === 'function') ? proxyUrl(path) : path;
        
        const res = await fetch(url);
        
        if (res.ok) {
            const json = await res.json();

            // 1. SENARYO (Sizin Durumunuz): [ { "financials": [...] } ]
            if (Array.isArray(json) && json.length > 0 && json[0].financials) {
                return { financials: json[0].financials };
            }

            // 2. SENARYO (Alternatif): { "financials": [...] }
            if (json.financials && Array.isArray(json.financials)) {
                return { financials: json.financials };
            }

            // 3. SENARYO: Direkt veri dizisi [ {...}, {...} ]
            if (Array.isArray(json)) {
                return { financials: json };
            }

            return { financials: [] };
        }
    } catch (e) { 
        console.warn("Financials fetch failed", e); 
    }
    return { financials: [] };
}


/* ============================
   UI RENDER
============================ */
function renderHeaderFromCompanies(ticker){
  // 1. Önce şirketi listeden bulup 'c' değişkenine atıyoruz
  const c = findCompanyInList(ticker);

  // 2. Grup ismini belirliyoruz (c yoksa varsayılan BIST)
  let groupName = "BIST";
  if (c) {
      groupName = (c.exchange || c.group || "BIST").toUpperCase();
  }
  // İsteğe bağlı: SP grubunu US olarak göstermek isterseniz:
  if(groupName === 'SP') groupName = 'US'; 

  // 3. İsim ve Sektör
  const name = c?.name || ticker;
  // Türkçe sektör varsa onu, yoksa İngilizceyi, yoksa boş
  const secText = c?.sector_tr || c?.sector || "";
  const sector = secText ? `• ${secText}` : "";

  // 4. HTML Güncellemeleri
  // Badge formatı: GROUP: TICKER (Örn: NYSE: AAPL)
  const pillEl = document.getElementById("tickerPill");
  if(pillEl) pillEl.innerText = `${groupName}: ${ticker}`;

  const titleEl = document.getElementById("companyTitle");
  if(titleEl) titleEl.innerText = name;

  const metaEl = document.getElementById("companyMeta");
  if(metaEl) metaEl.innerText = c ? `${groupName} ${sector}` : "Veri aranıyor...";

  const chartTitleEl = document.getElementById("chartTitle");
  if(chartTitleEl) chartTitleEl.innerText = `${name} Hisse Fiyatı`;

  // 5. Logo İşlemleri
  const logoEl = document.getElementById("companyLogo");
  const fbEl = document.getElementById("companyLogoFallback");
  const url = (c?.logourl || "").trim();

  if (logoEl && fbEl) {
      if (url){
        logoEl.src = url;
        logoEl.classList.remove("hidden");
        fbEl.classList.add("hidden");
        logoEl.onerror = () => {
          logoEl.classList.add("hidden");
          fbEl.classList.remove("hidden");
        };
      } else {
        logoEl.classList.add("hidden");
        fbEl.classList.remove("hidden");
      }
  }
}

function renderAbout(){
  const apiCompany = window.apiCompany || {};
  const c = window.currentCompany || {};
  const ticker = apiCompany.ticker || c.ticker || "-";

  // Başlık
  const titleEl = document.getElementById("detailTitle");
  if (titleEl) titleEl.textContent = `${c.name || apiCompany.name || ticker} (${ticker})`;

  // Sağ üst snapshot alanları
  const tickerVal = document.getElementById("tickerVal");
  if (tickerVal) tickerVal.textContent = ticker;

  const foundedEl = document.getElementById("foundedVal");
  const empEl = document.getElementById("empVal");
  const sectorEl = document.getElementById("sectorVal");
  const mcapEl = document.getElementById("mcapVal");

  const founded = apiCompany.founded || c.founded || "-";
  // R2 verisinde employees sayı gelebilir, formatlayalım
  let employees = apiCompany.employees || c.employees || "-";
  if(typeof employees === 'number') employees = employees.toLocaleString('tr-TR');

  // TR öncelikli sektör
  const sector = c.sector_tr || apiCompany.sector || c.sector || "-";

  if (foundedEl) foundedEl.textContent = founded;
  if (empEl) empEl.textContent = employees;
  if (sectorEl) sectorEl.textContent = sector;

  // --- Market Cap ---
  if (mcapEl){
    const mcapRaw =
      c?.market_cap ?? c?.marketcap ?? c?.mcap ?? c?.marketCap ??
      apiCompany?.market_cap ?? apiCompany?.marketcap ?? apiCompany?.mcap ?? apiCompany?.marketCap ??
      null;

    let n = Number(mcapRaw);

    if (!Number.isFinite(n) || n === 0) {
      const bm = getBenchmarkValue(ticker, ["Piyasa Değeri", "Market Cap"]);
      if (Number.isFinite(bm)) n = bm;
    }

    const sym = currencySymbolForTicker(ticker); // SP -> $, BIST -> ₺
    mcapEl.textContent = Number.isFinite(n) && n !== 0
      ? formatCompactWithSymbol(n, sym)
      : "-";
  }

  // Sol taraftaki açıklama metni
  const aboutEl = document.getElementById("aboutText");
  if (aboutEl) aboutEl.textContent = apiCompany.about || apiCompany.description || "-";
}


function isMoneyMetricType(type){
  const s = String(type || "").toLowerCase().trim();

  // ✅ PARA BİRİMİ ASLA EKLENMEYECEKLER (önce bunları ele)
  if (
    /devir|turnover|süre|sure|gün|gun|days|cycle|döngü|dongu/.test(s) ||         // Borç Devir Hızı, Stok Süresi, Nakit Döngüsü vb.
    /oran|ratio|marj|margin|%|percent/.test(s) ||                               // oran/marj
    /\broic\b|\broa\b|\broe\b|\bbeta\b/.test(s) ||                              // RO* / beta
    /pd\/dd|p\/b|f\/k|p\/e|fiyat\/satış|price\/sales/.test(s) ||                // çarpanlar
    /borç\/öz|debt\/equity/.test(s)                                             // Borç/Öz Kaynak
  ) return false;

  // ✅ PARA BİRİMİ EKLENECEKLER (whitelist / daha güvenli)
  if (
    /piyasa değeri|market cap/.test(s) ||
    /firma değeri|enterprise value/.test(s) ||
    /satış gelirleri|gelirler|revenue|sales/.test(s) ||
    /nakit ve nakit benzerleri|cash and cash equivalents/.test(s) ||
    /serbest nakit|free cash|fcf/.test(s) ||
    /net borç\b|net debt\b/.test(s) ||                 // dikkat: "borç devir" değil, net borç
    /özkaynak|equity/.test(s)
  ) return true;

  return false;
}
function isPercentMetricType(type){
  const s = String(type || "").toLowerCase().trim();
  return (
    /brüt kar marjı|brut kar marji/.test(s) ||
    /faaliyet k[âa]r marjı|faaliyet kar marji/.test(s) ||
    /\broic\b|\broa\b|\broe\b|\bwacc\b/.test(s) ||
    /satış büyümesi ttm|satis buyumesi ttm/.test(s) ||
    /faaliyet kar büyümesi ttm/.test(s)
  );
}
function isDaysMetricType(type){
  const s = String(type || "").toLowerCase().trim();
  return (
    /stok süresi|stok suresi/.test(s) ||
    /alacak süresi|alacak suresi/.test(s) ||
    /borç süresi|borc suresi/.test(s) ||
    /nakit döngüsü|nakit dongusu/.test(s)
  );
}


function getActiveFinancialTab(){
  const btn = document.querySelector("#financialTabs .tab-btn.active");
  return btn ? btn.dataset.tab : "ratios";
}

function toggleOverviewMetricsCard(tab){
  const card = document.getElementById("overviewMetricsCard");
  const wrap = document.getElementById("financialTableWrap");

  const t = tab || getActiveFinancialTab();

  if (card) card.style.display = (t === "ratios") ? "block" : "none";
  if (wrap) wrap.style.display = (t === "ratios") ? "none" : "block";
}



// ✅ YENİ: Oranları ve Market Cap'i Finansallardan Hesapla
// ✅ YENİ: Oranları ve Market Cap'i Finansallardan Hesapla
async function renderBenchmarksMetrics() {
    const listEl = document.getElementById("overviewMetricsList") || document.getElementById("metricsList");
    if (!listEl) return;

    // 1. Veri Kaynağı: apiFinancials
    const rows = Array.isArray(window.apiFinancials) ? window.apiFinancials : [];
    
    // Helper: Finansal tablodan değer bul (Büyük/küçük harf ve Türkçe karakter duyarsız)
    const findVal = (keys) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        const hit = rows.find(r => 
            keyList.some(k => String(r.item || "").toLowerCase().replace(/ı/g,'i') === k.toLowerCase().replace(/ı/g,'i'))
        );
        if (!hit) return null;
        // TTM varsa onu, yoksa value'yu al
        const val = hit.ttm !== undefined ? hit.ttm : hit.value;
        return safeNum(val);
    };

    // Listenizde kullanılan helperlar
    const pick = (keys) => findVal(keys);
    const asPct01 = (v) => v; // Değer zaten 0.52 formatında geliyor, işlem fmt içinde yapılıyor (*100)

    // --- MARKET CAP HESAPLAMA ---
    let mcapDisplay = "-";
    
    // A. Hisse Adedini Bul
    const shareKeys = ["Total Common Shares Outstanding", "Hisse Adedi", "Shares Outstanding (Basic)"];
    const shares = findVal(shareKeys);
    
    // B. Fiyatı Bul
    const { current } = derived52w || { current: 0 };
    const live = getLivePriceFromGlobal(currentTicker);
    const price = (live.cur !== null && live.cur > 0) ? live.cur : current;

    if (shares && price) {
        let finalShares = shares;

        // C. ADR (DRS) Kontrolü
        try {
            if (!window.__ADR_CACHE) {
                const path = `${window.FIN_DATA_BASE}/static/drs.json`;
                // Global proxyUrl varsa kullan
                const url = (typeof proxyUrl === 'function') ? proxyUrl(path) : path;
                const res = await fetch(url);
                if (res.ok) {
                    const rawAdr = await res.json();
                    window.__ADR_CACHE = {};
                    for (const [k, v] of Object.entries(rawAdr)) {
                        const p = v.split(':');
                        if (p.length === 2) window.__ADR_CACHE[k] = parseFloat(p[0]) / parseFloat(p[1]);
                    }
                }
            }

            const ratio = window.__ADR_CACHE ? window.__ADR_CACHE[currentTicker] : null;
            if (ratio && ratio > 0) {
                finalShares = shares / ratio;
            }
        } catch (e) { console.warn("ADR calc error", e); }

        const mcap = finalShares * price;
        const sym = currencySymbolForTicker(currentTicker);
        mcapDisplay = formatCompactWithSymbol(mcap, sym);

        // Header'daki Market Cap değerini de güncelle
        const headerMcap = document.getElementById("mcapVal");
        if (headerMcap) headerMcap.textContent = mcapDisplay;
    }

    // --- METRİK LİSTESİ (TAM LİSTE) ---
    const items = [
      { label:"F/K", cat:"Değerleme", v: pick(["F/K", "Fiyat/Kazanç", "PE Ratio"]), fmt:(v)=>v.toFixed(2), ok:(v)=>v>0 && v<20 },
        { label:"PD/DD", cat:"Değerleme", v: pick(["PD/DD", "Price to Book"]), fmt:(v)=>v.toFixed(2), ok:(v)=>v<3 },
        { label:"Cari Oran", cat:"Likidite", v: pick(["Cari Oran"]), fmt:(v)=>v.toFixed(2), ok:(v)=>v>=1.5 },
        { label:"Asit Test Oranı", cat:"Likidite", v: pick(["Asit Test Oranı"]), fmt:(v)=>v.toFixed(2), ok:(v)=>v>=1.0 },

        { label:"Brüt Kar Marjı", cat:"Kârlılık", v: asPct01(pick(["Brüt Kar Marjı"])), fmt:(v)=>(v*100).toFixed(1)+"%", ok:(v)=>v>=0.30 },
        { label:"Faaliyet Kar Marjı", cat:"Kârlılık", v: asPct01(pick(["Faaliyet Kâr Marjı","Faaliyet Kar Marjı"])), fmt:(v)=>(v*100).toFixed(1)+"%", ok:(v)=>v>=0.15 },

        { label:"ROA", cat:"Kârlılık", v: asPct01(pick(["ROA"])), fmt:(v)=>(v*100).toFixed(1)+"%", ok:(v)=>v>=0.05 },
        { label:"ROE", cat:"Kârlılık", v: asPct01(pick(["ROE"])), fmt:(v)=>(v*100).toFixed(1)+"%", ok:(v)=>v>=0.12 },
        { label:"ROIC", cat:"Kârlılık", v: asPct01(pick(["ROIC"])), fmt:(v)=>(v*100).toFixed(1)+"%", ok:(v)=>v>=0.10 },

        { label:"Borç / Öz Kaynak", cat:"Risk", v: pick(["Borç/Öz Kaynak","Borç / Öz Kaynak"]), fmt:(v)=>v.toFixed(2)+"x", ok:(v)=>v<=1.5 },

        { label:"Stok Devir Hızı", cat:"Verimlilik", v: pick(["Stok Devir Hızı"]), fmt:(v)=>v.toFixed(2), ok:(v)=>v>=4 },
        { label:"Alacak Devir Hızı", cat:"Verimlilik", v: pick(["Alacak Devir Hızı"]), fmt:(v)=>v.toFixed(2), ok:(v)=>v>=6 },
        { label:"Borç Devir Hızı", cat:"Verimlilik", v: pick(["Borç Devir Hızı"]), fmt:(v)=>v.toFixed(2), ok:(v)=>v>=6 },

        { label:"Nakit Döngüsü", cat:"Verimlilik", v: pick(["Nakit Döngüsü"]), fmt:(v)=>Math.round(v)+" gün", ok:(v)=>v<=60 },
    ];

    listEl.innerHTML = items.map(it => {
        const has = (it.v !== null && it.v !== undefined);
        const num = Number(it.v);
        const good = has ? it.ok(num) : null;

        const badgeText = (good === null) ? "—" : (good ? "GÜÇLÜ" : "ZAYIF");
        const badgeClass = (good === null) ? "badge" : (good ? "badge neon" : "badge");
        const display = has ? it.fmt(num) : "-";

        return `
      <div class="metric-row">
        <div class="flex flex-col">
          <span class="text-white text-sm font-semibold">${it.label}</span>
          <div class="mt-1"><span class="badge">${it.cat}</span></div>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-white font-extrabold text-sm tracking-wide">${display}</span>
          <span class="${badgeClass}">${badgeText}</span>
        </div>
      </div>
    `;
    }).join("");

    toggleOverviewMetricsCard(getActiveFinancialTab());
}



/* Mini bar chart: son 4 dönem Gelir & Kâr */
function renderMiniBars(){
  const wrap = document.getElementById("miniBarsWrap");
  if (!wrap) return;

  const rows = Array.isArray(window.apiFinancials) ? window.apiFinancials : [];
  if (!rows.length){
    wrap.innerHTML = `<div style="text-align:center; padding:18px; color:#666; font-weight:900; width:100%;">Finansallar yükleniyor...</div>`;
    return;
  }

  const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/ı/g,"i").replace(/ğ/g,"g").replace(/ü/g,"u").replace(/ş/g,"s").replace(/ö/g,"o").replace(/ç/g,"c")
    .trim();

const findRow = (type, keys) => rows.find(r => {
  if (r.type !== type) return false;
  const item = norm(r.item);
  return keys.some(k => item.includes(norm(k)));
});


  const rev = findRow("income", ["revenue", "sales", "ciro", "hasılat", "Satış Gelirleri"]);
  const prof = findRow("income", ["net income", "net profit", "net", "kar", "Dönem Karı (Zararı)"]);

  if (!rev || !prof){
    wrap.innerHTML = `<div style="text-align:center; padding:18px; color:#666; font-weight:900; width:100%;">Gelir/Kâr verisi bulunamadı.</div>`;
    return;
  }

  const keys = ["tminus3","tminus2","tminus1","ttm"];
  const labels = ["D-3","D-2","D-1","TTM"];

  const revVals = keys.map(k => Number(rev[k]));
  const profVals = keys.map(k => Number(prof[k]));

  const maxRev = Math.max(...revVals.map(v => Number.isFinite(v) ? Math.abs(v) : 0), 1);
  const maxProf = Math.max(...profVals.map(v => Number.isFinite(v) ? Math.abs(v) : 0), 1);

  wrap.innerHTML = labels.map((lb, i)=>{
    const r = revVals[i];
    const p = profVals[i];

    const rh = Number.isFinite(r) ? Math.max(4, Math.round((Math.abs(r)/maxRev)*96)) : 4;
    const ph = Number.isFinite(p) ? Math.max(4, Math.round((Math.abs(p)/maxProf)*96)) : 4;

    const pCls = (!Number.isFinite(p)) ? "profit" : (p < 0 ? "profit neg" : "profit");

    return `
      <div class="mini-col">
        <div class="mini-bars-stack">
          <div class="mini-bar" style="height:${rh}px"></div>
          <div class="mini-bar ${pCls}" style="height:${ph}px"></div>
        </div>
        <div class="mini-label">${lb}</div>
      </div>
    `;
  }).join("");
}


function renderNews(){
  const container = document.getElementById("newsList");
  if (!container) return;

  if (!Array.isArray(apiNews) || !apiNews.length){
    container.innerHTML = `<div class="p-4 text-sm text-[#888] font-semibold">Haber yok.</div>`;
    requestSendHeight(false);
    return;
  }

  const fmtDate = (tsSec) => {
    const d = new Date(Number(tsSec || 0) * 1000);
    if (!Number.isFinite(d.getTime())) return "-";
    return d.toLocaleDateString("tr-TR", { day:"2-digit", month:"short", year:"numeric" });
  };

  container.innerHTML = apiNews.map(n => {
    const dateText = n?.ts ? fmtDate(n.ts) : (n?.date || "");
    const url = String(n?.link || "").trim();
    const isValid = !!url && url !== "#";
    const senti = String(n?.sentiment || "").trim();

    return `
      <a href="${isValid ? url : "javascript:void(0)"}" class="news-item group" ${isValid ? 'target="_blank" rel="noopener"' : ""}>
        <div class="flex justify-between items-center mb-1">
          <span class="text-[10px] text-[#888] font-extrabold uppercase tracking-widest">${n?.source || "Kaynak"}</span>
          <span class="text-[10px] text-[#555] font-black uppercase tracking-widest">${dateText}</span>
        </div>
        <div class="text-[#ddd] text-xs font-semibold leading-snug group-hover:text-[#c2f50e] transition-colors">
          ${n?.title || "-"}
        </div>
        ${senti ? `<div class="mt-2"><span class="badge neon">${senti}</span></div>` : ``}
      </a>
    `;
  }).join("");

  requestSendHeight(false);
}


function renderFinancialTable(tabName){
  const tbody = document.getElementById("financialsBody");
  // ✅ Genel Bakış (ratios) sekmesinde financial ratios tablosunu göstermiyoruz
if (tabName === "ratios") {
  tbody.innerHTML = "";
  requestSendHeight(false);
  return;
}


  const rows = (Array.isArray(apiFinancials) ? apiFinancials : [])
  .filter(i => i.type === tabName)
  .map((r, idx) => ({ ...r, __idx: idx })); // ✅ API sırasını korumak için

  // ✅ order_no ile sırala (yoksa en sona at)
const sorted = rows.slice().sort((a, b) => {
  const ao = Number(a?.order_no ?? a?.orderNo ?? a?.orderno);
  const bo = Number(b?.order_no ?? b?.orderNo ?? b?.orderno);

  const aHas = Number.isFinite(ao);
  const bHas = Number.isFinite(bo);

  if (aHas && bHas) return ao - bo;
  if (aHas && !bHas) return -1;
  if (!aHas && bHas) return 1;

  // ✅ order yoksa: API sırası
  return (a?.__idx ?? 0) - (b?.__idx ?? 0);
});



  if (!rows.length){
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:18px; color:#666; font-weight:900;">Veri yok.</td></tr>`;
    requestSendHeight(false);
    return;
  }

  tbody.innerHTML = sorted.map(r => `
    <tr>
      <td>${r.item || "-"}</td>
      <td style="color:#c2f50e; font-weight:900">${formatFinancial(r.ttm, r.value_type)}</td>
      <td>${formatFinancial(r.tminus1, r.value_type)}</td>
      <td>${formatFinancial(r.tminus2, r.value_type)}</td>
      <td>${formatFinancial(r.tminus3, r.value_type)}</td>
    </tr>
  `).join("");

  requestSendHeight(false);
}

/* ============================
   CHART + 52W
============================ */
function buildFullChartFromHistory(history){
  // R2 verisi: { t: 1104762600, c: 17.08, ... }
  // Eski API verisi: { date: "01012023", price: "12.5" }
  
  const cleaned = (Array.isArray(history) ? history : [])
    .map(p => {
        // Yeni format (R2) kontrolü
        if (p.t !== undefined && p.c !== undefined) {
            return {
                // t saniye cinsinden geliyor, JS ms ister -> * 1000
                x: p.t * 1000, 
                y: Number(p.c)
            };
        }
        
        // Eski format (Fallback - Geri uyumluluk)
        const d = parseMMDDYYYY(p.date);
        const price = safeNum(p.price);
        if (d && price !== null) {
            return { x: d.getTime(), y: price };
        }
        return null;
    })
    .filter(p => p !== null)
    .sort((a,b) => a.x - b.x);

  chartFull.points = cleaned;
}

function calc52wFromPoints(points){
  if (!points || !points.length) return { low: 0, high: 0, current: 0 };

  // 1. Son verinin tarihini al (Referans noktası)
  const lastPoint = points[points.length - 1];
  const lastDate = lastPoint.x; 
  const current = lastPoint.y;

  // 2. 365 Gün (1 Yıl) öncesini hesapla (milisaniye cinsinden)
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  const cutOff = lastDate - oneYearMs;

  // 3. Sadece son 1 yıl içindeki noktaları tara
  let low = current;  // Başlangıç değerleri olarak şimdiki fiyatı ata
  let high = current;

  for (const p of points){
    // Tarih kontrolü: Eğer veri 1 yıldan eskiyse atla
    if (p.x < cutOff) continue;

    if (p.y < low) low = p.y;
    if (p.y > high) high = p.y;
  }

  return { low, high, current };
}

function render52w(){
  const { low, high, current } = derived52w || { low:0, high:0, current:0 };
  const denom = (high - low);
  let pct = denom > 0 ? ((current - low) / denom) * 100 : 0;
  pct = Math.max(0, Math.min(100, pct));

  document.getElementById("rangeFill").style.width = pct + "%";
  document.getElementById("rangeThumb").style.left = pct + "%";
  document.getElementById("currentPriceLabel").innerText = formatPrice(current);
  document.getElementById("lowPrice").innerText = formatPrice(low);
  document.getElementById("highPrice").innerText = formatPrice(high);

  // ✅ DÜZELTME: Para birimi simgesini merkezi fonksiyondan al
// ✅ DÜZELTME: Para birimi simgesini merkezi fonksiyondan al
  let sym = currencySymbolForTicker(currentTicker);

  // --- INDICATORS MAP KONTROLÜ ---
  if (window.__INDICATORS_MAP) {
      const indKey = String(currentTicker).toLowerCase();
      const indObj = window.__INDICATORS_MAP[indKey];
      
      // Eğer bu varlık bir gösterge ise (haritada varsa):
      if (indObj) {
          // Unit tanımlıysa onu kullan (örn: €), tanımlı değilse BOŞ string yap.
          // Böylece varsayılan $ veya ₺ mantığını ezeriz.
          sym = indObj.unit || "";
      }
  }
  // ---------------------------------------------------------

  // Canlı fiyatı veya mevcut fiyatı kullan
  const live = getLivePriceFromGlobal(currentTicker);
  const shownPrice = (live.cur !== null && live.cur > 0) ? live.cur : current;

  const hp = document.getElementById("headerPrice");
const hpVal = document.getElementById("headerPriceVal");
const hc = document.getElementById("headerCaret");

const priceText = (shownPrice ? sym + formatPrice(shownPrice) : "-");

// ✅ Yeni HTML varsa span’a yaz
if (hpVal) hpVal.innerText = priceText;

// ✅ Eski HTML varsa (tek div) ona yaz
else if (hp) hp.innerText = priceText;


// caret + renk (şirketler tablosu gibi)
let ch = null;
if (live.cur !== null && live.prev !== null && live.prev > 0) {
  ch = ((live.cur - live.prev) / live.prev) * 100;
}

const isUp = (ch !== null && ch > 0);
const isDown = (ch !== null && ch < 0);

// headerPrice rengi
if (hp) {
  hp.style.color = isUp ? "#c2f50e" : (isDown ? "#ff4d4d" : "#ffffff");
}

// caret ikonu
if (hc) {
  if (ch === null || ch === 0) {
    hc.classList.add("hidden");
    hc.innerHTML = "";
  } else {
    hc.classList.remove("hidden");
    hc.innerHTML = isUp
      ? '<i class="fa-solid fa-caret-up"></i>'
      : '<i class="fa-solid fa-caret-down"></i>';
  }
}


  // Değişim yüzdesi
  const el = document.getElementById("headerChange");
const elIcon = document.getElementById("headerTrendIcon");
const elVal = document.getElementById("headerChangeVal");

if (el){
  if (ch !== null){
    el.style.visibility = "visible";
    el.style.color = isUp ? "#c2f50e" : (isDown ? "#ff4d4d" : "#bdbdbd");
    if (elIcon) elIcon.className = `fa-solid ${isUp ? "fa-arrow-trend-up" : (isDown ? "fa-arrow-trend-down" : "fa-minus")}`;
    if (elVal) elVal.innerText = `${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%`;
  } else {
    el.style.visibility = "hidden";
  }
}

}

function lockChartWheel(){
  const el = document.querySelector("#priceChart");
  if (!el) return;
  el.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });
}

function getRangeSlice(rangeKey){
  const pts = chartFull.points || [];
  const n = pts.length;
  if (!n) return { points: [] };

  const last = (k) => {
    const take = Math.max(1, Math.min(n, k));
    return { points: pts.slice(n - take) };
  };

  if (rangeKey === "1M") return last(21);
  if (rangeKey === "3M") return last(63);
  if (rangeKey === "6M") return last(126);
  // 1Y varsayılan (yaklaşık 252 işlem günü)
  if (rangeKey === "1Y") return last(252);
  
  // MAX ve diğerleri için hepsi
  return { points: pts };
}

function tickAmountForRange(rangeKey){
  // screenshot gibi: az ama düzenli
  if (rangeKey === "1M") return 5;
  if (rangeKey === "3M") return 6;
  if (rangeKey === "6M") return 7;
  return 7; // 1Y
}

function ensureChart(rangeKey){
  activeRange = rangeKey;
  const pack = getRangeSlice(rangeKey);
  const el = document.querySelector("#priceChart");
  if (!el) return;

  if (!pack.points || pack.points.length === 0){
    el.innerHTML = `<div style="padding:16px; color:#777; font-weight:900;">Fiyat verisi yok.</div>`;
    requestSendHeight(false);
    return;
  }

  const tickAmount = tickAmountForRange(rangeKey);

  const options = {
    series: [{ name: "Fiyat", data: pack.points }],
    chart: {
      type: "area",
      height: 300,
      fontFamily: "Inter",
      toolbar: { show: false },
      background: "transparent",
      zoom: { enabled: false },
      pan: { enabled: false }
    },
    theme: { mode: "dark" },
    colors: ["#c2f50e"],
    stroke: { curve: "smooth", width: 2 },
    fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.06, stops: [0, 85, 100] } },
    dataLabels: { enabled: false },
    grid: { borderColor: "rgba(255,255,255,0.06)", strokeDashArray: 4, padding: { left: 10, right: 10 } },
    xaxis: {
      type: "datetime",
      tickAmount,
      labels: {
        rotate: -45,
        rotateAlways: true,
        hideOverlappingLabels: true,
        showDuplicates: false,
        style: { colors: "#ffffff", fontWeight: 800 },
        formatter: (val) => fmtISODate(val)
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: { colors: "#ffffff", fontWeight: 800 },
        formatter: (v) => Number(v).toFixed(2)
      }
    },
    tooltip: { theme: "dark", x: { formatter: (val) => fmtISODate(val) } },
    markers: { size: 0 },
    legend: { show: false }
  };

  try{
    if (!chartInstance){
      el.innerHTML = ""; // placeholder temizle
      chartInstance = new ApexCharts(el, options);
      requestAnimationFrame(() => {
        chartInstance.render().then(() => {
          requestSendHeight(true);
          setTimeout(() => requestSendHeight(true), 250);
        });
      });
    } else {
      chartInstance.updateOptions({ xaxis: options.xaxis }, false, true);
      chartInstance.updateSeries([{ name: "Fiyat", data: pack.points }], true);
      requestSendHeight(false);
    }
  } catch(e){
    el.innerHTML = `<div style="padding:16px; color:#ff8888; font-weight:900;">Chart hatası: ${String(e && e.message ? e.message : e)}</div>`;
    requestSendHeight(true);
  }
}

/* ============================
   SEARCH (autocomplete from window.companies)
============================ */
function scoreMatch(q, c){
  // basit skorlama: ticker prefix > ticker contains > name contains
  const tq = q.toUpperCase();
  const t = String(c.ticker || "").toUpperCase();
  const n = String(c.name || "").toUpperCase();
  if (t.startsWith(tq)) return 3;
  if (t.includes(tq)) return 2;
  if (n.includes(tq)) return 1;
  return 0;
}

function renderSearchDropdown(query){
  const dd = document.getElementById("searchDD");
  const q = String(query || "").trim();
  const list = Array.isArray(window.companies) ? window.companies : [];

  if (!q || q.length < 1 || !list.length){
    dd.style.display = "none";
    dd.innerHTML = "";
    return;
  }

  const matches = list
    .map(c => ({ c, s: scoreMatch(q, c) }))
    .filter(x => x.s > 0)
    .sort((a,b) => b.s - a.s || String(a.c.ticker).localeCompare(String(b.c.ticker)))
    .slice(0, 10)
    .map(x => x.c);

  if (!matches.length){
    dd.style.display = "none";
    dd.innerHTML = "";
    return;
  }

  dd.innerHTML = matches.map(c => {
    const gl = groupLabel(c.group);
    const sec = c.sector ? c.sector : "—";
    return `
      <div class="dd-item" data-ticker="${String(c.ticker || "").toUpperCase()}">
        <div class="dd-left">
          <div class="dd-title">${c.name || c.ticker}</div>
          <div class="dd-sub">${gl} • ${sec}</div>
        </div>
        <div class="dd-right">
          <span class="badge">${gl}</span>
          <span class="dd-ticker">${String(c.ticker || "").toUpperCase()}</span>
        </div>
      </div>
    `;
  }).join("");

  dd.style.display = "block";
}

function hideSearchDropdown(){
  const dd = document.getElementById("searchDD");
  dd.style.display = "none";
  dd.innerHTML = "";
}

/* ============================
   LOAD FLOW (2 API)
============================ */
async function loadAll(ticker){
  const mySeq = ++loadSeq;
  currentTicker = sanitizeTicker(ticker);

  // header from companies list immediately
  renderHeaderFromCompanies(currentTicker);
  const tv = document.getElementById("tickerVal");
if (tv) tv.innerText = currentTicker;


  // placeholders
  setLoadingState(true);
  document.getElementById("aboutText").innerText = "Yükleniyor...";
  const om = document.getElementById("overviewMetricsList");
if (om){
  om.innerHTML = `<div style="text-align:center; padding:18px; color:#666; font-weight:900;">Metrikler yükleniyor...</div>`;
}
const mb = document.getElementById("miniBarsWrap");
if (mb){
  mb.innerHTML = `<div style="text-align:center; padding:18px; color:#666; font-weight:900; width:100%;">Finansallar yükleniyor...</div>`;
}

  document.getElementById("newsList").innerHTML = `<div class="p-4 text-sm text-[#888] font-semibold">Haberler yükleniyor...</div>`;
  document.getElementById("financialsBody").innerHTML =
    `<tr><td colspan="5" style="text-align:center; padding:18px; color:#666; font-weight:900;">Finansallar yükleniyor...</td></tr>`;

  // reset numeric UI
  document.getElementById("headerPrice").innerText = "-";
  document.getElementById("currentPriceLabel").innerText = "-";
  document.getElementById("lowPrice").innerText = "-";
  document.getElementById("highPrice").innerText = "-";
  document.getElementById("rangeFill").style.width = "0%";
  document.getElementById("rangeThumb").style.left = "0%";

  // reset state
  apiCompany = null;
  apiPriceHistory = [];
  apiNews = [];
  apiFinancials = [];
  window.apiCompany = {};
window.currentCompany = {};

  chartFull = { points: [] };
  derived52w = { low:0, high:0, current:0 };

  // destroy chart to avoid edge render issues
  if (chartInstance){
    try { chartInstance.destroy(); } catch(e){}
    chartInstance = null;
    const el = document.getElementById("priceChart");
    if (el) el.innerHTML = "";
  }

  try{
    // 1) comdetail: about + price_history + news
    const d = await fetchComDetail(currentTicker);
    if (mySeq !== loadSeq) return;

    apiCompany = d.company || {};
window.apiCompany = apiCompany;
window.currentCompany = findCompanyInList(currentTicker) || {};

apiPriceHistory = d.price_history || [];
// eski kaynak (varsa) fallback kalsın
apiNews = Array.isArray(d.news) ? d.news : [];

// ✅ NEW: ticker news (yeni endpoint)
try {
  const tn = await fetchLatestTickerNews(currentTicker);
  if (Array.isArray(tn) && tn.length) {
    apiNews = tn; // yeni formatı kullan
  }
} catch(e) {
  // sessizce geç (fallback d.news varsa zaten var)
}


// about
renderAbout();

    // --- YENİ: GÖSTERGE MODU KONTROLÜ (GRUP BAZLI) ---
    // Önce varlığı listede buluyoruz
    const cObj = findCompanyInList(currentTicker);
    
    // Sadece grubu BIST, NYSE, NASDAQ veya SP olanlar "Şirket" kabul edilir.
    // Diğerleri (Döviz, Emtia, Kripto vb.) listede olsa bile gösterge muamelesi görür.
    const stockGroups = ['bist', 'nyse', 'nasdaq', 'sp'];
    const isCompany = cObj && stockGroups.includes((cObj.group || '').toLowerCase());
    
    const cardAbout = document.getElementById("cardAbout");
    const cardFin = document.getElementById("cardFinancials");
    const cardSnap = document.getElementById("snapshotCard");

    if (cardAbout) cardAbout.style.display = isCompany ? "block" : "none";
    if (cardFin) cardFin.style.display = isCompany ? "flex" : "none";
    if (cardSnap) cardSnap.style.display = isCompany ? "block" : "none";
    // -------------------------------------


    // chart + 52w
    buildFullChartFromHistory(apiPriceHistory);
    derived52w = calc52wFromPoints(chartFull.points || []);
    render52w();
    ensureChart(activeRange || "1Y");

    // news + benchmarks
    renderNews();


    updateUrlTicker(currentTicker);
    requestSendHeight(true);

    // 2) comfinancials: table
    console.log("[DETAIL] financials call start", currentTicker);

try {
  const res = await fetchComFinancials(currentTicker);
  if (mySeq !== loadSeq) return;

  apiFinancials = (res && res.financials) ? res.financials : [];
  window.apiFinancials = apiFinancials;

  renderFinancialTable(getActiveTab());
  
  // ✅ VERİ GELDİKTEN SONRA METRİKLERİ VE MARKET CAP'İ HESAPLA
  if (typeof renderBenchmarksMetrics === "function") renderBenchmarksMetrics();
  
  if (typeof renderMiniBars === "function") renderMiniBars();
  if (typeof toggleOverviewMetricsCard === "function") toggleOverviewMetricsCard(getActiveTab());

  requestSendHeight(true);
  setTimeout(() => requestSendHeight(true), 150);

} catch (e) {
  if (mySeq !== loadSeq) return;

  document.getElementById("financialsBody").innerHTML =
    `<tr><td colspan="5" style="text-align:center; padding:18px; color:#ff8888; font-weight:900;">Finansal veri alınamadı.</td></tr>`;
  requestSendHeight(true);
}


  } catch(err){
    if (mySeq !== loadSeq) return;
    const msg = (err && err.message) ? err.message : "API hatası";
    document.getElementById("aboutText").innerText = "Veri alınamadı: " + msg;
    document.getElementById("newsList").innerHTML = `<div class="p-4 text-sm text-[#ff8888] font-semibold">Veri alınamadı.</div>`;
    document.getElementById("metricsList").innerHTML = `<div class="p-4 text-sm text-[#ff8888] font-semibold">Veri alınamadı.</div>`;
    document.getElementById("financialsBody").innerHTML =
      `<tr><td colspan="5" style="text-align:center; padding:18px; color:#ff8888; font-weight:900;">Veri alınamadı.</td></tr>`;
    requestSendHeight(true);
  } finally {
    if (mySeq === loadSeq) setLoadingState(false);
  }
}

/* ============================
   EVENTS
============================ */
function setActiveButtons(container, selector, matchFn){
  container.querySelectorAll(selector).forEach(btn => {
    const isActive = matchFn(btn);
    btn.classList.toggle("active", isActive);
    if (btn.getAttribute("role") === "tab"){
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    }
  });
}

function initTabs(){
  const tabs = document.getElementById("financialTabs");
  if (!tabs) return;

  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    const tab = btn.dataset.tab;
    setActiveButtons(tabs, "button[data-tab]", b => b.dataset.tab === tab);

    if (Array.isArray(apiFinancials) && apiFinancials.length) {
      renderFinancialTable(tab);
toggleOverviewMetricsCard(tab);
requestSendHeight(false);

    }
  });
}

function initRanges(){
  const rangeWrap = document.getElementById("rangeBtns");
  if (!rangeWrap) return;

  rangeWrap.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-range]");
    if (!btn) return;
    const range = btn.dataset.range;
    setActiveButtons(rangeWrap, "button[data-range]", b => b.dataset.range === range);
    ensureChart(range);
  });
}

function initSearch(){
  const inp = document.getElementById("tickerSearch");
  const btn = document.getElementById("searchBtn");   // artık opsiyonel
  const dd  = document.getElementById("searchDD");
  if (!inp || !dd) return; // ✅ buton yoksa da çalış

  const run = (t) => {
  const ticker = sanitizeTicker(t || inp.value);
  hideSearchDropdown();

  // ✅ kullanıcı aradıktan sonra input boşalsın
  inp.value = "";
  inp.blur();

  loadAll(ticker);
};


  // ✅ buton varsa bağla, yoksa sorun değil
  if (btn && !btn.__bound) {
    btn.__bound = true;
    btn.addEventListener("click", () => run());
  }

  // input / dropdown
  inp.addEventListener("input", () => renderSearchDropdown(inp.value));
  inp.addEventListener("focus", () => renderSearchDropdown(inp.value));

  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      run();
    }
    if (e.key === "Escape") {
      hideSearchDropdown();
      inp.blur();
    }
  });

  dd.addEventListener("click", (e) => {
    const item = e.target.closest(".dd-item");
    if (!item) return;
    const t = item.getAttribute("data-ticker");
    run(t);
  });

  document.addEventListener("click", (e) => {
    const within = e.target.closest(".search-wrap");
    if (!within) hideSearchDropdown();
  });
}


/* ============================
   BOOT
============================ */
function finDetailInit(){
if (!window.ApexCharts){
    document.getElementById("priceChart").innerHTML =
      `<div style="padding:16px; color:#ff8888; font-weight:900;">ApexCharts yüklenemedi (CSP/blocked).</div>`;
  }

  setYearHeaders();
  initTabs();
  initRanges();
  initSearch();
  lockChartWheel();

  const urlTicker = getTickerFromQuery();
  document.getElementById("tickerSearch").value = urlTicker;

  // default range 1Y active already
  //loadAll(urlTicker);

  requestSendHeight(true);
  setTimeout(() => requestSendHeight(true), 300);
}


/* ============================
   IFRAME RESIZER
============================ */
let lastSent = 0, scheduled = false;

function computeHeight(){
  const b = document.body;
  const de = document.documentElement;
  return Math.ceil(Math.max(
    b ? b.scrollHeight : 0,
    de ? de.scrollHeight : 0,
    b ? b.offsetHeight : 0,
    de ? de.offsetHeight : 0
  ));
}
function postHeight(force){
  const h = computeHeight();
  if (!force && Math.abs(h - lastSent) < 2) return;
  lastSent = h;
  if (window.parent && window.parent !== window){
    window.parent.postMessage({ type: "resize-iframe", height: h }, "*");
  }
}
function requestSendHeight(force){
  // ✅ Companies ekranı kendi içinde scroll ediyor.
  // ResizeObserver + iframe auto-height burada scroll'u bozuyor.
  if (document.querySelector('#view-companies.view-section.active')) return;

  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    postHeight(!!force);
  });
}

window.addEventListener("resize", () => requestSendHeight(false));
if ("ResizeObserver" in window){
  const ro = new ResizeObserver(() => requestSendHeight(false));
  ro.observe(document.documentElement);
}

// --- EXPORTS (for merged.html)
let __finDetailInited = false;
window.finDetailBootOnce = function(){
  if (__finDetailInited) return;
  __finDetailInited = true;

  try { finDetailInit(); } catch(e){ console.error('finDetailInit error', e); }

  // ✅ boot sonrası: storage/query'den ticker al ve 1 kere yükle
  try {
    const t = getTickerFromQuery();
    if (t && window.finDetailLoad) window.finDetailLoad(t);
  } catch(e){}
};

window.finDetailLoad = function(ticker){
  try { loadAll(ticker); } catch(e){ console.error('finDetailLoad error', e); }
};
window.finDetailRefreshHeaderPrice = function(){
  try { render52w(); } catch(e){}
};

window.finOpenDetail = function(ticker){
  const t = String(ticker||'').toUpperCase().trim();
  if (!t) return;

  // 1) ticker'ı kaydet
  try { localStorage.setItem('finapsis_detail_ticker', t); } catch(e){}

  // 2) sekmeye geç
  try { switchTab('detail'); } catch(e){}

  // 3) detail init (1 kere)
  try { window.finDetailBootOnce && window.finDetailBootOnce(); } catch(e){}

  // 4) ✅ EN ÖNEMLİ: detail zaten inited ise de yeni ticker'ı yükle
  setTimeout(() => {
    try { window.finDetailLoad && window.finDetailLoad(t); } catch(e){}
  }, 50);
};





})();


    // ============================================
    // SCREENER JAVASCRIPT
    // ============================================
    
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
        // ✅ 1. ADIM: Badgeleri HEMEN çiz (Veri beklemeye gerek yok, state var)
        try { scUpdateFilterBadges(); } catch(e){ console.error(e); }

        // 2. ADIM: Veri kontrolü ve Tablo çizimi
        const isMapLoaded = window.__FIN_MAP && Object.keys(window.__FIN_MAP).length > 0;

        if (isMapLoaded) {
            // A. Veri zaten var, direkt çiz.
            console.log("[Screener] Veri hazır, tablo çiziliyor.");
            // Badge'i burada tekrar çağırmıyoruz, yukarıda çağırdık.
            try { processScreenerData(); } catch(e) { console.error(e); }
            try { renderMetricsPool(); } catch(e) {}
            try { renderScreenerResults(); } catch(e) {}
            try { setupDragAndDrop(); } catch(e) {}
        } else {
            // B. Veri yok, indir.
            console.log("[Screener] Metrics indiriliyor...");
            
            // Kullanıcıya bir yükleniyor mesajı göster
            const tbody = document.getElementById('screener-results-body');
            if(tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:#666;"><div class="spinner" style="margin:0 auto 10px auto;"></div>Veriler Yükleniyor...</td></tr>';

            // İndirmeyi başlat
            finBuildMapForActiveGroup(() => {
                _renderScreenerUI(); // İndirme bitince her şeyi çiz
            });
        }
    }

    // ✅ YENİLENMİŞ & ETKİLEŞİMLİ BADGE SİSTEMİ
   // ✅ GÜNCELLENMİŞ BADGE RENDER FONKSİYONU
    // ✅ DÜZELTİLMİŞ & GARANTİ ÇALIŞAN BADGE FONKSİYONU
    // ✅ GÜNCELLENMİŞ & TAMİR EDİLMİŞ BADGE RENDER FONKSİYONU
    // ✅ GÜNCELLENMİŞ BADGE RENDER (ALT SEKTÖR EKLENDİ)
    function scUpdateFilterBadges() {
        const area = document.getElementById("scActiveFiltersArea");
        if(!area) return;

        // 1. Değişkenleri Hazırla
        let groupLabel = "BIST";
        if(window.activeGroup === 'nyse') groupLabel = "NYSE";
        if(window.activeGroup === 'nasdaq') groupLabel = "NASDAQ";

        const currentSec = window.scSectorSelection || "TÜMÜ";
        const hasSector = !!window.scSectorSelection;
        
        // Alt Sektör (Industry) Değişkenleri
        const currentInd = window.scIndustrySelection || "TÜMÜ";
        const hasIndustry = !!window.scIndustrySelection;

        const compLabel = (comparisonMode === 'global') ? 'GENEL' : 'SEKTÖR';
        const calcLabel = (calculationMethod === 'mean') ? 'ORTALAMA' : 'MEDYAN';

        // 2. HTML String Oluştur
        let html = '';

        // --- A. BORSA BADGE ---
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

        // --- B. SEKTÖR BADGE ---
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

        // --- C. ALT SEKTÖR BADGE (YENİ) ---
        // Sektör seçili değilse tıklanamaz (class: disabled)
        // class disabled için CSS eklemediysen opacity düşürürüz
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

        // --- D. KIYASLAMA BADGE ---
        html += `
            <div class="sc-badge" onclick="scToggleCompMode()" title="Kıyaslama: Sektör mü Genel mi?">
                <i class="fa-solid fa-scale-balanced"></i>
                KIYAS: <span style="color:#fff;">${compLabel}</span>
                <i class="fa-solid fa-rotate" style="font-size:9px; opacity:0.5; margin-left:4px;"></i>
            </div>
        `;

        // --- E. HESAPLAMA BADGE ---
        html += `
            <div class="sc-badge" onclick="scToggleCalcMethod()" title="Hesaplama: Ortalama mı Medyan mı?">
                <i class="fa-solid fa-calculator"></i>
                HESAP: <span style="color:#fff;">${calcLabel}</span>
                <i class="fa-solid fa-rotate" style="font-size:9px; opacity:0.5; margin-left:4px;"></i>
            </div>
        `;

        // --- F. SIFIRLA BUTONU ---
        html += `
            <div class="sc-badge reset-btn" onclick="resetApp()" title="Tüm filtreleri temizle">
                <i class="fa-solid fa-rotate-left"></i> SIFIRLA
            </div>
        `;

        area.innerHTML = html;
    }function _renderScreenerUI() {
    try { processScreenerData(); } catch(e) { console.error(e); }
    try { renderMetricsPool(); } catch(e) {}
    try { renderScreenerResults(); } catch(e) {}
    try { setupDragAndDrop(); } catch(e) {}
    
    // ✅ EKSİK PARÇA: UI ilk açıldığında badge'leri çiz!
    try { scUpdateFilterBadges(); } catch(e) { console.error("Badge hatası:", e); }
}
// --- YENİ ETKİLEŞİM FONKSİYONLARI ---

    // 1. Kıyaslama Modunu Değiştir (Sektör <-> Genel)
    function scToggleCompMode() {
        const newMode = (comparisonMode === 'sector') ? 'global' : 'sector';
        setComparisonMode(newMode); // Mevcut fonksiyonu kullanıyoruz, o zaten badge'i güncelliyor
    }

    // 2. Hesaplama Yöntemini Değiştir (Medyan <-> Ortalama)
    function scToggleCalcMethod() {
        const newMethod = (calculationMethod === 'median') ? 'mean' : 'median';
        setCalcMethod(newMethod);
    }

    // 3. Market Popup Aç/Kapa
    function scToggleMarketPopup(e) {
        if(e) e.stopPropagation();
        const pop = document.getElementById("scMarketPopup");
        if(pop) {
            // Diğer popupları kapat
            scCloseSectorPopup();
            
            const isVisible = pop.style.display === "block";
            pop.style.display = isVisible ? "none" : "block";
        }
    }

    function processScreenerData() {
        // Eski 'window.benchmarks' dizisi artık yok. 
        // Veriler 'window.__FIN_MAP' içinde hazır (ticker -> {Metric: Value}).
        
        const map = window.__FIN_MAP || {};
        
        // Metrik tanımlarını hızlı erişim için haritala
        const defMap = {};
        METRIC_DEFINITIONS.forEach(m => defMap[m.dataKey] = m);

        // Sadece aktif gruba ait şirketleri al ve metriklerle birleştir
        processedData = window.companies
            .filter(c => c.group === activeGroup) 
            .map(comp => {
                const ticker = comp.ticker;
                
                // Bu şirketin metriklerini al (Yoksa boş obje)
                // __FIN_MAP zaten temizlenmiş sayısal değerler içeriyor
                const rawMetrics = map[ticker] || {};
                const preparedMetrics = {};

                // Screener mantığına göre bazı yüzde değerlerini 100 ile çarpmak gerekebilir
                // (Eski kodda 'val < 5 ise çarp' mantığı vardı, onu koruyalım)
                for (const [key, val] of Object.entries(rawMetrics)) {
                    if (val === null || val === undefined) continue;
                    
                    let finalVal = val;
                    const def = defMap[key];
                    
                    // Eğer metrik yüzde ise ve ham veri 0.15 (yani %15) gibi gelmişse, UI 15 bekliyor olabilir.
                    // Veri kaynağındaki formata göre burayı ayarlamak gerekebilir.
                    // Şimdilik eski mantığı (küçükse 100'le çarp) koruyoruz:
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

  const keyStr = `${activeGroup}|${keys.join(",")}`;
  if (__screenerStatsKey === keyStr) return;   // aynı metrik seti ise tekrar hesaplama
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

  // sector stats
  for (const sec in secValues){
    sectorStats[sec] = {};
    for (let i=0;i<keys.length;i++){
      const k = keys[i];
      if (secValues[sec][k]) sectorStats[sec][k] = getStats(secValues[sec][k]);
    }
  }

  // global stats
  for (let i=0;i<keys.length;i++){
    const k = keys[i];
    if (globValues[k]) globalStats[k] = getStats(globValues[k]);
  }
}


    function setComparisonMode(mode) {
        comparisonMode = mode;
        
        // Tablo başlığını güncelle (Varsa)
        const lbl = document.getElementById('comp-label');
        if(lbl) lbl.innerText = mode === 'sector' ? 'SEKTÖR' : 'GENEL';
        
        // Badge ve Tabloyu güncelle
        scUpdateFilterBadges(); 
        renderScreenerResults();
    }

    function setCalcMethod(method) {
        calculationMethod = method;
        
        // Tablo başlığını güncelle (Varsa)
        const lbl = document.getElementById('calc-label');
        if(lbl) lbl.innerText = method === 'mean' ? 'ORT' : 'MEDYAN';
        
        // Badge ve Tabloyu güncelle
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
    if (item.type === "Text") return fieldType === 'current' ? (item.text || "-") : (item.prev_text || "-");
    let val = (fieldType === 'current') ? indCleanNum(item.val) : indCleanNum(item.prev);
    if (val === null) return "-";
    let displayVal = (item.type === "Percentage") ? val * 100 : val;
    const digits = item.is4d ? 4 : 2;
    let formatted = displayVal.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return item.type === "Percentage" ? "%" + formatted : formatted;
};

window.indCls = function(n) {
    if (n === null || Math.abs(n) < 0.00000001) return "";
    return n > 0 ? "pos" : "neg";
};

window.indFormatDate = function(dateStr, isPeriodical) {
    if (!isPeriodical || !dateStr || !dateStr.includes('/')) return dateStr || "";
    const parts = dateStr.split('/');
    if (parts.length < 3) return dateStr;
    const aylar = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
    const ayIsmi = aylar[parseInt(parts[1]) - 1];
    const yilKisa = parts[2].toString().slice(-2);
    return `${ayIsmi}/${yilKisa}`;
};

// Göstergeler Filtre State
window.indFilterState = {
    group: "all" // Varsayılan: Hepsi
};

// ✅ GÖSTERGELER: ÜST GRUP BADGE SATIRI (PILL)
// Map formatın: { usdtry:{...}, eurtry:{...} }  (flat object)
// (Eski wrapper formatı gelirse {map:{...}}'i de destekliyoruz)
window.indUpdateBadge = function () {
  const area = document.getElementById("indBadgeArea");
  if (!area || !window.__INDICATORS_MAP) return;

  const root = window.__INDICATORS_MAP || {};
  const mapObj = (root && typeof root === "object" && root.map && typeof root.map === "object")
    ? root.map
    : root;

  const items = Object.entries(mapObj).map(([k, v]) => ({ key: String(k), v: (v || {}) }));

  // grup listesi (order ile)
  const groupMap = new Map();
  for (const it of items) {
    const g = (it.v.group || "").trim();
    if (!g) continue;
    const order = (it.v.group_order_no ?? 9999);
    if (!groupMap.has(g)) groupMap.set(g, order);
    else groupMap.set(g, Math.min(groupMap.get(g), order));
  }

  const groups = Array.from(groupMap.entries())
    .sort((a, b) => (a[1] - b[1]) || a[0].localeCompare(b[0], "tr"));

  const active = (window.indFilterState?.group || "all");

  const badges = [];
  badges.push(`
    <div class="ind-badge ${active === "all" ? "active" : ""}" data-g="all">
      TÜMÜ
    </div>
  `);

  for (const [g] of groups) {
    badges.push(`
      <div class="ind-badge ${active === g ? "active" : ""}" data-g="${g}">
        ${g}
      </div>
    `);
  }

  area.innerHTML = badges.join("");

  area.querySelectorAll(".ind-badge").forEach((btn) => {
    btn.onclick = () => {
      const g = btn.getAttribute("data-g") || "all";
      window.indFilterState.group = g;

      // tabloyu yeniden çiz
      if (typeof window.renderIndicators === "function") window.renderIndicators();

      // active class refresh
      window.indUpdateBadge();
    };
  });
};




window.indToggleGroupPopup = function(e) {
    if(e) e.stopPropagation();
    const pop = document.getElementById("indGroupPopup");
    if(pop) {
        const isVisible = pop.style.display === "block";
        pop.style.display = isVisible ? "none" : "block";
    }
};

window.indSelectGroup = function(g) {
    window.indFilterState.group = g;
    document.getElementById("indGroupPopup").style.display = "none";
    indUpdateBadge();
    if (typeof window.renderIndicators === "function") window.renderIndicators();
};

// Dışarı tıklama kapatması
document.addEventListener("click", () => {
    const pop = document.getElementById("indGroupPopup");
    if(pop) pop.style.display = "none";
});

// (Eski window.indicatorsData satırlarını sildik çünkü artık yukarıdan geliyor)

window.renderIndicators = function() {
    indUpdateBadge();
    const tbody = document.getElementById("indicators-tbody");
    if (!tbody || !window.__INDICATORS_MAP || !window.__INDICATORS_SUMMARY) return;

const map = window.__INDICATORS_MAP;

// ✅ summary artık { asOf, items }
const summaryObj = window.__INDICATORS_SUMMARY || { asOf: null, items: [] };
const summaryArr = Array.isArray(summaryObj.items) ? summaryObj.items : [];

// ✅ "Son güncelleme" yaz
const asOfEl = document.getElementById("indAsOf");
if (asOfEl) asOfEl.textContent = `Son güncelleme: ${summaryObj.asOf || "-"}`;


    

    // --- 1. MADDE: DINAMIK TARIH FORMATLAMA ---
    const formatDate = (dateStr, format) => {
  if (dateStr === null || dateStr === undefined) return "-";
  const s = String(dateStr).trim();
  if (!s || s === "-" || s.toLowerCase() === "null") return "-";

  // ✅ Senin yeni standardın: DD/MM/YYYY
  // (cd/pd artık böyle geliyor dedin)
  // ✅ Standard: dd-mm-yyyy (summary.v1.json)
// Ayrıca dd/mm/yyyy ve dd.mm.yyyy de destekle
let d = null;

// normalize: 28/01/2026 -> 28-01-2026, 28.01.2026 -> 28-01-2026
const norm = s.replaceAll("/", "-").replaceAll(".", "-");

// dd-mm-yyyy
let m = norm.match(/^(\d{2})-(\d{2})-(\d{4})$/);
if (m) {
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const yyyy = parseInt(m[3], 10);
  d = new Date(yyyy, mm - 1, dd);
} else {
  // fallback (ISO gibi)
  const tryD = new Date(s);
  if (!isNaN(tryD.getTime())) d = tryD;
}


  if (!d || isNaN(d.getTime())) return s;

  const dd = String(d.getDate()).padStart(2, "0");
  const mm2 = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();

  // MMM için: tr kısa ay ismi (Oca, Şub, Mar...) - sondaki noktayı kırp
  const MMM = new Intl.DateTimeFormat("tr-TR", { month: "short" })
    .format(d)
    .replace(".", "");

  const f = String(format || "dd/mm/yyyy").trim().toLowerCase();

  // ✅ indicatorsmap.json'dan gelen date_format destekleri
  if (f === "mmm-yyyy") return `${MMM}-${yyyy}`;
  if (f === "mm-yyyy")  return `${mm2}-${yyyy}`;
  if (f === "yyyy")     return `${yyyy}`;

  if (f === "dd-mm-yyyy") return `${dd}-${mm2}-${yyyy}`;
  if (f === "dd.mm.yyyy") return `${dd}.${mm2}.${yyyy}`;

  // default: senin standart formatın
  return `${dd}/${mm2}/${yyyy}`;
};

    const formatInd = (val, info) => {
        if (val === null || val === undefined || isNaN(val)) return "-";
        let n = parseFloat(val);
        if (info.value_type === "percentage") {
            return "%" + (n * 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        const digits = info.is4d ? 4 : 2;
        return n.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits }) + (info.unit ? " " + info.unit : "");
    };

    const getDiff = (v1, v2, info) => {
        if (v1 == null || v2 == null || v2 === 0 || isNaN(v1) || isNaN(v2)) return { txt: "-", cls: "" };
        const diff = v1 - v2;
        const pct = (diff / Math.abs(v2)) * 100;
        const isPos = diff > 0.00000001;
        const isNeg = diff < -0.00000001;
        const icon = isPos ? '<i class="fa-solid fa-caret-up"></i>' : (isNeg ? '<i class="fa-solid fa-caret-down"></i>' : '');
        const color = isPos ? 'var(--finapsis-neon)' : (isNeg ? 'var(--finapsis-red)' : '#aaa');
        
        return { 
            txt: `<div style="color:${color}; font-weight:700;">${icon} %${Math.abs(pct).toFixed(2)}</div>
                  <div style="font-size:10px; opacity:0.7;">${isPos ? '+' : ''}${formatInd(diff, info)}</div>`,
            cls: isPos ? "pos" : (isNeg ? "neg" : "")
        };
    };

    const getS = (id) => (summaryArr.find(x => x.i === id)?.v) || {};

// last kalktı: “anlık değer” zaten summary.cv / summary.cd
const getL = (id) => {
  const s = getS(id);
  return { value: s.cv, date: s.cd };
};

const usd_l = parseFloat(getL("usdtry").value);
const usd_s = getS("usdtry");

const eur_l = parseFloat(getL("eurusd").value);
const eur_s = getS("eurusd");

const gbp_l = parseFloat(getL("gbpusd").value);
const gbp_s = getS("gbpusd");

    // Tüm öğeleri topla ve filtrele
    let allItems = [];
    Object.keys(map).forEach(key => {
        const info = map[key];
        // GRUP FİLTRESİ
        if (window.indFilterState.group !== "all" && info.group !== window.indFilterState.group) return;

        const s = getS(key);

// Tek kaynak: summary
let cv = s.cv;
let cd = s.cd;

        let pv = s.pv;
        let pd = s.pd;
        let ytdv = s.ytdv;
        let tm12v = s.tm12v;

        if (key === "eurtry") {
            if (usd_l && eur_l) { cv = usd_l * eur_l; cd = getL("usdtry").date; }
            if (usd_s.pv && eur_s.pv) { pv = usd_s.pv * eur_s.pv; pd = usd_s.pd; }
            if (usd_s.ytdv && eur_s.ytdv) ytdv = usd_s.ytdv * eur_s.ytdv;
            if (usd_s.tm12v && eur_s.tm12v) tm12v = usd_s.tm12v * eur_s.tm12v;
        }
        if (key === "gbptry") {
            if (usd_l && gbp_l) { cv = usd_l * gbp_l; cd = getL("usdtry").date; }
            if (usd_s.pv && gbp_s.pv) { pv = usd_s.pv * gbp_s.pv; pd = usd_s.pd; }
            if (usd_s.ytdv && gbp_s.ytdv) ytdv = usd_s.ytdv * gbp_s.ytdv;
            if (usd_s.tm12v && gbp_s.tm12v) tm12v = usd_s.tm12v * gbp_s.tm12v;
        }

        allItems.push({ id: key, ...info, cv, cd, pv, pd, ytdv, tm12v });
    });

    // Önce Grup Sırasına (group_order_no), sonra öğe sırasına (order_no) göre diz
    allItems.sort((a, b) => {
        if (a.group_order_no !== b.group_order_no) return a.group_order_no - b.group_order_no;
        return (a.order_no || 0) - (b.order_no || 0);
    });

   tbody.innerHTML = allItems.map(item => {
        const d1 = getDiff(item.cv, item.pv, item);
        const dYtd = getDiff(item.cv, item.ytdv, item);
        const dY12 = getDiff(item.cv, item.tm12v, item);
        
        const priceColor = d1.cls === "pos" ? "var(--finapsis-neon)" : (d1.cls === "neg" ? "var(--finapsis-red)" : "#fff");
        const iconBg = d1.cls === 'pos' ? 'rgba(194, 245, 14, 0.15)' : (d1.cls === 'neg' ? 'rgba(255, 77, 77, 0.15)' : 'rgba(255, 255, 255, 0.05)');

        // Tıklama olayı (Varlık Detaya git) ve cursor:pointer eklendi
        return `
        <tr onclick="finOpenDetail('${item.id}')" style="cursor:pointer;">
            <td style="width: 250px;"> <div class="company-cell">
                    <div class="indicator-icon" style="background:${iconBg}; color:${priceColor};">
                        <div style="font-weight:900; font-size:11px;">${item.badge || ""}</div>
                    </div>
                    <div class="name-wrap">
                        <div class="company-name">${item.label}</div>
                    </div>
                </div>
            </td>
            <td style="font-weight:700; text-align:right;">
  <div style="color:${priceColor}; font-weight:600;">
    ${formatInd(item.cv, item)}
  </div>
  <div style="font-size:9px; color:#9CA3AF;">
    ${formatDate(item.cd, item.date_format)}
  </div>
</td>

            <td class="muted" style="font-size:14px; text-align:right;">
                <div style="color:#eee; font-weight:600;">${formatInd(item.pv, item)}</div>
                
                <div style="font-size:9px; opacity:0.5;">${formatDate(item.pd, item.date_format)}</div>
                
            </td>
            <td style="text-align:right;">${d1.txt}</td>
            <td style="text-align:right;">${dYtd.txt}</td>
            <td style="text-align:right;">${dY12.txt}</td>
        </tr>`;
    }).join("");
};
window.dgToggleIndGroup = function(gId) {
    const rows = document.querySelectorAll(`.${gId}`);
    const groupRow = rows[0].previousElementSibling;
    const isCollapsed = groupRow.classList.toggle("collapsed");
    rows.forEach(r => r.style.display = isCollapsed ? "none" : "table-row");
};// ============================================
// CALENDAR LIST FILTER LOGIC (FIXED)
// ============================================

// 1. EKSİK OLAN YARDIMCI FONKSİYONLAR (HATA BURADAYDI)
window.calCheckPastDate = function(dateStr) {
    if(!dateStr) return false;
    return new Date(dateStr) < new Date();
};

window.calGetImpactSVG = function(level) {
    let html = '<div style="display:flex; gap:1px;">';
    for(let i=1; i<=3; i++) {
        const activeColor = i <= level ? '#c2f50e' : '#333';
        html += `<svg width="14" height="14" viewBox="0 0 24 24" fill="${activeColor}"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`;
    }
    return html + '</div>';
};

// 2. VERİ YÜKLEYİCİ
// ============================================
// CALENDAR LIST (R2)
// ============================================
window.__CAL_LIST_PROMISE = window.__CAL_LIST_PROMISE || null;

function __calPad2(n){ return String(n).padStart(2,'0'); }

// epoch seconds -> "30/01/2026 - 13:05 Cuma" (TR)
function __calDateFullTR(epochSec){
  try{
    const d = new Date(epochSec * 1000);
    const dd = __calPad2(d.getDate());
    const mm = __calPad2(d.getMonth()+1);
    const yyyy = d.getFullYear();
    const hh = __calPad2(d.getHours());
    const mi = __calPad2(d.getMinutes());
    const dow = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"][d.getDay()];
    return `${dd}/${mm}/${yyyy} - ${hh}:${mi} ${dow}`;
  } catch(e){
    return "";
  }
}

function __calNormalizeFromR2(doc){
  // R2 format: { asOf, range:{from,to}, items:[{id,t,cc,imp,n,e,a,p,u}] }
  const arr = Array.isArray(doc?.items) ? doc.items : [];
  return arr.map(x => {
    const t = Number(x?.t || 0) || 0; // epoch seconds (IST->UTC çevrilmiş olabilir ama UI sadece sıralama/filter için kullanıyor)
    const iso = x?.u ? String(x.u) : (t ? new Date(t*1000).toISOString() : "");
    return {
      id: String(x?.id || ""),
      country_code: String(x?.cc || "").toLowerCase(),
      impact: Number(x?.imp || 1) || 1,
      name: String(x?.n || ""),
      expected: String(x?.e || ""),
      actual: String(x?.a || ""),
      prev: String(x?.p || ""),
      timestamp: iso,                 // UI bunu Date(...) ile parse ediyor
      date_full: t ? __calDateFullTR(t) : ""  // UI’da gösterim için
    };
  });
}

// 2. VERİ YÜKLEYİCİ (R2'dan çekilecek)
window.finEnsureCalendarList = async function(force = false){
  // zaten yüklendiyse çık
  if (!force && window.__CALENDAR_LIST_LOADED === true && Array.isArray(window.calendarList)) return;

  try {
    // FIN_DATA_BASE zaten kodun başka yerlerinde var varsayıyorum.
    const url = `${FIN_DATA_BASE}/calendar/latest.v1.json?ts=${Date.now()}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`calendar latest fetch failed: ${res.status}`);

    const payload = await res.json();

    // payload iki şekilde gelebilir:
    // 1) eski: [ {timestamp,country_code,impact,name,expected,actual,prev,...} ]
    // 2) yeni: { asOf, range, items:[ {id,t,cc,imp,n,e,a,p,u} ] }
    if (Array.isArray(payload)) {
      window.calendarList = payload;
    } else if (payload && Array.isArray(payload.items)) {
      window.calendarList = payload.items;
    } else {
      window.calendarList = [];
    }

    window.__CALENDAR_LIST_LOADED = true;

  } catch(e){
    console.error("Calendar load error:", e);
    window.calendarList = [];
    window.__CALENDAR_LIST_LOADED = true; // sonsuz deneme yapmasın diye
  }
};



// 3. STATE (Varsayılan: BUGÜN)
window.calListState = {
    time: 'today',    // ✅ Varsayılan: Bugün
    regions: [],      
    minImpact: 1,     
    search: ''        
};

// 4. FİLTRE FONKSİYONLARI
window.calListSetTime = function(period, btn) {
    window.calListState.time = period;
    // UI Güncelle
    const container = btn.parentElement;
    container.querySelectorAll('.cal-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderCalendarList();
};

window.calListSetImpact = function(level, e) {
    if(e) e.stopPropagation();
    window.calListState.minImpact = level;
    const el = document.getElementById("calImpactFilter");
    if(el) el.setAttribute("data-level", level);
    renderCalendarList();
};

window.calListToggleFilter = function(type, val, btn) {
    if (type !== 'region') return;
    const arr = window.calListState.regions;
    const idx = arr.indexOf(val);
    if (idx > -1) arr.splice(idx, 1);
    else arr.push(val);
    btn.classList.toggle('active');
    renderCalendarList();
};

window.calListSearch = function(val) {
    window.calListState.search = String(val).toLowerCase().trim();
    renderCalendarList();
};

// 5. TARİH HESAPLAMA
function calGetDateRange(period) {
    const now = new Date();
    // Saatleri sıfırla
    const start = new Date(now); start.setHours(0,0,0,0);
    const end = new Date(now); end.setHours(23,59,59,999);

    if (period === 'today') return { start, end };
    
    if (period === 'tomorrow') {
        start.setDate(now.getDate() + 1);
        end.setDate(now.getDate() + 1);
        return { start, end };
    }
    
    if (period === 'yesterday') {
        start.setDate(now.getDate() - 1);
        end.setDate(now.getDate() - 1);
        return { start, end };
    }


    // BU HAFTA (Pazartesi - Pazar) ✅ ay geçişi güvenli
if (period === 'this-week') {
    const day = now.getDay(); // 0(Pazar)..6(Cumartesi)
    const mondayOffset = (day === 0 ? -6 : 1 - day); // Pazartesiye kay
    start.setDate(now.getDate() + mondayOffset);

    // ✅ end'i start üzerinden üret (ay geçişi bug'ını bitirir)
    const end2 = new Date(start);
    end2.setHours(23,59,59,999);
    end2.setDate(start.getDate() + 6);

    return { start, end: end2 };
}


    // YENİ: BU AY (Ayın 1'i - Son günü)
    if (period === 'this-month') {
        start.setDate(1);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        return { start, end };
    }
    
    if (period === 'next-week') {
    const day = now.getDay();
    // sonraki haftanın Pazartesi'si:
    // Pazar(0) ise +1, diğer günler için + (8 - day)
    const diff = (day === 0 ? 1 : 8 - day);

    start.setDate(now.getDate() + diff);

    // ✅ end'i start üzerinden üret (ay geçişi güvenli)
    const end2 = new Date(start);
    end2.setHours(23,59,59,999);
    end2.setDate(start.getDate() + 6);

    return { start, end: end2 };
}


    if (period === 'prev-week') {
        const day = now.getDay();
        const diff = (day === 0 ? -6 : 1) - 7; 
        const lastWeek = new Date(now);
        lastWeek.setDate(now.getDate() - 7);
        const lwDay = lastWeek.getDay() || 7; 
        start.setTime(lastWeek.getTime());
        start.setDate(lastWeek.getDate() - lwDay + 1);
        end.setTime(start.getTime());
        end.setDate(start.getDate() + 6);
        return { start, end };
    }

    if (period === 'next-month') {
        start.setMonth(now.getMonth() + 1, 1); 
        end.setMonth(now.getMonth() + 2, 0);   
        return { start, end };
    }

    if (period === 'prev-month') {
        start.setMonth(now.getMonth() - 1, 1);
        end.setMonth(now.getMonth(), 0);
        return { start, end };
    }

    return null; // 'all'
}

// 6. RENDER
// 6. RENDER
window.renderCalendarList = async function() {
  await finEnsureCalendarList(); // ✅ artık async

  const tbody = document.getElementById("calendar-list-tbody");
  if(!tbody) return;

  let data = window.calendarList || [];
  const s = window.calListState;

  data = data.filter(item => {
    // ✅ eski/yeni şema uyumlu alanlar
    const tsStr = item.timestamp || item.u || (item.t ? new Date(item.t * 1000).toISOString() : null);
    const ts = tsStr ? new Date(tsStr) : new Date(0);

    const countryCode = (item.country_code || item.cc || "").toLowerCase();
    const impact = Number(item.impact ?? item.imp ?? 1);

    const name = (item.name || item.n || "");
    const txt = String(name).toLowerCase();

    // ✅ ARAMA: her zaman isim üzerinden çalışsın
    if (s.search) {
        if (!txt.includes(s.search)) return false;
        // NOT: arama varken zaman filtresi uygulanmasın istiyorsan buraya dokunmayız;
        // istersen aşağıdaki zaman filtresini "else" içine alırız.
    }

    // ZAMAN FİLTRESİ (arama yokken veya arama varken de çalışsın istiyorsan bu haliyle kalsın)
    if (!s.search && s.time !== 'all') {
        const range = calGetDateRange(s.time);
        if (range && (ts < range.start || ts > range.end)) return false;
    }

    // BÖLGE
    if (s.regions.length > 0) {
        if (!s.regions.includes(countryCode)) return false;
    }

    // ETKİ
    if (impact < s.minImpact) return false;

    return true;
});


  // ✅ sort: eski/yeni şema
  data.sort((a,b) => {
    const at = a.timestamp ? new Date(a.timestamp).getTime() : (a.t ? a.t * 1000 : 0);
    const bt = b.timestamp ? new Date(b.timestamp).getTime() : (b.t ? b.t * 1000 : 0);
    return at - bt;
  });

  if(data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:#666;">Seçilen kriterlere uygun etkinlik yok.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(c => {
    // ✅ eski/yeni şema uyumu
    const tsStr =
      c.timestamp
        ? c.timestamp
        : (c.t ? new Date(c.t * 1000).toISOString() : null);

    const impact = Number(c.impact ?? c.imp ?? 1);
    const countryCode = (c.country_code || c.cc || "").toLowerCase();

    const name = (c.name || c.n || "");
    const id = c.id;     
    const expected = (c.expected || c.e || "");
    const actual = (c.actual || c.a || "");
    const prev = (c.prev || c.p || "");

    const isPast = calCheckPastDate(tsStr);
    const flagUrl = countryCode ? `https://flagcdn.com/w40/${countryCode}.png` : '';
    const impactSVG = calGetImpactSVG(impact);

    return `
      <tr>
        <td>
          <div class="company-cell">
            <div style="width:38px; height:38px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); flex-shrink:0;">
              ${flagUrl ? `<img class="flag-img" src="${flagUrl}" alt="${countryCode}">` : `<span class="muted">—</span>`}
            </div>
            <div>
              <div class="data-name">${name}</div>
              <div class="date-sub ${isPast ? 'muted' : ''}">${tsStr ? new Date(tsStr).toLocaleString('tr-TR') : ''}</div>
            </div>
          </div>
        </td>
        <td>${impactSVG}</td>
        <td>${expected || '<span class="muted">—</span>'}</td>
        <td>${actual || '<span class="muted">—</span>'}</td>
        <td>${prev || '<span class="muted">—</span>'}</td>
        <td style="text-align:center;">
            <button
  class="notify-btn"
  ${isPast ? "disabled title='Etkinlik geçti'" : ""}
  onclick="${isPast ? "return false;" : `calOpenListModal('${String(c.id || "").replace(/'/g, "\\'")}')`}"
>
  <i class="fa-regular fa-bell"></i>
</button>
            
        </td>
      </tr>
    `;
  }).join("");
};

// ==========================================
    // ✅ KESİN ÇÖZÜM: GLOBAL TOGGLE FONKSİYONLARI
    // ==========================================

    // 1. Kıyaslama Modu (Sektör <-> Genel)
    window.scToggleCompMode = function() {
        // Mevcut mod neyse tersine çevir
        const current = window.comparisonMode || 'sector'; 
        const newMode = (current === 'sector') ? 'global' : 'sector';
        
        // Değişkeni güncelle
        window.comparisonMode = newMode;
        
        // Varsa eski fonksiyonu çağır, yoksa manuel güncelle
        if (typeof setComparisonMode === 'function') {
            setComparisonMode(newMode);
        } else {
            // Yedek plan: Fonksiyon yoksa bile badge'i güncelle
            try { scUpdateFilterBadges(); } catch(e){}
            try { renderScreenerResults(); } catch(e){}
        }
    };

    // 2. Hesaplama Modu (Medyan <-> Ortalama)
    window.scToggleCalcMethod = function() {
        const current = window.calculationMethod || 'median';
        const newMethod = (current === 'median') ? 'mean' : 'median';
        
        window.calculationMethod = newMethod;
        
        if (typeof setCalcMethod === 'function') {
            setCalcMethod(newMethod);
        } else {
            try { scUpdateFilterBadges(); } catch(e){}
            try { renderScreenerResults(); } catch(e){}
        }
    };

    // 3. Sektör Popup Aç/Kapa (Çakışma Korumalı)
    window.scToggleSectorPopup = function(e) {
        if(e) e.stopPropagation();

        // Diğer popupları kapat (Market popup vb.)
        const marketPop = document.getElementById("scMarketPopup");
        if(marketPop) marketPop.style.display = "none";

        // Bizim hedef popup'ı bul (Dinamik oluşturulanı)
        // scUpdateFilterBadges fonksiyonu çalıştığı için bu element DOM'da olmalı.
        const pop = document.getElementById("scSectorPopup");
        
        if(!pop) {
            console.error("Popup bulunamadı! scUpdateFilterBadges fonksiyonu çalışmamış olabilir.");
            return;
        }

        // Listeyi doldur (Eğer boşsa)
        if(typeof scBuildSectorList === 'function') scBuildSectorList();

        // Input'u temizle
        const inp = document.getElementById("scSectorSearchInput");
        if(inp) inp.value = "";

        // Görünürlüğü değiştir
        const isVisible = (pop.style.display === "block");
        pop.style.display = isVisible ? "none" : "block";
    };
    
    // 4. Sektör Seçimi (Global)
    window.scSelectSector = function(sec){
        window.scSectorSelection = sec;
        
        // Popup'ı kapat
        const pop = document.getElementById("scSectorPopup");
        if(pop) pop.style.display = "none";
        
        // Badge'leri ve tabloyu güncelle
        try { scUpdateFilterBadges(); } catch(e){}
        try { renderScreenerResults(); } catch(e){}
    };

    // =========================================================
    // ✅ SCREENER SEKTÖR FİLTRELEME MOTORU (TAMİR EDİLDİ)
    // =========================================================

    // 1. Liste Oluşturucu (Hayaletlerden Arındırılmış)
    window.scBuildSectorList = function(){
        const list = document.getElementById("scSectorList");
        if(!list) return; // Liste yoksa sessizce çık (Hata verme)

        // Aktif gruptaki sektörleri çek
        const sectors = [...new Set(window.companies
            .filter(c => c.group === activeGroup)
            .map(c => c.sector))]
            .filter(Boolean)
            .sort((a,b) => a.localeCompare(b,'tr'));

        // HTML oluştur
        let html = `<div class="sc-sector-item ${window.scSectorSelection==="" ? "active":""}" onclick="scSelectSector('')">Tüm Sektörler</div>`;
        html += sectors.map(s => {
            const isActive = (s === window.scSectorSelection) ? "active" : "";
            const safeS = s.replace(/"/g, '&quot;');
            return `<div class="sc-sector-item ${isActive}" onclick="scSelectSector('${safeS}')">${s}</div>`;
        }).join("");

        list.innerHTML = html;
        // Not: Eski buton (scSectorBtn) referansı buradan kaldırıldı.
    };

    // 2. Seçim Yapıcı (Optimize Edildi)
    window.scSelectSector = function(sec){
        window.scSectorSelection = sec;
        
        // Önce tabloyu güncelle
        try { renderScreenerResults(); } catch(e){}
        
        // Sonra arayüzü (Badge'leri) güncelle
        // Bu işlem popup'ı zaten yeniden oluşturup kapatacağı için 
        // manuel kapatmaya veya listeyi yeniden kurmaya gerek yok.
        try { scUpdateFilterBadges(); } catch(e){}
    };

    // 3. Temizleyici (Olay Yakalayıcı İyileştirildi)
    window.scClearSectorFilter = function(e){
        // Tıklama olayının popup'ı kapatmasını veya başka tetiklemeleri engelle
        if(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // Input kutusu varsa temizle
        const inp = document.getElementById("scSectorSearchInput");
        if(inp) inp.value = "";

        // Seçimi sıfırla
        scSelectSector("");
    };
    
    // 4. Popup İçi Arama (Filtreleme)
    window.scFilterSectorListInPopup = function(term){
        const t = String(term || "").toLocaleLowerCase('tr');
        const items = document.querySelectorAll("#scSectorList .sc-sector-item");
        
        items.forEach(el => {
            const txt = el.textContent.toLocaleLowerCase('tr');
            // "Tüm Sektörler" her zaman kalsın
            if(el.textContent === "Tüm Sektörler" || txt.includes(t)) {
                el.style.display = "block";
            } else {
                el.style.display = "none";
            }
        });
    };
    // ==========================================
    // ✅ COMPANIES LIST MODERN FILTRELEME (SEKTÖR & ALT SEKTÖR)
    // ==========================================

    // Filtre State
    window.clFilters = {
        sector: "",
        industry: "" // Alt Sektör
    };

    // 1. Badge'leri Çiz (Render)
  
    window.clUpdateFilterBadges = function() {
        const area = document.getElementById("clFilterBadges");
        if(!area) return;

        const secName = clFilters.sector || "TÜMÜ";
        const indName = clFilters.industry || "TÜMÜ";
        const isSecSelected = !!clFilters.sector;
        
        // Aktif Borsa Etiketi
        let marketLabel = "BIST";
        if(activeGroup === 'nyse') marketLabel = "NYSE";
        if(activeGroup === 'nasdaq') marketLabel = "NASDAQ";

        let html = "";

        // --- 1. BORSA (MARKET) BADGE ---
        html += `
            <div style="position:relative;">
                <div class="cl-badge market-badge" onclick="clTogglePopup('market', event)">
                    <i class="fa-solid fa-globe"></i>
                    BORSA: ${marketLabel}
                    <i class="fa-solid fa-chevron-down" style="font-size:10px; opacity:0.5;"></i>
                </div>
                <div id="clPopup_market" class="cl-popup-menu" onclick="event.stopPropagation()">
                    <div class="cl-popup-list">
                        <div class="cl-popup-item ${activeGroup==='bist'?'selected':''}" onclick="setGroup('bist')">BIST (İstanbul)</div>
                        <div class="cl-popup-item ${activeGroup==='nyse'?'selected':''}" onclick="setGroup('nyse')">NYSE (New York)</div>
                        <div class="cl-popup-item ${activeGroup==='nasdaq'?'selected':''}" onclick="setGroup('nasdaq')">NASDAQ</div>
                    </div>
                </div>
            </div>
        `;

        // --- 2. SEKTÖR BADGE ---
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

        // --- 3. ALT SEKTÖR BADGE ---
        html += `
            <div style="position:relative;">
                <div class="cl-badge ${!isSecSelected ? 'disabled' : (clFilters.industry ? 'active' : '')}" 
                     onclick="${isSecSelected ? "clTogglePopup('industry', event)" : ''}">
                    <i class="fa-solid fa-industry"></i>
                    ALT SEKTÖR: ${indName}
                    ${clFilters.industry ? '<i class="fa-solid fa-xmark" onclick="clClearFilter(\'industry\', event)" style="opacity:0.6;"></i>' : '<i class="fa-solid fa-chevron-down" style="font-size:10px; opacity:0.5;"></i>'}
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
    
    
    // 2. Popup Aç/Kapa (Market Desteği Eklendi)
    window.clTogglePopup = function(type, e) {
        if(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        const targetPopup = document.getElementById(`clPopup_${type}`);
        if(!targetPopup) return;

        // Açık mı kontrolü
        const isAlreadyOpen = (targetPopup.style.display === 'block');

        // Önce hepsini kapat
        document.querySelectorAll('.cl-popup-menu').forEach(el => el.style.display = 'none');

        // Eğer zaten açıktıysa kapalı kalsın, değilse açalım
        if (!isAlreadyOpen) {
            
            // --- MARKET İÇİN ÖZEL DURUM (Liste oluşturmaya gerek yok) ---
            if (type === 'market') {
                targetPopup.style.display = 'block';
                return;
            }

            // --- SEKTÖR / ALT SEKTÖR İÇİN LİSTE OLUŞTUR ---
            const listEl = document.getElementById(`clList_${type}`);
            let items = [];
            
            if (type === 'sector') {
                items = [...new Set(window.companies
                    .filter(c => c.group === activeGroup)
                    .map(c => c.sector))].filter(Boolean).sort((a,b) => a.localeCompare(b,'tr'));
            } 
            else if (type === 'industry') {
                if(!clFilters.sector) return; 
                items = [...new Set(window.companies
                    .filter(c => c.group === activeGroup && c.sector === clFilters.sector)
                    .map(c => c.industry))].filter(Boolean).sort((a,b) => a.localeCompare(b,'tr'));
            }

            // HTML Bas
            let listHtml = `<div class="cl-popup-item" onclick="clSelectFilter('${type}', '')">TÜMÜ</div>`;
            listHtml += items.map(i => {
                const isSel = (clFilters[type] === i);
                const safeVal = i.replace(/"/g, '&quot;');
                return `<div class="cl-popup-item ${isSel?'selected':''}" onclick="clSelectFilter('${type}', '${safeVal}')">${i}</div>`;
            }).join('');

            if(listEl) listEl.innerHTML = listHtml;

            // Arama kutusunu temizle
            const inp = targetPopup.querySelector('input');
            if(inp) inp.value = "";

            // Göster
            targetPopup.style.display = "block";
        }
    };    // 3. Seçim Yap
    window.clSelectFilter = function(type, val) {
        clFilters[type] = val;

        // Sektör değişirse, alt sektörü sıfırla
        if (type === 'sector') {
            clFilters.industry = ""; 
        }

        // 1. Badge'leri güncelle
        clUpdateFilterBadges();
        
        // 2. Tabloyu Filtrele (renderCompanyList fonksiyonuna bu mantığı ekleyeceğiz)
        renderCompanyList(); 
        
        // Popup kapat
        document.querySelectorAll('.cl-popup-menu').forEach(el => el.style.display = 'none');
    };

    // 4. Temizle (X butonu)
    window.clClearFilter = function(type, e) {
        if(e) e.stopPropagation();
        clSelectFilter(type, "");
    };

    // 5. Popup İçi Arama
    window.clFilterPopupList = function(type, term) {
        const t = term.toLocaleLowerCase('tr');
        const items = document.querySelectorAll(`#clList_${type} .cl-popup-item`);
        items.forEach(el => {
            const txt = el.textContent.toLocaleLowerCase('tr');
            el.style.display = (txt.includes(t) || el.textContent === "TÜMÜ") ? "block" : "none";
        });
    };

    // Dışarı tıklayınca kapat
    document.addEventListener('click', () => {
        document.querySelectorAll('.cl-popup-menu').forEach(el => el.style.display = 'none');
    });

/* ============================
   NEWS TAB (SPA) - FINAL FIX (FILTERS, IMAGES & DETAIL NEWS)
============================ */
(function(){
  let booted = false;

  window.finNewsBootOnce = async function(){
    if (booted) return;
    booted = true;
    try { await finNewsInit(); } catch(e){ console.warn("news init err", e); }
  };

  async function finNewsInit(){
    // -------- 1) STATE
    let allIds = [];             // Sunucudaki TÜM haber ID listesi
    const itemCache = new Map(); // İndirilen haber içerikleri (Cache)
    
    // Filtreleme ve Arama State'i
    let activeFilters = [];
    let tempFilters = [];
    let searchQuery = "";
    
    // Sayfalama State'i
    let currentPage = 1;
    const ITEMS_PER_PAGE = 20; 
    let currentShareItem = null;

    // -------- 2) UI REFERENCES
    const container = document.getElementById('news-container');
    const searchInput = document.getElementById('news-search-input');
    const filterBar = document.getElementById('filter-status-bar');
    const activeFiltersList = document.getElementById('active-filters-list');
    const clearBtn = document.getElementById('clear-filter-btn');
    const emptyState = document.getElementById('empty-state');
    const filterBadge = document.getElementById('filter-badge');

    // Modals & Buttons
    const modalWrapper = document.getElementById('filter-modal-overlay');
    const openFilterBtn = document.getElementById('open-filter-btn');
    const closeFilterBtn = document.querySelector('#filter-modal-overlay .close-modal-trigger');
    const modalClearBtn = document.getElementById('modal-clear-btn');
    const applyFilterBtn = document.getElementById('modal-apply-btn');
    const shareModal = document.getElementById('share-modal-overlay');
    const closeShareBtn = document.getElementById('close-share-btn');
    const shareTitlePreview = document.getElementById('share-title-preview');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const pageInfo = document.getElementById('page-info');
    const paginationControls = document.getElementById('pagination-controls');

    // -------- 3) HELPERS
    function lockScroll(){ document.body.style.overflow = 'hidden'; }
    function unlockScroll(){ document.body.style.overflow = ''; }

    function timeAgo(dateString) {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "";
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        if(seconds < 60) return "Az önce";
        const m = Math.floor(seconds/60); if(m<60) return m+" dk önce";
        const h = Math.floor(m/60); if(h<24) return h+" sa önce";
        return date.toLocaleDateString('tr-TR', {day:'numeric', month:'short'});
    }

    function attachSource(url) {
        try {
            const urlObj = new URL(url);
            urlObj.searchParams.set('source', 'finapsis');
            return urlObj.toString();
        } catch (e) { return url; }
    }

    function getUniqueValues(key) {
        const set = new Set();
        // Sadece indirilmiş (cache) verilerden filtre seçenekleri oluştur
        itemCache.forEach(item => {
            const val = item[key];
            if (Array.isArray(val)) val.forEach(v => set.add(v));
            else if (val) set.add(val);
        });
        return Array.from(set);
    }

    // -------- 4) DATA FETCHING
    async function fetchIndexIds(){
      const BASE = window.FIN_DATA_BASE || "";
      const url = `${BASE}/news/v1/mapping/id_map.json?t=${Date.now()}`; 
      try {
          const r = await fetch(url);
          if (!r.ok) return [];
          const j = await r.json();
          const m = j?.map && typeof j.map === "object" ? j.map : null;
          if (!m) return [];
          // ID'leri ters çevir (Yeniler üstte)
          return Object.keys(m).reverse().filter(x => typeof x === "string" && x.length > 2);
      } catch(e) { return []; }
    }

    async function fetchNewsItem(id){
      if(itemCache.has(id)) return itemCache.get(id);

      const BASE = window.FIN_DATA_BASE || "";
      const url = `${BASE}/news/v1/items/${encodeURIComponent(id)}.json`;
      
      try {
          const r = await fetch(url);
          if (!r.ok) return null;
          const it = await r.json();
          
          // ✅ GÖRSEL FIX: Olası tüm keyleri kontrol et
          let imgUrl = it?.im || it?.img || it?.image || it?.i || "";
          
          const obj = {
            id: it?.id || id,
            ts: Number(it?.ts || 0),
            source: it?.so || "Bilinmiyor",
            title: it?.tt || "Başlıksız Haber",
            link: it?.li || "#",
            sentiment: it?.se || "", 
            category: Array.isArray(it?.tp) ? it.tp : [],
            region: it?.re || "",
            sector: Array.isArray(it?.in) ? it.in : [],
            ticker: "", 
            pubdate: it?.ts ? new Date(Number(it.ts) * 1000).toISOString() : "",
            image: imgUrl
          };
          itemCache.set(id, obj);
          return obj;
      } catch(e) { return null; }
    }

    // --- MAIN LOADER ---
    async function loadAllNews(){
        container.innerHTML = `<div style="text-align:center; padding:40px; color:#888;"><div class="spinner" style="margin:0 auto 10px auto;"></div>Haber listesi alınıyor...</div>`;
        
        allIds = await fetchIndexIds();

        if (!allIds.length){
            container.innerHTML = `<div style="text-align:center; padding:40px; color:#888;">Haber bulunamadı.</div>`;
            return;
        }

        // Başlangıçta ilk 25 haberi yükle
        await loadBatch(0, 25);
        
        initFilterOptions();
        render(); // İlk çizim
    }

    // Belirli aralıktaki ID'leri indirir
    async function loadBatch(start, count) {
        // Sınırları kontrol et
        const end = Math.min(start + count, allIds.length);
        if(start >= end) return;

        const idsToLoad = allIds.slice(start, end);
        const promises = idsToLoad.map(id => fetchNewsItem(id));
        await Promise.all(promises);
    }

    // -------- 5) RENDER ENGINE (MERGED FILTER & PAGINATION)
    function render() {
        container.innerHTML = '';
        activeFiltersList.innerHTML = '';

        // 1. Filtre Barı Göster/Gizle
        if(activeFilters.length > 0) {
            filterBadge.style.display = 'block';
            filterBar.style.display = 'flex';
            renderActiveFiltersBadge();
        } else {
            filterBadge.style.display = 'none';
            filterBar.style.display = 'none';
        }

        // 2. TÜM Cache'teki verileri al ve FİLTRELE
        // (Sadece ekranda görüneni değil, indirilmiş olan her şeyi filtreler)
        const allLoadedItems = Array.from(itemCache.values()).sort((a,b) => b.ts - a.ts);
        
        const filtersByType = {};
        activeFilters.forEach(f => {
            if(!filtersByType[f.type]) filtersByType[f.type] = [];
            filtersByType[f.type].push(f.value);
        });

        const filteredData = allLoadedItems.filter(item => {
            const matchesSearch = !searchQuery || 
                                  item.title.toLowerCase().includes(searchQuery) || 
                                  (item.ticker && item.ticker.toLowerCase().includes(searchQuery)) ||
                                  item.source.toLowerCase().includes(searchQuery);

            if (!matchesSearch) return false;

            const checkType = (typeKey) => {
                const specificFilters = filtersByType[typeKey];
                if (!specificFilters || specificFilters.length === 0) return true; 
                const itemValue = item[typeKey];
                if (Array.isArray(itemValue)) return itemValue.some(v => specificFilters.includes(v));
                return specificFilters.includes(itemValue);
            };

            return checkType('region') && checkType('sector') && checkType('category') && checkType('ticker') && checkType('sentiment');
        });

        // 3. Boş Durum Kontrolü
        if (filteredData.length === 0) {
            emptyState.style.display = 'block';
            paginationControls.style.display = 'none';
            // Eğer veri azsa ve filtre sonucu yoksa, otomatik olarak biraz daha veri çekmeyi deneyebiliriz
            // Ama kullanıcı "Daha Fazla" butonunu kullansın diye şimdilik manuel bırakıyoruz.
            return;
        }
        emptyState.style.display = 'none';

        // 4. SAYFALAMA (Filtered Data Üzerinden)
        const totalItems = filteredData.length;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        
        if (currentPage > totalPages) currentPage = 1;

        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const pageData = filteredData.slice(startIndex, endIndex);

        pageInfo.textContent = `SAYFA ${currentPage} / ${totalPages}`;
        prevBtn.disabled = currentPage === 1;
        
        // Son sayfadaysak ve hala indirilecek veri varsa, Next butonu "Yükle" işlevi görsün
        // Eğer filtrelenmiş verinin sonuna geldiysek ve serverda daha veri varsa:
        const hasMoreServerData = itemCache.size < allIds.length;
        
        if (currentPage >= totalPages) {
            nextBtn.disabled = !hasMoreServerData; // Eğer serverda veri varsa aç
            if(hasMoreServerData) {
                nextBtn.innerText = "DAHA YÜKLE →";
                nextBtn.onclick = loadMoreData; // Özel fonksiyon
            } else {
                nextBtn.innerText = "SONRAKİ →";
                nextBtn.onclick = nextPage;
            }
        } else {
            nextBtn.disabled = false;
            nextBtn.innerText = "SONRAKİ →";
            nextBtn.onclick = nextPage;
        }

        paginationControls.style.display = 'flex';

        // 5. KARTLARI BAS
        pageData.forEach(item => {
            const finalLink = attachSource(item.link);
            const hasImage = item.image && item.image.length > 5;
            
            const imgHtml = hasImage 
                ? `<img src="${item.image}" alt="" class="news-img" onerror="this.parentElement.innerHTML='<div class=\\'fallback-img\\'>F</div>'">` 
                : `<div class="fallback-img">F</div>`;

            let tagsHtml = '';
            if (item.sentiment) {
                let sClass = 'sentiment-notr';
                if(item.sentiment === 'OLUMLU') sClass = 'sentiment-olumlu';
                if(item.sentiment === 'OLUMSUZ') sClass = 'sentiment-olumsuz';
                tagsHtml += `<span class="clickable-tag tag-sentiment ${sClass}" data-type="sentiment" data-val="${item.sentiment}">${item.sentiment}</span>`;
            }
            if(item.region) tagsHtml += `<span class="clickable-tag" data-type="region" data-val="${item.region}">📍 ${item.region}</span>`;
            if(item.category) item.category.forEach(c => tagsHtml += `<span class="clickable-tag" data-type="category" data-val="${c}">${c}</span>`);

            tagsHtml += `<button class="clickable-tag news-share-btn" data-title="${item.title.replace(/"/g, '&quot;')}" data-url="${finalLink}" style="margin-left:auto; border:none; background:transparent; color:rgba(255,255,255,0.5);">🔗 Paylaş</button>`;

            const cardHtml = `
                <div class="news-card">
                    <a href="${finalLink}" target="_blank" class="news-img-wrapper">
                        ${imgHtml}
                    </a>
                    <div class="news-content">
                        <div>
                            <div class="news-meta-top">
                                <span class="news-source">${item.source}</span>
                                <span class="news-time">${timeAgo(item.pubdate)}</span>
                            </div>
                            <a href="${finalLink}" target="_blank" class="news-title-link">
                                <span class="news-title">${item.title}</span>
                            </a>
                        </div>
                        <div class="news-tags">${tagsHtml}</div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', cardHtml);
        });
    }

    function renderActiveFilters() {
        activeFiltersList.innerHTML = '';
        activeFilters.forEach(f => {
            const displayMap = { 'region': 'Bölge', 'category': 'Kat.', 'sector': 'Sektör', 'ticker': 'Hisse', 'sentiment': 'Duygu' };
            const chipHtml = `
                <div class="filter-chip">
                    <span>${displayMap[f.type] || f.type}:</span> ${f.value}
                    <div class="filter-chip-remove" onclick="window.removeFilterExternal('${f.type}', '${f.value}')">✕</div>
                </div>
            `;
            activeFiltersList.insertAdjacentHTML('beforeend', chipHtml);
        });
    }

    // --- NAVIGATION ACTIONS ---
    async function nextPage() {
        currentPage++;
        render();
        window.scrollTo(0,0);
    }

    async function loadMoreData() {
        const btn = document.getElementById('next-page-btn');
        btn.disabled = true;
        btn.innerText = "Yükleniyor...";
        
        // Cache'teki son index'i bul
        const loadedCount = itemCache.size;
        // Sonraki 25 taneyi çek
        await loadBatch(loadedCount, 25);
        
        // Filtreleri güncelle (yeni veriler geldiği için yeni tagler olabilir)
        initFilterOptions();
        
        // Render (yeni verilerle sayfayı yenile)
        // Eğer filtre varsa, belki yeni gelen veriler şu anki sayfaya (veya sonraya) eklenecek
        render();
    }

    prevBtn.onclick = () => { if (currentPage > 1){ currentPage--; render(); window.scrollTo(0,0); } };

    // -------- 6) FILTER LOGIC
    function toggleActiveFilter(type, value) {
        const existsIndex = activeFilters.findIndex(f => f.type === type && f.value === value);
        if (existsIndex > -1) activeFilters.splice(existsIndex, 1);
        else activeFilters.push({ type, value });
        tempFilters = [...activeFilters];
        currentPage = 1; 
        updateModalSelectionUI();
        render();
    }

    function removeFilter(type, value) {
        activeFilters = activeFilters.filter(f => !(f.type === type && f.value === value));
        tempFilters = [...activeFilters];
        updateModalSelectionUI();
        render();
    }

    function clearAllFilters() {
        activeFilters = []; 
        tempFilters = [];
        searchQuery = "";
        searchInput.value = "";
        currentPage = 1;
        updateModalSelectionUI();
        render();
    }

    window.removeFilterExternal = (type, value) => removeFilter(type, value);

    // -------- 7) MODAL & EVENTS
    function initFilterOptions() {
        renderModalTags('sentiment', getUniqueValues('sentiment'));
        renderModalTags('region', getUniqueValues('region'));
        renderModalTags('sector', getUniqueValues('sector'));
        renderModalTags('category', getUniqueValues('category'));
        tempFilters = [...activeFilters];
        updateModalSelectionUI();
    }

    function renderModalTags(type, values) {
        const container = document.getElementById(`modal-tags-${type}`);
        if(container) {
            container.innerHTML = values.map(val => 
                `<div class="modal-chip" data-type="${type}" data-val="${val}">${val}</div>`
            ).join('');
        }
    }

    function updateModalSelectionUI() {
        document.querySelectorAll('.modal-chip').forEach(el => {
            const type = el.dataset.type;
            const val = el.dataset.val;
            const isSelected = tempFilters.some(f => f.type === type && f.value === val);
            el.classList.toggle('selected', isSelected);
        });
    }

    function toggleTempFilter(type, value) {
        const existsIndex = tempFilters.findIndex(f => f.type === type && f.value === value);
        if (existsIndex > -1) tempFilters.splice(existsIndex, 1);
        else tempFilters.push({ type, value });
        updateModalSelectionUI();
    }

    // Event Listeners
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        currentPage = 1;
        render();
    });

    container.addEventListener('click', (e) => {
        const target = e.target.closest('[data-type]');
        if (target && !target.closest('.modal-body')) {
            const exists = activeFilters.some(f => f.type === target.dataset.type && f.value === target.dataset.val);
            if (!exists) toggleActiveFilter(target.dataset.type, target.dataset.val);
        }
        const shareBtn = e.target.closest('.news-share-btn');
        if (shareBtn) {
            e.preventDefault(); e.stopPropagation();
            currentShareItem = { title: shareBtn.dataset.title, url: shareBtn.dataset.url };
            shareTitlePreview.textContent = currentShareItem.title;
            shareModal.style.display = 'block';
            lockScroll();
        }
    });

    openFilterBtn.onclick = () => {
        tempFilters = [...activeFilters];
        updateModalSelectionUI();
        modalWrapper.style.display = 'block';
        lockScroll();
        if(window.innerWidth >= 1200){
            const rect = openFilterBtn.getBoundingClientRect();
            const modalCard = modalWrapper.querySelector('.modal-card');
            modalCard.style.top = (rect.bottom + 8) + "px";
            modalCard.style.left = ((window.innerWidth - modalCard.offsetWidth) / 2) + "px";
        }
    };

    document.querySelector('#filter-modal-overlay .modal-body').addEventListener('click', (e) => {
        const chip = e.target.closest('.modal-chip');
        if(chip) toggleTempFilter(chip.dataset.type, chip.dataset.val);
    });

    applyFilterBtn.onclick = () => {
        activeFilters = [...tempFilters];
        currentPage = 1;
        modalWrapper.style.display = 'none';
        unlockScroll();
        render();
    };

    closeFilterBtn.onclick = () => { modalWrapper.style.display = 'none'; unlockScroll(); };
    modalClearBtn.onclick = () => { tempFilters = []; activeFilters = []; currentPage = 1; modalWrapper.style.display = 'none'; unlockScroll(); render(); };
    clearBtn.onclick = clearAllFilters;

    document.getElementById('share-x').onclick = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(currentShareItem.title)}&url=${encodeURIComponent(attachSource(currentShareItem.url))}`, '_blank');
    document.getElementById('share-wa').onclick = () => window.open(`https://wa.me/?text=${encodeURIComponent(`*${currentShareItem.title}*\n${attachSource(currentShareItem.url)}`)}`, '_blank');
    document.getElementById('share-li').onclick = () => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(attachSource(currentShareItem.url))}`, '_blank');
    document.getElementById('share-copy').onclick = () => {
        navigator.clipboard.writeText(attachSource(currentShareItem.url)).then(() => {
            const span = document.querySelector('#share-copy span');
            const original = span.textContent;
            span.textContent = "Kopyalandı!";
            setTimeout(() => span.textContent = original, 2000);
        });
    };
    closeShareBtn.onclick = () => { shareModal.style.display = 'none'; unlockScroll(); };

    // START
    await loadAllNews();
  }
})();

// ============================================
// DETAIL VIEW HABER FIX (fetchLatestTickerNews)
// ============================================
async function fetchLatestTickerNews(ticker){
  const t = String(ticker || "").toUpperCase().trim();
  if (!t) return [];

  const base = window.FIN_DATA_BASE || "";
  // ✅ Dosya yolu düzeltildi ve cache-bust eklendi
  const url = `${base}/news/v1/latest/ticker/${encodeURIComponent(t)}.v1.json?t=${Date.now()}`;

  try {
      const r = await fetch(url);
      if (!r.ok) return [];

      const j = await r.json();
      const items = Array.isArray(j?.items) ? j.items : [];

      // Array yapısını Object yapısına çevir (API response formatına göre)
      // row: [id, ts, source, sentiment, title, link, ticker, image]
      return items.map(row => ({
        id: row?.[0] || "",
        ts: Number(row?.[1] || 0),
        source: row?.[2] || "",
        sentiment: row?.[3] || "",
        title: row?.[4] || "",
        link: row?.[5] || "",
        ticker: row?.[6] || t,
        image: row?.[7] || "" // Varsa resim
      })).filter(x => x.id && x.title);
  } catch(e) {
      console.warn("[DetailNews] Fetch err:", e);
      return [];
  }
}
