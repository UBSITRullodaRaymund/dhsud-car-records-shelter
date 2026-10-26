/*=========================================================
 DHSUD-CAR RECORDS SHELTER
 Dockets Issuances
 Version 5.0
=========================================================*/


/*=========================================================
 CONFIGURATION
=========================================================*/

const SHEET_NAME = "Dockets Issuances";
const MODULE_NAME = "dockets";

requireLogin();


/*=========================================================
 GLOBAL VARIABLES
=========================================================*/

let documents = [];
let editingIndex = -1;
let searchDebounceTimer = null;
const PAGE_SIZE = 12;
const listCache = new Map();
let pageState = { page: 1, totalPages: 1, total: 0, pageSize: PAGE_SIZE };


/*=========================================================
 DOM ELEMENTS
=========================================================*/

const tbody =
document.getElementById("recordsBody");

const form =
document.getElementById("documentForm");

const modal =
document.getElementById("documentModal");

const openModalBtn =
document.getElementById("openModal");

const closeModalBtn =
document.getElementById("closeModal");

const cancelModalBtn =
document.getElementById("cancelModal");

const searchInput =
document.getElementById("searchInput");

/*=========================================================
 VIEW MODAL
=========================================================*/

const viewModal =
document.getElementById("viewModal");

const closeView =
document.getElementById("closeView");

const closeViewBtn =
document.getElementById("closeViewBtn");

/*=========================================================
 INITIALIZE
=========================================================*/

window.onload = function () {

    loadDocuments();

};

/*=========================================================
 FORMAT DATE
=========================================================*/

function formatDate(date){

    if(!date) return "-";

    return new Date(date).toLocaleDateString();

}


/*=========================================================
 TRANSACTION NUMBER
=========================================================*/

function generateTransactionNumber(){

    let highest = 0;

    documents.forEach(doc=>{

        if(!doc.transactionNo) return;

        const parts = doc.transactionNo.split("-");

        const number = parseInt(parts[2]);

        if(number > highest){

            highest = number;

        }

    });

    highest++;

    return `CAR-${new Date().getFullYear()}-${String(highest).padStart(4,"0")}`;

}

/*=========================================================
 LOAD DOCUMENTS
=========================================================*/

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
        status: "",
        office: "",
        year: ""
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

/*=========================================================
 RENDER TABLE
=========================================================*/

