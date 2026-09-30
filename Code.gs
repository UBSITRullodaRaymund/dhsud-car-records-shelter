/*=========================================================
  DHSUD-CAR RECORDS SHELTER — BACKEND
  Account System: Login, Sessions, RBAC
  Paste this into your Apps Script project (Code.gs),
  alongside your existing document-handling code.
=========================================================*/

// Admin spreadsheet — holds ONLY Users + Sessions. This can be the
// spreadsheet the script is bound to, or a separate dedicated one.
const SS = SpreadsheetApp.getActiveSpreadsheet();
const DEFAULT_DATA_SPREADSHEET_ID = SS.getId();

const USERS_SHEET_NAME = "Users";
const SESSIONS_SHEET_NAME = "Sessions";
const ACTIVITY_LOG_SHEET_NAME = "ActivityLog";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

/*=========================================================
  OFFICE SPREADSHEET ROUTING
  Each office owns its own Google Sheet. Fill in the real
  spreadsheet ID for each (the long string in its URL,
  between /d/ and /edit). Office names must exactly match
  the "Office" value stored in the Users sheet and the
  Office dropdowns in your forms.
=========================================================*/

const OFFICE_SHEETS = {
  "Administrative and Finance Office": "1V6LdSOpvElmKKsceyh8XR2h_VW0fKNh47jLj0xSu1Tw",
  "Housing Real Estate Development Regulation Office": "",
  "Homeowners Association and Community Development Office": "",
  "Environmental, Land Use and Urban Planning Office": "",
  "Office of the Regional Director": ""
};
const FOI_SPREADSHEET_ID = "1V6LdSOpvElmKKsceyh8XR2h_VW0fKNh47jLj0xSu1Tw";
const FOI_HEADERS = [
  "TRANSACTION NO", "TITLE", "NAME", "ADDRESS", "CONTACT NO / EMAIL",
  "MODE OF COMMUNICATION", "TYPE OF ID", "AGENCY / CONNECTING AGENCY",
  "TITLE OF DOCUMENT / RECORD REQUESTED", "DATE / PERIOD", "PURPOSE",
  "DOCUMENT TYPE", "REFERENCE NO", "ADDITIONAL INFORMATION",
  "DATE ACCOMPLISHED", "NAME", "AGENCY-CONNECTING AGENCY",
  "DATE ENTERED ON E-FOI", "PROOF OF ID PRESENTED",
  "REQUEST IS RECOMMENDED TO BE", "IF DENIED: REASON FOR DENIAL",
  "SECOND RECEIVING OFFICER ASSIGNED", "DECISION ON APPLICATION",
  "IF DENIED REASON DENIAL", "DATE REQUEST FINISHED",
  "FOI REGISTRY ACCOMPLISHED", "DATE RECEIVED", "Record Office"
];

function ensureFoiSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName("FOI");
  if (!sheet) sheet = spreadsheet.insertSheet("FOI");

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, FOI_HEADERS.length).setValues([FOI_HEADERS]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function setupFoiSpreadsheet() {
  const spreadsheet = SpreadsheetApp.openById(FOI_SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName("FOI");
  if (!sheet) throw new Error("The existing spreadsheet does not contain an FOI tab");
  const result = "Using existing FOI sheet: " + spreadsheet.getUrl();
  Logger.log(result);
  return result;
}   

// Opens the correct office spreadsheet and returns the requested tab.
// Throws if the office or tab name isn't recognized, rather than
// silently reading the wrong data.
function getOfficeSheet(officeName, tabName) {
  if (!Object.prototype.hasOwnProperty.call(OFFICE_SHEETS, officeName)) {
    throw new Error("Unknown office: " + officeName);
  }
  const configuredSpreadsheetId = tabName === "FOI"
    ? FOI_SPREADSHEET_ID
    : OFFICE_SHEETS[officeName];
  const spreadsheetId = configuredSpreadsheetId || DEFAULT_DATA_SPREADSHEET_ID;
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    throw new Error("Tab '" + tabName + "' not found in " + officeName);
  }
  return sheet;
}

function ensureFoiOfficeColumn(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (!lastColumn) throw new Error("The FOI sheet needs a header row before records can be saved");

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  let officeColumn = headers.findIndex(header =>
    String(header || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "") === "recordoffice"
  );

  if (officeColumn === -1) {
    officeColumn = lastColumn;
    sheet.getRange(1, officeColumn + 1).setValue("Record Office");
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, officeColumn + 1, lastRow - 1, 1)
        .setValues(Array.from({ length: lastRow - 1 }, () => ["Administrative and Finance Office"]));
    }
  }

  return officeColumn;
}

