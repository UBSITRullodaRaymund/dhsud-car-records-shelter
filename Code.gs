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
  "Administrative and Finance Office": "",
  "Housing Real Estate Development Regulation Office": "",
  "Homeowners Association and Community Development Office": "",
  "Environmental, Land Use and Urban Planning Office": "",
  "Public Housing and Settlement Division": "",
  "Office of the Regional Director": ""
};

// Opens the correct office spreadsheet and returns the requested tab.
// Throws if the office or tab name isn't recognized, rather than
// silently reading the wrong data.
function getOfficeSheet(officeName, tabName) {
  if (!Object.prototype.hasOwnProperty.call(OFFICE_SHEETS, officeName)) {
    throw new Error("Unknown office: " + officeName);
  }
  const spreadsheetId = OFFICE_SHEETS[officeName] || DEFAULT_DATA_SPREADSHEET_ID;
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    throw new Error("Tab '" + tabName + "' not found in " + officeName);
  }
  return sheet;
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

function doGet() {
  return jsonResponse({ error: "MySQL is the system of record. Read data through the PHP application." });
}

function getDashboardStats(auth, requestedOffice) {
  const office = resolveOffice(auth, requestedOffice);
  const definitions = [
    { module: "incoming", sheet: "Incoming Documents" },
    { module: "outgoing", sheet: "Outgoing Documents" },
    { module: "dockets", sheet: "Dockets Issuances" },
    { module: "docketsMapping", sheet: "Dockets Mapping" },
    { module: "foi", sheet: "FOI" }
  ];
  const modules = {};
  const totals = { "In progress": 0, Pending: 0, Completed: 0, Other: 0 };

  definitions.forEach(definition => {
    if (!hasPermission(auth.user, definition.module + ":view")) {
      modules[definition.module] = { allowed: false };
      return;
    }

    try {
      const sheet = getOfficeSheet(office, definition.sheet);
      const values = sheet.getDataRange().getValues();
      const headers = values.shift() || [];
      const statusColumn = headers.findIndex((header, index) =>
        normalizeDocumentHeader(header, definition.sheet, 0) === "status"
      );
      const result = { allowed: true, count: 0, statuses: { "In progress": 0, Pending: 0, Completed: 0, Other: 0 } };

      values.forEach(row => {
        if (!row.some(value => value !== "" && value !== null)) return;
        result.count++;
        if (statusColumn < 0) return;

        const category = dashboardStatusCategory(row[statusColumn]);
        if (category) {
          result.statuses[category]++;
          totals[category]++;
        }
      });

      modules[definition.module] = result;
    } catch (error) {
      modules[definition.module] = { allowed: true, error: error.message };
    }
  });

  return { success: true, office: office, modules: modules, statuses: totals };
}

function dashboardStatusCategory(value) {
  const status = String(value || "").trim().toLowerCase();
  if (!status) return "";
  if (/complete|closed|released|accomplished|denied/.test(status)) return "Completed";
  if (/pending|received|new|for review/.test(status)) return "Pending";
  if (/process|ongoing|routed|assigned|awaiting|active/.test(status)) return "In progress";
  return "Other";
}

function documentRecord(headers, row, sheetName) {
  const record = {};
  const occurrences = {};
  headers.forEach((header, index) => {
    const baseKey = String(header || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const occurrence = occurrences[baseKey] || 0;
    occurrences[baseKey] = occurrence + 1;
    record[normalizeDocumentHeader(header, sheetName, occurrence)] = row[index];
  });
  return record;
}

function documentVersion(headers, row, sheetName) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(documentRecord(headers, row, sheetName)),
    Utilities.Charset.UTF_8
  );
  return digest.map(byte => (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, "0")).join("");
}

function normalizeDocumentHeader(header, sheetName, occurrence = 0) {
  const key = String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (!key && sheetName === "Incoming Documents") return "routingSlip";
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
    ,dateofdocument: "dateDocument"
    ,datereleased: "dateReleased"
    ,to: "to"
    ,actionno: "actionNo"
    ,commentsremarks: "comments"
    ,receivedby: "receivedBy"
    ,emailadd: "email"
    ,remindersent: "reminderSent"
    ,datecompleted: "dateCompleted"
    ,modeofcommunication: sheetName === "Incoming Documents" ? "mode" : "communicationMode"
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
    transactionno: "transactionNo",
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
    ifdeniedreasondenial: occurrence > 0 ? "decisionDenialReason" : "denialReason",
    secondreceivingofficerassigned: "secondOfficer",
    decisiononapplication: "decision",
    daterequestfinished: "dateFinished",
    foiregistryaccomplished: "registryAccomplished"
  };

  return (isFoi && foi[key]) || (isDockets && dockets[key]) || common[key] || header;
}

