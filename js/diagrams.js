// js/diagrams.js

(function(){
  let dgInited = false;
  let chartObj = null;

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

  window.dgState = { 
      analysis: 'pe_margin', 
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
    return list.filter(c => (c.group || 'bist') === window.activeGroup);
  }

  window.dgUpdateBadges = function() {
      const area = document.getElementById("dgBadgeArea");
      if(!area) return;

      let groupLabel = "BIST";
      if(window.activeGroup === 'nyse') groupLabel = "NYSE";
      if(window.activeGroup === 'nasdaq') groupLabel = "NASDAQ";

      const currentAnalysisObj = ANALYSIS_OPTS.find(x => x.id === window.dgState.analysis) || ANALYSIS_OPTS[0];
      
      const currentSector = window.dgState.sector === 'all' ? 'TÜMÜ' : window.dgState.sector;
      const isSectorActive = window.dgState.sector !== 'all';

      const currentIndustry = window.dgState.industry === 'all' ? 'TÜMÜ' : window.dgState.industry;
      const isIndustryActive = window.dgState.industry !== 'all';
      const indStyle = isSectorActive ? '' : 'opacity:0.4; pointer-events:none; filter:grayscale(1);';

      let html = '';

      html += `
          <div style="position:relative;">
              <div class="sc-badge market-badge" onclick="dgTogglePopup('market', event)">
                  <i class="fa-solid fa-globe"></i>
                  BORSA: ${groupLabel} <i class="fa-solid fa-chevron-down" style="font-size:9px; opacity:0.5; margin-left:4px;"></i>
              </div>
              <div id="dgPopup_market" class="cl-popup-menu" onclick="event.stopPropagation()">
                  <div class="cl-popup-list">
                      <div class="cl-popup-item ${window.activeGroup==='bist'?'selected':''}" onclick="setGroup('bist')">BIST (İstanbul)</div>
                      <div class="cl-popup-item ${window.activeGroup==='nyse'?'selected':''}" onclick="setGroup('nyse')">NYSE (New York)</div>
                      <div class="cl-popup-item ${window.activeGroup==='nasdaq'?'selected':''}" onclick="setGroup('nasdaq')">NASDAQ</div>
                  </div>
              </div>
          </div>
      `;

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

  window.dgInitOnce = function(){
    finEnsureCompanies();
    finEnsureBenchmarks();
    
    if(typeof finBuildMapForActiveGroup === "function") {
        finBuildMapForActiveGroup(() => {
            if (dgInited) return;
            dgInited = true;
            window.dgRender();
        });
    } else {
        if (dgInited) return;
        dgInited = true;
        window.dgRender();
    }
  };

})();