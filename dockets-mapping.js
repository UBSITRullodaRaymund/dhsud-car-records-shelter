/*==================================================
DHSUD-CAR RECORDS SHELTER
DOCKETS MAPPING v2
==================================================*/

/*==================================================
DATABASE
==================================================*/

requireLogin();

let documents = [];

let currentCategory = null;
let currentProject = null;
let currentFolder = null;
let currentFile = null;
let selectedFile = null;
let showingSearchResults = false;

const MAPPING_SPREADSHEET_COLUMNS = [
    ["Category", "category"],
    ["Project", "project"],
    ["Folder", "folder"],
    ["File Name", "filename"],
    ["File Type", "type"],
    ["File Size", "size"],
    ["Status", "status"],
    ["Remarks", "remarks"],
    ["Google Drive Link", "url"],
    ["Date Uploaded", "uploaded"]
];

function renderMappingTable(container, files, onPreview) {
    const summaryColumns = [
        ["File Name", "filename"],
        ["Category", "category"],
        ["Project", "project"],
        ["Folder", "folder"],
        ["Status", "status"]
    ];
    const wrapper = document.createElement("div");
    wrapper.className = "spreadsheet-table-wrap";
    const table = document.createElement("table");
    table.className = "records-table modern-table spreadsheet-table";
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    summaryColumns.forEach(([label]) => {
        const th = document.createElement("th");
        th.textContent = label;
        headerRow.appendChild(th);
    });
    const actionHeader = document.createElement("th");
    actionHeader.textContent = "Action";
    headerRow.appendChild(actionHeader);
    head.appendChild(headerRow);
    const body = document.createElement("tbody");
    TablePagination.bindDetails(body);
    table.append(head, body);
    wrapper.appendChild(table);
    container.appendChild(wrapper);

    TablePagination.render(body, files, file => {
        const fragment = document.createDocumentFragment();
        const row = document.createElement("tr");
        TablePagination.makeExpandableRow(row);
        summaryColumns.forEach(([label, key]) => {
            const cell = document.createElement("td");
            cell.dataset.label = label;
            cell.textContent = file[key] == null || file[key] === "" ? "—" : String(file[key]);
            row.appendChild(cell);
        });
        const actions = document.createElement("td");
        actions.dataset.label = "Action";
        actions.className = "action-buttons";
        const previewButton = document.createElement("button");
        previewButton.type = "button";
        previewButton.className = "primary-btn";
        previewButton.innerHTML = '<i class="fa-solid fa-eye" aria-hidden="true"></i> Preview file';
        previewButton.addEventListener("click", () => {
            body.querySelectorAll(".selected-document-row").forEach(selected => {
                selected.classList.remove("selected-document-row");
            });
            row.classList.add("selected-document-row");
            onPreview(file);
        });
        actions.appendChild(previewButton);
        row.appendChild(actions);

        fragment.append(
            row,
            TablePagination.createDetailsRow(
                MAPPING_SPREADSHEET_COLUMNS.map(([label, key]) => [label, file[key]]),
                summaryColumns.length + 1
            )
        );
        return fragment;
    });
}

/*==================================================
LOAD GOOGLE SHEETS
==================================================*/

async function loadGoogleSheet(){

    const result = await authedGet({
        action: "getDocuments",
        module: "docketsMapping",
        sheet: "Dockets Mapping",
        office: getRequestOffice()
    });
    if (!Array.isArray(result)) {
        const message = result && result.error ? result.error : "Could not load Dockets Mapping from Google Sheets.";
        console.error(message, result);
        documents = [];
        alert("Dockets Mapping could not be loaded from Google Sheets. Please try again. " + message);
        return;
    }

    documents = result.map(record => {
        const normalized = normalizeRecordFields(record, "docketsMapping");
        return {
            category: normalized.category || "",
            project: normalized.project || "",
            folder: normalized.folder || "",
            filename: normalized.fileName || normalized.filename || "",
            type: normalized.fileType || normalized.type || "",
            size: normalized.fileSize || normalized.size || "",
            status: normalized.status || "",
            remarks: normalized.remarks || "",
            url: normalized.driveUrl || normalized.url || "",
            uploaded: normalized.dateUploaded || normalized.uploaded || ""
        };
    });

}

/*==================================================
INITIALIZE
==================================================*/

document.addEventListener("DOMContentLoaded", async ()=>{

    await loadGoogleSheet();

    populateFilters();

    renderCategories();

    updateStatistics();

});

