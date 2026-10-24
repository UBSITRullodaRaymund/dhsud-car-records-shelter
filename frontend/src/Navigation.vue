<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

defineProps({
    currentPage: {
        type: String,
        required: true,
    },
});

const links = [
    { page: "index", href: "index.html", label: "Home", icon: "fa-house" },
    { page: "documents", href: "documents.html", label: "Documents", icon: "fa-file-lines" },
    { page: "incoming", href: "incoming.html", label: "Incoming", icon: "fa-inbox" },
    { page: "outgoing", href: "outgoing.html", label: "Outgoing", icon: "fa-paper-plane" },
    { page: "dockets", href: "dockets.html", label: "Dockets", icon: "fa-folder-open" },
    { page: "dockets-mapping", href: "dockets-mapping.html", label: "Dockets Mapping", icon: "fa-map" },
    { page: "records", href: "records.html", label: "Records", icon: "fa-box-archive" },
    { page: "requests", href: "requests.html", label: "Requests", icon: "fa-file-circle-question" },
    { page: "foi", href: "foi.html", label: "FOI", icon: "fa-envelope-open-text" },
    { page: "users", href: "users.html", label: "User Management", icon: "fa-users" },
    { page: "activity-log", href: "activity-log.html", label: "Activity Log", icon: "fa-clock-rotate-left" },
];

const mobileOpen = ref(false);
const collapsed = ref(localStorage.getItem("dhsud_navigation_collapsed") === "true");
const userDetails = ref(readUserDetails());
const signedIn = computed(() => Boolean(userDetails.value));
const userInitials = computed(() => {
    const name = userDetails.value?.fullName || userDetails.value?.email || "User";
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
});
const mobileQuery = window.matchMedia("(max-width: 760px)");
const isMobile = ref(mobileQuery.matches);

function readUserDetails() {
    if (typeof window.getCurrentUser === "function") {
        return window.getCurrentUser();
    }

    try {
        const rawSession = localStorage.getItem("dhsud_session") || sessionStorage.getItem("dhsud_session");
        const session = rawSession ? JSON.parse(rawSession) : null;
        return session?.token && session.user ? session.user : null;
    } catch {
        return null;
    }
}

function readStoredSession() {
    try {
        const rawSession = localStorage.getItem("dhsud_session") || sessionStorage.getItem("dhsud_session");
        return rawSession ? JSON.parse(rawSession) : null;
    } catch {
        return null;
    }
}

function syncBodyClass() {
    document.body.classList.add("has-app-navigation");
    document.body.classList.toggle("nav-collapsed", isMobile.value || collapsed.value);
    document.body.classList.toggle("nav-mobile-open", mobileOpen.value);
}

function toggleNavigation() {
    if (isMobile.value) {
        mobileOpen.value = !mobileOpen.value;
    } else {
        collapsed.value = !collapsed.value;
        localStorage.setItem("dhsud_navigation_collapsed", String(collapsed.value));
    }
    syncBodyClass();
}

function closeMobileNavigation() {
    mobileOpen.value = false;
    syncBodyClass();
}

function updateViewport(event) {
    isMobile.value = event.matches;
    mobileOpen.value = false;
    syncBodyClass();
}

function onKeydown(event) {
    if (event.key === "Escape" && isMobile.value) closeMobileNavigation();
}

function refreshSession() {
    userDetails.value = readUserDetails();
}

async function logOut() {
    if (typeof window.logout === "function") {
        await window.logout();
        return;
    }

    const session = readStoredSession();
    try {
        if (session?.token) {
            const formData = new FormData();
            formData.append("action", "logout");
            formData.append("token", session.token);
            await fetch("api/index.php", {
                method: "POST",
                body: formData,
                credentials: "same-origin",
                headers: { "X-CSRF-Token": session.csrfToken || "" },
            });
        }
    } catch (error) {
        console.error("Remote logout failed; clearing the local session.", error);
    } finally {
        localStorage.removeItem("dhsud_session");
        sessionStorage.removeItem("dhsud_session");
        window.location.href = "login.html";
    }
}

onMounted(() => {
    syncBodyClass();
    mobileQuery.addEventListener("change", updateViewport);
    document.addEventListener("keydown", onKeydown);
    document.addEventListener("visibilitychange", refreshSession);
    window.addEventListener("storage", refreshSession);
    window.addEventListener("dhsud:session-updated", refreshSession);
});

onBeforeUnmount(() => {
    mobileQuery.removeEventListener("change", updateViewport);
    document.removeEventListener("keydown", onKeydown);
    document.removeEventListener("visibilitychange", refreshSession);
    window.removeEventListener("storage", refreshSession);
    window.removeEventListener("dhsud:session-updated", refreshSession);
    document.body.classList.remove("has-app-navigation", "nav-collapsed", "nav-mobile-open");
});
</script>

