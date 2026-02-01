// js/indicators.js

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

window.indFilterState = {
    group: "all" 
};

window.indUpdateBadge = function () {
  const area = document.getElementById("indBadgeArea");
  if (!area || !window.__INDICATORS_MAP) return;

  const root = window.__INDICATORS_MAP || {};
  const mapObj = (root && typeof root === "object" && root.map && typeof root.map === "object")
    ? root.map
    : root;

  const items = Object.entries(mapObj).map(([k, v]) => ({ key: String(k), v: (v || {}) }));

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
      if (typeof window.renderIndicators === "function") window.renderIndicators();
      window.indUpdateBadge();
    };
  });
};

window.renderIndicators = function() {
    indUpdateBadge();
    const tbody = document.getElementById("indicators-tbody");
    if (!tbody || !window.__INDICATORS_MAP || !window.__INDICATORS_SUMMARY) return;

    const map = window.__INDICATORS_MAP;
    const summaryObj = window.__INDICATORS_SUMMARY || { asOf: null, items: [] };
    const summaryArr = Array.isArray(summaryObj.items) ? summaryObj.items : [];

    const asOfEl = document.getElementById("indAsOf");
    if (asOfEl) asOfEl.textContent = `Son güncelleme: ${summaryObj.asOf || "-"}`;

    const formatDate = (dateStr, format) => {
      if (dateStr === null || dateStr === undefined) return "-";
      const s = String(dateStr).trim();
      if (!s || s === "-" || s.toLowerCase() === "null") return "-";

      let d = null;
      const norm = s.replaceAll("/", "-").replaceAll(".", "-");
      let m = norm.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (m) {
        const dd = parseInt(m[1], 10);
        const mm = parseInt(m[2], 10);
        const yyyy = parseInt(m[3], 10);
        d = new Date(yyyy, mm - 1, dd);
      } else {
        const tryD = new Date(s);
        if (!isNaN(tryD.getTime())) d = tryD;
      }

      if (!d || isNaN(d.getTime())) return s;

      const dd = String(d.getDate()).padStart(2, "0");
      const mm2 = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      const MMM = new Intl.DateTimeFormat("tr-TR", { month: "short" }).format(d).replace(".", "");
      const f = String(format || "dd/mm/yyyy").trim().toLowerCase();

      if (f === "mmm-yyyy") return `${MMM}-${yyyy}`;
      if (f === "mm-yyyy")  return `${mm2}-${yyyy}`;
      if (f === "yyyy")     return `${yyyy}`;
      if (f === "dd-mm-yyyy") return `${dd}-${mm2}-${yyyy}`;
      if (f === "dd.mm.yyyy") return `${dd}.${mm2}.${yyyy}`;
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
    const getL = (id) => { const s = getS(id); return { value: s.cv, date: s.cd }; };

    const usd_l = parseFloat(getL("usdtry").value);
    const usd_s = getS("usdtry");
    const eur_l = parseFloat(getL("eurusd").value);
    const eur_s = getS("eurusd");
    const gbp_l = parseFloat(getL("gbpusd").value);
    const gbp_s = getS("gbpusd");

    let allItems = [];
    Object.keys(map).forEach(key => {
        const info = map[key];
        if (window.indFilterState.group !== "all" && info.group !== window.indFilterState.group) return;

        const s = getS(key);
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
              <div style="color:${priceColor}; font-weight:600;">${formatInd(item.cv, item)}</div>
              <div style="font-size:9px; color:#9CA3AF;">${formatDate(item.cd, item.date_format)}</div>
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