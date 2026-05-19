import React, { useState, useEffect } from 'react';
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
  Layers,
  Users,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn, Button } from './UI';
import { motion, AnimatePresence } from 'motion/react';

export function MainLayout() {
  const { profile, org, isImpersonating, stopImpersonating } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === 'true';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(isCollapsed));
  }, [isCollapsed]);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['owner', 'admin'] },
    { icon: ShoppingCart, label: 'Sales Terminal', path: '/pos', roles: ['owner', 'admin', 'cashier'] },
    { icon: Box, label: 'Inventory Hub', path: '/inventory', roles: ['owner', 'admin'] },
    { icon: Layers, label: 'Categories', path: '/categories', roles: ['owner', 'admin'] },
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

      {/* Sidebar - Desktop */}
      <motion.aside 
        initial={false}
        animate={{ width: isCollapsed ? 88 : 288 }}
        className={cn(
          "h-full glass-panel hidden lg:flex flex-col z-20 relative transition-colors duration-300", 
          isImpersonating && "pt-12"
        )}
      >
        {/* Toggle Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-28 w-6 h-6 bg-slate-900 border border-white/10 rounded-full flex items-center justify-center z-30 hover:bg-indigo-600 hover:border-indigo-400 transition-all text-white group"
        >
          {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>

        <div className={cn("p-8 mb-4", isCollapsed && "p-5")}>
          <div className="flex items-center gap-4">
            <div className="min-w-[48px] w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center font-bold text-2xl shadow-lg shadow-indigo-500/20 text-white flex-shrink-0">
              N
            </div>
            {!isCollapsed && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col min-w-0"
              >
                <span className="text-xl font-bold tracking-tight text-white whitespace-nowrap">NestPOS <span className="text-indigo-400">Cloud</span></span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] leading-none mt-1">Tenant v2.4</span>
              </motion.div>
            )}
          </div>
        </div>

        <nav className={cn("flex-1 px-6 space-y-2", isCollapsed && "px-4")}>
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-all rounded-2xl group relative",
                isActive 
                  ? "bg-white/10 text-white shadow-sm border border-white/10" 
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5",
                isCollapsed && "px-0 justify-center"
              )}
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300")} />
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="truncate"
                    >
                      {item.label}
                    </motion.span>
                  )}
                  {isCollapsed && (
                    <div className="absolute left-16 bg-slate-900 border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                      {item.label}
                    </div>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className={cn("p-6 border-t border-white/10", isCollapsed && "p-4")}>
          <div className={cn(
            "flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5 mb-6 overflow-hidden",
            isCollapsed && "p-2 justify-center"
          )}>
            <div className="min-w-[40px] w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-white/10 flex-shrink-0">
              <UserIcon className="w-5 h-5 text-slate-300" />
            </div>
            {!isCollapsed && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col min-w-0"
              >
                <span className="text-sm font-bold text-white truncate">
                  {profile?.displayName || 'User'}
                </span>
                <div className="flex items-center gap-1.5 ">
                  <Shield className="w-3 h-3 text-indigo-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{profile?.role}</span>
                </div>
              </motion.div>
            )}
          </div>
          <button 
            onClick={logOut}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.2em] text-slate-500 hover:text-red-400 transition-colors group relative",
              isCollapsed && "px-0 justify-center"
            )}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
            {isCollapsed && (
              <div className="absolute left-16 bg-red-950/50 border border-red-500/20 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-red-400 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                Seal Session
              </div>
            )}
          </button>
        </div>
      </motion.aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-white/10 z-[70] lg:hidden flex flex-col"
            >
              <div className="p-8 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center font-bold text-xl text-white">N</div>
                  <span className="text-lg font-bold text-white">NestPOS Cloud</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-white">
                  <ChevronLeft className="w-6 h-6" />
                </button>
              </div>

              <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                {filteredNavItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all rounded-xl",
                      isActive ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-white/5"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="p-6 border-t border-white/10">
                <button 
                  onClick={logOut}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-500 hover:text-red-400 uppercase tracking-widest"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className={cn("flex-1 flex flex-col min-w-0 h-full relative z-10 transition-all", isImpersonating && "pt-12")}>
        <header className="h-20 lg:h-24 flex items-center justify-between px-6 lg:px-10 border-b border-white/5 lg:border-none">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl text-white"
            >
              <LayoutDashboard className="w-5 h-5 text-indigo-400" />
            </button>
            <div className="min-w-0">
              <div className="hidden lg:flex items-center gap-3 text-slate-400 mb-1">
                <Box className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Active Environment</span>
              </div>
              <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight truncate">
                {org?.name || 'Loading...'}
              </h1>
            </div>
          </div>
          
          <div className="flex gap-3 lg:gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl px-3 lg:px-5 py-2 lg:py-3 flex items-center gap-3 shadow-sm hidden sm:flex">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[10px] lg:text-xs font-semibold text-slate-200">Sync: Active</span>
            </div>
            <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl px-3 lg:px-5 py-2 lg:py-3 flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-[8px] lg:text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Region</span>
                <span className="text-xs lg:text-sm font-mono font-bold text-indigo-100">{org?.currency || 'USD'}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto px-6 lg:px-10 pb-10 technical-grid">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
