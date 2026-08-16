const socket = io();
let seatElements = {};  
let isRunning = false;
let results = {};       
let currentMode = null;
let liveStats = { sold: 0, uniqueSeats: 0, conflicts: 0, counterCounts: {1:0, 2:0, 3:0, 4:0}, soldSet: new Set() };
const rowsAlphabet = ['A','B','C','D','E','F','G','H','I','J'];

function initSeatMap(rows=5, cols=8) {
    const grid = document.getElementById('seat-map');
    const rowLabels = document.getElementById('row-labels');
    grid.innerHTML = '';
    rowLabels.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    seatElements = {};

    for (let r = 0; r < rows; r++) {
        const rowChar = rowsAlphabet[r] || r;
        const labelDiv = document.createElement('div');
        labelDiv.className = 'row-label';
        labelDiv.innerText = rowChar;
        rowLabels.appendChild(labelDiv);

        for (let c = 0; c < cols; c++) {
            const seatId = `${r}-${c}`;
            const seat = document.createElement('div');
            seat.className = 'seat';
            seat.dataset.row = r;
            seat.dataset.col = c;
            seat.innerText = `${rowChar}${c+1}`;
            grid.appendChild(seat);
            seatElements[seatId] = seat;
        }
    }
}

function updateSeat(row, col, counter, isConflict) {
    const seatId = `${row}-${col}`;
    const seat = seatElements[seatId];
    if (!seat) return;

    seat.className = 'seat';
    
    // Force reflow for animation
    void seat.offsetWidth;
    
    seat.classList.add(`sold-${counter}`);
    seat.classList.add('seat-pop');
    
    if (isConflict) {
        seat.classList.add('conflict');
    }

    setTimeout(() => seat.classList.remove('seat-pop'), 300);
}

function resetSeatMap() {
    for (const key in seatElements) {
        seatElements[key].className = 'seat';
    }
    liveStats = { sold: 0, uniqueSeats: 0, conflicts: 0, counterCounts: {1:0, 2:0, 3:0, 4:0}, soldSet: new Set() };
    updateLiveStats();
}

function updateLiveStats() {
    document.getElementById('stat-unique').innerText = liveStats.uniqueSeats;
    document.getElementById('stat-sold').innerText = liveStats.sold;
    const conflictsEl = document.getElementById('stat-conflicts');
    conflictsEl.innerText = liveStats.conflicts;
    if (liveStats.conflicts > 0) {
        conflictsEl.classList.add('has-conflicts');
    } else {
        conflictsEl.classList.remove('has-conflicts');
    }
    
    // Highlight total claims in red if it doesn't match unique (race condition!)
    const soldEl = document.getElementById('stat-sold');
    if (liveStats.sold !== liveStats.uniqueSeats && liveStats.sold > 0) {
        soldEl.classList.add('has-conflicts');
    } else {
        soldEl.classList.remove('has-conflicts');
    }
    
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`stat-c${i}`).innerText = liveStats.counterCounts[i];
    }
}

function addLogEntry(message, type) {
    const log = document.getElementById('event-log');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric", fractionalSecondDigits: 2 });
    
    let tagHtml = '<span class="log-tag tag-info">INFO</span>';
    if (type === 'conflict') {
        tagHtml = '<span class="log-tag tag-conflict">CONFLICT</span>';
    } else if (type === 'complete') {
        tagHtml = '<span class="log-tag tag-complete">DONE</span>';
    }

    entry.innerHTML = `
        <span class="log-time">[${time}]</span> 
        ${tagHtml} 
        <span class="log-text log-${type}">${message}</span>
    `;
    log.appendChild(entry);
    
    if (log.children.length > 200) {
        log.removeChild(log.firstChild);
    }
    
    log.scrollTop = log.scrollHeight;
}