/*==================================================
RENDER CATEGORIES
==================================================*/

function renderCategories(){

    const categoryList = document.getElementById("categoryList");

    categoryList.innerHTML = "";

    const categories = [...new Set(documents.map(doc => doc.category))];

    categories.forEach(category => {

        const totalProjects =
            new Set(
                documents
                .filter(doc => doc.category === category)
                .map(doc => doc.project)
            ).size;

        const item = document.createElement("button");
        item.type = "button";
        item.className = `category-item${currentCategory === category ? " is-selected" : ""}`;
        item.setAttribute("aria-pressed", String(currentCategory === category));
        item.addEventListener("click", () => openCategory(category));

        const icon = document.createElement("i");
        icon.className = "fa-solid fa-folder-tree";
        icon.setAttribute("aria-hidden", "true");
        const content = document.createElement("span");
        content.className = "category-item-copy";
        const title = document.createElement("strong");
        title.textContent = category;
        const count = document.createElement("span");
        count.textContent = `${totalProjects} ${totalProjects === 1 ? "project" : "projects"}`;
        content.append(title, count);
        item.append(icon, content);
        categoryList.appendChild(item);

    });

}

/*==================================================
OPEN CATEGORY
==================================================*/

function openCategory(category){

    showingSearchResults = false;
    resetRepositoryFilters();
    currentCategory = category;
    currentProject = null;
    currentFolder = null;

    renderCategories();
    updateBreadcrumb();

    const explorer = document.getElementById("explorerContent");

    const projects = [...new Set(
        documents
            .filter(doc => doc.category === category)
            .map(doc => doc.project)
    )];

    let html = `
        <div class="repository-content-heading">
            <div>
                <p class="repository-eyebrow">Step 2 of 3 · Projects</p>
                <h2>${category}</h2>
                <p>Choose a project to see its folders.</p>
            </div>
            <span class="repository-count">${projects.length} ${projects.length === 1 ? "project" : "projects"}</span>
        </div>

        <div class="project-grid">
    `;

    projects.sort().forEach(project=>{

        const folderCount = new Set(
            documents
                .filter(doc =>
                    doc.category === category &&
                    doc.project === project
                )
                .map(doc => doc.folder)
        ).size;

        html += `

        <button type="button" class="project-card repository-selectable-card"
            aria-label="Open project ${project}, ${folderCount} ${folderCount === 1 ? "folder" : "folders"}"
            onclick="openProject('${project}')">

            <i class="fa-solid fa-city"></i>

            <strong>${project}</strong>

            <span>${folderCount} ${folderCount === 1 ? "folder" : "folders"}</span>

        </button>

        `;

    });

    if(projects.length===0){

        html += `
        <div class="empty-state">

            <i class="fa-solid fa-folder-open"></i>

            <h2>No Projects</h2>

            <p>No projects found.</p>

        </div>
        `;

    }

    html += "</div>";

    explorer.innerHTML = html;

}

/*==================================================
OPEN PROJECT
==================================================*/

function openProject(project){

    showingSearchResults = false;
    currentProject = project;
    currentFolder = null;

    updateBreadcrumb();

    const explorer = document.getElementById("explorerContent");

    const folders = [...new Set(
        documents
            .filter(doc =>
                doc.category === currentCategory &&
                doc.project === project
            )
            .map(doc => doc.folder)
    )];

    let html = `

        <button class="repository-back-btn"
            onclick="openCategory('${currentCategory}')"
            type="button">

            <i class="fa-solid fa-arrow-left"></i>

            <span>All projects in ${currentCategory}</span>

        </button>

        <div class="repository-content-heading">
            <div>
                <p class="repository-eyebrow">Step 2 of 3 · Folders</p>
                <h2>${project}</h2>
                <p>Choose a folder to view its documents.</p>
            </div>
            <span class="repository-count">${folders.length} ${folders.length === 1 ? "folder" : "folders"}</span>
        </div>

        <div class="project-grid">

    `;

    folders.sort().forEach(folder=>{

        const fileCount = documents.filter(doc =>
            doc.category === currentCategory &&
            doc.project === project &&
            doc.folder === folder
        ).length;

        html += `

        <button type="button" class="project-card folder-card repository-selectable-card"

            onclick="openFolder('${folder}')">

            <i class="fa-solid fa-folder"></i>

            <strong>${folder}</strong>

            <span>${fileCount} ${fileCount === 1 ? "file" : "files"}</span>

        </button>

        `;

    });

    if(folders.length===0){

        html += `

        <div class="empty-state">

            <i class="fa-solid fa-folder-open"></i>

            <h2>No Folders</h2>

            <p>This project has no folders.</p>

        </div>

        `;

    }

    html += "</div>";

    explorer.innerHTML = html;

}

