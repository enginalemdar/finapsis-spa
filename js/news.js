// js/news.js

(function(){
  let booted = false;

  window.finNewsBootOnce = async function(){
    if (booted) return;
    booted = true;
    try { await finNewsInit(); } catch(e){ console.warn("news init err", e); }
  };

  async function finNewsInit(){
    let allIds = [];             
    const itemCache = new Map(); 
    
    let activeFilters = [];
    let tempFilters = [];
    let searchQuery = "";
    
    let currentPage = 1;
    const ITEMS_PER_PAGE = 20; 
    let currentShareItem = null;

    const container = document.getElementById('news-container');
    const searchInput = document.getElementById('news-search-input');
    const filterBar = document.getElementById('filter-status-bar');
    const activeFiltersList = document.getElementById('active-filters-list');
    const clearBtn = document.getElementById('clear-filter-btn');
    const emptyState = document.getElementById('empty-state');
    const filterBadge = document.getElementById('filter-badge');

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
        itemCache.forEach(item => {
            const val = item[key];
            if (Array.isArray(val)) val.forEach(v => set.add(v));
            else if (val) set.add(val);
        });
        return Array.from(set);
    }

    async function fetchIndexIds(){
      const BASE = window.FIN_DATA_BASE || "";
      const url = `${BASE}/news/v1/mapping/id_map.json?t=${Date.now()}`; 
      try {
          const r = await fetch(url);
          if (!r.ok) return [];
          const j = await r.json();
          const m = j?.map && typeof j.map === "object" ? j.map : null;
          if (!m) return [];
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

    async function loadAllNews(){
        container.innerHTML = `<div style="text-align:center; padding:40px; color:#888;"><div class="spinner" style="margin:0 auto 10px auto;"></div>Haber listesi alınıyor...</div>`;
        
        allIds = await fetchIndexIds();

        if (!allIds.length){
            container.innerHTML = `<div style="text-align:center; padding:40px; color:#888;">Haber bulunamadı.</div>`;
            return;
        }

        await loadBatch(0, 25);
        
        initFilterOptions();
        render(); 
    }

    async function loadBatch(start, count) {
        const end = Math.min(start + count, allIds.length);
        if(start >= end) return;

        const idsToLoad = allIds.slice(start, end);
        const promises = idsToLoad.map(id => fetchNewsItem(id));
        await Promise.all(promises);
    }

    function render() {
        container.innerHTML = '';
        activeFiltersList.innerHTML = '';

        if(activeFilters.length > 0) {
            filterBadge.style.display = 'block';
            filterBar.style.display = 'flex';
            renderActiveFiltersBadge();
        } else {
            filterBadge.style.display = 'none';
            filterBar.style.display = 'none';
        }

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

        if (filteredData.length === 0) {
            emptyState.style.display = 'block';
            paginationControls.style.display = 'none';
            return;
        }
        emptyState.style.display = 'none';

        const totalItems = filteredData.length;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        
        if (currentPage > totalPages) currentPage = 1;

        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const pageData = filteredData.slice(startIndex, endIndex);

        pageInfo.textContent = `SAYFA ${currentPage} / ${totalPages}`;
        prevBtn.disabled = currentPage === 1;
        
        const hasMoreServerData = itemCache.size < allIds.length;
        
        if (currentPage >= totalPages) {
            nextBtn.disabled = !hasMoreServerData; 
            if(hasMoreServerData) {
                nextBtn.innerText = "DAHA YÜKLE →";
                nextBtn.onclick = loadMoreData; 
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

    function renderActiveFiltersBadge() {
      renderActiveFilters(); 
    }

    async function nextPage() {
        currentPage++;
        render();
        window.scrollTo(0,0);
    }

    async function loadMoreData() {
        const btn = document.getElementById('next-page-btn');
        btn.disabled = true;
        btn.innerText = "Yükleniyor...";
        
        const loadedCount = itemCache.size;
        await loadBatch(loadedCount, 25);
        
        initFilterOptions();
        
        render();
    }

    prevBtn.onclick = () => { if (currentPage > 1){ currentPage--; render(); window.scrollTo(0,0); } };

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

    await loadAllNews();
  }
})();