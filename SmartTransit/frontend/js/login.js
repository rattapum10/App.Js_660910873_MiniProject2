"use strict";

/*
 * SmartTransit Login / Register
 * Use a same-origin API path so local, LAN, and LocalTunnel URLs work.
 */

const API_BASE = "/api/auth";

const $ = (id) => document.getElementById(id);

const loginTab = $("loginTab");
const registerTab = $("registerTab");
const loginPanel = $("loginPanel");
const registerPanel = $("registerPanel");
const authMessage = $("authMessage");
const registerPassword = $("registerPassword");
const confirmPassword = $("confirmPassword");
const passwordMatchHint = $("passwordMatchHint");

const EYE_OPEN = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>`;

const EYE_CLOSED = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m3 3 18 18"></path>
    <path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.1 3.9"></path>
    <path d="M6.2 6.2C3.5 8.1 2 12 2 12s3.5 7 10 7a10 10 0 0 0 4-.8"></path>
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>
  </svg>`;

function setMode(mode) {
  const loginMode = mode === "login";

  loginPanel.hidden = !loginMode;
  registerPanel.hidden = loginMode;

  loginTab.setAttribute("aria-selected", String(loginMode));
  registerTab.setAttribute("aria-selected", String(!loginMode));

  clearMessage();
}

function showMessage(text, type = "error") {
  authMessage.textContent = text;
  authMessage.className = `auth-message ${type}`;
  authMessage.hidden = false;
}

function clearMessage() {
  authMessage.textContent = "";
  authMessage.className = "auth-message";
  authMessage.hidden = true;
}

function showNetworkError(error) {
  console.error("SmartTransit auth request failed:", error);

  showMessage(
    "เชื่อมต่อ Backend ไม่ได้ กรุณาตรวจสอบว่า Backend และ LocalTunnel ยังทำงานอยู่ แล้วลองโหลดหน้าเว็บใหม่ หากยังพบปัญหา ให้ตรวจสอบ URL ของหน้าเว็บและสถานะเซิร์ฟเวอร์"
  );
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (_) {
    return {};
  }
}

function getAuthPayload(data) {
  const nested = data && data.data && typeof data.data === "object"
    ? data.data
    : {};

  return {
    token: data.token || data.accessToken || nested.token || nested.accessToken || "",
    user: data.user || nested.user || data.account || nested.account || null
  };
}

function saveSession(auth) {
  sessionStorage.setItem("smartTransitToken", auth.token);

  if (auth.user) {
    sessionStorage.setItem("smartTransitUser", JSON.stringify(auth.user));
  }
}

function describeApiError(data, fallback) {
  return data.message || data.error || data.details || fallback;
}

async function postAuth(endpoint, payload, button, defaultLabel) {
  button.disabled = true;
  button.textContent = "กำลังดำเนินการ...";

  try {
    const response = await fetch(`${API_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await readJson(response);

    if (!response.ok || data.success === false) {
      throw new Error(
        describeApiError(
          data,
          endpoint === "login"
            ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
            : "สมัครสมาชิกไม่สำเร็จ"
        )
      );
    }

    return data;
  } finally {
    button.disabled = false;
    button.textContent = defaultLabel;
  }
}

/* แสดงหรือซ่อนรหัสผ่านให้ทุกปุ่มที่กำหนด data-toggle-password */
document.querySelectorAll("[data-toggle-password]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = $(button.dataset.togglePassword);

    if (!input) return;

    const shouldShow = input.type === "password";
    input.type = shouldShow ? "text" : "password";
    button.setAttribute("aria-pressed", String(shouldShow));
    button.setAttribute(
      "aria-label",
      shouldShow ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"
    );
    button.innerHTML = shouldShow ? EYE_CLOSED : EYE_OPEN;
  });
});

/* สลับแท็บ Login / Register */
loginTab.addEventListener("click", () => setMode("login"));
registerTab.addEventListener("click", () => setMode("register"));

$("showRegisterLink").addEventListener("click", (event) => {
  event.preventDefault();
  setMode("register");
});

$("showLoginLink").addEventListener("click", (event) => {
  event.preventDefault();
  setMode("login");
});

/* ตรวจว่ารหัสผ่านและยืนยันรหัสผ่านตรงกันแบบทันที */
function updatePasswordMatch() {
  const password = registerPassword.value;
  const confirm = confirmPassword.value;

  confirmPassword.setCustomValidity("");

  if (!confirm) {
    passwordMatchHint.textContent = "กรอกรหัสผ่านให้ตรงกันทั้งสองช่อง";
    passwordMatchHint.style.color = "var(--auth-muted)";
    return false;
  }

  if (password !== confirm) {
    confirmPassword.setCustomValidity("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    passwordMatchHint.textContent = "รหัสผ่านทั้งสองช่องไม่ตรงกัน";
    passwordMatchHint.style.color = "#a61b1b";
    return false;
  }

  passwordMatchHint.textContent = "รหัสผ่านตรงกันแล้ว";
  passwordMatchHint.style.color = "#168344";
  return true;
}

registerPassword.addEventListener("input", updatePasswordMatch);
confirmPassword.addEventListener("input", updatePasswordMatch);

/* Login: เมื่อเข้าสู่ระบบสำเร็จ ให้ไปหน้าแรกทันที */
$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const button = $("loginSubmit");
  const payload = {
    email: $("loginEmail").value.trim(),
    password: $("loginPassword").value
  };

  try {
    const data = await postAuth("login", payload, button, "เข้าสู่ระบบ");
    const auth = getAuthPayload(data);

    if (!auth.token) {
      throw new Error(
        "Backend ตอบกลับโดยไม่มี Token กรุณาตรวจสอบรูปแบบข้อมูลจาก /api/auth/login"
      );
    }

    saveSession(auth);

    showMessage("เข้าสู่ระบบสำเร็จ กำลังเปิดหน้าหลัก...", "success");

    /* ไม่มีการหน่วงเวลา 3 วินาที */
    window.location.replace("index.html");
  } catch (error) {
    if (error instanceof TypeError) {
      showNetworkError(error);
    } else {
      showMessage(error.message || "เข้าสู่ระบบไม่สำเร็จ");
    }
  }
});

/* Register: ตรวจยืนยันรหัสผ่านก่อนส่ง API */
$("registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  if (registerPassword.value.length < 8) {
    showMessage("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
    registerPassword.focus();
    return;
  }

  if (registerPassword.value !== confirmPassword.value) {
    updatePasswordMatch();
    showMessage("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง");
    confirmPassword.focus();
    return;
  }

  const button = $("registerSubmit");
  const payload = {
    fullName: $("registerFullName").value.trim(),
    email: $("registerEmail").value.trim(),
    password: registerPassword.value
  };

  try {
    const data = await postAuth("register", payload, button, "สมัครสมาชิก");
    const auth = getAuthPayload(data);

    if (auth.token) {
      saveSession(auth);
      showMessage("สมัครสมาชิกสำเร็จ กำลังเปิดหน้าหลัก...", "success");
      window.location.replace("index.html");
      return;
    }

    /* บาง Backend สมัครสำเร็จแต่ให้ผู้ใช้ Login เอง */
    $("loginEmail").value = payload.email;
    setMode("login");
    showMessage(
      data.message || "สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบด้วยบัญชีที่สร้างไว้",
      "success"
    );
  } catch (error) {
    if (error instanceof TypeError) {
      showNetworkError(error);
    } else {
      showMessage(error.message || "สมัครสมาชิกไม่สำเร็จ");
    }
  }
});
