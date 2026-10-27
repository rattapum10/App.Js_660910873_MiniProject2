"use strict";

/* SmartTransit History: load and delete bookings owned by current user. */
const API_BASE = "/api";
const $ = (id) => document.getElementById(id);

let currentBookings = [];
let loadingHistory = false;

function pick(obj, keys, fallback = "-") {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      return obj[key];
    }
  }
  return fallback;
}

function getBookingId(row) {
  // deleteId is supplied by GET /api/bookings using the exact same key
  // that the Backend's DELETE handler uses. The others are legacy fallbacks.
  return pick(
    row,
    ["deleteId", "delete_id", "id", "booking_code", "bookingCode", "booking_id", "bookingId"],
    ""
  );
}

function dateText(value) {
  if (!value) return "-";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return String(value);

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function makeItem(label, value, emphasize = false) {
  const wrapper = document.createElement("div");
  const labelElement = document.createElement("span");
  labelElement.className = "history-item-label";
  labelElement.textContent = label;

  const valueElement = document.createElement("span");
  valueElement.className = emphasize ? "history-total" : "history-item-value";
  valueElement.textContent = String(value);

  wrapper.append(labelElement, valueElement);
  return wrapper;
}

function showError(message) {
  const el = $("historyError");
  if (!el) return;
  el.replaceChildren();
  el.textContent = message;
  el.hidden = false;
}

function clearError() {
  const el = $("historyError");
  if (!el) return;
  el.textContent = "";
  el.hidden = true;
}

function updateEmptyState() {
  const list = $("historyList");
  const empty = $("historyEmpty");
  if (!list || !empty) return;
  empty.hidden = list.children.length !== 0;
}

function makeTrashIcon() {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "17");
  svg.setAttribute("height", "17");

  const paths = [
    ["path", { d: "M3 6h18" }],
    ["path", { d: "M8 6V4h8v2" }],
    ["path", { d: "m19 6-1 14H6L5 6" }],
    ["path", { d: "M10 10v6M14 10v6" }]
  ];

  for (const [tag, attrs] of paths) {
    const node = document.createElementNS(svgNS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    svg.appendChild(node);
  }

  return svg;
}

function renderBookings(bookings) {
  const list = $("historyList");
  if (!list) return;

  list.replaceChildren();
  $("historyLoading").hidden = true;
  currentBookings = bookings;

  for (const row of bookings) {
    const id = getBookingId(row);
    const card = document.createElement("article");
    card.className = "history-card";
    if (id !== "") card.dataset.bookingId = String(id);

    const top = document.createElement("div");
    top.className = "history-card-top";

    const routeInfo = document.createElement("div");
    const code = document.createElement("div");
    code.className = "history-code";
    code.textContent = `รายการจอง #${id || "ไม่พบรหัส"}`;

    const route = document.createElement("h2");
    route.className = "history-route";
    route.textContent = `${pick(row, ["origin", "from_location", "from"])} → ${pick(row, ["destination", "to_location", "to"])}`;
    routeInfo.append(code, route);

    const status = document.createElement("span");
    status.className = "history-status";
    const dot = document.createElement("span");
    dot.className = "history-status-dot";
    const statusText = String(pick(row, ["status"], "ยืนยันแล้ว"));
    status.append(dot, document.createTextNode(statusText));
    top.append(routeInfo, status);

    const grid = document.createElement("div");
    grid.className = "history-grid";
    const priceRaw = Number(pick(row, ["total_price", "totalPrice", "price"], 0));
    const price = Number.isFinite(priceRaw) ? priceRaw : 0;

    grid.append(
      makeItem("วันที่เดินทาง", dateText(pick(row, ["date", "travel_date", "travelDate"]))),
      makeItem("จำนวนผู้โดยสาร", `${pick(row, ["passengers", "passenger_count"], "1")} คน`),
      makeItem("ราคารวม", `฿${price.toLocaleString("th-TH")}`, true),
      makeItem("ชื่อผู้จอง", String(pick(row, ["fullName", "full_name", "fullname", "contact_name", "name", "booking_name", "passenger_name"]))),
      makeItem("โทรศัพท์", String(pick(row, ["contactPhone", "contact_phone", "phone"]))),
      makeItem("อีเมล", String(pick(row, ["contactEmail", "contact_email", "email"])))
    );

    const actions = document.createElement("div");
    actions.className = "history-card-actions";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "history-delete-button";
    deleteButton.append(makeTrashIcon(), document.createTextNode("ลบรายการจอง"));
    deleteButton.setAttribute(
      "aria-label",
      id === "" ? "ลบรายการจอง (ไม่พบรหัส)" : `ลบรายการจองหมายเลข ${id}`
    );

    // ถ้า API ไม่ส่ง ID ที่ใช้ลบมา จะปิดปุ่มแทนการส่ง DELETE ด้วย ID ที่ไม่ถูกต้อง
    if (id === "") {
      deleteButton.disabled = true;
      deleteButton.title = "รายการนี้ไม่มี booking ID จาก API";
    } else {
      deleteButton.addEventListener("click", () => deleteBooking(id, card, deleteButton));
    }

    actions.appendChild(deleteButton);
    card.append(top, grid, actions);
    list.appendChild(card);
  }

  updateEmptyState();
}

async function loadHistory() {
  if (loadingHistory) return;
  loadingHistory = true;

  const token = sessionStorage.getItem("smartTransitToken");
  const loading = $("historyLoading");
  const list = $("historyList");
  const refreshButton = $("refreshHistory");

  clearError();
  if (loading) loading.hidden = false;
  if (list) list.replaceChildren();
  if (refreshButton) refreshButton.disabled = true;

  if (!token) {
    if (loading) loading.hidden = true;
    showError("กรุณาเข้าสู่ระบบก่อนดูประวัติการจอง");
    const errorEl = $("historyError");
    const loginLink = document.createElement("a");
    loginLink.href = "login.html";
    loginLink.textContent = " ไปหน้าเข้าสู่ระบบ";
    loginLink.style.fontWeight = "bold";
    errorEl.appendChild(loginLink);
    loadingHistory = false;
    if (refreshButton) refreshButton.disabled = false;
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/bookings`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    });

    let data = {};
    try { data = await response.json(); } catch (_) { data = {}; }

    if (response.status === 401) {
      throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
    }
    if (!response.ok) {
      throw new Error(data.message || data.error || "โหลดประวัติการจองไม่สำเร็จ");
    }

    const rows = Array.isArray(data)
      ? data
      : (data.bookings || data.data || []);

    renderBookings(Array.isArray(rows) ? rows : []);
  } catch (error) {
    if (loading) loading.hidden = true;
    showError(error.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
  } finally {
    loadingHistory = false;
    if (refreshButton) refreshButton.disabled = false;
  }
}

async function deleteBooking(id, card, button) {
  const bookingId = String(id);
  const confirmed = window.confirm(
    `คุณแน่ใจหรือไม่ว่าต้องการลบรายการจอง #${bookingId}?\nการลบนี้ไม่สามารถย้อนกลับได้`
  );

  if (!confirmed) return;

  const token = sessionStorage.getItem("smartTransitToken");
  if (!token) {
    showError("กรุณาเข้าสู่ระบบใหม่ก่อนลบรายการจอง");
    return;
  }

  clearError();
  const oldButtonText = button.textContent;
  button.disabled = true;
  button.replaceChildren(makeTrashIcon(), document.createTextNode("กำลังลบ..."));

  try {
    const response = await fetch(
      `${API_BASE}/bookings/${encodeURIComponent(bookingId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    let data = {};
    try { data = await response.json(); } catch (_) { data = {}; }

    if (response.status === 401) {
      throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
    }

    if (response.status === 404) {
      throw new Error(data.message || "ไม่พบรายการจองนี้ หรือรายการอาจถูกลบไปแล้ว");
    }

    if (!response.ok) {
      throw new Error(data.message || data.error || "ลบรายการจองไม่สำเร็จ");
    }

    // ลบการ์ดออกจากหน้าเมื่อ Backend ยืนยันว่าลบสำเร็จแล้วเท่านั้น
    card.remove();
    currentBookings = currentBookings.filter(
      row => String(getBookingId(row)) !== bookingId
    );
    updateEmptyState();
  } catch (error) {
    console.error("SmartTransit delete booking error:", error);
    showError(error.message || "ไม่สามารถลบรายการจองได้ กรุณาลองอีกครั้ง");
    button.disabled = false;
    button.replaceChildren(makeTrashIcon(), document.createTextNode("ลบรายการจอง"));
    button.setAttribute("aria-label", `ลบรายการจองหมายเลข ${bookingId}`);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const refreshButton = $("refreshHistory");
  if (refreshButton) refreshButton.addEventListener("click", loadHistory);
  loadHistory();
});
