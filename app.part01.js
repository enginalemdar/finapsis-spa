

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
