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
