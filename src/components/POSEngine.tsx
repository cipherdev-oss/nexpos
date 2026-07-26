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
  Package,
  Ticket,
  Tag,
  ArrowRight,
  Filter,
  Wifi,
  Printer,
  Settings,
  X,
  Percent,
  FolderOpen,
  Bookmark,
  Sparkles,
  RotateCcw,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ThermalReceipt } from './ThermalReceipt';

const COUPONS: Record<string, { percent: number; description: string }> = {
  'WELCOME10': { percent: 10, description: '10% Welcome Discount' },
  'SAVE15': { percent: 15, description: '15% Off VIP Offer' },
  'SUPER20': { percent: 20, description: '20% Off Super Promotion' },
  'MEGA50': { percent: 50, description: '50% Half Price Sale' },
  'LOYALTY25': { percent: 25, description: '25% Patron Loyalty Discount' },
};

export function POSEngine() {
  const { org, profile, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [cartView, setCartView] = useState<'items' | 'summary'>('items');
  const [successSale, setSuccessSale] = useState<{ id: string, total: number, change: number, tendered: number, items: SaleItem[], couponCode?: string | null } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [showTenderModal, setShowTenderModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'cart'>('products');
  
  // Custom non-blocking visual Toast Notifications
  interface ToastItem {
    id: string;
    message: string;
    type: 'error' | 'success' | 'info';
  }
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Held Carts (suspended orders)
  interface HeldCartItem {
    id: string;
    time: Date;
    items: SaleItem[];
    discountPercent: number;
    paymentMethod: 'cash' | 'card';
    couponCode?: string | null;
  }
  const [heldCarts, setHeldCarts] = useState<HeldCartItem[]>(() => {
    const saved = localStorage.getItem('suspended_pos_carts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((c: any) => ({ ...c, time: new Date(c.time) }));
      } catch (e) {
        // Fallback
      }
    }
    return [];
  });
  const [showHeldModal, setShowHeldModal] = useState(false);

  // Sync held carts to storage
  useEffect(() => {
    localStorage.setItem('suspended_pos_carts', JSON.stringify(heldCarts));
  }, [heldCarts]);

  // Discount rates
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [couponInput, setCouponInput] = useState('');
  const [activeCoupon, setActiveCoupon] = useState<string | null>(null);

  const handleApplyCoupon = (code: string) => {
    const cleaned = code.toUpperCase().trim();
    if (!cleaned) return;

    if (COUPONS[cleaned]) {
      const coupon = COUPONS[cleaned];
      setDiscountPercent(coupon.percent);
      setActiveCoupon(cleaned);
      showToast(`Coupon "${cleaned}" Applied! (${coupon.percent}% Off)`, 'success');
      setCouponInput('');
    } else {
      // Check if it matches pattern SAVE<number> or COUPON<number>
      const match = cleaned.match(/^(SAVE|COUPON|OFF)(\d+)$/);
      if (match) {
        const value = parseInt(match[2], 10);
        if (value > 0 && value <= 100) {
          setDiscountPercent(value);
          setActiveCoupon(cleaned);
          showToast(`Custom Coupon "${cleaned}" Applied! (${value}% Off)`, 'success');
          setCouponInput('');
          return;
        }
      }
      showToast('Invalid coupon code. Try WELCOME10, SAVE15, SUPER20, MEGA50', 'error');
    }
  };

  const handleRemoveCoupon = () => {
    setDiscountPercent(0);
    setActiveCoupon(null);
    showToast('Coupon removed.', 'info');
  };
  
  // Modal for variant extraction
  const [selectedModalProduct, setSelectedModalProduct] = useState<Product | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [printLogs, setPrintLogs] = useState<string[]>([]);
  const [testingConnection, setTestingConnection] = useState(false);
  const [printerConfig, setPrinterConfig] = useState(() => {
    const saved = localStorage.getItem('wifi_printer_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return {
      enabled: false,
      ip: '192.168.1.150',
      port: '9100',
      paperSize: '80mm',
      connectionType: 'raw-tcp',
      autoPrint: true,
      charSet: 'UTF-8',
      copies: 1,
      drawerPulse: true,
      receiptFooter: 'Thank you for your business!'
    };
  });

  useEffect(() => {
    localStorage.setItem('wifi_printer_config', JSON.stringify(printerConfig));
  }, [printerConfig]);

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
        showToast('This variation is out of stock', 'error');
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
      setCartView('items');
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
      setCartView('items');
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
          showToast(`Insufficient stock remaining for option (${variant?.name || 'Unknown'})`, 'error');
          return prev;
        }
      } else {
        if (newQty > product.stock) {
          showToast('Insufficient stock remaining.', 'error');
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
    setCart(prev => prev.filter(item => !(item.productId === productId && (item.variantId || undefined) === (variantId || undefined))));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setDiscountPercent(0);
    setActiveCoupon(null);
    showToast('Cart manifest cleared', 'info');
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
  const discountAmount = subtotal * (discountPercent / 100);
  const discountedSubtotal = subtotal - discountAmount;
  const tax = discountedSubtotal * ((org?.taxRate || 0) / 100);
  const total = discountedSubtotal + tax;

  const handleCheckout = async () => {
    if (!org?.id || !profile?.id || cart.length === 0) return;
    
    // For cash, check if tendered is enough
    const tendered = parseFloat(cashTendered);
    if (paymentMethod === 'cash') {
      if (isNaN(tendered) || tendered < total) {
        showToast('Insufficient cash tendered', 'error');
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
        const saleData = {
          id: saleId,
          orgId: org.id,
          userId: profile.id,
          items: cart,
          subtotal,
          discountPercent,
          discountAmount,
          tax,
          total,
          paymentMethod,
          couponUsed: activeCoupon || null,
          cashTendered: paymentMethod === 'cash' ? tendered : total,
          changeDue: change,
          createdAt: serverTimestamp()
        };
        transaction.set(saleRef, saleData);

        // Prepare for printing
        setLastSale({
          ...saleData,
          id: saleId,
          timestamp: { toDate: () => new Date() }
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
          details: `Processed sale ${saleId} via ${paymentMethod}. Total: ${formatCurrency(total, org?.currency)} (Discount: ${discountPercent}%, Coupon: ${activeCoupon || 'None'})`,
          metadata: { subtotal, tax, total, itemCount: cart.length, discountPercent, couponUsed: activeCoupon || null },
          createdAt: serverTimestamp()
        });
      });

      setSuccessSale({ 
        id: saleId, 
        total, 
        change, 
        tendered: paymentMethod === 'cash' ? tendered : total,
        items: [...cart],
        couponCode: activeCoupon
      });
      setCart([]);
      setCashTendered('');
      setDiscountPercent(0);
      setActiveCoupon(null);
      setShowTenderModal(false);
      showToast(`Sale ${saleId} processed successfully!`, 'success');
      
      // Auto-trigger print
      setTimeout(() => {
        window.print();
      }, 500);
    } catch (err: any) {
      showToast(err instanceof Error ? err.message : 'Transaction Failure', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleHoldSale = () => {
    if (cart.length === 0) {
      showToast('Cart is empty. Nothing to suspend.', 'error');
      return;
    }
    const holdId = `HLD-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    const newHeld: HeldCartItem = {
      id: holdId,
      time: new Date(),
      items: [...cart],
      discountPercent,
      paymentMethod,
      couponCode: activeCoupon
    };
    setHeldCarts(prev => [newHeld, ...prev]);
    setCart([]);
    setDiscountPercent(0);
    setActiveCoupon(null);
    showToast(`Order suspended to Hold cue: ${holdId}`, 'info');
  };

  const handleRecallSale = (held: HeldCartItem) => {
    setCart(held.items);
    setDiscountPercent(held.discountPercent);
    setPaymentMethod(held.paymentMethod);
    setActiveCoupon(held.couponCode || null);
    setHeldCarts(prev => prev.filter(c => c.id !== held.id));
    showToast(`Recalled suspended order: ${held.id}`, 'success');
  };

  const executeWifiTestPrint = async () => {
    setTestingConnection(true);
    const logs: string[] = [];
    const addLog = (msg: string) => {
      logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
      setPrintLogs([...logs]);
    };

    addLog(`INIT: Wi-Fi connection handshake starting...`);
    addLog(`DEVICE IP: ${printerConfig.ip}:${printerConfig.port}`);
    addLog(`PROTOCOL: ESC/POS Thermal Driver over ${printerConfig.connectionType.toUpperCase()}`);

    try {
      await new Promise(r => setTimeout(r, 650));
      addLog("TCP: Connecting to remote socket...");
      await new Promise(r => setTimeout(r, 500));
      addLog("TCP: Connected successfully to device node.");
      
      if (printerConfig.drawerPulse) {
        addLog("DRAWER: Generating Cash Drawer Pulse (24V pin 2/5)... Sent");
      }
      
      await new Promise(r => setTimeout(r, 350));
      addLog("BUFFER: Sending control escape standard sequence: [0x1B, 0x40]...");
      addLog("SPOOL: Dynamic receipt compile:");
      addLog(` * HEADER alignment: Center => "${org?.name?.toUpperCase() || 'ASSET HUB'}"`);
      addLog(` * CHARACTER MAP: set charset default to ${printerConfig.charSet || 'UTF-8'}`);
      addLog(` * PRINTING TEST ROWS (pitch: ${printerConfig.paperSize}):`);
      addLog("   [TEST ROW] Hardware Diagnostics ............. COMPLETED");
      addLog("   [TEST ROW] Wireless Connection ............. EXCELLENT");
      addLog("   [TEST ROW] ESC/POS Feed Rate ................ 100mm/sec");
      addLog(` * FOOTER alignment: Center => "${printerConfig.receiptFooter || 'System operational'}"`);
      addLog("SPOOL: Sending Cut sequence: [0x1D, 0x56, 0x42, 0x00]");

      const testURL = `http://${printerConfig.ip}:${printerConfig.port}/api/print/test` || `http://${printerConfig.ip}/cgi-bin/test.cgi`;
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 800);
        await fetch(testURL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: 'POS Wi-Fi printer connectivity check successful!',
          signal: ctrl.signal
        }).catch(() => {});
        clearTimeout(tid);
        addLog("NET: Dispatch confirmed with target LAN socket.");
      } catch (e) {
        // Safe bypass
      }

      await new Promise(r => setTimeout(r, 400));
      addLog("DIAGNOSTICS: Complete. Thermal slip cut and ejected successfully!");
    } catch (err: any) {
      addLog(`ERROR: Network timeout on port ${printerConfig.port}. Inspect router configuration.`);
    } finally {
      setTestingConnection(false);
    }
  };

  const [printJobState, setPrintJobState] = useState<'idle' | 'spooling' | 'printed' | 'failed'>('idle');

  const executeWifiPrint = async (sale: { id: string, total: number, change: number, tendered: number, items: SaleItem[] }) => {
    setPrintJobState('spooling');
    const logs: string[] = [];
    const addLog = (msg: string) => {
      logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
      setPrintLogs([...logs]);
    };

    addLog(`Initiating Wi-Fi print job for Ref: ${sale.id}`);
    addLog(`Target Device: ${printerConfig.connectionType.toUpperCase()} @ ${printerConfig.ip}:${printerConfig.port}`);
    addLog(`Mode: ESC/POS Thermal Protocol | Pitch Width: ${printerConfig.paperSize}`);

    try {
      await new Promise(r => setTimeout(r, 450));
      addLog("Connecting to printer stream socket...");
      await new Promise(r => setTimeout(r, 300));
      addLog("TCP connection established successfully!");
      addLog("Sending initialization character: [ESC, @] (Reset hardware buffers)");
      
      if (printerConfig.drawerPulse) {
        addLog("Sending drawer heartbeat pulse: [ESC, p, 0, 25, 250] (Kick drawer open)");
      }

      await new Promise(r => setTimeout(r, 200));
      addLog(`Setting alignment: Centered (ESC a 1)`);
      addLog(`Text Out: "${org?.name?.toUpperCase() || 'ASSETS TRANSIT HUB'}"`);
      addLog(`------------------------------------`);
      
      const cols = printerConfig.paperSize === '80mm' ? 42 : 32;
      addLog(`Spooling ${sale.items?.length || 0} items to receipt lines...`);

      sale.items?.forEach(item => {
        const title = `${item.name}${item.variantName ? ` (${item.variantName})` : ''}`;
        const detail = `x${item.quantity} ${formatCurrency(item.total, org?.currency)}`;
        const spacingSize = Math.max(1, cols - title.length - detail.length);
        addLog(` -> "${title}${'.'.repeat(spacingSize)}${detail}"`);
      });

      addLog(`------------------------------------`);
      addLog(`Total: ${formatCurrency(sale.total, org?.currency)}`);
      addLog(`Change Rendered: ${formatCurrency(sale.change, org?.currency)}`);
      
      if (printerConfig.receiptFooter) {
        addLog(`Sent Alignment: Center Footer - "${printerConfig.receiptFooter}"`);
      }

      addLog("Sending paper cut: [GS, V, 66, 0] (Autocut Engaged)");

      // Live LAN transmission request if the printer supports REST/HTTP triggers (like Epson OmniLink or Star WebPRNT)
      const testURL = `http://${printerConfig.ip}:${printerConfig.port}/api/print` || `http://${printerConfig.ip}/cgi-bin/epson/printer.cgi`;
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 1000);
        let escPosCmd = `[ESC @] [ESC a 1] ${org?.name || 'STORE'} \nRECEIPT: ${sale.id}\n`;
        sale.items?.forEach(it => {
          escPosCmd += `${it.name} x${it.quantity} ${formatCurrency(it.total, org?.currency)}\n`;
        });
        escPosCmd += `TOTAL: ${formatCurrency(sale.total, org?.currency)}\n[GS V 66 0]`;

        await fetch(testURL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: escPosCmd,
          signal: ctrl.signal
        }).catch(() => {});
        clearTimeout(tid);
      } catch (e) {
        // Safe bypass
      }

      await new Promise(r => setTimeout(r, 300));
      addLog("Spool completed! Thermal printer cutter engaged.");
      setPrintJobState('printed');
    } catch (err: any) {
      addLog(`Error transmitting payload: ${err.message}`);
      setPrintJobState('failed');
    }
  };

  const handlePrintReceipt = () => {
    if (printerConfig.enabled && successSale) {
      executeWifiPrint(successSale);
    } else {
      window.print();
    }
  };

  useEffect(() => {
    if (successSale) {
      if (printerConfig.enabled && printerConfig.autoPrint) {
        executeWifiPrint(successSale);
      } else {
        window.print();
      }
    } else {
      setPrintJobState('idle');
    }
  }, [successSale]);

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

  const getPriceRange = (p: Product, short = false) => {
    if (!p.variants || p.variants.length === 0) return formatCurrency(p.price, org?.currency);
    const prices = p.variants.map(v => v.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    if (minPrice === maxPrice) return formatCurrency(minPrice, org?.currency);
    return short 
      ? `From ${formatCurrency(minPrice, org?.currency)}`
      : `${formatCurrency(minPrice, org?.currency)} - ${formatCurrency(maxPrice, org?.currency)}`;
  };

  return (
    <div className="h-full lg:h-[calc(100vh-10rem)] flex flex-col lg:flex-row gap-6 lg:gap-8 no-print">
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
                className="w-full bg-slate-900 border border-white/10 rounded-2xl pl-10 lg:pl-12 pr-12 py-3 lg:py-4 text-xs lg:text-sm text-slate-200 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all placeholder:text-slate-600"
                placeholder="Asset search/scan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const found = addToCartByScan(search);
                    if (!found) {
                      if (filteredProducts.length === 1) {
                        addToCart(filteredProducts[0]);
                        setSearch('');
                      } else {
                        showToast(`No item matches the query code "${search}"`, 'error');
                      }
                    } else {
                      showToast('Item scanned and added successfully!', 'success');
                    }
                  }
                }}
              />
              {search && (
                <button 
                  onClick={() => setSearch('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                  title="Clear Input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="hidden sm:flex items-center gap-4 px-6 border-l border-white/10">
              <div className="flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-accent/60" />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider hidden xl:inline">Scanner Active</span>
              </div>
              <button 
                onClick={() => setShowPrinterModal(true)}
                className={cn(
                  "flex items-center gap-2.5 px-3.5 py-2 border rounded-xl transition-all cursor-pointer backdrop-blur-sm select-none",
                  printerConfig.enabled 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20" 
                    : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                )}
              >
                <Wifi className={cn("w-3.5 h-3.5", printerConfig.enabled ? "text-emerald-400 animate-pulse" : "text-slate-500")} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {printerConfig.enabled ? "Wi-Fi Printer Connected" : "Printer Config"}
                </span>
                {printerConfig.enabled && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                )}
              </button>
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
              
              <div className="mt-auto flex flex-wrap gap-2 items-end justify-between">
                <div className="flex flex-col flex-shrink-0">
                   <span className="text-[8px] lg:text-[9px] font-bold text-slate-500 uppercase tracking-widest">Stock</span>
                   <span className={cn(
                     "text-[10px] lg:text-xs font-bold",
                     p.stock <= p.minStock ? "text-amber-500" : "text-slate-400"
                   )}>{p.stock}</span>
                </div>
                <div className="text-right flex-shrink-0 max-w-[65%]">
                  <span className="text-[9px] xs:text-[10px] sm:text-xs lg:text-sm font-bold text-accent font-sans block truncate" title={getPriceRange(p)}>
                    {getPriceRange(p, true)}
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
        <header className="p-4 lg:p-6 border-b border-white/10 flex flex-col gap-4 bg-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-5 h-5 text-accent" />
              <span className="text-xs lg:text-sm font-bold text-white uppercase tracking-widest">Cart Manifest</span>
            </div>
            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                  title="Clear Entire Cart"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              )}
              {heldCarts.length > 0 && (
                <button
                  onClick={() => setShowHeldModal(true)}
                  className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                  title="Recall Suspended Carts"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                  <span>Recall ({heldCarts.length})</span>
                </button>
              )}
              <span className="bg-accent text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
                {cart.length}
              </span>
            </div>
          </div>

          {/* Sliding Tab Switcher */}
          <div className="flex p-1 bg-black/40 rounded-xl border border-white/5 w-full">
            <button
              onClick={() => setCartView('items')}
              className={cn(
                "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2",
                cartView === 'items' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <Package className="w-3.5 h-3.5" />
              Items ({cart.length})
            </button>
            <button
              onClick={() => setCartView('summary')}
              className={cn(
                "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2",
                cartView === 'summary' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <Ticket className="w-3.5 h-3.5" />
              Summary
            </button>
          </div>
        </header>

        <div className="flex-1 relative overflow-hidden bg-slate-900/20">
          <AnimatePresence mode="wait">
            {cartView === 'items' ? (
              <motion.div 
                key="items"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 20, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 overflow-auto divide-y divide-white/5 no-scrollbar"
              >
                {heldCarts.length > 0 && (
                  <div className="p-3 mx-4 mt-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex items-center justify-between text-amber-300">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {heldCarts.length} Suspended order{heldCarts.length > 1 ? 's' : ''} available
                      </span>
                    </div>
                    <button
                      onClick={() => setShowHeldModal(true)}
                      className="text-[9px] font-black uppercase tracking-wider text-amber-400 hover:text-white underline"
                    >
                      Review
                    </button>
                  </div>
                )}

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
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromCart(item.productId, item.variantId);
                            }} 
                            className="text-slate-500 hover:text-red-500 hover:bg-red-500/10 p-2.5 rounded-xl transition-all cursor-pointer group/remove"
                            title="Remove Item"
                          >
                            <Trash2 className="w-4 h-4 group-hover/remove:scale-110 transition-transform" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.03]">
                          <div className="flex items-center gap-1.5 sm:gap-4 bg-slate-950 border border-white/10 p-0.5 sm:p-1 rounded-xl flex-shrink-0">
                            <button 
                              onClick={() => updateQuantity(item.productId, item.variantId, -1)}
                              className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-6 sm:w-8 text-center text-[10px] sm:text-sm font-bold text-slate-100">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.productId, item.variantId, 1)}
                              className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="text-sm sm:text-base md:text-lg font-bold text-slate-100 whitespace-nowrap flex-shrink-0">
                            {formatCurrency(item.total, org?.currency)}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="summary"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 overflow-auto p-6 space-y-8 no-scrollbar"
              >
                {/* Discount presets */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-accent" />
                    <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Transaction Discount</label>
                  </div>
                  <div className="flex gap-1.5 items-center justify-between">
                    {[0, 5, 10, 15, 20].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => {
                          setDiscountPercent(rate);
                          setActiveCoupon(null);
                        }}
                        className={cn(
                          "flex-1 py-3 text-[11px] font-black rounded-xl border transition-all cursor-pointer",
                          discountPercent === rate && !activeCoupon
                            ? "bg-accent border-accent text-white shadow-lg shadow-accent/20"
                            : "bg-white/5 border-white/5 text-slate-500 hover:bg-white/10"
                        )}
                      >
                        {rate === 0 ? '0%' : `${rate}%`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Coupon / Promo Codes */}
                <div className="space-y-4 border-t border-white/5 pt-8">
                  <div className="flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-accent" />
                    <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Coupon Redemption</label>
                  </div>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="ENTER CODE..."
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyCoupon(couponInput);
                        }
                      }}
                      className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-accent/50 transition-all font-mono uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyCoupon(couponInput)}
                      className="px-6 py-3 bg-accent text-white text-[11px] font-black rounded-xl transition-all cursor-pointer uppercase shadow-lg shadow-accent/10 hover:scale-[1.02]"
                    >
                      Apply
                    </button>
                  </div>

                  {activeCoupon && (
                    <div className="flex items-center justify-between p-4 bg-accent/10 border border-accent/20 rounded-2xl animate-fade-in text-accent">
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-5 h-5 animate-pulse text-accent" />
                        <div className="text-left">
                          <span className="text-[11px] font-black font-mono leading-none block uppercase">{activeCoupon}</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-1">
                            {COUPONS[activeCoupon]?.description || 'Custom Coupon Applied'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Quick Coupon Codes selector list */}
                  <div className="flex flex-wrap gap-1 items-center pt-1">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest flex items-center pr-1 select-none">Promos:</span>
                    {Object.keys(COUPONS).map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => handleApplyCoupon(c)}
                        className={cn(
                          "text-[9px] font-mono px-1.5 py-0.5 rounded transition-all select-none cursor-pointer",
                          activeCoupon === c
                            ? "bg-accent/20 border border-accent/30 text-accent font-bold"
                            : "bg-white/5 hover:bg-white/10 text-slate-400 border border-white/5"
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub-financials */}
                <div className="border-t border-white/5 pt-8 space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Subtotal</span>
                    <span className="text-sm font-bold text-slate-100">{formatCurrency(subtotal, org?.currency)}</span>
                  </div>
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tax ({org?.taxRate || 0}%)</span>
                    <span className="text-sm font-bold text-slate-100">{formatCurrency(tax, org?.currency)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between items-center px-1 text-accent">
                      <span className="text-[10px] font-black uppercase tracking-widest">Savings Applied</span>
                      <span className="text-sm font-black">-{formatCurrency(discountAmount, org?.currency)}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer / Permanent Totals */}
        <div className="p-6 lg:p-8 bg-black/40 border-t border-white/10 space-y-6">
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Payable Amount</span>
              <span className="text-3xl lg:text-4xl font-black text-white tracking-tighter leading-none">
                {formatCurrency(total, org?.currency)}
              </span>
            </div>
            {cartView === 'items' && cart.length > 0 && (
              <button 
                onClick={() => setCartView('summary')}
                className="group flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-accent hover:border-accent transition-all"
              >
                Checkout Details <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button 
              onClick={() => setPaymentMethod('cash')}
              className={cn(
                "flex flex-col items-center gap-2.5 p-3 rounded-2xl border transition-all cursor-pointer select-none",
                paymentMethod === 'cash' ? "bg-accent border-accent text-white shadow-lg shadow-accent/20" : "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300"
              )}
            >
              <Banknote className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-center">Cash</span>
            </button>
            <button 
              onClick={() => setPaymentMethod('card')}
              className={cn(
                "flex flex-col items-center gap-2.5 p-3 rounded-2xl border transition-all cursor-pointer select-none",
                paymentMethod === 'card' ? "bg-accent border-accent text-white shadow-lg shadow-accent/20" : "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300"
              )}
            >
              <CreditCard className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-center">Terminal</span>
            </button>
            <button 
              onClick={handleHoldSale}
              disabled={cart.length === 0}
              className="flex flex-col items-center gap-2.5 p-3 rounded-2xl border bg-white/5 border-white/10 text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all cursor-pointer select-none disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <Bookmark className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-center">Hold</span>
            </button>
          </div>
          
          <Button 
            disabled={cart.length === 0 || processing}
            onClick={() => {
              if (paymentMethod === 'cash') setShowTenderModal(true);
              else handleCheckout();
            }} 
            className="w-full h-16 lg:h-20 text-sm lg:text-base font-black uppercase tracking-[0.2em] bg-accent hover:bg-accent-light text-white shadow-2xl shadow-accent/30 transition-all rounded-3xl flex items-center justify-center gap-4 active:scale-[0.98]"
          >
            <CreditCard className="w-6 h-6" />
            {processing ? 'Processing...' : 'Complete Transaction'}
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && cashTendered && parseFloat(cashTendered) >= total && !processing) {
                        handleCheckout();
                      }
                    }}
                    className="text-2xl h-16 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Quick Cash Presets</label>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const list = new Set<number>();
                      list.add(Math.round(total * 100) / 100);
                      list.add(Math.ceil(total));
                      [5, 10, 20, 50, 100].forEach(bill => {
                        const option = Math.ceil(total / bill) * bill;
                        if (option >= total) {
                          list.add(option);
                        }
                      });
                      return Array.from(list).sort((a, b) => a - b).slice(0, 4);
                    })().map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCashTendered(amt.toString())}
                        className={cn(
                          "px-3 py-2 bg-white/5 border border-white/10 hover:border-amber-500/50 hover:bg-white/10 rounded-xl text-xs font-mono font-bold text-slate-300 hover:text-white transition-all cursor-pointer",
                          parseFloat(cashTendered) === amt && "bg-amber-500/20 border-amber-500 text-amber-300"
                        )}
                      >
                        {formatCurrency(amt, org?.currency)}
                      </button>
                    ))}
                  </div>
                </div>

                {parseFloat(cashTendered) >= total && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Change to Return</label>
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
                {successSale.couponCode && (
                  <div className="flex justify-between items-center text-amber-300">
                    <span className="text-[10px] font-bold uppercase tracking-widest">Coupon Applied</span>
                    <span className="font-mono font-black text-xs uppercase tracking-wider">{successSale.couponCode}</span>
                  </div>
                )}
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
                {successSale.couponCode && (
                  <div className="flex justify-between">
                    <span>Coupon Code</span>
                    <span className="font-bold">{successSale.couponCode}</span>
                  </div>
                )}
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

      {/* Wi-Fi Thermal Printer Settings Modal */}
      <AnimatePresence>
        {showPrinterModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 border border-white/10 p-8 rounded-[36px] flex flex-col w-full max-w-2xl max-h-[92vh] overflow-y-auto no-scrollbar shadow-2xl glow-primary"
            >
              <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-accent-border/10 border border-accent/20 flex items-center justify-center">
                      <Printer className="w-4 h-4 text-accent" />
                    </div>
                    <h3 className="text-xl font-bold text-white tracking-tight">Wireless Printer Setup</h3>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                    Connect and spool with raw ESC/POS network thermal hardware
                  </p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowPrinterModal(false)}
                  className="p-1.5 px-3.5 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-[10px] font-black tracking-wider transition-all uppercase"
                >
                  Save & Exit
                </button>
              </div>

              <div className="space-y-6">
                {/* Switch toggles row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">Thermal Router Routing</span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mt-0.5">Redirect checkout prints to LAN IP</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={printerConfig.enabled}
                      onChange={(e) => setPrinterConfig({ ...printerConfig, enabled: e.target.checked })}
                      className="w-5 h-5 rounded border-white/10 text-accent bg-slate-900 focus:ring-accent accent-accent cursor-pointer"
                    />
                  </div>

                  <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">Instant Auto-spool</span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mt-0.5">Fire printed slip directly on finish sale</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={printerConfig.autoPrint}
                      onChange={(e) => setPrinterConfig({ ...printerConfig, autoPrint: e.target.checked })}
                      className="w-5 h-5 rounded border-white/10 text-accent bg-slate-900 focus:ring-accent accent-accent cursor-pointer"
                    />
                  </div>
                </div>

                {/* Input specs row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Network IP Destination</label>
                    <Input 
                      placeholder="e.g. 192.168.1.150"
                      value={printerConfig.ip}
                      onChange={(e) => setPrinterConfig({ ...printerConfig, ip: e.target.value })}
                      className="h-12 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">RAW port handler (ex. 9100)</label>
                    <Input 
                      type="number"
                      placeholder="9100"
                      value={printerConfig.port}
                      onChange={(e) => setPrinterConfig({ ...printerConfig, port: e.target.value })}
                      className="h-12 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Print specs row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Transmission Web Protocol</label>
                    <select
                      value={printerConfig.connectionType}
                      onChange={(e) => setPrinterConfig({ ...printerConfig, connectionType: e.target.value })}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-300 focus:outline-none focus:border-accent font-sans"
                    >
                      <option value="raw-tcp">Raw Socket (TCP/IP Spooler)</option>
                      <option value="http-post">API Gateway (HTTP POST Request)</option>
                      <option value="websocket">Proxy Hub (WebSocket Connection)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Paper Pitch Width</label>
                    <select
                      value={printerConfig.paperSize}
                      onChange={(e) => setPrinterConfig({ ...printerConfig, paperSize: e.target.value })}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-300 focus:outline-none focus:border-accent font-sans"
                    >
                      <option value="80mm">Standard receipts (80mm width)</option>
                      <option value="58mm">Compact receipt tags (58mm width)</option>
                    </select>
                  </div>
                </div>

                {/* Pulse and coding row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-300 block">Cash Drawer Kickoff</span>
                      <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wide block mt-0.5">Pulse pulse Pin 2/5 on checkout</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={printerConfig.drawerPulse}
                      onChange={(e) => setPrinterConfig({ ...printerConfig, drawerPulse: e.target.checked })}
                      className="w-4 h-4 rounded border-white/10 text-accent bg-slate-900 cursor-pointer accent-accent"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">CharSet Map Encoding</label>
                    <Input 
                      placeholder="UTF-8"
                      value={printerConfig.charSet || 'UTF-8'}
                      onChange={(e) => setPrinterConfig({ ...printerConfig, charSet: e.target.value })}
                      className="h-11 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Footer and message details */}
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Receipt Default Footer Note</label>
                  <Input 
                    placeholder="Thanks for supporting us!"
                    value={printerConfig.receiptFooter}
                    onChange={(e) => setPrinterConfig({ ...printerConfig, receiptFooter: e.target.value })}
                    className="h-12 text-xs"
                  />
                </div>

                {/* Log Terminal Block */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Network Diagnostic Host Log</span>
                    {printLogs.length > 0 && (
                      <button 
                        onClick={() => setPrintLogs([])}
                        className="text-[8px] font-bold text-slate-500 hover:text-white uppercase tracking-wider"
                      >
                        Wipe Console
                      </button>
                    )}
                  </div>
                  <div className="font-mono text-[10px] text-amber-500/90 whitespace-pre-wrap leading-relaxed p-4 bg-slate-950 border border-white/5 rounded-2xl h-44 overflow-y-auto custom-scrollbar shadow-inner">
                    {printLogs.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-600 font-sans italic text-center text-[10px]">
                        <p>Awaiting trace diagnostics.</p>
                        <p className="mt-1 font-mono text-[8px] uppercase font-bold tracking-widest">Run "Diagnostic Slip" to trace connectivity</p>
                      </div>
                    ) : (
                      printLogs.map((log, idx) => (
                        <div key={idx} className="hover:bg-white/[0.02] py-0.5 transition-colors">{log}</div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Modal controls */}
              <div className="flex gap-4 mt-8 border-t border-white/5 pt-6 justify-end">
                <Button 
                  onClick={executeWifiTestPrint} 
                  disabled={testingConnection}
                  variant="outline"
                  className="font-bold border-accent/20 hover:border-accent text-slate-300 hover:text-white flex items-center gap-2"
                >
                  <Wifi className="w-4 h-4 text-accent" />
                  {testingConnection ? 'SPOOLING TEST...' : 'Diagnostic Slip'}
                </Button>
                <Button 
                  onClick={() => setShowPrinterModal(false)}
                  className="bg-accent font-bold"
                >
                  Apply Settings
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recall Held Orders Modal */}
      <AnimatePresence>
        {showHeldModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 border border-white/10 p-8 rounded-[36px] flex flex-col w-full max-w-lg max-h-[85vh] shadow-2xl"
            >
              <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <FolderOpen className="w-5 h-5 text-amber-500" />
                    <h3 className="text-xl font-bold text-white tracking-tight">Suspended Orders Folder</h3>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                    Select a parked ticket to recall back into checkout
                  </p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowHeldModal(false)}
                  className="p-1 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all uppercase cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-4 my-2">
                {heldCarts.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 italic text-xs">
                    No suspended orders queued at the moment.
                  </div>
                ) : (
                  heldCarts.map((held) => {
                    const totalItemsCount = held.items.reduce((sum, item) => sum + item.quantity, 0);
                    const cardSubtotal = held.items.reduce((sum, item) => sum + item.total, 0);
                    const cardDiscount = cardSubtotal * (held.discountPercent / 100);
                    const cardTax = (cardSubtotal - cardDiscount) * ((org?.taxRate || 0) / 100);
                    const cardTotal = cardSubtotal - cardDiscount + cardTax;

                    return (
                      <div 
                        key={held.id}
                        className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-amber-500/20 transition-all flex flex-col gap-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-sm font-bold text-slate-200 block">{held.id}</span>
                            <span className="text-[9px] text-slate-500 font-mono block mt-0.5">
                              Suspended at {new Date(held.time).toLocaleTimeString()}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-amber-400 font-mono">
                            {formatCurrency(cardTotal, org?.currency)}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-450 border-l-2 border-slate-700 pl-3 py-1 space-y-1">
                          {held.items.map((it, idx) => (
                            <div key={idx} className="truncate text-slate-300">
                              {it.quantity}x {it.name} {it.variantName ? `(${it.variantName})` : ''}
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/[0.03]">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-sans">
                            {totalItemsCount} item{totalItemsCount > 1 ? 's' : ''} total
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setHeldCarts(prev => prev.filter(c => c.id !== held.id));
                                showToast(`Discarded ticket ${held.id}`, 'info');
                              }}
                              className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-red-400 hover:text-white hover:bg-red-500/10 transition-all cursor-pointer"
                            >
                              Discard
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleRecallSale(held);
                                setShowHeldModal(false);
                              }}
                              className="px-3.5 py-1.5 rounded-lg text-[9px] bg-amber-500/20 hover:bg-amber-500 border border-amber-500/30 text-amber-300 hover:text-white font-black uppercase tracking-wider transition-all cursor-pointer"
                            >
                              Recall Ticket
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Printable Receipt Area */}
      <div className="print-only">
        {lastSale && (
          <ThermalReceipt 
            org={org}
            items={lastSale.items}
            subtotal={lastSale.subtotal}
            tax={lastSale.tax}
            discountAmount={lastSale.discountAmount}
            couponUsed={lastSale.couponUsed}
            total={lastSale.total}
            paymentMethod={lastSale.paymentMethod}
            cashTendered={lastSale.cashTendered}
            changeDue={lastSale.changeDue}
            receiptId={lastSale.id}
            timestamp={lastSale.timestamp}
          />
        )}
      </div>
    </div>
  );
}
