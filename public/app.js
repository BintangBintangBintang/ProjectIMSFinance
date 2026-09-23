const form = document.getElementById("creditForm");
const result = document.getElementById("result");
const scheduleSection = document.getElementById("scheduleSection");
const scheduleBody = document.getElementById("scheduleBody");

// Fungsi format rupiah
const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'decimal',
        minimumFractionDigits: 0
    }).format(angka);
};

// Fungsi khusus untuk merender tabel jadwal angsuran
function renderTable(installments) {
    scheduleBody.innerHTML = ''; 

    installments.forEach(item => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td style="text-align: left;">${item.contractNo}</td>
            <td style="text-align: center;">${item.installmentNo}</td>
            <td style="text-align: center;">${formatRupiah(item.installmentAmount)}</td>
            <td style="text-align: center;">${item.dueDate}</td>
        `;
        
        scheduleBody.appendChild(tr);
    });

    scheduleSection.classList.remove('hidden');
}

// Event Listener untuk Submit Form
form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
        customerName: document.getElementById("customerName").value,
        carName: document.getElementById("carName").value,
        carPrice: document.getElementById("carPrice").value,
        dpPercent: document.getElementById("dpPercent").value,
        tenor: document.getElementById("tenor").value,
        startDate: document.getElementById("startDate").value
    };

    try {
        const response = await fetch("/api/contracts", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        const c = data.contract;

        // Tampilkan Hasil Summary (Ubah rupiah() menjadi formatRupiah())
        result.classList.remove("hidden");
        result.innerHTML = `
            <h2>Hasil Simulasi</h2>
            <div class="summary">
                <div><span>No. Kontrak</span><strong>${c.contractNo}</strong></div>
                <div><span>Harga Mobil</span><strong>${formatRupiah(c.carPrice)}</strong></div>
                <div><span>DP ${c.dpPercent}%</span><strong>${formatRupiah(c.dpAmount)}</strong></div>
                <div><span>Pokok Kredit</span><strong>${formatRupiah(c.principal)}</strong></div>
                <div><span>Bunga</span><strong>${(c.interestRate * 100).toFixed(1)}% / tahun</strong></div>
                <div><span>Total Bunga</span><strong>${formatRupiah(c.totalInterest)}</strong></div>
                <div><span>Total Pembayaran</span><strong>${formatRupiah(c.totalPayment)}</strong></div>
                <div class="highlight"><span>Angsuran / Bulan</span><strong>${formatRupiah(c.installment)}</strong></div>
            </div>
        `;

        // Panggil fungsi renderTable yang sudah disiapkan
        renderTable(data.installments);

    } catch (error) {
        alert(error.message);
    }
});