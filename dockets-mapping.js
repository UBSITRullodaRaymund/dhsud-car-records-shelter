/*==================================================
DHSUD-CAR RECORDS SHELTER
DOCKETS MAPPING v2
==================================================*/

/*==================================================
GOOGLE SHEETS CSV
==================================================*/

const SHEET_URL =
"https://docs.google.com/spreadsheets/d/e/2PACX-1vT-5o8Ty361qCFIf39AY81T1xp6MJJaw0FgIR4cinMf-4UwvpSIDf_ew9a2U3gHIPL90OxHscOHE883/pub?gid=734751751&single=true&output=csv";

/*==================================================
DATABASE
==================================================*/

let documents = [];

let currentCategory = null;
let currentProject = null;
let currentFolder = null;
let currentFile = null;
let selectedFile = null;

/*==================================================
LOAD GOOGLE SHEETS
==================================================*/

async function loadGoogleSheet(){

    const response = await fetch(SHEET_URL);

    const csv = await response.text();

    const rows = csv.trim().split("\n");

    const headers = rows[0].split(",");

    documents = [];

    for(let i=1;i<rows.length;i++){

        const cols = rows[i].split(",");

        documents.push({

            category: cols[0]?.trim(),

            project: cols[1]?.trim(),

            folder: cols[2]?.trim(),

            filename: cols[3]?.trim(),

            type: cols[4]?.trim(),

            size: cols[5]?.trim(),

            status: cols[6]?.trim(),

            remarks: cols[7]?.trim(),

            url: cols[8]?.trim(),

            uploaded: cols[9]?.trim()

        });

    }

    console.log(documents);

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

        categoryList.innerHTML += `

        <div class="category-item"
            onclick="openCategory('${category}')">

            <i class="fa-solid fa-folder-tree"></i>

            <div>

                <h4>${category}</h4>

                <p>${totalProjects} Project${totalProjects!=1?"s":""}</p>

            </div>

        </div>

        `;

    });

}

/*==================================================
OPEN CATEGORY
==================================================*/

