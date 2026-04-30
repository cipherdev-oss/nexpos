import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType, Product, SaleItem } from '../lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  serverTimestamp, 
  runTransaction,
  limit,
  orderBy 
} from 'firebase/firestore';
import { Button, Card, Input, MonospaceValue, cn } from './UI';
import { 
  Search, 
  ShoppingCart, 
  User, 
  CreditCard, 
  Banknote, 
  Trash2, 
  Plus, 
  Minus, 
  CheckCircle2,
  ScanLine,
  ChevronRight,
  Package2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function POSEngine() {
  const { org, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [successSale, setSuccessSale] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!org?.id) return;
    const q = query(collection(db, 'orgs', org.id, 'products'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ ...doc.data() as Product, id: doc.id })));
    });
    return unsubscribe;
  }, [org?.id]);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
            : item
        );
      }
      return [...prev, {
        productId: product.id!,
        name: product.name,
        price: product.price,
        quantity: 1,
        total: product.price
      }];
    });
    setSearch('');
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.productId === productId);
      const product = products.find(p => p.id === productId);
      if (!item || !product) return prev;
      
      const newQty = item.quantity + delta;
      if (newQty <= 0) return prev.filter(i => i.productId !== productId);
      if (newQty > product.stock) return prev;

      return prev.map(i => 
        i.productId === productId 
          ? { ...i, quantity: newQty, total: newQty * i.price }
          : i
      );
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.total, 0);
  const tax = subtotal * 0.08; // Example 8% tax
  const total = subtotal + tax;

  const handleCheckout = async () => {
    if (!org?.id || !profile?.id || cart.length === 0) return;
    
    setProcessing(true);
    try {
      await runTransaction(db, async (transaction) => {
        // 1. Verify stock for all items
        const productRefs = cart.map(item => doc(db, 'orgs', org.id, 'products', item.productId));
        const productSnapshots = await Promise.all(productRefs.map(ref => transaction.get(ref)));
        
        productSnapshots.forEach((snap, idx) => {
          if (!snap.exists()) throw new Error(`Product ${cart[idx].name} not found`);
          const currentStock = snap.data().stock;
          if (currentStock < cart[idx].quantity) {
            throw new Error(`Insufficient stock for ${cart[idx].name}`);
          }
        });

        // 2. Decrement stock
        productSnapshots.forEach((snap, idx) => {
          const currentStock = snap.data().stock;
          transaction.update(productRefs[idx], { 
            stock: currentStock - cart[idx].quantity,
            updatedAt: serverTimestamp()
          });
        });

        // 3. Create Sale record
        const saleRef = doc(collection(db, 'orgs', org.id, 'sales'));
        transaction.set(saleRef, {
          orgId: org.id,
          userId: profile.id,
          items: cart,
          subtotal,
          tax,
          total,
          paymentMethod,
          createdAt: serverTimestamp()
        });
      });

      setSuccessSale('TRN-' + Math.random().toString(36).substring(2, 9).toUpperCase());
      setCart([]);
      setTimeout(() => setSuccessSale(null), 5000);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Transaction Failure');
    } finally {
      setProcessing(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode === search ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-10rem)] flex gap-8">
      {/* Product Selection */}
      <div className="flex-1 flex flex-col min-w-0 glass-panel rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-white/10 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input 
              ref={searchInputRef}
              className="w-full bg-slate-900 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-600"
              placeholder="Search or scan asset for transmission..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredProducts.length === 1) {
                  addToCart(filteredProducts[0]);
                }
              }}
            />
          </div>
          <div className="flex items-center gap-3 px-6 border-l border-white/10">
            <ScanLine className="w-5 h-5 text-indigo-400" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden lg:inline">WebHID Engaged</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max">
          {filteredProducts.map((p) => (
            <motion.button
              key={p.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => addToCart(p)}
              disabled={p.stock <= 0}
              className={cn(
                "relative flex flex-col text-left p-5 glass-card rounded-2xl transition-all group",
                p.stock <= 0 ? "opacity-30 grayscale cursor-not-allowed" : "hover:bg-white/10 hover:border-indigo-500/30"
              )}
            >
              <div className="flex-1 mb-6">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1 tracking-widest truncate">
                  {p.category || 'General'}
                </span>
                <h4 className="text-sm font-bold text-slate-100 line-clamp-2 leading-tight group-hover:text-white transition-colors">
                  {p.name}
                </h4>
              </div>
              
              <div className="mt-auto flex items-end justify-between">
                <div className="flex flex-col">
                   <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Available</span>
                   <span className={cn(
                     "text-xs font-bold",
                     p.stock <= p.minStock ? "text-amber-500" : "text-slate-400"
                   )}>{p.stock} <span className="text-[8px] font-medium lowercase opacity-60">{p.unit}</span></span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-indigo-400">
                    ${p.price.toFixed(2)}
                  </span>
                </div>
              </div>

              {p.stock <= 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 backdrop-blur-[1px] rounded-2xl">
                  <span className="text-[10px] font-bold text-white bg-red-500 px-3 py-1 rounded-full uppercase tracking-widest">Stock Out</span>
                </div>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Cart Side */}
      <div className="w-[400px] flex flex-col glass-panel rounded-3xl overflow-hidden shadow-2xl">
        <header className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-5 h-5 text-indigo-400" />
            <span className="text-sm font-bold text-white uppercase tracking-widest">Active Manifest</span>
          </div>
          <span className="bg-indigo-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-indigo-500/20">
            {cart.length} Files
          </span>
        </header>

        <div className="flex-1 overflow-auto bg-slate-900/20">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-12 opacity-20">
              <Package2 className="w-16 h-16 text-slate-500 mb-6" />
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-center text-slate-400">Awaiting Signal</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {cart.map((item) => (
                <motion.div 
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  key={item.productId} 
                  className="p-6 group hover:bg-white/5 transition-all"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-sm font-bold text-slate-100 leading-snug">
                      {item.name}
                    </span>
                    <button onClick={() => removeFromCart(item.productId)} className="text-slate-600 hover:text-red-400 transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 bg-slate-950 border border-white/10 p-1 rounded-xl">
                      <button 
                        onClick={() => updateQuantity(item.productId, -1)}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-slate-100">{item.quantity}</span>
                      <button 
                         onClick={() => updateQuantity(item.productId, 1)}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="text-lg font-bold text-slate-100">
                      ${item.total.toFixed(2)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer / Totals */}
        <div className="p-8 bg-black/20 border-t border-white/10 space-y-6">
          <div className="space-y-2 opacity-60">
            <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
              <span>Sub-Environment Total</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
              <span>Tenant Tax (8%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="flex justify-between items-end pt-4 border-t border-white/5">
            <span className="text-xs font-black text-indigo-400 uppercase tracking-[0.3em]">Total Gross</span>
            <span className="text-4xl font-black text-white tracking-tighter">
              ${total.toFixed(2)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <button 
              onClick={() => setPaymentMethod('cash')}
              className={cn(
                "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all",
                paymentMethod === 'cash' ? "bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/20" : "bg-white/5 border-white/10 text-slate-500"
              )}
            >
              <Banknote className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Cash</span>
            </button>
            <button 
              onClick={() => setPaymentMethod('card')}
              className={cn(
                "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all",
                paymentMethod === 'card' ? "bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/20" : "bg-white/5 border-white/10 text-slate-500"
              )}
            >
              <CreditCard className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Terminal</span>
            </button>
          </div>

          <Button 
            onClick={handleCheckout} 
            disabled={cart.length === 0 || processing}
            className="w-full h-16 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xl shadow-2xl shadow-indigo-600/40 uppercase tracking-widest mt-4"
          >
            {processing ? 'Transmitting...' : 'Execute Transaction'}
          </Button>
        </div>
      </div>

      {/* Success Modal Overlay */}
      <AnimatePresence>
        {successSale && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 border border-white/10 p-14 rounded-[32px] flex flex-col items-center text-center max-w-sm w-full glow-indigo"
            >
              <div className="w-24 h-24 bg-indigo-500 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-indigo-500/40">
                <CheckCircle2 className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-white tracking-tight mb-2">Sync Successful</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-10">Ref: {successSale}</p>
              
              <Button onClick={() => setSuccessSale(null)} className="w-full h-14">
                Close Terminal
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
