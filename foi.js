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

const FOI_SPREADSHEET_COLUMNS = [
    ["", "column_1"],
    ["TRANSANCTION NO", "transanctionNo"],
    ["TITLE", "title"],
    ["GIVEN NAME", "givenName"],
    ["SURNAME", "surname"],
    ["ADDRESS", "address"],
    ["CONTACT NO/   EMAIL", "contactEmail"],
    ["MODE OF COMMUNICATION", "communicationMode"],
    ["TYPE OF ID", "idType"],
    ["AGENCY/CONNECTING AGENCY", "agency"],
    ["TITLE OF DOCUMENT/ RECORD REQUESTED", "documentRequested"],
    ["DATE/PERIOD", "datePeriod"],
    ["PURPOSE OF REQUEST", "purpose"],
    ["DOCUMENT TYPE", "documentType"],
    ["REFERENCE NO", "referenceNo"],
    ["ADDITIONAL INFORMATION", "additionalInformation"],
    ["DATE ACCOMPLISHED", "dateAccomplished"],
    ["NAME", "name"],
    ["AGENCY-CONNECTING AGENCY", "accomplishedAgency"],
    ["DATE ENTERED ON E-FOI", "dateEnteredEfoi"],
    ["PROOF OF ID PRESENTED", "proofOfId"],
    ["REQUEST IS RECOMMENED TO BE", "requestIsRecommenedToBe"],
    ["IF DENIED: REASON FOR DENIAL", "ifDeniedReasonForDenial"],
    ["SECOND RECEIVING OFFICER ASSIGNED", "secondOfficer"],
    ["DECISION ON APPLICATION", "decision"],
    ["IF DENIED REASON FOR DENIAL", "ifDeniedReasonForDenial_26"],
    ["DATE REQUEST FINISHED", "dateFinished"],
    ["FOI REGISTRY ACCOMPLISHED", "registryAccomplished"],
    ["DATE RECEIVED", "dateReceived"],
    ["Record Office", "recordOffice"],
    ["RECEIVED DOCUMENT TITLE", "receivedDocumentTitle"],
    ["GIVEN NAME", "givenName_32"],
    ["SURNAME", "surname_33"]
];

