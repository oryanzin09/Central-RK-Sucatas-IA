import React, { useState, useEffect } from 'react';
import { Package, MessageSquare, TrendingUp, ShoppingCart, DollarSign, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export const MLDashboard = ({ theme }: { theme: string }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log(`🔍 Buscando dados do período: ${period}`);
      const response = await fetch(`/api/ml/dashboard?period=${period}`);
      const result = await response.json();
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
          label="Anúncios Ativos"
          value={data?.activeListings || 0}
          subValue="itens publicados"
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
