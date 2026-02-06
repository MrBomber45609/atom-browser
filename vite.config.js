import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    clearScreen: false,
    server: {
        port: 1420,
        strictPort: true,
    },
    envPrefix: ["VITE_", "TAURI_"],
    build: {
        target: "esnext",
        minify: false,
        sourcemap: false,
        rollupOptions: {
            input: {
                main: resolve(__dirname, "src/index.html"),
                popup: resolve(__dirname, "src/popup.html"),
            },
        },
    },
});