const foiPreviewModal = document.getElementById("foiPreviewModal");
const foiPreviewFrame = document.getElementById("foiPreviewFrame");
const foiPreviewPrintButton = document.getElementById("foiPreviewPrint");
let foiPreviewUrl = null;
let foiTemplateBytesPromise;

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

    document.getElementById("emptyState").style.display = filtered.length ? "none" : "flex";
    TablePagination.render(tbody, filtered, request => {
        const actualIndex = requests.indexOf(request);
        const fragment = document.createDocumentFragment();
        const row = document.createElement("tr");
        const summaryValues = [
            getFoiCellValue(request, "transanctionNo") || request.transactionNo,
            getFoiRequesterName(request),
            request.documentRequested,
            request.dateReceived,
            request.decision
        ];
        summaryValues.forEach((value, index) => {
            const cell = document.createElement("td");
            cell.textContent = value == null || value === "" ? "—" : String(value);
            cell.dataset.label = ["Transaction No.", "Requester", "Document Requested", "Date Received", "Decision"][index];
            row.appendChild(cell);
        });
        const actions = document.createElement("td");
        actions.className = "action-buttons foi-actions";
        actions.dataset.label = "Actions";
        actions.innerHTML = `
            <button class="icon-btn" type="button" data-action="details" data-index="${actualIndex}" aria-expanded="false" title="Show all workbook fields" aria-label="Show all workbook fields"><i class="fa-solid fa-chevron-down"></i></button>
            <button class="icon-btn edit-btn" type="button" data-action="edit" data-index="${actualIndex}" title="Edit" aria-label="Edit"><i class="fa-solid fa-pen"></i></button>
            <button class="icon-btn delete-btn" type="button" data-action="delete" data-index="${actualIndex}" title="Delete" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>
        `;
        const downloadLink = document.createElement("a");
        downloadLink.className = "icon-btn foi-download-btn";
        downloadLink.href = getFoiTemplateUrl();
        downloadLink.download = "FOI-FORM-2023.pdf";
        downloadLink.title = "Download blank FOI form";
        downloadLink.setAttribute("aria-label", "Download blank FOI form");
        downloadLink.innerHTML = '<i class="fa-solid fa-download" aria-hidden="true"></i>';
        actions.insertBefore(downloadLink, actions.children[1]);
        const previewButton = document.createElement("button");
        previewButton.className = "icon-btn print-btn";
        previewButton.type = "button";
        previewButton.dataset.action = "preview";
        previewButton.dataset.index = String(actualIndex);
        previewButton.title = "Preview filled FOI form";
        previewButton.setAttribute("aria-label", "Preview filled FOI form");
        previewButton.innerHTML = '<i class="fa-solid fa-file-circle-check" aria-hidden="true"></i>';
        actions.insertBefore(previewButton, downloadLink.nextSibling);
        row.appendChild(actions);
        fragment.appendChild(row);

        const detailsRow = document.createElement("tr");
        detailsRow.className = "foi-details-row";
        detailsRow.hidden = true;
        const detailsCell = document.createElement("td");
        detailsCell.colSpan = 6;
        const details = document.createElement("dl");
        details.className = "foi-details";
        FOI_SPREADSHEET_COLUMNS.forEach(([label, key]) => {
            const term = document.createElement("dt");
            term.textContent = label || "Unlabeled workbook field";
            const value = document.createElement("dd");
            const fieldValue = getFoiCellValue(request, key);
            value.textContent = fieldValue == null || fieldValue === "" ? "—" : String(fieldValue);
            details.append(term, value);
        });
        detailsCell.appendChild(details);
        detailsRow.appendChild(detailsCell);
        fragment.appendChild(detailsRow);
        return fragment;
    });
}

function getFoiCellValue(request, key) {
    if (request[key] != null) return request[key];
    const aliases = {
        transanctionNo: "transactionNo",
        givenName_32: "givenName",
        surname_33: "surname",
        requestIsRecommenedToBe: "recommendation",
        ifDeniedReasonForDenial: "denialReason",
        ifDeniedReasonForDenial_26: "decisionDenialReason"
    };
    return aliases[key] ? request[aliases[key]] : "";
}

function getFoiRequesterName(request) {
    return request.name || [request.givenName, request.surname].filter(Boolean).join(" ");
}

function getFoiTemplateUrl() {
    const templatePath = document.body.dataset.foiTemplateUrl;
    if (!templatePath) {
        throw new Error("The FOI form download path is missing from the page.");
    }
    return new URL(templatePath, document.baseURI).href;
}

async function previewFoiRequest(index) {
    const request = requests[index];
    if (!request) return;

    try {
        if (typeof window.loadPdfLib !== "function") {
            throw new Error("The local PDF generation library loader is unavailable. Rebuild the frontend assets and reload the page.");
        }
        await window.loadPdfLib();
        const blob = await createFilledFoiPdf(request);
        if (foiPreviewUrl) URL.revokeObjectURL(foiPreviewUrl);
        foiPreviewUrl = URL.createObjectURL(blob);
        foiPreviewPrintButton.disabled = true;
        foiPreviewFrame.src = foiPreviewUrl;
        foiPreviewModal.style.display = "flex";
        foiPreviewModal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    } catch (error) {
        console.error("FOI PDF generation failed", error);
        alert(`Could not generate the filled FOI PDF: ${error.message}`);
    }
}

function closeFoiPreview() {
    foiPreviewModal.style.display = "none";
    foiPreviewModal.setAttribute("aria-hidden", "true");
    foiPreviewFrame.src = "about:blank";
    foiPreviewPrintButton.disabled = true;
    document.body.style.overflow = "";
    if (foiPreviewUrl) {
        URL.revokeObjectURL(foiPreviewUrl);
        foiPreviewUrl = null;
    }
}

