import React, { useState, useEffect } from 'react';
import { Package, MessageSquare, TrendingUp, ShoppingCart, DollarSign, RefreshCw, ExternalLink } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { api } from '../../utils/api';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MLDashboard = ({ theme }: { theme: string }) => {
  const [data, setData] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('rk_ml_dashboard');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(!data);
  const [period, setPeriod] = useState('30d');

  const fetchData = async (forceRefresh = false) => {
    if (!data) setLoading(true);
    try {
      if (forceRefresh) {
        await api.post('/api/ml/cache/clear', {});
      }
      console.log(`🔍 Buscando dados do período: ${period}`);
      const result = await api.get(`/api/ml/dashboard?period=${period}`);
      console.log('📦 Resposta da API:', result);
      
      if (result.success) {
        console.log('✅ Dados recebidos:', result.data);
        setData(result.data);
        try { localStorage.setItem('rk_ml_dashboard', JSON.stringify(result.data)); } catch (e) {}
      } else {
        console.error('❌ Erro na resposta:', result.error);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados ML:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  const formatCurrency = (value: any) => {
    const num = Number(value);
    if (isNaN(num)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(num);
  };

  const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-400 gap-4">
        <RefreshCw className="animate-spin text-violet-500" size={40} />
        <p>Carregando dados do Mercado Livre...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Seletor de período e Sincronizar */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => fetchData(true)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 active:scale-95",
            theme === 'dark' ? "bg-zinc-800 text-zinc-400 hover:text-white" : "bg-zinc-200 text-zinc-600 hover:text-zinc-900"
          )}
          title="Sincronizar com Mercado Livre (Limpar Cache)"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          <span>Sincronizar</span>
        </button>

        <div className="flex gap-2">
          {['7d', '30d', '90d'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                period === p
                  ? "bg-violet-600 text-white"
                  : theme === 'dark' ? "bg-zinc-800 text-zinc-400 hover:text-white" : "bg-zinc-200 text-zinc-600 hover:text-zinc-900"
              )}
            >
              {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
            </button>
          ))}
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Package}
          label="Total de Anúncios"
          value={data?.totalListings || 0}
          subValue={`${data?.activeListings || 0} ativos no momento`}
          color="bg-blue-500"
          theme={theme}
        />
        <MetricCard
          icon={MessageSquare}
          label="Perguntas Pendentes"
          value={data?.pendingQuestions || 0}
          subValue="aguardando resposta"
          color="bg-amber-500"
          theme={theme}
        />
        <MetricCard
          icon={TrendingUp}
          label="Vendas (Mês)"
          value={formatCurrency(data?.monthlySales)}
          subValue="faturamento ML"
          color="bg-emerald-500"
          theme={theme}
        />
        <MetricCard
          icon={ShoppingCart}
          label="Ticket Médio ML"
          value={formatCurrency(data?.avgTicket)}
          subValue="por venda"
          color="bg-violet-500"
          theme={theme}
        />
      </div>

      {/* Gráficos Reais */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={cn(
          "lg:col-span-2 border p-6 rounded-2xl h-[400px] flex flex-col",
          theme === 'dark' ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-200"
        )}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={cn("font-bold", theme === 'dark' ? "text-white" : "text-zinc-900")}>Desempenho de Vendas</h3>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-violet-500"></div>
              <span className="text-xs text-zinc-500">Faturamento Diário</span>
            </div>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.chartData || []}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? "#27272a" : "#e4e4e7"} />
                <XAxis 
                  dataKey="label" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#71717a' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#71717a' }}
                  tickFormatter={(value) => `R$ ${value}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
                    borderColor: theme === 'dark' ? '#27272a' : '#e4e4e7',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: theme === 'dark' ? '#f4f4f5' : '#18181b'
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Vendas']}
                />
                <Area 
                  type="monotone" 
                  dataKey="vendas" 
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={cn(
          "border p-6 rounded-2xl flex flex-col",
          theme === 'dark' ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-200"
        )}>
          <h3 className={cn("font-bold mb-6", theme === 'dark' ? "text-white" : "text-zinc-900")}>Vendas Recentes</h3>
          <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {data?.recentSales?.map((sale: any) => (
              <div key={sale.id} className="flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden border border-zinc-700 flex-shrink-0">
                  <img src={sale.thumbnail} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-bold truncate", theme === 'dark' ? "text-zinc-200" : "text-zinc-900")}>{sale.cliente}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{sale.itens}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-emerald-500">{formatCurrency(sale.valor)}</p>
                  <p className="text-[9px] text-zinc-500">{new Date(sale.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p>
                </div>
              </div>
            ))}
            {(!data?.recentSales || data.recentSales.length === 0) && (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 italic text-sm py-10">
                <ShoppingCart size={32} className="opacity-10 mb-2" />
                <p>Nenhuma venda recente</p>
              </div>
            )}
          </div>
          <button className="w-full mt-4 py-2 text-xs font-bold text-zinc-500 hover:text-violet-500 transition-colors border-t border-zinc-800/50 pt-4">
            Ver todas as vendas
          </button>
        </div>
      </div>

      {/* Anúncios Recentes */}
      <div className={cn(
        "border p-6 rounded-2xl",
        theme === 'dark' ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-200"
      )}>
        <div className="flex items-center justify-between mb-6">
          <h3 className={cn("text-lg font-bold", theme === 'dark' ? "text-white" : "text-zinc-900")}>Anúncios Recentes</h3>
          <button className="text-xs font-bold text-violet-500 hover:text-violet-400 transition-colors uppercase tracking-wider">Ver Todos</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {data?.recentListings?.map((item: any) => (
            <div key={item.id} className={cn(
              "border rounded-xl overflow-hidden group transition-all hover:border-violet-500/50",
              theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-zinc-50 border-zinc-200"
            )}>
              <div className="aspect-video relative overflow-hidden bg-zinc-800">
                <>
                  <img 
                    src={item.thumbnail} 
                    alt={item.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 -z-10">
                    <Package size={24} className="text-zinc-600" />
                  </div>
                </>
                <div className="absolute top-2 right-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider",
                    item.status === 'active' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-zinc-500/20 text-zinc-400 border border-zinc-500/30"
                  )}>
                    {item.status}
                  </span>
                </div>
              </div>
              <div className="p-3">
                <p className={cn("text-xs font-bold line-clamp-2 h-8 leading-tight", theme === 'dark' ? "text-zinc-200" : "text-zinc-900")}>{item.title}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-violet-500 font-bold text-sm">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}</span>
                  <button className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    theme === 'dark' ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-400" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-600"
                  )}>
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {(!data?.recentListings || data.recentListings.length === 0) && (
            <div className="col-span-full py-12 text-center text-zinc-500 italic text-sm">
              Nenhum anúncio recente encontrado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ icon: Icon, label, value, subValue, color, theme }: any) => {
  const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');
  return (
    <div className={cn(
      "border rounded-2xl p-6",
      theme === 'dark' ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-200"
    )}>
      <div className={cn("p-3 rounded-xl w-fit mb-4", color)}>
        <Icon className="text-white" size={24} />
      </div>
      <p className={cn("text-xs uppercase font-medium", theme === 'dark' ? "text-zinc-500" : "text-zinc-500")}>{label}</p>
      <p className={cn("text-2xl font-bold mt-1", theme === 'dark' ? "text-white" : "text-zinc-900")}>
        {typeof value === 'number' && isNaN(value) ? "0" : (value || "0")}
      </p>
      <p className={cn("text-xs mt-1", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")}>{subValue}</p>
    </div>
  );
};
