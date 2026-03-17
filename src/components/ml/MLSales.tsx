import React, { useState, useEffect } from 'react';
import { Package, Printer, RefreshCw, Truck, AlertCircle, Search } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { mlApiFetch } from '../../utils/api';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MLSales = ({ theme }: { theme: string }) => {
  const [sales, setSales] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [salesRes, listingsRes] = await Promise.all([
        mlApiFetch('/api/ml/sales'),
        mlApiFetch('/api/ml/listings?status=active&limit=5')
      ]);
      if (salesRes.success) setSales(salesRes.data);
      if (listingsRes.success) setListings(listingsRes.data);
    } catch (error) {
      console.error('Erro ao carregar dados ML:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const printLabel = async (shippingId: string) => {
    try {
      const res = await fetch(`/api/ml/shipment-label/${shippingId}`);
      if (!res.ok) throw new Error('Falha ao baixar etiqueta');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `etiqueta-${shippingId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao baixar etiqueta:', err);
      alert('Erro ao baixar etiqueta.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-400 gap-4">
        <RefreshCw className="animate-spin text-violet-500" size={40} />
        <p>Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Coluna Principal: Pedidos a processar */}
      <div className="lg:col-span-2 space-y-4">
        <h3 className={cn("text-lg font-bold", theme === 'dark' ? "text-white" : "text-zinc-900")}>
          Pedidos a processar
        </h3>
        {sales.filter(s => ['ready_to_print', 'pending', 'paid'].includes(s.shipping_status || s.status)).sort((a,b) => new Date(b.data).getTime() - new Date(a.data).getTime()).map(sale => (
          <div key={sale.id} className={cn(
            "border rounded-2xl p-4 flex items-center justify-between",
            theme === 'dark' ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-200"
          )}>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-zinc-800 rounded-lg overflow-hidden">
                <img src={sale.thumbnail} alt={sale.itens} className="w-full h-full object-cover" />
              </div>
              <div>
                <h4 className={cn("font-bold", theme === 'dark' ? "text-white" : "text-zinc-900")}>{sale.itens}</h4>
                <p className="text-sm text-zinc-500">{sale.cliente} • {new Date(sale.data).toLocaleDateString('pt-BR')}</p>
                <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full", sale.shipping_status === 'ready_to_print' ? "bg-amber-500/20 text-amber-500" : "bg-zinc-500/20 text-zinc-500")}>
                  {sale.shipping_status === 'ready_to_print' ? 'Envio pendente' : 'Pagamento aprovado'}
                </span>
              </div>
            </div>
            {sale.shipping_status === 'ready_to_print' && (
              <button
                onClick={() => printLabel(sale.shipping_id)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
              >
                <Printer size={16} /> Gerar Etiqueta
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Barra Lateral: Anúncios Recentes */}
      <div className="space-y-4">
        <h3 className={cn("text-lg font-bold", theme === 'dark' ? "text-white" : "text-zinc-900")}>
          Anúncios Recentes
        </h3>
        {listings.map(item => (
          <div key={item.id} className={cn(
            "border rounded-xl p-3 flex items-center gap-3",
            theme === 'dark' ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-200"
          )}>
            <img src={item.thumbnail} alt={item.titulo} className="w-12 h-12 rounded-lg object-cover" />
            <div className="flex-1 min-w-0">
              <h4 className={cn("font-medium text-sm truncate", theme === 'dark' ? "text-white" : "text-zinc-900")}>{item.titulo}</h4>
              <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                <span className={cn("px-1.5 py-0.5 rounded", item.status === 'active' ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500")}>
                  {item.status === 'active' ? 'Ativo' : 'Pausado'}
                </span>
                <span>{item.vendidos} vendidos</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
