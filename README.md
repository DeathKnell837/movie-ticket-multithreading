# CineBook — Movie Ticket Booking System
### Parallel Computing Midterm Project | Group 1: Lacay, Bacanto, Bravo

A real-time, interactive simulation comparing **Sequential Processing**, **Multi-threading with Race Conditions (Unsafe)**, and **Multi-threading with Synchronization Locks (Safe)** using Python, Flask-SocketIO, and a modern Cinema Box-Office Web Dashboard.

---

## 1. Quick Start Guide

### Step 1: Install Dependencies
Open PowerShell or Command Prompt in this folder and run:
```bash
pip install -r requirements.txt
```

### Step 2: Launch the System
```bash
python app.py
```

### Step 3: Open in Browser
Open your browser and visit:
```
http://localhost:5000
```

---

## 2. Project Architecture & Concepts Demonstrated

| Version | Mode | Concurrency Model | Expected Behavior |
|---|---|---|---|
| **Version 1: Sequential** | `sequential` | **Single Thread** (Counter 1 only). Customers served sequentially in a FIFO queue. | Baseline execution time (~1.5s). Zero race conditions, 100% correct seat allocation. |
| **Version 2: Threaded (No Lock)** | `threaded_unsafe` | **4 Concurrent Threads** without Mutex protection. | Demonstrates **Critical Section Race Conditions**. Multiple counters read the same seat as free simultaneously before writing, causing double-booking and inflated sale claims (~0.31s). |
| **Version 3: Threaded (With Lock)** | `threaded_safe` | **4 Concurrent Threads** with `threading.Lock()` mutex synchronization. | Fast parallel speedup (~0.33s, **~4.5x faster** than sequential) with **0 race conflicts** and guaranteed data consistency. |

---

## 3. Presentation Guide for Group 1 (Tuesday Demo Flow)

1. **Introduction**: 
   - State the problem: In a cinema box office, multiple cashier counters sell tickets from one shared pool of seats (a shared critical resource).
2. **Demo 1 — Sequential Baseline**:
   - Click **Sequential**.
   - Show that seats fill up slowly (~1.51s) through Counter 1 (teal).
   - Point out: Safe, but slow due to single-threaded bottleneck.
3. **Demo 2 — Multi-threading without Locks (Race Conditions)**:
   - Click **Threaded (No Lock)**.
   - Show seats populating rapidly in 4 different colors, but seats in conflict flash red and shake.
   - Highlight the Live Stats: **Unique Seats: 30 vs. Total Claims: ~90-100+**, with multiple counters colliding on the same seats.
   - Point out: Concurrency is fast, but without synchronization, the critical section suffers from **Lost Updates** and **Double Booking**.
4. **Demo 3 — Multi-threading with Mutex Lock (Safe Parallelism)**:
   - Click **Threaded (With Lock)**.
   - Show the grid filling across 4 counters evenly with **0 conflicts**, clean data, and speedup (~0.33s).
   - Point out: `threading.Lock()` serializes the critical section (checking and booking a seat) while allowing the simulated ticket-printing/card-processing work to run fully in parallel.
5. **Review the Timing Comparison Bar Chart**:
   - Compare the final benchmarks directly on screen.
