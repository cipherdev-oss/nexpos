import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { Onboarding } from './components/Onboarding';
import { MainLayout } from './components/MainLayout';
import { Dashboard } from './components/Dashboard';
import { InventoryList } from './components/InventoryList';
import { POSEngine } from './components/POSEngine';
import { UserManagement } from './components/UserManagement';
import { OrgSettings } from './components/OrgSettings';
import { CategoryManagement } from './components/CategoryManagement';

import { Settings } from 'lucide-react';

function AppContent() {
  const { user, profile, org, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950">
        <div className="absolute inset-0 technical-grid opacity-50" />
        <div className="flex flex-col items-center gap-8 relative z-10">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-white/5 border-t-indigo-500 rounded-full animate-spin" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-indigo-500/20 rounded-full" />
          </div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.5em] animate-pulse">
            Booting NestPOS Infrastructure
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (!profile || !org) {
    return <Onboarding />;
  }

  const isAdmin = profile?.role === 'owner' || profile?.role === 'admin';

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={isAdmin ? <Dashboard /> : <Navigate to="/pos" replace />} />
          <Route path="/inventory" element={isAdmin ? <InventoryList /> : <Navigate to="/pos" replace />} />
          <Route path="/categories" element={isAdmin ? <CategoryManagement /> : <Navigate to="/pos" replace />} />
          <Route path="/pos" element={<POSEngine />} />
          <Route path="/analytics" element={isAdmin ? <Dashboard /> : <Navigate to="/pos" replace />} />
          <Route path="/users" element={isAdmin ? <UserManagement /> : <Navigate to="/pos" replace />} />
          <Route path="/settings" element={isAdmin ? <OrgSettings /> : <Navigate to="/pos" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