// Decides which office's data a request is allowed to touch.
// - Staff/OfficeAdmin: always forced to their own office,
//   regardless of what the frontend sends — prevents someone
//   editing the request to peek at another office's data.
// - SuperAdmin: may pass an "office" param to view any one of them.
function resolveOffice(auth, requestedOffice) {
  if (auth.user.role !== "SuperAdmin") {
    return auth.user.office;
  }
  if (requestedOffice && Object.prototype.hasOwnProperty.call(OFFICE_SHEETS, requestedOffice)) {
    return requestedOffice;
  }

  if (auth.user.office && Object.prototype.hasOwnProperty.call(OFFICE_SHEETS, auth.user.office)) {
    return auth.user.office;
  }

  return Object.keys(OFFICE_SHEETS)[0];
}

/*=========================================================
  PERMISSIONS
  Fine-grained, per-module access on top of role. A user's
  Permissions cell stores a comma-separated list of codes
  like "incoming:view,incoming:create,outgoing:view".
  SuperAdmin always passes every check, regardless of what's
  checked in their Permissions cell.
=========================================================*/

const PERMISSION_MODULES = [
  "incoming", "outgoing", "dockets", "docketsMapping",
  "recordsMasterList", "recordsTransfer", "foi"
];

const PERMISSION_ACTIONS = ["view", "create", "edit", "delete"];

function hasPermission(user, code) {
  if (user.role === "SuperAdmin") return true;
  return (user.permissions || []).indexOf(code) !== -1;
}

/*=========================================================
  ENTRY POINTS
  Wire your existing getDocuments/save/update/delete logic
  in here behind requireAuth() + requireRole() checks.
=========================================================*/

