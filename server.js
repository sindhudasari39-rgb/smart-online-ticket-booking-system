/**
 * The Smart Online Ticket Booking System - Backend Server
 * Technology: Node.js (v24+) + Built-in node:sqlite
 * Full dynamic REST API backend with SQLite persistence
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 5000;
const DB_PATH = path.join(__dirname, '..', 'database', 'smart_tickets.db');
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

// Ensure DB exists or init
if (!fs.existsSync(DB_PATH)) {
    console.log('Database file not found, running initialization...');
    const { initDatabase } = require(path.join(__dirname, '..', 'database', 'init-db.js'));
    initDatabase();
}

const db = new DatabaseSync(DB_PATH);

// Helper to parse JSON request body
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', reject);
    });
}

// Helper to send JSON responses
function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(data));
}

// MIME types for static assets
const MIME_TYPES = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.json': 'application/json; charset=UTF-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp'
};

// Serve static frontend files
function serveStatic(req, res, pathname) {
    let safePath = pathname === '/' ? '/index.html' : pathname;
    // Normalize path to prevent directory traversal
    const filePath = path.normalize(path.join(FRONTEND_DIR, safePath));

    if (!filePath.startsWith(FRONTEND_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            // Fallback to index.html for SPA if not found
            const fallbackPath = path.join(FRONTEND_DIR, 'index.html');
            fs.readFile(fallbackPath, (readErr, content) => {
                if (readErr) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('404 Not Found');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
                    res.end(content);
                }
            });
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (readErr, content) => {
            if (readErr) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('500 Internal Server Error');
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            }
        });
    });
}

// The HTTP Server
const server = http.createServer(async (req, res) => {
    // CORS headers for API calls
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const query = Object.fromEntries(parsedUrl.searchParams.entries());

    try {
        // ================= API ROUTES =================

        // 1. Health check
        if (pathname === '/api/health' && req.method === 'GET') {
            return sendJson(res, 200, { status: 'OK', system: 'Smart Online Ticket Booking System', timestamp: new Date() });
        }

        // 2. Get All Slots (with Train & Bus filtering and seat availability)
        if (pathname === '/api/slots' && req.method === 'GET') {
            const typeFilter = query.type; // 'train', 'bus', or all
            const search = query.search ? `%${query.search.toLowerCase()}%` : null;

            let sql = `
                SELECT s.*,
                    (SELECT COUNT(*) FROM seats WHERE slot_id = s.id AND is_booked = 0) as available_seats,
                    (SELECT COUNT(*) FROM seats WHERE slot_id = s.id AND is_booked = 1) as booked_seats
                FROM slots s
                WHERE 1=1
            `;
            const params = [];

            if (typeFilter && (typeFilter === 'train' || typeFilter === 'bus')) {
                sql += ` AND s.type = ?`;
                params.push(typeFilter);
            }

            if (search) {
                sql += ` AND (LOWER(s.title) LIKE ? OR LOWER(s.source) LIKE ? OR LOWER(s.destination) LIKE ? OR LOWER(s.slot_code) LIKE ?)`;
                params.push(search, search, search, search);
            }

            sql += ` ORDER BY s.id ASC`;

            const stmt = db.prepare(sql);
            const slots = stmt.all(...params);

            return sendJson(res, 200, { success: true, count: slots.length, data: slots });
        }

        // 3. Get Specific Slot Details
        const slotMatch = pathname.match(/^\/api\/slots\/(\d+)$/);
        if (slotMatch && req.method === 'GET') {
            const slotId = parseInt(slotMatch[1], 10);
            const stmt = db.prepare(`
                SELECT s.*,
                    (SELECT COUNT(*) FROM seats WHERE slot_id = s.id AND is_booked = 0) as available_seats,
                    (SELECT COUNT(*) FROM seats WHERE slot_id = s.id AND is_booked = 1) as booked_seats
                FROM slots s WHERE s.id = ?
            `);
            const slot = stmt.get(slotId);
            if (!slot) {
                return sendJson(res, 404, { success: false, message: 'Slot not found' });
            }
            return sendJson(res, 200, { success: true, data: slot });
        }

        // 4. Get Seats for a Slot (Green = 0 / available, Red = 1 / purchased, 2 = not available)
        const seatsMatch = pathname.match(/^\/api\/slots\/(\d+)\/seats$/);
        if (seatsMatch && req.method === 'GET') {
            const slotId = parseInt(seatsMatch[1], 10);
            const slotStmt = db.prepare(`SELECT * FROM slots WHERE id = ?`);
            const slot = slotStmt.get(slotId);
            if (!slot) {
                return sendJson(res, 404, { success: false, message: 'Slot not found' });
            }

            const seatsStmt = db.prepare(`
                SELECT id, slot_id, seat_number, seat_type, row_label, col_index, is_booked
                FROM seats
                WHERE slot_id = ?
                ORDER BY row_label ASC, col_index ASC
            `);
            const seats = seatsStmt.all(slotId);

            let timeSlots = ['10:00', '11:30', '2:30', '4:45', '7:20', '11:10'];
            try {
                if (slot.time_slots_json) timeSlots = JSON.parse(slot.time_slots_json);
            } catch (e) {}

            return sendJson(res, 200, {
                success: true,
                slot: {
                    id: slot.id,
                    code: slot.slot_code,
                    title: slot.title,
                    type: slot.type,
                    price: slot.price,
                    source: slot.source,
                    destination: slot.destination,
                    departure: slot.departure_time,
                    arrival: slot.arrival_time,
                    platform: slot.platform_or_bay,
                    ac_type: slot.ac_type,
                    time_slots: timeSlots
                },
                seats: seats
            });
        }

        // 5. User Registration (Updated with Name, Where to Where, Age, Seats Count, AC/Non-AC)
        if (pathname === '/api/auth/register' && req.method === 'POST') {
            const body = await parseBody(req);
            const fullName = (body.name || body.full_name || '').trim();
            const whereFrom = (body.where_from || '').trim();
            const whereTo = (body.where_to || '').trim();
            const age = parseInt(body.age, 10);
            const seatsCount = parseInt(body.seats_count, 10) || 1;
            const acPreference = (body.ac_preference || 'AC').trim();
            const email = (body.email || `${fullName.toLowerCase().replace(/\s+/g, '') || 'user'}@ticket.com`).trim().toLowerCase();
            const phone = (body.phone || '+91 98765 00000').trim();
            const password = body.password || 'pass123';

            // Explicit validation - only trigger if fields are missing as requested
            const missing = [];
            if (!fullName) missing.push('Full Name');
            if (!whereFrom) missing.push('Departure Station (From)');
            if (!whereTo) missing.push('Arrival Station (To)');
            if (!age || isNaN(age)) missing.push('Age');
            if (!seatsCount || isNaN(seatsCount)) missing.push('Number of Seats');
            if (!acPreference) missing.push('AC or Non-AC preference');

            if (missing.length > 0) {
                return sendJson(res, 400, {
                    success: false,
                    message: `Please fill in missing registration fields: ${missing.join(', ')}.`
                });
            }

            // Insert or update existing user
            const existingStmt = db.prepare(`SELECT id FROM users WHERE email = ?`);
            const existing = existingStmt.get(email);
            let userId = null;

            if (existing) {
                userId = existing.id;
                db.prepare(`
                    UPDATE users
                    SET full_name = ?, where_from = ?, where_to = ?, age = ?, seats_count = ?, ac_preference = ?
                    WHERE id = ?
                `).run(fullName, whereFrom, whereTo, age, seatsCount, acPreference, userId);
            } else {
                const insertStmt = db.prepare(`
                    INSERT INTO users (full_name, email, phone, password, where_from, where_to, age, seats_count, ac_preference, travel_preference)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                const result = insertStmt.run(
                    fullName, email, phone, password,
                    whereFrom, whereTo, age, seatsCount, acPreference, 'Train'
                );
                userId = result.lastInsertRowid;
            }

            const newUser = {
                id: userId,
                full_name: fullName,
                email: email,
                phone: phone,
                where_from: whereFrom,
                where_to: whereTo,
                age: age,
                seats_count: seatsCount,
                ac_preference: acPreference
            };

            return sendJson(res, 201, {
                success: true,
                message: `Registration completed successfully for ${newUser.full_name}!`,
                user: newUser
            });
        }

        // 6. User Login
        if (pathname === '/api/auth/login' && req.method === 'POST') {
            const body = await parseBody(req);
            const { email, password } = body;

            if (!email || !password) {
                return sendJson(res, 400, { success: false, message: 'Please enter both email and password.' });
            }

            const userStmt = db.prepare(`SELECT * FROM users WHERE email = ?`);
            const user = userStmt.get(email.trim().toLowerCase());

            if (!user || user.password !== password) {
                return sendJson(res, 401, { success: false, message: 'Invalid email or password credentials.' });
            }

            const safeUser = {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone,
                travel_preference: user.travel_preference
            };

            return sendJson(res, 200, {
                success: true,
                message: `Welcome back, ${safeUser.full_name}!`,
                user: safeUser
            });
        }

        // 7. Create New Booking (Single or Group Booking Mode)
        if (pathname === '/api/bookings' && req.method === 'POST') {
            const body = await parseBody(req);
            const { user_id, slot_id, seats, passengers, is_group, total_amount, discount_amount } = body;

            if (!slot_id || !seats || !Array.isArray(seats) || seats.length === 0) {
                return sendJson(res, 400, { success: false, message: 'Please select at least one seat to book.' });
            }

            // Check if slot exists
            const slotStmt = db.prepare(`SELECT * FROM slots WHERE id = ?`);
            const slot = slotStmt.get(slot_id);
            if (!slot) {
                return sendJson(res, 404, { success: false, message: 'Invalid slot selected.' });
            }

            // Check if any selected seat is already filled (red)
            for (const seatNum of seats) {
                const checkSeat = db.prepare(`SELECT is_booked FROM seats WHERE slot_id = ? AND seat_number = ?`);
                const seatRow = checkSeat.get(slot_id, seatNum);
                if (!seatRow) {
                    return sendJson(res, 400, { success: false, message: `Seat ${seatNum} is invalid.` });
                }
                if (seatRow.is_booked === 1) {
                    return sendJson(res, 409, {
                        success: false,
                        message: `Seat ${seatNum} has just been filled by another passenger! Please select an available green seat.`
                    });
                }
            }

            // Generate Unique PNR / Booking Reference
            const prefix = slot.type === 'train' ? 'STB-TRN' : 'STB-BUS';
            const randomNum = Math.floor(10000 + Math.random() * 90000);
            const bookingRef = `${prefix}-${randomNum}`;

            // Create QR payload
            const primaryPassenger = passengers && passengers[0] ? passengers[0].name : 'Passenger';
            const qrPayload = JSON.stringify({
                ref: bookingRef,
                slot: slot.slot_code,
                mode: slot.type.toUpperCase(),
                seats: seats.join(', '),
                lead: primaryPassenger,
                date: slot.travel_date,
                status: 'CONFIRMED'
            });

            const travelTime = body.travel_time || slot.departure_time;
            const acType = body.ac_type || slot.ac_type || 'AC';

            // Insert Booking
            const insertBooking = db.prepare(`
                INSERT INTO bookings (
                    booking_reference, user_id, slot_id, seats_list, passengers_data,
                    is_group_booking, group_size, total_amount, discount_amount,
                    payment_status, booking_status, ac_type, travel_time, qr_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const bookingResult = insertBooking.run(
                bookingRef,
                user_id || 1,
                slot_id,
                seats.join(', '),
                JSON.stringify(passengers || []),
                is_group ? 1 : 0,
                seats.length,
                total_amount || (seats.length * slot.price),
                discount_amount || 0.0,
                'Paid',
                'Confirmed',
                acType,
                travelTime,
                qrPayload
            );
            const bookingId = bookingResult.lastInsertRowid;

            // Mark seats as filled (1 = Red) in database
            const updateSeat = db.prepare(`
                UPDATE seats
                SET is_booked = 1, booked_by_user_id = ?, booking_id = ?
                WHERE slot_id = ? AND seat_number = ?
            `);
            for (const seatNum of seats) {
                updateSeat.run(user_id || 1, bookingId, slot_id, seatNum);
            }

            return sendJson(res, 201, {
                success: true,
                message: `Booking Confirmed! Reference: ${bookingRef}`,
                booking: {
                    id: bookingId,
                    booking_reference: bookingRef,
                    slot_code: slot.slot_code,
                    slot_title: slot.title,
                    type: slot.type,
                    source: slot.source,
                    destination: slot.destination,
                    departure_time: slot.departure_time,
                    arrival_time: slot.arrival_time,
                    platform: slot.platform_or_bay,
                    seats: seats,
                    seats_list: seats.join(', '),
                    passengers: passengers || [],
                    is_group_booking: is_group ? 1 : 0,
                    group_size: seats.length,
                    total_amount: total_amount || (seats.length * slot.price),
                    status: 'Confirmed',
                    ac_type: acType,
                    travel_time: travelTime,
                    qr_data: qrPayload,
                    created_at: new Date().toISOString()
                }
            });
        }

        // 8. Get Bookings for a User (Booking Dashboard)
        const userBookingsMatch = pathname.match(/^\/api\/users\/(\d+)\/bookings$/);
        if (userBookingsMatch && req.method === 'GET') {
            const userId = parseInt(userBookingsMatch[1], 10);
            const stmt = db.prepare(`
                SELECT b.*,
                    s.slot_code, s.title as slot_title, s.type, s.source, s.destination,
                    s.departure_time, s.arrival_time, s.platform_or_bay, s.travel_date
                FROM bookings b
                JOIN slots s ON b.slot_id = s.id
                WHERE b.user_id = ?
                ORDER BY b.id DESC
            `);
            const bookings = stmt.all(userId);

            return sendJson(res, 200, { success: true, count: bookings.length, data: bookings });
        }

        // 9. Cancel a Booking (Releases seats back to Green)
        const cancelMatch = pathname.match(/^\/api\/bookings\/(\d+)\/cancel$/);
        if (cancelMatch && req.method === 'POST') {
            const bookingId = parseInt(cancelMatch[1], 10);
            const bookingStmt = db.prepare(`SELECT * FROM bookings WHERE id = ?`);
            const booking = bookingStmt.get(bookingId);

            if (!booking) {
                return sendJson(res, 404, { success: false, message: 'Booking not found.' });
            }

            if (booking.booking_status === 'Cancelled') {
                return sendJson(res, 400, { success: false, message: 'This booking is already cancelled.' });
            }

            // Update booking status
            db.prepare(`UPDATE bookings SET booking_status = 'Cancelled' WHERE id = ?`).run(bookingId);

            // Release seats back to available (0 = Green)
            db.prepare(`
                UPDATE seats
                SET is_booked = 0, booked_by_user_id = NULL, booking_id = NULL
                WHERE booking_id = ?
            `).run(bookingId);

            return sendJson(res, 200, {
                success: true,
                message: `Booking #${booking.booking_reference} cancelled successfully. Seats have been released.`,
                booking_reference: booking.booking_reference
            });
        }

        // 10. Digital Ticket Scanner / Verifier API
        const verifyMatch = pathname.match(/^\/api\/tickets\/verify\/([^/]+)$/);
        if (verifyMatch && req.method === 'GET') {
            const rawRef = decodeURIComponent(verifyMatch[1]).trim();
            // Allow looking up by exact booking_reference or parsed code
            const cleanRef = rawRef.includes('STB-') ? (rawRef.match(/STB-[A-Z]+-\d+/) || [rawRef])[0] : rawRef;

            const stmt = db.prepare(`
                SELECT b.*,
                    s.slot_code, s.title as slot_title, s.type, s.source, s.destination,
                    s.departure_time, s.arrival_time, s.platform_or_bay, s.travel_date,
                    u.full_name as user_name, u.email as user_email, u.phone as user_phone
                FROM bookings b
                JOIN slots s ON b.slot_id = s.id
                LEFT JOIN users u ON b.user_id = u.id
                WHERE b.booking_reference = ?
            `);
            const ticket = stmt.get(cleanRef);

            if (!ticket) {
                return sendJson(res, 404, {
                    success: false,
                    verified: false,
                    message: `Invalid or Fake Ticket! Reference "${cleanRef}" not found in database.`
                });
            }

            return sendJson(res, 200, {
                success: true,
                verified: true,
                status: ticket.booking_status,
                message: `Ticket Verified! Valid boarding pass for ${ticket.seats_list}.`,
                ticket: {
                    reference: ticket.booking_reference,
                    mode: ticket.type.toUpperCase(),
                    slot_code: ticket.slot_code,
                    title: ticket.slot_title,
                    source: ticket.source,
                    destination: ticket.destination,
                    departure: ticket.departure_time,
                    arrival: ticket.arrival_time,
                    platform: ticket.platform_or_bay,
                    travel_date: ticket.travel_date,
                    seats: ticket.seats_list,
                    passengers: JSON.parse(ticket.passengers_data || '[]'),
                    lead_passenger: ticket.user_name || 'Passenger',
                    is_group: ticket.is_group_booking === 1,
                    total_amount: ticket.total_amount,
                    status: ticket.booking_status,
                    created_at: ticket.created_at
                }
            });
        }

        // 11. Availability Alerts Subscription
        if (pathname === '/api/alerts' && req.method === 'POST') {
            const body = await parseBody(req);
            const { slot_id, email, phone } = body;

            if (!slot_id || !email) {
                return sendJson(res, 400, { success: false, message: 'Slot ID and email are required for alerts.' });
            }

            const slotStmt = db.prepare(`SELECT title FROM slots WHERE id = ?`);
            const slot = slotStmt.get(slot_id);
            if (!slot) {
                return sendJson(res, 404, { success: false, message: 'Slot not found.' });
            }

            const insertAlert = db.prepare(`
                INSERT INTO alerts (slot_id, user_email, user_phone)
                VALUES (?, ?, ?)
            `);
            insertAlert.run(slot_id, email.trim(), phone ? phone.trim() : '');

            return sendJson(res, 201, {
                success: true,
                message: `Availability alert activated for ${slot.title}! You will be notified instantly when seats open up.`,
                slot: slot.title
            });
        }

        // 12. Simulate Live Alert Trigger / Seat Release (For Demo & User Testing)
        const triggerMatch = pathname.match(/^\/api\/alerts\/simulate-trigger\/(\d+)$/);
        if (triggerMatch && req.method === 'POST') {
            const slotId = parseInt(triggerMatch[1], 10);
            // Release one booked seat to simulate opening
            const bookedSeat = db.prepare(`SELECT id, seat_number FROM seats WHERE slot_id = ? AND is_booked = 1 LIMIT 1`).get(slotId);

            if (bookedSeat) {
                db.prepare(`UPDATE seats SET is_booked = 0, booked_by_user_id = NULL, booking_id = NULL WHERE id = ?`).run(bookedSeat.id);
                return sendJson(res, 200, {
                    success: true,
                    seat_opened: bookedSeat.seat_number,
                    message: `ALERT TRIGGERED: Seat ${bookedSeat.seat_number} just opened up! It is now available (Green) for booking.`
                });
            } else {
                return sendJson(res, 200, {
                    success: true,
                    message: `All seats in this slot are already available (Green)!`
                });
            }
        }

        // ================= STATIC ASSET HANDLING =================
        serveStatic(req, res, pathname);

    } catch (error) {
        console.error('Server error on', req.method, pathname, error);
        return sendJson(res, 500, { success: false, message: 'Internal server error: ' + error.message });
    }
});

// Start the server if executed directly
if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`\n======================================================`);
        console.log(`🚀 The Smart Online Ticket Booking System is LIVE!`);
        console.log(`🌐 Local URL: http://localhost:${PORT}`);
        console.log(`📁 Frontend:  ${FRONTEND_DIR}`);
        console.log(`💾 Database:  ${DB_PATH}`);
        console.log(`======================================================\n`);
    });
}

module.exports = server;