/*==================================================
OPEN FOLDER
==================================================*/

function openFolder(folder){

    showingSearchResults = false;
    currentFolder = folder;
    updateBreadcrumb();

    const explorer = document.getElementById("explorerContent");

    const files = documents.filter(doc =>

        doc.category === currentCategory &&
        doc.project === currentProject &&
        doc.folder === folder

    );

    const html = `

        <button class="repository-back-btn"
            onclick="openProject('${currentProject}')"
            type="button">

            <i class="fa-solid fa-arrow-left"></i>

            <span>All folders in ${currentProject}</span>

        </button>

        <div class="repository-content-heading">
            <div>
                <p class="repository-eyebrow">Step 3 of 3 · Documents</p>
                <h2>${folder}</h2>
                <p>Select “Preview file” to open a document in the preview panel.</p>
            </div>
            <span class="repository-count">${files.length} ${files.length === 1 ? "document" : "documents"}</span>
        </div>

        <div id="mappingFolderTable"></div>
    `;

    explorer.innerHTML = html;
    const sortedFiles = files.sort((a, b) => a.filename.localeCompare(b.filename));
    const tableContainer = document.getElementById("mappingFolderTable");
    if (sortedFiles.length) {
        renderMappingTable(tableContainer, sortedFiles, file => {
            const folderFiles = documents.filter(doc =>
                doc.category === currentCategory &&
                doc.project === currentProject &&
                doc.folder === currentFolder
            );
            previewFile(folderFiles.indexOf(file));
        });
    } else {
        tableContainer.innerHTML = '<div class="empty-state"><i class="fa-solid fa-file-circle-xmark"></i><h2>No Documents</h2><p>This folder is empty.</p></div>';
    }

}


/*==================================================
PREVIEW FILE
==================================================*/

function previewFile(index){
    selectedFile = index;

// Remove previous highlight
document.querySelectorAll(".document-card").forEach(card=>{
    card.classList.remove("active-document");
});

// Highlight the clicked card
const selectedCard = document.getElementById(`doc-${index}`);

if(selectedCard){
    selectedCard.classList.add("active-document");
}

    const files = documents.filter(doc =>

        doc.category === currentCategory &&
        doc.project === currentProject &&
        doc.folder === currentFolder

    );

    const file = files[index];
    document.getElementById("previewPanelHint").textContent = "Showing the selected document preview.";

    // Convert Google Drive share link to preview link
    let previewURL = file.url;

    if(previewURL.includes("/view")){
        previewURL = previewURL.replace("/view","/preview");
    }

    const preview = document.getElementById("previewContent");

    preview.innerHTML = `

        <div class="preview-header">

    <div class="preview-title">

        <i class="${getFileIcon(file.type)}"></i>

        <div>

            <h2>${file.filename}</h2>

            <span>${file.type} • ${file.size}</span>

        </div>

    </div>

</div>

<div class="preview-pdf">

    <iframe
        src="${previewURL}"
        width="100%"
        height="650"
        style="border:none;">
    </iframe>

</div>

<div class="details-grid">

    <div class="detail-card">

        <span>Category</span>

        <strong>${file.category}</strong>

    </div>

    <div class="detail-card">

        <span>Project</span>

        <strong>${file.project}</strong>

    </div>

    <div class="detail-card">

        <span>Folder</span>

        <strong>${file.folder}</strong>

    </div>

    <div class="detail-card">

        <span>Status</span>

        <strong>${file.status}</strong>

    </div>

    <div class="detail-card">

        <span>Date Uploaded</span>

        <strong>${file.uploaded}</strong>

    </div>

    <div class="detail-card">

        <span>Remarks</span>

        <strong>${file.remarks}</strong>

    </div>

</div>

<div class="preview-actions">

    <a href="${file.url}"

       target="_blank"

       class="primary-btn">

       <i class="fa-solid fa-eye"></i>

       Open Document

    </a>

    <a href="${file.url}"

       target="_blank"

       class="primary-btn">

       <i class="fa-solid fa-download"></i>

       Download

    </a>

</div>

`;

}



/*==================================================
UPDATE BREADCRUMB
==================================================*/

