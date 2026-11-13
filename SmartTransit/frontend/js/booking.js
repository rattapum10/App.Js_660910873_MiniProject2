
"use strict";

/* =========================================
   SmartTransit - Booking Page
   Trip details: GET /api/trips
   Create booking: POST /api/bookings
   Price authority: Backend / SQLite
   ========================================= */

const API_BASE = "/api";

const params = new URLSearchParams(window.location.search);

const bookingInfo = {
  tripId: (params.get("tripId") || "").trim(),
  origin: "",
  destination: "",
  date: params.get("date") || "",
  departure: "",
  arrival: "",
  passengers: Number.parseInt(params.get("passengers") || "1", 10)
};

let tripData = null;
let bookingInProgress = false;
let tripLoading = true;
let tripLoadError = false;

if (!Number.isInteger(bookingInfo.passengers) || bookingInfo.passengers < 1) {
  bookingInfo.passengers = 1;
}

/* =========================================
   DOM HELPERS
   ========================================= */

function $(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = $(id);

  if (element) {
    element.textContent =
      value === undefined || value === null || value === ""
        ? "-"
        : String(value);
  }
}

function formatMoney(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return "-";
  }

  return `฿${amount.toLocaleString("th-TH")}`;
}

function formatThaiDate(dateString) {
  if (!dateString) return "-";

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);

  if (!match) return dateString;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return dateString;
  }

  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

/* =========================================
   ERROR HANDLING
   ========================================= */

function showError(message) {
  const errorElement = $("bookingError");

  if (errorElement) {
    errorElement.textContent = message;
    errorElement.hidden = false;
    errorElement.style.display = "block";

    errorElement.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  } else {
    window.alert(message);
  }
}

function clearError() {
  const errorElement = $("bookingError");

  if (errorElement) {
    errorElement.textContent = "";
    errorElement.hidden = true;
    errorElement.style.display = "none";
  }
}

/* =========================================
   PRICE CALCULATION
   ใช้ราคาจาก Backend เท่านั้น
   ========================================= */

function calculateTotalPrice() {
  if (!tripData) return 0;

  const unitPrice = Number(tripData.price);

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return 0;
  }

  return unitPrice * bookingInfo.passengers;
}

/* =========================================
   RENDER TRIP DETAILS
   ========================================= */

function renderBookingDetails() {
  setText("tripIdText", bookingInfo.tripId);
  setText("originText", bookingInfo.origin);
  setText("destinationText", bookingInfo.destination);
  setText("dateText", formatThaiDate(bookingInfo.date));
  setText("departureText", bookingInfo.departure);
  setText("arrivalText", bookingInfo.arrival);
  setText("passengersText", `${bookingInfo.passengers} คน`);

  setText("totalPrice", formatMoney(calculateTotalPrice()));
}

/* =========================================
   LOAD TRIP FROM BACKEND
   GET /api/trips?date=YYYY-MM-DD
   ========================================= */

