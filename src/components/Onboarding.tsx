import React, { useState } from 'react';
import { Button, Card, Input } from './UI';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { Store, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name) return;

    setLoading(true);
    try {
      const orgId = `org_${Math.random().toString(36).substring(2, 10)}`;
      const now = serverTimestamp();

      // Create Org
      await setDoc(doc(db, 'orgs', orgId), {
        name,
        ownerId: user.uid,
        createdAt: now,
        currency: 'USD',
        plan: 'free'
      });

      // Create User Profile
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        displayName: user.displayName,
        orgId: orgId,
        role: 'owner',
        createdAt: now
      });

      await refreshProfile();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'orgs/onboarding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-transparent relative overflow-hidden">
      <div className="absolute inset-0 technical-grid opacity-50" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg relative z-10"
      >
        <Card title="Workspace Initialization">
          <form onSubmit={handleCreateOrg} className="space-y-10 py-8 px-4">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center shadow-lg">
                <Store className="w-8 h-8 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Establish Node</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Primary Organization Registration</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Entity / Business Name</label>
                <Input 
                  placeholder="e.g. Neo Tokyo Retail"
                  className="h-14 text-lg"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="bg-white/5 rounded-2xl p-6 border border-white/5 space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                 Administrative Protocol
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                By initializing this node, you'll gain full [OWNER] privileges across the retail grid. This workspace will serve as your primary data synchronization hub.
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full h-16 text-lg font-black uppercase tracking-widest gap-3" 
              disabled={loading || !name}
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  Initialize System
                  <ArrowRight className="w-6 h-6" />
                </>
              )}
            </Button>

            <div className="pt-4 text-center">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Been invited by an admin?</p>
              <button 
                type="button"
                onClick={() => {
                  setLoading(true);
                  refreshProfile().finally(() => setLoading(false));
                }}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-[0.2em]"
              >
                Sync Invited Profile
              </button>
            </div>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
