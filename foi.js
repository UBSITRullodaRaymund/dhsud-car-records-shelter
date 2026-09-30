/* FOI request registry */
const SHEET_NAME = "FOI";
const MODULE_NAME = "foi";
const FOI_OFFICES = [
    "Administrative and Finance Office",
    "Housing Real Estate Development Regulation Office",
    "Homeowners Association and Community Development Office",
    "Environmental, Land Use and Urban Planning Office",
    "Office of the Regional Director"
];
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
const validationOptions = {
    communicationMode: ["Mobile", "Email", "Postal"],
    idType: ["Postal ID", "Driver's License", "Passport", "Other"],
    documentType: ["Letter", "Memorandum", "Report", "Other"],
    proofOfId: ["Presented", "Not Presented", "N/A"],
    recommendation: ["Approved", "Denied", "Partially Successful"],
    decision: ["Approved", "Denied", "Partially Successful", "Incomplete"],
    registryAccomplished: ["Yes", "No"]
};
const tbody = document.getElementById("foiBody");
const form = document.getElementById("foiForm");
const modal = document.getElementById("foiModal");
const fieldsContainer = document.getElementById("foiFields");
const officeSelect = document.getElementById("officeSelect");

function getFoiOffice() {
    const user = getCurrentUser();
    return user && user.role === "SuperAdmin" && officeSelect.value
        ? officeSelect.value
    : user && user.office ? user.office : "";
}

function configureOfficeSelector() {
    const user = getCurrentUser();
    if (!user || user.role !== "SuperAdmin") return;

    document.getElementById("officeFilterBox").hidden = false;
    officeSelect.innerHTML = FOI_OFFICES.map(office => `<option value="${office}">${office}</option>`).join("");
    officeSelect.value = FOI_OFFICES.includes(user.office) ? user.office : FOI_OFFICES[0];
    officeSelect.addEventListener("change", () => {
        document.getElementById("searchInput").value = "";
        document.getElementById("decisionFilter").value = "";
        loadRequests();
    });
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function buildForm(options = {}) {
    fieldsContainer.innerHTML = fields.map(([key, label, type, required]) => {
        const choices = options[key];
        const control = Array.isArray(choices) && choices.length
            ? `<select id="${key}" ${required ? "required" : ""}><option value="">Select an option</option>${choices.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}</select>`
            : type === "textarea"
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
        office: getFoiOffice()
    });

    if (!Array.isArray(result)) {
        requests = [];
        console.error(result && result.error ? result.error : "Unable to load FOI requests", result);
        renderTable();
        return;
    }

    requests = result
        .map(record => normalizeRecordFields(record, MODULE_NAME))
        .filter(request => fields.some(([key]) => String(request[key] || "").trim() !== ""));
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
        row.innerHTML = `<td>${escapeHtml(request.transactionNo || "-")}</td><td>${escapeHtml(request.title || "-")}</td><td>${escapeHtml(request.name || "-")}</td><td>${escapeHtml(request.contactEmail || "-")}</td><td>${escapeHtml(request.documentRequested || "-")}</td><td>${escapeHtml(request.dateReceived || "-")}</td><td>${escapeHtml(request.decision || "-")}</td><td>${escapeHtml(request.dateFinished || "-")}</td><td class="action-buttons"><button class="icon-btn print-btn" onclick="printFoiRequest(${actualIndex})" title="Download filled FOI PDF form" aria-label="Download filled FOI PDF form"><i class="fa-solid fa-print"></i></button><button class="icon-btn edit-btn" onclick="editRequest(${actualIndex})" title="Edit"><i class="fa-solid fa-pen"></i></button><button class="icon-btn delete-btn" onclick="deleteRequest(${actualIndex})" title="Delete"><i class="fa-solid fa-trash"></i></button></td>`;
        tbody.appendChild(row);
    });
}

