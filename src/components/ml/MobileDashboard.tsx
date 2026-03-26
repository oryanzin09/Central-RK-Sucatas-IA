import React, { useState, useEffect } from 'react';
import { Package, MessageSquare, TrendingUp, ShoppingCart, ExternalLink } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { api } from '../../utils/api';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MobileDashboard = ({ theme }: { theme: string }) => {
  const [data, setData] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('rk_ml_dashboard_mobile');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(!data);

  useEffect(() => {
    const fetchData = async () => {
      if (!data) setLoading(true);
      try {
        const result = await api.get(`/api/ml/dashboard?period=30d`);
        if (result.success) {
          setData(result.data);
          try { localStorage.setItem('rk_ml_dashboard_mobile', JSON.stringify(result.data)); } catch (e) {}
        }
      } catch (error) {
        console.error('Erro ao carregar dados ML:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  if (loading) return <div className="text-center p-4">Carregando...</div>;

  return (
    <div className="space-y-4 pb-4">
      {/* Grid de Métricas 2x2 (Alta densidade) */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={Package} label="Anúncios" value={data?.totalListings || 0} color="text-blue-400" theme={theme} />
        <MetricCard icon={MessageSquare} label="Perguntas" value={data?.pendingQuestions || 0} color="text-amber-400" theme={theme} />
        <MetricCard icon={TrendingUp} label="Vendas (Mês)" value={formatCurrency(data?.monthlySales)} color="text-emerald-400" theme={theme} />
        <MetricCard icon={ShoppingCart} label="Ticket Médio" value={formatCurrency(data?.avgTicket)} color="text-violet-400" theme={theme} />
      </div>

      {/* Gráfico Compacto */}
      <div className={cn("p-4 rounded-2xl border", theme === 'dark' ? "bg-zinc-900/50 border-zinc-800" : "bg-white border-zinc-200")}>
        <h3 className={cn("text-xs font-bold mb-3 uppercase tracking-wider", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")}>Tendência de Vendas</h3>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={[{v:10}, {v:30}, {v:20}, {v:50}, {v:40}, {v:70}]}>
              <Area type="monotone" dataKey="v" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lista de Anúncios Ultra-compacta */}
      <div className={cn("p-4 rounded-2xl border", theme === 'dark' ? "bg-zinc-900/50 border-zinc-800" : "bg-white border-zinc-200")}>
        <h3 className={cn("text-xs font-bold mb-3 uppercase tracking-wider", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")}>Anúncios Recentes</h3>
        <div className="space-y-3">
          {data?.recentListings?.slice(0, 4).map((item: any) => (
            <div key={item.id} className="flex items-center gap-3">
              <img src={item.thumbnail} alt={item.title} className="w-10 h-10 rounded-lg object-cover bg-zinc-800" referrerPolicy="no-referrer" />
              <div className="flex-1 min-w-0">
                <p className={cn("text-xs font-medium truncate", theme === 'dark' ? "text-zinc-200" : "text-zinc-900")}>{item.title}</p>
                <p className="text-[10px] text-violet-500 font-bold">{formatCurrency(item.price)}</p>
              </div>
              <ExternalLink size={14} className="text-zinc-600" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ icon: Icon, label, value, color, theme }: any) => (
  <div className={cn("p-3 rounded-2xl border flex flex-col justify-between", theme === 'dark' ? "bg-zinc-900/50 border-zinc-800" : "bg-white border-zinc-200")}>
    <Icon className={cn("mb-2", color)} size={18} />
    <p className={cn("text-[10px] uppercase font-medium", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")}>{label}</p>
    <p className={cn("text-sm font-bold mt-0.5", theme === 'dark' ? "text-white" : "text-zinc-900")}>{value}</p>
  </div>
);