function doGet(e) {
  const action = e.parameter.action;

  if (action === "validateSession") {
    const auth = requireAuth(e.parameter.token);
    if (!auth.ok) return jsonResponse({ error: auth.error }, 401);
    return jsonResponse({ success: true, user: auth.user });
  }

  if (action === "getFoiValidationOptions") {
    const auth = requireAuth(e.parameter.token);
    if (!auth.ok) return jsonResponse({ error: auth.error }, 401);
    if (!hasPermission(auth.user, "foi:view")) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    try {
      const sheet = getOfficeSheet(resolveOffice(auth, e.parameter.office), "FOI");
      return jsonResponse(getFoiValidationOptions(sheet));
    } catch (err) {
      return jsonResponse({ error: err.message }, 400);
    }
  }

  if (action === "getDocuments") {
    const auth = requireAuth(e.parameter.token);
    if (!auth.ok) return jsonResponse({ error: auth.error }, 401);

    const module = e.parameter.module;
    if (!hasPermission(auth.user, module + ":view")) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    try {
      const office = resolveOffice(auth, e.parameter.office);
      const sheet = getOfficeSheet(office, e.parameter.sheet);
      const officeColumn = -1;

      const data = sheet.getDataRange().getValues();
      const headers = data.shift();
      const rows = officeColumn === -1
        ? data
        : data.filter(row => String(row[officeColumn] || "") === office);
      const records = rows.map(row => {
        const record = {};
        const occurrences = {};
        headers.forEach((header, index) => {
          const baseKey = String(header || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
          const occurrence = occurrences[baseKey] || 0;
          occurrences[baseKey] = occurrence + 1;
          record[normalizeDocumentHeader(header, e.parameter.sheet, occurrence)] = row[index];
        });
        return record;
      });

      return jsonResponse(records);
    } catch (err) {
      return jsonResponse({ error: err.message }, 400);
    }
  }

  return jsonResponse({ error: "Unknown action" }, 400);
}

function getFoiValidationOptions(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const options = {};
  const fieldByHeader = {
    modeofcommunication: "communicationMode",
    typeofid: "idType",
    documenttype: "documentType",
    proofofidpresented: "proofOfId",
    requestisrecommendedtobe: "recommendation",
    requestisrecommenedtobe: "recommendation",
    decisiononapplication: "decision",
    foiregistryaccomplished: "registryAccomplished"
  };

  headers.forEach((header, columnIndex) => {
    const field = fieldByHeader[String(header || "")
      .trim().toLowerCase().replace(/[^a-z0-9]/g, "")];
    if (!field) return;

    const rules = sheet.getRange(2, columnIndex + 1, Math.max(1, sheet.getMaxRows() - 1), 1)
      .getDataValidations().flat().filter(Boolean);
    const values = [];
    rules.forEach(rule => {
      const criteriaValues = rule.getCriteriaValues();
      if (rule.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
        values.push(...criteriaValues[0]);
      } else if (rule.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
        values.push(...criteriaValues[0].getDisplayValues().flat());
      }
    });

    const uniqueValues = [...new Set(values.map(value => String(value).trim()).filter(Boolean))];
    if (uniqueValues.length) options[field] = uniqueValues;
  });

  return options;
}

function findFoiInsertRow(sheet, headers) {
  const transactionColumn = headers.findIndex(header => {
    const key = String(header || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    return key === "transactionno" || key === "transanctionno";
  });
  if (transactionColumn === -1) return sheet.getLastRow() + 1;

  const rowCount = Math.max(1, sheet.getMaxRows() - 1);
  const transactionValues = sheet
    .getRange(2, transactionColumn + 1, rowCount, 1)
    .getDisplayValues();
  const emptyRow = transactionValues.findIndex(([value]) => !String(value).trim());

  return emptyRow === -1 ? sheet.getLastRow() + 1 : emptyRow + 2;
}

function normalizeDocumentHeader(header, sheetName, occurrence = 0) {
  const key = String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const isDockets = sheetName === "Dockets Issuances";
  const isFoi = sheetName === "FOI";

  const common = {
    tracking: "tracking",
    transactionno: isDockets ? "transactionNo" : "tracking",
    transactionnumber: isDockets ? "transactionNo" : "tracking",
    trackingno: "tracking",
    trackingnumber: "tracking",
    routingslipno: "tracking",
    routingslipnumber: "tracking",
    datereceived: "dateReceived",
    receiveddate: "dateReceived",
    sender: "sender",
    originatingoffice: "office",
    originoffice: "office",
    office: "office",
    category: "category",
    subject: "subject",
    division: "division",
    assigneddivision: "division",
    ageing: "ageing",
    status: "status",
    remarks: "remarks",
    filename: "fileName",
    documentfile: "fileName",
    driveurl: "driveUrl"
  };

  const dockets = {
    daterequest: "dateRequest",
    documentfilename: "documentName",
    documentname: "documentName",
    classification: "classification",
    requestedby: "requestedBy",
    releasedby: "releasedBy",
    datereturned: "dateReturned",
    returnedby: "returnedBy",
    verifiedby: "verifiedBy"
  };

  const foi = {
    recordoffice: "recordOffice",
    transactionno: "transactionNo",
    transanctionno: "transactionNo",
    title: "title",
    name: occurrence > 0 ? "accomplishedBy" : "name",
    address: "address",
    contactnoemail: "contactEmail",
    modeofcommunication: "communicationMode",
    typeofid: "idType",
    agencyconnectingagency: occurrence > 0 ? "accomplishedAgency" : "agency",
    titleofdocumentrecordrequested: "documentRequested",
    dateperiod: "datePeriod",
    purposeofrequest: "purpose",
    documenttype: "documentType",
    referenceno: "referenceNo",
    additionalinformation: "additionalInformation",
    dateaccomplished: "dateAccomplished",
    dateenteredonefoi: "dateEnteredEfoi",
    proofofidpresented: "proofOfId",
    requestisrecommendedtobe: "recommendation",
    requestisrecommenedtobe: "recommendation",
    ifdeniedreasondenial: occurrence > 0 ? "decisionDenialReason" : "denialReason",
    secondreceivingofficerassigned: "secondOfficer",
    decisiononapplication: "decision",
    daterequestfinished: "dateFinished",
    foiregistryaccomplished: "registryAccomplished"
  };

  return (isFoi && foi[key]) || (isDockets && dockets[key]) || common[key] || header;
}

function doPost(e) {
  const action = e.parameter.action;

  if (action === "login") return handleLogin(e);
  if (action === "logout") return handleLogout(e);

  // Every other action (save/update/delete) must carry a valid token.
  const auth = requireAuth(e.parameter.token);
  if (!auth.ok) return jsonResponse({ error: auth.error }, 401);

  if (action === "save") {
    const module = e.parameter.module;
    if (!hasPermission(auth.user, module + ":create")) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    try {
      const office = resolveOffice(auth, e.parameter.office);
      const sheet = getOfficeSheet(office, e.parameter.sheet);
      const officeColumn = -1;
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

      // Build the row in header order from whatever fields the
      // frontend sent, and stamp who created it + when.
      const saveOccurrences = {};
      const row = headers.map((h, columnIndex) => {
        if (columnIndex === officeColumn) return office;
        if (h === "CreatedBy") return auth.user.email;
        if (h === "CreatedAt") return new Date();
        const baseKey = String(h || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        const occurrence = saveOccurrences[baseKey] || 0;
        saveOccurrences[baseKey] = occurrence + 1;
        const field = normalizeDocumentHeader(h, e.parameter.sheet, occurrence);
        return e.parameter[field] !== undefined ? e.parameter[field] : "";
      });

      const insertRow = e.parameter.sheet === "FOI"
        ? findFoiInsertRow(sheet, headers)
        : sheet.getLastRow() + 1;
      sheet.getRange(insertRow, 1, 1, row.length).setValues([row]);
      SpreadsheetApp.flush();

      logActivity(auth.user, module, "Create", e.parameter.recordId || "");
      const spreadsheet = sheet.getParent();
      return jsonResponse({
        success: true,
        office: office,
        spreadsheetName: spreadsheet.getName(),
        spreadsheetUrl: spreadsheet.getUrl(),
        sheetName: sheet.getName(),
        row: insertRow
      });
    } catch (err) {
      return jsonResponse({ error: err.message }, 400);
    }
  }

  if (action === "update") {
    const module = e.parameter.module;
    if (!hasPermission(auth.user, module + ":edit")) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    try {
      const office = resolveOffice(auth, e.parameter.office);
      const sheet = getOfficeSheet(office, e.parameter.sheet);
      const officeColumn = -1;
      const idField = e.parameter.idField;   // e.g. "transactionNo"
      const idValue = e.parameter.idValue;

      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const updateIdOccurrences = {};
      const idCol = headers.findIndex(h => {
        const baseKey = String(h || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        const occurrence = updateIdOccurrences[baseKey] || 0;
        updateIdOccurrences[baseKey] = occurrence + 1;
        return normalizeDocumentHeader(h, e.parameter.sheet, occurrence) === idField;
      });
      if (idCol === -1) throw new Error("ID field not found: " + idField);

      const rowIndex = data.findIndex((r, i) =>
        i > 0 && String(r[idCol]) === String(idValue) &&
        (officeColumn === -1 || String(r[officeColumn] || "") === office)
      );
      if (rowIndex === -1) return jsonResponse({ error: "Record not found" }, 404);

      const updateOccurrences = {};
      headers.forEach((h, colIndex) => {
        const baseKey = String(h || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        const occurrence = updateOccurrences[baseKey] || 0;
        updateOccurrences[baseKey] = occurrence + 1;
        const field = normalizeDocumentHeader(h, e.parameter.sheet, occurrence);
        if (colIndex !== officeColumn && e.parameter[field] !== undefined) {
          sheet.getRange(rowIndex + 1, colIndex + 1).setValue(e.parameter[field]);
        }
      });

      logActivity(auth.user, module, "Edit", idValue);
      return jsonResponse({ success: true });
    } catch (err) {
      return jsonResponse({ error: err.message }, 400);
    }
  }

  if (action === "delete") {
    const module = e.parameter.module;
    if (!hasPermission(auth.user, module + ":delete")) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    try {
      const office = resolveOffice(auth, e.parameter.office);
      const sheet = getOfficeSheet(office, e.parameter.sheet);
      const officeColumn = -1;
      const idField = e.parameter.idField;
      const idValue = e.parameter.idValue;

      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const deleteIdOccurrences = {};
      const idCol = headers.findIndex(h => {
        const baseKey = String(h || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        const occurrence = deleteIdOccurrences[baseKey] || 0;
        deleteIdOccurrences[baseKey] = occurrence + 1;
        return normalizeDocumentHeader(h, e.parameter.sheet, occurrence) === idField;
      });
      if (idCol === -1) throw new Error("ID field not found: " + idField);

      const rowIndex = data.findIndex((r, i) =>
        i > 0 && String(r[idCol]) === String(idValue) &&
        (officeColumn === -1 || String(r[officeColumn] || "") === office)
      );
      if (rowIndex === -1) return jsonResponse({ error: "Record not found" }, 404);

      sheet.deleteRow(rowIndex + 1);

      logActivity(auth.user, module, "Delete", idValue);
      return jsonResponse({ success: true });
    } catch (err) {
      return jsonResponse({ error: err.message }, 400);
    }
  }

  if (action === "listUsers") {
    if (!requireRole(auth.user, ["SuperAdmin", "OfficeAdmin"])) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    return listUsers(auth.user);
  }

  if (action === "createUserAccount") {
    if (!requireRole(auth.user, ["SuperAdmin", "OfficeAdmin"])) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    return createUserAccount(e, auth.user);
  }

  if (action === "updateUserAccount") {
    if (!requireRole(auth.user, ["SuperAdmin", "OfficeAdmin"])) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    return updateUserAccount(e, auth.user);
  }

  if (action === "deleteUserAccount") {
    if (!requireRole(auth.user, ["SuperAdmin", "OfficeAdmin"])) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    return deleteUserAccount(e, auth.user);
  }

  if (action === "listActivity") {
    if (!requireRole(auth.user, ["SuperAdmin", "OfficeAdmin"])) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    return listActivity(auth.user);
  }

  return jsonResponse({ error: "Unknown action" }, 400);
}

/*=========================================================
  ACTIVITY LOG
  Every create/edit/delete, plus login/logout, is recorded
  here automatically — who, which office, what module, what
  action, and when. SuperAdmin sees everything; OfficeAdmin
  is scoped to their own office.
=========================================================*/

function logActivity(user, module, action, recordId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getOrCreateActivityLogSheet();
    sheet.appendRow([
      new Date(),
      user.email,
      user.fullName,
      user.role,
      user.office,
      module || "",
      action,
      recordId || ""
    ]);
  } finally {
    lock.releaseLock();
  }
}

function listActivity(requestingUser) {
  const sheet = getOrCreateActivityLogSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  let logs = data.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i]])));

  if (requestingUser.role !== "SuperAdmin") {
    logs = logs.filter(l => l.Office === requestingUser.office);
  }

  // Newest first.
  logs.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));

  return jsonResponse(logs);
}

