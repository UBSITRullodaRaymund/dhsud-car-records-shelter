const DASHBOARD_MODULES = [
    { key: "incoming", label: "Incoming", statId: "statIncoming" },
    { key: "outgoing", label: "Outgoing", statId: "statOutgoing" },
    { key: "dockets", label: "Dockets", statId: "statDockets" },
    { key: "docketsMapping", label: "Dockets Mapping", statId: "statDocketsMapping" },
    { key: "foi", label: "FOI", statId: "statFoi" }
];

document.addEventListener("DOMContentLoaded", function () {
    const refreshButton = document.getElementById("refreshStatistics");
    if (refreshButton) {
        refreshButton.addEventListener("click", loadDashboardStatistics);
    }

    const user = getCurrentUser();
    if (user) {
        loadDashboardStatistics();
    }
});

async function loadDashboardStatistics() {
    const message = document.getElementById("overviewMessage");
    const refreshButton = document.getElementById("refreshStatistics");
    const user = getCurrentUser();
    if (!user) {
        message.textContent = "Sign in to see statistics for your office.";
        refreshButton.hidden = true;
        return;
    }

    refreshButton.hidden = false;
    refreshButton.disabled = true;
    message.textContent = "Loading current statistics from MySQL…";

    try {
        const result = await authedGet({
            action: "getDashboardStats",
            office: getRequestOffice()
        });
        if (!result || result.error || !result.success || !result.modules) {
            throw new Error(result && result.error
                ? result.error
                : "The server returned invalid dashboard statistics.");
        }

        const datasets = DASHBOARD_MODULES.map(function (module) {
            const moduleResult = result.modules[module.key];
            return {
                ...module,
                allowed: Boolean(moduleResult && moduleResult.allowed),
                count: moduleResult && Number.isFinite(Number(moduleResult.count))
                    ? Number(moduleResult.count)
                    : null,
                error: moduleResult && moduleResult.error ? moduleResult.error : ""
            };
        });
        const available = datasets.filter(function (dataset) {
            return dataset.allowed && dataset.count !== null;
        });

        if (available.length === 0) {
            document.getElementById("statTotal").textContent = "—";
            datasets.forEach(function (dataset) {
                document.getElementById(dataset.statId).textContent = "—";
            });
            renderModuleChart(datasets);
            renderStatusChart({});
            const moduleError = datasets.find(function (dataset) {
                return dataset.error;
            });
            message.textContent = moduleError
                ? `Dashboard data could not be loaded: ${moduleError.error}`
                : "Your account does not have view access to dashboard modules.";
            return;
        }

        const totalRecords = available.reduce(function (total, dataset) {
            return total + dataset.count;
        }, 0);

        document.getElementById("statTotal").textContent = totalRecords.toLocaleString();
        datasets.forEach(function (dataset) {
            document.getElementById(dataset.statId).textContent = dataset.count === null
                ? "—"
                : dataset.count.toLocaleString();
        });

        renderModuleChart(datasets);
        renderStatusChart(result.statuses || {});

        const office = result.office ? ` for ${result.office}` : "";
        const unavailable = datasets.filter(function (dataset) {
            return !dataset.allowed || dataset.count === null;
        }).map(function (dataset) {
            return dataset.label;
        });
        message.textContent = unavailable.length
            ? `Showing permitted records${office}. Unavailable modules: ${unavailable.join(", ")}.`
            : `Showing current records${office}.`;
    } catch (error) {
        message.textContent = error.message || "Statistics could not be loaded.";
        renderModuleChart([]);
        renderStatusChart({});
        console.error("Dashboard statistics error:", error);
    } finally {
        refreshButton.disabled = false;
    }
}

function renderModuleChart(datasets) {
    const chart = document.getElementById("moduleChart");
    const available = datasets.filter(function (dataset) {
        return dataset.allowed && dataset.count !== null;
    });
    const maxCount = Math.max(1, ...available.map(function (dataset) {
        return dataset.count;
    }));

    chart.innerHTML = datasets.length
        ? datasets.map(function (dataset) {
            const count = dataset.allowed ? dataset.count : null;
            const width = count === null ? 0 : (count / maxCount) * 100;
            const value = count !== null ? count.toLocaleString()
                : (dataset.error ? "Unavailable" : "No access");
            return `<div class="chart-row">
                <span>${dataset.label}</span>
                <div class="chart-track" aria-hidden="true"><div class="chart-bar" style="width:${width}%"></div></div>
                <span class="chart-value">${value}</span>
            </div>`;
        }).join("")
        : '<p class="chart-empty">Sign in to load module statistics.</p>';
    chart.setAttribute("aria-label", available.length
        ? `Records by module: ${available.map(function (dataset) {
            return `${dataset.label}, ${dataset.count}`;
        }).join("; ")}.`
        : "Record counts by module are unavailable.");
}

function renderStatusChart(statuses) {
    const counts = {
        "In progress": Number(statuses["In progress"]) || 0,
        Pending: Number(statuses.Pending) || 0,
        Completed: Number(statuses.Completed) || 0,
        Other: Number(statuses.Other) || 0
    };
    const statusCount = Object.values(counts).reduce(function (total, count) {
        return total + count;
    }, 0);

    const chart = document.getElementById("statusChart");
    if (statusCount === 0) {
        chart.innerHTML = '<p class="chart-empty">No status information is available for these records.</p>';
        chart.setAttribute("aria-label", "No status information is available for these records.");
        return;
    }

    const maxCount = Math.max(1, ...Object.values(counts));
    chart.innerHTML = Object.entries(counts).map(function ([label, count]) {
        const width = (count / maxCount) * 100;
        return `<div class="chart-row">
            <span>${label}</span>
            <div class="chart-track" aria-hidden="true"><div class="chart-bar" style="width:${width}%"></div></div>
            <span class="chart-value">${count.toLocaleString()}</span>
        </div>`;
    }).join("");
    chart.setAttribute("aria-label", `Work status: ${Object.entries(counts).map(function ([label, count]) {
        return `${label}, ${count}`;
    }).join("; ")}.`);
}
