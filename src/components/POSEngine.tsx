import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType, Product, SaleItem, Category } from '../lib/firebase';
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
import { Button, Card, Input, MonospaceValue, cn, formatCurrency } from './UI';
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
  Package2,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function POSEngine() {
  const { org, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [successSale, setSuccessSale] = useState<{ id: string, total: number, change: number, tendered: number } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [showTenderModal, setShowTenderModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'cart'>('products');
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!org?.id) return;
    const q = query(collection(db, 'orgs', org.id, 'products'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ ...doc.data() as Product, id: doc.id })));
    });

    const catQ = query(collection(db, 'orgs', org.id, 'categories'), orderBy('name', 'asc'));
    const unsubscribeCats = onSnapshot(catQ, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ ...doc.data() as Category, id: doc.id })));
    });

    return () => {
      unsubscribe();
      unsubscribeCats();
    };
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
    
    // For cash, check if tendered is enough
    const tendered = parseFloat(cashTendered);
    if (paymentMethod === 'cash') {
      if (isNaN(tendered) || tendered < total) {
        alert('Insufficient cash tendered');
        return;
      }
    }

    setProcessing(true);
    try {
      const saleId = 'TRN-' + Math.random().toString(36).substring(2, 9).toUpperCase();
      const change = paymentMethod === 'cash' ? tendered - total : 0;

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
          id: saleId,
          orgId: org.id,
          userId: profile.id,
          items: cart,
          subtotal,
          tax,
          total,
          paymentMethod,
          cashTendered: paymentMethod === 'cash' ? tendered : total,
          changeDue: change,
          createdAt: serverTimestamp()
        });
      });

      setSuccessSale({ id: saleId, total, change, tendered: paymentMethod === 'cash' ? tendered : total });
      setCart([]);
      setCashTendered('');
      setShowTenderModal(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Transaction Failure');
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    if (successSale) {
      window.print();
    }
  }, [successSale]);

  const handlePrintReceipt = () => {
    window.print();
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode === search ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="h-full lg:h-[calc(100vh-10rem)] flex flex-col lg:flex-row gap-6 lg:gap-8">
      {/* Mobile Switcher */}
      <div className="lg:hidden flex p-1 bg-white/5 border border-white/10 rounded-2xl">
        <button 
          onClick={() => setActiveTab('products')}
          className={cn(
            "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all",
            activeTab === 'products' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
          )}
        >
          Browse Assets
        </button>
        <button 
          onClick={() => setActiveTab('cart')}
          className={cn(
            "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all relative",
            activeTab === 'cart' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
          )}
        >
          Review Cart
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full animate-pulse">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      {/* Product Selection */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 glass-panel rounded-3xl overflow-hidden h-full",
        activeTab !== 'products' && "hidden lg:flex"
      )}>
        <div className="p-4 lg:p-6 border-b border-white/10 flex flex-col gap-4 lg:gap-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 lg:w-5 h-4 lg:h-5 text-slate-500" />
              <input 
                ref={searchInputRef}
                className="w-full bg-slate-900 border border-white/10 rounded-2xl pl-10 lg:pl-12 pr-4 py-3 lg:py-4 text-xs lg:text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-600"
                placeholder="Asset search/scan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredProducts.length === 1) {
                    addToCart(filteredProducts[0]);
                  }
                }}
              />
            </div>
            <div className="hidden sm:flex items-center gap-3 px-6 border-l border-white/10">
              <ScanLine className="w-5 h-5 text-indigo-400" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden lg:inline">WebHID Engaged</span>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar -mx-2 px-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                "px-4 lg:px-6 py-2 rounded-xl text-[9px] lg:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap border flex-shrink-0",
                selectedCategory === 'all' 
                  ? "bg-indigo-600 border-indigo-400 text-white shadow-lg" 
                  : "bg-white/5 border-white/10 text-slate-500"
              )}
            >
              All Assets
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={cn(
                  "px-4 lg:px-6 py-2 rounded-xl text-[9px] lg:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap border flex-shrink-0",
                  selectedCategory === cat.name 
                    ? "bg-indigo-600 border-indigo-400 text-white shadow-lg" 
                    : "bg-white/5 border-white/10 text-slate-500"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 lg:p-6 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4 auto-rows-max">
          {filteredProducts.map((p) => (
            <motion.button
              key={p.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => addToCart(p)}
              disabled={p.stock <= 0}
              className={cn(
                "relative flex flex-col text-left p-4 lg:p-5 glass-card rounded-2xl transition-all group",
                p.stock <= 0 ? "opacity-30 grayscale cursor-not-allowed" : "hover:bg-white/10 hover:border-indigo-500/30"
              )}
            >
              <div className="flex-1 mb-4 lg:mb-6">
                <span className="text-[8px] lg:text-[10px] font-bold text-slate-500 uppercase block mb-1 tracking-widest truncate">
                  {p.category || 'General'}
                </span>
                <h4 className="text-xs lg:text-sm font-bold text-slate-100 line-clamp-2 leading-tight group-hover:text-white transition-colors">
                  {p.name}
                </h4>
              </div>
              
              <div className="mt-auto flex items-end justify-between">
                <div className="flex flex-col">
                   <span className="text-[8px] lg:text-[9px] font-bold text-slate-500 uppercase tracking-widest">Stock</span>
                   <span className={cn(
                     "text-[10px] lg:text-xs font-bold",
                     p.stock <= p.minStock ? "text-amber-500" : "text-slate-400"
                   )}>{p.stock}</span>
                </div>
                <div className="text-right">
                  <span className="text-base lg:text-lg font-bold text-indigo-400">
                    {formatCurrency(p.price, org?.currency)}
                  </span>
                </div>
              </div>

              {p.stock <= 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 backdrop-blur-[1px] rounded-2xl">
                  <span className="text-[8px] lg:text-[10px] font-bold text-white bg-red-500 px-3 py-1 rounded-full uppercase tracking-widest">Out</span>
                </div>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Cart Side */}
      <div className={cn(
        "w-full lg:w-[400px] flex flex-col glass-panel rounded-3xl overflow-hidden shadow-2xl h-full",
        activeTab !== 'cart' && "hidden lg:flex"
      )}>
        <header className="p-4 lg:p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-5 h-5 text-indigo-400" />
            <span className="text-xs lg:text-sm font-bold text-white uppercase tracking-widest">Cart Manifest</span>
          </div>
          <span className="bg-indigo-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
            {cart.length}
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
                      {formatCurrency(item.total, org?.currency)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer / Totals */}
        <div className="p-6 lg:p-8 bg-black/20 border-t border-white/10 space-y-4 lg:space-y-6">
          <div className="space-y-2 opacity-60">
            <div className="flex justify-between text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-widest">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal, org?.currency)}</span>
            </div>
            <div className="flex justify-between text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-widest">
              <span>Tax (8%)</span>
              <span>{formatCurrency(tax, org?.currency)}</span>
            </div>
          </div>
          
          <div className="flex justify-between items-end pt-2 lg:pt-4 border-t border-white/5">
            <span className="text-[10px] lg:text-xs font-black text-indigo-400 uppercase tracking-[0.3em]">Total</span>
            <span className="text-2xl lg:text-4xl font-black text-white tracking-tighter">
              {formatCurrency(total, org?.currency)}
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
            onClick={() => {
              if (paymentMethod === 'cash') setShowTenderModal(true);
              else handleCheckout();
            }} 
            disabled={cart.length === 0 || processing}
            className="w-full h-16 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xl shadow-2xl shadow-indigo-600/40 uppercase tracking-widest mt-4"
          >
            {processing ? 'Transmitting...' : 'Execute Transaction'}
          </Button>
        </div>
      </div>

      {/* Tender Modal */}
      <AnimatePresence>
        {showTenderModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 border border-white/10 p-8 rounded-[32px] flex flex-col w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-widest">Cash Tendering</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Total Amount</label>
                  <div className="text-3xl font-black text-white">{formatCurrency(total, org?.currency)}</div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Cash Received</label>
                  <Input 
                    type="number"
                    autoFocus
                    placeholder="Enter amount..."
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="text-2xl h-16 font-bold"
                  />
                </div>

                {parseFloat(cashTendered) >= total && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Change to Return</label>
                    <div className="text-3xl font-black text-green-400">
                      {formatCurrency(parseFloat(cashTendered) - total, org?.currency)}
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mt-8">
                <Button variant="outline" onClick={() => setShowTenderModal(false)}>Cancel</Button>
                <Button 
                  disabled={!cashTendered || parseFloat(cashTendered) < total || processing}
                  onClick={handleCheckout}
                >
                  {processing ? 'Processing...' : 'Complete Sale'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              className="bg-slate-900 border border-white/10 p-10 rounded-[32px] flex flex-col items-center text-center max-w-sm w-full glow-indigo print:hidden"
            >
              <div className="w-20 h-20 bg-indigo-500 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/40">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight mb-1">Sale Complete</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Ref: {successSale.id}</p>
              
              <div className="w-full bg-white/5 rounded-2xl p-6 mb-8 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Paid</span>
                  <span className="font-bold text-white">{formatCurrency(successSale.total, org?.currency)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Change Given</span>
                  <span className="font-bold text-green-400">{formatCurrency(successSale.change, org?.currency)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 w-full">
                <Button onClick={handlePrintReceipt} className="w-full h-14 bg-indigo-600">
                  Print Receipt
                </Button>
                <Button variant="outline" onClick={() => setSuccessSale(null)} className="w-full h-12">
                  Done
                </Button>
              </div>
            </motion.div>

            {/* Hidden Printable Receipt */}
            <div className="hidden print:block fixed inset-0 bg-white text-black p-8 font-mono text-xs">
              <div className="text-center mb-4">
                <h1 className="text-lg font-bold uppercase">{org?.name}</h1>
                <p>RECEIPT: {successSale.id}</p>
                <p>{new Date().toLocaleString()}</p>
              </div>
              <div className="border-t border-b border-black py-2 my-2">
                <div className="flex justify-between font-bold mb-1">
                  <span className="flex-1">Item</span>
                  <span className="w-12 text-center">Qty</span>
                  <span className="w-20 text-right">Price</span>
                </div>
                {/* We since we don't have the cart anymore, we'd need to store the sale items in successSale state if we want them here, or fetch from DB */}
                <p className="italic text-center py-4">Transaction Successful</p>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Total</span>
                  <span className="font-bold">{formatCurrency(successSale.total, org?.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cash Tendered</span>
                  <span>{formatCurrency(successSale.tendered, org?.currency)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-1 border-t border-black">
                  <span>Change Due</span>
                  <span>{formatCurrency(successSale.change, org?.currency)}</span>
                </div>
              </div>
              <div className="text-center mt-8">
                <p>Thank you for your business!</p>
                <div className="mt-4 border border-black p-2 inline-block">
                  {successSale.id}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
