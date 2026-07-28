// ISI DENGAN DATA PROYEK SUPABASE ANDA SENDIRI
const SUPABASE_URL = 'https://xvgdkpgkxbskkxdfcyqy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2Z2RrcGdreGJza2t4ZGZjeXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNDYzODcsImV4cCI6MjEwMDgyMjM4N30.XTWYWxHK-lcPzpka7fuFddYYgz5AVz2T15ri2uVXaCQ'; 

// Membuat Inisialisasi Koneksi ke SDK Cloud Supabase
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let activeMode = ''; // Menyimpan status kategori form ('atasan' / 'bawahan')
let currentUser = ''; // Menyimpan nama pemilik tailor pasca login
let selectedOrderForPrint = null; // Data order terpilih untuk penyaringan cetak ukuran

// 1. OTENTIKASI & INITIALISASI DASHBOARD
async function initApp() {
    currentUser = document.getElementById('owner-name').value.trim();
    if(!currentUser) return alert("Silakan masukkan nama pemilik untuk membuka data jaitan!");
    
    try {
        // Melakukan test ping koneksi langsung ke Supabase Cloud
        const { data, error } = await _supabase.from('pesanan').select('id_order').limit(1);
        if (error) {
            console.error("Kesalahan Validasi Database:", error);
            return alert("Koneksi Database Cloud Gagal! Periksa apakah ANON_KEY sudah dimasukkan dengan benar.");
        }
        
        // Pindah Tampilan jika login sukses
        document.getElementById('display-user').innerText = currentUser;
        document.getElementById('login-sec').classList.add('hidden');
        document.getElementById('main-dash').classList.remove('hidden');
        
        // Atur default tanggal input hari ini
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('p-masuk').value = today;

        fetchOrdersFromCloud(); // Muat data riwayat dari PostgreSQL cloud
    } catch (err) {
        alert("Sistem bermasalah saat terhubung ke server. Hubungi Admin.");
    }
}

// 2. NAVIGASI FORM DINAMIS
function showForm(mode) {
    activeMode = mode;
    document.getElementById('order-form').classList.remove('hidden');
    document.getElementById('form-title').innerText = "Form Input Jaitan " + mode.toUpperCase();
    document.getElementById('ukuran-container').classList.add('hidden');
    document.getElementById('btn-next').classList.remove('hidden');
    clearFormFields();
}

function proceedToMeasureForm() {
    const namaPelanggan = document.getElementById('p-nama').value.trim();
    if(!namaPelanggan) return alert("Wajib mengisi nama pelanggan terlebih dahulu!");
    
    document.getElementById('ukuran-container').classList.remove('hidden');
    document.getElementById('btn-next').classList.add('hidden');
    
    // Tampilkan panel input parameter ukuran sesuai opsi jaitan
    document.getElementById('form-atasan').classList.toggle('hidden', activeMode !== 'atasan');
    document.getElementById('form-bawahan').classList.toggle('hidden', activeMode !== 'bawahan');
    if(activeMode === 'bawahan') switchBawahanSubFields();
}

function switchBawahanSubFields() {
    const tipeBawahan = document.getElementById('select-bawahan').value;
    document.getElementById('field-celana').classList.toggle('hidden', tipeBawahan !== 'celana');
    document.getElementById('field-rok').classList.toggle('hidden', tipeBawahan !== 'rok');
}

