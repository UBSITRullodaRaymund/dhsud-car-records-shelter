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

const denialReasonOptions = [
    ["Invalid Request", "Invalid Request"],
    ["Incomplete", "Incomplete"],
    ["Data already available online", "Data already available online"]
];

const fields = [
    ["transactionNo", "TRANSACTION NO", "text", true],
    ["title", "TITLE", "select", true],
    ["givenName", "GIVEN NAME", "text", true],
    ["surname", "SURNAME", "text", true],
    ["address", "ADDRESS", "textarea", false],
    ["contactEmail", "CONTACT NO / EMAIL", "text", true],
    ["communicationMode", "MODE OF COMMUNICATION", "text", false],
    ["idType", "TYPE OF ID", "text", false],
    ["agency", "AGENCY / CONNECTING AGENCY", "text", false],
    ["documentRequested", "TITLE OF DOCUMENT / RECORD REQUESTED", "textarea", true],
    ["receivedDocumentTitle", "RECEIVED DOCUMENT TITLE", "textarea", false],
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
    ["recommendation", "REQUEST IS RECOMMENDED TO BE", "select", false],
    ["denialReason", "IF DENIED: REASON FOR DENIAL", "select", false],
    ["secondOfficer", "SECOND RECEIVING OFFICER ASSIGNED", "text", false],
    ["decision", "DECISION ON APPLICATION", "select", false],
    ["decisionCost", "NUMBER", "number", false],
    ["decisionDenialReason", "IF DENIED REASON FOR DENIAL", "select", false],
    ["dateFinished", "DATE REQUEST FINISHED", "date", false],
    ["registryAccomplished", "FOI REGISTRY ACCOMPLISHED", "text", false],
    ["dateReceived", "DATE RECEIVED", "date", false]
];

let requests = [];
let editingIndex = -1;
const PAGE_SIZE = 12;
const listCache = new Map();
let pageState = { page: 1, totalPages: 1, total: 0, pageSize: PAGE_SIZE };
const validationOptions = {
    title: ["Mr", "Ms", "Mrs", "Miss"],
    communicationMode: ["Mobile", "Email", "Postal", "Landline"],
    idType: ["Postal ID", "Driver's License", "Passport","Voter's ID","Postal ID", "SSS ID", "School ID", "Company ID", "Others"],
    documentType: ["Letter", "Memorandum", "Report", "Other"],
    proofOfId: ["Presented", "Not Presented", "N/A"],
    recommendation: ["Approved", "Denied", "Partially Successful"],
    decision: ["Approved", "Denied", "Partially Successful", "Incomplete", "Cost"],
    registryAccomplished: ["Yes", "No"]
};
const tbody = document.getElementById("foiBody");
const form = document.getElementById("foiForm");
const modal = document.getElementById("foiModal");
const previewModal = document.getElementById("foiPreviewModal");
const previewFrame = document.getElementById("foiPreviewFrame");
const previewOpenLink = document.getElementById("foiPreviewOpen");
const previewDownloadLink = document.getElementById("foiPreviewDownload");
const fieldsContainer = document.getElementById("foiFields");
const officeSelect = document.getElementById("officeSelect");
const searchInput = document.getElementById("searchInput");
let foiPreviewUrl = null;
let searchDebounceTimer = null;

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

function buildSelectField(key, label, required, choices = []) {
    const optionList = choices.length
        ? `<option value="">Select an option</option>${choices.map((choice) => {
            const value = Array.isArray(choice) ? choice[0] : choice;
            const text = Array.isArray(choice) ? choice[1] : choice;
            return `<option value="${escapeHtml(value)}">${escapeHtml(text)}</option>`;
        }).join("")}`
        : `<option value="">Select an option</option>`;
    return `<div class="full"><label for="${key}">${label}${required ? " *" : ""}</label><select id="${key}" ${required ? "required" : ""}>${optionList}</select></div>`;
}