function printFoiRequest(index) {
    const request = requests[index];
    if (!request) return;
    if (!window.PDFLib) {
        alert("The PDF form tool did not load. Check your internet connection and try again.");
        return;
    }
    downloadFilledFoiPdf(request).catch(error => {
        console.error("FOI PDF generation failed", error);
        alert(`Could not fill the FOI PDF form: ${error.message}`);
    });
}

let foiTemplateBytesPromise;

function loadFoiTemplateBytes() {
    if (!foiTemplateBytesPromise) {
        foiTemplateBytesPromise = fetch("FOI%20FORM_2023_REV%2007.17.26%20.pdf")
            .then(response => {
                if (!response.ok) throw new Error("The FOI PDF template could not be loaded.");
                return response.arrayBuffer();
            })
            .then(buffer => new Uint8Array(buffer))
            .catch(error => {
                foiTemplateBytesPromise = null;
                throw error;
            });
    }
    return foiTemplateBytesPromise.then(bytes => bytes.slice());
}

// async function downloadFilledFoiPdf(request) {
//     const { PDFDocument, StandardFonts, rgb } = PDFLib;
//     const pdf = await PDFDocument.load(await loadFoiTemplateBytes());
//     if (pdf.getPageCount() !== 1) throw new Error("The selected form must be the one-page FOI template.");

//     const page = pdf.getPages()[0];
//     const form = pdf.getForm();
//     const pageSize = page.getSize();
//     if (Math.abs(pageSize.width - 612) > 1 || Math.abs(pageSize.height - 936) > 1) {
//         throw new Error("Select the blank FOI PDF template with the original page size.");
//     }
//     if (form.getFields().length) throw new Error("Select the blank FOI PDF template, not a previously filled copy.");
//     const font = await pdf.embedFont(StandardFonts.Helvetica);
//     const textField = (name, value, x, y, width, height, options = {}) => {
//         const field = form.createTextField(name);
//         if (options.multiline) field.enableMultiline();
//         field.setText(String(value || ""));
//         field.addToPage(page, {
//             x, y, width, height, font,
//             fontSize: 10,
//             textColor: rgb(0.08, 0.1, 0.12),
//             borderWidth: 0,
//             borderColor: rgb(1, 1, 1),
//             backgroundColor: undefined
//         });
//     };
//     const checkbox = (name, x, y, selected) => {
//         const field = form.createCheckBox(name);
//         field.addToPage(page, {
//             x, y, width: 7, height: 7,
//             borderWidth: 0,
//             backgroundColor: undefined
//         });
//         if (selected) field.check();
//     };
//     const normalized = value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
//     const nameParts = String(request.name || "").trim().split(/\s+/).filter(Boolean);
//     const givenName = nameParts.shift() || "";
//     const surname = nameParts.length ? nameParts.pop() : "";
//     const middleName = nameParts.join(" ");
//     const middleInitial = middleName ? `${middleName[0]}.` : "";

//     textField("transactionNo", request.transactionNo, 326, 812, 170, 12);
//     textField("requestingParty.title", request.title, 99, 750, 70, 12);
//     textField("requestingParty.givenName", givenName, 180, 750, 105, 12);
//     textField("requestingParty.middleInitial", middleInitial, 300, 750, 38, 12);
//     textField("requestingParty.surname", surname, 355, 750, 155, 12);
//     textField("requestingParty.address", request.address, 95, 724, 415, 13, { multiline: true });
//     textField("requestingParty.contact", request.contactEmail, 95, 702, 415, 13);

//     const communication = normalized(request.communicationMode);
//     [["landline", 99, "landline"], ["mobile", 183, "mobile"], ["email", 265, "email"], ["postal", 350, "postal"]]
//         .forEach(([name, x, match]) => checkbox(`communication.${name}`, x, 678, communication === match || (match === "postal" && communication === "postaladdress")));

