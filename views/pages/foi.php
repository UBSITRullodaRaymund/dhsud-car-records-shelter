<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FOI Requests | DHSUD-CAR Records Shelter</title>
<link rel="icon" type="image/png" href="logo.png">
<link rel="stylesheet" href="assets/css/style.css">
<link rel="stylesheet" href="assets/css/requests.css?v=<?= filemtime(__DIR__ . '/../../assets/css/requests.css') ?>">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css">
<?php require __DIR__ . '/../partials/navigation-assets.php'; ?>
</head>
<body class="has-app-navigation"
      data-foi-template-url="<?= htmlspecialchars(rawurlencode('FOI FORM_2023_REV 07.17.26 .pdf'), ENT_QUOTES, 'UTF-8') ?>"
      data-foi-template-api="api/foi-template.php">
<?php require __DIR__ . '/../partials/navigation.php'; ?>
<header><nav>
    <div class="logo"><img src="logo.png" alt="DHSUD-CAR Logo"><div><h2>DHSUD-CAR</h2><span>Records Shelter</span></div></div>
    <ul><li><a href="./">Home</a></li><li><a href="requests">Requests</a></li><li><a href="foi" class="active">FOI</a></li></ul>
</nav></header>
<section class="page-banner"><div class="page-banner-content"><h1>FOI Requests</h1><p>Manage Freedom of Information applications and outcomes.</p></div></section>
<section class="records-page foi-page">
    <div class="records-header foi-toolbar"><h2>FOI Registry</h2><button class="add-btn" id="openModal"><i class="fa-solid fa-plus"></i> New FOI Request</button></div>
    <div class="filter-panel foi-filter-panel"><div class="filter-row"><div class="filter-box foi-search-filter"><label for="searchInput">Search Requests</label><input id="searchInput" type="search" placeholder="Search transaction, name, title or reference..."></div><div class="filter-box foi-decision-filter"><label for="decisionFilter">Decision</label><select id="decisionFilter"><option value="">All Decisions</option></select></div></div></div>
    <div class="table-container foi-table-wrap"><table class="records-table modern-table foi-table"><thead><tr>
        <th>Transaction No.</th><th>Requester</th><th>Document Requested</th><th>Date Received</th><th>Decision</th><th>Actions</th>
    </tr></thead><tbody id="foiBody"></tbody></table><div id="emptyState" class="empty-state" style="display:none"><i class="fa-solid fa-file-circle-question"></i><h3>No FOI Requests</h3><p>Create the first FOI request to get started.</p></div></div>
</section>
<div id="foiModal" class="modal"><div class="modal-content foi-modal"><span class="close" id="closeModal">&times;</span><h2 id="modalTitle">New FOI Request</h2><p class="foi-help">Complete the registry fields below. Required fields are marked by the browser.</p><form id="foiForm"><div id="foiFields" class="foi-form-grid"></div><div class="modal-buttons"><button type="submit" class="save-btn"><i class="fa-solid fa-floppy-disk"></i> Save Request</button><button type="button" class="cancel-btn" id="cancelModal">Cancel</button></div></form></div></div>
<div id="foiPreviewModal" class="modal foi-preview-overlay" aria-hidden="true"><section class="modal-content foi-preview-panel" role="dialog" aria-modal="true" aria-labelledby="foiPreviewTitle"><header class="foi-preview-header"><h2 id="foiPreviewTitle">Filled FOI Form Preview</h2><button type="button" class="icon-btn delete-btn" id="closeFoiPreview" aria-label="Close preview" title="Close preview"><i class="fa-solid fa-xmark"></i></button></header><div class="foi-preview-actions"><button type="button" class="save-btn" id="foiPreviewPrint" disabled><i class="fa-solid fa-print"></i> Print</button></div><iframe id="foiPreviewFrame" class="foi-preview-frame" title="Filled FOI PDF preview"></iframe></section></div>
<script src="assets/js/auth.js"></script>
<script src="assets/js/table-pagination.js?v=<?= filemtime(__DIR__ . '/../../assets/js/table-pagination.js') ?>"></script>
<script src="assets/js/foi.js?v=<?= filemtime(__DIR__ . '/../../assets/js/foi.js') ?>"></script>
</body>
</html>
