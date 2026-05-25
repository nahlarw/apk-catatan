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
function initCanvas() {
    canvas = document.getElementById('paintCanvas');
    ctx = canvas.getContext('2d');
    
    // Set resolusi internal canvas berdasarkan ukuran layarnya
    canvas.width = 380;
    canvas.height = 600;

    ctx.lineCap = 'round';
    ctx.lineWidth = 5;

    // Deteksi Mouse (Laptop)
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);

    // Deteksi Sentuhan (Handphone)
    canvas.addEventListener('touchstart', (e) => { startDrawing(e.touches[0]); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e.touches[0]); }, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
}

function openCanvasModal() {
    document.getElementById('canvasModal').style.display = 'flex';
    document.getElementById('plusDropdown').classList.remove('show');
    clearCanvas();
}
function closeCanvasModal() { document.getElementById('canvasModal').style.display = 'none'; }

function startDrawing(e) {
    isDrawing = true;
    ctx.beginPath();
    const rect = canvas.getBoundingClientRect();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

function draw(e) {
    if (!isDrawing) return;
    ctx.strokeStyle = currentColor;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
}

function stopDrawing() { isDrawing = false; }

function changeCanvasColor(color, element) {
    currentColor = color;
    document.querySelectorAll('.color-dot').forEach(dot => dot.classList.remove('active'));
    element.classList.add('active');
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function saveCanvasDrawing() {
    const dataURL = canvas.toDataURL();
    const imgHtml = `<img src="${dataURL}" class="canvas-drawn-img" style="border:1px solid #ddd;"><div><br></div>`;
    document.getElementById('noteBody').focus();
    document.execCommand('insertHTML', false, imgHtml);
    closeCanvasModal();
}

// STRUKTUR RESERVED DEFAULT CRUD APLIKASI
function saveNote() {
    const title = document.getElementById('noteTitle').value.trim();
    const body = document.getElementById('noteBody').innerHTML.trim();
    const folder = document.getElementById('noteFolder').value;
    
    if (!title && (body === '' || body === '<br>')) { closeModal(); return; }

    const today = new Date();
    const dateString = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`;

    if (editingNoteId) {
        const idx = notes.findIndex(n => n.id === editingNoteId);
        if (idx !== -1) {
            notes[idx].title = title;
            notes[idx].body = body;
            notes[idx].folder = folder;
        }
    } else {
        notes.unshift({ id: Date.now(), title, body, folder, date: dateString, favorite: false, inTrash: false });
    }
    saveData();
    closeModal();
}

function deleteNote(id, event) { event.stopPropagation(); const n = notes.find(n => n.id === id); if (n) { n.inTrash = true; n.favorite = false; saveData(); } }
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
}

function editNote(id) {
    const n = notes.find(n => n.id === id);
    if (n) {
        editingNoteId = id;
        document.getElementById('noteTitle').value = n.title;
        document.getElementById('noteBody').innerHTML = n.body;
        document.getElementById('noteFolder').value = n.folder;
        document.getElementById('noteModal').classList.add('open');
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
