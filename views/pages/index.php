<!DOCTYPE html>
<html lang="en">

<head>

    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>DHSUD-CAR RECORDS SHELTER</title>
    <link rel="icon" type="image/png" href="logo.png">

    <link rel="stylesheet" href="style.css">

    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet">

    <link rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css">

<?php require __DIR__ . '/../partials/navigation-assets.php'; ?>
</head>

<body class="dashboard-page has-app-navigation">

<?php require __DIR__ . '/../partials/navigation.php'; ?>


<!-- ==================================================
     NAVIGATION
================================================== -->

<header class="dashboard-header">

    <nav class="dashboard-nav" aria-label="Main navigation">

        <div class="logo">

            <img src="logo.png" alt="DHSUD-CAR Logo">

            <div>

                <h2>DHSUD-CAR</h2>

                <span>Records Shelter</span>

            </div>

        </div>


        <ul>

            <li>
                <a href="#" class="active" title="Home">
                    <i class="fa-solid fa-house" aria-hidden="true"></i>
                    <span>Home</span>
                </a>
            </li>

            <li>
                <a href="#welcome" title="About">
                    <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
                    <span>About</span>
                </a>
            </li>

            <li>
                <a href="login" title="Login">
                    <i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i>
                    <span>Login</span>
                </a>
            </li>

            <li>
                <a href="users" title="User management">
                    <i class="fa-solid fa-users" aria-hidden="true"></i>
                    <span>User Management</span>
                </a>
            </li>

            <li>
                <a href="activity-log" title="Activity log">
                    <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>
                    <span>Activity Log</span>
                </a>
            </li>

            <li>
                <a href="#departments" title="Departments">
                    <i class="fa-solid fa-building" aria-hidden="true"></i>
                    <span>Departments</span>
                </a>
            </li>

            <li>
                <a href="documents" title="Documents monitoring">
                    <i class="fa-solid fa-file-lines" aria-hidden="true"></i>
                    <span>Documents</span>
                </a>
            </li>

            <li>
                <a href="dockets" title="Dockets issuances">
                    <i class="fa-solid fa-folder-open" aria-hidden="true"></i>
                    <span>Dockets</span>
                </a>
            </li>

            <li>
                <a href="dockets-mapping" title="Dockets mapping">
                    <i class="fa-solid fa-map" aria-hidden="true"></i>
                    <span>Dockets Mapping</span>
                </a>
            </li>

            <li>
                <a href="foi" title="Freedom of information">
                    <i class="fa-solid fa-envelope-open-text" aria-hidden="true"></i>
                    <span>FOI</span>
                </a>
            </li>

            <li>
                <a href="#footer" title="Contact">
                    <i class="fa-solid fa-address-card" aria-hidden="true"></i>
                    <span>Contact</span>
                </a>
            </li>

        </ul>

    </nav>

</header>


<!-- ==================================================
     HERO
================================================== -->

<section class="hero">

    <div class="overlay">

        <div class="hero-content">

            <h1>DHSUD-CAR</h1>

            <h2>RECORDS SHELTER</h2>

            <p>
                Explore connected records tools and find the services your
                office needs, all in one secure digital shelter.
            </p>

            <a href="#departments" class="btn">
                Explore Departments
            </a>

        </div>

    </div>

</section>

<!-- ==================================================
     GENERAL STATISTICS
================================================== -->

<section id="overview" class="dashboard-overview" aria-labelledby="overviewTitle">

    <div class="overview-heading">
        <div>
            <p class="overview-eyebrow">Records at a glance</p>
            <h2 id="overviewTitle">General Statistics</h2>
            <p id="overviewMessage" role="status">Sign in to see statistics for your office.</p>
        </div>
        <button id="refreshStatistics" class="refresh-statistics" type="button" hidden>
            <i class="fa-solid fa-rotate" aria-hidden="true"></i>
            Refresh
        </button>
    </div>

    <div id="statisticsGrid" class="overview-statistics" aria-live="polite">
        <article class="overview-stat-card">
            <span class="overview-stat-icon"><i class="fa-solid fa-layer-group" aria-hidden="true"></i></span>
            <div><p>Total Records</p><strong id="statTotal">—</strong></div>
        </article>
        <article class="overview-stat-card">
            <span class="overview-stat-icon incoming-icon"><i class="fa-solid fa-inbox" aria-hidden="true"></i></span>
            <div><p>Incoming</p><strong id="statIncoming">—</strong></div>
        </article>
        <article class="overview-stat-card">
            <span class="overview-stat-icon outgoing-icon"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i></span>
            <div><p>Outgoing</p><strong id="statOutgoing">—</strong></div>
        </article>
        <article class="overview-stat-card">
            <span class="overview-stat-icon docket-icon"><i class="fa-solid fa-folder-open" aria-hidden="true"></i></span>
            <div><p>Docket Issuances</p><strong id="statDockets">—</strong></div>
        </article>
        <article class="overview-stat-card">
            <span class="overview-stat-icon mapping-icon"><i class="fa-solid fa-map" aria-hidden="true"></i></span>
            <div><p>Dockets Mapping</p><strong id="statDocketsMapping">—</strong></div>
        </article>
        <article class="overview-stat-card">
            <span class="overview-stat-icon foi-icon"><i class="fa-solid fa-envelope-open-text" aria-hidden="true"></i></span>
            <div><p>FOI Requests</p><strong id="statFoi">—</strong></div>
        </article>
    </div>

    <div class="overview-chart-grid">
        <article class="overview-chart-card">
            <div class="overview-chart-heading">
                <div>
                    <h3>Records by Module</h3>
                    <p>Current accessible records by system area</p>
                </div>
            </div>
            <div id="moduleChart" class="bar-chart" role="img" aria-label="Records by module chart"></div>
        </article>

        <article class="overview-chart-card">
            <div class="overview-chart-heading">
                <div>
                    <h3>Work Status</h3>
                    <p>Records grouped by their current status</p>
                </div>
            </div>
            <div id="statusChart" class="bar-chart status-chart" role="img" aria-label="Work status chart"></div>
        </article>
    </div>