function renderTable(data = documents){
    if(data.length === 0){
        document.getElementById("emptyState").style.display="flex";
        document.getElementById("showingCount").textContent=0;
        document.getElementById("totalCount").textContent=0;
        return;
    }

    document.getElementById("emptyState").style.display="none";
    document.getElementById("showingCount").textContent=data.length;
    document.getElementById("totalCount").textContent=documents.length;

    const fragment = document.createDocumentFragment();
    data.forEach((doc,index)=>{
        const row=document.createElement("tr");
        row.innerHTML=`
            <td>${escapeHtml(doc.transactionNo || "-")}</td>
            <td>${escapeHtml(formatDate(doc.dateRequest))}</td>
            <td>${escapeHtml(doc.documentName || "-")}</td>
            <td>${escapeHtml(doc.classification || "-")}</td>
            <td>${escapeHtml(doc.requestedBy || "-")}</td>
            <td>${escapeHtml(doc.releasedBy || "-")}</td>
            <td>${escapeHtml(formatDate(doc.dateReceived))}</td>
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

/*=========================================================
 DASHBOARD
=========================================================*/

function updateDashboard(counts = buildDashboardCounts(documents)){
    const total = counts.total ?? documents.length;
    const pending = counts.pending ?? 0;
    const released = counts.released ?? 0;
    const returned = counts.returned ?? 0;

    document.getElementById("totalDocuments").textContent = total;
    document.getElementById("pendingDocuments").textContent = pending;
    document.getElementById("releasedDocuments").textContent = released;
    document.getElementById("returnedDocuments").textContent = returned;
}

/*=========================================================
 MODAL CONTROLS
=========================================================*/

openModalBtn.addEventListener("click", openModal);

closeModalBtn.addEventListener("click", closeModal);

cancelModalBtn.addEventListener("click", closeModal);

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

if (searchInput) {
    searchInput.addEventListener("input", () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => loadDocuments(1), 150);
    });
}

const pageButtons = Array.from(document.querySelectorAll(".page-btn"));
const prevPageBtn = pageButtons.find(btn => btn.innerHTML.includes("fa-angle-left"));
const nextPageBtn = pageButtons.find(btn => btn.innerHTML.includes("fa-angle-right"));
if (prevPageBtn) prevPageBtn.addEventListener("click", () => {
    if (pageState.page > 1) loadDocuments(pageState.page - 1);
});
if (nextPageBtn) nextPageBtn.addEventListener("click", () => {
    if (pageState.page < pageState.totalPages) loadDocuments(pageState.page + 1);
});

const clearButton = document.getElementById("clearFilters");
if (clearButton) clearButton.addEventListener("click", () => {
    searchInput.value = "";
    loadDocuments(1);
});

function openModal(){

    editingIndex = -1;

    form.reset();

    document.getElementById("transactionNo").value =
        generateTransactionNumber();

    modal.style.display = "flex";

}


function closeModal(){

    modal.style.display = "none";

}

/*=========================================================
 CLOSE MODAL OUTSIDE
=========================================================*/

window.addEventListener("click", function(e){

    if(e.target === modal){

        closeModal();

    }

});

/*=========================================================
 FORM SUBMIT
=========================================================*/

form.addEventListener("submit", async function(e){

    e.preventDefault();
    if (!form.reportValidity()) return;

    const classification =
    document.querySelector('input[name="classification"]:checked');

    const doc = {

        transactionNo:
            editingIndex === -1
            ? generateTransactionNumber()
            : documents[editingIndex].transactionNo,

        dateRequest:
            document.getElementById("dateRequest").value,

        documentName:
            document.getElementById("documentName").value,

        classification:
            classification ? classification.value : "",

        requestedBy:
            document.getElementById("requestedBy").value,

        releasedBy:
            document.getElementById("releasedBy").value,

        dateReceived:
            document.getElementById("dateReceived").value,

        dateReturned:
            document.getElementById("dateReturned").value,

        returnedBy:
            document.getElementById("returnedBy").value,

        verifiedBy:
            document.getElementById("verifiedBy").value,

        status:
            document.getElementById("status").value,

        remarks:
            document.getElementById("remarks").value

    };

    const result = editingIndex === -1
        ? await saveDocument(doc)
        : await updateDocument(doc);

    if (!result || result.error) {
        alert(result ? result.error : "Save failed");
        return;
    }

    closeModal();

    await loadDocuments();

});

/*=========================================================
 SAVE DOCUMENT
=========================================================*/

async function saveDocument(doc){

    const formData = new FormData();

    formData.append("action","save");
    formData.append("module", MODULE_NAME);
    formData.append("sheet",SHEET_NAME);
    formData.append("office", getRequestOffice());

    formData.append("transactionNo",doc.transactionNo);
    formData.append("dateRequest",doc.dateRequest);
    formData.append("documentName",doc.documentName);
    formData.append("classification",doc.classification);
    formData.append("requestedBy",doc.requestedBy);
    formData.append("releasedBy",doc.releasedBy);
    formData.append("dateReceived",doc.dateReceived);
    formData.append("dateReturned",doc.dateReturned);
    formData.append("returnedBy",doc.returnedBy);
    formData.append("verifiedBy",doc.verifiedBy);
    formData.append("status",doc.status);
    formData.append("remarks",doc.remarks);

    return await authedPost(formData);

}

/*=========================================================
 EDIT DOCUMENT
=========================================================*/

function editDocument(index){

    editingIndex = index;

    const doc = documents[index];

    document.getElementById("transactionNo").value =
        doc.transactionNo || "";

    document.getElementById("dateRequest").value =
        doc.dateRequest ? doc.dateRequest.split("T")[0] : "";

    document.getElementById("documentName").value =
        doc.documentName || "";

    // Classification Radio Button
    document
        .querySelectorAll('input[name="classification"]')
        .forEach(radio=>{

            radio.checked =
                radio.value===doc.classification;

        });

    document.getElementById("requestedBy").value =
        doc.requestedBy || "";

    document.getElementById("releasedBy").value =
        doc.releasedBy || "";

    document.getElementById("dateReceived").value =
        doc.dateReceived
            ? doc.dateReceived.split("T")[0]
            : "";

    document.getElementById("dateReturned").value =
        doc.dateReturned
            ? doc.dateReturned.split("T")[0]
            : "";

    document.getElementById("returnedBy").value =
        doc.returnedBy || "";

    document.getElementById("verifiedBy").value =
        doc.verifiedBy || "";

    document.getElementById("status").value =
        doc.status || "";

    document.getElementById("remarks").value =
        doc.remarks || "";

    modal.style.display="flex";

}


/*=========================================================
 UPDATE DOCUMENT
=========================================================*/

async function updateDocument(doc){

    const formData=new FormData();

    formData.append("action","update");
    formData.append("module", MODULE_NAME);
    formData.append("sheet",SHEET_NAME);
    formData.append("office", getRequestOffice());
    formData.append("idField", "transactionNo");
    formData.append("idValue", doc.transactionNo);

    formData.append("transactionNo",doc.transactionNo);
    formData.append("dateRequest",doc.dateRequest);
    formData.append("documentName",doc.documentName);
    formData.append("classification",doc.classification);
    formData.append("requestedBy",doc.requestedBy);
    formData.append("releasedBy",doc.releasedBy);
    formData.append("dateReceived",doc.dateReceived);
    formData.append("dateReturned",doc.dateReturned);
    formData.append("returnedBy",doc.returnedBy);
    formData.append("verifiedBy",doc.verifiedBy);
    formData.append("status",doc.status);
    formData.append("remarks",doc.remarks);

    const result = await authedPost(formData);
    if (!result || result.error) {
        alert(result ? result.error : "Update failed");
        return null;
    }

    editingIndex = -1;
    await loadDocuments();
    return result;

}

/*=========================================================
 DELETE DOCUMENT
=========================================================*/

async function deleteDocument(index){

    const doc = documents[index];

    if(!confirm(
        `Delete Transaction\n\n${doc.transactionNo}?`
    )) return;

    const formData = new FormData();

    formData.append("action","delete");
    formData.append("module", MODULE_NAME);
    formData.append("sheet",SHEET_NAME);
    formData.append("office", getRequestOffice());
    formData.append("idField", "transactionNo");
    formData.append("idValue", doc.transactionNo);

    const result = await authedPost(formData);
    if (!result || result.error) {
        alert(result ? result.error : "Delete failed");
        return;
    }

    await loadDocuments();

}

/*=========================================================
 VIEW DOCUMENT
=========================================================*/

function viewDocument(index){

    const doc = documents[index];

    document.getElementById("viewTransactionNo").textContent =
        doc.transactionNo || "";

    document.getElementById("viewDateRequest").textContent =
        formatDate(doc.dateRequest);

    document.getElementById("viewDocumentName").textContent =
        doc.documentName || "";

    document.getElementById("viewRequestedBy").textContent =
        doc.requestedBy || "";

    document.getElementById("viewReleasedBy").textContent =
        doc.releasedBy || "";

    document.getElementById("viewDateReceived").textContent =
        formatDate(doc.dateReceived);

    document.getElementById("viewDateReturned").textContent =
        formatDate(doc.dateReturned);

    document.getElementById("viewReturnedBy").textContent =
        doc.returnedBy || "";

    document.getElementById("viewVerifiedBy").textContent =
        doc.verifiedBy || "";

    document.getElementById("viewStatus").textContent =
        doc.status || "";

    document.getElementById("viewRemarks").textContent =
        doc.remarks || "";

    /*==============================
      CLASSIFICATION CHECKBOXES
    ==============================*/

    document.getElementById("checkCondo").innerHTML =
        "☐ Condominium";

    document.getElementById("checkSubdivision").innerHTML =
        "☐ Subdivision";

    document.getElementById("checkCLUP").innerHTML =
        "☐ CLUP";

    document.getElementById("checkHOA").innerHTML =
        "☐ HOA";

    document.getElementById("checkMemorial").innerHTML =
        "☐ Memorial Park";

    document.getElementById("checkOthers").innerHTML =
        "☐ Others";

    switch(doc.classification){

        case "Condominium":
            document.getElementById("checkCondo").innerHTML =
                "☑ Condominium";
            break;

        case "Subdivision":
            document.getElementById("checkSubdivision").innerHTML =
                "☑ Subdivision";
            break;

        case "CLUP":
            document.getElementById("checkCLUP").innerHTML =
                "☑ CLUP";
            break;

        case "HOA":
            document.getElementById("checkHOA").innerHTML =
                "☑ HOA";
            break;

        case "Memorial Park":
            document.getElementById("checkMemorial").innerHTML =
                "☑ Memorial Park";
            break;

        default:
            document.getElementById("checkOthers").innerHTML =
                "☑ Others";

    }

    viewModal.style.display = "flex";

}

/*=========================================================
 CLOSE VIEW MODAL
=========================================================*/

closeView.onclick = closeViewModal;

closeViewBtn.onclick = closeViewModal;

function closeViewModal(){

    viewModal.style.display = "none";

}

window.addEventListener("click",function(e){

    if(e.target===viewModal){

        closeViewModal();

    }

});