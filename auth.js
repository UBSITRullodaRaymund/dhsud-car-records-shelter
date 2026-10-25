/*=========================================================
  DHSUD-CAR RECORDS SHELTER
  Shared Auth Helper
  Include this on EVERY page (login and all protected
  pages), before any page-specific script tag.

  IMPORTANT: this file now owns API_URL. Remove the
  duplicate "const API_URL = ..." line from script.js,
  incoming.js, outgoing.js, dockets.js, etc. — redeclaring
  it in more than one loaded script will throw an error.
=========================================================*/

const API_URL = "api/index.php";

const SESSION_KEY = "dhsud_session";
const DEFAULT_REQUEST_OFFICE = "Office of the Regional Director";

/*=========================================================
 SAVE / READ / CLEAR SESSION
=========================================================*/

function saveSession(token, user, csrfToken) {
    const payload = JSON.stringify({ token, user, csrfToken });
    localStorage.setItem(SESSION_KEY, payload);
    sessionStorage.setItem(SESSION_KEY, payload);
}

function getSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;

        const session = JSON.parse(raw);
        if (session && session.token) {
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        }

        return session;
    } catch (e) {
        return null;
    }
}

function getToken() {
    const session = getSession();
    return session ? session.token : null;
}

function getCurrentUser() {
    const session = getSession();
    return session ? session.user : null;
}

function getRequestOffice() {
    const user = getCurrentUser();
    return user && user.office ? user.office : DEFAULT_REQUEST_OFFICE;
}

function canEditRecordInOwnOffice(record) {
    const user = getCurrentUser();
    return !record || !record._recordOffice || !user
        || user.role === "SuperAdmin"
        || record._recordOffice === user.office;
}

function getRecordOffice(record) {
    const user = getCurrentUser();
    if (user && user.role === "SuperAdmin" && record && record._recordOffice) {
        return record._recordOffice;
    }
    return getRequestOffice();
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
}

/*=========================================================
 GUARD — call at the top of every protected page.
 Redirects to the PHP login route if there is no local session.
 (This only checks that a token EXISTS client-side — the
 backend still independently validates it on every request,
 which is the check that actually matters for security.)
=========================================================*/

function requireLogin() {
    const session = getSession();
    if (!session || !session.token) {
        clearSession();
        window.location.href = "login";
        return null;
    }
    return session;
}

/*=========================================================
 LOGOUT
=========================================================*/

async function logout() {
    const token = getToken();
    const session = getSession();

    if (token) {
        try {
            const formData = new FormData();
            formData.append("action", "logout");
            formData.append("token", token);
            await fetch(API_URL, {
                method: "POST",
                body: formData,
                credentials: "same-origin",
                headers: { "X-CSRF-Token": session ? session.csrfToken : "" }
            });
        } catch (e) {
            // Non-fatal — clear locally regardless.
        }
    }

    clearSession();
    window.location.href = "login";
}

/*=========================================================
 AUTHENTICATED FETCH HELPERS
 Use these instead of raw fetch() so the token is always
 attached, and a 401 always bounces back to login.
=========================================================*/

async function authedGet(params) {
    const token = getToken();
    const query = new URLSearchParams({ ...params, token }).toString();

    const response = await fetch(`${API_URL}?${query}`, { credentials: "same-origin" });
    const result = await response.json();

    if (response.status === 401) {
        clearSession();
        window.location.href = "login";
        return null;
    }

    return result;
}

async function authedPost(formData) {
    const token = getToken();
    const session = getSession();
    formData.append("token", token);

    const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        headers: { "X-CSRF-Token": session ? session.csrfToken : "" }
    });
    const result = await response.json();

    if (response.status === 401) {
        clearSession();
        window.location.href = "login";
        return null;
    }

    return result;
}

function normalizeRecordFields(record, moduleName) {
    const normalized = {};
    const isDockets = moduleName === "dockets";
    const aliases = {
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
        driveurl: "driveUrl",
        googledrivelink: "driveUrl",
        project: "project",
        folder: "folder",
        filetype: "fileType",
        filesize: "fileSize",
        dateuploaded: "dateUploaded",
        dateofdocument: "dateDocument",
        datereleased: "dateReleased",
        to: "to",
        from: "from",
        signatory: "signatory",
        deadline: "deadline",
        actionno: "actionNo",
        commentsremarks: "comments",
        receivedby: "receivedBy",
        emailadd: "email",
        remindersent: "reminderSent",
        datecompleted: "dateCompleted",
        daterequest: "dateRequest",
        documentfilename: "documentName",
        documentname: "documentName",
        classification: "classification",
        requestedby: "requestedBy",
        releasedby: "releasedBy",
        datereturned: "dateReturned",
        returnedby: "returnedBy",
        verifiedby: "verifiedBy"
        ,transactionno: "transactionNo"
        ,title: "title"
        ,contactnoemail: "contactEmail"
        ,modeofcommunication: moduleName === "incoming" || moduleName === "outgoing" ? "mode" : "communicationMode"
        ,typeofid: "idType"
        ,agencyconnectingagency: "agency"
        ,titleofdocumentrecordrequested: "documentRequested"
        ,dateperiod: "datePeriod"
        ,purposeofrequest: "purpose"
        ,documenttype: "documentType"
        ,referenceno: "referenceNo"
        ,additionalinformation: "additionalInformation"
        ,dateaccomplished: "dateAccomplished"
        ,dateenteredonefoi: "dateEnteredEfoi"
        ,proofofidpresented: "proofOfId"
        ,requestisrecommendedtobe: "recommendation"
        ,ifdeniedreasondenial: "denialReason"
        ,secondreceivingofficerassigned: "secondOfficer"
        ,decisiononapplication: "decision"
        ,daterequestfinished: "dateFinished"
        ,foiregistryaccomplished: "registryAccomplished"
    };

    Object.entries(record || {}).forEach(([key, value]) => {
        const compactKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        normalized[aliases[compactKey] || key] = value;
    });

    return normalized;
}

/*=========================================================
 RENDER LOGGED-IN USER INFO + LOGOUT BUTTON
 Call this on page load, passing the ID of a container
 element in your nav (e.g. a <div id="userMenu"></div>).
=========================================================*/

function renderUserMenu(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const user = getCurrentUser();
    if (!user) return;

    container.innerHTML = `
        <div class="user-menu">
            <span class="user-name">
                <i class="fa-solid fa-user-circle"></i>
                ${user.fullName} <small>(${user.role})</small>
            </span>
            <button class="logout-btn" onclick="logout()">
                <i class="fa-solid fa-right-from-bracket"></i> Logout
            </button>
        </div>
    `;
}
