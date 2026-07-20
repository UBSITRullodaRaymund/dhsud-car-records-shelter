/* ==========================================================
   DHSUD-CAR RECORDS SHELTER
   Version 2.0
   Developed for DHSUD-CAR
========================================================== */

/* ==========================================================
   CONFIGURATION
========================================================== */

const API_URL =
"https://script.google.com/macros/s/AKfycbxQAh3bOHZc-c1gZpOtpSF4SaQSd8XV-g_OWnbM8h628C9uPPEdsVdEtrw0yabpNSn_3Q/exec";

/* ==========================================================
   GLOBAL VARIABLES
========================================================== */

let documents = [];
let editingIndex = -1;

/* ==========================================================
   DOM ELEMENTS
========================================================== */

const modal = document.getElementById("documentModal");
const form = document.getElementById("documentForm");

const openModalBtn = document.getElementById("openModal");
const closeModalBtn = document.querySelector(".close");
const cancelModalBtn = document.getElementById("closeModal");

const officeFilter = document.getElementById("officeFilter");
const yearFilter = document.getElementById("yearFilter");
const statusFilter = document.getElementById("statusFilter");
const searchInput = document.getElementById("searchInput");

const tbody = document.getElementById("recordsBody");

/* ==========================================================
   GOOGLE SHEETS API
========================================================== */

async function loadDocuments() {

    try {

        const response =
        await fetch(API_URL + "?action=getDocuments");

        documents = await response.json();

        renderTable();
        updateDashboard();

    } catch (error) {

        console.error("Load Error:", error);

    }

}

/* ==========================================================
   SAVE DOCUMENT
========================================================== */

async function saveDocument(documentData){

    try{

        const formData = new FormData();

        Object.keys(documentData).forEach(key=>{

            formData.append(key,documentData[key]);

        });

        await fetch(API_URL,{

            method:"POST",
            mode:"no-cors",
            body:formData

        });

        await loadDocuments();

    }catch(error){

        console.error("Save Error:",error);

    }

}

/* ==========================================================
   DELETE DOCUMENT
========================================================== */

async function deleteDocument(tracking){

    if(!confirm("Are you sure you want to delete this document?"))
        return;

    try{

        const formData=new FormData();

        formData.append("action","delete");
        formData.append("tracking",tracking);

        await fetch(API_URL,{

            method:"POST",

            body:formData

        });

        await loadDocuments();

        alert("Document deleted successfully.");

    }catch(error){

        console.error(error);

        alert("Unable to delete document.");

    }

}

// ===============================
// Animated Counter
// ===============================

const counters = document.querySelectorAll(".counter");

const speed = 200;

counters.forEach(counter => {

    const updateCount = () => {

        const target = +counter.getAttribute("data-target");
        const count = +counter.innerText.replace(/,/g,'');

        const increment = target / speed;

        if(count < target){

            counter.innerText = Math.ceil(count + increment).toLocaleString();

            setTimeout(updateCount,10);

        }else{

            counter.innerText = target.toLocaleString();

        }

    }

    updateCount();

});

// ===============================
// Scroll Reveal Animation
// ===============================

const observer = new IntersectionObserver((entries)=>{

    entries.forEach(entry=>{

        if(entry.isIntersecting){

            entry.target.classList.add("show");

        }

    });

},{
    threshold:0.15
});

document.querySelectorAll(".card,.stat-box,.container").forEach(el=>{

    el.classList.add("hidden");

    observer.observe(el);

});

// ===============================
// Sticky Navbar Effect
// ===============================

const header = document.querySelector("header");

window.addEventListener("scroll",()=>{

    if(window.scrollY > 80){

        header.style.background="#003C88";
        header.style.boxShadow="0 5px 20px rgba(0,0,0,.2)";

    }else{

        header.style.background="transparent";
        header.style.boxShadow="none";

    }

});

// ===============================
// Back To Top Button
// ===============================

const topButton = document.createElement("button");

topButton.innerHTML = "↑";

topButton.id = "topButton";

document.body.appendChild(topButton);

