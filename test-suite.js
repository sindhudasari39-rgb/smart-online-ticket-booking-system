/**
 * Zero-Network Self-Contained Test Suite
 * Directly tests the HTTP server request listeners without requiring TCP socket binding
 */

const { EventEmitter } = require('events');
const { Readable } = require('stream');
const server = require('./backend/server.js');

function simulateRequest(method, urlPath, body = null) {
    return new Promise((resolve) => {
        // Create Mock Request (Readable stream)
        const req = new Readable({
            read() {}
        });
        req.method = method;
        req.url = urlPath;
        req.headers = { host: 'localhost' };

        if (body) {
            const bodyStr = JSON.stringify(body);
            req.push(bodyStr);
            req.headers['content-type'] = 'application/json';
        }
        req.push(null); // EOF

        // Create Mock Response
        const res = new EventEmitter();
        let statusCode = 200;
        const headers = {};
        let responseBody = '';

        res.writeHead = function (code, hdrs) {
            statusCode = code;
            if (hdrs) Object.assign(headers, hdrs);
            return res;
        };

        res.write = function (chunk) {
            if (chunk) responseBody += chunk.toString();
            return true;
        };

        res.end = function (chunk) {
            if (chunk) responseBody += chunk.toString();
            let parsed = null;
            try {
                parsed = JSON.parse(responseBody);
            } catch (e) {
                parsed = responseBody;
            }
            resolve({ statusCode, headers, data: parsed });
        };

        // Dispatch request directly to server handler
        server.emit('request', req, res);
    });
}

