import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { cn } from '../utils';
import { Eye, EyeOff, Loader2, Package, Bike, Tag, Layers } from 'lucide-react';
import { api } from '../utils/api';
import { CATEGORIAS_OFICIAIS } from '../constants/lists';
import { auth, googleProvider, db } from '../firebase';
import { signInWithPopup, signInWithRedirect, getRedirectResult, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

interface LoginProps {
  onLogin: () => void;
}

const Marquee = React.memo(({ items, variant = 'default', speed = 40 }: { items: string[], variant?: 'default' | 'violet', speed?: number }) => {
  return (
    <div className="relative w-full overflow-hidden py-1" style={{ maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)' }}>
      <div
        className="flex gap-2 w-max pr-2 will-change-transform"
        style={{ animation: `marquee ${speed}s linear infinite` }}
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
      </div>
    </div>
  );
});

export const Login = ({ onLogin }: LoginProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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

  useEffect(() => {
    // Check for redirect result when component mounts (Crucial for PWA mobile login)
    const checkRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          setLoading(true);
          // App.tsx onAuthStateChanged will handle the rest (syncing to Firestore, etc.)
        }
      } catch (err: any) {
        console.error("Redirect login error:", err);
        setError(err.message || 'Erro ao fazer login com o Google');
      } finally {
        setLoading(false);
      }
    };
    
    checkRedirectResult();
  }, []);

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        // 1. Native Android/iOS Login via Capacitor Plugin
        const result = await FirebaseAuthentication.signInWithGoogle();
        if (result.credential?.idToken) {
          const credential = GoogleAuthProvider.credential(result.credential.idToken);
          await signInWithCredential(auth, credential);
          // App.tsx onAuthStateChanged will handle the rest
        } else {
          throw new Error("Falha ao obter token do Google.");
        }
      } else {
        // 2. Web/PWA Login
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        if (isMobile) {
          // Use redirect for mobile web to avoid popup blockers
          await signInWithRedirect(auth, googleProvider);
        } else {
          // Use popup for desktop web
          await signInWithPopup(auth, googleProvider);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao fazer login com o Google');
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
      {/* Efeito Aura de Fundo Dinâmico (Apenas Desktop) */}
      <div className="hidden md:block">
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
      </div>
      
      {/* Overlay de Ruído Sutil (Apenas Desktop) */}
      <div className="hidden md:block absolute inset-0 opacity-[0.05] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay" />

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
                  <div 
                    className="bg-zinc-900/40 backdrop-blur-xl p-2.5 md:p-4 rounded-lg md:rounded-xl border border-zinc-800/50 transition-all shadow-2xl shadow-black/20 hover:-translate-y-0.5 hover:border-violet-500/40"
                  >
                    <div className="text-lg md:text-3xl font-black text-white mb-0.5 tracking-tighter">{stats.totalPecas}</div>
                    <div className="text-[6px] md:text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Peças em Linha</div>
                  </div>
                  <div 
                    className="bg-zinc-900/40 backdrop-blur-xl p-2.5 md:p-4 rounded-lg md:rounded-xl border border-zinc-800/50 transition-all shadow-2xl shadow-black/20 hover:-translate-y-0.5 hover:border-violet-500/40"
                  >
                    <div className="text-lg md:text-3xl font-black text-white mb-0.5 tracking-tighter">{stats.totalMotos}</div>
                    <div className="text-[6px] md:text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Motos no Pátio</div>
                  </div>
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
                  <div className="group-hover:-translate-y-1 transition-transform duration-300">
                    <Package size={16} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                  </div>
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
                  Bem-vindo!
                </h2>
                <p className="text-zinc-400 font-medium text-[10px] md:text-xs leading-relaxed">
                  Entre com sua conta Google para acessar o painel administrativo.
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

              <div className="space-y-4">
                <button 
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full bg-white text-zinc-900 py-3 md:py-4 rounded-lg md:rounded-xl font-black uppercase tracking-widest hover:bg-zinc-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 mt-3 md:mt-5 shadow-xl disabled:opacity-50 text-[10px] md:text-xs"
                >
                  {loading ? <Loader2 className="animate-spin w-4 h-4 md:w-5 md:h-5" /> : (
                    <>
                      <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-6 md:h-6" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Entrar com o Google
                    </>
                  )}
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
}
