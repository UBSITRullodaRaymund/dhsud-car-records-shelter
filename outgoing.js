/* =========================================================
   DHSUD-CAR OUTGOING DOCUMENTS
   ========================================================= */


/* =========================================================
   STORAGE
   ========================================================= */

const STORAGE_KEY = "dhsudCarDocuments";


/* =========================================================
   DEPARTMENTS
   ========================================================= */

const DEPARTMENTS = [

  {
    code: "HREDRD",
    name: "Housing and Real Estate Development Regulation Division",
    icon: "fa-building",
    color: "#1d4ed8"
  },

  {
    code: "PHSD",
    name: "Public Housing and Settlements Division",
    icon: "fa-house",
    color: "#ea580c"
  },

  {
    code: "AFD",
    name: "Administrative and Finance Division",
    icon: "fa-coins",
    color: "#ca8a04"
  },

  {
    code: "HOACDD",
    name: "Homeowners Association and Community Development Division",
    icon: "fa-people-group",
    color: "#15803d"
  },

  {
    code: "ELUPDD",
    name: "Environmental, Land Use, and Urban Planning and Development Division",
    icon: "fa-map-location-dot",
    color: "#7c3aed"
  },

  {
    code: "ORD",
    name: "Office of the Regional Director",
    icon: "fa-building-columns",
    color: "#be185d"
  }

];


/* =========================================================
   STATE
   ========================================================= */

let allDocuments = [];

let selectedDepartment = null;

let departmentSearchTerm = "";

let googleSheetDocuments = [];

const OUTGOING_SPREADSHEET_COLUMNS = [
  ["ROUTING SLIP NO", "routingSlipNo"],
  ["DATE OF DOCUMENT", "dateOfDocument"],
  ["DATE RECEIVED", "dateReceived"],
  ["SENDER", "sender"],
  ["SIGNATORY", "signatory"],
  ["MODE OF COMMUNICATION", "modeOfCommunication"],
  ["SUBJECT", "subject"],
  ["DATE RELEASED", "dateReleased"],
  ["FROM", "from"],
  ["TO", "to"],
  ["ACTION NO.", "actionNo"],
  ["COMMENTS/ REMARKS", "comments"],
  ["RECEIVED BY", "receivedBy"],
  ["E-MAIL ADD", "email"],
  ["DEADLINE", "deadline"],
  ["STATUS", "status"],
  ["REMINDER SENT", "reminderSent"],
  ["Date Completed", "dateCompleted"]
];


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

  setupEvents();

  showLoading(true);

  loadGoogleSheetDocuments()
    .then(function () {

      loadAllDocuments();

      renderStatistics();

      renderDepartments();

    })
    .catch(function (error) {

      console.error(
        "Initialization error:",
        error
      );

      googleSheetDocuments = [];
      allDocuments = [];

      renderStatistics();

      renderDepartments();
      alert("Outgoing documents could not be loaded from Google Sheets. Local cached records are not being shown. Please try again.");

    })
    .finally(function () {

      showLoading(false);

    });

});


/* =========================================================
   EVENTS
   ========================================================= */

function setupEvents() {

  const mainSearch =
    document.getElementById("outgoingSearch");


  if (mainSearch) {

    mainSearch.addEventListener(
      "input",
      function () {

        renderDepartments();

      }
    );

  }


  const departmentSearch =
    document.getElementById(
      "departmentDocumentsSearch"
    );


  if (departmentSearch) {

    departmentSearch.addEventListener(
      "input",
      function () {

        departmentSearchTerm =
          departmentSearch.value
            .trim()
            .toLowerCase();

        TablePagination.reset(document.getElementById("departmentDocumentsBody"));

        if (selectedDepartment) {

          renderDepartmentDocuments(
            selectedDepartment
          );

        }

      }
    );

  }


  const backButton =
    document.getElementById(
      "departmentBackBtn"
    );


  if (backButton) {

    backButton.addEventListener(
      "click",
      function () {

        closeDepartmentDocuments();

      }
    );

  }


  window.addEventListener(
    "storage",
    function (event) {

      if (event.key === STORAGE_KEY) {

        loadAllDocuments();

        renderStatistics();

        renderDepartments();


        if (selectedDepartment) {

          renderDepartmentDocuments(
            selectedDepartment
          );

        }

      }

    }
  );

}


