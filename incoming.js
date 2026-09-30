<<<<<<< HEAD
/* ==========================================================
   DHSUD-CAR RECORDS SHELTER
   Incoming Documents Module
   Version 1.0
========================================================== */

/* ==========================================================
   CONFIGURATION
========================================================== */

const SHEET_NAME = "Incoming Documents";
const MODULE_NAME = "incoming";

requireLogin();

/* ==========================================================
   GLOBAL VARIABLES
========================================================== */

let documents = [];
let editingIndex = -1;

/* ==========================================================
   DOM ELEMENTS
========================================================== */

// Table
const tbody = document.getElementById("recordsBody");

// Form
const form = document.getElementById("documentForm");

// Modals
const modal = document.getElementById("documentModal");
const viewModal = document.getElementById("viewModal");

// Buttons
const openModalBtn = document.getElementById("openModal");
const closeModalBtn = document.querySelector(".close");
const cancelModalBtn = document.getElementById("closeModal");
const exportBtn = document.getElementById("exportExcel");

// Filters
const searchInput = document.getElementById("searchInput");
const officeFilter = document.getElementById("officeFilter");
const yearFilter = document.getElementById("yearFilter");
const statusFilter = document.getElementById("statusFilter");
/* ==========================================================
   HELPER FUNCTIONS
========================================================== */

function formatDate(dateString){

    if(!dateString) return "-";

    return new Date(dateString).toLocaleDateString("en-US",{
        year:"numeric",
        month:"long",
        day:"numeric"
    });

}

function generateTrackingNumber(){

    const year = new Date().getFullYear();

    return `DHSUD-${year}-${String(documents.length + 1).padStart(4,"0")}`;

}

/* ==========================================================
   LOAD DOCUMENTS
========================================================== */

async function loadDocuments(){
    const result = await authedGet({
        action: "getDocuments",
        module: MODULE_NAME,
        sheet: SHEET_NAME,
        office: getRequestOffice()
    });

    if (!Array.isArray(result)) {
        documents = [];
        console.error(result && result.error ? result.error : "Unexpected API response", result);
        renderTable();
        return;
    }

    documents = result.map(record => normalizeRecordFields(record, MODULE_NAME));

    console.log(documents);

    renderTable();

    populateFilters();

    updateDashboard();

}



/* ==========================================================
   RENDER TABLE
========================================================== */

