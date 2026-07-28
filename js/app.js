const SUPABASE_URL = 'https://xvgdkpgkxbskkxdfcyqy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2Z2RrcGdreGJza2t4ZGZjeXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNDYzODcsImV4cCI6MjEwMDgyMjM4N30.XTWYWxHK-lcPzpka7fuFddYYgz5AVz2T15ri2uVXaCQ';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let activeMode = '';
let currentUser = '';

async function initApp() {
    currentUser = document.getElementById('owner-name').value;
    if(!currentUser) return alert("Masukkan nama pemilik!");
    document.getElementById('display-user').innerText = currentUser;
    document.getElementById('login-sec').classList.add('hidden');
    document.getElementById('main-dash').classList.remove('hidden');
    fetchOrders();
}

function showForm(mode) {
    activeMode = mode;
    document.getElementById('order-form').classList.remove('hidden');
    document.getElementById('form-title').innerText = "Input " + mode.toUpperCase();
    document.getElementById('ukuran-fields').classList.add('hidden');
    document.getElementById('btn-measure').classList.remove('hidden');
    document.getElementById('btn-save').classList.add('hidden');
}

function prepareMeasure() {
    const fields = activeMode === 'atasan' 
        ? ['Bahu', 'P Tangan', 'L Tangan', 'P Baju', 'Dada'] 
        : ['L Pinggang', 'L Pinggul', 'Panjang'];
    
    const container = document.getElementById('ukuran-fields');
    container.innerHTML = '';
    fields.forEach(f => {
        container.innerHTML += `<div><label>${f}</label><input type="number" class="uk-val" data-label="${f}"></div>`;
    });
    container.classList.remove('hidden');
    document.getElementById('btn-measure').classList.add('hidden');
    document.getElementById('btn-save').classList.remove('hidden');
}

// CREATE: Simpan ke Supabase
async function saveToSupabase() {
    const idOrder = "SMZ-" + Date.now().toString().slice(-4);
    let ukuran = {};
    document.querySelectorAll('.uk-val').forEach(i => ukuran[idatasetlabel] = i.value);

    const { data, error } = await _supabase.from('pesanan').insert([{
        id_order: idOrder,
        nama_pelanggan: documentgetElementById('p-nama')value,
        nama_pemilik: current
        kategori: activeMode,
        jenis_pakaian: documentgetElementById('p-jenis')value,
        harga: documentgetElementById('p-harga')value,
        tgl_jemput: documentgetElementById('p-jemput')value,
        detail_ukuran: ukuran
    }]);

    if(error) alert("Gagal Simpan: " + error.message);
    else {
        alert("Berhasil disimpan ke Cloud!");
        document.getElementById('order-form').classList.add('hidden');
        fetchOrders();
    }
}

// READ: Ambil Data dari Supabase
async function fetchOrders() {
    const { data, error } = await _supabase.from('pesanan').select('*').order('created_at', { ascending: false });
    if(error) return console.error(error);
    
    const list = document.getElementById('data-list');
    list.innerHTML = '';
    data.forEach(o => {
        list.innerHTML += `<tr>
            <td>${o.id_order}</td>
            <td>${o.nama_pelanggan}</td>
            <td>${o.tgl_jemput}</td>
            <td><svg id="bc-${o.id_order}"></svg></td>
            <td>
                <button class="btn btn-gold" onclick="printNota('${o.id_order}')">Nota</button>
                <button class="btn btn-outline" onclick="deleteOrder('${o.id_order}')">Hapus</button>
            </td>
        </tr>`;
        setTimeout(() => JsBarcode(`#bc-${o.id_order}`, o.id_order, {height: 30, width: 1.5}), 100);
    });
}

// DELETE: Hapus Langsung dari Aplikasi
async function deleteOrder(id) {
    if(!confirm("Hapus pesanan ini dari database?")) return;
    const { error } = await _supabase.from('pesanan').delete().eq('id_order', id);
    if(error) alert("Gagal hapus!");
    else fetchOrders();
}
