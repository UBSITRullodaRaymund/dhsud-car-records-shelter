<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Documents Monitoring | DHSUD-CAR Records Shelter</title>
    <link rel="icon" type="image/png" href="logo.png">

    <link rel="stylesheet" href="assets/css/style.css">

    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">

    <link rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css">
<?php require __DIR__ . '/../partials/navigation-assets.php'; ?>
</head>

<body class="has-app-navigation">

<?php require __DIR__ . '/../partials/navigation.php'; ?>
<!-- ================= NAVIGATION ================= -->

<header>

<nav>

<div class="logo">

<img src="logo.png" alt="Logo">

<div>

<h2>DHSUD-CAR</h2>

<span>Records Shelter</span>

</div>

</div>

<ul>

<li><a href="./">Home</a></li>

<li><a href="documents" class="active">Documents Monitoring</a></li>

</ul>

</nav>

</header>

<!-- ================= PAGE HEADER ================= -->

<section class="page-banner">

<div class="page-banner-content">

<h1>Documents Monitoring</h1>

<p>

Monitor all official incoming documents, outgoing documents,
and dockets issuances in one place.

</p>

</div>

</section>

<!-- ================= MODULES ================= -->

<section class="documents-container">

<?php if ($userCanViewModule('incoming')): ?>
<div class="doc-card">

<div class="doc-icon">

<i class="fa-solid fa-inbox"></i>

</div>

<div class="doc-text">

<h2>Incoming Documents</h2>

<p>

Manage and monitor all received documents.

</p>

</div>

<div class="doc-button">

<a href="incoming">

Open

<i class="fa-solid fa-arrow-right"></i>

</a>

</div>

</div>
<?php endif; ?>

<?php if ($userCanViewModule('outgoing')): ?>
<div class="doc-card">

<div class="doc-icon">

<i class="fa-solid fa-paper-plane"></i>

</div>

<div class="doc-text">

<h2>Outgoing Documents</h2>

<p>

Track all outgoing communications and releases.

</p>

</div>

<div class="doc-button">

<a href="outgoing">

Open

<i class="fa-solid fa-arrow-right"></i>

</a>

</div>

</div>
<?php endif; ?>

<?php if ($userCanViewModule('dockets')): ?>
<div class="doc-card">

<div class="doc-icon">

<i class="fa-solid fa-folder-open"></i>

</div>

<div class="doc-text">

<h2>Dockets Issuances</h2>

<p>

View and organize all official dockets.

</p>

</div>

<div class="doc-button">

<a href="dockets">

Open

<i class="fa-solid fa-arrow-right"></i>

</a>

</div>

</div>
<?php endif; ?>

</section>

<!-- ================= BACK BUTTON ================= -->

<div class="back-home">

<a href="./">

<i class="fa-solid fa-house"></i>

Back to Home

</a>

</div>

<footer>

<h3>DHSUD-CAR RECORDS SHELTER</h3>

<p>

Department of Human Settlements and Urban Development
Cordillera Administrative Region

</p>

<p>

© 2026 All Rights Reserved.

</p>

</footer>

<script src="assets/js/script.js"></script>

</body>
</html>