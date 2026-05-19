import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType, Sale } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { Card, MonospaceValue, cn, formatCurrency } from './UI';
import { 
  TrendingUp, 
  Users, 
  Package, 
  DollarSign, 
  ArrowUpRight, 
  Clock,
  Activity,
  History,
  ShoppingCart,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export function Dashboard() {
  const navigate = useNavigate();
  const { org, profile, nukeEverything } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org?.id) return;

    // Last 7 days query
    const last7Days = subDays(new Date(), 7);
    const q = query(
      collection(db, 'orgs', org.id, 'sales'),
      where('createdAt', '>=', Timestamp.fromDate(last7Days)),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data() as Sale, id: doc.id }));
      setSales(data);
      setRecentSales(data.slice(0, 5));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `orgs/${org.id}/sales`);
    });

    return unsubscribe;
  }, [org?.id]);

  // Aggregate data for chart
  const getChartData = () => {
    const dailyMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'MMM dd');
      dailyMap[date] = 0;
    }

    sales.forEach(sale => {
      if (sale.createdAt && sale.createdAt.toDate) {
        const date = format(sale.createdAt.toDate(), 'MMM dd');
        if (dailyMap[date] !== undefined) {
          const amount = Number(sale.total);
          if (!isNaN(amount)) {
            dailyMap[date] += amount;
          }
        }
      }
    });

    return Object.entries(dailyMap).map(([name, total]) => ({ 
      name, 
      total: isNaN(total) ? 0 : total 
    }));
  };

  const stats = [
    { 
      label: 'Gross Volume (7d)', 
      value: sales.reduce((acc, s) => acc + s.total, 0), 
      icon: DollarSign, 
      trend: '+12.5%',
      color: 'indigo'
    },
    { 
      label: 'Unique Orders', 
      value: sales.length, 
      icon: TrendingUp, 
      trend: '+8.2%',
      color: 'teal'
    },
    { 
      label: 'Avg Ticket Size', 
      value: sales.length ? (sales.reduce((acc, s) => acc + s.total, 0) / sales.length) : 0, 
      icon: Activity, 
      trend: '+4.1%',
      color: 'indigo'
    },
    { 
      label: 'Active Nodes', 
      value: '8/10', 
      icon: Users, 
      trend: 'STABLE',
      color: 'slate'
    },
  ];

  const chartData = getChartData();

  return (
    <div className="space-y-8 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="relative overflow-hidden group hover:bg-white/10 transition-all cursor-default">
            <div className="flex justify-between items-start mb-6">
              <div className={cn(
                "p-3 rounded-xl border",
                stat.color === 'indigo' ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-400" :
                stat.color === 'teal' ? "bg-teal-500/20 border-teal-500/30 text-teal-400" :
                "bg-slate-800/50 border-slate-700/50 text-slate-400"
              )}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className={cn(
                "text-[10px] font-bold px-2 py-1 rounded-full",
                stat.trend.startsWith('+') ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"
              )}>
                {stat.trend}
              </span>
            </div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tracking-tight">
                {typeof stat.value === 'number' && (stat.label.includes('Volume') || stat.label.includes('Avg')) ? formatCurrency(stat.value, org?.currency) : 
                 stat.value}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions / Role Shortcuts */}
      <section className="bg-indigo-600/5 border border-indigo-500/10 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/10 border border-indigo-500/30">
            <ShoppingCart className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Active Terminal Ready</h2>
            <p className="text-xs text-slate-500 font-medium">Switch to the cashier interface for live sales processing.</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/pos')}
          className="w-full md:w-auto px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3"
        >
          Enter POS Mode
          <ArrowUpRight className="w-5 h-5" />
        </button>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Sales Chart */}
        <Card title="Transactional Momentum" className="xl:col-span-2 min-h-[450px]">
          <div className="h-[360px] w-full mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} 
                />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)' }}
                  itemStyle={{ fontSize: 12, color: '#818cf8', fontWeight: 600 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#6366f1" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorTotal)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Recent Operations */}
        <Card title="System Feed" className="flex flex-col">
          <div className="flex-1 space-y-4 pt-6">
            {recentSales.map((sale) => (
              <div key={sale.id} className="flex items-center gap-4 group p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center shrink-0 border border-indigo-500/20">
                  <ArrowUpRight className="w-5 h-5 text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-white truncate">
                      {sale.items.length} Items Distributed
                    </span>
                    <span className="text-sm font-bold text-indigo-400">
                      +{formatCurrency(sale.total, org?.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {sale.paymentMethod} • {sale.createdAt?.toDate ? format(sale.createdAt.toDate(), 'HH:mm') : 'NOW'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-600">
                      #{sale.id?.substring(0, 8).toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {recentSales.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center py-20 text-slate-600">
                <History className="w-12 h-12 mb-4 opacity-10" />
                <span className="text-xs font-bold uppercase tracking-widest opacity-40">Awaiting Signal</span>
              </div>
            )}
          </div>
          <div className="mt-8">
            <button className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all">
              Request Full Audit Trace
            </button>
          </div>
        </Card>
      </div>

      {/* Danger Zone */}
      <section className="mt-12 p-8 border border-red-500/20 rounded-3xl bg-red-500/5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/10 border border-red-500/30">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Danger Zone</h2>
              <p className="text-xs text-slate-500 font-medium">
                {profile?.role === 'owner' 
                  ? 'Deleting your organization will permanently erase all data, inventory, and staff records.' 
                  : 'Leaving will revoke your access to this organization immediately.'}
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              if (confirm(`Are you sure you want to ${profile?.role === 'owner' ? 'DELETE entire organization' : 'LEAVE organization'}? This cannot be undone.`)) {
                nukeEverything();
              }
            }}
            className="w-full md:w-auto px-10 py-5 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3"
          >
            <Trash2 className="w-5 h-5" />
            {profile?.role === 'owner' ? 'Delete Organization' : 'Leave Organization'}
          </button>
        </div>
      </section>
    </div>
  );
}