topButton.style.position="fixed";
topButton.style.right="30px";
topButton.style.bottom="30px";
topButton.style.width="50px";
topButton.style.height="50px";
topButton.style.borderRadius="50%";
topButton.style.border="none";
topButton.style.background="#005BAC";
topButton.style.color="#fff";
topButton.style.fontSize="22px";
topButton.style.cursor="pointer";
topButton.style.display="none";
topButton.style.boxShadow="0 10px 20px rgba(0,0,0,.2)";
topButton.style.transition=".3s";
topButton.style.zIndex="999";

window.addEventListener("scroll",()=>{

    if(window.scrollY > 500){

        topButton.style.display="block";

    }else{

        topButton.style.display="none";

    }

});

topButton.onclick=()=>{

    window.scrollTo({

        top:0,

        behavior:"smooth"

    });

};

// ===============================
// Card Hover Animation
// ===============================

document.querySelectorAll(".card").forEach(card=>{

    card.addEventListener("mouseenter",()=>{

        card.style.transform="translateY(-12px) scale(1.02)";

    });

    card.addEventListener("mouseleave",()=>{

        card.style.transform="translateY(0px) scale(1)";

    });

});


// ===============================
// Smooth Fade-In on Page Load
// ===============================

window.addEventListener("load",()=>{

    document.body.style.opacity="1";

});

// ===============================
// Hidden Animation
// ===============================

const style = document.createElement("style");

style.innerHTML=`

body{

opacity:0;

transition:opacity .8s;

}

.hidden{

opacity:0;

transform:translateY(50px);

transition:all .8s ease;

}

.show{

opacity:1;

transform:translateY(0);

}

`;

document.head.appendChild(style);

// ===============================
// Console Message
// ===============================

console.log("%cDHSUD-CAR RECORDS SHELTER","color:#005BAC;font-size:22px;font-weight:bold;");
console.log("Version 1.0 Loaded Successfully");


// =============================
// LIVE TABLE SEARCH
// =============================

if(searchInput){

searchInput.addEventListener("keyup",function(){

let value=this.value.toLowerCase();

let rows=document.querySelectorAll(".records-table tbody tr");

rows.forEach(row=>{

row.style.display=row.innerText.toLowerCase().includes(value)
? ""
: "none";

});

});

}

/* ==========================================================
   MODAL FUNCTIONS
========================================================== */

function openModal(){

    modal.style.display="flex";

}

function closeModal(){

    modal.style.display="none";

    form.reset();

    editingIndex=-1;

    const saveBtn=document.querySelector(".save-btn");

    if(saveBtn){

        saveBtn.innerHTML=
        '<i class="fa-solid fa-floppy-disk"></i> Save Document';

    }

}

/* ==========================================================
   EVENT LISTENERS
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
   ADD / UPDATE DOCUMENT
========================================================== */

if(form){

form.addEventListener("submit",async function(e){

e.preventDefault();

const file=document.getElementById("documentFile").files[0];

const trackingNumber=
editingIndex===-1
? `DHSUD-${new Date().getFullYear()}-${String(documents.length+1).padStart(4,"0")}`
: documents[editingIndex].tracking;

const newDocument={

tracking:trackingNumber,

dateReceived:document.getElementById("dateReceived").value,

sender:document.getElementById("sender").value,

office:document.getElementById("office").value,

category:document.getElementById("category").value,

subcategory:document.getElementById("subject").value,

division:document.getElementById("division").value,

status:document.getElementById("status").value,

remarks:document.getElementById("remarks")?.value || "",

attachmentName:file ? file.name : "",

attachmentType:file ? file.type : "",

attachmentSize:file ? file.size : 0,

driveUrl:"",

ageing:"1 DAY OF 3 DAYS"

};

if (editingIndex === -1) {

    await saveDocument(newDocument);

} else {    

    await updateDocument(newDocument);

    editingIndex = -1;

}

closeModal();
await loadDocuments();
renderTable();
updateDashboard();

});

}
/* ==========================================================
   RENDER DOCUMENT TABLE
========================================================== */