// 3. CREATE: SIMPAN DATA KE CLOUD SUPABASE
async function saveToSupabaseCloud() {
    // Generate nomor order unik berbasis Timestamp (Contoh: SMZ-4567)
    const idOrder = "SMZ-" + Date.now().toString().slice(-4);
    
    let detailUkuranJson = {};
    // Ekstraksi nilai input ukuran secara dinamis berbasis class penanda
    let targetSelector = '';
    if(activeMode === 'atasan') {
        targetSelector = '.val-atasan';
    } else {
        const tipe = document.getElementById('select-bawahan').value;
        targetSelector = (tipe === 'celana') ? '.val-celana' : '.val-rok';
    }
    
    document.querySelectorAll(targetSelector).forEach(input => {
        detailUkuranJson[input.getAttribute('data-label')] = input.value || "0";
    });

    const payload = {
        id_order: idOrder,
        nama_pelanggan: document.getElementById('p-nama').value,
        nama_pemilik: currentUser,
        kategori: activeMode,
        jenis_pakaian: document.getElementById('p-jenis').value || activeMode,
        harga: parseFloat(document.getElementById('p-harga').value) || 0,
        tgl_masuk: document.getElementById('p-masuk').value,
        tgl_jemput: document.getElementById('p-jemput').value,
        detail_ukuran: detailUkuranJson
    };

    const { data, error } = await _supabase.from('pesanan').insert([payload]);

    if(error) {
        alert("Gagal Menyimpan: " + error.message);
    } else {
        alert(`Pesanan ${idOrder} Berhasil Disimpan Secara Aman di Cloud!`);
        document.getElementById('order-form').classList.add('hidden');
        fetchOrdersFromCloud();
    }
}

// 4. READ: AMBIL DATA DARI CLOUD POSTGRESQL & GENERATE BARCODE
async function fetchOrdersFromCloud() {
    const { data, error } = await _supabase.from('pesanan').select('*').order('created_at', { ascending: false });
    if(error) return console.error("Gagal memuat riwayat data:", error.message);
    
    const tableBody = document.getElementById('data-list');
    tableBody.innerHTML = '';
    
    data.forEach(order => {
        const rowHTML = `<tr>
            <td><input type="checkbox" class="cb-order" value="${order.id_order}"></td>
            <td><b>${order.id_order}</b></td>
            <td>${order.nama_pelanggan}</td>
            <td>${order.jenis_pakaian}</td>
            <td>Rp ${Number(order.harga).toLocaleString('id-ID')}</td>
            <td>${order.tgl_jemput || '-'}</td>
            <td><svg id="barcode-target-${order.id_order}" class="barcode-svg"></svg></td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="btn btn-primary" style="padding:6px 12px; font-size:11px;" onclick="openPrintUkuranModal('${order.id_order}')">🖨️ Cetak Ukuran</button>
                    <button class="btn btn-outline" style="padding:6px 12px; font-size:11px;" onclick="deleteOrderDirect('${order.id_order}')">Hapus</button>
                </div>
            </td>
        </tr>`;
        tableBody.insertAdjacentHTML('beforeend', rowHTML);
        
        // Membuat gambar barcode berbasis lib JsBarcode secara asinkronus
        setTimeout(() => {
            JsBarcode(`#barcode-target-${order.id_order}`, order.id_order, {
                format: "CODE128",
                width: 1.2,
                height: 35,
                displayValue: true,
                fontSize: 11
            });
        }, 50);
    });
}

// 5. DELETE: HAPUS DATA LANGSUNG DARI INTERFACE APLIKASI
async function deleteOrderDirect(idOrderParam) {
    if(!confirm(`Apakah Anda yakin ingin menghapus data order ${idOrderParam} secara permanen dari server cloud?`)) return;
    
    const { error } = await _supabase.from('pesanan').delete().eq('id_order', idOrderParam);
    if(error) {
        alert("Gagal menghapus data: " + error.message);
    } else {
        alert("Data pesanan jaitan berhasil dihapus!");
        fetchOrdersFromCloud();
    }
}

// 6. SIMULASI BARCODE SCANNER
async function scanOrderAction(actionType) {
    const scanInputVal = document.getElementById('scan-id').value.trim();
    if(!scanInputVal) return alert("Masukkan ID Order Barcode!");
    
    const { data, error } = await _supabase.from('pesanan').select('*').eq('id_order', scanInputVal).single();
    if(error || !data) return alert("ID Barcode Tidak Ditemukan di Cloud Server!");
    
    if(actionType === 'view') {
        openPrintUkuranModal(data.id_order);
    } else {
        generatePdfDocument([data], 'nota');
    }
}