function getOrCreateActivityLogSheet() {
  let sheet = SS.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
  if (!sheet) {
    sheet = SS.insertSheet(ACTIVITY_LOG_SHEET_NAME);
    sheet.appendRow([
      "Timestamp", "Email", "FullName", "Role",
      "Office", "Module", "Action", "RecordId"
    ]);
  }
  return sheet;
}

/*=========================================================
  USER MANAGEMENT (SuperAdmin: any office. OfficeAdmin: own
  office only — enforced below, not left to the frontend.)
=========================================================*/

function listUsers(requestingUser) {
  const sheet = getOrCreateUsersSheet();
  const data = sheet.getDataRange().getValues();

  if (!data.length) {
    return jsonResponse([]);
  }

  ensureSheetHeaders(sheet, [
    "Email", "PasswordHash", "Salt", "FullName",
    "Role", "Office", "Status", "DateCreated", "Permissions"
  ]);

  const headers = data[0];
  const rows = data.slice(1);

  let users = rows.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i]])));

  // Never send password hashes/salts to the frontend.
  users = users.map(u => ({
    email: u.Email,
    fullName: u.FullName,
    role: u.Role,
    office: u.Office,
    status: u.Status,
    permissions: parsePermissions(u.Permissions)
  }));

  if (requestingUser.role !== "SuperAdmin") {
    users = users.filter(u => u.office === requestingUser.office);
  }

  return jsonResponse(users);
}