function showToast(message, type='conflict') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconSvg = '';
    if (type === 'conflict') {
        iconSvg = `
            <svg class="toast-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
        `;
    } else {
        iconSvg = `
            <svg class="toast-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;
    }

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        if(container.contains(toast)) container.removeChild(toast);
    }, 4000);
    
    if (container.children.length > 3) {
        container.removeChild(container.firstChild);
    }
}

function updateTimingChart() {
    const container = document.getElementById('timing-bars');
    container.innerHTML = '';
    
    let maxTime = 0;
    for (const key in results) {
        if (results[key].elapsed > maxTime) maxTime = results[key].elapsed;
    }
    
    const svgCheck = `<svg class="status-svg success" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const svgWarn = `<svg class="status-svg warn" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;

    const labels = {
        'sequential': { name: 'Sequential', class: 'seq', defaultIcon: svgCheck },
        'threaded_unsafe': { name: 'Unsafe', class: 'unsafe', defaultIcon: svgWarn },
        'threaded_safe': { name: 'Safe', class: 'safe', defaultIcon: svgCheck }
    };

    for (const mode in results) {
        const res = results[mode];
        const info = labels[mode] || { name: mode, class: 'seq', defaultIcon: '' };
        const iconSvg = (mode === 'threaded_unsafe' && res.conflict_count > 0) ? svgWarn : info.defaultIcon;
        
        const pct = maxTime > 0 ? (res.elapsed / maxTime) * 100 : 0;
        
        const html = `
            <div class="timing-bar-container">
                <div class="timing-label">${info.name}</div>
                <div class="timing-track">
                    <div class="timing-fill ${info.class}" style="width: ${pct}%"></div>
                </div>
                <div class="timing-val">
                    <span>${res.elapsed.toFixed(3)}s</span>
                    ${iconSvg}
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    }
}

function startSimulation(mode) {
    if (isRunning) return;
    isRunning = true;
    currentMode = mode;
    
    const btns = document.querySelectorAll('.controls-card button');
    btns.forEach(b => {
        b.disabled = true;
        b.classList.remove('active-seq', 'active-unsafe', 'active-safe');
    });
    
    let activeClass = 'active-seq';
    if(mode === 'threaded_unsafe') activeClass = 'active-unsafe';
    if(mode === 'threaded_safe') activeClass = 'active-safe';
    
    const map = {
        'sequential': 'btn-sequential',
        'threaded_unsafe': 'btn-threaded-unsafe',
        'threaded_safe': 'btn-threaded-safe'
    };
    if (map[mode]) {
        document.getElementById(map[mode]).classList.add(activeClass);
    }
    
    resetSeatMap();
    document.getElementById('event-log').innerHTML = '';
    document.getElementById('mode-badge').innerText = mode.toUpperCase().replace('_', ' ');
    
    socket.emit('start_simulation', { mode });
}

function resetAll() {
    socket.emit('reset');
    resetSeatMap();
    document.getElementById('event-log').innerHTML = '';
    results = {};
    updateTimingChart();
    
    document.getElementById('mode-badge').innerText = 'IDLE';
    
    const btns = document.querySelectorAll('.controls-card button');
    btns.forEach(b => {
        b.disabled = false;
        b.classList.remove('active-seq', 'active-unsafe', 'active-safe');
    });
    isRunning = false;
}

// Socket Events
socket.on('simulation_started', (data) => {
    initSeatMap(data.rows || 5, data.cols || 8);
    document.getElementById('mode-badge').innerText = (data.mode || currentMode).toUpperCase().replace('_', ' ');
    addLogEntry(`Simulation started: ${data.mode}`, 'info');
});

socket.on('seat_update', (data) => {
    if (data.reset) {
        resetSeatMap();
        return;
    }
    
    updateSeat(data.row, data.col, data.counter, data.conflict);
    
    liveStats.sold++;
    const seatKey = `${data.row}-${data.col}`;
    if (!liveStats.soldSet.has(seatKey)) {
        liveStats.soldSet.add(seatKey);
        liveStats.uniqueSeats++;
    }
    if (data.counter >= 1 && data.counter <= 4) {
        liveStats.counterCounts[data.counter]++;
    }
    
    if (data.conflict) {
        liveStats.conflicts++;
        const rowChar = rowsAlphabet[data.row] || data.row;
        showToast(`Conflict on Seat ${rowChar}${data.col+1}! Counters ${data.prev_counter} & ${data.counter} collided`, 'conflict');
    }
    
    updateLiveStats();
});

socket.on('log_entry', (data) => {
    addLogEntry(data.message, data.type);
});

socket.on('simulation_complete', (data) => {
    results[data.mode] = data;
    updateLiveStats();
    updateTimingChart();
    
    isRunning = false;
    const btns = document.querySelectorAll('.controls-card button');
    btns.forEach(b => b.disabled = false);
    
    showToast(`Simulation complete: ${data.mode}`, 'success');
});

// Event Listeners
document.getElementById('btn-sequential').addEventListener('click', () => startSimulation('sequential'));
document.getElementById('btn-threaded-unsafe').addEventListener('click', () => startSimulation('threaded_unsafe'));
document.getElementById('btn-threaded-safe').addEventListener('click', () => startSimulation('threaded_safe'));
document.getElementById('btn-reset').addEventListener('click', resetAll);

// Init
window.addEventListener('DOMContentLoaded', () => {
    initSeatMap(5, 8);
    updateLiveStats();
});
