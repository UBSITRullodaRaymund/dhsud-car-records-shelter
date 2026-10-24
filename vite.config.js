import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    base: "./",
    plugins: [vue(), tailwindcss()],
    build: {
        outDir: "dist",
        emptyOutDir: true,
        rollupOptions: {
            input: "frontend/src/main.js",
            output: {
                entryFileNames: "assets/app.js",
                assetFileNames: "assets/app.css",
                chunkFileNames: "assets/[name].js",
            },
        },
    },
});