/* =========================================================
   LOCAL STORAGE
   ========================================================= */

function getLocalDocuments() {

  try {

    const stored =
      localStorage.getItem(
        STORAGE_KEY
      );


    if (!stored) {

      return [];

    }


    const parsed =
      JSON.parse(stored);


    return Array.isArray(parsed)
      ? parsed
      : [];


  } catch (error) {

    console.error(
      "Could not read local documents:",
      error
    );

    return [];

  }

}


/* =========================================================
   LOAD ALL DOCUMENTS
   ========================================================= */

function loadAllDocuments() {

  const localDocuments =
    getLocalDocuments();


  const combined = [

    ...googleSheetDocuments,

    ...localDocuments

  ];


  const uniqueDocuments = [];

  const seen = new Set();


  combined.forEach(function (doc) {

    const key =
      createDocumentKey(
        doc
      );


    if (!seen.has(key)) {

      seen.add(key);

      uniqueDocuments.push(
        doc
      );

    }

  });


  allDocuments =
    uniqueDocuments.filter(
      function (doc) {

        return getDepartment(
          doc
        ) !== "";

      }
    );


  console.log(
    "Outgoing documents loaded:",
    allDocuments.length
  );

}


/* =========================================================
   LOAD GOOGLE SHEET
   ========================================================= */

async function loadGoogleSheetDocuments() {

  try {
    const records = await authedGet({
      action: "getDocuments",
      module: "outgoing",
      sheet: "Outgoing Documents",
      office: getRequestOffice()
    });
    if (!Array.isArray(records)) {
      throw new Error(records && records.error ? records.error : "Google Sheets returned an invalid outgoing-record list.");
    }

    googleSheetDocuments = records.map(function (record, index) {
      const normalized = normalizeRecordFields(record, "outgoing");
      const destination = normalized.to || normalized.office || "";
      return {
        id: normalized.tracking || `SHEET-${index + 1}`,
        source: "google-sheet",
        routingSlipNo: normalized.tracking || "",
        dateOfDocument: normalized.dateDocument || "",
        dateReceived: normalized.dateReceived || "",
        sender: normalized.sender || "",
        signatory: normalized.signatory || "",
        modeOfCommunication: normalized.communicationMode || "",
        subject: normalized.subject || "",
        dateReleased: normalized.dateReleased || "",
        from: normalized.from || "",
        to: destination,
        actionNo: normalized.actionNo || "",
        comments: normalized.comments || "",
        receivedBy: normalized.receivedBy || "",
        email: normalized.email || "",
        deadline: normalized.deadline || "",
        status: normalized.status || "",
        reminderSent: normalized.reminderSent || "",
        dateCompleted: normalized.dateCompleted || "",
        department: normalizeDepartment(destination)
      };
    });


    console.log(
      "Google Sheet rows loaded:",
      googleSheetDocuments.length
    );


    const recognized =
      googleSheetDocuments.filter(
        function (doc) {

          return getDepartment(
            doc
          ) !== "";

        }
      );


    console.log(
      "Google Sheet records recognized for Outgoing:",
      recognized.length
    );


  } catch (error) {

    console.error(
      "Google Sheet loading error:",
      error
    );

    throw error;

  }

}


/* =========================================================
   CSV PARSER
   ========================================================= */

