(() => {
    const states = new WeakMap();
    const DEFAULT_PAGE_SIZE = 10;
    const PAGE_SIZE_OPTIONS = [10, 25, 50];

    function getState(tbody) {
        let state = states.get(tbody);
        if (state) return state;

        const table = tbody.closest("table");
        const container = table && table.parentElement;
        if (!table || !container) return null;

        let controls = container.querySelector(":scope > .table-pagination");
        if (!controls) {
            controls = document.createElement("nav");
            controls.className = "table-pagination";
            controls.setAttribute("aria-label", "Table pagination");
            table.insertAdjacentElement("afterend", controls);
        }

        state = { page: 1, pageSize: DEFAULT_PAGE_SIZE, controls };
        states.set(tbody, state);
        return state;
    }

    function labelRow(row, headers) {
        row.querySelectorAll("td").forEach((cell, index) => {
            const label = (cell.dataset.label || headers[index] || "").trim();
            if (label && !cell.hasAttribute("colspan")) {
                cell.dataset.label = label;
                let labelElement = cell.querySelector(":scope > .table-cell-label");
                if (!labelElement) {
                    labelElement = document.createElement("span");
                    labelElement.className = "table-cell-label";
                    cell.prepend(labelElement);
                }
                labelElement.textContent = label;
            }
        });
    }

    function render(tbody, rows, createRow) {
        const state = getState(tbody);
        if (!state) return;

        const headers = Array.from(tbody.closest("table").querySelectorAll("thead th"))
            .map(header => header.textContent.trim());
        const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
        state.page = Math.min(state.page, totalPages);

        const start = (state.page - 1) * state.pageSize;
        const pageRows = rows.slice(start, start + state.pageSize);
        tbody.replaceChildren();
        pageRows.forEach((item, index) => {
            const row = createRow(item, start + index);
            labelRow(row, headers);
            tbody.appendChild(row);
        });

        state.controls.hidden = rows.length === 0;
        if (rows.length === 0) {
            state.controls.replaceChildren();
            return;
        }

        const end = Math.min(start + pageRows.length, rows.length);
        state.controls.innerHTML = `
            <span class="table-pagination__summary">
                Showing <strong>${start + 1}–${end}</strong> of <strong>${rows.length.toLocaleString()}</strong>
            </span>
            <div class="table-pagination__actions">
                <label class="table-pagination__size">
                    Rows
                    <select aria-label="Rows per page">
                        ${PAGE_SIZE_OPTIONS.map(size => `
                            <option value="${size}" ${state.pageSize === size ? "selected" : ""}>${size}</option>
                        `).join("")}
                    </select>
                </label>
                <button type="button" data-page="previous" aria-label="Previous page" ${state.page <= 1 ? "disabled" : ""}>
                    <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
                </button>
                <span class="table-pagination__page" aria-live="polite">Page ${state.page} of ${totalPages}</span>
                <button type="button" data-page="next" aria-label="Next page" ${state.page >= totalPages ? "disabled" : ""}>
                    <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
                </button>
            </div>
        `;

        state.controls.querySelector("select").addEventListener("change", event => {
            state.pageSize = Number(event.currentTarget.value);
            state.page = 1;
            render(tbody, rows, createRow);
        });
        state.controls.querySelectorAll("button[data-page]").forEach(button => {
            button.addEventListener("click", () => {
                state.page += button.dataset.page === "next" ? 1 : -1;
                render(tbody, rows, createRow);
            });
        });
        return { start: start + 1, end, total: rows.length };
    }

    function reset(tbody) {
        const state = states.get(tbody);
        if (state) state.page = 1;
    }

    window.TablePagination = { render, reset };
})();
