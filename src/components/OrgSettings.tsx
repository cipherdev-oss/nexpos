import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp, writeBatch, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { Card, Button, Input, MonospaceValue } from './UI';
import { Settings, Globe, Banknote, Save, Loader2, CheckCircle2, ShieldAlert, Trash2, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ACCENT_COLORS } from '../lib/theme';

export function OrgSettings() {
  const { org, profile, refreshProfile, user } = useAuth();
  const [name, setName] = useState(org?.name || '');
  const [currency, setCurrency] = useState(org?.currency || 'USD');
  const [taxRate, setTaxRate] = useState(org?.taxRate || 0);
  const [accentColor, setAccentColor] = useState(org?.accentColor || 'emerald');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDangerModal, setShowDangerModal] = useState<'sales' | 'inventory' | 'reset' | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [wiping, setWiping] = useState(false);

  const performWipe = async () => {
    if (!org?.id || wiping) return;
    
    setWiping(true);
    try {
      const batch = writeBatch(db);
      
      if (showDangerModal === 'sales' || showDangerModal === 'reset') {
        const salesRef = collection(db, 'orgs', org.id, 'sales');
        const snapshot = await getDocs(salesRef);
        snapshot.docs.forEach(d => batch.delete(d.ref));
      }
      
      if (showDangerModal === 'inventory' || showDangerModal === 'reset') {
        // Products
        const productsRef = collection(db, 'orgs', org.id, 'products');
        const snapshotProd = await getDocs(productsRef);
        snapshotProd.docs.forEach(d => batch.delete(d.ref));
        
        // Categories
        const categoriesRef = collection(db, 'orgs', org.id, 'categories');
        const snapshotCat = await getDocs(categoriesRef);
        snapshotCat.docs.forEach(d => batch.delete(d.ref));
      }
      
      if (showDangerModal === 'reset') {
        const orgRef = doc(db, 'orgs', org.id);
        batch.update(orgRef, {
          name: 'System Reset Node',
          currency: 'USD',
          taxRate: 0,
          accentColor: 'sky',
          updatedAt: serverTimestamp()
        });
      }
      
      await batch.commit();

      // Audit Log
      await addDoc(collection(db, 'orgs', org.id, 'audit'), {
        orgId: org.id,
        userId: user?.uid,
        userEmail: user?.email,
        action: showDangerModal === 'reset' ? 'reset' : 'delete',
        targetType: showDangerModal === 'reset' ? 'org' : showDangerModal === 'sales' ? 'sale' : 'product',
        targetId: org.id,
        targetName: org.name,
        details: `CRITICAL: ${showDangerModal === 'reset' ? 'Full System Reset' : showDangerModal === 'sales' ? 'Cleared all sales records' : 'Cleared all inventory data'} executed by ${user?.email}`,
        createdAt: serverTimestamp()
      });

      await refreshProfile();
      setShowDangerModal(null);
      setConfirmText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `orgs/${org.id}/wipe`);
    } finally {
      setWiping(false);
    }
  };

  React.useEffect(() => {
    if (org) {
      setName(org.name || '');
      setCurrency(org.currency || 'USD');
      setTaxRate(org.taxRate || 0);
      setAccentColor(org.accentColor || 'emerald');
    }
  }, [org]);

  const currencies = [
    { code: 'USD', symbol: '$', label: 'US Dollar' },
    { code: 'LKR', symbol: 'Rs.', label: 'Sri Lankan Rupee' },
    { code: 'EUR', symbol: '€', label: 'Euro' },
    { code: 'GBP', symbol: '£', label: 'British Pound' },
    { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  ];

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id) return;

    setLoading(true);
    try {
      const finalTaxRate = isNaN(Number(taxRate)) ? 0 : Number(taxRate);
      
      await updateDoc(doc(db, 'orgs', org.id), {
        name,
        currency,
        taxRate: finalTaxRate,
        accentColor,
        updatedAt: serverTimestamp()
      });

      // Audit Log
      await addDoc(collection(db, 'orgs', org.id, 'audit'), {
        orgId: org.id,
        userId: user?.uid,
        userEmail: user?.email,
        action: 'update',
        targetType: 'org',
        targetId: org.id,
        targetName: name,
        details: `Updated core system configuration: Name=${name}, Currency=${currency}, Tax=${finalTaxRate}%`,
        createdAt: serverTimestamp()
      });

      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `orgs/${org.id}`);
    } finally {
      setLoading(false);
    }
  };

  if (profile?.role !== 'owner' && profile?.role !== 'admin') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <Settings className="w-16 h-16 text-slate-500 mx-auto opacity-20" />
          <h2 className="text-2xl font-bold text-slate-500">Privileged Access Required</h2>
          <p className="text-slate-600">Contact node administrator for configuration changes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">System Configuration</h1>
        <p className="text-sm text-slate-400">Manage global organization parameters and localization</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-4">
          <Card className="bg-accent/5 border-accent-border">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-accent/20 rounded-2xl flex items-center justify-center">
                <Globe className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-white">Localization</h3>
                <p className="text-[10px] text-accent/60 font-bold uppercase tracking-widest mt-1">Regional Protocols</p>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Changes to currency will propagate across the inventory and POS grid immediately.
              </p>
            </div>
          </Card>

          <Card className="bg-red-500/5 border-red-500/20">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-white">Danger Zone</h3>
                <p className="text-[10px] text-red-500/60 font-bold uppercase tracking-widest mt-1">Low-Level Operations</p>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Destructive actions are irreversible. Multi-factor text confirmation required for all wipes.
              </p>
              
              <div className="space-y-2 pt-2">
                <Button 
                  variant="danger" 
                  size="sm" 
                  className="w-full justify-start gap-2 h-10"
                  onClick={() => setShowDangerModal('sales')}
                >
                  <Trash2 className="w-4 h-4" />
                  Wipe Sales Ledger
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start gap-2 h-10 border-red-500/20 text-red-400 hover:bg-red-500/10"
                  onClick={() => setShowDangerModal('inventory')}
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Inventory
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start gap-2 h-10 border-red-500/40 bg-red-500/10 text-red-500 hover:bg-red-500/20"
                  onClick={() => setShowDangerModal('reset')}
                >
                  <AlertTriangle className="w-4 h-4" />
                  Factory Reset Node
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card title="Core Identity">
            <form onSubmit={handleUpdate} className="space-y-8 py-4">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Organization Name</label>
                  <Input 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="NestPOS Cloud Node Name"
                    className="h-12"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Tax Configuration (%)</label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    placeholder="e.g. 8.00"
                    className="h-12"
                    required
                  />
                  <p className="text-[10px] text-slate-500 font-medium ml-1">Standard transactional tax applied to all checkouts.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">System Accent</label>
                  <div className="flex flex-wrap gap-3">
                    {['emerald', 'indigo', 'amber', 'rose', 'sky', 'violet'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setAccentColor(color)}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${
                          accentColor === color 
                            ? 'border-white scale-110 shadow-lg' 
                            : 'border-transparent opacity-50 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: ACCENT_COLORS[color]?.base }}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium ml-1">Global design language for all terminal interfaces.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Universal Currency</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currencies.map((curr) => (
                      <button
                        key={curr.code}
                        type="button"
                        onClick={() => setCurrency(curr.code)}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                          currency === curr.code 
                            ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' 
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-sm">{curr.label}</span>
                          <span className="text-[10px] opacity-60 uppercase">{curr.code}</span>
                        </div>
                        <span className="text-lg font-black">{curr.symbol}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                {saved ? (
                  <div className="flex items-center gap-2 text-accent">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Configuration Synchronized</span>
                  </div>
                ) : (
                  <div />
                )}
                
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="px-8 h-12 gap-2 min-w-[160px]"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Commit Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {showDangerModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 lg:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDangerModal(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="relative w-full max-w-lg glass-card border border-red-500/30 overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-start justify-between">
                  <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                  </div>
                  <button 
                    onClick={() => setShowDangerModal(null)}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    Confirm {showDangerModal === 'sales' ? 'Ledger Wipe' : showDangerModal === 'inventory' ? 'Inventory Clearance' : 'System Reset'}
                  </h2>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    You are about to permanently delete all {showDangerModal === 'sales' ? 'transactional records' : showDangerModal === 'inventory' ? 'products and categories' : 'data and reset configurations'}. This action cannot be reversed.
                  </p>
                </div>

                <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-xl flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Authorization Required</p>
                    <p className="text-xs text-red-300 font-medium italic">Type "{showDangerModal === 'reset' ? 'PERMANENT RESET' : 'FORCE DELETE'}" below to authorize.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <Input 
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Provide authorization string..."
                    className="h-14 border-red-500/20 focus:border-red-500 text-center text-lg font-bold uppercase tracking-widest"
                  />
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <Button 
                      variant="outline" 
                      className="h-14"
                      onClick={() => setShowDangerModal(null)}
                    >
                      Abort Mission
                    </Button>
                    <Button 
                      variant="danger" 
                      className="h-14 font-black uppercase tracking-widest"
                      disabled={confirmText !== (showDangerModal === 'reset' ? 'PERMANENT RESET' : 'FORCE DELETE') || wiping}
                      onClick={performWipe}
                    >
                      {wiping ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Execute Action'}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
