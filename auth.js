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
"https://script.google.com/macros/s/AKfycbzB000NSx4wtVSrn-_tEJZ6AiIRLGQlTZrDvZNbULkSaf7LJDLM33nz7dXjsoDuXXGY/exec";

const SESSION_KEY = "dhsud_session";

function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeInlineJsString(value) {
    return escapeHtml(JSON.stringify(String(value == null ? "" : value)));
}

function safeHttpUrl(value) {
    try {
        const url = new URL(String(value || ""), window.location.href);
        const allowedHosts = ["drive.google.com", "docs.google.com", "drive.usercontent.google.com"];
        return url.protocol === "https:" && allowedHosts.includes(url.hostname) ? url.href : "";
    } catch (error) {
        return "";
    }
}

function sanitizeInputText(value) {
    return String(value == null ? "" : value)
        .normalize("NFC")
        .replace(/\r\n?/g, "\n")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .trim();
}

function normalizeStatusValue(value) {
    return String(value == null ? "" : value).trim().toUpperCase();
}

/*=========================================================
 SAVE / READ / CLEAR SESSION
=========================================================*/

function saveSession(token, user, csrfToken) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user, csrfToken }));
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

function getCsrfToken() {
    const session = getSession();
    return session ? session.csrfToken : null;
}

function getCurrentUser() {
    const session = getSession();
    return session ? session.user : null;
}

function getRequestOffice() {
    const user = getCurrentUser();
    return user && user.office ? user.office : "";
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

function requireSuperAdmin() {
    const session = requireLogin();
    if (!session || !session.token) return false;

    if (!session.user || session.user.role !== "SuperAdmin") {
        window.location.replace("index.html");
        return false;
    }

    return true;
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

async function logout() {
    const token = getToken();

    if (token) {
        try {
            let csrfToken = getCsrfToken();
            if (!csrfToken) {
                const response = await fetch(`${API_URL}?action=validateSession&token=${encodeURIComponent(token)}`);
                const session = await response.json();
                csrfToken = session.csrfToken;
            }

            if (csrfToken) {
                const formData = new FormData();
                formData.append("action", "logout");
                formData.append("token", token);
                formData.append("csrfToken", csrfToken);
                await fetch(API_URL, { method: "POST", body: formData, keepalive: true });
            }
        } catch (error) {
            console.error("Could not revoke the server session", error);
        }
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
    const csrfToken = getCsrfToken();
    if (!token || !csrfToken) {
        clearSession();
        window.location.replace("login.html");
        return null;
    }
    for (const [key, value] of Array.from(formData.entries())) {
        if (typeof value === "string" && !["password", "token", "csrfToken"].includes(key)) {
            formData.set(key, sanitizeInputText(value));
        }
    }
    formData.append("token", token);
    formData.append("csrfToken", csrfToken);

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
    if (!record || typeof record !== "object") return record || {};
    if (typeof record.status === "string") {
        record.status = normalizeStatusValue(record.status);
    }
    return record;
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
                ${escapeHtml(user.fullName)} <small>(${escapeHtml(user.role)})</small>
            </span>
            <button class="logout-btn" onclick="logout()">
                <i class="fa-solid fa-right-from-bracket"></i> Logout
            </button>
        </div>
    `;
}

document.addEventListener("DOMContentLoaded", function () {
    const nav = document.querySelector("header nav");
    if (!getToken()) return;

    if (nav) {
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
    }

    renderAdminLinks();
});

/*=========================================================
 ADMIN NAV LINKS — only SuperAdmin sees these links.
=========================================================*/

function renderAdminLinks(containerId) {
    const nav = document.querySelector("header nav, header.navbar .container");
    const container = containerId
        ? document.getElementById(containerId)
        : nav && nav.querySelector("ul");
    if (!container) return;

    const user = getCurrentUser();
    if (!user) return;

    if (user.role === "SuperAdmin") {
        const links = [
            { href: "users.html", label: "User Accounts" },
            { href: "activity-log.html", label: "Activity Log" }
        ];
        const currentPage = window.location.pathname.split("/").pop();

        links.forEach(function (link) {
            let anchor = container.querySelector(`a[href="${link.href}"]`);
            if (!anchor) {
                const item = document.createElement("li");
                anchor = document.createElement("a");
                anchor.href = link.href;
                anchor.textContent = link.label;
                item.appendChild(anchor);
                container.appendChild(item);
            }

            if (currentPage === link.href) {
                anchor.classList.add("active");
                anchor.setAttribute("aria-current", "page");
            }
        });
    }
}
