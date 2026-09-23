const fs = require('fs');

const rawData = fs.readFileSync('db.json', 'utf8');
const db = JSON.parse(rawData);


fs.writeFileSync('kontrak.json', JSON.stringify(db.contracts, null, 2));
console.log(' File kontrak.json berhasil dibuat!');

fs.writeFileSync('jadwal.json', JSON.stringify(db.installments, null, 2));
console.log(' File jadwal.json berhasil dibuat!');