//     const idType = normalized(request.idType);
//     const idOptions = [
//         ["passport", 99, 638], ["votersId", 185, 638], ["postalId", 266, 638],
//         ["driversLicense", 349, 638], ["sssId", 450, 638], ["schoolId", 99, 628],
//         ["companyId", 185, 628], ["others", 266, 628]
//     ];
//     idOptions.forEach(([name, x, y]) => {
//         const aliases = { votersId: "votersid", postalId: "postalid", driversLicense: "driverslicense", sssId: "sssid", schoolId: "schoolid", companyId: "companyid" };
//         checkbox(`requestingParty.id.${name}`, x, y, idType === (aliases[name] || name.toLowerCase()));
//     });

//     textField("requestedInformation.agency", request.agency, 95, 586, 415, 11);
//     textField("requestedInformation.documentRequested", request.documentRequested, 95, 566, 415, 28, { multiline: true });
//     textField("requestedInformation.datePeriod", request.datePeriod, 246, 545, 250, 12);
//     textField("requestedInformation.purpose", request.purpose, 95, 510, 415, 29, { multiline: true });
//     textField("requestedInformation.documentType", request.documentType, 95, 494, 165, 11);
//     textField("requestedInformation.referenceNo", request.referenceNo, 270, 482, 225, 10);
//     textField("requestedInformation.additionalInformation", request.additionalInformation, 260, 469, 235, 10);
//     textField("declaration.dateAccomplished", formatPrintDate(request.dateAccomplished), 350, 401, 145, 10);

//     textField("receivingOfficer.name", request.accomplishedBy, 95, 365, 190, 10);
//     textField("receivingOfficer.agency", request.accomplishedAgency, 300, 365, 205, 10);
//     textField("receivingOfficer.dateEnteredEfoi", formatPrintDate(request.dateEnteredEfoi), 95, 328, 190, 10);
//     textField("receivingOfficer.proofOfId", request.proofOfId, 300, 328, 205, 10);

//     const recommendation = normalized(request.recommendation);
//     checkbox("recommendation.approved", 273, 321, recommendation === "approved");
//     checkbox("recommendation.denied", 355, 321, recommendation === "denied");
//     const denial = normalized(request.denialReason);
//     checkbox("denialReason.invalidRequest", 273, 311, denial.includes("invalid"));
//     checkbox("denialReason.incomplete", 355, 311, denial.includes("incomplete"));
//     checkbox("denialReason.online", 426, 311, denial.includes("online"));
//     textField("receivingOfficer.secondOfficer", request.secondOfficer, 270, 299, 225, 11);
//     textField("receivingOfficer.decisionMaker", "", 270, 284, 225, 11);

//     const decision = normalized(request.decision);
//     checkbox("decision.successful", 211, 240, decision === "successful" || decision === "approved");
//     checkbox("decision.partiallySuccessful", 273, 240, decision === "partiallysuccessful");
//     checkbox("decision.denied", 356, 240, decision === "denied");
//     const decisionDenial = normalized(request.decisionDenialReason);
//     checkbox("decisionDenialReason.invalidRequest", 273, 231, decisionDenial.includes("invalid"));
//     checkbox("decisionDenialReason.incomplete", 355, 231, decision === "incomplete" || decisionDenial.includes("incomplete"));
//     checkbox("decisionDenialReason.online", 426, 231, decisionDenial.includes("online"));
//     textField("receivingOfficer.dateFinished", formatPrintDate(request.dateFinished), 205, 201, 95, 12);
//     const registry = normalized(request.registryAccomplished);
//     checkbox("registryAccomplished.yes", 438, 205, registry === "yes");
//     checkbox("registryAccomplished.no", 488, 205, registry === "no");

//     textField("acknowledgement.receivedDocuments", request.documentRequested, 88, 74, 420, 16, { multiline: true });
//     textField("acknowledgement.dateReceived", formatPrintDate(request.dateReceived), 205, 48, 115, 12);

//     form.flatten();
//     const blob = new Blob([await pdf.save()], { type: "application/pdf" });
//     const link = document.createElement("a");
//     const url = URL.createObjectURL(blob);
//     const transaction = String(request.transactionNo || "request").replace(/[^a-z0-9_-]/gi, "_");
//     link.href = url;
//     link.download = `FOI-${transaction}.pdf`;
//     document.body.appendChild(link);
//     link.click();
//     link.remove();
//     setTimeout(() => URL.revokeObjectURL(url), 1000);
// }

