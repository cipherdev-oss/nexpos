import React from 'react';
import { Button, Card } from './UI';
import { signInWithGoogle } from '../lib/firebase';
import { LogIn, Terminal } from 'lucide-react';
import { motion } from 'motion/react';

export function LoginScreen() {
  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-transparent relative overflow-hidden">
      <div className="absolute inset-0 technical-grid opacity-50" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <div className="flex flex-col items-center mb-12">
          <motion.div 
            initial={{ rotate: -10 }}
            animate={{ rotate: 0 }}
            className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-indigo-600/40"
          >
            <Terminal className="w-12 h-12 text-white" />
          </motion.div>
          <h1 className="text-5xl font-bold tracking-tight text-white mb-2">NexPOS</h1>
          <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.4em]">Next-Gen Retail Ecosystem</p>
        </div>

        <Card title="Security Gateway" className="shadow-2xl">
          <div className="space-y-8 py-4">
            <div className="text-center">
              <p className="text-slate-400 text-sm font-medium mb-1">
                Welcome to your command center.
              </p>
              <p className="text-slate-500 text-xs tracking-tight">
                Authorize your identity to access the retail grid.
              </p>
            </div>
            
            <Button 
              onClick={handleLogin}
              className="w-full h-14 gap-3 bg-indigo-600 hover:bg-indigo-500 text-lg font-bold"
            >
              <LogIn className="w-5 h-5" />
              Sign in with Google
            </Button>

            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-white/5" />
              <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest leading-none">OAuth 2.0 Secure</span>
              <div className="h-px flex-1 bg-white/5" />
            </div>

            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
              <span>v2.8.4 Stable</span>
              <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-emerald-500" /> End-to-End Encrypted</span>
            </div>
          </div>
        </Card>

        <div className="mt-12 text-center">
          <p className="text-slate-600 font-bold text-[10px] uppercase tracking-[0.2em]">
            Precision Engineering for Modern Commerce
          </p>
        </div>
      </motion.div>
    </div>
  );
}
