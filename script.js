/* ==========================================
   DHSUD-CAR RECORDS SHELTER
   Version 1.0
========================================== */

// ===============================
// Animated Counter
// ===============================

const counters = document.querySelectorAll(".counter");

const speed = 200;

counters.forEach(counter => {

    const updateCount = () => {

        const target = +counter.getAttribute("data-target");
        const count = +counter.innerText.replace(/,/g,'');

        const increment = target / speed;

        if(count < target){

            counter.innerText = Math.ceil(count + increment).toLocaleString();

            setTimeout(updateCount,10);

        }else{

            counter.innerText = target.toLocaleString();

        }

    }

    updateCount();

});

// ===============================
// Scroll Reveal Animation
// ===============================

const observer = new IntersectionObserver((entries)=>{

    entries.forEach(entry=>{

        if(entry.isIntersecting){

            entry.target.classList.add("show");

        }

    });

},{
    threshold:0.15
});

document.querySelectorAll(".card,.stat-box,.container").forEach(el=>{

    el.classList.add("hidden");

    observer.observe(el);

});

// ===============================
// Sticky Navbar Effect
// ===============================

const header = document.querySelector("header");

window.addEventListener("scroll",()=>{

    if(window.scrollY > 80){

        header.style.background="#003C88";
        header.style.boxShadow="0 5px 20px rgba(0,0,0,.2)";

    }else{

        header.style.background="transparent";
        header.style.boxShadow="none";

    }

});

// ===============================
// Back To Top Button
// ===============================

const topButton = document.createElement("button");

topButton.innerHTML = "↑";

topButton.id = "topButton";

document.body.appendChild(topButton);

topButton.style.position="fixed";
topButton.style.right="30px";
topButton.style.bottom="30px";
topButton.style.width="50px";
topButton.style.height="50px";
topButton.style.borderRadius="50%";
topButton.style.border="none";
topButton.style.background="#005BAC";
topButton.style.color="#fff";
topButton.style.fontSize="22px";
topButton.style.cursor="pointer";
topButton.style.display="none";
topButton.style.boxShadow="0 10px 20px rgba(0,0,0,.2)";
topButton.style.transition=".3s";
topButton.style.zIndex="999";

window.addEventListener("scroll",()=>{

    if(window.scrollY > 500){

        topButton.style.display="block";

    }else{

        topButton.style.display="none";

    }

});

topButton.onclick=()=>{

    window.scrollTo({

        top:0,

        behavior:"smooth"

    });

};

// ===============================
// Card Hover Animation
// ===============================

document.querySelectorAll(".card").forEach(card=>{

    card.addEventListener("mouseenter",()=>{

        card.style.transform="translateY(-12px) scale(1.02)";

    });

    card.addEventListener("mouseleave",()=>{

        card.style.transform="translateY(0px) scale(1)";

    });

});


// ===============================
// Smooth Fade-In on Page Load
// ===============================

window.addEventListener("load",()=>{

    document.body.style.opacity="1";

});

// ===============================
// Hidden Animation
// ===============================

const style = document.createElement("style");

style.innerHTML=`

body{

opacity:0;

transition:opacity .8s;

}

.hidden{

opacity:0;

transform:translateY(50px);

transition:all .8s ease;

}

.show{

opacity:1;

transform:translateY(0);

}

`;

document.head.appendChild(style);

// ===============================
// Console Message
// ===============================

console.log("%cDHSUD-CAR RECORDS SHELTER","color:#005BAC;font-size:22px;font-weight:bold;");
console.log("Version 1.0 Loaded Successfully");


// =============================
// LIVE TABLE SEARCH
// =============================

const searchInput = document.getElementById("searchInput");

if(searchInput){

searchInput.addEventListener("keyup",function(){

let value=this.value.toLowerCase();

let rows=document.querySelectorAll(".records-table tbody tr");

rows.forEach(row=>{

row.style.display=row.innerText.toLowerCase().includes(value)
? ""
: "none";

});

});

}

// ======================================
// MODAL
// ======================================

const modal=document.getElementById("documentModal");

const open=document.getElementById("openModal");

const close=document.querySelector(".close");

const cancel=document.getElementById("closeModal");

if(open){

open.onclick=function(){

modal.style.display="block";

}

}

if(close){

close.onclick=function(){

modal.style.display="none";

}

}

if(cancel){

cancel.onclick=function(){

modal.style.display="none";

}

}

window.onclick=function(e){

if(e.target==modal){

modal.style.display="none";

}

}

const form = document.getElementById("documentForm");

if(form){

form.addEventListener("submit",function(e){

e.preventDefault();

const tracking=document.getElementById("trackingNo").value;
const date=document.getElementById("dateReceived").value;
const sender=document.getElementById("sender").value;
const subject=document.getElementById("subject").value;
const status=document.getElementById("status").value;

const tbody=document.getElementById("recordsBody");

const row=document.createElement("tr");

row.innerHTML=`

<td>${tracking}</td>

<td>${date}</td>

<td>${sender}</td>

<td>${subject}</td>

<td>
<span class="status ${status.toLowerCase()}">
${status}
</span>
</td>

<td>
<button class="view-btn">
<i class="fa-solid fa-eye"></i>
View
</button>
</td>

`;

tbody.prepend(row);

modal.style.display="none";

form.reset();

});

}