function doPost(e) {
  try {
    const parameters = e && e.parameter ? e.parameter : {};
    if (parameters.action === "syncDatabaseMirror") return syncDatabaseMirror(e);
    return jsonResponse({ error: "MySQL is the system of record. Writes must go through the PHP application." });
  } catch (error) {
    console.error("MySQL mirror request failed.", error && error.stack ? error.stack : error);

    let authorized = false;
    try {
      const parameters = e && e.parameter ? e.parameter : {};
      const expected = PropertiesService.getScriptProperties().getProperty("DHSUD_MIRROR_SECRET");
      const supplied = String(parameters.secret || "");
      authorized = Boolean(expected && supplied && expected === supplied);
    } catch (authError) {
      console.error("Could not verify the mirror request while handling an error.", authError);
    }

    return jsonResponse({
      error: authorized ? String(error.message || error) : "Mirror request failed."
    });
  }
}

function syncDatabaseMirror(e) {
    const expectedSecret = PropertiesService.getScriptProperties().getProperty("DHSUD_MIRROR_SECRET");
    const suppliedSecret = String(e.parameter.secret || "");
    if (!expectedSecret || !suppliedSecret || expectedSecret !== suppliedSecret) {
      return jsonResponse({ error: "Spreadsheet mirror authentication failed." });
    }

    let payload;
    try {
      payload = JSON.parse(String(e.parameter.payload || "{}"));
      if (!payload || typeof payload !== "object") throw new Error("Invalid mirror payload.");
    } catch (error) {
      return jsonResponse({ error: "Spreadsheet mirror payload is invalid." });
    }

    const lock = LockService.getScriptLock();
    let lockAcquired = false;
    try {
      lock.waitLock(10000);
      lockAcquired = true;
      const kind = String(e.parameter.kind || "");
      if (kind === "records") {
        return syncDatabaseRecords(String(e.parameter.module || ""), payload);
      }
      if (kind === "users") {
        return syncDatabaseUsers(payload);
      }
      if (kind === "activity") {
        return syncDatabaseActivity(payload);
      }
      return jsonResponse({ error: "Unsupported spreadsheet mirror type." });
    } catch (error) {
      console.error("MySQL mirror update failed.", error);
      return jsonResponse({ error: String(error.message || error) });
    } finally {
      if (lockAcquired) lock.releaseLock();
    }
  }

function syncDatabaseRecords(module, payload) {
    const sheets = {
      incoming: "Incoming Documents",
      outgoing: "Outgoing Documents",
      dockets: "Dockets Issuances",
      docketsMapping: "Dockets Mapping",
      foi: "FOI"
    };
    const sheetName = sheets[module];
    if (!sheetName || !Array.isArray(payload.records)) {
      return jsonResponse({ error: "Invalid records mirror request." });
    }
    const chunkIndex = Math.max(0, Number(payload.chunkIndex) || 0);
    const officeOffsets = payload.offsetsByOffice || {};

    const officeNames = Object.keys(OFFICE_SHEETS);
    const destinations = {};
    officeNames.forEach(office => {
      const spreadsheetId = OFFICE_SHEETS[office] || DEFAULT_DATA_SPREADSHEET_ID;
      if (!destinations[spreadsheetId]) destinations[spreadsheetId] = { offices: [], includeUnassigned: false };
      destinations[spreadsheetId].offices.push(office);
      if (!OFFICE_SHEETS[office]) destinations[spreadsheetId].includeUnassigned = true;
    });

    Object.keys(destinations).forEach(spreadsheetId => {
      const destination = destinations[spreadsheetId];
      const mirrored = payload.records.filter(entry =>
        destination.offices.includes(String(entry.office || ""))
        || (destination.includeUnassigned && !entry.office)
        || (!officeNames.includes(String(entry.office || "")) && destination.includeUnassigned)
      );
      const destinationOffset = destination.offices.reduce(
        (total, office) => total + Number(officeOffsets[office] || 0),
        destination.includeUnassigned ? Number(officeOffsets.__unassigned || 0) : 0
      );
      const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      let sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) sheet = spreadsheet.insertSheet(sheetName);

      let headers = sheet.getLastColumn() > 0
        ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
        : [];
      if (!headers.length || headers.every(header => String(header || "").trim() === "")) {
        headers = mirrored.length ? Object.keys(mirrored[0].data) : [];
        if (headers.length) {
          ensureSheetSize(sheet, 1, headers.length);
          sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        }
      }

      const rows = mirrored.map(entry => {
        const occurrences = {};
        return headers.map(header => {
          const key = String(header || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
          const occurrence = occurrences[key] || 0;
          occurrences[key] = occurrence + 1;
          const field = normalizeDocumentHeader(header, sheetName, occurrence);
          const value = entry.data[field];
          if ((field === "office" || field === "recordOffice") && (value === undefined || value === "")) {
            return entry.office || "";
          }
          return value === undefined || value === null ? "" : value;
        });
      });

      if (chunkIndex === 0) {
        const lastRow = sheet.getLastRow();
        if (lastRow > 1 && sheet.getLastColumn() > 0) {
          sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
        }
      }
      if (rows.length && headers.length) {
        ensureSheetSize(sheet, destinationOffset + rows.length + 1, headers.length);
        sheet.getRange(destinationOffset + 2, 1, rows.length, headers.length).setValues(rows);
      }
    });
    return jsonResponse({ success: true });
  }

