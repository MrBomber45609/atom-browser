// ================================================================
// CONFIGURACIÓN CORE (PUENTE ELECTRON)
// ================================================================

// Accedemos a la API expuesta en preload.js
const electron = window.electronAPI;

// 1. Wrapper para 'invoke': Mantiene la compatibilidad con tu código actual
const invoke = async (cmd, args) => {
  try {
    return await electron.invoke(cmd, args);
  } catch (e) {
    console.error(`Error invocando '${cmd}':`, e);
    return null;
  }
};

// 2. Wrapper para 'listen': Adapta los eventos de Electron al formato { payload } de Tauri
const listen = (channel, callback) => {
  electron.on(channel, (data) => {
    // Envolvemos la data para que tu código existente no se rompa
    callback({ payload: data });
  });
};

// ================================================================
// ELEMENTOS DEL DOM
// ================================================================
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

// Controles de ventana
const btnMinimize = document.getElementById("btn-minimize");
const btnMaximize = document.getElementById("btn-maximize");
const btnCloseWindow = document.getElementById("btn-close-window");

// ================================================================
// LÓGICA DE INTERFAZ
// ================================================================

// --- CONTROLES DE VENTANA (Nativo Electron) ---
if (btnMinimize) btnMinimize.addEventListener("click", () => electron.minimize());
if (btnMaximize) btnMaximize.addEventListener("click", () => electron.maximize());
if (btnCloseWindow) btnCloseWindow.addEventListener("click", () => electron.close());


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
let isAdblockEnabled = true;

// --- UTILIDADES ---
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// --- FAVICON MEJORADO (Usa API de Google) ---
function getFaviconUrl(url) {
  try {
    if (!url || url.startsWith('file:') || url.startsWith('atom:')) return '';
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
  } catch {
    return '';
  }
}

// --- FUNCIONES AUXILIARES DE PESTAÑAS ---
// --- Pointer-based tab drag system (smooth reordering) ---
let dragState = null;

