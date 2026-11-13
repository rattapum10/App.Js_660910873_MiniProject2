"use strict";

/* SmartTransit - Central Session Manager */
(function () {
    const TOKEN_KEY = "smartTransitToken";
    const USER_KEY = "smartTransitUser";

    function hasSession() {
        return Boolean(sessionStorage.getItem(TOKEN_KEY));
    }

    function clearSession() {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
    }

    function loginUrl() {
        return "login.html";
    }

    function logout() {
        clearSession();
        window.location.replace(loginUrl());
    }

    function handleUnauthorized() {
        clearSession();

        if (!window.location.pathname.endsWith("/login.html")) {
            window.location.replace(loginUrl());
        }
    }

    function protectPage() {
        const page = window.location.pathname.split("/").pop();

        const protectedPages = [
            "booking.html",
            "history.html"
        ];

        if (protectedPages.includes(page) && !hasSession()) {
            window.location.replace(loginUrl());
        }
    }

    function setupNavigation() {
        if (!hasSession()) return;

        document.querySelectorAll('a[href="login.html"]').forEach(link => {
            link.href = "#";
            link.textContent = "ออกจากระบบ";
            link.setAttribute("data-auth-logout", "true");
        });
    }

    document.addEventListener("click", function (event) {
        const logoutLink = event.target.closest("[data-auth-logout]");

        if (logoutLink) {
            event.preventDefault();

            if (window.confirm("ต้องการออกจากระบบหรือไม่?")) {
                logout();
            }
        }
    });

    window.SmartTransitAuth = {
        hasSession,
        clearSession,
        logout,
        handleUnauthorized,
        protectPage
    };

    protectPage();

    document.addEventListener("DOMContentLoaded", setupNavigation);
})();
