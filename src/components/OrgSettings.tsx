import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Card, Button, Input, MonospaceValue } from './UI';
import { Settings, Globe, Banknote, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

export function OrgSettings() {
  const { org, profile, refreshProfile } = useAuth();
  const [name, setName] = useState(org?.name || '');
  const [currency, setCurrency] = useState(org?.currency || 'USD');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

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
      await updateDoc(doc(db, 'orgs', org.id), {
        name,
        currency,
        updatedAt: serverTimestamp()
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
          <Card className="bg-indigo-600/5 border-indigo-500/20">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
                <Globe className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">Localization</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Regional Protocols</p>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Changes to currency will propagate across the inventory and POS grid immediately.
              </p>
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
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Universal Currency</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currencies.map((curr) => (
                      <button
                        key={curr.code}
                        type="button"
                        onClick={() => setCurrency(curr.code)}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                          currency === curr.code 
                            ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/20' 
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
                  <div className="flex items-center gap-2 text-emerald-400">
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
    </div>
  );
}
