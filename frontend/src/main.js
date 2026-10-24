import { createApp } from "vue";
import Navigation from "./Navigation.vue";
import "./styles.css";

window.loadPdfLib = async () => {
    if (!window.PDFLib) {
        window.PDFLib = await import("pdf-lib");
    }
    return window.PDFLib;
};

const root = document.getElementById("app-navigation-root");
if (root) {
    createApp(Navigation, { currentPage: root.dataset.currentPage ?? "index" }).mount(root);
}