function buildForm(options = {}) {
    const maxLengths = { transactionNo: 5, title: 50, givenName: 100, surname: 100, address: 500, contactEmail: 254, communicationMode: 30, idType: 50, agency: 200, documentRequested: 2000, receivedDocumentTitle: 2000, datePeriod: 100, purpose: 2000, documentType: 50, referenceNo: 100, additionalInformation: 2000, accomplishedBy: 100, accomplishedAgency: 150, proofOfId: 30, recommendation: 50, denialReason: 1000, secondOfficer: 100, decision: 50, decisionCost: 20, decisionDenialReason: 1000, registryAccomplished: 10, dateAccomplished: 10, dateEnteredEfoi: 10, dateFinished: 10, dateReceived: 10 };
    fieldsContainer.innerHTML = fields.map(([key, label, type, required]) => {
        const choices = key === "denialReason" || key === "decisionDenialReason" ? denialReasonOptions : options[key];
        const maxLength = maxLengths[key] || 1000;
        if (key === "decisionCost") {
            return `<div class="full" data-decision-cost-group style="display:none;"><label for="${key}">${label}${required ? " *" : ""}</label><input id="${key}" type="${type}" min="0" ${type === "number" ? 'step="0.01"' : ""} ${required ? "required" : ""}></div>`;
        }
        if (type === "select") {
            return buildSelectField(key, label, required, choices || []);
        }
        const control = Array.isArray(choices) && choices.length && typeof choices[0] !== "string"
            ? `<select id="${key}" ${required ? "required" : ""}><option value="">Select an option</option>${choices.map(value => `<option value="${escapeHtml(value[0])}">${escapeHtml(value[1])}</option>`).join("")}</select>`
            : Array.isArray(choices) && choices.length
            ? `<select id="${key}" ${required ? "required" : ""}><option value="">Select an option</option>${choices.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}</select>`
            : type === "textarea"
            ? `<textarea id="${key}" maxlength="${maxLength}" ${required ? "required" : ""}></textarea>`
            : key === "transactionNo"
            ? `<input id="${key}" type="hidden"><div class="transaction-digits" role="group" aria-label="Transaction number, five digits">${Array.from({ length: 5 }, (_, index) => `<input class="transaction-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" aria-label="Transaction number digit ${index + 1}"${required ? " required" : ""}>`).join("")}</div>`
            : `<input id="${key}" type="${type}" ${type === "date" ? `max="9999-12-31"` : `maxlength="${maxLength}"`} ${required ? "required" : ""}>`;
        return `<div class="${type === "textarea" ? "full" : ""}"><label for="${key}">${label}${required ? " *" : ""}</label>${control}</div>`;
    }).join("");
    syncDecisionCostFields();
}

function syncDecisionCostFields() {
    const decisionField = document.getElementById("decision");
    const costFields = document.querySelectorAll("[data-decision-cost-group]");
    if (!decisionField) return;
    const show = decisionField.value === "Cost";
    costFields.forEach(field => {
        field.style.display = show ? "block" : "none";
        const input = field.querySelector("input");
        if (input) {
            input.disabled = !show;
            if (!show) {
                input.value = "";
            }
        }
    });
}

function updatePagination() {
    const prevBtn = document.getElementById("prevPageBtn");
    const currentBtn = document.getElementById("currentPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");
    if (!prevBtn || !currentBtn || !nextBtn) return;

    currentBtn.textContent = String(pageState.page);
    prevBtn.disabled = pageState.page <= 1;
    nextBtn.disabled = pageState.page >= pageState.totalPages;

    const showingCount = document.getElementById("showingCount");
    const totalCount = document.getElementById("totalCount");
    if (showingCount) showingCount.textContent = String(requests.length || 0);
    if (totalCount) totalCount.textContent = String(pageState.total || 0);
}

function applyPageResponse(payload) {
    const nextRequests = Array.isArray(payload && payload.records) ? payload.records : [];
    requests = nextRequests
        .map(record => normalizeRecordFields(record, MODULE_NAME))
        .filter(request => fields.some(([key]) => String(request[key] || "").trim() !== ""));

    pageState = {
        page: Number(payload && payload.page) || 1,
        totalPages: Number(payload && payload.totalPages) || 1,
        total: Number(payload && payload.total) || requests.length,
        pageSize: Number(payload && payload.pageSize) || PAGE_SIZE
    };

    renderTable();
    populateDecisions();
    updatePagination();
}