function renderTable(data = documents) {

    tbody.innerHTML = "";

    if (!data || data.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center;padding:30px;">
                    No records found.
                </td>
            </tr>
        `;

        return;
    }

    data.forEach((doc, index) => {

        const row = document.createElement("tr");

        row.innerHTML = `

            <td>${doc.tracking || "-"}</td>

            <td>${formatDate(doc.dateReceived)}</td>

            <td>${doc.sender || "-"}</td>

            <td>${doc.office || "-"}</td>

            <td>${doc.category || "-"}</td>

            <td>${doc.subject || "-"}</td>

            <td>${doc.division || "-"}</td>

            <td>${doc.ageing || "-"}</td>

            <td>
    <span class="status-badge ${String(doc.status || "").toLowerCase()}">
        ${doc.status || "-"}
    </span>
</td>

           <td class="action-buttons">

    <button class="icon-btn view-btn" onclick="viewDocument(${index})" title="View">
        <i class="fa-solid fa-eye"></i>
    </button>

    <button class="icon-btn edit-btn" onclick="editDocument(${index})" title="Edit">
        <i class="fa-solid fa-pen"></i>
    </button>

    <button class="icon-btn delete-btn" onclick="deleteDocument(${index})" title="Delete">
        <i class="fa-solid fa-trash"></i>
    </button>

</td>

        `;

        tbody.appendChild(row);

    });

}

/* ==========================================================
   DASHBOARD
========================================================== */

function updateDashboard() {

    const total = documents.length;

    const processing = documents.filter(d => d.status === "Processing").length;

    const completed = documents.filter(d => d.status === "Completed").length;

    const pending = documents.filter(d => d.status === "Pending").length;

    const totalEl = document.getElementById("totalDocuments");
    const processingEl = document.getElementById("processingDocuments");
    const completedEl = document.getElementById("completedDocuments");
    const pendingEl = document.getElementById("pendingDocuments");

    if (totalEl) totalEl.textContent = total;
    if (processingEl) processingEl.textContent = processing;
    if (completedEl) completedEl.textContent = completed;
    if (pendingEl) pendingEl.textContent = pending;

}

/* ==========================================================
   SEARCH & FILTERS
========================================================== */

function filterDocuments() {

    const keyword = searchInput.value.toLowerCase();

    const office = officeFilter.value;

    const year = yearFilter.value;

    const status = statusFilter.value;

    const filtered = documents.filter(doc => {

        const searchMatch =

            (doc.tracking || "").toLowerCase().includes(keyword) ||

            (doc.sender || "").toLowerCase().includes(keyword) ||

            (doc.category || "").toLowerCase().includes(keyword) ||

            (doc.subject || "").toLowerCase().includes(keyword) ||

            (doc.division || "").toLowerCase().includes(keyword);

        const officeMatch =

            office === "All Offices" ||

            doc.office === office;

        const yearMatch =

            year === "All Years" ||

            new Date(doc.dateReceived).getFullYear().toString() === year;

        const statusMatch =

            status === "All Status" ||

            doc.status === status;

        return searchMatch &&
               officeMatch &&
               yearMatch &&
               statusMatch;

    });

    renderTable(filtered);

}

/* ==========================================================
   MODAL FUNCTIONS
========================================================== */

function openModal() {

    modal.style.display = "flex";

}

function closeModal() {

    modal.style.display = "none";

    form.reset();

    editingIndex = -1;

    document.querySelector(".save-btn").innerHTML =
        '<i class="fa-solid fa-floppy-disk"></i> Save Document';

}
/* ==========================================================
   MODAL EVENTS
========================================================== */

if(openModalBtn){

    openModalBtn.addEventListener("click",openModal);

}

if(closeModalBtn){

    closeModalBtn.addEventListener("click",closeModal);

}

if(cancelModalBtn){

    cancelModalBtn.addEventListener("click",closeModal);

}

window.addEventListener("click",function(e){

    if(e.target===modal){

        closeModal();
=======
/* ==================================================
   DHSUD-CAR INCOMING DOCUMENTS
================================================== */

const STORAGE_KEY = "dhsudCARIncomingDocuments";

let incomingDocuments = [];

let editingDocumentId = null;


/* ==================================================
   LOAD DATA
================================================== */

document.addEventListener("DOMContentLoaded", function () {

    loadIncomingDocuments();

    renderMasterlist();

    const search = document.getElementById("masterlistSearch");

    if (search) {

        search.addEventListener("input", function () {

            renderMasterlist(this.value);

        });

    }

    const form = document.getElementById("incomingForm");

    if (form) {

        form.addEventListener("submit", saveDocument);
>>>>>>> 8bc4fdc795ce57389f57fd985c7ac49cd63b3fb5

    }

});

<<<<<<< HEAD
/* ==========================================================
   SAVE DOCUMENT
========================================================== */

async function saveDocument(doc){

    const formData = new FormData();

    formData.append("action","save");
    formData.append("module", MODULE_NAME);
    formData.append("sheet",SHEET_NAME);
    formData.append("office", getRequestOffice());

    formData.append("tracking",doc.tracking);
    formData.append("dateReceived",doc.dateReceived);
    formData.append("sender",doc.sender);
    formData.append("originatingOffice",doc.office);
    formData.append("category",doc.category);
    formData.append("subject",doc.subject);
    formData.append("division",doc.division);
    formData.append("status",doc.status);
    formData.append("remarks",doc.remarks);
    formData.append("fileName",doc.attachmentName || "");
    formData.append("driveUrl","");

    const result = await authedPost(formData);
    if (!result || result.error) {
        alert(result ? result.error : "Save failed");
        return;
    }

    await loadDocuments();

}

/* ==========================================================
   UPDATE DOCUMENT
========================================================== */

async function updateDocument(doc){

    const formData = new FormData();

    formData.append("action","update");
    formData.append("module", MODULE_NAME);
    formData.append("sheet",SHEET_NAME);
    formData.append("office", getRequestOffice());
    formData.append("idField", "tracking");
    formData.append("idValue", doc.tracking);

    formData.append("tracking",doc.tracking);
    formData.append("dateReceived",doc.dateReceived);
    formData.append("sender",doc.sender);
    formData.append("originatingOffice",doc.office);
    formData.append("category",doc.category);
    formData.append("subject",doc.subject);
    formData.append("division",doc.division);
    formData.append("status",doc.status);
    formData.append("remarks",doc.remarks);
    formData.append("fileName",doc.attachmentName || "");
    formData.append("driveUrl","");

    const result = await authedPost(formData);
    if (!result || result.error) {
        alert(result ? result.error : "Update failed");
        return;
    }

    editingIndex = -1;

    await loadDocuments();

}


/* ==========================================================
   DELETE DOCUMENT
========================================================== */

async function deleteDocument(index){

    const doc = documents[index];

    if (!confirm(`Delete ${doc.tracking}?`)) return;

    const formData = new FormData();

    formData.append("action", "delete");
    formData.append("module", MODULE_NAME);
    formData.append("sheet", SHEET_NAME);
    formData.append("office", doc.office);
    formData.append("idField", "tracking");
    formData.append("idValue", doc.tracking);

    const result = await authedPost(formData);
    if (!result || result.error) {
        alert(result ? result.error : "Delete failed");
        return;
    }

    await loadDocuments();

}

/* ==========================================================
   SEARCH DOCUMENTS
========================================================== */

function filterDocuments() {

    const search = searchInput.value.toLowerCase().trim();

    const office = officeFilter.value;
    const year = yearFilter.value;
    const status = statusFilter.value;

    const filtered = documents.filter(doc => {

        const matchesSearch =

            !search ||

            String(doc.tracking).toLowerCase().includes(search) ||
            String(doc.sender).toLowerCase().includes(search) ||
            String(doc.office).toLowerCase().includes(search) ||
            String(doc.category).toLowerCase().includes(search) ||
            String(doc.subject).toLowerCase().includes(search) ||
            String(doc.division).toLowerCase().includes(search) ||
            String(doc.status).toLowerCase().includes(search) ||
            String(doc.remarks).toLowerCase().includes(search);

        const matchesOffice =
            !office || doc.office === office;

        const matchesStatus =
            !status || doc.status === status;

        let matchesYear = true;

        if(year){

            matchesYear =
                new Date(doc.dateReceived).getFullYear().toString() === year;

        }

        return (
            matchesSearch &&
            matchesOffice &&
            matchesStatus &&
            matchesYear
        );

    });

    renderTable(filtered);

}

/* ==========================================================
   POPULATE FILTERS
========================================================== */

function populateFilters() {

    // Office Filter
    const offices = [...new Set(
        documents
            .map(doc => doc.office)
            .filter(Boolean)
    )].sort();

    officeFilter.innerHTML =
        `<option value="">All Offices</option>`;

    offices.forEach(office => {

        officeFilter.innerHTML +=
            `<option value="${office}">${office}</option>`;

    });

    // Year Filter
    const years = [...new Set(
        documents
            .map(doc => new Date(doc.dateReceived).getFullYear())
            .filter(Boolean)
    )].sort((a, b) => b - a);

    yearFilter.innerHTML =
        `<option value="">All Years</option>`;

    years.forEach(year => {

        yearFilter.innerHTML +=
            `<option value="${year}">${year}</option>`;

    });

}

/* ==========================================================
   FORM SUBMIT
========================================================== */

form.addEventListener("submit", async function(e){

    e.preventDefault();

    const file = document.getElementById("documentFile").files[0];

    const doc = {

        tracking:
            editingIndex === -1
            ? generateTrackingNumber()
            : documents[editingIndex].tracking,

        dateReceived: document.getElementById("dateReceived").value,

        sender: document.getElementById("sender").value,

        office: document.getElementById("office").value,

        category: document.getElementById("category").value,

        subject: document.getElementById("subject").value,

        division: document.getElementById("division").value,

        status: document.getElementById("status").value,

        remarks: document.getElementById("remarks").value,

        attachmentName: file ? file.name : "",

        ageing: "1 DAY OF 3 DAYS"

    };

    if(editingIndex === -1){

        await saveDocument(doc);

    }else{

        await updateDocument(doc);

    }

    closeModal();

    loadDocuments();

});

/* ==========================================================
   VIEW DOCUMENT
========================================================== */

function viewDocument(index){

    const doc = documents[index];

    document.getElementById("viewTracking").textContent =
    doc.tracking;

    document.getElementById("viewDate").textContent =
    formatDate(doc.dateReceived);

    document.getElementById("viewSender").textContent =
    doc.sender;

    document.getElementById("viewOffice").textContent =
    doc.office;

    document.getElementById("viewCategory").textContent =
    doc.category;

    document.getElementById("viewSubject").textContent =
    doc.subject;

    document.getElementById("viewDivision").textContent =
    doc.division;

    document.getElementById("viewStatus").textContent =
    doc.status;

    document.getElementById("viewAgeing").textContent =
    doc.ageing;

    document.getElementById("viewRemarks").textContent =
    doc.remarks || "-";

    viewModal.style.display = "flex";

}

/* ==========================================================
   EDIT DOCUMENT
========================================================== */

function editDocument(index){

    editingIndex = index;

    const doc = documents[index];

    document.getElementById("dateReceived").value = doc.dateReceived
        ? doc.dateReceived.split("T")[0]
        : "";

    document.getElementById("sender").value = doc.sender || "";

    document.getElementById("office").value = doc.office || "";

    document.getElementById("category").value = doc.category || "";

    document.getElementById("subject").value = doc.subject || "";

    document.getElementById("division").value = doc.division || "";

    document.getElementById("status").value = doc.status || "";

    document.getElementById("remarks").value = doc.remarks || "";

    modal.style.display = "flex";
=======

/* ==================================================
   LOAD FROM LOCAL STORAGE
================================================== */

function loadIncomingDocuments() {

    const saved =
        localStorage.getItem(STORAGE_KEY);

    if (saved) {

        try {

            incomingDocuments = JSON.parse(saved);

        } catch (error) {

            incomingDocuments = [];

        }

    } else {

        incomingDocuments = [];

    }

}


/* ==================================================
   SAVE TO LOCAL STORAGE
================================================== */

function saveIncomingDocuments() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(incomingDocuments)
    );
>>>>>>> 8bc4fdc795ce57389f57fd985c7ac49cd63b3fb5

}


<<<<<<< HEAD
/* ==========================================================
   EXPORT TO EXCEL
========================================================== */

if(exportBtn){

    exportBtn.addEventListener("click", function(){

        if(documents.length === 0){

            alert("No documents to export.");
=======
/* ==================================================
   ADD / EDIT DOCUMENT
================================================== */

function saveDocument(event) {

    event.preventDefault();


    /* ==================================================
       GET FORM VALUES
    ================================================== */

    const documentData = {

        routingSlip:
            document.getElementById("routingSlip").value.trim(),

        dateDocument:
            document.getElementById("dateDocument").value,

        dateReceived:
            document.getElementById("dateReceived").value,

        sender:
            document.getElementById("sender").value.trim(),

        signatory:
            document.getElementById("signatory").value.trim(),

        mode:
            document.getElementById("mode").value,

        subject:
            document.getElementById("subject").value.trim(),

        from:
            document.getElementById("from").value.trim(),

        actionNo:
            document.getElementById("actionNo").value.trim(),

        receivedBy:
            document.getElementById("receivedBy").value.trim(),

        email:
            document.getElementById("email").value.trim(),

        deadline:
            document.getElementById("deadline").value,

        status:
            document.getElementById("status").value,

        comments:
            document.getElementById("comments").value.trim()

    };


    /* ==================================================
       EDIT EXISTING DOCUMENT
    ================================================== */

    if (editingDocumentId) {

        const documentIndex =
            incomingDocuments.findIndex(
                function (doc) {

                    return doc.id === editingDocumentId;

                }
            );


        if (documentIndex === -1) {

            alert("Document could not be found.");
>>>>>>> 8bc4fdc795ce57389f57fd985c7ac49cd63b3fb5

            return;

        }

<<<<<<< HEAD
        const exportData = documents.map(doc => ({

            "Tracking No.": doc.tracking,

            "Date Received": formatDate(doc.dateReceived),

            "Sender": doc.sender,

            "Office": doc.office,

            "Category": doc.category,

            "Subject": doc.subject,

            "Division": doc.division,

            "Status": doc.status,

            "Remarks": doc.remarks

        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);

        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(workbook, worksheet, "Incoming Documents");

        XLSX.writeFile(workbook,"Incoming_Documents.xlsx");

    });

}

/* ==========================================================
   FILTER EVENTS
========================================================== */

if(searchInput){

    searchInput.addEventListener("keyup",filterDocuments);

}

if(officeFilter){

    officeFilter.addEventListener("change",filterDocuments);

}

if(yearFilter){

    yearFilter.addEventListener("change",filterDocuments);

}

if(statusFilter){

    statusFilter.addEventListener("change",filterDocuments);

}

/* ==========================================================
   VIEW MODAL
========================================================== */

document.getElementById("closeView").onclick=function(){

    viewModal.style.display="none";

};

document.getElementById("closeViewBtn").onclick=function(){

    viewModal.style.display="none";

};

window.addEventListener("click",function(e){

    if(e.target===viewModal){

        viewModal.style.display="none";
=======

        /*
         * Keep the existing ID and routing information.
         */

        incomingDocuments[documentIndex] = {

            ...incomingDocuments[documentIndex],

            ...documentData

        };


        saveIncomingDocuments();

        renderMasterlist(
            document.getElementById("masterlistSearch").value
        );


        closeIncomingModal();


        alert(
            "Incoming document updated successfully."
        );


        return;

    }


    /* ==================================================
       ADD NEW DOCUMENT
    ================================================== */

    const newDocument = {

        id:
            Date.now().toString(),

        ...documentData,

        routeTo: "",

        dateAdded:
            new Date().toISOString()

    };


    incomingDocuments.unshift(newDocument);

    saveIncomingDocuments();

    renderMasterlist();

    event.target.reset();

    closeIncomingModal();


    alert(
        "Incoming document added successfully."
    );

}


/* ==================================================
   RENDER MASTERLIST
================================================== */

function renderMasterlist(searchTerm = "") {

    const body =
        document.getElementById("masterlistBody");

    const count =
        document.getElementById("masterlistCount");


    if (!body) return;


    const search =
        searchTerm.toLowerCase().trim();


    const filtered =
        incomingDocuments.filter(function (doc) {

            return (

                String(doc.routingSlip || "")
                    .toLowerCase()
                    .includes(search)

                ||

                String(doc.sender || "")
                    .toLowerCase()
                    .includes(search)

                ||

                String(doc.subject || "")
                    .toLowerCase()
                    .includes(search)

                ||

                String(doc.status || "")
                    .toLowerCase()
                    .includes(search)

                ||

                String(doc.routeTo || "")
                    .toLowerCase()
                    .includes(search)

            );

        });


    count.textContent =
        filtered.length +
        (
            filtered.length === 1
                ? " Document"
                : " Documents"
        );


    if (filtered.length === 0) {

        body.innerHTML = `

            <tr>

                <td colspan="8"
                    class="empty-masterlist">

                    <i class="fa-solid fa-inbox"></i>

                    <strong>
                        No incoming documents found
                    </strong>

                    <span>
                        Click "Add Incoming Document"
                        to add a new document.
                    </span>

                </td>

            </tr>

        `;

        return;

    }


    body.innerHTML =
        filtered.map(function (doc) {

            return `

                <tr>

                    <td>

                        <strong>
                            ${escapeHTML(doc.routingSlip)}
                        </strong>

                    </td>


                    <td>
                        ${formatDate(doc.dateReceived)}
                    </td>


                    <td>
                        ${escapeHTML(doc.sender)}
                    </td>


                    <td>
                        ${escapeHTML(doc.subject)}
                    </td>


                    <td>
                        ${escapeHTML(doc.mode)}
                    </td>


                    <td>
                        ${escapeHTML(doc.status)}
                    </td>


                    <!-- ROUTE TO -->

                    <td>

                        <select
                            class="route-select"
                            onchange="routeDocument('${doc.id}', this.value)"
                        >

                            <option value="">
                                Select Department
                            </option>

                            <option value="HREDRD"
                                ${doc.routeTo === "HREDRD" ? "selected" : ""}>
                                HREDRD
                            </option>

                            <option value="HOACDD"
                                ${doc.routeTo === "HOACDD" ? "selected" : ""}>
                                HOACDD
                            </option>

                            <option value="ELUPDD"
                                ${doc.routeTo === "ELUPDD" ? "selected" : ""}>
                                ELUPDD
                            </option>

                            <option value="PHSD"
                                ${doc.routeTo === "PHSD" ? "selected" : ""}>
                                PHSD
                            </option>

                            <option value="AFD"
                                ${doc.routeTo === "AFD" ? "selected" : ""}>
                                AFD
                            </option>

                            <option value="ORD"
                                ${doc.routeTo === "ORD" ? "selected" : ""}>
                                ORD
                            </option>

                        </select>

                    </td>


                    <!-- EDIT -->

                    <td>

                        <div class="action-buttons">

                            <button
                                type="button"
                                class="edit-btn"
                                onclick="editIncomingDocument('${doc.id}')"
                            >

                                <i class="fa-solid fa-pen"></i>

                                Edit

                            </button>

                        </div>

                    </td>

                </tr>

            `;

        }).join("");

}


/* ==================================================
   EDIT DOCUMENT
================================================== */

function editIncomingDocument(documentId) {

    const doc =
        incomingDocuments.find(
            function (item) {

                return item.id === documentId;

            }
        );


    if (!doc) {

        alert("Document could not be found.");

        return;

    }


    /* ==================================================
       STORE EDITING ID
    ================================================== */

    editingDocumentId = documentId;


    /* ==================================================
       FILL FORM
    ================================================== */

    document.getElementById("routingSlip").value =
        doc.routingSlip || "";


    document.getElementById("dateDocument").value =
        doc.dateDocument || "";


    document.getElementById("dateReceived").value =
        doc.dateReceived || "";


    document.getElementById("sender").value =
        doc.sender || "";


    document.getElementById("signatory").value =
        doc.signatory || "";


    document.getElementById("mode").value =
        doc.mode || "";


    document.getElementById("subject").value =
        doc.subject || "";


    document.getElementById("from").value =
        doc.from || "";


    document.getElementById("actionNo").value =
        doc.actionNo || "";


    document.getElementById("receivedBy").value =
        doc.receivedBy || "";


    document.getElementById("email").value =
        doc.email || "";


    document.getElementById("deadline").value =
        doc.deadline || "";


    document.getElementById("status").value =
        doc.status || "Pending";


    document.getElementById("comments").value =
        doc.comments || "";


    /* ==================================================
       CHANGE MODAL TEXT
    ================================================== */

    document.getElementById("modalTitle").textContent =
        "Edit Incoming Document";


    document.getElementById("modalDescription").textContent =
        "Edit the information of this incoming document.";


    document.getElementById("saveButtonText").textContent =
        "Save Changes";


    /* ==================================================
       OPEN MODAL
    ================================================== */

    document
        .getElementById("incomingModal")
        .classList.add("show");

}


/* ==================================================
   ROUTE DOCUMENT
================================================== */

function routeDocument(documentId, department) {

    const documentIndex =
        incomingDocuments.findIndex(
            function (doc) {

                return doc.id === documentId;

            }
        );


    if (documentIndex === -1) return;


    incomingDocuments[documentIndex].routeTo =
        department;


    saveIncomingDocuments();


    const search =
        document.getElementById("masterlistSearch");


    renderMasterlist(
        search ? search.value : ""
    );


    if (department) {

        alert(
            "Document routed to " +
            getDepartmentName(department) +
            "."
        );

    }

}


/* ==================================================
   DEPARTMENT NAME
================================================== */

function getDepartmentName(code) {

    const names = {

        HREDRD:
            "HREDRD",

        HOACDD:
            "HOACDD",

        ELUPDD:
            "ELUPDD",

        PHSD:
            "PHSD",

        AFD:
            "AFD",

        ORD:
            "ORD"

    };

    return names[code] || code;

}


/* ==================================================
   OPEN ADD MODAL
================================================== */

function openIncomingModal() {

    /*
     * Make sure this is ADD mode.
     */

    editingDocumentId = null;


    document.getElementById("modalTitle").textContent =
        "Add Incoming Document";


    document.getElementById("modalDescription").textContent =
        "Enter the information of the newly received document.";


    document.getElementById("saveButtonText").textContent =
        "Add Document";


    /*
     * Reset form before opening.
     */

    const form =
        document.getElementById("incomingForm");


    if (form) {

        form.reset();

    }


    document
        .getElementById("incomingModal")
        .classList.add("show");

}


/* ==================================================
   CLOSE MODAL
================================================== */

function closeIncomingModal() {

    editingDocumentId = null;


    const form =
        document.getElementById("incomingForm");


    if (form) {

        form.reset();

    }


    document.getElementById("modalTitle").textContent =
        "Add Incoming Document";


    document.getElementById("modalDescription").textContent =
        "Enter the information of the newly received document.";


    document.getElementById("saveButtonText").textContent =
        "Add Document";


    document
        .getElementById("incomingModal")
        .classList.remove("show");

}


/* ==================================================
   CLICK OUTSIDE MODAL
================================================== */

window.addEventListener("click", function (event) {

    const modal =
        document.getElementById("incomingModal");

    if (event.target === modal) {

        closeIncomingModal();
>>>>>>> 8bc4fdc795ce57389f57fd985c7ac49cd63b3fb5

    }

});

<<<<<<< HEAD
/* ==========================================================
   START APPLICATION
========================================================== */

window.addEventListener("DOMContentLoaded", () => {

    loadDocuments();

    searchInput.addEventListener("input", filterDocuments);

    officeFilter.addEventListener("change", filterDocuments);

    yearFilter.addEventListener("change", filterDocuments);

    statusFilter.addEventListener("change", filterDocuments);

});
=======

/* ==================================================
   DATE FORMAT
================================================== */

function formatDate(dateString) {

    if (!dateString) return "";


    const date =
        new Date(dateString + "T00:00:00");


    if (isNaN(date.getTime())) {

        return dateString;

    }


    return date.toLocaleDateString(
        "en-US",
        {
            month: "short",
            day: "2-digit",
            year: "numeric"
        }
    );

}


/* ==================================================
   SECURITY
================================================== */

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;")

        .replace(/'/g, "&#039;");

}
>>>>>>> 8bc4fdc795ce57389f57fd985c7ac49cd63b3fb5
