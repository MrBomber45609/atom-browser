// Tauri APIs
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

// --- ELEMENTOS DEL DOM ---
const urlInput = document.getElementById("url-bar");
const btnGo = document.getElementById("btn-go");
const btnBack = document.getElementById("btn-back");
const btnForward = document.getElementById("btn-forward");
const btnRefresh = document.getElementById("btn-refresh");
const btnNewTab = document.getElementById("btn-new-tab");
const btnAdblock = document.getElementById("btn-adblock");
const btnBookmark = document.getElementById("btn-bookmark");
const btnDownloads = document.getElementById("btn-downloads"); // [NEW]
const btnMenu = document.getElementById("btn-menu");
const tabsContainer = document.getElementById("tabs-container");
const progressBar = document.getElementById("progress-bar");
const favicon = document.getElementById("favicon");

// Menú desplegable
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

// Downloads Overlay
const downloadsOverlay = document.getElementById("downloads-overlay");
const downloadsList = document.getElementById("downloads-list");
const btnCloseDownloads = document.getElementById("btn-close-downloads");
const btnClearDownloads = document.getElementById("btn-clear-downloads");

// Search Engine Overlay
const searchEngineOverlay = document.getElementById("search-engine-overlay");
const btnCloseSearchEngine = document.getElementById("btn-close-search-engine");
const searchEngineItems = document.querySelectorAll(".search-engine-item");

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
const isPrivateMode = false; // Siempre modo privado (no guarda historial en modo privado, pero aquí lo dejamos apagado)
const isAdblockEnabled = true; // Siempre activo

// --- FUNCIONES AUXILIARES ---

function createTabElement(tabId, isActive = false) {
  const tabEl = document.createElement("div");
  tabEl.className = "tab animate-enter" + (isActive ? " active" : "");
  tabEl.dataset.tabId = tabId;
  tabEl.title = "Nueva pestaña";
  tabEl.innerHTML = `
    <img class="tab-favicon" src="" alt="" />
    <span class="tab-title">Nueva pestaña</span>
    <button class="tab-close" title="Cerrar">×</button>
  `;

  tabEl.addEventListener("click", (e) => {
    if (!e.target.classList.contains("tab-close")) {
      switchTab(tabId);
    }
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
    console.log("Solicitando nueva pestaña...");
    const tabId = await invoke("create_tab", { url });
    console.log("Nueva pestaña creada:", tabId);

    tabs.set(tabId, { url: url || "about:blank", title: "Nueva pestaña" });
    const tabEl = createTabElement(tabId, true);

    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    // Insertar antes del botón de nueva pestaña
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
    // Manejar página de inicio
    if (url === 'atom://home' || url.includes('home.html')) {
      tabEl.querySelector(".tab-title").textContent = "Nueva pestaña";
      tabEl.querySelector(".tab-favicon").src = "ico.png";
      tabEl.title = "Nueva pestaña";
    } else {
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace("www.", "");
        tabEl.querySelector(".tab-title").textContent = domain || "Nueva pestaña";
        tabEl.querySelector(".tab-favicon").src = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
        tabEl.title = url;
      } catch {
        tabEl.querySelector(".tab-title").textContent = "Nueva pestaña";
      }
    }
  }

  if (tabId === activeTabId) {
    showDomainOnly(url);
  }
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

// --- UTILIDADES ---
// Función Debounce para optimizar escritura en disco
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// --- HISTORIAL OPTIMIZADO ---

// Guardamos en memoria inmediatamente, pero en disco cada 2 segundos máximo
const saveToHistoryDisk = debounce((history) => {
  localStorage.setItem("atom-history", JSON.stringify(history.slice(0, 100)));
}, 2000);

function saveToHistory(url) {
  if (isPrivateMode) return;
  if (!url || url === "about:blank" || url.startsWith("atom://")) return;

  // Leemos, actualizamos memoria
  const history = JSON.parse(localStorage.getItem("atom-history") || "[]");

  // Evitar duplicados consecutivos
  if (history[0]?.url === url) return;

  history.unshift({ url, time: Date.now() });

  // Disparamos el guardado optimizado
  saveToHistoryDisk(history);
}

// --- LOADING ---

// --- LOADING MEJORADO ---
let loadingTimeout;

function startLoading() {
  clearTimeout(loadingTimeout);
  progressBar.classList.remove("complete");
  progressBar.style.width = "0%";
  // Forzar reflow para reiniciar animación
  void progressBar.offsetWidth;
  progressBar.classList.add("loading");
  btnRefresh.classList.add("loading");

  // Fallback: Si por alguna razón no recibimos evento de carga terminada, parar a los 10s
  loadingTimeout = setTimeout(stopLoading, 10000);
}

function stopLoading() {
  clearTimeout(loadingTimeout);
  progressBar.classList.remove("loading");
  progressBar.style.width = "100%"; // Llenar visualmente

  setTimeout(() => {
    progressBar.classList.add("complete"); // Desvanecer
    btnRefresh.classList.remove("loading");
    // Resetear después de la animación de desvanecimiento
    setTimeout(() => {
      progressBar.style.width = "0%";
      progressBar.classList.remove("complete");
    }, 300);
  }, 200);
}

// --- ESCUCHAR CAMBIOS DE URL ---
listen('url-changed', (event) => {
  const { id, url } = event.payload;
  console.log("URL cambiada en tab:", id, url);

  stopLoading();
  updateTabInfo(id, url);
  saveToHistory(url);

  if (id === activeTabId) {
    updateBookmarkStar();
  }
});

// --- URL BAR ESTILO HELIUM (mostrar solo dominio) ---
function showDomainOnly(url) {
  // Manejar página de inicio
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

// --- EVENTOS ---

urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    handleNavigation();
  }
});

