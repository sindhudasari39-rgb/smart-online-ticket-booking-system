/**
 * Smart Online Ticket Booking System - Database Initializer & Seeder
 * Updated with exact trains:
 * - Venkatadri Express
 * - Vande Bharat Express
 * - Guntur Passenger
 * Plus Rows A, B, C, D, E layout matching Pic 1
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'smart_tickets.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

function initDatabase() {
    console.log('⚡ Initializing Database at:', DB_PATH);
    
    // Remove old DB to guarantee clean schema migration
    if (fs.existsSync(DB_PATH)) {
        try {
            fs.unlinkSync(DB_PATH);
        } catch (e) {
            console.log('Notice: Could not unlink existing db directly, continuing...');
        }
    }

    const db = new DatabaseSync(DB_PATH);

    // Read and run schema.sql
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schemaSql);
    console.log('✅ Schema tables verified.');

    // Seed Sample User
    const insertUser = db.prepare(`
        INSERT INTO users (full_name, email, phone, password, where_from, where_to, age, seats_count, ac_preference, travel_preference)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertUser.run(
        'D. Sindhura',
        'sindhura@example.com',
        '+91 98765 43210',
        'password123',
        'Secunderabad',
        'Tirupati',
        23,
        2,
        'AC',
        'Train'
    );

    // Train & Bus Slots including Venkatadri Express, Vande Bharat Express, Guntur Passenger
    const sampleSlots = [
        {
            code: 'TRN-101',
            type: 'train',
            title: 'Venkatadri Express',
            operator: 'South Central Railway',
            source: 'Kacheguda (Hyderabad)',
            destination: 'Tirupati Main Junction',
            departure_time: '04:45 PM',
            arrival_time: '06:05 AM (Next Day)',
            duration: '13h 20m',
            travel_date: 'THU 17 DEC',
            platform: 'Platform 4',
            price: 520.00,
            total_seats: 50,
            status: 'Available',
            ac_type: 'AC 3-Tier',
            time_slots: JSON.stringify(['10:00', '11:30', '2:30', '4:45', '7:20', '11:10']),
            // Matching Pic 1 seat pattern
            purchased_seats: ['A7', 'A8', 'E5', 'E6', 'E7', 'E8', 'E9'],
            not_available_seats: ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'D1', 'D2', 'D3', 'D4', 'D7', 'D8', 'D9', 'D10', 'E1', 'E2', 'E3', 'E4', 'E10']
        },
        {
            code: 'TRN-102',
            type: 'train',
            title: 'Vande Bharat Express',
            operator: 'Indian Railways Highspeed',
            source: 'Secunderabad Junction',
            destination: 'Visakhapatnam Port',
            departure_time: '03:00 PM',
            arrival_time: '11:30 PM',
            duration: '8h 30m',
            travel_date: 'THU 17 DEC',
            platform: 'Platform 1',
            price: 890.00,
            total_seats: 50,
            status: 'Available',
            ac_type: 'AC Executive Chair',
            time_slots: JSON.stringify(['06:00', '09:15', '03:00', '05:45', '08:30']),
            purchased_seats: ['A6', 'B5', 'C6', 'E4', 'E5'],
            not_available_seats: ['A1', 'A2', 'B1', 'C1', 'D1', 'E1']
        },
        {
            code: 'TRN-103',
            type: 'train',
            title: 'Guntur Passenger',
            operator: 'South Central Intercity',
            source: 'Secunderabad Junction',
            destination: 'Guntur Junction',
            departure_time: '07:20 AM',
            arrival_time: '01:45 PM',
            duration: '6h 25m',
            travel_date: 'THU 17 DEC',
            platform: 'Platform 2',
            price: 240.00,
            total_seats: 50,
            status: 'Available',
            ac_type: 'Non-AC Express',
            time_slots: JSON.stringify(['07:20', '10:45', '01:15', '04:30', '07:00']),
            purchased_seats: ['A3', 'A4', 'B4', 'B5', 'D5', 'D6'],
            not_available_seats: ['C1', 'C2', 'C9', 'C10']
        },
        {
            code: 'BUS-201',
            type: 'bus',
            title: 'Volvo 9600 AC Multi-Axle',
            operator: 'Garuda Plus Express',
            source: 'MGBS Hyderabad',
            destination: 'Vijayawada Bus Station',
            departure_time: '11:30 AM',
            arrival_time: '05:00 PM',
            duration: '5h 30m',
            travel_date: 'THU 17 DEC',
            platform: 'Bay 12',
            price: 450.00,
            total_seats: 50,
            status: 'Available',
            ac_type: 'AC Luxury Sleeper',
            time_slots: JSON.stringify(['06:30', '09:00', '11:30', '02:00', '06:15', '10:30']),
            purchased_seats: ['A2', 'B2', 'D2', 'E2'],
            not_available_seats: ['C1', 'C2', 'C3', 'C4']
        },
        {
            code: 'BUS-202',
            type: 'bus',
            title: 'Scania Dreamliner AC Sleeper',
            operator: 'Orange Travels AC',
            source: 'Hyderabad Central',
            destination: 'Bengaluru Majestic',
            departure_time: '10:00 PM',
            arrival_time: '06:30 AM',
            duration: '8h 30m',
            travel_date: 'THU 17 DEC',
            platform: 'Bay 4',
            price: 680.00,
            total_seats: 50,
            status: 'Available',
            ac_type: 'AC Sleeper',
            time_slots: JSON.stringify(['08:00', '09:30', '10:00', '11:15']),
            purchased_seats: ['A5', 'A6', 'E6', 'E7'],
            not_available_seats: ['C1', 'C2', 'C3']
        }
    ];

    const insertSlot = db.prepare(`
        INSERT INTO slots (
            slot_code, type, title, operator, source, destination,
            departure_time, arrival_time, duration, travel_date, platform_or_bay,
            price, total_seats, status, ac_type, time_slots_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertSeat = db.prepare(`
        INSERT INTO seats (
            slot_id, seat_number, seat_type, row_label, col_index, is_booked
        ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Rows matching Pic 1: A, B, C (aisle gap), D, E with 10 columns each
    const rows = ['A', 'B', 'C', 'D', 'E'];

    for (const slot of sampleSlots) {
        const res = insertSlot.run(
            slot.code, slot.type, slot.title, slot.operator,
            slot.source, slot.destination, slot.departure_time, slot.arrival_time,
            slot.duration, slot.travel_date, slot.platform, slot.price,
            slot.total_seats, slot.status, slot.ac_type, slot.time_slots
        );
        const slotId = res.lastInsertRowid;

        for (const row of rows) {
            for (let col = 1; col <= 10; col++) {
                const seatNum = `${row}${col}`;
                let isBooked = 0; // 0 = Available (Green)

                if (slot.purchased_seats.includes(seatNum)) {
                    isBooked = 1; // 1 = Purchased (Coral/Red)
                } else if (slot.not_available_seats.includes(seatNum)) {
                    isBooked = 2; // 2 = Not Available (Dark circle)
                }

                const seatType = (row === 'A' || row === 'E') ? 'Window' : 'Standard';
                insertSeat.run(slotId, seatNum, seatType, row, col, isBooked);
            }
        }
    }

    // Insert Sample Initial Bookings matching Pic 2 and Pic 3
    const insertBooking = db.prepare(`
        INSERT INTO bookings (
            booking_reference, user_id, slot_id, seats_list, passengers_data,
            is_group_booking, group_size, total_amount, discount_amount,
            payment_status, booking_status, ac_type, travel_time, qr_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertBooking.run(
        'STB-TRN-78192',
        1,
        1, // Venkatadri Express
        'B5, B6',
        JSON.stringify([
            { seat: 'B5', name: 'D. Sindhura' },
            { seat: 'B6', name: 'Friend' }
        ]),
        1,
        2,
        936.00,
        104.00,
        'Paid',
        'Confirmed',
        'AC 3-Tier',
        '4:45 PM',
        'STB-TRN-78192|Venkatadri Express|B5, B6|Confirmed'
    );

    insertBooking.run(
        'STB-TRN-44210',
        1,
        2, // Vande Bharat Express
        'A5, B5',
        JSON.stringify([
            { seat: 'A5', name: 'D. Sindhura' },
            { seat: 'B5', name: 'Traveler' }
        ]),
        0,
        2,
        1780.00,
        0.0,
        'Paid',
        'Confirmed',
        'AC Executive Chair',
        '3:00 PM',
        'STB-TRN-44210|Vande Bharat Express|A5, B5|Confirmed'
    );

    console.log('✅ Initial database with Venkatadri, Vande Bharat, and Guntur Passenger seeded successfully.');
    db.close();
}

if (require.main === module) {
    initDatabase();
}

module.exports = { initDatabase, DB_PATH };