function updateBreadcrumb(){

    const breadcrumb = document.getElementById("breadcrumb");

    let html = `

        <span onclick="renderHome()">

            Home

        </span>

    `;

    if(currentCategory){

        html += `

            <span class="separator">></span>

            <span onclick="openCategory('${currentCategory}')">

                ${currentCategory}

            </span>

        `;

    }

    if(currentProject){

        html += `

            <span class="separator">></span>

            <span onclick="openProject('${currentProject}')">

                ${currentProject}

            </span>

        `;

    }

    if(currentFolder){

        html += `

            <span class="separator">></span>

            <span>

                ${currentFolder}

            </span>

        `;

    }

    breadcrumb.innerHTML = html;

}

/*==================================================
HOME
==================================================*/

function renderHome(){

    showingSearchResults = false;
    currentCategory = null;
    currentProject = null;
    currentFolder = null;

    renderCategories();
    updateBreadcrumb();

    document.getElementById("explorerContent").innerHTML = `

        <div class="empty-state">

            <i class="fa-solid fa-folder-tree"></i>

            <h2>Welcome</h2>

            <p>

                Select a category from the left panel
                to start browsing records.

            </p>

        </div>

    `;

}

/*==================================================
UPDATE BREADCRUMB
==================================================*/

function updateBreadcrumb(){

    const breadcrumb = document.getElementById("breadcrumb");

    let html = `
        <span onclick="renderHome()">
            Home
        </span>
    `;

    if(currentCategory){

        html += `
            <span class="separator">></span>

            <span onclick="openCategory('${currentCategory}')">
                ${currentCategory}
            </span>
        `;

    }

    if(currentProject){

        html += `
            <span class="separator">></span>

            <span onclick="openProject('${currentProject}')">
                ${currentProject}
            </span>
        `;

    }

    if(currentFolder){

        html += `
            <span class="separator">></span>

            <span>
                ${currentFolder}
            </span>
        `;

    }

    breadcrumb.innerHTML = html;

}

/*==================================================
HOME
==================================================*/

function renderHome(){

    showingSearchResults = false;
    currentCategory = null;
    currentProject = null;
    currentFolder = null;

    renderCategories();
    updateBreadcrumb();

    document.getElementById("explorerContent").innerHTML = `

        <div class="empty-state">

            <i class="fa-solid fa-folder-open"></i>

            <h2>Choose a category to begin</h2>

            <p>

                Your projects and folders will appear here. Use the location trail above to move back at any time.

            </p>

        </div>

    `;

}


/*==================================================
GLOBAL SEARCH
==================================================*/

function searchRecords(){

    const keyword = document
        .getElementById("globalSearch")
        .value
        .trim()
        .toLowerCase();

    // If search box is empty, return to the home view
    if(keyword === ""){

        renderHome();

        return;

    }

    let results = [];

    categories.sort().forEach(category=>{

        Object.keys(records[category]).forEach(project => {

            if(project.toLowerCase().includes(keyword)){
                results.push({ type:"Project", category, project });
            }

            Object.keys(records[category][project]).forEach(folder => {

                if(folder.toLowerCase().includes(keyword)){
                    results.push({ type:"Folder", category, project, folder });
                }

                records[category][project][folder].forEach(file => {
                    if(file.name.toLowerCase().includes(keyword)){
                        results.push({ type:"Document", category, project, folder, file });
                    }
                });
            });
        });
    });

    showSearchResults(results);

}

/*==================================================
DISPLAY SEARCH RESULTS
==================================================*/

function showSearchResults(results){

    const explorer = document.getElementById("explorerContent");

    if(results.length===0){

        explorer.innerHTML=`

            <div class="empty-state">

                <i class="fa-solid fa-magnifying-glass"></i>

                <h2>No Results Found</h2>

                <p>Try another keyword.</p>

            </div>

        `;

        return;

    }

    let html=`

        <h2 style="margin-bottom:20px;color:#0B4EA2;">

            Search Results (${results.length})

        </h2>

    `;

    results.forEach(item=>{

        html+=`

        <div class="document-card search-result"

        onclick="openSearchResult(${results.indexOf(item)})">

            <div class="document-left">

                <i class="fa-solid fa-magnifying-glass"></i>

                <div>

                    <div class="document-name">

                        ${
                            item.type==="Project"
                            ? item.project
                            : item.type==="Folder"
                            ? item.folder
                            : item.file.name
                        }

                    </div>

                    <div class="document-size">

                        ${item.category}

                        ${item.project ? " > "+item.project : ""}

                        ${item.folder ? " > "+item.folder : ""}

                    </div>

                </div>

            </div>

        </div>

        `;

    });

    explorer.innerHTML=html;

    window.currentSearchResults=results;

}