function createUserAccount(e, requestingUser) {
  const email = String(e.parameter.email || "").trim().toLowerCase();
  const password = String(e.parameter.password || "");
  const fullName = String(e.parameter.fullName || "");
  const role = String(e.parameter.role || "OfficeStaff");
  const office = String(e.parameter.office || "");
  const status = String(e.parameter.status || "Active");
  const permissions = String(e.parameter.permissions || ""); // "incoming:view,incoming:create,..."

  if (!email || !password || !office) {
    return jsonResponse({ error: "Email, password, and office are required" }, 400);
  }

  // OfficeAdmin can only create accounts inside their own office.
  if (requestingUser.role !== "SuperAdmin" && office !== requestingUser.office) {
    return jsonResponse({ error: "You can only create accounts for your own office" }, 403);
  }

  const sheet = getOrCreateUsersSheet();
  const existing = sheet.getDataRange().getValues();
  const emailCol = existing[0].indexOf("Email");
  if (existing.some((r, i) => i > 0 && String(r[emailCol]).toLowerCase() === email)) {
    return jsonResponse({ error: "An account with this email already exists" }, 409);
  }

  const salt = generateSalt();
  const hash = hashPassword(password, salt);

  sheet.appendRow([email, hash, salt, fullName, role, office, status, new Date(), permissions]);

  return jsonResponse({ success: true });
}

