/* ── State ───────────────────────────────────────────── */
let coaches = [];
let selectedCoach = null;
let selectedDate = null;
let selectedSlot = null;

/* ── Navigation ─────────────────────────────────────── */
function navigate(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    document.getElementById('view-' + view).classList.add('active');
    const navBtn = document.querySelector(`.nav-btn[data-view="${view}"]`);
    if (navBtn) navBtn.classList.add('active');

    if (view === 'coaches') loadCoaches();
}

/* ── Coaches ────────────────────────────────────────── */
async function loadCoaches() {
    const res = await fetch('/api/coaches');
    coaches = await res.json();
    renderCoaches();
}

function renderCoaches() {
    const grid = document.getElementById('coaches-grid');
    grid.innerHTML = coaches.map(c => `
        <div class="coach-card" onclick="selectCoach(${c.id})">
            <div class="coach-card-header">
                <div class="coach-avatar">
                    <img src="${c.photo_url}" alt="${c.name}">
                </div>
                <div>
                    <div class="coach-card-name">${c.name}</div>
                    <div class="coach-card-specialty">${c.specialty}</div>
                </div>
            </div>
            <div class="coach-card-body">
                <p class="coach-card-bio">${c.bio}</p>
                <div class="coach-card-footer">
                    <div class="coach-rate">$${c.hourly_rate.toFixed(0)} <span>/hr</span></div>
                    <button class="btn-book-coach">Book Lesson</button>
                </div>
            </div>
        </div>
    `).join('');
}

/* ── Select Coach & Show Booking ────────────────────── */
async function selectCoach(coachId) {
    selectedCoach = coaches.find(c => c.id === coachId);
    selectedDate = null;
    selectedSlot = null;

    // Show coach detail
    const info = document.getElementById('booking-coach-info');
    info.innerHTML = `
        <div class="coach-detail-avatar">
            <img src="${selectedCoach.photo_url}" alt="${selectedCoach.name}">
        </div>
        <div class="coach-detail-info">
            <h2>${selectedCoach.name}</h2>
            <div class="specialty">${selectedCoach.specialty}</div>
            <div class="rate">$${selectedCoach.hourly_rate.toFixed(0)} per hour</div>
        </div>
    `;

    // Load available dates
    const res = await fetch(`/api/dates?coach_id=${coachId}`);
    const dates = await res.json();
    renderDates(dates);

    // Reset time slots and form
    document.getElementById('time-slots').innerHTML = '<p class="hint">Select a date first</p>';
    document.getElementById('step-details').style.display = 'none';

    // Navigate
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-booking').classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
}

/* ── Dates ──────────────────────────────────────────── */
function renderDates(dates) {
    const picker = document.getElementById('date-picker');
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    picker.innerHTML = dates.map(d => {
        const date = new Date(d + 'T12:00:00');
        const dayName = dayNames[date.getDay()];
        const dayNum = date.getDate();
        const month = monthNames[date.getMonth()];
        return `
            <button class="date-btn" onclick="selectDate('${d}', this)" type="button">
                <span class="day-name">${dayName}</span>
                <span class="day-num">${dayNum}</span>
                <span class="month">${month}</span>
            </button>
        `;
    }).join('');
}

async function selectDate(date, el) {
    selectedDate = date;
    selectedSlot = null;
    document.getElementById('step-details').style.display = 'none';

    // Highlight selected date
    document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');

    // Load time slots
    const res = await fetch(`/api/slots?coach_id=${selectedCoach.id}&date=${date}`);
    const slots = await res.json();
    renderTimeSlots(slots);
}

/* ── Time Slots ─────────────────────────────────────── */
function renderTimeSlots(slots) {
    const container = document.getElementById('time-slots');

    if (slots.length === 0) {
        container.innerHTML = '<p class="hint">No available slots on this date</p>';
        return;
    }

    container.innerHTML = slots.map(s => {
        const startLabel = formatTime(s.start_time);
        const endLabel = formatTime(s.end_time);
        return `
            <button class="time-btn" onclick="selectTime(${s.id}, '${s.start_time}', '${s.end_time}', this)" type="button">
                ${startLabel} – ${endLabel}
            </button>
        `;
    }).join('');
}