btnGo.addEventListener("click", handleNavigation);
btnBack.addEventListener("click", () => invoke("go_back"));
btnForward.addEventListener("click", () => invoke("go_forward"));
btnRefresh.addEventListener("click", () => {
  startLoading();
  invoke("reload");
});
btnNewTab.addEventListener("click", () => createTab());

// --- MENÚ DESPLEGABLE ---
btnMenu.addEventListener("click", (e) => {
  e.stopPropagation();
  dropdownMenu.classList.toggle("hidden");
});

// Cerrar menú al hacer clic fuera
document.addEventListener("click", () => {
  dropdownMenu.classList.add("hidden");
});

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

btnCloseSearchEngine.addEventListener("click", () => {
  searchEngineOverlay.classList.add("hidden");
});

// --- ATAJOS DE TECLADO ---
document.addEventListener("keydown", (e) => {
  // Ctrl+L: Focus en URL bar
  if (e.ctrlKey && e.key === "l") {
    e.preventDefault();
    urlInput.focus();
    urlInput.select();
  }

  // Ctrl+R o F5: Recargar
  if ((e.ctrlKey && e.key === "r") || e.key === "F5") {
    e.preventDefault();
    startLoading();
    invoke("reload");
  }

  // Alt+Left: Atrás
  if (e.altKey && e.key === "ArrowLeft") {
    e.preventDefault();
    invoke("go_back");
  }

  // Alt+Right: Adelante
  if (e.altKey && e.key === "ArrowRight") {
    e.preventDefault();
    invoke("go_forward");
  }

  // Ctrl+T: Nueva pestaña
  if (e.ctrlKey && e.key === "t") {
    e.preventDefault();
    createTab();
  }

  // Ctrl+W: Cerrar pestaña
  if (e.ctrlKey && e.key === "w") {
    e.preventDefault();
    if (activeTabId) {
      closeTab(activeTabId);
    }
  }

  // Ctrl+Tab: Siguiente pestaña
  if (e.ctrlKey && e.key === "Tab") {
    e.preventDefault();
    const tabIds = Array.from(tabs.keys());
    const currentIndex = tabIds.indexOf(activeTabId);
    const nextIndex = (currentIndex + 1) % tabIds.length;
    switchTab(tabIds[nextIndex]);
  }

  // Ctrl+Shift+Tab: Pestaña anterior
  if (e.ctrlKey && e.shiftKey && e.key === "Tab") {
    e.preventDefault();
    const tabIds = Array.from(tabs.keys());
    const currentIndex = tabIds.indexOf(activeTabId);
    const prevIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
    switchTab(tabIds[prevIndex]);
  }
});

// --- MARCADORES ---
function getBookmarks() {
  return JSON.parse(localStorage.getItem("atom-bookmarks") || "[]");
}

function isBookmarked(url) {
  return getBookmarks().some(b => b.url === url);
}

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

