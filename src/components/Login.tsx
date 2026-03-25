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
  
  // Inicializa com dados do localStorage para evitar o "0" inicial
  const [stats, setStats] = useState(() => {
    const saved = localStorage.getItem('rk_public_stats');
    return saved ? JSON.parse(saved) : { totalPecas: 0, totalMotos: 0, marcas: [] };
  });

  useEffect(() => {
    fetch('/api/public-stats')
      .then(res => res.json())
      .then(data => {
        const newStats = {
          totalPecas: data.totalPecas || 0,
          totalMotos: data.totalMotos || 0,
          marcas: data.marcas || []
        };
        setStats(newStats);
        localStorage.setItem('rk_public_stats', JSON.stringify(newStats));
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
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] p-4 md:p-6 font-sans relative overflow-hidden">
      {/* Efeito Aura de Fundo */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none animate-pulse" style={{ animationDelay: '2s' }} />
      
      {/* Overlay de Ruído Sutil */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-5xl bg-zinc-900/80 backdrop-blur-xl rounded-3xl md:rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col md:flex-row border border-zinc-800/50 relative z-10"
      >
        {/* Esquerda: Painel de Status */}
        <div className="w-full md:w-5/12 bg-zinc-950 p-6 md:p-12 text-white flex flex-col justify-between relative overflow-hidden border-b md:border-b-0 md:border-r border-zinc-800/50">
          {/* Efeito de Gradiente Interno */}
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-violet-600/10 via-transparent to-transparent pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3 md:mb-4">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-violet-600 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-violet-600/20">
                <Bike className="text-white" size={16} md:size={20} />
              </div>
              <h1 className="text-xl md:text-3xl font-black tracking-tighter uppercase">RK Sucatas</h1>
            </div>
            <p className="text-zinc-500 text-[10px] md:text-sm font-medium leading-relaxed max-w-[280px]">
              Gestão inteligente para desmonte, <br className="hidden md:block" />
              estoque e vendas integradas.
            </p>
          </div>

          <div className="space-y-6 md:space-y-12 my-6 md:my-12 relative z-10">
            <div className="group">
              <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-3">Resumo do Estoque</div>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="bg-zinc-900/50 backdrop-blur-md p-3 md:p-5 rounded-xl md:rounded-2xl border border-zinc-800/50 transition-all hover:border-violet-500/30">
                  <div className="text-xl md:text-3xl font-black text-white mb-0.5">{stats.totalPecas}</div>
                  <div className="text-[8px] md:text-[10px] font-bold text-zinc-500 uppercase">Peças em Linha</div>
                </div>
                <div className="bg-zinc-900/50 backdrop-blur-md p-3 md:p-5 rounded-xl md:rounded-2xl border border-zinc-800/50 transition-all hover:border-violet-500/30">
                  <div className="text-xl md:text-3xl font-black text-white mb-0.5">{stats.totalMotos}</div>
                  <div className="text-[8px] md:text-[10px] font-bold text-zinc-500 uppercase">Motos no Pátio</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                Principais Marcas
              </div>
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                {['HONDA', 'YAMAHA', 'SUZUKI', 'SHINERAY'].map(m => (
                  <span key={m} className="bg-violet-600/10 px-2.5 md:px-4 py-1 rounded-full text-[8px] md:text-[10px] font-black text-violet-400 border border-violet-500/20 uppercase tracking-wider">
                    {m}
                  </span>
                ))}
                
                {stats.marcas.filter((m: string) => !['HONDA', 'YAMAHA', 'SUZUKI', 'SHINERAY'].includes(m.toUpperCase())).slice(0, 2).map((m: string) => (
                  <span key={m} className="bg-zinc-900/50 px-2.5 md:px-4 py-1 rounded-full text-[8px] md:text-[10px] font-black text-zinc-500 border border-zinc-800/50 uppercase tracking-wider">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="text-[8px] md:text-[10px] text-zinc-600 font-bold uppercase tracking-widest relative z-10">
            © 2026 RK SUCATAS • GESTÃO PROFISSIONAL
          </div>
        </div>

        {/* Direita: Formulário de Acesso */}
        <div className="w-full md:w-7/12 p-6 md:p-16 flex flex-col justify-center bg-zinc-900/40 backdrop-blur-sm">
          <div className="max-w-md w-full mx-auto">
            <div className="mb-6 md:mb-12">
              <h2 className="text-2xl md:text-4xl font-black text-white mb-2 tracking-tight">Bem-vindo!</h2>
              <p className="text-zinc-500 font-medium text-xs md:text-base">Entre com seu WhatsApp e senha para acessar o painel administrativo.</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Seu WhatsApp</label>
                <input 
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="w-full bg-zinc-950/50 px-4 py-3.5 md:px-5 md:py-4 rounded-xl md:rounded-2xl border border-zinc-800/50 text-white placeholder:text-zinc-800 focus:ring-2 focus:ring-violet-600/50 focus:border-violet-500/50 outline-none transition-all font-medium text-sm md:text-base"
                  required
                />
              </div>
              <div className="space-y-1.5 relative">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Sua Senha</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full bg-zinc-950/50 px-4 py-3.5 md:px-5 md:py-4 rounded-xl md:rounded-2xl border border-zinc-800/50 text-white placeholder:text-zinc-800 focus:ring-2 focus:ring-violet-600/50 focus:border-violet-500/50 outline-none transition-all font-medium text-sm md:text-base"
                    required
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-violet-600 text-white py-4 md:py-5 rounded-xl md:rounded-2xl font-black uppercase tracking-widest hover:bg-violet-500 transition-all active:scale-[0.98] flex items-center justify-center gap-3 mt-2 shadow-xl shadow-violet-600/20 disabled:opacity-50 text-[10px] md:text-sm"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : 'Entrar no Sistema'}
              </button>
            </form>

            <div className="mt-8 md:mt-12 pt-5 md:pt-8 border-t border-zinc-800/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[8px] md:text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Servidor Online</span>
              </div>
              <span className="text-[8px] md:text-[10px] font-bold text-zinc-800 uppercase">PB • BR • V2.5</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