function updateUserAccount(e, requestingUser) {
  const email = String(e.parameter.email || "").trim().toLowerCase();
  if (!email) return jsonResponse({ error: "Email is required" }, 400);

  const sheet = getOrCreateUsersSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idx = {
    email: headers.indexOf("Email"),
    fullName: headers.indexOf("FullName"),
    role: headers.indexOf("Role"),
    office: headers.indexOf("Office"),
    status: headers.indexOf("Status"),
    permissions: headers.indexOf("Permissions")
  };

  const rowIndex = data.findIndex((r, i) => i > 0 && String(r[idx.email]).toLowerCase() === email);
  if (rowIndex === -1) return jsonResponse({ error: "Account not found" }, 404);

  const targetOffice = data[rowIndex][idx.office];
  if (requestingUser.role !== "SuperAdmin" && targetOffice !== requestingUser.office) {
    return jsonResponse({ error: "You can only manage accounts in your own office" }, 403);
  }

  if (e.parameter.office !== undefined) {
    const requestedOffice = String(e.parameter.office || "").trim();
    if (!Object.prototype.hasOwnProperty.call(OFFICE_SHEETS, requestedOffice)) {
      return jsonResponse({ error: "A valid office is required" }, 400);
    }
    if (requestingUser.role !== "SuperAdmin" && requestedOffice !== requestingUser.office) {
      return jsonResponse({ error: "You can only assign accounts to your own office" }, 403);
    }
    sheet.getRange(rowIndex + 1, idx.office + 1).setValue(requestedOffice);
  }

  if (e.parameter.fullName !== undefined) {
    sheet.getRange(rowIndex + 1, idx.fullName + 1).setValue(e.parameter.fullName);
  }

  if (e.parameter.role !== undefined) {
    sheet.getRange(rowIndex + 1, idx.role + 1).setValue(e.parameter.role);
  }
  if (e.parameter.status !== undefined) {
    sheet.getRange(rowIndex + 1, idx.status + 1).setValue(e.parameter.status);
  }
  if (e.parameter.permissions !== undefined) {
    sheet.getRange(rowIndex + 1, idx.permissions + 1).setValue(e.parameter.permissions);
  }
  if (e.parameter.password) {
    const salt = generateSalt();
    const hash = hashPassword(e.parameter.password, salt);
    sheet.getRange(rowIndex + 1, headers.indexOf("PasswordHash") + 1).setValue(hash);
    sheet.getRange(rowIndex + 1, headers.indexOf("Salt") + 1).setValue(salt);
  }

  return jsonResponse({ success: true });
}

