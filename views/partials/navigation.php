<div id="app-navigation-root"
     data-current-page="<?= htmlspecialchars((string) ($_GET['page'] ?? 'index'), ENT_QUOTES, 'UTF-8') ?>"></div>
<script type="module" src="dist/assets/app.js?v=<?= filemtime(__DIR__ . '/../../dist/assets/app.js') ?>"></script>
