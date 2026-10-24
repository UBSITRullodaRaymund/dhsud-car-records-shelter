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

const DOCKETS_SPREADSHEET_COLUMNS = [
    ["Transaction No.", "transactionNo"],
    ["Date of Request", "dateRequest"],
    ["Document Name", "documentName"],
    ["Classification", "classification"],
    ["Requested By", "requestedBy"],
    ["Released By", "releasedBy"],
    ["Date Received", "dateReceived"],
    ["Date Returned", "dateReturned"],
    ["Returned By", "returnedBy"],
    ["Verified By", "verifiedBy"],
    ["Status", "status"],
    ["Remarks", "remarks"],
    ["File Name", "fileName"],
    ["Date Uploaded", "dateUploaded"]
];

requireLogin();


/*=========================================================
 GLOBAL VARIABLES
=========================================================*/

let documents = [];

let editingIndex = -1;


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

async function loadDocuments(){

    try{
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

        renderTable();

        updateDashboard();

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

        TablePagination.render(tbody, [], () => document.createElement("tr"));

        return;

    }

    document.getElementById("emptyState").style.display="none";

    TablePagination.render(tbody, data, (doc,index)=>{

        const row=document.createElement("tr");
        DOCKETS_SPREADSHEET_COLUMNS.forEach(([label, key])=>{
            const cell=document.createElement("td");
            cell.dataset.label=label;
            cell.textContent=doc[key] == null ? "" : String(doc[key]);
            row.appendChild(cell);
        });

        const actions=document.createElement("td");
        actions.dataset.label="Action";
        actions.className="action-buttons";
        actions.innerHTML=`
            <button class="icon-btn view-btn" onclick="viewDocument(${index})" title="View">
                <i class="fa-solid fa-eye"></i>
            </button>
            <button class="icon-btn edit-btn" onclick="editDocument(${index})" title="Edit">
                <i class="fa-solid fa-pen"></i>
            </button>
            <button class="icon-btn delete-btn" onclick="deleteDocument(${index})" title="Delete">
                <i class="fa-solid fa-trash"></i>
            </button>`;
        row.appendChild(actions);

        return row;
    });

}

/*=========================================================
 DASHBOARD
=========================================================*/

function updateDashboard(){

    document.getElementById("totalDocuments").textContent =
    documents.length;

    document.getElementById("pendingDocuments").textContent =
    documents.filter(d=>d.status==="Pending").length;

    document.getElementById("releasedDocuments").textContent =
    documents.filter(d=>d.status==="Released").length;

    document.getElementById("returnedDocuments").textContent =
    documents.filter(d=>d.status==="Returned").length;

}

/*=========================================================
 MODAL CONTROLS
=========================================================*/

openModalBtn.addEventListener("click", openModal);

closeModalBtn.addEventListener("click", closeModal);

cancelModalBtn.addEventListener("click", closeModal);


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

    const classification =
    document.querySelector('input[name="classification"]:checked');

    const doc = {

        transactionNo:
            editingIndex === -1
            ? generateTransactionNumber()
            : documents[editingIndex].transactionNo,

        _syncVersion:
            editingIndex === -1
            ? ""
            : documents[editingIndex]._syncVersion,

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
    formData.append("_syncVersion", doc._syncVersion);

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
    formData.append("_syncVersion", doc._syncVersion);

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