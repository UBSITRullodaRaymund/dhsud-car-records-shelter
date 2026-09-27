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

    }

});


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

}


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

            return;

        }


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

    }

});


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