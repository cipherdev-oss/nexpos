import React from 'react';
import { useAuth } from '../lib/AuthContext';
import { logOut } from '../lib/firebase';
import { 
  BarChart3, 
  Package, 
  ShoppingCart, 
  Settings, 
  LogOut, 
  User as UserIcon,
  Shield,
  LayoutDashboard,
  Box,
  Users
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from './UI';

export function MainLayout() {
  const { profile, org, isImpersonating, stopImpersonating } = useAuth();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['owner', 'admin'] },
    { icon: ShoppingCart, label: 'Sales Terminal', path: '/pos', roles: ['owner', 'admin', 'cashier'] },
    { icon: Box, label: 'Inventory Hub', path: '/inventory', roles: ['owner', 'admin'] },
    { icon: Users, label: 'Staff Node', path: '/users', roles: ['owner', 'admin'] },
    { icon: BarChart3, label: 'Analytics', path: '/analytics', roles: ['owner', 'admin'] },
    { icon: Settings, label: 'Configuration', path: '/settings', roles: ['owner', 'admin'] },
  ];

  const filteredNavItems = navItems.filter(item => 
    !item.roles || (profile?.role && item.roles.includes(profile.role))
  );

  return (
    <div className="flex h-screen bg-transparent relative overflow-hidden">
      {/* Impersonation Indicator Overlay */}
      {isImpersonating && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-indigo-600 px-6 py-2 flex items-center justify-center gap-6 shadow-2xl">
          <div className="flex items-center gap-3">
            <UserIcon className="w-4 h-4 text-white animate-pulse" />
            <span className="text-xs font-black text-white uppercase tracking-widest">
              Impersonation Active: Acting as {profile?.displayName || profile?.email} ({profile?.role})
            </span>
          </div>
          <button 
            onClick={stopImpersonating}
            className="px-4 py-1.5 bg-white text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all shadow-lg"
          >
            Exit Staff Mode
          </button>
        </div>
      )}

      {/* Sidebar */}
      <aside className={cn("w-72 h-full glass-panel flex flex-col z-20 transition-all", isImpersonating && "pt-12")}>
        <div className="p-8 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center font-bold text-2xl shadow-lg shadow-indigo-500/20 text-white">
              N
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white">NexPOS <span className="text-indigo-400">Cloud</span></span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] leading-none mt-1">Tenant v2.4</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-6 space-y-2">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-all rounded-2xl",
                isActive 
                  ? "bg-white/10 text-white shadow-sm border border-white/10" 
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
              )}
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn("w-5 h-5", isActive ? "text-indigo-400" : "text-slate-500")} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-6 border-t border-white/10">
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5 mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-white/10">
              <UserIcon className="w-5 h-5 text-slate-300" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-white truncate">
                {profile?.displayName || 'User'}
              </span>
              <div className="flex items-center gap-1.5 ">
                <Shield className="w-3 h-3 text-indigo-400" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{profile?.role}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={logOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.2em] text-slate-500 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={cn("flex-1 flex flex-col min-w-0 h-full relative z-10 transition-all", isImpersonating && "pt-12")}>
        <header className="h-24 flex items-center justify-between px-10">
          <div>
            <div className="flex items-center gap-3 text-slate-400 mb-1">
              <Box className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Active Environment</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {org?.name || 'Loading Workspace...'}
            </h1>
          </div>
          
          <div className="flex gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-semibold text-slate-200">Cloud Sync: Active</span>
            </div>
            <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl px-5 py-3 flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Base Currency</span>
                <span className="text-sm font-mono font-bold text-indigo-100">{org?.currency || 'USD'}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto px-10 pb-10 technical-grid">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