async function loadRequests(page = 1) {
    const search = searchInput ? searchInput.value.trim() : "";
    const cacheKey = JSON.stringify({
        office: getFoiOffice(),
        module: MODULE_NAME,
        sheet: SHEET_NAME,
        page,
        pageSize: PAGE_SIZE,
        search
    });

    if (listCache.has(cacheKey)) {
        applyPageResponse(listCache.get(cacheKey));
        return;
    }

    const result = await authedGet({
        action: "getDocuments",
        module: MODULE_NAME,
        sheet: SHEET_NAME,
        office: getFoiOffice(),
        page,
        pageSize: PAGE_SIZE,
        search
    });

    if (!result || !result.records) {
        if (Array.isArray(result)) {
            requests = result
                .map(record => normalizeRecordFields(record, MODULE_NAME))
                .filter(request => fields.some(([key]) => String(request[key] || "").trim() !== ""));
            pageState = { page: 1, totalPages: 1, total: requests.length, pageSize: PAGE_SIZE };
            renderTable();
            populateDecisions();
            updatePagination();
            return;
        }

        requests = [];
        console.error(result && result.error ? result.error : "Unable to load FOI requests", result);
        renderTable();
        updatePagination();
        return;
    }

    listCache.set(cacheKey, result);
    applyPageResponse(result);
}

function renderTable() {
    const search = searchInput.value.trim().toLowerCase();
    const decision = document.getElementById("decisionFilter").value;
    const filtered = requests.filter((request) => {
        const text = [request.transactionNo, request.title, request.name, request.contactEmail, request.documentRequested, request.referenceNo]
            .map(value => String(value || "").toLowerCase()).join(" ");
        return text.includes(search) && (!decision || request.decision === decision);
    });

    const fragment = document.createDocumentFragment();
    filtered.forEach((request) => {
        const actualIndex = requests.indexOf(request);
        const row = document.createElement("tr");
        row.innerHTML = `<td>${escapeHtml(request.transactionNo || "-")}</td><td>${escapeHtml(request.title || "-")}</td><td>${escapeHtml(request.name || "-")}</td><td>${escapeHtml(request.contactEmail || "-")}</td><td>${escapeHtml(request.documentRequested || "-")}</td><td>${escapeHtml(request.dateReceived || "-")}</td><td>${escapeHtml(request.decision || "-")}</td><td>${escapeHtml(request.dateFinished || "-")}</td><td class="action-buttons"><button class="icon-btn preview-btn" data-action="preview" data-index="${actualIndex}" title="Preview filled FOI PDF" aria-label="Preview filled FOI PDF"><i class="fa-solid fa-eye"></i></button><button class="icon-btn print-btn" data-action="print" data-index="${actualIndex}" title="Download filled FOI PDF form" aria-label="Download filled FOI PDF form"><i class="fa-solid fa-print"></i></button><button class="icon-btn edit-btn" data-action="edit" data-index="${actualIndex}" title="Edit"><i class="fa-solid fa-pen"></i></button><button class="icon-btn delete-btn" data-action="delete" data-index="${actualIndex}" title="Delete"><i class="fa-solid fa-trash"></i></button></td>`;
        fragment.appendChild(row);
    });

    tbody.innerHTML = "";
    tbody.appendChild(fragment);
    document.getElementById("emptyState").style.display = filtered.length ? "none" : "flex";
}

async function printFoiRequest(index) {
    const request = requests[index];
    if (!request) return;
    if (!window.PDFLib) {
        alert("The PDF form tool did not load. Check your internet connection and try again.");
        return;
    }
    try {
        const blob = await createFilledFoiPdf(request);
        downloadFoiPdf(blob, request);
    } catch (error) {
        console.error("FOI PDF generation failed", error);
        alert(`Could not fill the FOI PDF form: ${error.message}`);
    }
}