function parseCSV(text) {

  const rows = [];

  let row = [];

  let value = "";

  let insideQuotes = false;


  for (
    let i = 0;
    i < text.length;
    i++
  ) {

    const character =
      text[i];

    const nextCharacter =
      text[i + 1];


    if (
      character === '"'
    ) {

      if (
        insideQuotes &&
        nextCharacter === '"'
      ) {

        value += '"';

        i++;

      } else {

        insideQuotes =
          !insideQuotes;

      }

      continue;

    }


    if (
      character === "," &&
      !insideQuotes
    ) {

      row.push(value);

      value = "";

      continue;

    }


    if (
      (
        character === "\n" ||
        character === "\r"
      ) &&
      !insideQuotes
    ) {

      if (
        character === "\r" &&
        nextCharacter === "\n"
      ) {

        i++;

      }


      row.push(value);

      rows.push(row);

      row = [];

      value = "";

      continue;

    }


    value += character;

  }


  if (
    value !== "" ||
    row.length > 0
  ) {

    row.push(value);

    rows.push(row);

  }


  return rows;

}


/* =========================================================
   HEADER NORMALIZATION
   ========================================================= */

function normalizeHeader(value) {

  return String(
    value || ""
  )

    .replace(
      /^\uFEFF/,
      ""
    )

    .replace(
      /\s+/g,
      " "
    )

    .trim()

    .toLowerCase();

}


/* =========================================================
   DEPARTMENT TEXT NORMALIZATION
   ========================================================= */

function normalizeDepartmentText(value) {

  return String(
    value || ""
  )

    .replace(
      /&/g,
      "and"
    )

    .toUpperCase()

    .replace(
      /[^A-Z0-9]/g,
      ""
    );

}


/* =========================================================
   GET VALUE
   ========================================================= */

function getValue(
  data,
  possibleKeys
) {

  for (
    let i = 0;
    i < possibleKeys.length;
    i++
  ) {

    const key =
      normalizeHeader(
        possibleKeys[i]
      );


    if (
      Object.prototype.hasOwnProperty.call(
        data,
        key
      )
    ) {

      return String(
        data[key] || ""
      ).trim();

    }

  }


  return "";

}


/* =========================================================
   DEPARTMENT NORMALIZATION
   ========================================================= */

function normalizeDepartment(value) {

  const original =
    String(
      value || ""
    ).trim();


  if (!original) {

    return "";

  }


  const text =
    normalizeDepartmentText(
      original
    );


  for (
    let i = 0;
    i < DEPARTMENTS.length;
    i++
  ) {

    const department =
      DEPARTMENTS[i];


    const code =
      normalizeDepartmentText(
        department.code
      );


    const name =
      normalizeDepartmentText(
        department.name
      );


    if (
      text === code
    ) {

      return department.code;

    }


    if (
      text === name
    ) {

      return department.code;

    }


    if (
      text.includes(code) &&
      text.length >= code.length
    ) {

      return department.code;

    }


    if (
      text.includes(name)
    ) {

      return department.code;

    }

  }


  if (
    text.includes("HREDRD") ||
    text.includes("HREDR") ||
    text.includes(
      "HOUSINGANDREALESTATEDEVELOPMENTREGULATION"
    )
  ) {

    return "HREDRD";

  }


  if (
    text.includes("PHSD") ||
    text.includes(
      "PUBLICHOUSINGANDSETTLEMENTS"
    )
  ) {

    return "PHSD";

  }


  if (
    text.includes("AFD") ||
    text.includes(
      "ADMINISTRATIVEANDFINANCE"
    )
  ) {

    return "AFD";

  }


  if (
    text.includes("HOACDD") ||
    text.includes(
      "HOMEOWNERSASSOCIATIONANDCOMMUNITYDEVELOPMENT"
    )
  ) {

    return "HOACDD";

  }


  if (
    text.includes("ELUPDD") ||
    text.includes(
      "ENVIRONMENTALLANDUSEANDURBANPLANNINGANDDEVELOPMENT"
    )
  ) {

    return "ELUPDD";

  }


  if (
    text === "ORD" ||
    text.includes(
      "OFFICEOFTHEREGIONALDIRECTOR"
    )
  ) {

    return "ORD";

  }


  return "";

}


/* =========================================================
   GET DEPARTMENT
   ========================================================= */

function getDepartment(
  doc
) {

  if (!doc) {

    return "";

  }


  const departmentValue =
    doc.department ||
    doc.to ||
    doc.destinationDepartment ||
    "";


  return normalizeDepartment(
    departmentValue
  );

}


