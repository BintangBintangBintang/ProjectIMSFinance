require('dotenv').config();

const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Hapus express.static('public') jika frontend dipisah (Next.js/React), 
// tapi biarkan jika file HTML disatukan di folder yang sama.
app.use(express.static("public")); 

// ==========================================
// 1. KONFIGURASI JSONBIN
// ==========================================
// Gunakan environment variables agar API Key tidak bocor
const BIN_ID = process.env.JSONBIN_BIN_ID; 
const API_KEY = process.env.JSONBIN_API_KEY; 
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

async function readDb() {
  try {
    const response = await fetch(JSONBIN_URL, {
      method: 'GET',
      headers: { 'X-Master-Key': API_KEY }
    });
    const data = await response.json();
    return data.record; // JSONBin v3 membungkus data asli di dalam objek 'record'
  } catch (error) {
    console.error("Gagal membaca dari JSONBin:", error);
    return { kontrak: [], jadwal: [] };
  }
}

async function writeDb(db) {
  try {
    await fetch(JSONBIN_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY
      },
      body: JSON.stringify(db)
    });
    console.log("Data berhasil disinkronisasi ke Cloud!");
  } catch (error) {
    console.error("Gagal menyimpan ke JSONBin:", error);
  }
}

// ==========================================
// 2. FUNGSI LOGIKA (TIDAK BERUBAH)
// ==========================================
function getInterestRate(tenor) {
  if (typeof tenor !== 'number' || tenor <= 0) {
    throw new Error("Jangka waktu tidak valid. Silakan input ulang.");
  }
  if (tenor <= 12) return 0.12;
  if (tenor > 12 && tenor <= 24) return 0.14;
  if (tenor > 24) return 0.165; 
}

function nextContractNumber(kontrak) {
  const number = kontrak.length + 1;
  return `AGR${String(number).padStart(5, "0")}`;
}

function addMonths(dateString, months) {
  const date = new Date(dateString); 
  const originalDay = date.getUTCDate();
  date.setUTCMonth(date.getUTCMonth() + months);
  if (date.getUTCDate() !== originalDay) {
    date.setUTCDate(0);
  }
  return date.toISOString().slice(0, 10);
}




app.post("/api/contracts", async (req, res) => {
  try {
    const { customerName, carName, carPrice, dpPercent, tenor, startDate } = req.body;

    const price = Number(carPrice);
    const dp = Number(dpPercent);
    const months = Number(tenor);

    if (!customerName || !carName || !startDate) {
      return res.status(400).json({ message: "Data customer, mobil, dan tanggal mulai wajib diisi." });
    }
    if (price <= 0 || dp < 0 || dp >= 100 || months <= 0) {
      return res.status(400).json({ message: "Nilai harga, DP, atau tenor tidak valid." });
    }

    const rate = getInterestRate(months);
    const dpAmount = price * dp / 100;
    const principal = price - dpAmount;

    const totalInterest = principal * rate * (months / 12);
    const totalPayment = principal + totalInterest;
    let installment = totalPayment / months;
    installment = Math.ceil(installment / 1000) * 1000;

    // AWAIT digunakan karena membaca dari internet
    const db = await readDb(); 
    const contractNo = nextContractNumber(db.kontrak);

    const contract = {
      contractNo,
      customerName,
      carName,
      carPrice: price,
      dpPercent: dp,
      dpAmount,
      principal,
      tenor: months,
      interestRate: rate,
      totalInterest,
      totalPayment,
      installment,
      startDate,
      createdAt: new Date().toISOString()
    };
    
    const installments = Array.from({ length: months }, (_, index) => ({
      contractNo,
      installmentNo: index + 1,
      installmentAmount: installment,
      dueDate: addMonths(startDate, index), 
      status: "BELUM BAYAR"
    }));

    db.kontrak.push(contract);
    db.jadwal.push(...installments);
    
    // AWAIT digunakan untuk menyimpan ke internet
    await writeDb(db);

    res.json({ contract, installments });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get("/api/contracts", async (req, res) => {
  const db = await readDb();
  res.json(db.kontrak);
});

app.get("/api/contracts/:contractNo/installments", async (req, res) => {
  const db = await readDb();
  const data = db.jadwal.filter(item => item.contractNo === req.params.contractNo);
  res.json(data);
});

app.get("/api/reports/jatuh-tempo", async (req, res) => {
  const db = await readDb();
  const limitDate = "2024-08-14";
  const targetClient = "sugus"; 

  const targetContracts = db.kontrak.filter(c => 
    c.customerName.toLowerCase().includes(targetClient)
  );

  const result = targetContracts.map(contract => {
    const dueInstallments = db.jadwal.filter(i => 
      i.contractNo === contract.contractNo && 
      i.dueDate <= limitDate
    );

    const totalJatuhTempo = dueInstallments.reduce((total, i) => {
      return total + i.installmentAmount;
    }, 0);

    return {
      "KONTRAK NO": contract.contractNo,
      "CLIENT NAME": contract.customerName,
      "TOTAL ANGSURAN JATUH TEMPO": Math.ceil(totalJatuhTempo / 1000) * 1000
    };
  });

  res.json(result);
});

app.listen(PORT, () => {
  console.log(`IMS Finance berjalan di http://localhost:${PORT}`);
});