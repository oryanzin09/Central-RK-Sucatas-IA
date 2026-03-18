import React, { useState, useEffect, useMemo } from 'react';
import { Search, Package, ExternalLink, RefreshCw, ChevronLeft, ChevronRight, Eye, Tag, ShoppingBag, Edit2, Plus, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { mlApiFetch } from '../../utils/api';
import { cn } from '../../utils';
import { CustomDropdown } from '../CustomDropdown';
import { CATEGORIAS_OFICIAIS, MOTOS_OFICIAIS } from '../../constants/lists';

export const MLCatalog = ({ theme }: { theme: string }) => {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState('active');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMoto, setSelectedMoto] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [newItem, setNewItem] = useState({
    title: '',
    price: '',
    stock: '1',
    category: '',
    moto: '',
    description: ''
  });
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [motos, setMotos] = useState<string[]>([]);
  const itemsPerPage = 20;

  const fetchListings = async (forceRefresh = false) => {
    setLoading(true);
    try {
      if (forceRefresh) {
        await mlApiFetch('/api/ml/cache/clear', { method: 'POST' });
      }

      const offset = (currentPage - 1) * itemsPerPage;
      let url = `/api/ml/listings?status=${status}&limit=${itemsPerPage}&offset=${offset}`;
      
      if (selectedCategory !== 'all') {
        url += `&category=${encodeURIComponent(selectedCategory)}`;
      }
      if (selectedMoto !== 'all') {
        url += `&moto=${encodeURIComponent(selectedMoto)}`;
      }

      const result = await mlApiFetch(url);
      if (result.success) {
        setListings(result.data);
        setTotal(result.total || 0);
      }
    } catch (error) {
      console.error('Erro ao buscar anúncios:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotionData = async () => {
    try {
      const [catRes, motoRes] = await Promise.all([
        mlApiFetch('/api/notion/categories'),
        mlApiFetch('/api/notion/motos')
      ]);
      if (catRes.success) setCategories(catRes.data);
      if (motoRes.success) setMotos(motoRes.data);
    } catch (error) {
      console.error('Erro ao buscar dados do Notion:', error);
    }
  };

  useEffect(() => {
    fetchListings();
  }, [status, currentPage, selectedCategory, selectedMoto]);

  useEffect(() => {
    fetchNotionData();
  }, []);

  const filteredListings = listings.filter(item => 
    item.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(total / itemsPerPage);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleEdit = (item: any) => {
    setEditingItem({ ...item });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setSaving(true);
    try {
      const updateData = {
        title: editingItem.titulo,
        price: editingItem.preco,
        available_quantity: editingItem.estoque,
        status: editingItem.status
      };
      
      const result = await mlApiFetch(`/api/ml/listings/${editingItem.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      
      if (result.success) {
        setIsEditModalOpen(false);
        fetchListings();
      }
    } catch (error) {
      console.error('Erro ao salvar edição:', error);
      alert('Erro ao salvar as alterações no Mercado Livre.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateListing = async () => {
    if (!newItem.title || !newItem.price) {
      alert('Por favor, preencha o título e o preço.');
      return;
    }
    
    setSaving(true);
    try {
      const result = await mlApiFetch('/api/inventory', {
        method: 'POST',
        body: JSON.stringify({
          nome: newItem.title,
          categoria: newItem.category,
          moto: newItem.moto,
          valor: newItem.price,
          estoque: newItem.stock,
          descricao: newItem.description
        })
      });
      
      if (result.success) {
        setIsAddModalOpen(false);
        setNewItem({
          title: '',
          price: '',
          stock: '1',
          category: '',
          moto: '',
          description: ''
        });
        fetchListings();
        alert('Anúncio criado com sucesso no Notion!');
      }
    } catch (error) {
      console.error('Erro ao criar anúncio:', error);
      alert('Erro ao criar o anúncio.');
    } finally {
      setSaving(false);
    }
  };

  const statusOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Ativos' },
    { value: 'paused', label: 'Pausados' },
    { value: 'closed', label: 'Encerrados' },
    { value: 'under_review', label: 'Em revisão' },
  ];

  const categoryOptions = useMemo(() => [
    { value: 'all', label: 'Todas Categorias' },
    ...CATEGORIAS_OFICIAIS.map(c => ({ value: c, label: c }))
  ], []);

  const motoOptions = useMemo(() => [
    { value: 'all', label: 'Todas as Motos' },
    ...MOTOS_OFICIAIS.map(m => ({ value: m, label: m }))
  ], []);

  return (
    <div className="space-y-6">
      {/* Barra Superior Harmonizada */}
      <div className={cn(
        "relative z-50 p-4 rounded-2xl border flex flex-col gap-4 shadow-sm",
        theme === 'dark' ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-200"
      )}>
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col md:flex-row gap-3 w-full lg:w-auto items-center">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                type="text"
                placeholder="Buscar no catálogo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  "w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-violet-500/50",
                  theme === 'dark' 
                    ? "bg-zinc-950 border-zinc-800 text-zinc-200 placeholder:text-zinc-600" 
                    : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400"
                )}
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <CustomDropdown
                options={statusOptions}
                value={status}
                onChange={(val) => {
                  setStatus(val);
                  setCurrentPage(1);
                }}
                theme={theme as any}
                className="w-full md:w-40"
              />
              
              <button
                onClick={() => fetchListings(true)}
                className={cn(
                  "p-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2",
                  theme === 'dark' ? "bg-zinc-800 text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900"
                )}
                title="Sincronizar com Mercado Livre (Limpar Cache)"
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                <span className="text-xs font-medium hidden md:inline">Sincronizar</span>
              </button>
            </div>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="w-full lg:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-violet-600/20 hover:scale-105 active:scale-95"
          >
            <Plus size={18} />
            <span>Novo Anúncio</span>
          </button>
        </div>

        {/* Filtros Adicionais (Categorias e Motos) */}
        <div className="flex flex-col md:flex-row gap-3 pt-3 border-t border-zinc-800/20">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block ml-1">Filtrar por Categoria</label>
            <CustomDropdown
              options={categoryOptions}
              value={selectedCategory}
              onChange={setSelectedCategory}
              theme={theme as any}
              className="w-full"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block ml-1">Filtrar por Moto</label>
            <CustomDropdown
              options={motoOptions}
              value={selectedMoto}
              onChange={setSelectedMoto}
              theme={theme as any}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Grid de Anúncios */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-4">
          <Loader2 className="animate-spin text-violet-500" size={40} />
          <p className="font-medium">Sincronizando com Mercado Livre...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredListings.map((item) => (
              <div key={item.id} className={cn(
                "border rounded-2xl overflow-hidden group transition-all hover:border-violet-500/50 flex flex-col relative",
                theme === 'dark' ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-200"
              )}>
                <div className="aspect-square relative overflow-hidden bg-zinc-800">
                  <img 
                    src={item.thumbnail} 
                    alt={item.titulo} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-2 right-2 flex flex-col gap-1">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shadow-sm",
                      item.status === 'active' ? "bg-emerald-500 text-white" : "bg-zinc-500 text-white"
                    )}>
                      {item.status === 'active' ? 'Ativo' : item.status}
                    </span>
                  </div>
                  
                  {/* Botão de Edição Rápida */}
                  <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleEdit(item)}
                      className="p-2 bg-black/60 hover:bg-violet-600 text-white rounded-lg backdrop-blur-sm transition-all"
                      title="Editar anúncio"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => window.open(item.link, '_blank')}
                        className="p-2 bg-white/20 hover:bg-white/40 rounded-lg text-white backdrop-blur-sm transition-colors"
                        title="Ver no Mercado Livre"
                      >
                        <ExternalLink size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className={cn(
                      "text-sm font-bold line-clamp-2 leading-tight flex-1",
                      theme === 'dark' ? "text-zinc-100" : "text-zinc-900"
                    )}>
                      {item.titulo}
                    </h4>
                    <span className="text-[10px] font-mono text-zinc-500">#{item.id.replace('MLB', '')}</span>
                  </div>
                  
                  <div className="mt-auto space-y-3">
                    <div className="flex items-baseline gap-1">
                      <span className="text-violet-500 font-black text-lg">{formatCurrency(item.preco)}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-zinc-800/50">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Estoque</span>
                        <span className={cn(
                          "text-xs font-bold",
                          item.estoque > 0 ? (theme === 'dark' ? "text-zinc-300" : "text-zinc-700") : "text-red-500"
                        )}>
                          {item.estoque} un
                        </span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Vendidos</span>
                        <span className={cn("text-xs font-bold", theme === 'dark' ? "text-zinc-300" : "text-zinc-700")}>
                          {item.vendidos} un
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredListings.length === 0 && (
            <div className="py-20 text-center text-zinc-500 italic">
              Nenhum anúncio encontrado para esta busca.
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-zinc-800/50">
              <p className="text-sm text-zinc-500">
                Mostrando <span className="font-bold text-zinc-300">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-bold text-zinc-300">{Math.min(currentPage * itemsPerPage, total)}</span> de <span className="font-bold text-zinc-300">{total}</span> anúncios
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={cn(
                    "p-2 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed",
                    theme === 'dark' ? "bg-zinc-800 text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900"
                  )}
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    let pageNum = currentPage;
                    if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;
                    
                    if (pageNum <= 0 || pageNum > totalPages) return null;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={cn(
                          "w-10 h-10 rounded-xl text-sm font-bold transition-all",
                          currentPage === pageNum
                            ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                            : theme === 'dark' ? "bg-zinc-800 text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900"
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={cn(
                    "p-2 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed",
                    theme === 'dark' ? "bg-zinc-800 text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900"
                  )}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de Edição */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={cn(
            "w-full max-w-2xl rounded-3xl border shadow-2xl overflow-visible animate-in fade-in zoom-in duration-200",
            theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
          )}>
            <div className="p-6 border-b border-zinc-800/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-600/20 text-violet-500 rounded-xl">
                  <Edit2 size={20} />
                </div>
                <div>
                  <h3 className={cn("text-lg font-bold", theme === 'dark' ? "text-white" : "text-zinc-900")}>
                    Editar Anúncio
                  </h3>
                  <p className="text-xs text-zinc-500">ID: {editingItem.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Preview da Imagem */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Foto Principal</label>
                  <div className="aspect-square rounded-2xl overflow-hidden bg-zinc-800 border border-zinc-700 relative group">
                    <img 
                      src={editingItem.thumbnail} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl text-sm font-bold">
                        <ImageIcon size={16} />
                        Alterar Foto
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Título do Anúncio</label>
                    <textarea
                      value={editingItem.titulo}
                      onChange={(e) => setEditingItem({ ...editingItem, titulo: e.target.value })}
                      className={cn(
                        "w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-violet-500/50 min-h-[100px] resize-none",
                        theme === 'dark' 
                          ? "bg-zinc-950 border-zinc-800 text-zinc-200" 
                          : "bg-zinc-50 border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Preço (R$)</label>
                      <input
                        type="number"
                        value={editingItem.preco}
                        onChange={(e) => setEditingItem({ ...editingItem, preco: parseFloat(e.target.value) })}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-violet-500/50",
                          theme === 'dark' 
                            ? "bg-zinc-950 border-zinc-800 text-zinc-200" 
                            : "bg-zinc-50 border-zinc-200 text-zinc-900"
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Estoque</label>
                      <input
                        type="number"
                        value={editingItem.estoque}
                        onChange={(e) => setEditingItem({ ...editingItem, estoque: parseInt(e.target.value) })}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-violet-500/50",
                          theme === 'dark' 
                            ? "bg-zinc-950 border-zinc-800 text-zinc-200" 
                            : "bg-zinc-50 border-zinc-200 text-zinc-900"
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</label>
                    <CustomDropdown
                      options={statusOptions}
                      value={editingItem.status}
                      onChange={(val) => setEditingItem({ ...editingItem, status: val })}
                      theme={theme as any}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-zinc-800/50 flex items-center justify-end gap-3 bg-zinc-950/20">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className={cn(
                  "px-6 py-2.5 rounded-xl font-bold transition-all",
                  theme === 'dark' ? "text-zinc-400 hover:text-white" : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex items-center gap-2 px-8 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-600/20"
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Salvar Alterações</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Adicionar (Simplificado para este exemplo) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={cn(
            "w-full max-w-2xl rounded-3xl border shadow-2xl overflow-visible animate-in fade-in zoom-in duration-200",
            theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
          )}>
            <div className="p-6 border-b border-zinc-800/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-600/20 text-emerald-500 rounded-xl">
                  <Plus size={20} />
                </div>
                <h3 className={cn("text-lg font-bold", theme === 'dark' ? "text-white" : "text-zinc-900")}>
                  Novo Anúncio
                </h3>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Título do Anúncio</label>
                    <input
                      type="text"
                      value={newItem.title}
                      onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                      placeholder="Ex: Amortecedor Traseiro Honda CB 300"
                      className={cn(
                        "w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-violet-500/50",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-zinc-50 border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Preço (R$)</label>
                      <input
                        type="number"
                        value={newItem.price}
                        onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                        placeholder="0,00"
                        className={cn(
                          "w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-violet-500/50",
                          theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-zinc-50 border-zinc-200 text-zinc-900"
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Estoque</label>
                      <input
                        type="number"
                        value={newItem.stock}
                        onChange={(e) => setNewItem({ ...newItem, stock: e.target.value })}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-violet-500/50",
                          theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-zinc-50 border-zinc-200 text-zinc-900"
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Categoria</label>
                    <CustomDropdown
                      options={CATEGORIAS_OFICIAIS.map(c => ({ value: c, label: c }))}
                      value={newItem.category}
                      onChange={(val) => setNewItem({ ...newItem, category: val })}
                      theme={theme as any}
                      className="w-full"
                      placeholder="Selecione uma categoria"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Moto</label>
                    <CustomDropdown
                      options={MOTOS_OFICIAIS.map(m => ({ value: m, label: m }))}
                      value={newItem.moto}
                      onChange={(val) => setNewItem({ ...newItem, moto: val })}
                      theme={theme as any}
                      className="w-full"
                      placeholder="Selecione a moto"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-2xl p-8 text-zinc-500 gap-2 flex-1">
                    <ImageIcon size={40} className="opacity-20" />
                    <p className="text-xs font-medium">Arraste fotos ou clique para enviar</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Descrição</label>
                    <textarea
                      value={newItem.description}
                      onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                      placeholder="Detalhes do produto..."
                      className={cn(
                        "w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-violet-500/50 min-h-[100px] resize-none",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-zinc-50 border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-zinc-800/50 flex items-center justify-end gap-3 bg-zinc-950/20">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className={cn(
                  "px-6 py-2.5 rounded-xl font-bold transition-all",
                  theme === 'dark' ? "text-zinc-400 hover:text-white" : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateListing}
                disabled={saving}
                className="flex items-center gap-2 px-8 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-600/20"
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Criando...</span>
                  </>
                ) : (
                  <span>Criar Anúncio</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
