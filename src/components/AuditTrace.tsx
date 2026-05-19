import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType, AuditLog } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, where, Timestamp } from 'firebase/firestore';
import { Card, MonospaceValue, cn, formatCurrency, Button } from './UI';
import { 
  History, 
  Search, 
  Calendar, 
  ArrowLeft, 
  Eye, 
  FileText,
  Clock,
  User,
  CreditCard,
  Banknote,
  Receipt,
  Download,
  Package,
  Layers,
  Settings,
  AlertTriangle,
  Info,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export function AuditTrace() {
  const { org } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [dateFilter, setDateFilter] = useState<'today' | '7d' | '30d' | 'all'>('7d');

  useEffect(() => {
    if (!org?.id) return;

    let q = query(
      collection(db, 'orgs', org.id, 'audit'),
      orderBy('createdAt', 'desc')
    );

    if (dateFilter !== 'all') {
      const now = new Date();
      let startDate = new Date();
      if (dateFilter === 'today') startDate.setHours(0, 0, 0, 0);
      else if (dateFilter === '7d') startDate.setDate(now.getDate() - 7);
      else if (dateFilter === '30d') startDate.setDate(now.getDate() - 30);
      
      q = query(
        collection(db, 'orgs', org.id, 'audit'),
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ ...doc.data() as AuditLog, id: doc.id })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `orgs/${org.id}/audit`);
    });

    return unsubscribe;
  }, [org?.id, dateFilter]);

  const filteredLogs = logs.filter(l => 
    l.id?.toLowerCase().includes(search.toLowerCase()) ||
    l.targetName?.toLowerCase().includes(search.toLowerCase()) ||
    l.details?.toLowerCase().includes(search.toLowerCase()) ||
    l.userEmail?.toLowerCase().includes(search.toLowerCase())
  );

  const getActionIcon = (log: AuditLog) => {
    switch (log.targetType) {
      case 'sale': return <Receipt className="w-4 h-4" />;
      case 'product': return <Package className="w-4 h-4" />;
      case 'category': return <Layers className="w-4 h-4" />;
      case 'org': return <Settings className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'text-emerald-400';
      case 'update': return 'text-sky-400';
      case 'delete': return 'text-red-400';
      case 'reset': return 'text-rose-500';
      case 'sale': return 'text-accent';
      default: return 'text-slate-400';
    }
  };

    const exportToCSV = () => {
      const headers = ['Log ID', 'Timestamp', 'Operator', 'Action', 'Target Type', 'Target Name', 'Details'];
      const rows = filteredLogs.map(l => [
        l.id,
        l.createdAt?.toDate ? format(l.createdAt.toDate(), 'yyyy-MM-dd HH:mm:ss') : '',
        l.userEmail || l.userId,
        l.action,
        l.targetType,
        l.targetName,
        l.details
      ]);

      const content = [
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');

      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `audit_trace_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    return (
      <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Audit Trace</h1>
            <p className="text-xs lg:text-sm text-slate-400">Historical operation log and multi-node verification</p>
          </div>
        </div>
        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
          {(['today', '7d', '30d', 'all'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setDateFilter(filter)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                dateFilter === filter ? "bg-accent text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
            >
              {filter}
            </button>
          ))}
        </div>
        <Button 
          variant="outline" 
          onClick={exportToCSV}
          className="gap-2 h-10 px-6 font-bold uppercase tracking-widest text-[10px]"
          disabled={filteredLogs.length === 0}
        >
          <Download className="w-4 h-4" />
          Export Ledger
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Logs List */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input 
              className="w-full bg-slate-900 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-slate-200 focus:outline-none focus:border-accent transition-all"
              placeholder="Filter by action, target, or operator..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="glass-panel rounded-3xl overflow-hidden border border-white/10">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Temporal Log</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Operator</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Operation</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Target Asset</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredLogs.map((log) => (
                      <tr 
                        key={log.id}
                        className={cn(
                          "group hover:bg-white/5 transition-all cursor-pointer",
                          selectedLog?.id === log.id && "bg-accent/10"
                        )}
                        onClick={() => setSelectedLog(log)}
                      >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-200">
                            {log.createdAt?.toDate ? format(log.createdAt.toDate(), 'MMM dd, yyyy') : '---'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter">
                            {log.createdAt?.toDate ? format(log.createdAt.toDate(), 'HH:mm:ss') : '---'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[120px]">
                            {log.userEmail?.split('@')[0] || 'System'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={cn("flex items-center gap-2 font-black uppercase tracking-widest text-[9px]", getActionColor(log.action))}>
                          {log.action}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("p-1.5 rounded-lg bg-white/5 border border-white/10", getActionColor(log.action))}>
                             {getActionIcon(log)}
                          </div>
                          <span className="text-sm font-bold text-white tracking-tight">
                            {log.targetName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end">
                           <button className="p-2 rounded-lg bg-white/5 border border-white/10 group-hover:bg-accent group-hover:border-accent-border transition-all">
                              <Eye className="w-4 h-4 text-slate-400 group-hover:text-white" />
                            </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center">
                        <History className="w-12 h-12 text-slate-700 mx-auto mb-4 opacity-20" />
                        <span className="text-sm font-bold text-slate-500 uppercase tracking-widest opacity-40">No audit records found in current scope</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Details Panel */}
        <div className="lg:col-span-1 space-y-6">
          <AnimatePresence mode="wait">
            {selectedLog ? (
              <motion.div
                key={selectedLog.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <Card title="Activity Log Detail" className="sticky top-24 overflow-hidden">
                  <div className="space-y-6">
                    <div className="bg-slate-900 rounded-2xl p-4 border border-white/5 space-y-4">
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">
                          {selectedLog.createdAt?.toDate ? format(selectedLog.createdAt.toDate(), 'PPpp') : '---'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <User className="w-4 h-4 text-slate-500" />
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] truncate">
                           Operator: {selectedLog.userEmail || selectedLog.userId}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-accent/5 border border-accent-border/20">
                        <label className="text-[9px] font-black text-accent uppercase tracking-widest mb-2 block">Operation Manifest</label>
                        <p className="text-sm text-slate-200 font-medium leading-relaxed">
                          {selectedLog.details}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                          <label className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Log Identity</label>
                          <span className="text-[10px] font-mono text-slate-300">{selectedLog.id?.substring(0, 12).toUpperCase()}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                          <label className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Asset Type</label>
                          <span className="text-[10px] font-bold text-slate-300 uppercase">{selectedLog.targetType}</span>
                        </div>
                      </div>
                    </div>

                    {selectedLog.metadata && (
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Structural Metadata</label>
                        <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-2">
                          {Object.entries(selectedLog.metadata).map(([key, value]: [string, any]) => (
                            <div key={key} className="flex justify-between items-center text-[10px]">
                              <span className="text-slate-500 font-bold uppercase tracking-tight">{key}</span>
                              <span className="text-slate-200 font-mono">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-6 border-t border-white/10">
                       <Button 
                        onClick={exportToCSV}
                        className="w-full gap-2 py-4 shadow-xl shadow-accent/20 font-bold uppercase tracking-widest text-[10px]"
                      >
                        <Download className="w-4 h-4" />
                        Extract Operations Data
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ) : (
              <div className="h-64 glass-panel rounded-3xl flex flex-col items-center justify-center text-center p-8 border border-dashed border-white/10 opacity-50 sticky top-24">
                <FileText className="w-8 h-8 text-slate-600 mb-3" />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Sector Select Required</p>
                <p className="text-[8px] text-slate-600 mt-2 uppercase tracking-widest">Awaiting deep scan authorization</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
