# 🚆 The Smart Online Ticket Booking System

A full-stack, real-time ticket booking platform for **Trains & Buses**, built with a clean separation of concerns:
- `frontend/` (Modern glassmorphic responsive UI, real-time green/red seat matrix, dynamic QR boarding pass, live conductor scanner)
- `backend/` (Node.js REST API server, transaction-safe booking engine, live QR verification endpoint)
- `database/` (SQLite database with automated schema creation, seed slots, seat layouts, bookings, and alerts)

---

## 🌟 Key Features

1. **Hero Section with Train Backdrop**:
   - Uses the uploaded high-speed train visual with glowing branding: **The Smart Online Ticket Booking System**.
   - Instant search bar with Origin, Destination, and Travel Mode filter.
2. **Train & Bus Travel Slots**:
   - Filter between **🚆 Train Slots** and **🚌 Bus Slots**.
   - Real-time seat counters on every card showing green (available) vs red (filled) seats.
3. **Interactive Seat Selection for Every Slot**:
   - **🟢 Green Seats**: Available (not filled) — click to select.
   - **🔴 Red Seats**: Filled / Booked — clicking shows an interactive warning popup message.
   - **🔵 Blue Highlight**: Your active selection.
4. **Group Booking Mode**:
   - Friends select seats together.
   - Choose group size (2 to 6 passengers).
   - **✨ Auto-Select Together**: Automatically locates consecutive green seats side-by-side in the same coach!
   - Assign individual passenger/friend names to each seat.
   - Automatic 10% group discount.
5. **Universal POP Message Engine**:
   - Interactive pop-up toasts with synthesized audio chime for *every* user interaction:
     - Seat selected & deselected
     - Filled seat clicked warning
     - Group mode activation
     - Filter applied
     - Registration & login
     - Booking confirmation celebration
     - Ticket verification status
6. **Instant Booking Celebration Pop Modal**:
   - Once booked, an animated celebration modal appears displaying PNR, reserved seats, and instant links to view the digital ticket or visit the dashboard.
7. **Digital Boarding Pass with Scannable QR Code & Barcode**:
   - Client-side zero-dependency SVG QR code generator embedded on each ticket.
   - Displays PNR, passenger names, seats, route, platform/bay, and travel date.
   - Print / Save as PDF capability.
8. **Live Conductor Scanner & Verifier**:
   - Integrated optical viewfinder simulation.
   - Live real-time verification against the backend SQLite database via `/api/tickets/verify/:pnr`.
9. **Booking Dashboard ("Booking Dash")**:
   - Real-time travel statistics: Total bookings, active trips, group trips, and total amount spent.
   - View, scan, or cancel existing reservations (canceling automatically releases seats back to green!).
10. **Availability Alerts**:
    - Sign up for instant notifications when sold-out seats open up.
    - Test alert simulation button that dynamically releases seats in the database.
11. **No Python & No Static**:
    - 100% JavaScript / Node.js.
    - Real dynamic REST API and database persistence.

---

## 📂 Project Structure

```
smart-ticket-booking-system/
├── frontend/                     # Frontend UI layer
│   ├── index.html                # Main application portal
│   ├── css/
│   │   └── style.css             # Glassmorphic dark UI styling
│   ├── js/
│   │   ├── app.js                # Core frontend logic & popups
│   │   └── qr.js                 # Zero-dependency QR Code generator
│   └── assets/
│       └── hero-train.jpg        # Hero train visual
├── backend/                      # Backend API server
│   ├── server.js                 # Node.js dynamic HTTP REST API server
│   └── package.json              # Backend package configuration
├── database/                     # Database persistence layer
│   ├── schema.sql                # SQLite schema (users, slots, seats, bookings, alerts)
│   ├── init-db.js                # Database initializer & seeder
│   └── smart_tickets.db          # SQLite database file
├── package.json                  # Root npm configuration
├── start.bat                     # One-click Windows runner
└── README.md                     # Documentation
```

---

## 🚀 How to Run

### Method 1: One-Click (Windows)
Double-click `start.bat` in the project root directory.

### Method 2: Command Line
```powershell
# 1. Initialize the database
node database/init-db.js

# 2. Start the server
node backend/server.js
```

Open your browser at:
👉 **`http://localhost:5000`**

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/slots` | Fetch all slots with filter (`?type=train\|bus`) |
| `GET` | `/api/slots/:id/seats` | Fetch green/red seat matrix for slot |
| `POST` | `/api/auth/register` | Register new passenger account |
| `POST` | `/api/auth/login` | Passenger sign in |
| `POST` | `/api/bookings` | Reserve seats and generate ticket |
| `GET` | `/api/users/:id/bookings` | Fetch user's booking history |
| `POST` | `/api/bookings/:id/cancel` | Cancel booking & release seats back to green |
| `GET` | `/api/tickets/verify/:pnr` | Live QR verification against database |
| `POST` | `/api/alerts` | Subscribe for availability alerts |
| `POST` | `/api/alerts/simulate-trigger/:slotId` | Test trigger seat release alert |