async function loadTripDetails() {
  tripLoading = true;
  tripLoadError = false;
  tripData = null;

  const submitButton = $("submitBooking");

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "กำลังโหลดข้อมูลเที่ยวรถ...";
  }

  if (!bookingInfo.tripId) {
    throw new Error("ไม่พบรหัสเที่ยวรถ กรุณากลับไปเลือกเที่ยวรถใหม่");
  }

  if (!bookingInfo.date) {
    throw new Error("ไม่พบวันที่เดินทาง กรุณากลับไปเลือกเที่ยวรถใหม่");
  }

  const dateMatch = /^\d{4}-\d{2}-\d{2}$/.exec(bookingInfo.date);

  if (!dateMatch) {
    throw new Error("รูปแบบวันที่เดินทางไม่ถูกต้อง");
  }

  const response = await fetch(
    `${API_BASE}/trips?date=${encodeURIComponent(bookingInfo.date)}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json"
      },
      cache: "no-store"
    }
  );

  let result = {};

  try {
    result = await response.json();
  } catch (error) {
    result = {};
  }

  if (!response.ok || result.success !== true) {
    throw new Error(
      result.message || "ไม่สามารถโหลดข้อมูลเที่ยวรถจาก Backend ได้"
    );
  }

  if (!Array.isArray(result.trips)) {
    throw new Error("รูปแบบข้อมูลเที่ยวรถจาก Backend ไม่ถูกต้อง");
  }

  const trip = result.trips.find(
    (item) => String(item.tripId) === bookingInfo.tripId
  );

  if (!trip) {
    throw new Error(
      "ไม่พบเที่ยวรถนี้ หรือเที่ยวรถไม่ได้เปิดให้บริการ กรุณากลับไปค้นหาใหม่"
    );
  }

  const price = Number(trip.price);
  const availableSeats = Number(trip.availableSeats);

  if (!Number.isFinite(price) || price < 0) {
    throw new Error("ข้อมูลราคาของเที่ยวรถไม่ถูกต้อง");
  }

  if (!Number.isSafeInteger(availableSeats) || availableSeats < 0) {
    throw new Error("ข้อมูลจำนวนที่นั่งจาก Backend ไม่ถูกต้อง");
  }

  if (!trip.origin || !trip.destination) {
    throw new Error("ข้อมูลเส้นทางเที่ยวรถไม่ครบถ้วน");
  }

  tripData = {
    tripId: String(trip.tripId),
    origin: String(trip.origin),
    destination: String(trip.destination),
    departure: String(trip.departure),
    arrival: String(trip.arrival),
    price,
    capacity: Number(trip.capacity),
    bookedSeats: Number(trip.bookedSeats),
    availableSeats
  };

  // ใช้ข้อมูลจาก Backend เป็นข้อมูลหลัก
  bookingInfo.origin = tripData.origin;
  bookingInfo.destination = tripData.destination;
  bookingInfo.departure = tripData.departure;
  bookingInfo.arrival = tripData.arrival;

  tripLoading = false;

  renderBookingDetails();

  if (submitButton) {
    submitButton.disabled = false;
    submitButton.textContent = "ยืนยันการจองตัวอย่าง";
  }

  if (bookingInfo.passengers > tripData.availableSeats) {
    showError(
      `จำนวนที่นั่งไม่เพียงพอ ขณะนี้เหลือ ${tripData.availableSeats} ที่นั่ง`
    );
  }

  console.log("SmartTransit: Trip loaded from Backend", tripData);

  return tripData;
}

/* =========================================
   ACCOUNT PREFILL
   ========================================= */

function prefillAccount() {
  const nameInput = $("fullName");
  const emailInput = $("email");

  if (nameInput) {
    nameInput.value = "";
    nameInput.placeholder = "กรอกชื่อ-นามสกุล";
    nameInput.readOnly = false;
    nameInput.disabled = false;
    nameInput.removeAttribute("readonly");
    nameInput.removeAttribute("disabled");
  }

  try {
    const savedUser = sessionStorage.getItem("smartTransitUser");

    if (!savedUser) return;

    const user = JSON.parse(savedUser);

    if (emailInput && user.email && !emailInput.value) {
      emailInput.value = user.email;
    }
  } catch (error) {
    console.warn("SmartTransit: ไม่สามารถอ่านข้อมูลบัญชีได้");
  }
}

/* =========================================
   FORM VALIDATION
   ========================================= */

function validateBooking() {
  if (tripLoading) {
    showError("กรุณารอให้ระบบโหลดข้อมูลเที่ยวรถก่อน");
    return false;
  }

  if (tripLoadError || !tripData) {
    showError("ไม่สามารถตรวจสอบข้อมูลเที่ยวรถได้ กรุณาโหลดหน้าเว็บใหม่");
    return false;
  }

  if (!bookingInfo.tripId) {
    showError("ไม่พบรหัสเที่ยวรถ");
    return false;
  }

  if (!bookingInfo.date) {
    showError("ไม่พบวันที่เดินทาง");
    return false;
  }

  if (
    !Number.isSafeInteger(bookingInfo.passengers) ||
    bookingInfo.passengers < 1
  ) {
    showError("จำนวนผู้โดยสารไม่ถูกต้อง");
    return false;
  }

  if (bookingInfo.passengers > tripData.availableSeats) {
    showError(
      `จำนวนที่นั่งไม่เพียงพอ เหลือ ${tripData.availableSeats} ที่นั่ง`
    );
    return false;
  }

  const nameInput = $("fullName");
  const phoneInput = $("phone");
  const emailInput = $("email");

  if (!nameInput || !nameInput.value.trim()) {
    showError("กรุณากรอกชื่อ-นามสกุล");
    nameInput?.focus();
    return false;
  }

  if (!phoneInput || !phoneInput.value.trim()) {
    showError("กรุณากรอกหมายเลขโทรศัพท์");
    phoneInput?.focus();
    return false;
  }

  if (!emailInput || !emailInput.value.trim()) {
    showError("กรุณากรอกอีเมล");
    emailInput?.focus();
    return false;
  }

  if (!emailInput.checkValidity()) {
    showError("รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง");
    emailInput.focus();
    return false;
  }

  return true;
}

/* =========================================
   BOOKING RESPONSE HELPERS
   ========================================= */

function extractBooking(result) {
  if (!result || typeof result !== "object") {
    return {};
  }

  if (result.booking && typeof result.booking === "object") {
    return result.booking;
  }

  if (
    result.data?.booking &&
    typeof result.data.booking === "object"
  ) {
    return result.data.booking;
  }

  if (result.data && typeof result.data === "object") {
    return result.data;
  }

  return result;
}

function extractBookingId(result) {
  const booking = extractBooking(result);

  const id =
    booking.bookingCode ??
    booking.booking_code ??
    booking.bookingId ??
    booking.booking_id ??
    booking.id ??
    booking.deleteId ??
    result?.bookingId ??
    result?.booking_id ??
    result?.id;

  return id === undefined || id === null || id === ""
    ? "ไม่พบรหัสจาก API"
    : String(id);
}

/* =========================================
   SUCCESS SCREEN
   ========================================= */

function showBookingSuccess(result, contact) {
  const bookingContent = $("bookingContent");
  const confirmation = $("bookingConfirmation");

  if (bookingContent) {
    bookingContent.hidden = true;
    bookingContent.style.display = "none";
  }

  if (confirmation) {
    confirmation.hidden = false;
    confirmation.style.display = "block";
  }

  const booking = extractBooking(result);

  const returnedTotal =
    booking.totalPrice ??
    booking.total_price ??
    booking.totalAmount ??
    booking.total_amount ??
    booking.price ??
    result?.totalPrice ??
    result?.total_price;

  // Backend เป็นผู้คำนวณยอดรวมที่เชื่อถือได้
  const totalPrice =
    returnedTotal !== undefined && returnedTotal !== null
      ? Number(returnedTotal)
      : calculateTotalPrice();

  setText("confirmationBookingId", extractBookingId(result));
  setText("confirmationFullName", contact.fullName);

  setText("confirmationTripId", bookingInfo.tripId);
  setText("confirmationOrigin", bookingInfo.origin);
  setText("confirmationDestination", bookingInfo.destination);

  setText("confirmationDate", formatThaiDate(bookingInfo.date));
  setText("confirmationDeparture", bookingInfo.departure);
  setText("confirmationArrival", bookingInfo.arrival);

  setText("confirmationPassengers", `${bookingInfo.passengers} คน`);

  setText("confirmationPhone", contact.phone);
  setText("confirmationEmail", contact.email);

  setText(
    "confirmationPrice",
    formatMoney(
      Number.isFinite(totalPrice) && totalPrice >= 0
        ? totalPrice
        : calculateTotalPrice()
    )
  );

  const historyButton = $("goHistoryBtn");

  if (historyButton) {
    historyButton.href = "history.html";
  }

  const homeButton = $("goHomeBtn");

  if (homeButton) {
    homeButton.href = "index.html";
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  console.log("SmartTransit: Booking completed", result);

  // ไม่เปลี่ยนหน้าอัตโนมัติ
}

/* =========================================
   CREATE BOOKING
   POST /api/bookings
   ========================================= */

async function createBooking(event) {
  event?.preventDefault();

  if (bookingInProgress) return;

  clearError();

  if (!validateBooking()) return;

  const token = sessionStorage.getItem("smartTransitToken");

  if (!token) {
    showError("กรุณาเข้าสู่ระบบก่อนทำรายการจอง");
    return;
  }

  const nameInput = $("fullName");
  const phoneInput = $("phone");
  const emailInput = $("email");
  const notesInput = $("notes");
  const submitButton = $("submitBooking");

  const contact = {
    fullName: nameInput.value.trim(),
    phone: phoneInput.value.trim(),
    email: emailInput.value.trim()
  };

  // ส่งข้อมูลที่ Backend ต้องการ
  // ไม่ส่งราคาเพื่อให้ Backend อ่านราคาจาก SQLite เอง

  const payload = {
    tripId: bookingInfo.tripId,
    date: bookingInfo.date,
    passengers: bookingInfo.passengers,

    fullName: contact.fullName,
    phone: contact.phone,
    email: contact.email,

    notes: notesInput
      ? notesInput.value.trim()
      : ""
  };

  bookingInProgress = true;

  const originalButtonText = submitButton
    ? submitButton.textContent
    : "ยืนยันการจอง";

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "กำลังบันทึกการจอง...";
  }

  let bookingSucceeded = false;

  try {
    const response = await fetch(`${API_BASE}/bookings`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },

      body: JSON.stringify(payload)
    });

    let result = {};

    try {
      result = await response.json();
    } catch (error) {
      result = {};
    }

    if (response.status === 401) {
      if (
        window.SmartTransitAuth &&
        typeof window.SmartTransitAuth.handleUnauthorized === "function"
      ) {
        window.SmartTransitAuth.handleUnauthorized();
      } else {
        showError("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
      }

      return;
    }

    if (!response.ok || result.success !== true) {
      throw new Error(
        result.message ||
        result.error ||
        "ไม่สามารถบันทึกการจองได้ กรุณาลองอีกครั้ง"
      );
    }

    showBookingSuccess(result, contact);

    bookingSucceeded = true;

  } catch (error) {
    console.error("SmartTransit booking error:", error);

    if (error instanceof TypeError) {
      showError(
        "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบ Backend แล้วลองอีกครั้ง"
      );
    } else {
      showError(
        error.message || "เกิดข้อผิดพลาดในการจอง กรุณาลองอีกครั้ง"
      );
    }

  } finally {
    bookingInProgress = false;

    if (!bookingSucceeded && submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  }
}

/* =========================================
   INITIALIZATION
   ========================================= */

document.addEventListener("DOMContentLoaded", async function () {
  clearError();

  prefillAccount();

  const nameInput = $("fullName");

  if (nameInput) {
    nameInput.value = "";
    nameInput.readOnly = false;
    nameInput.disabled = false;
    nameInput.removeAttribute("readonly");
    nameInput.removeAttribute("disabled");
  }

  const bookingForm = $("bookingForm");

  if (bookingForm) {
    bookingForm.addEventListener("submit", createBooking);
  }

  renderBookingDetails();

  try {
    await loadTripDetails();

  } catch (error) {
    console.error("SmartTransit trip loading error:", error);

    tripLoading = false;
    tripLoadError = true;

    const submitButton = $("submitBooking");

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "ไม่สามารถจองได้";
    }

    showError(error.message || "ไม่สามารถโหลดข้อมูลเที่ยวรถได้");
  }
});