/*==================================================
OPEN SEARCH RESULT
==================================================*/

function openSearchResult(index){

    const item=window.currentSearchResults[index];

    if(item.type==="Project"){

        openCategory(item.category);

        setTimeout(()=>{

            openProject(item.project);

        },50);

    }

    else if(item.type==="Folder"){

        openCategory(item.category);

        setTimeout(()=>{

            openProject(item.project);

            setTimeout(()=>{

                openFolder(item.folder);

            },50);

        },50);

    }

    else{

        openCategory(item.category);

        setTimeout(()=>{

            openProject(item.project);

            setTimeout(()=>{

                openFolder(item.folder);

                setTimeout(()=>{

                    previewFile(item.file.name);

                },50);

            },50);

        },50);

    }

}

/*==================================================
UPDATE DASHBOARD STATISTICS
==================================================*/

function updateStatistics(){

    const categories =
        new Set(documents.map(doc => doc.category));

    const projects =
        new Set(documents.map(doc => doc.project));

    const folders =
        new Set(
            documents.map(doc => doc.category + "|" + doc.project + "|" + doc.folder)
        );

    const totalDocuments = documents.length;

    document.getElementById("totalCategories").textContent = categories.size;
    document.getElementById("totalProjects").textContent = projects.size;
    document.getElementById("totalFolders").textContent = folders.size;
    document.getElementById("totalDocuments").textContent = totalDocuments;

}

/*==================================================
UPDATE BREADCRUMB
==================================================*/

function updateBreadcrumb(){

    const bc = document.getElementById("breadcrumb");

    let html = `
        <button type="button" class="breadcrumb-link" onclick="goHome()" ${!currentCategory ? 'aria-current="page"' : ""}>
            <i class="fa-solid fa-house" aria-hidden="true"></i>
            <span>Repository home</span>
        </button>
    `;

    if(currentCategory){
        html += `
            <i class="fa-solid fa-chevron-right separator" aria-hidden="true"></i>
            <button type="button" class="breadcrumb-link" onclick="openCategory('${currentCategory}')" ${!currentProject ? 'aria-current="page"' : ""}>
                <span>${currentCategory}</span>
            </button>
        `;
    }

    if(currentProject){
        html += `
            <i class="fa-solid fa-chevron-right separator" aria-hidden="true"></i>
            <button type="button" class="breadcrumb-link" onclick="openProject('${currentProject}')" ${!currentFolder ? 'aria-current="page"' : ""}>
                <span>${currentProject}</span>
            </button>
        `;
    }

    if(currentFolder){
        html += `
            <i class="fa-solid fa-chevron-right separator" aria-hidden="true"></i>
            <span class="breadcrumb-current" aria-current="page">${currentFolder}</span>
        `;
    }

    if(showingSearchResults && !currentCategory){
        html += `
            <i class="fa-solid fa-chevron-right separator" aria-hidden="true"></i>
            <span class="breadcrumb-current" aria-current="page">Search results</span>
        `;
    }

    bc.innerHTML = html;

}

function goHome(){

    currentCategory = null;
    currentProject = null;
    currentFolder = null;

    updateBreadcrumb();

    renderHome();

}

/*==================================================
POPULATE FILTERS
==================================================*/

function populateFilters(){

    const categoryFilter = document.getElementById("categoryFilter");
    const projectFilter = document.getElementById("projectFilter");
    const folderFilter = document.getElementById("folderFilter");

    // Clear old options
    categoryFilter.innerHTML = '<option value="">All Categories</option>';
    projectFilter.innerHTML = '<option value="">All Projects</option>';
    folderFilter.innerHTML = '<option value="">All Folders</option>';

    // Unique values
    const categories = [...new Set(documents.map(d => d.category))].sort();
    const projects = [...new Set(documents.map(d => d.project))].sort();
    const folders = [...new Set(documents.map(d => d.folder))].sort();

    categories.forEach(category=>{
        categoryFilter.innerHTML += `<option value="${category}">${category}</option>`;
    });

    projects.forEach(project=>{
        projectFilter.innerHTML += `<option value="${project}">${project}</option>`;
    });

    folders.forEach(folder=>{
        folderFilter.innerHTML += `<option value="${folder}">${folder}</option>`;
    });

}