function renderTable() {

    if (!tbody) return;

    tbody.innerHTML = "";

    const office = officeFilter ? officeFilter.value : "All Offices";
    const year = yearFilter ? yearFilter.value : "All Years";
    const status = statusFilter ? statusFilter.value : "All Status";

    const filteredDocuments = documents.filter(doc => {

        const officeMatch =
            office === "All Offices" ||
            doc.office === office;

        const yearMatch =
            year === "All Years" ||
            (
                doc.dateReceived &&
                new Date(doc.dateReceived).getFullYear().toString() === year
            );

        const statusMatch =
            status === "All Status" ||
            doc.status === status;

        return officeMatch && yearMatch && statusMatch;

    });

    filteredDocuments.forEach((doc,index)=>{

        const row=document.createElement("tr");

        row.innerHTML=`

<td>${doc.tracking}</td>

<td>${
doc.dateReceived
? new Date(doc.dateReceived).toLocaleDateString("en-US",{
    year:"numeric",
    month:"long",
    day:"numeric"
})
: "-"
}</td>

<td>${doc.sender}</td>

<td>${doc.office}</td>

<td>${doc.category}</td>

<td>${doc.subcategory}</td>

<td>${doc.division}</td>

<td>

<span class="age-badge">

${doc.ageing || "-"}

</span>

</td>

<td>

<span class="status ${(doc.status || "").toLowerCase()}">

${doc.status || "-"}

</span>

</td>

<td class="action-buttons">

<button class="view-btn">

<i class="fa-solid fa-eye"></i>

</button>

<button class="edit-btn">

<i class="fa-solid fa-pen"></i>

</button>

<button class="delete-btn">

<i class="fa-solid fa-trash"></i>

</button>

</td>

`;

        tbody.appendChild(row);

        attachRowEvents(row,doc,index);

    });

    updateDashboard();

    document.getElementById("showingCount").textContent =
    filteredDocuments.length;

    document.getElementById("totalCount").textContent =
    documents.length;

}

async function saveDocument(doc){

    const formData = new FormData();

    formData.append("action","save");

    formData.append("tracking",doc.tracking);
    formData.append("dateReceived",doc.dateReceived);
    formData.append("sender",doc.sender);
    formData.append("office",doc.office);
    formData.append("category",doc.category);
    formData.append("subject",doc.subcategory);
    formData.append("division",doc.division);
    formData.append("status",doc.status);
    formData.append("remarks",doc.remarks || "");
    formData.append("fileName",doc.attachmentName || "");
    formData.append("driveUrl","");

    await fetch(API_URL,{
        method:"POST",
        body:formData
    });

    await loadDocuments();

}

async function updateDocument(doc){

    const formData = new FormData();

    formData.append("action","update");

    formData.append("tracking",doc.tracking);
    formData.append("dateReceived",doc.dateReceived);
    formData.append("sender",doc.sender);
    formData.append("office",doc.office);
    formData.append("category",doc.category);
    formData.append("subject",doc.subcategory);
    formData.append("division",doc.division);
    formData.append("status",doc.status);
    formData.append("remarks",doc.remarks || "");
    formData.append("fileName",doc.attachmentName || "");
    formData.append("driveUrl","");

    await fetch(API_URL,{
        method:"POST",
        body:formData
    });

    await loadDocuments();

}


/* ==========================================================
   ATTACH BUTTON EVENTS
========================================================== */

function attachRowEvents(row, doc, index){

    // View
    row.querySelector(".view-btn")
    .addEventListener("click",()=>{

        viewDocument(doc);

    });

    // Edit
    row.querySelector(".edit-btn")
    .addEventListener("click",()=>{

        editDocument(doc,index);

    });

    // Delete
    row.querySelector(".delete-btn")
    .addEventListener("click",()=>{

        deleteDocument(doc.tracking);

    });

}

/* ==========================================================
   VIEW DOCUMENT
========================================================== */

