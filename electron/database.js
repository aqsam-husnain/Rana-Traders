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
  // Add columns that may be missing from older databases
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
  saveDb();
}

module.exports = { initDatabase, getDb, closeDb, getDbPath, saveDb, getRawDb, resetDatabase };
