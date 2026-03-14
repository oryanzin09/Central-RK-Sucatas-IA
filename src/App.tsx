/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useContext, createContext, useRef } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  TrendingUp, 
  Users, 
  DollarSign, 
  ShoppingCart,
  Menu,
  X,
  Search,
  Bell,
  ChevronRight,
  Loader2,
  AlertCircle,
  Plus,
  Minus,
  Save,
  Wrench,
  ChevronLeft,
  Sun,
  Moon,
  Trash2,
  Layers,
  Check,
  Bike,
  Edit,
  Settings,
  History,
  Calendar,
  Filter,
  RefreshCw,
  ExternalLink,
  Edit2,
  LayoutGrid,
  Table as TableIcon,
  MessageSquare,
  Upload
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FloatingAIChat } from './components/FloatingAIChat';
import { Atendimento } from './pages/Atendimento';
import { MercadoLivre } from './pages/MercadoLivre';
import { io } from 'socket.io-client';

// Utility for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Global Data Context
export const DataContext = createContext<{
  inventory: any[];
  sales: any[];
  motos: any[];
  loading: boolean;
  whatsappStatus: { connected: boolean, isConnecting: boolean, reconnectAttempts: number };
  whatsappConversations: any[];
  whatsappQr: string | null;
  setInventory: React.Dispatch<React.SetStateAction<any[]>>;
  setSales: React.Dispatch<React.SetStateAction<any[]>>;
  setMotos: React.Dispatch<React.SetStateAction<any[]>>;
  refreshData: () => Promise<void>;
}>({
  inventory: [],
  sales: [],
  motos: [],
  loading: false,
  whatsappStatus: { connected: false, isConnecting: false, reconnectAttempts: 0 },
  whatsappConversations: [],
  whatsappQr: null,
  setInventory: () => {},
  setSales: () => {},
  setMotos: () => {},
  refreshData: async () => {}
});

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [inventory, setInventory] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [motos, setMotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(0);
  const [whatsappStatus, setWhatsappStatus] = useState({ connected: false, isConnecting: false, reconnectAttempts: 0 });
  const [whatsappConversations, setWhatsappConversations] = useState<any[]>([]);
  const [whatsappQr, setWhatsappQr] = useState<string | null>(null);
  const CACHE_TIME = 5 * 60 * 1000; // 5 minutos

  const loadData = async (force = false) => {
    const now = Date.now();
    if (!force && (now - lastFetch) < CACHE_TIME && inventory.length > 0) {
      return; // Usa cache
    }

    setLoading(true);
    try {
      const [invRes, salesRes, motosRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/sales'),
        fetch('/api/motos')
      ]);
      
      const invData = await invRes.json();
      const salesData = await salesRes.json();
      const motosData = await motosRes.json();
      
      if (invData.success) setInventory(invData.data);
      if (salesData.success) setSales(salesData.data);
      if (motosData.success) setMotos(motosData.data);
      setLastFetch(now);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Socket global para WhatsApp e Notificações
    const socket = io();
    
    socket.on('whatsapp-status', (status) => {
      setWhatsappStatus(status);
      if (status.connected) setWhatsappQr(null);
    });

    socket.on('whatsapp-qr', (qr) => {
      setWhatsappQr(qr);
      setWhatsappStatus(prev => ({ ...prev, connected: false, isConnecting: true }));
    });

    socket.on('whatsapp-conversations', (conversations) => {
      const sorted = [...conversations].sort((a, b) => 
        new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()
      );
      setWhatsappConversations(sorted);
    });

    socket.on('whatsapp-message-updated', (updatedMsg) => {
      setWhatsappConversations(prev => prev.map(conv => {
        if (conv.number === updatedMsg.number) {
          return {
            ...conv,
            messages: conv.messages.map((m: any) => m.id === updatedMsg.id ? updatedMsg : m)
          };
        }
        return conv;
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <DataContext.Provider value={{ 
      inventory, 
      sales, 
      motos,
      loading, 
      whatsappStatus,
      whatsappConversations,
      whatsappQr,
      setInventory, 
      setSales, 
      setMotos,
      refreshData: () => loadData(true) 
    }}>
      {children}
    </DataContext.Provider>
  );
}

// Mock Data for Dashboard
const salesData = [
  { name: 'Jan', sales: 4000, profit: 2400 },
  { name: 'Feb', sales: 3000, profit: 1398 },
  { name: 'Mar', sales: 2000, profit: 9800 },
  { name: 'Apr', sales: 2780, profit: 3908 },
  { name: 'May', sales: 1890, profit: 4800 },
  { name: 'Jun', sales: 2390, profit: 3800 },
];

const categoryData = [
  { name: 'Eletrônicos', value: 400 },
  { name: 'Roupas', value: 300 },
  { name: 'Casa', value: 300 },
  { name: 'Outros', value: 200 },
];

const COLORS = ['#8b5cf6', '#34d399', '#fb7185', '#f59e0b', '#3b82f6'];

// Components
const SidebarItem = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick,
  theme,
  badge
}: { 
  icon: any, 
  label: string, 
  active: boolean, 
  onClick: () => void,
  theme: 'light' | 'dark',
  badge?: number
}) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden",
      active 
        ? "bg-violet-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] ring-1 ring-violet-400/30" 
        : theme === 'dark' 
          ? "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-100"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
    )}
  >
    {active && (
      <div className="absolute inset-0 bg-gradient-to-r from-violet-400/10 to-transparent pointer-events-none" />
    )}
    <Icon size={20} className={cn(active ? "text-white" : "group-hover:text-violet-400 transition-colors")} />
    {label && <span className="font-bold tracking-tight whitespace-nowrap">{label}</span>}
    {badge !== undefined && (
      <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-lg shadow-rose-500/20">
        {badge}
      </span>
    )}
    {active && label && (
      <motion.div 
        layoutId="active-pill"
        className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#fff]"
      />
    )}
  </button>
);

const SkeletonRow = ({ theme }: { theme: 'light' | 'dark', key?: any }) => (
  <tr className="animate-pulse">
    <td className="px-6 py-4"><div className={cn("h-4 rounded w-16", theme === 'dark' ? "bg-zinc-800" : "bg-zinc-200")}></div></td>
    <td className="px-6 py-4"><div className={cn("h-4 rounded w-48", theme === 'dark' ? "bg-zinc-800" : "bg-zinc-200")}></div></td>
    <td className="px-6 py-4"><div className={cn("h-4 rounded w-32", theme === 'dark' ? "bg-zinc-800" : "bg-zinc-200")}></div></td>
    <td className="px-6 py-4"><div className={cn("h-4 rounded w-24", theme === 'dark' ? "bg-zinc-800" : "bg-zinc-200")}></div></td>
    <td className="px-6 py-4"><div className={cn("h-4 rounded w-20", theme === 'dark' ? "bg-zinc-800" : "bg-zinc-200")}></div></td>
  </tr>
);

