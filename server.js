const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, "db.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function readDb() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}


function getInterestRate(tenor) {
  // Pastikan input berupa angka valid dan di atas 0 agar tidak error
  if (typeof tenor !== 'number' || tenor <= 0) {
    // Mewakili alur "No" yang kembali ke atas (meminta input ulang)
    throw new Error("Jangka waktu tidak valid. Silakan input ulang.");
  }

  // Jangka Waktu <= 12 bulan
  if (tenor <= 12) {
    return 0.12;
  } 
  // Jangka Waktu > 12 and <= 24 bulan
  else if (tenor > 12 && tenor <= 24) {
    return 0.14;
  } 
  // Jangka Waktu > 24 bulan (berapapun nilai di atas 24)
  else if (tenor > 24) {
    return 0.165; 
  }
}

function nextContractNumber(contracts) {
  const number = contracts.length + 1;
  return `AGR${String(number).padStart(5, "0")}`;
}

function addMonths(dateString, months) {
  const date = new Date(dateString); // Format YYYY-MM-DD otomatis di-parse sebagai UTC
  const originalDay = date.getUTCDate();

  date.setUTCMonth(date.getUTCMonth() + months);

  if (date.getUTCDate() !== originalDay) {
    date.setUTCDate(0);
  }

  return date.toISOString().slice(0, 10);
}

app.post("/api/contracts", (req, res) => {
  try {
    const {
      customerName,
      carName,
      carPrice,
      dpPercent,
      tenor,
      startDate
    } = req.body;

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

    // Bunga flat sesuai flowchart:
    // bunga = pokok x bunga_tahunan x (tenor / 12)
    const totalInterest = principal * rate * (months / 12);
    const totalPayment = principal + totalInterest;
    let installment = totalPayment / months;
    // Pembulatan ke atas ke kelipatan 1000
    installment = Math.ceil(installment / 1000) * 1000;

    

    const db = readDb();
    const contractNo = nextContractNumber(db.contracts);

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

    // (Di dalam app.post("/api/contracts", ... ))
    
    const installments = Array.from({ length: months }, (_, index) => ({
      contractNo,
      installmentNo: index + 1,
      installmentAmount: installment,
      // Ubah dari index + 1 menjadi index agar angsuran 1 = tanggal mulai
      dueDate: addMonths(startDate, index), 
      status: "BELUM BAYAR"
    }));

    db.contracts.push(contract);
    db.installments.push(...installments);
    writeDb(db);

    res.json({ contract, installments });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get("/api/contracts", (req, res) => {
  const db = readDb();
  res.json(db.contracts);
});

app.get("/api/contracts/:contractNo/installments", (req, res) => {
  const db = readDb();
  const data = db.installments.filter(
    item => item.contractNo === req.params.contractNo
  );
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`IMS Finance berjalan di http://localhost:${PORT}`);
});

app.get("/api/reports/jatuh-tempo", (req, res) => {
  const db = readDb();
  
  
  const limitDate = "2024-08-14";


  const targetContracts = db.contracts.filter(c => 
    c.customerName.toLowerCase().includes(targetClient)
  );

  
  const result = targetContracts.map(contract => {
    
    // Cari jadwal angsuran yang sesuai kontrak dan <= batas tanggal
    const dueInstallments = db.installments.filter(i => 
      i.contractNo === contract.contractNo && 
      i.dueDate <= limitDate
    );

    // Hitung total angsuran (SUM)
    const totalJatuhTempo = dueInstallments.reduce((total, i) => {
      return total + i.installmentAmount;
    }, 0);

    // Kembalikan objek sesuai format tabel yang diminta
    return {
      "KONTRAK NO": contract.contractNo,
      "CLIENT NAME": contract.customerName,
      "TOTAL ANGSURAN JATUH TEMPO": Math.ceil(totalJatuhTempo / 1000) * 1000
    };
  });

  res.json(result);
});