
"use strict";

const API_BASE = "http://127.0.0.1:3000/api";

const form = document.getElementById("srSearchForm");
const originSelect = document.getElementById("srOrigin");
const destinationSelect = document.getElementById("srDestination");
const dateInput = document.getElementById("srTravelDate");
const passengersSelect = document.getElementById("srPassengers");
const searchButton = document.getElementById("srSearchButton");
const errorBox = document.getElementById("srSearchError");
const tripList = document.getElementById("srTripList");
const resultCount = document.getElementById("srResultCount");
const emptyState = document.getElementById("srEmptyState");
const resultsSection = document.getElementById("srResults");

let allTrips = [];
let hasSearched = false;
let requestNumber = 0;

function localDateString() {
    const now = new Date();

    return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")
    ].join("-");
}

function setError(message) {
    errorBox.textContent = message;
    errorBox.hidden = !message;
}

function textElement(tag, className, value) {
    const element = document.createElement(tag);

    if (className) element.className = className;

    element.textContent = String(value ?? "");

    return element;
}

function formatDate(value) {
    if (!value) return "-";

    const parts = value.split("-");

    if (parts.length !== 3) return value;

    const date = new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2])
    );

    return date.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

// แปลงชื่อฟิลด์จาก Backend ให้เป็นรูปแบบเดียวกัน
function normalizeTrip(trip) {
    return {
        tripId: String(trip.tripId ?? ""),
        origin: String(trip.origin ?? ""),
        destination: String(trip.destination ?? ""),
        departure: String(trip.departure ?? ""),
        arrival: String(trip.arrival ?? ""),
        price: Number(trip.price),
        availableSeats: Number(trip.availableSeats),
        capacity: Number(trip.capacity ?? 0),
        bookedSeats: Number(trip.bookedSeats ?? 0)
    };
}

function makeBookingUrl(trip) {
    const params = new URLSearchParams({
        tripId: trip.tripId,
        origin: trip.origin,
        destination: trip.destination,
        date: dateInput.value,
        departure: trip.departure,
        arrival: trip.arrival,
        passengers: passengersSelect.value,
        price: String(trip.price)
    });

    return `booking.html?${params.toString()}`;
}

function makeTripCard(trip) {
    const card = document.createElement("article");
    card.className = "trip-card";

    const left = document.createElement("div");
    left.className = "trip-left";

    const top = document.createElement("div");
    top.className = "trip-top";

    top.appendChild(
        textElement("span", "trip-id", trip.tripId)
    );

    top.appendChild(
        textElement("span", "trip-tag", "เที่ยวรถโดยสาร")
    );

    const route = document.createElement("h3");
    route.className = "trip-route";

    route.append(
        textElement("span", "", trip.origin),
        textElement("span", "route-arrow", "→"),
        textElement("span", "", trip.destination)
    );

    const meta = document.createElement("div");
    meta.className = "trip-meta";

    meta.append(
        textElement("span", "", `ออกเดินทาง ${trip.departure} น.`),
        textElement("span", "", `ถึงปลายทาง ${trip.arrival} น.`),
        textElement("span", "", `วันที่ ${formatDate(dateInput.value)}`),
        textElement("span", "", `ที่นั่งว่าง ${trip.availableSeats} ที่นั่ง`)
    );

    left.append(top, route, meta);

    const right = document.createElement("div");
    right.className = "trip-right";

    const priceBlock = document.createElement("div");

    priceBlock.append(
        textElement("span", "price-caption", "ราคาต่อคน"),
        textElement(
            "div",
            "trip-price",
            `฿${trip.price.toLocaleString("th-TH")}`
        ),
        textElement(
            "span",
            "price-unit",
            `รวม ${passengersSelect.value} คน: ฿${(
                trip.price * Number(passengersSelect.value)
            ).toLocaleString("th-TH")}`
        )
    );

    const bookButton = document.createElement("button");

    bookButton.type = "button";
    bookButton.className = "book-button";

    const passengers = Number(passengersSelect.value);

    if (
        !Number.isFinite(trip.price) ||
        trip.price < 0 ||
        !Number.isFinite(trip.availableSeats) ||
        trip.availableSeats < passengers
    ) {
        bookButton.disabled = true;
        bookButton.textContent = "ที่นั่งไม่เพียงพอ";
    } else {
        bookButton.textContent = "จองเที่ยวนี้";

        bookButton.addEventListener("click", () => {
            window.location.href = makeBookingUrl(trip);
        });
    }

    right.append(priceBlock, bookButton);
    card.append(left, right);

    return card;
}

