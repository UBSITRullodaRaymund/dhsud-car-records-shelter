/* ==========================================
   DHSUD-CAR RECORDS SHELTER
   Version 1.0
========================================== */
// ======================================
// DOCUMENT DATABASE
// ======================================
let documents = [

    

{
    tracking:"DHSUD-RQST-27419",
    sender:"Lovelyn Sotelo",
    office:"CAR",
    category:"Request",
    subcategory:"Request for Library Services",
    division:"Housing Real Estate Development Regulation Division",
    ageing:"2 DAYS OF 3 DAYS",
    status:"Completed"
}

];

// ===============================
// EDIT MODE
// ===============================

let editingIndex = -1;

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

const searchInput = document.getElementById("searchInput");

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

// ======================================
// MODAL
// ======================================

const modal=document.getElementById("documentModal");

const open=document.getElementById("openModal");

const close=document.querySelector(".close");

const cancel=document.getElementById("closeModal");

if(open){

open.onclick=function(){

modal.style.display = "flex";

}

}

if(close){

close.onclick=function(){

modal.style.display="none";

}

}

if(cancel){

cancel.onclick=function(){

modal.style.display="none";

}

}

window.onclick=function(e){

if(e.target==modal){

modal.style.display="none";

}

}

// ======================================
// ADD NEW DOCUMENT
// ======================================

const form = document.getElementById("documentForm");

if (form) {

    form.addEventListener("submit", function (e) {

        e.preventDefault();

        
        const trackingNumber =
`DHSUD-${new Date().getFullYear()}-${String(documents.length + 1).padStart(4,"0")}`;

const newDocument = {

    tracking: trackingNumber,

    dateReceived: document.getElementById("dateReceived").value,

    sender: document.getElementById("sender").value,

    office: document.getElementById("office").value,

    category: document.getElementById("category").value,

    subcategory: document.getElementById("subject").value,

    division: document.getElementById("division").value,

    ageing: "1 DAY OF 3 DAYS",

    status: document.getElementById("status").value

};

        // If editing an existing document
if (editingIndex !== -1) {

    documents[editingIndex] = newDocument;

    editingIndex = -1;

    document.querySelector(".save-btn").innerHTML =
        '<i class="fa-solid fa-floppy-disk"></i> Save Document';

} else {

    // Add new document
    documents.unshift(newDocument);

}

renderTable();

modal.style.display = "none";

form.reset();

    });

}

// ======================================
// RENDER DOCUMENT TABLE
// ======================================

function renderTable() {

    const tbody = document.getElementById("recordsBody");

    if (!tbody) return;

    tbody.innerHTML = "";

    documents.forEach((doc, index) => {

        const row = document.createElement("tr");

        row.innerHTML = `

<td>${doc.tracking}</td>

<td>${doc.dateReceived || "-"}</td>

<td>${doc.sender}</td>

<td>${doc.office}</td>

<td>${doc.category}</td>

<td>${doc.subcategory}</td>

<td>${doc.division}</td>

<td>
<span class="age-badge">
${doc.ageing}
</span>
</td>

<td>
<span class="status ${doc.status.toLowerCase()}">
${doc.status}
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


// ======================================
// VIEW DOCUMENT
// ======================================

row.querySelector(".view-btn").addEventListener("click", function () {

    document.getElementById("viewTracking").textContent = doc.tracking;

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

    document.getElementById("viewModal").style.display = "flex";

});

// ======================================
// EDIT DOCUMENT
// ======================================

row.querySelector(".edit-btn").addEventListener("click", function () {

    editingIndex = index;

    document.getElementById("trackingNo").value = doc.tracking;
    document.getElementById("dateReceived").value = doc.dateReceived || "";
    document.getElementById("sender").value = doc.sender;
    document.getElementById("office").value = doc.office;
    document.getElementById("category").value = doc.category;
    document.getElementById("subject").value = doc.subcategory;
    document.getElementById("division").value = doc.division;
    document.getElementById("status").value = doc.status;
    document.getElementById("remarks").value = doc.remarks || "";

    document.querySelector(".save-btn").innerHTML =
        '<i class="fa-solid fa-pen"></i> Update Document';

    modal.style.display = "flex";

});

// Delete button
row.querySelector(".delete-btn").addEventListener("click", function () {
    if (confirm("Are you sure you want to delete this document?")) {
        row.remove();
    }

});

modal.style.display = "none";

form.reset();

    });

updateDashboard();

}

// Load existing data
renderTable();
updateDashboard();

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