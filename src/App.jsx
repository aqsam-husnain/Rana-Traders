import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Buyers from './pages/Buyers';
import Suppliers from './pages/Suppliers';
import BuyerKhata from './pages/BuyerKhata';
import SupplierKhata from './pages/SupplierKhata';
import Products from './pages/Products';
import StockOverview from './pages/StockOverview';
import Sales from './pages/Sales';
import Purchases from './pages/Purchases';
import DayBook from './pages/DayBook';
import Commission from './pages/Commission';
import Reports from './pages/Reports';
import Expenses from './pages/Expenses';
import Settings from './pages/Settings';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Login />;

  return (
    <Routes>
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="buyers" element={<Buyers />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="buyer/:id" element={<BuyerKhata />} />
        <Route path="supplier/:id" element={<SupplierKhata />} />
        <Route path="products" element={<Products />} />
        <Route path="stock" element={<StockOverview />} />
        <Route path="sales" element={<Sales />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="daybook" element={<DayBook defaultTab="roznamcha" />} />
        <Route path="rokar" element={<DayBook defaultTab="rokar" />} />
        <Route path="commission" element={<Commission />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
