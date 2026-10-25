<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps({
    currentPage: {
        type: String,
        required: true,
    },
    currentUser: {
        type: Object,
        default: null,
    },
});

const links = [
    { page: "index", href: "./", label: "Home", icon: "fa-house" },
    { page: "documents", href: "documents", label: "Documents", icon: "fa-file-lines" },
    { page: "incoming", href: "incoming", label: "Incoming", icon: "fa-inbox" },
    { page: "outgoing", href: "outgoing", label: "Outgoing", icon: "fa-paper-plane" },
    { page: "dockets", href: "dockets", label: "Dockets", icon: "fa-folder-open" },
    { page: "dockets-mapping", href: "dockets-mapping", label: "Dockets Mapping", icon: "fa-map" },
    { page: "records", href: "records", label: "Records", icon: "fa-box-archive" },
    { page: "requests", href: "requests", label: "Requests", icon: "fa-file-circle-question" },
    { page: "foi", href: "foi", label: "FOI", icon: "fa-envelope-open-text" },
    { page: "users", href: "users", label: "User Management", icon: "fa-users" },
    { page: "activity-log", href: "activity-log", label: "Activity Log", icon: "fa-clock-rotate-left" },
];

const navigationPermissions = {
    documents: ["incoming:view", "outgoing:view", "dockets:view"],
    incoming: ["incoming:view"],
    outgoing: ["outgoing:view"],
    dockets: ["dockets:view"],
    "dockets-mapping": ["docketsMapping:view"],
    records: [
        "incoming:view",
        "outgoing:view",
        "dockets:view",
        "docketsMapping:view",
        "recordsMasterList:view",
        "recordsTransfer:view",
        "foi:view",
    ],
    requests: ["foi:view"],
    foi: ["foi:view"],
};

const knownPages = new Set([...links.map(link => link.page), "profile", "login"]);
const activePage = computed(() => {
    const pathPage = decodeURIComponent(window.location.pathname)
        .split("/")
        .filter(Boolean)
        .at(-1);
    return pathPage && knownPages.has(pathPage) ? pathPage : props.currentPage;
});

const mobileOpen = ref(false);
const collapsed = ref(localStorage.getItem("dhsud_navigation_collapsed") === "true");
const userDetails = ref(props.currentUser);
const signedIn = computed(() => Boolean(userDetails.value));
const visibleLinks = computed(() => links.filter(link => {
    if (link.page === "index") {
        return true;
    }
    if (!signedIn.value) {
        return false;
    }
    if (["users", "activity-log"].includes(link.page)) {
        return ["SuperAdmin", "OfficeAdmin"].includes(userDetails.value.role);
    }
    if (userDetails.value.role === "SuperAdmin") {
        return true;
    }
    const requiredPermissions = navigationPermissions[link.page] || [];
    return requiredPermissions.some(permission => userDetails.value.permissions?.includes(permission));
}));
const userInitials = computed(() => {
    const name = userDetails.value?.fullName || userDetails.value?.email || "User";
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
});
const mobileQuery = window.matchMedia("(max-width: 900px)");
const isMobile = ref(mobileQuery.matches);

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
    fetch("api/index.php?action=session", { credentials: "same-origin" })
        .then(async response => {
            if (response.status === 401) {
                userDetails.value = null;
                return;
            }
            if (!response.ok) {
                throw new Error(`Session refresh failed with status ${response.status}.`);
            }
            const result = await response.json();
            userDetails.value = result.user ?? null;
        })
        .catch(error => {
            console.error("Unable to refresh navigation permissions.", error);
        });
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
        window.location.href = "login";
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
                href="profile"
                class="nav-account flex min-h-[5.75rem] items-center gap-3 border-b border-white/10 px-3 no-underline transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-sky-300"
                :class="collapsed && !isMobile ? 'justify-center' : ''"
                :title="collapsed && !isMobile ? [userDetails?.fullName, userDetails?.role, userDetails?.office].filter(Boolean).join(' · ') || 'Guest' : undefined"
                :aria-current="activePage === 'profile' ? 'page' : undefined"
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
                    v-for="link in visibleLinks"
                    :key="link.page"
                    :href="link.href"
                    :title="collapsed && !isMobile ? link.label : undefined"
                    :aria-current="activePage === link.page ? 'page' : undefined"
                    class="group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
                    :class="activePage === link.page ? 'nav-link-active' : 'text-slate-300 hover:bg-white/7 hover:text-white'"
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
                    href="login"
                    class="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-300 no-underline transition-colors hover:bg-white/7 hover:text-white"
                    :title="collapsed && !isMobile ? 'Login' : undefined"
                    :aria-current="activePage === 'login' ? 'page' : undefined"
                >
                    <i class="fa-solid fa-right-to-bracket w-5 shrink-0 text-center" aria-hidden="true"></i>
                    <span v-if="!collapsed || isMobile">Login</span>
                </a>
            </div>
        </aside>
        <button
            type="button"
            class="fixed top-4 z-[1202] grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-lg shadow-slate-900/10 transition-[left,background,color] duration-300 hover:bg-sky-50 hover:text-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
            :class="mobileOpen ? 'left-[calc(min(18rem,86vw)-3.25rem)] !border-white/10 !bg-slate-900 !text-white' : (isMobile ? 'left-3' : (collapsed ? 'left-[calc(4.875rem-1.25rem)]' : 'left-[14.95rem]'))"
            :aria-expanded="isMobile ? String(mobileOpen) : String(!collapsed)"
            aria-controls="appNavigation"
            :aria-label="isMobile ? (mobileOpen ? 'Hide navigation' : 'Show navigation') : (collapsed ? 'Expand navigation' : 'Collapse navigation')"
            @click="toggleNavigation"
        >
            <i class="fa-solid" :class="isMobile ? (mobileOpen ? 'fa-xmark' : 'fa-bars') : (collapsed ? 'fa-angles-right' : 'fa-angles-left')" aria-hidden="true"></i>
        </button>
    </div>
</template>