async function previewFoiRequest(index) {
    const request = requests[index];
    if (!request) return;
    if (!window.PDFLib) {
        alert("The PDF form tool did not load. Check your internet connection and try again.");
        return;
    }

    try {
        const blob = await createFilledFoiPdf(request);
        if (foiPreviewUrl) URL.revokeObjectURL(foiPreviewUrl);
        foiPreviewUrl = URL.createObjectURL(blob);
        previewFrame.src = foiPreviewUrl;
        previewOpenLink.href = foiPreviewUrl;
        previewDownloadLink.href = foiPreviewUrl;
        previewDownloadLink.download = getFoiPdfFilename(request);
        previewModal.style.display = "flex";
        previewModal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    } catch (error) {
        console.error("FOI PDF preview failed", error);
        alert(`Could not preview the FOI PDF: ${error.message}`);
    }
}

function closeFoiPreview() {
    previewModal.style.display = "none";
    previewModal.setAttribute("aria-hidden", "true");
    previewFrame.src = "about:blank";
    document.body.style.overflow = "";
    if (foiPreviewUrl) {
        URL.revokeObjectURL(foiPreviewUrl);
        foiPreviewUrl = null;
    }
}

function getFoiPdfFilename(request) {
    const transaction = String(request.transactionNo || "request").replace(/[^a-z0-9_-]/gi, "_");
    return `FOI-${transaction}.pdf`;
}

function downloadFoiPdf(blob, request) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getFoiPdfFilename(request);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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

async function createFilledFoiPdf(request) {
    const { PDFDocument } = PDFLib;
    const pdf = await PDFDocument.load(await loadFoiTemplateBytes());
    const form = pdf.getForm();
    const fields = form.getFields();

    if (!fields.length) {
        return createStaticFoiPdf(pdf, request);
    }

    const availableFields = new Set(fields.map(field => field.getName()));
    const requiredFields = [
        "transactionNo",
        "requestingParty.givenName",
        "requestingParty.surname",
        "requestedInformation.documentRequested"
    ];
    const missingRequiredFields = requiredFields.filter(name => !availableFields.has(name));
    if (missingRequiredFields.length) {
        fields.forEach(field => form.removeField(field));
        return createStaticFoiPdf(pdf, request);
    }

    const safe = v => String(v == null ? "" : v);

    const setText = (name, value) => {
        if (!availableFields.has(name)) return;
        form.getTextField(name).setText(safe(value));
    };

    const setCheck = (name, selected) => {
        if (!availableFields.has(name)) return;
        const cb = form.getCheckBox(name);
        if (selected) cb.check();
        else cb.uncheck();
    };

    // ---- Name splitting ----
    const parts = safe(request.name).trim().split(/\s+/).filter(Boolean);
    const given = safe(request.givenName).trim() || parts.shift() || "";
    const surname = safe(request.surname).trim() || (parts.length ? parts.pop() : "");
    const middle = request.givenName || request.surname ? "" : parts.join(" ");
    const middleInitial = middle ? `${middle[0]}.` : "";

    // ---- Text fields ----
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
    setText("acknowledgement.receivedDocuments", request.receivedDocumentTitle);
    setText("acknowledgement.dateReceived", formatPrintDateSeparated(request.dateReceived));

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
    const denial = safe(request.denialReason).toLowerCase();
    setCheck("recommendation.approved", rec === "approved");
    setCheck("recommendation.denied", rec === "denied");

    // ---- Denial reason (recommendation) ----
    setCheck("denialReason.invalidRequest", /invalid/.test(denial));
    setCheck("denialReason.incomplete", /incomplete/.test(denial));
    setCheck("denialReason.online", /online|available online/.test(denial));

    // ---- Decision ----
    const dec = safe(request.decision).toLowerCase().replace(/[^a-z]/g, "");
    const decDen = safe(request.decisionDenialReason).toLowerCase();
    setCheck("decision.successful", dec === "successful" || dec === "approved");
    setCheck("decision.partiallySuccessful", dec === "partiallysuccessful");
    setCheck("decision.denied", dec === "denied");

    // ---- Decision denial reason ----
    setCheck("decisionDenialReason.invalidRequest", /invalid/.test(decDen));
    setCheck("decisionDenialReason.incomplete", /incomplete/.test(decDen) || dec === "incomplete");
    setCheck("decisionDenialReason.online", /online|available online/.test(decDen));

    // ---- Registry accomplished ----
    const reg = safe(request.registryAccomplished).toLowerCase();
    setCheck("registryAccomplished.yes", reg === "yes");
    setCheck("registryAccomplished.no", reg === "no");

    form.removeField(form.getTextField("transactionNo"));
    const page = pdf.getPages()[0];
    const { width, height } = page.getSize();
    const font = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
    drawTransactionDigits(page, font, request.transactionNo, width / 612, height / 936);

    // ---- Flatten so the fields become permanent ----
    form.flatten();

    return new Blob([await pdf.save()], { type: "application/pdf" });
}