/*==================================================
SEARCH & FILTER
==================================================*/

function applyFilters(){

    const search = document.getElementById("searchInput").value.toLowerCase().trim();

    const category = document.getElementById("categoryFilter").value;
    const project = document.getElementById("projectFilter").value;
    const folder = document.getElementById("folderFilter").value;
    showingSearchResults = true;
    currentCategory = null;
    currentProject = null;
    currentFolder = null;
    renderCategories();
    updateBreadcrumb();

    let filtered = documents.filter(doc=>{

        const matchesSearch =

            doc.filename.toLowerCase().includes(search) ||

            doc.project.toLowerCase().includes(search) ||

            doc.category.toLowerCase().includes(search) ||

            doc.folder.toLowerCase().includes(search) ||

            (doc.remarks || "").toLowerCase().includes(search);

        const matchesCategory =
            category === "" || doc.category === category;

        const matchesProject =
            project === "" || doc.project === project;

        const matchesFolder =
            folder === "" || doc.folder === folder;

        return matchesSearch &&
               matchesCategory &&
               matchesProject &&
               matchesFolder;

    });

    renderSearchResults(filtered);

}

/*==================================================
CLEAR FILTERS
==================================================*/

function clearFilters(){

    resetRepositoryFilters();

    renderHome();

}

function resetRepositoryFilters(){
    document.getElementById("searchInput").value = "";
    document.getElementById("categoryFilter").value = "";
    document.getElementById("projectFilter").value = "";
    document.getElementById("folderFilter").value = "";
}

/*==================================================
SEARCH RESULTS
==================================================*/

function renderSearchResults(files){

    const explorer = document.getElementById("explorerContent");
    const search = document.getElementById("searchInput").value.trim();
    const category = document.getElementById("categoryFilter").value;
    const project = document.getElementById("projectFilter").value;
    const folder = document.getElementById("folderFilter").value;
    const activeFilters = [
        search ? `Search: "${search}"` : "",
        category ? `Category: ${category}` : "",
        project ? `Project: ${project}` : "",
        folder ? `Folder: ${folder}` : ""
    ].filter(Boolean);
    updateBreadcrumb();

    const html = `
        <div class="repository-content-heading repository-search-results-heading">
            <div>
                <p class="repository-eyebrow">Search &amp; filters</p>
                <h2>Matching documents</h2>
                <p>${activeFilters.length ? activeFilters.join(" · ") : "All repository documents"}</p>
            </div>
            <span class="repository-count">${files.length} ${files.length === 1 ? "result" : "results"}</span>
        </div>
        <div id="mappingSearchTable"></div>
    `;

    explorer.innerHTML = html;
    const sortedFiles = files.sort((a, b) => a.filename.localeCompare(b.filename));
    const tableContainer = document.getElementById("mappingSearchTable");
    if (sortedFiles.length) {
        renderMappingTable(tableContainer, sortedFiles, file => {
            previewSearchFile(documents.indexOf(file));
        });
    } else {
        tableContainer.innerHTML = '<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><h2>No Results Found</h2><p>Try a different keyword or filter.</p></div>';
    }

}


/*==================================================
PREVIEW FROM SEARCH
==================================================*/

function previewSearchFile(index){

    const file = documents[index];

    showingSearchResults = false;
    currentCategory = file.category;
    currentProject = file.project;
    currentFolder = file.folder;

    renderCategories();
    updateBreadcrumb();

    previewFile(
        documents.filter(doc=>

            doc.category===currentCategory &&
            doc.project===currentProject &&
            doc.folder===currentFolder

        ).findIndex(doc=>doc.filename===file.filename)
    );

}

/*==================================================
GET FILE ICON
==================================================*/

function getFileIcon(type){

    type = type.toLowerCase();

    switch(type){

        case "pdf":
            return "fa-solid fa-file-pdf";

        case "doc":
        case "docx":
            return "fa-solid fa-file-word";

        case "xls":
        case "xlsx":
            return "fa-solid fa-file-excel";

        case "ppt":
        case "pptx":
            return "fa-solid fa-file-powerpoint";

        case "jpg":
        case "jpeg":
        case "png":
        case "gif":
            return "fa-solid fa-file-image";

        case "zip":
        case "rar":
            return "fa-solid fa-file-zipper";

        default:
            return "fa-solid fa-file";
    }

}
