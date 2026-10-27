"use strict";

/* =========================================
   SmartTransit - Booking Page
   API: same-origin /api/bookings (supports LocalTunnel and other hostnames)
   Success screen remains until user navigates.
   ========================================= */

const API_BASE = "/api";

/* Prices are for display only. Backend should calculate authoritative total. */
const TRIP_PRICES = {
  ST001: 220,
  ST002: 280,
  ST003: 200
};

const params = new URLSearchParams(window.location.search);

const bookingInfo = {
  tripId: params.get("tripId") || "",
  origin: params.get("origin") || "",
  destination: params.get("destination") || "",
  date: params.get("date") || "",
  departure: params.get("departure") || "",
  arrival: params.get("arrival") || "",
  passengers: Number.parseInt(params.get("passengers") || "1", 10)
};

if (!Number.isInteger(bookingInfo.passengers) || bookingInfo.passengers < 1) {
  bookingInfo.passengers = 1;
}

let bookingInProgress = false;

function $(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = $(id);
  if (element) {
    element.textContent = value == null || value === "" ? "-" : String(value);
  }
}

function formatThaiDate(dateString) {
  if (!dateString) return "-";

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return dateString;

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );

  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function calculateTotalPrice() {
  const unitPrice = TRIP_PRICES[bookingInfo.tripId] || 0;
  return unitPrice * bookingInfo.passengers;
}

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return "-";
  }
  return `฿${amount.toLocaleString("th-TH")}`;
}

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

/* Keep name empty; email may be prefilled from the signed-in account. */
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

function showError(message) {
  const errorElement = $("bookingError");
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.hidden = false;
    errorElement.style.display = "block";
    errorElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
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

function validateBooking() {
  if (!bookingInfo.tripId) {
    showError("ไม่พบรหัสเที่ยวรถ กรุณากลับไปเลือกเที่ยวรถใหม่");
    return false;
  }

  if (!bookingInfo.origin || !bookingInfo.destination) {
    showError("ไม่พบข้อมูลต้นทางหรือปลายทาง กรุณากลับไปเลือกเที่ยวรถใหม่");
    return false;
  }

  if (!bookingInfo.date) {
    showError("ไม่พบวันที่เดินทาง กรุณากลับไปเลือกเที่ยวรถใหม่");
    return false;
  }

  if (!Number.isInteger(bookingInfo.passengers) || bookingInfo.passengers < 1) {
    showError("จำนวนผู้โดยสารไม่ถูกต้อง");
    return false;
  }

  if (!TRIP_PRICES[bookingInfo.tripId]) {
    showError("ไม่พบราคาของเที่ยวรถนี้ กรุณากลับไปเลือกเที่ยวรถใหม่");
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

function extractBooking(result) {
  if (!result || typeof result !== "object") return {};
  if (result.booking && typeof result.booking === "object") return result.booking;
  if (result.data?.booking && typeof result.data.booking === "object") return result.data.booking;
  if (result.data && typeof result.data === "object") return result.data;
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
    result?.bookingId ??
    result?.booking_id ??
    result?.id;

  return id === undefined || id === null || id === "" ? "ไม่พบรหัสจาก API" : String(id);
}

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
    result?.totalPrice ??
    result?.total_price;

  const calculatedTotal = calculateTotalPrice();
  const totalPrice = returnedTotal !== undefined && returnedTotal !== null
    ? Number(returnedTotal)
    : calculatedTotal;

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
  setText("confirmationPrice", formatMoney(Number.isFinite(totalPrice) ? totalPrice : calculatedTotal));

  const historyButton = $("goHistoryBtn");
  if (historyButton) historyButton.href = "history.html";

  const homeButton = $("goHomeBtn");
  if (homeButton) homeButton.href = "index.html";

  window.scrollTo({ top: 0, behavior: "smooth" });

  /* Intentionally no setTimeout, location.href, or reload here. */
}

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

  /*
   * The current known backend accepts tripId, origin, destination, date,
   * passengers, phone, email and notes. fullName is also sent for forward
   * compatibility, but a backend/schema update may be required to persist it.
   */
  const payload = {
    tripId: bookingInfo.tripId,
    origin: bookingInfo.origin,
    destination: bookingInfo.destination,
    date: bookingInfo.date,
    departure: bookingInfo.departure,
    arrival: bookingInfo.arrival,
    departure_time: bookingInfo.departure,
    arrival_time: bookingInfo.arrival,
    passengers: bookingInfo.passengers,
    fullName: contact.fullName,
    phone: contact.phone,
    email: contact.email,
    notes: notesInput ? notesInput.value.trim() : ""
  };

  bookingInProgress = true;
  const originalButtonText = submitButton ? submitButton.textContent : "ยืนยันการจอง";

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
    } catch (parseError) {
      result = {};
    }

    if (response.status === 401) {
      showError("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
      return;
    }

    if (!response.ok) {
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
      showError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่า Backend และ LocalTunnel ยังทำงานอยู่ แล้วลองโหลดหน้าเว็บใหม่");
    } else {
      showError(error.message || "เกิดข้อผิดพลาดในการจอง กรุณาลองอีกครั้ง");
    }
  } finally {
    bookingInProgress = false;

    if (!bookingSucceeded && submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  }
}

document.addEventListener("DOMContentLoaded", function () {
  renderBookingDetails();
  prefillAccount();
  clearError();

  const bookingForm = $("bookingForm");
  if (bookingForm) {
    bookingForm.addEventListener("submit", createBooking);
  }

  const nameInput = $("fullName");
  if (nameInput) {
    nameInput.value = "";
    nameInput.readOnly = false;
    nameInput.disabled = false;
    nameInput.removeAttribute("readonly");
    nameInput.removeAttribute("disabled");
  }
});
