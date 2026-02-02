// Initialize on load
window.companies = window.companies || [];

// View switcher
window.switchView = function(view) {
  if (view === 'temel') {
    const ticker = document.getElementById('tickerSearch')?.value || 
                   document.getElementById('ticker')?.value || '';
    window.location.href = '/detail.html?ticker=' + ticker;
  }
};

// Search functionality (same as detail)
const searchInput = document.getElementById('tickerSearch');
const searchDD = document.getElementById('searchDD');

if (searchInput && searchDD) {
  searchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase().trim();
    
    if (!query) {
      searchDD.style.display = 'none';
      return;
    }

    const matches = window.companies.filter(c => {
      const ticker = (c.ticker || '').toLowerCase();
      const name = (c.name || '').toLowerCase();
      return ticker.includes(query) || name.includes(query);
    }).slice(0, 8);

    if (!matches.length) {
      searchDD.style.display = 'none';
      return;
    }

    searchDD.innerHTML = matches.map(c => `
      <div class="search-item" data-ticker="${c.ticker}">
        <div class="search-ticker">${c.ticker}</div>
        <div class="search-name">${c.name}</div>
      </div>
    `).join('');

    searchDD.style.display = 'block';
  });

  searchDD.addEventListener('click', function(e) {
    const item = e.target.closest('.search-item');
    if (!item) return;
    
    const ticker = item.getAttribute('data-ticker');
    searchInput.value = ticker;
    searchDD.style.display = 'none';
    
    // Update ticker input and reload
    const tickerInput = document.getElementById('ticker');
    if (tickerInput) tickerInput.value = ticker;
    
    document.getElementById('runBtn')?.click();
  });

  document.addEventListener('click', function(e) {
    if (!searchInput.contains(e.target) && !searchDD.contains(e.target)) {
      searchDD.style.display = 'none';
    }
  });
}

// Lookback popup
const lookbackBtn = document.getElementById('lookbackBtn');
const lookbackPopup = document.getElementById('lookbackPopup');
const lookbackLabel = document.getElementById('lookbackLabel');

if (lookbackBtn && lookbackPopup) {
  lookbackBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    lookbackPopup.classList.toggle('hidden');
  });

  lookbackPopup.addEventListener('click', function(e) {
    const btn = e.target.closest('[data-lookback]');
    if (!btn) return;
    
    const value = btn.getAttribute('data-lookback');
    lookbackLabel.textContent = value;
    lookbackPopup.classList.add('hidden');
    
    // Trigger reload with new lookback
    document.getElementById('runBtn')?.click();
  });

  document.addEventListener('click', function(e) {
    if (!lookbackBtn.contains(e.target) && !lookbackPopup.contains(e.target)) {
      lookbackPopup.classList.add('hidden');
    }
  });
}

// Ticker menu popup (same as companies)
const tickerMenuBtn = document.getElementById('tickerMenuBtn');
const tickerMenuPopup = document.getElementById('tickerMenuPopup');

if (tickerMenuBtn && tickerMenuPopup) {
  tickerMenuBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    const rect = this.getBoundingClientRect();
    tickerMenuPopup.style.left = rect.left + 'px';
    tickerMenuPopup.style.top = (rect.bottom + 5) + 'px';
    tickerMenuPopup.classList.toggle('hidden');
  });

  document.addEventListener('click', function(e) {
    if (!tickerMenuBtn.contains(e.target) && !tickerMenuPopup.contains(e.target)) {
      tickerMenuPopup.classList.add('hidden');
    }
  });
}

// Get lookback value from UI
function getCurrentLookback() {
  const label = document.getElementById('lookbackLabel');
  return label ? parseInt(label.textContent) : 400;
}