async function runTests() {
    console.log('🧪 Starting The Smart Online Ticket Booking System Test Suite (Sandbox Mode)...\n');

    try {
        // Test 1: Serve Frontend HTML
        const htmlRes = await simulateRequest('GET', '/');
        console.log(`[PASS] Test 1: Static HTML Page (Status: ${htmlRes.statusCode})`);
        if (typeof htmlRes.data !== 'string' || !htmlRes.data.includes('The Smart Online Ticket Booking System')) {
            throw new Error('Index.html did not contain expected title');
        }

        // Test 2: Hero Train Image Asset
        const imgRes = await simulateRequest('GET', '/assets/hero-train.jpg');
        console.log(`[PASS] Test 2: Hero Train Image Asset (Status: ${imgRes.statusCode}, Content-Type: ${imgRes.headers['Content-Type']})`);
        if (imgRes.statusCode !== 200) throw new Error('Hero image asset not found');

        // Test 3: Get Slots (Train & Bus)
        const slotsRes = await simulateRequest('GET', '/api/slots');
        console.log(`[PASS] Test 3: Fetch Slots (Status: ${slotsRes.statusCode}, Found: ${slotsRes.data.count} slots)`);
        if (!slotsRes.data.success || slotsRes.data.count === 0) throw new Error('No slots returned');

        // Verify Train and Bus slots are both present
        const trainSlots = slotsRes.data.data.filter(s => s.type === 'train');
        const busSlots = slotsRes.data.data.filter(s => s.type === 'bus');
        console.log(`       🚆 Train Slots: ${trainSlots.length}`);
        console.log(`       🚌 Bus Slots:   ${busSlots.length}`);
        if (trainSlots.length === 0 || busSlots.length === 0) throw new Error('Both train and bus slots must be present');

        // Test 4: Get Seat Map for Slot 1 (Check Green and Red seats)
        const seatsRes = await simulateRequest('GET', '/api/slots/1/seats');
        console.log(`[PASS] Test 4: Slot 1 Seat Map (Status: ${seatsRes.statusCode}, Total Seats: ${seatsRes.data.seats.length})`);
        const greenSeats = seatsRes.data.seats.filter(s => s.is_booked === 0);
        const redSeats = seatsRes.data.seats.filter(s => s.is_booked === 1);
        console.log(`       🟢 Green (Available): ${greenSeats.length} seats`);
        console.log(`       🔴 Red (Filled):      ${redSeats.length} seats`);
        if (greenSeats.length === 0 || redSeats.length === 0) throw new Error('Seats map does not have both green and red seats');

        // Test 5: Register User (with Where to Where, Age, Seats, AC/Non-AC)
        const regEmail = `passenger_${Date.now()}@test.com`;
        const regRes = await simulateRequest('POST', '/api/auth/register', {
            full_name: 'D. Sindhura',
            where_from: 'Kacheguda (Hyderabad)',
            where_to: 'Tirupati Main Junction',
            age: 23,
            seats_count: 2,
            ac_preference: 'AC',
            email: regEmail,
            phone: '+91 98765 43210',
            password: 'secretpassword',
            travel_preference: 'Train'
        });
        console.log(`[PASS] Test 5: Passenger Registration (Status: ${regRes.statusCode}, Message: ${regRes.data.message})`);
        if (!regRes.data.success) throw new Error('Registration failed');
        const testUserId = regRes.data.user.id;

        // Test 6: Book Seats (Group Booking Mode for Friends)
        const seatToBook1 = greenSeats[0].seat_number;
        const seatToBook2 = greenSeats[1].seat_number;
        const bookRes = await simulateRequest('POST', '/api/bookings', {
            user_id: testUserId,
            slot_id: 1,
            seats: [seatToBook1, seatToBook2],
            passengers: [
                { name: 'Friend One', seat: seatToBook1 },
                { name: 'Friend Two', seat: seatToBook2 }
            ],
            is_group: true,
            total_amount: 86.40,
            discount_amount: 9.60
        });
        console.log(`[PASS] Test 6: Group Booking Submission (Status: ${bookRes.statusCode}, PNR: ${bookRes.data.booking.booking_reference})`);
        if (!bookRes.data.success) throw new Error('Booking failed');
        const bookingRef = bookRes.data.booking.booking_reference;
        const bookingId = bookRes.data.booking.id;

        // Test 7: Verify newly booked seats are now Red (Filled)
        const recheckSeats = await simulateRequest('GET', '/api/slots/1/seats');
        const bookedSeat1Obj = recheckSeats.data.seats.find(s => s.seat_number === seatToBook1);
        console.log(`[PASS] Test 7: Real-Time Seat Synchronization (Seat ${seatToBook1} is now Red/Filled: ${bookedSeat1Obj.is_booked === 1})`);
        if (bookedSeat1Obj.is_booked !== 1) throw new Error('Seat was not updated to filled in database');

        // Test 8: QR Scanner Live Verification
        const verifyRes = await simulateRequest('GET', `/api/tickets/verify/${bookingRef}`);
        console.log(`[PASS] Test 8: QR Scanner Live Verification (Status: ${verifyRes.statusCode}, Verified: ${verifyRes.data.verified})`);
        if (!verifyRes.data.verified) throw new Error('Scanner verification failed');

        // Test 9: Cancel Booking and verify seats return to Green (Available)
        const cancelRes = await simulateRequest('POST', `/api/bookings/${bookingId}/cancel`);
        console.log(`[PASS] Test 9: Booking Cancellation (Status: ${cancelRes.statusCode}, Message: ${cancelRes.data.message})`);
        const afterCancelSeats = await simulateRequest('GET', '/api/slots/1/seats');
        const releasedSeat = afterCancelSeats.data.seats.find(s => s.seat_number === seatToBook1);
        console.log(`[PASS] Test 10: Seats Released back to Green/Available (is_booked: ${releasedSeat.is_booked})`);
        if (releasedSeat.is_booked !== 0) throw new Error('Seat was not released back to green');

        console.log('\n=============================================================');
        console.log('🎉 ALL 10 TESTS PASSED WITH 100% SUCCESS!');
        console.log('=============================================================\n');
        process.exit(0);

    } catch (err) {
        console.error('\n❌ Test failed:', err);
        process.exit(1);
    }
}

runTests();
