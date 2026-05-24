import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType, Sale, Product, Category } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, where, Timestamp } from 'firebase/firestore';
import { Card, MonospaceValue, cn, formatCurrency } from './UI';
import { 
  BarChart3, 
  TrendingUp, 
  PieChart as PieChartIcon, 
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Filter
} from 'lucide-react';
import { 
  AreaChart,
  Area,
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

const COLORS = ['#10b981', '#06b6d4', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b'];

export function Analytics() {
  const { org } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    if (!org?.id) return;

    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const startDate = subDays(new Date(), days);

    const salesQ = query(
      collection(db, 'orgs', org.id, 'sales'),
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeSales = onSnapshot(salesQ, (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ ...doc.data() as Sale, id: doc.id })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `orgs/${org.id}/sales`);
    });

    const productsQ = query(collection(db, 'orgs', org.id, 'products'));
    const unsubscribeProducts = onSnapshot(productsQ, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ ...doc.data() as Product, id: doc.id })));
    });

    const categoriesQ = query(collection(db, 'orgs', org.id, 'categories'));
    const unsubscribeCategories = onSnapshot(categoriesQ, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ ...doc.data() as Category, id: doc.id })));
      setLoading(false);
    });

    return () => {
      unsubscribeSales();
      unsubscribeProducts();
      unsubscribeCategories();
    };
  }, [org?.id, timeRange]);

  const [performanceMetric, setPerformanceMetric] = useState<'total' | 'profit'>('total');

  const getDailyTrendData = () => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const dailyMap: Record<string, { date: string, total: number, profit: number }> = {};
    
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, 'yyyy-MM-dd');
      dailyMap[key] = {
        date: format(d, days <= 7 ? 'EEE' : 'MMM dd'),
        total: 0,
        profit: 0
      };
    }

    sales.forEach(sale => {
      if (sale.createdAt?.toDate) {
        const key = format(sale.createdAt.toDate(), 'yyyy-MM-dd');
        if (dailyMap[key]) {
          dailyMap[key].total += sale.total;
          const saleProfit = sale.items.reduce((pAcc, i) => pAcc + (i.price - (i.cost || 0)) * i.quantity, 0);
          dailyMap[key].profit += saleProfit;
        }
      }
    });

    return Object.values(dailyMap);
  };

  // Insights computations
  const getProductPerformance = () => {
    const perf: Record<string, { name: string, quantity: number, total: number, profit: number }> = {};
    sales.forEach(sale => {
      sale.items.forEach(item => {
        if (!perf[item.productId]) {
          perf[item.productId] = { name: item.name, quantity: 0, total: 0, profit: 0 };
        }
        perf[item.productId].quantity += item.quantity;
        perf[item.productId].total += item.total;
        perf[item.productId].profit += (item.price - (item.cost || 0)) * item.quantity;
      });
    });
    return Object.values(perf)
      .sort((a, b) => b[performanceMetric] - a[performanceMetric])
      .slice(0, 5);
  };

  const getCategoryDistribution = () => {
    const dist: Record<string, number> = {};
    sales.forEach(sale => {
      sale.items.forEach(item => {
        // Try to find category from products list
        const product = products.find(p => p.id === item.productId);
        const catName = product?.category || 'General';
        dist[catName] = (dist[catName] || 0) + item.total;
      });
    });
    return Object.entries(dist).map(([name, value]) => ({ name, value }));
  };

  const getTopProfitProduct = () => {
    const perf: Record<string, { name: string, quantity: number, total: number, profit: number }> = {};
    sales.forEach(sale => {
      sale.items.forEach(item => {
        if (!perf[item.productId]) {
          perf[item.productId] = { name: item.name, quantity: 0, total: 0, profit: 0 };
        }
        perf[item.productId].quantity += item.quantity;
        perf[item.productId].total += item.total;
        perf[item.productId].profit += (item.price - (item.cost || 0)) * item.quantity;
      });
    });
    const sorted = Object.values(perf).sort((a, b) => b.profit - a.profit);
    return sorted[0] || null;
  };

  const getPaymentMethodStats = () => {
    const stats: Record<string, number> = { cash: 0, card: 0 };
    sales.forEach(sale => {
      stats[sale.paymentMethod] = (stats[sale.paymentMethod] || 0) + 1;
    });
    return Object.entries(stats).map(([name, value]) => ({ name, value }));
  };

  if (loading) return null;

  const topProducts = getProductPerformance();
  const categoryDist = getCategoryDistribution();
  const paymentStats = getPaymentMethodStats();
  const dailyTrend = getDailyTrendData();
  const topProfitProduct = getTopProfitProduct();

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight text-glow">Strategic Analytics</h1>
          <p className="text-xs lg:text-sm text-slate-400 font-medium">Deep insights into revenue performance and asset circulation</p>
        </div>
        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 shrink-0">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                timeRange === range ? "bg-accent text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {topProfitProduct && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 lg:p-8 rounded-3xl bg-gradient-to-br from-accent/15 via-accent/5 to-transparent border border-accent/25 shadow-2xl relative overflow-hidden group cursor-default"
        >
          {/* Ambient background blur */}
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-accent/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none group-hover:bg-accent/10 transition-all duration-700" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                </span>
                <span className="text-[10px] font-black text-accent uppercase tracking-[0.2em]">Highest Profit Yield Champion ({timeRange})</span>
              </div>
              <h2 className="text-xl lg:text-3xl font-black text-white tracking-tight leading-tighter">
                {topProfitProduct.name}
              </h2>
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                This asset has outperformed all other inventory nodes based on transaction totals, generating unmatched net profit margins. It currently serves as your principal engine of business cash yield.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-6 lg:gap-10 border-t lg:border-t-0 lg:border-l border-white/5 pt-6 lg:pt-0 lg:pl-10">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Net Profit Contribution</span>
                <span className="text-xl lg:text-3xl font-black text-accent animate-pulse">
                  +{formatCurrency(topProfitProduct.profit, org?.currency)}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Volume Moving</span>
                <span className="text-xl lg:text-2xl font-black text-white font-mono">
                  {topProfitProduct.quantity} <span className="text-[10px] text-slate-400 lowercase font-medium">units</span>
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Distribution by Category */}
        <Card title="Category Revenue Distribution" className="lg:col-span-1 min-h-[400px] flex flex-col">
          <div className="relative h-[300px] w-full mt-6">
            <ResponsiveContainer width="100%" height="100%" minHeight={100}>
              <PieChart>
                <Pie
                  data={categoryDist}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ fontSize: 12, color: '#fff' }}
                  formatter={(value: number) => formatCurrency(value, org?.currency)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {categoryDist.slice(0, 4).map((item, index) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Assets Performance */}
        <Card 
          title={performanceMetric === 'total' ? "Top Asset Nodes (Total Gross)" : "Profit Leadership (Net Yield)"} 
          className="lg:col-span-2 min-h-[400px]"
          action={
            <div className="flex bg-white/5 border border-white/10 rounded-lg p-0.5 ml-4">
              <button 
                onClick={() => setPerformanceMetric('total')}
                className={cn("px-2 py-1 rounded text-[8px] font-bold uppercase tracking-widest transition-all", performanceMetric === 'total' ? "bg-accent text-white" : "text-slate-500 hover:text-slate-300")}
              >
                Gross
              </button>
              <button 
                onClick={() => setPerformanceMetric('profit')}
                className={cn("px-2 py-1 rounded text-[8px] font-bold uppercase tracking-widest transition-all", performanceMetric === 'profit' ? "bg-accent text-white" : "text-slate-500 hover:text-slate-300")}
              >
                Profit
              </button>
            </div>
          }
        >
          <div className="relative h-[320px] w-full mt-6">
            <ResponsiveContainer width="100%" height="100%" minHeight={100}>
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  width={150}
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  formatter={(value: number) => formatCurrency(value, org?.currency)}
                />
                <Bar 
                  dataKey={performanceMetric === 'total' ? "total" : "profit"} 
                  fill={performanceMetric === 'total' ? "var(--accent-color)" : "var(--accent-color-hover)"} 
                  radius={[0, 10, 10, 0]}
                  barSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Payment Logic Distribution */}
        <Card title="Payment Method Mix" className="lg:col-span-1 min-h-[350px]">
           <div className="relative h-[200px] w-full mt-6">
             <ResponsiveContainer width="100%" height="100%" minHeight={100}>
                <PieChart>
                  <Pie
                    data={paymentStats}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    dataKey="value"
                    labelLine={false}
                  >
                    <Cell fill="var(--accent-color)" />
                    <Cell fill="#06b6d4" />
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" />
                </PieChart>
             </ResponsiveContainer>
           </div>
           <div className="mt-8 space-y-4">
             {paymentStats.map((s, idx) => (
               <div key={s.name} className="flex justify-between items-center text-xs">
                 <span className="font-bold text-slate-500 uppercase tracking-widest">{s.name} processing</span>
                 <span className="font-bold text-white">{s.value} Transferred</span>
               </div>
             ))}
           </div>
        </Card>

        {/* Sales Volume Trends */}
        <Card title="Revenue Stream Velocity" className="lg:col-span-2 min-h-[350px]">
          <div className="flex flex-wrap items-center gap-6 mb-6">
             <MonospaceValue 
               label="Avg Daily Gross" 
               value={formatCurrency(sales.reduce((acc, s) => acc + s.total, 0) / (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90), org?.currency)} 
             />
             <MonospaceValue 
               label="Avg Daily Profit" 
               value={formatCurrency(sales.reduce((acc, s) => {
                 const saleProfit = s.items.reduce((pAcc, i) => pAcc + (i.price - (i.cost || 0)) * i.quantity, 0);
                 return acc + saleProfit;
               }, 0) / (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90), org?.currency)} 
               className="text-accent"
             />
             <MonospaceValue label="Total Throughput" value={sales.length} />
          </div>
          <div className="relative h-[250px] w-full mt-6">
            <ResponsiveContainer width="100%" height="100%" minHeight={100}>
              <AreaChart data={dailyTrend}>
                <defs>
                  <linearGradient id="colorDailyTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-color)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent-color)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDailyProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-color-hover)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent-color-hover)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }}
                  interval={timeRange === '90d' ? 6 : timeRange === '30d' ? 2 : 0}
                />
                <YAxis 
                  hide
                />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)' }}
                  itemStyle={{ fontSize: 10, fontWeight: 700 }}
                  formatter={(value: number) => formatCurrency(value, org?.currency)}
                />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="var(--accent-color)" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorDailyTotal)" 
                  name="Gross Revenue"
                />
                <Area 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="var(--accent-color-hover)" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorDailyProfit)" 
                  name="Net Profit"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Deep Analytics Report Section */}
      <section className="glass-panel p-8 rounded-[40px] border border-white/5 bg-gradient-to-br from-accent/10 to-transparent">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
           <div className="space-y-2">
             <h3 className="text-xl font-bold text-white">Full Intelligence Export</h3>
             <p className="text-sm text-slate-400 max-w-lg">Generate a serialized report package containing all granular transaction data, staff performance metrics, and inventory movement logs.</p>
           </div>
           <button className="px-8 py-4 bg-white text-slate-950 rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all shadow-2xl">
             Generate System Intelligence
           </button>
        </div>
      </section>
    </div>
  );
}
