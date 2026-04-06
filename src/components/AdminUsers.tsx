import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../utils/api';
import { cn } from '../utils';
import { Loader2, Shield, ShieldAlert, Trash2, User, UserCog, Users, Plus, Edit, X, Save, Eye, EyeOff } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, addDoc } from 'firebase/firestore';

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  lastLogin: string | null;
}

interface ClientData {
  id: string;
  phone: string;
  name: string;
  interests: string | null;
  purchases: string | null;
  createdAt: string;
  lastLogin: string | null;
}

export default function AdminUsers({ userRole, onModalChange, theme = 'dark' }: { userRole?: string, onModalChange?: (isOpen: boolean) => void, theme?: 'light' | 'dark' }) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal State for Clients
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (onModalChange) {
      onModalChange(isClientModalOpen);
    }
    return () => {
      if (onModalChange) {
        onModalChange(false);
      }
    };
  }, [isClientModalOpen, onModalChange]);

  const [editingClient, setEditingClient] = useState<ClientData | null>(null);
  const [clientFormData, setClientFormData] = useState({
    phone: '',
    name: '',
    password: '',
    interests: [] as string[],
    purchases: [] as string[]
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
      const usersSnap = await getDocs(collection(db, 'users'));
      const clientsSnap = await getDocs(collection(db, 'clients'));

      const usersData = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserData));
      const clientsData = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientData));

      setUsers(usersData);
      setClients(clientsData);
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
  const handleToggleRole = async (userId: string, currentRole: string) => {
    const roles = ['admin', 'gerente', 'estoque', 'client'];
    const currentIndex = roles.indexOf(currentRole);
    const newRole = roles[(currentIndex + 1) % roles.length];
    
    if (!window.confirm(`Tem certeza que deseja alterar a permissão deste usuário para ${newRole.toUpperCase()}?`)) return;
    
    setActionLoading(userId);
    
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err: any) {
      alert(err.message || 'Erro de conexão');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`ATENÇÃO: Tem certeza que deseja excluir permanentemente o usuário ${userName || userId}?`)) return;
    
    setActionLoading(userId);
    try {
      await deleteDoc(doc(db, 'users', userId));
      setUsers(users.filter(u => u.id !== userId));
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
    if (purchaseItemInput.trim()) {
      setClientFormData(prev => ({ 
        ...prev, 
        purchases: [...prev.purchases, purchaseItemInput.trim()] 
      }));
      setPurchaseItemInput('');
    }
  };

  const handleRemovePurchase = (index: number) => {
    setClientFormData(prev => ({ ...prev, purchases: prev.purchases.filter((_, i) => i !== index) }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }
    if (value.length > 10) {
      value = `${value.slice(0, 10)}-${value.slice(10)}`;
    }
    
    setClientFormData({ ...clientFormData, phone: value });
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('save_client');
    try {
      const payload = {
        phone: clientFormData.phone,
        name: clientFormData.name,
        interests: JSON.stringify(clientFormData.interests),
        purchases: JSON.stringify(clientFormData.purchases)
      };

      if (editingClient) {
        await updateDoc(doc(db, 'clients', editingClient.id), { ...payload, updatedAt: new Date().toISOString() });
        setClients(clients.map(c => c.id === editingClient.id ? { ...c, ...payload } : c));
        setIsClientModalOpen(false);
      } else {
        const newDoc = await addDoc(collection(db, 'clients'), {
          ...payload,
          createdAt: new Date().toISOString(),
          lastLogin: null
        });
        setClients([...clients, { ...payload, id: newDoc.id, createdAt: new Date().toISOString(), lastLogin: null }]);
        setIsClientModalOpen(false);
      }
    } catch (err: any) {
      alert(err.message || 'Erro de conexão');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (!window.confirm(`ATENÇÃO: Tem certeza que deseja excluir permanentemente o cliente ${clientName || clientId}?`)) return;
    
    setActionLoading(clientId);
    try {
      await deleteDoc(doc(db, 'clients', clientId));
      setClients(clients.filter(c => c.id !== clientId));
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
                            <div className="text-xs text-gray-500 sm:hidden font-mono">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-400 hidden sm:table-cell">{user.email}</td>
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
                        {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 text-gray-500 hidden lg:table-cell">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleString('pt-BR') : 'Nunca'}
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
                      <div className="text-xs text-gray-500 font-mono">{user.email}</div>
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
                    Último login: {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('pt-BR') : 'Nunca'}
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
                      {new Date(client.createdAt).toLocaleDateString('pt-BR')}
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
                  Cadastrado em: {new Date(client.createdAt).toLocaleDateString('pt-BR')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* NOVO MODAL CLIENTE (ESTILO HUB) */}
      <AnimatePresence>
        {isClientModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsClientModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={cn(
                "fixed bottom-0 left-0 right-0 z-[105] rounded-t-[2.5rem] p-6 pt-0 pb-0 overflow-hidden",
                "md:bottom-10 md:left-1/2 md:-translate-x-1/2 md:right-auto md:w-full md:max-w-xl md:rounded-[2.5rem] md:shadow-2xl",
                theme === 'dark' ? "bg-zinc-900 border-t md:border border-zinc-800" : "bg-white border-t md:border border-zinc-200",
                "shadow-2xl shadow-black/50"
              )}
            >
              {/* Handle for mobile */}
              <div className="w-full flex justify-center pt-2 pb-4">
                <div className={cn(
                  "w-12 h-1.5 rounded-full",
                  theme === 'dark' ? "bg-zinc-800" : "bg-zinc-200"
                )} />
              </div>

              <div className="flex items-center justify-between mb-6">
                <div className="flex flex-col">
                  <h3 className={cn(
                    "text-xl font-black tracking-tight",
                    theme === 'dark' ? "text-white" : "text-zinc-900"
                  )}>
                    {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
                  </h3>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
                    {editingClient ? 'Atualize os dados do perfil' : 'Cadastre um novo perfil no sistema'}
                  </p>
                </div>
                <button 
                  onClick={() => setIsClientModalOpen(false)}
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90",
                    theme === 'dark' ? "bg-zinc-800 text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-500 hover:text-zinc-900"
                  )}
                >
                  <X size={20} />
                </button>
              </div>

              {/* CONTEÚDO DO FORMULÁRIO */}
              <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6 no-scrollbar pb-32">
                <form id="client-form" onSubmit={handleSaveClient} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* NOME */}
                    <div>
                      <label className={cn(
                        "block text-[10px] font-black uppercase tracking-[0.2em] mb-2",
                        theme === 'dark' ? "text-zinc-500" : "text-zinc-400"
                      )}>Nome Completo</label>
                      <input
                        type="text"
                        value={clientFormData.name}
                        onChange={e => setClientFormData({...clientFormData, name: e.target.value})}
                        className={cn(
                          "w-full border rounded-2xl px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-violet-500/50",
                          theme === 'dark' 
                            ? "bg-zinc-950 border-zinc-800 text-zinc-200" 
                            : "bg-zinc-50 border-zinc-200 text-zinc-900"
                        )}
                        placeholder="Ex: João Silva"
                      />
                    </div>
                    
                    {/* TELEFONE / NUMERO */}
                    <div>
                      <label className={cn(
                        "block text-[10px] font-black uppercase tracking-[0.2em] mb-2",
                        theme === 'dark' ? "text-zinc-500" : "text-zinc-400"
                      )}>Número (Login)*</label>
                      <input
                        type="text"
                        required
                        value={clientFormData.phone}
                        onChange={handlePhoneChange}
                        className={cn(
                          "w-full border rounded-2xl px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-violet-500/50",
                          theme === 'dark' 
                            ? "bg-zinc-950 border-zinc-800 text-zinc-200" 
                            : "bg-zinc-50 border-zinc-200 text-zinc-900"
                        )}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>

                  {/* SENHA COM TOGGLE */}
                  <div className="pb-2">
                    <label className={cn(
                      "block text-[10px] font-black uppercase tracking-[0.2em] mb-2",
                      theme === 'dark' ? "text-zinc-500" : "text-zinc-400"
                    )}>
                      Senha
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={clientFormData.password}
                        onChange={e => setClientFormData({...clientFormData, password: e.target.value})}
                        className={cn(
                          "w-full border rounded-2xl px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-violet-500/50 pr-12",
                          theme === 'dark' 
                            ? "bg-zinc-950 border-zinc-800 text-zinc-200" 
                            : "bg-zinc-50 border-zinc-200 text-zinc-900"
                        )}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={cn(
                          "absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors",
                          theme === 'dark' ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"
                        )}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* INTERESSES (ETIQUETAS) */}
                  <div className="pt-2">
                    <label className={cn(
                      "block text-[10px] font-black uppercase tracking-[0.2em] mb-2",
                      theme === 'dark' ? "text-zinc-500" : "text-zinc-400"
                    )}>Interesses / Peças</label>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={interestInput}
                        onChange={e => setInterestInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddInterest())}
                        className={cn(
                          "flex-1 border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500/50",
                          theme === 'dark' 
                            ? "bg-zinc-950 border-zinc-800 text-zinc-200" 
                            : "bg-zinc-50 border-zinc-200 text-zinc-900"
                        )}
                        placeholder="Ex: Motor Titan 160"
                      />
                      <button
                        type="button"
                        onClick={handleAddInterest}
                        className={cn(
                          "w-12 h-12 flex items-center justify-center rounded-2xl transition-all active:scale-95 shrink-0",
                          theme === 'dark' ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-600"
                        )}
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {clientFormData.interests.map((interest, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-500/10 text-violet-400 border border-violet-500/20">
                          {interest}
                          <button type="button" onClick={() => handleRemoveInterest(idx)} className="hover:text-violet-300">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* COMPRAS (ETIQUETAS) */}
                  <div className="pt-2">
                    <label className={cn(
                      "block text-[10px] font-black uppercase tracking-[0.2em] mb-2",
                      theme === 'dark' ? "text-zinc-500" : "text-zinc-400"
                    )}>Histórico de Compras</label>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={purchaseItemInput}
                        onChange={e => setPurchaseItemInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddPurchase())}
                        className={cn(
                          "flex-1 border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500/50",
                          theme === 'dark' 
                            ? "bg-zinc-950 border-zinc-800 text-zinc-200" 
                            : "bg-zinc-50 border-zinc-200 text-zinc-900"
                        )}
                        placeholder="Ex: Pneu R$150"
                      />
                      <button
                        type="button"
                        onClick={handleAddPurchase}
                        className={cn(
                          "w-12 h-12 flex items-center justify-center rounded-2xl transition-all active:scale-95 shrink-0",
                          theme === 'dark' ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-600"
                        )}
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {clientFormData.purchases.map((purchase, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {purchase}
                          <button type="button" onClick={() => handleRemovePurchase(idx)} className="hover:text-emerald-300">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </form>
              </div>

              {/* RODAPÉ FIXO */}
              <div className={cn(
                "absolute bottom-0 left-0 right-0 p-6 pt-4 pb-6 md:pb-8 border-t backdrop-blur-md z-10",
                theme === 'dark' ? "bg-zinc-900/90 border-zinc-800" : "bg-white/90 border-zinc-200"
              )}>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsClientModalOpen(false)}
                    className={cn(
                      "flex-1 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all border",
                      theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800" : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                    )}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    form="client-form"
                    disabled={actionLoading === 'save_client'}
                    className="flex-[1.5] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2"
                  >
                    {actionLoading === 'save_client' ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingClient ? 'Salvar Alterações' : 'Salvar Cliente')}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