// =========================
  // CONFIG
  // =========================
  const BASE = "https://finapsis-data.nameless-dream-696b.workers.dev";

  function $(id){ return document.getElementById(id); }
  function setErr(msg){ $("err").textContent = msg || ""; }
  function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
  function round2(x){ return Math.round((x + Number.EPSILON) * 100) / 100; }

  function fmtCompact(x){
    if(x === null || x === undefined || !Number.isFinite(x)) return "—";
    const abs = Math.abs(x);
    if(abs >= 1e12) return (x/1e12).toFixed(2) + "T";
    if(abs >= 1e9)  return (x/1e9).toFixed(2) + "B";
    if(abs >= 1e6)  return (x/1e6).toFixed(2) + "M";
    if(abs >= 1e3)  return (x/1e3).toFixed(2) + "K";
    return String(Math.round(x));
  }

  // LWC param.time bazen number (unix sec) bazen {year,month,day}
  function timeToDateStr(t){
    if(!t) return "—";
    if(typeof t === "number") return new Date(t*1000).toISOString().slice(0,10);
    if(typeof t === "object" && t.year && t.month && t.day){
      const mm = String(t.month).padStart(2,"0");
      const dd = String(t.day).padStart(2,"0");
      return `${t.year}-${mm}-${dd}`;
    }
    return String(t);
  }
  function normTickerInput(raw){ return String(raw||"").trim().toUpperCase(); }

  function buildUrl(market, ticker){
    const t = normTickerInput(ticker);
    const m = String(market||"us").toLowerCase();
    return `${BASE}/ohlcv/ticker/${encodeURIComponent(m)}/${encodeURIComponent(t)}/1d.v1.json`;
  }

  // =========================
  // INDICATORS
  // =========================
  function ema(values, period){
    const out = Array(values.length).fill(null);
    const k = 2/(period+1);
    let prev = null;
    for(let i=0;i<values.length;i++){
      const v = values[i];
      if(!Number.isFinite(v)){ out[i]=null; continue; }
      if(prev === null){
        if(i >= period-1){
          let s=0, ok=true;
          for(let j=i-(period-1); j<=i; j++){
            if(!Number.isFinite(values[j])){ ok=false; break; }
            s += values[j];
          }
          if(ok){ prev = s/period; out[i]=prev; }
        }
      } else {
        prev = (v - prev)*k + prev;
        out[i]=prev;
      }
    }
    return out;
  }

  function rsi(close, period=14){
    const out = Array(close.length).fill(null);
    let avgG=null, avgL=null;
    for(let i=1;i<close.length;i++){
      const ch = close[i]-close[i-1];
      const g = ch>0 ? ch : 0;
      const l = ch<0 ? -ch : 0;

      if(i === period){
        let sumG=0,sumL=0,ok=true;
        for(let k=1;k<=period;k++){
          const d = close[k]-close[k-1];
          sumG += d>0 ? d : 0;
          sumL += d<0 ? -d : 0;
          if(!Number.isFinite(sumG)||!Number.isFinite(sumL)) ok=false;
        }
        if(ok){
          avgG = sumG/period; avgL = sumL/period;
          const rs = avgL===0 ? Infinity : (avgG/avgL);
          out[i] = 100 - (100/(1+rs));
        }
        continue;
      }
      if(avgG!==null && avgL!==null){
        avgG = (avgG*(period-1)+g)/period;
        avgL = (avgL*(period-1)+l)/period;
        const rs = avgL===0 ? Infinity : (avgG/avgL);
        out[i] = 100 - (100/(1+rs));
      }
    }
    return out;
  }

  function findSwingsHL(candles, left=3, right=3){
    const highs=[], lows=[];
    for(let i=left;i<candles.length-right;i++){
      const hi=candles[i]?.high, lo=candles[i]?.low;
      if(!Number.isFinite(hi)||!Number.isFinite(lo)) continue;
      let isHigh=true, isLow=true;
      for(let j=i-left;j<=i+right;j++){
        if(j===i) continue;
        const hj=candles[j]?.high, lj=candles[j]?.low;
        if(!Number.isFinite(hj)||!Number.isFinite(lj)){ isHigh=false; isLow=false; break; }
        if(hj >= hi) isHigh=false;
        if(lj <= lo) isLow=false;
        if(!isHigh && !isLow) break;
      }
      if(isHigh) highs.push({i, price:hi});
      if(isLow) lows.push({i, price:lo});
    }
    return {highs,lows};
  }

  function clusterLevels(points, lastClose, timeArr, volArr, maxLevels=3){
    const bucket = Math.max(lastClose*0.006, lastClose*0.002);
    const clusters=[];
    for(const p of points){
      let placed=false;
      for(const c of clusters){
        if(Math.abs(c.mean - p.price) <= bucket){
          c.points.push(p);
          c.mean = c.points.reduce((a,b)=>a+b.price,0)/c.points.length;
          placed=true; break;
        }
      }
      if(!placed) clusters.push({mean:p.price, points:[p]});
    }

    const n=timeArr.length;
    const scored = clusters.map(c=>{
      const touches=c.points.length;
      const lastIdx=Math.max(...c.points.map(x=>x.i));
      const recency = 1 - (n-1-lastIdx)/Math.max(1,(n-1));

      let vSum=0,vCnt=0;
      for(const p of c.points){
        for(let k=p.i-1;k<=p.i+1;k++){
          if(k>=0 && k<volArr.length && Number.isFinite(volArr[k])){ vSum+=volArr[k]; vCnt++; }
        }
      }
      const vAvg=vCnt?(vSum/vCnt):null;

      let vNorm=0.5;
      if(vAvg!==null){
        const i0=lastIdx;
        const start=Math.max(0,i0-19);
        let s=0,cnt=0;
        for(let k=start;k<=i0;k++){ if(Number.isFinite(volArr[k])){ s+=volArr[k]; cnt++; } }
        const v20=cnt?(s/cnt):null;
        if(v20 && v20>0) vNorm = clamp(vAvg/v20,0.2,2.0)/2.0;
      }

      const score = clamp((touches/6)*0.55 + recency*0.30 + vNorm*0.15, 0, 1);
      return {
        price:c.mean,
        touches,
        score,
        strength: score>=0.78 ? "Güçlü" : (score>=0.55 ? "Orta":"Zayıf")
      };
    });

    scored.sort((a,b)=>b.score-a.score);
    const picked=[];
    for(const lvl of scored){
      if(picked.length>=maxLevels) break;
      if(picked.some(x=>Math.abs(x.price-lvl.price)<=bucket)) continue;
      picked.push(lvl);
    }
    return picked.map(x=>({price:round2(x.price), strength:x.strength, score:round2(x.score), touches:x.touches}));
  }

  // =========================
  // SIGNAL (AL/TUT/SAT)
  // =========================
  function computeSignal({score, trendState, rsi14, volVs}){
    // Basit, explainable: skor + trend + RSI düzeltmesi
    // (İstersen sonra MACD vs ekleriz)
    let s = score;
    if(trendState==="bullish") s += 3;
    if(trendState==="bearish") s -= 3;
    if(Number.isFinite(rsi14) && rsi14 >= 70) s -= 4;     // aşırı alım
    if(Number.isFinite(rsi14) && rsi14 <= 30) s += 4;     // aşırı satım
    if(Number.isFinite(volVs) && volVs >= 1.3) s += 2;    // hacim teyidi
    s = clamp(Math.round(s), 0, 100);

    if(s >= 80) return { label:"GÜÇLÜ AL", color:"lime" };
    if(s >= 65) return { label:"AL", color:"green" };
    if(s >= 45) return { label:"TUT", color:"amber" };
    if(s >= 30) return { label:"SAT", color:"red" };
    return { label:"GÜÇLÜ SAT", color:"red" };
  }

  function trendHuman(trend){
    if(trend==="bullish") return { tr:"pozitif", dot:"green" };
    if(trend==="bearish") return { tr:"negatif", dot:"red" };
    return { tr:"nötr", dot:"" };
  }

  // =========================
  // CHART
  // =========================
  let chart, candleSeries, volumeSeries, ema20Series, ema50Series;
  let srLines = [];         // supports/resistances price lines
  let userLines = [];       // user drawn lines
  let candlesByTime = new Map();
  let volByTime = new Map();

  const visibility = {
    ema20: true,
    ema50: true,
    volume: true,
    sr: true,
    user: true
  };

  function initChart(){
    const el = $("chartWrap");
    el.innerHTML = `
      <div class="tv-tooltip" id="tooltip">
        <div class="tdate" id="ttDate">—</div>
        <div class="row"><span>Açılış</span><b id="ttO">—</b></div>
        <div class="row"><span>Yüksek</span><b id="ttH">—</b></div>
        <div class="row"><span>Düşük</span><b id="ttL">—</b></div>
        <div class="row"><span>Kapanış</span><b id="ttC">—</b></div>
        <div class="row"><span>Hacim</span><b id="ttV">—</b></div>
      </div>
    `;

    chart = LightweightCharts.createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: { background: { type: "solid", color: "#070707" }, textColor: "#d9d9d9" },
      grid: { vertLines: { color: "rgba(255,255,255,0.06)" }, horzLines: { color: "rgba(255,255,255,0.06)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.10)" },
      timeScale: { borderColor: "rgba(255,255,255,0.10)", timeVisible: true, secondsVisible: false },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal }
    });

    candleSeries = chart.addCandlestickSeries({
      upColor: "#31c48d", downColor: "#ff4d4d",
      borderUpColor: "#31c48d", borderDownColor: "#ff4d4d",
      wickUpColor: "#31c48d", wickDownColor: "#ff4d4d",
    });

    volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      scaleMargins: { top: 0.82, bottom: 0.0 },
    });

    ema20Series = chart.addLineSeries({ lineWidth: 2, color: "rgba(49,196,141,0.95)" });
    ema50Series = chart.addLineSeries({ lineWidth: 2, color: "rgba(255,209,102,0.95)" });

    // Responsive
    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);

    setupTooltip();
    setupUserDraw();
    setupLegendToggle();
  }

  function clearPriceLines(lines){
    try{ for(const pl of lines) candleSeries.removePriceLine(pl); }catch(_){}
    lines.length = 0;
  }
  function addSRLine(price, label){
    const pl = candleSeries.createPriceLine({
      price,
      title: label,
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      axisLabelVisible: true,
    });
    srLines.push(pl);
  }
  function addUserLine(price){
    const pl = candleSeries.createPriceLine({
      price,
      title: "Kullanıcı",
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Solid,
      axisLabelVisible: true,
    });
    userLines.push(pl);
  }

  function setupTooltip(){
    const tip = $("tooltip");
    const wrap = $("chartWrap");

    chart.subscribeCrosshairMove((param) => {
      if(!param || !param.time || !param.point){
        tip.style.display = "none";
        return;
      }

      const timeKey = (typeof param.time === "number")
        ? param.time
        : (param.time.year ? `${param.time.year}-${param.time.month}-${param.time.day}` : String(param.time));

      // candlesByTime anahtarını unix seconds (number) tutuyoruz
      // eğer param.time object gelirse, aynı günün unix time'ını bulmak için en yakın match yapacağız:
      let candle = null;
      let vol = null;

      if(typeof param.time === "number"){
        candle = candlesByTime.get(param.time);
        vol = volByTime.get(param.time);
      } else {
        // object day -> map'ten aynı date’e denk gelen ilk entry (lookback içinde)
        const dStr = timeToDateStr(param.time);
        // küçük ve stabil: map’i iterate et (max 2500 satır, sorun olmaz)
        for(const [t, c] of candlesByTime.entries()){
          if(timeToDateStr(t) === dStr){
            candle = c;
            vol = volByTime.get(t);
            break;
          }
        }
      }

      if(!candle){
        tip.style.display = "none";
        return;
      }

      $("ttDate").textContent = timeToDateStr(param.time);
      $("ttO").textContent = Number.isFinite(candle.open)  ? candle.open.toFixed(2)  : "—";
      $("ttH").textContent = Number.isFinite(candle.high)  ? candle.high.toFixed(2)  : "—";
      $("ttL").textContent = Number.isFinite(candle.low)   ? candle.low.toFixed(2)   : "—";
      $("ttC").textContent = Number.isFinite(candle.close) ? candle.close.toFixed(2) : "—";
      $("ttV").textContent = Number.isFinite(vol) ? fmtCompact(vol) : "—";

      const x = clamp(param.point.x, 90, wrap.clientWidth - 90);
      const y = clamp(param.point.y, 90, wrap.clientHeight - 40);
      tip.style.left = x + "px";
      tip.style.top  = y + "px";
      tip.style.display = "block";
    });
  }

  function setupLegendToggle(){
    const legend = $("legend");
    legend.addEventListener("click", (e) => {
      const pill = e.target.closest(".pill");
      if(!pill) return;
      const key = pill.getAttribute("data-key");
      if(!key) return;

      visibility[key] = !visibility[key];
      pill.classList.toggle("off", !visibility[key]);

      if(key === "ema20") ema20Series.applyOptions({ visible: visibility.ema20 });
      if(key === "ema50") ema50Series.applyOptions({ visible: visibility.ema50 });
      if(key === "volume") volumeSeries.applyOptions({ visible: visibility.volume });

      if(key === "sr"){
        // SR: görünürlük için price line'ları recreate etmek daha stabil
        // burada hızlı çözüm: çizgileri remove et / yeniden ekle
        // (state SR listelerini globalde tutuyoruz)
        renderSRLines();
      }
      if(key === "user"){
        renderUserLines();
      }
    });
  }

  // SR level data cache
  let __supports = [];
  let __resistances = [];
  function renderSRLines(){
    clearPriceLines(srLines);
    if(!visibility.sr) return;
    __supports.forEach((lv, i) => addSRLine(lv.price, `Destek ${i+1} (${lv.strength})`));
    __resistances.forEach((lv, i) => addSRLine(lv.price, `Direnç ${i+1} (${lv.strength})`));
  }

  // user lines cache
  let __userLevels = [];
  function renderUserLines(){
    clearPriceLines(userLines);
    if(!visibility.user) return;
    __userLevels.forEach(p => addUserLine(p));
  }

  function setupUserDraw(){
    const el = $("chartWrap");
    el.addEventListener("click", (ev) => {
      if(!ev.shiftKey) return; // SHIFT + click
      // fiyat: click y koordinatını price'a çevir
      const rect = el.getBoundingClientRect();
      const y = ev.clientY - rect.top;

      // LWC coordinateToPrice uses series.priceScale()
      const price = candleSeries.coordinateToPrice(y);
      if(!Number.isFinite(price)) return;

      __userLevels.push(round2(price));
      renderUserLines();
    });
  }

  // =========================
  // UI RENDER (LEFT & ALERTS)
  // =========================
  function renderSummary({ticker, currency, asof, score, signal, momState, riskState, close, volume, trendState, rsi14, volVs, supports, resistances}){
    $("sumTicker").textContent = `${ticker} (${currency||"—"})`;
    $("sumAsOf").textContent = asof || "—";

    // Signal badge
    const dotClass = signal.color === "lime" ? "lime" : (signal.color==="green" ? "green" : (signal.color==="amber" ? "amber" : "red"));
    $("sumSignal").innerHTML = `<span class="dot ${dotClass}"></span> ${signal.label}`;

    $("sumScore").textContent = (score ?? "—");
    $("sumMomRisk").textContent = `Momentum: ${momState} • Risk: ${riskState}`;
    $("scoreBar").style.width = clamp(score||0,0,100) + "%";

    $("sumClose").textContent = Number.isFinite(close) ? close.toFixed(2) : "—";
    $("sumVol").textContent = Number.isFinite(volume) ? fmtCompact(volume) : "—";

    const tr = trendHuman(trendState);
    $("sumTrend").innerHTML = `<span class="dot ${tr.dot}"></span> Trend: ${tr.tr}`;

    $("sumRSI").textContent = Number.isFinite(rsi14) ? rsi14.toFixed(1) : "—";
    $("sumVolVs").textContent = (volVs !== null && Number.isFinite(volVs)) ? volVs.toFixed(2) : "—";

    const r = rsi14;
    let rFill = "linear-gradient(90deg, rgba(194,245,14,.12), rgba(194,245,14,.95))";
    if(Number.isFinite(r) && r >= 70) rFill = "linear-gradient(90deg, rgba(255,209,102,.15), rgba(255,209,102,.95))";
    if(Number.isFinite(r) && r >= 80) rFill = "linear-gradient(90deg, rgba(255,77,77,.15), rgba(255,77,77,.95))";
    $("rsiBar").style.width = Number.isFinite(r) ? clamp(r,0,100)+"%" : "0%";
    $("rsiBar").style.background = rFill;

    const su = supports?.slice(0,2).map(s=>`${s.price} (${s.strength})`).join(" • ") || "—";
    const re = resistances?.slice(0,2).map(r=>`${r.price} (${r.strength})`).join(" • ") || "—";
    $("sumLevels").textContent = `Destek: ${su}  |  Direnç: ${re}`;
  }

  function renderTags(tags){
    $("tags").innerHTML = (tags && tags.length)
      ? tags.map(t => `<span class="tag">${t}</span>`).join("")
      : `<div class="muted" style="margin-top:8px;">Etiket yok</div>`;
  }

  function renderAlerts(alerts){
    if(!alerts || !alerts.length){
      $("alerts").innerHTML = `<div class="muted" style="margin-top:10px;">Uyarı yok</div>`;
      return;
    }
    $("alerts").innerHTML = alerts.map(a=>{
      const sev = a.severity || "low";
      const sevTr = sev==="high" ? "yüksek" : (sev==="medium" ? "orta" : "düşük");
      return `
        <div class="alert">
          <div class="alertHead">
            <div class="alertTitle">${a.title || "Uyarı"}</div>
            <div class="sev ${sev}"><span class="dot"></span> ${sevTr}</div>
          </div>
         a
          <div class="alertText">${a.detail || ""}</div>
          ${a.action_hint ? `<div class="alertHint">Öneri: ${a.action_hint}</div>` : ``}
        </div>
      `;
    }).join("");
  }

  // =========================
  // LOAD
  // =========================
  async function loadAndRender(){
    setErr("");

    const market = "tr";
    const ticker = normTickerInput($("ticker").value);
    const lookback = Number(getCurrentLookback()) || 400;
    const maxLevels = Number($("levels").value) || 3;
    if(!ticker) return setErr("Ticker boş olamaz.");

    const url = buildUrl(market, ticker);

    try{
      const res = await fetch(url, { cache:"no-store" });
      if(!res.ok) throw new Error(`Fetch failed (${res.status}) ${res.statusText}\nURL: ${url}`);

      const json = await res.json();
      if(!json || !Array.isArray(json.rows)) throw new Error("Beklenen format yok: json.rows array değil.");

      const rows = json.rows.slice(-Math.min(lookback, json.rows.length));

      const candles = rows.map(r => ({
        time: r.t,
        open: r.o, high: r.h, low: r.l, close: r.c
      })).filter(x => [x.time,x.open,x.high,x.low,x.close].every(Number.isFinite));

      const volumes = rows.map(r => {
        const up = (Number.isFinite(r.o) && Number.isFinite(r.c)) ? (r.c >= r.o) : true;
        return {
          time: r.t,
          value: Number.isFinite(r.v) ? r.v : 0,
          color: up ? "rgba(49,196,141,0.45)" : "rgba(255,77,77,0.45)"
        };
      }).filter(x => Number.isFinite(x.time));

      candlesByTime = new Map();
      volByTime = new Map();
      for(const c of candles) candlesByTime.set(c.time, c);
      for(const v of volumes) volByTime.set(v.time, v.value);

      const closeArr = candles.map(c=>c.close);
      const volArr = rows.map(r => Number.isFinite(r.v) ? r.v : NaN);

      const ema20Arr = ema(closeArr, 20);
      const ema50Arr = ema(closeArr, 50);
      const rsiArr = rsi(closeArr, 14);

      const ema20Data = candles.map((c,i)=> Number.isFinite(ema20Arr[i]) ? ({time:c.time, value: ema20Arr[i]}) : null).filter(Boolean);
      const ema50Data = candles.map((c,i)=> Number.isFinite(ema50Arr[i]) ? ({time:c.time, value: ema50Arr[i]}) : null).filter(Boolean);

      // Levels
      const swings = findSwingsHL(candles, 3, 3);
      const lastClose = closeArr[closeArr.length-1];
      const timeArr = candles.map(c=>c.time);
      __supports = Number.isFinite(lastClose) ? clusterLevels(swings.lows, lastClose, timeArr, volArr, maxLevels) : [];
      __resistances = Number.isFinite(lastClose) ? clusterLevels(swings.highs, lastClose, timeArr, volArr, maxLevels) : [];

      // Trend state
      const e20 = ema20Arr[ema20Arr.length-1];
      const e50 = ema50Arr[ema50Arr.length-1];
      let trendState = "neutral";
      if(Number.isFinite(e20) && Number.isFinite(e50) && Number.isFinite(lastClose)){
        if(e20 > e50 && lastClose > e20) trendState = "bullish";
        else if(e20 < e50 && lastClose < e20) trendState = "bearish";
      }

      // Vol/Avg20
      let volVs = null;
      if(volArr.length >= 20){
        const lastV = volArr[volArr.length-1];
        let s=0,cnt=0;
        for(let i=Math.max(0,volArr.length-20); i<volArr.length; i++){
          if(Number.isFinite(volArr[i])){ s+=volArr[i]; cnt++; }
        }
        const avg = cnt ? (s/cnt) : null;
        if(avg && avg>0 && Number.isFinite(lastV)) volVs = lastV/avg;
      }

      // Score
      const r14 = rsiArr[rsiArr.length-1];
      let score = 50;
      if(trendState==="bullish") score += 12;
      if(trendState==="bearish") score -= 12;
      if(Number.isFinite(r14)){
        if(r14 >= 70) score -= 6;
        else if(r14 <= 30) score += 6;
        else if(r14 >= 55) score += 4;
        else if(r14 <= 45) score -= 4;
      }
      if(volVs !== null){
        if(volVs >= 1.3) score += 5;
        else if(volVs <= 0.7) score -= 3;
      }
      score = clamp(Math.round(score), 0, 100);

      const signal = computeSignal({score, trendState, rsi14:r14, volVs});

      const momState = (Number.isFinite(r14) && r14 >= 55 && trendState==="bullish") ? "strong" :
                       (Number.isFinite(r14) && r14 <= 45 && trendState==="bearish") ? "weak" : "neutral";
      const riskState = (Number.isFinite(r14) && r14 >= 70) ? "elevated" : "normal";

      // Tags
      const tags = [];
      if(trendState==="bullish") tags.push("trend_pozitif");
      if(trendState==="bearish") tags.push("trend_negatif");
      if(Number.isFinite(r14) && r14 >= 70) tags.push("rsi_aşırı_alım");
      if(Number.isFinite(r14) && r14 <= 30) tags.push("rsi_aşırı_satım");
      if(volVs !== null && volVs >= 1.2) tags.push("hacim_ort_üstü");

      // Alerts
      const alerts = [];
      if(Number.isFinite(r14) && r14 >= 70){
        alerts.push({
          severity: "medium",
          title: "RSI aşırı alım bölgesinde",
          detail: `RSI(14)=${round2(r14)} → kısa vadeli düzeltme riski artabilir.`,
          action_hint: "Yeni alım için geri çekilme beklenebilir."
        });
      }
      if(__resistances.length && Number.isFinite(lastClose) && lastClose > __resistances[0].price * 1.002){
        const volOk = (volVs !== null) ? (volVs >= 1.2) : false;
        alerts.push({
          severity: "low",
          title: "Direnç kırılımı sinyali",
          detail: `${round2(__resistances[0].price)} üstü kapanış; hacim teyidi: ${volOk ? "var" : "yok"}.`,
          action_hint: "Stop seviyesi için en yakın destek izlenebilir."
        });
      }

      // Render series
      candleSeries.setData(candles);
      volumeSeries.setData(volumes);
      ema20Series.setData(ema20Data);
      ema50Series.setData(ema50Data);

      // Apply visibility after data set
      ema20Series.applyOptions({ visible: visibility.ema20 });
      ema50Series.applyOptions({ visible: visibility.ema50 });
      volumeSeries.applyOptions({ visible: visibility.volume });

      renderSRLines();
      renderUserLines();

      chart.timeScale().fitContent();

      // Left summary
      const last = candles[candles.length-1];
      renderSummary({
        ticker: (json.ticker || ticker),
        currency: json.currency || null,
        asof: timeToDateStr(last?.time),
        score,
        signal,
        momState,
        riskState,
        close: last?.close,
        volume: Number.isFinite(volArr[volArr.length-1]) ? volArr[volArr.length-1] : null,
        trendState,
        rsi14: Number.isFinite(r14) ? r14 : null,
        volVs,
        supports: __supports,
        resistances: __resistances
      });

      renderTags(tags);
      renderAlerts(alerts);

    }catch(e){
      setErr(String(e && e.stack ? e.stack : e));
    }
  }

  // =========================
  // INIT
  // =========================
  initChart();
  $("runBtn").addEventListener("click", loadAndRender);
  $("ticker").addEventListener("keydown", (ev)=>{ if(ev.key==="Enter") loadAndRender(); });
  loadAndRender();