function loadFoiTemplateBytes() {
    if (!foiTemplateBytesPromise) {
        foiTemplateBytesPromise = fetchFoiTemplateBytes().catch(error => {
            foiTemplateBytesPromise = null;
            throw error;
        });
    }
    return foiTemplateBytesPromise.then(bytes => bytes.slice());
}

async function fetchFoiTemplateBytes() {
    const endpoint = new URL(document.body.dataset.foiTemplateApi, document.baseURI);
    let invalidResponse;

    for (let attempt = 0; attempt < 2; attempt++) {
        const requestUrl = new URL(endpoint);
        requestUrl.searchParams.set("_", `${Date.now()}-${attempt}`);
        const response = await fetch(requestUrl, {
            cache: "no-store",
            credentials: "same-origin",
            headers: { Accept: "application/pdf" }
        });
        if (!response.ok) {
            throw new Error(`The FOI PDF template request failed (HTTP ${response.status} at ${response.url}).`);
        }

        const bytes = new Uint8Array(await response.arrayBuffer());
        if (new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-") {
            return bytes;
        }

        const contentType = response.headers.get("content-type") || "unknown";
        const signature = new TextDecoder().decode(bytes.subarray(0, 32)).replace(/\s+/g, " ").trim() || "empty response";
        invalidResponse = new Error(
            `The FOI form endpoint returned ${contentType}, not a PDF (HTTP ${response.status}; response starts "${signature}"). Check that the latest api/foi-template.php and official PDF template are deployed.`
        );
    }

    throw invalidResponse;
}

async function createFilledFoiPdf(request) {
    const pdf = await window.PDFLib.PDFDocument.load(await loadFoiTemplateBytes());
    return createStaticFoiPdf(pdf, request);
}

