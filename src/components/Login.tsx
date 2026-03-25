import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { cn } from '../utils';
import { Eye, EyeOff, Loader2, Package, Bike, Tag } from 'lucide-react';
import { api } from '../utils/api';

interface LoginProps {
  onLogin: (token: string) => void;
}

export const Login = ({ onLogin }: LoginProps) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ totalPecas: 0, totalMotos: 0, marcas: [] as string[] });

  useEffect(() => {
    fetch('/api/public-stats')
      .then(res => res.json())
      .then(data => {
        setStats({
          totalPecas: data.totalPecas || 0,
          totalMotos: data.totalMotos || 0,
          marcas: data.marcas || []
        });
      })
      .catch(console.error);
  }, []);

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
    setLoading(true);
    
    try {
      const result = await api.post('/api/login', { 
        phone: phone.replace(/\D/g, ''), 
        password 
      });
      
      if (result.success) {
        console.log('🔑 Login response:', result);
        localStorage.setItem('auth_token', result.token);
        onLogin(result.token);
      } else {
        alert('Senha incorreta!');
      }
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      alert('Erro ao conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-5xl bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row"
      >
        {/* Esquerda: Estatísticas */}
        <div className="md:w-5/12 bg-zinc-900 p-10 text-white flex flex-col justify-between">
          <div>
            <h1 className="text-4xl font-black mb-2 tracking-tighter">RK Sucatas</h1>
            <p className="text-zinc-400">Gerenciamento inteligente de peças e motos.</p>
          </div>

          <div className="space-y-4 my-10">
            <div className="bg-zinc-800/50 p-5 rounded-2xl flex items-center gap-4 border border-zinc-700/50">
              <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
                <Package size={24} />
              </div>
              <div>
                <div className="text-3xl font-bold">{stats.totalPecas}</div>
                <div className="text-sm text-zinc-400">Peças em estoque</div>
              </div>
            </div>
            <div className="bg-zinc-800/50 p-5 rounded-2xl flex items-center gap-4 border border-zinc-700/50">
              <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400">
                <Bike size={24} />
              </div>
              <div>
                <div className="text-3xl font-bold">{stats.totalMotos}</div>
                <div className="text-sm text-zinc-400">Motos cadastradas</div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Tag size={14} /> Principais Marcas
            </div>
            <div className="flex flex-wrap gap-2">
              {stats.marcas.length > 0 ? stats.marcas.map(m => (
                <span key={m} className="bg-zinc-800 px-3 py-1 rounded-full text-xs font-medium text-zinc-300 border border-zinc-700">
                  {m}
                </span>
              )) : <span className="text-zinc-600 text-sm">Nenhuma marca registrada</span>}
            </div>
          </div>
        </div>

        {/* Direita: Login */}
        <div className="md:w-7/12 p-10 flex flex-col justify-center bg-white">
          <div className="max-w-md w-full mx-auto">
            <h2 className="text-3xl font-bold mb-2 text-zinc-900">Bem-vindo de volta</h2>
            <p className="text-zinc-500 mb-8">Entre com suas credenciais para acessar o painel.</p>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">WhatsApp</label>
                <input 
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  required
                />
              </div>
              <div className="relative">
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Senha</label>
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-10 text-zinc-400 hover:text-zinc-600">
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-zinc-900 text-white py-3 rounded-xl font-bold hover:bg-zinc-800 transition flex items-center justify-center gap-2 mt-2"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Entrar no Sistema'}
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
