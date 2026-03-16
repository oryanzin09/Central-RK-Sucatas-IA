import React, { useState, useEffect } from 'react';
import { Package, MessageSquare, TrendingUp, ShoppingCart, DollarSign, RefreshCw, ExternalLink } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { mlApiFetch } from '../../utils/api';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MLDashboard = ({ theme }: { theme: string }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log(`🔍 Buscando dados do período: ${period}`);
      const result = await mlApiFetch(`/api/ml/dashboard?period=${period}`);
      console.log('📦 Resposta da API:', result);
      
      if (result.success) {
        console.log('✅ Dados recebidos:', result.data);
        setData(result.data);
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
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
      {/* Seletor de período */}
      <div className="flex justify-end gap-2">
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

      {/* Gráficos placeholder - você pode adicionar dados reais depois */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={cn(
          "border p-6 rounded-2xl h-[300px] flex items-center justify-center",
          theme === 'dark' ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-200"
        )}>
          <p className="text-zinc-500">Gráfico de vendas em breve</p>
        </div>
        <div className={cn(
          "border p-6 rounded-2xl h-[300px] flex items-center justify-center",
          theme === 'dark' ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-200"
        )}>
          <p className="text-zinc-500">Distribuição por status</p>
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
      <p className={cn("text-2xl font-bold mt-1", theme === 'dark' ? "text-white" : "text-zinc-900")}>{value}</p>
      <p className={cn("text-xs mt-1", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")}>{subValue}</p>
    </div>
  );
};
