/* ==========================================================
   DHSUD-CAR RECORDS SHELTER
   Outgoing Documents Module
   Version 1.0
========================================================== */

/* ==========================================================
   CONFIGURATION
========================================================== */

const SHEET_NAME = "Outgoing Documents";
const MODULE_NAME = "outgoing";

requireLogin();

/* ==========================================================
   GLOBAL VARIABLES
========================================================== */

let documents = [];
let editingIndex = -1;
let searchDebounceTimer = null;
const PAGE_SIZE = 12;
const listCache = new Map();
let pageState = { page: 1, totalPages: 1, total: 0, pageSize: PAGE_SIZE };

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

function buildDashboardCounts(records = []) {
    return {
        total: records.length,
        pending: records.filter(d => normalizeStatusValue(d.status) === "PENDING").length,
        processing: records.filter(d => normalizeStatusValue(d.status) === "PROCESSING").length,
        completed: records.filter(d => normalizeStatusValue(d.status) === "COMPLETED").length,
        released: records.filter(d => normalizeStatusValue(d.status) === "RELEASED").length,
        returned: records.filter(d => normalizeStatusValue(d.status) === "RETURNED").length
    };
}

function applyPageResponse(payload) {
    const pageRecords = Array.isArray(payload && payload.records) ? payload.records : [];
    documents = pageRecords.map(record => normalizeRecordFields(record, MODULE_NAME));
    pageState = {
        page: Number(payload && payload.page) || 1,
        totalPages: Number(payload && payload.totalPages) || 1,
        total: Number(payload && payload.total) || documents.length,
        pageSize: Number(payload && payload.pageSize) || PAGE_SIZE
    };

    renderTable(documents);
    updateDashboard(payload && payload.counts ? payload.counts : buildDashboardCounts(documents));
    updatePagination();
}

function updatePagination() {
    const pageButtons = Array.from(document.querySelectorAll(".page-btn"));
    const prevBtn = pageButtons.find(btn => btn.innerHTML.includes("fa-angle-left"));
    const currentBtn = pageButtons.find(btn => !btn.innerHTML.includes("fa-angle-left") && !btn.innerHTML.includes("fa-angle-right"));
    const nextBtn = pageButtons.find(btn => btn.innerHTML.includes("fa-angle-right"));
    if (!prevBtn || !currentBtn || !nextBtn) return;

    currentBtn.textContent = String(pageState.page);
    prevBtn.disabled = pageState.page <= 1;
    nextBtn.disabled = pageState.page >= pageState.totalPages;

    const showingCount = document.getElementById("showingCount");
    const totalCount = document.getElementById("totalCount");
    if (showingCount) showingCount.textContent = String(documents.length || 0);
    if (totalCount) totalCount.textContent = String(pageState.total || 0);
}

async function loadDocuments(page = 1){
    const filters = {
        page,
        pageSize: PAGE_SIZE,
        search: searchInput ? searchInput.value.trim() : "",
        status: statusFilter ? statusFilter.value : "",
        office: officeFilter ? officeFilter.value : "",
        year: yearFilter ? yearFilter.value : ""
    };

    const cacheKey = JSON.stringify({
        office: getRequestOffice(),
        module: MODULE_NAME,
        sheet: SHEET_NAME,
        ...filters
    });

    if (listCache.has(cacheKey)) {
        applyPageResponse(listCache.get(cacheKey));
        return;
    }

    try {
        const result = await authedGet({
            action: "getDocuments",
            module: MODULE_NAME,
            sheet: SHEET_NAME,
            office: getRequestOffice(),
            page: filters.page,
            pageSize: filters.pageSize,
            search: filters.search,
            status: filters.status,
            officeFilter: filters.office,
            year: filters.year
        });

        if (!result || !result.records) {
            if (Array.isArray(result)) {
                const legacyRecords = result.map(record => normalizeRecordFields(record, MODULE_NAME));
                documents = legacyRecords;
                pageState = { page: 1, totalPages: 1, total: legacyRecords.length, pageSize: PAGE_SIZE };
                renderTable(documents);
                updateDashboard(buildDashboardCounts(legacyRecords));
                updatePagination();
                return;
            }

            documents = [];
            console.error(result && result.error ? result.error : "Unexpected API response", result);
            renderTable();
            updateDashboard(buildDashboardCounts([]));
            return;
        }

        listCache.set(cacheKey, result);
        applyPageResponse(result);
    }
    catch(error){
        console.error(error);
    }
}



/* ==========================================================
   RENDER TABLE
========================================================== */