// 7. POP-UP SELEKSI CENTANG UKURAN KHUSUS UNTUK DIPRINT
async function openPrintUkuranModal(idOrderParam) {
    const { data, error } = await _supabase.from('pesanan').select('*').eq('id_order', idOrderParam).single();
    if(error) return alert("Gagal memuat detail ukuran.");
    
    selectedOrderForPrint = data;
    document.getElementById('modal-name').innerText = "Cetak Detail Ukuran: " + data.nama_pelanggan;
    
    const checklistContainer = document.getElementById('modal-checklist');
    checklistContainer.innerHTML = '';
    
    // Looping key ukuran dari JSONB untuk dibuatkan kotak centang/pilihan
    for(let keyUkuran in data.detail_ukuran) {
        checklistContainer.innerHTML += `<div class="check-item">
            <input type="checkbox" class="cb-attribute-print" value="${keyUkuran}" checked>
            <span>${keyUkuran}</span>
        </div>`;
    }
    document.getElementById('modal-ukuran').classList.remove('hidden');
}

function executePrintUkuranSelected() {
    const checkedAttributes = Array.from(document.querySelectorAll('.cb-attribute-print:checked')).map(c => c.value);
    if(checkedAttributes.length === 0) return alert("Pilih minimal satu atribut ukuran jaitan!");
    
    // Duplikasi data order, saring ukuran hanya yang dipilih user
    let filteredDataPrint = {...selectedOrderForPrint, detail_ukuran: {}};
    checkedAttributes.forEach(attrKey => {
        filteredDataPrint.detail_ukuran[attrKey] = selectedOrderForPrint.detail_ukuran[attrKey];
    });
    
    generatePdfDocument([filteredDataPrint], 'ukuran');
    closeSizeModal();
}

// 8. CETAK MASSAL (BULK PRINT NOTA) BERBASIS CHECKBOX TABEL
async function bulkAction(type) {
    const checkedOrderIds = Array.from(document.querySelectorAll('.cb-order:checked')).map(c => c.value);
    if(checkedOrderIds.length === 0) return alert("Silakan beri tanda centang (v) pada list tabel pesanan yang ingin dicetak massal!");
    
    const { data, error } = await _supabase.from('pesanan').select('*').in('id_order', checkedOrderIds);
    if(error) return alert("Gagal menarik data cetak massal.");
    
    generatePdfDocument(data, type);
}