async function downloadFilledFoiPdf(request) {
    const { PDFDocument } = PDFLib;
    const pdf = await PDFDocument.load(await loadFoiTemplateBytes());
    const form = pdf.getForm();

    const safe = v => String(v == null ? "" : v);

    const setText = (name, value) => {
        try {
            form.getTextField(name).setText(safe(value));
        } catch (e) {
            console.warn(`Text field missing: ${name}`);
        }
    };

    const setCheck = (name, selected) => {
        try {
            const cb = form.getCheckBox(name);
            if (selected) cb.check();
            else cb.uncheck();
        } catch (e) {
            console.warn(`Checkbox missing: ${name}`);
        }
    };

    // ---- Name splitting ----
    const parts = safe(request.name).trim().split(/\s+/).filter(Boolean);
    const given = parts.shift() || "";
    const surname = parts.length ? parts.pop() : "";
    const middle = parts.join(" ");
    const middleInitial = middle ? `${middle[0]}.` : "";

    // ---- Text fields ----
    setText("transactionNo", request.transactionNo);
    setText("requestingParty.title", request.title);
    setText("requestingParty.givenName", given);
    setText("requestingParty.middleInitial", middleInitial);
    setText("requestingParty.surname", surname);
    setText("requestingParty.address", request.address);
    setText("requestingParty.contact", request.contactEmail);
    setText("requestedInformation.agency", request.agency);
    setText("requestedInformation.documentRequested", request.documentRequested);
    setText("requestedInformation.datePeriod", request.datePeriod);
    setText("requestedInformation.purpose", request.purpose);
    setText("requestedInformation.documentType", request.documentType);
    setText("requestedInformation.referenceNo", request.referenceNo);
    setText("requestedInformation.additionalInformation", request.additionalInformation);
    setText("declaration.dateAccomplished", formatPrintDate(request.dateAccomplished));
    setText("receivingOfficer.name", request.accomplishedBy);
    setText("receivingOfficer.agency", request.accomplishedAgency);
    setText("receivingOfficer.dateEnteredEfoi", formatPrintDate(request.dateEnteredEfoi));
    setText("receivingOfficer.proofOfId", request.proofOfId);
    setText("receivingOfficer.secondOfficer", request.secondOfficer);
    setText("receivingOfficer.decisionMaker", "");
    setText("receivingOfficer.dateFinished", formatPrintDate(request.dateFinished));
    setText("acknowledgement.receivedDocuments", request.documentRequested);
    setText("acknowledgement.dateReceived", formatPrintDate(request.dateReceived));

    // ---- Communication mode ----
    const comm = safe(request.communicationMode).toLowerCase();
    setCheck("communication.landline", comm === "landline");
    setCheck("communication.mobile", comm === "mobile");
    setCheck("communication.email", comm === "email");
    setCheck("communication.postal", comm === "postal" || comm === "postal address");

    // ---- ID type ----
    const id = safe(request.idType).toLowerCase().replace(/[^a-z]/g, "");
    setCheck("requestingParty.id.passport", id === "passport");
    setCheck("requestingParty.id.votersId", id === "votersid");
    setCheck("requestingParty.id.postalId", id === "postalid");
    setCheck("requestingParty.id.driversLicense", id === "driverslicense");
    setCheck("requestingParty.id.sssId", id === "sssid");
    setCheck("requestingParty.id.schoolId", id === "schoolid");
    setCheck("requestingParty.id.companyId", id === "companyid");
    setCheck("requestingParty.id.others", id === "others");

    // ---- Recommendation ----
    const rec = safe(request.recommendation).toLowerCase();
    setCheck("recommendation.approved", rec === "approved");
    setCheck("recommendation.denied", rec === "denied");

    // ---- Denial reason (recommendation) ----
    const denial = safe(request.denialReason).toLowerCase();
    setCheck("denialReason.invalidRequest", denial.includes("invalid"));
    setCheck("denialReason.incomplete", denial.includes("incomplete"));
    setCheck("denialReason.online", denial.includes("online"));

    // ---- Decision ----
    const dec = safe(request.decision).toLowerCase().replace(/[^a-z]/g, "");
    setCheck("decision.successful", dec === "successful" || dec === "approved");
    setCheck("decision.partiallySuccessful", dec === "partiallysuccessful");
    setCheck("decision.denied", dec === "denied");

    // ---- Decision denial reason ----
    const decDen = safe(request.decisionDenialReason).toLowerCase();
    setCheck("decisionDenialReason.invalidRequest", decDen.includes("invalid"));
    setCheck("decisionDenialReason.incomplete", decDen.includes("incomplete") || dec === "incomplete");
    setCheck("decisionDenialReason.online", decDen.includes("online"));

    // ---- Registry accomplished ----
    const reg = safe(request.registryAccomplished).toLowerCase();
    setCheck("registryAccomplished.yes", reg === "yes");
    setCheck("registryAccomplished.no", reg === "no");

    // ---- Flatten so the fields become permanent ----
    form.flatten();

    // ---- Download ----
    const blob = new Blob([await pdf.save()], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `FOI-${safe(request.transactionNo || "request").replace(/[^a-z0-9_-]/gi, "_")}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatPrintDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return [String(date.getDate()).padStart(2, "0"), String(date.getMonth() + 1).padStart(2, "0"), date.getFullYear()].join("/");
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
    fields.forEach(([key, , type]) => {
        const input = document.getElementById(key);
        const value = request ? request[key] || "" : "";
        input.value = type === "date" ? toDateInputValue(value) : value;
        input.disabled = key === "transactionNo" && Boolean(request);
    });
    modal.style.display = "flex";
}

function toDateInputValue(value) {
    if (!value) return "";
    const text = String(value).trim();
    const dateOnly = text.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateOnly) return dateOnly[1];

    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return "";
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function closeForm() { modal.style.display = "none"; }
function editRequest(index) { openForm(requests[index]); }

async function deleteRequest(index) {
    const request = requests[index];
    if (!request || !confirm(`Delete FOI request ${request.transactionNo || "this record"}?`)) return;
    const result = await authedPost(buildFormData({
        action: "delete", module: MODULE_NAME, sheet: SHEET_NAME,
        office: getFoiOffice(), idField: "transactionNo", idValue: request.transactionNo
    }));
    if (!result || result.error) { alert(result ? result.error : "Delete failed"); return; }
    await loadRequests();
}

form.addEventListener("submit", async event => {
    event.preventDefault();
    try {
        const values = {};
        fields.forEach(([key]) => { values[key] = document.getElementById(key).value; });
        const payload = editingIndex === -1
            ? { action: "save", module: MODULE_NAME, sheet: SHEET_NAME, office: getFoiOffice(), ...values }
            : { action: "update", module: MODULE_NAME, sheet: SHEET_NAME, office: getFoiOffice(), idField: "transactionNo", idValue: requests[editingIndex].transactionNo, ...values };
        const result = await authedPost(buildFormData(payload));
        if (!result || result.error) { alert(result && result.error ? result.error : "Save failed"); return; }
        if (payload.action === "save") {
            const destination = result.spreadsheetUrl
                ? `\n${result.office} / ${result.spreadsheetName} / ${result.sheetName}, row ${result.row}\n${result.spreadsheetUrl}`
                : "";
            alert(`FOI request saved.${destination}`);
        }
        closeForm();
        await loadRequests();
    } catch (error) {
        console.error("FOI save failed", error);
        alert(`FOI save failed: ${error.message}`);
    }
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
document.getElementById("searchInput").addEventListener("search", renderTable);
document.getElementById("decisionFilter").addEventListener("change", renderTable);
window.addEventListener("click", event => { if (event.target === modal) closeForm(); });

document.addEventListener("DOMContentLoaded", () => {
    configureOfficeSelector();
    buildForm(validationOptions);
    loadRequests();
});