</section>



<!-- ==================================================
     DEPARTMENTS
================================================== -->

<section id="departments">

    <div class="title">

        <h2>Departments</h2>

        <p>
            Select a department to continue
        </p>

    </div>


    <div class="department-grid">


        <!-- HREDRD -->

        <div class="department-card">

            <div class="department-icon">
                <i class="fa-solid fa-building"></i>
            </div>

            <div class="department-content">

                <h3>HREDRD</h3>

                <p>
                    Housing and Real Estate Development
                    Regulation Division
                </p>

            </div>

            <button onclick="openDepartment('HREDRD')">
                Open Department
                <i class="fa-solid fa-arrow-right"></i>
            </button>

        </div>


        <!-- ORD -->

        <div class="department-card">

            <div class="department-icon">
                <i class="fa-solid fa-user-tie"></i>
            </div>

            <div class="department-content">

                <h3>ORD</h3>

                <p>
                    Office of the Regional Director
                </p>

            </div>

            <button onclick="openDepartment('ORD')">
                Open Department
                <i class="fa-solid fa-arrow-right"></i>
            </button>

        </div>


        <!-- RECORDS -->

        <div class="department-card records-card">

            <div class="department-icon">
                <i class="fa-solid fa-box-archive"></i>
            </div>

            <div class="department-content">

                <h3>RECORDS</h3>

                <p>
                    Centralized records management,
                    monitoring, and custody system.
                </p>

            </div>

            <button onclick="window.location.href='records'">
                Open Records
                <i class="fa-solid fa-arrow-right"></i>
            </button>

        </div>


        <!-- PHSD -->

        <div class="department-card">

            <div class="department-icon">
                <i class="fa-solid fa-house"></i>
            </div>

            <div class="department-content">

                <h3>PHSD</h3>

                <p>
                    Public Housing and Settlements Division
                </p>

            </div>

            <button onclick="openDepartment('PHSD')">
                Open Department
                <i class="fa-solid fa-arrow-right"></i>
            </button>

        </div>


        <!-- ELUPDD -->

        <div class="department-card">

            <div class="department-icon">
                <i class="fa-solid fa-map-location-dot"></i>
            </div>

            <div class="department-content">

                <h3>ELUPDD</h3>

                <p>
                    Environmental, Land Use, and Urban Planning
                    and Development Division
                </p>

            </div>

            <button onclick="openDepartment('ELUPDD')">
                Open Department
                <i class="fa-solid fa-arrow-right"></i>
            </button>

        </div>


        <!-- AFD -->

        <div class="department-card">

            <div class="department-icon">
                <i class="fa-solid fa-coins"></i>
            </div>

            <div class="department-content">

                <h3>AFD</h3>

                <p>
                    Administrative and Finance Division
                </p>

            </div>

            <button onclick="openDepartment('AFD')">
                Open Department
                <i class="fa-solid fa-arrow-right"></i>
            </button>

        </div>


        <!-- HOACDD -->

        <div class="department-card">

            <div class="department-icon">
                <i class="fa-solid fa-people-group"></i>
            </div>

            <div class="department-content">

                <h3>HOACDD</h3>

                <p>
                    Homeowners Association and Community
                    Development Division
                </p>

            </div>

            <button onclick="openDepartment('HOACDD')">
                Open Department
                <i class="fa-solid fa-arrow-right"></i>
            </button>

        </div>


    </div>

</section>


<!-- ==================================================
     FOOTER
================================================== -->

<footer id="footer">

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


<script src="auth.js"></script>
<script src="dashboard.js?v=<?= filemtime(__DIR__ . '/../../dashboard.js') ?>"></script>
<script src="script.js"></script>


<script>

const departmentApps = {

    PHSD: "https://script.google.com/macros/s/AKfycbywCJxOZsBGOR27SKHaCt9qn26rTOwP3dgT1Jz6QMl9T_bYRe_oOwDNW8hlzxGDRxcb/exec"

};


function openDepartment(department) {

    const url = departmentApps[department];

    if (!url) {

        alert(
            "The " +
            department +
            " website has not been connected yet."
        );

        return;

    }

    window.location.href = url;

}

</script>


</body>
</html>