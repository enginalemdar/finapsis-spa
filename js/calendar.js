// js/calendar.js

window.__calSelectedEventId = null;

window.calOpenListModal = function (eventId) {
  window.__calSelectedEventId = String(eventId || "");

  const ov = document.getElementById("calListModalOverlay");
  const form = document.getElementById("calFormContainer");
  const ok = document.getElementById("calSuccessContainer");

  if (!ov || !form || !ok) return;

  form.style.display = "";
  ok.style.display = "none";

  ov.style.display = "flex";
  const nameEl = document.getElementById("calUserName");
  if (nameEl) setTimeout(() => nameEl.focus(), 0);

  window.__calUpdateSendBtn?.();
};

window.calCloseListModal = function () {
  const ov = document.getElementById("calListModalOverlay");
  if (ov) ov.style.display = "none";
  window.__calSelectedEventId = null;
};

window.__CAL_REMINDER_ENDPOINT = "https://finapsis-data.nameless-dream-696b.workers.dev/calendar/reminders";

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

  if (!eventId) {
    alert("Etkinlik bulunamadı. Lütfen tekrar deneyin.");
    return;
  }

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

    if (!res.ok) {
      let msg = `Hata: ${res.status}`;
      try {
        const t = await res.text();
        if (t) msg += `\n${t}`;
      } catch (_) {}
      throw new Error(msg);
    }

    if (form) form.style.display = "none";
    if (ok) ok.style.display = "";

    if (nameEl) nameEl.value = "";
    if (emailEl) emailEl.value = "";
    if (consentEl) consentEl.checked = false;

  } catch (err) {
    console.error("[CAL] reminder submit failed:", err);
    alert("Hatırlatıcı oluşturulamadı. Lütfen tekrar deneyin.\n\n" + (err?.message || ""));
    if (sendBtn) sendBtn.disabled = false;
  } finally {
    if (sendBtn && oldTxt) sendBtn.textContent = oldTxt;
  }
};

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


document.addEventListener("click", (e) => {
  const ov = document.getElementById("calListModalOverlay");
  const content = document.getElementById("calListModalContent");
  if (!ov || !content) return;

  if (ov.style.display !== "flex") return;

  if (e.target === ov) window.calCloseListModal();
});

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

["calUserName", "calUserEmail", "calCheckConsent"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", window.__calUpdateSendBtn);
  if (el) el.addEventListener("change", window.__calUpdateSendBtn);
});

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

window.__CAL_LIST_PROMISE = window.__CAL_LIST_PROMISE || null;

function __calPad2(n){ return String(n).padStart(2,'0'); }

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
  const arr = Array.isArray(doc?.items) ? doc.items : [];
  return arr.map(x => {
    const t = Number(x?.t || 0) || 0; 
    const iso = x?.u ? String(x.u) : (t ? new Date(t*1000).toISOString() : "");
    return {
      id: String(x?.id || ""),
      country_code: String(x?.cc || "").toLowerCase(),
      impact: Number(x?.imp || 1) || 1,
      name: String(x?.n || ""),
      expected: String(x?.e || ""),
      actual: String(x?.a || ""),
      prev: String(x?.p || ""),
      timestamp: iso,                 
      date_full: t ? __calDateFullTR(t) : ""  
    };
  });
}

window.finEnsureCalendarList = async function(force = false){
  if (!force && window.__CALENDAR_LIST_LOADED === true && Array.isArray(window.calendarList)) return;

  try {
    const url = `${FIN_DATA_BASE}/calendar/latest.v1.json?ts=${Date.now()}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`calendar latest fetch failed: ${res.status}`);

    const payload = await res.json();

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
    window.__CALENDAR_LIST_LOADED = true; 
  }
};

window.calListState = {
    time: 'today',    
    regions: [],      
    minImpact: 1,     
    search: ''        
};

window.calListSetTime = function(period, btn) {
    window.calListState.time = period;
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

function calGetDateRange(period) {
    const now = new Date();
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

if (period === 'this-week') {
    const day = now.getDay(); 
    const mondayOffset = (day === 0 ? -6 : 1 - day); 
    start.setDate(now.getDate() + mondayOffset);

    const end2 = new Date(start);
    end2.setHours(23,59,59,999);
    end2.setDate(start.getDate() + 6);

    return { start, end: end2 };
}

    if (period === 'this-month') {
        start.setDate(1);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        return { start, end };
    }
    
    if (period === 'next-week') {
    const day = now.getDay();
    const diff = (day === 0 ? 1 : 8 - day);

    start.setDate(now.getDate() + diff);

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

    return null; 
}

window.renderCalendarList = async function() {
  await finEnsureCalendarList(); 

  const tbody = document.getElementById("calendar-list-tbody");
  if(!tbody) return;

  let data = window.calendarList || [];
  const s = window.calListState;

  data = data.filter(item => {
    const tsStr = item.timestamp || item.u || (item.t ? new Date(item.t * 1000).toISOString() : null);
    const ts = tsStr ? new Date(tsStr) : new Date(0);

    const countryCode = (item.country_code || item.cc || "").toLowerCase();
    const impact = Number(item.impact ?? item.imp ?? 1);

    const name = (item.name || item.n || "");
    const txt = String(name).toLowerCase();

    if (s.search) {
        if (!txt.includes(s.search)) return false;
    }

    if (!s.search && s.time !== 'all') {
        const range = calGetDateRange(s.time);
        if (range && (ts < range.start || ts > range.end)) return false;
    }

    if (s.regions.length > 0) {
        if (!s.regions.includes(countryCode)) return false;
    }

    if (impact < s.minImpact) return false;

    return true;
});

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