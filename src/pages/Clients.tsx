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
  userId: string;
}

export const Clients = ({ theme }: { theme: 'light' | 'dark' }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    numero: '',
    senha: '',
    itensComprados: '',
    userId: ''
  });

  const fetchClients = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/clients', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setClients(data.data);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
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
        userId: client.userId || ''
      });
    } else {
      setEditingClient(null);
      setFormData({
        nome: '',
        numero: '',
        senha: '',
        itensComprados: '',
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
        fetchClients();
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
      if (data.success) fetchClients();
      else alert('Erro ao excluir cliente: ' + (data.error || 'Erro desconhecido'));
    } catch (error) {
      console.error('❌ Erro ao deletar cliente:', error);
      alert('Erro de conexão ao excluir cliente');
    }
  };

  const filteredClients = clients.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.userId.includes(searchTerm)
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
        <div className="p-4 border-b border-zinc-800/50 flex items-center gap-4">
          <Search className="text-zinc-500" size={20} />
          <input 
            type="text"
            placeholder="Buscar por nome, CPF ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-zinc-300 placeholder:text-zinc-600"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={cn(
                "text-[10px] font-black uppercase tracking-[0.2em]",
                theme === 'dark' ? "text-zinc-500 bg-zinc-950/50" : "text-zinc-400 bg-zinc-50"
              )}>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4">Itens</th>
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
                <tr key={client.id} className="group hover:bg-zinc-800/20 transition-colors">
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
                    <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium max-w-[200px] truncate">
                      <ShoppingBag size={12} className="shrink-0" /> {client.itensComprados}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
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