// --- HISTORIAL OVERLAY ---
// --- RENDERIZADO EFICIENTE ---
function renderHistory() {
  const history = JSON.parse(localStorage.getItem("atom-history") || "[]");

  // Usamos DocumentFragment para una sola reflow del DOM (Más rápido)
  const fragment = document.createDocumentFragment();

  if (history.length === 0) {
    historyList.innerHTML = '<div class="empty-state">Sin historial</div>';
    return;
  }

  // Limitamos renderizado visual a 50 items para mantener la UI fluida
  history.slice(0, 50).forEach(h => {
    const item = document.createElement("div");
    item.className = "history-item";
    const date = new Date(h.time);
    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Sanitización básica de URL para evitar XSS visual
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

// --- EVENTOS DE OVERLAYS ---
btnBookmark.addEventListener("click", toggleBookmark);

btnCloseHistory.addEventListener("click", () => historyOverlay.classList.add("hidden"));

btnClearHistory.addEventListener("click", () => {
  localStorage.removeItem("atom-history");
  renderHistory();
});

// Bookmarks overlay (right click on star)
btnBookmark.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  renderBookmarks();
  bookmarksOverlay.classList.remove("hidden");
});

btnCloseBookmarks.addEventListener("click", () => bookmarksOverlay.classList.add("hidden"));

// Cerrar overlays con Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    historyOverlay.classList.add("hidden");
    bookmarksOverlay.classList.add("hidden");
    searchEngineOverlay.classList.add("hidden");
    dropdownMenu.classList.add("hidden");
  }
  // Ctrl+H para historial
  if (e.ctrlKey && e.key === "h") {
    e.preventDefault();
    renderHistory();
    historyOverlay.classList.toggle("hidden");
  }
  // Ctrl+D para marcador
  if (e.ctrlKey && e.key === "d") {
    e.preventDefault();
    toggleBookmark();
  }
  // Ctrl+J para descargas
  if (e.ctrlKey && e.key === "j") {
    e.preventDefault();
    renderDownloads();
    downloadsOverlay.classList.toggle("hidden");
  }
});

// --- GESTOR DE DESCARGAS ---
const downloads = new Map(); // id -> { filename, path, total, current, state: 'progress'|'finished'|'error' }

function getDownloadsHistory() {
  return JSON.parse(localStorage.getItem("atom-downloads") || "[]");
}

function saveDownloadsHistory(list) {
  localStorage.setItem("atom-downloads", JSON.stringify(list.slice(0, 50)));
}

function updateDownloadBtn() {
  const history = getDownloadsHistory();
  if (history.length > 0 || downloads.size > 0) {
    btnDownloads.classList.remove("hidden");
  } else {
    btnDownloads.classList.add("hidden");
  }

  // Animation if any active download
  const hasActive = Array.from(downloads.values()).some(d => d.state === 'progress');
  if (hasActive) {
    btnDownloads.classList.add("downloading");
  } else {
    btnDownloads.classList.remove("downloading");
  }
}

// Send data to Popup Window
async function syncPopupData() {
  const history = getDownloadsHistory();
  const active = Array.from(downloads.values()).reverse();
  const all = [...active, ...history].slice(0, 50);

  // Emit event globally so Popup picks it up
  await window.__TAURI__.event.emit("render-downloads", { downloads: all });
}

// Event Listeners for Downloads
btnDownloads.addEventListener("click", async () => {
  // Obtener rectángulo del botón relativo al viewport
  const rect = btnDownloads.getBoundingClientRect();

  // Coordenadas relativas a la esquina superior izquierda del área de contenido (viewport)
  // Queremos alinear el borde derecho del popup con el borde derecho del botón:
  const popupWidth = 380; // Debe coincidir con CSS/Tauri config
  const relativeX = rect.right - popupWidth;
  const relativeY = rect.bottom + 5; // Un pequeño margen vertical

  // Send data first
  await syncPopupData();

  // Move (sending relative coords) and Show
  await invoke("content_position", { x: relativeX, y: relativeY });
  await invoke("toggle_popup", { show: true });
});

// We don't need local overlay logic anymore for downloads
// btnCloseDownloads... etc removal or ignore
// We still listen to events to update Badge/Button state
listen('download-started', (event) => {
  const { id, filename, path } = event.payload;
  downloads.set(id, { id, filename, path, current: 0, total: 0, state: 'progress' });
  updateDownloadBtn();
  syncPopupData();
});

listen('download-progress', (event) => {
  const { id, current, total } = event.payload;
  const d = downloads.get(id);
  if (d) {
    d.current = current;
    d.total = total;
    syncPopupData(); // Realtime update popup
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
    syncPopupData();
  }
});

// Inicializar botón
updateDownloadBtn();

// --- INICIALIZACIÓN ---
async function init() {
  try {
    let tabId = await invoke("get_active_tab");
    console.log("Tab inicial:", tabId);

    if (!tabId) {
      await createTab(); // Crea pestaña por defecto (home)
      return;
    }

    if (tabId) {
      tabs.set(tabId, { url: "about:blank", title: "Nueva pestaña" });
      activeTabId = tabId;
      const tabEl = createTabElement(tabId, true);
      // Insertar antes del botón de nueva pestaña
      tabsContainer.insertBefore(tabEl, btnNewTab);
    }
  } catch (error) {
    console.error("Error inicializando:", error);
  }
}

init();