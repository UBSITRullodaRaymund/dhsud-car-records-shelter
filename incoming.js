/* ==========================================================
   DHSUD-CAR RECORDS SHELTER
   Incoming Documents Module
   Version 1.0
========================================================== */

/* ==========================================================
   CONFIGURATION
========================================================== */

const API_URL =
"https://script.google.com/macros/s/AKfycbxQAh3bOHZc-c1gZpOtpSF4SaQSd8XV-g_OWnbM8h628C9uPPEdsVdEtrw0yabpNSn_3Q/exec";

const SHEET_NAME = "Incoming Documents";

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

    const url =
        `${API_URL}?action=getDocuments&sheet=${encodeURIComponent(SHEET_NAME)}`;

    console.log(url);

    const response = await fetch(url);

    documents = await response.json();

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
    <span class="status-badge ${doc.status.toLowerCase()}">
        ${doc.status}
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

    }

});

/* ==========================================================
   SAVE DOCUMENT
========================================================== */

async function saveDocument(doc){

    const formData = new FormData();

    formData.append("action","save");
    formData.append("sheet",SHEET_NAME);

    formData.append("tracking",doc.tracking);
    formData.append("dateReceived",doc.dateReceived);
    formData.append("sender",doc.sender);
    formData.append("office",doc.office);
    formData.append("category",doc.category);
    formData.append("subject",doc.subject);
    formData.append("division",doc.division);
    formData.append("status",doc.status);
    formData.append("remarks",doc.remarks);
    formData.append("fileName",doc.attachmentName || "");
    formData.append("driveUrl","");

    await fetch(API_URL,{
        method:"POST",
        body:formData
    });

    await loadDocuments();

}

/* ==========================================================
   UPDATE DOCUMENT
========================================================== */

async function updateDocument(doc){

    const formData = new FormData();

    formData.append("action","update");
    formData.append("sheet",SHEET_NAME);

    formData.append("tracking",doc.tracking);
    formData.append("dateReceived",doc.dateReceived);
    formData.append("sender",doc.sender);
    formData.append("office",doc.office);
    formData.append("category",doc.category);
    formData.append("subject",doc.subject);
    formData.append("division",doc.division);
    formData.append("status",doc.status);
    formData.append("remarks",doc.remarks);
    formData.append("fileName",doc.attachmentName || "");
    formData.append("driveUrl","");

    await fetch(API_URL,{
        method:"POST",
        body:formData
    });

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
    formData.append("sheet", SHEET_NAME);
    formData.append("tracking", doc.tracking);

    await fetch(API_URL, {
        method: "POST",
        body: formData
    });

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

}


/* ==========================================================
   EXPORT TO EXCEL
========================================================== */

if(exportBtn){

    exportBtn.addEventListener("click", function(){

        if(documents.length === 0){

            alert("No documents to export.");

            return;

        }

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

    }

});

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
