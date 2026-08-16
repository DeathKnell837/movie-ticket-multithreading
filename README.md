# CineBook — Movie Ticket Booking System
### Parallel Computing Midterm Project | Group 1: Lacay, Bacanto, Bravo

> 🌐 **Live Web Application (Deployed on Render)**:  
> 👉 **[https://movie-ticket-multithreading.onrender.com](https://movie-ticket-multithreading.onrender.com)**
>
> 📦 **GitHub Repository**:  
> 👉 **[https://github.com/DeathKnell837/movie-ticket-multithreading](https://github.com/DeathKnell837/movie-ticket-multithreading)**

---

A real-time, interactive simulation comparing **Sequential Processing**, **Multi-threading with Race Conditions (Unsafe)**, and **Multi-threading with Synchronization Locks (Safe)** using Python, Flask-SocketIO, and a modern Cinema Box-Office Web Dashboard with real-time customer journey animations and custom vector SVG icons.

---

## 1. Quick Start Guide (Run Locally)

### Step 1: Install Dependencies
Open PowerShell or Command Prompt in this folder and run:
```bash
pip install -r requirements.txt
```

### Step 2: Launch the Server
```bash
python app.py
```

### Step 3: Open in Browser
Open your browser and visit:
```
http://localhost:5000
```

---

## 2. Project Architecture & Concurrency Models

```
                            [ Web Browser Dashboard ]
                                       ▲
                                       │ Real-Time WebSocket Events
                                       ▼
                             [ Flask-SocketIO App ]
                                       │
                ┌──────────────────────┼──────────────────────┐
                ▼                      ▼                      ▼
        [ 1. Sequential ]     [ 2. Threaded Unsafe ]   [ 3. Threaded Safe ]
         • Single Thread       • 4 Concurrent Threads   • 4 Concurrent Threads
         • No Concurrency      • No Mutex Lock          • threading.Lock() Mutex
         • Slow (~1.51s)       • Severe Race Condition  • Fast (~0.33s, 4.5x faster)
         • 0 Conflicts         • 60-70+ Conflicts       • 0 Conflicts (100% Safe)
```

---

## 3. Concurrency Comparison Matrix

| Version | Mode | Concurrency Model | Expected Behavior & Benchmark |
|---|---|---|---|
| **Version 1: Sequential** | `sequential` | **Single Thread** (Counter 1 only). Customers served sequentially in a FIFO queue. | Baseline execution time (~1.51s). Zero race conditions, 100% correct seat allocation. |
| **Version 2: Threaded (No Lock)** | `threaded_unsafe` | **4 Concurrent Threads** without Mutex protection. | Demonstrates **Critical Section Race Conditions**. Multiple counters read the same seat as free simultaneously before writing, causing double-booking, corrupted sale claims (~95–100+ claims for 30 seats), and pulsing red conflict seats (~0.31s). |
| **Version 3: Threaded (With Lock)** | `threaded_safe` | **4 Concurrent Threads** with `threading.Lock()` mutex synchronization. | Fast parallel speedup (~0.33s, **~4.5x faster** than sequential) with **0 race conflicts** and guaranteed data consistency across all 4 counters. |

---

## 4. Visual Elements & Features

- **Two-Stage Customer Journey Animation**: Waiting customers slide from the queue track down to their designated Cashier Counter, then hop directly onto their assigned seat in the grid.
- **High-Contrast Color Coding**:
  - **Counter 1**: Teal (`#2ec4b6`)
  - **Counter 2**: Amber Gold (`#e8a838`)
  - **Counter 3**: Electric Purple (`#a855f7`)
  - **Counter 4**: Royal Blue (`#4361ee`)
  - **Race Conflict**: Glowing Crimson Red (`#ff2e63`) with shaking animation
- **Custom Vector SVG Icons**: Clean cinema and threading icons (no raw emojis).
- **Responsive Layout**: Designed for both desktop projectors and mobile smartphones.

---

## 5. Presentation Demo Flow for Group 1 (Tuesday)

1. **Open the Live App**: Visit [https://movie-ticket-multithreading.onrender.com](https://movie-ticket-multithreading.onrender.com).
2. **Demo 1 — Sequential Baseline**: Click `▶ Sequential`. Explain how a single counter creates a bottleneck (~1.51s).
3. **Demo 2 — Multi-threading without Locks**: Click `▶ Threaded (No Lock)`. Show race condition double-bookings, glowing red conflict seats, and total claims exceeding physical capacity.
4. **Demo 3 — Multi-threading with Mutex Locks**: Click `▶ Threaded (With Lock)`. Show 4.5x speedup with clean, conflict-free seat allocation across all 4 counters.
5. **Review Timing Comparison**: Point to the animated comparative benchmark bars at the bottom.
