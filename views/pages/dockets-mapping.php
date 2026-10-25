<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Dockets Mapping | DHSUD-CAR Records Shelter</title>

<link rel="stylesheet" href="assets/css/dockets-mapping.css?v=<?= filemtime(__DIR__ . '/../../assets/css/dockets-mapping.css') ?>">

<link rel="preconnect" href="https://fonts.googleapis.com">

<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">

<link rel="stylesheet"
href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css">

<?php require __DIR__ . '/../partials/navigation-assets.php'; ?>
</head>

<body class="has-app-navigation dockets-mapping-page">

<?php require __DIR__ . '/../partials/navigation.php'; ?>
<!-- ==========================================
HEADER
========================================== -->

<header class="navbar">

<div class="container">

<div class="logo">

<img src="logo.png">

<div>

<h2>DHSUD-CAR</h2>

<span>Records Shelter</span>

</div>

</div>

<ul class="nav-links">

<li><a href="./">Home</a></li>

<li><a href="documents">Documents Monitoring</a></li>

<li><a href="dockets-mapping" class="active">Dockets Mapping</a></li>

</ul>

</div>

</header>

<!-- ==========================================
HERO
========================================== -->

<section class="hero">

<div class="container hero-content">

<div>

<span class="badge">

<i class="fa-solid fa-map-location-dot"></i>

Dockets Mapping Explorer

</span>

<h1>Digital Dockets Repository</h1>

<p>

Browse projects, folders, documents and preview files
from one centralized workspace.

</p>

</div>

<div class="hero-icon">

<i class="fa-solid fa-folder-tree"></i>

</div>

</div>

</section>

<!-- ==========================================
STATISTICS
========================================== -->

<section class="stats">

<div class="container">

<div class="stats-grid">

<div class="stat-card">

<i class="fa-solid fa-layer-group"></i>

<h3 id="totalCategories">0</h3>

<p>Categories</p>

</div>

<div class="stat-card">

<i class="fa-solid fa-folder-tree"></i>

<h3 id="totalProjects">0</h3>

<p>Projects</p>

</div>

<div class="stat-card">

<i class="fa-solid fa-folder-open"></i>

<h3 id="totalFolders">0</h3>

<p>Folders</p>

</div>

<div class="stat-card">

<i class="fa-solid fa-file-lines"></i>

<h3 id="totalDocuments">0</h3>

<p>Documents</p>

</div>

</div>

</div>

</section>

<!-- ==========================================
SEARCH
========================================== -->

<section class="search-section">

<div class="container">

<div class="repository-search-heading">
    <div>
        <p class="repository-eyebrow">Find a record</p>
        <h2>Search the repository</h2>
    </div>
    <p>Search by file, project, folder, or narrow the results with filters.</p>
</div>

<div class="search-box">

<label class="repository-search-field">
    <span class="visually-hidden">Search files, projects, folders, or remarks</span>
    <i class="fa-solid fa-search" aria-hidden="true"></i>
    <input
    id="searchInput"
    type="search"
    placeholder="Search files, projects, folders..."
    oninput="applyFilters()">
</label>

<label class="repository-filter">
    <span>Category</span>
    <select id="categoryFilter" onchange="applyFilters()" aria-label="Filter by category">
        <option value="">All Categories</option>
    </select>
</label>

<label class="repository-filter">
    <span>Project</span>
    <select id="projectFilter" onchange="applyFilters()" aria-label="Filter by project">
        <option value="">All Projects</option>
    </select>
</label>

<label class="repository-filter">
    <span>Folder</span>
    <select id="folderFilter" onchange="applyFilters()" aria-label="Filter by folder">
        <option value="">All Folders</option>
    </select>
</label>

<button class="primary-btn clear-filters-btn" type="button" onclick="clearFilters()">
    <i class="fa-solid fa-filter-circle-xmark" aria-hidden="true"></i>
    <span>Clear filters</span>
</button>

</div>

</div>

</section>

<!-- ==========================================
EXPLORER
========================================== -->

<section class="explorer-section">

<div class="container">

<div class="explorer-layout">

<!-- LEFT PANEL -->

<aside class="sidebar">

<h3>
    <span class="repository-step-number">1</span>
    <span>Choose a category</span>
</h3>
<p class="repository-panel-hint">Start here to browse projects and files.</p>

<div id="categoryList">

<!-- JavaScript -->

</div>

</aside>

<!-- CENTER PANEL -->

<main class="explorer">

<h3>
    <span class="repository-step-number">2</span>
    <span>Browse projects &amp; folders</span>
</h3>

<!-- Breadcrumb -->

<nav id="breadcrumb" class="breadcrumb" aria-label="Repository location" aria-live="polite">
    <button type="button" class="breadcrumb-link" onclick="goHome()" aria-current="page">
        <i class="fa-solid fa-house" aria-hidden="true"></i>
        <span>Repository home</span>
    </button>
</nav>

<div id="explorerContent">

<div class="empty-state">

<i class="fa-solid fa-folder-open"></i>

<h2>Choose a category to begin</h2>

<p>

Your projects and folders will appear here. Use the location trail above to move back at any time.

</p>

</div>

</div>

</main>

<!-- RIGHT PANEL -->

<aside class="preview">

<h3>
    <span class="repository-step-number">3</span>
    <span>Preview a document</span>
</h3>
<p id="previewPanelHint" class="repository-panel-hint">Select “Preview file” on a document to see it here.</p>

<div id="previewContent">

<div class="empty-state">

<i class="fa-solid fa-file-pdf"></i>

<h2>No file selected</h2>

<p>

Select a document to preview it here.

</p>

</div>

</div>

</aside>

</div>

</div>

</section>

<script src="assets/js/auth.js"></script>
<script src="assets/js/table-pagination.js?v=<?= filemtime(__DIR__ . '/../../assets/js/table-pagination.js') ?>"></script>
<script src="assets/js/dockets-mapping.js?v=<?= filemtime(__DIR__ . '/../../assets/js/dockets-mapping.js') ?>"></script>

</body>

</html>