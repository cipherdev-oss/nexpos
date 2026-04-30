import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Card, Button, Input, MonospaceValue } from './UI';
import { Users, UserPlus, Shield, Trash2, Mail, CheckCircle2, XCircle, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firebase';

interface orgUser {
  id: string;
  email: string;
  role: 'admin' | 'cashier' | 'owner';
  displayName?: string;
  createdAt: any;
}

export function UserManagement() {
  const { org, profile, impersonateUser } = useAuth();
  const [users, setUsers] = useState<orgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  
  // New user form
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'cashier'>('cashier');

  useEffect(() => {
    if (!org?.id) return;

    const q = query(collection(db, 'users'), where('orgId', '==', org.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as orgUser));
      setUsers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return unsubscribe;
  }, [org?.id]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id || !newEmail) return;

    try {
      // Use a cleaner ID generation or let Firestore decide, but for pre-provisioning 
      // we'll use a safe base64-like string or just the email hash
      // To strictly follow isValidId regex '^[a-zA-Z0-9_\\-]+$'
      // we'll replace any unsafe chars if we use btoa
      const userId = btoa(newEmail.toLowerCase())
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      await setDoc(doc(db, 'users', userId), {
        email: newEmail.toLowerCase(),
        orgId: org.id,
        role: newRole,
        createdAt: serverTimestamp(),
        displayName: newEmail.split('@')[0]
      });

      setNewEmail('');
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    }
  };

  const removeUser = async (userId: string) => {
    if (userId === auth.currentUser?.uid) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'users');
    }
  };

  if (profile?.role !== 'owner' && profile?.role !== 'admin') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <XCircle className="w-16 h-16 text-red-500 mx-auto opacity-50" />
          <h2 className="text-2xl font-bold text-white">Access Restricted</h2>
          <p className="text-slate-500">Only authorized node administrators can manage permissions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Identity Management</h1>
          <p className="text-sm text-slate-400">Control access nodes and permission tiers</p>
        </div>
        <Button onClick={() => setIsAdding(true)} className="gap-2">
          <UserPlus className="w-5 h-5" />
          Provision New User
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card title="Workspace Quota" className="bg-indigo-600/5 border-indigo-500/20">
          <div className="flex items-center justify-between">
            <MonospaceValue label="Active Seats" value={`${users.length} / 10`} />
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
        </Card>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-6"
          >
            <Card className="w-full max-w-md shadow-2xl" title="Provision Identity">
              <form onSubmit={handleAddUser} className="space-y-6 py-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
                  <Input 
                    type="email"
                    required
                    placeholder="operator@nexus.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Permission Tier</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setNewRole('cashier')}
                      className={`p-4 rounded-xl border text-left transition-all ${newRole === 'cashier' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/20' : 'bg-white/5 border-white/10 text-slate-400'}`}
                    >
                      <span className="block font-bold text-sm">Cashier</span>
                      <span className="text-[10px] opacity-70">Sales operations only</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewRole('admin')}
                      className={`p-4 rounded-xl border text-left transition-all ${newRole === 'admin' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/20' : 'bg-white/5 border-white/10 text-slate-400'}`}
                    >
                      <span className="block font-bold text-sm">Admin</span>
                      <span className="text-[10px] opacity-70">Full system access</span>
                    </button>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setIsAdding(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1">Authorize</Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((u) => (
          <motion.div 
            layout
            key={u.id}
            className="group glass-card p-6 rounded-2xl border border-white/10 hover:bg-white/10 transition-all"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex gap-3">
                <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center border border-white/10">
                  {u.role === 'owner' ? <Shield className="w-6 h-6 text-indigo-400" /> : <Users className="w-6 h-6 text-slate-400" />}
                </div>
                {u.id !== auth.currentUser?.uid && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => impersonateUser(u as any)} 
                    className="h-12 px-4 gap-2 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-600 hover:text-white"
                  >
                    <LogIn className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Login As</span>
                  </Button>
                )}
              </div>
              {u.role !== 'owner' && u.id !== auth.currentUser?.uid && (
                <Button variant="ghost" size="sm" onClick={() => removeUser(u.id)} className="p-2 h-9 w-9 text-slate-500 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            <h3 className="text-lg font-bold text-white mb-1 truncate">{u.displayName || u.email}</h3>
            <div className="flex items-center gap-2 mb-6">
              <Mail className="w-3 h-3 text-slate-500" />
              <span className="text-xs text-slate-500 truncate">{u.email}</span>
            </div>

            <div className="flex justify-between items-center pt-6 border-t border-white/5">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${u.role === 'owner' ? 'bg-indigo-400' : u.role === 'admin' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{u.role}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-lg border border-white/5">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span className="text-[9px] font-bold text-slate-500 uppercase">Synchronized</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
