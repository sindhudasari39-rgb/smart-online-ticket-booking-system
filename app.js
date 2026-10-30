/**
 * The Smart Online Ticket Booking System
 * Core Frontend Logic
 * Implements:
 * 1. Passenger Registration Form with conditional validation ("if i didint enter means give, dont give pop messege simply")
 * 2. Trains: Venkatadri Express, Vande Bharat Express, Guntur Passenger
 * 3. Pic 1: Circular Seat Selection (Rows A-E, Time Slot Pills 10:00, 11:30, 2:30, 4:45, 7:20, 11:10)
 * 4. Pic 2: Payment Successful Mobile Boarding Pass
 * 5. Pic 3: Shohoz-Style Bookings Dashboard (Upcoming & Previous Tickets)
 */

class SmartTicketApp {
    constructor() {
        this.apiBase = window.location.origin;
        this.currentUser = JSON.parse(localStorage.getItem('smart_ticket_user')) || {
            id: 1,
            full_name: 'D. Sindhura',
            email: 'sindhura@example.com',
            phone: '+91 98765 43210',
            where_from: 'Kacheguda (Hyderabad)',
            where_to: 'Tirupati Main Junction',
            age: 23,
            seats_count: 2,
            ac_preference: 'AC',
            travel_preference: 'Train'
        };

        this.currentSlots = [];
        this.selectedSlot = null;
        this.selectedSeats = new Set();
        this.currentSeatsData = [];
        this.selectedTime = '4:45';
        this.activeFilter = 'all';

        // Dashboard states (Pic 3)
        this.dashTab = 'upcoming'; // 'upcoming' or 'history'
        this.dashCategory = 'all';  // 'all', 'train', 'bus', 'launch'
        this.dashSearchTerm = '';
        this.userBookings = [];

        // Web Audio synth for alert/ping
        this.audioCtx = null;

        this.init();
    }

    init() {
        this.updateUserNav();
        this.loadSlots();
        this.loadUserBookings();
    }