function selectTime(slotId, start, end, el) {
    selectedSlot = { id: slotId, start, end };

    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');

    // Show details form
    document.getElementById('step-details').style.display = 'block';
    document.getElementById('selected-slot-id').value = slotId;

    // Update summary
    const dateObj = new Date(selectedDate + 'T12:00:00');
    const dateStr = dateObj.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    document.getElementById('booking-summary').innerHTML = `
        <strong>Booking Summary</strong><br>
        Coach: ${selectedCoach.name}<br>
        Date: ${dateStr}<br>
        Time: ${formatTime(start)} – ${formatTime(end)}<br>
        Price: <strong>$${selectedCoach.hourly_rate.toFixed(0)}</strong>
    `;

    // Scroll to form
    document.getElementById('step-details').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ── Submit Booking ─────────────────────────────────── */
async function submitBooking(event) {
    event.preventDefault();

    const name = document.getElementById('book-name').value.trim();
    const email = document.getElementById('book-email').value.trim();
    const slotId = parseInt(document.getElementById('selected-slot-id').value);

    const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_id: slotId, name, email }),
    });

    if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Booking failed');
        return;
    }

    const booking = await res.json();

    // Show success modal
    const dateObj = new Date(booking.date + 'T12:00:00');
    const dateStr = dateObj.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    document.getElementById('modal-message').innerHTML = `
        Your lesson with <strong>${booking.coach_name}</strong> is confirmed.<br>
        ${dateStr} at ${formatTime(booking.start_time)} – ${formatTime(booking.end_time)}<br><br>
        A confirmation has been sent to <strong>${email}</strong>.
    `;
    document.getElementById('modal-backdrop').classList.add('show');

    // Reset form
    document.getElementById('booking-form').reset();
    selectedSlot = null;

    // Refresh slots for this date
    if (selectedDate && selectedCoach) {
        const slotsRes = await fetch(`/api/slots?coach_id=${selectedCoach.id}&date=${selectedDate}`);
        const slots = await slotsRes.json();
        renderTimeSlots(slots);
        document.getElementById('step-details').style.display = 'none';
    }
}

function closeModal() {
    document.getElementById('modal-backdrop').classList.remove('show');
}

/* ── My Bookings ────────────────────────────────────── */
async function lookupBookings(event) {
    event.preventDefault();
    const email = document.getElementById('lookup-email').value.trim();

    const res = await fetch(`/api/bookings?email=${encodeURIComponent(email)}`);
    const bookings = await res.json();
    renderBookings(bookings);
}

function renderBookings(bookings) {
    const container = document.getElementById('bookings-list');

    if (bookings.length === 0) {
        container.innerHTML = `
            <div class="no-bookings">
                <div class="icon">📭</div>
                <p>No bookings found for this email.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = bookings.map(b => {
        const dateObj = new Date(b.date + 'T12:00:00');
        const dateStr = dateObj.toLocaleDateString('en-US', {
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
        });
        return `
            <div class="booking-card">
                <div class="booking-info">
                    <div class="booking-coach">🎾 ${b.coach_name}</div>
                    <div class="booking-datetime">${dateStr} · ${formatTime(b.start_time)} – ${formatTime(b.end_time)}</div>
                    <div class="booking-price">$${b.hourly_rate.toFixed(0)}</div>
                </div>
                <button class="btn btn-danger" onclick="cancelBooking(${b.id})">Cancel</button>
            </div>
        `;
    }).join('');
}

async function cancelBooking(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    const res = await fetch(`/api/bookings/${bookingId}`, { method: 'DELETE' });
    if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Cancel failed');
        return;
    }

    // Refresh
    const email = document.getElementById('lookup-email').value.trim();
    if (email) {
        const r = await fetch(`/api/bookings?email=${encodeURIComponent(email)}`);
        renderBookings(await r.json());
    }
}

/* ── Helpers ────────────────────────────────────────── */
function formatTime(time24) {
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

/* ── Init ───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    loadCoaches();
});
