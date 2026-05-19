import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType, Category, Product } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { Button, Card, Input, MonospaceValue, cn } from './UI';
import { Plus, Search, Layers, Edit2, Trash2, X, Check, Loader2, Package, ChevronUp, ChevronDown, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function CategoryManagement() {
  const { org, profile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!org?.id) return;

    const q = query(
      collection(db, 'orgs', org.id, 'categories'),
      orderBy('name', 'asc')
    );

    const unsubscribeCats = onSnapshot(q, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ ...doc.data() as Category, id: doc.id })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `orgs/${org.id}/categories`);
    });

    const productsQ = query(
      collection(db, 'orgs', org.id, 'products'),
      orderBy('name', 'asc')
    );

    const unsubscribeProducts = onSnapshot(productsQ, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ ...doc.data() as Product, id: doc.id })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `orgs/${org.id}/products`);
    });

    return () => {
      unsubscribeCats();
      unsubscribeProducts();
    };
  }, [org?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id) return;

    try {
      if (editingCategory?.id) {
        await updateDoc(doc(db, 'orgs', org.id, 'categories', editingCategory.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'orgs', org.id, 'categories'), {
          ...formData,
          orgId: org.id,
          createdAt: serverTimestamp()
        });
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `orgs/${org.id}/categories`);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '' });
    setEditingCategory(null);
    setIsEditing(false);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({ name: category.name, description: category.description || '' });
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!org?.id || !window.confirm('Are you sure you want to delete this category? Items using this category will remain, but the category itself will be removed from the registry.')) return;
    try {
      await deleteDoc(doc(db, 'orgs', org.id, 'categories', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `orgs/${org.id}/categories/${id}`);
    }
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleExpand = (id: string) => {
    const next = new Set(expandedCats);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedCats(next);
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 lg:gap-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Category Registry</h1>
          <p className="text-xs lg:text-sm text-slate-400 uppercase tracking-tighter sm:normal-case sm:tracking-normal">Classify and organize your asset infrastructure</p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)} className="w-full sm:w-auto gap-2 h-12 px-6">
            <Plus className="w-5 h-5" />
            New Category
          </Button>
        )}
      </div>

      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card title={editingCategory ? "Modify Categorization" : "New Categorization"} className="border-indigo-500/20 bg-indigo-500/5">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">Category Name</label>
                    <Input 
                      placeholder="e.g. Beverages, Stationery" 
                      value={formData.name} 
                      onChange={e => setFormData({...formData, name: e.target.value})} 
                      required 
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">Description (Optional)</label>
                    <Input 
                      placeholder="Protocol description..." 
                      value={formData.description} 
                      onChange={e => setFormData({...formData, description: e.target.value})} 
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-white/5">
                  <Button variant="ghost" type="button" onClick={resetForm} className="w-full sm:w-auto order-2 sm:order-1">Cancel</Button>
                  <Button type="submit" className="w-full sm:w-auto gap-2 order-1 sm:order-2">
                    {editingCategory ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingCategory ? 'Commit Correction' : 'Initialize Category'}
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
        <div className="lg:col-span-1 space-y-6">
            <Card title="Query Filters" className="lg:sticky lg:top-24">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input 
                  placeholder="Search categories..." 
                  className="pl-10" 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              
              <div className="pt-4 border-t border-white/5">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
                  <span>Registry Stats</span>
                  <Layers className="w-3 h-3" />
                </div>
                <div className="space-y-4">
                  <MonospaceValue label="Total Clusters" value={categories.length} />
                  <MonospaceValue label="Mapped Assets" value={products.length} />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin opacity-20" />
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="h-64 glass-panel rounded-[32px] flex flex-col items-center justify-center text-center p-8 lg:p-12 border-dashed border-white/10">
              <Layers className="w-12 h-12 text-slate-500 mb-4 opacity-20" />
              <h3 className="text-lg lg:text-xl font-bold text-slate-400 uppercase tracking-widest mb-2">No Categories Identified</h3>
              <p className="text-[10px] sm:text-xs text-slate-500 max-w-xs uppercase font-bold tracking-tighter opacity-50">Initialize a new categorization cluster to begin organization.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredCategories.map((category) => {
                const categoryProducts = products.filter(p => p.category === category.name);
                const isExpanded = category.id && expandedCats.has(category.id);

                return (
                  <motion.div
                    layout
                    key={category.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card rounded-2xl overflow-hidden group hover:border-white/20 transition-all"
                  >
                    <div className="p-4 lg:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 lg:gap-6">
                      <div 
                        className="flex items-center gap-4 lg:gap-6 cursor-pointer flex-1"
                        onClick={() => category.id && toggleExpand(category.id)}
                      >
                        <div className="w-10 h-10 lg:w-12 lg:h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 transition-all shrink-0">
                          <Layers className="w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition-all" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg lg:text-xl font-bold text-white tracking-tight truncate">{category.name}</h3>
                            <span className="px-2 py-0.5 bg-slate-800 text-[9px] font-bold text-slate-400 rounded-md border border-white/5">
                              {categoryProducts.length} Assets
                            </span>
                          </div>
                          <p className="text-[10px] lg:text-xs text-slate-500 mt-0.5 line-clamp-1">{category.description || 'No description provided.'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:ml-auto md:ml-0">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleEdit(category)}
                          className="lg:opacity-0 lg:group-hover:opacity-100 transition-all h-10 w-10 sm:h-auto sm:w-auto"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => category.id && toggleExpand(category.id)}
                          className="text-slate-400 hover:text-white"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => category.id && handleDelete(category.id)}
                          className="text-red-400/50 hover:text-red-400 lg:opacity-0 lg:group-hover:opacity-100 transition-all h-10 w-10 sm:h-auto sm:w-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-white/5 bg-black/20"
                        >
                          <div className="p-6">
                            {categoryProducts.length === 0 ? (
                              <div className="flex flex-col items-center py-8 opacity-30">
                                <Package className="w-8 h-8 mb-2" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">No mapped assets</span>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {categoryProducts.map(p => (
                                  <div key={p.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center border border-white/5">
                                        <Tag className="w-3.5 h-3.5 text-indigo-400" />
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-200">{p.name}</span>
                                        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">{p.sku}</span>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-[10px] font-bold text-indigo-300">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: org?.currency || 'USD' }).format(p.price)}
                                      </div>
                                      <div className={cn(
                                        "text-[9px] font-bold uppercase tracking-tighter",
                                        p.stock <= p.minStock ? "text-amber-500" : "text-slate-500"
                                      )}>
                                        Stock: {p.stock}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )
}
        </div>
      </div>
    </div>
  );
}
