#!/usr/bin/env python3
"""Flask app for tennis lesson booking."""

import sqlite3
import os
from flask import Flask, jsonify, request, render_template, g

app = Flask(__name__)
DB_PATH = os.path.join(os.path.dirname(__file__), "tennis.db")


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


# ── Pages ───────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


# ── API ─────────────────────────────────────────────────────────────────────
@app.get("/api/coaches")
def get_coaches():
    db = get_db()
    rows = db.execute("SELECT * FROM coaches ORDER BY name").fetchall()
    return jsonify([dict(r) for r in rows])


@app.get("/api/slots")
def get_slots():
    db = get_db()
    coach_id = request.args.get("coach_id")
    date = request.args.get("date")

    query = "SELECT * FROM time_slots WHERE is_booked = 0"
    params = []

    if coach_id:
        query += " AND coach_id = ?"
        params.append(coach_id)
    if date:
        query += " AND date = ?"
        params.append(date)

    query += " ORDER BY date, start_time"
    rows = db.execute(query, params).fetchall()
    return jsonify([dict(r) for r in rows])


@app.get("/api/dates")
def get_dates():
    """Get available dates for a coach."""
    db = get_db()
    coach_id = request.args.get("coach_id")
    if not coach_id:
        return jsonify({"error": "coach_id required"}), 400

    rows = db.execute(
        "SELECT DISTINCT date FROM time_slots WHERE coach_id = ? AND is_booked = 0 ORDER BY date",
        (coach_id,),
    ).fetchall()
    return jsonify([r["date"] for r in rows])


@app.post("/api/book")
def book_slot():
    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    slot_id = data.get("slot_id")
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()

    if not slot_id or not name or not email:
        return jsonify({"error": "slot_id, name, and email are required"}), 400

    db = get_db()

    slot = db.execute("SELECT * FROM time_slots WHERE id = ?", (slot_id,)).fetchone()
    if not slot:
        return jsonify({"error": "Slot not found"}), 404
    if slot["is_booked"]:
        return jsonify({"error": "Slot is already booked"}), 409

    db.execute("UPDATE time_slots SET is_booked = 1 WHERE id = ?", (slot_id,))
    db.execute(
        "INSERT INTO bookings (slot_id, customer_name, customer_email) VALUES (?, ?, ?)",
        (slot_id, name, email),
    )
    db.commit()

    booking = db.execute(
        """SELECT b.id, b.customer_name, b.customer_email, b.created_at,
                  s.date, s.start_time, s.end_time, c.name as coach_name
           FROM bookings b
           JOIN time_slots s ON b.slot_id = s.id
           JOIN coaches c ON s.coach_id = c.id
           WHERE b.slot_id = ?""",
        (slot_id,),
    ).fetchone()

    return jsonify(dict(booking)), 201


@app.get("/api/bookings")
def get_bookings():
    email = request.args.get("email", "").strip()
    if not email:
        return jsonify({"error": "email parameter required"}), 400

    db = get_db()
    rows = db.execute(
        """SELECT b.id, b.customer_name, b.customer_email, b.created_at,
                  s.date, s.start_time, s.end_time, s.id as slot_id,
                  c.name as coach_name, c.hourly_rate
           FROM bookings b
           JOIN time_slots s ON b.slot_id = s.id
           JOIN coaches c ON s.coach_id = c.id
           WHERE LOWER(b.customer_email) = LOWER(?)
           ORDER BY s.date, s.start_time""",
        (email,),
    ).fetchall()

    return jsonify([dict(r) for r in rows])


@app.delete("/api/bookings/<int:booking_id>")
def cancel_booking(booking_id):
    db = get_db()

    booking = db.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,)).fetchone()
    if not booking:
        return jsonify({"error": "Booking not found"}), 404

    db.execute("UPDATE time_slots SET is_booked = 0 WHERE id = ?", (booking["slot_id"],))
    db.execute("DELETE FROM bookings WHERE id = ?", (booking_id,))
    db.commit()

    return jsonify({"message": "Booking cancelled successfully"})


if __name__ == "__main__":
    if not os.path.exists(DB_PATH):
        print("Database not found. Run 'python init_db.py' first.")
        exit(1)
    app.run(debug=True, port=5000)