/* =========================================================
   CREATE DOCUMENT KEY
   ========================================================= */

function createDocumentKey(
  doc
) {

  if (
    doc.source ===
    "google-sheet" &&
    doc.id
  ) {

    return String(
      doc.id
    );

  }


  if (
    doc.id
  ) {

    return String(
      doc.id
    );

  }


  const routing =
    doc.routingSlipNo ||
    "";

  const subject =
    doc.subject ||
    "";

  const received =
    doc.dateReceived ||
    "";

  const department =
    getDepartment(
      doc
    );


  return [

    routing,

    subject,

    received,

    department

  ]

    .join("|")

    .toLowerCase();

}


/* =========================================================
   STATUS NORMALIZATION
   ========================================================= */

function normalizeStatus(
  value
) {

  const status =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();


  if (!status) {

    return "Pending";

  }


  if (
    status.includes("complete") ||
    status.includes("done") ||
    status.includes("closed")
  ) {

    return "Completed";

  }


  if (
    status.includes("process") ||
    status.includes("ongoing") ||
    status.includes("working")
  ) {

    return "Processing";

  }


  if (
    status.includes("pending") ||
    status.includes("wait")
  ) {

    return "Pending";

  }


  return "Pending";

}


/* =========================================================
   GET DEPARTMENT DOCUMENTS
   ========================================================= */

function getDepartmentDocuments(
  departmentCode
) {

  return allDocuments.filter(
    function (doc) {

      return (
        getDepartment(
          doc
        ) === departmentCode
      );

    }
  );

}


/* =========================================================
   CALCULATE STATISTICS
   ========================================================= */

function calculateStatistics(
  documents
) {

  const result = {

    total:
      documents.length,

    pending:
      0,

    processing:
      0,

    completed:
      0

  };


  documents.forEach(
    function (doc) {

      const status =
        normalizeStatus(
          doc.status
        );


      if (
        status ===
        "Pending"
      ) {

        result.pending++;

      }


      else if (
        status ===
        "Processing"
      ) {

        result.processing++;

      }


      else if (
        status ===
        "Completed"
      ) {

        result.completed++;

      }

    }
  );


  return result;

}


/* =========================================================
   RENDER OVERALL STATISTICS
   ========================================================= */

function renderStatistics() {

  const statistics =
    calculateStatistics(
      allDocuments
    );


  const total =
    document.getElementById(
      "totalOutgoing"
    );


  const pending =
    document.getElementById(
      "pendingOutgoing"
    );


  const processing =
    document.getElementById(
      "processingOutgoing"
    );


  const completed =
    document.getElementById(
      "completedOutgoing"
    );


  if (total) {

    total.textContent =
      statistics.total
        .toLocaleString();

  }


  if (pending) {

    pending.textContent =
      statistics.pending
        .toLocaleString();

  }


  if (processing) {

    processing.textContent =
      statistics.processing
        .toLocaleString();

  }


  if (completed) {

    completed.textContent =
      statistics.completed
        .toLocaleString();

  }

}


/* =========================================================
   RENDER DEPARTMENT CARDS
   ========================================================= */

