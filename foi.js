/* FOI request registry */
const SHEET_NAME = "FOI";
const MODULE_NAME = "foi";
requireLogin();

const fields = [
    ["transactionNo", "TRANSACTION NO", "text", true],
    ["title", "TITLE", "text", true],
    ["name", "NAME", "text", true],
    ["address", "ADDRESS", "textarea", false],
    ["contactEmail", "CONTACT NO / EMAIL", "text", true],
    ["communicationMode", "MODE OF COMMUNICATION", "text", false],
    ["idType", "TYPE OF ID", "text", false],
    ["agency", "AGENCY / CONNECTING AGENCY", "text", false],
    ["documentRequested", "TITLE OF DOCUMENT / RECORD REQUESTED", "textarea", true],
    ["datePeriod", "DATE / PERIOD", "text", false],
    ["purpose", "PURPOSE OF REQUEST", "textarea", false],
    ["documentType", "DOCUMENT TYPE", "text", false],
    ["referenceNo", "REFERENCE NO", "text", false],
    ["additionalInformation", "ADDITIONAL INFORMATION", "textarea", false],
    ["dateAccomplished", "DATE ACCOMPLISHED", "date", false],
    ["accomplishedBy", "NAME", "text", false],
    ["accomplishedAgency", "AGENCY-CONNECTING AGENCY", "text", false],
    ["dateEnteredEfoi", "DATE ENTERED ON E-FOI", "date", false],
    ["proofOfId", "PROOF OF ID PRESENTED", "text", false],
    ["recommendation", "REQUEST IS RECOMMENDED TO BE", "text", false],
    ["denialReason", "IF DENIED: REASON FOR DENIAL", "textarea", false],
    ["secondOfficer", "SECOND RECEIVING OFFICER ASSIGNED", "text", false],
    ["decision", "DECISION ON APPLICATION", "text", false],
    ["decisionDenialReason", "IF DENIED REASON FOR DENIAL", "textarea", false],
    ["dateFinished", "DATE REQUEST FINISHED", "date", false],
    ["registryAccomplished", "FOI REGISTRY ACCOMPLISHED", "text", false],
    ["dateReceived", "DATE RECEIVED", "date", false]
];

let requests = [];
let editingIndex = -1;
const tbody = document.getElementById("foiBody");
const form = document.getElementById("foiForm");
const modal = document.getElementById("foiModal");
const fieldsContainer = document.getElementById("foiFields");

function buildForm() {
    fieldsContainer.innerHTML = fields.map(([key, label, type, required]) => {
        const control = type === "textarea"
            ? `<textarea id="${key}" ${required ? "required" : ""}></textarea>`
            : `<input id="${key}" type="${type}" ${required ? "required" : ""}>`;
        return `<div class="${type === "textarea" ? "full" : ""}"><label for="${key}">${label}${required ? " *" : ""}</label>${control}</div>`;
    }).join("");
}

async function loadRequests() {
    const result = await authedGet({
        action: "getDocuments",
        module: MODULE_NAME,
        sheet: SHEET_NAME,
        office: getRequestOffice()
    });

    if (!Array.isArray(result)) {
        requests = [];
        console.error(result && result.error ? result.error : "Unable to load FOI requests", result);
        renderTable();
        return;
    }

    requests = result.map(record => normalizeRecordFields(record, MODULE_NAME));
    renderTable();
    populateDecisions();
}

function renderTable() {
    const search = document.getElementById("searchInput").value.trim().toLowerCase();
    const decision = document.getElementById("decisionFilter").value;
    const filtered = requests.filter(request => {
        const text = [request.transactionNo, request.title, request.name, request.contactEmail, request.documentRequested, request.referenceNo]
            .map(value => String(value || "").toLowerCase()).join(" ");
        return text.includes(search) && (!decision || request.decision === decision);
    });

    tbody.innerHTML = "";
    document.getElementById("emptyState").style.display = filtered.length ? "none" : "flex";
    filtered.forEach((request, index) => {
        const actualIndex = requests.indexOf(request);
        const row = document.createElement("tr");
        row.innerHTML = `<td>${request.transactionNo || "-"}</td><td>${request.title || "-"}</td><td>${request.name || "-"}</td><td>${request.contactEmail || "-"}</td><td>${request.documentRequested || "-"}</td><td>${request.dateReceived || "-"}</td><td>${request.decision || "-"}</td><td>${request.dateFinished || "-"}</td><td class="action-buttons"><button class="icon-btn edit-btn" onclick="editRequest(${actualIndex})" title="Edit"><i class="fa-solid fa-pen"></i></button><button class="icon-btn delete-btn" onclick="deleteRequest(${actualIndex})" title="Delete"><i class="fa-solid fa-trash"></i></button></td>`;
        tbody.appendChild(row);
    });
}

function populateDecisions() {
    const select = document.getElementById("decisionFilter");
    const current = select.value;
    const decisions = [...new Set(requests.map(request => request.decision).filter(Boolean))].sort();
    select.innerHTML = '<option value="">All Decisions</option>' + decisions.map(value => `<option>${value}</option>`).join("");
    select.value = decisions.includes(current) ? current : "";
}

function openForm(request = null) {
    editingIndex = request ? requests.indexOf(request) : -1;
    document.getElementById("modalTitle").textContent = request ? "Edit FOI Request" : "New FOI Request";
    fields.forEach(([key]) => {
        const input = document.getElementById(key);
        input.value = request ? request[key] || "" : "";
        input.disabled = key === "transactionNo" && Boolean(request);
    });
    modal.style.display = "flex";
}

function closeForm() { modal.style.display = "none"; }
function editRequest(index) { openForm(requests[index]); }

async function deleteRequest(index) {
    const request = requests[index];
    if (!request || !confirm(`Delete FOI request ${request.transactionNo || "this record"}?`)) return;
    const result = await authedPost(buildFormData({
        action: "delete", module: MODULE_NAME, sheet: SHEET_NAME,
        office: getRequestOffice(), idField: "transactionNo", idValue: request.transactionNo
    }));
    if (!result || result.error) { alert(result ? result.error : "Delete failed"); return; }
    await loadRequests();
}

form.addEventListener("submit", async event => {
    event.preventDefault();
    const values = {};
    fields.forEach(([key]) => { values[key] = document.getElementById(key).value; });
    const payload = editingIndex === -1
        ? { action: "save", module: MODULE_NAME, sheet: SHEET_NAME, office: getRequestOffice(), ...values }
        : { action: "update", module: MODULE_NAME, sheet: SHEET_NAME, office: getRequestOffice(), idField: "transactionNo", idValue: requests[editingIndex].transactionNo, ...values };
    const result = await authedPost(buildFormData(payload));
    if (!result || result.error) { alert(result ? result.error : "Save failed"); return; }
    closeForm();
    await loadRequests();
});

function buildFormData(values) {
    const data = new FormData();
    Object.entries(values).forEach(([key, value]) => data.append(key, value == null ? "" : value));
    return data;
}

document.getElementById("openModal").addEventListener("click", () => openForm());
document.getElementById("closeModal").addEventListener("click", closeForm);
document.getElementById("cancelModal").addEventListener("click", closeForm);
document.getElementById("searchInput").addEventListener("input", renderTable);
document.getElementById("decisionFilter").addEventListener("change", renderTable);
window.addEventListener("click", event => { if (event.target === modal) closeForm(); });

document.addEventListener("DOMContentLoaded", () => { buildForm(); loadRequests(); });
