
"use strict";

// =============================================
// SmartTransit - Frontend Demo
// ข้อมูลเที่ยวรถจำลอง ยังไม่ได้เชื่อมต่อ Backend
// =============================================

const trips = [
    {
        id: "ST001",
        departure: "08:00",
        arrival: "11:00",
        price: 220,
        seats: 8
    },
    {
        id: "ST002",
        departure: "10:30",
        arrival: "13:15",
        price: 280,
        seats: 5
    },
    {
        id: "ST003",
        departure: "14:00",
        arrival: "17:10",
        price: 200,
        seats: 11
    }
];

// =============================================
// 1. เชื่อมต่อองค์ประกอบ HTML
// =============================================

const searchForm = document.getElementById("searchForm");
const originInput = document.getElementById("origin");
const destinationInput = document.getElementById("destination");
const travelDateInput = document.getElementById("travelDate");
const passengersInput = document.getElementById("passengers");
const tripList = document.getElementById("tripList");
const searchMessage = document.getElementById("searchMessage");

// =============================================
// 2. ตรวจสอบว่า HTML มีองค์ประกอบครบหรือไม่
// =============================================

if (
    !searchForm ||
    !originInput ||
    !destinationInput ||
    !travelDateInput ||
    !passengersInput ||
    !tripList ||
    !searchMessage
) {
    console.error(
        "SmartTransit: ไม่พบองค์ประกอบ HTML ที่จำเป็น กรุณาตรวจสอบ index.html"
    );
} else {
    initializeApp();
}

// =============================================
// 3. เริ่มต้นระบบ
// =============================================

function initializeApp() {
    const today = getLocalDate();

    travelDateInput.value = today;
    travelDateInput.min = today;

    searchForm.addEventListener("submit", handleSearch);

    console.log("SmartTransit Frontend พร้อมใช้งาน");
}

// วันที่ปัจจุบันตามเวลาท้องถิ่น
function getLocalDate() {
    const now = new Date();
    const localDate = new Date(
        now.getTime() - now.getTimezoneOffset() * 60000
    );

    return localDate.toISOString().slice(0, 10);
}

// =============================================
// 4. แสดงข้อความแจ้งเตือนบนหน้าเว็บ
// =============================================

function showMessage(message, type = "info") {
    searchMessage.textContent = message;
    searchMessage.className = `message ${type}`;
}

// =============================================
// 5. จัดการการค้นหาเที่ยวรถ
// =============================================

function handleSearch(event) {
    event.preventDefault();

    const origin = originInput.value;
    const destination = destinationInput.value;
    const date = travelDateInput.value;
    const passengers = Number(passengersInput.value);

    showMessage("");

    // ตรวจสอบต้นทางและปลายทาง
    if (origin === destination) {
        tripList.replaceChildren();
        showMessage(
            "กรุณาเลือกต้นทางและปลายทางให้แตกต่างกัน",
            "error"
        );
        return;
    }

    // ตรวจสอบวันที่
    if (!date || date < getLocalDate()) {
        tripList.replaceChildren();
        showMessage(
            "กรุณาเลือกวันที่เดินทางตั้งแต่วันนี้เป็นต้นไป",
            "error"
        );
        return;
    }

    // ตรวจสอบจำนวนผู้โดยสาร
    if (!Number.isInteger(passengers) || passengers < 1) {
        tripList.replaceChildren();
        showMessage(
            "กรุณาเลือกจำนวนผู้โดยสารให้ถูกต้อง",
            "error"
        );
        return;
    }

    // แสดงเที่ยวรถตัวอย่าง
    displayTrips(origin, destination, date, passengers);

    showMessage(
        `พบเที่ยวรถตัวอย่าง ${trips.length} รายการ`,
        "success"
    );
}

// =============================================
// 6. สร้างการ์ดเที่ยวรถ
// =============================================

function displayTrips(origin, destination, date, passengers) {
    tripList.replaceChildren();

    trips.forEach(function (trip) {
        const card = document.createElement("article");
        card.className = "trip-card";

        // ข้อมูลเที่ยวรถ
        const info = document.createElement("div");
        info.className = "trip-info";

        const title = document.createElement("h3");
        title.textContent = `เที่ยวรถ ${trip.id}`;

        const route = document.createElement("p");
        route.textContent = `${origin} → ${destination}`;

        const time = document.createElement("p");
        time.textContent =
            `เวลาออก ${trip.departure} น. · ถึง ${trip.arrival} น.`;

        const travelDate = document.createElement("p");
        travelDate.textContent = `วันที่เดินทาง ${date}`;

        const seats = document.createElement("p");
        seats.textContent = `ที่นั่งว่าง ${trip.seats} ที่`;

        info.append(
            title,
            route,
            time,
            travelDate,
            seats
        );

        // ราคาและปุ่มเลือกเที่ยวรถ
        const action = document.createElement("div");
        action.className = "trip-action";

        const price = document.createElement("div");
        price.className = "trip-price";
        price.textContent =
            `฿${trip.price.toLocaleString("th-TH")}`;

        const priceNote = document.createElement("p");
        priceNote.textContent = "ราคาต่อคน";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "primary-button";
        button.textContent = "เลือกเที่ยวรถ";

        // เมื่อกดเลือกเที่ยวรถ
        button.addEventListener("click", function () {
            if (trip.seats < passengers) {
                alert("ขออภัย ที่นั่งว่างไม่เพียงพอ");
                return;
            }

            // ส่งข้อมูลไปหน้า booking.html
            const params = new URLSearchParams({
                tripId: trip.id,
                origin: origin,
                destination: destination,
                date: date,
                departure: trip.departure,
                arrival: trip.arrival,
                passengers: String(passengers),
                price: String(trip.price)
            });

            window.location.href =
                `booking.html?${params.toString()}`;
        });

        action.append(
            price,
            priceNote,
            button
        );

        card.append(info, action);
        tripList.appendChild(card);
    });
}