function renderDepartments() {

  const grid =
    document.getElementById(
      "departmentGrid"
    );


  if (!grid) {

    return;

  }


  const searchInput =
    document.getElementById(
      "outgoingSearch"
    );


  const searchTerm =
    searchInput
      ? searchInput.value
          .trim()
          .toLowerCase()
      : "";


  grid.innerHTML = "";


  DEPARTMENTS.forEach(
    function (department) {

      const departmentDocuments =
        getDepartmentDocuments(
          department.code
        );


      const statistics =
        calculateStatistics(
          departmentDocuments
        );


      const departmentMatches =
        !searchTerm ||
        department.code
          .toLowerCase()
          .includes(searchTerm) ||
        department.name
          .toLowerCase()
          .includes(searchTerm);


      const documentMatches =
        !searchTerm ||
        departmentDocuments.some(
          function (doc) {

            return documentMatchesSearch(
              doc,
              searchTerm
            );

          }
        );


      if (
        !departmentMatches &&
        !documentMatches
      ) {

        return;

      }


      const card =
        document.createElement(
          "div"
        );


      card.className =
        "department-card";


      card.style.borderLeftColor =
        department.color;


      card.innerHTML = `

        <div class="department-header">

          <div
            class="department-icon"
            style="
              background:${department.color}12;
              color:${department.color};
            "
          >

            <i
              class="fa-solid ${department.icon}"
            ></i>

          </div>


          <div class="department-name">

            <h3>
              ${escapeHtml(
                department.code
              )}
            </h3>

            <p>
              ${escapeHtml(
                department.name
              )}
            </p>

          </div>

        </div>


        <div class="department-total">

          <span
            class="department-total-label"
          >
            Total Files
          </span>

          <strong
            class="department-total-number"
          >
            ${statistics.total.toLocaleString()}
          </strong>

        </div>


        <div class="department-status">

          <div class="status-count">

            <span>
              Pending
            </span>

            <strong>
              ${statistics.pending.toLocaleString()}
            </strong>

          </div>


          <div class="status-count">

            <span>
              Processing
            </span>

            <strong>
              ${statistics.processing.toLocaleString()}
            </strong>

          </div>


          <div class="status-count">

            <span>
              Completed
            </span>

            <strong>
              ${statistics.completed.toLocaleString()}
            </strong>

          </div>

        </div>


        <button
          type="button"
          class="view-department-btn"
        >

          <i
            class="fa-solid fa-folder-open"
          ></i>

          View
          ${escapeHtml(
            department.code
          )}
          Documents

        </button>

      `;


      const button =
        card.querySelector(
          ".view-department-btn"
        );


      if (button) {

        button.addEventListener(
          "click",
          function () {

            openDepartment(
              department.code
            );

          }
        );

      }


      grid.appendChild(
        card
      );

    }
  );


  if (
    !grid.children.length
  ) {

    grid.innerHTML = `

      <div
        style="
          grid-column:1 / -1;
          background:#ffffff;
          border:1px solid #e2e8f0;
          border-radius:12px;
          padding:40px;
          text-align:center;
          color:#9ca3af;
        "
      >

        <i
          class="fa-solid fa-folder-open"
          style="
            font-size:30px;
            margin-bottom:10px;
          "
        ></i>

        <div>
          No departments or documents found.
        </div>

      </div>

    `;

  }

}


/* =========================================================
   SEARCH DOCUMENT
   ========================================================= */

function documentMatchesSearch(
  doc,
  searchTerm
) {

  const values = [

    doc.routingSlipNo,

    doc.dateOfDocument,

    doc.dateReceived,

    doc.sender,

    doc.signatory,

    doc.subject,

    doc.from,

    doc.to,

    doc.actionNo,

    doc.comments,

    doc.receivedBy,

    doc.email,

    doc.deadline,

    doc.status,

    doc.dateCompleted

  ];


  return values.some(
    function (value) {

      return String(
        value || ""
      )
        .toLowerCase()
        .includes(
          searchTerm
        );

    }
  );

}


/* =========================================================
   OPEN DEPARTMENT
   ========================================================= */

function openDepartment(
  departmentCode
) {

  selectedDepartment =
    departmentCode;


  departmentSearchTerm =
    "";


  const searchInput =
    document.getElementById(
      "departmentDocumentsSearch"
    );


  if (searchInput) {

    searchInput.value = "";

  }


  const departmentsView =
    document.getElementById(
      "departmentsView"
    );


  const departmentDocuments =
    document.getElementById(
      "departmentDocuments"
    );


  if (departmentsView) {

    departmentsView.classList.add(
      "hidden"
    );

  }


  if (departmentDocuments) {

    departmentDocuments.classList.remove(
      "hidden"
    );

  }


  renderDepartmentDocuments(
    departmentCode
  );


  window.scrollTo({

    top: 0,

    behavior: "smooth"

  });

}