function drawTransactionDigits(page, font, value, scaleX, scaleY) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 5);
    const startX = 445;
    const startY = 817;
    const cellWidth = 16;
    const digitOffsets = [0, 16, 40, 52, 64];
    const cellHeight = 12;
    const fontSize = 8 * Math.min(scaleX, scaleY);
    const scaledCellWidth = cellWidth * scaleX;
    const scaledCellHeight = cellHeight * scaleY;

    digits.split("").forEach((digit, index) => {
        const digitWidth = font.widthOfTextAtSize(digit, fontSize);
        page.drawText(digit, {
            x: (startX + digitOffsets[index]) * scaleX + (scaledCellWidth - digitWidth) / 2,
            y: startY * scaleY + (scaledCellHeight - fontSize) / 2,
            size: fontSize,
            font,
            color: PDFLib.rgb(0.08, 0.1, 0.12)
        });
    });
}

async function createStaticFoiPdf(pdf, request) {
    const { StandardFonts, rgb } = PDFLib;
    if (pdf.getPageCount() !== 1) {
        throw new Error("The static FOI template must be a one-page PDF.");
    }

    const page = pdf.getPages()[0];
    const { width, height } = page.getSize();
    const templateWidth = 612;
    const templateHeight = 936;
    const scaleX = width / templateWidth;
    const scaleY = height / templateHeight;
    const fontScale = Math.min(scaleX, scaleY);
    if (Math.abs(width / height - templateWidth / templateHeight) > 0.025) {
        throw new Error(`The static FOI template has incompatible proportions (${width} x ${height} points).`);
    }

    const font = await pdf.embedFont(StandardFonts.Helvetica);
    drawTransactionDigits(page, font, request.transactionNo, scaleX, scaleY);
    const textField = (value, x, y, fieldWidth, fieldHeight, options = {}) => {
        const text = String(value == null ? "" : value).replace(/[\r\n]+/g, " ").trim();
        if (!text) return;

        const inset = 2 * fontScale;
        const scaledWidth = fieldWidth * scaleX;
        const scaledHeight = fieldHeight * scaleY;
        const maxWidth = scaledWidth - inset * 2;
        let fontSize = (options.fontSize || 8) * fontScale;
        const minFontSize = 5.5 * fontScale;

        if (options.multiline) {
            const wrap = size => {
                const lines = [];
                let line = "";
                const pushWord = word => {
                    let remainder = word;
                    while (remainder && font.widthOfTextAtSize(remainder, size) > maxWidth) {
                        let splitAt = remainder.length;
                        while (splitAt > 1 && font.widthOfTextAtSize(remainder.slice(0, splitAt), size) > maxWidth) splitAt--;
                        if (line) lines.push(line);
                        lines.push(remainder.slice(0, splitAt));
                        remainder = remainder.slice(splitAt);
                        line = "";
                    }
                    if (!remainder) return;
                    const candidate = line ? `${line} ${remainder}` : remainder;
                    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
                        lines.push(line);
                        line = remainder;
                    } else {
                        line = candidate;
                    }
                };
                text.split(/\s+/).forEach(pushWord);
                if (line) lines.push(line);
                return lines;
            };

            let lines = wrap(fontSize);
            while (lines.length * fontSize * 1.12 > scaledHeight - inset * 2 && fontSize > minFontSize) {
                fontSize = Math.max(minFontSize, fontSize - 0.5 * fontScale);
                lines = wrap(fontSize);
            }

            const maxLines = Math.max(1, Math.floor((scaledHeight - inset * 2) / (fontSize * 1.12)));
            if (lines.length > maxLines) {
                lines = lines.slice(0, maxLines);
                let lastLine = lines[maxLines - 1];
                while (lastLine.length && font.widthOfTextAtSize(`${lastLine}...`, fontSize) > maxWidth) {
                    lastLine = lastLine.slice(0, -1).trimEnd();
                }
                lines[maxLines - 1] = lastLine ? `${lastLine}...` : "...";
            }

            lines.forEach((line, index) => page.drawText(line, {
                x: x * scaleX + inset,
                y: y * scaleY + scaledHeight - inset - fontSize - index * fontSize * 1.12,
                size: fontSize,
                font,
                color: rgb(0.08, 0.1, 0.12)
            }));
            return;
        }

        while (font.widthOfTextAtSize(text, fontSize) > maxWidth && fontSize > minFontSize) {
            fontSize = Math.max(minFontSize, fontSize - 0.5 * fontScale);
        }
        let fitted = text;
        while (fitted.length && font.widthOfTextAtSize(fitted, fontSize) > maxWidth) {
            fitted = fitted.slice(0, -1).trimEnd();
        }
        if (fitted !== text && fitted.length > 3) fitted = `${fitted.slice(0, -3)}...`;
        page.drawText(fitted, {
            x: x * scaleX + inset,
            y: y * scaleY + Math.max(1, (scaledHeight - fontSize) / 2),
            size: fontSize,
            font,
            color: rgb(0.08, 0.1, 0.12)
        });
    };
    const checkbox = (name, x, y, selected) => {
        if (!selected) return;
        const boxX = x * scaleX;
        const boxY = y * scaleY;
        const boxSize = 6 * fontScale;
        page.drawLine({ start: { x: boxX + fontScale, y: boxY + fontScale }, end: { x: boxX + boxSize, y: boxY + boxSize }, thickness: 1.1 * fontScale, color: rgb(0.08, 0.1, 0.12) });
        page.drawLine({ start: { x: boxX + fontScale, y: boxY + boxSize }, end: { x: boxX + boxSize, y: boxY + fontScale }, thickness: 1.1 * fontScale, color: rgb(0.08, 0.1, 0.12) });
    };
    const normalized = value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const parts = String(request.name || "").trim().split(/\s+/).filter(Boolean);
    const given = String(request.givenName || "").trim() || parts.shift() || "";
    const surname = String(request.surname || "").trim() || (parts.length ? parts.pop() : "");
    const middle = request.givenName || request.surname ? "" : parts.join(" ");

    textField(request.title, 113, 750, 70, 12);
    textField(given, 180, 750, 105, 12);
    textField(middle ? `${middle[0]}.` : "", 300, 750, 38, 12);
    textField(surname, 355, 750, 155, 12);
    textField(request.address, 104, 724, 415, 13);
    textField(request.contactEmail, 310, 702, 415, 13);

    const communication = normalized(request.communicationMode);
    [["landline", 93, "landline"], ["mobile", 178, "mobile"], ["email", 259, "email"], ["postal", 343, "postal"]]
        .forEach(([name, x, match]) => checkbox(`communication.${name}`, x, 681, communication === match));

    const id = normalized(request.idType);
    const idOptions = [
        ["passport", 93, 640], ["votersId", 179, 640], ["postalId", 260, 640],
        ["driversLicense", 343, 640], ["sssId", 443, 640], ["schoolId", 93, 631],
        ["companyId", 179, 631], ["others", 260, 631]
    ];
    const idAliases = { votersId: "votersid", postalId: "postalid", driversLicense: "driverslicense", sssId: "sssid", schoolId: "schoolid", companyId: "companyid" };
    idOptions.forEach(([name, x, y]) => checkbox(
        `requestingParty.id.${name}`,
        x,
        y,
        name === "others" ? id === "other" || id === "others" : id === (idAliases[name] || name.toLowerCase())
    ));

    textField(request.agency, 303, 610, 415, 11);
    textField(request.documentRequested, 101, 571, 415, 28, { multiline: true });
    textField(formatPrintPeriod(request.datePeriod), 220, 550, 250, 12);
    textField(request.purpose, 101, 514, 415, 29, { multiline: true });
    textField(request.documentType, 100, 498, 165, 11);
    textField(request.referenceNo, 222, 485, 225, 10);
    textField(request.additionalInformation, 262, 474, 235, 10);
    textField(formatPrintDate(request.dateAccomplished), 442, 381, 145, 10);
    textField(request.accomplishedBy, 189, 354 , 190, 10);
    textField(request.accomplishedAgency, 444, 354, 205, 10);
    textField(formatPrintDate(request.dateEnteredEfoi), 185, 336, 190, 10);
    textField(request.proofOfId, 300, 328, 205, 10);

    const recommendation = normalized(request.recommendation);
    checkbox("recommendation.approved", 268, 324, recommendation === "approved");
    checkbox("recommendation.denied", 351, 324, recommendation === "denied");
    const denial = normalized(request.denialReason);
    checkbox("denialReason.invalidRequest", 269, 312, denial.includes("invalid"));
    checkbox("denialReason.incomplete", 350, 312, denial.includes("incomplete"));
    checkbox("denialReason.online", 423, 312, denial.includes("online"));
    textField(request.secondOfficer, 307, 303, 225, 11);

    const decision = normalized(request.decision);
    checkbox("decision.successful", 208, 242, decision === "successful" || decision === "approved");
    checkbox("decision.partiallySuccessful", 269, 242, decision === "partiallysuccessful");
    checkbox("decision.denied", 351, 242, decision === "denied");
    const decisionDenial = normalized(request.decisionDenialReason);
    checkbox("decisionDenialReason.invalidRequest", 268 , 232, decisionDenial.includes("invalid"));
    checkbox("decisionDenialReason.incomplete", 350, 232, decision === "incomplete" || decisionDenial.includes("incomplete"));
    checkbox("decisionDenialReason.online", 420, 232, decisionDenial.includes("online"));
    textField(formatPrintDate(request.dateFinished), 225, 206, 95, 12);
    const registry = normalized(request.registryAccomplished);
    checkbox("registryAccomplished.yes", 433, 208, registry === "yes");
    checkbox("registryAccomplished.no", 484, 208, registry === "no");
    textField(request.receivedDocumentTitle, 177, 90, 420, 16, { multiline: true });
    textField(formatPrintDateSeparated(request.dateReceived), 189, 53, 115, 12);

    return new Blob([await pdf.save()], { type: "application/pdf" });
}

