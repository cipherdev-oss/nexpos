import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType, Product, Category, ProductVariant } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { Button, Card, Input, MonospaceValue, cn, formatCurrency } from './UI';
import { Plus, Search, Package, AlertTriangle, Edit2, Trash2, X, Check, Filter, ChevronDown, ChevronUp, BookOpen, HelpCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function InventoryList() {
  const { org, profile, user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [guideTab, setGuideTab] = useState<'protocols' | 'scenarios'>('protocols');
  const [selectedPlaygroundScenario, setSelectedPlaygroundScenario] = useState<string>('coffee');
  const [loadedFeedback, setLoadedFeedback] = useState<string | null>(null);

  // Parent-Variant States
  const [hasVariants, setHasVariants] = useState(false);
  const [variantsList, setVariantsList] = useState<ProductVariant[]>([]);
  const [newVariant, setNewVariant] = useState({
    name: '',
    sku: '',
    barcode: '',
    price: 0,
    cost: 0,
    stock: 0
  });

  // Keep track of which card has its variations expanded
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', sku: '', barcode: '', category: '', subCategory: '', price: 0, cost: 0, stock: 0, minStock: 5, unit: 'pcs'
  });

  const loadPlaygroundTemplate = (type: 'single' | 'variant') => {
    // Scroll smoothly to form section
    setTimeout(() => {
      const formEl = document.getElementById('asset-form-card');
      if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);

    if (selectedPlaygroundScenario === 'coffee') {
      if (type === 'single') {
        setFormData({
          name: 'Classic Thermal Tumbler Mug',
          category: 'Stationery',
          subCategory: 'Drinkware',
          unit: 'pcs',
          price: 18.00,
          cost: 7.50,
          stock: 25,
          minStock: 5,
          sku: 'MUG-16OZ',
          barcode: '742918237581',
          isGuideItem: true
        });
        setHasVariants(false);
        setVariantsList([]);
        setLoadedFeedback('Loaded single asset: "Classic Thermal Tumbler Mug" into Form Registry below! View configuration items there.');
      } else {
        setFormData({
          name: 'Panama Geisha Specialty Beans',
          category: 'Coffee Beans',
          subCategory: 'Premium Roast',
          unit: 'bag',
          price: 0,
          cost: 0,
          stock: 0,
          minStock: 3,
          sku: '',
          barcode: '',
          isGuideItem: true
        });
        setHasVariants(true);
        setVariantsList([
          {
            id: 'VAR-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
            name: '250g Drip Grind Bag',
            sku: 'GEISHA-250G',
            barcode: '742918237592',
            price: 28.00,
            cost: 12.00,
            stock: 12
          },
          {
            id: 'VAR-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
            name: '500g Whole bean Bag',
            sku: 'GEISHA-500G',
            barcode: '742918237603',
            price: 52.00,
            cost: 20.00,
            stock: 8
          },
          {
            id: 'VAR-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
            name: '1kg Bulk Wholebean',
            sku: 'GEISHA-1KG',
            barcode: '742918237614',
            price: 98.00,
            cost: 40.00,
            stock: 4
          }
        ]);
        setLoadedFeedback('Loaded Multi-Variant asset: "Panama Geisha Beans" with 3 size variants initialized! View variations table below.');
      }
    } else if (selectedPlaygroundScenario === 'fashion') {
      if (type === 'single') {
        setFormData({
          name: 'Premium Canvas Tote Bag',
          category: 'Clothing',
          subCategory: 'Accessories',
          unit: 'pcs',
          price: 14.99,
          cost: 4.20,
          stock: 50,
          minStock: 10,
          sku: 'TOTE-CR-NAT',
          barcode: '883921004823',
          isGuideItem: true
        });
        setHasVariants(false);
        setVariantsList([]);
        setLoadedFeedback('Loaded single asset: "Premium Canvas Tote Bag" into Form Registry below!');
      } else {
        setFormData({
          name: 'Retro Heavyweight Pullover Hoodie',
          category: 'Clothing',
          subCategory: 'Apparel',
          unit: 'pcs',
          price: 0,
          cost: 0,
          stock: 0,
          minStock: 5,
          sku: '',
          barcode: '',
          isGuideItem: true
        });
        setHasVariants(true);
        setVariantsList([
          {
            id: 'VAR-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
            name: 'Black - Medium (M)',
            sku: 'HD-RET-BLK-M',
            barcode: '883921004834',
            price: 45.00,
            cost: 16.50,
            stock: 20
          },
          {
            id: 'VAR-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
            name: 'Black - Large (L)',
            sku: 'HD-RET-BLK-L',
            barcode: '883921004845',
            price: 45.00,
            cost: 16.50,
            stock: 15
          },
          {
            id: 'VAR-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
            name: 'Heather Grey - Medium (M)',
            sku: 'HD-RET-GRY-M',
            barcode: '883921004856',
            price: 48.00,
            cost: 17.50,
            stock: 18
          },
          {
            id: 'VAR-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
            name: 'Heather Grey - Large (L)',
            sku: 'HD-RET-GRY-L',
            barcode: '883921004867',
            price: 48.00,
            cost: 17.50,
            stock: 12
          }
        ]);
        setLoadedFeedback('Loaded Multi-Variant asset: "Retro Pullover Hoodie" with 4 Color-Size variations! Scroll down to build.');
      }
    } else {
      // stationery/bookstore
      if (type === 'single') {
        setFormData({
          name: 'Professional Metal Fountain Pen',
          category: 'Stationery',
          subCategory: 'Writing',
          unit: 'pcs',
          price: 29.50,
          cost: 11.20,
          stock: 15,
          minStock: 3,
          sku: 'FN-PEN-MN-F',
          barcode: '918237559102',
          isGuideItem: true
        });
        setHasVariants(false);
        setVariantsList([]);
        setLoadedFeedback('Loaded single asset: "Professional Metal Fountain Pen" into Registry Form below!');
      } else {
        setFormData({
          name: 'Hardcover Academic Weekly Planner 2026',
          category: 'Stationery',
          subCategory: 'Planners',
          unit: 'pcs',
          price: 0,
          cost: 0,
          stock: 0,
          minStock: 5,
          sku: '',
          barcode: '',
          isGuideItem: true
        });
        setHasVariants(true);
        setVariantsList([
          {
            id: 'VAR-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
            name: 'Pocket Size A6 - Midnight Black',
            sku: 'PLAN-26-A6',
            barcode: '918237559113',
            price: 16.00,
            cost: 5.50,
            stock: 30
          },
          {
            id: 'VAR-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
            name: 'Standard A5 size - Emerald Green',
            sku: 'PLAN-26-A5',
            barcode: '918237559124',
            price: 22.00,
            cost: 8.00,
            stock: 25
          },
          {
            id: 'VAR-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
            name: 'Executive A4 Desk Size - Cobalt Blue',
            sku: 'PLAN-26-A4',
            barcode: '918237559135',
            price: 32.00,
            cost: 13.00,
            stock: 12
          }
        ]);
        setLoadedFeedback('Loaded Multi-Variant Asset: "Academic Weekly Planner" with Pocket A6, Standard A5 and Executive A4 options initialized below!');
      }
    }
    setIsAdding(true);
    // Erase feedback after 8 seconds
    setTimeout(() => {
      setLoadedFeedback(null);
    }, 8000);
  };

  useEffect(() => {
    if (!org?.id) return;

    // Fetch Products
    const productsQ = query(
      collection(db, 'orgs', org.id, 'products'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeProducts = onSnapshot(productsQ, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ ...doc.data() as Product, id: doc.id })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `orgs/${org.id}/products`);
    });

    // Fetch Categories
    const categoriesQ = query(
      collection(db, 'orgs', org.id, 'categories'),
      orderBy('name', 'asc')
    );

    const unsubscribeCategories = onSnapshot(categoriesQ, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ ...doc.data() as Category, id: doc.id })));
    }, (error) => {
      console.error("Categories fetch error:", error);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeCategories();
    };
  }, [org?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id) return;

    try {
      const { id, ...sanitizedData } = formData;
      let cleanData: any;

      if (hasVariants) {
        if (variantsList.length === 0) {
          alert('Asset configured to have variants must possess at least one variation record.');
          return;
        }
        const totalStock = variantsList.reduce((acc, v) => acc + Number(v.stock), 0);
        const minPrice = Math.min(...variantsList.map(v => v.price));
        // Average or maximum cost
        const avgCost = variantsList.reduce((acc, v) => acc + v.cost, 0) / variantsList.length;

        cleanData = {
          ...sanitizedData,
          price: minPrice,
          cost: avgCost,
          stock: totalStock,
          minStock: Number(sanitizedData.minStock) || 0,
          hasVariants: true,
          variants: variantsList,
          isGuideItem: formData.isGuideItem || false
        };
      } else {
        cleanData = {
          ...sanitizedData,
          price: Number(sanitizedData.price) || 0,
          cost: Number(sanitizedData.cost) || 0,
          stock: Number(sanitizedData.stock) || 0,
          minStock: Number(sanitizedData.minStock) || 0,
          hasVariants: false,
          variants: [],
          isGuideItem: formData.isGuideItem || false
        };
      }

      // Seamlessly Connect & Auto-Register Unlisted Category
      if (cleanData.category && cleanData.category.trim()) {
        const catNameTrimmed = cleanData.category.trim();
        const categoryExists = categories.some(cat => cat.name.trim().toLowerCase() === catNameTrimmed.toLowerCase());
        
        if (!categoryExists) {
          const categoryRef = await addDoc(collection(db, 'orgs', org.id, 'categories'), {
            name: catNameTrimmed,
            description: `Auto-registered cluster for asset "${cleanData.name}"`,
            orgId: org.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          // Audit Log
          await addDoc(collection(db, 'orgs', org.id, 'audit'), {
            orgId: org.id,
            userId: user?.uid,
            userEmail: user?.email,
            action: 'create',
            targetType: 'category',
            targetId: categoryRef.id,
            targetName: catNameTrimmed,
            details: `Automatically registered categorization cluster "${catNameTrimmed}" during Asset registration`,
            createdAt: serverTimestamp()
          });
        }
      }

      if (editingProduct?.id) {
        await updateDoc(doc(db, 'orgs', org.id, 'products', editingProduct.id), {
          ...cleanData,
          updatedAt: serverTimestamp()
        });

        // Audit Log
        await addDoc(collection(db, 'orgs', org.id, 'audit'), {
          orgId: org.id,
          userId: user?.uid,
          userEmail: user?.email,
          action: 'update',
          targetType: 'product',
          targetId: editingProduct.id,
          targetName: cleanData.name,
          details: `Modified variant asset properties for ${cleanData.name} (Has variants: ${hasVariants}, Variants count: ${variantsList.length})`,
          metadata: { oldStock: editingProduct.stock, newStock: cleanData.stock, hasVariants, variantsCount: variantsList.length },
          createdAt: serverTimestamp()
        });
      } else {
        const docRef = await addDoc(collection(db, 'orgs', org.id, 'products'), {
          ...cleanData,
          orgId: org.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Audit Log
        await addDoc(collection(db, 'orgs', org.id, 'audit'), {
          orgId: org.id,
          userId: user?.uid,
          userEmail: user?.email,
          action: 'create',
          targetType: 'product',
          targetId: docRef.id,
          targetName: cleanData.name,
          details: `Registered variant parent asset: ${cleanData.name} with total stock of ${cleanData.stock}`,
          metadata: { hasVariants, variantsCount: variantsList.length },
          createdAt: serverTimestamp()
        });
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `orgs/${org.id}/products`);
    }
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingProduct(null);
    setFormData({ name: '', sku: '', barcode: '', category: '', subCategory: '', price: 0, cost: 0, stock: 0, minStock: 5, unit: 'pcs' });
    setHasVariants(false);
    setVariantsList([]);
    setNewVariant({ name: '', sku: '', barcode: '', price: 0, cost: 0, stock: 0 });
  };

  const startEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData(p);
    setHasVariants(!!p.hasVariants);
    setVariantsList(p.variants || []);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!org?.id) return;
    const productToDelete = products.find(p => p.id === id);
    try {
      await deleteDoc(doc(db, 'orgs', org.id, 'products', id));

      // Audit Log
      await addDoc(collection(db, 'orgs', org.id, 'audit'), {
        orgId: org.id,
        userId: user?.uid,
        userEmail: user?.email,
        action: 'delete',
        targetType: 'product',
        targetId: id,
        targetName: productToDelete?.name || 'Unknown Asset',
        details: `Permanently removed asset: ${productToDelete?.name || id} from infrastructure`,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Deletion failed:", error);
      handleFirestoreError(error, OperationType.DELETE, `orgs/${org.id}/products/${id}`);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Inventory Hub</h1>
          <div className="flex items-center gap-2">
            <p className="text-xs lg:text-sm text-slate-400">Node management & stock levels</p>
            {profile && (
              <span className="px-2 py-0.5 bg-accent/10 border border-accent-border rounded text-[8px] font-bold text-accent uppercase tracking-widest">
                Tier: {profile.role}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3">
          <Button 
            type="button"
            variant="outline" 
            onClick={() => setShowGuide(!showGuide)} 
            className={cn("gap-2 border-white/10 text-slate-300 hover:bg-white/5", showGuide && "border-accent text-accent bg-accent/5")}
          >
            <BookOpen className="w-4 h-4" />
            <span>Operations Guide</span>
          </Button>
          <Button onClick={() => setIsAdding(true)} className="w-full sm:w-auto gap-2">
            <Plus className="w-5 h-5" />
            Register Asset
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showGuide && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 lg:p-8 shadow-2xl space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-accent/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
              
              <div className="flex justify-between items-start relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-accent/10 border border-accent/20 rounded-2xl flex items-center justify-center shrink-0">
                    <BookOpen className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-wider">Asset Modification Operations Protocol</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Interactive sandbox and protocol guides for configuration design</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="p-1.5 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Guide Tabs */}
              <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-4 relative z-10">
                <button
                  type="button"
                  onClick={() => setGuideTab('protocols')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border",
                    guideTab === 'protocols'
                      ? "bg-accent/10 border-accent text-accent"
                      : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                  )}
                >
                  📖 Structural Protocols
                </button>
                <button
                  type="button"
                  onClick={() => setGuideTab('scenarios')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border flex items-center gap-2",
                    guideTab === 'scenarios'
                      ? "bg-accent/10 border-accent text-accent shadow-[0_0_15px_rgba(235,94,40,0.15)] animate-pulse"
                      : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                  )}
                >
                  🚀 Practical Scenario Playground
                </button>
              </div>

              {guideTab === 'protocols' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                  {/* Protocol 1: Standalone Single Asset */}
                  <div className="space-y-3 p-5 bg-white/5 border border-white/5 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-accent/10 text-accent border border-accent/25 text-[10px] font-black flex items-center justify-center font-mono">01</span>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">Standard Single Asset Modification</h4>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Designed for simple items with uniform physical attributes (e.g., standard books, single-edition prints, or standalone products with a single SKU).
                    </p>
                    <ul className="space-y-2 border-t border-white/5 pt-3 font-mono text-[10px] text-slate-500">
                      <li className="flex items-start gap-2">
                        <span className="text-accent">•</span>
                        <span>Modify <strong className="text-slate-350">Sale Price</strong>, <strong className="text-slate-350">Unit Cost</strong>, and <strong className="text-slate-350">Initial Stock</strong> directly on the product's main form columns.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-accent">•</span>
                        <span>Enter the exact scannable Barcode tag / SKU identifier at the parent level.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-accent">•</span>
                        <span>Saving changes instantly commits stock parameters to the primary item record.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Protocol 2: Multi-Variant Asset */}
                  <div className="space-y-3 p-5 bg-white/5 border border-white/5 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[10px] font-black flex items-center justify-center font-mono">02</span>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">Separate Multi-Variant Modification</h4>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Designed for complex items possessing multiple distinct configurations, page counts, dimensions, paper formats, or size editions.
                    </p>
                    <ul className="space-y-2 border-t border-white/5 pt-3 font-mono text-[10px] text-slate-500">
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400">•</span>
                        <span>General details (Name, Category, tags, unit) are modified centrally on the parent form.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400">•</span>
                        <span>Pricing, SKU codes, unique UPC barcodes, and dedicated stock counts are registered and managed <strong className="text-white">separately inside the Configurations sub-list</strong>.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400">•</span>
                        <span>Overall parent asset stock values calculate automatically as the net sum of all config sub-stocks.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 relative z-10">
                  <div className="bg-slate-950/40 p-5 border border-white/5 rounded-2xl flex flex-col md:flex-row gap-6 items-start justify-between">
                    <div className="space-y-2">
                      <span className="text-[9px] font-black text-accent uppercase tracking-widest block">Step 1: Choose Your Business Industry Concept</span>
                      <div className="flex gap-2">
                        {[
                          { id: 'coffee', label: '☕ Cafe / Coffee Shop' },
                          { id: 'fashion', label: '👕 Apparel & Merch' },
                          { id: 'stationery', label: '📚 Bookstore / Stationery' }
                        ].map(scenario => (
                          <button
                            key={scenario.id}
                            type="button"
                            onClick={() => setSelectedPlaygroundScenario(scenario.id)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all",
                              selectedPlaygroundScenario === scenario.id
                                ? "bg-white text-slate-950 shadow"
                                : "bg-white/5 text-slate-400 hover:text-slate-200"
                            )}
                          >
                            {scenario.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                        Select an option to see a real comparison mapping showing how to structure and categorize standard items vs multi-variants in practice.
                      </p>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto shrink-0 pt-2 md:pt-0">
                      <button
                        type="button"
                        onClick={() => loadPlaygroundTemplate('single')}
                        className="flex-1 md:flex-none px-4 py-2.5 bg-accent text-white text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-accent/90 transition-all flex items-center justify-center gap-1.5"
                      >
                        ⚡ load simple template
                      </button>
                      <button
                        type="button"
                        onClick={() => loadPlaygroundTemplate('variant')}
                        className="flex-1 md:flex-none px-4 py-2.5 bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-1.5"
                      >
                        ⚡ load variant template
                      </button>
                    </div>
                  </div>

                  {/* Schema Visualization Mapping Block */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Column A: Flat / Single Item Model */}
                    <div className="bg-white/5 p-5 border border-white/5 rounded-2xl space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-accent/15 border border-accent/20 rounded text-[8px] font-black text-accent uppercase tracking-widest">Option A</span>
                        <h4 className="text-xs font-black text-white uppercase tracking-wider">Example: Simple Standalone Product</h4>
                      </div>
                      <div className="bg-slate-950 p-4 rounded-xl border border-white/5 font-mono text-[10px] leading-relaxed text-slate-400 space-y-2">
                        <div className="text-accent font-bold">// Database Document (1:1 Product Schema)</div>
                        <div>📂 Products Collection</div>
                        <div className="pl-4 border-l border-white/10 space-y-1">
                          <div>• <strong className="text-white">Name:</strong> {selectedPlaygroundScenario === 'coffee' ? '"Classic Thermal Tumbler Mug"' : selectedPlaygroundScenario === 'fashion' ? '"Premium Canvas Tote Bag"' : '"Professional Metal Fountain Pen"'}</div>
                          <div>• <strong className="text-white">Category:</strong> {selectedPlaygroundScenario === 'coffee' ? '"Stationery"' : selectedPlaygroundScenario === 'fashion' ? '"Clothing"' : '"Stationery"'}</div>
                          <div>• <strong className="text-white">Subcategory:</strong> {selectedPlaygroundScenario === 'coffee' ? '"Drinkware"' : selectedPlaygroundScenario === 'fashion' ? '"Accessories"' : '"Writing"'}</div>
                          <div>• <strong className="text-white">HasVariants:</strong> <span className="text-red-400">false</span></div>
                          <div className="text-slate-500">// Single flat item stats declared on parent document itself:</div>
                          <div>• <strong className="text-emerald-400">Price:</strong> {selectedPlaygroundScenario === 'coffee' ? '$18.00' : selectedPlaygroundScenario === 'fashion' ? '$14.99' : '$29.50'}</div>
                          <div>• <strong className="text-emerald-400">Stock:</strong> {selectedPlaygroundScenario === 'coffee' ? '25 units' : selectedPlaygroundScenario === 'fashion' ? '50 units' : '15 units'}</div>
                          <div>• <strong className="text-emerald-400">SKU:</strong> {selectedPlaygroundScenario === 'coffee' ? '"MUG-16OZ"' : selectedPlaygroundScenario === 'fashion' ? '"TOTE-CR-NAT"' : '"FN-PEN-MN-F"'}</div>
                          <div>• <strong className="text-emerald-400">Barcode:</strong> {selectedPlaygroundScenario === 'coffee' ? '"742918237581"' : selectedPlaygroundScenario === 'fashion' ? '"883921004823"' : '"918237559102"'}</div>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed italic">
                        ⭐ <strong>When to categorize under this:</strong> Choose this options when the physical item has no subdivisions (no sizes, colors, formats, or volumes) and is sold exactly as-is under a single primary SKU.
                      </p>
                    </div>

                    {/* Column B: Relational Parent-Variant model */}
                    <div className="bg-white/5 p-5 border border-white/5 rounded-2xl space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/20 rounded text-[8px] font-black text-emerald-400 uppercase tracking-widest">Option B</span>
                        <h4 className="text-xs font-black text-white uppercase tracking-wider">Example: Complex Multi-Variant Product</h4>
                      </div>
                      <div className="bg-slate-950 p-4 rounded-xl border border-white/5 font-mono text-[10px] leading-relaxed text-slate-400 space-y-3">
                        <div className="text-emerald-400 font-bold">// Parent Container Document</div>
                        <div>📂 Products Collection</div>
                        <div className="pl-4 border-l border-white/10 space-y-1">
                          <div>• <strong className="text-white">Name:</strong> {selectedPlaygroundScenario === 'coffee' ? '"Panama Geisha Specialty Beans"' : selectedPlaygroundScenario === 'fashion' ? '"Retro Heavyweight Pullover Hoodie"' : '"Hardcover Academic Planner 2026"'}</div>
                          <div>• <strong className="text-white">Category:</strong> {selectedPlaygroundScenario === 'coffee' ? '"Coffee Beans"' : selectedPlaygroundScenario === 'fashion' ? '"Clothing"' : '"Stationery"'}</div>
                          <div>• <strong className="text-white">Subcategory:</strong> {selectedPlaygroundScenario === 'coffee' ? '"Premium Roast"' : selectedPlaygroundScenario === 'fashion' ? '"Apparel"' : '"Planners"'}</div>
                          <div>• <strong className="text-white">HasVariants:</strong> <span className="text-emerald-400">true</span></div>
                          <div>• <strong className="text-white">Total Stock:</strong> <span className="text-emerald-400">Sum of nested (e.g. {selectedPlaygroundScenario === 'coffee' ? '24' : selectedPlaygroundScenario === 'fashion' ? '65' : '67'} units)</span></div>
                        </div>
                        
                        <div className="text-slate-500 border-t border-white/5 pt-2">// Nested Configurations array (Managed separately):</div>
                        <div className="pl-4 space-y-2 border-l border-emerald-500/20">
                          {selectedPlaygroundScenario === 'coffee' ? (
                            <>
                              <div>
                                <strong className="text-emerald-300">└─ Config 1: "250g Drip Grind Bag"</strong>
                                <div className="pl-4 text-slate-500">Price: $28.00 | stock: 12 pcs | SKU: GEISHA-250G | Barcode: 742918237592</div>
                              </div>
                              <div>
                                <strong className="text-emerald-300">└─ Config 2: "500g Whole bean Bag"</strong>
                                <div className="pl-4 text-slate-500">Price: $52.00 | stock: 8 pcs | SKU: GEISHA-500G | Barcode: 742918237603</div>
                              </div>
                            </>
                          ) : selectedPlaygroundScenario === 'fashion' ? (
                            <>
                              <div>
                                <strong className="text-emerald-300">└─ Config 1: "Black - Medium (M)"</strong>
                                <div className="pl-4 text-slate-500">Price: $45.00 | stock: 20 pcs | SKU: HD-RET-BLK-M | Barcode: 883921004834</div>
                              </div>
                              <div>
                                <strong className="text-emerald-300">└─ Config 2: "Black - Large (L)"</strong>
                                <div className="pl-4 text-slate-500">Price: $45.00 | stock: 15 pcs | SKU: HD-RET-BLK-L | Barcode: 883921004845</div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <strong className="text-emerald-300">└─ Config 1: "Pocket Size A6 - Midnight Black"</strong>
                                <div className="pl-4 text-slate-500">Price: $16.00 | stock: 30 pcs | SKU: PLAN-26-A6 | Barcode: 918237559113</div>
                              </div>
                              <div>
                                <strong className="text-emerald-300">└─ Config 2: "Standard A5 size - Emerald Green"</strong>
                                <div className="pl-4 text-slate-500">Price: $22.00 | stock: 25 pcs | SKU: PLAN-26-A5 | Barcode: 918237559124</div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed italic">
                        ⭐ <strong>When to categorize under this:</strong> Choose this option when the core product has subdivisions (sizes, weight formats, styles) where price, SKU, barcodes, or stocks vary per config but share general classifications!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 relative z-10">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">Point-of-Sale Realization Context</span>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Barcode scanners and transaction logs resolve target assets using their nested SKU or scanned variation barcode automatically! This lets cashiers process individual sub-variations without standard parent manual selectors popping up.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center bg-white/5 p-4 lg:p-6 rounded-2xl border border-white/10 backdrop-blur-md">
        <div className="relative md:col-span-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 lg:w-5 h-4 lg:h-5 text-slate-500" />
          <input 
            className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-10 lg:pl-12 pr-4 py-2.5 lg:py-3 text-xs lg:text-sm text-slate-200 focus:outline-none focus:border-accent transition-all placeholder:text-slate-600"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <select 
            className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 lg:py-3 text-xs lg:text-sm text-slate-200 focus:outline-none focus:border-accent appearance-none transition-all"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all" className="bg-slate-900">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.name} className="bg-slate-900">{cat.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-6 lg:gap-8 px-4 lg:px-6 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0">
          <MonospaceValue label="SKUs" value={filteredProducts.length} />
          <MonospaceValue label="Stock" value={filteredProducts.reduce((acc, p) => acc + p.stock, 0)} />
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
            id="asset-form-card"
          >
            <Card title={editingProduct ? "Modify Asset Details" : "New Asset Registration"}>
              {loadedFeedback && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-start gap-3"
                >
                  <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 animate-bounce" />
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider block">Template Loaded Successfully!</span>
                    <p className="text-[11px] font-mono leading-relaxed text-slate-350">{loadedFeedback}</p>
                  </div>
                </motion.div>
              )}
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-6 py-4">
                <div className="md:col-span-2 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">General Identifier</label>
                    <Input 
                      placeholder="Product Name" 
                      value={formData.name} 
                      onChange={e => setFormData({...formData, name: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">Category</label>
                      <select 
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:border-accent focus:outline-none appearance-none"
                        value={formData.category} 
                        onChange={e => {
                          if (e.target.value === '__add_custom__') {
                            navigate('/categories');
                          } else {
                            setFormData({ ...formData, category: e.target.value });
                          }
                        }} 
                        required
                      >
                        <option value="" disabled className="bg-slate-900">Select Category</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.name} className="bg-slate-900">{cat.name}</option>
                        ))}
                        {/* Dynamically display active option if loaded via guide but not yet in database list */}
                        {formData.category && !categories.some(cat => cat.name.trim().toLowerCase() === formData.category.trim().toLowerCase()) && (
                          <option value={formData.category} className="bg-slate-900 text-amber-400">
                            ✨ {formData.category} (Pending Auto-Registration)
                          </option>
                        )}
                        <option value="__add_custom__" className="bg-slate-900 text-accent font-bold">
                          ➕ Create Brand New Category...
                        </option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">Base Type / Unit</label>
                      <Input 
                        placeholder="e.g. pcs, book, copy" 
                        value={formData.unit || ''} 
                        onChange={e => setFormData({...formData, unit: e.target.value})} 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">Sub-Category Tag</label>
                      <Input 
                        placeholder="e.g. Softcover, Novel" 
                        value={formData.subCategory || ''} 
                        onChange={e => setFormData({...formData, subCategory: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">Alert Stock Threshold</label>
                      <Input 
                        type="number"
                        placeholder="5" 
                        value={formData.minStock || ''} 
                        onChange={e => setFormData({...formData, minStock: parseInt(e.target.value) || 0})} 
                      />
                    </div>
                  </div>

                  {/* Variation Toggle Switch Block */}
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col pr-4">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Configure Asset Variations</span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-normal">
                          Enable for multi-variant products (e.g. different sizes, page counts, editions)
                        </span>
                      </div>
                      <input 
                        type="checkbox"
                        checked={hasVariants}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setHasVariants(checked);
                          if (checked && variantsList.length === 0) {
                            // Seed default variation with current parent form values to make it intuitive
                            setVariantsList([{
                              id: 'VAR-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
                              name: formData.subCategory || 'Standard Edition',
                              sku: formData.sku || '',
                              barcode: formData.barcode || '',
                              price: Number(formData.price) || 0,
                              cost: Number(formData.cost) || 0,
                              stock: Number(formData.stock) || 0
                            }]);
                          }
                        }}
                        className="w-5 h-5 rounded border-white/10 bg-slate-900 accent-accent cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Left/Middle-Right Columns Conditionals */}
                {!hasVariants ? (
                  <>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">SKU Identifier</label>
                        <Input placeholder="Internal SKU" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">Barcode Scannable</label>
                        <Input placeholder="EAN / UPC" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">Sale Price ({org?.currency})</label>
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={isNaN(formData.price!) ? '' : formData.price} 
                          onChange={e => setFormData({...formData, price: parseFloat(e.target.value) || 0})} 
                          required 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">Unit Cost ({org?.currency})</label>
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={isNaN(formData.cost!) ? '' : formData.cost} 
                          onChange={e => setFormData({...formData, cost: parseFloat(e.target.value) || 0})} 
                          required 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">Initial Stock</label>
                        <Input 
                          type="number" 
                          value={isNaN(formData.stock!) ? '' : formData.stock} 
                          onChange={e => setFormData({...formData, stock: parseInt(e.target.value) || 0})} 
                          required 
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="md:col-span-2 p-5 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                    <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 border-b border-white/10 pb-2 mb-2">
                      <Package className="w-4 h-4 text-accent" />
                      Variations Config ({variantsList.length})
                    </h4>
                    
                    {variantsList.length > 0 ? (
                      <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1 no-scrollbar">
                        {variantsList.map((v) => (
                          <div key={v.id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between text-[11px] gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-white truncate">{v.name}</p>
                              <div className="flex items-center gap-2 text-[9px] text-slate-500 uppercase font-bold mt-1">
                                <span>SKU: {v.sku || '---'}</span>
                                <span>•</span>
                                <span>Stock: {v.stock}</span>
                              </div>
                            </div>
                            <div className="text-right flex items-center gap-3">
                              <span className="font-bold text-accent">{formatCurrency(v.price, org?.currency)}</span>
                              <button 
                                type="button"
                                onClick={() => setVariantsList(prev => prev.filter(item => item.id !== v.id))}
                                className="text-slate-600 hover:text-red-400 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-amber-500/80 italic uppercase">Please register at least one variation context below.</p>
                    )}

                    {/* Add Variant Formlet nested in parent card */}
                    <div className="border-t border-white/10 pt-4 space-y-3">
                      <span className="text-[9px] font-black text-accent uppercase tracking-[0.2em] block">Add Custom variation</span>
                      <div className="grid grid-cols-2 gap-2">
                        <Input 
                          placeholder="Variant Name (e.g. 120p - Hardcover)" 
                          value={newVariant.name}
                          onChange={e => setNewVariant(prev => ({ ...prev, name: e.target.value }))}
                          className="h-9 text-xs"
                        />
                        <Input 
                          placeholder="Barcode (UPC/EAN)" 
                          value={newVariant.barcode}
                          onChange={e => setNewVariant(prev => ({ ...prev, barcode: e.target.value }))}
                          className="h-9 text-xs"
                        />
                        <Input 
                          placeholder="SKU" 
                          value={newVariant.sku}
                          onChange={e => setNewVariant(prev => ({ ...prev, sku: e.target.value }))}
                          className="h-9 text-xs"
                        />
                        <div className="flex gap-1.5">
                          <Input 
                            type="number"
                            placeholder="Price" 
                            value={newVariant.price || ''}
                            onChange={e => setNewVariant(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                            className="h-9 text-xs flex-1"
                          />
                          <Input 
                            type="number"
                            placeholder="Cost" 
                            value={newVariant.cost || ''}
                            onChange={e => setNewVariant(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
                            className="h-9 text-xs flex-1"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="number"
                          placeholder="Stock Level" 
                          value={newVariant.stock || ''}
                          onChange={e => setNewVariant(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                          className="h-9 text-xs w-28"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            if (!newVariant.name) {
                              alert('Please provide a name/description for this variation (e.g., 200 pages / Paperback)');
                              return;
                            }
                            setVariantsList(prev => [...prev, {
                              ...newVariant,
                              id: 'VAR-' + Math.random().toString(36).substring(2, 7).toUpperCase()
                            }]);
                            setNewVariant({ name: '', sku: '', barcode: '', price: 0, cost: 0, stock: 0 });
                          }}
                          className="h-9 text-xs flex-1 border-accent/20 hover:border-accent text-accent"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Commit actions row */}
                <div className="md:col-span-4 flex justify-end gap-3 border-t border-white/10 pt-4">
                  <Button type="button" variant="ghost" onClick={resetForm} className="px-6">
                    <X className="w-4 h-4 mr-2" /> Cancel
                  </Button>
                  <Button type="submit" className="px-8 gap-2 bg-accent">
                    <Check className="w-4 h-4" /> Commit Record
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((p) => (
          <motion.div 
            layout
            key={p.id} 
            className={cn(
              "group p-6 glass-card rounded-2xl flex flex-col hover:bg-white/10 transition-all",
              p.stock <= p.minStock ? "border-amber-500/20" : ""
            )}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center border border-white/10">
                <Package className="w-6 h-6 text-slate-400 group-hover:text-accent transition-colors" />
              </div>
              <div className="flex gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" onClick={() => startEdit(p)} className="p-2 h-9 w-9 rounded-lg">
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button 
                  variant="danger" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(p.id!);
                  }} 
                  className="p-2 h-9 w-9 rounded-lg relative z-10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <h3 className="text-lg font-bold text-white mb-1 truncate">{p.name}</h3>
            <div className="flex items-center gap-2 mb-2">
              {p.subCategory && (
                <span className="text-[10px] text-accent font-bold uppercase tracking-widest">{p.subCategory}</span>
              )}
              {p.hasVariants && (
                <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                  Multi-Variant
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">
              <span>{p.hasVariants ? `${p.variants?.length || 0} configurations` : `SKU: ${p.sku || '---'}`}</span>
              <span>•</span>
              <span>{p.category || 'General'}</span>
            </div>

            <div className="mt-auto pt-6 border-t border-white/5 flex justify-between items-end">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Stock Level</span>
                <div className={cn(
                  "flex items-center gap-2 text-lg font-bold",
                  p.stock <= p.minStock ? "text-amber-400" : "text-white"
                )}>
                  {p.stock} <span className="text-xs text-slate-500 font-medium lowercase">{p.unit}</span>
                  {p.stock <= p.minStock && <AlertTriangle className="w-4 h-4" />}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">
                  {p.hasVariants ? 'Price Range' : 'Unit Price'}
                </span>
                <span className={cn("font-bold text-accent", p.hasVariants ? "text-base" : "text-xl")}>
                  {getPriceRange(p)}
                </span>
              </div>
            </div>

            {/* Expandable sub-list of variations */}
            {p.hasVariants && p.variants && p.variants.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5 w-full">
                <button
                  type="button"
                  onClick={() => setExpandedProducts(prev => ({ ...prev, [p.id!]: !prev[p.id!] }))}
                  className="flex items-center justify-between w-full text-slate-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-wider"
                >
                  <span>{expandedProducts[p.id!] ? 'Hide Variations Details' : 'Show Variations Details'}</span>
                  {expandedProducts[p.id!] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {expandedProducts[p.id!] && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 space-y-2 max-h-[140px] overflow-y-auto font-mono text-[9px] border-t border-white/5 pt-2"
                  >
                    <div className="grid grid-cols-4 text-slate-500 uppercase font-black tracking-wider border-b border-white/5 pb-1">
                      <span className="col-span-1">Variant</span>
                      <span>SKU</span>
                      <span className="text-right">Price</span>
                      <span className="text-center">Stock</span>
                    </div>
                    {p.variants.map((v) => (
                      <div key={v.id} className="grid grid-cols-4 text-slate-350 py-1.5 border-b border-white/5 last:border-0 hover:bg-white/5 px-0.5 rounded items-center">
                        <span className="font-bold text-slate-200 truncate pr-1 col-span-1" title={v.name}>{v.name}</span>
                        <span className="truncate pr-1" title={v.sku}>{v.sku || '---'}</span>
                        <span className="text-right font-bold text-accent">{formatCurrency(v.price, org?.currency)}</span>
                        <span className="text-center font-bold text-white">{v.stock}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