/* =========================================================
   CLOSE DEPARTMENT
   ========================================================= */

function closeDepartmentDocuments() {

  selectedDepartment =
    null;


  const departmentsView =
    document.getElementById(
      "departmentsView"
    );


  const departmentDocuments =
    document.getElementById(
      "departmentDocuments"
    );


  if (departmentDocuments) {

    departmentDocuments.classList.add(
      "hidden"
    );

  }


  if (departmentsView) {

    departmentsView.classList.remove(
      "hidden"
    );

  }


  const searchInput =
    document.getElementById(
      "outgoingSearch"
    );


  if (searchInput) {

    searchInput.value = "";

  }


  departmentSearchTerm =
    "";


  renderStatistics();

  renderDepartments();


  window.scrollTo({

    top: 0,

    behavior: "smooth"

  });

}


/* =========================================================
   RENDER DEPARTMENT DOCUMENTS
   ========================================================= */

function renderDepartmentDocuments(
  departmentCode
) {

  const department =
    DEPARTMENTS.find(
      function (item) {

        return (
          item.code ===
          departmentCode
        );

      }
    );


  if (!department) {

    return;

  }


  const title =
    document.getElementById(
      "departmentDocumentsTitle"
    );


  const subtitle =
    document.getElementById(
      "departmentDocumentsSubtitle"
    );


  const body =
    document.getElementById(
      "departmentDocumentsBody"
    );


  if (!body) {

    return;

  }


  const allDepartmentDocuments =
    getDepartmentDocuments(
      departmentCode
    );


  if (title) {

    title.textContent =
      department.code +
      " Documents";

  }


  if (subtitle) {

    subtitle.textContent =
      department.name +
      " — " +
      allDepartmentDocuments.length
        .toLocaleString() +
      " total files";

  }


  let departmentDocumentList =
    [...allDepartmentDocuments];


  if (departmentSearchTerm) {

    departmentDocumentList =
      departmentDocumentList.filter(
        function (doc) {

          return documentMatchesSearch(
            doc,
            departmentSearchTerm
          );

        }
      );

  }


  departmentDocumentList.sort(
    function (a, b) {

      const dateA =
        parseDateForSort(
          a.dateReceived ||
          a.dateOfDocument
        );


      const dateB =
        parseDateForSort(
          b.dateReceived ||
          b.dateOfDocument
        );


      return dateB - dateA;

    }
  );


  TablePagination.render(body, departmentDocumentList, function (doc) {
    const row = document.createElement("tr");
    OUTGOING_SPREADSHEET_COLUMNS.forEach(([label, key]) => {
      const cell = document.createElement("td");
      cell.dataset.label = label;
      cell.textContent = doc[key] == null ? "" : String(doc[key]);
      row.appendChild(cell);
    });
    return row;
  });

}


/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDate(
  value
) {

  if (!value) {

    return "—";

  }


  const text =
    String(
      value
    ).trim();


  if (!/\d/.test(text)) {

    return text;

  }


  const date =
    new Date(
      text
    );


  if (
    !Number.isNaN(
      date.getTime()
    )
  ) {

    return date.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "2-digit",
        year: "numeric"
      }
    );

  }


  return text;

}


/* =========================================================
   DATE SORT
   ========================================================= */

function parseDateForSort(
  value
) {

  if (!value) {

    return 0;

  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return 0;

  }


  return date.getTime();

}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(
  value
) {

  return String(
    value ?? ""
  )

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );

}


/* =========================================================
   LOADING
   ========================================================= */

function showLoading(
  show
) {

  const loading =
    document.getElementById(
      "loadingMessage"
    );


  if (!loading) {

    return;

  }


  if (show) {

    loading.classList.remove(
      "hidden"
    );

  } else {

    loading.classList.add(
      "hidden"
    );

  }

}


/* =========================================================
   BACK TO DOCUMENTS MONITORING
   ========================================================= */

function goToDocumentsMonitoring() {

  window.location.href =
    "documents.html";

}