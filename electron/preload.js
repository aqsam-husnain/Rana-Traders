const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  login: (u, p) => ipcRenderer.invoke('login', u, p),
  getMacAddresses: () => ipcRenderer.invoke('get-mac-addresses'),
  getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
  // Buyers
  getBuyers: () => ipcRenderer.invoke('get-buyers'),
  getBuyer: (id) => ipcRenderer.invoke('get-buyer', id),
  addBuyer: (d) => ipcRenderer.invoke('add-buyer', d),
  updateBuyer: (id, d) => ipcRenderer.invoke('update-buyer', id, d),
  deleteBuyer: (id) => ipcRenderer.invoke('delete-buyer', id),
  // Suppliers
  getSuppliers: () => ipcRenderer.invoke('get-suppliers'),
  getSupplier: (id) => ipcRenderer.invoke('get-supplier', id),
  addSupplier: (d) => ipcRenderer.invoke('add-supplier', d),
  updateSupplier: (id, d) => ipcRenderer.invoke('update-supplier', id, d),
  deleteSupplier: (id) => ipcRenderer.invoke('delete-supplier', id),
  // Products
  getProducts: () => ipcRenderer.invoke('get-products'),
  getProduct: (id) => ipcRenderer.invoke('get-product', id),
  addProduct: (d) => ipcRenderer.invoke('add-product', d),
  updateProduct: (id, d) => ipcRenderer.invoke('update-product', id, d),
  deleteProduct: (id) => ipcRenderer.invoke('delete-product', id),
  // Units
  getUnits: () => ipcRenderer.invoke('get-units'),
  addUnit: (name) => ipcRenderer.invoke('add-unit', name),
  deleteUnit: (id) => ipcRenderer.invoke('delete-unit', id),
  // Stock
  getStockOverview: () => ipcRenderer.invoke('get-stock-overview'),
  getProductStock: (productId) => ipcRenderer.invoke('get-product-stock', productId),
  // Sales
  getSales: (f) => ipcRenderer.invoke('get-sales', f),
  addSale: (d) => ipcRenderer.invoke('add-sale', d),
  deleteSale: (id) => ipcRenderer.invoke('delete-sale', id),
  // Purchases
  getPurchases: (f) => ipcRenderer.invoke('get-purchases', f),
  addPurchase: (d) => ipcRenderer.invoke('add-purchase', d),
  deletePurchase: (id) => ipcRenderer.invoke('delete-purchase', id),
  // Payments
  getPayments: (f) => ipcRenderer.invoke('get-payments', f),
  addPayment: (d) => ipcRenderer.invoke('add-payment', d),
  deletePayment: (id) => ipcRenderer.invoke('delete-payment', id),
  // Ledger
  getBuyerLedger: (id) => ipcRenderer.invoke('get-buyer-ledger', id),
  getSupplierLedger: (id) => ipcRenderer.invoke('get-supplier-ledger', id),
  getDaybook: (date) => ipcRenderer.invoke('get-daybook', date),
  // Reports
  getReport: (type, f) => ipcRenderer.invoke('get-report', type, f),
  // Backup & Restore
  backupDatabase: () => ipcRenderer.invoke('backup-database'),
  restoreDatabase: () => ipcRenderer.invoke('restore-database'),
  resetDatabase: () => ipcRenderer.invoke('reset-database'),
  getDatabaseInfo: () => ipcRenderer.invoke('get-database-info'),
  onDatabaseRestored: (callback) => ipcRenderer.on('database-restored', callback),
  // Settings
  getSetting: (key) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key, val) => ipcRenderer.invoke('set-setting', key, val),
});
