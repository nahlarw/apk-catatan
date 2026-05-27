let notes = JSON.parse(localStorage.getItem('notes')) || [];

let currentFilter = 'all';
let editingNoteId = null;

// Variabel untuk fitur Gambar & Lukisan (Canvas)
let canvas, ctx, isDrawing = false;
let currentColor = '#85929E';

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('appTheme') || 'light';
    document.body.className = savedTheme === 'dark' ? 'theme-dark' : 'theme-light';
    const savedLayout = localStorage.getItem('appLayout') || 'kisi';
    changeLayout(savedLayout);

    renderNotes();
    updateCounters();
    initCanvas();
});

function renderNotes(filteredNotes = null) {
    const grid = document.getElementById('notesGrid');
    grid.innerHTML = '';
    
    let dataToRender = filteredNotes || notes;

    if (!filteredNotes) {
        if (currentFilter === 'Sampah') dataToRender = notes.filter(n => n.inTrash);
        else if (currentFilter === 'Favorit') dataToRender = notes.filter(n => n.favorite && !n.inTrash);
        else if (currentFilter === 'all') dataToRender = notes.filter(n => !n.inTrash);
        else dataToRender = notes.filter(n => n.folder === currentFilter && !n.inTrash);
    }

    dataToRender.sort((a, b) => b.favorite - a.favorite);

    if (dataToRender.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); margin-top: 40px; font-size: 14px;">Tidak ada catatan</div>`;
        return;
    }

    dataToRender.forEach(note => {
        const card = document.createElement('div');
        card.className = 'note-card';
        if (!note.inTrash) card.onclick = () => editNote(note.id);
        
        let actionButtons = note.inTrash ? `
            <i class="fas fa-undo-alt restore-btn" onclick="restoreNote(${note.id}, event)"></i>
            <i class="far fa-trash-alt delete-btn" onclick="permaDeleteNote(${note.id}, event)"></i>
        ` : `
            <i class="${note.favorite ? 'fas' : 'far'} fa-star" style="color: ${note.favorite ? '#f1c40f' : 'inherit'};" onclick="toggleFavorite(${note.id}, event)"></i>
            <i class="far fa-trash-alt delete-btn" onclick="deleteNote(${note.id}, event)"></i>
        `;

        card.innerHTML = `
            <div>
                <div class="note-title">${note.title || 'Tanpa Judul'}</div>
                <div class="note-body">${note.body || 'Tidak ada teks tambahan'}</div>
            </div>
            <div class="note-footer">
                <span>${note.date} ${note.inTrash ? '' : '| ' + note.folder}</span>
                <div style="display:flex; gap: 14px; align-items:center;">${actionButtons}</div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// 1. FITUR BARU: EDIT PENULISAN (Rich Text Format)
function formatDoc(command) {
    document.execCommand(command, false, null);
    document.getElementById('noteBody').focus();
}

// 2. FITUR BARU: MANAJEMEN PLUS MENU (LALUAN INPUT)
function togglePlusMenu(e) {
    e.stopPropagation();
    document.getElementById('plusDropdown').classList.toggle('show');
}

// A. Sub-Fitur: Tambah Gambar
function triggerImageUpload() {
    document.getElementById('imageInput').click();
    document.getElementById('plusDropdown').classList.remove('show');
}

function insertImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgHtml = `<img src="${e.target.result}" alt="Gambar Lampiran"><div><br></div>`;
            document.getElementById('noteBody').focus();
            document.execCommand('insertHTML', false, imgHtml);
        }
        reader.readAsDataURL(file);
    }
}

// B. Sub-Fitur: Tambah Tabel
function openTableModal() {
    document.getElementById('tableModal').style.display = 'flex';
    document.getElementById('plusDropdown').classList.remove('show');
}
function closeTableModal() { document.getElementById('tableModal').style.display = 'none'; }

function insertTable() {
    const rows = document.getElementById('tableRows').value;
    const cols = document.getElementById('tableCols').value;
    
    let tableHtml = '<table>';
    for (let i = 0; i < rows; i++) {
        tableHtml += '<tr>';
        for (let j = 0; j < cols; j++) {
            tableHtml += '<td>&nbsp;</td>';
        }
        tableHtml += '</tr>';
    }
    tableHtml += '</table><div><br></div>';
    
    document.getElementById('noteBody').focus();
    document.execCommand('insertHTML', false, tableHtml);
    closeTableModal();
}

// C. Sub-Fitur: Lukisan (Canvas Drawing)
// C. Sub-Fitur: Lukisan (Canvas Drawing)
let currentCanvasTool = 'pen';
let canvasSize = 4;
let canvasUndoStack = [];
let canvasRedoStack = [];

function initCanvas() {
    canvas = document.getElementById('paintCanvas');
    ctx = canvas.getContext('2d');
    canvas.style.touchAction = 'none';

    // Event Handler Universal (Mendukung mouse & touch Hp agar kursor tidak geser)
    canvas.addEventListener('pointerdown', startDrawing);
    canvas.addEventListener('pointermove', draw);
    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointerout', stopDrawing);
}

function resizeCanvasToDisplay() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

function openCanvasModal() {
    document.getElementById('canvasModal').style.display = 'flex';
    document.getElementById('plusDropdown').classList.remove('show');
    
    resizeCanvasToDisplay();
    
    // Reset data riwayat coretan setiap kali kanvas baru dibuka
    canvasUndoStack = [];
    canvasRedoStack = [];
    saveCanvasState(); // Simpan kondisi awal kanvas kosong
    
    selectCanvasTool('pen');
}

function closeCanvasModal() { 
    document.getElementById('canvasModal').style.display = 'none'; 
}

// Menyimpan snapshot gambar saat ini untuk fitur Undo/Redo
function saveCanvasState() {
    if (canvasUndoStack.length >= 20) canvasUndoStack.shift(); // Batasi maksimal 20 history memori
    canvasUndoStack.push(canvas.toDataURL());
    canvasRedoStack = []; // Reset setiap ada coretan baru
}

// Fungsi Mengembalikan Gambaran Sebelumnya (UNDO)
function undoCanvas() {
    if (canvasUndoStack.length > 1) {
        canvasRedoStack.push(canvasUndoStack.pop());
        const previousState = canvasUndoStack[canvasUndoStack.length - 1];
        restoreCanvasState(previousState);
    }
}

// Fungsi Maju ke Gambaran Depannya (REDO)
function redoCanvas() {
    if (canvasRedoStack.length > 0) {
        const nextState = canvasRedoStack.pop();
        canvasUndoStack.push(nextState);
        restoreCanvasState(nextState);
    }
}

function restoreCanvasState(dataUrl) {
    const img = new Image();
    img.src = dataUrl;
    img.onload = function() {
        ctx.globalCompositeOperation = 'source-over'; // Normalisasi komposit saat menimpa state
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        // Kembalikan ke tool aktif semula setelah merestore gambar
        selectCanvasTool(currentCanvasTool);
    };
}

// Mengatur pilihan mode alat (Pen, Kuas, Eraser)
function selectCanvasTool(tool) {
    currentCanvasTool = tool;
    
    const penEl = document.getElementById('penTool');
    const brushEl = document.getElementById('brushTool');
    const eraserEl = document.getElementById('eraserTool');

    // Reset warna text ikon tool di bawah
    if(penEl) penEl.style.color = "#aaa";
    if(brushEl) brushEl.style.color = "#aaa";
    if(eraserEl) eraserEl.style.color = "#aaa";

    if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        canvasSize = 24; // Penghapus dibuat tebal
        if(eraserEl) eraserEl.style.color = "#fff";
    } else if (tool === 'brush') {
        ctx.globalCompositeOperation = 'source-over';
        canvasSize = 12; // Mode kuas dibuat tebal meliuk
        if(brushEl) brushEl.style.color = "#fff";
    } else {
        ctx.globalCompositeOperation = 'source-over';
        canvasSize = 4;  // Mode pulpen tipis presisi
        if(penEl) penEl.style.color = "#fff";
    }
}

function startDrawing(e) {
    isDrawing = true;
    ctx.beginPath();
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.moveTo(x, y);
}

function draw(e) {
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineWidth = canvasSize;
    ctx.strokeStyle = currentColor;
    
    ctx.lineTo(x, y);
    ctx.stroke();
}

function stopDrawing() { 
    if (isDrawing) {
        isDrawing = false; 
        ctx.beginPath();
        saveCanvasState(); // Simpan coretan ke history setelah jari diangkat
    }
}

function changeCanvasColor(color, element) {
    // Jika warna diklik saat pakai penghapus, otomatis balikkan ke mode pulpen aktif
    if (currentCanvasTool === 'eraser') {
        selectCanvasTool('pen');
    }
    
    currentColor = color;
    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.classList.remove('active');
        dot.style.border = 'none';
    });
    element.classList.add('active');
    element.style.border = '2px solid #fff';
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveCanvasState(); // Catat history papan kosong
}

function saveCanvasDrawing() {
    const dataURL = canvas.toDataURL();
    ctx.globalCompositeOperation = 'source-over';
    
    const imgHtml = `<img src="${dataURL}" class="canvas-drawn-img" style="max-width:100%; height:auto; border:1px solid #ddd; display:block; margin:8px 0;"><div><br></div>`;
    document.getElementById('noteBody').focus();
    document.execCommand('insertHTML', false, imgHtml);
    closeCanvasModal();
}

function deleteNote(id, event) { event.stopPropagation(); if (confirm("Apakah kamu yakin ingin menghapus catatan ini?")) {const n = notes.find(n => n.id === id); if (n) { n.inTrash = true; n.favorite = false; saveData(); } } }
function restoreNote(id, event) { event.stopPropagation(); const n = notes.find(n => n.id === id); if (n) { n.inTrash = false; saveData(); } }
function permaDeleteNote(id, event) { event.stopPropagation(); if(confirm("Hapus permanen?")) { notes = notes.filter(n => n.id !== id); saveData(); } }

function searchNotes() {
    const q = document.getElementById('searchInput').value.toLowerCase().trim();
    if (q === '') { renderNotes(); return; }
    const filtered = notes.filter(n => {
        if (n.inTrash) return false;
        const matchTitle = n.title && n.title.toLowerCase().includes(q);
        const matchBody = n.body && n.body.toLowerCase().includes(q);
        const matchFolder = n.folder && n.folder.toLowerCase().includes(q);
        return matchTitle || matchBody || matchFolder;
    });
    renderNotes(filtered);
}

function filterCategory(category, element) {
    currentFilter = category;
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('remove', 'active'));
    element.classList.add('active');
    document.getElementById('current-view-title').innerText = category === 'all' ? 'Semua catatan' : category;
    document.getElementById('fabBtn').style.display = category === 'Sampah' ? 'none' : 'flex';
    closeAllMenus();
    renderNotes();
}

function toggleFavorite(id, event) { event.stopPropagation(); const n = notes.find(n => n.id === id); if (n) { n.favorite = !n.favorite; saveData(); } }
function changeTheme(t) { document.body.className = t === 'dark' ? 'theme-dark' : 'theme-light'; document.documentElement.className = t === 'dark' ? 'theme-dark' : 'theme-light'; localStorage.setItem('appTheme', t); closeAllMenus();}
function changeLayout(l) {const grid = document.getElementById('notesGrid');
    if (grid) {
        grid.className = l === 'kisi' ? 'notes-grid layout-kisi' : 'notes-grid layout-daftar'; 
    }
    localStorage.setItem('appLayout', l); 
    closeAllMenus(); 
}

// Pengontrol Dropdown & Penutup Otomatis Aman
function toggleSettingsMenu(e) { e.stopPropagation(); document.getElementById('viewDropdown').classList.remove('show'); document.getElementById('settingsDropdown').classList.toggle('show'); }
var plusDrop = document.getElementById('plusDropdown');
function toggleViewMenu(e) { e.stopPropagation(); document.getElementById('settingsDropdown').classList.remove('show'); document.getElementById('viewDropdown').classList.toggle('show'); }

function closeAllMenus() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
    document.getElementById('settingsDropdown').classList.remove('show');
    document.getElementById('viewDropdown').classList.remove('show');
    document.getElementById('plusDropdown').classList.remove('show');
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('overlay').classList.toggle('active'); }
function toggleSearch() { const c = document.getElementById('searchContainer'); c.classList.toggle('active'); if (c.classList.contains('active')) document.getElementById('searchInput').focus(); else { document.getElementById('searchInput').value = ''; renderNotes(); } }

function openModal() {
    editingNoteId = null;
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteBody').innerHTML = '';
    document.getElementById('noteFolder').value = 'Kerja';
    document.getElementById('noteModal').classList.add('open');

    history.pushState({ modalOpen: true }, '');
}

function editNote(id) {
    const n = notes.find(n => n.id === id);
    if (n) {
        editingNoteId = id;
        document.getElementById('noteTitle').value = n.title;
        document.getElementById('noteBody').innerHTML = n.body;
        document.getElementById('noteFolder').value = n.folder;
        document.getElementById('noteModal').classList.add('open');

        history.pushState({ modalOpen: true }, '');
    }
}
function closeModal() { document.getElementById('noteModal').classList.remove('open'); }
function saveData() { localStorage.setItem('notes', JSON.stringify(notes)); renderNotes(); updateCounters(); }

function updateCounters() {
    document.getElementById('count-all').innerText = notes.filter(n => !n.inTrash).length;
    document.getElementById('count-fav').innerText = notes.filter(n => n.favorite && !n.inTrash).length;
    document.getElementById('count-kerja').innerText = notes.filter(n => n.folder === 'Kerja' && !n.inTrash).length;
    document.getElementById('count-pribadi').innerText = notes.filter(n => n.folder === 'Pribadi' && !n.inTrash).length;
    document.getElementById('count-kuliah').innerText = notes.filter(n => n.folder === 'Kuliah' && !n.inTrash).length;
    document.getElementById('count-trash').innerText = notes.filter(n => n.inTrash).length;
}

window.onclick = function(event) {
    if (event.target.matches('.fa-bars') || event.target.closest('#sidebar')) {
        return;
    }
    if (!event.target.matches('.fa-ellipsis-v') && !event.target.matches('.fa-cog') && !event.target.matches('.fa-plus')) {
        closeAllMenus();
    }
}

window.addEventListener('popstate', function (event) {
    const modal = document.getElementById('noteModal');
    if (modal && modal.classList.contains('open')) {
        modal.classList.remove('open');
    }
});
