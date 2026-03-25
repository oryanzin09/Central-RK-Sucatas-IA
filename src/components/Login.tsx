import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { cn } from '../utils';
import { Eye, EyeOff, Loader2, Package, Bike, Tag, Layers } from 'lucide-react';
import { api } from '../utils/api';
import { CATEGORIAS_OFICIAIS } from '../constants/lists';

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

  const loginRef = React.useRef<HTMLDivElement>(null);

  const scrollToLogin = () => {
    loginRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const Marquee = ({ items, variant = 'default', speed = 40 }: { items: string[], variant?: 'default' | 'violet', speed?: number }) => {
    return (
      <div className="relative w-full overflow-hidden py-1" style={{ maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)' }}>
        <motion.div
          animate={{ x: ["0%", "-50%"] }}
          transition={{ repeat: Infinity, duration: speed, ease: "linear" }}
          className="flex gap-3 w-max pr-3"
        >
          {[...items, ...items].map((item, i) => (
            <span 
              key={i} 
              className={cn(
                "px-4 md:px-5 py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-wider border whitespace-nowrap transition-colors",
                variant === 'violet' 
                  ? "bg-violet-600/10 text-violet-400 border-violet-500/20" 
                  : "bg-zinc-900/50 text-zinc-500 border-zinc-800/50"
              )}
            >
              {item}
            </span>
          ))}
        </motion.div>
      </div>
    );
  };

  const allBrands = Array.from(new Set([
    'HONDA', 'YAMAHA', 'SUZUKI', 'SHINERAY', 
    ...(stats.marcas || []).map((m: string) => m.toUpperCase())
  ])).sort((a, b) => a.localeCompare(b));

  return (
    <div className="min-h-screen bg-[#09090b] font-sans relative overflow-x-hidden no-scrollbar">
      {/* Efeito Aura de Fundo Dinâmico */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.15, 0.1],
          x: [0, 50, 0],
          y: [0, -30, 0]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-violet-600/20 blur-[120px] rounded-full pointer-events-none" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.3, 1],
          opacity: [0.1, 0.2, 0.1],
          x: [0, -60, 0],
          y: [0, 40, 0]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none" 
      />
      
      {/* Overlay de Ruído Sutil */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay" />

      <div className="h-[100dvh] md:min-h-screen flex items-center justify-center p-0 md:p-6 relative z-10 no-scrollbar overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-5xl bg-zinc-900/80 backdrop-blur-xl rounded-none md:rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-y-auto md:overflow-hidden flex flex-col md:flex-row border-0 md:border border-zinc-800/50 h-[100dvh] md:h-auto no-scrollbar snap-y snap-mandatory"
        >
               {/* Esquerda: Painel de Status (Full screen no mobile) */}
          <div className="w-full md:w-5/12 h-[100dvh] md:min-h-[600px] bg-zinc-950 p-6 md:p-10 text-white flex flex-col justify-center gap-y-8 md:gap-y-12 relative overflow-hidden border-b md:border-b-0 md:border-r border-zinc-800/50 shrink-0 snap-start">
            {/* Efeito de Gradiente Interno */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-violet-600/10 via-transparent to-transparent pointer-events-none" />
            
            <div className="relative z-10 flex flex-col items-center text-center pt-8 md:pt-16">
              <div className="mb-3 md:mb-6">
                <h1 className="text-3xl md:text-6xl font-black tracking-tighter uppercase leading-none">
                  <span className="text-white">RK</span>
                  <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent"> SUCATAS</span>
                </h1>
              </div>
              <p className="text-zinc-400 text-xs md:text-lg font-medium leading-relaxed max-w-[260px] md:max-w-md mx-auto">
                O maior estoque de peças da região com procedência garantida. <br className="hidden md:block" />
                Sua moto merece o melhor desempenho, explore nosso catálogo.
              </p>
            </div>

            <div className="space-y-4 md:space-y-8 relative z-10">
              <div className="group">
                <div className="text-[8px] md:text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-2 md:mb-4 text-center">Resumo do Estoque</div>
                <div className="grid grid-cols-2 gap-2 md:gap-4">
                  <motion.div 
                    whileHover={{ y: -3, borderColor: 'rgba(139, 92, 246, 0.4)' }}
                    className="bg-zinc-900/40 backdrop-blur-xl p-3 md:p-5 rounded-lg md:rounded-2xl border border-zinc-800/50 transition-all shadow-2xl shadow-black/20"
                  >
                    <div className="text-xl md:text-4xl font-black text-white mb-0.5 tracking-tighter">{stats.totalPecas}</div>
                    <div className="text-[7px] md:text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Peças em Linha</div>
                  </motion.div>
                  <motion.div 
                    whileHover={{ y: -3, borderColor: 'rgba(139, 92, 246, 0.4)' }}
                    className="bg-zinc-900/40 backdrop-blur-xl p-3 md:p-5 rounded-lg md:rounded-2xl border border-zinc-800/50 transition-all shadow-2xl shadow-black/20"
                  >
                    <div className="text-xl md:text-4xl font-black text-white mb-0.5 tracking-tighter">{stats.totalMotos}</div>
                    <div className="text-[7px] md:text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Motos no Pátio</div>
                  </motion.div>
                </div>
              </div>

              <div className="space-y-4 md:space-y-6">
                <div>
                  <div className="text-[9px] md:text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-2 md:mb-3 flex items-center justify-center gap-2">
                    Principais Marcas
                  </div>
                  <Marquee items={allBrands} variant="violet" speed={35} />
                </div>

                <div>
                  <div className="text-[9px] md:text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-2 md:mb-3 flex items-center justify-center gap-2">
                    Categorias em Destaque
                  </div>
                  <Marquee items={CATEGORIAS_OFICIAIS} speed={120} />
                </div>
              </div>
            </div>

            <div className="relative z-10 flex flex-col gap-4 md:gap-6 pt-4 md:pt-8">
              {/* Botão Ver Catálogo (Mobile Only) */}
              <div className="md:hidden flex flex-col items-center gap-4">
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={scrollToLogin}
                  className="w-full bg-gradient-to-r from-violet-600 to-blue-600 text-white py-4 rounded-xl font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 group shadow-[0_10px_40px_rgba(139,92,246,0.3)] active:shadow-none text-xs"
                >
                  Ver Catálogo
                  <motion.div
                    animate={{ y: [0, 4, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  >
                    <Package size={18} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                  </motion.div>
                </motion.button>
              </div>

              <div className="flex items-center justify-between text-[9px] md:text-[11px] text-zinc-600 font-bold uppercase tracking-widest">
                <span className="ml-[100px]">© 2026 RK SUCATAS</span>
                <span className="hidden md:inline">• GESTÃO PROFISSIONAL</span>
              </div>
            </div>
          </div>

          {/* Direita: Formulário de Acesso (Full screen no mobile) */}
          <div 
            ref={loginRef}
            className="w-full md:w-7/12 h-[100dvh] md:min-h-[600px] p-6 md:p-12 flex flex-col justify-center bg-zinc-900/40 backdrop-blur-sm shrink-0 snap-start"
          >
            <div className="max-w-md w-full mx-auto">
              <div className="mb-6 md:mb-10">
                <h2 className="text-2xl md:text-4xl font-black text-white mb-2 tracking-tight">Bem-vindo!</h2>
                <p className="text-zinc-400 font-medium text-xs md:text-base">Entre com seu WhatsApp e senha para acessar o painel administrativo.</p>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-3 md:space-y-6">
                <div className="space-y-1.5 md:space-y-2">
                  <label className="text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Seu WhatsApp</label>
                  <input 
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    className="w-full bg-zinc-950/40 px-4 py-3 md:px-5 md:py-4 rounded-lg md:rounded-2xl border border-zinc-800/50 text-white placeholder:text-zinc-800 focus:ring-2 focus:ring-violet-600/50 focus:border-violet-500/50 outline-none transition-all font-bold text-sm md:text-base shadow-inner"
                    required
                  />
                </div>
                <div className="space-y-1.5 md:space-y-2 relative">
                  <label className="text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Sua Senha</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full bg-zinc-950/40 px-4 py-3 md:px-5 md:py-4 rounded-lg md:rounded-2xl border border-zinc-800/50 text-white placeholder:text-zinc-800 focus:ring-2 focus:ring-violet-600/50 focus:border-violet-500/50 outline-none transition-all font-bold text-sm md:text-base shadow-inner"
                      required
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)} 
                      className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors p-2"
                    >
                      {showPassword ? <EyeOff size={16} md:size={20} /> : <Eye size={16} md:size={20} />}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-violet-600 text-white py-3.5 md:py-5 rounded-lg md:rounded-2xl font-black uppercase tracking-widest hover:bg-violet-500 transition-all active:scale-[0.98] flex items-center justify-center gap-3 mt-4 md:mt-6 shadow-2xl shadow-violet-600/30 disabled:opacity-50 text-[9px] md:text-sm"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} md:size={22} /> : 'Entrar no Sistema'}
                </button>
              </form>

              <div className="mt-8 md:mt-16 pt-6 md:pt-8 border-t border-zinc-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  <span className="text-[7px] md:text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Servidor Online</span>
                </div>
                <span className="text-[7px] md:text-[10px] font-bold text-zinc-800 uppercase">PB • BR • V2.5</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