async function createStaticFoiPdf(pdf, request) {
    const { StandardFonts, rgb } = window.PDFLib;
    if (pdf.getPageCount() !== 1) {
        throw new Error("The FOI PDF template must contain exactly one page.");
    }

    const page = pdf.getPages()[0];
    const { width, height } = page.getSize();
    const templateWidth = 612;
    const templateHeight = 936;
    const scaleX = width / templateWidth;
    const scaleY = height / templateHeight;
    const fontScale = Math.min(scaleX, scaleY);
    if (Math.abs(width / height - templateWidth / templateHeight) > 0.025) {
        throw new Error(`The FOI PDF template has incompatible proportions (${width} x ${height} points).`);
    }

    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const drawText = (value, x, y, fieldWidth, fieldHeight, multiline = false) => {
        const text = String(value == null ? "" : value).replace(/[\r\n]+/g, " ").trim();
        if (!text) return;

        const inset = 2 * fontScale;
        const maxWidth = fieldWidth * scaleX - inset * 2;
        const maxHeight = fieldHeight * scaleY - inset * 2;
        let size = 8 * fontScale;
        const minSize = 5.5 * fontScale;
        const wrap = currentSize => {
            const lines = [];
            let line = "";
            const pushWord = word => {
                let remainder = word;
                while (remainder && font.widthOfTextAtSize(remainder, currentSize) > maxWidth) {
                    let splitAt = remainder.length;
                    while (splitAt > 1 && font.widthOfTextAtSize(remainder.slice(0, splitAt), currentSize) > maxWidth) splitAt--;
                    if (line) lines.push(line);
                    lines.push(remainder.slice(0, splitAt));
                    remainder = remainder.slice(splitAt);
                    line = "";
                }
                if (!remainder) return;
                const candidate = line ? `${line} ${remainder}` : remainder;
                if (line && font.widthOfTextAtSize(candidate, currentSize) > maxWidth) {
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

        let lines = multiline ? wrap(size) : [text];
        while (size > minSize && (lines.length * size * 1.12 > maxHeight || lines.some(line => font.widthOfTextAtSize(line, size) > maxWidth))) {
            size = Math.max(minSize, size - 0.5 * fontScale);
            lines = multiline ? wrap(size) : [text];
        }
        if (!multiline) {
            let fitted = text;
            while (fitted.length > 1 && font.widthOfTextAtSize(fitted, size) > maxWidth) fitted = fitted.slice(0, -1).trimEnd();
            if (fitted !== text && fitted.length > 3) fitted = `${fitted.slice(0, -3)}...`;
            lines = [fitted];
        }
        const maxLines = multiline ? Math.max(1, Math.floor(maxHeight / (size * 1.12))) : 1;
        if (lines.length > maxLines) {
            lines = lines.slice(0, maxLines);
            let lastLine = lines[maxLines - 1];
            while (lastLine.length > 1 && font.widthOfTextAtSize(`${lastLine}...`, size) > maxWidth) lastLine = lastLine.slice(0, -1).trimEnd();
            lines[maxLines - 1] = `${lastLine}...`;
        }
        lines.forEach((line, index) => page.drawText(line, {
            x: x * scaleX + inset,
            y: y * scaleY + fieldHeight * scaleY - inset - size - index * size * 1.12,
            size,
            font,
            color: rgb(0.08, 0.1, 0.12)
        }));
    };
    const checkbox = (x, y, selected) => {
        if (!selected) return;
        const boxX = x * scaleX;
        const boxY = y * scaleY;
        const boxSize = 6 * fontScale;
        page.drawLine({ start: { x: boxX + fontScale, y: boxY + fontScale }, end: { x: boxX + boxSize, y: boxY + boxSize }, thickness: 1.1 * fontScale, color: rgb(0.08, 0.1, 0.12) });
        page.drawLine({ start: { x: boxX + fontScale, y: boxY + boxSize }, end: { x: boxX + boxSize, y: boxY + fontScale }, thickness: 1.1 * fontScale, color: rgb(0.08, 0.1, 0.12) });
    };
    const normalized = value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const parts = getFoiRequesterName(request).trim().split(/\s+/).filter(Boolean);
    const given = parts.shift() || "";
    const surname = parts.length ? parts.pop() : "";
    const middle = parts.join(" ");
    const printDate = formatPrintDate;

    drawText(request.transactionNo, 445, 817, 170, 12);
    drawText(request.title, 113, 750, 70, 12);
    drawText(given, 180, 750, 105, 12);
    drawText(middle ? `${middle[0]}.` : "", 300, 750, 38, 12);
    drawText(surname, 355, 750, 155, 12);
    drawText(request.address, 104, 724, 415, 13);
    drawText(request.contactEmail, 310, 702, 415, 13);

    const communication = normalized(request.communicationMode);
    [["landline", 93, "landline"], ["mobile", 178, "mobile"], ["email", 259, "email"], ["postal", 343, "postal"]]
        .forEach(([kind, x, match]) => checkbox(x, 681, communication === match));
    const id = normalized(request.idType);
    const idOptions = [
        ["passport", 93, 640], ["votersid", 179, 640], ["postalid", 260, 640],
        ["driverslicense", 343, 640], ["sssid", 443, 640], ["schoolid", 93, 631],
        ["companyid", 179, 631], ["others", 260, 631]
    ];
    idOptions.forEach(([kind, x, y]) => checkbox(x, y, id === kind || (kind === "others" && id === "other")));

    drawText(request.agency, 303, 610, 415, 11);
    drawText(request.documentRequested, 101, 571, 415, 28, true);
    drawText(formatPrintPeriod(request.datePeriod), 220, 550, 250, 12);
    drawText(request.purpose, 101, 514, 415, 29, true);
    drawText(request.documentType, 100, 498, 165, 11);
    drawText(request.referenceNo, 222, 485, 225, 10);
    drawText(request.additionalInformation, 262, 474, 235, 10);
    drawText(printDate(request.dateAccomplished), 442, 381, 145, 10);
    drawText(request.accomplishedBy, 189, 354, 190, 10);
    drawText(request.accomplishedAgency, 444, 354, 205, 10);
    drawText(printDate(request.dateEnteredEfoi), 185, 336, 190, 10);
    drawText(request.proofOfId, 300, 328, 205, 10);

    const recommendation = normalized(request.recommendation);
    checkbox(268, 324, recommendation === "approved");
    checkbox(351, 324, recommendation === "denied");
    const denial = normalized(request.denialReason);
    checkbox(269, 312, denial.includes("invalid"));
    checkbox(350, 312, denial.includes("incomplete"));
    checkbox(423, 312, denial.includes("online"));
    drawText(request.secondOfficer, 307, 303, 225, 11);

    const decision = normalized(request.decision);
    checkbox(208, 242, decision === "successful" || decision === "approved");
    checkbox(269, 242, decision === "partiallysuccessful");
    checkbox(351, 242, decision === "denied");
    const decisionDenial = normalized(request.decisionDenialReason);
    checkbox(268, 232, decisionDenial.includes("invalid"));
    checkbox(350, 232, decision === "incomplete" || decisionDenial.includes("incomplete"));
    checkbox(420, 232, decisionDenial.includes("online"));
    drawText(printDate(request.dateFinished), 225, 206, 95, 12);
    const registry = normalized(request.registryAccomplished);
    checkbox(433, 208, registry === "yes");
    checkbox(484, 208, registry === "no");
    drawText(request.documentRequested, 177, 90, 420, 16, true);
    drawText(printDate(request.dateReceived), 189, 53, 115, 12);
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

function formatPrintPeriod(value) {
    if (!value) return "";
    const text = String(value).trim();
    return /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(text) ? formatPrintDate(text) : text;
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
        office: getRequestOffice(), idField: "transactionNo", idValue: request.transactionNo,
        _syncVersion: request._syncVersion
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
        : { action: "update", module: MODULE_NAME, sheet: SHEET_NAME, office: getRequestOffice(), idField: "transactionNo", idValue: requests[editingIndex].transactionNo, _syncVersion: requests[editingIndex]._syncVersion, ...values };
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
document.getElementById("closeFoiPreview").addEventListener("click", closeFoiPreview);
foiPreviewFrame.addEventListener("load", () => {
    if (foiPreviewUrl && foiPreviewFrame.src === foiPreviewUrl) {
        foiPreviewPrintButton.disabled = false;
    }
});
foiPreviewPrintButton.addEventListener("click", () => {
    if (!foiPreviewUrl || !foiPreviewFrame.contentWindow) {
        alert("Wait for the filled FOI form preview to finish loading, then print it.");
        return;
    }
    try {
        foiPreviewFrame.contentWindow.focus();
        foiPreviewFrame.contentWindow.print();
    } catch (error) {
        console.error("FOI PDF printing failed", error);
        alert("Could not open the print dialog from the preview. Use the PDF viewer's print control.");
    }
});
tbody.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button || !tbody.contains(button)) return;
    const index = Number(button.dataset.index);
    if (!Number.isInteger(index)) return;
    if (button.dataset.action === "details") {
        const detailsRow = button.closest("tr").nextElementSibling;
        if (!detailsRow || !detailsRow.classList.contains("foi-details-row")) return;
        detailsRow.hidden = !detailsRow.hidden;
        button.setAttribute("aria-expanded", String(!detailsRow.hidden));
        button.title = detailsRow.hidden ? "Show all workbook fields" : "Hide workbook fields";
        return;
    }
    if (button.dataset.action === "preview") previewFoiRequest(index);
    if (button.dataset.action === "edit") editRequest(index);
    if (button.dataset.action === "delete") deleteRequest(index);
});
document.getElementById("searchInput").addEventListener("input", () => {
    TablePagination.reset(tbody);
    renderTable();
});
document.getElementById("decisionFilter").addEventListener("change", () => {
    TablePagination.reset(tbody);
    renderTable();
});
window.addEventListener("click", event => { if (event.target === modal) closeForm(); });
window.addEventListener("click", event => { if (event.target === foiPreviewModal) closeFoiPreview(); });

document.addEventListener("DOMContentLoaded", () => { buildForm(); loadRequests(); });
