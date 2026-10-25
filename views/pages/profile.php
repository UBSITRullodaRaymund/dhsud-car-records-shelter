<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Profile | DHSUD-CAR Records Shelter</title>
    <link rel="icon" type="image/png" href="logo.png">
    <link rel="stylesheet" href="assets/css/style.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css">
    <?php require __DIR__ . '/../partials/navigation-assets.php'; ?>
</head>
<body class="has-app-navigation">
<?php require __DIR__ . '/../partials/navigation.php'; ?>

<section class="page-banner">
    <div class="page-banner-content">
        <p class="profile-eyebrow">Account settings</p>
        <h1>My Profile</h1>
        <p>View your account details and update your name, email address, or password.</p>
    </div>
</section>

<main class="records-page profile-page">
    <section class="profile-panel" aria-labelledby="profileDetailsTitle">
        <div class="profile-panel-heading">
            <span class="profile-section-icon" aria-hidden="true"><i class="fa-solid fa-user-pen"></i></span>
            <div>
                <h2 id="profileDetailsTitle">Personal information</h2>
                <p>Your role and office are managed by an administrator.</p>
            </div>
        </div>

        <form id="profileForm" class="profile-form">
            <div id="profileMessage" class="profile-message hidden" role="status" aria-live="polite"></div>

            <section class="profile-details-section" aria-labelledby="profileDetailsSectionTitle">
                <div class="profile-subsection-heading">
                    <span class="profile-section-icon profile-section-icon-small" aria-hidden="true"><i class="fa-solid fa-id-card"></i></span>
                    <div>
                        <h3 id="profileDetailsSectionTitle">Account details</h3>
                        <p>Keep your contact information current.</p>
                    </div>
                </div>
                <div class="profile-details-grid">
                    <label class="profile-field">
                        Full name
                        <input id="profileFullName" name="fullName" type="text" maxlength="120" autocomplete="name" required
                               class="profile-input">
                    </label>
                    <label class="profile-field">
                        Email address
                        <input id="profileEmail" name="email" type="email" maxlength="254" autocomplete="email" required
                               class="profile-input">
                    </label>
                </div>
                <div class="profile-assignment-grid" aria-label="Assigned access">
                    <div class="profile-readonly">
                        <span class="profile-field-label"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Role</span>
                        <p id="profileRole"></p>
                    </div>
                    <div class="profile-readonly">
                        <span class="profile-field-label"><i class="fa-solid fa-building" aria-hidden="true"></i> Office</span>
                        <p id="profileOffice"></p>
                    </div>
                </div>
            </section>

            <section class="profile-password-section" aria-labelledby="passwordSectionTitle">
                <div class="profile-subsection-heading">
                    <span class="profile-section-icon profile-section-icon-small" aria-hidden="true"><i class="fa-solid fa-lock"></i></span>
                    <div>
                        <h3 id="passwordSectionTitle">Change password</h3>
                        <p>Leave these fields blank to keep your current password.</p>
                    </div>
                </div>
                <div class="profile-password-grid">
                    <label class="profile-field">
                        New password
                        <input id="profileNewPassword" name="newPassword" type="password" minlength="8" autocomplete="new-password"
                               class="profile-input">
                        <span class="profile-hint">At least 8 characters.</span>
                    </label>
                    <label class="profile-field">
                        Confirm new password
                        <input id="profileConfirmPassword" name="confirmPassword" type="password" minlength="8" autocomplete="new-password"
                               class="profile-input">
                    </label>
                </div>
            </section>

            <section class="profile-verification-section" aria-labelledby="profileVerificationTitle">
                <div class="profile-subsection-heading">
                    <span class="profile-section-icon profile-section-icon-small profile-security-icon" aria-hidden="true"><i class="fa-solid fa-key"></i></span>
                    <div>
                        <h3 id="profileVerificationTitle">Confirm your identity</h3>
                        <p>Enter your current password to securely save profile changes.</p>
                    </div>
                </div>
                <label class="profile-field profile-current-password">
                    Current password
                    <input id="profileCurrentPassword" name="currentPassword" type="password" autocomplete="current-password" required
                           class="profile-input">
                </label>
            </section>

            <div class="profile-actions">
                <button id="profileSave" type="submit" class="save-btn">
                    <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
                    Save changes
                </button>
                <a href="./" class="profile-back-link">Back to Home</a>
            </div>
        </form>
    </section>
</main>

<script src="assets/js/auth.js"></script>
<script src="assets/js/profile.js"></script>
</body>
</html>
