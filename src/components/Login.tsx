import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { cn } from '../utils';
import { Eye, EyeOff, Loader2, Package, Bike, Tag, Layers } from 'lucide-react';
import { api } from '../utils/api';
import { CATEGORIAS_OFICIAIS } from '../constants/lists';

interface LoginProps {
  onLogin: (token: string) => void;
}

const Marquee = React.memo(({ items, variant = 'default', speed = 40 }: { items: string[], variant?: 'default' | 'violet', speed?: number }) => {
  const animateX = React.useMemo(() => ["0%", "-50%"], []);
  
  return (
    <div className="relative w-full overflow-hidden py-1" style={{ maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)' }}>
      <motion.div
        animate={{ x: animateX }}
        transition={{ repeat: Infinity, duration: speed, ease: "linear" }}
        className="flex gap-2 w-max pr-2"
      >
        {[...items, ...items].map((item, i) => (
          <span 
            key={i} 
            className={cn(
              "px-3 md:px-4 py-1.5 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-wider border whitespace-nowrap transition-colors",
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
});

export const Login = ({ onLogin }: LoginProps) => {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRegister, setIsRegister] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Inicializa com dados do localStorage para evitar o \"0\" inicial
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
    if (val.includes('@')) return val;
    const cleaned = val.replace(/\D/g, '').slice(0, 11);
    const match = cleaned.match(/^(\d{2})(\d{5})(\d{4})$/) || cleaned.match(/^(\d{2})(\d{4,5})(\d{0,4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}${match[3] ? '-' + match[3] : ''}`;
    }
    return cleaned;
  };

  const validatePassword = (pass: string) => {
    const hasMinLength = pass.length >= 8;
    const hasTwoNumbers = (pass.match(/\d/g) || []).length >= 2;
    return hasMinLength && hasTwoNumbers;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    const isEmail = phone.includes('@');
    const cleanPhone = isEmail ? phone.trim() : phone.replace(/\D/g, '');
    const whatsappRegex = /^\d{10,13}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!isEmail && !whatsappRegex.test(cleanPhone)) {
      setError('Número de WhatsApp inválido (deve ter entre 10 e 13 dígitos)');
      setLoading(false);
      return;
    }

    if (isEmail && !emailRegex.test(cleanPhone)) {
      setError('E-mail inválido');
      setLoading(false);
      return;
    }

    try {
      if (isRegister) {
        if (password !== confirmPassword) {
          setError('As senhas não coincidem');
          setLoading(false);
          return;
        }

        if (!validatePassword(password)) {
          setError('A senha deve ter no mínimo 8 caracteres e 2 números');
          setLoading(false);
          return;
        }

        const result = await api.post('/api/register', { 
          phone: cleanPhone, 
          password: password.trim(),
          name: isRegister ? name.trim() : undefined
        });

        if (result.success) {
          localStorage.setItem('auth_token', result.token);
          localStorage.setItem('user_role', result.user?.role || 'client');
          localStorage.setItem('user_name', result.user?.name || name || 'Cliente');
          localStorage.setItem('user_phone', cleanPhone);
          onLogin(result.token);
        } else {
          setError(result.error || 'Erro ao criar conta');
        }
      } else {
        const result = await api.post('/api/login', { 
          phone: cleanPhone, 
          password: password.trim()
        });
        
        if (result.success) {
          localStorage.setItem('auth_token', result.token);
          localStorage.setItem('user_role', result.user?.role || 'client');
          localStorage.setItem('user_name', result.user?.name || 'Cliente');
          localStorage.setItem('user_phone', cleanPhone);
          onLogin(result.token);
        } else {
          setError(result.error || 'Telefone/E-mail ou senha incorretos');
        }
      }
    } catch (error) {
      console.error('Erro na autenticação:', error);
      setError('Erro ao conectar ao servidor');
    } finally {
      setLoading(false);
    }
  };

  const loginRef = React.useRef<HTMLDivElement>(null);

  const scrollToLogin = () => {
    loginRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const allBrands = React.useMemo(() => Array.from(new Set([
    'HONDA', 'YAMAHA', 'SUZUKI', 'SHINERAY', 
    ...(stats.marcas || []).map((m: string) => m.toUpperCase())
  ])).sort((a, b) => a.localeCompare(b)), [stats.marcas]);

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

      <div className="h-[100dvh] md:min-h-screen flex items-center justify-center p-0 md:p-4 relative z-10 no-scrollbar overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-4xl bg-zinc-900/80 backdrop-blur-xl rounded-none md:rounded-[2rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-y-auto md:overflow-hidden flex flex-col md:flex-row border-0 md:border border-zinc-800/50 h-[100dvh] md:h-auto no-scrollbar snap-y snap-mandatory"
        >
               {/* Esquerda: Painel de Status (Full screen no mobile) */}
          <div className="w-full md:w-5/12 h-[100dvh] md:min-h-[550px] bg-zinc-950 p-6 md:p-8 text-white flex flex-col justify-center gap-y-6 md:gap-y-10 relative overflow-hidden border-b md:border-b-0 md:border-r border-zinc-800/50 shrink-0 snap-start">
            {/* Efeito de Gradiente Interno */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-violet-600/10 via-transparent to-transparent pointer-events-none" />
            
            <div className="relative z-10 flex flex-col items-center text-center pt-6 md:pt-12">
              <div className="mb-2 md:mb-4">
                <h1 className="text-2xl md:text-5xl font-black tracking-tighter uppercase leading-none">
                  <span className="text-white">RK</span>
                  <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent"> SUCATAS</span>
                </h1>
              </div>
              <p className="text-zinc-400 text-[10px] md:text-base font-medium leading-relaxed max-w-[240px] md:max-w-sm mx-auto">
                O maior estoque de peças da região com procedência garantida. <br className="hidden md:block" />
                Sua moto merece o melhor desempenho, explore nosso catálogo.
              </p>
            </div>

            <div className="space-y-3 md:space-y-6 relative z-10">
              <div className="group">
                <div className="text-[7px] md:text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-1.5 md:mb-3 text-center">Resumo do Estoque</div>
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  <motion.div 
                    whileHover={{ y: -2, borderColor: 'rgba(139, 92, 246, 0.4)' }}
                    className="bg-zinc-900/40 backdrop-blur-xl p-2.5 md:p-4 rounded-lg md:rounded-xl border border-zinc-800/50 transition-all shadow-2xl shadow-black/20"
                  >
                    <div className="text-lg md:text-3xl font-black text-white mb-0.5 tracking-tighter">{stats.totalPecas}</div>
                    <div className="text-[6px] md:text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Peças em Linha</div>
                  </motion.div>
                  <motion.div 
                    whileHover={{ y: -2, borderColor: 'rgba(139, 92, 246, 0.4)' }}
                    className="bg-zinc-900/40 backdrop-blur-xl p-2.5 md:p-4 rounded-lg md:rounded-xl border border-zinc-800/50 transition-all shadow-2xl shadow-black/20"
                  >
                    <div className="text-lg md:text-3xl font-black text-white mb-0.5 tracking-tighter">{stats.totalMotos}</div>
                    <div className="text-[6px] md:text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Motos no Pátio</div>
                  </motion.div>
                </div>
              </div>

              <div className="space-y-3 md:space-y-4">
                <div>
                  <div className="text-[8px] md:text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-1.5 md:mb-2 flex items-center justify-center gap-2">
                    Principais Marcas
                  </div>
                  <Marquee items={allBrands} variant="violet" speed={35} />
                </div>

                <div>
                  <div className="text-[8px] md:text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-1.5 md:mb-2 flex items-center justify-center gap-2">
                    Categorias em Destaque
                  </div>
                  <Marquee items={CATEGORIAS_OFICIAIS} speed={120} />
                </div>
              </div>
            </div>

            <div className="relative z-10 flex flex-col gap-3 md:gap-4 pt-3 md:pt-6">
              {/* Botão Ver Catálogo (Mobile Only) */}
              <div className="md:hidden flex flex-col items-center gap-3">
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={scrollToLogin}
                  className="w-full bg-gradient-to-r from-violet-600 to-blue-600 text-white py-3.5 rounded-xl font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 group shadow-[0_10px_40px_rgba(139,92,246,0.3)] active:shadow-none text-[10px]"
                >
                  Ver Catálogo
                  <motion.div
                    animate={{ y: [0, 3, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  >
                    <Package size={16} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                  </motion.div>
                </motion.button>
              </div>

              <div className="flex items-center justify-between text-[8px] md:text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                <span className="ml-[20px] md:ml-[40px]">© 2026 RK SUCATAS</span>
                <span className="hidden md:inline">• GESTÃO PROFISSIONAL</span>
              </div>
            </div>
          </div>

          {/* Direita: Formulário de Acesso (Full screen no mobile) */}
          <div 
            ref={loginRef}
            className="w-full md:w-7/12 h-[100dvh] md:min-h-[550px] p-6 md:p-12 lg:p-16 flex flex-col justify-center bg-zinc-900/40 backdrop-blur-sm shrink-0 snap-start"
          >
            <div className="max-w-[320px] w-full mx-auto">
              <div className="mb-6 md:mb-10">
                <h2 className="text-xl md:text-2xl font-black text-white mb-2 tracking-tight">
                  {isRegister ? 'Criar Conta' : 'Bem-vindo!'}
                </h2>
                <p className="text-zinc-400 font-medium text-[10px] md:text-xs leading-relaxed">
                  {isRegister 
                    ? 'Preencha os dados abaixo para se cadastrar no sistema.' 
                    : 'Entre com seu WhatsApp e senha para acessar o painel administrativo.'}
                </p>
              </div>
              
              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] md:text-xs font-bold flex items-center gap-2"
                >
                  <div className="w-1 h-1 bg-red-500 rounded-full" />
                  {error}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-2.5 md:space-y-4">
                {isRegister && (
                  <div className="space-y-1 md:space-y-1.5">
                    <label className="text-[7px] md:text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Nome Completo</label>
                    <input 
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: João da Silva"
                      className="w-full bg-zinc-950/40 px-3.5 py-2.5 md:px-4 md:py-3 rounded-lg md:rounded-xl border border-zinc-800/50 text-white placeholder:text-zinc-800 focus:ring-2 focus:ring-violet-600/50 focus:border-violet-500/50 outline-none transition-all font-bold text-xs md:text-sm shadow-inner"
                      required={isRegister}
                    />
                  </div>
                )}

                <div className="space-y-1 md:space-y-1.5">
                  <label className="text-[7px] md:text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Seu WhatsApp</label>
                  <input 
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    className="w-full bg-zinc-950/40 px-3.5 py-2.5 md:px-4 md:py-3 rounded-lg md:rounded-xl border border-zinc-800/50 text-white placeholder:text-zinc-800 focus:ring-2 focus:ring-violet-600/50 focus:border-violet-500/50 outline-none transition-all font-bold text-xs md:text-sm shadow-inner"
                    required
                  />
                </div>
                
                <div className="space-y-1 md:space-y-1.5 relative">
                  <label className="text-[7px] md:text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Sua Senha</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full bg-zinc-950/40 px-3.5 py-2.5 md:px-4 md:py-3 rounded-lg md:rounded-xl border border-zinc-800/50 text-white placeholder:text-zinc-800 focus:ring-2 focus:ring-violet-600/50 focus:border-violet-500/50 outline-none transition-all font-bold text-xs md:text-sm shadow-inner"
                      required
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)} 
                      className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors p-1.5"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" /> : <Eye className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" />}
                    </button>
                  </div>
                  {isRegister && (
                    <p className="text-[6px] md:text-[8px] text-zinc-500 font-bold uppercase tracking-wider mt-1 ml-1">
                      Mínimo 8 caracteres e 2 números
                    </p>
                  )}
                </div>

                {isRegister && (
                  <div className="space-y-1 md:space-y-1.5">
                    <label className="text-[7px] md:text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Confirmar Senha</label>
                    <input 
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full bg-zinc-950/40 px-3.5 py-2.5 md:px-4 md:py-3 rounded-lg md:rounded-xl border border-zinc-800/50 text-white placeholder:text-zinc-800 focus:ring-2 focus:ring-violet-600/50 focus:border-violet-500/50 outline-none transition-all font-bold text-xs md:text-sm shadow-inner"
                      required
                    />
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-violet-600 text-white py-3 md:py-4 rounded-lg md:rounded-xl font-black uppercase tracking-widest hover:bg-violet-500 transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 mt-3 md:mt-5 shadow-2xl shadow-violet-600/30 disabled:opacity-50 text-[8px] md:text-xs"
                >
                  {loading ? <Loader2 className="animate-spin w-4 h-4 md:w-5 md:h-5" /> : (isRegister ? 'Criar Minha Conta' : 'Entrar no Sistema')}
                </button>
              </form>

              <div className="mt-4 md:mt-6 text-center">
                <button 
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setError(null);
                  }}
                  className="text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-[0.15em] hover:text-violet-400 transition-colors"
                >
                  {isRegister ? 'Já tem uma conta? Faça Login' : 'Não tem conta? Registre-se'}
                </button>
              </div>

              <div className="mt-6 md:mt-10 pt-4 md:pt-6 border-t border-zinc-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-[6px] md:text-[9px] font-bold text-zinc-600 uppercase tracking-wider">Servidor Online</span>
                </div>
                <span className="text-[6px] md:text-[9px] font-bold text-zinc-800 uppercase">PB • BR • V2.5</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
