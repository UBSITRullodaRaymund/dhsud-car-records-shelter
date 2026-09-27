/* =========================================================
   DHSUD-CAR OUTGOING DOCUMENTS
   ========================================================= */


/* =========================================================
   STORAGE
   ========================================================= */

const STORAGE_KEY = "dhsudCarDocuments";


/* =========================================================
   GOOGLE SHEETS CSV
   ========================================================= */

const GOOGLE_SHEET_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vT-5o8Ty361qCFIf39AY81T1xp6MJJaw0FgIR4cinMf-4UwvpSIDf_ew9a2U3gHIPL90OxHscOHE883/pub?gid=0&single=true&output=csv";


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

      loadAllDocuments();

      renderStatistics();

      renderDepartments();

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

    const response =
      await fetch(
        GOOGLE_SHEET_CSV,
        {
          cache: "no-store"
        }
      );


    if (!response.ok) {

      throw new Error(
        "Google Sheet could not be loaded. HTTP " +
        response.status
      );

    }


    const csvText =
      await response.text();


    if (!csvText.trim()) {

      googleSheetDocuments = [];

      return;

    }


    const rows =
      parseCSV(csvText);


    if (
      !rows ||
      rows.length < 2
    ) {

      googleSheetDocuments = [];

      return;

    }


    const headers =
      rows[0].map(
        function (header) {

          return normalizeHeader(
            header
          );

        }
      );


    console.log(
      "Google Sheet headers:",
      headers
    );


    googleSheetDocuments =
      rows
        .slice(1)
        .filter(
          function (row) {

            return row.some(
              function (cell) {

                return String(
                  cell || ""
                ).trim() !== "";

              }
            );

          }
        )
        .map(
          function (row, index) {

            const data = {};


            headers.forEach(
              function (header, i) {

                data[header] =
                  row[i] !== undefined
                    ? row[i]
                    : "";

              }
            );


            const destination =
              getValue(
                data,
                [
                  "to",
                  "department",
                  "destination department"
                ]
              );


            return {

              id:
                "SHEET-" +
                (index + 1),

              source:
                "google-sheet",

              routingSlipNo:
                getValue(
                  data,
                  [
                    "routing slip no",
                    "routing slip number",
                    "routing slip"
                  ]
                ),

              dateOfDocument:
                getValue(
                  data,
                  [
                    "date of document"
                  ]
                ),

              dateReceived:
                getValue(
                  data,
                  [
                    "date received"
                  ]
                ),

              sender:
                getValue(
                  data,
                  [
                    "sender"
                  ]
                ),

              signatory:
                getValue(
                  data,
                  [
                    "signatory"
                  ]
                ),

              modeOfCommunication:
                getValue(
                  data,
                  [
                    "mode of communication"
                  ]
                ),

              subject:
                getValue(
                  data,
                  [
                    "subject"
                  ]
                ),

              dateReleased:
                getValue(
                  data,
                  [
                    "date released"
                  ]
                ),

              from:
                getValue(
                  data,
                  [
                    "from"
                  ]
                ),

              to:
                destination,

              actionNo:
                getValue(
                  data,
                  [
                    "action no.",
                    "action no",
                    "action number"
                  ]
                ),

              comments:
                getValue(
                  data,
                  [
                    "comments/remarks",
                    "comments / remarks",
                    "comments remarks"
                  ]
                ),

              receivedBy:
                getValue(
                  data,
                  [
                    "received by"
                  ]
                ),

              email:
                getValue(
                  data,
                  [
                    "e-mail add",
                    "email add",
                    "e-mail address",
                    "email address"
                  ]
                ),

              deadline:
                getValue(
                  data,
                  [
                    "deadline"
                  ]
                ),

              status:
                getValue(
                  data,
                  [
                    "status"
                  ]
                ),

              reminderSent:
                getValue(
                  data,
                  [
                    "reminder sent"
                  ]
                ),

              dateCompleted:
                getValue(
                  data,
                  [
                    "date completed"
                  ]
                ),

              department:
                normalizeDepartment(
                  destination
                )

            };

          }
        );


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


    googleSheetDocuments = [];

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


  body.innerHTML = "";


  if (!departmentDocumentList.length) {

    body.innerHTML = `

      <tr>

        <td
          colspan="12"
          class="empty-cell"
        >

          No documents found for this department.

        </td>

      </tr>

    `;

    return;

  }


  departmentDocumentList.forEach(
    function (doc) {

      /*
       * IMPORTANT:
       *
       * "document" must refer to the browser DOM.
       * "doc" refers to the individual record.
       */

      const row =
        document.createElement(
          "tr"
        );


      row.innerHTML = `

        <td>
          ${escapeHtml(
            doc.routingSlipNo ||
            "—"
          )}
        </td>


        <td>
          ${escapeHtml(
            formatDate(
              doc.dateOfDocument
            )
          )}
        </td>


        <td>
          ${escapeHtml(
            formatDate(
              doc.dateReceived
            )
          )}
        </td>


        <td>
          ${escapeHtml(
            doc.sender ||
            "—"
          )}
        </td>


        <td>
          ${escapeHtml(
            doc.signatory ||
            "—"
          )}
        </td>


        <td>
          ${escapeHtml(
            doc.subject ||
            "—"
          )}
        </td>


        <td>
          ${escapeHtml(
            doc.from ||
            "—"
          )}
        </td>


        <td>
          ${escapeHtml(
            doc.actionNo ||
            "—"
          )}
        </td>


        <td>
          ${escapeHtml(
            normalizeStatus(
              doc.status
            )
          )}
        </td>


        <td>
          ${escapeHtml(
            formatDate(
              doc.deadline
            )
          )}
        </td>


        <td>
          ${escapeHtml(
            doc.comments ||
            "—"
          )}
        </td>


        <td>
          ${escapeHtml(
            doc.receivedBy ||
            "—"
          )}
        </td>

      `;


      body.appendChild(
        row
      );

    }
  );

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