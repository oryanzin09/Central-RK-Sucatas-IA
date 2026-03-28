import React, { useState, useEffect, useContext } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2, 
  X, 
  Save,
  MapPin,
  Phone,
  CreditCard,
  ShoppingBag,
  User as UserIcon,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils';
import { DataContext } from '../App';

interface Client {
  id: string;
  nome: string;
  numero: string;
  senha?: string;
  itensComprados: string;
  interesses: string[];
  userId: string;
}

export const Clients = ({ theme }: { theme: 'light' | 'dark' }) => {
  const [clients, setClients] = useState<Client[]>(() => {
    try {
      const saved = localStorage.getItem('rk_clients');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    nome: '',
    numero: '',
    senha: '',
    itensComprados: '',
    interesses: [] as string[],
    userId: ''
  });

  const handleOpenDetailModal = (client: Client) => {
    setSelectedClient(client);
    setIsDetailModalOpen(true);
  };

  const fetchClients = async (force = false) => {
    if (force) setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/clients', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setClients(data.data);
        localStorage.setItem('rk_clients', JSON.stringify(data.data));
      }
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Carrega do cache imediatamente e busca atualização em background
    fetchClients(clients.length === 0);
  }, []);

  const handleOpenModal = (client?: Client) => {
    setShowPassword(false);
    if (client) {
      setEditingClient(client);
      setFormData({
        nome: client.nome || '',
        numero: client.numero || '',
        senha: client.senha || '',
        itensComprados: client.itensComprados || '',
        interesses: client.interesses || [],
        userId: client.userId || ''
      });
    } else {
      setEditingClient(null);
      setFormData({
        nome: '',
        numero: '',
        senha: '',
        itensComprados: '',
        interesses: [],
        userId: ''
      });
    }
    setIsModalOpen(true);
  };

  const formatPhone = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 11);
    const match = cleaned.match(/^(\d{2})(\d{5})(\d{4})$/) || cleaned.match(/^(\d{2})(\d{4,5})(\d{0,4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}${match[3] ? '-' + match[3] : ''}`;
    }
    return cleaned;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('auth_token');
    const method = editingClient ? 'PUT' : 'POST';
    const url = editingClient ? `/api/clients/${editingClient.id}` : '/api/clients';
    
    console.log(`🚀 Enviando requisição ${method} para ${url}`, formData);

    try {
      const res = await fetch(url, {
        method,
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      console.log('📥 Resposta do servidor:', data);
      if (data.success) {
        setIsModalOpen(false);
        fetchClients(true);
      } else {
        alert('Erro ao salvar cliente: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('❌ Erro ao salvar cliente:', error);
      alert('Erro de conexão ao salvar cliente');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este cliente?')) return;
    console.log(`🗑️ Deletando cliente ${id}...`);
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      console.log('📥 Resposta do servidor (delete):', data);
      if (data.success) fetchClients(true);
      else alert('Erro ao excluir cliente: ' + (data.error || 'Erro desconhecido'));
    } catch (error) {
      console.error('❌ Erro ao deletar cliente:', error);
      alert('Erro de conexão ao excluir cliente');
    }
  };

  const [searchTag, setSearchTag] = useState('');

  // ... (existing code)

  const togglePasswordVisibility = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSet = new Set(visiblePasswords);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setVisiblePasswords(newSet);
  };

  const filteredClients = clients.filter(c => 
    (c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
     c.userId.includes(searchTerm)) &&
    (searchTag === '' || c.interesses.some(i => i.toLowerCase().includes(searchTag.toLowerCase())))
  );

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={cn("text-2xl font-black tracking-tight", theme === 'dark' ? "text-white" : "text-zinc-900")}>
            Gestão de Clientes
          </h1>
          <p className="text-zinc-500 text-sm font-medium">Visualize e gerencie a base de clientes do sistema.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-600/20"
        >
          <Plus size={18} />
          Novo Cliente
        </button>
      </div>

      <div className={cn(
        "relative border rounded-[2rem] overflow-hidden",
        theme === 'dark' ? "bg-zinc-900/40 border-zinc-800/50" : "bg-white border-zinc-200 shadow-xl"
      )}>
        <div className="p-4 border-b border-zinc-800/50 flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-4 flex-1 w-full">
            <Search className="text-zinc-500" size={20} />
            <input 
              type="text"
              placeholder="Buscar por nome, CPF ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-zinc-300 placeholder:text-zinc-600"
            />
          </div>
          <input 
            type="text"
            placeholder="Filtrar por etiqueta..."
            value={searchTag}
            onChange={(e) => setSearchTag(e.target.value)}
            className="w-full md:w-48 bg-zinc-900/50 border border-zinc-800 rounded-2xl py-2 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/50 transition-all placeholder:text-zinc-600"
          />
        </div>

        <div className="overflow-x-auto">
          {/* Mobile View */}
          <div className="md:hidden space-y-4">
            {filteredClients.map((client) => (
              <div key={client.id} onClick={() => handleOpenDetailModal(client)} className={cn("p-4 rounded-2xl border cursor-pointer", theme === 'dark' ? "bg-zinc-900/40 border-zinc-800/50" : "bg-white border-zinc-200 shadow-sm")}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-violet-600/10 flex items-center justify-center text-violet-500 font-black">
                      {client.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-black text-white">{client.nome}</div>
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">ID: {client.userId}</div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-zinc-400 font-medium mb-1"><Phone size={12} className="inline mr-1" /> {client.numero}</div>
                <div className="text-xs text-zinc-400 font-medium mb-2"><ShoppingBag size={12} className="inline mr-1" /> {client.itensComprados}</div>
                
                <div className="flex flex-wrap gap-1 mb-3">
                  {client.interesses && client.interesses.map((int, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-violet-600/20 text-violet-300 text-[9px] font-bold">
                      {int}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-800/50" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <Lock size={12} className="text-zinc-500" />
                    <span className="font-mono text-[10px] text-zinc-400">
                      {visiblePasswords.has(client.id) ? client.senha || '---' : '••••••••'}
                    </span>
                    <button 
                      onClick={(e) => togglePasswordVisibility(e, client.id)}
                      className="p-1 text-zinc-500 hover:text-zinc-300"
                    >
                      {visiblePasswords.has(client.id) ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleOpenModal(client)}
                      className="p-2 rounded-lg bg-zinc-800 text-zinc-400"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(client.id)}
                      className="p-2 rounded-lg bg-zinc-800 text-rose-500/50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Desktop View */}
          <table className="hidden md:table w-full text-left border-collapse">
            <thead>
              <tr className={cn(
                "text-[10px] font-black uppercase tracking-[0.2em]",
                theme === 'dark' ? "text-zinc-500 bg-zinc-950/50" : "text-zinc-400 bg-zinc-50"
              )}>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4">Interesses</th>
                <th className="px-6 py-4">Senha</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-8">
                      <div className="h-4 bg-zinc-800 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <Users className="mx-auto text-zinc-700 mb-4" size={48} />
                    <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Nenhum cliente encontrado</p>
                  </td>
                </tr>
              ) : filteredClients.map((client) => (
                <tr key={client.id} onClick={() => handleOpenDetailModal(client)} className="group hover:bg-zinc-800/20 transition-colors cursor-pointer">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-violet-600/10 flex items-center justify-center text-violet-500 font-black">
                        {client.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-black text-white">{client.nome}</div>
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">ID: {client.userId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
                        <Phone size={12} /> {client.numero}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {client.interesses && client.interesses.length > 0 ? (
                        client.interesses.slice(0, 3).map((int, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-md bg-violet-600/20 text-violet-300 text-[9px] font-bold whitespace-nowrap">
                            {int}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-zinc-600 font-bold uppercase">Nenhum</span>
                      )}
                      {client.interesses && client.interesses.length > 3 && (
                        <span className="text-[9px] text-zinc-500 font-bold">+{client.interesses.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <div className="font-mono text-xs text-zinc-400 bg-zinc-800/50 px-2 py-1 rounded-lg border border-zinc-800 min-w-[80px] text-center">
                        {visiblePasswords.has(client.id) ? client.senha || '---' : '••••••••'}
                      </div>
                      <button 
                        onClick={(e) => togglePasswordVisibility(e, client.id)}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-all"
                      >
                        {visiblePasswords.has(client.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleOpenModal(client)}
                        className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-violet-600 transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(client.id)}
                        className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
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
      </div>

      <AnimatePresence>
        {isDetailModalOpen && selectedClient && (
          <div className="fixed inset-0 z-[2000] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={cn(
                "w-full md:max-w-lg h-[92vh] md:h-auto md:max-h-[90vh] rounded-t-[2.5rem] md:rounded-[2.5rem] overflow-hidden border-t md:border shadow-2xl flex flex-col relative",
                theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200"
              )}
            >
              {/* Handle for mobile */}
              <div className="md:hidden w-full flex justify-center pt-4 pb-2">
                <div className="w-12 h-1.5 rounded-full bg-zinc-800/50" />
              </div>

              <button onClick={() => setIsDetailModalOpen(false)} className={cn(
                "absolute top-6 right-6 z-50 p-2 rounded-full transition-all active:scale-90 shadow-xl border",
                theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white" : "bg-zinc-100 border-zinc-200 text-zinc-500 hover:text-zinc-900"
              )}>
                <X size={20} />
              </button>
              
              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-violet-600/10 flex items-center justify-center text-violet-500 font-black text-2xl">
                    {selectedClient.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className={cn("text-xl font-black tracking-tight", theme === 'dark' ? "text-white" : "text-zinc-900")}>
                      {selectedClient.nome}
                    </h2>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">ID: {selectedClient.userId}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className={cn("p-3 rounded-xl border", theme === 'dark' ? "bg-zinc-900/50 border-zinc-800" : "bg-zinc-50 border-zinc-100")}>
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-0.5 flex items-center gap-1.5">
                      <Phone size={9} /> WhatsApp
                    </label>
                    <p className="text-sm font-medium text-zinc-300">{selectedClient.numero}</p>
                  </div>
                  
                  <div className={cn("p-3 rounded-xl border", theme === 'dark' ? "bg-zinc-900/50 border-zinc-800" : "bg-zinc-50 border-zinc-100")}>
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-0.5 flex items-center gap-1.5">
                      <ShoppingBag size={9} /> Interesses
                    </label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedClient.interesses && selectedClient.interesses.length > 0 ? [...selectedClient.interesses].sort((a, b) => {
                        const aIsMoto = a.toLowerCase().includes('moto');
                        const bIsMoto = b.toLowerCase().includes('moto');
                        if (aIsMoto && !bIsMoto) return -1;
                        if (!aIsMoto && bIsMoto) return 1;
                        return a.localeCompare(b);
                      }).map((int, i) => (
                        <span key={i} className="px-2 py-1 rounded-md bg-violet-600/20 text-violet-300 text-[10px] font-bold">{int}</span>
                      )) : <p className="text-sm font-medium text-zinc-300">Nenhum interesse registrado</p>}
                    </div>
                  </div>

                  <div className={cn("p-3 rounded-xl border", theme === 'dark' ? "bg-zinc-900/50 border-zinc-800" : "bg-zinc-50 border-zinc-100")}>
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-0.5 flex items-center gap-1.5">
                      <ShoppingBag size={9} /> Itens Comprados
                    </label>
                    <p className="text-sm font-medium text-zinc-300">{selectedClient.itensComprados || 'Nenhum item registrado'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-6">
                  <button 
                    onClick={() => {
                      const phone = selectedClient.numero.replace(/\D/g, '');
                      window.open(`https://wa.me/55${phone}?text=Olá, ${selectedClient.nome}!`, '_blank');
                    }}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600/20 transition-all"
                  >
                    <Phone size={20} />
                    <span className="text-[10px] font-bold uppercase">WhatsApp</span>
                  </button>
                  <button 
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenModal(selectedClient);
                    }}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-violet-600/10 text-violet-500 hover:bg-violet-600/20 transition-all"
                  >
                    <Edit2 size={20} />
                    <span className="text-[10px] font-bold uppercase">Editar</span>
                  </button>
                  <button 
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleDelete(selectedClient.id);
                    }}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-rose-600/10 text-rose-500 hover:bg-rose-600/20 transition-all"
                  >
                    <Trash2 size={20} />
                    <span className="text-[10px] font-bold uppercase">Excluir</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={cn(
                "relative w-full max-w-xl rounded-[2.5rem] overflow-hidden shadow-2xl",
                theme === 'dark' ? "bg-zinc-950 border border-zinc-800" : "bg-white"
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-right from-violet-600 to-blue-600" />
              
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-violet-600/20 flex items-center justify-center text-violet-500">
                      <UserIcon size={24} />
                    </div>
                    <div>
                      <h2 className={cn("text-2xl font-black tracking-tight", theme === 'dark' ? "text-white" : "text-zinc-900")}>
                        {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
                      </h2>
                      <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Preencha os dados do cliente abaixo</p>
                    </div>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <UserIcon size={10} /> Nome Completo
                    </label>
                    <input 
                      required
                      placeholder="Ex: João Silva"
                      value={formData.nome}
                      onChange={e => setFormData({...formData, nome: e.target.value})}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-3.5 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/50 transition-all placeholder:text-zinc-700"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Phone size={10} /> WhatsApp / Contato
                      </label>
                      <input 
                        placeholder="(00) 00000-0000"
                        value={formData.numero}
                        onChange={e => setFormData({...formData, numero: formatPhone(e.target.value)})}
                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-3.5 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/50 transition-all placeholder:text-zinc-700"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Lock size={10} /> Senha de Acesso
                      </label>
                      <div className="relative">
                        <input 
                          type={showPassword ? "text" : "password"}
                          placeholder="********"
                          value={formData.senha}
                          onChange={e => setFormData({...formData, senha: e.target.value})}
                          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-3.5 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/50 transition-all placeholder:text-zinc-700 pr-12"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <ShoppingBag size={10} /> Interesses
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {formData.interesses.map((tag, index) => (
                        <span key={index} className="flex items-center gap-1 px-2 py-1 rounded-md bg-violet-600/20 text-violet-300 text-[10px] font-bold">
                          {tag}
                          <button type="button" onClick={() => setFormData({...formData, interesses: formData.interesses.filter((_, i) => i !== index)})} className="text-violet-500 hover:text-violet-300">
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input 
                        id="interest-input"
                        placeholder="Digite e pressione Enter..."
                        className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-2xl py-3.5 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/50 transition-all placeholder:text-zinc-700"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const value = e.currentTarget.value.trim();
                            if (value && !formData.interesses.includes(value)) {
                              setFormData({...formData, interesses: [...formData.interesses, value]});
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          const input = document.getElementById('interest-input') as HTMLInputElement;
                          const value = input.value.trim();
                          if (value && !formData.interesses.includes(value)) {
                            setFormData({...formData, interesses: [...formData.interesses, value]});
                            input.value = '';
                          }
                        }}
                        className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 rounded-2xl font-black text-xs uppercase transition-all"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <ShoppingBag size={10} /> Itens Comprados / Observações
                    </label>
                    <textarea 
                      placeholder="Liste os itens ou observações relevantes..."
                      value={formData.itensComprados}
                      onChange={e => setFormData({...formData, itensComprados: e.target.value})}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-3.5 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/50 transition-all placeholder:text-zinc-700 min-h-[100px] resize-none"
                    />
                  </div>

                  <div className="pt-2">
                    <button 
                      type="submit"
                      className="w-full bg-violet-600 hover:bg-violet-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-violet-600/20 flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      <Save size={18} />
                      {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
