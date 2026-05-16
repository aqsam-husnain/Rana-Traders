const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { initDatabase, getDb, closeDb, getDbPath, saveDb, getRawDb, resetDatabase } = require('./database');

let mainWindow;

function getMacAddresses() {
  const interfaces = os.networkInterfaces();
  const macs = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.mac && iface.mac !== '00:00:00:00:00:00') macs.push(iface.mac.toUpperCase());
    }
  }
  return [...new Set(macs)];
}

function checkMacAddress() {
  try {
    const macFilePath = app.isPackaged
      ? path.join(process.resourcesPath, 'allowed_macs.json')
      : path.join(__dirname, '..', 'allowed_macs.json');
    const macConfig = JSON.parse(fs.readFileSync(macFilePath, 'utf-8'));
    if (macConfig.bypass_enabled) return true;
    const deviceMacs = getMacAddresses();
    const allowedMacs = macConfig.allowed.map(m => m.toUpperCase());
    return deviceMacs.some(mac => allowedMacs.includes(mac));
  } catch (err) { console.error('MAC check failed:', err); return false; }
}

function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '..', 'src', 'assets', 'icon.ico');

  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1100, minHeight: 700,
    title: 'رانا ٹریڈرز — Rana Traders',
    icon: iconPath,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true },
    show: false, backgroundColor: '#060608'
  });
  if (!app.isPackaged) mainWindow.loadURL('http://localhost:5173');
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  mainWindow.once('ready-to-show', () => { mainWindow.maximize(); mainWindow.show(); });
  if (!app.isPackaged) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

