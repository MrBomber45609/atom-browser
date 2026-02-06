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
    tabsContainer.appendChild(tabEl);
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

function saveToHistory(url) {
  if (isPrivateMode) return;
  if (!url || url === "about:blank") return;
  const history = JSON.parse(localStorage.getItem("atom-history") || "[]");
  if (history[0]?.url === url) return;
  history.unshift({ url, time: Date.now() });
  localStorage.setItem("atom-history", JSON.stringify(history.slice(0, 100)));
}

// --- LOADING ---

function startLoading() {
  progressBar.classList.add("loading");
  btnRefresh.classList.add("loading");
}

function stopLoading() {
  progressBar.classList.remove("loading");
  progressBar.classList.add("complete");
  btnRefresh.classList.remove("loading");
  setTimeout(() => {
    progressBar.classList.remove("complete");
    progressBar.style.width = "0%";
  }, 500);
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
  bookmarksList.innerHTML = bookmarks.length ? "" : '<div style="padding: 20px; text-align: center; opacity: 0.5">Sin marcadores</div>';

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
function renderHistory() {
  const history = JSON.parse(localStorage.getItem("atom-history") || "[]");
  historyList.innerHTML = history.length ? "" : '<div style="padding: 20px; text-align: center; opacity: 0.5">Sin historial</div>';

  history.forEach(h => {
    const item = document.createElement("div");
    item.className = "history-item";
    const date = new Date(h.time);
    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    item.innerHTML = `
      <span class="url">${h.url}</span>
      <span class="time">${timeStr}</span>
    `;
    item.addEventListener("click", () => {
      invoke("navigate", { url: h.url });
      historyOverlay.classList.add("hidden");
    });
    historyList.appendChild(item);
  });
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
});

// --- INICIALIZACIÓN ---
async function init() {
  try {
    const tabId = await invoke("get_active_tab");
    console.log("Tab inicial:", tabId);
    if (tabId) {
      tabs.set(tabId, { url: "about:blank", title: "Nueva pestaña" });
      activeTabId = tabId;
      const tabEl = createTabElement(tabId, true);
      tabsContainer.appendChild(tabEl);
    }
  } catch (error) {
    console.error("Error inicializando:", error);
  }
}

init();