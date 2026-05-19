import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType, Product, Category } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { Button, Card, Input, MonospaceValue, cn, formatCurrency } from './UI';
import { Plus, Search, Package, AlertTriangle, Edit2, Trash2, X, Check, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function InventoryList() {
  const { org, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', sku: '', barcode: '', category: '', price: 0, cost: 0, stock: 0, minStock: 5, unit: 'pcs'
  });

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
      const cleanData = {
        ...sanitizedData,
        price: Number(sanitizedData.price) || 0,
        cost: Number(sanitizedData.cost) || 0,
        stock: Number(sanitizedData.stock) || 0,
        minStock: Number(sanitizedData.minStock) || 0,
      };

      if (editingProduct?.id) {
        await updateDoc(doc(db, 'orgs', org.id, 'products', editingProduct.id), {
          ...cleanData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'orgs', org.id, 'products'), {
          ...cleanData,
          orgId: org.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
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
    setFormData({ name: '', sku: '', barcode: '', category: '', price: 0, cost: 0, stock: 0, minStock: 5, unit: 'pcs' });
  };

  const startEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData(p);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!org?.id) return;
    try {
      await deleteDoc(doc(db, 'orgs', org.id, 'products', id));
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Inventory Hub</h1>
          <div className="flex items-center gap-2">
            <p className="text-xs lg:text-sm text-slate-400">Node management & stock levels</p>
            {profile && (
              <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-[8px] font-bold text-indigo-400 uppercase tracking-widest">
                Tier: {profile.role}
              </span>
            )}
          </div>
        </div>
        <Button onClick={() => setIsAdding(true)} className="w-full sm:w-auto gap-2">
          <Plus className="w-5 h-5" />
          Register Asset
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center bg-white/5 p-4 lg:p-6 rounded-2xl border border-white/10 backdrop-blur-md">
        <div className="relative md:col-span-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 lg:w-5 h-4 lg:h-5 text-slate-500" />
          <input 
            className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-10 lg:pl-12 pr-4 py-2.5 lg:py-3 text-xs lg:text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <select 
            className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 lg:py-3 text-xs lg:text-sm text-slate-200 focus:outline-none focus:border-indigo-500 appearance-none transition-all"
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
          >
            <Card title={editingProduct ? "Modify Asset" : "New Asset Registration"}>
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
                      <label className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">SKU</label>
                      <Input placeholder="Internal SKU" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">Category</label>
                      <select 
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:border-indigo-500 focus:outline-none appearance-none"
                        value={formData.category} 
                        onChange={e => setFormData({...formData, category: e.target.value})} 
                        required
                      >
                        <option value="" disabled className="bg-slate-900">Select Category</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.name} className="bg-slate-900">{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">Barcode</label>
                    <Input placeholder="EAN/UPC" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} />
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
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">Initial Stock</label>
                    <Input 
                      type="number" 
                      value={isNaN(formData.stock!) ? '' : formData.stock} 
                      onChange={e => setFormData({...formData, stock: parseInt(e.target.value) || 0})} 
                      required 
                    />
                  </div>
                  <div className="flex gap-2 pt-5">
                    <Button type="submit" className="flex-1 gap-2">
                      <Check className="w-4 h-4" />
                      Commit
                    </Button>
                    <Button type="button" variant="ghost" onClick={resetForm} className="px-2">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <Package className="w-6 h-6 text-slate-400 group-hover:text-indigo-400 transition-colors" />
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
            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">
              <span>SKU: {p.sku || '---'}</span>
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
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Unit Price</span>
                <span className="text-xl font-bold text-indigo-400">
                  {formatCurrency(p.price, org?.currency)}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
