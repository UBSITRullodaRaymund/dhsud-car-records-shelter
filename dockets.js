/*=========================================================
 DHSUD-CAR RECORDS SHELTER
 Dockets Issuances
 Version 5.0
=========================================================*/


/*=========================================================
 CONFIGURATION
=========================================================*/

const API_URL =
"https://script.google.com/macros/s/AKfycbxQAh3bOHZc-c1gZpOtpSF4SaQSd8XV-g_OWnbM8h628C9uPPEdsVdEtrw0yabpNSn_3Q/exec";

const SHEET_NAME = "Dockets Issuances";


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

        const response = await fetch(

            `${API_URL}?action=getDocuments&sheet=${encodeURIComponent(SHEET_NAME)}`

        );

        documents = await response.json();

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

    tbody.innerHTML = "";

    if(data.length === 0){

        document.getElementById("emptyState").style.display="flex";

        document.getElementById("showingCount").textContent=0;

        document.getElementById("totalCount").textContent=0;

        return;

    }

    document.getElementById("emptyState").style.display="none";

    document.getElementById("showingCount").textContent=data.length;

    document.getElementById("totalCount").textContent=documents.length;

    data.forEach((doc,index)=>{

        const row=document.createElement("tr");

        row.innerHTML=`

<td>${doc.transactionNo || "-"}</td>

<td>${formatDate(doc.dateRequest)}</td>

<td>${doc.documentName || "-"}</td>

<td>${doc.classification || "-"}</td>

<td>${doc.requestedBy || "-"}</td>

<td>${doc.releasedBy || "-"}</td>

<td>${formatDate(doc.dateReceived)}</td>

<td>

<span class="status-badge ${String(doc.status).toLowerCase()}">

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

    if(editingIndex === -1){

        await saveDocument(doc);

    }else{

        await updateDocument(doc);

    }

    closeModal();

    loadDocuments();

});

/*=========================================================
 SAVE DOCUMENT
=========================================================*/

async function saveDocument(doc){

    const formData = new FormData();

    formData.append("action","save");
    formData.append("sheet",SHEET_NAME);

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

    const response = await fetch(API_URL,{
        method:"POST",
        body:formData
    });

    return await response.json();

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
    formData.append("sheet",SHEET_NAME);

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

    const response=await fetch(API_URL,{
        method:"POST",
        body:formData
    });

    return await response.json();

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
    formData.append("sheet",SHEET_NAME);
    formData.append("transactionNo",doc.transactionNo);

    await fetch(API_URL,{
        method:"POST",
        body:formData
    });

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