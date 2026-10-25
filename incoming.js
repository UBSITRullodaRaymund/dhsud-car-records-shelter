/* ==================================================
   DHSUD-CAR INCOMING DOCUMENTS
================================================== */

let incomingDocuments = [];

let editingDocumentId = null;

const INCOMING_SPREADSHEET_COLUMNS = [
    ["", "routingSlip"],
    ["DATE OF DOCUMENT", "dateDocument"],
    ["DATE RECEIVED", "dateReceived"],
    ["SENDER", "sender"],
    ["SIGNATORY", "signatory"],
    ["MODE OF COMMUNICATION", "mode"],
    ["SUBJECT", "subject"],
    ["DATE RELEASED", "dateReleased"],
    ["FROM", "from"],
    ["TO", "to"],
    ["ACTION NO.", "actionNo"],
    ["COMMENTS/ REMARKS", "comments"],
    ["RECEIVED BY", "receivedBy"],
    ["E-MAIL ADD", "email"],
    ["DEADLINE", "deadline"],
    ["STATUS", "status"],
    ["REMINDER SENT", "reminderSent"],
    ["Date Completed", "dateCompleted"]
];

/* ==================================================
   LOAD DATA
================================================== */

document.addEventListener("DOMContentLoaded", async function () {
    TablePagination.bindDetails(document.getElementById("masterlistBody"));
    await loadIncomingDocuments();

    const search = document.getElementById("masterlistSearch");

    if (search) {

        search.addEventListener("input", function () {
            TablePagination.reset(document.getElementById("masterlistBody"));
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

async function loadIncomingDocuments() {
    const result = await authedGet({
        action: "getDocuments",
        module: "incoming",
        sheet: "Incoming Documents",
        office: getRequestOffice()
    });
    if (!Array.isArray(result)) {
        incomingDocuments = [];
        renderMasterlist();
        const message = result && result.error ? result.error : "Unable to load incoming documents.";
        console.error(message);
        alert("Incoming documents could not be loaded from Google Sheets. Please try again. " + message);
        return;
    }

    incomingDocuments = result.map(function (record, index) {
        const normalized = normalizeRecordFields(record, "incoming");
        const routingSlip = normalized.routingSlip || normalized.tracking || "";
        return {
            ...normalized,
            id: routingSlip || String(index),
            routingSlip,
            mode: normalized.mode || normalized.communicationMode || "",
            routeTo: normalized.to || normalized.routeTo || ""
        };
    });
    renderMasterlist(document.getElementById("masterlistSearch")?.value || "");
}


/* ==================================================
   ADD / EDIT DOCUMENT
================================================== */

async function saveDocument(event) {

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

    const isEditing = Boolean(editingDocumentId);
    const editedRecord = isEditing
        ? incomingDocuments.find(record => record.id === editingDocumentId)
        : null;
    const formData = new FormData();
    formData.append("action", isEditing ? "update" : "save");
    formData.append("module", "incoming");
    formData.append("sheet", "Incoming Documents");
    formData.append("office", getRecordOffice(editedRecord));
    Object.entries(documentData).forEach(([key, value]) => formData.append(key, value));

    if (editingDocumentId) {
        formData.append("idField", "routingSlip");
        formData.append("idValue", editingDocumentId);
        formData.append("_syncVersion", editedRecord ? editedRecord._syncVersion || "" : "");
    } else {
        formData.append("to", "");
    }

    const result = await authedPost(formData);
    if (!result || result.error) {
        alert(result && result.error ? result.error : "Could not save the incoming document.");
        return;
    }

    await loadIncomingDocuments();
    event.target.reset();
    closeIncomingModal();
    alert(isEditing ? "Incoming document updated successfully." : "Incoming document added successfully.");

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


    TablePagination.render(body, filtered, function (doc) {
        const fragment = document.createDocumentFragment();
        const row = document.createElement("tr");
        TablePagination.makeExpandableRow(row);
        const summaryColumns = [
            ["Routing Slip No.", "routingSlip"],
            ["Date Received", "dateReceived"],
            ["Sender", "sender"],
            ["Subject", "subject"],
            ["Status", "status"]
        ];
        summaryColumns.forEach(([label, key]) => {
            const cell = document.createElement("td");
            cell.dataset.label = label;
            cell.textContent = doc[key] == null || doc[key] === "" ? "—" : String(doc[key]);
            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");
        actionCell.dataset.label = "Action";
        actionCell.className = "action-buttons";
        if (canEditRecordInOwnOffice(doc)) {
            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.className = "edit-btn";
            editButton.innerHTML = '<i class="fa-solid fa-pen" aria-hidden="true"></i> Edit';
            editButton.addEventListener("click", () => editIncomingDocument(doc.id));
            actionCell.appendChild(editButton);

            if (doc.routingSlip) {
                const deleteButton = document.createElement("button");
                deleteButton.type = "button";
                deleteButton.className = "delete-btn";
                deleteButton.setAttribute("aria-label", `Delete incoming document ${doc.routingSlip}`);
                deleteButton.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i> Delete';
                deleteButton.addEventListener("click", () => deleteIncomingDocument(doc));
                actionCell.appendChild(deleteButton);
            }
        }
        row.appendChild(actionCell);

        const fields = INCOMING_SPREADSHEET_COLUMNS.map(([label, key]) => {
            if (key === "to" && !canEditRecordInOwnOffice(doc)) {
                return [label, doc.routeTo || doc.to];
            }
            if (key !== "to") return [label, doc[key]];

            const select = document.createElement("select");
            select.className = "route-select";
            select.setAttribute("aria-label", "Route To");
            select.innerHTML = `
                <option value="">Select Department</option>
                <option value="HREDRD">HREDRD</option>
                <option value="HOACDD">HOACDD</option>
                <option value="ELUPDD">ELUPDD</option>
                <option value="PHSD">PHSD</option>
                <option value="AFD">AFD</option>
                <option value="ORD">ORD</option>
            `;
            select.value = doc.routeTo || doc.to || "";
            select.addEventListener("change", () => routeDocument(doc.id, select.value));
            return [label, select];
        });
        fields.unshift(["Record Office", doc._recordOffice]);
        fragment.append(row, TablePagination.createDetailsRow(fields, summaryColumns.length + 1));
        return fragment;
    });
    if (filtered.length === 0) {
        const emptyRow = document.createElement("tr");
        const emptyCell = document.createElement("td");
        emptyCell.colSpan = 6;
        emptyCell.className = "empty-masterlist";
        emptyCell.textContent = "No incoming documents found.";
        emptyRow.appendChild(emptyCell);
        body.appendChild(emptyRow);
    }

}


/* ==================================================
   EDIT DOCUMENT
================================================== */

async function deleteIncomingDocument(doc) {
    if (!doc || !doc.routingSlip || !canEditRecordInOwnOffice(doc)) return;
    if (!confirm(`Delete incoming document ${doc.routingSlip}?`)) return;

    const formData = new FormData();
    formData.append("action", "delete");
    formData.append("module", "incoming");
    formData.append("sheet", "Incoming Documents");
    formData.append("office", getRecordOffice(doc));
    formData.append("idField", "routingSlip");
    formData.append("idValue", doc.routingSlip);
    formData.append("_syncVersion", doc._syncVersion || "");

    const result = await authedPost(formData);
    if (!result || result.error) {
        alert(result && result.error ? result.error : "Could not delete the incoming document.");
        return;
    }

    await loadIncomingDocuments();
}

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

async function routeDocument(documentId, department) {
    const record = incomingDocuments.find(item => item.id === documentId);
    if (!record || !record.routingSlip) {
        alert("This document does not have a routing slip number and cannot be updated.");
        return;
    }

    const formData = new FormData();
    formData.append("action", "update");
    formData.append("module", "incoming");
    formData.append("sheet", "Incoming Documents");
    formData.append("office", getRecordOffice(record));
    formData.append("idField", "routingSlip");
    formData.append("idValue", record.routingSlip);
    formData.append("_syncVersion", record._syncVersion || "");
    formData.append("to", department);
    const result = await authedPost(formData);
    if (!result || result.error) {
        alert(result && result.error ? result.error : "Could not route the document.");
        await loadIncomingDocuments();
        return;
    }

    await loadIncomingDocuments();
    if (department) {
        alert("Document routed to " + getDepartmentName(department) + ".");
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