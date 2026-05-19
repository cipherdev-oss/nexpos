import React, { useState } from 'react';
import { Button, Card, Input } from './UI';
import { signInWithGoogle, signInWithGithub, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../lib/firebase';
import { LogIn, Terminal, Mail, Lock, Github, UserPlus, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [method, setMethod] = useState<'social' | 'email'>('social');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    try {
      setLoading(true);
      setError(null);
      if (provider === 'google') await signInWithGoogle();
      else await signInWithGithub();
    } catch (err: any) {
      console.error('Social login failed', err);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('../lib/firebase');
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error('Email auth failed', err);
      let message = 'Authentication failed';
      if (err.code === 'auth/user-not-found') message = 'No account found with this email';
      else if (err.code === 'auth/wrong-password') message = 'Incorrect security credential';
      else if (err.code === 'auth/email-already-in-use') message = 'This email is already registered';
      else if (err.code === 'auth/weak-password') message = 'Credential strength insufficient';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please provide an email to reset your credential');
      return;
    }
    setLoading(true);
    const { auth, sendPasswordResetEmail } = await import('../lib/firebase');
    try {
      await sendPasswordResetEmail(auth, email);
      alert('Reset protocol initiated. Check your uplink (email).');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 technical-grid opacity-30" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-lg relative z-10"
      >
        <div className="flex flex-col items-center mb-8 text-center">
          <motion.div 
            initial={{ rotate: -10, y: -20 }}
            animate={{ rotate: 0, y: 0 }}
            className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-indigo-600/30"
          >
            <Terminal className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">NestPOS Cloud</h1>
          <p className="text-slate-500 font-bold text-[8px] uppercase tracking-[0.4em]">Unified Retail Infrastructure</p>
        </div>

        <Card className="shadow-2xl border-white/5 bg-slate-900/50 backdrop-blur-xl">
          <div className="space-y-6 py-2">
            <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 mb-6">
              <button 
                onClick={() => setMethod('social')}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${method === 'social' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Social Connect
              </button>
              <button 
                onClick={() => setMethod('email')}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${method === 'email' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Email Matrix
              </button>
            </div>

            <AnimatePresence mode="wait">
              {method === 'social' ? (
                <motion.div 
                  key="social"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <Button 
                    onClick={() => handleSocialLogin('google')}
                    disabled={loading}
                    className="w-full h-12 gap-3 bg-white hover:bg-slate-100 text-slate-900 font-bold border-none"
                  >
                    <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                    Connect via Google Account
                  </Button>
                  <Button 
                    onClick={() => handleSocialLogin('github')}
                    disabled={loading}
                    className="w-full h-12 gap-3 bg-slate-800 hover:bg-slate-700 text-white font-bold border-none"
                  >
                    <Github className="w-5 h-5" />
                    Establish GitHub Uplink
                  </Button>
                </motion.div>
              ) : (
                <motion.form 
                  key="email"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleEmailSubmit}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Identification Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                      <Input 
                        type="email"
                        placeholder="operator@nexus.io"
                        className="pl-10 h-11"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Security Credential</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                      <Input 
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 h-11"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[10px] font-bold text-red-400 uppercase tracking-widest animate-shake">
                      Protocol Breach: {error}
                    </div>
                  )}

                  <Button 
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 gap-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold border-none mt-2"
                  >
                    {loading ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                        <Terminal className="w-5 h-5 opacity-50" />
                      </motion.div>
                    ) : (
                      <>
                        {mode === 'login' ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                        {mode === 'login' ? 'Execute Login' : 'Provision Identity'}
                      </>
                    )}
                  </Button>

                  <div className="flex justify-between items-center px-1">
                    <button 
                      type="button"
                      onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                      className="text-[10px] font-bold text-slate-500 hover:text-indigo-400 uppercase tracking-widest transition-colors py-2 text-left"
                    >
                      {mode === 'login' ? 'Request New Identity Provisioning' : 'Access Existing Infrastructure'}
                    </button>
                    {mode === 'login' && (
                      <button 
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-[10px] font-bold text-slate-500 hover:text-indigo-400 uppercase tracking-widest transition-colors py-2 text-right"
                      >
                        Reset Protocol
                      </button>
                    )}
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-4 py-2">
              <div className="h-px flex-1 bg-white/5" />
              <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
              <div className="h-px flex-1 bg-white/5" />
            </div>

            <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 uppercase tracking-widest">
              <span className="flex items-center gap-2">
                <Fingerprint className="w-3 h-3 text-emerald-500/50" />
                Auth Protocol v2.4
              </span>
              <span className="opacity-50">Stable Release</span>
            </div>
          </div>
        </Card>

        <div className="mt-8 text-center flex flex-col items-center gap-4">
          <p className="text-slate-600 font-bold text-[9px] uppercase tracking-[0.3em] max-w-xs leading-relaxed">
            Authorized Personnel Only. Unauthorized access attempts will be logged and reported to infrastructure security.
          </p>
          <div className="flex gap-4">
             <div className="w-8 h-1 bg-slate-900 rounded-full" />
             <div className="w-12 h-1 bg-indigo-900/30 rounded-full" />
             <div className="w-8 h-1 bg-slate-900 rounded-full" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