function registerIpcHandlers() {
  const { queryAll, queryOne, runSql } = getDb();

  ipcMain.handle('login', (_e, u, p) => {
    if (u === 'admin' && p === 'admin') return { success: true, user: { username: u, name: 'Rana Traders' } };
    return { success: false, message: 'Invalid credentials' };
  });
  ipcMain.handle('get-mac-addresses', () => getMacAddresses());

  ipcMain.handle('get-dashboard-stats', () => {
    const today = new Date().toISOString().split('T')[0];
    return {
      activeBuyers: queryOne("SELECT COUNT(*) as c FROM buyers WHERE status='Active' AND type='Regular'")?.c || 0,
      activeSuppliers: queryOne("SELECT COUNT(*) as c FROM suppliers WHERE status='Active' AND type='Regular'")?.c || 0,
      todaySale: queryOne("SELECT COALESCE(SUM(net_amount),0) as t FROM sales WHERE substr(date,1,10)=?", [today])?.t || 0,
      todayPurchase: queryOne("SELECT COALESCE(SUM(net_amount),0) as t FROM purchases WHERE substr(date,1,10)=?", [today])?.t || 0,
      totalPayable: (queryOne("SELECT COALESCE(SUM(net_amount),0) as t FROM purchases")?.t || 0) - (queryOne("SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE party_type='Supplier' AND type='Paid'")?.t || 0) - (queryOne("SELECT COALESCE(SUM(amount_paid),0) as t FROM purchases")?.t || 0) + (queryOne("SELECT COALESCE(SUM(opening_balance),0) as t FROM suppliers")?.t || 0),
      totalReceivable: (queryOne("SELECT COALESCE(SUM(net_amount),0) as t FROM sales")?.t || 0) - (queryOne("SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE party_type='Buyer' AND type='Received'")?.t || 0) - (queryOne("SELECT COALESCE(SUM(amount_paid),0) as t FROM sales")?.t || 0) + (queryOne("SELECT COALESCE(SUM(opening_balance),0) as t FROM buyers")?.t || 0),
      totalStock: (queryOne("SELECT COALESCE(SUM(opening_stock),0) as t FROM products WHERE status='Active'")?.t || 0) + (queryOne("SELECT COALESCE(SUM(quantity),0) as t FROM purchases")?.t || 0) - (queryOne("SELECT COALESCE(SUM(quantity),0) as t FROM sales")?.t || 0),
      recentTransactions: queryAll("SELECT 'Sale' as type,s.id,s.date,s.net_amount as amount,b.name as party_name,b.name_urdu as party_name_urdu,p.name as product_name,p.name_urdu as product_name_urdu FROM sales s LEFT JOIN buyers b ON s.buyer_id=b.id LEFT JOIN products p ON s.product_id=p.id UNION ALL SELECT 'Purchase',pu.id,pu.date,pu.net_amount,sp.name,sp.name_urdu,p.name,p.name_urdu FROM purchases pu LEFT JOIN suppliers sp ON pu.supplier_id=sp.id LEFT JOIN products p ON pu.product_id=p.id ORDER BY date DESC LIMIT 10")
    };
  });

  // Buyers
  ipcMain.handle('get-buyers', () => queryAll('SELECT * FROM buyers ORDER BY created_at DESC'));
  ipcMain.handle('get-buyer', (_e, id) => queryOne('SELECT * FROM buyers WHERE id=?', [id]));
  ipcMain.handle('add-buyer', (_e, d) => runSql('INSERT INTO buyers (name,name_urdu,type,phone,address,cnic,opening_balance,status) VALUES (?,?,?,?,?,?,?,?)', [d.name, d.name_urdu, d.type, d.phone, d.address, d.cnic, d.opening_balance || 0, d.status || 'Active']));
  ipcMain.handle('update-buyer', (_e, id, d) => { runSql('UPDATE buyers SET name=?,name_urdu=?,type=?,phone=?,address=?,cnic=?,opening_balance=?,status=? WHERE id=?', [d.name, d.name_urdu, d.type, d.phone, d.address, d.cnic, d.opening_balance, d.status, id]); return { success: true }; });
  ipcMain.handle('delete-buyer', (_e, id) => { runSql('DELETE FROM buyers WHERE id=?', [id]); return { success: true }; });

  // Suppliers
  ipcMain.handle('get-suppliers', () => queryAll('SELECT * FROM suppliers ORDER BY created_at DESC'));
  ipcMain.handle('get-supplier', (_e, id) => queryOne('SELECT * FROM suppliers WHERE id=?', [id]));
  ipcMain.handle('add-supplier', (_e, d) => runSql('INSERT INTO suppliers (name,name_urdu,type,phone,address,cnic,opening_balance,status) VALUES (?,?,?,?,?,?,?,?)', [d.name, d.name_urdu, d.type, d.phone, d.address, d.cnic, d.opening_balance || 0, d.status || 'Active']));
  ipcMain.handle('update-supplier', (_e, id, d) => { runSql('UPDATE suppliers SET name=?,name_urdu=?,type=?,phone=?,address=?,cnic=?,opening_balance=?,status=? WHERE id=?', [d.name, d.name_urdu, d.type, d.phone, d.address, d.cnic, d.opening_balance, d.status, id]); return { success: true }; });
  ipcMain.handle('delete-supplier', (_e, id) => { runSql('DELETE FROM suppliers WHERE id=?', [id]); return { success: true }; });

  // Products
  ipcMain.handle('get-products', () => queryAll('SELECT * FROM products ORDER BY created_at DESC'));
  ipcMain.handle('get-product', (_e, id) => queryOne('SELECT * FROM products WHERE id=?', [id]));
  ipcMain.handle('add-product', (_e, d) => runSql('INSERT INTO products (name,name_urdu,unit,commission_rate,opening_stock,status) VALUES (?,?,?,?,?,?)', [d.name, d.name_urdu, d.unit, d.commission_rate || 0, d.opening_stock || 0, d.status || 'Active']));
  ipcMain.handle('update-product', (_e, id, d) => { runSql('UPDATE products SET name=?,name_urdu=?,unit=?,commission_rate=?,opening_stock=?,status=? WHERE id=?', [d.name, d.name_urdu, d.unit, d.commission_rate, d.opening_stock || 0, d.status, id]); return { success: true }; });
  ipcMain.handle('delete-product', (_e, id) => { runSql('DELETE FROM products WHERE id=?', [id]); return { success: true }; });

  // Units
  ipcMain.handle('get-units', () => queryAll('SELECT * FROM units ORDER BY name ASC'));
  ipcMain.handle('add-unit', (_e, name) => { runSql('INSERT OR IGNORE INTO units (name) VALUES (?)', [name]); return { success: true }; });
  ipcMain.handle('delete-unit', (_e, id) => { runSql('DELETE FROM units WHERE id=?', [id]); return { success: true }; });

  // Stock
  ipcMain.handle('get-stock-overview', () => queryAll("SELECT p.id,p.name,p.name_urdu,p.unit,p.opening_stock,COALESCE(p.opening_stock,0)+COALESCE((SELECT SUM(quantity) FROM purchases WHERE product_id=p.id),0) as total_purchased,COALESCE((SELECT SUM(quantity) FROM sales WHERE product_id=p.id),0) as total_sold,COALESCE(p.opening_stock,0)+COALESCE((SELECT SUM(quantity) FROM purchases WHERE product_id=p.id),0)-COALESCE((SELECT SUM(quantity) FROM sales WHERE product_id=p.id),0) as available_stock FROM products p WHERE p.status='Active'"));
  ipcMain.handle('get-product-stock', (_e, productId) => {
    const row = queryOne("SELECT COALESCE(p.opening_stock,0)+COALESCE((SELECT SUM(quantity) FROM purchases WHERE product_id=p.id),0)-COALESCE((SELECT SUM(quantity) FROM sales WHERE product_id=p.id),0) as available_stock FROM products p WHERE p.id=?", [productId]);
    return row ? row.available_stock : 0;
  });

  // Sales
  ipcMain.handle('get-sales', (_e, f) => { let q = "SELECT s.*,b.name as buyer_name,b.name_urdu as buyer_name_urdu,p.name as product_name,p.name_urdu as product_name_urdu,p.unit as product_unit,COALESCE(s.unit,p.unit) as display_unit FROM sales s LEFT JOIN buyers b ON s.buyer_id=b.id LEFT JOIN products p ON s.product_id=p.id"; const pp = [], conds = []; if (f?.dateFrom) { conds.push('substr(s.date,1,10)>=?'); pp.push(f.dateFrom); } if (f?.dateTo) { conds.push('substr(s.date,1,10)<=?'); pp.push(f.dateTo); } if (conds.length) q += ' WHERE ' + conds.join(' AND '); q += ' ORDER BY s.date DESC,s.id DESC'; return queryAll(q, pp); });
  ipcMain.handle('get-sale', (_e, id) => queryOne('SELECT * FROM sales WHERE id=?', [id]));
  ipcMain.handle('add-sale', (_e, d) => runSql('INSERT INTO sales (buyer_id,product_id,date,quantity,rate,total,commission,bardana,labour,net_amount,payment_mode,notes,amount_paid,payment_status,unit,commission_type,total_weight,kaat,munshiyana,kiraya,others) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [d.buyer_id, d.product_id, d.date, d.quantity, d.rate, d.total, d.commission, d.bardana, d.labour, d.net_amount, d.payment_mode, d.notes, d.amount_paid || 0, d.payment_status || 'To Receive', d.unit || null, d.commission_type || 'default', d.total_weight || 0, d.kaat || 0, d.munshiyana || 0, d.kiraya || 0, d.others || 0]));
  ipcMain.handle('update-sale', (_e, id, d) => { runSql('UPDATE sales SET buyer_id=?,product_id=?,date=?,quantity=?,rate=?,total=?,commission=?,bardana=?,labour=?,net_amount=?,payment_mode=?,notes=?,amount_paid=?,payment_status=?,unit=?,commission_type=?,total_weight=?,kaat=?,munshiyana=?,kiraya=?,others=? WHERE id=?', [d.buyer_id, d.product_id, d.date, d.quantity, d.rate, d.total, d.commission, d.bardana, d.labour, d.net_amount, d.payment_mode, d.notes, d.amount_paid || 0, d.payment_status || 'To Receive', d.unit || null, d.commission_type || 'default', d.total_weight || 0, d.kaat || 0, d.munshiyana || 0, d.kiraya || 0, d.others || 0, id]); return { success: true }; });
  ipcMain.handle('delete-sale', (_e, id) => { runSql('DELETE FROM sales WHERE id=?', [id]); return { success: true }; });

  // Purchases
  ipcMain.handle('get-purchases', (_e, f) => { let q = "SELECT pu.*,sp.name as supplier_name,sp.name_urdu as supplier_name_urdu,p.name as product_name,p.name_urdu as product_name_urdu,p.unit as product_unit,COALESCE(pu.unit,p.unit) as display_unit FROM purchases pu LEFT JOIN suppliers sp ON pu.supplier_id=sp.id LEFT JOIN products p ON pu.product_id=p.id"; const pp = [], conds = []; if (f?.dateFrom) { conds.push('substr(pu.date,1,10)>=?'); pp.push(f.dateFrom); } if (f?.dateTo) { conds.push('substr(pu.date,1,10)<=?'); pp.push(f.dateTo); } if (conds.length) q += ' WHERE ' + conds.join(' AND '); q += ' ORDER BY pu.date DESC,pu.id DESC'; return queryAll(q, pp); });
  ipcMain.handle('get-purchase', (_e, id) => queryOne('SELECT * FROM purchases WHERE id=?', [id]));
  ipcMain.handle('add-purchase', (_e, d) => runSql('INSERT INTO purchases (supplier_id,product_id,date,quantity,rate,total,commission,bardana,labour,net_amount,payment_mode,notes,amount_paid,payment_status,unit,commission_type,total_weight,kaat,munshiyana,kiraya,others) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [d.supplier_id, d.product_id, d.date, d.quantity, d.rate, d.total, d.commission, d.bardana, d.labour, d.net_amount, d.payment_mode, d.notes, d.amount_paid || 0, d.payment_status || 'To Pay', d.unit || null, d.commission_type || 'default', d.total_weight || 0, d.kaat || 0, d.munshiyana || 0, d.kiraya || 0, d.others || 0]));
  ipcMain.handle('update-purchase', (_e, id, d) => { runSql('UPDATE purchases SET supplier_id=?,product_id=?,date=?,quantity=?,rate=?,total=?,commission=?,bardana=?,labour=?,net_amount=?,payment_mode=?,notes=?,amount_paid=?,payment_status=?,unit=?,commission_type=?,total_weight=?,kaat=?,munshiyana=?,kiraya=?,others=? WHERE id=?', [d.supplier_id, d.product_id, d.date, d.quantity, d.rate, d.total, d.commission, d.bardana, d.labour, d.net_amount, d.payment_mode, d.notes, d.amount_paid || 0, d.payment_status || 'To Pay', d.unit || null, d.commission_type || 'default', d.total_weight || 0, d.kaat || 0, d.munshiyana || 0, d.kiraya || 0, d.others || 0, id]); return { success: true }; });
  ipcMain.handle('delete-purchase', (_e, id) => { runSql('DELETE FROM purchases WHERE id=?', [id]); return { success: true }; });

  // Payments
  ipcMain.handle('get-payments', (_e, f) => { let q = "SELECT pay.*,CASE WHEN pay.party_type='Buyer' THEN (SELECT name FROM buyers WHERE id=pay.party_id) ELSE (SELECT name FROM suppliers WHERE id=pay.party_id) END as party_name,CASE WHEN pay.party_type='Buyer' THEN (SELECT name_urdu FROM buyers WHERE id=pay.party_id) ELSE (SELECT name_urdu FROM suppliers WHERE id=pay.party_id) END as party_name_urdu FROM payments pay"; const pp = [], conds = []; if (f?.partyType) { conds.push('pay.party_type=?'); pp.push(f.partyType); } if (f?.dateFrom) { conds.push('substr(pay.date,1,10)>=?'); pp.push(f.dateFrom); } if (f?.dateTo) { conds.push('substr(pay.date,1,10)<=?'); pp.push(f.dateTo); } if (conds.length) q += ' WHERE ' + conds.join(' AND '); q += ' ORDER BY pay.date DESC,pay.id DESC'; return queryAll(q, pp); });
  ipcMain.handle('add-payment', (_e, d) => runSql('INSERT INTO payments (party_type,party_id,date,amount,type,mode,reference,notes) VALUES (?,?,?,?,?,?,?,?)', [d.party_type, d.party_id, d.date, d.amount, d.type, d.mode, d.reference, d.notes]));
  ipcMain.handle('delete-payment', (_e, id) => { runSql('DELETE FROM payments WHERE id=?', [id]); return { success: true }; });

  // Expenses — Daily Kharcha (خرچہ) — deducted from Rokar Khata
  ipcMain.handle('get-expenses', (_e, f) => {
    let q = 'SELECT * FROM expenses';
    const pp = [], conds = [];
    if (f?.dateFrom) { conds.push('substr(date,1,10)>=?'); pp.push(f.dateFrom); }
    if (f?.dateTo)   { conds.push('substr(date,1,10)<=?'); pp.push(f.dateTo); }
    if (f?.category) { conds.push('category=?'); pp.push(f.category); }
    if (conds.length) q += ' WHERE ' + conds.join(' AND ');
    q += ' ORDER BY date DESC, id DESC';
    return queryAll(q, pp);
  });
  ipcMain.handle('add-expense', (_e, d) => runSql(
    'INSERT INTO expenses (date,description,description_urdu,category,amount,notes) VALUES (?,?,?,?,?,?)',
    [d.date, d.description, d.description_urdu || '', d.category || 'General', d.amount, d.notes || '']
  ));
  ipcMain.handle('update-expense', (_e, id, d) => {
    runSql('UPDATE expenses SET date=?,description=?,description_urdu=?,category=?,amount=?,notes=? WHERE id=?',
      [d.date, d.description, d.description_urdu || '', d.category || 'General', d.amount, d.notes || '', id]);
    return { success: true };
  });
  ipcMain.handle('delete-expense', (_e, id) => { runSql('DELETE FROM expenses WHERE id=?', [id]); return { success: true }; });

  // Ledger
  ipcMain.handle('get-buyer-ledger', (_e, bid) => {
    const buyer = queryOne('SELECT * FROM buyers WHERE id=?', [bid]);
    const sales = queryAll("SELECT s.id as sale_id,s.date,'Sale' as type,p.name as product_name,p.name_urdu as product_name_urdu,s.quantity,s.rate,s.total,s.commission,s.bardana,s.labour,s.net_amount,s.net_amount as debit,0 as credit,s.notes,COALESCE(s.unit,p.unit) as display_unit,s.amount_paid,s.payment_status,s.payment_mode,s.commission_type,s.total_weight,s.kaat,s.munshiyana,s.kiraya,s.others FROM sales s LEFT JOIN products p ON s.product_id=p.id WHERE s.buyer_id=? ORDER BY s.date,s.id", [bid]);
    // Payments received at sale time (amount_paid from sales table)
    const salePayments = queryAll("SELECT NULL as sale_id,NULL as payment_id,s.date,'Payment' as type,p.name as product_name,p.name_urdu as product_name_urdu,0 as quantity,0 as rate,0 as total,0 as commission,0 as bardana,0 as labour,0 as net_amount,0 as debit,s.amount_paid as credit,COALESCE(s.notes,'') || ' (received with sale)' as notes,'' as display_unit,0 as amount_paid,'' as payment_status,s.payment_mode,'' as commission_type FROM sales s LEFT JOIN products p ON s.product_id=p.id WHERE s.buyer_id=? AND s.amount_paid>0 ORDER BY s.date,s.id", [bid]);
    // Separate standalone payments from payments table
    const payments = queryAll("SELECT id as payment_id,date,'Payment' as type,'' as product_name,'' as product_name_urdu,0 as quantity,0 as rate,0 as total,0 as commission,0 as bardana,0 as labour,0 as net_amount,CASE WHEN type='Paid' THEN amount ELSE 0 END as debit,CASE WHEN type='Received' THEN amount ELSE 0 END as credit,notes,'' as display_unit,0 as amount_paid,'' as payment_status,mode as payment_mode,'' as commission_type FROM payments WHERE party_type='Buyer' AND party_id=? ORDER BY date,id", [bid]);
    return { buyer, entries: [...sales, ...salePayments, ...payments].sort((a, b) => (a.date || '').localeCompare(b.date || '')) };
  });
  ipcMain.handle('get-supplier-ledger', (_e, sid) => {
    const supplier = queryOne('SELECT * FROM suppliers WHERE id=?', [sid]);
    const purchases = queryAll("SELECT pu.id as purchase_id,pu.date,'Purchase' as type,p.name as product_name,p.name_urdu as product_name_urdu,pu.quantity,pu.rate,pu.total,pu.commission,pu.bardana,pu.labour,pu.net_amount,pu.net_amount as debit,0 as credit,pu.notes,COALESCE(pu.unit,p.unit) as display_unit,pu.amount_paid,pu.payment_status,pu.payment_mode,pu.commission_type,pu.total_weight,pu.kaat,pu.munshiyana,pu.kiraya,pu.others FROM purchases pu LEFT JOIN products p ON pu.product_id=p.id WHERE pu.supplier_id=? ORDER BY pu.date,pu.id", [sid]);
    // Payments made at purchase time (amount_paid from purchases table)
    const purchasePayments = queryAll("SELECT NULL as purchase_id,NULL as payment_id,pu.date,'Payment' as type,p.name as product_name,p.name_urdu as product_name_urdu,0 as quantity,0 as rate,0 as total,0 as commission,0 as bardana,0 as labour,0 as net_amount,0 as debit,pu.amount_paid as credit,COALESCE(pu.notes,'') || ' (paid with purchase)' as notes,'' as display_unit,0 as amount_paid,'' as payment_status,pu.payment_mode,'' as commission_type FROM purchases pu LEFT JOIN products p ON pu.product_id=p.id WHERE pu.supplier_id=? AND pu.amount_paid>0 ORDER BY pu.date,pu.id", [sid]);
    // Separate standalone payments from payments table
    const payments = queryAll("SELECT id as payment_id,date,'Payment' as type,'' as product_name,'' as product_name_urdu,0 as quantity,0 as rate,0 as total,0 as commission,0 as bardana,0 as labour,0 as net_amount,CASE WHEN type='Received' THEN amount ELSE 0 END as debit,CASE WHEN type='Paid' THEN amount ELSE 0 END as credit,notes,'' as display_unit,0 as amount_paid,'' as payment_status,mode as payment_mode,'' as commission_type FROM payments WHERE party_type='Supplier' AND party_id=? ORDER BY date,id", [sid]);
    return { supplier, entries: [...purchases, ...purchasePayments, ...payments].sort((a, b) => (a.date || '').localeCompare(b.date || '')) };
  });

  // Day Book
  ipcMain.handle('get-daybook', (_e, date) => {
    // Sales — full net_amount (represents the complete transaction value)
    const s = queryAll("SELECT 'Sale' as type,s.date,s.net_amount as amount,b.name as party_name,b.name_urdu as party_name_urdu,p.name as product_name,p.name_urdu as product_name_urdu FROM sales s LEFT JOIN buyers b ON s.buyer_id=b.id LEFT JOIN products p ON s.product_id=p.id WHERE substr(s.date,1,10)=?", [date]);
    // Purchases — full net_amount (represents the complete transaction value)
    const pu = queryAll("SELECT 'Purchase' as type,pu.date,pu.net_amount as amount,sp.name as party_name,sp.name_urdu as party_name_urdu,p.name as product_name,p.name_urdu as product_name_urdu FROM purchases pu LEFT JOIN suppliers sp ON pu.supplier_id=sp.id LEFT JOIN products p ON pu.product_id=p.id WHERE substr(pu.date,1,10)=?", [date]);
    // Standalone payments from the payments table only (no inline amount_paid — avoids double-counting)
    const pa = queryAll("SELECT CASE WHEN type='Received' THEN 'Payment In' ELSE 'Payment Out' END as type,date,amount,CASE WHEN party_type='Buyer' THEN (SELECT name FROM buyers WHERE id=party_id) ELSE (SELECT name FROM suppliers WHERE id=party_id) END as party_name,CASE WHEN party_type='Buyer' THEN (SELECT name_urdu FROM buyers WHERE id=party_id) ELSE (SELECT name_urdu FROM suppliers WHERE id=party_id) END as party_name_urdu,'' as product_name,'' as product_name_urdu FROM payments WHERE substr(date,1,10)=?", [date]);
    return [...s, ...pu, ...pa];
  });

  // Rokar Khata — Full Cash Book (روکڑ کھاتہ)
  // Tracks ALL physical cash that moves in/out of hand, regardless of party type.
  // Rule:
  //   Walk-in buyer/supplier  → full net_amount (they always settle fully in cash)
  //   Regular buyer/supplier  → only the cash portion (amount_paid at time of transaction)
  //   Standalone payments     → only mode='Cash' (excludes cheque, transfer, etc.)
  ipcMain.handle('get-rokar', (_e, date) => {
    // ─── جمع (Cash In) ───────────────────────────────────────────────────────

    // 1. Walk-in buyer sales — full amount received in cash on the spot
    const walkInSales = queryAll(
      `SELECT 'Walk-in Sale' as type, s.date, s.net_amount as amount,
              b.name as party_name, b.name_urdu as party_name_urdu,
              p.name as product_name, p.name_urdu as product_name_urdu
       FROM sales s
       LEFT JOIN buyers b ON s.buyer_id = b.id
       LEFT JOIN products p ON s.product_id = p.id
       WHERE substr(s.date,1,10)=? AND b.type='Walk-in'`, [date]);

    // 2. Regular buyer sales where cash was received at time of sale (amount_paid > 0)
    //    e.g. buyer pays half now, rest on credit — the "half now" comes into Rokar
    const regularCashSales = queryAll(
      `SELECT 'Cash Received' as type, s.date, s.amount_paid as amount,
              b.name as party_name, b.name_urdu as party_name_urdu,
              p.name as product_name, p.name_urdu as product_name_urdu
       FROM sales s
       LEFT JOIN buyers b ON s.buyer_id = b.id
       LEFT JOIN products p ON s.product_id = p.id
       WHERE substr(s.date,1,10)=? AND b.type='Regular' AND s.amount_paid > 0`, [date]);

    // ─── خرچ (Cash Out) ──────────────────────────────────────────────────────

    // 3. Walk-in supplier purchases — full amount paid in cash on the spot
    const walkInPurchases = queryAll(
      `SELECT 'Walk-in Purchase' as type, pu.date, pu.net_amount as amount,
              sp.name as party_name, sp.name_urdu as party_name_urdu,
              p.name as product_name, p.name_urdu as product_name_urdu
       FROM purchases pu
       LEFT JOIN suppliers sp ON pu.supplier_id = sp.id
       LEFT JOIN products p ON pu.product_id = p.id
       WHERE substr(pu.date,1,10)=? AND sp.type='Walk-in'`, [date]);

    // 4. Regular supplier purchases where cash was paid at time of purchase (amount_paid > 0)
    //    e.g. supplier asks for half in cash now — that half goes OUT of Rokar
    const regularCashPurchases = queryAll(
      `SELECT 'Cash Paid' as type, pu.date, pu.amount_paid as amount,
              sp.name as party_name, sp.name_urdu as party_name_urdu,
              p.name as product_name, p.name_urdu as product_name_urdu
       FROM purchases pu
       LEFT JOIN suppliers sp ON pu.supplier_id = sp.id
       LEFT JOIN products p ON pu.product_id = p.id
       WHERE substr(pu.date,1,10)=? AND sp.type='Regular' AND pu.amount_paid > 0`, [date]);

    // 5. Standalone cash payments (mode='Cash' only — excludes cheque/transfer)
    //    Covers both regular and walk-in parties' separate payment entries
    //    e.g. daily kharcha, or settling a running balance in cash
    const cashPayments = queryAll(
      `SELECT CASE WHEN pay.type='Received' THEN 'Cash Received' ELSE 'Cash Paid' END as type,
              pay.date, pay.amount,
              CASE WHEN pay.party_type='Buyer'
                THEN (SELECT name FROM buyers WHERE id=pay.party_id)
                ELSE (SELECT name FROM suppliers WHERE id=pay.party_id)
              END as party_name,
              CASE WHEN pay.party_type='Buyer'
                THEN (SELECT name_urdu FROM buyers WHERE id=pay.party_id)
                ELSE (SELECT name_urdu FROM suppliers WHERE id=pay.party_id)
              END as party_name_urdu,
              '' as product_name, '' as product_name_urdu
       FROM payments pay
       WHERE substr(pay.date,1,10)=? AND pay.mode='Cash'`, [date]);

    // 6. Daily expenses (خرچہ) — cash spent from Rokar on misc daily expenses
    const dailyExpenses = queryAll(
      `SELECT 'Expense' as type, e.date, e.amount,
              e.category as party_name, '' as party_name_urdu,
              e.description as product_name, e.description_urdu as product_name_urdu
       FROM expenses e
       WHERE substr(e.date,1,10)=?`, [date]);

    return [...walkInSales, ...regularCashSales, ...walkInPurchases, ...regularCashPurchases, ...cashPayments, ...dailyExpenses];
  });

  // Rokar Khata — All-time running balance (نقد بیلنس)
  // Returns the cumulative cash in hand = Opening Balance + All Cash In − All Cash Out
  ipcMain.handle('get-rokar-cumulative', () => {
    const openingBalance = parseFloat(queryOne("SELECT value FROM settings WHERE key='rokar_opening_balance'")?.value || '0');

    // All-time جمع (Cash In)
    const allWalkInSales     = queryOne("SELECT COALESCE(SUM(s.net_amount),0) as t FROM sales s LEFT JOIN buyers b ON s.buyer_id=b.id WHERE b.type='Walk-in'")?.t || 0;
    const allRegCashSales    = queryOne("SELECT COALESCE(SUM(s.amount_paid),0) as t FROM sales s LEFT JOIN buyers b ON s.buyer_id=b.id WHERE b.type='Regular' AND s.amount_paid>0")?.t || 0;
    const allCashPaymentsIn  = queryOne("SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE type='Received' AND mode='Cash'")?.t || 0;

    // All-time خرچ (Cash Out)
    const allWalkInPurchases  = queryOne("SELECT COALESCE(SUM(pu.net_amount),0) as t FROM purchases pu LEFT JOIN suppliers sp ON pu.supplier_id=sp.id WHERE sp.type='Walk-in'")?.t || 0;
    const allRegCashPurchases = queryOne("SELECT COALESCE(SUM(pu.amount_paid),0) as t FROM purchases pu LEFT JOIN suppliers sp ON pu.supplier_id=sp.id WHERE sp.type='Regular' AND pu.amount_paid>0")?.t || 0;
    const allCashPaymentsOut  = queryOne("SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE type='Paid' AND mode='Cash'")?.t || 0;
    const allExpenses         = queryOne("SELECT COALESCE(SUM(amount),0) as t FROM expenses")?.t || 0;

    const totalIn  = allWalkInSales + allRegCashSales + allCashPaymentsIn;
    const totalOut = allWalkInPurchases + allRegCashPurchases + allCashPaymentsOut + allExpenses;
    const balance  = openingBalance + totalIn - totalOut;

    return { openingBalance, totalIn, totalOut, balance };
  });

  // Reports
  ipcMain.handle('get-report', (_e, type, f) => {
    const p = []; if (f?.dateFrom) p.push(f.dateFrom); if (f?.dateTo) p.push(f.dateTo);
    if (type === 'daily-sales') return queryAll("SELECT s.*,b.name as buyer_name,b.name_urdu as buyer_name_urdu,pr.name as product_name,pr.name_urdu as product_name_urdu FROM sales s LEFT JOIN buyers b ON s.buyer_id=b.id LEFT JOIN products pr ON s.product_id=pr.id WHERE substr(s.date,1,10)>=? AND substr(s.date,1,10)<=? ORDER BY s.date DESC", p);
    if (type === 'daily-purchases') return queryAll("SELECT pu.*,sp.name as supplier_name,sp.name_urdu as supplier_name_urdu,pr.name as product_name,pr.name_urdu as product_name_urdu FROM purchases pu LEFT JOIN suppliers sp ON pu.supplier_id=sp.id LEFT JOIN products pr ON pu.product_id=pr.id WHERE substr(pu.date,1,10)>=? AND substr(pu.date,1,10)<=? ORDER BY pu.date DESC", p);
    if (type === 'stock') return queryAll("SELECT p.id,p.name,p.name_urdu,p.unit,COALESCE(p.opening_stock,0) as opening_stock,COALESCE((SELECT SUM(quantity) FROM purchases WHERE product_id=p.id),0) as purchased,COALESCE((SELECT SUM(quantity) FROM sales WHERE product_id=p.id),0) as sold,COALESCE(p.opening_stock,0)+COALESCE((SELECT SUM(quantity) FROM purchases WHERE product_id=p.id),0)-COALESCE((SELECT SUM(quantity) FROM sales WHERE product_id=p.id),0) as stock FROM products p WHERE p.status='Active'");
    if (type === 'buyer-outstanding') return queryAll("SELECT b.id,b.name,b.name_urdu,b.phone,b.opening_balance,COALESCE((SELECT SUM(net_amount) FROM sales WHERE buyer_id=b.id),0) as total_sales,COALESCE((SELECT SUM(amount) FROM payments WHERE party_type='Buyer' AND party_id=b.id AND type='Received'),0)+COALESCE((SELECT SUM(amount_paid) FROM sales WHERE buyer_id=b.id),0) as total_paid,b.opening_balance+COALESCE((SELECT SUM(net_amount) FROM sales WHERE buyer_id=b.id),0)-COALESCE((SELECT SUM(amount) FROM payments WHERE party_type='Buyer' AND party_id=b.id AND type='Received'),0)-COALESCE((SELECT SUM(amount_paid) FROM sales WHERE buyer_id=b.id),0) as balance FROM buyers b WHERE b.status='Active' AND b.type='Regular' ORDER BY balance DESC");
    if (type === 'supplier-outstanding') return queryAll("SELECT sp.id,sp.name,sp.name_urdu,sp.phone,sp.opening_balance,COALESCE((SELECT SUM(net_amount) FROM purchases WHERE supplier_id=sp.id),0) as total_purchases,COALESCE((SELECT SUM(amount) FROM payments WHERE party_type='Supplier' AND party_id=sp.id AND type='Paid'),0)+COALESCE((SELECT SUM(amount_paid) FROM purchases WHERE supplier_id=sp.id),0) as total_paid,sp.opening_balance+COALESCE((SELECT SUM(net_amount) FROM purchases WHERE supplier_id=sp.id),0)-COALESCE((SELECT SUM(amount) FROM payments WHERE party_type='Supplier' AND party_id=sp.id AND type='Paid'),0)-COALESCE((SELECT SUM(amount_paid) FROM purchases WHERE supplier_id=sp.id),0) as balance FROM suppliers sp WHERE sp.status='Active' AND sp.type='Regular' ORDER BY balance DESC");
    if (type === 'profit-loss') return { totalSales: queryOne("SELECT COALESCE(SUM(net_amount),0) as t FROM sales")?.t || 0, totalPurchases: queryOne("SELECT COALESCE(SUM(net_amount),0) as t FROM purchases")?.t || 0, totalCommission: (queryOne("SELECT COALESCE(SUM(commission),0) as t FROM sales")?.t || 0) + (queryOne("SELECT COALESCE(SUM(commission),0) as t FROM purchases")?.t || 0) };
    if (type === 'commission') {
      return queryAll("SELECT s.date,'Sale' as type,b.name as party_name,b.name_urdu as party_name_urdu,pr.name as product_name,pr.name_urdu as product_name_urdu,s.quantity,s.total,s.commission FROM sales s LEFT JOIN buyers b ON s.buyer_id=b.id LEFT JOIN products pr ON s.product_id=pr.id WHERE substr(s.date,1,10)>=? AND substr(s.date,1,10)<=? AND s.commission>0 UNION ALL SELECT pu.date,'Purchase' as type,sp.name as party_name,sp.name_urdu as party_name_urdu,pr.name as product_name,pr.name_urdu as product_name_urdu,pu.quantity,pu.total,pu.commission FROM purchases pu LEFT JOIN suppliers sp ON pu.supplier_id=sp.id LEFT JOIN products pr ON pu.product_id=pr.id WHERE substr(pu.date,1,10)>=? AND substr(pu.date,1,10)<=? AND pu.commission>0 ORDER BY date DESC", [f?.dateFrom, f?.dateTo, f?.dateFrom, f?.dateTo]);
    }

    // ─── Daily Stock Valuation Report (date-range filtered) ───
    if (type === 'stock-valuation') {
      const df = f?.dateFrom || '1900-01-01', dt = f?.dateTo || '2999-12-31';
      const products = queryAll("SELECT p.id,p.name,p.name_urdu,p.unit,COALESCE(p.opening_stock,0) as opening_stock FROM products p WHERE p.status='Active' ORDER BY p.name");
      return products.map(prod => {
        // Purchases before dateFrom = part of opening; within range = period purchases
        const prePurchQty = queryOne("SELECT COALESCE(SUM(quantity),0) as q FROM purchases WHERE product_id=? AND substr(date,1,10)<?", [prod.id, df])?.q || 0;
        const prePurchVal = queryOne("SELECT COALESCE(SUM(net_amount),0) as v FROM purchases WHERE product_id=? AND substr(date,1,10)<?", [prod.id, df])?.v || 0;
        const preSoldQty = queryOne("SELECT COALESCE(SUM(quantity),0) as q FROM sales WHERE product_id=? AND substr(date,1,10)<?", [prod.id, df])?.q || 0;
        const openingQty = prod.opening_stock + prePurchQty - preSoldQty;
        const purchasedQty = queryOne("SELECT COALESCE(SUM(quantity),0) as q FROM purchases WHERE product_id=? AND substr(date,1,10)>=? AND substr(date,1,10)<=?", [prod.id, df, dt])?.q || 0;
        const purchasedValue = queryOne("SELECT COALESCE(SUM(net_amount),0) as v FROM purchases WHERE product_id=? AND substr(date,1,10)>=? AND substr(date,1,10)<=?", [prod.id, df, dt])?.v || 0;
        const soldQty = queryOne("SELECT COALESCE(SUM(quantity),0) as q FROM sales WHERE product_id=? AND substr(date,1,10)>=? AND substr(date,1,10)<=?", [prod.id, df, dt])?.q || 0;
        const soldValue = queryOne("SELECT COALESCE(SUM(net_amount),0) as v FROM sales WHERE product_id=? AND substr(date,1,10)>=? AND substr(date,1,10)<=?", [prod.id, df, dt])?.v || 0;
        const closingQty = openingQty + purchasedQty - soldQty;
        const allPurchVal = prePurchVal + purchasedValue;
        const allPurchQty = prod.opening_stock + prePurchQty + purchasedQty;
        const avgRate = allPurchQty > 0 ? allPurchVal / allPurchQty : 0;
        const openingRate = avgRate;
        const purchaseRate = purchasedQty > 0 ? purchasedValue / purchasedQty : 0;
        const saleRate = soldQty > 0 ? soldValue / soldQty : 0;
        const openingValue = openingQty * avgRate;
        const closingValue = closingQty * avgRate;
        return {
          id: prod.id, name: prod.name, name_urdu: prod.name_urdu, unit: prod.unit,
          opening_qty: openingQty, opening_rate: openingRate, opening_value: openingValue,
          purchased_qty: purchasedQty, purchase_rate: purchaseRate, purchased_value: purchasedValue,
          sold_qty: soldQty, sale_rate: saleRate, sold_value: soldValue,
          closing_qty: closingQty, closing_rate: avgRate, closing_value: closingValue,
        };
      });
    }

    // ─── Balance Sheet (as-on date filtered) ───
    if (type === 'balance-sheet') {
      const dt = f?.dateTo || '2999-12-31';
      const df = `substr(date,1,10)<='${dt}'`;
      const getProductStocks = () => {
        const prods = queryAll("SELECT p.id,p.name,p.name_urdu,COALESCE(p.opening_stock,0) as opening_stock FROM products p WHERE p.status='Active' ORDER BY p.name");
        return prods.map(prod => {
          const pq = queryOne(`SELECT COALESCE(SUM(quantity),0) as q FROM purchases WHERE product_id=? AND ${df}`, [prod.id])?.q || 0;
          const pv = queryOne(`SELECT COALESCE(SUM(net_amount),0) as v FROM purchases WHERE product_id=? AND ${df}`, [prod.id])?.v || 0;
          const sq = queryOne(`SELECT COALESCE(SUM(quantity),0) as q FROM sales WHERE product_id=? AND ${df}`, [prod.id])?.q || 0;
          const cq = prod.opening_stock + pq - sq; const tq = prod.opening_stock + pq; const ar = tq > 0 ? pv / tq : 0;
          return { name: prod.name + ' Stock A/c', name_urdu: prod.name_urdu, value: cq * ar, qty: cq };
        });
      };
      const buyers = queryAll(`SELECT b.name,b.name_urdu,b.opening_balance,COALESCE((SELECT SUM(net_amount) FROM sales WHERE buyer_id=b.id AND ${df}),0) as total_sales,COALESCE((SELECT SUM(amount) FROM payments WHERE party_type='Buyer' AND party_id=b.id AND type='Received' AND ${df}),0)+COALESCE((SELECT SUM(amount_paid) FROM sales WHERE buyer_id=b.id AND ${df}),0) as total_paid FROM buyers b WHERE b.status='Active' AND b.type='Regular' ORDER BY b.name`);
      const assetCustomers = [], liabCustomers = [];
      buyers.forEach(b => {
        const bal = b.opening_balance + b.total_sales - b.total_paid;
        if (bal > 0.01) assetCustomers.push({ name: b.name, name_urdu: b.name_urdu || '', amount: bal });
        else if (bal < -0.01) liabCustomers.push({ name: b.name, name_urdu: b.name_urdu || '', amount: Math.abs(bal) });
      });
      const suppliers = queryAll(`SELECT sp.name,sp.name_urdu,sp.opening_balance,COALESCE((SELECT SUM(net_amount) FROM purchases WHERE supplier_id=sp.id AND ${df}),0) as total_purchases,COALESCE((SELECT SUM(amount) FROM payments WHERE party_type='Supplier' AND party_id=sp.id AND type='Paid' AND ${df}),0)+COALESCE((SELECT SUM(amount_paid) FROM purchases WHERE supplier_id=sp.id AND ${df}),0) as total_paid FROM suppliers sp WHERE sp.status='Active' AND sp.type='Regular' ORDER BY sp.name`);
      const assetSuppliers = [], liabSuppliers = [];
      suppliers.forEach(sp => {
        const bal = sp.opening_balance + sp.total_purchases - sp.total_paid;
        if (bal > 0.01) liabSuppliers.push({ name: sp.name, name_urdu: sp.name_urdu || '', amount: bal });
        else if (bal < -0.01) assetSuppliers.push({ name: sp.name, name_urdu: sp.name_urdu || '', amount: Math.abs(bal) });
      });
      const allAssetCustomers = [...assetCustomers, ...assetSuppliers];
      const allLiabCustomers = [...liabCustomers, ...liabSuppliers];
      const totalSaleAmountPaid = queryOne(`SELECT COALESCE(SUM(amount_paid),0) as t FROM sales WHERE ${df}`)?.t || 0;
      const totalPurchaseAmountPaid = queryOne(`SELECT COALESCE(SUM(amount_paid),0) as t FROM purchases WHERE ${df}`)?.t || 0;
      const totalPaymentsReceived = queryOne(`SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE type='Received' AND ${df}`)?.t || 0;
      const totalPaymentsPaid = queryOne(`SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE type='Paid' AND ${df}`)?.t || 0;
      const cashInHand = (totalSaleAmountPaid + totalPaymentsReceived) - (totalPurchaseAmountPaid + totalPaymentsPaid);
      const productStocks = getProductStocks();
      const assetStocks = productStocks.filter(s => s.value > 0.01);
      const liabStocks = productStocks.filter(s => s.value < -0.01).map(s => ({ ...s, value: Math.abs(s.value) }));
      const totalSales = queryOne(`SELECT COALESCE(SUM(net_amount),0) as t FROM sales WHERE ${df}`)?.t || 0;
      const totalPurchases = queryOne(`SELECT COALESCE(SUM(net_amount),0) as t FROM purchases WHERE ${df}`)?.t || 0;
      const totalCommission = (queryOne(`SELECT COALESCE(SUM(commission),0) as t FROM sales WHERE ${df}`)?.t || 0) + (queryOne(`SELECT COALESCE(SUM(commission),0) as t FROM purchases WHERE ${df}`)?.t || 0);
      const profitLoss = totalSales - totalPurchases + totalCommission;
      const customerAssetTotal = allAssetCustomers.reduce((s, c) => s + c.amount, 0);
      const cashTotal = Math.max(0, cashInHand);
      const stockAssetTotal = assetStocks.reduce((s, p) => s + p.value, 0);
      const assetsTotal = customerAssetTotal + cashTotal + stockAssetTotal;
      const customerLiabTotal = allLiabCustomers.reduce((s, c) => s + c.amount, 0);
      const stockLiabTotal = liabStocks.reduce((s, p) => s + p.value, 0);
      const equityValue = assetsTotal - customerLiabTotal - stockLiabTotal - Math.abs(Math.min(0, profitLoss));
      const liabTotal = assetsTotal;
      return {
        assets: { customers: allAssetCustomers, customerTotal: customerAssetTotal, cash: [{ name: 'Cash Book', name_urdu: 'روکڑ کھاتا', amount: cashTotal }], cashTotal, stocks: assetStocks, stockTotal: stockAssetTotal, total: assetsTotal },
        liabilities: { customers: allLiabCustomers, customerTotal: customerLiabTotal, stocks: liabStocks, stockTotal: stockLiabTotal, profitLoss, equity: equityValue, total: liabTotal },
        commissionEarned: totalCommission,
      };
    }

    // ─── Trial Balance (as-on date filtered) ───
    if (type === 'trial-balance') {
      const dt = f?.dateTo || '2999-12-31';
      const df = `substr(date,1,10)<='${dt}'`;
      const groups = [];
      const buyers = queryAll(`SELECT b.name,b.name_urdu,b.opening_balance,COALESCE((SELECT SUM(net_amount) FROM sales WHERE buyer_id=b.id AND ${df}),0) as total_sales,COALESCE((SELECT SUM(amount) FROM payments WHERE party_type='Buyer' AND party_id=b.id AND type='Received' AND ${df}),0)+COALESCE((SELECT SUM(amount_paid) FROM sales WHERE buyer_id=b.id AND ${df}),0) as total_paid FROM buyers b WHERE b.status='Active' AND b.type='Regular' ORDER BY b.name`);
      const suppliers = queryAll(`SELECT sp.name,sp.name_urdu,sp.opening_balance,COALESCE((SELECT SUM(net_amount) FROM purchases WHERE supplier_id=sp.id AND ${df}),0) as total_purchases,COALESCE((SELECT SUM(amount) FROM payments WHERE party_type='Supplier' AND party_id=sp.id AND type='Paid' AND ${df}),0)+COALESCE((SELECT SUM(amount_paid) FROM purchases WHERE supplier_id=sp.id AND ${df}),0) as total_paid FROM suppliers sp WHERE sp.status='Active' AND sp.type='Regular' ORDER BY sp.name`);
      const custAccounts = [];
      buyers.forEach(b => { const bal = b.opening_balance + b.total_sales - b.total_paid; custAccounts.push({ name: b.name, name_urdu: b.name_urdu || '', debit: Math.max(0, bal), credit: Math.max(0, -bal) }); });
      suppliers.forEach(sp => { const bal = sp.opening_balance + sp.total_purchases - sp.total_paid; custAccounts.push({ name: sp.name, name_urdu: sp.name_urdu || '', debit: Math.max(0, -bal), credit: Math.max(0, bal) }); });
      groups.push({ group: 'Customers', group_urdu: 'گاہک / سپلائرز', accounts: custAccounts });
      const totalSaleAmtPaid = queryOne(`SELECT COALESCE(SUM(amount_paid),0) as t FROM sales WHERE ${df}`)?.t || 0;
      const totalPurchAmtPaid = queryOne(`SELECT COALESCE(SUM(amount_paid),0) as t FROM purchases WHERE ${df}`)?.t || 0;
      const totalPmtReceived = queryOne(`SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE type='Received' AND ${df}`)?.t || 0;
      const totalPmtPaid = queryOne(`SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE type='Paid' AND ${df}`)?.t || 0;
      const cashBal = (totalSaleAmtPaid + totalPmtReceived) - (totalPurchAmtPaid + totalPmtPaid);
      groups.push({ group: 'Cash A/c', group_urdu: 'نقد کھاتا', accounts: [{ name: 'Cash Book', name_urdu: 'روکڑ کھاتا', debit: Math.max(0, cashBal), credit: Math.max(0, -cashBal) }] });
      const totalSales = queryOne(`SELECT COALESCE(SUM(net_amount),0) as t FROM sales WHERE ${df}`)?.t || 0;
      const totalPurchases = queryOne(`SELECT COALESCE(SUM(net_amount),0) as t FROM purchases WHERE ${df}`)?.t || 0;
      const totalComm = (queryOne(`SELECT COALESCE(SUM(commission),0) as t FROM sales WHERE ${df}`)?.t || 0) + (queryOne(`SELECT COALESCE(SUM(commission),0) as t FROM purchases WHERE ${df}`)?.t || 0);
      const pl = totalSales - totalPurchases + totalComm;
      groups.push({ group: 'Equity Capital', group_urdu: 'ایکویٹی سرمایہ', accounts: [{ name: 'Profit / Loss A/c', name_urdu: 'نفع نقصان', debit: Math.max(0, -pl), credit: Math.max(0, pl) }] });
      const prods = queryAll("SELECT p.id,p.name,p.name_urdu FROM products p WHERE p.status='Active' ORDER BY p.name");
      const saleAccounts = prods.map(pr => {
        const saleVal = queryOne(`SELECT COALESCE(SUM(net_amount),0) as v FROM sales WHERE product_id=? AND ${df}`, [pr.id])?.v || 0;
        return { name: pr.name + ' Sale A/c', name_urdu: pr.name_urdu || '', debit: 0, credit: saleVal };
      });
      groups.push({ group: 'Products Sale A/c', group_urdu: 'فروخت کھاتے', accounts: saleAccounts });
      const stockAccounts = prods.map(pr => {
        const pq = queryOne(`SELECT COALESCE(SUM(quantity),0) as q FROM purchases WHERE product_id=? AND ${df}`, [pr.id])?.q || 0;
        const pv = queryOne(`SELECT COALESCE(SUM(net_amount),0) as v FROM purchases WHERE product_id=? AND ${df}`, [pr.id])?.v || 0;
        const sq = queryOne(`SELECT COALESCE(SUM(quantity),0) as q FROM sales WHERE product_id=? AND ${df}`, [pr.id])?.q || 0;
        const os = queryOne("SELECT COALESCE(opening_stock,0) as o FROM products WHERE id=?", [pr.id])?.o || 0;
        const cq = os + pq - sq; const tq = os + pq; const ar = tq > 0 ? pv / tq : 0; const sv = cq * ar;
        return { name: pr.name + ' Stock A/c', name_urdu: pr.name_urdu || '', debit: Math.max(0, sv), credit: Math.max(0, -sv) };
      });
      groups.push({ group: 'Products Stock A/c', group_urdu: 'اسٹاک کھاتے', accounts: stockAccounts });
      const cogsAccounts = prods.map(pr => {
        const purchVal = queryOne(`SELECT COALESCE(SUM(net_amount),0) as v FROM purchases WHERE product_id=? AND ${df}`, [pr.id])?.v || 0;
        return { name: pr.name + ' Expense A/c', name_urdu: pr.name_urdu || '', debit: purchVal, credit: 0 };
      });
      groups.push({ group: 'Products COGs A/c', group_urdu: 'لاگت کھاتے', accounts: cogsAccounts });
      let totalDebit = 0, totalCredit = 0;
      groups.forEach(g => { g.subtotalDebit = g.accounts.reduce((s, a) => s + a.debit, 0); g.subtotalCredit = g.accounts.reduce((s, a) => s + a.credit, 0); totalDebit += g.subtotalDebit; totalCredit += g.subtotalCredit; });
      return { groups, totalDebit, totalCredit };
    }

    return [];
  });

  // Backup
  ipcMain.handle('backup-database', async () => {
    const r = await dialog.showSaveDialog(mainWindow, { title: 'Backup', defaultPath: `rana-traders-backup-${new Date().toISOString().split('T')[0]}.db`, filters: [{ name: 'Database', extensions: ['db'] }] });
    if (!r.canceled && r.filePath) { saveDb(); fs.copyFileSync(getDbPath(), r.filePath); return { success: true, path: r.filePath }; }
    return { success: false };
  });

  // Restore database from backup
  ipcMain.handle('restore-database', async () => {
    const r = await dialog.showOpenDialog(mainWindow, {
      title: 'Restore Database — بیک اپ بحال کریں',
      filters: [{ name: 'Database', extensions: ['db'] }],
      properties: ['openFile']
    });
    if (r.canceled || !r.filePaths.length) return { success: false };
    const selectedPath = r.filePaths[0];
    try {
      // Validate the file is a valid SQLite database
      const initSqlJs = require('sql.js');
      const SQL = await initSqlJs();
      const buffer = fs.readFileSync(selectedPath);
      const testDb = new SQL.Database(buffer);
      // Quick check: try to read a table
      try { testDb.exec('SELECT COUNT(*) FROM buyers'); } catch (e) {
        testDb.close();
        return { success: false, message: 'Invalid database file — this backup does not contain the expected tables.' };
      }
      testDb.close();
      // Close current database, replace file, reinitialize
      closeDb();
      fs.copyFileSync(selectedPath, getDbPath());
      await initDatabase();
      // Show success message and wait for user acknowledgement
      await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Database Restored — ڈیٹا بیس بحال ہو گیا',
        message: '✅  Database imported successfully!\nڈیٹا بیس کامیابی سے درآمد ہو گیا!',
        detail: 'The app will now restart to load the imported data.\nایپ اب نیا ڈیٹا لوڈ کرنے کے لیے ری اسٹارٹ ہو گی۔',
        buttons: ['OK'],
        noLink: true
      });
      mainWindow.webContents.send('database-restored');
      mainWindow.reload();
      mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.blur();
        mainWindow.focus();
        mainWindow.webContents.focus();
      });
      return { success: true };
    } catch (e) {
      console.error('Restore failed:', e);
      return { success: false, message: 'Failed to restore: ' + e.message };
    }
  });

  // Reset database (clear all data, start fresh with empty tables)
  ipcMain.handle('reset-database', async () => {
    const confirm = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Reset Database — ڈیٹا بیس ری سیٹ',
      message: 'Are you sure you want to delete ALL data?\nکیا آپ واقعی تمام ڈیٹا حذف کرنا چاہتے ہیں؟',
      detail: 'This will permanently remove all buyers, suppliers, products, sales, purchases, payments, and settings. This cannot be undone!\n\nیہ تمام ڈیٹا مستقل طور پر حذف کر دے گا۔ یہ واپس نہیں ہو سکتا!',
      buttons: ['Cancel', 'Yes, Reset Everything'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    });
    if (confirm.response !== 1) return { success: false };
    try {
      await resetDatabase();
      mainWindow.reload();
      mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.blur();
        mainWindow.focus();
        mainWindow.webContents.focus();
      });
      return { success: true };
    } catch (e) {
      console.error('Reset failed:', e);
      return { success: false, message: 'Reset failed: ' + e.message };
    }
  });

  // Get database info
  ipcMain.handle('get-database-info', () => {
    const dbFilePath = getDbPath();
    const stats = fs.statSync(dbFilePath);
    const { queryOne } = getDb();
    return {
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      counts: {
        buyers: queryOne('SELECT COUNT(*) as c FROM buyers')?.c || 0,
        suppliers: queryOne('SELECT COUNT(*) as c FROM suppliers')?.c || 0,
        products: queryOne('SELECT COUNT(*) as c FROM products')?.c || 0,
        sales: queryOne('SELECT COUNT(*) as c FROM sales')?.c || 0,
        purchases: queryOne('SELECT COUNT(*) as c FROM purchases')?.c || 0,
        payments: queryOne('SELECT COUNT(*) as c FROM payments')?.c || 0,
      }
    };
  });

  // Settings
  ipcMain.handle('get-setting', (_e, key) => queryOne('SELECT value FROM settings WHERE key=?', [key])?.value || null);
  ipcMain.handle('set-setting', (_e, key, val) => { runSql('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)', [key, val]); return { success: true }; });

  // File export — show save dialog, write file to chosen path
  ipcMain.handle('save-file-dialog', async (_e, defaultName, filters, dataBase64) => {
    // Strip characters illegal in Windows filenames: \ / : * ? " < > |
    const safeName = (defaultName || 'export').replace(/[\\/:*?"<>|]/g, '-');
    const r = await dialog.showSaveDialog(mainWindow, {
      title: 'Save File',
      defaultPath: safeName,
      filters: filters || [{ name: 'All Files', extensions: ['*'] }]
    });
    if (r.canceled || !r.filePath) return { success: false };
    try {
      fs.writeFileSync(r.filePath, Buffer.from(dataBase64, 'base64'));
      return { success: true, path: r.filePath };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
}

app.whenReady().then(async () => {
  if (!checkMacAddress()) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'رانا ٹریڈرز — Access Denied',
      message: '⛔  This device is not authorized',
      detail: [
        'اس ڈیوائس کو یہ ایپ چلانے کی اجازت نہیں ہے۔',
        'This device is not registered to run Rana Traders.',
        '',
        'Please contact the developers to authorize',
        'this device for use:',
        '',
        '📞  Aqsam Husnain  —  0303-6487829',
        '📞  Wajid Raza Asdi  —  0301-6314479',
        '',
        'ڈویلپرز سے رابطہ کریں تاکہ اس ڈیوائس کو',
        'استعمال کی اجازت دی جا سکے۔',
      ].join('\n'),
      buttons: ['OK'],
      noLink: true
    });
    app.quit();
    return;
  }
  await initDatabase();
  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => { closeDb(); if (process.platform !== 'darwin') app.quit(); });
