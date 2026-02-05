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
const tabsContainer = document.getElementById("tabs-container");
const progressBar = document.getElementById("progress-bar");
const favicon = document.getElementById("favicon");

// --- ESTADO DE TABS ---
const tabs = new Map();
let activeTabId = null;

// --- FUNCIONES AUXILIARES ---

function createTabElement(tabId, isActive = false) {
  const tabEl = document.createElement("div");
  tabEl.className = "tab" + (isActive ? " active" : "");
  tabEl.dataset.tabId = tabId;
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

    // Llamamos a Rust y esperamos el ID
    const tabId = await invoke("create_tab", { url: url || "about:blank" });
    console.log("Pestaña creada con ID:", tabId);

    tabs.set(tabId, { url: url || "about:blank", title: "Nueva pestaña" });

    // Quitar clase active de todas las tabs
    tabsContainer.querySelectorAll(".tab").forEach(tab => {
      tab.classList.remove("active");
    });

    // Crear y añadir elemento DOM
    const tabEl = createTabElement(tabId, true);
    tabsContainer.appendChild(tabEl);

    activeTabId = tabId;
    urlInput.value = "";
    favicon.classList.remove("visible");
    stopLoading();

    return tabId;
  } catch (error) {
    console.error("Error creando pestaña:", error);
    stopLoading();
  }
}

async function closeTab(tabId) {
  if (tabs.size <= 1) return;

  try {
    await invoke("close_tab", { tabId });

    const tabEl = tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabEl) tabEl.remove();

    tabs.delete(tabId);

    if (activeTabId === tabId) {
      const nextTabId = tabs.keys().next().value;
      if (nextTabId) {
        activeTabId = nextTabId;
        tabsContainer.querySelector(`[data-tab-id="${nextTabId}"]`)?.classList.add("active");
        const tabData = tabs.get(nextTabId);
        if (tabData) {
          urlInput.value = tabData.url !== "about:blank" ? tabData.url : "";
          updateFavicon(tabData.url);
        }
      }
    }
  } catch (error) {
    console.error("Error cerrando pestaña:", error);
  }
}

async function switchTab(tabId) {
  if (activeTabId === tabId) return;

  try {
    await invoke("switch_tab", { tabId });

    tabsContainer.querySelectorAll(".tab").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.tabId === tabId);
    });

    activeTabId = tabId;

    const tabData = tabs.get(tabId);
    if (tabData) {
      urlInput.value = tabData.url !== "about:blank" ? tabData.url : "";
      updateFavicon(tabData.url);
    }
  } catch (error) {
    console.error("Error cambiando pestaña:", error);
  }
}

function updateTabInfo(tabId, url) {
  const tabData = tabs.get(tabId);
  if (tabData) {
    tabData.url = url;

    try {
      const hostname = new URL(url).hostname.replace("www.", "");
      tabData.title = hostname || "Nueva pestaña";
    } catch {
      tabData.title = "Nueva pestaña";
    }

    const tabEl = tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabEl) {
      tabEl.querySelector(".tab-title").textContent = tabData.title;
      const faviconEl = tabEl.querySelector(".tab-favicon");
      try {
        const domain = new URL(url).hostname;
        faviconEl.src = `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
      } catch {
        faviconEl.src = "";
      }
    }
  }
}

// --- HISTORIAL LOCAL ---
function saveToHistory(url) {
  if (!url || url === "about:blank") return;
  const history = JSON.parse(localStorage.getItem("atom-history") || "[]");
  if (history[0]?.url === url) return;
  history.unshift({ url, time: Date.now() });
  localStorage.setItem("atom-history", JSON.stringify(history.slice(0, 100)));
}

// --- FAVICON TOOLBAR ---
function updateFavicon(url) {
  try {
    const domain = new URL(url).hostname;
    if (domain && domain !== "blank") {
      favicon.src = `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
      favicon.classList.add("visible");
    } else {
      favicon.classList.remove("visible");
    }
  } catch {
    favicon.classList.remove("visible");
  }
}

// --- BARRA DE PROGRESO ---
function startLoading() {
  progressBar.classList.remove("complete");
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

  if (id === activeTabId && document.activeElement !== urlInput) {
    urlInput.value = url;
    updateFavicon(url);
  }
});

// --- NAVEGACIÓN ---
function handleNavigation() {
  let input = urlInput.value.trim();
  if (!input) return;

  let finalUrl = "";

  if (input.includes(".") && !input.includes(" ")) {
    if (input.startsWith("http://") || input.startsWith("https://")) {
      finalUrl = input;
    } else {
      finalUrl = "https://" + input;
    }
  } else {
    finalUrl = "https://www.google.com/search?q=" + encodeURIComponent(input);
  }

  startLoading();
  urlInput.blur();
  invoke("navigate", { url: finalUrl });
}

// --- EVENTOS ---
btnGo.addEventListener("click", handleNavigation);
urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleNavigation();
});

btnBack.addEventListener("click", () => {
  startLoading();
  invoke("go_back");
});

btnForward.addEventListener("click", () => {
  startLoading();
  invoke("go_forward");
});

btnRefresh.addEventListener("click", () => {
  startLoading();
  invoke("reload");
});

btnNewTab.addEventListener("click", () => createTab());

// Atajos de teclado
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "t") {
    e.preventDefault();
    createTab();
  }
  if (e.ctrlKey && e.key === "w") {
    e.preventDefault();
    if (activeTabId) closeTab(activeTabId);
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