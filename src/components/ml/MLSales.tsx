import React, { useState, useEffect } from 'react';
import { Package, Printer, RefreshCw, Truck, AlertCircle, Search, Clock, CheckCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { mlApiFetch } from '../../utils/api';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getStatusInfo = (sale: any) => {
  if (sale.has_dispute) {
    return { label: 'Mediação', color: 'bg-red-500/20 text-red-400', icon: AlertCircle, description: 'Responda à mediação para prosseguir.', action: 'responder_mediacao' };
  }
  
  const shippingStatus = String(sale.shipping_status || '');
  const status = String(sale.status || '');
  
  // Handle reprint status explicitly
  if (shippingStatus.includes('reprint') || status.includes('REIMPRIMIR') || shippingStatus.includes('REIMPRIMIR')) {
    return { label: 'Reimprimir Etiqueta', color: 'bg-blue-500/20 text-blue-400', icon: Printer, description: 'A etiqueta precisa ser impressa novamente.', action: 'imprimir_etiqueta' };
  }

  if (shippingStatus === 'ready_to_ship_ready_to_print' || shippingStatus === 'ready_to_print') {
    return { label: 'Pronta para gerar etiqueta', color: 'bg-blue-500/20 text-blue-400', icon: Printer, description: 'Você deve despachar o pacote hoje ou amanhã.', action: 'imprimir_etiqueta' };
  }
  if (shippingStatus === 'ready_to_ship_printed' || shippingStatus === 'printed') {
    return { label: 'Etiqueta impressa', color: 'bg-amber-500/20 text-amber-400', icon: Package, description: 'Aguardando despacho.', action: 'imprimir_etiqueta' };
  }
  if (shippingStatus === 'ready_to_ship_invoice_pending' || shippingStatus === 'invoice_pending') {
    return { label: 'Aguardando nota fiscal', color: 'bg-orange-500/20 text-orange-400', icon: AlertCircle, description: 'Emita a NF para liberar a etiqueta.', action: 'emitir_nf' };
  }
  if (shippingStatus === 'ready_to_ship') {
    return { label: 'Pronta para envio', color: 'bg-blue-500/20 text-blue-400', icon: Printer, description: 'Você deve despachar o pacote.', action: 'imprimir_etiqueta' };
  }
  if (shippingStatus.startsWith('shipped')) {
    return { label: 'Em trânsito', color: 'bg-violet-500/20 text-violet-400', icon: Truck, description: 'O pacote está a caminho do comprador.', action: 'acompanhar_envio' };
  }
  if (shippingStatus.startsWith('delivered')) {
    return { label: 'Entregue', color: 'bg-emerald-500/20 text-emerald-400', icon: CheckCircle, description: 'O pacote foi entregue ao comprador.', action: 'ver_detalhes' };
  }
  if (shippingStatus.startsWith('cancelled') || shippingStatus.startsWith('not_delivered') || sale.is_cancelled) {
    return { label: 'Cancelada/Não entregue', color: 'bg-red-500/20 text-red-400', icon: AlertCircle, description: 'Venda cancelada ou não entregue.', action: 'ver_detalhes' };
  }

  switch (shippingStatus) {
    case 'pending':
      return { label: 'Envio pendente', color: 'bg-amber-500/20 text-amber-400', icon: Clock, description: 'Aguardando liberação da etiqueta.', action: 'ver_detalhes' };
    default:
      return { label: sale.status || 'Pago', color: 'bg-zinc-500/20 text-zinc-400', icon: Package, description: 'Aguardando atualização de envio.', action: 'ver_detalhes' };
  }
};

export const MLSales = ({ theme }: { theme: string }) => {
  const [sales, setSales] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

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
      
      const contentType = res.headers.get('Content-Type');
      const isZip = contentType === 'application/zip';
      const extension = isZip ? 'zip' : 'pdf';
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `etiqueta-${shippingId}.${extension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao baixar etiqueta:', err);
      alert('Erro ao baixar etiqueta.');
    }
  };



  const tabs = [
    { 
      id: 'pending', 
      label: 'Prontas para Envio', 
      filter: (s: any) => {
        const isCancelled = s.is_cancelled || s.status === 'cancelled' || String(s.shipping_status).startsWith('cancelled') || String(s.shipping_status).startsWith('not_delivered');
        const isReadyToShip = String(s.shipping_status).startsWith('ready_to_ship') || s.shipping_status === 'pending';
        return isReadyToShip && !isCancelled && !s.has_dispute;
      }
    },
    { id: 'dispute', label: 'Aguardando', filter: (s: any) => s.has_dispute },
    { id: 'shipped', label: 'Em trânsito', filter: (s: any) => String(s.shipping_status).startsWith('shipped') },
    { id: 'delivered', label: 'Finalizadas', filter: (s: any) => String(s.shipping_status).startsWith('delivered') },
  ];

  const filteredSales = sales.filter(s => {
    const currentTab = tabs.find(t => t.id === activeTab);
    const isMatch = currentTab?.filter(s);
    if (activeTab === 'pending' && !isMatch) {
      console.log('Sale filtered out from pending:', s.id, 'Status:', s.shipping_status, 'Status2:', s.status, 'Dispute:', s.has_dispute, 'Cancelled:', s.is_cancelled);
    }
    return isMatch;
  });

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
      {/* Coluna Principal: Pedidos */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center gap-2 p-1 bg-zinc-900/50 rounded-xl w-fit border border-zinc-800">
          {tabs.map(tab => {
            const count = sales.filter(s => tab.filter(s)).length;
            if (tab.id === 'dispute' && count === 0) return null;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
                  activeTab === tab.id
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {tab.label}
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full",
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-zinc-800 text-zinc-500"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          {filteredSales.length === 0 ? (
            <div className={cn(
              "p-12 text-center border border-dashed rounded-2xl",
              theme === 'dark' ? "border-zinc-800 text-zinc-600" : "border-zinc-200 text-zinc-400"
            )}>
              <Package size={40} className="mx-auto mb-4 opacity-20" />
              <p>Nenhuma encomenda nesta categoria.</p>
            </div>
          ) : (
            filteredSales.sort((a,b) => new Date(b.data).getTime() - new Date(a.data).getTime()).map(sale => {
              const statusInfo = getStatusInfo(sale);
              return (
                <div key={sale.id} className={cn(
                  "border rounded-2xl p-4 flex flex-col gap-4 transition-all",
                  theme === 'dark' ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-200"
                )}>
                  <div className="flex items-center justify-between border-b pb-3 border-zinc-800/50">
                    <div className="flex items-center gap-3">
                      <span className="bg-amber-400 text-black text-[10px] font-black px-1.5 py-0.5 rounded">ML</span>
                      <span className="text-xs text-zinc-400 font-medium">#{sale.id}</span>
                      <span className="text-xs text-zinc-500">|</span>
                      <span className="text-xs text-zinc-400">{new Date(sale.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-xs font-bold", theme === 'dark' ? "text-zinc-300" : "text-zinc-700")}>{sale.cliente}</p>
                      <p className="text-[10px] text-zinc-500">{sale.nickname}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700">
                        <img src={sale.thumbnail} alt={sale.itens} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h4 className={cn("font-bold text-sm line-clamp-1", theme === 'dark' ? "text-white" : "text-zinc-900")}>{sale.itens}</h4>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{statusInfo.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-md flex items-center gap-1", statusInfo.color)}>
                            <statusInfo.icon size={10} />
                            {statusInfo.label}
                          </span>
                          <span className="text-xs text-zinc-500 font-medium">
                            R$ {Number(sale.valor || 0).toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {statusInfo.action === 'responder_mediacao' && (
                        <button
                          onClick={() => window.open(`https://myaccount.mercadolivre.com.br/messaging/orders/${sale.id}`, '_blank')}
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-red-500/20"
                        >
                          Responder mediação
                        </button>
                      )}
                      {statusInfo.action === 'imprimir_etiqueta' && (
                        <button
                          onClick={() => printLabel(sale.shipping_id)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                        >
                          <Printer size={14} /> Imprimir Etiqueta
                        </button>
                      )}
                      {statusInfo.action === 'emitir_nf' && (
                        <button
                          onClick={() => window.open(`https://myaccount.mercadolivre.com.br/sales/${sale.id}/detail`, '_blank')}
                          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-orange-500/20"
                        >
                          <AlertCircle size={14} /> Emitir NF
                        </button>
                      )}
                      {statusInfo.action === 'acompanhar_envio' && (
                        <button
                          onClick={() => window.open(`https://myaccount.mercadolivre.com.br/sales/${sale.id}/detail`, '_blank')}
                          className="bg-violet-500 hover:bg-violet-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-violet-500/20"
                        >
                          <Truck size={14} /> Acompanhar Envio
                        </button>
                      )}
                      <button
                        onClick={() => window.open(`https://myaccount.mercadolivre.com.br/sales/${sale.id}/detail`, '_blank')}
                        className={cn(
                          "px-4 py-2 rounded-lg text-xs font-bold border transition-all",
                          theme === 'dark' ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800" : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                        )}
                      >
                        Detalhes
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Barra Lateral: Anúncios Recentes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className={cn("text-lg font-bold", theme === 'dark' ? "text-white" : "text-zinc-900")}>
            Anúncios Recentes
          </h3>
          <button className="text-[10px] font-bold text-violet-500 uppercase tracking-wider hover:text-violet-400">Ver todos</button>
        </div>
        <div className="space-y-3">
          {listings.map(item => (
            <div key={item.id} className={cn(
              "border rounded-xl p-3 flex items-center gap-3 group transition-all hover:border-violet-500/50",
              theme === 'dark' ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-200"
            )}>
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700 flex-shrink-0">
                <img src={item.thumbnail} alt={item.titulo} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={cn("font-medium text-xs truncate", theme === 'dark' ? "text-white" : "text-zinc-900")}>{item.titulo}</h4>
                <div className="flex items-center justify-between mt-1">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider",
                    item.status === 'active' ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"
                  )}>
                    {item.status === 'active' ? 'Ativo' : 'Pausado'}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-medium">{item.vendidos} vendidos</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
