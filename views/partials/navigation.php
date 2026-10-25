<div id="app-navigation-root"
     data-current-page="<?= htmlspecialchars((string) ($_GET['route'] ?? $_GET['page'] ?? 'index'), ENT_QUOTES, 'UTF-8') ?>"
     data-current-user="<?= htmlspecialchars(json_encode($navigationUser, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP | JSON_THROW_ON_ERROR), ENT_QUOTES, 'UTF-8') ?>"></div>
<script type="module" src="dist/assets/app.js?v=<?= filemtime(__DIR__ . '/../../dist/assets/app.js') ?>"></script>