    // ================= Synthesized Audio Tone =================
    playPopSound(type = 'info') {
        try {
            if (!this.audioCtx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) this.audioCtx = new AudioContext();
            }
            if (!this.audioCtx) return;

            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            const now = this.audioCtx.currentTime;

            if (type === 'success') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523.25, now);
                osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15);
                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
            } else if (type === 'warning' || type === 'error') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(280, now);
                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
            }
        } catch (e) {}
    }

    // ================= Universal POP Message / Toast System =================
    // Rule: Don't give pop messages simply; only show when user action requires alert/warning/success
    popMessage(type = 'info', title = 'Notice', message = '') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        this.playPopSound(type);

        const toast = document.createElement('div');
        toast.className = `pop-toast ${type}`;

        const icons = {
            success: '✅',
            warning: '⚠️',
            error: '❌',
            info: '🔔'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || '🔔'}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-msg">${message}</div>
            </div>
            <div class="toast-progress"></div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'all 0.3s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    scrollToSection(id) {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    }

    updateUserNav() {
        const container = document.getElementById('user-nav-container');
        if (!container) return;

        if (this.currentUser) {
            const initial = this.currentUser.full_name ? this.currentUser.full_name[0].toUpperCase() : 'S';
            container.innerHTML = `
                <div class="user-badge" onclick="app.scrollToSection('registration-section')">
                    <div class="user-avatar">${initial}</div>
                    <span class="user-name">${this.currentUser.full_name}</span>
                </div>
            `;
        }
    }

    // ================= 1. Passenger Registration Form Handler =================
    // Requirement:
    // in registration: name, where to where, age, how many seats, ac or non ac
    // "dont give pop messege simply, if i didint enter means give"
    setAcPreference(type) {
        document.getElementById('reg-form-ac').value = type;
        const btnAc = document.getElementById('btn-pref-ac');
        const btnNonAc = document.getElementById('btn-pref-nonac');

        if (type === 'AC') {
            btnAc.classList.add('active');
            btnNonAc.classList.remove('active');
        } else {
            btnNonAc.classList.add('active');
            btnAc.classList.remove('active');
        }
    }

    async handlePageRegistration(event) {
        event.preventDefault();

        const name = document.getElementById('reg-form-name').value.trim();
        const from = document.getElementById('reg-form-from').value.trim();
        const to = document.getElementById('reg-form-to').value.trim();
        const age = document.getElementById('reg-form-age').value.trim();
        const seatsCount = document.getElementById('reg-form-seats').value;
        const acPref = document.getElementById('reg-form-ac').value;

        // Validation: ONLY show popup if user DID NOT enter required fields!
        const missingFields = [];
        if (!name) missingFields.push('Passenger Name');
        if (!from) missingFields.push('From Station');
        if (!to) missingFields.push('To Station');
        if (!age) missingFields.push('Passenger Age');
        if (!seatsCount) missingFields.push('Number of Seats');
        if (!acPref) missingFields.push('AC or Non-AC Preference');

        if (missingFields.length > 0) {
            this.popMessage('warning', 'Missing Details', `Please enter: ${missingFields.join(', ')}`);
            return;
        }

        // If all entered correctly, proceed without noisy popups
        try {
            const res = await fetch(`${this.apiBase}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name,
                    where_from: from,
                    where_to: to,
                    age: parseInt(age, 10),
                    seats_count: parseInt(seatsCount, 10),
                    ac_preference: acPref
                })
            });

            const data = await res.json();
            if (data.success) {
                this.currentUser = data.user;
                localStorage.setItem('smart_ticket_user', JSON.stringify(data.user));
                this.updateUserNav();

                // Update target seats count on seat modal
                const targetSeatsEl = document.getElementById('target-seats-count');
                if (targetSeatsEl) targetSeatsEl.textContent = this.currentUser.seats_count;

                // Match with appropriate train slot (e.g. Venkatadri Express if Tirupati, etc.)
                let matchedSlot = this.currentSlots.find(s => s.destination.toLowerCase().includes(to.toLowerCase()));
                if (!matchedSlot && this.currentSlots.length > 0) {
                    matchedSlot = this.currentSlots[0]; // Venkatadri Express
                }

                if (matchedSlot) {
                    this.openSeatModal(matchedSlot.id);
                } else {
                    this.scrollToSection('slots-section');
                }
            } else {
                this.popMessage('error', 'Registration Error', data.message);
            }
        } catch (e) {
            console.error('Registration failed:', e);
        }
    }

    // ================= Load Slots (Train & Bus) =================
    async loadSlots(filterType = null) {
        try {
            let url = `${this.apiBase}/api/slots`;
            if (filterType && filterType !== 'all') url += `?type=${filterType}`;

            const res = await fetch(url);
            const data = await res.json();

            if (data.success) {
                this.currentSlots = data.data;
                this.renderSlots(this.currentSlots);
            }
        } catch (err) {
            console.error('Error fetching slots:', err);
        }
    }

    filterSlots(type) {
        this.activeFilter = type;
        document.querySelectorAll('.mode-tab').forEach(tab => tab.classList.remove('active'));
        const activeTab = document.getElementById(`tab-${type}`);
        if (activeTab) activeTab.classList.add('active');

        this.loadSlots(type);
        this.scrollToSection('slots-section');
    }

    renderSlots(slots) {
        const grid = document.getElementById('slots-grid');
        if (!grid) return;

        grid.innerHTML = slots.map(slot => {
            const isTrain = slot.type === 'train';
            const icon = isTrain ? '🚆' : '🚌';
            const modeText = isTrain ? 'Train Express' : 'Luxury Coach';

            return `
                <div class="slot-card">
                    <div>
                        <div class="slot-header">
                            <span class="slot-mode-badge ${slot.type}">
                                ${icon} ${modeText}
                            </span>
                            <span class="slot-code">${slot.slot_code}</span>
                        </div>

                        <h3 class="slot-title">${slot.title}</h3>
                        <div class="slot-operator">${slot.operator} • <span style="color: #38bdf8; font-weight: 600;">${slot.ac_type || 'AC'}</span></div>

                        <div class="route-timeline">
                            <div class="route-stop">
                                <div>
                                    <div class="time">${slot.departure_time}</div>
                                    <div class="city">${slot.source}</div>
                                </div>
                                <div style="text-align: right;">
                                    <div class="time">${slot.arrival_time}</div>
                                    <div class="city">${slot.destination}</div>
                                </div>
                            </div>
                            <div class="route-divider">
                                <div class="route-line"></div>
                                <span>${slot.duration}</span>
                                <div class="route-line"></div>
                            </div>
                            <div class="route-footer-info">
                                <span>📅 ${slot.travel_date}</span>
                                <span>📍 ${slot.platform_or_bay}</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div class="slot-price-row">
                            <div class="price-box">
                                <span>Ticket Price</span>
                                <div class="amount">$${slot.price.toFixed(2)}</div>
                            </div>

                            <div class="seat-indicator-box">
                                <div class="seat-pill green">
                                    <span class="seat-dot green"></span>
                                    <span>${slot.available_seats} Available</span>
                                </div>
                                <div class="seat-pill red">
                                    <span class="seat-dot red"></span>
                                    <span>${slot.booked_seats} Booked</span>
                                </div>
                            </div>
                        </div>

                        <div class="slot-actions">
                            <button class="btn btn-primary" onclick="app.openSeatModal(${slot.id})">
                                💺 Select Seats (Pic 1)
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ================= 2. Seat Selection Engine (Exact Pic 1 Layout) =================
    async openSeatModal(slotId) {
        try {
            const res = await fetch(`${this.apiBase}/api/slots/${slotId}/seats`);
            const data = await res.json();

            if (!data.success) return;

            this.selectedSlot = data.slot;
            this.currentSeatsData = data.seats;
            this.selectedSeats.clear();
            this.selectedTime = '4:45';

            // Set Slot Titles
            document.getElementById('seat-modal-title').textContent = 'Select Seats';
            document.getElementById('seat-modal-slot-sub').textContent = `${this.selectedSlot.title} • ${this.selectedSlot.source} ➔ ${this.selectedSlot.destination}`;

            // Target Seats Count
            const targetCount = (this.currentUser && this.currentUser.seats_count) ? this.currentUser.seats_count : 2;
            const targetEl = document.getElementById('target-seats-count');
            if (targetEl) targetEl.textContent = targetCount;

            // Render Time Pills (Pic 1)
            this.renderTimeSlots(this.selectedSlot.time_slots);

            // Render Rows A, B, C (aisle) D, E (Pic 1)
            this.renderPic1SeatBoard();
            this.updatePic1CheckoutSummary();

            document.getElementById('seat-modal').classList.add('active');
        } catch (err) {
            console.error('Error opening seat modal:', err);
        }
    }

    closeSeatModal() {
        document.getElementById('seat-modal').classList.remove('active');
        this.selectedSlot = null;
        this.selectedSeats.clear();
    }

    renderTimeSlots(timeSlots) {
        const container = document.getElementById('pic1-time-slots-container');
        if (!container) return;

        const slotsList = (timeSlots && timeSlots.length > 0) ? timeSlots : ['10:00', '11:30', '2:30', '4:45', '7:20', '11:10'];
        container.innerHTML = slotsList.map(t => `
            <button
                class="pic1-time-pill ${t === this.selectedTime ? 'active' : ''}"
                onclick="app.selectTimeSlot('${t}')"
            >
                ${t}
            </button>
        `).join('');
    }

    selectTimeSlot(timeStr) {
        this.selectedTime = timeStr;
        document.querySelectorAll('.pic1-time-pill').forEach(btn => {
            btn.classList.toggle('active', btn.textContent.trim() === timeStr);
        });
    }

    // Render Pic 1: Circular Seats in Rows A, B, C, (aisle), D, E
    renderPic1SeatBoard() {
        const board = document.getElementById('pic1-seat-board');
        if (!board || !this.currentSeatsData) return;

        // Group seats by row_label (A, B, C, D, E)
        const rowMap = { 'A': [], 'B': [], 'C': [], 'D': [], 'E': [] };
        this.currentSeatsData.forEach(seat => {
            const rowLabel = seat.row_label || seat.seat_number[0];
            if (rowMap[rowLabel]) rowMap[rowLabel].push(seat);
        });

        let html = '';
        const rowLabels = ['A', 'B', 'C', 'D', 'E'];

        rowLabels.forEach((rowLetter, idx) => {
            const seats = rowMap[rowLetter] || [];
            // Sort by col_index
            seats.sort((a, b) => a.col_index - b.col_index);

            html += `
                <div class="pic1-row-wrap">
                    <span class="pic1-row-label">${rowLetter}</span>
                    <div class="pic1-seats-row">
                        ${seats.map(s => this.renderPic1SeatCircle(s)).join('')}
                    </div>
                    <span class="pic1-row-label">${rowLetter}</span>
                </div>
            `;

            // Aisle gap between C and D (Pic 1)
            if (rowLetter === 'C') {
                html += `<div class="pic1-aisle-divider">────── AISLE PASSAGE ──────</div>`;
            }
        });

        board.innerHTML = html;
    }

    renderPic1SeatCircle(seat) {
        const isSelected = this.selectedSeats.has(seat.seat_number);
        // Status: 0 = available (teal), 1 = purchased (coral), 2 = not available (dark)
        let statusClass = 'avail';
        let content = '';

        if (seat.is_booked === 1) {
            statusClass = 'purchased'; // Coral Red
        } else if (seat.is_booked === 2) {
            statusClass = 'not-avail'; // Dark
        } else if (isSelected) {
            statusClass = 'selected'; // Blue with Checkmark
            content = '✓';
        }

        const canClick = seat.is_booked === 0 || isSelected;

        return `
            <button
                type="button"
                class="pic1-seat ${statusClass}"
                title="Seat ${seat.seat_number}"
                onclick="app.handlePic1SeatClick('${seat.seat_number}', ${seat.is_booked})"
            >
                ${content}
            </button>
        `;
    }

    handlePic1SeatClick(seatNum, statusCode) {
        if (statusCode === 1) {
            // Only pop warning when clicked filled seat as requested
            this.popMessage('warning', 'Already Purchased', `Seat ${seatNum} has already been purchased. Please select a green available seat.`);
            return;
        }
        if (statusCode === 2) {
            this.popMessage('warning', 'Not Available', `Seat ${seatNum} is not available for booking.`);
            return;
        }

        if (this.selectedSeats.has(seatNum)) {
            this.selectedSeats.delete(seatNum);
        } else {
            const targetCount = (this.currentUser && this.currentUser.seats_count) ? this.currentUser.seats_count : 2;
            if (this.selectedSeats.size >= targetCount) {
                // Remove the first selected to allow sliding selection
                const firstSeat = this.selectedSeats.values().next().value;
                this.selectedSeats.delete(firstSeat);
            }
            this.selectedSeats.add(seatNum);
        }

        this.renderPic1SeatBoard();
        this.updatePic1CheckoutSummary();
    }

    // Auto-Group Seats
    autoSelectAdjacentSeats() {
        if (!this.currentSeatsData) return;

        const targetCount = (this.currentUser && this.currentUser.seats_count) ? this.currentUser.seats_count : 2;
        const availableSeats = this.currentSeatsData.filter(s => s.is_booked === 0);

        if (availableSeats.length < targetCount) {
            this.popMessage('warning', 'Unavailable', 'Not enough available seats left.');
            return;
        }

        this.selectedSeats.clear();
        for (let i = 0; i < targetCount; i++) {
            this.selectedSeats.add(availableSeats[i].seat_number);
        }

        this.renderPic1SeatBoard();
        this.updatePic1CheckoutSummary();
    }

    updatePic1CheckoutSummary() {
        const countEl = document.getElementById('summary-seats-count');
        const priceEl = document.getElementById('summary-total-price');
        const chipsContainer = document.getElementById('selected-seats-container');

        if (!this.selectedSlot) return;

        const count = this.selectedSeats.size;
        const total = count * this.selectedSlot.price;

        if (countEl) countEl.textContent = count;
        if (priceEl) priceEl.textContent = `$${total.toFixed(2)}`;

        if (chipsContainer) {
            chipsContainer.innerHTML = Array.from(this.selectedSeats).map(s => `
                <span class="seat-chip">Seat ${s}</span>
            `).join('');
        }
    }

    // ================= 3. Process Booking & Display Pic 2 =================
    async processBooking() {
        if (this.selectedSeats.size === 0) {
            this.popMessage('warning', 'No Seats Selected', 'Please click on available green circle seats to proceed.');
            return;
        }

        const seatsArr = Array.from(this.selectedSeats);
        const passengers = seatsArr.map((seat, idx) => ({
            seat: seat,
            name: (idx === 0 && this.currentUser) ? this.currentUser.full_name : `Passenger ${idx + 1}`
        }));

        const total = seatsArr.length * this.selectedSlot.price;

        try {
            const res = await fetch(`${this.apiBase}/api/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: this.currentUser ? this.currentUser.id : 1,
                    slot_id: this.selectedSlot.id,
                    seats: seatsArr,
                    passengers: passengers,
                    is_group: seatsArr.length > 1,
                    total_amount: total,
                    travel_time: this.selectedTime,
                    ac_type: this.selectedSlot.ac_type
                })
            });

            const data = await res.json();

            if (!data.success) {
                this.popMessage('error', 'Booking Error', data.message);
                return;
            }

            this.closeSeatModal();
            this.lastConfirmedBooking = data.booking;

            // Show SUCCESS Modal (Pic 2 Mobile Ticket Style)
            this.showPic2PaymentSuccess(data.booking);

            // Reload slots & dashboard
            this.loadSlots(this.activeFilter);
            this.loadUserBookings();

        } catch (err) {
            console.error('Booking error:', err);
        }
    }

    // Pic 2: Payment Successful Screen
    showPic2PaymentSuccess(booking) {
        // Seat pills
        const pillsContainer = document.getElementById('pic2-seat-pills');
        if (pillsContainer) {
            pillsContainer.innerHTML = booking.seats.map(s => `
                <span class="pic2-pill">Seat ${s}</span>
            `).join('');
        }

        // Ticket details
        document.getElementById('pic2-ticket-title').textContent = booking.slot_title;
        document.getElementById('pic2-ticket-operator').textContent = `${booking.type === 'train' ? 'South Central Railway' : 'Luxury Coach Lines'} • ${booking.seats_list}`;
        document.getElementById('pic2-ticket-price').textContent = `$${booking.total_amount.toFixed(2)}`;
        document.getElementById('pic2-ticket-class').textContent = booking.ac_type || 'AC Class';

        document.getElementById('pic2-ticket-date').textContent = 'THU 17 DEC';
        document.getElementById('pic2-ticket-time').textContent = `${booking.travel_time || '4:45 PM'}`;
        document.getElementById('pic2-ticket-location').textContent = `${booking.source} (${booking.platform || 'Platform 4'})`;

        document.getElementById('celebration-modal').classList.add('active');
        this.playPopSound('success');
    }

    closeCelebrationAndGoToDash() {
        document.getElementById('celebration-modal').classList.remove('active');
        this.scrollToSection('dashboard-section');
    }

    // ================= 4. Shohoz-Style Bookings Dashboard (Pic 3) =================
    async loadUserBookings() {
        if (!this.currentUser) return;

        try {
            const res = await fetch(`${this.apiBase}/api/users/${this.currentUser.id}/bookings`);
            const data = await res.json();

            if (!data.success) return;

            this.userBookings = data.data;
            this.renderPic3Dashboard();
        } catch (err) {
            console.error('Error loading bookings:', err);
        }
    }

    setDashboardTab(tabName) {
        this.dashTab = tabName;
        document.getElementById('tab-dash-upcoming').classList.toggle('active', tabName === 'upcoming');
        document.getElementById('tab-dash-history').classList.toggle('active', tabName === 'history');
        this.renderPic3Dashboard();
    }

    filterDashCategory(category) {
        this.dashCategory = category;
        document.querySelectorAll('.pic3-pill-btn').forEach(btn => {
            btn.classList.toggle('active', btn.id === `pill-${category}`);
        });
        this.renderPic3Dashboard();
    }

    handleDashSearch(query) {
        this.dashSearchTerm = (query || '').toLowerCase().trim();
        this.renderPic3Dashboard();
    }

    renderPic3Dashboard() {
        const container = document.getElementById('bookings-list-container');
        if (!container) return;

        let filtered = this.userBookings.slice();

        // 1. Filter by Upcoming vs Previous / History
        if (this.dashTab === 'upcoming') {
            filtered = filtered.filter(b => b.booking_status === 'Confirmed');
        } else {
            filtered = filtered.filter(b => b.booking_status === 'Cancelled' || b.booking_status === 'Completed');
        }

        // 2. Filter by Category (train, bus, launch)
        if (this.dashCategory !== 'all') {
            filtered = filtered.filter(b => b.type === this.dashCategory);
        }

        // 3. Search query
        if (this.dashSearchTerm) {
            filtered = filtered.filter(b =>
                b.booking_reference.toLowerCase().includes(this.dashSearchTerm) ||
                b.slot_title.toLowerCase().includes(this.dashSearchTerm) ||
                b.seats_list.toLowerCase().includes(this.dashSearchTerm)
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 40px; text-align: center; color: #64748b;">
                    <div style="font-size: 2.2rem; margin-bottom: 8px;">🎫</div>
                    <h3 style="color: #0f172a; margin-bottom: 4px;">No ${this.dashTab} bookings found</h3>
                    <p style="font-size: 0.9rem;">Book seats on Venkatadri Express, Vande Bharat Express, or Guntur Passenger above.</p>
                </div>
            `;
            return;
        }

        // Render Cards in Pic 3 format
        container.innerHTML = filtered.map(b => {
            const isTrain = b.type === 'train';
            const icon = isTrain ? '🚆' : '🚌';
            const operatorSubtitle = b.ac_type || (isTrain ? 'South Central Railway, AC Class' : 'Luxury AC Coach');

            return `
                <div class="pic3-booking-card">
                    <div class="pic3-card-top-row">
                        <div class="pic3-date-time">
                            📅 ${b.travel_date || 'THU 17 DEC'} - ${b.travel_time || b.departure_time}
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-weight: 700; color: #475569;">${icon} ${isTrain ? 'Train' : 'Bus'}</span>
                            <span class="pic3-status-badge">(${b.booking_status})</span>
                        </div>
                    </div>

                    <div class="pic3-card-content-grid">
                        <div>
                            <div class="pic3-train-header">
                                <div class="pic3-train-logo">${icon}</div>
                                <div>
                                    <div class="pic3-train-title">${b.slot_title}</div>
                                    <div class="pic3-train-class">${operatorSubtitle}</div>
                                </div>
                            </div>

                            <div class="pic3-trip-times">
                                <div>
                                    <span style="color: #64748b; font-size: 0.78rem; display: block;">Departure:</span>
                                    <strong>${b.departure_time}</strong> (${b.source})
                                </div>
                                <div>
                                    <span style="color: #64748b; font-size: 0.78rem; display: block;">Arrival:</span>
                                    <strong>${b.arrival_time}</strong> (${b.destination})
                                </div>
                            </div>

                            <div style="margin-top: 8px;">
                                <span style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #0284c7; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 0.82rem;">
                                    Selected Seat: ${b.seats_list}
                                </span>
                            </div>
                        </div>

                        <div class="pic3-fare-col">
                            <span style="font-size: 0.75rem; color: #64748b; font-weight: 700; display: block;">FARE</span>
                            <div class="pic3-fare-amount">৳${b.total_amount.toFixed(0)}</div>
                            <button class="pic3-btn-view-details" onclick='app.openFullTicketModal(${JSON.stringify(b)})'>
                                VIEW DETAILS
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    openFullTicketModal(booking) {
        document.getElementById('ticket-slot-title').textContent = booking.slot_title;
        document.getElementById('ticket-pnr').textContent = booking.booking_reference;
        document.getElementById('ticket-date').textContent = booking.travel_date || 'THU 17 DEC';
        document.getElementById('ticket-source').textContent = booking.source;
        document.getElementById('ticket-destination').textContent = booking.destination;
        document.getElementById('ticket-dep-time').textContent = booking.departure_time;
        document.getElementById('ticket-platform').textContent = booking.platform_or_bay || 'Platform 4';
        document.getElementById('ticket-seats').textContent = booking.seats_list;

        const qrContainer = document.getElementById('ticket-qr-container');
        if (window.renderQRCode) {
            window.renderQRCode(qrContainer, `${booking.booking_reference}|${booking.seats_list}|CONFIRMED`, 140);
        }

        document.getElementById('ticket-modal').classList.add('active');
    }

    closeTicketModal() {
        document.getElementById('ticket-modal').classList.remove('active');
    }
}

// Instantiate globally
window.app = new SmartTicketApp();
