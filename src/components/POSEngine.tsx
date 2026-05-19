import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType, Product, SaleItem, Category, ProductVariant } from '../lib/firebase';
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
  const { org, profile, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [successSale, setSuccessSale] = useState<{ id: string, total: number, change: number, tendered: number, items: SaleItem[] } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [showTenderModal, setShowTenderModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'cart'>('products');
  
  // Modal for variant extraction
  const [selectedModalProduct, setSelectedModalProduct] = useState<Product | null>(null);

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

  const addToCart = (product: Product, variant?: ProductVariant) => {
    if (product.hasVariants && !variant) {
      setSelectedModalProduct(product);
      return;
    }

    if (variant) {
      if (variant.stock <= 0) {
        alert('This variation is out of stock');
        return;
      }
      setCart(prev => {
        const existing = prev.find(item => item.productId === product.id && item.variantId === variant.id);
        if (existing) {
          if (existing.quantity >= variant.stock) return prev;
          return prev.map(item => 
            (item.productId === product.id && item.variantId === variant.id)
              ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
              : item
          );
        }
        return [...prev, {
          productId: product.id!,
          variantId: variant.id,
          variantName: variant.name,
          name: product.name,
          subCategory: product.subCategory,
          price: variant.price,
          cost: variant.cost,
          quantity: 1,
          total: variant.price
        }];
      });
      setSearch('');
    } else {
      if (product.stock <= 0) return;
      setCart(prev => {
        const existing = prev.find(item => item.productId === product.id && !item.variantId);
        if (existing) {
          if (existing.quantity >= product.stock) return prev;
          return prev.map(item => 
            (item.productId === product.id && !item.variantId)
              ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
              : item
          );
        }
        return [...prev, {
          productId: product.id!,
          name: product.name,
          subCategory: product.subCategory,
          price: product.price,
          cost: product.cost,
          quantity: 1,
          total: product.price
        }];
      });
      setSearch('');
    }
  };

  const updateQuantity = (productId: string, variantId: string | undefined, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.productId === productId && i.variantId === variantId);
      const product = products.find(p => p.id === productId);
      if (!item || !product) return prev;
      
      const newQty = item.quantity + delta;
      if (newQty <= 0) return prev.filter(i => !(i.productId === productId && i.variantId === variantId));
      
      // Stock level limits checks
      if (variantId) {
        const variant = product.variants?.find(v => v.id === variantId);
        if (!variant || newQty > variant.stock) {
          alert(`Insufficient stock remaining for option (${variant?.name || 'Unknown'})`);
          return prev;
        }
      } else {
        if (newQty > product.stock) {
          alert('Insufficient stock remaining.');
          return prev;
        }
      }

      return prev.map(i => 
        (i.productId === productId && i.variantId === variantId)
          ? { ...i, quantity: newQty, total: newQty * i.price }
          : i
      );
    });
  };

  const removeFromCart = (productId: string, variantId: string | undefined) => {
    setCart(prev => prev.filter(item => !(item.productId === productId && item.variantId === variantId)));
  };

  const addToCartByScan = (searchTerm: string) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return false;

    // 1) Search nested variants first to see if any matches this barcode or SKU
    for (const p of products) {
      if (p.hasVariants && p.variants) {
        const matchingVar = p.variants.find(v => v.barcode === searchTerm || v.sku.toLowerCase() === term);
        if (matchingVar) {
          addToCart(p, matchingVar);
          setSearch('');
          return true;
        }
      }
    }

    // 2) Standard parent matching
    const parentMatch = products.find(p => p.barcode === searchTerm || p.sku.toLowerCase() === term);
    if (parentMatch) {
      if (parentMatch.hasVariants) {
        setSelectedModalProduct(parentMatch);
        setSearch('');
        return true;
      } else {
        addToCart(parentMatch);
        setSearch('');
        return true;
      }
    }

    return false;
  };

  const subtotal = cart.reduce((acc, item) => acc + item.total, 0);
  const tax = subtotal * ((org?.taxRate || 0) / 100);
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
        // Collect unique parent product IDs to read
        const uniqueProductIds: string[] = Array.from(new Set(cart.map(item => item.productId)));
        const productRefsMap: Record<string, any> = {};
        
        const uniqueRefs = uniqueProductIds.map((id: string) => {
          const ref = doc(db, 'orgs', org!.id, 'products', id);
          productRefsMap[id] = ref;
          return ref;
        });

        const productSnapshots = await Promise.all(uniqueRefs.map(ref => transaction.get(ref)));
        const productDataMap: Record<string, any> = {};
        productSnapshots.forEach(snap => {
          if (snap.exists()) {
            productDataMap[snap.id] = snap.data();
          }
        });

        // Store intermediate updates to apply on commit
        const productUpdates: Record<string, any> = {};

        // 1. Verify stock for all items
        for (const item of cart) {
          const currentData = productUpdates[item.productId] || productDataMap[item.productId];
          if (!currentData) {
            throw new Error(`Product ${item.name} not found`);
          }

          if (item.variantId) {
            // Retrieve variant list and locate record
            const variants = [...(currentData.variants || [])];
            const variantIdx = variants.findIndex(v => v.id === item.variantId);
            if (variantIdx === -1) {
              throw new Error(`Variation "${item.variantName || 'unknown'}" not found for ${item.name}`);
            }

            if (variants[variantIdx].stock < item.quantity) {
              throw new Error(`Insufficient stock for "${item.name}" variation "${variants[variantIdx].name}"`);
            }

            // Decrement variant stock
            variants[variantIdx].stock -= item.quantity;

            // Recalculate parent overall stock
            const totalStock = variants.reduce((sum, v) => sum + Number(v.stock), 0);

            productUpdates[item.productId] = {
              ...currentData,
              stock: totalStock,
              variants
            };
          } else {
            // Standalone item stock verification
            if (currentData.stock < item.quantity) {
              throw new Error(`Insufficient stock for ${item.name}`);
            }

            productUpdates[item.productId] = {
              ...currentData,
              stock: currentData.stock - item.quantity
            };
          }
        }

        // 2. Commit all updated parent documents
        for (const [id, updateData] of Object.entries(productUpdates)) {
          transaction.set(productRefsMap[id], {
            ...updateData,
            updatedAt: serverTimestamp()
          });
        }

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

        // 4. Create Audit Log
        const auditRef = doc(collection(db, 'orgs', org.id, 'audit'));
        transaction.set(auditRef, {
          orgId: org.id,
          userId: profile.id,
          userEmail: user?.email,
          action: 'sale',
          targetType: 'sale',
          targetId: saleId,
          targetName: `Sale ${saleId}`,
          details: `Processed sale ${saleId} via ${paymentMethod}. Total: ${formatCurrency(total, org?.currency)}`,
          metadata: { subtotal, tax, total, itemCount: cart.length },
          createdAt: serverTimestamp()
        });
      });

      setSuccessSale({ 
        id: saleId, 
        total, 
        change, 
        tendered: paymentMethod === 'cash' ? tendered : total,
        items: [...cart]
      });
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
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.hasVariants && p.variants && p.variants.some(v => 
        v.barcode === search || v.sku.toLowerCase().includes(search.toLowerCase()) || v.name.toLowerCase().includes(search.toLowerCase())
      ));
    
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const getPriceRange = (p: Product) => {
    if (!p.variants || p.variants.length === 0) return formatCurrency(p.price, org?.currency);
    const prices = p.variants.map(v => v.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    if (minPrice === maxPrice) return formatCurrency(minPrice, org?.currency);
    return `${formatCurrency(minPrice, org?.currency)} - ${formatCurrency(maxPrice, org?.currency)}`;
  };

  return (
    <div className="h-full lg:h-[calc(100vh-10rem)] flex flex-col lg:flex-row gap-6 lg:gap-8">
      {/* Mobile Switcher */}
      <div className="lg:hidden flex p-1 bg-white/5 border border-white/10 rounded-2xl">
        <button 
          onClick={() => setActiveTab('products')}
          className={cn(
            "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all",
            activeTab === 'products' ? "bg-accent text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
          )}
        >
          Browse Assets
        </button>
        <button 
          onClick={() => setActiveTab('cart')}
          className={cn(
            "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all relative",
            activeTab === 'cart' ? "bg-accent text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
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
                className="w-full bg-slate-900 border border-white/10 rounded-2xl pl-10 lg:pl-12 pr-4 py-3 lg:py-4 text-xs lg:text-sm text-slate-200 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all placeholder:text-slate-600"
                placeholder="Asset search/scan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const found = addToCartByScan(search);
                    if (!found && filteredProducts.length === 1) {
                      addToCart(filteredProducts[0]);
                    }
                  }
                }}
              />
            </div>
            <div className="hidden sm:flex items-center gap-3 px-6 border-l border-white/10">
              <ScanLine className="w-5 h-5 text-accent" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden lg:inline">WebHID Engaged</span>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar -mx-2 px-2">
            <button
              onClick={() => setSelectedCategory('all')}
               className={cn(
                "px-4 lg:px-6 py-2 rounded-xl text-[9px] lg:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap border flex-shrink-0",
                selectedCategory === 'all' 
                  ? "bg-accent border-accent text-white shadow-lg" 
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
                    ? "bg-accent border-accent text-white shadow-lg" 
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
                p.stock <= 0 ? "opacity-30 grayscale cursor-not-allowed" : "hover:bg-white/10 hover:border-accent-border"
              )}
            >
              <div className="flex-1 mb-4 lg:mb-6">
                <span className="text-[8px] lg:text-[10px] font-bold text-slate-500 uppercase block mb-1 tracking-widest truncate">
                  {p.category || 'General'}
                </span>
                <h4 className="text-xs lg:text-sm font-bold text-slate-100 line-clamp-2 leading-tight group-hover:text-white transition-colors">
                  {p.name}
                </h4>
                {p.subCategory && (
                  <span className="text-[8px] lg:text-[9px] font-black text-accent uppercase tracking-widest mt-1 block">
                    {p.subCategory}
                  </span>
                )}
                {p.hasVariants && (
                  <span className="inline-block text-[7px] lg:text-[8px] font-black bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase mt-2">
                    Configurations
                  </span>
                )}
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
                  <span className="text-xs lg:text-sm font-bold text-accent font-sans whitespace-nowrap block">
                    {getPriceRange(p)}
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
            <ShoppingCart className="w-5 h-5 text-accent" />
            <span className="text-xs lg:text-sm font-bold text-white uppercase tracking-widest">Cart Manifest</span>
          </div>
          <span className="bg-accent text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
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
                  key={item.variantId ? `${item.productId}-${item.variantId}` : item.productId} 
                  className="p-6 group hover:bg-white/5 transition-all"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-100 leading-snug">
                        {item.name}
                      </span>
                      {item.subCategory && (
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                          {item.subCategory}
                        </span>
                      )}
                      {item.variantName && (
                        <span className="text-[9px] bg-accent/15 border border-accent/20 text-accent font-black uppercase px-2 py-0.5 rounded-full mt-2 w-fit block tracking-wider">
                          {item.variantName}
                        </span>
                      )}
                    </div>
                    <button onClick={() => removeFromCart(item.productId, item.variantId)} className="text-slate-600 hover:text-red-400 transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 bg-slate-950 border border-white/10 p-1 rounded-xl">
                      <button 
                        onClick={() => updateQuantity(item.productId, item.variantId, -1)}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-slate-100">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.productId, item.variantId, 1)}
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
              <span>Tax ({org?.taxRate || 0}%)</span>
              <span>{formatCurrency(tax, org?.currency)}</span>
            </div>
          </div>
          
          <div className="flex justify-between items-end pt-2 lg:pt-4 border-t border-white/5">
            <span className="text-[10px] lg:text-xs font-black text-accent uppercase tracking-[0.3em]">Total</span>
            <span className="text-2xl lg:text-4xl font-black text-white tracking-tighter">
              {formatCurrency(total, org?.currency)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <button 
              onClick={() => setPaymentMethod('cash')}
              className={cn(
                "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all",
                paymentMethod === 'cash' ? "bg-accent border-accent text-white shadow-lg shadow-accent/20" : "bg-white/5 border-white/10 text-slate-500"
              )}
            >
              <Banknote className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Cash</span>
            </button>
            <button 
              onClick={() => setPaymentMethod('card')}
              className={cn(
                "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all",
                paymentMethod === 'card' ? "bg-accent border-accent text-white shadow-lg shadow-accent/20" : "bg-white/5 border-white/10 text-slate-500"
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
            className="w-full h-16 bg-accent hover:bg-accent-hover text-white rounded-2xl font-black text-xl shadow-2xl shadow-accent/40 uppercase tracking-widest mt-4"
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
              className="bg-slate-900 border border-white/10 p-10 rounded-[32px] flex flex-col items-center text-center max-w-sm w-full glow-primary print:hidden"
            >
              <div className="w-20 h-20 bg-accent rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-accent/40">
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
                <Button onClick={handlePrintReceipt} className="w-full h-14 bg-accent">
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
                  <span className="w-12 text-center font-bold">Qty</span>
                  <span className="w-20 text-right font-bold">Price</span>
                </div>
                {successSale.items && successSale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-0.5">
                    <span className="flex-1 truncate">
                      {item.name}
                      {item.variantName && ` (${item.variantName})`}
                    </span>
                    <span className="w-12 text-center">{item.quantity}</span>
                    <span className="w-20 text-right">{formatCurrency(item.total, org?.currency)}</span>
                  </div>
                ))}
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

      {/* Product Variant Picker Modal */}
      <AnimatePresence>
        {selectedModalProduct && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 border border-white/10 p-8 rounded-[32px] flex flex-col w-full max-w-lg shadow-2xl"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white uppercase tracking-wider">{selectedModalProduct.name}</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                    Choose edition / size option
                  </p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setSelectedModalProduct(null)}
                  className="p-1 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all uppercase"
                >
                  Close
                </button>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 no-scrollbar my-4">
                {selectedModalProduct.variants && selectedModalProduct.variants.length > 0 ? (
                  selectedModalProduct.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        addToCart(selectedModalProduct, v);
                        setSelectedModalProduct(null);
                      }}
                      disabled={v.stock <= 0}
                      className={cn(
                        "w-full p-4 rounded-2xl flex items-center justify-between border transition-all text-left",
                        v.stock <= 0 
                          ? "opacity-40 bg-slate-950/20 border-white/5 cursor-not-allowed" 
                          : "bg-white/5 border-white/10 hover:border-accent hover:bg-white/10"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-white text-sm block">{v.name}</span>
                        <div className="flex items-center gap-2 mt-1.5 font-mono text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                          <span>SKU: {v.sku || '---'}</span>
                          <span>•</span>
                          <span>Stock: {v.stock} pcs</span>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <span className="text-base font-bold text-accent">{formatCurrency(v.price, org?.currency)}</span>
                        {v.stock <= 0 && <span className="block text-[8px] font-bold text-red-500 uppercase tracking-widest mt-1">Out of Stock</span>}
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic py-6 text-center">No configurations found.</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
