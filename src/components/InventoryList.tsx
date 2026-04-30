import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType, Product } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { Button, Card, Input, MonospaceValue, cn } from './UI';
import { Plus, Search, Package, AlertTriangle, Edit2, Trash2, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function InventoryList() {
  const { org } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', sku: '', barcode: '', category: '', price: 0, cost: 0, stock: 0, minStock: 5, unit: 'pcs'
  });

  useEffect(() => {
    if (!org?.id) return;

    const q = query(
      collection(db, 'orgs', org.id, 'products'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ ...doc.data() as Product, id: doc.id }));
      setProducts(prods);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `orgs/${org.id}/products`);
    });

    return unsubscribe;
  }, [org?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id) return;

    try {
      if (editingProduct?.id) {
        await updateDoc(doc(db, 'orgs', org.id, 'products', editingProduct.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'orgs', org.id, 'products'), {
          ...formData,
          orgId: org.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'inventory');
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
    if (!org?.id || !confirm('Permanently delete this core asset?')) return;
    try {
      await deleteDoc(doc(db, 'orgs', org.id, 'products', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `inventory/${id}`);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Inventory Hub</h1>
          <p className="text-sm text-slate-400">Manage your product nodes and stock levels</p>
        </div>
        <Button onClick={() => setIsAdding(true)} className="gap-2">
          <Plus className="w-5 h-5" />
          Register Asset
        </Button>
      </div>

      <div className="flex gap-4 items-center bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-md">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input 
            className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
            placeholder="Search assets by name, sku, barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-8 px-6 border-l border-white/10">
          <MonospaceValue label="Total SKUs" value={products.length} />
          <MonospaceValue label="Global Stock" value={products.reduce((acc, p) => acc + p.stock, 0)} />
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
                      <label className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">Barcode</label>
                      <Input placeholder="EAN/UPC" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">Sale Price ({org?.currency})</label>
                    <Input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">Unit Cost ({org?.currency})</label>
                    <Input type="number" step="0.01" value={formData.cost} onChange={e => setFormData({...formData, cost: parseFloat(e.target.value)})} required />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">Initial Stock</label>
                    <Input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: parseInt(e.target.value)})} required />
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
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" onClick={() => startEdit(p)} className="p-2 h-9 w-9 rounded-lg">
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(p.id!)} className="p-2 h-9 w-9 rounded-lg">
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
                  ${p.price.toFixed(2)}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
