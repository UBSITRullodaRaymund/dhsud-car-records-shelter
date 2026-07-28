/*==================================================
DHSUD-CAR RECORDS SHELTER
DOCKETS MAPPING v2
==================================================*/

/*==================================================
MASTER DATA
==================================================*/

const records = {

    "Subdivision":{

        "Zairod Pine Homes":{

            "Plans":[

                {
                    name:"Approved Site Development Plan.pdf",
                    size:"3.5 MB",
                    type:"PDF",
                    link:"#"
                },

                {
                    name:"Vicinity Map.pdf",
                    size:"1.2 MB",
                    type:"PDF",
                    link:"#"
                }

            ],

            "Permits":[

                {
                    name:"Development Permit.pdf",
                    size:"2.1 MB",
                    type:"PDF",
                    link:"#"
                }

            ],

            "Reports":[]

        },

        "Green Valley":{

            "Plans":[],

            "Permits":[]

        }

    },

    "Condominium":{

        "Summer Pine Residences":{

            "Plans":[],

            "Permits":[]

        }

    },

    "4PH Projects":{},

    "Executive Brief":{},

    "Project List":{},

    "Columbarium":{},

    "Memorial Park":{},

    "Real Estate Service Practitioners":{},

    "Unregistered Projects":{},

    "Incentivized Compliance Funded Projects":{}

};

/*==================================================
CURRENT STATE
==================================================*/

let currentCategory = null;
let currentProject = null;
let currentFolder = null;
let currentFile = null;

/*==================================================
INITIALIZE
==================================================*/

document.addEventListener("DOMContentLoaded", () => {

    renderCategories();

});


/*==================================================
RENDER CATEGORIES
==================================================*/

function renderCategories(){

    const categoryList = document.getElementById("categoryList");

    categoryList.innerHTML = "";

    Object.keys(records).forEach(category => {

        const totalProjects = Object.keys(records[category]).length;

        categoryList.innerHTML += `

        <div class="category-item"
            onclick="openCategory('${category}')">

            <i class="fa-solid fa-folder-tree"></i>

            <div>

                <h4>${category}</h4>

                <p>${totalProjects} Project${totalProjects !== 1 ? "s" : ""}</p>

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

    const explorer = document.getElementById("explorerContent");

    const projects = records[category];

    let html = `

        <h2 style="margin-bottom:20px;color:#0B4EA2;">

            ${category}

        </h2>

        <div class="project-grid">

    `;

    Object.keys(projects).forEach(project => {

        const folderCount = Object.keys(projects[project]).length;

        html += `

        <div class="project-card"

            onclick="openProject('${project}')">

            <i class="fa-solid fa-city"></i>

            <h3>${project}</h3>

            <p>${folderCount} Folder${folderCount !== 1 ? "s" : ""}</p>

        </div>

        `;

    });

    if(Object.keys(projects).length === 0){

        html += `

        <div class="empty-state">

            <i class="fa-solid fa-folder-open"></i>

            <h2>No Projects</h2>

            <p>This category doesn't contain any projects yet.</p>

        </div>

        `;

    }

    html += `</div>`;

    explorer.innerHTML = html;

}

/*==================================================
OPEN PROJECT
==================================================*/

function openProject(project){

    currentProject = project;

    const explorer = document.getElementById("explorerContent");

    const folders = records[currentCategory][project];

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

    Object.keys(folders).forEach(folder => {

        const fileCount = folders[folder].length;

        html += `

        <div class="project-card folder-card"

            onclick="openFolder('${folder}')">

            <i class="fa-solid fa-folder"></i>

            <h3>${folder}</h3>

            <p>${fileCount} File${fileCount !== 1 ? "s" : ""}</p>

        </div>

        `;

    });

    if(Object.keys(folders).length === 0){

        html += `

        <div class="empty-state">

            <i class="fa-solid fa-folder-open"></i>

            <h2>No Folders</h2>

            <p>This project doesn't contain any folders yet.</p>

        </div>

        `;

    }

    html += `</div>`;

    explorer.innerHTML = html;

}

/*==================================================
OPEN FOLDER
==================================================*/

function openFolder(folder){

    currentFolder = folder;

    const explorer = document.getElementById("explorerContent");

    const files = records[currentCategory][currentProject][folder];

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

    if(files.length === 0){

        html += `

        <div class="empty-state">

            <i class="fa-solid fa-file-circle-xmark"></i>

            <h2>No Documents</h2>

            <p>This folder is empty.</p>

        </div>

        `;

    }else{

        files.forEach(file => {

            html += `

            <div class="document-card">

                <div class="document-left">

                    <i class="fa-solid fa-file-pdf"></i>

                    <div>

                        <div class="document-name">

                            ${file.name}

                        </div>

                        <div class="document-size">

                            ${file.size}

                        </div>

                    </div>

                </div>

                <button class="primary-btn"
                    onclick="previewFile('${file.name}')">

                    View

                </button>

            </div>

            `;

        });

    }

    explorer.innerHTML = html;

}