<template>
    <div>
        <button
            v-if="isMobile && mobileOpen"
            class="fixed inset-0 z-[1198] cursor-default bg-slate-950/45 backdrop-blur-[2px]"
            type="button"
            aria-label="Close navigation"
            @click="closeMobileNavigation"
        ></button>
        <aside
            id="appNavigation"
            aria-label="Main navigation"
            class="vue-sidebar fixed inset-y-0 left-0 z-[1200] flex flex-col border-r border-white/10 bg-slate-950 text-slate-100 shadow-2xl shadow-slate-950/20 transition-[width,transform] duration-300 ease-out"
            :class="[
                isMobile ? 'w-[min(18rem,86vw)] -translate-x-[105%]' : (collapsed ? 'w-[4.875rem]' : 'w-[16.25rem]'),
                mobileOpen ? '!translate-x-0' : '',
            ]"
        >
            <a
                href="profile.html"
                class="nav-account flex min-h-[5.75rem] items-center gap-3 border-b border-white/10 px-3 no-underline transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-sky-300"
                :class="collapsed && !isMobile ? 'justify-center' : ''"
                :title="collapsed && !isMobile ? [userDetails?.fullName, userDetails?.role, userDetails?.office].filter(Boolean).join(' · ') || 'Guest' : undefined"
                :aria-current="currentPage === 'profile' ? 'page' : undefined"
                aria-label="View profile"
            >
                <span class="nav-account-avatar grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold" aria-hidden="true">
                    {{ signedIn ? userInitials : "G" }}
                </span>
                <span v-if="!collapsed || isMobile" class="min-w-0">
                    <strong class="block truncate text-sm font-semibold text-white">
                        {{ userDetails?.fullName || "Guest" }}
                    </strong>
                    <span class="mt-1 block truncate text-xs text-slate-400">
                        {{ userDetails?.role || "DHSUD-CAR Records Shelter" }}
                    </span>
                    <span v-if="userDetails?.office" class="mt-1 block truncate text-[11px] text-slate-500">
                        {{ userDetails.office }}
                    </span>
                </span>
            </a>
            <nav class="flex-1 space-y-1 overflow-y-auto px-2 py-4" aria-label="Shelter sections">
                <a
                    v-for="link in links"
                    :key="link.page"
                    :href="link.href"
                    :title="collapsed && !isMobile ? link.label : undefined"
                    :aria-current="currentPage === link.page ? 'page' : undefined"
                    class="group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
                    :class="currentPage === link.page ? 'bg-sky-400/15 text-sky-200 ring-1 ring-inset ring-sky-300/15' : 'text-slate-300 hover:bg-white/7 hover:text-white'"
                >
                    <i class="fa-solid w-5 shrink-0 text-center text-base" :class="link.icon" aria-hidden="true"></i>
                    <span v-if="!collapsed || isMobile" class="truncate">{{ link.label }}</span>
                </a>
            </nav>
            <div class="nav-actions border-t border-white/10 p-2">
                <button
                    v-if="signedIn"
                    type="button"
                    class="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-300 transition-colors hover:bg-rose-400/10 hover:text-rose-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300"
                    :title="collapsed && !isMobile ? 'Sign out' : undefined"
                    @click="logOut"
                >
                    <i class="fa-solid fa-right-from-bracket w-5 shrink-0 text-center" aria-hidden="true"></i>
                    <span v-if="!collapsed || isMobile">Sign out</span>
                </button>
                <a
                    v-else
                    href="login.html"
                    class="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-300 no-underline transition-colors hover:bg-white/7 hover:text-white"
                    :title="collapsed && !isMobile ? 'Login' : undefined"
                >
                    <i class="fa-solid fa-right-to-bracket w-5 shrink-0 text-center" aria-hidden="true"></i>
                    <span v-if="!collapsed || isMobile">Login</span>
                </a>
            </div>
        </aside>
        <button
            type="button"
            class="fixed top-4 z-[1202] grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-lg shadow-slate-900/10 transition-[left,background,color] duration-300 hover:bg-sky-50 hover:text-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 max-[760px]:left-3"
            :class="mobileOpen ? 'left-[calc(min(18rem,86vw)-3.25rem)] !border-white/10 !bg-slate-900 !text-white' : (isMobile ? 'left-3' : (collapsed ? 'left-[1.15rem]' : 'left-[14.95rem]'))"
            :aria-expanded="isMobile ? String(mobileOpen) : String(!collapsed)"
            aria-controls="appNavigation"
            :aria-label="isMobile ? (mobileOpen ? 'Hide navigation' : 'Show navigation') : (collapsed ? 'Expand navigation' : 'Collapse navigation')"
            @click="toggleNavigation"
        >
            <i class="fa-solid" :class="isMobile ? (mobileOpen ? 'fa-xmark' : 'fa-bars') : (collapsed ? 'fa-angles-right' : 'fa-angles-left')" aria-hidden="true"></i>
        </button>
    </div>
</template>
