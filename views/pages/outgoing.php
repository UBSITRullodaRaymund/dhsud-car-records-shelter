<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>Outgoing Documents | DHSUD-CAR</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">

  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
  >

  <link rel="stylesheet" href="assets/css/outgoing.css">
<?php require __DIR__ . '/../partials/navigation-assets.php'; ?>
</head>

<body class="has-app-navigation">

<?php require __DIR__ . '/../partials/navigation.php'; ?>

  <!-- =========================================================
       TOP BAR
  ========================================================== -->

  <header class="topbar">

    <div class="brand">
      <img src="logo.png" alt="DHSUD Logo">

      <div class="brand-text">
        <strong>DHSUD-CAR</strong>
        <span>Document Monitoring System</span>
      </div>
    </div>

    <nav class="navigation">

      <a href="./">
        <i class="fa-solid fa-house"></i>
        Home
      </a>

      <a href="documents" class="active">
        <i class="fa-solid fa-file-lines"></i>
        Documents Monitoring
      </a>

      <a href="dockets">
        <i class="fa-solid fa-folder-open"></i>
        Dockets Issuances
      </a>

    </nav>

  </header>


  <!-- =========================================================
       MAIN CONTENT
  ========================================================== -->

  <main class="main-container">

    <!-- Back Button -->

    <div class="back-container">

      <button
        type="button"
        class="back-monitoring-btn"
        onclick="goToDocumentsMonitoring()"
      >
        <i class="fa-solid fa-arrow-left"></i>
        Back to Documents Monitoring
      </button>

    </div>


    <!-- =======================================================
         HERO
    ======================================================== -->

    <section class="hero">

      <div class="hero-icon">
        <i class="fa-solid fa-paper-plane"></i>
      </div>

      <div class="hero-content">

        <h1>Outgoing Documents</h1>

        <p>
          Monitor and manage documents routed to DHSUD-CAR departments.
        </p>

      </div>

    </section>


    <!-- =======================================================
         OVERALL STATISTICS
    ======================================================== -->

    <section class="statistics-grid">

      <!-- TOTAL -->

      <div class="stat-card">

        <div class="stat-icon">
          <i class="fa-solid fa-folder-open"></i>
        </div>

        <div class="stat-content">

          <span class="stat-label">
            Total Documents
          </span>

          <strong id="totalOutgoing">
            0
          </strong>

        </div>

      </div>


      <!-- PENDING -->

      <div class="stat-card">

        <div class="stat-icon">
          <i class="fa-solid fa-clock"></i>
        </div>

        <div class="stat-content">

          <span class="stat-label">
            Pending
          </span>

          <strong id="pendingOutgoing">
            0
          </strong>

        </div>

      </div>


      <!-- PROCESSING -->

      <div class="stat-card">

        <div class="stat-icon">
          <i class="fa-solid fa-spinner"></i>
        </div>

        <div class="stat-content">

          <span class="stat-label">
            Processing
          </span>

          <strong id="processingOutgoing">
            0
          </strong>

        </div>

      </div>


      <!-- COMPLETED -->

      <div class="stat-card">

        <div class="stat-icon">
          <i class="fa-solid fa-circle-check"></i>
        </div>

        <div class="stat-content">

          <span class="stat-label">
            Completed
          </span>

          <strong id="completedOutgoing">
            0
          </strong>

        </div>

      </div>

    </section>


    <!-- =======================================================
         SEARCH
    ======================================================== -->

    <section class="search-section">

      <div class="search-box">

        <i class="fa-solid fa-magnifying-glass"></i>

        <input
          type="text"
          id="outgoingSearch"
          placeholder="Search departments or documents..."
          autocomplete="off"
        >

      </div>

    </section>


    <!-- =======================================================
         DEPARTMENT VIEW
    ======================================================== -->

    <section id="departmentsView">

      <div class="section-heading">

        <div>
          <h2>Departments</h2>

          <p>
            Select a department to view its outgoing documents.
          </p>
        </div>

      </div>


      <!-- Department cards are generated by JavaScript -->

      <div
        id="departmentGrid"
        class="department-grid"
      ></div>

    </section>


    <!-- =======================================================
         DEPARTMENT DOCUMENTS
    ======================================================== -->

    <section
      id="departmentDocuments"
      class="department-documents hidden"
    >

      <div class="documents-header">

        <div class="documents-title-area">

          <button
            type="button"
            id="departmentBackBtn"
            class="department-back-btn"
          >
            <i class="fa-solid fa-arrow-left"></i>
            Back to Departments
          </button>

          <h2 id="departmentDocumentsTitle">
            Department Documents
          </h2>

          <p id="departmentDocumentsSubtitle">
            Documents routed to this department.
          </p>

        </div>

      </div>


      <!-- Department Search -->

      <div class="department-search">

        <div class="search-box">

          <i class="fa-solid fa-magnifying-glass"></i>

          <input
            type="text"
            id="departmentDocumentsSearch"
            placeholder="Search documents..."
            autocomplete="off"
          >

        </div>

      </div>


      <!-- Document Table -->

      <div class="table-wrapper spreadsheet-table-container">

        <table class="documents-table spreadsheet-table">

          <thead>

            <tr>
              <th>ROUTING SLIP NO</th>
              <th>DATE RECEIVED</th>
              <th>SENDER</th>
              <th>SUBJECT</th>
              <th>TO</th>
              <th>STATUS</th>
              <th>Action</th>

            </tr>

          </thead>

          <tbody id="departmentDocumentsBody">

            <tr>

              <td
                colspan="7"
                class="empty-cell"
              >
                No documents found.
              </td>

            </tr>

          </tbody>

        </table>

      </div>

    </section>


    <!-- =======================================================
         LOADING
    ======================================================== -->

    <div
      id="loadingMessage"
      class="loading-message hidden"
    >

      <i class="fa-solid fa-spinner fa-spin"></i>

      <span>
        Loading documents...
      </span>

    </div>

  </main>


  <!-- =========================================================
       JAVASCRIPT
  ========================================================== -->

  <script src="assets/js/auth.js"></script>
  <script src="assets/js/table-pagination.js?v=<?= filemtime(__DIR__ . '/../../assets/js/table-pagination.js') ?>"></script>
  <script
    src="assets/js/outgoing.js?v=<?= filemtime(__DIR__ . '/../../assets/js/outgoing.js') ?>"
    defer
  ></script>

</body>
</html>