function formatPrintDate(value) {
    if (!value) return "";
    const dateOnly = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return [String(date.getDate()).padStart(2, "0"), String(date.getMonth() + 1).padStart(2, "0"), date.getFullYear()].join("/");
}

function formatPrintDateSeparated(value) {
    const parts = formatPrintDate(value).split("/");
    return parts.length === 3 ? parts.join(" / ") : parts[0];
}

function formatPrintPeriod(value) {
    if (!value) return "";
    const text = String(value).trim();
    return /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(text) ? formatPrintDate(text) : text;
}

function populateDecisions() {
    const select = document.getElementById("decisionFilter");
    const current = select.value;
    const decisions = [...new Set(requests.map(request => request.decision).filter(Boolean))].sort();
    select.innerHTML = '<option value="">All Decisions</option>' + decisions.map(value => `<option>${escapeHtml(value)}</option>`).join("");
    select.value = decisions.includes(current) ? current : "";
}

function openForm(request = null) {
    editingIndex = request ? requests.indexOf(request) : -1;
    document.getElementById("modalTitle").textContent = request ? "Edit FOI Request" : "New FOI Request";
    const applicantName = request ? splitApplicantName(request) : {};
    fields.forEach(([key, , type]) => {
        const input = document.getElementById(key);
        const value = request ? request[key] || applicantName[key] || "" : "";
        if (type === "select") {
            if (input) {
                input.value = key === "title" ? normalizeApplicantTitle(value) : value;
            }
            return;
        }
        if (input) {
            input.value = type === "date" ? toDateInputValue(value) : value;
        }
        if (input) {
            input.disabled = key === "transactionNo" && Boolean(request);
        }
    });
    syncTransactionNumberBoxes(request ? request.transactionNo : "");
    syncDecisionCostFields();
    modal.style.display = "flex";
}

