// Tauri APIs
// Tauri APIs - Wrapper setup
const { invoke } = window.__TAURI__.core || { invoke: async () => console.warn('Tauri invoke not available') };
const { listen } = window.__TAURI__.event || { listen: () => console.warn('Tauri listen not available') };
const { getCurrentWindow } = window.__TAURI__.window || { getCurrentWindow: () => null };


// --- ELEMENTOS DEL DOM ---
const urlInput = document.getElementById("url-bar");
const btnGo = document.getElementById("btn-go");
const btnBack = document.getElementById("btn-back");
const btnForward = document.getElementById("btn-forward");
const btnRefresh = document.getElementById("btn-refresh");
const btnNewTab = document.getElementById("btn-new-tab");
const btnAdblock = document.getElementById("btn-adblock");
const btnBookmark = document.getElementById("btn-bookmark");
const btnDownloads = document.getElementById("btn-downloads");
const btnMenu = document.getElementById("btn-menu");
const tabsContainer = document.getElementById("tabs-container");
const progressBar = document.getElementById("progress-bar");

// Menú
const dropdownMenu = document.getElementById("dropdown-menu");
const menuHistory = document.getElementById("menu-history");
const menuSearchEngine = document.getElementById("menu-search-engine");
const menuBookmarks = document.getElementById("menu-bookmarks");

// Overlays
const historyOverlay = document.getElementById("history-overlay");
const historyList = document.getElementById("history-list");
const btnCloseHistory = document.getElementById("btn-close-history");
const btnClearHistory = document.getElementById("btn-clear-history");
const bookmarksOverlay = document.getElementById("bookmarks-overlay");
const bookmarksList = document.getElementById("bookmarks-list");
const btnCloseBookmarks = document.getElementById("btn-close-bookmarks");
const downloadsOverlay = document.getElementById("downloads-overlay");
const downloadsList = document.getElementById("downloads-list");
const btnCloseDownloads = document.getElementById("btn-close-downloads");
const btnClearDownloads = document.getElementById("btn-clear-downloads");

// Search Engine
const searchEngineOverlay = document.getElementById("search-engine-overlay");
const btnCloseSearchEngine = document.getElementById("btn-close-search-engine");
const searchEngineItems = document.querySelectorAll(".search-engine-item");

// Window Controls
const btnMinimize = document.getElementById("btn-minimize");
const btnMaximize = document.getElementById("btn-maximize");
const btnCloseWindow = document.getElementById("btn-close-window");

// --- CONTROLES DE VENTANA ---
// --- CONTROLES DE VENTANA ---
// Usamos comandos directos al backend para asegurar funcionalidad
if (btnMinimize) {
  btnMinimize.addEventListener("click", () => {
    invoke("minimize_window").catch(e => console.error("Error minimizing:", e));
  });
}

if (btnMaximize) {
  btnMaximize.addEventListener("click", () => {
    invoke("maximize_window").catch(e => console.error("Error maximizing:", e));
  });
}

if (btnCloseWindow) {
  btnCloseWindow.addEventListener("click", () => {
    invoke("close_window").catch(e => console.error("Error closing:", e));
  });
}


// --- MOTORES DE BÚSQUEDA ---
const SEARCH_ENGINES = {
  duckduckgo: "https://duckduckgo.com/?q=",
  google: "https://www.google.com/search?q=",
  brave: "https://search.brave.com/search?q=",
  startpage: "https://www.startpage.com/search?q="
};

let currentSearchEngine = localStorage.getItem("atom-search-engine") || "duckduckgo";

// --- ESTADO ---
const tabs = new Map();
let activeTabId = null;
const isPrivateMode = false;
const isAdblockEnabled = true;

// --- UTILIDADES ---
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// --- FAVICON PRIVADO (sin Google) ---
function getFaviconUrl(url) {
  try {
    const urlObj = new URL(url);
    // Usar directamente el favicon del sitio — sin filtrar por Google
    return urlObj.origin + '/favicon.ico';
  } catch {
    return '';
  }
}

// --- FUNCIONES AUXILIARES ---
function createTabElement(tabId, isActive = false) {
  const tabEl = document.createElement("div");
  tabEl.className = "tab animate-enter" + (isActive ? " active" : "");
  tabEl.dataset.tabId = tabId;
  tabEl.title = "Nueva pestaña";
  tabEl.innerHTML = `
    <img class="tab-favicon" src="" alt="" onerror="this.src='ico.png'" />
    <span class="tab-title">Nueva pestaña</span>
    <button class="tab-close" title="Cerrar">×</button>
  `;

  tabEl.addEventListener("click", (e) => {
    if (!e.target.classList.contains("tab-close")) switchTab(tabId);
  });

  tabEl.querySelector(".tab-close").addEventListener("click", (e) => {
    e.stopPropagation();
    closeTab(tabId);
  });

  return tabEl;
}