function openCategory(category){

    currentCategory = category;
    currentProject = null;
    currentFolder = null;

    updateBreadcrumb();

    const explorer = document.getElementById("explorerContent");

    const projects = [...new Set(
        documents
            .filter(doc => doc.category === category)
            .map(doc => doc.project)
    )];

    let html = `
        <h2 style="margin-bottom:20px;color:#0B4EA2;">
            ${category}
        </h2>

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

        <div class="project-card"
            onclick="openProject('${project}')">

            <i class="fa-solid fa-city"></i>

            <h3>${project}</h3>

            <p>${folderCount} Folder${folderCount!=1?"s":""}</p>

        </div>

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

        <button class="primary-btn"
            onclick="openCategory('${currentCategory}')"
            style="margin-bottom:20px;">

            <i class="fa-solid fa-arrow-left"></i>

            Back to ${currentCategory}

        </button>

        <h2 style="margin-bottom:20px;color:#0B4EA2;">

            ${project}

        </h2>

        <div class="project-grid">

    `;

    folders.sort().forEach(folder=>{

        const fileCount = documents.filter(doc =>
            doc.category === currentCategory &&
            doc.project === project &&
            doc.folder === folder
        ).length;

        html += `

        <div class="project-card folder-card"

            onclick="openFolder('${folder}')">

            <i class="fa-solid fa-folder"></i>

            <h3>${folder}</h3>

            <p>${fileCount} File${fileCount!=1?"s":""}</p>

        </div>

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

    currentFolder = folder;
    updateBreadcrumb();

    const explorer = document.getElementById("explorerContent");

    const files = documents.filter(doc =>

        doc.category === currentCategory &&
        doc.project === currentProject &&
        doc.folder === folder

    );

    let html = `

        <button class="primary-btn"
            onclick="openProject('${currentProject}')"
            style="margin-bottom:20px;">

            <i class="fa-solid fa-arrow-left"></i>

            Back to ${currentProject}

        </button>

        <h2 style="margin-bottom:20px;color:#0B4EA2;">

            ${folder}

        </h2>

    `;

    if(files.length===0){

        html += `

        <div class="empty-state">

            <i class="fa-solid fa-file-circle-xmark"></i>

            <h2>No Documents</h2>

            <p>This folder is empty.</p>

        </div>

        `;

    }else{

        files
             .sort((a,b)=>
              a.filename.localeCompare(b.filename)
             )
             .forEach((file,index)=>{
                const active = selectedFile === index ? "active-document" : "";

            html += `   

            <div class="document-card ${active}" id="doc-${index}">

                <div class="document-left">

                    <i class="${getFileIcon(file.type)}"></i>

                    <div>

                        <div class="document-name">

                            ${file.filename}

                        </div>

                        <div class="document-size">

                            ${file.size}

                        </div>

                    </div>

                </div>

               <button
                    class="primary-btn"
                    onclick="previewFile(${index})">

                    <i class="fa-solid fa-eye"></i> View

                </button>

            </div>

            `;

        });

    }

    explorer.innerHTML = html;

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

    currentCategory = null;
    currentProject = null;
    currentFolder = null;

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

    currentCategory = null;
    currentProject = null;
    currentFolder = null;

    updateBreadcrumb();

    document.getElementById("explorerContent").innerHTML = `

        <div class="empty-state">

            <i class="fa-solid fa-folder-open"></i>

            <h2>Select a Category</h2>

            <p>

                Choose a category from the left panel
                to begin browsing.

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

            // Match project name
            if(project.toLowerCase().includes(keyword)){

                results.push({
                    type:"Project",
                    category,
                    project
                });

            }

            Object.keys(records[category][project]).forEach(folder => {

                // Match folder name
                if(folder.toLowerCase().includes(keyword)){

                    results.push({
                        type:"Folder",
                        category,
                        project,
                        folder
                    });

                }

                records[category][project][folder].forEach(file => {

                    // Match file name
                    if(file.name.toLowerCase().includes(keyword)){

                        results.push({
                            type:"Document",
                            category,
                            project,
                            folder,
                            file
                        });

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

        <span onclick="goHome()">

            <i class="fa-solid fa-house"></i>

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

    document.getElementById("searchInput").value="";

    document.getElementById("categoryFilter").value="";

    document.getElementById("projectFilter").value="";

    document.getElementById("folderFilter").value="";

    renderHome();

}

/*==================================================
SEARCH RESULTS
==================================================*/

function renderSearchResults(files){

    const explorer = document.getElementById("explorerContent");

    let html = `

    <h2 style="margin-bottom:20px;color:#0B4EA2;">

        Search Results

    </h2>

    <p style="margin-bottom:20px;color:#666;">

        ${files.length} document(s) found

    </p>

    `;

    if(files.length===0){

        html += `

        <div class="empty-state">

            <i class="fa-solid fa-magnifying-glass"></i>

            <h2>No Results Found</h2>

            <p>Try a different keyword or filter.</p>

        </div>

        `;

    }else{

        files
        .sort((a,b)=>a.filename.localeCompare(b.filename))
        .forEach((file,index)=>{

            html += `

            <div class="document-card">

                <div class="document-left">

                    <i class="fa-solid fa-file-pdf"></i>

                    <div>

                        <div class="document-name">

                            ${file.filename}

                        </div>

                        <div class="document-size">

                            ${file.project}

                        </div>

                    </div>

                </div>

                <button
                    class="primary-btn"
                    onclick="previewSearchFile(${documents.indexOf(file)})">

                    <i class="fa-solid fa-eye"></i>

                    Preview

                </button>

            </div>

            `;

        });

    }

    explorer.innerHTML = html;

}


/*==================================================
PREVIEW FROM SEARCH
==================================================*/

function previewSearchFile(index){

    const file = documents[index];

    currentCategory = file.category;
    currentProject = file.project;
    currentFolder = file.folder;

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

