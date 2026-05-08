const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let db = null;
let dbPath = '';

async function initDatabase() {
  const SQL = await initSqlJs();
  // Store database in the app's own folder (not AppData)
  // Dev: project root | Production: next to the .exe
  const baseDir = app.isPackaged
    ? path.dirname(app.getPath('exe'))
    : path.join(__dirname, '..');
  dbPath = path.join(baseDir, 'rana-traders.db');

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  createTables();
  runMigrations();
  saveDb();
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS buyers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, name_urdu TEXT,
      type TEXT DEFAULT 'Regular', phone TEXT, address TEXT, cnic TEXT,
      opening_balance REAL DEFAULT 0, status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, name_urdu TEXT,
      type TEXT DEFAULT 'Regular', phone TEXT, address TEXT, cnic TEXT,
      opening_balance REAL DEFAULT 0, status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, name_urdu TEXT,
      unit TEXT DEFAULT 'KG', commission_rate REAL DEFAULT 0,
      opening_stock REAL DEFAULT 0,
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT, buyer_id INTEGER, product_id INTEGER,
      date TEXT NOT NULL, quantity REAL NOT NULL, rate REAL NOT NULL, total REAL NOT NULL,
      commission REAL DEFAULT 0, bardana REAL DEFAULT 0, labour REAL DEFAULT 0,
      net_amount REAL NOT NULL, payment_mode TEXT DEFAULT 'Credit', notes TEXT,
      unit TEXT, commission_type TEXT DEFAULT 'default',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_id INTEGER, product_id INTEGER,
      date TEXT NOT NULL, quantity REAL NOT NULL, rate REAL NOT NULL, total REAL NOT NULL,
      commission REAL DEFAULT 0, bardana REAL DEFAULT 0, labour REAL DEFAULT 0,
      net_amount REAL NOT NULL, payment_mode TEXT DEFAULT 'Credit', notes TEXT,
      amount_paid REAL DEFAULT 0, payment_status TEXT DEFAULT 'To Pay',
      unit TEXT, commission_type TEXT DEFAULT 'default',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, party_type TEXT NOT NULL, party_id INTEGER NOT NULL,
      date TEXT NOT NULL, amount REAL NOT NULL, type TEXT NOT NULL,
      mode TEXT DEFAULT 'Cash', reference TEXT, notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  `);
}

function runMigrations() {
  // ── Rename old tables if they exist (migrate from customer/dealer to buyer/supplier) ──
  try {
    const hasCustomers = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='customers'");
    if (hasCustomers.length > 0 && hasCustomers[0].values.length > 0) {
      // Check if buyers table already has data (avoid duplicate migration)
      const buyerCount = db.exec("SELECT COUNT(*) FROM buyers");
      const buyerHasData = buyerCount.length > 0 && buyerCount[0].values[0][0] > 0;
      if (!buyerHasData) {
        try { db.run("INSERT INTO buyers SELECT * FROM customers"); } catch (e) { /* ignore */ }
      }
      try { db.run("DROP TABLE IF EXISTS customers"); } catch (e) { /* ignore */ }
    }
  } catch (e) { /* buyers table might not exist yet or customers already dropped */ }

  try {
    const hasDealers = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='dealers'");
    if (hasDealers.length > 0 && hasDealers[0].values.length > 0) {
      const supplierCount = db.exec("SELECT COUNT(*) FROM suppliers");
      const supplierHasData = supplierCount.length > 0 && supplierCount[0].values[0][0] > 0;
      if (!supplierHasData) {
        try { db.run("INSERT INTO suppliers SELECT * FROM dealers"); } catch (e) { /* ignore */ }
      }
      try { db.run("DROP TABLE IF EXISTS dealers"); } catch (e) { /* ignore */ }
    }
  } catch (e) { /* suppliers table might not exist yet or dealers already dropped */ }

  // ── Rename customer_id → buyer_id in sales table ──
  try {
    const salesCols = db.exec("PRAGMA table_info(sales)");
    if (salesCols.length > 0) {
      const colNames = salesCols[0].values.map(v => v[1]);
      if (colNames.includes('customer_id') && !colNames.includes('buyer_id')) {
        db.run("ALTER TABLE sales RENAME COLUMN customer_id TO buyer_id");
      }
    }
  } catch (e) { /* ignore - column might already be renamed or ALTER RENAME not supported */ }

  // ── Rename dealer_id → supplier_id in purchases table ──
  try {
    const purchCols = db.exec("PRAGMA table_info(purchases)");
    if (purchCols.length > 0) {
      const colNames = purchCols[0].values.map(v => v[1]);
      if (colNames.includes('dealer_id') && !colNames.includes('supplier_id')) {
        db.run("ALTER TABLE purchases RENAME COLUMN dealer_id TO supplier_id");
      }
    }
  } catch (e) { /* ignore */ }

  // ── Update party_type values in payments table ──
  try { db.run("UPDATE payments SET party_type='Buyer' WHERE party_type='Customer'"); } catch (e) { /* ignore */ }
  try { db.run("UPDATE payments SET party_type='Supplier' WHERE party_type='Dealer'"); } catch (e) { /* ignore */ }

  // Add opening_stock column to existing products table if missing
  try { db.run('ALTER TABLE products ADD COLUMN opening_stock REAL DEFAULT 0'); } catch (e) { /* already exists */ }

  // Purchase payment tracking — how much paid to farmer at time of purchase
  try { db.run('ALTER TABLE purchases ADD COLUMN amount_paid REAL DEFAULT 0'); } catch (e) { /* already exists */ }
  try { db.run("ALTER TABLE purchases ADD COLUMN payment_status TEXT DEFAULT 'To Pay'"); } catch (e) { /* already exists */ }

  // Per-transaction unit (allows overriding product default unit at purchase/sale time)
  try { db.run('ALTER TABLE purchases ADD COLUMN unit TEXT'); } catch (e) { /* already exists */ }
  try { db.run('ALTER TABLE sales ADD COLUMN unit TEXT'); } catch (e) { /* already exists */ }

  // Custom vs default commission tracking
  try { db.run("ALTER TABLE purchases ADD COLUMN commission_type TEXT DEFAULT 'default'"); } catch (e) { /* already exists */ }
  try { db.run("ALTER TABLE sales ADD COLUMN commission_type TEXT DEFAULT 'default'"); } catch (e) { /* already exists */ }

  // Sale payment tracking — how much received from buyer at time of sale
  try { db.run('ALTER TABLE sales ADD COLUMN amount_paid REAL DEFAULT 0'); } catch (e) { /* already exists */ }
  try { db.run("ALTER TABLE sales ADD COLUMN payment_status TEXT DEFAULT 'To Receive'"); } catch (e) { /* already exists */ }

  // Seed default units if units table is empty
  const unitCount = db.exec("SELECT COUNT(*) FROM units");
  if (unitCount.length === 0 || unitCount[0].values[0][0] === 0) {
    const defaults = ['KG', 'Mann', 'Ton', 'Bag', 'Quintal', 'Piece', 'Liter', 'Dozen', 'Peti', 'Bori'];
    for (const u of defaults) {
      try { db.run('INSERT OR IGNORE INTO units (name) VALUES (?)', [u]); } catch (e) { /* ignore */ }
    }
  }

  // Seed sample data ONLY in development mode (not when packaged as EXE)
  // In production (EXE), the user starts with a clean empty database
  if (!app.isPackaged) {
    const productCount = db.exec("SELECT COUNT(*) FROM products");
    if (productCount.length === 0 || productCount[0].values[0][0] === 0) {
      seedSampleData();
    }
  }
}

function seedSampleData() {
  // ── Buyers — Mills & companies that BUY from the shop (shop sells TO them) ──
  const buyers = [
    ['Haji Aslam & Sons', 'حاجی اسلم اینڈ سنز', 'Regular', '0321-1111111', 'Okara Mandi', '35201-1111111-1', 25000, 'Active'],
    ['Chaudhry Traders', 'چوہدری ٹریڈرز', 'Regular', '0300-2222222', 'Sahiwal Mandi', '35201-2222222-2', 18000, 'Active'],
    ['Malik Grain House', 'ملک گرین ہاؤس', 'Regular', '0333-3333333', 'Multan Mandi', '', 0, 'Active'],
    ['Khan Brothers', 'خان برادرز', 'Regular', '0345-4444444', 'Hafizabad', '35201-4444444-4', 10000, 'Active'],
    ['Sheikh Rice Mills', 'شیخ رائس ملز', 'Regular', '0312-5555555', 'Kala Shah Kaku', '', 35000, 'Active'],
    ['Al-Madina Trading', 'المدینہ ٹریڈنگ', 'Regular', '0341-6666666', 'Gujranwala', '35201-6666666-6', 0, 'Active'],
  ];
  for (const c of buyers) {
    db.run('INSERT INTO buyers (name,name_urdu,type,phone,address,cnic,opening_balance,status) VALUES (?,?,?,?,?,?,?,?)', c);
  }

  // ── Suppliers — Farmers (کسان) that SELL to the shop (shop purchases FROM them) ──
  const suppliers = [
    ['Ahmad Khan', 'احمد خان', 'Regular', '0301-1234567', 'Mandi Bahauddin', '35201-1234567-1', 5000, 'Active'],
    ['Rashid Ali', 'راشد علی', 'Regular', '0321-2345678', 'Gujrat', '35201-2345678-2', 12000, 'Active'],
    ['Faisal Mehmood', 'فیصل محمود', 'Regular', '0333-3456789', 'Jhelum', '35201-3456789-3', 0, 'Active'],
    ['Tariq Hussain', 'طارق حسین', 'Regular', '0345-4567890', 'Lahore', '35201-4567890-4', 8500, 'Active'],
    ['Imran Shahzad', 'عمران شہزاد', 'Regular', '0300-5678901', 'Faisalabad', '35201-5678901-5', 3000, 'Active'],
    ['Nadeem Iqbal', 'ندیم اقبال', 'Regular', '0312-6789012', 'Sargodha', '', 0, 'Active'],
    ['Waqar Hassan', 'وقار حسن', 'Regular', '0341-7890123', 'Rawalpindi', '', 15000, 'Active'],
    ['Bilal Ahmed', 'بلال احمد', 'Regular', '0302-8901234', 'Islamabad', '35201-8901234-8', 0, 'Active'],
  ];
  for (const d of suppliers) {
    db.run('INSERT INTO suppliers (name,name_urdu,type,phone,address,cnic,opening_balance,status) VALUES (?,?,?,?,?,?,?,?)', d);
  }

  // ── Products ──
  const products = [
    ['Wheat', 'گندم', 'Mann', 2.5, 150, 'Active'],
    ['Rice Basmati', 'باسمتی چاول', 'KG', 3.0, 500, 'Active'],
    ['Corn / Maize', 'مکئی', 'Mann', 2.0, 80, 'Active'],
    ['Sugar', 'چینی', 'Bag', 1.5, 40, 'Active'],
    ['Mustard Seed', 'سرسوں', 'Mann', 2.5, 60, 'Active'],
    ['Gram / Chickpea', 'چنا', 'Mann', 2.0, 100, 'Active'],
  ];
  for (const p of products) {
    db.run('INSERT INTO products (name,name_urdu,unit,commission_rate,opening_stock,status) VALUES (?,?,?,?,?,?)', p);
  }

  // ── Purchases (supplier/farmer → shop) ──
  const purchases = [
    [1, 1, '2026-04-05T09:30', 200, 3800, 760000, 19000, 500, 300, 741200, 'On Account', 'First wheat lot from Okara', 0, 'To Pay', 'Mann', 'default'],
    [2, 1, '2026-04-08T10:15', 150, 3900, 585000, 14625, 400, 250, 570125, 'On Account', '', 0, 'To Pay', 'Mann', 'default'],
    [3, 2, '2026-04-10T08:45', 800, 280, 224000, 6720, 200, 150, 217130, 'Bank Transfer', 'Basmati from Multan', 100000, 'Partial', 'KG', 'default'],
    [1, 2, '2026-04-12T14:00', 600, 290, 174000, 5220, 150, 100, 168730, 'Cash', '', 168730, 'Paid', 'KG', 'default'],
    [4, 3, '2026-04-14T11:30', 100, 2800, 280000, 5600, 200, 100, 274300, 'On Account', 'Maize', 0, 'To Pay', 'Mann', 'default'],
    [5, 4, '2026-04-16T16:20', 50, 140, 7000, 175, 50, 30, 6795, 'On Account', 'Sugar bags from Hafizabad', 0, 'To Pay', 'Bag', 'default'],
    [2, 4, '2026-04-18T09:00', 80, 135, 10800, 162, 60, 40, 10578, 'Cash', '', 10578, 'Paid', 'Bag', 'default'],
    [6, 5, '2026-04-20T13:45', 120, 5200, 624000, 15600, 300, 200, 608500, 'Cash', 'Mustard seed', 200000, 'Partial', 'Mann', 'default'],
    [3, 5, '2026-04-22T10:30', 80, 5000, 400000, 10000, 200, 150, 389850, 'On Account', '', 0, 'To Pay', 'Mann', 'default'],
    [1, 6, '2026-04-24T15:10', 180, 4600, 828000, 16560, 400, 250, 811590, 'On Account', 'Chickpea from Okara', 0, 'To Pay', 'Mann', 'default'],
    [4, 6, '2026-04-26T08:20', 100, 4500, 450000, 9000, 200, 150, 441050, 'On Account', '', 0, 'To Pay', 'Mann', 'default'],
    [6, 1, '2026-04-28T12:00', 120, 4000, 480000, 12000, 300, 200, 468100, 'Cash', 'New wheat shipment', 468100, 'Paid', 'Mann', 'default'],
    [2, 3, '2026-04-30T17:30', 60, 2900, 174000, 3480, 100, 80, 170540, 'Bank Transfer', '', 50000, 'Partial', 'Mann', 'default'],
    [5, 2, '2026-05-01T09:45', 400, 285, 114000, 3420, 100, 80, 110600, 'On Account', 'Basmati rice', 0, 'To Pay', 'KG', 'default'],
    [3, 6, '2026-05-02T11:15', 150, 4700, 705000, 14100, 350, 200, 690850, 'On Account', 'Premium chickpea', 0, 'To Pay', 'Mann', 'default'],
  ];
  for (const p of purchases) {
    db.run('INSERT INTO purchases (supplier_id,product_id,date,quantity,rate,total,commission,bardana,labour,net_amount,payment_mode,notes,amount_paid,payment_status,unit,commission_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', p);
  }

  // ── Sales (shop → buyer/mill) ──
  const sales = [
    [1, 1, '2026-04-07T10:00', 50, 4200, 210000, 5250, 100, 80, 204570, 'On Account', 'Wheat to Haji Aslam', 'Mann', 'default'],
    [2, 1, '2026-04-09T14:30', 80, 4100, 328000, 8200, 150, 100, 319550, 'On Account', '', 'Mann', 'default'],
    [3, 2, '2026-04-11T09:15', 200, 320, 64000, 1920, 50, 40, 61990, 'Cash', 'Cash sale basmati', 'KG', 'default'],
    [4, 2, '2026-04-13T11:45', 300, 315, 94500, 2835, 80, 60, 91525, 'On Account', '', 'KG', 'default'],
    [5, 3, '2026-04-15T16:00', 30, 3200, 96000, 1920, 50, 30, 94000, 'On Account', 'Corn to Sheikh Rice Mills', 'Mann', 'default'],
    [1, 4, '2026-04-17T08:30', 20, 155, 3100, 46.5, 20, 15, 3018.5, 'Cash', 'Sugar bags', 'Bag', 'default'],
    [6, 5, '2026-04-21T13:00', 40, 5800, 232000, 5800, 100, 80, 226020, 'On Account', 'Mustard seed', 'Mann', 'default'],
    [5, 6, '2026-04-25T10:45', 80, 5000, 400000, 8000, 200, 150, 391650, 'On Account', 'Chickpea to Sheikh Rice Mills', 'Mann', 'default'],
    [2, 6, '2026-04-27T15:20', 60, 4900, 294000, 5880, 150, 100, 287870, 'Bank Transfer', '', 'Mann', 'default'],
    [6, 1, '2026-04-29T12:30', 100, 4150, 415000, 10375, 200, 150, 404275, 'Cash', 'Wheat sale to Al-Madina', 'Mann', 'default'],
    [4, 3, '2026-05-01T17:00', 40, 3100, 124000, 2480, 60, 40, 121420, 'On Account', '', 'Mann', 'default'],
    [3, 5, '2026-05-02T09:30', 50, 5600, 280000, 7000, 120, 80, 272800, 'On Account', 'Mustard to Malik Grain House', 'Mann', 'default'],
  ];
  for (const s of sales) {
    db.run('INSERT INTO sales (buyer_id,product_id,date,quantity,rate,total,commission,bardana,labour,net_amount,payment_mode,notes,unit,commission_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', s);
  }

  // ── Payments ──
  const payments = [
    ['Buyer', 1, '2026-04-10T11:00', 100000, 'Received', 'Cash', '', 'Partial payment from Haji Aslam'],
    ['Buyer', 2, '2026-04-15T14:30', 150000, 'Received', 'Bank Transfer', 'TRX-20260415', 'Chaudhry Traders bank transfer'],
    ['Buyer', 4, '2026-04-20T09:45', 50000, 'Received', 'Cash', '', ''],
    ['Buyer', 5, '2026-04-28T16:15', 200000, 'Received', 'Cheque', 'CHQ-4521', 'Sheikh Rice Mills cheque'],
    ['Buyer', 3, '2026-04-30T10:30', 60000, 'Received', 'Cash', '', 'Malik Grain House payment'],
    ['Supplier', 1, '2026-04-12T15:00', 300000, 'Paid', 'Bank Transfer', 'TRX-20260412', 'Payment to Ahmad Khan'],
    ['Supplier', 2, '2026-04-18T11:30', 250000, 'Paid', 'Cash', '', 'Rashid Ali cash'],
    ['Supplier', 3, '2026-04-22T13:45', 100000, 'Paid', 'Bank Transfer', 'TRX-20260422', ''],
    ['Supplier', 5, '2026-04-25T08:00', 400000, 'Paid', 'Cheque', 'CHQ-8811', 'Imran Shahzad payment'],
    ['Supplier', 4, '2026-05-01T12:15', 50000, 'Paid', 'Cash', '', 'Tariq Hussain partial'],
  ];
  for (const p of payments) {
    db.run('INSERT INTO payments (party_type,party_id,date,amount,type,mode,reference,notes) VALUES (?,?,?,?,?,?,?,?)', p);
  }

  console.log('✅ Sample data seeded successfully');
}

function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

/* Helper: convert sql.js results to array of objects */
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function runSql(sql, params = []) {
  db.run(sql, params);
  saveDb();
  return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] };
}

function getDb() { return { queryAll, queryOne, runSql }; }
function getDbPath() { return dbPath; }
function getRawDb() { return db; }

function closeDb() {
  if (db) { saveDb(); db.close(); db = null; }
}

async function resetDatabase() {
  // Close existing db
  if (db) { db.close(); db = null; }
  // Delete the database file
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  // Reinitialize with empty tables (no sample data since we skip seeding)
  const SQL = await initSqlJs();
  db = new SQL.Database();
  createTables();
  runMigrations();
  // Seed only default units, NOT sample data
  const defaults = ['KG', 'Mann', 'Ton', 'Bag', 'Quintal', 'Piece', 'Liter', 'Dozen', 'Peti', 'Bori'];
  for (const u of defaults) {
    try { db.run('INSERT OR IGNORE INTO units (name) VALUES (?)', [u]); } catch (e) { /* ignore */ }
  }
  saveDb();
}

module.exports = { initDatabase, getDb, closeDb, getDbPath, saveDb, getRawDb, resetDatabase };
