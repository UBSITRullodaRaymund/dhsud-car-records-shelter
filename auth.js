/*=========================================================
  DHSUD-CAR RECORDS SHELTER
  Shared Auth Helper
  Include this on EVERY page (login.html and all protected
  pages), before any page-specific script tag.

  IMPORTANT: this file now owns API_URL. Remove the
  duplicate "const API_URL = ..." line from script.js,
  incoming.js, outgoing.js, dockets.js, etc. — redeclaring
  it in more than one loaded script will throw an error.
=========================================================*/

const API_URL =
"https://script.google.com/macros/s/AKfycbz-QHC1nioYNOrFQw7h2q6M44Barh7rwYjDzFZ1I1PdU6f24tkncUjJEWTvqS1WtTfr/exec";

const SESSION_KEY = "dhsud_session";

/*=========================================================
 SAVE / READ / CLEAR SESSION
=========================================================*/

function saveSession(token, user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }));
}

function getSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
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

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

/*=========================================================
 GUARD — call at the top of every protected page.
 Redirects to login.html if there is no local session.
 (This only checks that a token EXISTS client-side — the
 backend still independently validates it on every request,
 which is the check that actually matters for security.)
=========================================================*/

function requireLogin() {
    document.documentElement.dataset.requiresAuth = "true";
    const session = getSession();
    if (!session || !session.token) {
        window.location.replace("login.html");
    }
    return session;
}

window.addEventListener("pageshow", function () {
    if (document.documentElement.dataset.requiresAuth === "true" && !getToken()) {
        window.location.replace("login.html");
    }
});

window.addEventListener("storage", function (event) {
    if (event.key === SESSION_KEY && !event.newValue &&
        document.documentElement.dataset.requiresAuth === "true") {
        window.location.replace("login.html");
    }
});

/*=========================================================
 LOGOUT
=========================================================*/

function logout() {
    const token = getToken();

    if (token) {
        const formData = new FormData();
        formData.append("action", "logout");
        formData.append("token", token);
        fetch(API_URL, { method: "POST", body: formData, keepalive: true }).catch(() => {});
    }

    clearSession();
    window.location.href = "login.html";
}

/*=========================================================
 AUTHENTICATED FETCH HELPERS
 Use these instead of raw fetch() so the token is always
 attached, and a 401 always bounces back to login.
=========================================================*/

async function authedGet(params) {
    const token = getToken();
    const query = new URLSearchParams({ ...params, token }).toString();

    const response = await fetch(`${API_URL}?${query}`);
    const result = await response.json();

    if (isSessionError(response, result)) {
        clearSession();
        window.location.replace("login.html");
        return null;
    }

    return result;
}

async function authedPost(formData) {
    const token = getToken();
    formData.append("token", token);

    const response = await fetch(API_URL, { method: "POST", body: formData });
    const result = await response.json();

    if (isSessionError(response, result)) {
        clearSession();
        window.location.replace("login.html");
        return null;
    }

    return result;
}

function isSessionError(response, result) {
    const sessionErrors = ["Missing session token", "Invalid session", "Session expired"];
    return response.status === 401 || sessionErrors.includes(result && result.error);
}

/*=========================================================
 RENDER LOGGED-IN USER INFO + LOGOUT BUTTON
 Call this on page load, passing the ID of a container
 element in your nav (e.g. a <div id="userMenu"></div>).
=========================================================*/

/*=========================================================
 NORMALIZE RECORD FIELDS
 The backend already renames sheet headers into camelCase
 field keys before sending data (see normalizeDocumentHeader
 in Code.gs). This is a defensive pass-through so a page
 never breaks if a future header/module mapping gap slips
 a raw header through unmapped — it just returns the record
 as-is rather than throwing.
=========================================================*/

function normalizeRecordFields(record, module) {
    return record || {};
}

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

document.addEventListener("DOMContentLoaded", function () {
    const nav = document.querySelector("header nav");
    if (!nav || !getToken()) return;

    const loginLink = nav.querySelector('a[href="login.html"]');
    if (loginLink) {
        const loginItem = loginLink.closest("li");
        if (loginItem) loginItem.hidden = true;
        else loginLink.hidden = true;
    }

    let container = document.getElementById("userMenu");
    if (!container) {
        container = document.createElement("div");
        container.id = "userMenu";
        nav.appendChild(container);
    }

    renderUserMenu("userMenu");
});

/*=========================================================
 ADMIN NAV LINKS — only SuperAdmin / OfficeAdmin see the
 User Accounts and Activity Log links. Call on any page
 that has an element with this ID inside its <ul> nav.
=========================================================*/

function renderAdminLinks(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const user = getCurrentUser();
    if (!user) return;

    if (user.role === "SuperAdmin" || user.role === "OfficeAdmin") {
        container.innerHTML = `
            <li><a href="users.html">User Accounts</a></li>
            <li><a href="activity-log.html">Activity Log</a></li>
        `;
    }
}
