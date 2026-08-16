from flask import Flask, render_template
from flask_socketio import SocketIO
from booking_engine import SeatPool, CustomerQueue, run_sequential, run_threaded
import os
import time

app = Flask(__name__)
app.config['SECRET_KEY'] = 'parallel-computing-group1'
socketio = SocketIO(app, async_mode='threading', cors_allowed_origins='*')

pool = SeatPool(rows=5, cols=8)

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('start_simulation')
def handle_start(data):
    mode = data.get('mode', 'sequential')
    pool.reset()
    queue = CustomerQueue(30)
    
    # Emit simulation_started
    socketio.emit('simulation_started', {
        'mode': mode,
        'rows': pool.rows,
        'cols': pool.cols,
        'num_customers': 30
    })
    
    def on_sale(row, col, counter_id):
        """Called when a seat is actually sold (no conflict on this specific seat)."""
        socketio.emit('seat_update', {
            'row': row,
            'col': col,
            'counter': counter_id,
            'conflict': False,
            'prev_counter': None,
            'timestamp': time.time()
        })
        socketio.emit('log_entry', {
            'message': f'Counter {counter_id} sold seat {chr(65+row)}{col+1}',
            'type': 'info',
            'timestamp': time.time()
        })
    
    def on_conflict(conflict_dict):
        """Called for each race condition detected (seat was targeted by multiple counters)."""
        row = conflict_dict['row']
        col = conflict_dict['col']
        c1 = conflict_dict['counter1']
        c2 = conflict_dict['counter2']
        socketio.emit('seat_update', {
            'row': row,
            'col': col,
            'counter': c2,
            'conflict': True,
            'prev_counter': c1,
            'timestamp': time.time()
        })
        socketio.emit('log_entry', {
            'message': f'RACE CONDITION: Seat {chr(65+row)}{col+1} targeted by Counter {c1} and Counter {c2} simultaneously',
            'type': 'conflict',
            'timestamp': time.time()
        })
    
    # Run the simulation in a background thread so Flask doesn't block
    def run_sim():
        if mode == 'sequential':
            elapsed = run_sequential(pool, queue, on_sale)
        elif mode == 'threaded_unsafe':
            elapsed = run_threaded(pool, queue, on_sale, use_lock=False, on_conflict_callback=on_conflict)
        elif mode == 'threaded_safe':
            elapsed = run_threaded(pool, queue, on_sale, use_lock=True)
        else:
            return
        
        stats = pool.get_stats()
        socketio.emit('simulation_complete', {
            'mode': mode,
            'elapsed': round(elapsed, 4),
            'total_sales': stats['total_sales'],
            'unique_sold': stats['unique_sold'],
            'conflict_count': stats['conflict_count'],
            'conflicts': pool.conflicts,
            'counter_counts': stats['counter_counts']
        })
        socketio.emit('log_entry', {
            'message': f'Simulation complete: Elapsed {elapsed:.4f}s | Unique Sold: {stats["unique_sold"]} | Conflicts: {stats["conflict_count"]}',
            'type': 'complete',
            'timestamp': time.time()
        })
    
    socketio.start_background_task(run_sim)

@socketio.on('reset')
def handle_reset():
    pool.reset()
    socketio.emit('seat_update', {'reset': True})
    socketio.emit('log_entry', {
        'message': 'Seat pool reset to initial state',
        'type': 'info',
        'timestamp': time.time()
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=False, allow_unsafe_werkzeug=True)
