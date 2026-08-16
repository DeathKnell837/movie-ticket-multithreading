import threading
import time
import random

class SeatPool:
    def __init__(self, rows=5, cols=8):
        self.rows = rows
        self.cols = cols
        self.total = rows * cols  # 40 seats
        self.grid = [[False]*cols for _ in range(rows)]  # False=available, True=sold
        self.sold_by = [[None]*cols for _ in range(rows)]  # counter_id that sold it
        self.lock = threading.Lock()
        self.conflicts = []  # list of {row, col, counter1, counter2}
        self.total_sales = 0  # incremented on every sale attempt (even double-sells)
    
    def reset(self):
        # Reset all state to initial
        with self.lock:
            self.grid = [[False]*self.cols for _ in range(self.rows)]
            self.sold_by = [[None]*self.cols for _ in range(self.rows)]
            self.conflicts = []
            self.total_sales = 0
    
    def find_and_sell(self, counter_id, mode='sequential'):
        """
        Scan the grid from top-left for the first available seat and sell it.
        
        mode='sequential': no delay, no lock (single thread, safe by design)
        mode='unsafe': random sleep (0.005-0.012s) between READ and WRITE, NO lock.
                        On conflict, records it but continues scanning for the next
                        available seat so the thread still makes progress.
        mode='safe': same sleep but wrapped in lock, so conflicts are impossible.
        
        Returns (row, col, is_conflict) or None if sold out.
        is_conflict here means a conflict was DETECTED during this call (even if
        the thread ultimately sold a different, clean seat).
        """
        if mode == 'safe':
            self.lock.acquire()
            
        try:
            conflict_detected = False
            did_race_check = False  # Only do the race window once per call
            for r in range(self.rows):
                for c in range(self.cols):
                    if not self.grid[r][c]:  # 1. READ: Check if available
                        if mode in ['unsafe', 'safe'] and not did_race_check:
                            # Random sleep creates realistic race window
                            # Only on the FIRST available seat found
                            time.sleep(random.uniform(0.005, 0.012))
                            did_race_check = True
                        
                        if self.grid[r][c]:  # Re-check: another thread sold it!
                            if mode == 'unsafe':
                                # Record the conflict — this seat was double-targeted
                                conflict_detected = True
                                self.conflicts.append({
                                    'row': r,
                                    'col': c,
                                    'counter1': self.sold_by[r][c],
                                    'counter2': counter_id
                                })
                                self.total_sales += 1
                                # Keep scanning for a truly free seat (no more sleeping)
                                continue
                        
                        # Seat is still free (or we're in safe mode) — claim it
                        self.grid[r][c] = True
                        self.sold_by[r][c] = counter_id
                        self.total_sales += 1
                        
                        return (r, c, conflict_detected)
            return None
        finally:
            if mode == 'safe':
                self.lock.release()
    
    def get_stats(self):
        """Return {total_sales, unique_sold, conflict_count, counter_counts}"""
        unique_sold = sum(1 for r in range(self.rows) for c in range(self.cols) if self.grid[r][c])
        counter_counts = {}
        for r in range(self.rows):
            for c in range(self.cols):
                cid = self.sold_by[r][c]
                if cid is not None:
                    counter_counts[str(cid)] = counter_counts.get(str(cid), 0) + 1
        return {
            'total_sales': self.total_sales,
            'unique_sold': unique_sold,
            'conflict_count': len(self.conflicts),
            'counter_counts': counter_counts
        }


class CustomerQueue:
    def __init__(self, n=30):
        self.remaining = n
        self.queue_lock = threading.Lock()  # Always locked, even in Version 2
        # The queue is NOT the shared resource under test — the seat pool is.
    
    def next(self):
        """Returns customer number (1-30) or None if empty."""
        with self.queue_lock:
            if self.remaining > 0:
                cust = 30 - self.remaining + 1
                self.remaining -= 1
                return cust
            return None


def counter_worker(pool, counter_id, queue, mode, on_sale_callback, on_conflict_callback=None):
    """
    The function each thread runs.
    Loop: get next customer from queue → find_and_sell → emit events → sleep.
    on_sale_callback(row, col, counter_id) — called for the seat actually sold.
    on_conflict_callback(conflict_dict) — called for each conflict detected during scan.
    """
    last_conflict_count = len(pool.conflicts)
    while True:
        customer = queue.next()
        if customer is None:
            break
        result = pool.find_and_sell(counter_id, mode)
        if result is not None:
            row, col, had_conflict = result
            
            # Emit any NEW conflicts that were added during this find_and_sell call
            if on_conflict_callback and had_conflict:
                new_conflicts = pool.conflicts[last_conflict_count:]
                for conflict in new_conflicts:
                    on_conflict_callback(conflict)
            last_conflict_count = len(pool.conflicts)
            
            # Emit the actual seat sold
            on_sale_callback(row, col, counter_id)
        time.sleep(0.03)  # simulate processing work (outside critical section)


def run_sequential(pool, queue, on_sale_callback):
    """
    Single thread, counter_id=1, mode='sequential'.
    Work delay: 0.05s per customer (slower than threaded to show the difference).
    Returns elapsed time in seconds.
    """
    start = time.perf_counter()
    while True:
        customer = queue.next()
        if customer is None:
            break
        result = pool.find_and_sell(1, 'sequential')
        if result is not None:
            row, col, _ = result
            on_sale_callback(row, col, 1)
        time.sleep(0.05)
    return time.perf_counter() - start


def run_threaded(pool, queue, on_sale_callback, use_lock=False, on_conflict_callback=None):
    """
    Spawn 4 threads (counter_id 1-4).
    mode = 'safe' if use_lock else 'unsafe'
    Start all, join all.
    Returns elapsed time in seconds.
    """
    mode = 'safe' if use_lock else 'unsafe'
    threads = []
    for i in range(1, 5):
        t = threading.Thread(target=counter_worker, args=(pool, i, queue, mode, on_sale_callback, on_conflict_callback))
        threads.append(t)
    start = time.perf_counter()
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return time.perf_counter() - start