// --- FUNCIONES DE TABS ---
async function createTab(url = null) {
  try {
    const tabId = await invoke("create_tab", { url });
    tabs.set(tabId, { url: url || "about:blank", title: "Nueva pestaña" });
    const tabEl = createTabElement(tabId, true);
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tabsContainer.insertBefore(tabEl, btnNewTab);
    activeTabId = tabId;
    urlInput.value = "";
    urlInput.focus();
  } catch (error) {
    console.error("Error creando pestaña:", error);
  }
}

async function closeTab(tabId) {
  try {
    await invoke("close_tab", { tabId });
    tabs.delete(tabId);
    const tabEl = document.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabEl) tabEl.remove();

    if (tabs.size === 0) {
      await createTab();
    } else if (activeTabId === tabId) {
      const firstTabId = tabs.keys().next().value;
      await switchTab(firstTabId);
    }
  } catch (error) {
    console.error("Error cerrando pestaña:", error);
  }
}

async function switchTab(tabId) {
  try {
    await invoke("switch_tab", { tabId });
    activeTabId = tabId;
    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.tabId === tabId);
    });
    const tabInfo = tabs.get(tabId);
    if (tabInfo) {
      showDomainOnly(tabInfo.url);
      updateBookmarkStar();
    }
  } catch (error) {
    console.error("Error cambiando de pestaña:", error);
  }
}

function updateTabInfo(tabId, url) {
  const tabData = tabs.get(tabId);
  if (tabData) {
    tabData.url = url;
    tabs.set(tabId, tabData);
  }

  const tabEl = document.querySelector(`[data-tab-id="${tabId}"]`);
  if (tabEl) {
    if (url === 'atom://home' || url.includes('home.html')) {
      tabEl.querySelector(".tab-title").textContent = "Nueva pestaña";
      tabEl.querySelector(".tab-favicon").src = "ico.png";
      tabEl.title = "Nueva pestaña";
    } else {
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace("www.", "");
        tabEl.querySelector(".tab-title").textContent = domain || "Nueva pestaña";
        // Favicon privado — directo del dominio
        tabEl.querySelector(".tab-favicon").src = getFaviconUrl(url);
        tabEl.title = url;
      } catch {
        tabEl.querySelector(".tab-title").textContent = "Nueva pestaña";
      }
    }
  }

  if (tabId === activeTabId) showDomainOnly(url);
}

// --- NAVEGACIÓN ---
function handleNavigation() {
  const input = urlInput.value.trim();
  if (!input) return;

  let finalUrl;
  if (input.includes(".") && !input.includes(" ")) {
    finalUrl = input.startsWith("http") ? input : "https://" + input;
  } else {
    const searchUrl = SEARCH_ENGINES[currentSearchEngine] || SEARCH_ENGINES.duckduckgo;
    finalUrl = searchUrl + encodeURIComponent(input);
  }

  startLoading();
  urlInput.blur();
  invoke("navigate", { url: finalUrl });
}

// --- HISTORIAL ---
const saveToHistoryDisk = debounce((history) => {
  localStorage.setItem("atom-history", JSON.stringify(history.slice(0, 100)));
}, 2000);

function saveToHistory(url) {
  if (isPrivateMode) return;
  if (!url || url === "about:blank" || url.startsWith("atom://")) return;
  const history = JSON.parse(localStorage.getItem("atom-history") || "[]");
  if (history[0]?.url === url) return;
  history.unshift({ url, time: Date.now() });
  saveToHistoryDisk(history);
}

// --- LOADING ---
let loadingTimeout;

function startLoading() {
  clearTimeout(loadingTimeout);
  progressBar.classList.remove("complete");
  progressBar.style.width = "0%";
  void progressBar.offsetWidth;
  progressBar.classList.add("loading");
  btnRefresh.classList.add("loading");
  loadingTimeout = setTimeout(stopLoading, 10000);
}