function renderTable(data = documents) {
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

    const fragment = document.createDocumentFragment();
    data.forEach((doc, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${escapeHtml(doc.tracking || "-")}</td>
            <td>${escapeHtml(formatDate(doc.dateReceived))}</td>
            <td>${escapeHtml(doc.sender || "-")}</td>
            <td>${escapeHtml(doc.office || "-")}</td>
            <td>${escapeHtml(doc.category || "-")}</td>
            <td>${escapeHtml(doc.subject || "-")}</td>
            <td>${escapeHtml(doc.division || "-")}</td>
            <td>${escapeHtml(doc.ageing || "-")}</td>
            <td><span class="status-badge">${escapeHtml(doc.status || "-")}</span></td>
            <td class="action-buttons">
                <button class="icon-btn view-btn" data-action="view" data-index="${index}" title="View"><i class="fa-solid fa-eye"></i></button>
                <button class="icon-btn edit-btn" data-action="edit" data-index="${index}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="icon-btn delete-btn" data-action="delete" data-index="${index}" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        fragment.appendChild(row);
    });

    tbody.innerHTML = "";
    tbody.appendChild(fragment);
}

/* ==========================================================
   DASHBOARD
========================================================== */

function updateDashboard(counts = buildDashboardCounts(documents)) {
    const total = counts.total ?? documents.length;
    const processing = counts.processing ?? 0;
    const completed = counts.completed ?? 0;
    const pending = counts.pending ?? 0;
    const released = counts.released ?? 0;

    const totalEl = document.getElementById("totalDocuments");
    const processingEl = document.getElementById("processingDocuments");
    const completedEl = document.getElementById("completedDocuments");
    const pendingEl = document.getElementById("pendingDocuments");
    const releasedEl = document.getElementById("releasedDocuments");

    if (totalEl) totalEl.textContent = total;
    if (processingEl) processingEl.textContent = processing;
    if (completedEl) completedEl.textContent = completed;
    if (pendingEl) pendingEl.textContent = pending;
    if (releasedEl) releasedEl.textContent = released;
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

            normalizeStatusValue(doc.status) === normalizeStatusValue(status);

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

tbody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const index = Number(button.dataset.index);
    const action = button.dataset.action;
    if (Number.isNaN(index)) return;

    if (action === "view") viewDocument(index);
    if (action === "edit") editDocument(index);
    if (action === "delete") deleteDocument(index);
});

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
    formData.append("office",doc.office);
    formData.append("category",doc.category);
    formData.append("subject",doc.subject);
    formData.append("division",doc.division);
    formData.append("status", normalizeStatusValue(doc.status));
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
    formData.append("office",doc.office);
    formData.append("category",doc.category);
    formData.append("subject",doc.subject);
    formData.append("division",doc.division);
    formData.append("status", normalizeStatusValue(doc.status));
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
            `<option value="${escapeHtml(office)}">${escapeHtml(office)}</option>`;

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
    if (!form.reportValidity()) return;

    const file = document.getElementById("documentFile").files[0];
    if (file && !/\.(pdf|doc|docx|xls|xlsx|jpg|png)$/i.test(file.name)) {
        alert("Choose a PDF, Word, Excel, JPG, or PNG file.");
        return;
    }

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

        status: normalizeStatusValue(document.getElementById("status").value),

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

    document.getElementById("status").value = normalizeStatusValue(doc.status) || "";

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

        XLSX.utils.book_append_sheet(workbook, worksheet, "Outgoing Documents");

        XLSX.writeFile(workbook,"Outgoing_Documents.xlsx");

    });

}

/* ==========================================================
   FILTER EVENTS
========================================================== */

if (searchInput) {
    searchInput.addEventListener("input", () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => loadDocuments(1), 150);
    });
}

if (officeFilter) officeFilter.addEventListener("change", () => loadDocuments(1));
if (yearFilter) yearFilter.addEventListener("change", () => loadDocuments(1));
if (statusFilter) statusFilter.addEventListener("change", () => loadDocuments(1));

const pageButtons = Array.from(document.querySelectorAll(".page-btn"));
const prevPageBtn = pageButtons.find(btn => btn.innerHTML.includes("fa-angle-left"));
const nextPageBtn = pageButtons.find(btn => btn.innerHTML.includes("fa-angle-right"));
if (prevPageBtn) prevPageBtn.addEventListener("click", () => {
    if (pageState.page > 1) loadDocuments(pageState.page - 1);
});
if (nextPageBtn) nextPageBtn.addEventListener("click", () => {
    if (pageState.page < pageState.totalPages) loadDocuments(pageState.page + 1);
});

const clearButton = document.querySelector(".clear-btn");
if (clearButton) clearButton.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (officeFilter) officeFilter.value = "All Offices";
    if (yearFilter) yearFilter.value = "All Years";
    if (statusFilter) statusFilter.value = "All Status";
    loadDocuments(1);
});

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
});
