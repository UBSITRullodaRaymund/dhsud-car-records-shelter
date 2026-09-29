/*=========================================================
 DHSUD-CAR RECORDS SHELTER
 Activity Log
=========================================================*/

requireLogin();

let logs = [];

const tbody = document.getElementById("logBody");
const searchInput = document.getElementById("searchInput");
const actionFilter = document.getElementById("actionFilter");

window.onload = function () {
    renderUserMenu("userMenu");
    loadActivity();
};

async function loadActivity() {
    const fd = new FormData();
    fd.append("action", "listActivity");

    const result = await authedPost(fd);

    if (!result || result.error) {
        console.error(result && result.error);
        return;
    }

    logs = result;
    renderTable();
}

function renderTable() {
    const search = searchInput.value.trim().toLowerCase();
    const actionValue = actionFilter.value;

    const filtered = logs.filter(l => {
        const matchesSearch =
            !search ||
            String(l.FullName).toLowerCase().includes(search) ||
            String(l.Email).toLowerCase().includes(search) ||
            String(l.Module).toLowerCase().includes(search) ||
            String(l.Office).toLowerCase().includes(search);

        const matchesAction = !actionValue || l.Action === actionValue;

        return matchesSearch && matchesAction;
    });

    tbody.innerHTML = "";

    if (filtered.length === 0) {
        document.getElementById("emptyState").style.display = "flex";
        return;
    }
    document.getElementById("emptyState").style.display = "none";

    filtered.forEach(l => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${formatTimestamp(l.Timestamp)}</td>
            <td>${l.FullName || l.Email}<br><small>${l.Email}</small></td>
            <td>${l.Office || "-"}</td>
            <td>${l.Module || "-"}</td>
            <td><span class="status-badge ${String(l.Action).toLowerCase()}">${l.Action}</span></td>
            <td>${l.RecordId || "-"}</td>
        `;
        tbody.appendChild(row);
    });
}

function formatTimestamp(value) {
    if (!value) return "-";
    const d = new Date(value);
    return d.toLocaleString();
}

searchInput.addEventListener("keyup", renderTable);
actionFilter.addEventListener("change", renderTable);

document.getElementById("clearFilters").addEventListener("click", () => {
    searchInput.value = "";
    actionFilter.value = "";
    renderTable();
});