function stopLoading() {
  clearTimeout(loadingTimeout);
  progressBar.classList.remove("loading");
  progressBar.style.width = "100%";
  setTimeout(() => {
    progressBar.classList.add("complete");
    btnRefresh.classList.remove("loading");
    setTimeout(() => {
      progressBar.style.width = "0%";
      progressBar.classList.remove("complete");
    }, 300);
  }, 200);
}

// --- URL CHANGED ---
listen('url-changed', (event) => {
  const { id, url } = event.payload;
  stopLoading();
  updateTabInfo(id, url);
  saveToHistory(url);
  if (id === activeTabId) updateBookmarkStar();
});

// --- URL BAR ---
function showDomainOnly(url) {
  if (url === 'atom://home' || url.includes('home.html')) {
    urlInput.value = '';
    urlInput.dataset.fullUrl = '';
    return;
  }
  try {
    const urlObj = new URL(url);
    urlInput.value = urlObj.hostname.replace('www.', '');
    urlInput.dataset.fullUrl = url;
  } catch {
    urlInput.value = url;
    urlInput.dataset.fullUrl = url;
  }
}

urlInput.addEventListener('focus', () => {
  if (urlInput.dataset.fullUrl) {
    urlInput.value = urlInput.dataset.fullUrl;
    urlInput.select();
  }
});

urlInput.addEventListener('blur', () => {
  if (urlInput.dataset.fullUrl && urlInput.value === urlInput.dataset.fullUrl) {
    showDomainOnly(urlInput.dataset.fullUrl);
  }
});

// --- EVENTOS DE NAVEGACIÓN ---
urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleNavigation(); });
btnGo.addEventListener("click", handleNavigation);
btnBack.addEventListener("click", () => invoke("go_back"));
btnForward.addEventListener("click", () => invoke("go_forward"));
btnRefresh.addEventListener("click", () => { startLoading(); invoke("reload"); });
btnNewTab.addEventListener("click", () => createTab());

// --- MENÚ ---
btnMenu.addEventListener("click", (e) => { e.stopPropagation(); dropdownMenu.classList.toggle("hidden"); });
document.addEventListener("click", () => dropdownMenu.classList.add("hidden"));

menuHistory.addEventListener("click", () => {
  dropdownMenu.classList.add("hidden");
  renderHistory();
  historyOverlay.classList.remove("hidden");
});

menuSearchEngine.addEventListener("click", () => {
  dropdownMenu.classList.add("hidden");
  updateSearchEngineSelection();
  searchEngineOverlay.classList.remove("hidden");
});

menuBookmarks.addEventListener("click", () => {
  dropdownMenu.classList.add("hidden");
  renderBookmarks();
  bookmarksOverlay.classList.remove("hidden");
});

// --- MOTOR DE BÚSQUEDA ---
function updateSearchEngineSelection() {
  searchEngineItems.forEach(item => {
    item.classList.toggle("active", item.dataset.engine === currentSearchEngine);
  });
}

searchEngineItems.forEach(item => {
  item.addEventListener("click", () => {
    currentSearchEngine = item.dataset.engine;
    localStorage.setItem("atom-search-engine", currentSearchEngine);
    updateSearchEngineSelection();
    searchEngineOverlay.classList.add("hidden");
  });
});

btnCloseSearchEngine.addEventListener("click", () => searchEngineOverlay.classList.add("hidden"));

// --- ATAJOS DE TECLADO ---
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "l") { e.preventDefault(); urlInput.focus(); urlInput.select(); }
  if ((e.ctrlKey && e.key === "r") || e.key === "F5") { e.preventDefault(); startLoading(); invoke("reload"); }
  if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); invoke("go_back"); }
  if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); invoke("go_forward"); }
  if (e.ctrlKey && e.key === "t") { e.preventDefault(); createTab(); }
  if (e.ctrlKey && e.key === "w") { e.preventDefault(); if (activeTabId) closeTab(activeTabId); }

  if (e.ctrlKey && !e.shiftKey && e.key === "Tab") {
    e.preventDefault();
    const tabIds = Array.from(tabs.keys());
    const idx = tabIds.indexOf(activeTabId);
    switchTab(tabIds[(idx + 1) % tabIds.length]);
  }
  if (e.ctrlKey && e.shiftKey && e.key === "Tab") {
    e.preventDefault();
    const tabIds = Array.from(tabs.keys());
    const idx = tabIds.indexOf(activeTabId);
    switchTab(tabIds[(idx - 1 + tabIds.length) % tabIds.length]);
  }

  if (e.key === "Escape") {
    historyOverlay.classList.add("hidden");
    bookmarksOverlay.classList.add("hidden");
    searchEngineOverlay.classList.add("hidden");
    downloadsOverlay.classList.add("hidden");
    dropdownMenu.classList.add("hidden");
  }
  if (e.ctrlKey && e.key === "h") { e.preventDefault(); renderHistory(); historyOverlay.classList.toggle("hidden"); }
  if (e.ctrlKey && e.key === "d") { e.preventDefault(); toggleBookmark(); }
  if (e.ctrlKey && e.key === "j") { e.preventDefault(); renderDownloads(); downloadsOverlay.classList.toggle("hidden"); }
});