function splitApplicantName(request) {
    const givenName = String(request.givenName || "").trim();
    const surname = String(request.surname || "").trim();
    if (givenName || surname) return { givenName, surname };

    const parts = String(request.name || "").trim().split(/\s+/).filter(Boolean);
    return { givenName: parts.shift() || "", surname: parts.join(" ") };
}

function normalizeApplicantTitle(value) {
    const normalized = String(value || "").trim().replace(/\./g, "").toLowerCase();
    return (validationOptions.title || []).find(option => option.toLowerCase() === normalized) || "";
}

function syncTransactionNumberBoxes(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 5);
    const hiddenInput = document.getElementById("transactionNo");
    if (hiddenInput) hiddenInput.value = digits;
    document.querySelectorAll(".transaction-digit").forEach((input, index) => {
        input.value = digits[index] || "";
        input.disabled = editingIndex !== -1;
    });
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
    if (!form.reportValidity()) return;
    try {
        const values = {};
        fields.forEach(([key, , type]) => {
            const input = document.getElementById(key);
            values[key] = input ? input.value : "";
        });
        values.name = [values.givenName, values.surname].filter(Boolean).join(" ");
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

document.addEventListener("input", event => {
    if (event.target && event.target.classList.contains("transaction-digit")) {
        event.target.value = event.target.value.replace(/\D/g, "").slice(0, 1);
        const digitInputs = [...document.querySelectorAll(".transaction-digit")];
        const value = digitInputs.map(input => input.value).join("");
        document.getElementById("transactionNo").value = value;
        if (event.target.value) {
            const nextInput = digitInputs[digitInputs.indexOf(event.target) + 1];
            if (nextInput) nextInput.focus();
        }
    }
});

document.addEventListener("paste", event => {
    if (!event.target || !event.target.classList.contains("transaction-digit")) return;
    event.preventDefault();
    const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 5);
    const digitInputs = [...document.querySelectorAll(".transaction-digit")];
    digitInputs.forEach((input, index) => {
        input.value = digits[index] || "";
    });
    document.getElementById("transactionNo").value = digits;
    const nextEmpty = digitInputs.find(input => !input.value);
    (nextEmpty || digitInputs[digitInputs.length - 1]).focus();
});