// 9. ENGINE GENERATOR HTML TO PDF FILE
function generatePdfDocument(ordersArray, printType) {
// ISI DENGAN DATA PROYEK SUPABASE ANDA SENDIRI
const SUPABASE_URL = 'https://supabase.co';
const SUPABASE_KEY = 'MASUKKAN_ANON_PUBLIC_KEY_YANG_SANGAT_PANJANG_DI_SINI'; 

// Membuat Inisialisasi Koneksi ke SDK Cloud Supabase
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let activeMode = ''; // Menyimpan status kategori form ('atasan' / 'bawahan')
let currentUser = ''; // Menyimpan nama pemilik tailor pasca login
let selectedOrderForPrint = null; // Data order terpilih untuk penyaringan cetak ukuran

// 1. OTENTIKASI & INITIALISASI DASHBOARD
async function initApp() {
    currentUser = document.getElementById('owner-name').value.trim();
    if(!currentUser) return alert("Silakan masukkan nama pemilik untuk membuka data jaitan!");
    
    try {
        // Melakukan test ping koneksi langsung ke Supabase Cloud
        const { data, error } = await _supabase.from('pesanan').select('id_order').limit(1);
        if (error) {
            console.error("Kesalahan Validasi Database:", error);
            return alert("Koneksi Database Cloud Gagal! Periksa apakah ANON_KEY sudah dimasukkan dengan benar.");
        }
        
        // Pindah Tampilan jika login sukses
        document.getElementById('display-user').innerText = currentUser;
        document.getElementById('login-sec').classList.add('hidden');
        document.getElementById('main-dash').classList.remove('hidden');
        
        // Atur default tanggal input hari ini
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('p-masuk').value = today;

        fetchOrdersFromCloud(); // Muat data riwayat dari PostgreSQL cloud
    } catch (err) {
        alert("Sistem bermasalah saat terhubung ke server. Hubungi Admin.");
    }
}

// 2. NAVIGASI FORM DINAMIS
function showForm(mode) {
    activeMode = mode;
    document.getElementById('order-form').classList.remove('hidden');
    document.getElementById('form-title').innerText = "Form Input Jaitan " + mode.toUpperCase();
    document.getElementById('ukuran-container').classList.add('hidden');
    document.getElementById('btn-next').classList.remove('hidden');
    clearFormFields();
}

function proceedToMeasureForm() {
    const namaPelanggan = document.getElementById('p-nama').value.trim();
    if(!namaPelanggan) return alert("Wajib mengisi nama pelanggan terlebih dahulu!");
    
    document.getElementById('ukuran-container').classList.remove('hidden');
    document.getElementById('btn-next').classList.add('hidden');
    
    // Tampilkan panel input parameter ukuran sesuai opsi jaitan
    document.getElementById('form-atasan').classList.toggle('hidden', activeMode !== 'atasan');
    document.getElementById('form-bawahan').classList.toggle('hidden', activeMode !== 'bawahan');
    if(activeMode === 'bawahan') switchBawahanSubFields();
}

function switchBawahanSubFields() {
    const tipeBawahan = document.getElementById('select-bawahan').value;
    document.getElementById('field-celana').classList.toggle('hidden', tipeBawahan !== 'celana');
    document.getElementById('field-rok').classList.toggle('hidden', tipeBawahan !== 'rok');
}

// 3. CREATE: SIMPAN DATA KE CLOUD SUPABASE
async function saveToSupabaseCloud() {
    // Generate nomor order unik berbasis Timestamp (Contoh: SMZ-4567)
    const idOrder = "SMZ-" + Date.now().toString().slice(-4);
    
    let detailUkuranJson = {};
    // Ekstraksi nilai input ukuran secara dinamis berbasis class penanda
    let targetSelector = '';
    if(activeMode === 'atasan') {
        targetSelector = '.val-atasan';
    } else {
        const tipe = document.getElementById('select-bawahan').value;
        targetSelector = (tipe === 'celana') ? '.val-celana' : '.val-rok';
    }
    
    document.querySelectorAll(targetSelector).forEach(input => {
        detailUkuranJson[input.getAttribute('data-label')] = input.value || "0";
    });

    const payload = {
        id_order: idOrder,
        nama_pelanggan: document.getElementById('p-nama').value,
        nama_pemilik: currentUser,
        kategori: activeMode,
        jenis_pakaian: document.getElementById('p-jenis').value || activeMode,
        harga: parseFloat(document.getElementById('p-harga').value) || 0,
        tgl_masuk: document.getElementById('p-masuk').value,
        tgl_jemput: document.getElementById('p-jemput').value,
        detail_ukuran: detailUkuranJson
    };

    const { data, error } = await _supabase.from('pesanan').insert([payload]);

    if(error) {
        alert("Gagal Menyimpan: " + error.message);
    } else {
        alert(`Pesanan ${idOrder} Berhasil Disimpan Secara Aman di Cloud!`);
        document.getElementById('order-form').classList.add('hidden');
        fetchOrdersFromCloud();
    }
}

// 4. READ: AMBIL DATA DARI CLOUD POSTGRESQL & GENERATE BARCODE
async function fetchOrdersFromCloud() {
    const { data, error } = await _supabase.from('pesanan').select('*').order('created_at', { ascending: false });
    if(error) return console.error("Gagal memuat riwayat data:", error.message);
    
    const tableBody = document.getElementById('data-list');
    tableBody.innerHTML = '';
    
    data.forEach(order => {
        const rowHTML = `<tr>
            <td><input type="checkbox" class="cb-order" value="${order.id_order}"></td>
            <td><b>${order.id_order}</b></td>
            <td>${order.nama_pelanggan}</td>
            <td>${order.jenis_pakaian}</td>
            <td>Rp ${Number(order.harga).toLocaleString('id-ID')}</td>
            <td>${order.tgl_jemput || '-'}</td>
            <td><svg id="barcode-target-${order.id_order}" class="barcode-svg"></svg></td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="btn btn-primary" style="padding:6px 12px; font-size:11px;" onclick="openPrintUkuranModal('${order.id_order}')">🖨️ Cetak Ukuran</button>
                    <button class="btn btn-outline" style="padding:6px 12px; font-size:11px;" onclick="deleteOrderDirect('${order.id_order}')">Hapus</button>
                </div>
            </td>
        </tr>`;
        tableBody.insertAdjacentHTML('beforeend', rowHTML);
        
        // Membuat gambar barcode berbasis lib JsBarcode secara asinkronus
        setTimeout(() => {
            JsBarcode(`#barcode-target-${order.id_order}`, order.id_order, {
                format: "CODE128",
                width: 1.2,
                height: 35,
                displayValue: true,
                fontSize: 11
            });
        }, 50);
    });
}

// 5. DELETE: HAPUS DATA LANGSUNG DARI INTERFACE APLIKASI
async function deleteOrderDirect(idOrderParam) {
    if(!confirm(`Apakah Anda yakin ingin menghapus data order ${idOrderParam} secara permanen dari server cloud?`)) return;
    
    const { error } = await _supabase.from('pesanan').delete().eq('id_order', idOrderParam);
    if(error) {
        alert("Gagal menghapus data: " + error.message);
    } else {
        alert("Data pesanan jaitan berhasil dihapus!");
        fetchOrdersFromCloud();
    }
}

// 6. SIMULASI BARCODE SCANNER
async function scanOrderAction(actionType) {
    const scanInputVal = document.getElementById('scan-id').value.trim();
    if(!scanInputVal) return alert("Masukkan ID Order Barcode!");
    
    const { data, error } = await _supabase.from('pesanan').select('*').eq('id_order', scanInputVal).single();
    if(error || !data) return alert("ID Barcode Tidak Ditemukan di Cloud Server!");
    
    if(actionType === 'view') {
        openPrintUkuranModal(data.id_order);
    } else {
        generatePdfDocument([data], 'nota');
    }
}

// 7. POP-UP SELEKSI CENTANG UKURAN KHUSUS UNTUK DIPRINT
async function openPrintUkuranModal(idOrderParam) {
    const { data, error } = await _supabase.from('pesanan').select('*').eq('id_order', idOrderParam).single();
    if(error) return alert("Gagal memuat detail ukuran.");
    
    selectedOrderForPrint = data;
    document.getElementById('modal-name').innerText = "Cetak Detail Ukuran: " + data.nama_pelanggan;
    
    const checklistContainer = document.getElementById('modal-checklist');
    checklistContainer.innerHTML = '';
    
    // Looping key ukuran dari JSONB untuk dibuatkan kotak centang/pilihan
    for(let keyUkuran in data.detail_ukuran) {
        checklistContainer.innerHTML += `<div class="check-item">
            <input type="checkbox" class="cb-attribute-print" value="${keyUkuran}" checked>
            <span>${keyUkuran}</span>
        </div>`;
    }
    document.getElementById('modal-ukuran').classList.remove('hidden');
}

function executePrintUkuranSelected() {
    const checkedAttributes = Array.from(document.querySelectorAll('.cb-attribute-print:checked')).map(c => c.value);
    if(checkedAttributes.length === 0) return alert("Pilih minimal satu atribut ukuran jaitan!");
    
    // Duplikasi data order, saring ukuran hanya yang dipilih user
    let filteredDataPrint = {...selectedOrderForPrint, detail_ukuran: {}};
    checkedAttributes.forEach(attrKey => {
        filteredDataPrint.detail_ukuran[attrKey] = selectedOrderForPrint.detail_ukuran[attrKey];
    });
    
    generatePdfDocument([filteredDataPrint], 'ukuran');
    closeSizeModal();
}

// 8. CETAK MASSAL (BULK PRINT NOTA) BERBASIS CHECKBOX TABEL
async function bulkAction(type) {
    const checkedOrderIds = Array.from(document.querySelectorAll('.cb-order:checked')).map(c => c.value);
    if(checkedOrderIds.length === 0) return alert("Silakan beri tanda centang (v) pada list tabel pesanan yang ingin dicetak massal!");
    
    const { data, error } = await _supabase.from('pesanan').select('*').in('id_order', checkedOrderIds);
    if(error) return alert("Gagal menarik data cetak massal.");
    
    generatePdfDocument(data, type);
}

// 9. ENGINE GENERATOR HTML TO PDF FILE
function generatePdfDocument(ordersArray, printType) {
