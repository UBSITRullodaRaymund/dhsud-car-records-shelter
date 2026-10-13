/*=========================================================
 DHSUD-CAR RECORDS SHELTER
 User Accounts (Admin)
=========================================================*/

if (!requireSuperAdmin()) {
    throw new Error("SuperAdmin access required");
}

const MODULES = [
    { key: "incoming",           label: "Incoming Documents" },
    { key: "outgoing",           label: "Outgoing Documents" },
    { key: "dockets",            label: "Dockets Issuances" },
    { key: "docketsMapping",     label: "Dockets Mapping" },
    { key: "recordsMasterList",  label: "Records Master List" },
    { key: "recordsTransfer",    label: "Records Transfer Custody" },
    { key: "foi",                label: "FOI Requests" }
];

const ACTIONS = ["view", "create", "edit", "delete"];

let users = [];
let editingEmail = null;

const tbody = document.getElementById("usersBody");
const modal = document.getElementById("userModal");
const form = document.getElementById("userForm");
const permissionsBody = document.querySelector("#permissionsTable tbody");

window.onload = function () {
    renderUserMenu("userMenu");
    buildPermissionsGrid();
    loadUsers();
};

/*=========================================================
 BUILD CHECKBOX GRID
=========================================================*/

function buildPermissionsGrid() {
    permissionsBody.innerHTML = "";

    MODULES.forEach(mod => {
        const row = document.createElement("tr");

        let cells = `<td>${mod.label}</td>`;

        ACTIONS.forEach(action => {
            const code = `${mod.key}:${action}`;
            cells += `
                <td>
                    <input type="checkbox" class="perm-checkbox" data-code="${code}">
                </td>
            `;
        });

        row.innerHTML = cells;
        permissionsBody.appendChild(row);
    });
}

function getCheckedPermissions() {
    return Array.from(document.querySelectorAll(".perm-checkbox"))
        .filter(cb => cb.checked)
        .map(cb => cb.dataset.code);
}

function setCheckedPermissions(codes) {
    document.querySelectorAll(".perm-checkbox").forEach(cb => {
        cb.checked = codes.includes(cb.dataset.code);
    });
}

/*=========================================================
 LOAD + RENDER USERS
=========================================================*/

async function loadUsers() {
    const result = await authedPost(buildFormData({ action: "listUsers" }));

    if (!result || result.error) {
        console.error(result && result.error);
        return;
    }

    users = result;
    renderTable();
}

function renderTable() {
    if (users.length === 0) {
        tbody.innerHTML = "";
        document.getElementById("emptyState").style.display = "flex";
        return;
    }
    document.getElementById("emptyState").style.display = "none";

    const fragment = document.createDocumentFragment();
    users.forEach((u, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${escapeHtml(u.fullName || "-")}</td>
            <td>${escapeHtml(u.email || "-")}</td>
            <td>${escapeHtml(u.role || "-")}</td>
            <td>${escapeHtml(u.office || "-")}</td>
            <td><span class="status-badge">${escapeHtml(u.status || "-")}</span></td>
            <td class="action-buttons">
                <button class="icon-btn edit-btn" data-action="edit" data-index="${index}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="icon-btn delete-btn" data-action="delete" data-index="${index}" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        fragment.appendChild(row);
    });

    tbody.innerHTML = "";
    tbody.appendChild(fragment);
}

/*=========================================================
 MODAL CONTROLS
=========================================================*/

document.getElementById("openModal").addEventListener("click", () => openModal());
document.getElementById("closeModal").addEventListener("click", closeModal);
document.getElementById("cancelModal").addEventListener("click", closeModal);
tbody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const index = Number(button.dataset.index);
    const action = button.dataset.action;
    if (Number.isNaN(index)) return;

    if (action === "edit") editUser(index);
    if (action === "delete") deleteUser(index);
});

function openModal() {
    editingEmail = null;
    form.reset();
    setCheckedPermissions([]);
    document.getElementById("modalTitle").textContent = "New Account";
    document.getElementById("password").required = true;
    document.getElementById("password").placeholder = "Set an initial password";
    document.getElementById("email").disabled = false;
    modal.style.display = "flex";
}

function closeModal() {
    modal.style.display = "none";
}

function editUser(index) {
    const u = users[index];
    editingEmail = u.email;

    document.getElementById("modalTitle").textContent = "Edit Account";
    document.getElementById("fullName").value = u.fullName || "";
    document.getElementById("email").value = u.email;
    document.getElementById("email").disabled = true; // email is the account key — not editable here
    document.getElementById("password").value = "";
    document.getElementById("password").required = false;
    document.getElementById("password").placeholder = "Leave blank to keep unchanged";
    document.getElementById("role").value = u.role;
    document.getElementById("office").value = u.office;
    document.getElementById("status").value = u.status;

    setCheckedPermissions(u.permissions || []);

    modal.style.display = "flex";
}

async function deleteUser(index) {
    const user = users[index];
    if (!user || !confirm(`Delete the account for ${user.fullName || user.email}?`)) return;

    const result = await authedPost(buildFormData({
        action: "deleteUserAccount",
        email: user.email
    }));

    if (!result || result.error) {
        alert(result ? result.error : "Account deletion failed");
        return;
    }

    loadUsers();
}

window.addEventListener("click", e => {
    if (e.target === modal) closeModal();
});

/*=========================================================
 SAVE (CREATE OR UPDATE)
=========================================================*/

form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;

    const permissions = getCheckedPermissions().join(",");

    if (editingEmail) {

        const result = await authedPost(buildFormData({
            action: "updateUserAccount",
            email: editingEmail,
            fullName: document.getElementById("fullName").value,
            office: document.getElementById("office").value,
            role: document.getElementById("role").value,
            status: document.getElementById("status").value,
            permissions: permissions,
            password: document.getElementById("password").value
        }));

        if (!result || result.error) {
            alert(result ? result.error : "Update failed");
            return;
        }

    } else {

        const result = await authedPost(buildFormData({
            action: "createUserAccount",
            fullName: document.getElementById("fullName").value,
            email: document.getElementById("email").value,
            password: document.getElementById("password").value,
            role: document.getElementById("role").value,
            office: document.getElementById("office").value,
            status: document.getElementById("status").value,
            permissions: permissions
        }));

        if (!result || result.error) {
            alert(result ? result.error : "Account creation failed");
            return;
        }
    }

    closeModal();
    loadUsers();
});

/*=========================================================
 HELPER
=========================================================*/

function buildFormData(fields) {
    const fd = new FormData();
    Object.entries(fields).forEach(([key, value]) => fd.append(key, value));
    return fd;
}
