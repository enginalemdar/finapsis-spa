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