function buildFormData(values) {
    const data = new FormData();
    Object.entries(values).forEach(([key, value]) => data.append(key, value == null ? "" : value));
    return data;
}

document.getElementById("openModal").addEventListener("click", () => openForm());
document.getElementById("closeModal").addEventListener("click", closeForm);
document.getElementById("cancelModal").addEventListener("click", closeForm);
document.getElementById("closeFoiPreview").addEventListener("click", closeFoiPreview);
document.getElementById("foiPreviewPrint").addEventListener("click", () => {
    if (!foiPreviewUrl) return;
    const printWindow = window.open(foiPreviewUrl, "_blank", "noopener");
    if (!printWindow) alert("Allow pop-ups to open the PDF print viewer.");
});
searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => loadRequests(1), 150);
});
searchInput.addEventListener("search", () => loadRequests(1));
document.getElementById("decisionFilter").addEventListener("change", () => renderTable());
document.getElementById("prevPageBtn").addEventListener("click", () => {
    if (pageState.page > 1) loadRequests(pageState.page - 1);
});
document.getElementById("nextPageBtn").addEventListener("click", () => {
    if (pageState.page < pageState.totalPages) loadRequests(pageState.page + 1);
});
tbody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const index = Number(button.dataset.index);
    const action = button.dataset.action;
    if (Number.isNaN(index)) return;

    if (action === "preview") previewFoiRequest(index);
    if (action === "print") printFoiRequest(index);
    if (action === "edit") editRequest(index);
    if (action === "delete") deleteRequest(index);
});
document.addEventListener("change", event => {
    if (event.target && event.target.id === "decision") {
        syncDecisionCostFields();
    }
});
window.addEventListener("click", event => {
    if (event.target === modal) closeForm();
    if (event.target === previewModal) closeFoiPreview();
});
window.addEventListener("keydown", event => {
    if (event.key === "Escape" && previewModal.style.display === "flex") closeFoiPreview();
});

document.addEventListener("DOMContentLoaded", () => {
    configureOfficeSelector();
    buildForm(validationOptions);
    loadRequests();
});