function viewDocument(doc){

    document.getElementById("viewTracking").textContent =
    doc.tracking;

    document.getElementById("viewDate").textContent =
    doc.dateReceived || "-";

    document.getElementById("viewSender").textContent =
    doc.sender;

    document.getElementById("viewOffice").textContent =
    doc.office;

    document.getElementById("viewCategory").textContent =
    doc.category;

    document.getElementById("viewSubject").textContent =
    doc.subcategory;

    document.getElementById("viewDivision").textContent =
    doc.division;

    document.getElementById("viewStatus").textContent =
    doc.status;

    document.getElementById("viewAgeing").textContent =
    doc.ageing;

    document.getElementById("viewRemarks").textContent =
    doc.remarks || "-";

    document.getElementById("viewModal").style.display="flex";

}

/* ==========================================================
   EDIT DOCUMENT
========================================================== */

function editDocument(doc,index){

    editingIndex=index;

    document.getElementById("trackingNo").value =
    doc.tracking;

    document.getElementById("dateReceived").value =
    doc.dateReceived || "";

    document.getElementById("sender").value =
    doc.sender;

    document.getElementById("office").value =
    doc.office;

    document.getElementById("category").value =
    doc.category;

    document.getElementById("subject").value =
    doc.subcategory;

    document.getElementById("division").value =
    doc.division;

    document.getElementById("status").value =
    doc.status;

    document.getElementById("remarks").value =
    doc.remarks || "";

    document.querySelector(".save-btn").innerHTML =
    '<i class="fa-solid fa-pen"></i> Update Document';

    openModal();

}



updateDashboard();
// ===============================
// UPDATE TABLE FOOTER
// ===============================

const visibleDocuments = tbody.querySelectorAll("tr").length;

document.getElementById("showingCount").textContent = visibleDocuments;

document.getElementById("totalCount").textContent = documents.length;


// Load existing data
loadDocuments();
document.getElementById("officeFilter").addEventListener("change", renderTable);
document.getElementById("yearFilter").addEventListener("change", renderTable);
document.getElementById("statusFilter").addEventListener("change", renderTable);

// ======================================
// UPDATE DASHBOARD COUNTERS
// ======================================

function updateDashboard() {

    const total = documents.length;

    const pending = documents.filter(doc => doc.status === "Pending").length;

    const processing = documents.filter(doc => doc.status === "Processing").length;

    const completed = documents.filter(doc => doc.status === "Completed").length;

    document.getElementById("totalDocuments").textContent = total;

    document.getElementById("pendingDocuments").textContent = pending;

    document.getElementById("processingDocuments").textContent = processing;

    document.getElementById("completedDocuments").textContent = completed;

}

// ======================================
// CLOSE VIEW MODAL
// ======================================

const viewModal = document.getElementById("viewModal");

document.getElementById("closeView").onclick = function () {

    viewModal.style.display = "none";

};

document.getElementById("closeViewBtn").onclick = function () {

    viewModal.style.display = "none";

};

window.addEventListener("click", function (e) {

    if (e.target === viewModal) {

        viewModal.style.display = "none";

    }

});

// ======================================
// EXPORT TO EXCEL
// ======================================

const exportBtn = document.getElementById("exportExcel");

if (exportBtn) {

    exportBtn.addEventListener("click", function () {

        if (documents.length === 0) {

            alert("There are no documents to export.");

            return;

        }

        const exportData = documents.map(doc => ({

            "Tracking No.": doc.tracking,

            "Date Received": doc.dateReceived,

            "Sender": doc.sender,

            "Office": doc.office,

            "Category": doc.category,

            "Subject": doc.subcategory,

            "Division": doc.division,

            "Ageing": doc.ageing,

            "Status": doc.status

        }));

        // Create workbook
        const worksheet = XLSX.utils.json_to_sheet(exportData);

        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(workbook, worksheet, "Incoming Documents");

        // Auto column widths
        worksheet["!cols"] = [

            { wch: 22 },

            { wch: 15 },

            { wch: 25 },

            { wch: 25 },

            { wch: 18 },

            { wch: 35 },

            { wch: 35 },

            { wch: 18 },

            { wch: 15 }

        ];

        // File name
        const today = new Date().toISOString().split("T")[0];

        XLSX.writeFile(
            workbook,
            `Incoming_Documents_${today}.xlsx`
        );

    });
}
