(function () {
    const body = document.body;
    const toggle = document.getElementById("appNavigationToggle");
    const backdrop = document.getElementById("appNavigationBackdrop");
    const logout = document.getElementById("appNavigationLogout");
    const mobileQuery = window.matchMedia("(max-width: 760px)");
    const collapsedKey = "dhsud_navigation_collapsed";

    if (!toggle || !backdrop) return;

    function isMobile() {
        return mobileQuery.matches;
    }

    function setExpanded(expanded) {
        if (isMobile()) {
            body.classList.toggle("nav-mobile-open", expanded);
            body.classList.add("nav-collapsed");
            backdrop.hidden = !expanded;
            toggle.setAttribute("aria-expanded", String(expanded));
            toggle.setAttribute("aria-label", expanded ? "Hide navigation" : "Show navigation");
            toggle.title = expanded ? "Hide navigation" : "Show navigation";
            toggle.innerHTML = `<i class="fa-solid ${expanded ? "fa-angles-left" : "fa-bars"}" aria-hidden="true"></i>`;
            return;
        }

        body.classList.toggle("nav-collapsed", !expanded);
        body.classList.remove("nav-mobile-open");
        backdrop.hidden = true;
        localStorage.setItem(collapsedKey, expanded ? "false" : "true");
        toggle.setAttribute("aria-expanded", String(expanded));
        toggle.setAttribute("aria-label", expanded ? "Hide navigation" : "Show navigation");
        toggle.title = expanded ? "Hide navigation" : "Show navigation";
        toggle.innerHTML = `<i class="fa-solid ${expanded ? "fa-angles-left" : "fa-angles-right"}" aria-hidden="true"></i>`;
    }

    const savedCollapsed = localStorage.getItem(collapsedKey) === "true";
    setExpanded(isMobile() ? false : !savedCollapsed);

    toggle.addEventListener("click", function () {
        setExpanded(toggle.getAttribute("aria-expanded") !== "true");
    });

    backdrop.addEventListener("click", function () {
        setExpanded(false);
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && isMobile() && body.classList.contains("nav-mobile-open")) {
            setExpanded(false);
        }
    });

    mobileQuery.addEventListener("change", function () {
        setExpanded(isMobile() ? false : localStorage.getItem(collapsedKey) !== "true");
    });

    document.addEventListener("DOMContentLoaded", function () {
        if (typeof getCurrentUser !== "function" || !getCurrentUser() || !logout) return;

        const loginLink = document.querySelector('.app-navigation-links a[href="login"]');
        if (loginLink) loginLink.hidden = true;
        logout.hidden = false;
        logout.addEventListener("click", function () {
            if (typeof window.logout === "function") {
                window.logout();
            }
        });
    });
})();
