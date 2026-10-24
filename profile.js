requireLogin();

const profileForm = document.getElementById("profileForm");
const profileMessage = document.getElementById("profileMessage");
const profileSave = document.getElementById("profileSave");
const profileSession = getSession();
const profileUser = profileSession ? profileSession.user : null;

if (profileUser) {
    document.getElementById("profileFullName").value = profileUser.fullName || "";
    document.getElementById("profileEmail").value = profileUser.email || "";
    document.getElementById("profileRole").textContent = profileUser.role || "—";
    document.getElementById("profileOffice").textContent = profileUser.office || "—";
} else {
    window.location.href = "login.html";
}

function showProfileMessage(message, type = "success") {
    profileMessage.textContent = message;
    profileMessage.className = `profile-message profile-message-${type}`;
}

profileForm.addEventListener("submit", async event => {
    event.preventDefault();
    profileMessage.classList.add("hidden");

    const newPassword = document.getElementById("profileNewPassword").value;
    const confirmPassword = document.getElementById("profileConfirmPassword").value;
    if (newPassword !== confirmPassword) {
        showProfileMessage("The new password and confirmation do not match.", "error");
        return;
    }

    const payload = new FormData();
    payload.append("action", "updateOwnProfile");
    payload.append("fullName", document.getElementById("profileFullName").value.trim());
    payload.append("email", document.getElementById("profileEmail").value.trim());
    payload.append("currentPassword", document.getElementById("profileCurrentPassword").value);
    payload.append("newPassword", newPassword);

    profileSave.disabled = true;
    try {
        const result = await authedPost(payload);
        if (!result || result.error) {
            showProfileMessage(result?.error || "Your profile could not be updated.", "error");
            return;
        }
        if (!result.success || !result.user) {
            showProfileMessage("The server returned an incomplete profile update response.", "error");
            return;
        }

        const updatedSession = { ...getSession(), user: result.user };
        saveSession(updatedSession.token, updatedSession.user, updatedSession.csrfToken);
        window.dispatchEvent(new Event("dhsud:session-updated"));

        document.getElementById("profileFullName").value = result.user.fullName || "";
        document.getElementById("profileEmail").value = result.user.email || "";
        document.getElementById("profileCurrentPassword").value = "";
        document.getElementById("profileNewPassword").value = "";
        document.getElementById("profileConfirmPassword").value = "";
        const warnings = [result.activityWarning, result.mirrorWarning].filter(Boolean);
        showProfileMessage(
            warnings.length ? `Your profile was updated. ${warnings.join(" ")}` : "Your profile was updated successfully.",
            warnings.length ? "warning" : "success"
        );
    } catch (error) {
        console.error("Profile update failed.", error);
        showProfileMessage("The profile service could not be reached. Please try again.", "error");
    } finally {
        profileSave.disabled = false;
    }
});