function renderTrips(trips) {
    tripList.replaceChildren();

    trips.forEach(trip => {
        tripList.appendChild(makeTripCard(trip));
    });

    emptyState.hidden = trips.length !== 0;

    resultCount.textContent = hasSearched
        ? `พบ ${trips.length} เที่ยวรถ`
        : `เที่ยวรถ ${trips.length} รายการ`;
}

function filterTrips() {
    const origin = originSelect.value;
    const destination = destinationSelect.value;

    const filtered = allTrips.filter(trip => {
        const matchesOrigin = trip.origin === origin;

        const matchesDestination =
            !destination || trip.destination === destination;

        return matchesOrigin && matchesDestination;
    });

    renderTrips(filtered);
}

async function loadTrips() {
    const currentRequest = ++requestNumber;

    setError("");

    searchButton.disabled = true;
    searchButton.textContent = "กำลังโหลด...";
    resultCount.textContent = "กำลังโหลดเที่ยวรถ...";

    tripList.replaceChildren();
    emptyState.hidden = true;

    try {
        const params = new URLSearchParams({
            date: dateInput.value
        });

        const response = await fetch(
            `${API_BASE}/trips?${params.toString()}`
        );

        const data = await response.json();

        if (!response.ok || data.success !== true) {
            throw new Error(
                data.message ||
                `HTTP ${response.status}`
            );
        }

        if (!Array.isArray(data.trips)) {
            throw new Error("ข้อมูลเที่ยวรถไม่ถูกต้อง");
        }

        if (currentRequest !== requestNumber) return;

        allTrips = data.trips
            .map(normalizeTrip)
            .filter(trip =>
                trip.tripId &&
                trip.origin &&
                trip.destination &&
                trip.departure &&
                trip.arrival &&
                Number.isFinite(trip.price) &&
                Number.isFinite(trip.availableSeats)
            );

        hasSearched = true;

        filterTrips();

    } catch (error) {
        if (currentRequest !== requestNumber) return;

        console.error("Load trips error:", error);

        allTrips = [];

        tripList.replaceChildren();
        emptyState.hidden = true;

        resultCount.textContent = "โหลดข้อมูลไม่สำเร็จ";

        setError(
            `ไม่สามารถโหลดเที่ยวรถได้: ${error.message}`
        );

    } finally {
        if (currentRequest === requestNumber) {
            searchButton.disabled = false;
            searchButton.textContent = "ค้นหาเที่ยวรถ";
        }
    }
}

form.addEventListener("submit", async event => {
    event.preventDefault();

    setError("");

    if (!dateInput.value) {
        setError("กรุณาเลือกวันที่เดินทาง");
        dateInput.focus();
        return;
    }

    if (dateInput.value < localDateString()) {
        setError("วันที่เดินทางต้องไม่เป็นวันที่ผ่านมาแล้ว");
        dateInput.focus();
        return;
    }

    const passengers = Number(passengersSelect.value);

    if (
        !Number.isInteger(passengers) ||
        passengers < 1 ||
        passengers > 6
    ) {
        setError("กรุณาเลือกจำนวนผู้โดยสารให้ถูกต้อง");
        passengersSelect.focus();
        return;
    }

    hasSearched = true;

    await loadTrips();

    resultsSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});

dateInput.addEventListener("change", () => {
    if (!dateInput.value || dateInput.value < localDateString()) {
        setError("กรุณาเลือกวันที่ตั้งแต่วันนี้เป็นต้นไป");
        return;
    }

    setError("");

    if (hasSearched) {
        loadTrips();
    }
});

originSelect.addEventListener("change", filterTrips);
destinationSelect.addEventListener("change", filterTrips);
passengersSelect.addEventListener("change", filterTrips);

dateInput.min = localDateString();
dateInput.value = localDateString();

// โหลดเที่ยวรถจาก Backend เมื่อเปิดหน้า
loadTrips();
