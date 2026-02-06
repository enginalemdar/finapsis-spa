// js/detail.js

(function(){
const DEFAULT_TICKER = "AAPL";

window.__ABOUT_CACHE = null; 

window.benchmarks = window.benchmarks || [];
window.companies = window.companies || [];

function getIndicatorInfo(ticker) {
  if (!window.__INDICATORS_MAP) return null;
  const indKey = String(ticker || '').toLowerCase().trim();
  const indObj = window.__INDICATORS_MAP[indKey];
  if (!indObj) return null;
  
  return {
    isIndicator: true,
    label: indObj.label || ticker,
    unit: indObj.unit || "",
    valueType: indObj.value_type || "number",
    badge: indObj.badge || "",
    group: indObj.group || ""
  };
}


let currentTicker = DEFAULT_TICKER;

let apiCompany = null;        
let apiPriceHistory = [];     
let apiNews = [];             
let apiFinancials = [];       
let apiMetrics = [];
let apiMeta = { lastTQ: null, lastTA: null };
let financialPeriodMode = "annual"; // annual | quarterly
let newsFilterMode = "all";
let newsPage = 1;
let newsPageSize = 6;
let trendChartInstance = null;

let derived52w = { low: 0, high: 0, current: 0 };

let chartInstance = null;
let chartFull = { points: [] }; 
let activeRange = "1Y";
let activeChartType = "area";
let volumeChartInstance = null;

let loadSeq = 0;

function getTickerFromQuery(){
  const href = String(window.location.href || "");
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
  const day = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const y = d.getFullYear();
  return `${day}/${m}/${y}`;  // DD/MM/YYYY format
}
function setYearHeaders(){
  const y = new Date().getFullYear();
  document.getElementById("y1Head").innerText = y - 1;
  document.getElementById("y2Head").innerText = y - 2;
  document.getElementById("y3Head").innerText = y - 3;
}

function setPeriodHeaders(meta){
  const lastTA = meta?.lastTA;
  const lastTQ = meta?.lastTQ;

  let head0 = "TTM";
  let baseYear = null;

  if (typeof lastTA === "string" && lastTA.toUpperCase() === "TTM") {
    if (typeof lastTQ === "string" && lastTQ.includes("/")) {
      const y = Number(lastTQ.split("/")[0]);
      if (Number.isFinite(y)) baseYear = y;
    }
  } else if (lastTA !== null && lastTA !== undefined && String(lastTA).trim() !== "") {
    const y = Number(String(lastTA).replace(/[^0-9]/g, ""));
    if (Number.isFinite(y) && y > 1900) {
      baseYear = y;
      head0 = String(y);
    }
  }

  if (lastTA && String(lastTA).toUpperCase() === "TTM") head0 = "TTM";

  if (!Number.isFinite(baseYear)) {
    const y = new Date().getFullYear();
    baseYear = y - 1;
    head0 = "TTM";
  }

  const h1 = baseYear - 1;
  const h2 = baseYear - 2;
  const h3 = baseYear - 3;

  const th0 = document.querySelector('th[data-col="t"]') || document.querySelector('th:nth-child(2)');
  const th1 = document.getElementById("y1Head");
  const th2 = document.getElementById("y2Head");
  const th3 = document.getElementById("y3Head");

  if (th0) th0.innerText = head0;
  if (th1) th1.innerText = h1;
  if (th2) th2.innerText = h2;
  if (th3) th3.innerText = h3;
}

function normalizeKey(s){
  return String(s || "")
    .toLowerCase()
    .replace(/ı/g,"i").replace(/ğ/g,"g").replace(/ü/g,"u").replace(/ş/g,"s").replace(/ö/g,"o").replace(/ç/g,"c")
    .replace(/\s+/g, " ")
    .trim();
}

function getQuarterLabelFromPeriod(periodStr){
  if (!periodStr || !periodStr.includes("/")) return periodStr || "-";
  const [y, m] = periodStr.split("/").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return periodStr;
  let q = 1;
  if (m <= 3) q = 1;
  else if (m <= 6) q = 2;
  else if (m <= 9) q = 3;
  else q = 4;
  return `Q${q} ${y}`;
}

function shiftPeriod(periodStr, shiftQuarters){
  if (!periodStr || !periodStr.includes("/")) return null;
  let [y, m] = periodStr.split("/").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  let months = m - (shiftQuarters * 3);
  let year = y;
  while (months <= 0){
    months += 12;
    year -= 1;
  }
  return `${year}/${months}`;
}

function getQuarterColumns(){
  const rows = Array.isArray(apiFinancials) ? apiFinancials : [];
  const row = rows.find(r => r && r.quarterly);
  const keys = row ? Object.keys(row.quarterly || {}) : [];
  const sorted = keys.sort((a,b)=>{
    if (a === "t") return -1;
    if (b === "t") return 1;
    const na = Number(String(a).replace("tminus",""));
    const nb = Number(String(b).replace("tminus",""));
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  });
  return sorted;
}

function getAnnualColumns(){
  const rows = Array.isArray(apiFinancials) ? apiFinancials : [];
  const row = rows.find(r => r && r.annual);
  const keys = row ? Object.keys(row.annual || {}) : [];
  const sorted = keys.sort((a,b)=>{
    if (a === "t") return -1;
    if (b === "t") return 1;
    const na = Number(String(a).replace("tminus",""));
    const nb = Number(String(b).replace("tminus",""));
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  });
  return sorted;
}

function getAnnualHeaderLabel(idx){
  const lastTA = apiMeta?.lastTA;
  const lastTQ = apiMeta?.lastTQ;
  let baseYear = null;
  let head0 = "TTM";

  if (typeof lastTA === "string" && lastTA.toUpperCase() === "TTM") {
    if (typeof lastTQ === "string" && lastTQ.includes("/")) {
      const y = Number(lastTQ.split("/")[0]);
      if (Number.isFinite(y)) baseYear = y;
    }
    head0 = "TTM";
  } else if (lastTA !== null && lastTA !== undefined && String(lastTA).trim() !== "") {
    const y = Number(String(lastTA).replace(/[^0-9]/g, ""));
    if (Number.isFinite(y) && y > 1900) {
      baseYear = y;
      head0 = String(y);
    }
  }

  if (!Number.isFinite(baseYear)) {
    const y = new Date().getFullYear();
    baseYear = y - 1;
  }

  if (idx === 0) return head0;
  return String(baseYear - idx);
}

function getQuarterHeaderLabel(idx){
  const base = apiMeta?.lastTQ;
  const period = shiftPeriod(base, idx);
  return getQuarterLabelFromPeriod(period || base || "-");
}
function setLoadingState(isLoading){
  const btn = document.getElementById("searchBtn");
  const inp = document.getElementById("tickerSearch");
  if (btn) btn.disabled = !!isLoading;
  if (inp) inp.disabled = !!isLoading;

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
  }
}
function getActiveTab(){
  const active = document.querySelector('#financialTabs button.tab-btn.active');
  return active?.dataset?.tab || "income-statement";
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

function formatCountCompact(n){
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
  return suf ? `${s}${suf}` : `${s}`;
}

function getFinancialsEndpointForTicker(ticker){
  const c = findCompanyInList(ticker);
  const g = String(c?.group || "").toLowerCase();

  if (g === "bist") return API_COMFIN_TR;

  if (g === "sp") return API_COMFIN_US_N;

  return API_COMFIN_TR;
}

function getMarketCode(ticker) {
    const c = findCompanyInList(ticker);
    const g = c ? String(c.group || "").toLowerCase() : "";
    
    return 'us'; 
}

async function fetchComDetail(ticker) {
    const t = String(ticker).toUpperCase();
    const market = getMarketCode(t);
    const companyInfo = findCompanyInList(t) || {};

    if (!window.__ABOUT_CACHE) {
        try {
            const res = await fetch(`${window.FIN_DATA_BASE}/static/companies.about.v1.json`);
            if (res.ok) window.__ABOUT_CACHE = await res.json();
            else window.__ABOUT_CACHE = [];
        } catch (e) { window.__ABOUT_CACHE = []; }
    }
    const aboutObj = window.__ABOUT_CACHE.find(x => x.ticker === t);

    
    let price_history = [];
    try {
        let historyUrl = "";
        
        const g = companyInfo ? (companyInfo.group || "").toLowerCase() : "";
        const isStock = ['bist', 'nyse', 'nasdaq', 'sp'].includes(g);

        if (isStock) {
             historyUrl = `${window.FIN_DATA_BASE}/ohlcv/ticker/${market}/${t}/1d.v1.json`;
        } else {
             historyUrl = `${window.FIN_DATA_BASE}/ohlcv/ticker/us/${t.toLowerCase()}.json`;
        }

        const histRes = await fetch(historyUrl);
        if (histRes.ok) {
            const histJson = await histRes.json();
            price_history = histJson.rows || [];
        }
    } catch (e) { console.warn("History fetch failed", e); }

    const apiCompany = {
        ticker: t,
        name: companyInfo.name,
        about: aboutObj ? (aboutObj.about_tr || aboutObj.about) : "Şirket açıklaması bulunamadı.",
        founded: companyInfo.founded,
        employees: companyInfo.employees,
        sector: companyInfo.sector_tr || companyInfo.sector,
        industry: companyInfo.industry_tr || companyInfo.industry,
        market_cap: null 
    };

    return {
        company: apiCompany,
        price_history: price_history,
        news: [] 
    };
}
window.fetchComDetail = fetchComDetail;

async function fetchComFinancials(ticker) {
    const t = String(ticker).toUpperCase();
    try {
        const path = `${window.FIN_DATA_BASE}/financials/${t}.json`;
        const url = (typeof proxyUrl === 'function') ? proxyUrl(path) : path;
        
        const res = await fetch(url);
        
        if (res.ok) {
            const json = await res.json();

            if (Array.isArray(json) && json.length > 0 && json[0].financials) {
                const fin = json[0].financials || [];
                const metrics = json[0].metrics || fin.filter(r => r.type === "ratios" || r.type === "metrics");
                return { 
                  financials: fin, 
                  metrics: metrics,
                  lastTQ: json[0].lastTQ,
                  lastTA: json[0].lastTA
                };
            }

            if (json.financials && Array.isArray(json.financials)) {
                const fin = json.financials;
                const metrics = json.metrics || fin.filter(r => r.type === "ratios" || r.type === "metrics");
                return { 
                  financials: fin, 
                  metrics: metrics,
                  lastTQ: json.lastTQ,
                  lastTA: json.lastTA
                };
            }

            if (json && Array.isArray(json.data) && json.data.length > 0) {
                const d0 = json.data[0];
                if (d0 && d0.financials) {
                    return {
                      financials: d0.financials || [],
                      metrics: d0.metrics || [],
                      lastTQ: d0.lastTQ,
                      lastTA: d0.lastTA
                    };
                }
                if (d0 && d0.data && d0.data.financials) {
                    return {
                      financials: d0.data.financials || [],
                      metrics: d0.data.metrics || [],
                      lastTQ: d0.data.lastTQ,
                      lastTA: d0.data.lastTA
                    };
                }
            }

            if (Array.isArray(json)) {
                return { financials: json, metrics: [], lastTQ: null, lastTA: null };
            }

            return { financials: [], metrics: [], lastTQ: null, lastTA: null };
        }
    } catch (e) { 
        console.warn("Financials fetch failed", e); 
    }
    return { financials: [], metrics: [], lastTQ: null, lastTA: null };
}

function renderHeaderFromCompanies(ticker){
  const c = findCompanyInList(ticker);
  const indInfo = getIndicatorInfo(ticker);

  let groupName = "BIST";
  if (indInfo) {
    groupName = indInfo.badge || indInfo.group || "GÖSTERGE";
  } else if (c) {
    groupName = (c.exchange || c.group || "BIST").toUpperCase();
  }
  if(groupName === 'SP') groupName = 'US'; 

  const name = indInfo ? indInfo.label : (c?.name || ticker);
  const secText = indInfo ? "" : (c?.sector_tr || c?.sector || "");
  const sector = secText ? `• ${secText}` : "";

  const pillEl = document.getElementById("tickerPill");
  if(pillEl) pillEl.innerText = `${groupName}: ${ticker}`;

  const titleEl = document.getElementById("companyTitle");
  if(titleEl) titleEl.innerText = name;

  const metaEl = document.getElementById("companyMeta");
  if(metaEl) {
    if (indInfo) {
      metaEl.innerText = "";
    } else {
      metaEl.innerText = c ? `${groupName} ${sector}` : "Veri aranıyor...";
    }
  }

  const chartTitleEl = document.getElementById("chartTitle");
  if(chartTitleEl) {
    if (indInfo) {
      chartTitleEl.innerText = name;
    } else {
      chartTitleEl.innerText = `${name} Hisse Fiyatı`;
    }
  }

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

  const titleEl = document.getElementById("detailTitle");
  if (titleEl) titleEl.textContent = `${c.name || apiCompany.name || ticker} (${ticker})`;

  const tickerVal = document.getElementById("tickerVal");
  if (tickerVal) tickerVal.textContent = ticker;

  const foundedEl = document.getElementById("foundedVal");
  const empEl = document.getElementById("empVal");
  const sectorEl = document.getElementById("sectorVal");
  const mcapEl = document.getElementById("mcapVal");

  const founded = apiCompany.founded || c.founded || "-";
  let employees = apiCompany.employees || c.employees || "-";
  if(typeof employees === 'number') employees = employees.toLocaleString('tr-TR');

  const sector = c.sector_tr || apiCompany.sector || c.sector || "-";

  if (foundedEl) foundedEl.textContent = founded;
  if (empEl) empEl.textContent = employees;
  if (sectorEl) sectorEl.textContent = sector;

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

    const sym = currencySymbolForTicker(ticker); 
    mcapEl.textContent = Number.isFinite(n) && n !== 0
      ? formatCompactWithSymbol(n, sym)
      : "-";
  }

  const aboutEl = document.getElementById("aboutText");
  if (aboutEl) aboutEl.textContent = apiCompany.about || apiCompany.description || "-";
}


function isMoneyMetricType(type){
  const s = String(type || "").toLowerCase().trim();

  if (
    /devir|turnover|süre|sure|gün|gun|days|cycle|döngü|dongu/.test(s) ||         
    /oran|ratio|marj|margin|%|percent/.test(s) ||                               
    /\broic\b|\broa\b|\broe\b|\bbeta\b/.test(s) ||                              
    /pd\/dd|p\/b|f\/k|p\/e|fiyat\/satış|price\/sales/.test(s) ||                
    /borç\/öz|debt\/equity/.test(s)                                             
  ) return false;

  if (
    /piyasa değeri|market cap/.test(s) ||
    /firma değeri|enterprise value/.test(s) ||
    /satış gelirleri|gelirler|revenue|sales/.test(s) ||
    /nakit ve nakit benzerleri|cash and cash equivalents/.test(s) ||
    /serbest nakit|free cash|fcf/.test(s) ||
    /net borç\b|net debt\b/.test(s) ||                 
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

async function renderBenchmarksMetrics() {
    const listEl = document.getElementById("overviewMetricsList") || document.getElementById("metricsList");
    if (!listEl) return;

    const rows = (Array.isArray(window.apiMetrics) && window.apiMetrics.length)
      ? window.apiMetrics
      : (Array.isArray(window.apiFinancials) ? window.apiFinancials.filter(r => r.type === "metrics" || r.type === "ratios") : []);
    
    const pickMetricVal = (row) => {
        if (!row) return null;
        if (row.annual && row.annual.t !== undefined) return row.annual.t;
        if (row.quarterly && row.quarterly.t !== undefined) return row.quarterly.t;
        if (row.ttm !== undefined) return row.ttm;
        if (row.value !== undefined) return row.value;
        return null;
    };

    const findVal = (keys) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        const hit = rows.find(r => 
            keyList.some(k => String(r.item || "").toLowerCase().replace(/ı/g,'i') === k.toLowerCase().replace(/ı/g,'i'))
        );
        if (!hit) return null;
        const val = pickMetricVal(hit);
        return safeNum(val);
    };

    const pick = (keys) => findVal(keys);
    const asPct01 = (v) => v; 

    let mcapDisplay = "-";
    
    const shareKeys = ["Hisse Adedi", "Shares Outstanding (Diluted)", "Shares Outstanding (Basic)", "Total Common Shares Outstanding"];
    const shares = findVal(shareKeys);
    
    const { current } = derived52w || { current: 0 };
    const live = getLivePriceFromGlobal(currentTicker);
    const price = (live.cur !== null && live.cur > 0) ? live.cur : current;

    if (shares && price) {
        let finalShares = shares;

        try {
            if (!window.__ADR_CACHE) {
                const path = `${window.FIN_DATA_BASE}/static/drs.json`;
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

        const headerMcap = document.getElementById("mcapVal");
        if (headerMcap) headerMcap.textContent = mcapDisplay;
    }

    const livePrice = (live.cur !== null && live.cur > 0) ? live.cur : null;
    const epsVal = findVal(["Hisse Başına Kazanç", "EPS (Diluted)", "EPS (Basic)", "EPS"]);
    const bookVal = findVal(["Defter Değeri", "Tangible Book Value"]);
    const marketCapRaw = (shares && livePrice) ? shares * livePrice : null;

    const items = [
  { 
    label:"F/K", 
    cat:"Değerleme", 
    v: (livePrice !== null && epsVal !== null) ? (livePrice / epsVal) : pick(["F/K", "Fiyat/Kazanç", "PE Ratio"]), 
    fmt:(v)=>v.toFixed(2), 
    badges: { good: "CAZİP", neutral: "UYGUN", bad: "PAHALI" },
    ok:(v)=>v>0 && v<20 
  },
  { 
    label:"PD/DD", 
    cat:"Değerleme", 
    v: (marketCapRaw !== null && bookVal !== null) ? (marketCapRaw / bookVal) : pick(["PD/DD", "Price to Book"]), 
    fmt:(v)=>v.toFixed(2), 
    badges: { good: "UYGUN", neutral: "NORMAL", bad: "YÜKSEK" },
    ok:(v)=>v<3 
  },
  { 
    label:"Cari Oran", 
    cat:"Likidite", 
    v: pick(["Cari Oran"]), 
    fmt:(v)=>v.toFixed(2), 
    badges: { good: "SAĞLAM", neutral: "ORTA", bad: "ZAYIF" },
    ok:(v)=>v>=1.5 
  },
  { 
    label:"Asit Test Oranı", 
    cat:"Likidite", 
    v: pick(["Asit Test Oranı"]), 
    fmt:(v)=>v.toFixed(2), 
    badges: { good: "GÜÇLÜ", neutral: "YETERLİ", bad: "ZAYIF" },
    ok:(v)=>v>=1.0 
  },
  { 
    label:"Brüt Kar Marjı", 
    cat:"Kârlılık", 
    v: asPct01(pick(["Brüt Kar Marjı"])), 
    fmt:(v)=>(v*100).toFixed(1)+"%", 
    badges: { good: "GÜÇLÜ", neutral: "ORTA", bad: "ZAYIF" },
    ok:(v)=>v>=0.30 
  },
  { 
    label:"Faaliyet Kar Marjı", 
    cat:"Kârlılık", 
    v: asPct01(pick(["Faaliyet Kâr Marjı","Faaliyet Kar Marjı"])), 
    fmt:(v)=>(v*100).toFixed(1)+"%", 
    badges: { good: "GÜÇLÜ", neutral: "ORTA", bad: "DÜŞÜK" },
    ok:(v)=>v>=0.15 
  },
  { 
    label:"ROA", 
    cat:"Kârlılık", 
    v: asPct01(pick(["ROA"])), 
    fmt:(v)=>(v*100).toFixed(1)+"%", 
    badges: { good: "YÜK SEK", neutral: "NORMAL", bad: "DÜŞÜK" },
    ok:(v)=>v>=0.05 
  },
  { 
    label:"ROE", 
    cat:"Kârlılık", 
    v: asPct01(pick(["ROE"])), 
    fmt:(v)=>(v*100).toFixed(1)+"%", 
    badges: { good: "GÜÇLÜ", neutral: "ORTA", bad: "ZAYIF" },
    ok:(v)=>v>=0.12 
  },
  { 
    label:"ROIC", 
    cat:"Kârlılık", 
    v: asPct01(pick(["ROIC"])), 
    fmt:(v)=>(v*100).toFixed(1)+"%", 
    badges: { good: "MÜKEMMasEL", neutral: "İYİ", bad: "ZAYIF" },
    ok:(v)=>v>=0.10 
  },
  { 
    label:"Borç / Öz Kaynak", 
    cat:"Risk", 
    v: pick(["Borç/Öz Kaynak","Borç / Öz Kaynak"]), 
    fmt:(v)=>v.toFixed(2)+"x", 
    badges: { good: "SAĞLAM", neutral: "DENGELİ", bad: "RİSKLİ" },
    ok:(v)=>v<=1.5 
  },
  { 
    label:"Stok Devir Hızı", 
    cat:"Verimlilik", 
    v: pick(["Stok Devir Hızı"]), 
    fmt:(v)=>v.toFixed(2), 
    badges: { good: "HIZLI", neutral: "NORMAL", bad: "YAVAŞ" },
    ok:(v)=>v>=4 
  },
  { 
    label:"Alacak Devir Hızı", 
    cat:"Verimlilik", 
    v: pick(["Alacak Devir Hızı"]), 
    fmt:(v)=>v.toFixed(2), 
    badges: { good: "HIZLI", neutral: "NORMAL", bad: "YAVAŞ" },
    ok:(v)=>v>=6 
  },
  { 
    label:"Borç Devir Hızı", 
    cat:"Verimlilik", 
    v: pick(["Borç Devir Hızı"]), 
    fmt:(v)=>v.toFixed(2), 
    badges: { good: "HIZLI", neutral: "NORMAL", bad: "YAVAŞ" },
    ok:(v)=>v>=6 
  },
  { 
    label:"Nakit Döngüsü", 
    cat:"Verimlilik", 
    v: pick(["Nakit Döngüsü"]), 
    fmt:(v)=>Math.round(v)+" gün", 
    badges: { good: "HIZLI", neutral: "NORMAL", bad: "YAVAŞ" },
    ok:(v)=>v<=60 
  },
];

    listEl.innerHTML = items.map(it => {
  const has = (it.v !== null && it.v !== undefined);
  const num = Number(it.v);
  const good = has ? it.ok(num) : null;

  const badgeText = (good === null) ? "—" : (good ? it.badges.good : it.badges.bad);
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


  let rev = findRow("income-statement", ["revenue", "sales", "ciro", "hasılat", "Satış Gelirleri"]);
  let prof = findRow("income-statement", ["net income", "net profit", "net", "kar", "Dönem Karı (Zararı)"]);
  if (!rev) rev = findRow("income", ["revenue", "sales", "ciro", "hasılat", "Satış Gelirleri"]);
  if (!prof) prof = findRow("income", ["net income", "net profit", "net", "kar", "Dönem Karı (Zararı)"]);

  if (!rev || !prof){
    wrap.innerHTML = `<div style="text-align:center; padding:18px; color:#666; font-weight:900; width:100%;">Gelir/Kâr verisi bulunamadı.</div>`;
    return;
  }

  const keysNew = ["tminus3","tminus2","tminus1","t"];
  const keysOld = ["tminus3","tminus2","tminus1","ttm"];
  const labels = ["D-3","D-2","D-1","D-0"];

  const useOld = rev && rev.quarterly === undefined && ("ttm" in rev);
  const keys = useOld ? keysOld : keysNew;

  const revVals = keys.map(k => Number(useOld ? rev?.[k] : rev?.quarterly?.[k]));
  const profVals = keys.map(k => Number(useOld ? prof?.[k] : prof?.quarterly?.[k]));

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

  const rawList = Array.isArray(apiNews) ? apiNews : [];
  const filtered = rawList.filter(n => {
    if (newsFilterMode === "all") return true;
    const s = String(n?.sentiment || "").toLowerCase();
    if (newsFilterMode === "positive") return s.includes("olumlu") || s.includes("positive");
    if (newsFilterMode === "negative") return s.includes("olumsuz") || s.includes("negative");
    if (newsFilterMode === "neutral") return s.includes("nötr") || s.includes("notr") || s.includes("neutral");
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / newsPageSize));
  if (newsPage > totalPages) newsPage = totalPages;
  const start = (newsPage - 1) * newsPageSize;
  const pageList = filtered.slice(start, start + newsPageSize);

  const prevBtn = document.getElementById("newsPrevBtn");
  const nextBtn = document.getElementById("newsNextBtn");
  const pageInfo = document.getElementById("newsPageInfo");
  if (pageInfo) pageInfo.textContent = `${newsPage} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = newsPage <= 1;
  if (nextBtn) nextBtn.disabled = newsPage >= totalPages;

  if (!pageList.length){
    container.innerHTML = `<div class="p-4 text-sm text-[#888] font-semibold">Haber yok.</div>`;
    requestSendHeight(false);
    return;
  }

  const fmtDate = (tsSec) => {
    const d = new Date(Number(tsSec || 0) * 1000);
    if (!Number.isFinite(d.getTime())) return "-";
    return d.toLocaleDateString("tr-TR", { day:"2-digit", month:"short", year:"numeric" });
  };

  container.innerHTML = pageList.map(n => {
  const dateText = n?.ts ? fmtDate(n.ts) : (n?.date || "");
  let url = String(n?.link || "").trim();
  
  // UTM parametresi ekle
  if (url && url !== "#") {
    const separator = url.includes('?') ? '&' : '?';
    url = url + separator + 'utm_source=finapsis.co';
  }
  
  const isValid = !!url && url !== "#";
  const senti = String(n?.sentiment || "").trim();
  
  // Sentiment CSS class
  let sentiClass = '';
  if (senti) {
    const s = senti.toLowerCase();
    if (s.includes('olumlu') || s.includes('positive')) sentiClass = 'sentiment-olumlu';
    else if (s.includes('olumsuz') || s.includes('negative')) sentiClass = 'sentiment-olumsuz';
    else sentiClass = 'sentiment-notr';
  }

  return `
    <a href="${isValid ? url : "javascript:void(0)"}" class="news-item group" ${isValid ? 'target="_blank" rel="noopener"' : ""}>
      <div class="flex justify-between items-center mb-1">
        <span class="text-[10px] text-[#888] font-extrabold uppercase tracking-widest">${n?.source || "Kaynak"}</span>
        <span class="text-[10px] text-[#555] font-black uppercase tracking-widest">${dateText}</span>
      </div>
      <div class="text-[#ddd] text-xs font-semibold leading-snug group-hover:text-[#c2f50e] transition-colors">
        ${n?.title || "-"}
      </div>
      ${senti ? `<div class="mt-2"><span class="badge ${sentiClass}">${senti}</span></div>` : ``}
    </a>
  `;
}).join("");

  setSideStackHeights();

  requestSendHeight(false);
}

function setSideStackHeights(){
  const finCard = document.getElementById("cardFinancials");
  const side = document.getElementById("sideStack");
  const newsList = document.getElementById("newsList");
  if (!finCard || !side || !newsList) return;

  side.style.maxHeight = finCard.offsetHeight + "px";
  side.style.overflow = "hidden";

  const head = side.querySelector(".card-head");
  const pagination = side.querySelector(".news-pagination");
  const headH = head ? head.offsetHeight : 0;
  const pagH = pagination ? pagination.offsetHeight : 0;
  const total = finCard.offsetHeight;
  const listH = Math.max(140, total - headH - pagH - 16);

  newsList.style.maxHeight = listH + "px";
  newsList.style.overflowY = "auto";
}

function initNewsFilters(){
  const wrap = document.querySelector(".news-filters");
  if (!wrap) return;
  wrap.addEventListener("click", (e) => {
    const btn = e.target.closest(".news-filter-btn");
    if (!btn) return;
    const mode = btn.dataset.filter;
    newsFilterMode = mode || "all";
    wrap.querySelectorAll(".news-filter-btn").forEach(b => b.classList.toggle("active", b === btn));
    newsPage = 1;
    renderNews();
  });

  const prevBtn = document.getElementById("newsPrevBtn");
  const nextBtn = document.getElementById("newsNextBtn");
  if (prevBtn && !prevBtn.__bound) {
    prevBtn.__bound = true;
    prevBtn.addEventListener("click", () => {
      newsPage = Math.max(1, newsPage - 1);
      renderNews();
    });
  }
  if (nextBtn && !nextBtn.__bound) {
    nextBtn.__bound = true;
    nextBtn.addEventListener("click", () => {
      newsPage += 1;
      renderNews();
    });
  }
}


function renderFinancialTable(tabName){
  const tbody = document.getElementById("financialsBody");
if (tabName === "ratios") {
  tbody.innerHTML = "";
  requestSendHeight(false);
  return;
}

  const allRows = (Array.isArray(apiFinancials) ? apiFinancials : []);
  let rows = (tabName === "metrics")
    ? (Array.isArray(apiMetrics) ? apiMetrics : [])
    : allRows.filter(i => i.type === tabName);
  if (!rows.length) {
    const fallbackMap = {
      "income-statement": "income",
      "balance-sheet": "balance",
      "cash-flow-statement": "cash-flow"
    };
    const fb = fallbackMap[tabName];
    if (fb) rows = allRows.filter(i => i.type === fb);
  }
  const dropItems = new Set([
    "gross margin",
    "operating margin",
    "profit margin",
    "free cash flow margin",
    "ebitda margin",
    "ebit margin",
    "effective tax rate",
    "dividend per share",
    "free cash flow per share",
    "shares outstanding (basic)",
    "shares outstanding (diluted)",
    "eps (basic)",
    "eps (diluted)"
  ]);

  rows = rows
    .filter(r => tabName === "metrics" ? true : !dropItems.has(normalizeKey(r.item)))
    .map((r, idx) => ({ ...r, __idx: idx })); 

const sorted = rows.slice().sort((a, b) => {
  const ao = Number(a?.order_no ?? a?.orderNo ?? a?.orderno);
  const bo = Number(b?.order_no ?? b?.orderNo ?? b?.orderno);

  const aHas = Number.isFinite(ao);
  const bHas = Number.isFinite(bo);

  if (aHas && bHas) return ao - bo;
  if (aHas && !bHas) return -1;
  if (!aHas && bHas) return 1;

  return (a?.__idx ?? 0) - (b?.__idx ?? 0);
});



  if (!rows.length){
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:18px; color:#666; font-weight:900;">Veri yok.</td></tr>`;
    requestSendHeight(false);
    return;
  }

  const pickAnnual = (r, key) => {
    if (!r) return null;
    if (r.annual && r.annual[key] !== undefined) return r.annual[key];
    if (r.ttm !== undefined && key === "t") return r.ttm;
    if (r.ttm !== undefined && key === "tminus1") return r.ttm;
    if (r[key] !== undefined) return r[key];
    return null;
  };

  const pickAnnualFallback = (r, key) => {
    const v = pickAnnual(r, key);
    if (v !== null && v !== undefined) return v;
    if (key === "t") {
      const fb = pickAnnual(r, "tminus1");
      if (fb !== null && fb !== undefined) return fb;
    }
    return v;
  };
  const pickQuarter = (r, key) => {
    if (!r) return null;
    if (r.quarterly && r.quarterly[key] !== undefined) return r.quarterly[key];
    if (r[key] !== undefined) return r[key];
    return null;
  };

  const columns = (financialPeriodMode === "quarterly") ? getQuarterColumns() : getAnnualColumns();
  const headerRow = document.getElementById("financialsHeadRow");
  if (headerRow) {
    const headerCells = columns.map((k, idx) => {
      const label = (financialPeriodMode === "quarterly") ? getQuarterHeaderLabel(idx) : getAnnualHeaderLabel(idx);
      return `<th class="period-col">${label}</th>`;
    }).join("");
    headerRow.innerHTML = `<th width="28%">Kalem</th>${headerCells}`;
  }

  const dayItems = new Set([
    "stok suresi",
    "alacak suresi",
    "borc suresi",
    "nakit dongusu"
  ]);
  const moneyExact = new Set([
    "net borc",
    "defter degeri",
    "firma degeri",
    "hisse fiyati",
    "serbest nakit akisi",
    "isletme sermayesi",
    "piyasa degeri"
  ]);
  const moneyContains = [
    "net borc",
    "defter degeri",
    "firma degeri",
    "hisse fiyati",
    "serbest nakit akisi",
    "isletme sermayesi",
    "piyasa degeri"
  ];
  const isMoneyMetric = (rawItem, normItem) => {
    if (moneyExact.has(normItem) || moneyContains.some(k => normItem.includes(k))) return true;
    const raw = String(rawItem || "").toLowerCase();
    if (raw.includes("working capital")) return true;
    if (raw.includes("net debt")) return true;
    if (raw.includes("book value")) return true;
    if (raw.includes("enterprise value")) return true;
    if (raw.includes("market cap")) return true;
    // İşletme Sermayesi: devir/oran olmayanları para say
    if (/isletme sermayesi(?!.*(devir|orani))/.test(normItem)) return true;
    return false;
  };
  const countItems = new Set([
    "hisse adedi",
    "shares outstanding (basic)",
    "shares outstanding (diluted)",
    "total common shares outstanding"
  ]);

  tbody.innerHTML = sorted.map((r, idx) => {
    const normItem = normalizeKey(r.item);
    const isEffTax = normItem === "effective tax rate";
    const cells = columns.map(k => {
      const raw = (financialPeriodMode === "quarterly")
        ? pickQuarter(r, k)
        : (k === "t" ? pickAnnualFallback(r, k) : pickAnnual(r, k));

      const vNum = safeNum(raw);
      if (isEffTax) {
        return `<td>${vNum === null ? "-" : (vNum * 100).toFixed(2) + "%"}</td>`;
      }

      if (String(r.value_type || "").toLowerCase() === "percentage") {
        const cls = vNum > 0 ? "val-up" : (vNum < 0 ? "val-down" : "");
        return `<td class="${cls}">${vNum === null ? "-" : (vNum * 100).toFixed(2) + "%"}</td>`;
      }

      if (tabName === "metrics") {
        if (dayItems.has(normItem)) {
          return `<td>${vNum === null ? "-" : Math.round(vNum) + " Gün"}</td>`;
        }
        if (isMoneyMetric(r.item, normItem)) {
          return `<td>${formatFinancial(raw, r.value_type)}</td>`;
        }
        if (countItems.has(normItem)) {
          return `<td>${vNum === null ? "-" : formatCountCompact(vNum)}</td>`;
        }
        return `<td>${vNum === null ? "-" : vNum.toFixed(2)}</td>`;
      }

      return `<td>${formatFinancial(raw, r.value_type)}</td>`;
    }).join("");

    return `<tr data-idx="${idx}" class="fin-row"><td>${r.item || "-"}</td>${cells}</tr>`;
  }).join("");

  requestSendHeight(false);
}

function openTrendModal(row, mode){
  const modal = document.getElementById("trendModal");
  const titleEl = document.getElementById("trendModalTitle");
  const closeBtn = document.getElementById("trendModalClose");
  const chartEl = document.getElementById("trendChart");
  if (!modal || !titleEl || !chartEl) return;

  const columns = (mode === "quarterly") ? getQuarterColumns() : getAnnualColumns();
  const labelsRaw = columns.map((k, idx) => (mode === "quarterly") ? getQuarterHeaderLabel(idx) : getAnnualHeaderLabel(idx));
  const valuesRaw = columns.map(k => {
    if (mode === "quarterly") return row?.quarterly?.[k] ?? null;
    return row?.annual?.[k] ?? null;
  });
  const labels = labelsRaw.slice().reverse();
  const values = valuesRaw.slice().reverse();

  titleEl.textContent = row.item || "Trend";
  modal.classList.remove("hidden");

  if (trendChartInstance) {
    trendChartInstance.destroy();
    trendChartInstance = null;
  }

  if (window.ApexCharts) {
    trendChartInstance = new ApexCharts(chartEl, {
      chart: { type: "line", height: 260, toolbar: { show: false }, foreColor: "#cfcfcf" },
      series: [{ name: row.item || "Value", data: values }],
      xaxis: { categories: labels },
      stroke: { width: 2, curve: "smooth" },
      colors: ["#c2f50e"],
      grid: { borderColor: "rgba(255,255,255,0.08)" },
      tooltip: { theme: "dark" }
    });
    trendChartInstance.render();
  } else {
    chartEl.innerHTML = `<div style="color:#888; padding:16px;">Grafik yüklenemedi.</div>`;
  }

  if (closeBtn && !closeBtn.__bound) {
    closeBtn.__bound = true;
    closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
  }
  const backdrop = modal.querySelector(".trend-modal-backdrop");
  if (backdrop && !backdrop.__bound) {
    backdrop.__bound = true;
    backdrop.addEventListener("click", () => modal.classList.add("hidden"));
  }
}

function initTrendRowClick(){
  const tbody = document.getElementById("financialsBody");
  if (!tbody || tbody.__bound) return;
  tbody.__bound = true;
  tbody.addEventListener("click", (e) => {
    const tr = e.target.closest("tr.fin-row");
    if (!tr) return;
    const idx = Number(tr.getAttribute("data-idx"));
    if (!Number.isFinite(idx)) return;
    const tab = getActiveTab();
    let rows = (tab === "metrics")
      ? (Array.isArray(apiMetrics) ? apiMetrics : [])
      : (Array.isArray(apiFinancials) ? apiFinancials : []).filter(i => i.type === tab);
    if (!rows.length) {
      const fallbackMap = { "income-statement": "income", "balance-sheet": "balance", "cash-flow-statement": "cash-flow" };
      const fb = fallbackMap[tab];
      if (fb) rows = (Array.isArray(apiFinancials) ? apiFinancials : []).filter(i => i.type === fb);
    }
    const row = rows.filter(r => !["metrics","ratios"].includes(r.type))[idx] || rows[idx];
    if (row) openTrendModal(row, financialPeriodMode);
  });
}

window.addEventListener("resize", () => {
  setSideStackHeights();
});

function renderSimilarCompanies(){
  const tbody = document.getElementById("similarBody");
  const subtitle = document.getElementById("similarSubtitle");
  if (!tbody) return;

  const current = findCompanyInList(currentTicker);
  if (!current) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:18px; color:#666; font-weight:900;">Benzer bulunamadı.</td></tr>`;
    if (subtitle) subtitle.textContent = "-";
    return;
  }

  const group = String(current.group || "").toLowerCase();
  const sector = current.sector || current.sector_tr;
  const industry = current.industry || current.industry_tr;
  const map = window.__FIN_MAP || {};
  const baseMc = map[current.ticker]?.["Piyasa Değeri"] || map[current.ticker]?.["Market Cap"] || null;

  const candidates = (window.companies || []).filter(c => {
    if (String(c.ticker || "").toUpperCase() === currentTicker) return false;
    if (String(c.group || "").toLowerCase() !== group) return false;
    if (industry && c.industry && c.industry !== industry) return false;
    if (sector && c.sector && c.sector !== sector) return false;
    return true;
  });

  const scored = candidates.map(c => {
    const d = map[c.ticker] || {};
    const mc = d["Piyasa Değeri"] || d["Market Cap"] || null;
    const dist = (baseMc && mc) ? Math.abs(mc - baseMc) : Number.MAX_SAFE_INTEGER;
    return { c, mc, dist, d };
  }).filter(x => x.mc !== null).sort((a,b)=>a.dist-b.dist).slice(0,5);

  if (subtitle) {
    subtitle.textContent = `${group.toUpperCase()} · ${sector || "-"}${industry ? " · " + industry : ""}`;
  }

  if (!scored.length){
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:18px; color:#666; font-weight:900;">Benzer bulunamadı.</td></tr>`;
    return;
  }

  const rows = scored.map(x => {
    const d = x.d || {};
    const sym = currencySymbolForTicker(x.c.ticker);
    const rev = d["Satış Gelirleri"] || d["Revenue"];
    const opm = d["Faaliyet Kâr Marjı"] || d["Faaliyet Kar Marjı"];
    const pe = d["F/K"];
    const pb = d["PD/DD"];
    const logo = (x.c.logourl || "").trim();
    const name = x.c.name || x.c.ticker;
    return `
      <tr class="similar-row" data-ticker="${x.c.ticker}">
        <td>
          <div class="similar-cell">
            ${logo ? `<img class="similar-logo" src="${logo}" alt="${name}" />` : `<div class="similar-logo"></div>`}
            <span>${name}</span>
          </div>
        </td>
        <td>${Number.isFinite(x.mc) ? formatCompactWithSymbol(x.mc, sym) : "-"}</td>
        <td>${Number.isFinite(rev) ? formatCompactWithSymbol(rev, sym) : "-"}</td>
        <td>${Number.isFinite(opm) ? (opm*100).toFixed(1)+"%" : "-"}</td>
        <td>${Number.isFinite(pe) ? Number(pe).toFixed(2) : "-"}</td>
        <td>${Number.isFinite(pb) ? Number(pb).toFixed(2) : "-"}</td>
      </tr>
    `;
  }).join("");

  tbody.innerHTML = rows;

  tbody.querySelectorAll(".similar-row").forEach(tr => {
    tr.addEventListener("click", () => {
      const t = tr.getAttribute("data-ticker");
      if (t) loadAll(t);
    });
  });
}

function buildFullChartFromHistory(history){
  
  const cleaned = (Array.isArray(history) ? history : [])
    .map(p => {
        if (p.t !== undefined && p.c !== undefined) {
            return {
                x: p.t * 1000,
                o: Number(p.o || p.c),
                h: Number(p.h || p.c),
                l: Number(p.l || p.c),
                c: Number(p.c),
                v: Number(p.v || 0)
            };
        }
        
        const d = parseMMDDYYYY(p.date);
        const price = safeNum(p.price);
        if (d && price !== null) {
            return { 
                x: d.getTime(), 
                o: price, h: price, l: price, c: price, v: 0 
            };
        }
        return null;
    })
    .filter(p => p !== null)
    .sort((a,b) => a.x - b.x);

  chartFull.points = cleaned;
}

function calc52wFromPoints(points){
  if (!points || !points.length) return { low: 0, high: 0, current: 0 };

  const lastPoint = points[points.length - 1];
  const lastDate = lastPoint.x; 
  const current = (lastPoint.y !== undefined ? lastPoint.y : lastPoint.c);

  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  const cutOff = lastDate - oneYearMs;

  let low = current;  
  let high = current;

  for (const p of points){
    if (p.x < cutOff) continue;

    const val = (p.y !== undefined ? p.y : p.c);
    if (val < low) low = val;
    if (val > high) high = val;
  }

  return { low, high, current };
}

function render52w(){
  const { low, high, current } = derived52w || { low:0, high:0, current:0 };
  
  let sym = currencySymbolForTicker(currentTicker);
  const indInfo = getIndicatorInfo(currentTicker);
  const isPercentage = indInfo && indInfo.valueType === "percentage";

  if (indInfo) {
    if (indInfo.valueType === "percentage") {
      sym = "%";
    } else {
      sym = indInfo.unit || "";
    }
  }

  const displayCurrent = isPercentage ? current * 100 : current;
  const displayLow = isPercentage ? low * 100 : low;
  const displayHigh = isPercentage ? high * 100 : high;

  const denom = (displayHigh - displayLow);
  let pct = denom > 0 ? ((displayCurrent - displayLow) / denom) * 100 : 0;
  pct = Math.max(0, Math.min(100, pct));

  document.getElementById("rangeFill").style.width = pct + "%";
  document.getElementById("rangeThumb").style.left = pct + "%";
  document.getElementById("currentPriceLabel").innerText = sym + formatPrice(displayCurrent);
document.getElementById("lowPrice").innerText = sym + formatPrice(displayLow);
document.getElementById("highPrice").innerText = sym + formatPrice(displayHigh);

  const live = getLivePriceFromGlobal(currentTicker);
  let shownPrice = (live.cur !== null && live.cur > 0) ? live.cur : current;

  if (isPercentage) {
    shownPrice = shownPrice * 100;
  }

  const hp = document.getElementById("headerPrice");
const hpVal = document.getElementById("headerPriceVal");
const hc = document.getElementById("headerCaret");

const priceText = (shownPrice ? sym + formatPrice(shownPrice) : "-");

if (hpVal) hpVal.innerText = priceText;

else if (hp) hp.innerText = priceText;


let ch = null;
if (live.cur !== null && live.prev !== null && live.prev > 0) {
  ch = ((live.cur - live.prev) / live.prev) * 100;
}

const isUp = (ch !== null && ch > 0);
const isDown = (ch !== null && ch < 0);

if (hp) {
  hp.style.color = isUp ? "#c2f50e" : (isDown ? "#ff4d4d" : "#ffffff");
}

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

  if (rangeKey === "1H") return last(60);
  if (rangeKey === "1A") return last(21);
  if (rangeKey === "3A") return last(63);
  if (rangeKey === "6A") return last(126);
  if (rangeKey === "1Y") return last(252);
  if (rangeKey === "5Y") return last(1260);
  
  if (rangeKey === "YTD") {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
    return { points: pts.filter(p => p.x >= yearStart) };
  }
  
  if (rangeKey === "MAX") return { points: pts };
  
  return last(252);
}

function tickAmountForRange(rangeKey){
  if (rangeKey === "1H") return 6;
  if (rangeKey === "1A") return 5;
  if (rangeKey === "3A") return 6;
  if (rangeKey === "6A") return 7;
  if (rangeKey === "1Y") return 7;
  if (rangeKey === "YTD") return 7;
  if (rangeKey === "5Y") return 6;
  if (rangeKey === "MAX") return 8;
  return 7; 
}

function ensureChart(rangeKey){
  activeRange = rangeKey;
  const pack = getRangeSlice(rangeKey);
  const el = document.querySelector("#priceChart");
  const volEl = document.querySelector("#volumeChart");
  if (!el) return;

  if (!pack.points || pack.points.length === 0){
    el.innerHTML = `<div style="padding:16px; color:#777; font-weight:900;">Veri yok.</div>`;
    if (volEl) volEl.innerHTML = "";
    requestSendHeight(false);
    return;
  }

  const tickAmount = tickAmountForRange(rangeKey);
  const indInfo = getIndicatorInfo(currentTicker);
  const seriesName = indInfo ? "Değer" : "Fiyat";
  const isPercentage = indInfo && indInfo.valueType === "percentage";

  const yFormatter = isPercentage 
    ? (v) => "%" + (v * 100).toFixed(2)
    : (v) => Number(v).toFixed(2);

  const tooltipYFormatter = isPercentage
    ? (v) => "%" + (v * 100).toFixed(2)
    : (v) => (indInfo && indInfo.unit ? indInfo.unit : "") + Number(v).toFixed(2);

  const chartType = activeChartType || "area";
  let series, chartConfig;
  
  if (chartType === "candlestick") {
    series = [{
      name: seriesName,
      data: pack.points.map(p => ({x: p.x, y: [p.o, p.h, p.l, p.c]}))
    }];
    
    chartConfig = {
      chart: { type: "candlestick", height: 300, fontFamily: "Inter", toolbar: { show: false }, background: "transparent", zoom: { enabled: false } },
      theme: { mode: "dark" },
      plotOptions: { candlestick: { colors: { upward: "#c2f50e", downward: "#ff4d4d" }, wick: { useFillColor: true } } }
    };
  } else if (chartType === "line") {
    series = [{
      name: seriesName,
      data: pack.points.map(p => ({ x: p.x, y: p.c }))
    }];
    
    chartConfig = {
      chart: { type: "line", height: 300, fontFamily: "Inter", toolbar: { show: false }, background: "transparent", zoom: { enabled: false }, pan: { enabled: false } },
      theme: { mode: "dark" },
      colors: ["#c2f50e"],
      stroke: { curve: "smooth", width: 2 }
    };
  } else {
    series = [{
      name: seriesName,
      data: pack.points.map(p => ({ x: p.x, y: p.c }))
    }];
    
    chartConfig = {
      chart: { type: "area", height: 300, fontFamily: "Inter", toolbar: { show: false }, background: "transparent", zoom: { enabled: false }, pan: { enabled: false } },
      theme: { mode: "dark" },
      colors: ["#c2f50e"],
      stroke: { curve: "smooth", width: 2 },
      fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.06, stops: [0, 85, 100] } }
    };
  }

  const options = {
    series: series,
    ...chartConfig,
    dataLabels: { enabled: false },
    grid: { borderColor: "rgba(255,255,255,0.06)", strokeDashArray: 4, padding: { left: 10, right: 10 } },
    xaxis: {
      type: "datetime", tickAmount,
      labels: { rotate: -45, rotateAlways: true, hideOverlappingLabels: true, showDuplicates: false, style: { colors: "#ffffff", fontWeight: 800 }, formatter: (val) => fmtISODate(val) },
      axisBorder: { show: false }, axisTicks: { show: false }
    },
    yaxis: { labels: { style: { colors: "#ffffff", fontWeight: 800 }, formatter: yFormatter } },
    tooltip: { theme: "dark", x: { formatter: (val) => fmtISODate(val) }, y: { formatter: tooltipYFormatter } },
    markers: { size: 0 },
    legend: { show: false }
  };

  try{
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    el.innerHTML = "";
    chartInstance = new ApexCharts(el, options);
    chartInstance.render().then(() => requestSendHeight(true));
  } catch(e){
    el.innerHTML = `<div style="padding:16px; color:#ff8888; font-weight:900;">Chart hatası: ${String(e && e.message ? e.message : e)}</div>`;
    requestSendHeight(true);
  }

  if (volEl) {
    const hasVolume = pack.points.some(p => p.v && p.v > 0);
    
    if (!hasVolume) {
      volEl.innerHTML = "";
      if (volumeChartInstance) {
        volumeChartInstance.destroy();
        volumeChartInstance = null;
      }
      return;
    }

    const volumeOptions = {
      series: [{ name: "Hacim", data: pack.points.map(p => ({ x: p.x, y: p.v || 0 })) }],
      chart: { type: "bar", height: 120, fontFamily: "Inter", toolbar: { show: false }, background: "transparent", zoom: { enabled: false } },
      theme: { mode: "dark" },
      colors: ["rgba(194, 245, 14, 0.5)"],
      plotOptions: { bar: { columnWidth: "80%" } },
      dataLabels: { enabled: false },
      grid: { borderColor: "rgba(255,255,255,0.06)", padding: { left: 10, right: 10 } },
      xaxis: { type: "datetime", labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: {
        labels: {
          style: { colors: "#ffffff", fontWeight: 600, fontSize: "10px" },
          formatter: (v) => {
            if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
            if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
            if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
            return v.toFixed(0);
          }
        }
      },
      tooltip: { theme: "dark", x: { formatter: (val) => fmtISODate(val) }, y: { formatter: (v) => v.toLocaleString('tr-TR', {maximumFractionDigits: 0}) } }
    };

    try {
      if (volumeChartInstance) {
        volumeChartInstance.destroy();
        volumeChartInstance = null;
      }
      volEl.innerHTML = "";
      volumeChartInstance = new ApexCharts(volEl, volumeOptions);
      volumeChartInstance.render();
    } catch(e) {
      console.error("Volume chart error:", e);
    }
  }
}

window.setChartType = function(type) {
  if (type !== "area" && type !== "line" && type !== "candlestick") return;
  activeChartType = type;
  
  const buttons = document.querySelectorAll('.chart-type-btn');
  buttons.forEach(btn => {
    if (btn.getAttribute('data-type') === type) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  ensureChart(activeRange);
};


function scoreMatch(q, c){
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

async function loadAll(ticker){
  const mySeq = ++loadSeq;
  currentTicker = sanitizeTicker(ticker);

  renderHeaderFromCompanies(currentTicker);
  const tv = document.getElementById("tickerVal");
if (tv) tv.innerText = currentTicker;


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

  document.getElementById("headerPrice").innerText = "-";
  document.getElementById("currentPriceLabel").innerText = "-";
  document.getElementById("lowPrice").innerText = "-";
  document.getElementById("highPrice").innerText = "-";
  document.getElementById("rangeFill").style.width = "0%";
  document.getElementById("rangeThumb").style.left = "0%";

  apiCompany = null;
  apiPriceHistory = [];
  apiNews = [];
  apiFinancials = [];
  window.apiCompany = {};
window.currentCompany = {};

  chartFull = { points: [] };
  derived52w = { low:0, high:0, current:0 };

  if (chartInstance){
    try { chartInstance.destroy(); } catch(e){}
    chartInstance = null;
    const el = document.getElementById("priceChart");
    if (el) el.innerHTML = "";
  }

  try{
    const d = await fetchComDetail(currentTicker);
    if (mySeq !== loadSeq) return;

    apiCompany = d.company || {};
window.apiCompany = apiCompany;
window.currentCompany = findCompanyInList(currentTicker) || {};

apiPriceHistory = d.price_history || [];
apiNews = Array.isArray(d.news) ? d.news : [];

try {
  const tn = await fetchLatestTickerNews(currentTicker);
  if (Array.isArray(tn) && tn.length) {
    apiNews = tn; 
  }
} catch(e) {
}


renderAbout();

    const cObj = findCompanyInList(currentTicker);
    
    const stockGroups = ['bist', 'nyse', 'nasdaq', 'sp'];
    const isCompany = cObj && stockGroups.includes((cObj.group || '').toLowerCase());
    
    const cardAbout = document.getElementById("cardAbout");
    const cardFin = document.getElementById("cardFinancials");
    const cardSnap = document.getElementById("snapshotCard");

    if (cardAbout) cardAbout.style.display = isCompany ? "block" : "none";
    if (cardFin) cardFin.style.display = isCompany ? "flex" : "none";
    if (cardSnap) cardSnap.style.display = isCompany ? "block" : "none";


    buildFullChartFromHistory(apiPriceHistory);
    derived52w = calc52wFromPoints(chartFull.points || []);
    render52w();
    ensureChart(activeRange || "1Y");

    renderNews();


    updateUrlTicker(currentTicker);
    requestSendHeight(true);

    console.log("[DETAIL] financials call start", currentTicker);

try {
  const res = await fetchComFinancials(currentTicker);
  if (mySeq !== loadSeq) return;

  apiFinancials = (res && res.financials) ? res.financials : [];
  apiMetrics = (res && res.metrics) ? res.metrics : [];
  apiMeta = { lastTQ: res?.lastTQ || null, lastTA: res?.lastTA || null };
  window.apiFinancials = apiFinancials;
  window.apiMetrics = apiMetrics;
  window.apiMeta = apiMeta;

  setPeriodHeaders(apiMeta);

  renderFinancialTable(getActiveTab());
  
  if (typeof renderBenchmarksMetrics === "function") renderBenchmarksMetrics();
  
  if (typeof renderMiniBars === "function") renderMiniBars();
  if (typeof toggleOverviewMetricsCard === "function") toggleOverviewMetricsCard(getActiveTab());
  if (typeof renderSimilarCompanies === "function") renderSimilarCompanies();
  setSideStackHeights();

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

function initPeriodToggle(){
  const annualBtn = document.getElementById("periodAnnualBtn");
  const quarterBtn = document.getElementById("periodQuarterBtn");
  if (!annualBtn || !quarterBtn) return;

  const setMode = (mode) => {
    financialPeriodMode = mode;
    annualBtn.classList.toggle("active", mode === "annual");
    quarterBtn.classList.toggle("active", mode === "quarterly");
    renderFinancialTable(getActiveTab());
    requestSendHeight(false);
  };

  if (!annualBtn.__bound) {
    annualBtn.__bound = true;
    annualBtn.addEventListener("click", () => setMode("annual"));
  }
  if (!quarterBtn.__bound) {
    quarterBtn.__bound = true;
    quarterBtn.addEventListener("click", () => setMode("quarterly"));
  }
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
  const btn = document.getElementById("searchBtn");   
  const dd  = document.getElementById("searchDD");
  if (!inp || !dd) return; 

  const run = (t) => {
  const ticker = sanitizeTicker(t || inp.value);
  hideSearchDropdown();

  inp.value = "";
  inp.blur();

  loadAll(ticker);
};


  if (btn && !btn.__bound) {
    btn.__bound = true;
    btn.addEventListener("click", () => run());
  }

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
  initPeriodToggle();
  initNewsFilters();
  initTrendRowClick();

  const urlTicker = getTickerFromQuery();
  document.getElementById("tickerSearch").value = urlTicker;

  requestSendHeight(true);
  setTimeout(() => requestSendHeight(true), 300);
}


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

let __finDetailInited = false;
window.finDetailBootOnce = function(){
  if (__finDetailInited) return;
  __finDetailInited = true;

  try { finDetailInit(); } catch(e){ console.error('finDetailInit error', e); }

  try {
    const t = getTickerFromQuery();
    if (t && window.finDetailLoad) window.finDetailLoad(t);
  } catch(e){}
};

window.finDetailLoad = function(ticker){
  const searchInput = document.getElementById('tickerSearch');
  if (searchInput) searchInput.value = '';
  try { loadAll(ticker); } catch(e){ console.error('finDetailLoad error', e); }
};
window.finDetailRefreshHeaderPrice = function(){
  try { render52w(); } catch(e){}
};

window.finOpenDetail = function(ticker){
  const t = String(ticker||'').toUpperCase().trim();
  if (!t) return;

  try { localStorage.setItem('finapsis_detail_ticker', t); } catch(e){}

  try { switchTab('detail'); } catch(e){}

  try { window.finDetailBootOnce && window.finDetailBootOnce(); } catch(e){}

  setTimeout(() => {
    try { window.finDetailLoad && window.finDetailLoad(t); } catch(e){}
  }, 50);
};

})();

async function fetchLatestTickerNews(ticker){
  const t = String(ticker || "").toUpperCase().trim();
  if (!t) return [];

  const base = window.FIN_DATA_BASE || "";
  const url = `${base}/news/v1/latest/ticker/${encodeURIComponent(t)}.v1.json?t=${Date.now()}`;

  try {
      const r = await fetch(url);
      if (!r.ok) return [];

      const j = await r.json();
      const items = Array.isArray(j?.items) ? j.items : [];

      return items.map(row => ({
        id: row?.[0] || "",
        ts: Number(row?.[1] || 0),
        source: row?.[2] || "",
        sentiment: row?.[3] || "",
        title: row?.[4] || "",
        link: row?.[5] || "",
        ticker: row?.[6] || t,
        image: row?.[7] || "" 
      })).filter(x => x.id && x.title);
  } catch(e) {
      console.warn("[DetailNews] Fetch err:", e);
      return [];
  }
}