function initTabDrag(tabEl, e) {
  if (e.button !== 0) return; // solo click izquierdo
  const startX = e.clientX;
  const startY = e.clientY;
  let dragging = false;

  const onMove = (ev) => {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (!dragging && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;

    if (!dragging) {
      dragging = true;
      startDrag(tabEl, ev);
    }
    updateDrag(ev);
  };

  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    if (dragging) endDrag();
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

function startDrag(tabEl, e) {
  // Create ghost
  const rect = tabEl.getBoundingClientRect();
  const ghost = tabEl.cloneNode(true);
  ghost.className = 'tab active tab-drag-ghost';
  ghost.style.width = rect.width + 'px';
  ghost.style.height = rect.height + 'px';
  ghost.style.left = rect.left + 'px';
  ghost.style.top = rect.top + 'px';
  document.body.appendChild(ghost);

  // Create drop indicator
  const indicator = document.createElement('div');
  indicator.className = 'tab-drop-indicator';
  tabsContainer.style.position = 'relative';
  tabsContainer.appendChild(indicator);

  tabEl.classList.add('dragging');
  tabEl.setPointerCapture && tabEl.releasePointerCapture(e.pointerId);

  dragState = {
    tabEl, ghost, indicator,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    containerRect: tabsContainer.getBoundingClientRect()
  };
}

function updateDrag(e) {
  if (!dragState) return;
  const { ghost, indicator, offsetX, offsetY } = dragState;

  // Move ghost
  ghost.style.left = (e.clientX - offsetX) + 'px';
  ghost.style.top = (e.clientY - offsetY) + 'px';

  // Find drop position
  const tabs = Array.from(tabsContainer.querySelectorAll('.tab:not(.dragging)'));
  let insertBefore = null;
  let indicatorLeft = -999;

  for (const tab of tabs) {
    const r = tab.getBoundingClientRect();
    const mid = r.left + r.width / 2;
    if (e.clientX < mid) {
      insertBefore = tab;
      indicatorLeft = r.left - dragState.containerRect.left - 1;
      break;
    }
  }

  if (!insertBefore) {
    // After last tab
    const last = tabs[tabs.length - 1];
    if (last) {
      const r = last.getBoundingClientRect();
      indicatorLeft = r.right - dragState.containerRect.left + 1;
    }
  }

  indicator.style.left = indicatorLeft + 'px';
  dragState.insertBefore = insertBefore;
}

function endDrag() {
  if (!dragState) return;
  const { tabEl, ghost, indicator, insertBefore } = dragState;

  // Move tab in DOM
  if (insertBefore) {
    tabsContainer.insertBefore(tabEl, insertBefore);
  } else {
    tabsContainer.insertBefore(tabEl, btnNewTab);
  }

  tabEl.classList.remove('dragging');
  ghost.remove();
  indicator.remove();
  dragState = null;
}

function createTabElement(tabId, isActive = false) {
  const tabEl = document.createElement("div");
  tabEl.className = "tab animate-enter" + (isActive ? " active" : "");
  tabEl.dataset.tabId = tabId;
  tabEl.title = "Nueva pestaña";
  tabEl.innerHTML = `
    <img class="tab-favicon" src="" alt="" onerror="this.style.display='none'" />
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

  // Pointer-based drag
  tabEl.addEventListener("pointerdown", (e) => {
    if (e.target.classList.contains("tab-close")) return;
    initTabDrag(tabEl, e);
  });

  // Prevent native drag
  tabEl.addEventListener("dragstart", (e) => e.preventDefault());

  return tabEl;
}

// --- LÓGICA PRINCIPAL DE PESTAÑAS ---
async function createTab(url = null) {
  try {
    // Invocamos al backend de Electron
    const tabId = await invoke("create_tab", { url });

    if (tabId) {
      tabs.set(tabId, { url: url || "about:blank", title: "Nueva pestaña" });
      const tabEl = createTabElement(tabId, true);
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tabsContainer.insertBefore(tabEl, btnNewTab);
      activeTabId = tabId;
      urlInput.value = "";
      urlInput.focus();
    }
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
      const fav = tabEl.querySelector(".tab-favicon");
      fav.src = "";
      fav.style.display = "none";
      tabEl.title = "Nueva pestaña";
    } else {
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace("www.", "");
        tabEl.querySelector(".tab-title").textContent = domain || "Nueva pestaña";
        const fav = tabEl.querySelector(".tab-favicon");
        const favUrl = getFaviconUrl(url);
        if (favUrl) { fav.src = favUrl; fav.style.display = ""; } else { fav.style.display = "none"; }
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
  if (!url || url === "about:blank" || url.startsWith("atom://") || url.includes("home.html")) return;
  const history = JSON.parse(localStorage.getItem("atom-history") || "[]");
  if (history[0]?.url === url) return;
  history.unshift({ url, time: Date.now() });
  saveToHistoryDisk(history);
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem("atom-history") || "[]");
  historyList.innerHTML = history.length ? "" : '<div class="empty-state">Sin historial</div>';

  history.forEach(h => {
    const item = document.createElement("div");
    item.className = "history-item";
    const date = new Date(h.time);
    const timeStr = date.toLocaleString("es", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    item.innerHTML = `
      <span class="url">${h.url}</span>
      <span class="time">${timeStr}</span>
    `;
    item.querySelector(".url").addEventListener("click", () => {
      invoke("navigate", { url: h.url });
      hideOverlay(historyOverlay);
    });
    historyList.appendChild(item);
  });
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

// --- LISTENERS DEL BACKEND ---
listen('url-changed', (event) => {
  const { id, url } = event.payload;
  stopLoading();
  updateTabInfo(id, url);
  saveToHistory(url);
  if (id === activeTabId) updateBookmarkStar();
});

// Pestanas creadas desde el backend (target=_blank)
listen('tab-created-backend', (event) => {
  const { id, url } = event.payload;
  if (id && !tabs.has(id)) {
    tabs.set(id, { url: url || 'about:blank', title: 'Nueva pestaña' });
    const tabEl = createTabElement(id, true);
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tabsContainer.insertBefore(tabEl, btnNewTab);
    activeTabId = id;
    updateTabInfo(id, url);
  }
});

// Atom Shield state sync (desde context menu del main process)
listen('adblock-state', (event) => {
  isAdblockEnabled = event.payload;
  btnAdblock.classList.toggle("active", isAdblockEnabled);
  btnAdblock.title = isAdblockEnabled ? "Atom Shield: Activo" : "Atom Shield: Desactivado";
});

// Fullscreen Immersive
listen('fullscreen-change', (event) => {
  const isFullscreen = event.payload;
  if (isFullscreen) {
    document.body.classList.add('fullscreen-hiding');
    setTimeout(() => {
      document.body.classList.remove('fullscreen-hiding');
      document.body.classList.add('fullscreen-mode');
    }, 280);
  } else {
    document.body.classList.remove('fullscreen-mode');
    document.body.classList.add('fullscreen-showing');
    setTimeout(() => {
      document.body.classList.remove('fullscreen-showing');
    }, 400);
  }
});

// --- URL BAR ---
// --- MOSTRAR URL COMPLETA ---
function showDomainOnly(url) {
  // Si es la home, limpiar la barra
  if (!url || url === 'atom://home' || url.includes('home.html')) {
    urlInput.value = '';
    urlInput.dataset.fullUrl = '';
    return;
  }

  // Mostrar URL completa en lugar de solo dominio
  urlInput.value = url;
  urlInput.dataset.fullUrl = url;
}

// --- URL SUGGESTIONS ---
const urlSuggestions = document.getElementById("url-suggestions");
let selectedSuggestionIndex = -1;
let currentSuggestions = [];

function getSuggestions(query) {
  if (!query || query.length < 2) return [];

  const q = query.toLowerCase();
  const results = [];

  // Search bookmarks first (higher priority)
  const bookmarks = getBookmarks();
  bookmarks.forEach(b => {
    const url = (b.url || '').toLowerCase();
    const title = (b.title || '').toLowerCase();
    if (url.includes(q) || title.includes(q)) {
      results.push({ type: 'bookmark', url: b.url, title: b.title || b.url });
    }
  });

  // Then search history
  const history = JSON.parse(localStorage.getItem("atom-history") || "[]");
  history.forEach(h => {
    const url = (h.url || '').toLowerCase();
    // Avoid duplicates with bookmarks
    if (url.includes(q) && !results.some(r => r.url === h.url)) {
      results.push({ type: 'history', url: h.url, title: h.url });
    }
  });

  // Limit results
  return results.slice(0, 8);
}

function renderSuggestions(suggestions) {
  if (suggestions.length === 0) {
    urlSuggestions.classList.add("hidden");
    return;
  }

  currentSuggestions = suggestions;
  selectedSuggestionIndex = -1;

  urlSuggestions.innerHTML = suggestions.map((s, i) => {
    const icon = s.type === 'bookmark'
      ? '<svg class="suggestion-icon bookmark" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
      : '<svg class="suggestion-icon history" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';

    const displayText = s.title || s.url;
    const typeLabel = s.type === 'bookmark' ? 'Marcador' : 'Historial';

    return `
      <div class="suggestion-item" data-index="${i}" data-url="${s.url}">
        ${icon}
        <span class="suggestion-text">${displayText}</span>
        <span class="suggestion-type">${typeLabel}</span>
      </div>
    `;
  }).join('');

  urlSuggestions.classList.remove("hidden");

  // Add click handlers
  urlSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const url = item.dataset.url;
      if (url) {
        urlInput.value = url;
        urlSuggestions.classList.add("hidden");
        handleNavigation();
      }
    });
  });
}

function updateSelectedSuggestion() {
  urlSuggestions.querySelectorAll('.suggestion-item').forEach((item, i) => {
    item.classList.toggle('selected', i === selectedSuggestionIndex);
  });

  // Update input value to show selected suggestion
  if (selectedSuggestionIndex >= 0 && currentSuggestions[selectedSuggestionIndex]) {
    urlInput.value = currentSuggestions[selectedSuggestionIndex].url;
  }
}

function hideSuggestions() {
  urlSuggestions.classList.add("hidden");
  selectedSuggestionIndex = -1;
  currentSuggestions = [];
}

// Input handler for suggestions
const handleSuggestionsInput = debounce(() => {
  const query = urlInput.value.trim();
  const suggestions = getSuggestions(query);
  renderSuggestions(suggestions);
}, 150);

urlInput.addEventListener('input', handleSuggestionsInput);

urlInput.addEventListener('focus', () => {
  if (urlInput.dataset.fullUrl) {
    urlInput.value = urlInput.dataset.fullUrl;
    urlInput.select();
  }
  // Show suggestions if there's text
  const query = urlInput.value.trim();
  if (query.length >= 2) {
    const suggestions = getSuggestions(query);
    renderSuggestions(suggestions);
  }
});

urlInput.addEventListener('blur', () => {
  // Delay to allow click on suggestion
  setTimeout(() => {
    hideSuggestions();
    if (urlInput.dataset.fullUrl && urlInput.value === urlInput.dataset.fullUrl) {
      showDomainOnly(urlInput.dataset.fullUrl);
    }
  }, 150);
});

// Keyboard navigation for suggestions
urlInput.addEventListener('keydown', (e) => {
  if (urlSuggestions.classList.contains('hidden')) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, currentSuggestions.length - 1);
    updateSelectedSuggestion();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
    updateSelectedSuggestion();
  } else if (e.key === 'Escape') {
    hideSuggestions();
  }
});

// --- ATOM SHIELD TOGGLE ---
btnAdblock.addEventListener("click", async () => {
  try {
    const newState = await invoke("toggle-adblock");
    isAdblockEnabled = newState;
    btnAdblock.classList.toggle("active", newState);
    btnAdblock.title = newState ? "Atom Shield: Activo" : "Atom Shield: Desactivado";
  } catch (e) {
    console.error("Error toggling adblock:", e);
  }
});

// --- EVENTOS DOM ---
urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleNavigation(); });
btnGo.addEventListener("click", handleNavigation);
btnBack.addEventListener("click", () => invoke("go_back"));
btnForward.addEventListener("click", () => invoke("go_forward"));
btnRefresh.addEventListener("click", () => { startLoading(); invoke("reload"); });
btnNewTab.addEventListener("click", () => {
  console.log("Click en nueva pestaña"); // Para depurar si falla
  createTab();
});

// --- OVERLAYS MANAGER ---
const allOverlays = () => [historyOverlay, bookmarksOverlay, searchEngineOverlay];

function isAnyOverlayOpen() {
  return allOverlays().some(o => !o.classList.contains("hidden")) || !dropdownMenu.classList.contains("hidden");
}

function showOverlay(overlay) {
  overlay.classList.remove("hidden");
  // Opcional: Si quieres ocultar la webview al abrir overlay (mejor rendimiento)
  // invoke("hide_active_tab"); 
}

function hideOverlay(overlay) {
  overlay.classList.add("hidden");
  // invoke("show_active_tab");
}

function hideAllOverlays() {
  allOverlays().forEach(o => o.classList.add("hidden"));
  downloadsOverlay.classList.add("hidden");
  dropdownMenu.classList.add("hidden");
}

// --- MENÚ ---
btnMenu.addEventListener("click", (e) => {
  e.stopPropagation();
  downloadsOverlay.classList.add("hidden");
  dropdownMenu.classList.toggle("hidden");
});

document.addEventListener("click", () => {
  if (!dropdownMenu.classList.contains("hidden")) dropdownMenu.classList.add("hidden");
  if (!downloadsOverlay.classList.contains("hidden")) downloadsOverlay.classList.add("hidden");
});

menuHistory.addEventListener("click", () => {
  dropdownMenu.classList.add("hidden");
  renderHistory();
  showOverlay(historyOverlay);
});

menuSearchEngine.addEventListener("click", () => {
  dropdownMenu.classList.add("hidden");
  updateSearchEngineSelection();
  showOverlay(searchEngineOverlay);
});

menuBookmarks.addEventListener("click", () => {
  dropdownMenu.classList.add("hidden");
  renderBookmarks();
  showOverlay(bookmarksOverlay);
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
    hideOverlay(searchEngineOverlay);
  });
});

btnCloseSearchEngine.addEventListener("click", () => hideOverlay(searchEngineOverlay));

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
    if (tabIds.length > 0) {
      const idx = tabIds.indexOf(activeTabId);
      switchTab(tabIds[(idx + 1) % tabIds.length]);
    }
  }

  if (e.key === "Escape") hideAllOverlays();

  if (e.ctrlKey && e.key === "h") {
    e.preventDefault();
    if (historyOverlay.classList.contains("hidden")) { renderHistory(); showOverlay(historyOverlay); }
    else hideOverlay(historyOverlay);
  }

  if (e.ctrlKey && e.key === "j") {
    e.preventDefault();
    if (downloadsOverlay.classList.contains("hidden")) { downloadsOverlay.classList.remove("hidden"); renderDownloads(); }
    else downloadsOverlay.classList.add("hidden");
  }
});

// --- MARCADORES ---
function getBookmarks() { return JSON.parse(localStorage.getItem("atom-bookmarks") || "[]"); }
function isBookmarked(url) { return getBookmarks().some(b => b.url === url); }

function toggleBookmark() {
  const url = tabs.get(activeTabId)?.url;
  if (!url || url === "about:blank" || url.includes("home.html")) return;

  let bookmarks = getBookmarks();
  const exists = bookmarks.findIndex(b => b.url === url);

  if (exists >= 0) {
    bookmarks.splice(exists, 1);
    btnBookmark.classList.remove("bookmarked");
  } else {
    bookmarks.unshift({ url, title: urlInput.value || url, time: Date.now() });
    btnBookmark.classList.add("bookmarked");
  }
  localStorage.setItem("atom-bookmarks", JSON.stringify(bookmarks.slice(0, 100)));
}

function updateBookmarkStar() {
  const url = tabs.get(activeTabId)?.url;
  if (isBookmarked(url)) btnBookmark.classList.add("bookmarked");
  else btnBookmark.classList.remove("bookmarked");
}

function renderBookmarks() {
  const bookmarks = getBookmarks();
  bookmarksList.innerHTML = bookmarks.length ? "" : '<div class="empty-state">Sin marcadores</div>';

  bookmarks.forEach(b => {
    const item = document.createElement("div");
    item.className = "bookmark-item";
    item.innerHTML = `
      <span class="url">${b.title || b.url}</span>
      <button class="delete-btn">×</button>
    `;
    item.querySelector(".url").addEventListener("click", () => {
      invoke("navigate", { url: b.url });
      hideOverlay(bookmarksOverlay);
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

btnBookmark.addEventListener("click", toggleBookmark);
btnCloseHistory.addEventListener("click", () => hideOverlay(historyOverlay));
btnClearHistory.addEventListener("click", () => { localStorage.removeItem("atom-history"); renderHistory(); });
btnBookmark.addEventListener("contextmenu", (e) => { e.preventDefault(); renderBookmarks(); showOverlay(bookmarksOverlay); });
btnCloseBookmarks.addEventListener("click", () => hideOverlay(bookmarksOverlay));

// --- GESTOR DE DESCARGAS ---
const downloads = new Map();

function getDownloadsHistory() { return JSON.parse(localStorage.getItem("atom-downloads") || "[]"); }
function saveDownloadsHistory(list) { localStorage.setItem("atom-downloads", JSON.stringify(list.slice(0, 50))); }

function updateDownloadBtn() {
  const history = getDownloadsHistory();
  if (history.length > 0 || downloads.size > 0) btnDownloads.classList.remove("hidden");
  else btnDownloads.classList.add("hidden");

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

function getFileIcon(filename) {
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
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

  all.slice(0, 20).forEach(d => {
    const item = document.createElement("div");
    let stateClass = '';
    let statusText = '';
    let progressWidth = '0%';
    let progressClass = 'download-progress-fill';

    if (d.state === 'progress') {
      stateClass = 'active';
      if (d.total > 0) {
        const percent = Math.round((d.current / d.total) * 100);
        statusText = `${formatBytes(d.current)} / ${formatBytes(d.total)}`;
        progressWidth = `${percent}%`;
      } else {
        statusText = 'Descargando...';
        progressWidth = '100%';
        progressClass += ' indeterminate';
      }
    } else if (d.state === 'finished') {
      stateClass = 'completed';
      statusText = d.total > 0 ? `${formatBytes(d.total)} • Completado` : 'Completado';
      progressWidth = '100%';
      progressClass += ' complete';
    } else {
      stateClass = 'error';
      statusText = 'Error';
      progressWidth = '100%';
      progressClass += ' error';
    }

    item.className = `download-item ${stateClass}`;
    const safeName = (d.filename || 'Descarga').replace(/</g, '&lt;');

    item.innerHTML = `
      <div class="download-icon">${getFileIcon(d.filename)}</div>
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

// Botón descargas
btnDownloads.addEventListener("click", (e) => {
  e.stopPropagation();
  const wasHidden = downloadsOverlay.classList.contains("hidden");
  dropdownMenu.classList.add("hidden");
  if (wasHidden) {
    downloadsOverlay.classList.remove("hidden");
    renderDownloads();
  } else {
    downloadsOverlay.classList.add("hidden");
  }
});
downloadsOverlay.addEventListener("click", (e) => e.stopPropagation());
btnCloseDownloads.addEventListener("click", () => downloadsOverlay.classList.add("hidden"));
btnClearDownloads.addEventListener("click", () => {
  localStorage.removeItem("atom-downloads");
  downloads.clear();
  updateDownloadBtn();
  renderDownloads();
});

// Listeners de Descargas
listen('download-started', (event) => {
  const { id, filename, path } = event.payload;
  downloads.set(id, { id, filename, path, current: 0, total: 0, state: 'progress' });
  updateDownloadBtn();
  downloadsOverlay.classList.remove("hidden");
  renderDownloads();
});

listen('download-progress', (event) => {
  const { id, current, total } = event.payload;
  const d = downloads.get(id);
  if (d) {
    d.current = current;
    d.total = total;
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
  // Consultar estado del adblock
  const adState = await invoke("get-adblock-state");
  isAdblockEnabled = adState !== false;
  btnAdblock.classList.toggle("active", isAdblockEnabled);
  btnAdblock.title = isAdblockEnabled ? "Atom Shield: Activo" : "Atom Shield: Desactivado";

  await createTab();
}

init();