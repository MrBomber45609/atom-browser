const { listen } = window.__TAURI__.event;
const { invoke } = window.__TAURI__.core;

const downloadsList = document.getElementById("downloads-list");
const btnClearDownloads = document.getElementById("btn-clear-downloads");

// --- RENDERIZADO DE DESCARGAS (Copiado de main.js pero adaptado) ---
function renderDownloads(list) {
    downloadsList.innerHTML = list.length ? "" : '<div class="empty-state">No hay descargas recientes</div>';

    list.forEach(d => {
        const item = document.createElement("div");
        item.className = "download-item";

        let statusText = "";
        let width = "0%";
        let barClass = "download-progress-bar";

        if (d.state === 'progress') {
            if (d.total > 0) {
                const percent = Math.round((d.current / d.total) * 100);
                statusText = `${percent}% - ${(d.current / 1024 / 1024).toFixed(1)} MB / ${(d.total / 1024 / 1024).toFixed(1)} MB`;
                width = `${percent}%`;
            } else {
                statusText = "Descargando...";
                width = "100%";
                barClass += " indeterminate";
            }
        } else if (d.state === 'finished') {
            statusText = "Completado";
            width = "100%";
            barClass += " complete";
        } else {
            statusText = "Error";
            width = "100%";
            barClass += " error";
        }

        item.innerHTML = `
      <div class="download-icon-box">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><path d="M9 15l3 3 3-3"/></svg>
      </div>
      <div class="download-info">
        <div class="download-name" title="${d.filename}">${d.filename}</div>
        <div class="download-meta">${statusText}</div>
      </div>
      <div class="download-progress-bg">
        <div class="${barClass}" style="width: ${width}"></div>
      </div>
    `;

        // Abrir archivo al click (opcional, requiere backend implementado)
        // item.addEventListener('click', () => invoke('open_file', { path: d.path }));

        downloadsList.appendChild(item);
    });
}

// --- ESCUCHAR DATOS DEL BACKEND ---
listen('render-downloads', (event) => {
    const { downloads } = event.payload;
    renderDownloads(downloads);
});

// Limpiar
btnClearDownloads.addEventListener("click", () => {
    invoke("clear_downloads"); // Necesitamos este comando en backend o enviar evento al main
    renderDownloads([]);
});

// Cerrar con Escape
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        invoke("toggle_popup", { show: false });
    }
});

// Cerrar al perder el foco (clic fuera)
window.addEventListener("blur", () => {
    invoke("toggle_popup", { show: false });
});

// Cerrar manualmente desde el backend si se necesita
listen('hide-popup', () => {
    invoke("toggle_popup", { show: false });
});
