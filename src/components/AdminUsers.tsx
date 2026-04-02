import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Loader2, Shield, ShieldAlert, Trash2, User, UserCog, Users, Plus, Edit, X, Save } from 'lucide-react';

interface UserData {
  id: number;
  phone: string;
  name: string;
  role: string;
  created_at: string;
  last_login: string | null;
}

interface ClientData {
  id: number;
  phone: string;
  name: string;
  interests: string | null;
  purchases: string | null;
  created_at: string;
  last_login: string | null;
}

export default function AdminUsers({ userRole }: { userRole?: string }) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Modal State for Clients
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientData | null>(null);
  const [clientFormData, setClientFormData] = useState({
    phone: '',
    name: '',
    password: '',
    interests: [] as string[],
    purchases: [] as {item: string, value: string}[]
  });

  const [interestInput, setInterestInput] = useState('');
  const [purchaseItemInput, setPurchaseItemInput] = useState('');
  const [purchaseValueInput, setPurchaseValueInput] = useState('');

  const parseJSON = (str: string | null, fallback: any) => {
    if (!str) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [usersRes, clientsRes] = await Promise.all([
        api.get('/api/admin/users'),
        api.get('/api/admin/clients')
      ]);

      if (usersRes.success) {
        setUsers(usersRes.data);
      } else {
        setError(usersRes.error || 'Erro ao carregar usuários');
      }

      if (clientsRes.success) {
        setClients(clientsRes.data);
      } else {
        setError(clientsRes.error || 'Erro ao carregar clientes');
      }
    } catch (err: any) {
      setError(err.message || 'Erro de conexão ao buscar dados');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Users Handlers ---
  const handleToggleRole = async (userId: number, currentRole: string) => {
    const roles = ['admin', 'gerente', 'estoque'];
    const currentIndex = roles.indexOf(currentRole);
    const newRole = roles[(currentIndex + 1) % roles.length];
    
    if (!window.confirm(`Tem certeza que deseja alterar a permissão deste usuário para ${newRole.toUpperCase()}?`)) return;
    
    setActionLoading(userId);
    
    try {
      const response = await api.put(`/api/admin/users/${userId}/role`, { role: newRole });
      if (response.success) {
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      } else {
        alert(response.error || 'Erro ao atualizar permissão');
      }
    } catch (err: any) {
      alert(err.message || 'Erro de conexão');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!window.confirm(`ATENÇÃO: Tem certeza que deseja excluir permanentemente o usuário ${userName || userId}?`)) return;
    
    setActionLoading(userId);
    try {
      const response = await api.delete(`/api/admin/users/${userId}`);
      if (response.success) {
        setUsers(users.filter(u => u.id !== userId));
      } else {
        alert(response.error || 'Erro ao excluir usuário');
      }
    } catch (err: any) {
      alert(err.message || 'Erro de conexão');
    } finally {
      setActionLoading(null);
    }
  };

  // --- Clients Handlers ---
  const handleOpenClientModal = (client: ClientData | null = null) => {
    if (client) {
      setEditingClient(client);
      setClientFormData({
        phone: client.phone,
        name: client.name || '',
        password: '', // Do not show existing password
        interests: parseJSON(client.interests, []),
        purchases: parseJSON(client.purchases, [])
      });
    } else {
      setEditingClient(null);
      setClientFormData({ phone: '', name: '', password: '', interests: [], purchases: [] });
    }
    setInterestInput('');
    setPurchaseItemInput('');
    setPurchaseValueInput('');
    setIsClientModalOpen(true);
  };

  const handleAddInterest = () => {
    if (interestInput.trim()) {
      setClientFormData(prev => ({ ...prev, interests: [...prev.interests, interestInput.trim()] }));
      setInterestInput('');
    }
  };

  const handleRemoveInterest = (index: number) => {
    setClientFormData(prev => ({ ...prev, interests: prev.interests.filter((_, i) => i !== index) }));
  };

  const handleAddPurchase = () => {
    if (purchaseItemInput.trim() && purchaseValueInput.trim()) {
      setClientFormData(prev => ({ 
        ...prev, 
        purchases: [...prev.purchases, { item: purchaseItemInput.trim(), value: purchaseValueInput.trim() }] 
      }));
      setPurchaseItemInput('');
      setPurchaseValueInput('');
    }
  };

  const handleRemovePurchase = (index: number) => {
    setClientFormData(prev => ({ ...prev, purchases: prev.purchases.filter((_, i) => i !== index) }));
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(-1); // Use -1 for modal loading
    try {
      const payload = {
        ...clientFormData,
        interests: JSON.stringify(clientFormData.interests),
        purchases: JSON.stringify(clientFormData.purchases)
      };

      if (editingClient) {
        const res = await api.put(`/api/admin/clients/${editingClient.id}`, payload);
        if (res.success) {
          setClients(clients.map(c => c.id === editingClient.id ? { ...c, ...payload } : c));
          setIsClientModalOpen(false);
        } else {
          alert(res.error || 'Erro ao atualizar cliente');
        }
      } else {
        const res = await api.post('/api/admin/clients', payload);
        if (res.success) {
          setClients([...clients, { ...payload, id: res.id, created_at: new Date().toISOString(), last_login: null }]);
          setIsClientModalOpen(false);
        } else {
          alert(res.error || 'Erro ao criar cliente');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Erro de conexão');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteClient = async (clientId: number, clientName: string) => {
    if (!window.confirm(`ATENÇÃO: Tem certeza que deseja excluir permanentemente o cliente ${clientName || clientId}?`)) return;
    
    setActionLoading(clientId);
    try {
      const response = await api.delete(`/api/admin/clients/${clientId}`);
      if (response.success) {
        setClients(clients.filter(c => c.id !== clientId));
      } else {
        alert(response.error || 'Erro ao excluir cliente');
      }
    } catch (err: any) {
      alert(err.message || 'Erro de conexão');
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
        <p>Erro: {error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors">
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* STAFF TABLE */}
      {userRole === 'admin' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <UserCog className="w-6 h-6 text-blue-400" />
              Gestão de Staff (Acessos)
            </h2>
            <div className="text-sm text-gray-400">
              Total: {users.length} usuário(s)
            </div>
          </div>

          <div className="bg-[#1a1d24] rounded-xl border border-gray-800 overflow-hidden hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-xs text-gray-400 uppercase bg-[#0f1115]/50 border-b border-gray-800">
                  <tr>
                    <th className="px-6 py-4 font-medium">Usuário</th>
                    <th className="px-6 py-4 font-medium hidden sm:table-cell">Telefone</th>
                    <th className="px-6 py-4 font-medium">Permissão</th>
                    <th className="px-6 py-4 font-medium hidden md:table-cell">Cadastro</th>
                    <th className="px-6 py-4 font-medium hidden lg:table-cell">Último Login</th>
                    <th className="px-6 py-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-[#222630] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-white truncate">{user.name || 'Sem nome'}</div>
                            <div className="text-xs text-gray-500 sm:hidden font-mono">{user.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-400 hidden sm:table-cell">{user.phone}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          user.role === 'admin' 
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                            : user.role === 'gerente'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {user.role === 'admin' ? <ShieldAlert className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                          {user.role === 'admin' ? 'Administrador' : user.role === 'gerente' ? 'Gerente' : 'Estoque'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 hidden md:table-cell">
                        {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 text-gray-500 hidden lg:table-cell">
                        {user.last_login ? new Date(user.last_login).toLocaleString('pt-BR') : 'Nunca'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleRole(user.id, user.role)}
                            disabled={actionLoading === user.id}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                            title="Alterar Permissão"
                          >
                            {actionLoading === user.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <ShieldAlert className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id, user.name)}
                            disabled={actionLoading === user.id}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Excluir Usuário"
                          >
                            {actionLoading === user.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards for Staff */}
          <div className="grid grid-cols-1 gap-4 sm:hidden">
            {users.map((user) => (
              <div key={user.id} className="bg-[#1a1d24] rounded-2xl border border-gray-800 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-white">{user.name || 'Sem nome'}</div>
                      <div className="text-xs text-gray-500 font-mono">{user.phone}</div>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    user.role === 'admin' 
                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                      : user.role === 'gerente'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {user.role === 'admin' ? 'Admin' : user.role === 'gerente' ? 'Gerente' : 'Estoque'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-gray-800/50">
                  <div className="text-[10px] text-gray-500">
                    Último login: {user.last_login ? new Date(user.last_login).toLocaleDateString('pt-BR') : 'Nunca'}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleRole(user.id, user.role)}
                      disabled={actionLoading === user.id}
                      className="p-2.5 bg-gray-800 text-gray-400 rounded-xl hover:text-white transition-all"
                    >
                      <ShieldAlert className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id, user.name)}
                      disabled={actionLoading === user.id}
                      className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl hover:bg-rose-500/20 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CLIENTS TABLE */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" />
            Gestão de Clientes
          </h2>
          <div className="flex items-center justify-between sm:justify-end gap-4">
            <div className="text-sm text-gray-400">
              Total: {clients.length} cliente(s)
            </div>
            <button
              onClick={() => handleOpenClientModal()}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm font-bold shadow-lg shadow-emerald-500/20 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Novo Cliente
            </button>
          </div>
        </div>

        <div className="bg-[#1a1d24] rounded-xl border border-gray-800 overflow-hidden hidden sm:block">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="text-xs text-gray-400 uppercase bg-[#0f1115]/50 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Cliente</th>
                  <th className="px-6 py-4 font-medium hidden sm:table-cell">Telefone</th>
                  <th className="px-6 py-4 font-medium hidden md:table-cell">Interesses</th>
                  <th className="px-6 py-4 font-medium hidden lg:table-cell">Compras</th>
                  <th className="px-6 py-4 font-medium hidden xl:table-cell">Cadastro</th>
                  <th className="px-6 py-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-[#222630] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-white truncate">{client.name || 'Sem nome'}</div>
                          <div className="text-xs text-gray-500 sm:hidden font-mono">{client.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-400 hidden sm:table-cell">{client.phone}</td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {parseJSON(client.interests, []).map((interest: string, idx: number) => (
                          <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 truncate max-w-[100px]" title={interest}>
                            {interest}
                          </span>
                        ))}
                        {!client.interests && <span className="text-gray-500">-</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {parseJSON(client.purchases, []).map((purchase: any, idx: number) => (
                          <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 truncate max-w-[100px]" title={`${purchase.item} - ${purchase.value}`}>
                            {purchase.item}
                          </span>
                        ))}
                        {!client.purchases && <span className="text-gray-500">-</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 hidden xl:table-cell">
                      {new Date(client.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenClientModal(client)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                          title="Editar Cliente"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClient(client.id, client.name)}
                          disabled={actionLoading === client.id}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                          title="Excluir Cliente"
                        >
                          {actionLoading === client.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards for Clients */}
        <div className="grid grid-cols-1 gap-4 sm:hidden">
          {clients.map((client) => (
            <div key={client.id} className="bg-[#1a1d24] rounded-2xl border border-gray-800 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-white">{client.name || 'Sem nome'}</div>
                    <div className="text-xs text-gray-500 font-mono">{client.phone}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenClientModal(client)}
                    className="p-2.5 bg-gray-800 text-gray-400 rounded-xl hover:text-white transition-all"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClient(client.id, client.name)}
                    disabled={actionLoading === client.id}
                    className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl hover:bg-rose-500/20 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tags Section */}
              <div className="space-y-3 pt-2 border-t border-gray-800/50">
                {client.interests && (
                  <div className="flex flex-wrap gap-1">
                    {parseJSON(client.interests, []).map((interest: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {interest}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-[10px] text-gray-500">
                  Cadastrado em: {new Date(client.created_at).toLocaleDateString('pt-BR')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL CLIENTE */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1d24] border border-gray-800 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col my-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0 sticky top-0 bg-[#1a1d24] z-10">
              <h3 className="text-lg font-bold text-white">
                {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
              </h3>
              <button 
                onClick={() => setIsClientModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveClient} className="p-4 space-y-4">
              {/* ... campos do formulário ... */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Nome</label>
                <input
                  type="text"
                  value={clientFormData.name}
                  onChange={e => setClientFormData({...clientFormData, name: e.target.value})}
                  className="w-full bg-[#0f1115] border border-gray-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                  placeholder="Nome do cliente"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Telefone (Login)*</label>
                <input
                  type="text"
                  required
                  value={clientFormData.phone}
                  onChange={e => setClientFormData({...clientFormData, phone: e.target.value})}
                  className="w-full bg-[#0f1115] border border-gray-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                  placeholder="Ex: 11999999999"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Senha {editingClient ? '(Deixe em branco para não alterar)' : '(Opcional)'}
                </label>
                <input
                  type="password"
                  value={clientFormData.password}
                  onChange={e => setClientFormData({...clientFormData, password: e.target.value})}
                  className="w-full bg-[#0f1115] border border-gray-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                  placeholder="Senha de acesso"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Interesses (Etiquetas)</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={interestInput}
                    onChange={e => setInterestInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddInterest())}
                    className="flex-1 bg-[#0f1115] border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Ex: Peças para Honda CG 160"
                  />
                  <button
                    type="button"
                    onClick={handleAddInterest}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {clientFormData.interests.map((interest, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {interest}
                      <button type="button" onClick={() => handleRemoveInterest(idx)} className="hover:text-emerald-300">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Histórico de Compras</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={purchaseItemInput}
                    onChange={e => setPurchaseItemInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddPurchase())}
                    className="flex-[2] bg-[#0f1115] border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Item (Ex: Pneu traseiro)"
                  />
                  <input
                    type="text"
                    value={purchaseValueInput}
                    onChange={e => setPurchaseValueInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddPurchase())}
                    className="flex-1 bg-[#0f1115] border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Valor (Ex: R$ 150)"
                  />
                  <button
                    type="button"
                    onClick={handleAddPurchase}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {clientFormData.purchases.map((purchase, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {purchase.item} - {purchase.value}
                      <button type="button" onClick={() => handleRemovePurchase(idx)} className="hover:text-blue-300">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 shrink-0 sticky bottom-0 bg-[#1a1d24] py-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === -1}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-colors font-medium disabled:opacity-50"
                >
                  {actionLoading === -1 ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