// --- MARCADORES ---
function getBookmarks() { return JSON.parse(localStorage.getItem("atom-bookmarks") || "[]"); }
function isBookmarked(url) { return getBookmarks().some(b => b.url === url); }

function toggleBookmark() {
  const url = tabs.get(activeTabId)?.url;
  if (!url || url === "about:blank") return;

  let bookmarks = getBookmarks();
  const exists = bookmarks.findIndex(b => b.url === url);

  if (exists >= 0) {
    bookmarks.splice(exists, 1);
    btnBookmark.classList.remove("bookmarked");
    btnBookmark.textContent = "☆";
  } else {
    bookmarks.unshift({ url, title: urlInput.value || url, time: Date.now() });
    btnBookmark.classList.add("bookmarked");
    btnBookmark.textContent = "★";
  }
  localStorage.setItem("atom-bookmarks", JSON.stringify(bookmarks.slice(0, 100)));
}

function updateBookmarkStar() {
  const url = tabs.get(activeTabId)?.url;
  if (isBookmarked(url)) {
    btnBookmark.classList.add("bookmarked");
    btnBookmark.textContent = "★";
  } else {
    btnBookmark.classList.remove("bookmarked");
    btnBookmark.textContent = "☆";
  }
}

function renderBookmarks() {
  const bookmarks = getBookmarks();
  bookmarksList.innerHTML = bookmarks.length ? "" : '<div class="empty-state">Sin marcadores</div>';

  bookmarks.forEach(b => {
    const item = document.createElement("div");
    item.className = "bookmark-item";
    item.innerHTML = `
      <span class="url">${b.title || b.url}</span>
      <button class="delete-btn">✕</button>
    `;
    item.querySelector(".url").addEventListener("click", () => {
      invoke("navigate", { url: b.url });
      bookmarksOverlay.classList.add("hidden");
    });
    item.querySelector(".delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      let bks = getBookmarks().filter(x => x.url !== b.url);
      localStorage.setItem("atom-bookmarks", JSON.stringify(bks));
      renderBookmarks();
      updateBookmarkStar();
    });
    bookmarksList.appendChild(item);
  });
}

// --- HISTORIAL ---
function renderHistory() {
  const history = JSON.parse(localStorage.getItem("atom-history") || "[]");
  const fragment = document.createDocumentFragment();

  if (history.length === 0) {
    historyList.innerHTML = '<div class="empty-state">Sin historial</div>';
    return;
  }

  history.slice(0, 50).forEach(h => {
    const item = document.createElement("div");
    item.className = "history-item";
    const date = new Date(h.time);
    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const safeUrl = h.url.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    item.innerHTML = `
      <span class="url">${safeUrl}</span>
      <span class="time">${timeStr}</span>
    `;
    item.addEventListener("click", () => {
      invoke("navigate", { url: h.url });
      historyOverlay.classList.add("hidden");
    });
    fragment.appendChild(item);
  });

  historyList.innerHTML = "";
  historyList.appendChild(fragment);
}

btnBookmark.addEventListener("click", toggleBookmark);
btnCloseHistory.addEventListener("click", () => historyOverlay.classList.add("hidden"));
btnClearHistory.addEventListener("click", () => { localStorage.removeItem("atom-history"); renderHistory(); });
btnBookmark.addEventListener("contextmenu", (e) => { e.preventDefault(); renderBookmarks(); bookmarksOverlay.classList.remove("hidden"); });
btnCloseBookmarks.addEventListener("click", () => bookmarksOverlay.classList.add("hidden"));

// ================================================================
// GESTOR DE DESCARGAS (integrado como overlay)
// ================================================================
const downloads = new Map();

function getDownloadsHistory() { return JSON.parse(localStorage.getItem("atom-downloads") || "[]"); }
function saveDownloadsHistory(list) { localStorage.setItem("atom-downloads", JSON.stringify(list.slice(0, 50))); }

