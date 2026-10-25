<!DOCTYPE html>
<html lang="en">

<head>

    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Records - DHSUD-CAR</title>

    <link rel="icon" type="image/png" href="logo.png">

    <link rel="stylesheet" href="assets/css/style.css">

    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet">

    <link rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css">

<?php require __DIR__ . '/../partials/navigation-assets.php'; ?>
</head>

<body class="has-app-navigation">

<?php require __DIR__ . '/../partials/navigation.php'; ?>

<!-- ==================================================
     NAVIGATION
================================================== -->

<header>

    <nav>

        <div class="logo">

            <img src="logo.png" alt="DHSUD-CAR Logo">

            <div>

                <h2>DHSUD-CAR</h2>

                <span>Records Shelter</span>

            </div>

        </div>


        <ul>

            <li>
                <a href="./">
                    Home
                </a>
            </li>

            <li>
                <a href="records" class="active">
                    Records
                </a>
            </li>

        </ul>

    </nav>

</header>


<!-- ==================================================
     HERO
================================================== -->

<section class="module-hero">

    <div class="module-hero-content">

        <div class="module-hero-icon">

            <i class="fa-solid fa-box-archive"></i>

        </div>

        <div>

            <h1>Records</h1>

            <p>
                Access and manage DHSUD-CAR records management
                systems and services.
            </p>

        </div>

    </div>

</section>


<!-- ==================================================
     RECORDS MODULES
================================================== -->

<main class="records-container">


    <div class="records-title">

        <h2>
            Records Modules
        </h2>

        <p>
            Select a records management service to continue.
        </p>

    </div>


    <div class="records-list">


        <?php if ($userCanViewModule('incoming') || $userCanViewModule('outgoing') || $userCanViewModule('dockets')): ?>
        <div class="records-module-card">
            <div class="records-module-icon"><i class="fa-solid fa-folder-tree"></i></div>
            <div class="records-module-content">
                <h3>Documents Monitoring</h3>
                <p>Monitor all official incoming documents, outgoing documents, and document issuances in one place.</p>
            </div>
            <button onclick="window.location.href='documents'">Open <i class="fa-solid fa-arrow-right"></i></button>
        </div>
        <?php endif; ?>

        <?php if ($userCanViewModule('foi')): ?>
        <div class="records-module-card">
            <div class="records-module-icon"><i class="fa-solid fa-file-circle-question"></i></div>
            <div class="records-module-content">
                <h3>Requests</h3>
                <p>Manage FOI, Billing, Certified True Copy, Receiving, and other records-related requests.</p>
            </div>
            <button onclick="window.location.href='requests'">Open <i class="fa-solid fa-arrow-right"></i></button>
        </div>
        <?php endif; ?>

        <?php if ($userCanViewModule('docketsMapping')): ?>
        <div class="records-module-card">
            <div class="records-module-icon"><i class="fa-solid fa-map-location-dot"></i></div>
            <div class="records-module-content">
                <h3>Dockets Mapping</h3>
                <p>Search, locate, and organize official dockets and their corresponding records.</p>
            </div>
            <button onclick="window.location.href='dockets-mapping'">Open <i class="fa-solid fa-arrow-right"></i></button>
        </div>
        <?php endif; ?>

        <?php if ($userCanViewModule('recordsMasterList')): ?>
        <div class="records-module-card">
            <div class="records-module-icon"><i class="fa-solid fa-book-open"></i></div>
            <div class="records-module-content">
                <h3>Records Master List</h3>
                <p>Manage records inventory, registries, and the masterlist of official records.</p>
            </div>
            <button onclick="window.location.href='records-masterlist'">Open <i class="fa-solid fa-arrow-right"></i></button>
        </div>
        <?php endif; ?>

        <?php if ($userCanViewModule('recordsTransfer')): ?>
        <div class="records-module-card">
            <div class="records-module-icon"><i class="fa-solid fa-boxes-packing"></i></div>
            <div class="records-module-content">
                <h3>Records Transfer Custody</h3>
                <p>Track the transfer, receiving, and custody of official DHSUD-CAR records.</p>
            </div>
            <button onclick="window.location.href='records-transfer'">Open <i class="fa-solid fa-arrow-right"></i></button>
        </div>
        <?php endif; ?>


    </div>


    <!-- BACK BUTTON -->

    <div class="back-home">

        <button onclick="window.location.href='./'">

            <i class="fa-solid fa-house"></i>

            Back to Home

        </button>

    </div>


</main>


<footer>

    <h3>
        DHSUD-CAR RECORDS SHELTER
    </h3>

    <p>
        Department of Human Settlements and Urban Development
        Cordillera Administrative Region
    </p>

    <p>
        © 2026 All Rights Reserved.
    </p>

</footer>


</body>
</html>