function syncDatabaseUsers(payload) {
    if (!Array.isArray(payload.users)) return jsonResponse({ error: "Invalid users mirror request." });
    const sheet = getOrCreateUsersSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const chunkIndex = Math.max(0, Number(payload.chunkIndex) || 0);
    const startIndex = Math.max(0, Number(payload.startIndex) || 0);
    const users = payload.users.map(user => headers.map(header => {
      switch (String(header).trim()) {
        case "Email": return user.email || "";
        case "PasswordHash": return "";
        case "Salt": return "";
        case "FullName": return user.fullName || "";
        case "Role": return user.role || "";
        case "Office": return user.office || "";
        case "Status": return user.status || "";
        case "DateCreated": return user.dateCreated || "";
        case "Permissions": return Array.isArray(user.permissions) ? user.permissions.join(",") : "";
        default: return "";
      }
    }));

    if (chunkIndex === 0) {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
    }
    if (users.length) {
      ensureSheetSize(sheet, startIndex + users.length + 1, headers.length);
      sheet.getRange(startIndex + 2, 1, users.length, headers.length).setValues(users);
    }
    return jsonResponse({ success: true });
  }

function syncDatabaseActivity(payload) {
    if (!Array.isArray(payload.activity)) return jsonResponse({ error: "Invalid activity mirror request." });
    const sheet = getOrCreateActivityLogSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const chunkIndex = Math.max(0, Number(payload.chunkIndex) || 0);
    const startIndex = Math.max(0, Number(payload.startIndex) || 0);
    const activity = payload.activity.map(entry => headers.map(header => entry[header] || ""));
    if (chunkIndex === 0) {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
    }
    if (activity.length) {
      ensureSheetSize(sheet, startIndex + activity.length + 1, headers.length);
      sheet.getRange(startIndex + 2, 1, activity.length, headers.length).setValues(activity);
    }
    return jsonResponse({ success: true });
  }

function ensureSheetSize(sheet, minimumRows, minimumColumns) {
    if (sheet.getMaxRows() < minimumRows) {
      sheet.insertRowsAfter(sheet.getMaxRows(), minimumRows - sheet.getMaxRows());
    }
    if (sheet.getMaxColumns() < minimumColumns) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), minimumColumns - sheet.getMaxColumns());
    }
  }