function updateDownloadBtn() {
  const history = getDownloadsHistory();
  if (history.length > 0 || downloads.size > 0) {
    btnDownloads.classList.remove("hidden");
  } else {
    btnDownloads.classList.add("hidden");
  }
  const hasActive = Array.from(downloads.values()).some(d => d.state === 'progress');
  btnDownloads.classList.toggle("downloading", hasActive);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function renderDownloads() {
  const history = getDownloadsHistory();
  const active = Array.from(downloads.values()).reverse();
  const all = [...active, ...history];

  if (all.length === 0) {
    downloadsList.innerHTML = '<div class="empty-state">No hay descargas</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  all.slice(0, 30).forEach(d => {
    const item = document.createElement("div");
    let stateClass = '';
    let statusText = '';
    let progressWidth = '0%';
    let progressClass = 'download-progress-fill';

    if (d.state === 'progress') {
      stateClass = 'active';
      if (d.total > 0) {
        const percent = Math.round((d.current / d.total) * 100);
        statusText = `${percent}% — ${formatBytes(d.current)} / ${formatBytes(d.total)}`;
        progressWidth = `${percent}%`;
      } else {
        statusText = 'Descargando...';
        progressWidth = '100%';
        progressClass += ' indeterminate';
      }
    } else if (d.state === 'finished') {
      stateClass = 'completed';
      statusText = 'Completado';
      progressWidth = '100%';
      progressClass += ' complete';
    } else {
      stateClass = 'error';
      statusText = 'Error';
      progressWidth = '100%';
      progressClass += ' error';
    }

    item.className = `download-item ${stateClass}`;

    const iconSvg = d.state === 'finished'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>'
      : d.state === 'error'
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

    const safeName = (d.filename || 'Descarga').replace(/</g, '&lt;');

    item.innerHTML = `
      <div class="download-icon">${iconSvg}</div>
      <div class="download-info">
        <div class="download-name" title="${safeName}">${safeName}</div>
        <div class="download-meta">${statusText}</div>
      </div>
      <div class="download-progress">
        <div class="${progressClass}" style="width: ${progressWidth}"></div>
      </div>
    `;

    fragment.appendChild(item);
  });

  downloadsList.innerHTML = "";
  downloadsList.appendChild(fragment);
}

// Botón descargas — abre overlay
btnDownloads.addEventListener("click", () => {
  renderDownloads();
  downloadsOverlay.classList.remove("hidden");
});

btnCloseDownloads.addEventListener("click", () => downloadsOverlay.classList.add("hidden"));

btnClearDownloads.addEventListener("click", () => {
  localStorage.removeItem("atom-downloads");
  downloads.clear();
  updateDownloadBtn();
  renderDownloads();
});

// --- EVENTOS DE DESCARGAS ---
listen('download-started', (event) => {
  const { id, filename, path } = event.payload;
  downloads.set(id, { id, filename, path, current: 0, total: 0, state: 'progress' });
  updateDownloadBtn();
  // Auto-mostrar overlay cuando empieza descarga
  renderDownloads();
  downloadsOverlay.classList.remove("hidden");
});

listen('download-progress', (event) => {
  const { id, current, total } = event.payload;
  const d = downloads.get(id);
  if (d) {
    d.current = current;
    d.total = total;
    // Actualizar UI en tiempo real si overlay está visible
    if (!downloadsOverlay.classList.contains("hidden")) renderDownloads();
  }
});

listen('download-finished', (event) => {
  const { id, success } = event.payload;
  const d = downloads.get(id);
  if (d) {
    d.state = success ? 'finished' : 'error';
    const history = getDownloadsHistory();
    const existingIdx = history.findIndex(x => x.id === id);
    if (existingIdx >= 0) history.splice(existingIdx, 1);
    history.unshift(d);
    saveDownloadsHistory(history);
    downloads.delete(id);
    updateDownloadBtn();
    if (!downloadsOverlay.classList.contains("hidden")) renderDownloads();
  }
});

updateDownloadBtn();

// --- INICIALIZACIÓN ---
async function init() {
  try {
    let tabId = await invoke("get_active_tab");
    if (!tabId) {
      await createTab();
      return;
    }
    tabs.set(tabId, { url: "about:blank", title: "Nueva pestaña" });
    activeTabId = tabId;
    const tabEl = createTabElement(tabId, true);
    tabsContainer.insertBefore(tabEl, btnNewTab);
  } catch (error) {
    console.error("Error inicializando:", error);
  }
}

init();