function deleteUserAccount(e, requestingUser) {
  const email = String(e.parameter.email || "").trim().toLowerCase();
  if (!email) return jsonResponse({ error: "Email is required" }, 400);

  if (email === String(requestingUser.email || "").trim().toLowerCase()) {
    return jsonResponse({ error: "You cannot delete your own account" }, 400);
  }

  const sheet = getOrCreateUsersSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailIndex = headers.indexOf("Email");
  const officeIndex = headers.indexOf("Office");
  const rowIndex = data.findIndex((row, index) =>
    index > 0 && String(row[emailIndex]).trim().toLowerCase() === email
  );

  if (rowIndex === -1) return jsonResponse({ error: "Account not found" }, 404);

  const targetOffice = data[rowIndex][officeIndex];
  if (requestingUser.role !== "SuperAdmin" && targetOffice !== requestingUser.office) {
    return jsonResponse({ error: "You can only manage accounts in your own office" }, 403);
  }

  sheet.deleteRow(rowIndex + 1);
  return jsonResponse({ success: true });
}

/*=========================================================
  LOGIN
=========================================================*/

function handleLogin(e) {
  const email = String(e.parameter.email || "").trim().toLowerCase();
  const password = String(e.parameter.password || "");

  if (!email || !password) {
    return jsonResponse({ error: "Email and password are required" }, 400);
  }

  const sheet = getOrCreateUsersSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  const idx = {
    email: headers.indexOf("Email"),
    hash: headers.indexOf("PasswordHash"),
    salt: headers.indexOf("Salt"),
    name: headers.indexOf("FullName"),
    role: headers.indexOf("Role"),
    office: headers.indexOf("Office"),
    status: headers.indexOf("Status"),
    permissions: headers.indexOf("Permissions")
  };

  const row = data.find(r => String(r[idx.email]).trim().toLowerCase() === email);

  if (!row) {
    return jsonResponse({ error: "Invalid email or password" }, 401);
  }

  if (String(row[idx.status]).trim() !== "Active") {
    return jsonResponse({ error: "This account is inactive. Contact an administrator." }, 403);
  }

  const computedHash = hashPassword(password, row[idx.salt]);
  if (computedHash !== row[idx.hash]) {
    return jsonResponse({ error: "Invalid email or password" }, 401);
  }

  const user = {
    email: email,
    fullName: row[idx.name],
    role: row[idx.role],
    office: row[idx.office],
    permissions: parsePermissions(row[idx.permissions])
  };

  const token = createSession(user);

  logActivity(user, "", "Login", "");

  return jsonResponse({
    success: true,
    token: token,
    user: user
  });
}

function handleLogout(e) {
  const token = e.parameter.token;
  if (!token) return jsonResponse({ success: true });

  const sheet = getOrCreateSessionsSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idx = {
    token: headers.indexOf("Token"),
    email: headers.indexOf("Email"),
    role: headers.indexOf("Role"),
    office: headers.indexOf("Office"),
    name: headers.indexOf("FullName")
  };

  for (let i = 1; i < data.length; i++) {
    if (data[i][idx.token] === token) {
      logActivity({
        email: data[i][idx.email],
        fullName: data[i][idx.name],
        role: data[i][idx.role],
        office: data[i][idx.office]
      }, "", "Logout", "");

      sheet.deleteRow(i + 1);
      break;
    }
  }

  return jsonResponse({ success: true });
}

/*=========================================================
  SESSIONS
=========================================================*/

function createSession(user) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getOrCreateSessionsSheet();
    const token = Utilities.getUuid();
    const now = new Date();
    const expires = new Date(now.getTime() + SESSION_DURATION_MS);

    sheet.appendRow([
      token,
      user.email,
      user.role,
      user.office,
      user.fullName,
      now,
      expires,
      (user.permissions || []).join(",")
    ]);

    cleanupExpiredSessions(sheet);

    return token;
  } finally {
    lock.releaseLock();
  }
}

function requireAuth(token) {
  if (!token) return { ok: false, error: "Missing session token" };

  const sheet = getOrCreateSessionsSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  const idx = {
    token: headers.indexOf("Token"),
    email: headers.indexOf("Email"),
    role: headers.indexOf("Role"),
    office: headers.indexOf("Office"),
    name: headers.indexOf("FullName"),
    expires: headers.indexOf("ExpiresAt"),
    permissions: headers.indexOf("Permissions")
  };

  const row = data.find(r => r[idx.token] === token);

  if (!row) return { ok: false, error: "Invalid session" };

  if (new Date(row[idx.expires]).getTime() < Date.now()) {
    return { ok: false, error: "Session expired" };
  }

  return {
    ok: true,
    user: {
      email: row[idx.email],
      role: row[idx.role],
      office: row[idx.office],
      fullName: row[idx.name],
      permissions: parsePermissions(row[idx.permissions])
    }
  };
}