function doPostRemaining(e) {
  const action = e.parameter.action;
  const auth = requireAuth(e.parameter.token);
  if (!auth.ok) return jsonResponse({ error: auth.error }, 401);

  if (action === "update") {
    const module = e.parameter.module;
    if (!hasPermission(auth.user, module + ":edit")) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    try {
      const office = resolveOffice(auth, e.parameter.office);
      const sheet = getOfficeSheet(office, e.parameter.sheet);
      const recordLock = LockService.getScriptLock();
      recordLock.waitLock(10000);
      try {
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

        const rowIndex = data.findIndex((r, i) => i > 0 && String(r[idCol]) === String(idValue));
        if (rowIndex === -1) return jsonResponse({ error: "Record not found" }, 404);
        if (e.parameter.syncVersion && documentVersion(headers, data[rowIndex], e.parameter.sheet) !== e.parameter.syncVersion) {
          return jsonResponse({ error: "This record changed in the spreadsheet. Reload it before saving.", conflict: true }, 409);
        }

        const updateOccurrences = {};
        headers.forEach((h, colIndex) => {
          const baseKey = String(h || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
          const occurrence = updateOccurrences[baseKey] || 0;
          updateOccurrences[baseKey] = occurrence + 1;
          const field = normalizeDocumentHeader(h, e.parameter.sheet, occurrence);
          if (e.parameter[field] !== undefined) {
            sheet.getRange(rowIndex + 1, colIndex + 1).setValue(e.parameter[field]);
          }
        });
      } finally {
        recordLock.releaseLock();
      }

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
      const recordLock = LockService.getScriptLock();
      recordLock.waitLock(10000);
      let idValue = e.parameter.idValue;
      try {
        const idField = e.parameter.idField;

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

        const rowIndex = data.findIndex((r, i) => i > 0 && String(r[idCol]) === String(idValue));
        if (rowIndex === -1) return jsonResponse({ error: "Record not found" }, 404);
        if (e.parameter.syncVersion && documentVersion(headers, data[rowIndex], e.parameter.sheet) !== e.parameter.syncVersion) {
          return jsonResponse({ error: "This record changed in the spreadsheet. Reload it before deleting.", conflict: true }, 409);
        }

        sheet.deleteRow(rowIndex + 1);
      } finally {
        recordLock.releaseLock();
      }

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

function updateOwnProfile(e, requestingUser) {
  const currentPassword = String(e.parameter.currentPassword || "");
  const fullName = String(e.parameter.fullName || "").trim();
  const email = String(e.parameter.email || "").trim().toLowerCase();
  const newPassword = String(e.parameter.newPassword || "");

  if (!currentPassword || !fullName || !email) {
    return jsonResponse({ error: "Current password, full name, and email are required." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: "Enter a valid email address." }, 400);
  }
  if (newPassword && newPassword.length < 8) {
    return jsonResponse({ error: "A new password must be at least 8 characters." }, 400);
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const usersSheet = getOrCreateUsersSheet();
    const users = usersSheet.getDataRange().getValues();
    const headers = users[0];
    const columns = {
      email: headers.indexOf("Email"),
      passwordHash: headers.indexOf("PasswordHash"),
      salt: headers.indexOf("Salt"),
      fullName: headers.indexOf("FullName"),
      role: headers.indexOf("Role"),
      office: headers.indexOf("Office"),
      status: headers.indexOf("Status"),
      permissions: headers.indexOf("Permissions")
    };
    const currentEmail = String(requestingUser.email || "").trim().toLowerCase();
    const rowIndex = users.findIndex((row, index) =>
      index > 0 && String(row[columns.email]).trim().toLowerCase() === currentEmail
    );
    if (rowIndex < 1) return jsonResponse({ error: "Account not found." }, 404);

    const row = users[rowIndex];
    if (String(row[columns.status]).trim() !== "Active") {
      return jsonResponse({ error: "This account is inactive." }, 403);
    }
    if (hashPassword(currentPassword, row[columns.salt]) !== String(row[columns.passwordHash])) {
      return jsonResponse({ error: "Current password is incorrect." }, 403);
    }
    if (users.some((candidate, index) =>
      index !== rowIndex && String(candidate[columns.email]).trim().toLowerCase() === email
    )) {
      return jsonResponse({ error: "An account with this email already exists." }, 409);
    }

    const sessionsSheet = getOrCreateSessionsSheet();
    let sessions = sessionsSheet.getDataRange().getValues();
    let sessionHeaders = sessions[0];
    const tokenColumn = sessionHeaders.indexOf("Token");
    const emailColumn = sessionHeaders.indexOf("Email");
    const nameColumn = sessionHeaders.indexOf("FullName");
    let sessionIndex = sessions.findIndex((session, index) =>
      index > 0 && session[tokenColumn] === e.parameter.token
    );
    if (sessionIndex < 1) {
      return jsonResponse({ error: "The current session could not be updated." }, 401);
    }

    usersSheet.getRange(rowIndex + 1, columns.email + 1).setValue(email);
    usersSheet.getRange(rowIndex + 1, columns.fullName + 1).setValue(fullName);
    if (newPassword) {
      const salt = generateSalt();
      usersSheet.getRange(rowIndex + 1, columns.passwordHash + 1).setValue(hashPassword(newPassword, salt));
      usersSheet.getRange(rowIndex + 1, columns.salt + 1).setValue(salt);
    }

    const updatedUser = {
      email: email,
      fullName: fullName,
      role: row[columns.role],
      office: row[columns.office],
      status: row[columns.status],
      permissions: parsePermissions(row[columns.permissions])
    };
    for (let index = sessions.length - 1; index > 0; index--) {
      if (index !== sessionIndex && String(sessions[index][emailColumn]).trim().toLowerCase() === currentEmail) {
        sessionsSheet.deleteRow(index + 1);
      }
    }

    sessions = sessionsSheet.getDataRange().getValues();
    sessionHeaders = sessions[0];
    sessionIndex = sessions.findIndex((session, index) =>
      index > 0 && session[sessionHeaders.indexOf("Token")] === e.parameter.token
    );
    sessionsSheet.getRange(sessionIndex + 1, emailColumn + 1).setValue(email);
    sessionsSheet.getRange(sessionIndex + 1, nameColumn + 1).setValue(fullName);

    lock.releaseLock();
    let activityWarning = "";
    try {
      logActivity(updatedUser, "", "Update Profile", "");
    } catch (error) {
      console.error("Profile was updated, but the activity log could not be written.", error);
      activityWarning = "Your profile was saved, but the activity log could not be updated.";
    }
    return jsonResponse({ success: true, user: updatedUser, activityWarning: activityWarning });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
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
