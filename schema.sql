-- Smart Online Ticket Booking System - SQLite Database Schema
-- Updated with registration fields (where_from, where_to, age, seats_count, ac_preference)

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    password TEXT,
    where_from TEXT,
    where_to TEXT,
    age INTEGER,
    seats_count INTEGER DEFAULT 1,
    ac_preference TEXT DEFAULT 'AC',
    travel_preference TEXT DEFAULT 'Train',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_code TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('train', 'bus')),
    title TEXT NOT NULL,
    operator TEXT NOT NULL,
    source TEXT NOT NULL,
    destination TEXT NOT NULL,
    departure_time TEXT NOT NULL,
    arrival_time TEXT NOT NULL,
    duration TEXT NOT NULL,
    travel_date TEXT NOT NULL,
    platform_or_bay TEXT NOT NULL,
    price REAL NOT NULL,
    total_seats INTEGER NOT NULL,
    status TEXT DEFAULT 'Available',
    ac_type TEXT DEFAULT 'AC',
    time_slots_json TEXT DEFAULT '["10:00","11:30","2:30","4:45","7:20","11:10"]'
);

CREATE TABLE IF NOT EXISTS seats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_id INTEGER NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
    seat_number TEXT NOT NULL,
    seat_type TEXT DEFAULT 'Window',
    row_label TEXT NOT NULL,
    col_index INTEGER NOT NULL,
    is_booked INTEGER DEFAULT 0,
    booked_by_user_id INTEGER,
    booking_id INTEGER
);

CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_reference TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    slot_id INTEGER NOT NULL REFERENCES slots(id),
    seats_list TEXT NOT NULL,
    passengers_data TEXT NOT NULL,
    is_group_booking INTEGER DEFAULT 0,
    group_size INTEGER DEFAULT 1,
    total_amount REAL NOT NULL,
    discount_amount REAL DEFAULT 0.0,
    payment_status TEXT DEFAULT 'Paid',
    booking_status TEXT DEFAULT 'Confirmed',
    ac_type TEXT DEFAULT 'AC',
    travel_time TEXT DEFAULT '4:45 PM',
    qr_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_id INTEGER NOT NULL REFERENCES slots(id),
    user_email TEXT NOT NULL,
    user_phone TEXT NOT NULL,
    alert_type TEXT DEFAULT 'Seat Availability',
    status TEXT DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
