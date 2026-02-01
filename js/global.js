// ... (global.js'in üst kısımları aynı kalsın) ...

// ============================================
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
    // ... (Target belirleme mantığı aynen kalabilir) ...
    // Kısaca:
    if (forced) target = forced.includes('portfolio') ? 'portfolio.html' : target; // vs vs..
    else if (hasCode) target = 'portfolio.html';
    else if (saved) target = saved;

    setTimeout(() => {
      switchTab(target);
      requestAnimationFrame(hidePL);
    }, 100); // Biraz daha güvenli pay

  } catch (e) {
    console.error(e);
    requestAnimationFrame(hidePL);
  }
}

// Bu kısım çok önemli: Script dinamik yüklendiği için
// DOMContentLoaded'ı beklemek yerine hemen çalışmalı veya durumu kontrol etmeli.
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootFinapsis);
} else {
    bootFinapsis(); // DOM zaten hazırsa hemen çalış
}