const StatCard = ({ icon: Icon, label, value, trend, subValue, color, theme }: any) => (
  <div className={cn(
    "border rounded-2xl p-6 transition-all duration-300 relative overflow-hidden group",
    theme === 'dark' 
      ? "bg-zinc-900/40 border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-violet-500/50 hover:shadow-[0_8px_30px_rgb(139,92,246,0.15)] hover:scale-[1.02]" 
      : "bg-white border-zinc-200 hover:border-violet-500/30 shadow-sm hover:scale-[1.02]"
  )}>
    {theme === 'dark' && (
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/5 via-transparent to-transparent pointer-events-none" />
    )}
    <div className="flex items-start justify-between relative z-10">
      <div className={cn("p-3 rounded-xl bg-opacity-10 shadow-inner", color)}>
        <Icon size={24} className={color.replace('bg-', 'text-')} />
      </div>
      {trend !== undefined && (
        <span className={cn("text-xs font-bold px-2 py-1 rounded-full shadow-sm", 
          trend > 0 
            ? "bg-emerald-500/10 text-emerald-400 shadow-emerald-500/10" 
            : "bg-rose-500/10 text-rose-400 shadow-rose-500/10"
        )}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <div className="mt-4 relative z-10">
      <p className="text-zinc-500 text-xs uppercase font-medium tracking-wider">{label}</p>
      <h3 className={cn(
        "text-2xl font-bold mt-1 tracking-tight", 
        theme === 'dark' ? "text-white" : "text-zinc-900",
        trend !== undefined && trend > 0 && theme === 'dark' && "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]",
        trend !== undefined && trend < 0 && theme === 'dark' && "text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.3)]"
      )}>
        {value}
      </h3>
      {subValue && <p className="text-xs text-zinc-500 mt-1 font-medium">{subValue}</p>}
    </div>
  </div>
);

const DashboardView = ({ theme, onSelectItem }: { theme: 'light' | 'dark', onSelectItem: (item: any) => void }) => {
  const { inventory, sales, loading, refreshData } = useContext(DataContext);
  const [selectedPaymentType, setSelectedPaymentType] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const metrics = useMemo(() => {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    // Estoque
    const valorTotalEstoque = inventory.reduce((sum, item) => sum + (item.valor * item.estoque), 0);
    const totalItensEstoque = inventory.reduce((sum, item) => sum + item.estoque, 0);
    const estoqueBaixo = inventory.filter(item => item.estoque <= 2);
    const ultimosItens = [...inventory].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()).slice(0, 5);

    // Vendas
    const vendasMes = sales.filter(item => {
      let itemDate = new Date(item.data);
      if (typeof item.data === 'string' && item.data.length === 10 && item.data.includes('-')) {
        const [y, m, d] = item.data.split('-').map(Number);
        itemDate = new Date(y, m - 1, d);
      }
      return itemDate.getMonth() === mesAtual && 
             itemDate.getFullYear() === anoAtual &&
             item.tipo !== 'SAÍDA';
    });

    const saidasMes = sales.filter(item => {
      let itemDate = new Date(item.data);
      if (typeof item.data === 'string' && item.data.length === 10 && item.data.includes('-')) {
        const [y, m, d] = item.data.split('-').map(Number);
        itemDate = new Date(y, m - 1, d);
      }
      return itemDate.getMonth() === mesAtual && 
             itemDate.getFullYear() === anoAtual &&
             item.tipo === 'SAÍDA';
    });

    const valorVendasMes = vendasMes.reduce((sum, v) => sum + v.valor, 0);
    const valorSaidasMes = saidasMes.reduce((sum, v) => sum + v.valor, 0);
    const ticketMedio = vendasMes.length > 0 ? valorVendasMes / vendasMes.length : 0;

    return {
      valorTotalEstoque,
      totalItensEstoque,
      estoqueBaixo,
      ultimosItens,
      valorVendasMes,
      totalVendasMes: vendasMes.length,
      valorSaidasMes,
      totalSaidasMes: saidasMes.length,
      ticketMedio
    };
  }, [inventory, sales]);

  // Gráfico Vendas por Dia (últimos 30 dias)
  const chartData = useMemo(() => {
    const days = [];
    const hoje = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(hoje);
      d.setDate(hoje.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({
        date: dateStr,
        label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        vendas: 0,
        saidas: 0
      });
    }

    sales.forEach(sale => {
      let saleDateObj = new Date(sale.data);
      if (typeof sale.data === 'string' && sale.data.length === 10 && sale.data.includes('-')) {
        const [y, m, d] = sale.data.split('-').map(Number);
        saleDateObj = new Date(y, m - 1, d);
      }
      const saleDate = `${saleDateObj.getFullYear()}-${String(saleDateObj.getMonth() + 1).padStart(2, '0')}-${String(saleDateObj.getDate()).padStart(2, '0')}`;
      const day = days.find(d => d.date === saleDate);
      if (day) {
        if (sale.tipo === 'SAÍDA') {
          day.saidas += sale.valor;
        } else {
          day.vendas += sale.valor;
        }
      }
    });

    return days;
  }, [sales]);

  // Gráfico Vendas por Tipo (Valor)
  const pieData = useMemo(() => {
    const types: Record<string, number> = {};
    sales.filter(s => s.tipo !== 'SAÍDA').forEach(sale => {
      types[sale.tipo] = (types[sale.tipo] || 0) + sale.valor;
    });
    return Object.entries(types).map(([name, value]) => ({ name, value }));
  }, [sales]);

  const latestSales = useMemo(() => {
    return [...sales].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, 5);
  }, [sales]);

  const filteredSalesByType = useMemo(() => {
    if (!selectedPaymentType) return [];
    return sales.filter(s => s.tipo === selectedPaymentType)
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [sales, selectedPaymentType]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-400 gap-4">
        <Loader2 className="animate-spin text-violet-500" size={40} />
        <p className="animate-pulse">Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={cn("text-xl font-bold", theme === 'dark' ? "text-white" : "text-zinc-900")}>Dashboard</h2>
        <button 
          onClick={refreshData}
          disabled={loading}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border",
            theme === 'dark' 
              ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800" 
              : "bg-white border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
          )}
        >
          <RefreshCw size={16} className={cn(loading && "animate-spin")} />
          {loading ? "Atualizando..." : "Atualizar Dados"}
        </button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={Package} 
          label="Valor do Estoque" 
          value={formatCurrency(metrics.valorTotalEstoque)} 
          subValue={`${metrics.totalItensEstoque} itens em estoque`}
          color="bg-blue-500" 
          theme={theme} 
        />
        <StatCard 
          icon={TrendingUp} 
          label="Vendas (Mês)" 
          value={formatCurrency(metrics.valorVendasMes)} 
          subValue={`${metrics.totalVendasMes} vendas no mês`}
          color="bg-emerald-500" 
          theme={theme} 
        />
        <StatCard 
          icon={DollarSign} 
          label="Saídas (Mês)" 
          value={formatCurrency(metrics.valorSaidasMes)} 
          subValue="despesas"
          color="bg-rose-500" 
          theme={theme} 
        />
        <StatCard 
          icon={ShoppingCart} 
          label="Ticket Médio" 
          value={formatCurrency(metrics.ticketMedio)} 
          subValue="por venda"
          color="bg-amber-500" 
          theme={theme} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico Vendas por Dia */}
        <div className={cn(
          "lg:col-span-2 border p-6 rounded-2xl transition-all duration-300",
          theme === 'dark' 
            ? "bg-zinc-900/40 border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-violet-500/30" 
            : "bg-white border-zinc-200 shadow-sm"
        )}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={cn("text-lg font-bold tracking-tight", theme === 'dark' ? "text-white" : "text-zinc-900")}>
              Vendas por Dia (30 dias)
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Vendas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Saídas</span>
              </div>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? "#27272a" : "#e5e7eb"} vertical={false} />
                <XAxis 
                  dataKey="label" 
                  stroke="#71717a" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fontWeight: 600 }}
                />
                <YAxis 
                  stroke="#71717a" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => formatCurrency(value)}
                  tick={{ fontWeight: 600 }}
                />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), ""]}
                  contentStyle={{ 
                    backgroundColor: theme === 'dark' ? '#18181b' : '#fff', 
                    border: `1px solid ${theme === 'dark' ? '#27272a' : '#e5e7eb'}`, 
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="vendas" name="Vendas" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorVendas)" />
                <Area type="monotone" dataKey="saidas" name="Saídas" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorSaidas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico Vendas por Tipo */}
        <div className={cn(
          "border p-6 rounded-2xl transition-all duration-300",
          theme === 'dark' 
            ? "bg-zinc-900/40 border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-violet-500/30" 
            : "bg-white border-zinc-200 shadow-sm"
        )}>
          <h3 className={cn("text-lg font-bold tracking-tight mb-6", theme === 'dark' ? "text-white" : "text-zinc-900")}>
            Vendas por Tipo
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                  onClick={(data) => setSelectedPaymentType(data.name)}
                  style={{ cursor: 'pointer' }}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: theme === 'dark' ? '#18181b' : '#fff', 
                    border: `1px solid ${theme === 'dark' ? '#27272a' : '#e5e7eb'}`, 
                    borderRadius: '12px' 
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-2 mt-6 justify-center">
            {pieData.map((item, i) => (
              <button 
                key={item.name} 
                onClick={() => setSelectedPaymentType(item.name)}
                className="flex items-center gap-2 bg-zinc-800/30 px-3 py-2 rounded-xl border border-zinc-700/30 hover:bg-zinc-800/60 transition-all cursor-pointer group relative"
              >
                <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.3)] group-hover:scale-110 transition-transform" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider group-hover:text-zinc-300 transition-colors">{item.name}</span>
                
                {/* Tooltip de valor no hover */}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-[10px] font-black text-emerald-400 opacity-0 group-hover:opacity-100 group-hover:-top-11 pointer-events-none transition-all duration-200 shadow-2xl whitespace-nowrap z-20">
                  {formatCurrency(item.value)}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 border-b border-r border-zinc-700 rotate-45" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimas Vendas */}
        <div className={cn(
          "border rounded-2xl overflow-hidden transition-all duration-300",
          theme === 'dark' 
            ? "bg-zinc-900/40 border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)]" 
            : "bg-white border-zinc-200 shadow-sm"
        )}>
          <div className={cn(
            "p-4 border-b flex items-center justify-between",
            theme === 'dark' ? "border-zinc-800/50" : "border-zinc-100"
          )}>
            <h3 className={cn("font-bold tracking-tight", theme === 'dark' ? "text-white" : "text-zinc-900")}>Últimas Vendas</h3>
            <History size={16} className="text-zinc-500" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={cn(
                  "text-[10px] uppercase font-bold tracking-wider",
                  theme === 'dark' ? "bg-zinc-800/30 text-zinc-500" : "bg-zinc-50 text-zinc-500"
                )}>
                  <th className="px-4 py-3">Peça</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Data</th>
                </tr>
              </thead>
              <tbody className={cn("divide-y", theme === 'dark' ? "divide-zinc-800/30" : "divide-zinc-100")}>
                {latestSales.map((sale) => (
                  <tr 
                    key={sale.id} 
                    onClick={() => onSelectItem(sale)}
                    className={cn(
                      "transition-colors group cursor-pointer",
                      theme === 'dark' ? "hover:bg-zinc-800/20" : "hover:bg-zinc-50"
                    )}
                  >
                    <td className={cn("px-4 py-3 font-bold", theme === 'dark' ? "text-zinc-200" : "text-zinc-900")}>
                      {sale.nome}
                    </td>
                    <td className="px-4 py-3 text-emerald-400 font-bold drop-shadow-[0_0_8px_rgba(52,211,153,0.2)]">
                      {formatCurrency(sale.valor)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider",
                        theme === 'dark' 
                          ? "bg-zinc-800/50 text-zinc-400 border border-zinc-700/50" 
                          : "bg-zinc-100 text-zinc-600"
                      )}>
                        {sale.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs font-medium">
                      {new Date(sale.data).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Últimos Itens Adicionados */}
        <div className={cn(
          "border rounded-2xl overflow-hidden transition-all duration-300",
          theme === 'dark' 
            ? "bg-zinc-900/40 border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)]" 
            : "bg-white border-zinc-200 shadow-sm"
        )}>
          <div className={cn(
            "p-4 border-b flex items-center justify-between",
            theme === 'dark' ? "border-zinc-800/50" : "border-zinc-100"
          )}>
            <h3 className={cn("font-bold tracking-tight", theme === 'dark' ? "text-white" : "text-zinc-900")}>Últimos itens adicionados</h3>
            <Package size={16} className="text-violet-500" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={cn(
                  "text-[10px] uppercase font-bold tracking-wider",
                  theme === 'dark' ? "bg-zinc-800/30 text-zinc-500" : "bg-zinc-50 text-zinc-500"
                )}>
                  <th className="px-4 py-3">Peça</th>
                  <th className="px-4 py-3 text-center">Qtd</th>
                  <th className="px-4 py-3">Moto</th>
                  <th className="px-4 py-3">Valor</th>
                </tr>
              </thead>
              <tbody className={cn("divide-y", theme === 'dark' ? "divide-zinc-800/30" : "divide-zinc-100")}>
                {metrics.ultimosItens.map((item) => (
                  <tr 
                    key={item.id} 
                    onClick={() => onSelectItem(item)}
                    className={cn(
                      "transition-colors group cursor-pointer",
                      theme === 'dark' ? "hover:bg-zinc-800/20" : "hover:bg-zinc-50"
                    )}
                  >
                    <td className={cn("px-4 py-3 font-bold", theme === 'dark' ? "text-zinc-200" : "text-zinc-900")}>
                      {item.nome}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider",
                        theme === 'dark' ? "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30" : "bg-violet-100 text-violet-600"
                      )}>
                        {item.estoque}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs font-medium">{item.moto}</td>
                    <td className={cn("px-4 py-3 font-medium", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
                      {formatCurrency(item.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de Transações por Tipo */}
      <AnimatePresence>
        {selectedPaymentType && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                "w-full max-w-4xl max-h-[80vh] overflow-hidden rounded-3xl border shadow-2xl flex flex-col",
                theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
              )}
            >
              <div className="p-6 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/50">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white flex items-center gap-3">
                    <History className="text-violet-500" />
                    Transações: {selectedPaymentType}
                  </h3>
                  <p className="text-zinc-500 text-sm mt-1">
                    Total de {filteredSalesByType.length} registros encontrados
                  </p>
                </div>
                
                <div className="flex flex-col items-end mr-4 md:mr-8">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Soma Total</span>
                  <div className="text-lg md:text-2xl font-black text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.4)]">
                    {formatCurrency(filteredSalesByType.reduce((sum, s) => sum + s.valor, 0))}
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedPaymentType(null)}
                  className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-0">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className={cn(
                      "text-[10px] uppercase font-bold tracking-wider",
                      theme === 'dark' ? "bg-zinc-800 text-zinc-500" : "bg-zinc-50 text-zinc-500"
                    )}>
                      <th className="px-6 py-4 border-b border-zinc-800/50">Item / Descrição</th>
                      <th className="px-6 py-4 border-b border-zinc-800/50">Valor</th>
                      <th className="px-6 py-4 border-b border-zinc-800/50">Data</th>
                      <th className="px-6 py-4 border-b border-zinc-800/50">RK ID</th>
                    </tr>
                  </thead>
                  <tbody className={cn("divide-y", theme === 'dark' ? "divide-zinc-800/30" : "divide-zinc-100")}>
                    {filteredSalesByType.length > 0 ? (
                      filteredSalesByType.map((sale) => (
                        <tr 
                          key={sale.id} 
                          className={cn(
                            "transition-colors",
                            theme === 'dark' ? "hover:bg-zinc-800/20" : "hover:bg-zinc-50"
                          )}
                        >
                          <td className="px-6 py-4">
                            <div className="font-bold text-white">{sale.nome}</div>
                            {sale.descricao && <div className="text-xs text-zinc-500 mt-1 line-clamp-1">{sale.descricao}</div>}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-emerald-400 font-bold">
                              {formatCurrency(sale.valor)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-zinc-400 text-xs">
                            {new Date(sale.data).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-zinc-500 font-mono text-xs">{sale.rk_id || '-'}</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                          Nenhuma transação encontrada para este tipo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="p-4 border-t border-zinc-800/50 bg-zinc-900/30 flex justify-end">
                <button 
                  onClick={() => setSelectedPaymentType(null)}
                  className="px-6 py-2 rounded-xl bg-zinc-800 text-white font-bold hover:bg-zinc-700 transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const InventoryView = ({ theme, onSelectItem }: { theme: 'light' | 'dark', onSelectItem: (item: any) => void }) => {
  const { inventory: items, loading, setInventory, refreshData } = useContext(DataContext);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [selectedMoto, setSelectedMoto] = useState('Todas');
  const [onlyWithStock, setOnlyWithStock] = useState(false);
  const [showWithPhotoFirst, setShowWithPhotoFirst] = useState(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Sort states
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({
    key: 'criado_em',
    direction: 'desc'
  });

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    categoria: '',
    novaCategoria: '',
    moto: '',
    outraMoto: '',
    valor: '',
    estoque: '1',
    ano: '',
    descricao: '',
    ml_link: ''
  });

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
  };

  // Extract unique categories and motos for filters
  const categories = Array.from(new Set(items.map(item => item.categoria).filter(Boolean)));
  const motos = Array.from(new Set(items.map(item => item.moto).filter(Boolean)));

  // Sorting logic
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filtering and Sorting logic
  const filteredAndSortedItems = useMemo(() => {
    const searchTerms = searchTerm.toLowerCase().split(' ').filter(t => t.length > 0);
    
    let result = items.filter(item => {
      const matchesSearch = searchTerms.length === 0 || searchTerms.every(term => 
        (item.nome?.toLowerCase() || '').includes(term) ||
        (item.moto?.toLowerCase() || '').includes(term) ||
        (item.rk_id?.toLowerCase() || '').includes(term) ||
        (item.categoria?.toLowerCase() || '').includes(term)
      );
      
      const matchesCategory = selectedCategory === 'Todas' || item.categoria === selectedCategory;
      const matchesMoto = selectedMoto === 'Todas' || item.moto === selectedMoto;
      const matchesStock = !onlyWithStock || (item.estoque > 0);

      return matchesSearch && matchesCategory && matchesMoto && matchesStock;
    });

    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    if (showWithPhotoFirst) {
      result.sort((a, b) => {
        const aHasPhoto = !!a.imagem;
        const bHasPhoto = !!b.imagem;
        if (aHasPhoto && !bHasPhoto) return -1;
        if (!aHasPhoto && bHasPhoto) return 1;
        return 0;
      });
    }

    return result;
  }, [items, searchTerm, selectedCategory, selectedMoto, onlyWithStock, sortConfig, showWithPhotoFirst]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedItems, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedItems.length / itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedMoto, onlyWithStock, itemsPerPage, showWithPhotoFirst]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('Todas');
    setSelectedMoto('Todas');
    setOnlyWithStock(false);
    setShowWithPhotoFirst(true);
    setSortConfig({ key: 'criado_em', direction: 'desc' });
    setSelectedIds([]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedItems.map(item => item.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const idsToRemove = [...selectedIds];
    setIsBulkDeleteConfirmOpen(false);
    
    // Optimistic update
    setInventory(prev => prev.filter(item => !idsToRemove.includes(item.id)));
    setSelectedIds([]);

    try {
      const response = await fetch('/api/inventory/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToRemove })
      });
      
      if (!response.ok) throw new Error('Falha ao excluir itens');
    } catch (err: any) {
      alert(err.message);
      refreshData();
    }
  };

  const handleBulkUpdateStock = async (amount: number) => {
    if (!selectedIds.length) return;
    const idsToUpdate = [...selectedIds];
    
    // Optimistic update
    setInventory(prev => prev.map(item => {
      if (idsToUpdate.includes(item.id)) {
        return { ...item, estoque: Math.max(0, (item.estoque || 0) + amount) };
      }
      return item;
    }));

    try {
      const response = await fetch('/api/inventory/bulk-update-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToUpdate, amount })
      });
      
      if (!response.ok) throw new Error('Falha ao atualizar estoque');
    } catch (err: any) {
      alert(err.message);
      refreshData();
    }
  };

  const handleBulkUpdateCategory = async () => {
    if (!selectedIds.length || !bulkCategory) return;
    const idsToUpdate = [...selectedIds];
    const newCategory = bulkCategory;
    setIsCategoryModalOpen(false);

    // Optimistic update
    setInventory(prev => prev.map(item => {
      if (idsToUpdate.includes(item.id)) {
        return { ...item, categoria: newCategory };
      }
      return item;
    }));
    setSelectedIds([]);
    setBulkCategory('');

    try {
      const response = await fetch('/api/inventory/bulk-update-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToUpdate, categoria: newCategory })
      });

      if (!response.ok) throw new Error('Falha ao atualizar categoria');
    } catch (err: any) {
      setError(err.message);
      refreshData();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    const payload = {
      ...formData,
      categoria: formData.categoria === 'nova' ? formData.novaCategoria : formData.categoria,
      moto: formData.moto === 'outra' ? formData.outraMoto : formData.moto,
    };

    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Erro ao salvar item');
      
      const newItem = await response.json();
      
      // Update state locally to avoid slow full refetch
      setInventory(prev => [newItem, ...prev]);
      
      setIsModalOpen(false);
      setFormData({
        nome: '',
        categoria: '',
        novaCategoria: '',
        moto: '',
        outraMoto: '',
        valor: '',
        estoque: '1',
        ano: '',
        descricao: '',
        ml_link: ''
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleteConfirmOpen(false);
    const targetId = id || itemToDelete;
    if (!targetId) return;
    
    // Optimistic update
    setInventory(prev => prev.filter(item => item.id !== targetId));
    setSelectedIds(prev => prev.filter(i => i !== targetId));
    setItemToDelete(null);

    try {
      const response = await fetch(`/api/inventory/${targetId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Falha ao excluir item');
    } catch (err: any) {
      setError(err.message);
      refreshData();
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-400 gap-4">
        <Loader2 className="animate-spin text-violet-500" size={40} />
        <p className="animate-pulse">Sincronizando com Notion...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-rose-400 gap-4">
        <AlertCircle size={40} />
        <p>Erro: {error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-zinc-800 rounded-lg text-white hover:bg-zinc-700 transition-colors"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  const columns = [
    { key: 'nome', label: 'Peça' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'valor', label: 'Valor' },
    { key: 'moto', label: 'Moto' },
    { key: 'estoque', label: 'Estoque' },
    { key: 'ano', label: 'Ano' },
    { key: 'rk_id', label: 'ID' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'criado_em', label: 'Criado em' },
    { key: 'imagem', label: 'Imagem' },
    { key: 'ml_link', label: 'ML LINK' },
    { key: 'actions', label: 'Ações' },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className={cn(
        "border p-4 rounded-2xl flex flex-wrap items-center gap-4 transition-all duration-300",
        theme === 'dark' 
          ? "bg-zinc-900/40 border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)]" 
          : "bg-white border-zinc-200 shadow-sm"
      )}>
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input 
            type="text" 
            placeholder="🔍 Buscar peça, moto ou ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              "w-full border rounded-xl py-2 pl-10 pr-4 text-sm outline-none transition-all duration-200",
              theme === 'dark' 
                ? "bg-zinc-950/50 border-zinc-800 text-zinc-200 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10" 
                : "bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-violet-500"
            )}
          />
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-zinc-500 ml-1 tracking-wider">Categoria</span>
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={cn(
                "border rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-violet-500/50 transition-all duration-200",
                theme === 'dark' 
                  ? "bg-zinc-950/50 border-zinc-800 text-zinc-200" 
                  : "bg-white border-zinc-200 text-zinc-700"
              )}
            >
              <option value="Todas">Todas</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-zinc-500 ml-1 tracking-wider">Moto</span>
            <select 
              value={selectedMoto}
              onChange={(e) => setSelectedMoto(e.target.value)}
              className={cn(
                "border rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-violet-500/50 transition-all duration-200",
                theme === 'dark' 
                  ? "bg-zinc-950/50 border-zinc-800 text-zinc-200" 
                  : "bg-white border-zinc-200 text-zinc-700"
              )}
            >
              <option value="Todas">Todas</option>
              {motos.map(moto => (
                <option key={moto} value={moto}>{moto}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer group mt-4">
            <div className={cn(
              "w-5 h-5 rounded border flex items-center justify-center transition-all duration-200",
              onlyWithStock 
                ? "bg-violet-600 border-violet-600 shadow-[0_0_10px_rgba(139,92,246,0.3)]" 
                : theme === 'dark' ? "border-zinc-700 group-hover:border-zinc-500" : "border-zinc-300 group-hover:border-zinc-400"
            )} onClick={() => setOnlyWithStock(!onlyWithStock)}>
              {onlyWithStock && <Check className="text-white" size={14} />}
            </div>
            <span className={cn(
              "text-xs font-bold uppercase tracking-wider transition-colors",
              theme === 'dark' ? "text-zinc-500 group-hover:text-zinc-300" : "text-zinc-500"
            )}>Com estoque</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer group mt-4">
            <div className={cn(
              "w-5 h-5 rounded border flex items-center justify-center transition-all duration-200",
              showWithPhotoFirst 
                ? "bg-violet-600 border-violet-600 shadow-[0_0_10px_rgba(139,92,246,0.3)]" 
                : theme === 'dark' ? "border-zinc-700 group-hover:border-zinc-500" : "border-zinc-300 group-hover:border-zinc-400"
            )} onClick={() => setShowWithPhotoFirst(!showWithPhotoFirst)}>
              {showWithPhotoFirst && <Check className="text-white" size={14} />}
            </div>
            <span className={cn(
              "text-xs font-bold uppercase tracking-wider transition-colors",
              theme === 'dark' ? "text-zinc-500 group-hover:text-zinc-300" : "text-zinc-500"
            )}>Com foto primeiro</span>
          </label>

          <button 
            onClick={clearFilters}
            className={cn(
              "px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all mt-4",
              theme === 'dark' ? "text-zinc-500 hover:text-white hover:bg-zinc-800/50" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
            )}
          >
            Limpar Filtros
          </button>

          <div className="flex items-center gap-1 border rounded-xl p-1 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 mt-4">
            <button 
              onClick={() => setViewMode('table')}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                viewMode === 'table' 
                  ? "bg-violet-600 text-white shadow-sm" 
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              )}
            >
              <TableIcon size={16} />
            </button>
            <button 
              onClick={() => setViewMode('card')}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                viewMode === 'card' 
                  ? "bg-violet-600 text-white shadow-sm" 
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              )}
            >
              <LayoutGrid size={16} />
            </button>
          </div>

          <button 
            onClick={handleManualRefresh}
            disabled={loading || isRefreshing}
            className={cn(
              "p-2 rounded-xl transition-all mt-4 border",
              theme === 'dark' 
                ? "text-zinc-400 border-zinc-800/50 hover:text-white hover:bg-zinc-800/50" 
                : "text-zinc-500 border-zinc-200 hover:text-zinc-900 hover:bg-zinc-100"
            )}
            title="Atualizar estoque"
          >
            <RefreshCw size={18} className={cn((loading || isRefreshing) && "animate-spin")} />
          </button>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-500 transition-all shadow-[0_8px_20px_rgba(139,92,246,0.3)] flex items-center gap-2 mt-4 font-bold tracking-tight"
          >
            <Plus size={18} />
            Novo Item
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border transition-colors backdrop-blur-xl",
              theme === 'dark' ? "bg-zinc-900/90 border-zinc-800 text-white" : "bg-white/90 border-zinc-200 text-zinc-900"
            )}
          >
            <span className="text-sm font-medium mr-4">
              {selectedIds.length} item(s) selecionado(s)
            </span>
            
            <div className={cn("flex items-center gap-2 border-l pl-4", theme === 'dark' ? "border-zinc-800" : "border-zinc-200")}>
              <button 
                onClick={() => handleBulkUpdateStock(1)}
                className={cn("p-2 rounded-lg transition-colors text-emerald-400", theme === 'dark' ? "hover:bg-zinc-800" : "hover:bg-zinc-100")}
                title="Aumentar estoque"
              >
                <Plus size={18} />
              </button>
              <button 
                onClick={() => handleBulkUpdateStock(-1)}
                className={cn("p-2 rounded-lg transition-colors text-rose-400", theme === 'dark' ? "hover:bg-zinc-800" : "hover:bg-zinc-100")}
                title="Diminuir estoque"
              >
                <Minus size={18} />
              </button>
              <button 
                onClick={() => setIsCategoryModalOpen(true)}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-violet-400"
                title="Mudar categoria"
              >
                <Layers size={18} />
              </button>
              <button 
                onClick={() => setIsBulkDeleteConfirmOpen(true)}
                className="p-2 hover:bg-rose-500/20 hover:text-rose-400 rounded-lg transition-colors text-zinc-400"
                title="Excluir selecionados"
              >
                <Trash2 size={18} />
              </button>
            </div>

            <button 
              onClick={() => setSelectedIds([])}
              className="ml-4 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Desmarcar tudo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table Container */}
      <div className={cn(
        "border rounded-2xl overflow-hidden relative transition-all duration-300",
        theme === 'dark' 
          ? "bg-zinc-900/40 border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)]" 
          : "bg-white border-zinc-200 shadow-sm"
      )}>
        {loading && (
          <div className={cn(
            "absolute inset-0 backdrop-blur-[2px] z-10 flex items-center justify-center",
            theme === 'dark' ? "bg-zinc-950/50" : "bg-white/50"
          )}>
            <Loader2 className="animate-spin text-violet-500" size={32} />
          </div>
        )}
        <div className={cn(
          "p-6 border-b flex items-center justify-between transition-colors",
          theme === 'dark' ? "border-zinc-800/50" : "border-zinc-100"
        )}>
          <h3 className={cn(
            "text-lg font-bold tracking-tight transition-colors",
            theme === 'dark' ? "text-white" : "text-zinc-900"
          )}>Estoque em Tempo Real</h3>
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-bold uppercase tracking-wider">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            {filteredAndSortedItems.length} itens encontrados
          </div>
        </div>
        
        {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className={cn(
                  "transition-colors",
                  theme === 'dark' ? "bg-zinc-800/30" : "bg-zinc-50"
                )}>
                  <th className="px-6 py-4 w-10">
                    <div 
                      className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-all duration-200",
                        selectedIds.length === paginatedItems.length && paginatedItems.length > 0
                          ? "bg-violet-600 border-violet-600 shadow-[0_0_8px_rgba(139,92,246,0.3)]" 
                          : theme === 'dark' ? "border-zinc-700" : "border-zinc-300"
                      )}
                      onClick={toggleSelectAll}
                    >
                      {selectedIds.length === paginatedItems.length && paginatedItems.length > 0 && <Check className="text-white" size={14} />}
                    </div>
                  </th>
                  {columns.map(col => (
                    <th 
                      key={col.key} 
                      onClick={() => handleSort(col.key)}
                      className={cn(
                        "px-6 py-4 text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all duration-200 group",
                        theme === 'dark' ? "text-zinc-500 hover:bg-zinc-800/40" : "text-zinc-500 hover:bg-zinc-100",
                        sortConfig.key === col.key && (theme === 'dark' ? "text-violet-400 bg-violet-500/5" : "text-violet-600 bg-violet-50")
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {col.label}
                        <div className="flex flex-col text-[8px] leading-[4px] opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className={cn(sortConfig.key === col.key && sortConfig.direction === 'asc' ? "text-violet-400" : "text-zinc-600")}>▲</span>
                          <span className={cn(sortConfig.key === col.key && sortConfig.direction === 'desc' ? "text-violet-400" : "text-zinc-600")}>▼</span>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={cn(
                "divide-y transition-colors",
                theme === 'dark' ? "divide-zinc-800/30" : "divide-zinc-100"
              )}>
                {loading && items.length === 0 ? (
                  Array(10).fill(0).map((_, i) => <SkeletonRow key={i} theme={theme} />)
                ) : paginatedItems.map((item) => (
                  <tr 
                    key={item.id} 
                    onClick={() => onSelectItem(item)}
                    className={cn(
                      "transition-all duration-200 group cursor-pointer",
                      selectedIds.includes(item.id) 
                        ? theme === 'dark' ? "bg-violet-500/10" : "bg-violet-50"
                        : theme === 'dark' ? "hover:bg-zinc-800/20" : "hover:bg-zinc-50"
                    )}
                  >
                    <td className="px-6 py-4">
                      <div 
                        className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-all duration-200",
                          selectedIds.includes(item.id) 
                            ? "bg-violet-600 border-violet-600 shadow-[0_0_8px_rgba(139,92,246,0.3)] opacity-100" 
                            : cn(
                                "opacity-0 group-hover:opacity-100",
                                theme === 'dark' ? "border-zinc-700 hover:border-zinc-500" : "border-zinc-300 hover:border-zinc-400"
                              )
                        )}
                        onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                      >
                        {selectedIds.includes(item.id) && <Check className="text-white" size={14} />}
                      </div>
                    </td>
                    {columns.map(col => (
                      <td key={`${item.id}-${col.key}`} className={cn(
                        "px-6 py-4 text-sm transition-colors",
                        theme === 'dark' ? "text-zinc-400" : "text-zinc-600"
                      )}>
                        {col.key === 'valor' ? (
                          <span className={cn(
                            "font-bold transition-colors text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.2)]",
                          )}>{formatCurrency(item[col.key])}</span>
                        ) : col.key === 'criado_em' ? (
                          <span className="text-xs text-zinc-500 font-medium">{formatDate(item[col.key])}</span>
                        ) : col.key === 'ml_link' && item[col.key] ? (
                          <a 
                            href={item[col.key]} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-colors inline-block"
                          >
                            <ExternalLink size={16} />
                          </a>
                        ) : col.key === 'imagem' && item[col.key] ? (
                          <div className={cn(
                            "w-10 h-10 rounded-lg overflow-hidden border transition-colors relative",
                            theme === 'dark' ? "border-zinc-800/50" : "border-zinc-200"
                          )}>
                            <>
                              <img 
                                src={item[col.key]} 
                                alt={item.nome} 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer" 
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 -z-10">
                                <Package size={16} className="text-zinc-400 opacity-50" />
                              </div>
                            </>
                          </div>
                        ) : col.key === 'categoria' ? (
                          <span className={cn(
                            "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors",
                            theme === 'dark' ? "bg-violet-500/10 text-violet-400 border border-violet-500/20" : "bg-zinc-100 text-zinc-600"
                          )}>
                            {item[col.key]}
                          </span>
                        ) : col.key === 'moto' ? (
                          <span className={cn(
                            "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-colors",
                            theme === 'dark' ? "bg-zinc-800 text-zinc-300 border-zinc-700" : "bg-zinc-100 text-zinc-600 border-zinc-200"
                          )}>
                            {item[col.key]}
                          </span>
                        ) : col.key === 'actions' ? (
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setItemToDelete(item.id);
                                setIsDeleteConfirmOpen(true);
                              }}
                              className={cn(
                                "p-2 rounded-lg transition-all",
                                theme === 'dark' ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20" : "text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                              )}
                              title="Excluir item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ) : (
                          item[col.key] || <span className="text-zinc-600 italic">-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 bg-zinc-50/50 dark:bg-zinc-900/20">
            {loading && items.length === 0 ? (
              Array(8).fill(0).map((_, i) => (
                <div key={i} className={cn("h-64 rounded-2xl animate-pulse", theme === 'dark' ? "bg-zinc-800/50" : "bg-zinc-200/50")} />
              ))
            ) : paginatedItems.map((item) => (
              <div 
                key={item.id}
                onClick={() => onSelectItem(item)}
                className={cn(
                  "group relative flex flex-col rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden hover:-translate-y-1 hover:shadow-xl",
                  selectedIds.includes(item.id)
                    ? theme === 'dark' ? "bg-violet-500/10 border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.15)]" : "bg-violet-50 border-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                    : theme === 'dark' ? "bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700" : "bg-white border-zinc-200 hover:border-zinc-300"
                )}
              >
                {/* Selection Checkbox */}
                <div 
                  onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                  className={cn(
                    "absolute top-3 left-3 z-10 w-6 h-6 rounded-md border flex items-center justify-center transition-all duration-200 backdrop-blur-md",
                    selectedIds.includes(item.id)
                      ? "bg-violet-600 border-violet-600 shadow-[0_0_10px_rgba(139,92,246,0.5)] opacity-100"
                      : cn(
                          "opacity-0 group-hover:opacity-100",
                          theme === 'dark' ? "bg-zinc-900/80 border-zinc-600" : "bg-white/80 border-zinc-300"
                        )
                  )}
                >
                  {selectedIds.includes(item.id) && <Check className="text-white" size={14} strokeWidth={3} />}
                </div>

                {/* Actions Menu */}
                <div className="absolute top-3 right-3 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setItemToDelete(item.id);
                      setIsDeleteConfirmOpen(true);
                    }}
                    className={cn(
                      "p-1.5 rounded-md backdrop-blur-md transition-all",
                      theme === 'dark' ? "bg-zinc-900/80 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/20" : "bg-white/80 text-zinc-500 hover:text-rose-600 hover:bg-rose-50"
                    )}
                    title="Excluir item"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Image Section */}
                <div className={cn(
                  "relative aspect-video w-full overflow-hidden border-b",
                  theme === 'dark' ? "border-zinc-800/50 bg-zinc-950" : "border-zinc-100 bg-zinc-50"
                )}>
                  {item.imagem ? (
                    <>
                      <img 
                        src={item.imagem} 
                        alt={item.nome} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-900 -z-10">
                        <Package size={32} className="text-zinc-400 opacity-20" />
                        <span className="text-[8px] uppercase font-bold tracking-widest mt-2 text-zinc-500 opacity-40">Sem Imagem</span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-20">
                      <Package size={48} />
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  <div className="absolute bottom-3 left-3 flex gap-2">
                    <span className={cn(
                      "px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider shadow-lg backdrop-blur-md",
                      item.estoque > 0 
                        ? "bg-emerald-500/90 text-white" 
                        : "bg-rose-500/90 text-white"
                    )}>
                      {item.estoque > 0 ? `${item.estoque} EM ESTOQUE` : 'ESGOTADO'}
                    </span>
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className={cn(
                      "font-bold text-base leading-tight line-clamp-2",
                      theme === 'dark' ? "text-zinc-100" : "text-zinc-900"
                    )}>
                      {item.nome}
                    </h4>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <span className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-md",
                      theme === 'dark' ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-600"
                    )}>
                      {item.rk_id}
                    </span>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md",
                      theme === 'dark' ? "bg-violet-500/20 text-violet-400" : "bg-violet-100 text-violet-600"
                    )}>
                      {item.categoria}
                    </span>
                  </div>

                  <div className="mt-auto space-y-2">
                    <div className={cn(
                      "flex items-center justify-between text-sm p-2 rounded-lg",
                      theme === 'dark' ? "bg-zinc-900/50" : "bg-zinc-50"
                    )}>
                      <span className="text-zinc-500">Moto</span>
                      <span className={cn("font-medium", theme === 'dark' ? "text-zinc-300" : "text-zinc-700")}>
                        {item.moto || '-'}
                      </span>
                    </div>
                    
                    <div className="flex items-end justify-between pt-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Valor</span>
                        <span className="text-lg font-black text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                          {formatCurrency(item.valor)}
                        </span>
                      </div>
                      
                      {item.ml_link && (
                        <a 
                          href={item.ml_link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-colors"
                          title="Ver no Mercado Livre"
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        <div className={cn(
          "p-4 border-t flex flex-wrap items-center justify-between gap-4 transition-colors",
          theme === 'dark' ? "bg-zinc-900/30 border-zinc-800" : "bg-zinc-50 border-zinc-200"
        )}>
          <div className="text-sm text-zinc-500">
            Mostrando <span className={cn("font-medium transition-colors", theme === 'dark' ? "text-zinc-300" : "text-zinc-900")}>{(currentPage - 1) * itemsPerPage + 1}</span>-
            <span className={cn("font-medium transition-colors", theme === 'dark' ? "text-zinc-300" : "text-zinc-900")}>{Math.min(currentPage * itemsPerPage, filteredAndSortedItems.length)}</span> de 
            <span className={cn("font-medium transition-colors", theme === 'dark' ? "text-zinc-300" : "text-zinc-900")}> {filteredAndSortedItems.length}</span> itens
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={cn(
                "px-3 py-1.5 border rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-medium",
                theme === 'dark' 
                  ? "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800" 
                  : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              )}
            >
              Anterior
            </button>
            <span className={cn(
              "px-3 py-1.5 text-sm font-medium",
              theme === 'dark' ? "text-zinc-400" : "text-zinc-600"
            )}>
              Página {currentPage} de {totalPages}
            </span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className={cn(
                "px-3 py-1.5 border rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-medium",
                theme === 'dark' 
                  ? "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800" 
                  : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              )}
            >
              Próximo
            </button>
          </div>

          <select 
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className={cn(
              "border rounded-lg py-1.5 px-3 text-sm focus:outline-none focus:border-violet-500 transition-colors",
              theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-300" : "bg-white border-zinc-300 text-zinc-600"
            )}
          >
            <option value={25}>25 por página</option>
            <option value={50}>50 por página</option>
            <option value={100}>100 por página</option>
          </select>
        </div>

        {filteredAndSortedItems.length === 0 && (
          <div className={cn(
            "p-12 text-center transition-colors",
            theme === 'dark' ? "text-zinc-500" : "text-zinc-400"
          )}>
            Nenhum item corresponde aos filtros aplicados.
          </div>
        )}
      </div>

      {/* New Item Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                "relative w-full max-w-2xl border rounded-3xl shadow-2xl overflow-hidden transition-colors",
                theme === 'dark' ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.2)] text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <div className={cn(
                "p-6 border-b flex items-center justify-between transition-colors",
                theme === 'dark' ? "border-zinc-800" : "border-zinc-100"
              )}>
                <h3 className={cn(
                  "text-xl font-bold flex items-center gap-2 transition-colors",
                  theme === 'dark' ? "text-white" : "text-zinc-900"
                )}>
                  <Plus className="text-violet-500" />
                  Novo Item no Estoque
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    theme === 'dark' ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-zinc-100 text-zinc-500"
                  )}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Nome da Peça *</label>
                    <input 
                      required
                      type="text"
                      value={formData.nome}
                      onChange={(e) => setFormData({...formData, nome: e.target.value})}
                      placeholder="Ex: Relé de Partida"
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Categoria</label>
                    <select 
                      value={formData.categoria}
                      onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    >
                      <option value="">Selecione...</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="nova">+ Nova Categoria</option>
                    </select>
                    {formData.categoria === 'nova' && (
                      <input 
                        type="text"
                        value={formData.novaCategoria}
                        onChange={(e) => setFormData({...formData, novaCategoria: e.target.value})}
                        placeholder="Nome da nova categoria"
                        className={cn(
                          "w-full mt-2 border rounded-xl py-2 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                          theme === 'dark' ? "bg-zinc-950 border-violet-500/50 text-zinc-200" : "bg-white border-violet-500/50 text-zinc-900"
                        )}
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Moto</label>
                    <select 
                      value={formData.moto}
                      onChange={(e) => setFormData({...formData, moto: e.target.value})}
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    >
                      <option value="">Selecione...</option>
                      {motos.map(moto => (
                        <option key={moto} value={moto}>{moto}</option>
                      ))}
                      <option value="outra">+ Outra</option>
                    </select>
                    {formData.moto === 'outra' && (
                      <input 
                        type="text"
                        value={formData.outraMoto}
                        onChange={(e) => setFormData({...formData, outraMoto: e.target.value})}
                        placeholder="Modelo da moto"
                        className={cn(
                          "w-full mt-2 border rounded-xl py-2 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                          theme === 'dark' ? "bg-zinc-950 border-violet-500/50 text-zinc-200" : "bg-white border-violet-500/50 text-zinc-900"
                        )}
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Ano</label>
                    <input 
                      type="text"
                      value={formData.ano}
                      onChange={(e) => setFormData({...formData, ano: e.target.value})}
                      placeholder="Ex: 2014-2018"
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Valor (R$)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={formData.valor}
                      onChange={(e) => setFormData({...formData, valor: e.target.value})}
                      placeholder="0,00"
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Estoque</label>
                    <input 
                      type="number"
                      value={formData.estoque}
                      onChange={(e) => setFormData({...formData, estoque: e.target.value})}
                      placeholder="1"
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Link Mercado Livre</label>
                  <input 
                    type="url"
                    value={formData.ml_link}
                    onChange={(e) => setFormData({...formData, ml_link: e.target.value})}
                    placeholder="https://produto.mercadolivre.com.br/..."
                    className={cn(
                      "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                    )}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Descrição / Observações</label>
                  <textarea 
                    rows={3}
                    value={formData.descricao}
                    onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                    placeholder="Detalhes adicionais da peça..."
                    className={cn(
                      "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                    )}
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className={cn(
                      "px-6 py-2.5 text-sm font-medium transition-all rounded-xl",
                      theme === 'dark' ? "text-zinc-400 hover:text-white hover:bg-zinc-800" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                    )}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="px-8 py-2.5 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-500 transition-all shadow-lg shadow-violet-600/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Salvar no Notion
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Exclusão Individual */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-md p-6 rounded-2xl border shadow-2xl",
                theme === 'dark' ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.2)] text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <div className="flex items-center gap-4 text-rose-500 mb-4">
                <div className="p-3 bg-rose-500/10 rounded-full">
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-xl font-bold">Excluir Item?</h3>
              </div>
              <p className={cn("mb-6", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
                Tem certeza que deseja excluir este item do estoque? Esta ação não pode ser desfeita no Notion.
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className={cn(
                    "px-4 py-2 rounded-xl transition-colors font-medium",
                    theme === 'dark' ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                  )}
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleDelete(itemToDelete!)}
                  className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Exclusão em Massa */}
      <AnimatePresence>
        {isBulkDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-md p-6 rounded-2xl border shadow-2xl",
                theme === 'dark' ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.2)] text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <div className="flex items-center gap-4 text-rose-500 mb-4">
                <div className="p-3 bg-rose-500/10 rounded-full">
                  <Trash2 size={24} />
                </div>
                <h3 className="text-xl font-bold">Excluir {selectedIds.length} itens?</h3>
              </div>
              <p className={cn("mb-6", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
                Tem certeza que deseja excluir permanentemente os itens selecionados?
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setIsBulkDeleteConfirmOpen(false)}
                  className={cn(
                    "px-4 py-2 rounded-xl transition-colors font-medium",
                    theme === 'dark' ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                  )}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleBulkDelete}
                  className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all"
                >
                  Excluir Tudo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Mudança de Categoria em Massa */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-md p-6 rounded-2xl border shadow-2xl",
                theme === 'dark' ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.2)] text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <div className="flex items-center gap-4 text-violet-500 mb-4">
                <div className="p-3 bg-violet-500/10 rounded-full">
                  <Layers size={24} />
                </div>
                <h3 className="text-xl font-bold">Mudar Categoria</h3>
              </div>
              <p className={cn("mb-4 text-sm", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
                Selecione ou digite a nova categoria para os {selectedIds.length} itens selecionados.
              </p>
              
              <div className="space-y-4 mb-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Nova Categoria</label>
                  <input 
                    type="text"
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value)}
                    placeholder="Ex: Motor, Carenagem..."
                    className={cn(
                      "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                    )}
                    autoFocus
                  />
                </div>
                
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setBulkCategory(cat)}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs transition-colors",
                          bulkCategory === cat 
                            ? "bg-violet-600 text-white" 
                            : theme === 'dark' ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => {
                    setIsCategoryModalOpen(false);
                    setBulkCategory('');
                  }}
                  className={cn(
                    "px-4 py-2 rounded-xl transition-colors font-medium",
                    theme === 'dark' ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                  )}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleBulkUpdateCategory}
                  disabled={!bulkCategory}
                  className="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-violet-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Atualizar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SalesView = ({ theme, onSelectItem }: { theme: 'light' | 'dark', onSelectItem: (item: any) => void }) => {
  const { sales: items, loading, refreshData, setSales } = useContext(DataContext);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editingSale, setEditingSale] = useState<any | null>(null);

  const [formData, setFormData] = useState({
    nome: '',
    moto: '',
    valor: '',
    tipo: 'Pix',
    data: new Date().toISOString().split('T')[0]
  });

  const [editFormData, setEditFormData] = useState({
    nome: '',
    moto: '',
    valor: '',
    tipo: 'Pix',
    data: ''
  });

  // Novos estados de filtro
  const [quickFilter, setQuickFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentType, setPaymentType] = useState('Todos');

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedItems.map(item => item.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const idsToRemove = [...selectedIds];
    setIsBulkDeleteConfirmOpen(false);
    
    // Optimistic update
    setSales(prev => prev.filter(item => !idsToRemove.includes(item.id)));
    setSelectedIds([]);

    try {
      const response = await fetch('/api/sales/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToRemove })
      });
      
      if (!response.ok) throw new Error('Falha ao excluir vendas');
    } catch (err: any) {
      alert(err.message);
      // Rollback if needed (optional, but good practice)
      refreshData();
    }
  };

  const handleDeleteSale = async () => {
    if (!itemToDelete) return;
    const idToRemove = itemToDelete;
    setIsDeleteConfirmOpen(false);
    
    // Optimistic update
    setSales(prev => prev.filter(item => item.id !== idToRemove));
    setSelectedIds(prev => prev.filter(i => i !== idToRemove));
    setItemToDelete(null);

    try {
      const response = await fetch(`/api/sales/${idToRemove}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Falha ao excluir venda');
    } catch (err: any) {
      alert(err.message);
      refreshData();
    }
  };

  const handleEditSale = (sale: any) => {
    setEditingSale(sale);
    setEditFormData({
      nome: sale.nome,
      moto: sale.moto,
      valor: sale.valor.toString(),
      tipo: sale.tipo || 'Pix',
      data: sale.data ? new Date(sale.data).toISOString().split('T')[0] : ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale) return;
    const saleId = editingSale.id;
    const updatedData = { ...editFormData, id: saleId, valor: Number(editFormData.valor) };
    
    // Optimistic update
    setSales(prev => prev.map(item => item.id === saleId ? { ...item, ...updatedData } : item));
    setIsEditModalOpen(false);
    setEditingSale(null);

    try {
      const response = await fetch(`/api/sales/${saleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      });
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Falha ao atualizar venda');
      }
      // Update with real data from server if needed
      setSales(prev => prev.map(item => item.id === saleId ? result.data : item));
    } catch (err: any) {
      alert(err.message);
      refreshData();
    }
  };

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      if (result.success) {
        setSales(prev => [result.data, ...prev]);
        setIsModalOpen(false);
        setFormData({
          nome: '',
          moto: '',
          valor: '',
          tipo: 'Pix',
          data: new Date().toISOString().split('T')[0]
        });
      } else {
        throw new Error(result.error || 'Falha ao salvar venda');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const paymentTypes = useMemo(() => {
    const types = new Set(items.map(item => item.tipo).filter(Boolean));
    return ['Todos', ...Array.from(types)];
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = [...items];

    // Filtro de busca
    if (searchTerm) {
      const searchTerms = searchTerm.toLowerCase().split(' ').filter(t => t.length > 0);
      result = result.filter(item => 
        searchTerms.every(term => 
          (item.nome?.toLowerCase() || '').includes(term) ||
          (item.numero_id?.toLowerCase() || '').includes(term) ||
          (item.moto?.toLowerCase() || '').includes(term)
        )
      );
    }

    // Filtro de Tipo de Pagamento
    if (paymentType && paymentType !== 'Todos') {
      result = result.filter(item => item.tipo === paymentType);
    }

    // Filtro de Data
    let start: Date | null = null;
    let end: Date | null = null;

    if (quickFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      switch (quickFilter) {
        case 'today':
          start = today;
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
          break;
        case 'yesterday':
          start = new Date(today);
          start.setDate(today.getDate() - 1);
          end = new Date(start);
          end.setHours(23, 59, 59, 999);
          break;
        case 'this-week':
          start = new Date(today);
          start.setDate(today.getDate() - today.getDay());
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
          break;
        case 'this-month':
          start = new Date(today.getFullYear(), today.getMonth(), 1);
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
          break;
        case 'last-30-days':
          start = new Date(today);
          start.setDate(today.getDate() - 30);
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
          break;
      }
    } else if (startDate || endDate) {
      if (startDate) {
        const [y, m, d] = startDate.split('-').map(Number);
        start = new Date(y, m - 1, d);
        start.setHours(0, 0, 0, 0);
      }
      if (endDate) {
        const [y, m, d] = endDate.split('-').map(Number);
        end = new Date(y, m - 1, d);
        end.setHours(23, 59, 59, 999);
      }
    }

    if (start || end) {
      result = result.filter(item => {
        let itemDate = new Date(item.data);
        
        // Se a data for apenas YYYY-MM-DD, o JS interpreta como UTC.
        // Vamos ajustar para local para que os filtros de "Hoje" e "Ontem" funcionem.
        if (typeof item.data === 'string' && item.data.length === 10 && item.data.includes('-')) {
          const [y, m, d] = item.data.split('-').map(Number);
          itemDate = new Date(y, m - 1, d);
        }

        if (start && itemDate < start) return false;
        if (end && itemDate > end) return false;
        return true;
      });
    }

    return result;
  }, [items, searchTerm, quickFilter, startDate, endDate, paymentType]);

  const totalValue = useMemo(() => {
    return filteredItems.reduce((acc, item) => acc + (item.valor || 0), 0);
  }, [filteredItems]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  const clearAllFilters = () => {
    setSearchTerm('');
    setQuickFilter('all');
    setStartDate('');
    setEndDate('');
    setPaymentType('Todos');
    setCurrentPage(1);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-400 gap-4">
        <Loader2 className="animate-spin text-violet-500" size={40} />
        <p className="animate-pulse">Carregando vendas do Notion...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de Filtros */}
      <div className={cn(
        "border p-6 rounded-2xl space-y-6 transition-all duration-300",
        theme === 'dark' 
          ? "bg-zinc-900/40 border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)]" 
          : "bg-white border-zinc-200 shadow-sm"
      )}>
        {/* Busca e Atualizar */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por peça, moto ou ID..." 
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className={cn(
                "w-full border rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none transition-all",
                theme === 'dark' 
                  ? "bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-violet-500" 
                  : "bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-violet-500"
              )}
            />
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-500 uppercase">Pagamento:</span>
              <select
                value={paymentType}
                onChange={(e) => {
                  setPaymentType(e.target.value);
                  setCurrentPage(1);
                }}
                className={cn(
                  "border rounded-xl py-2 px-3 text-xs outline-none transition-all cursor-pointer",
                  theme === 'dark' 
                    ? "bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-violet-500" 
                    : "bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-violet-500"
                )}
              >
                {paymentTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={handleManualRefresh}
              disabled={loading || isRefreshing}
              className={cn(
                "p-2.5 rounded-xl transition-all border",
                theme === 'dark' 
                  ? "text-zinc-400 border-zinc-800/50 hover:text-white hover:bg-zinc-800/50" 
                  : "text-zinc-500 border-zinc-200 hover:text-zinc-900 hover:bg-zinc-100"
              )}
              title="Atualizar dados"
            >
              <RefreshCw size={18} className={cn((loading || isRefreshing) && "animate-spin")} />
            </button>

            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-[0_8px_20px_rgba(139,92,246,0.3)] font-bold tracking-tight"
            >
              <ShoppingCart size={20} />
              <span className="hidden sm:inline">Nova Venda</span>
            </button>
          </div>
        </div>

        {/* Filtros Rápidos e Período */}
        <div className="flex flex-wrap items-center justify-between gap-6 pt-2 border-t border-zinc-800/30">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'Tudo' },
              { id: 'today', label: 'Hoje' },
              { id: 'yesterday', label: 'Ontem' },
              { id: 'this-week', label: 'Semana' },
              { id: 'this-month', label: 'Mês' },
              { id: 'last-30-days', label: '30 Dias' },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => {
                  setQuickFilter(filter.id);
                  setStartDate('');
                  setEndDate('');
                  setCurrentPage(1);
                }}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border",
                  quickFilter === filter.id
                    ? "bg-violet-600 border-violet-500 text-white shadow-[0_8px_20px_rgba(139,92,246,0.3)]"
                    : theme === 'dark'
                      ? "bg-zinc-950 border-zinc-800/50 text-zinc-500 hover:border-zinc-700 hover:text-zinc-200"
                      : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-zinc-500" />
              <input 
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setQuickFilter('all');
                  setCurrentPage(1);
                }}
                className={cn(
                  "border rounded-lg py-1 px-2 text-xs outline-none transition-all",
                  theme === 'dark' 
                    ? "bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-violet-500" 
                    : "bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-violet-500"
                )}
              />
              <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider">até</span>
              <input 
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setQuickFilter('all');
                  setCurrentPage(1);
                }}
                className={cn(
                  "border rounded-lg py-1 px-2 text-xs outline-none transition-all",
                  theme === 'dark' 
                    ? "bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-violet-500" 
                    : "bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-violet-500"
                )}
              />
            </div>
          </div>
        </div>

        {/* Indicadores e Limpar */}
        {(searchTerm || quickFilter !== 'all' || startDate || endDate || paymentType !== 'Todos') && (
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800/30">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-zinc-500 font-medium">
                Mostrando <span className="text-violet-400 font-bold">{filteredItems.length}</span> vendas no período
              </span>
              <div className="w-px h-4 bg-zinc-800/50" />
              <span className="text-zinc-500 font-medium">
                Total filtrado: <span className="text-emerald-400 font-bold drop-shadow-[0_0_8px_rgba(52,211,153,0.2)]">{formatCurrency(totalValue)}</span>
              </span>
            </div>
            <button 
              onClick={clearAllFilters}
              className="flex items-center gap-2 text-xs text-zinc-500 hover:text-rose-400 font-bold uppercase tracking-wider transition-colors"
            >
              <X size={14} />
              Limpar todos os filtros
            </button>
          </div>
        )}
      </div>

      <div className={cn(
        "border rounded-2xl overflow-hidden relative transition-all duration-300",
        theme === 'dark' 
          ? "bg-zinc-900/40 border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)]" 
          : "bg-white border-zinc-200 shadow-sm"
      )}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className={cn(
                "transition-colors",
                theme === 'dark' ? "bg-zinc-800/30" : "bg-zinc-50"
              )}>
                <th className="px-6 py-4 w-10">
                  <div 
                    onClick={toggleSelectAll}
                    className={cn(
                      "w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-all duration-200",
                      selectedIds.length === paginatedItems.length && paginatedItems.length > 0
                        ? "bg-violet-600 border-violet-600 shadow-[0_0_8px_rgba(139,92,246,0.3)]" 
                        : theme === 'dark' ? "border-zinc-700" : "border-zinc-300"
                    )}
                  >
                    {selectedIds.length === paginatedItems.length && paginatedItems.length > 0 && <Check className="text-white" size={14} />}
                  </div>
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Peça</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Moto</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Valor</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tipo</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Data</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">ID</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className={cn(
              "divide-y transition-colors",
              theme === 'dark' ? "divide-zinc-800/30" : "divide-zinc-100"
            )}>
              {loading && items.length === 0 ? (
                Array(10).fill(0).map((_, i) => <SkeletonRow key={i} theme={theme} />)
              ) : paginatedItems.map((item) => (
                <tr 
                  key={item.id} 
                  onClick={() => onSelectItem(item)}
                  className={cn(
                    "transition-all duration-200 group cursor-pointer",
                    selectedIds.includes(item.id) 
                      ? theme === 'dark' ? "bg-violet-500/10" : "bg-violet-50"
                      : theme === 'dark' ? "hover:bg-zinc-800/20" : "hover:bg-zinc-50"
                  )}
                >
                  <td className="px-6 py-4">
                    <div 
                      onClick={() => toggleSelect(item.id)}
                      className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-all duration-200",
                        selectedIds.includes(item.id)
                          ? "bg-violet-600 border-violet-600 shadow-[0_0_8px_rgba(139,92,246,0.3)] opacity-100" 
                          : cn(
                              "opacity-0 group-hover:opacity-100",
                              theme === 'dark' ? "border-zinc-700 hover:border-zinc-500" : "border-zinc-300 hover:border-zinc-400"
                            )
                      )}
                    >
                      {selectedIds.includes(item.id) && <Check className="text-white" size={14} />}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {item.imagem && (
                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-zinc-800/50">
                          <img src={item.imagem} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}
                      <span className={cn("text-sm font-bold tracking-tight", theme === 'dark' ? "text-white" : "text-zinc-900")}>{item.nome}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-zinc-500">{item.moto}</td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-violet-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.2)]">
                      {formatCurrency(item.valor)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {item.tipo && (
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-colors",
                        theme === 'dark' ? "bg-zinc-800 text-zinc-300 border-zinc-700" : "bg-zinc-100 text-zinc-600 border-zinc-200"
                      )}>
                        {item.tipo}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-zinc-500 font-medium">{formatDate(item.data)}</td>
                  <td className="px-6 py-4 text-xs font-mono text-zinc-600">{item.numero_id}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEditSale(item)}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          theme === 'dark' ? "bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-700" : "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
                        )}
                        title="Editar"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => {
                          setItemToDelete(item.id);
                          setIsDeleteConfirmOpen(true);
                        }}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          theme === 'dark' ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20" : "text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                        )}
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={cn(
          "p-4 border-t flex items-center justify-between transition-colors",
          theme === 'dark' ? "bg-zinc-900/30 border-zinc-800/50" : "bg-zinc-50 border-zinc-200"
        )}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total: {filteredItems.length} vendas</span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={cn(
                "p-1.5 border rounded-lg disabled:opacity-30 transition-all",
                theme === 'dark' ? "border-zinc-800 hover:bg-zinc-800" : "border-zinc-200 hover:bg-zinc-100"
              )}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold text-zinc-400">Página {currentPage} de {totalPages}</span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className={cn(
                "p-1.5 border rounded-lg disabled:opacity-30 transition-all",
                theme === 'dark' ? "border-zinc-800 hover:bg-zinc-800" : "border-zinc-200 hover:bg-zinc-100"
              )}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Nova Venda */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={cn(
                "w-full max-w-lg p-8 rounded-3xl border shadow-2xl relative",
                theme === 'dark' ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.2)] text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-zinc-800 rounded-full transition-colors"
              >
                <X size={20} className="text-zinc-500" />
              </button>

              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-violet-600/10 rounded-2xl">
                  <ShoppingCart className="text-violet-500" size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Registrar Venda</h2>
                  <p className="text-sm text-zinc-500">Adicione os detalhes da nova transação</p>
                </div>
              </div>

              <form onSubmit={handleSaveSale} className="space-y-5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Peça Vendida</label>
                  <input 
                    required
                    type="text" 
                    value={formData.nome}
                    onChange={(e) => setFormData({...formData, nome: e.target.value})}
                    placeholder="Ex: Motor Honda CB 300"
                    className={cn(
                      "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Moto</label>
                    <input 
                      type="text"
                      value={formData.moto}
                      onChange={(e) => setFormData({...formData, moto: e.target.value})}
                      placeholder="Ex: CB 300"
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Valor (R$)</label>
                    <input 
                      required
                      type="number"
                      step="0.01"
                      value={formData.valor}
                      onChange={(e) => setFormData({...formData, valor: e.target.value})}
                      placeholder="0,00"
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Pagamento</label>
                    <select
                      value={formData.tipo}
                      onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    >
                      <option value="Pix">Pix</option>
                      <option value="Cartão">Cartão</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Mercado Livre">Mercado Livre</option>
                      <option value="Transferência">Transferência</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Data</label>
                    <input 
                      type="date"
                      value={formData.data}
                      onChange={(e) => setFormData({...formData, data: e.target.value})}
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className={cn(
                      "px-6 py-2.5 text-sm font-medium transition-all rounded-xl",
                      theme === 'dark' ? "text-zinc-400 hover:text-white hover:bg-zinc-800" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                    )}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="px-8 py-2.5 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-500 transition-all shadow-lg shadow-violet-600/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Registrar Venda
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Editar Venda */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={cn(
                "w-full max-w-lg p-8 rounded-3xl border shadow-2xl relative",
                theme === 'dark' ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.2)] text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-zinc-800 rounded-full transition-colors"
              >
                <X size={20} className="text-zinc-500" />
              </button>

              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-violet-600/10 rounded-2xl">
                  <Edit className="text-violet-500" size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Editar Venda</h2>
                  <p className="text-sm text-zinc-500">Atualize os detalhes da transação</p>
                </div>
              </div>

              <form onSubmit={handleUpdateSale} className="space-y-5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Peça Vendida</label>
                  <input 
                    required
                    type="text" 
                    value={editFormData.nome}
                    onChange={(e) => setEditFormData({...editFormData, nome: e.target.value})}
                    placeholder="Ex: Motor Honda CB 300"
                    className={cn(
                      "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Moto</label>
                    <input 
                      type="text"
                      value={editFormData.moto}
                      onChange={(e) => setEditFormData({...editFormData, moto: e.target.value})}
                      placeholder="Ex: CB 300"
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Valor (R$)</label>
                    <input 
                      required
                      type="number"
                      step="0.01"
                      value={editFormData.valor}
                      onChange={(e) => setEditFormData({...editFormData, valor: e.target.value})}
                      placeholder="0,00"
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Pagamento</label>
                    <select
                      value={editFormData.tipo}
                      onChange={(e) => setEditFormData({...editFormData, tipo: e.target.value})}
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    >
                      <option value="Pix">Pix</option>
                      <option value="Cartão">Cartão</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Mercado Livre">Mercado Livre</option>
                      <option value="Transferência">Transferência</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Data</label>
                    <input 
                      type="date"
                      value={editFormData.data}
                      onChange={(e) => setEditFormData({...editFormData, data: e.target.value})}
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className={cn(
                      "px-6 py-2.5 text-sm font-medium transition-all rounded-xl",
                      theme === 'dark' ? "text-zinc-400 hover:text-white hover:bg-zinc-800" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                    )}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="px-8 py-2.5 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-500 transition-all shadow-lg shadow-violet-600/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Confirmação Exclusão Individual */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-md p-8 rounded-3xl border shadow-2xl text-center",
                theme === 'dark' ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.2)] text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Excluir Venda?</h3>
              <p className="text-zinc-500 text-sm mb-8">
                Esta ação não pode ser desfeita. A venda será removida permanentemente do Notion.
              </p>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-medium transition-all",
                    theme === 'dark' ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                  )}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDeleteSale}
                  disabled={isActionLoading}
                  className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-500 transition-all shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2"
                >
                  {isActionLoading ? <Loader2 className="animate-spin" size={18} /> : "Excluir"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Confirmação Exclusão em Massa */}
      <AnimatePresence>
        {isBulkDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-md p-8 rounded-3xl border shadow-2xl text-center",
                theme === 'dark' ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.2)] text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Excluir {selectedIds.length} Vendas?</h3>
              <p className="text-zinc-500 text-sm mb-8">
                Esta ação removerá permanentemente todas as vendas selecionadas do Notion.
              </p>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsBulkDeleteConfirmOpen(false)}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-medium transition-all",
                    theme === 'dark' ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                  )}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleBulkDelete}
                  disabled={isActionLoading}
                  className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-500 transition-all shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2"
                >
                  {isActionLoading ? <Loader2 className="animate-spin" size={18} /> : "Excluir Todas"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border transition-colors backdrop-blur-xl",
              theme === 'dark' ? "bg-zinc-900/90 border-zinc-800 text-white" : "bg-white/90 border-zinc-200 text-zinc-900"
            )}
          >
            <span className="text-sm font-medium mr-4">
              {selectedIds.length} venda(s) selecionada(s)
            </span>
            
            <div className={cn("flex items-center gap-2 border-l pl-4", theme === 'dark' ? "border-zinc-800" : "border-zinc-200")}>
              <button 
                onClick={() => setIsBulkDeleteConfirmOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600/10 text-rose-500 hover:bg-rose-600 hover:text-white rounded-xl text-sm font-bold transition-all"
              >
                <Trash2 size={16} />
                Excluir Selecionadas
              </button>
              <button 
                onClick={() => setSelectedIds([])}
                className={cn("px-4 py-2 text-sm font-medium transition-all", theme === 'dark' ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600")}
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// =============================================================================
// MOTOS VIEW COMPONENT
// =============================================================================

const MotosView = ({ theme, onSelectItem }: { theme: 'light' | 'dark', onSelectItem: (item: any) => void }) => {
  const { motos: items, loading, refreshData, setMotos } = useContext(DataContext);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editingMoto, setEditingMoto] = useState<any | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [inlineEditData, setInlineEditData] = useState<any>(null);
  const editRowRef = useRef<HTMLTableRowElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Função para lidar com seleção de arquivos
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      // Limitar a 15 arquivos
      if (files.length + selectedFiles.length > 15) {
        alert('Máximo de 15 fotos permitido');
        return;
      }
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  // Função para remover arquivo selecionado
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Função para fazer upload dos arquivos
  const uploadFiles = async (isEdit: boolean = false) => {
    if (selectedFiles.length === 0) return;
    
    const uploadedUrls = await performUpload();
    if (uploadedUrls.length > 0) {
      if (isEdit) {
        setEditFormData(prev => {
          const newImagens = [...prev.imagens, ...uploadedUrls];
          return {
            ...prev, 
            imagens: newImagens,
            imagem: prev.imagem || newImagens[0] || ''
          };
        });
      } else {
        setFormData(prev => {
          const newImagens = [...prev.imagens, ...uploadedUrls];
          return {
            ...prev, 
            imagens: newImagens,
            imagem: prev.imagem || newImagens[0] || ''
          };
        });
      }
    }
  };

  const performUpload = async () => {
    if (selectedFiles.length === 0) return [];
    
    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      // Para cada arquivo, fazer o processo de upload assinado
      for (const file of selectedFiles) {
        // 1. Solicitar URL assinada para upload
        const requestRes = await fetch('/api/storage/request-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            fileType: file.type
          })
        });
        
        const requestData = await requestRes.json();
        if (!requestData.success) throw new Error('Falha ao solicitar upload');
        
        const { uploadUrl, publicUrl } = requestData.data;
        
        // 2. Fazer upload DIRETO para o Google Cloud Storage usando a URL assinada
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          }
        });
        
        if (!uploadRes.ok) throw new Error('Falha no upload da imagem');
        
        // 3. Guardar a URL pública permanente
        uploadedUrls.push(publicUrl);
      }
      
      setSelectedFiles([]);
      return uploadedUrls;
    } catch (error: any) {
      console.error('Erro no upload:', error);
      alert('❌ Erro ao enviar fotos: ' + (error as Error).message);
      return [];
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editRowRef.current && !editRowRef.current.contains(event.target as Node)) {
        saveInlineEdit();
      }
    };

    if (editingRowId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingRowId, inlineEditData]);

  const [formData, setFormData] = useState({
    nome: '',
    marca: '',
    modelo: '',
    ano: '',
    valor: '',
    cor: '',
    cilindrada: '',
    lote: '',
    nome_nf: '',
    pecas_retiradas: '',
    status: '',
    descricao: '',
    imagem: '',
    imagens: [] as string[]
  });

  const [editFormData, setEditFormData] = useState({
    nome: '',
    marca: '',
    modelo: '',
    ano: '',
    valor: '',
    cor: '',
    cilindrada: '',
    lote: '',
    nome_nf: '',
    pecas_retiradas: '',
    status: '',
    descricao: '',
    imagem: '',
    imagens: [] as string[]
  });

  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null);
  const [brandFilter, setBrandFilter] = useState('Todas');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [cilindradaFilter, setCilindradaFilter] = useState('Todas');
  const [sortOrder, setSortOrder] = useState('Data de Criação');
  const [anoMinFilter, setAnoMinFilter] = useState('');
  const [valorMinFilter, setValorMinFilter] = useState('');
  const [valorMaxFilter, setValorMaxFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');

  const closeModals = () => {
    setIsModalOpen(false);
    setIsEditModalOpen(false);
    setSelectedFiles([]);
  };

  const getStatusColor = (status: string, isBadge: boolean = false) => {
    switch (status) {
      case 'Disponível':
        return isBadge ? "bg-emerald-500 text-white" : "bg-emerald-500/10 text-emerald-500";
      case 'Desmontada':
        return isBadge ? "bg-amber-500 text-white" : "bg-amber-500/10 text-amber-500";
      case 'Vendida':
        return isBadge ? "bg-rose-500 text-white" : "bg-rose-500/10 text-rose-500";
      case 'Em estoque':
        return isBadge ? "bg-zinc-600 text-white" : "bg-zinc-500/10 text-zinc-400";
      default:
        return isBadge ? "bg-violet-500 text-white" : "bg-violet-500/10 text-violet-500";
    }
  };

  const handleRowClick = (item: any) => {
    if (editingRowId === item.id) return;
    
    if (clickTimer) {
      clearTimeout(clickTimer);
      setClickTimer(null);
      handleInlineEdit(item);
    } else {
      const timer = setTimeout(() => {
        onSelectItem(item);
        setClickTimer(null);
      }, 250);
      setClickTimer(timer);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedItems.map(item => item.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const idsToRemove = [...selectedIds];
    setIsBulkDeleteConfirmOpen(false);
    
    setMotos(prev => prev.filter(item => !idsToRemove.includes(item.id)));
    setSelectedIds([]);

    try {
      const response = await fetch('/api/motos/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToRemove })
      });
      
      if (!response.ok) throw new Error('Falha ao excluir motos');
    } catch (err: any) {
      alert(err.message);
      refreshData();
    }
  };

  const handleDeleteMoto = async () => {
    if (!itemToDelete) return;
    const idToRemove = itemToDelete;
    setIsDeleteConfirmOpen(false);
    
    setMotos(prev => prev.filter(item => item.id !== idToRemove));
    setSelectedIds(prev => prev.filter(i => i !== idToRemove));
    setItemToDelete(null);

    try {
      const response = await fetch(`/api/motos/${idToRemove}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Falha ao excluir moto');
    } catch (err: any) {
      alert(err.message);
      refreshData();
    }
  };

  const handleEditMoto = (moto: any) => {
    setEditingMoto(moto);
    setEditFormData({
      nome: moto.nome || '',
      marca: moto.marca || '',
      modelo: moto.modelo || '',
      ano: moto.ano || '',
      valor: moto.valor?.toString() || '',
      cor: moto.cor || '',
      cilindrada: moto.cilindrada?.toString() || '',
      lote: moto.lote || '',
      nome_nf: moto.nome_nf || '',
      pecas_retiradas: moto.pecas_retiradas || '',
      status: moto.status || '',
      descricao: moto.descricao || '',
      imagem: moto.imagem || '',
      imagens: moto.imagens || []
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateMoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMoto) return;
    setIsSaving(true);

    try {
      // Upload automático se houver arquivos pendentes
      let currentImagens = [...editFormData.imagens];
      let currentImagem = editFormData.imagem;

      if (selectedFiles.length > 0) {
        const uploadedUrls = await performUpload();
        if (uploadedUrls.length > 0) {
          currentImagens = [...currentImagens, ...uploadedUrls];
          if (!currentImagem) currentImagem = uploadedUrls[0];
        }
      }

      const motoId = editingMoto.id;
      
      // Garantir que os campos obrigatórios estejam presentes e formatados
      const payload = {
        nome: editFormData.nome || editingMoto.nome,
        marca: editFormData.marca || editingMoto.marca,
        modelo: editFormData.modelo || editingMoto.modelo,
        ano: editFormData.ano || editingMoto.ano,
        valor: Number(editFormData.valor) || editingMoto.valor,
        cor: editFormData.cor || editingMoto.cor,
        cilindrada: Number(editFormData.cilindrada) || editingMoto.cilindrada,
        lote: editFormData.lote || editingMoto.lote,
        nome_nf: editFormData.nome_nf || editingMoto.nome_nf,
        pecas_retiradas: editFormData.pecas_retiradas || editingMoto.pecas_retiradas,
        status: editFormData.status || editingMoto.status,
        descricao: editFormData.descricao || editingMoto.descricao,
        imagens: currentImagens
      };
      
      console.log('📤 Enviando atualização:', payload);
      
      const response = await fetch(`/api/motos/${motoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      console.log('📥 Resposta do servidor:', result);
      
      if (result.success) {
        // Atualizar o estado local com os dados retornados do servidor
        setMotos(prev => prev.map(m => m.id === motoId ? result.data : m));
        setIsEditModalOpen(false);
        setEditingMoto(null);
      } else {
        throw new Error(result.error || 'Erro ao atualizar');
      }
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
      refreshData();
    } finally {
      setIsSaving(false);
    }
  };

  const handleInlineEdit = (item: any) => {
    setEditingRowId(item.id);
    setInlineEditData({ ...item });
  };

  const saveInlineEdit = async () => {
    if (!editingRowId || !inlineEditData) return;
    const motoId = editingRowId;
    
    // Optimistic update
    setMotos(prev => prev.map(item => item.id === motoId ? { ...item, ...inlineEditData } : item));
    setEditingRowId(null);
    setInlineEditData(null);

    try {
      const response = await fetch(`/api/motos/${motoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inlineEditData)
      });
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Falha ao atualizar moto');
      }
      setMotos(prev => prev.map(item => item.id === motoId ? result.data : item));
    } catch (err: any) {
      alert(err.message);
      refreshData();
    }
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveInlineEdit();
    } else if (e.key === 'Escape') {
      setEditingRowId(null);
      setInlineEditData(null);
    }
  };

  const handleSaveMoto = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Upload automático se houver arquivos pendentes
      let currentImagens = [...formData.imagens];
      let currentImagem = formData.imagem;

      if (selectedFiles.length > 0) {
        const uploadedUrls = await performUpload();
        if (uploadedUrls.length > 0) {
          currentImagens = [...currentImagens, ...uploadedUrls];
          if (!currentImagem) currentImagem = uploadedUrls[0];
        }
      }

      const finalData = {
        ...formData,
        imagens: currentImagens,
        imagem: currentImagens[0] || ''
      };

      const response = await fetch('/api/motos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData)
      });
      
      const result = await response.json();
      if (result.success) {
        setMotos(prev => [result.data, ...prev]);
        setIsModalOpen(false);
        setFormData({
          nome: '',
          marca: '',
          modelo: '',
          ano: '',
          valor: '',
          cor: '',
          cilindrada: '',
          lote: '',
          nome_nf: '',
          pecas_retiradas: '',
          status: '',
          descricao: '',
          imagem: '',
          imagens: []
        });
      } else {
        throw new Error(result.error || 'Falha ao salvar moto');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const brands = useMemo(() => {
    const b = new Set(items.map(item => item.marca).filter(Boolean));
    return ['Todas', ...Array.from(b)];
  }, [items]);

  const statuses = useMemo(() => {
    const s = new Set(['Disponível', 'Em estoque', 'Desmontada', 'Vendida']);
    items.forEach(item => {
      if (item.status) s.add(item.status);
    });
    return ['Todos', ...Array.from(s)];
  }, [items]);

  const cilindradas = useMemo(() => {
    const c = new Set(items.map(item => item.cilindrada).filter(Boolean));
    return ['Todas', ...Array.from(c)];
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = [...items];

    if (searchTerm) {
      const searchTerms = searchTerm.toLowerCase().split(' ').filter(t => t.length > 0);
      result = result.filter(item => 
        searchTerms.every(term => 
          (item.nome?.toLowerCase() || '').includes(term) ||
          (item.marca?.toLowerCase() || '').includes(term) ||
          (item.modelo?.toLowerCase() || '').includes(term) ||
          (item.rk_id?.toLowerCase() || '').includes(term) ||
          (item.lote?.toLowerCase() || '').includes(term)
        )
      );
    }

    if (brandFilter && brandFilter !== 'Todas') {
      result = result.filter(item => item.marca === brandFilter);
    }

    if (statusFilter && statusFilter !== 'Todos') {
      result = result.filter(item => item.status === statusFilter);
    }

    if (cilindradaFilter && cilindradaFilter !== 'Todas') {
      result = result.filter(item => item.cilindrada === cilindradaFilter);
    }

    if (anoMinFilter) {
      result = result.filter(item => Number(item.ano) >= Number(anoMinFilter));
    }

    if (valorMinFilter) {
      result = result.filter(item => item.valor >= Number(valorMinFilter));
    }

    if (valorMaxFilter) {
      result = result.filter(item => item.valor <= Number(valorMaxFilter));
    }

    // Ordenar
    result.sort((a, b) => {
      // 1. Prioridade Máxima: Vendidas sempre para o final
      const aIsSold = a.status === 'Vendida';
      const bIsSold = b.status === 'Vendida';
      if (aIsSold && !bIsSold) return 1;
      if (!aIsSold && bIsSold) return -1;

      // 2. Prioridade Secundária: Com fotos no topo (se não for vendida)
      const aHasPhotos = (a.imagens && a.imagens.length > 0) || (a.imagem && a.imagem !== '');
      const bHasPhotos = (b.imagens && b.imagens.length > 0) || (b.imagem && b.imagem !== '');
      
      if (aHasPhotos && !bHasPhotos) return -1;
      if (!aHasPhotos && bHasPhotos) return 1;

      // 3. Ordenação selecionada
      let comparison = 0;
      switch (sortOrder) {
        case 'Cilindrada':
          comparison = (Number(a.cilindrada) || 0) - (Number(b.cilindrada) || 0);
          break;
        case 'Nome':
          comparison = (a.nome || '').localeCompare(b.nome || '');
          break;
        case 'Data de Criação':
          comparison = new Date(b.criado_em || 0).getTime() - new Date(a.criado_em || 0).getTime();
          break;
        case 'Ano':
          comparison = (Number(a.ano) || 0) - (Number(b.ano) || 0);
          break;
        case 'Valor':
          comparison = (a.valor || 0) - (b.valor || 0);
          break;
        case 'Lote':
          comparison = (a.lote || '').localeCompare(b.lote || '');
          break;
        default:
          // Default: Recentemente adicionadas (Data de Criação desc)
          comparison = new Date(b.criado_em || 0).getTime() - new Date(a.criado_em || 0).getTime();
      }
      
      return comparison;
    });

    return result;
  }, [items, searchTerm, brandFilter, statusFilter, cilindradaFilter, anoMinFilter, valorMinFilter, valorMaxFilter, sortOrder]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-400 gap-4">
        <Loader2 className="animate-spin text-violet-500" size={40} />
        <p className="animate-pulse">Carregando motos do Notion...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={cn(
        "border p-6 rounded-2xl space-y-6 transition-all duration-300",
        theme === 'dark' 
          ? "bg-zinc-900/40 border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)]" 
          : "bg-white border-zinc-200 shadow-sm"
      )}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nome, marca, modelo..." 
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className={cn(
                "w-full border rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none transition-all",
                theme === 'dark' 
                  ? "bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-violet-500" 
                  : "bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-violet-500"
              )}
            />
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-500 uppercase">Marca:</span>
              <select
                value={brandFilter}
                onChange={(e) => {
                  setBrandFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className={cn(
                  "border rounded-xl py-2 px-3 text-xs outline-none transition-all cursor-pointer",
                  theme === 'dark' 
                    ? "bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-violet-500" 
                    : "bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-violet-500"
                )}
              >
                {brands.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-500 uppercase">Ordenar por:</span>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className={cn(
                  "border rounded-xl py-2 px-3 text-xs outline-none transition-all cursor-pointer",
                  theme === 'dark' 
                    ? "bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-violet-500" 
                    : "bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-violet-500"
                )}
              >
                <option value="Data de Criação">Data de Criação</option>
                <option value="Nome">Nome</option>
                <option value="Cilindrada">Cilindrada</option>
                <option value="Ano">Ano</option>
                <option value="Valor">Valor</option>
                <option value="Lote">Lote</option>
              </select>
            </div>

            <div className="flex items-center gap-1 border rounded-xl p-1 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
              <button 
                onClick={() => setViewMode('table')}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  viewMode === 'table' 
                    ? "bg-violet-600 text-white shadow-sm" 
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                )}
              >
                <TableIcon size={16} />
              </button>
              <button 
                onClick={() => setViewMode('card')}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  viewMode === 'card' 
                    ? "bg-violet-600 text-white shadow-sm" 
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                )}
              >
                <LayoutGrid size={16} />
              </button>
            </div>

            <button 
              onClick={handleManualRefresh}
              disabled={loading || isRefreshing}
              className={cn(
                "p-2.5 rounded-xl transition-all border",
                theme === 'dark' 
                  ? "text-zinc-400 border-zinc-800/50 hover:text-white hover:bg-zinc-800/50" 
                  : "text-zinc-500 border-zinc-200 hover:text-zinc-900 hover:bg-zinc-100"
              )}
            >
              <RefreshCw size={18} className={cn((loading || isRefreshing) && "animate-spin")} />
            </button>

            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-[0_8px_20px_rgba(139,92,246,0.3)] font-bold tracking-tight"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Nova Moto</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-zinc-800/30">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-500 uppercase">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className={cn(
                  "border rounded-xl py-2 px-3 text-xs outline-none transition-all cursor-pointer",
                  theme === 'dark' 
                    ? "bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-violet-500" 
                    : "bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-violet-500"
                )}
              >
                {statuses.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-500 uppercase">Cilindrada:</span>
              <select
                value={cilindradaFilter}
                onChange={(e) => {
                  setCilindradaFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className={cn(
                  "border rounded-xl py-2 px-3 text-xs outline-none transition-all cursor-pointer",
                  theme === 'dark' 
                    ? "bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-violet-500" 
                    : "bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-violet-500"
                )}
              >
                {cilindradas.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-500 uppercase">Ano Min:</span>
              <input 
                type="number"
                placeholder="Ex: 2015"
                value={anoMinFilter}
                onChange={(e) => {
                  setAnoMinFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className={cn(
                  "w-20 border rounded-xl py-2 px-3 text-xs outline-none transition-all",
                  theme === 'dark' 
                    ? "bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-violet-500" 
                    : "bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-violet-500"
                )}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-500 uppercase">Valor:</span>
              <div className="flex items-center gap-1">
                <input 
                  type="number"
                  placeholder="Min"
                  value={valorMinFilter}
                  onChange={(e) => {
                    setValorMinFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "w-24 border rounded-xl py-2 px-3 text-xs outline-none transition-all",
                    theme === 'dark' 
                      ? "bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-violet-500" 
                      : "bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-violet-500"
                  )}
                />
                <span className="text-zinc-500 text-xs">-</span>
                <input 
                  type="number"
                  placeholder="Max"
                  value={valorMaxFilter}
                  onChange={(e) => {
                    setValorMaxFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "w-24 border rounded-xl py-2 px-3 text-xs outline-none transition-all",
                    theme === 'dark' 
                      ? "bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-violet-500" 
                      : "bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-violet-500"
                  )}
                />
              </div>
            </div>
          </div>

          {(brandFilter !== 'Todas' || statusFilter !== 'Todos' || cilindradaFilter !== 'Todas' || anoMinFilter || valorMinFilter || valorMaxFilter) && (
            <button 
              onClick={() => {
                setBrandFilter('Todas');
                setStatusFilter('Todos');
                setCilindradaFilter('Todas');
                setAnoMinFilter('');
                setValorMinFilter('');
                setValorMaxFilter('');
                setCurrentPage(1);
              }}
              className="text-xs text-rose-400 hover:text-rose-300 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors ml-auto"
            >
              <X size={14} />
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className={cn(
          "border rounded-2xl overflow-hidden relative transition-all duration-300",
          theme === 'dark' 
            ? "bg-zinc-900/40 border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)]" 
            : "bg-white border-zinc-200 shadow-sm"
        )}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className={cn(
                  "transition-colors",
                  theme === 'dark' ? "bg-zinc-800/30" : "bg-zinc-50"
                )}>
                  <th className="px-6 py-4 w-10">
                    <div 
                      onClick={toggleSelectAll}
                      className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-all duration-200",
                        selectedIds.length === paginatedItems.length && paginatedItems.length > 0
                          ? "bg-violet-600 border-violet-600 shadow-[0_0_8px_rgba(139,92,246,0.3)]" 
                          : theme === 'dark' ? "border-zinc-700" : "border-zinc-300"
                      )}
                    >
                      {selectedIds.length === paginatedItems.length && paginatedItems.length > 0 && <Check className="text-white" size={14} />}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">ID</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Moto</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Marca/Modelo</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Ano</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Lote</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Valor</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className={cn(
                "divide-y transition-colors",
                theme === 'dark' ? "divide-zinc-800/30" : "divide-zinc-100"
              )}>
                {paginatedItems.map((item) => (
                  <tr 
                    key={item.id} 
                    ref={editingRowId === item.id ? editRowRef : null}
                    onClick={() => handleRowClick(item)}
                    className={cn(
                      "transition-all duration-200 group cursor-pointer",
                      selectedIds.includes(item.id) 
                        ? theme === 'dark' ? "bg-violet-500/10" : "bg-violet-50"
                        : theme === 'dark' ? "hover:bg-zinc-800/20" : "hover:bg-zinc-50",
                      editingRowId === item.id && (theme === 'dark' ? "bg-zinc-800/40" : "bg-zinc-100")
                    )}
                  >
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div 
                        onClick={() => toggleSelect(item.id)}
                        className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-all duration-200",
                          selectedIds.includes(item.id)
                            ? "bg-violet-600 border-violet-600 shadow-[0_0_8px_rgba(139,92,246,0.3)] opacity-100" 
                            : cn(
                                "opacity-0 group-hover:opacity-100",
                                theme === 'dark' ? "border-zinc-700 hover:border-zinc-500" : "border-zinc-300 hover:border-zinc-400"
                              )
                        )}
                      >
                        {selectedIds.includes(item.id) && <Check className="text-white" size={14} />}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-zinc-500">
                      {editingRowId === item.id ? (
                        <input 
                          autoFocus
                          type="text" 
                          value={inlineEditData.rk_id} 
                          onChange={(e) => setInlineEditData({...inlineEditData, rk_id: e.target.value})}
                          onKeyDown={handleInlineKeyDown}
                          className={cn("w-full bg-transparent border-b border-violet-500 outline-none px-1")}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : item.rk_id}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {item.imagem && (
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-zinc-800/50">
                            <img src={item.imagem} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        )}
                        {editingRowId === item.id ? (
                          <input 
                            type="text" 
                            value={inlineEditData.nome} 
                            onChange={(e) => setInlineEditData({...inlineEditData, nome: e.target.value})}
                            onKeyDown={handleInlineKeyDown}
                            className={cn("w-full bg-transparent border-b border-violet-500 outline-none px-1 text-sm font-bold", theme === 'dark' ? "text-white" : "text-zinc-900")}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className={cn("text-sm font-bold tracking-tight", theme === 'dark' ? "text-white" : "text-zinc-900")}>{item.nome}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-500">
                      {editingRowId === item.id ? (
                        <div className="flex gap-1">
                          <input 
                            type="text" 
                            value={inlineEditData.marca} 
                            onChange={(e) => setInlineEditData({...inlineEditData, marca: e.target.value})}
                            onKeyDown={handleInlineKeyDown}
                            className={cn("w-1/2 bg-transparent border-b border-violet-500 outline-none px-1")}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <input 
                            type="text" 
                            value={inlineEditData.modelo} 
                            onChange={(e) => setInlineEditData({...inlineEditData, modelo: e.target.value})}
                            onKeyDown={handleInlineKeyDown}
                            className={cn("w-1/2 bg-transparent border-b border-violet-500 outline-none px-1")}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      ) : (
                        `${item.marca} ${item.modelo}`
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500">
                      {editingRowId === item.id ? (
                        <input 
                          type="text" 
                          value={inlineEditData.ano} 
                          onChange={(e) => setInlineEditData({...inlineEditData, ano: e.target.value})}
                          onKeyDown={handleInlineKeyDown}
                          className={cn("w-full bg-transparent border-b border-violet-500 outline-none px-1")}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : item.ano}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500">
                      {editingRowId === item.id ? (
                        <input 
                          type="text" 
                          value={inlineEditData.lote} 
                          onChange={(e) => setInlineEditData({...inlineEditData, lote: e.target.value})}
                          onKeyDown={handleInlineKeyDown}
                          className={cn("w-full bg-transparent border-b border-violet-500 outline-none px-1")}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : item.lote}
                    </td>
                    <td className="px-6 py-4">
                      {editingRowId === item.id ? (
                        <select 
                          value={inlineEditData.status} 
                          onChange={(e) => setInlineEditData({...inlineEditData, status: e.target.value})}
                          onKeyDown={handleInlineKeyDown}
                          className={cn("w-full bg-transparent border-b border-violet-500 outline-none px-1 text-[10px] font-bold uppercase")}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="Disponível">Disponível</option>
                          <option value="Em estoque">Em estoque</option>
                          <option value="Desmontada">Desmontada</option>
                          <option value="Vendida">Vendida</option>
                        </select>
                      ) : (
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                          getStatusColor(item.status)
                        )}>
                          {item.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingRowId === item.id ? (
                        <input 
                          type="number" 
                          value={inlineEditData.valor} 
                          onChange={(e) => setInlineEditData({...inlineEditData, valor: Number(e.target.value)})}
                          onKeyDown={handleInlineKeyDown}
                          className={cn("w-full bg-transparent border-b border-violet-500 outline-none px-1 text-sm font-bold text-violet-400")}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-sm font-bold text-violet-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.2)]">
                          {formatCurrency(item.valor)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {editingRowId === item.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={saveInlineEdit}
                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all"
                          >
                            <Check size={14} />
                          </button>
                          <button 
                            onClick={() => { setEditingRowId(null); setInlineEditData(null); }}
                            className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEditMoto(item)}
                            className={cn(
                              "p-2 rounded-lg transition-all",
                              theme === 'dark' ? "bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-700" : "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
                            )}
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => {
                              setItemToDelete(item.id);
                              setIsDeleteConfirmOpen(true);
                            }}
                            className={cn(
                              "p-2 rounded-lg transition-all",
                              theme === 'dark' ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20" : "text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                            )}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {paginatedItems.map((item) => (
            <MotoCard 
              key={item.id}
              item={item}
              theme={theme}
              onSelectItem={onSelectItem}
              handleEditMoto={handleEditMoto}
              setItemToDelete={setItemToDelete}
              setIsDeleteConfirmOpen={setIsDeleteConfirmOpen}
              getStatusColor={getStatusColor}
            />
          ))}
        </div>
      )}

      <div className={cn(
          "p-4 border-t flex items-center justify-between transition-colors",
          theme === 'dark' ? "bg-zinc-900/30 border-zinc-800/50" : "bg-zinc-50 border-zinc-200"
        )}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total: {filteredItems.length} motos</span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={cn(
                "p-1.5 border rounded-lg disabled:opacity-30 transition-all",
                theme === 'dark' ? "border-zinc-800 hover:bg-zinc-800" : "border-zinc-200 hover:bg-zinc-100"
              )}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold text-zinc-400">Página {currentPage} de {totalPages}</span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className={cn(
                "p-1.5 border rounded-lg disabled:opacity-30 transition-all",
                theme === 'dark' ? "border-zinc-800 hover:bg-zinc-800" : "border-zinc-200 hover:bg-zinc-100"
              )}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

      {/* Modal Nova Moto */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={cn(
                "w-full max-w-2xl max-h-[90vh] rounded-3xl border shadow-2xl relative overflow-hidden",
                theme === 'dark' ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800/50 text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <form onSubmit={handleSaveMoto} className="flex flex-col max-h-[90vh]">
                <button type="button" onClick={closeModals} className="absolute top-6 right-6 p-2 hover:bg-zinc-800 rounded-full transition-colors z-10">
                  <X size={20} className="text-zinc-500" />
                </button>

                <div className="p-8 pb-4 flex items-center gap-4 border-b border-zinc-800/50">
                  <div className="p-3 bg-violet-600/10 rounded-2xl">
                    <Plus className="text-violet-500" size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Nova Moto</h2>
                    <p className="text-sm text-zinc-500">Adicione uma nova moto ao catálogo</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                  <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Nome/Título</label>
                    <input required type="text" value={formData.nome} onChange={(e) => setFormData({...formData, nome: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Marca</label>
                    <input type="text" value={formData.marca} onChange={(e) => setFormData({...formData, marca: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Modelo</label>
                    <input type="text" value={formData.modelo} onChange={(e) => setFormData({...formData, modelo: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Ano</label>
                    <input type="text" value={formData.ano} onChange={(e) => setFormData({...formData, ano: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Cilindrada</label>
                    <input type="number" value={formData.cilindrada} onChange={(e) => setFormData({...formData, cilindrada: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Valor (R$)</label>
                    <input required type="number" value={formData.valor} onChange={(e) => setFormData({...formData, valor: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Cor</label>
                    <input type="text" value={formData.cor} onChange={(e) => setFormData({...formData, cor: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Lote</label>
                    <input type="text" value={formData.lote} onChange={(e) => setFormData({...formData, lote: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Status</label>
                    <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")}>
                      <option value="">Selecione...</option>
                      <option value="Disponível">Disponível</option>
                      <option value="Em estoque">Em estoque</option>
                      <option value="Desmontada">Desmontada</option>
                      <option value="Vendida">Vendida</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Nome NF</label>
                    <input type="text" value={formData.nome_nf} onChange={(e) => setFormData({...formData, nome_nf: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Peças Retiradas</label>
                  <input type="text" value={formData.pecas_retiradas} onChange={(e) => setFormData({...formData, pecas_retiradas: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Fotos (Máx 15)</label>
                  
                  {/* Imagens já salvas */}
                  {formData.imagens.length > 0 && (
                    <Reorder.Group 
                      axis="x" 
                      values={formData.imagens} 
                      onReorder={(newOrder) => setFormData({...formData, imagens: newOrder})}
                      className="flex gap-2 mb-3 overflow-x-auto pb-2 custom-scrollbar"
                    >
                      {formData.imagens.map((img) => (
                        <Reorder.Item 
                          key={img} 
                          value={img}
                          layout
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="relative flex-shrink-0 w-24 aspect-square rounded-lg overflow-hidden border border-zinc-800 group cursor-grab active:cursor-grabbing"
                        >
                          <img src={img} className="w-full h-full object-cover pointer-events-none" referrerPolicy="no-referrer" />
                          <button 
                            type="button"
                            onClick={() => setFormData({...formData, imagens: formData.imagens.filter((i) => i !== img)})}
                            className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          >
                            <X size={10} />
                          </button>
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <Layers size={16} className="text-white/70" />
                          </div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  )}

                  {/* Pré-visualização das imagens selecionadas */}
                  {selectedFiles.length > 0 && (
                    <Reorder.Group 
                      axis="x" 
                      values={selectedFiles} 
                      onReorder={setSelectedFiles}
                      className="flex gap-2 mb-3 overflow-x-auto pb-2 custom-scrollbar"
                    >
                      {selectedFiles.map((file) => (
                        <Reorder.Item 
                          key={file.name + file.size + file.lastModified} 
                          value={file}
                          layout
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="relative flex-shrink-0 w-24 group aspect-square cursor-grab active:cursor-grabbing"
                        >
                          <img 
                            src={URL.createObjectURL(file)} 
                            alt={file.name}
                            className="w-full h-full object-cover rounded-lg border border-zinc-700 pointer-events-none"
                          />
                          <button
                            type="button"
                            onClick={() => setSelectedFiles(prev => prev.filter(f => f !== file))}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          >
                            <X size={14} />
                          </button>
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none rounded-lg">
                            <Layers size={16} className="text-white/70" />
                          </div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  )}
                  
                  {/* Botão de adicionar fotos */}
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={selectedFiles.length + formData.imagens.length >= 15}
                      className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <Plus size={18} />
                      Selecionar Fotos ({selectedFiles.length + formData.imagens.length}/15)
                    </button>
                    
                    {selectedFiles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => uploadFiles(false)}
                        disabled={uploading}
                        className="px-4 py-2 bg-violet-600 rounded-xl hover:bg-violet-500 transition-colors flex items-center gap-2 text-sm font-bold"
                      >
                        {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                        {uploading ? 'Enviando...' : 'Fazer Upload'}
                      </button>
                    )}
                  </div>
                  
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase font-bold tracking-widest">
                    Selecione imagens do seu computador (máx 15)
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Descrição</label>
                  <textarea rows={3} value={formData.descricao} onChange={(e) => setFormData({...formData, descricao: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                </div>
              </div>

              <div className="p-6 border-t border-zinc-800/50 bg-zinc-900/20 flex items-center justify-end gap-3">
                  <button type="button" onClick={closeModals} className="px-6 py-2.5 text-sm font-medium">Cancelar</button>
                  <button 
                    type="submit"
                    disabled={isSaving} 
                    className="px-8 py-2.5 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-500 flex items-center gap-2"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Salvar Moto
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Editar Moto */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={cn(
                "w-full max-w-2xl max-h-[90vh] rounded-3xl border shadow-2xl relative overflow-hidden",
                theme === 'dark' ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800/50 text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <form onSubmit={handleUpdateMoto} className="flex flex-col max-h-[90vh]">
                <button type="button" onClick={closeModals} className="absolute top-6 right-6 p-2 hover:bg-zinc-800 rounded-full transition-colors z-10">
                  <X size={20} className="text-zinc-500" />
                </button>

                <div className="p-8 pb-4 flex items-center gap-4 border-b border-zinc-800/50">
                  <div className="p-3 bg-violet-600/10 rounded-2xl">
                    <Edit className="text-violet-500" size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Editar Moto</h2>
                    <p className="text-sm text-zinc-500">Atualize as informações da moto</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                  <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Nome/Título</label>
                    <input required type="text" value={editFormData.nome} onChange={(e) => setEditFormData({...editFormData, nome: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Marca</label>
                    <input type="text" value={editFormData.marca} onChange={(e) => setEditFormData({...editFormData, marca: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Modelo</label>
                    <input type="text" value={editFormData.modelo} onChange={(e) => setEditFormData({...editFormData, modelo: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Ano</label>
                    <input type="text" value={editFormData.ano} onChange={(e) => setEditFormData({...editFormData, ano: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Cilindrada</label>
                    <input type="number" value={editFormData.cilindrada} onChange={(e) => setEditFormData({...editFormData, cilindrada: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Valor (R$)</label>
                    <input required type="number" value={editFormData.valor} onChange={(e) => setEditFormData({...editFormData, valor: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Cor</label>
                    <input type="text" value={editFormData.cor} onChange={(e) => setEditFormData({...editFormData, cor: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Lote</label>
                    <input type="text" value={editFormData.lote} onChange={(e) => setEditFormData({...editFormData, lote: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Status</label>
                    <select value={editFormData.status} onChange={(e) => setEditFormData({...editFormData, status: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")}>
                      <option value="">Selecione...</option>
                      <option value="Disponível">Disponível</option>
                      <option value="Em estoque">Em estoque</option>
                      <option value="Desmontada">Desmontada</option>
                      <option value="Vendida">Vendida</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Nome NF</label>
                    <input type="text" value={editFormData.nome_nf} onChange={(e) => setEditFormData({...editFormData, nome_nf: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Peças Retiradas</label>
                  <input type="text" value={editFormData.pecas_retiradas} onChange={(e) => setEditFormData({...editFormData, pecas_retiradas: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Fotos (Máx 15)</label>
                  
                  {/* Imagens já salvas */}
                  {editFormData.imagens.length > 0 && (
                    <Reorder.Group 
                      axis="x" 
                      values={editFormData.imagens} 
                      onReorder={(newOrder) => setEditFormData({...editFormData, imagens: newOrder})}
                      className="flex gap-2 mb-3 overflow-x-auto pb-2 custom-scrollbar"
                    >
                      {editFormData.imagens.map((img) => (
                        <Reorder.Item 
                          key={img} 
                          value={img}
                          layout
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="relative flex-shrink-0 w-24 aspect-square rounded-lg overflow-hidden border border-zinc-800 group cursor-grab active:cursor-grabbing"
                        >
                          <img src={img} className="w-full h-full object-cover pointer-events-none" referrerPolicy="no-referrer" />
                          <button 
                            type="button"
                            onClick={() => setEditFormData({...editFormData, imagens: editFormData.imagens.filter((i) => i !== img)})}
                            className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          >
                            <X size={10} />
                          </button>
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <Layers size={16} className="text-white/70" />
                          </div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  )}

                  {/* Pré-visualização das imagens selecionadas */}
                  {selectedFiles.length > 0 && (
                    <Reorder.Group 
                      axis="x" 
                      values={selectedFiles} 
                      onReorder={setSelectedFiles}
                      className="flex gap-2 mb-3 overflow-x-auto pb-2 custom-scrollbar"
                    >
                      {selectedFiles.map((file) => (
                        <Reorder.Item 
                          key={file.name + file.size + file.lastModified} 
                          value={file}
                          layout
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="relative flex-shrink-0 w-24 group aspect-square cursor-grab active:cursor-grabbing"
                        >
                          <img 
                            src={URL.createObjectURL(file)} 
                            alt={file.name}
                            className="w-full h-full object-cover rounded-lg border border-zinc-700 pointer-events-none"
                          />
                          <button
                            type="button"
                            onClick={() => setSelectedFiles(prev => prev.filter(f => f !== file))}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          >
                            <X size={14} />
                          </button>
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none rounded-lg">
                            <Layers size={16} className="text-white/70" />
                          </div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  )}
                  
                  {/* Botão de adicionar fotos */}
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={selectedFiles.length + editFormData.imagens.length >= 15}
                      className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <Plus size={18} />
                      Selecionar Fotos ({selectedFiles.length + editFormData.imagens.length}/15)
                    </button>
                    
                    {selectedFiles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => uploadFiles(true)}
                        disabled={uploading}
                        className="px-4 py-2 bg-violet-600 rounded-xl hover:bg-violet-500 transition-colors flex items-center gap-2 text-sm font-bold"
                      >
                        {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                        {uploading ? 'Enviando...' : 'Fazer Upload'}
                      </button>
                    )}
                  </div>
                  
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase font-bold tracking-widest">
                    Selecione imagens do seu computador (máx 15)
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Descrição</label>
                  <textarea rows={3} value={editFormData.descricao} onChange={(e) => setEditFormData({...editFormData, descricao: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                </div>
              </div>

              <div className="p-6 border-t border-zinc-800/50 bg-zinc-900/20 flex items-center justify-end gap-3">
                  <button type="button" onClick={closeModals} className="px-6 py-2.5 text-sm font-medium">Cancelar</button>
                  <button 
                    type="submit"
                    disabled={isSaving} 
                    className="px-8 py-2.5 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-500 flex items-center gap-2"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Confirmação Exclusão */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className={cn("w-full max-w-md p-8 rounded-3xl border shadow-2xl text-center", theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900")}>
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Excluir Moto?</h3>
              <p className="text-zinc-500 text-sm mb-8">Esta ação não pode ser desfeita. A moto será removida do Notion.</p>
              <div className="flex items-center gap-3">
                <button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-3 rounded-xl font-medium bg-zinc-800">Cancelar</button>
                <button onClick={handleDeleteMoto} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold">Excluir</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className={cn("fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl", theme === 'dark' ? "bg-zinc-900/90 border-zinc-800 text-white" : "bg-white/90 border-zinc-200 text-zinc-900")}>
            <span className="text-sm font-medium mr-4">{selectedIds.length} moto(s) selecionada(s)</span>
            <div className="flex items-center gap-2 border-l pl-4 border-zinc-800">
              <button onClick={() => setIsBulkDeleteConfirmOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-rose-600/10 text-rose-500 hover:bg-rose-600 hover:text-white rounded-xl text-sm font-bold transition-all">
                <Trash2 size={16} />
                Excluir Selecionadas
              </button>
              <button onClick={() => setSelectedIds([])} className="px-4 py-2 text-sm font-medium text-zinc-500">Cancelar</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Confirmação Exclusão em Massa */}
      <AnimatePresence>
        {isBulkDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className={cn("w-full max-w-md p-8 rounded-3xl border shadow-2xl text-center", theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900")}>
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Excluir {selectedIds.length} Motos?</h3>
              <p className="text-zinc-500 text-sm mb-8">Esta ação removerá permanentemente todas as motos selecionadas.</p>
              <div className="flex items-center gap-3">
                <button onClick={() => setIsBulkDeleteConfirmOpen(false)} className="flex-1 py-3 rounded-xl font-medium bg-zinc-800">Cancelar</button>
                <button onClick={handleBulkDelete} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold">Excluir Todas</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}

// =============================================================================
// DETAIL MODAL COMPONENT
// =============================================================================

const DetailModal = ({ item, onClose, theme }: { item: any, onClose: () => void, theme: 'light' | 'dark' }) => {
  if (!item) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={cn(
          "w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl border shadow-2xl flex flex-col",
          theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
        )}
      >
        {/* Header */}
        <div className={cn(
          "p-6 border-b flex items-center justify-between",
          theme === 'dark' ? "bg-zinc-900/50 border-zinc-800/50" : "bg-zinc-50 border-zinc-100"
        )}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-600/20 text-violet-500">
              {item.tipo ? <ShoppingCart size={24} /> : <Package size={24} />}
            </div>
            <div>
              <h3 className={cn("text-xl font-bold", theme === 'dark' ? "text-white" : "text-zinc-900")}>{item.nome}</h3>
              <p className="text-zinc-500 text-sm">{item.rk_id || 'Sem ID'}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className={cn(
              "p-2 rounded-full transition-colors",
              theme === 'dark' ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-zinc-100 text-zinc-500"
            )}
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Image Section */}
          {(item.imagens && item.imagens.length > 0) ? (
            <div className="space-y-3">
              <div className={cn(
                "w-full aspect-video rounded-2xl overflow-hidden border bg-zinc-950/50",
                theme === 'dark' ? "border-zinc-800/50" : "border-zinc-200"
              )}>
                <img src={item.imagens[0]} alt={item.nome} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              </div>
              {item.imagens.length > 1 && (
                <div className="grid grid-cols-5 gap-2">
                  {item.imagens.slice(1).map((img: string, idx: number) => (
                    <div key={idx} className={cn(
                      "aspect-square rounded-lg overflow-hidden border bg-zinc-950/50",
                      theme === 'dark' ? "border-zinc-800/50" : "border-zinc-200"
                    )}>
                      <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : item.imagem && (
            <div className={cn(
              "w-full aspect-video rounded-2xl overflow-hidden border bg-zinc-950/50",
              theme === 'dark' ? "border-zinc-800/50" : "border-zinc-200"
            )}>
              <img src={item.imagem} alt={item.nome} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DetailItem label="Valor" value={formatCurrency(item.valor)} theme={theme} highlight />
            {item.estoque !== undefined && <DetailItem label="Estoque" value={`${item.estoque} unidades`} theme={theme} />}
            {item.tipo && <DetailItem label="Meio de Pagamento" value={item.tipo} theme={theme} />}
            {item.moto && <DetailItem label="Moto Compatível" value={item.moto} theme={theme} />}
            {item.marca && <DetailItem label="Marca" value={item.marca} theme={theme} />}
            {item.modelo && <DetailItem label="Modelo" value={item.modelo} theme={theme} />}
            {item.ano && <DetailItem label="Ano" value={item.ano} theme={theme} />}
            {item.cilindrada && <DetailItem label="Cilindrada" value={`${item.cilindrada} cc`} theme={theme} />}
            {item.lote && <DetailItem label="Lote" value={item.lote} theme={theme} />}
            {item.status && <DetailItem label="Status" value={item.status} theme={theme} />}
            {item.cor && <DetailItem label="Cor" value={item.cor} theme={theme} />}
            {item.categoria && <DetailItem label="Categoria" value={item.categoria} theme={theme} />}
            {item.data && <DetailItem label="Data da Transação" value={formatDate(item.data)} theme={theme} />}
            {item.criado_em && <DetailItem label="Cadastrado em" value={formatDate(item.criado_em)} theme={theme} />}
          </div>

          {/* Additional Info */}
          {(item.nome_nf || item.pecas_retiradas) && (
            <div className="grid grid-cols-1 gap-4">
              {item.nome_nf && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Nome NF</h4>
                  <div className={cn(
                    "p-4 rounded-xl border text-sm leading-relaxed",
                    theme === 'dark' ? "bg-zinc-950/50 border-zinc-800 text-zinc-300" : "bg-zinc-50 border-zinc-200 text-zinc-700"
                  )}>
                    {item.nome_nf}
                  </div>
                </div>
              )}
              {item.pecas_retiradas && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Peças Retiradas</h4>
                  <div className={cn(
                    "p-4 rounded-xl border text-sm leading-relaxed",
                    theme === 'dark' ? "bg-zinc-950/50 border-zinc-800 text-zinc-300" : "bg-zinc-50 border-zinc-200 text-zinc-700"
                  )}>
                    {item.pecas_retiradas}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {item.descricao && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Descrição / Observações</h4>
              <div className={cn(
                "p-4 rounded-xl border text-sm leading-relaxed",
                theme === 'dark' ? "bg-zinc-950/50 border-zinc-800 text-zinc-300" : "bg-zinc-50 border-zinc-200 text-zinc-700"
              )}>
                {item.descricao}
              </div>
            </div>
          )}

          {/* Links */}
          {item.ml_link && (
            <a 
              href={item.ml_link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-yellow-500 text-black font-bold rounded-xl hover:bg-yellow-400 transition-all shadow-lg shadow-yellow-500/20"
            >
              <ExternalLink size={18} />
              Ver no Mercado Livre
            </a>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const DetailItem = ({ label, value, theme, highlight }: { label: string, value: string | number, theme: 'light' | 'dark', highlight?: boolean }) => (
  <div className={cn(
    "p-4 rounded-2xl border transition-colors",
    theme === 'dark' ? "bg-zinc-950/50 border-zinc-800/50" : "bg-zinc-50 border-zinc-200"
  )}>
    <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">{label}</p>
    <p className={cn(
      "text-sm font-bold",
      highlight ? "text-emerald-400" : theme === 'dark' ? "text-zinc-200" : "text-zinc-900"
    )}>{value}</p>
  </div>
);

// =============================================================================
// MOTO CARD COMPONENT
// =============================================================================

const MOTO_COLORS: Record<string, string> = {
  'Preta': '#000000',
  'Branca': '#FFFFFF',
  'Vermelha': '#EF4444',
  'Azul': '#3B82F6',
  'Amarela': '#FBBF24',
  'Verde': '#10B981',
  'Cinza': '#6B7280',
  'Prata': '#D1D5DB',
  'Dourada': '#F59E0B',
  'Laranja': '#F97316',
  'Roxa': '#8B5CF6',
  'Rosa': '#EC4899',
  'Marrom': '#78350F',
  'Bege': '#F5F5DC',
  'Vinho': '#7F1D1D',
  'Grafite': '#374151',
  'Cobre': '#B45309',
  'Titanium': '#4B5563',
  'Azul Marinho': '#1E3A8A',
  'Verde Militar': '#365314'
};

const getMotoColor = (colorName: string) => {
  if (!colorName) return 'transparent';
  const normalized = colorName.trim().charAt(0).toUpperCase() + colorName.trim().slice(1).toLowerCase();
  return MOTO_COLORS[normalized] || 'transparent';
};

const MotoCard = ({ item, theme, onSelectItem, handleEditMoto, setItemToDelete, setIsDeleteConfirmOpen, getStatusColor }: any) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const images = useMemo(() => {
    const imgs = item.imagens && item.imagens.length > 0 ? item.imagens : (item.imagem ? [item.imagem] : []);
    return imgs.filter(Boolean);
  }, [item.imagens, item.imagem]);

  // Preload images for smoother experience
  useEffect(() => {
    if (images.length > 0) {
      images.forEach(src => {
        const img = new Image();
        img.src = src;
      });
    }
  }, [images]);

  const handleMouseLeave = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    // Volta instantaneamente a disparar o reset, mas a transição suave é mantida pelo CSS
    setCurrentImageIndex(0);
  };

  const handleMouseEnter = () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleWheel = (e: WheelEvent) => {
      if (images.length <= 1) return;
      
      // Prevent page scroll when hovering and scrolling on the card
      if (e.deltaY !== 0) {
        e.preventDefault();
        e.stopPropagation();
        
        if (e.deltaY > 0) {
          setCurrentImageIndex((prev) => (prev + 1) % images.length);
        } else {
          setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
        }
      }
    };

    // Add listener with passive: false to allow preventDefault
    card.addEventListener('wheel', handleWheel, { passive: false });
    return () => card.removeEventListener('wheel', handleWheel);
  }, [images.length]);

  return (
    <div 
      ref={cardRef}
      onClick={() => onSelectItem(item)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "group relative border rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer flex flex-col h-full",
        theme === 'dark' 
          ? "bg-zinc-900/40 border-zinc-800/50 hover:border-violet-500/50 hover:shadow-[0_8px_30px_rgba(139,92,246,0.1)]" 
          : "bg-white border-zinc-200 hover:border-violet-500/50 hover:shadow-lg",
        item.status === 'Vendida' && "opacity-60 grayscale-[0.5] brightness-75"
      )}
    >
      {/* Image Container */}
      <div className="aspect-[4/3] relative overflow-hidden bg-zinc-100 dark:bg-zinc-950">
        {images.length > 0 ? (
          <div className="w-full h-full relative">
            {imgLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900">
                <Loader2 size={24} className="animate-spin text-violet-500/50" />
              </div>
            )}
            <div 
              className="flex transition-transform duration-500 ease-out h-full"
              style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
            >
              {images.map((src: string, idx: number) => (
                <div key={idx} className="w-full h-full flex-shrink-0 relative">
                  <img 
                    src={src} 
                    onLoad={() => idx === currentImageIndex && setImgLoading(false)}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (idx === currentImageIndex) {
                        console.error("Failed to load image:", src);
                        // Hide failed image to show the icon behind it
                        target.style.display = 'none';
                      } else {
                        target.style.display = 'none';
                      }
                    }}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer" 
                  />
                  {/* Fallback if single image fails */}
                  <div className="absolute inset-0 -z-10 flex flex-col items-center justify-center text-zinc-400 bg-zinc-100 dark:bg-zinc-900/50">
                    <Bike size={48} strokeWidth={1} className="opacity-20" />
                    <span className="text-[10px] uppercase font-bold tracking-tighter mt-2 opacity-40">Erro ao carregar</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Image Indicators */}
            {images.length > 1 && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 px-2">
                {images.map((_: any, idx: number) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "h-1 rounded-full transition-all duration-300 shadow-sm",
                      idx === currentImageIndex ? "w-6 bg-white" : "w-1.5 bg-white/40"
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 bg-zinc-100 dark:bg-zinc-900/50">
            <Bike size={48} strokeWidth={1} className="opacity-20" />
            <span className="text-[10px] uppercase font-bold tracking-tighter mt-2 opacity-40">Sem Imagem</span>
          </div>
        )}
        
        {/* Status Badge - Improved */}
        <div className="absolute top-3 left-3">
          <span className={cn(
            "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg backdrop-blur-md border border-white/10",
            getStatusColor(item.status, true)
          )}>
            {item.status}
          </span>
        </div>

        {/* Quick Actions - Repositioned to top right */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
          <button 
            onClick={(e) => { e.stopPropagation(); handleEditMoto(item); }}
            className="p-2.5 rounded-xl bg-white/90 backdrop-blur-sm text-zinc-900 hover:bg-violet-500 hover:text-white transition-all shadow-xl border border-zinc-200/50"
          >
            <Edit size={16} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setItemToDelete(item.id); setIsDeleteConfirmOpen(true); }}
            className="p-2.5 rounded-xl bg-white/90 backdrop-blur-sm text-zinc-900 hover:bg-rose-500 hover:text-white transition-all shadow-xl border border-zinc-200/50"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">{item.marca}</span>
            </div>
            <span className="text-[10px] font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{item.rk_id}</span>
          </div>
          
          <div>
            <h3 className={cn(
              "font-black text-xl leading-tight line-clamp-1 tracking-tight",
              theme === 'dark' ? "text-white" : "text-zinc-900"
            )}>
              {item.nome && item.nome !== '-' ? item.nome : (item.modelo && item.modelo !== '-' ? item.modelo : 'Moto sem Nome')}
            </h3>
            {item.nome && item.nome !== '-' && item.modelo && item.modelo !== '-' && item.nome !== item.modelo && (
              <p className="text-xs text-zinc-500 font-medium mt-0.5">{item.modelo}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-y-2 gap-x-3 pt-1">
            {item.lote && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-900/50 px-2 py-1 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <Layers size={12} className="text-violet-500" />
                <span className="font-bold">Lote: {item.lote}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-900/50 px-2 py-1 rounded-lg border border-zinc-100 dark:border-zinc-800">
              <Calendar size={12} className="text-violet-500" />
              <span>{item.ano}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-900/50 px-2 py-1 rounded-lg border border-zinc-100 dark:border-zinc-800">
              <div 
                className="w-2.5 h-2.5 rounded-full border border-zinc-300 dark:border-zinc-700 shadow-inner" 
                style={{ backgroundColor: getMotoColor(item.cor) }} 
              />
              <span>{item.cor || '-'}</span>
            </div>
            {item.cilindrada && item.cilindrada !== '-' && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-900/50 px-2 py-1 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <TrendingUp size={12} className="text-violet-500" />
                <span>{item.cilindrada}cc</span>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Investimento</span>
            <span className="text-xl font-black text-violet-500">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500 group-hover:bg-violet-500 group-hover:text-white transition-all duration-300 shadow-sm group-hover:shadow-violet-500/20">
            <ChevronRight size={20} />
          </div>
        </div>
      </div>
    </div>
  );
};

function AppContent() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'estoque' | 'vendas' | 'motos' | 'atendimento'>('dashboard');
  const [selectedDetailItem, setSelectedDetailItem] = useState<any | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const socket = io();
    socket.on('whatsapp-notification', (data: { count: number }) => {
      setUnreadCount(data.count);
    });

    // A contagem agora pode vir das conversas globais, mas mantemos o fetch inicial por segurança
    /*
    fetch('/api/whatsapp/messages')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUnreadCount(data.data.filter((m: any) => m.status === 'unread').length);
        }
      });
    */

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300 flex font-sans",
      theme === 'dark' 
        ? "bg-[radial-gradient(ellipse_at_top,_#1a1b1f,_#09090b)] text-zinc-100" 
        : "bg-zinc-50 text-zinc-900"
    )}>
      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:sticky top-0 h-screen inset-y-0 left-0 z-50 transition-all duration-300 ease-in-out border-r",
        theme === 'dark' ? "bg-zinc-950/50 border-zinc-800/50 backdrop-blur-xl" : "bg-white border-zinc-200 shadow-xl",
        isSidebarOpen ? "w-64" : "w-20",
        !isSidebarOpen && "-translate-x-full lg:translate-x-0"
      )}>
        <div className={cn(
          "h-full flex flex-col p-4",
          theme === 'dark' ? "bg-transparent" : "bg-white"
        )}>
          <div className="flex items-center gap-3 px-2 mb-10 overflow-hidden">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-600/20">
              <Wrench className="text-white" size={24} />
            </div>
            {isSidebarOpen && (
              <motion.span 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "text-xl font-bold tracking-tight whitespace-nowrap transition-colors",
                  theme === 'dark' ? "text-white" : "text-zinc-900"
                )}
              >
                RK <span className="text-violet-500">SUCATAS</span>
              </motion.span>
            )}
          </div>

          <nav className="flex-1 space-y-2">
            <SidebarItem 
              icon={LayoutDashboard} 
              label={isSidebarOpen ? "Dashboard" : ""} 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
              theme={theme}
            />
            <SidebarItem 
              icon={Package} 
              label={isSidebarOpen ? "Estoque" : ""} 
              active={activeTab === 'estoque'} 
              onClick={() => setActiveTab('estoque')} 
              theme={theme}
            />
            <SidebarItem 
              icon={ShoppingCart} 
              label={isSidebarOpen ? "Vendas" : ""} 
              active={activeTab === 'vendas'} 
              onClick={() => setActiveTab('vendas')} 
              theme={theme}
            />
            <SidebarItem 
              icon={Bike} 
              label={isSidebarOpen ? "Motos" : ""} 
              active={activeTab === 'motos'} 
              onClick={() => setActiveTab('motos')} 
              theme={theme}
            />
            <SidebarItem 
              icon={MessageSquare} 
              label={isSidebarOpen ? "Atendimento" : ""} 
              active={activeTab === 'atendimento'} 
              onClick={() => setActiveTab('atendimento')} 
              theme={theme}
              badge={unreadCount > 0 ? unreadCount : undefined}
            />
            <SidebarItem 
              icon={TrendingUp} 
              label={isSidebarOpen ? "Mercado Livre" : ""} 
              active={activeTab === 'mercadolivre'} 
              onClick={() => setActiveTab('mercadolivre')} 
              theme={theme}
            />
          </nav>

          <div className={cn(
            "mt-auto p-4 rounded-2xl border transition-colors",
            theme === 'dark' ? "bg-zinc-900/50 border-zinc-800" : "bg-zinc-100 border-zinc-200"
          )}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-tr from-violet-500 to-fuchsia-500" />
              {isSidebarOpen && (
                <div className="overflow-hidden">
                  <p className={cn(
                    "text-sm font-medium truncate transition-colors",
                    theme === 'dark' ? "text-zinc-100" : "text-zinc-900"
                  )}>Admin User</p>
                  <p className="text-xs text-zinc-500 truncate">oryanzin09@gmail.com</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className={cn(
          "h-16 border-b backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-40 transition-colors",
          theme === 'dark' ? "bg-zinc-950/40 border-zinc-800/50" : "bg-white/50 border-zinc-200"
        )}>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                theme === 'dark' ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-zinc-100 text-zinc-600"
              )}
            >
              <Menu size={20} />
            </button>
            <h2 className={cn(
              "text-lg font-semibold capitalize transition-colors",
              theme === 'dark' ? "text-white" : "text-zinc-900"
            )}>{activeTab}</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className={cn(
              "hidden md:flex items-center gap-2 border px-3 py-1.5 rounded-lg transition-colors focus-within:border-violet-500",
              theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-zinc-400" : "bg-zinc-100 border-zinc-200 text-zinc-600"
            )}>
              <Search size={16} />
              <input 
                type="text" 
                placeholder="Pesquisar..." 
                className="bg-transparent border-none outline-none text-sm w-48"
              />
            </div>
            
            <button 
              onClick={toggleTheme}
              className={cn(
                "p-2 rounded-lg transition-all duration-300",
                theme === 'dark' ? "hover:bg-zinc-800 text-amber-400" : "hover:bg-zinc-100 text-violet-600"
              )}
              title={theme === 'dark' ? "Mudar para modo claro" : "Mudar para modo escuro"}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <button className={cn(
              "p-2 rounded-lg relative transition-colors",
              theme === 'dark' ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-zinc-100 text-zinc-600"
            )}>
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-violet-500 rounded-full border-2 border-zinc-950" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' ? (
                <DashboardView theme={theme} onSelectItem={setSelectedDetailItem} />
              ) : activeTab === 'estoque' ? (
                <InventoryView theme={theme} onSelectItem={setSelectedDetailItem} />
              ) : activeTab === 'vendas' ? (
                <SalesView theme={theme} onSelectItem={setSelectedDetailItem} />
              ) : activeTab === 'motos' ? (
                <MotosView theme={theme} onSelectItem={setSelectedDetailItem} />
              ) : activeTab === 'atendimento' ? (
                <Atendimento theme={theme} />
              ) : activeTab === 'mercadolivre' ? (
                <MercadoLivre theme={theme} />
              ) : (
                <div className={cn(
                  "flex flex-col items-center justify-center h-[60vh] transition-colors",
                  theme === 'dark' ? "text-zinc-500" : "text-zinc-400"
                )}>
                  <Settings size={48} className="mb-4 opacity-20" />
                  <p className="text-lg">Funcionalidade em desenvolvimento</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <FloatingAIChat theme={theme} />
      
      {/* Modal de Detalhes Global */}
      <AnimatePresence>
        {selectedDetailItem && (
          <DetailModal 
            item={selectedDetailItem} 
            theme={theme} 
            onClose={() => setSelectedDetailItem(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