function parsePermissions(raw) {
  if (!raw) return [];
  return String(raw).split(",").map(s => s.trim()).filter(Boolean);
}

function requireRole(user, allowedRoles) {
  return allowedRoles.indexOf(user.role) !== -1;
}

function cleanupExpiredSessions(sheet) {
  const data = sheet.getDataRange().getValues();
  const now = Date.now();

  // Walk backwards so row deletion doesn't skip rows.
  for (let i = data.length - 1; i >= 1; i--) {
    if (new Date(data[i][6]).getTime() < now) {
      sheet.deleteRow(i + 1);
    }
  }
}

/*=========================================================
  PASSWORD HASHING
  SHA-256 with a per-user random salt. Not bcrypt-grade,
  but Apps Script has no bcrypt — this is the practical
  ceiling in this environment. Never store plain passwords.
=========================================================*/

function hashPassword(password, salt) {
  const raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + salt,
    Utilities.Charset.UTF_8
  );
  return raw.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0")).join("");
}

function generateSalt() {
  return Utilities.getUuid();
}

/*=========================================================
  ADMIN-ONLY: CREATE A USER
  Run this manually from the Apps Script editor (select the
  function, click Run) to seed accounts. Never expose this
  as a web-facing action — there is no public self-signup.
=========================================================*/

function createUser_RUN_MANUALLY() {
  const email = "admin@example.gov.ph";       // change me
  const password = "TempPassw0rd!";           // change me, share securely, force reset on first login
  const fullName = "System Administrator";     // change me
  const role = "SuperAdmin";                   // SuperAdmin | OfficeAdmin | OfficeStaff
  const office = "Office of the Regional Director"; // change me
  const permissions = [];                      // SuperAdmin ignores this; leave empty

  const sheet = getOrCreateUsersSheet();
  const salt = generateSalt();
  const hash = hashPassword(password, salt);

  sheet.appendRow([
    email.trim().toLowerCase(),
    hash,
    salt,
    fullName,
    role,
    office,
    "Active",
    new Date(),
    permissions.join(",")
  ]);

  Logger.log("User created: " + email);
}

/*=========================================================
  SHEET SETUP HELPERS
=========================================================*/

function getOrCreateUsersSheet() {
  let sheet = SS.getSheetByName(USERS_SHEET_NAME);
  if (!sheet) {
    sheet = SS.insertSheet(USERS_SHEET_NAME);
  }

  ensureSheetHeaders(sheet, [
    "Email", "PasswordHash", "Salt", "FullName",
    "Role", "Office", "Status", "DateCreated", "Permissions"
  ]);

  return sheet;
}

function getOrCreateSessionsSheet() {
  let sheet = SS.getSheetByName(SESSIONS_SHEET_NAME);
  if (!sheet) {
    sheet = SS.insertSheet(SESSIONS_SHEET_NAME);
    sheet.appendRow([
      "Token", "Email", "Role", "Office",
      "FullName", "CreatedAt", "ExpiresAt", "Permissions"
    ]);
  }
  return sheet;
}

function ensureSheetHeaders(sheet, requiredHeaders) {
  const data = sheet.getDataRange().getValues();
  if (!data.length) {
    sheet.appendRow(requiredHeaders);
    return;
  }

  const existing = Array.isArray(data[0]) ? data[0].map(h => String(h || "").trim()) : [];
  const missing = requiredHeaders.filter(h => !existing.includes(h));

  if (missing.length) {
    const merged = existing.concat(missing);
    sheet.getRange(1, 1, 1, merged.length).setValues([merged]);
  }
}

function getOrCreateSessionsSheet() {
  let sheet = SS.getSheetByName(SESSIONS_SHEET_NAME);
  if (!sheet) {
    sheet = SS.insertSheet(SESSIONS_SHEET_NAME);
    sheet.appendRow([
      "Token", "Email", "Role", "Office",
      "FullName", "CreatedAt", "ExpiresAt", "Permissions"
    ]);
  }
  return sheet;
}

/*=========================================================
  RESPONSE HELPER
=========================================================*/

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
