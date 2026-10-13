const express = require("express");
const path = require("path");
const { createProxyMiddleware } = require("http-proxy-middleware");

const APP_SCRIPT_ID = "AKfycbz-QHC1nioYNOrFQw7h2q6M44Barh7rwYjDzFZ1I1PdU6f24tkncUjJEWTvqS1WtTfr";
const PORT = 3000;

const app = express();

app.use(
  "/api",
  createProxyMiddleware({
    target: "https://script.google.com",
    changeOrigin: true,
    pathRewrite: {
      "^/api": `/macros/s/${APP_SCRIPT_ID}/exec`
    },
    onError: (err, req, res) => {
      console.error("Proxy error:", err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: "Proxy error contacting Google Apps Script" });
      }
    }
  })
);

app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.listen(PORT, () => {
  console.log(`Local app + proxy is running at http://localhost:${PORT}`);
});
