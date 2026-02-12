#!/usr/bin/env python3
"""Initialize the tennis booking database with schema and seed data."""

import sqlite3
import os
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "tennis.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS coaches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    photo_url TEXT,
    bio TEXT,
    specialty TEXT,
    hourly_rate REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS time_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coach_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_booked INTEGER DEFAULT 0,
    FOREIGN KEY (coach_id) REFERENCES coaches(id)
);

CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_id INTEGER NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (slot_id) REFERENCES time_slots(id)
);
"""

COACHES = [
    {
        "name": "Maria Santos",
        "photo_url": "https://api.dicebear.com/7.x/personas/svg?seed=Maria&backgroundColor=b6e3f4",
        "bio": "Former WTA top 100 player with 15 years of coaching experience. Specializes in building strong fundamentals and competitive match play.",
        "specialty": "Groundstrokes & Match Strategy",
        "hourly_rate": 85.00,
    },
    {
        "name": "James Chen",
        "photo_url": "https://api.dicebear.com/7.x/personas/svg?seed=James&backgroundColor=c0aede",
        "bio": "USPTA certified professional. Patient and methodical teaching style, great with beginners and intermediate players looking to level up.",
        "specialty": "Beginners & Technique",
        "hourly_rate": 65.00,
    },
    {
        "name": "Sofia Kovac",
        "photo_url": "https://api.dicebear.com/7.x/personas/svg?seed=Sofia&backgroundColor=d1f4d1",
        "bio": "NCAA Division I champion turned coach. High-energy sessions focused on fitness, agility, and power hitting.",
        "specialty": "Power Game & Fitness",
        "hourly_rate": 90.00,
    },
    {
        "name": "Andre Williams",
        "photo_url": "https://api.dicebear.com/7.x/personas/svg?seed=Andre&backgroundColor=ffd5dc",
        "bio": "20+ years coaching juniors and adults. Known for improving serve technique and net play. Relaxed, encouraging style.",
        "specialty": "Serve & Volley",
        "hourly_rate": 75.00,
    },
]

HOURS = [(h, h + 1) for h in range(9, 17)]  # 9am-5pm, 1-hour blocks


def init():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.executescript(SCHEMA)

    # Insert coaches
    for coach in COACHES:
        cur.execute(
            "INSERT INTO coaches (name, photo_url, bio, specialty, hourly_rate) VALUES (?, ?, ?, ?, ?)",
            (coach["name"], coach["photo_url"], coach["bio"], coach["specialty"], coach["hourly_rate"]),
        )

    # Generate 2 weeks of time slots for each coach
    today = datetime.now().date()
    # Start from next Monday
    start = today + timedelta(days=(7 - today.weekday()) % 7)
    if start == today:
        start = today

    for coach_id in range(1, len(COACHES) + 1):
        for day_offset in range(14):
            date = start + timedelta(days=day_offset)
            # Skip Sundays
            if date.weekday() == 6:
                continue
            date_str = date.isoformat()
            for start_h, end_h in HOURS:
                cur.execute(
                    "INSERT INTO time_slots (coach_id, date, start_time, end_time) VALUES (?, ?, ?, ?)",
                    (coach_id, date_str, f"{start_h:02d}:00", f"{end_h:02d}:00"),
                )

    conn.commit()
    conn.close()
    print(f"Database created at {DB_PATH}")
    print(f"  {len(COACHES)} coaches")

    conn = sqlite3.connect(DB_PATH)
    count = conn.execute("SELECT COUNT(*) FROM time_slots").fetchone()[0]
    conn.close()
    print(f"  {count} time slots generated")


if __name__ == "__main__":
    init()
