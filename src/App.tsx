/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useContext, createContext, useRef, useCallback, memo } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { api } from './utils/api';
import QuestionsDashboard from './components/QuestionsDashboard';
import AdminUsers from './components/AdminUsers';
import AuditLogs from './components/AuditLogs';
import { 
  LayoutDashboard, 
  Package, 
  TrendingUp, 
  Users, 
  DollarSign, 
  ShoppingCart,
  Menu,
  X,
  Search,
  Bell,
  ChevronRight,
  Loader2,
  AlertCircle,
  Plus,
  Minus,
  Save,
  Wrench,
  ChevronLeft,
  Sun,
  Moon,
  Trash2,
  Layers,
  Check,
  Bike,
  Edit,
  Settings,
  History,
  Calendar,
  Filter,
  RefreshCw,
  ExternalLink,
  Edit2,
  LayoutGrid,
  Table as TableIcon,
  MessageSquare,
  Upload,
  User,
  Camera,
  Image as ImageIcon,
  Box,
  BarChart3,
  MessageCircle,
  ShoppingBag,
  Eye,
  FileText,
  CreditCard,
  Zap,
  Tag,
  FileDown,
  EyeOff,
  Truck,
  Activity,
  MapPin,
  Hash,
  TrendingDown,
  Copy,
  ArrowDownAZ,
  LogOut,
  UserCog
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { cn } from './utils';
import { BudgetModal } from './components/BudgetModal';
import { GlobalSearch } from './components/GlobalSearch';
import { CustomDropdown } from './components/CustomDropdown';
import { CATEGORIAS_OFICIAIS, MOTOS_OFICIAIS, PAGAMENTOS_OFICIAIS } from './constants/lists';
import { MobileBottomNav } from './components/MobileBottomNav';
import { FreteView } from './components/FreteView';
import { Atendimento } from './pages/Atendimento';
import { MercadoLivre } from './pages/MercadoLivre';
import { Clients } from './pages/Clients';
import { io } from 'socket.io-client';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';

const modelosMotos = MOTOS_OFICIAIS;
const modelosUnicos = MOTOS_OFICIAIS;

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

const parseJson = async (res: Response) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error(`❌ Erro ao parsear JSON de ${res.url}. Conteúdo recebido:`, text.substring(0, 200));
    throw new Error(`Resposta inválida de ${res.url}`);
  }
};

const fetchWithRetry = async (url: string, init?: RequestInit, retries = 8) => {
  const isInternal = url.startsWith('/') || url.startsWith(window.location.origin);
  let firebaseToken = null;
  
  if (isInternal && auth.currentUser) {
    try {
      firebaseToken = await auth.currentUser.getIdToken();
    } catch (e) {
      console.error("Failed to get Firebase token for fetchWithRetry", e);
    }
  }
  
  const headers: HeadersInit = {
    ...(init?.headers || {}),
    ...(firebaseToken ? { 'Authorization': `Bearer ${firebaseToken}` } : {})
  };
  
  console.log(`🔍 Fetching ${url} with method ${init?.method || 'GET'} and headers:`, headers);
  
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { ...init, headers });
      
      // Se o status for 503 ou 502, é provável que o servidor esteja iniciando
      if (res.status === 503 || res.status === 502) {
        throw new Error('Servidor indisponível (iniciando)');
      }

      // Verifica o corpo da resposta mesmo se o status for 200
      // O proxy da plataforma às vezes retorna 200 com o HTML de "Starting Server"
      const text = await res.clone().text();
      if (
        text.includes('<title>Starting Server...</title>') || 
        text.includes('Starting Server...') ||
        text.trim().startsWith('<!doctype html>') ||
        text.trim().startsWith('<!DOCTYPE html>')
      ) {
        throw new Error('Servidor ainda iniciando (HTML recebido)');
      }

      if (res.status === 401 || res.status === 403 || res.status === 404) {
        return res; // Return directly, don't retry client errors
      }

      if (!res.ok) throw new Error(`Status ${res.status}`);
      
      return res;
    } catch (err) {
      // Don't retry if it's a known non-retryable error
      if (err instanceof Error && err.message.includes('Sessão expirada')) {
        throw err;
      }
      
      if (i === retries) {
        console.error(`❌ Falha definitiva ao buscar ${url}:`, err);
        throw err;
      }
      // Espera progressiva mais longa: 3s, 6s, 9s...
      const delay = 3000 * (i + 1);
      console.warn(`⚠️ Tentativa ${i + 1} falhou para ${url}: ${err instanceof Error ? err.message : String(err)}. Tentando novamente em ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Falha após retentativas');
};

function normalizarTexto(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function extrairModeloMoto(textoPeca: string) {
  if (!textoPeca || textoPeca.length < 3) return '';
  const textoNormalizado = normalizarTexto(textoPeca);
  for (const modelo of modelosUnicos) {
    const modeloNormalizado = normalizarTexto(modelo);
    if (textoNormalizado.includes(modeloNormalizado)) return modelo;
  }
  for (const modelo of modelosUnicos) {
    const modeloNormalizado = normalizarTexto(modelo);
    const palavrasModelo = modeloNormalizado.split(' ');
    if (palavrasModelo.length >= 2) {
      let encontrouTodas = true;
      let posicao = 0;
      for (const palavra of palavrasModelo) {
        const index = textoNormalizado.indexOf(palavra, posicao);
        if (index === -1) { encontrouTodas = false; break; }
        posicao = index + palavra.length;
      }
      if (encontrouTodas) return modelo;
    }
  }
  const padraoNumerico = textoPeca.match(/\b(50|100|110|125|150|160|190|200|250|300|400|500|600|660|900|1000)\b/i);
  if (padraoNumerico) {
    const numero = padraoNumerico[0];
    for (const modelo of modelosUnicos) {
      if (modelo.includes(numero)) return modelo;
    }
  }
  return '';
}

function extrairCategoria(textoPeca: string) {
  if (!textoPeca || textoPeca.length < 3) return '';
  const textoNormalizado = normalizarTexto(textoPeca);
  // Ordena por tamanho decrescente para pegar o termo mais específico primeiro
  const categoriasOrdenadas = [...CATEGORIAS_OFICIAIS].sort((a, b) => b.length - a.length);
  for (const categoria of categoriasOrdenadas) {
    const categoriaNormalizada = normalizarTexto(categoria);
    // Se o texto da peça contém a categoria OU a categoria contém o texto da peça (ex: "escapamento" -> "Escapamentos")
    if (textoNormalizado.includes(categoriaNormalizada) || categoriaNormalizada.includes(textoNormalizado)) return categoria;
  }
  return '';
}

const dropdownClass = (theme: string) => cn(
  "w-full border rounded-xl py-2 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-violet-500/50",
  theme === 'dark' 
    ? "bg-zinc-950 border-zinc-800 text-zinc-200 hover:border-zinc-700" 
    : "bg-white border-zinc-200 text-zinc-900 hover:border-zinc-300"
);

// Global Data Context
export const DataContext = createContext<{
  inventory: any[];
  sales: any[];
  motos: any[];
  loading: boolean;
  whatsappStatus: { connected: boolean, isConnecting: boolean, reconnectAttempts: number };
  whatsappConversations: any[];
  whatsappQr: string | null;
  setInventory: React.Dispatch<React.SetStateAction<any[]>>;
  setSales: React.Dispatch<React.SetStateAction<any[]>>;
  setMotos: React.Dispatch<React.SetStateAction<any[]>>;
  refreshData: () => Promise<void>;
  showSensitiveInfo: boolean;
  setShowSensitiveInfo: React.Dispatch<React.SetStateAction<boolean>>;
}>({
  inventory: [],
  sales: [],
  motos: [],
  loading: false,
  whatsappStatus: { connected: false, isConnecting: false, reconnectAttempts: 0 },
  whatsappConversations: [],
  whatsappQr: null,
  setInventory: () => {},
  setSales: () => {},
  setMotos: () => {},
  refreshData: async () => {},
  showSensitiveInfo: true,
  setShowSensitiveInfo: () => {},
});

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [inventory, setInventory] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [motos, setMotos] = useState<any[]>([]);

  useEffect(() => {
    try {
      const savedInventory = localStorage.getItem('rk_inventory');
      if (savedInventory) setInventory(JSON.parse(savedInventory));
      
      const savedSales = localStorage.getItem('rk_sales');
      if (savedSales) setSales(JSON.parse(savedSales));
      
      const savedMotos = localStorage.getItem('rk_motos');
      if (savedMotos) setMotos(JSON.parse(savedMotos));
    } catch (e) {
      console.error('Erro ao carregar cache do localStorage', e);
    }
  }, []);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(0);
  const lastMutationRef = useRef(0);
  const [whatsappStatus, setWhatsappStatus] = useState({ connected: false, isConnecting: false, reconnectAttempts: 0 });
  const [whatsappConversations, setWhatsappConversations] = useState<any[]>([]);
  const [whatsappQr, setWhatsappQr] = useState<string | null>(null);
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(true);
  const CACHE_TIME = 5 * 1000; // 5 segundos

  const loadData = async (force = false, silent = false) => {
    const now = Date.now();
    // Se não for forçado, não for silencioso e o cache for recente, não faz nada
    if (!force && !silent && (now - lastFetch) < CACHE_TIME && inventory.length > 0) {
      return; 
    }

    if (!silent) setLoading(true);
    
    try {
      const query = force ? '?force=true' : '';
      
      const results = await Promise.allSettled([
        fetchWithRetry(`/api/inventory${query}`),
        fetchWithRetry(`/api/sales${query}`),
        fetchWithRetry(`/api/motos${query}`)
      ]);

      // Processar resultados individualmente
      // Estoque
      if (results[0].status === 'fulfilled') {
        try {
          const data = await parseJson(results[0].value);
          if (data.success) {
            setInventory(prev => {
              const newDataStr = JSON.stringify(data.data);
              const prevDataStr = JSON.stringify(prev);
              if (newDataStr !== prevDataStr) {
                try { localStorage.setItem('rk_inventory', newDataStr); } catch (e) { console.warn('Cache de estoque cheio'); }
                return data.data;
              }
              return prev;
            });
          }
        } catch (e) {
          console.error('❌ Erro ao processar estoque:', e);
        }
      } else {
        console.error('❌ Erro ao buscar estoque:', results[0].reason);
      }

      // Vendas
      if (results[1].status === 'fulfilled') {
        try {
          const data = await parseJson(results[1].value);
          if (data.success) {
            setSales(prev => {
              const newDataStr = JSON.stringify(data.data);
              const prevDataStr = JSON.stringify(prev);
              if (newDataStr !== prevDataStr) {
                try { localStorage.setItem('rk_sales', newDataStr); } catch (e) { console.warn('Cache de vendas cheio'); }
                return data.data;
              }
              return prev;
            });
          }
        } catch (e) {
          console.error('❌ Erro ao processar vendas:', e);
        }
      } else {
        console.error('❌ Erro ao buscar vendas:', results[1].reason);
      }

      // Motos
      if (results[2].status === 'fulfilled') {
        try {
          const data = await parseJson(results[2].value);
          if (data.success) {
            // Grace period: se houve uma mutação recente (últimos 15s) e é um fetch silencioso,
            // não sobrescrevemos o estado das motos para evitar que itens novos sumam (eventual consistency do Notion)
            const isRecentMutation = (Date.now() - lastMutationRef.current) < 15000;
            if (!silent || !isRecentMutation || motos.length === 0) {
              setMotos(prev => {
                const newDataStr = JSON.stringify(data.data);
                const prevDataStr = JSON.stringify(prev);
                if (newDataStr !== prevDataStr) {
                  try { localStorage.setItem('rk_motos', newDataStr); } catch (e) { console.warn('Cache de motos cheio'); }
                  return data.data;
                }
                return prev;
              });
            } else {
              console.log('⏳ Pulando atualização de motos devido a mutação recente');
            }
          }
        } catch (e) {
          console.error('❌ Erro ao processar motos:', e);
        }
      } else {
        console.error('❌ Erro ao buscar motos:', results[2].reason);
      }
      
      setLastFetch(now);
    } catch (error: any) {
      console.error('Erro crítico ao carregar dados:', error);
      // Só mostra erro se não for silencioso
      if (!silent) {
        // Aqui poderíamos usar um toast ou setError global
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Socket global para WhatsApp e Notificações
    const socket = io();
    
    socket.on('whatsapp-status', (status) => {
      setWhatsappStatus(status);
      if (status.connected) setWhatsappQr(null);
    });

    socket.on('whatsapp-qr', (qr) => {
      setWhatsappQr(qr);
      setWhatsappStatus(prev => ({ ...prev, connected: false, isConnecting: true }));
    });

    socket.on('whatsapp-conversations', (conversations) => {
      const sorted = [...conversations].sort((a, b) => 
        new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()
      );
      setWhatsappConversations(sorted);
    });

    socket.on('whatsapp-message-updated', (updatedMsg) => {
      setWhatsappConversations(prev => prev.map(conv => {
        if (conv.number === updatedMsg.number) {
          return {
            ...conv,
            messages: conv.messages.map((m: any) => m.id === updatedMsg.id ? updatedMsg : m)
          };
        }
        return conv;
      }));
    });

    // Polling para sincronização "instantânea" (silenciosa)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData(false, true);
      }
    }, 10000); // Aumentado para 10 segundos e adicionado verificação de visibilidade

    const initApp = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await CapacitorUpdater.notifyAppReady();
          console.log('✅ App pronto para atualizações automáticas');
        } catch (error) {
          console.error('Erro no auto-update:', error);
        }
      }
    };
    initApp();

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, []);

  return (
    <DataContext.Provider value={{ 
      inventory, 
      sales, 
      motos,
      loading, 
      whatsappStatus,
      whatsappConversations,
      whatsappQr,
      setInventory, 
      setSales, 
      setMotos: (val) => {
        if (typeof val === 'function') {
          setMotos(prev => {
            const next = (val as any)(prev);
            lastMutationRef.current = Date.now();
            return next;
          });
        } else {
          setMotos(val);
          lastMutationRef.current = Date.now();
        }
      },
      refreshData: () => loadData(true),
      showSensitiveInfo,
      setShowSensitiveInfo
    }}>
      {children}
    </DataContext.Provider>
  );
}

// Mock Data for Dashboard
const salesData = [
  { name: 'Jan', sales: 4000, profit: 2400 },
  { name: 'Feb', sales: 3000, profit: 1398 },
  { name: 'Mar', sales: 2000, profit: 9800 },
  { name: 'Apr', sales: 2780, profit: 3908 },
  { name: 'May', sales: 1890, profit: 4800 },
  { name: 'Jun', sales: 2390, profit: 3800 },
];

const categoryData = [
  { name: 'Eletrônicos', value: 400 },
  { name: 'Roupas', value: 300 },
  { name: 'Casa', value: 300 },
  { name: 'Outros', value: 200 },
];

const COLORS = ['#8b5cf6', '#34d399', '#fb7185', '#f59e0b', '#3b82f6'];

// Components
const SidebarItem = memo(({ 
  icon: Icon, 
  label, 
  active, 
  onClick,
  theme,
  badge,
  className
}: { 
  icon: any, 
  label: string, 
  active: boolean, 
  onClick: () => void,
  theme: 'light' | 'dark',
  badge?: number,
  className?: string
}) => (
  <motion.button
    whileHover={{ x: 4 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-500 group relative overflow-hidden transform-gpu",
      active 
        ? "bg-violet-600 text-white shadow-[0_10px_30px_rgba(139,92,246,0.3)]" 
        : theme === 'dark' 
          ? "text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
      className
    )}
  >
    {active && (
      <motion.div 
        layoutId="activeTabGlow"
        className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
      />
    )}
    <Icon size={20} strokeWidth={active ? 3 : 2} className="relative z-10" />
    {label && <span className="font-black text-xs uppercase tracking-[0.2em] whitespace-nowrap relative z-10">{label}</span>}
    {badge !== undefined && (
      <span className="absolute right-4 top-1/2 -translate-y-1/2 bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-lg shadow-rose-500/40 relative z-10">
        {badge}
      </span>
    )}
  </motion.button>
));

const SkeletonRow = memo(({ theme }: { theme: 'light' | 'dark', key?: any }) => (
  <tr className="animate-pulse transform-gpu">
    <td className="px-6 py-4"><div className={cn("h-4 rounded w-16", theme === 'dark' ? "bg-zinc-800" : "bg-zinc-200")}></div></td>
    <td className="px-6 py-4"><div className={cn("h-4 rounded w-48", theme === 'dark' ? "bg-zinc-800" : "bg-zinc-200")}></div></td>
    <td className="px-6 py-4"><div className={cn("h-4 rounded w-32", theme === 'dark' ? "bg-zinc-800" : "bg-zinc-200")}></div></td>
    <td className="px-6 py-4"><div className={cn("h-4 rounded w-24", theme === 'dark' ? "bg-zinc-800" : "bg-zinc-200")}></div></td>
    <td className="px-6 py-4"><div className={cn("h-4 rounded w-20", theme === 'dark' ? "bg-zinc-800" : "bg-zinc-200")}></div></td>
  </tr>
));

const StatCard = memo(({ icon: Icon, label, value, trend, subValue, color, theme, onClick, isSensitive, isCurrency = true }: any) => {
  const context = useContext(DataContext);
  const showSensitiveInfo = context?.showSensitiveInfo ?? true;
  
  const formatValue = (val: any) => {
    if (!isCurrency) return val;
    if (typeof val === 'string' && val.includes('R$')) return val;
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^\d,-]/g, '').replace(',', '.'));
    if (isNaN(num)) return val;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  };

  const displayValue = formatValue(value);
  const displayTrend = (trend === null || trend === undefined || isNaN(Number(trend))) ? null : Number(trend);

  return (
    <motion.div 
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "group relative border p-5 sm:p-6 rounded-[2rem] transition-all duration-500 cursor-pointer overflow-hidden flex flex-col justify-between h-full",
        theme === 'dark' 
          ? "bg-zinc-900/40 border-zinc-800/50 shadow-2xl hover:border-violet-500/40 hover:bg-zinc-900/60" 
          : "bg-white border-zinc-200 shadow-xl hover:shadow-2xl hover:border-violet-200"
      )}
    >
      {/* Dynamic Glow Effect */}
      <div className={cn(
        "absolute -right-8 -top-8 w-32 h-32 rounded-full blur-[60px] opacity-0 transition-opacity duration-500 group-hover:opacity-20",
        color || "bg-violet-500"
      )} />

      <div className="flex items-center justify-between mb-4">
        <div className={cn(
          "p-3 rounded-2xl transition-all duration-500 shadow-lg",
          theme === 'dark' 
            ? "bg-zinc-800/80 text-zinc-400 group-hover:text-white group-hover:bg-violet-600/20 group-hover:scale-110" 
            : "bg-zinc-100 text-zinc-500 group-hover:text-zinc-900 group-hover:bg-violet-50"
        )}>
          <Icon size={20} strokeWidth={2.5} />
        </div>
        {displayTrend !== null && (
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-wider shadow-sm",
            displayTrend > 0 
              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
              : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
          )}>
            {displayTrend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(displayTrend)}%
          </div>
        )}
      </div>

      <div className="space-y-1">
        <span className={cn(
          "text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] opacity-50", 
          theme === 'dark' ? "text-zinc-400" : "text-zinc-500"
        )}>
          {label}
        </span>
        <div className="flex items-baseline gap-2">
          <h3 className={cn(
            "text-lg sm:text-2xl font-black tracking-tighter transition-all duration-500",
            theme === 'dark' ? "text-white" : "text-zinc-900",
            isSensitive && !showSensitiveInfo && "blur-xl select-none",
            (label.includes('Valor') || label.includes('Vendas')) && "text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.4)]",
            label.includes('Saídas') && "text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.4)]"
          )}>
            {displayValue}
          </h3>
        </div>
        {subValue && (
          <p className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate opacity-70 mt-1">
            {subValue}
          </p>
        )}
      </div>
    </motion.div>
  );
});

const ChartCard = memo(({ label, data, theme, color, icon: Icon, className }: any) => (
  <motion.div 
    whileHover={{ y: -4, scale: 1.02 }}
    className={cn(
      "border rounded-[2rem] p-6 transition-all duration-500 relative overflow-hidden flex flex-col gap-4 h-full group transform-gpu",
      theme === 'dark' 
        ? "bg-zinc-900/40 border-zinc-800/50 shadow-2xl hover:border-violet-500/40 hover:bg-zinc-900/60" 
        : "bg-white border-zinc-200 shadow-xl hover:shadow-2xl hover:border-violet-200",
      className
    )}
  >
    <div className={cn(
      "absolute -right-10 -top-10 w-32 h-32 rounded-full blur-[60px] opacity-0 transition-opacity duration-500 group-hover:opacity-20",
      color ? `bg-[${color}]` : "bg-violet-500"
    )} />

    <div className="flex items-center justify-between relative z-10">
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-3 rounded-2xl transition-all duration-500 shadow-lg",
          theme === 'dark' 
            ? "bg-zinc-800/80 text-zinc-400 group-hover:text-white group-hover:bg-violet-600/20" 
            : "bg-zinc-100 text-zinc-500 group-hover:text-zinc-900 group-hover:bg-violet-50"
        )}>
          <Icon size={20} strokeWidth={2.5} />
        </div>
        <span className={cn(
          "text-[10px] font-black uppercase tracking-[0.25em] opacity-50", 
          theme === 'dark' ? "text-zinc-400" : "text-zinc-500"
        )}>
          {label}
        </span>
      </div>
    </div>
    <div className="h-[80px] w-full mt-auto relative z-10">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`gradient-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color || "#8b5cf6"} stopOpacity={0.4}/>
              <stop offset="95%" stopColor={color || "#8b5cf6"} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <Area 
            type="monotone" 
            dataKey="vendas" 
            stroke={color || "#8b5cf6"} 
            strokeWidth={3} 
            fillOpacity={1} 
            fill={`url(#gradient-${label})`} 
            animationDuration={2000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </motion.div>
));


const QuestionsModal = memo(({ isOpen, onClose, theme }: { isOpen: boolean, onClose: () => void, theme: 'light' | 'dark' }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={cn(
          "relative w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col",
          theme === 'dark' ? "bg-zinc-950 border border-zinc-800" : "bg-white"
        )}
      >
        <div className={cn(
          "p-6 border-b flex items-center justify-between",
          theme === 'dark' ? "border-zinc-800" : "border-zinc-100"
        )}>
          <h2 className={cn("text-xl font-black tracking-tight", theme === 'dark' ? "text-white" : "text-zinc-900")}>
            Perguntas Mercado Livre
          </h2>
          <button onClick={onClose} className={cn("p-2 rounded-full", theme === 'dark' ? "hover:bg-zinc-800" : "hover:bg-zinc-100")}>
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <QuestionsDashboard theme={theme} />
        </div>
      </motion.div>
    </div>
  );
});

const DashboardView = ({ 
  theme, 
  onSelectItem, 
  mlData, 
  source, 
  onToggleSource, 
  onTabChange,
  allMlListings,
  showAllMlAds,
  setShowAllMlAds,
  onFetchAllMlListings,
  isMlListingsLoading,
  mlPeriod,
  setMlPeriod,
  mlCustomDate,
  setMlCustomDate,
  isMlDashboardLoading,
  mlSearchTerm,
  setMlSearchTerm,
  mlSortConfig,
  toggleMlSort,
  mlCurrentPage,
  setMlCurrentPage,
  mlTotalPages,
  paginatedMlListings,
  paymentFilter,
  setPaymentFilter,
  showPaymentFilter,
  setShowPaymentFilter,
  isSearchOpen,
  onRefreshMlDashboard
}: any) => {
  const { inventory, sales, loading, refreshData, showSensitiveInfo, setShowSensitiveInfo } = useContext(DataContext);
  const [selectedPaymentType, setSelectedPaymentType] = useState<string | null>(null);
  const [isQuestionsModalOpen, setIsQuestionsModalOpen] = useState(false);
  const [mlSalesSubTab, setMlSalesSubTab] = useState('pending');

  useEffect(() => {
    if (selectedPaymentType || isQuestionsModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedPaymentType, isQuestionsModalOpen]);

  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  const formatCurrency = (value: any) => {
    if (typeof value === 'string' && value.includes('R$')) return value;
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d,-]/g, '').replace(',', '.'));
    if (isNaN(num)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  };

  const metrics = useMemo(() => {
    if (source === 'mercadolivre' && mlData) {
      return {
        valorTotalEstoque: 0,
        totalItensEstoque: Number(mlData.totalListings) || 0,
        activeListings: Number(mlData.activeListings) || 0,
        valorVendasMes: Number(mlData.monthlySales) || 0,
        totalVendasMes: Number(mlData.totalSalesCount) || 0,
        pendingShipments: Number(mlData.pendingShipments) || 0,
        ticketMedio: Number(mlData.avgTicket) || 0,
        perguntasPendentes: Number(mlData.pendingQuestions) || 0,
        totalPerguntas: Number(mlData.totalQuestions) || 0,
        ultimosItens: mlData.recentListings || [],
        ultimasVendas: mlData.recentSales || []
      };
    }

    const parseDate = (dateStr: any) => {
      if (!dateStr) return new Date(0);
      let d = new Date(dateStr);
      if (isNaN(d.getTime()) && typeof dateStr === 'string') {
        if (dateStr.includes('/')) {
          const [day, month, year] = dateStr.split('/').map(Number);
          d = new Date(year, month - 1, day);
        } else if (dateStr.includes('-')) {
          const datePart = dateStr.split('T')[0];
          const [y, m, day] = datePart.split('-').map(Number);
          d = new Date(y, m - 1, day);
        }
      }
      return d;
    };

    const parseValue = (val: any) => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val;
      
      let str = String(val).trim();
      
      // Remove R$ and spaces
      str = str.replace(/R\$\s?/g, '');
      
      // Check if it has both dots and commas (e.g. 1.200,50)
      if (str.includes('.') && str.includes(',')) {
        // Remove dots (thousands separators) and replace comma with dot
        str = str.replace(/\./g, '').replace(',', '.');
      } else if (str.includes(',')) {
        // Only has comma, assume it's decimal separator
        str = str.replace(',', '.');
      }
      
      // Remove any other non-digit/dot/minus characters
      const cleaned = str.replace(/[^\d.-]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    };

    // Estoque
    const valorTotalEstoque = inventory.reduce((sum, item) => sum + parseValue(item.valor), 0);
    const totalItensEstoque = inventory.length;
    const estoqueBaixo = inventory.filter(item => (Number(item.estoque) || 0) <= 2);
    const ultimosItens = [...inventory].sort((a, b) => {
      const dateA = a.criado_em ? new Date(a.criado_em).getTime() : 0;
      const dateB = b.criado_em ? new Date(b.criado_em).getTime() : 0;
      return dateB - dateA;
    }).slice(0, 5);

    // Vendas
    const vendasMes = sales.filter(item => {
      const itemDate = parseDate(item.data);
      const isCurrentMonth = itemDate.getMonth() === mesAtual && 
                             itemDate.getFullYear() === anoAtual;
      const isNotSaida = item.tipo !== 'SAÍDA';
      return isCurrentMonth && isNotSaida;
    });

    const saidasMes = sales.filter(item => {
      const itemDate = parseDate(item.data);
      const isCurrentMonth = itemDate.getMonth() === mesAtual && 
                             itemDate.getFullYear() === anoAtual;
      const isSaida = item.tipo === 'SAÍDA';
      return isCurrentMonth && isSaida;
    });

    const valorVendasMes = vendasMes.reduce((sum, v) => sum + parseValue(v.valor), 0);
    const valorSaidasMes = saidasMes.reduce((sum, v) => sum + parseValue(v.valor), 0);
    const ticketMedio = vendasMes.length > 0 ? valorVendasMes / vendasMes.length : 0;

    console.log('📊 Dashboard Metrics Debug:', {
      inventoryCount: inventory.length,
      salesCount: sales.length,
      vendasMesCount: vendasMes.length,
      valorVendasMes,
      valorTotalEstoque,
      mesAtual,
      anoAtual
    });

    return {
      valorTotalEstoque,
      totalItensEstoque,
      estoqueBaixo,
      ultimosItens,
      valorVendasMes,
      totalVendasMes: vendasMes.length,
      valorSaidasMes,
      totalSaidasMes: saidasMes.length,
      ticketMedio,
      ultimasVendas: [...sales].sort((a, b) => parseDate(b.data).getTime() - parseDate(a.data).getTime())
    };
  }, [inventory, sales, mlData, source, mesAtual, anoAtual]);

  const filteredLastSales = useMemo(() => {
    if (paymentFilter === 'TODOS') return metrics.ultimasVendas;
    return metrics.ultimasVendas.filter((sale: any) => sale.tipo === paymentFilter);
  }, [metrics.ultimasVendas, paymentFilter]);

  const filteredSales = useMemo(() => {
    if (source === 'estoque') return metrics.ultimasVendas;
    return metrics.ultimasVendas.filter((sale: any) => {
      const isCancelled = sale.is_cancelled || sale.status === 'cancelled' || sale.shipping_status?.startsWith('cancelled') || sale.shipping_substatus === 'cancelled' || sale.shipping_substatus === 'not_delivered';
      
      if (mlSalesSubTab === 'pending') {
        // Vendas pendentes: prontas para imprimir etiqueta, etiqueta já impressa ou aguardando NF
        return !sale.has_dispute && !isCancelled && (sale.shipping_status?.startsWith('ready_to_ship') || sale.shipping_status === 'pending' || sale.shipping_status?.includes('ready_to_print') || sale.shipping_status?.includes('printed') || sale.shipping_status?.includes('invoice_pending'));
      }
      if (mlSalesSubTab === 'dispute') return sale.has_dispute;
      if (mlSalesSubTab === 'shipped') return sale.shipping_status === 'shipped' && !isCancelled;
      if (mlSalesSubTab === 'delivered') return sale.shipping_status === 'delivered' && !isCancelled;
      if (mlSalesSubTab === 'cancelled') return isCancelled;
      if (mlSalesSubTab === 'all') return true;
      return false;
    });
  }, [metrics.ultimasVendas, mlSalesSubTab, source]);

  // Gráfico Vendas por Dia (últimos 30 dias)
  const chartData = useMemo(() => {
    if (source === 'mercadolivre' && mlData?.chartData) {
      return mlData.chartData;
    }

    const days = [];
    const hoje = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(hoje);
      d.setDate(hoje.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({
        date: dateStr,
        label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        vendas: 0,
        saidas: 0
      });
    }

    const parseDate = (dateStr: any) => {
      if (!dateStr) return new Date(0);
      let d = new Date(dateStr);
      if (isNaN(d.getTime()) && typeof dateStr === 'string' && dateStr.length >= 10) {
        const datePart = dateStr.split('T')[0];
        if (datePart.includes('-')) {
          const [y, m, day] = datePart.split('-').map(Number);
          d = new Date(y, m - 1, day);
        }
      }
      return d;
    };

    sales.forEach(sale => {
      const saleDateObj = parseDate(sale.data);
      const saleDate = `${saleDateObj.getFullYear()}-${String(saleDateObj.getMonth() + 1).padStart(2, '0')}-${String(saleDateObj.getDate()).padStart(2, '0')}`;
      const day = days.find(d => d.date === saleDate);
      if (day) {
        if (sale.tipo === 'SAÍDA') {
          day.saidas += Number(sale.valor) || 0;
        } else {
          day.vendas += Number(sale.valor) || 0;
        }
      }
    });

    return days;
  }, [sales, mlData, source]);

  // Gráfico Vendas por Tipo (Valor)
  const pieData = useMemo(() => {
    const types: Record<string, number> = {};
    sales.filter(s => s.tipo !== 'SAÍDA').forEach(sale => {
      types[sale.tipo] = (types[sale.tipo] || 0) + sale.valor;
    });
    return Object.entries(types).map(([name, value]) => ({ name, value }));
  }, [sales]);

  const latestSales = useMemo(() => {
    return [...sales].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, 5);
  }, [sales]);

  const filteredSalesByType = useMemo(() => {
    if (!selectedPaymentType) return [];
    return sales.filter(s => s.tipo === selectedPaymentType)
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [sales, selectedPaymentType]);

  if (loading && inventory.length === 0 && sales.length === 0) {
    // Retornar null ou não bloquear a tela para que inicie direto
    // Apenas mostrar um indicador sutil se necessário
  }

  return (
    <>
      <div className={cn("space-y-6", isSearchOpen && "blur-md pointer-events-none")}>
      <div className="space-y-4 mb-6">
        {/* Linha 1: Título e Ações Principais */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <h2 className={cn("text-2xl sm:text-3xl font-black tracking-tight", theme === 'dark' ? "text-white" : "text-zinc-900")}>
              Dashboard <span className="text-violet-500">RK</span>
            </h2>

            <div className="flex sm:hidden items-center gap-2">
              {/* Toggle de Informações Sensíveis (Mobile) */}
              <button
                onClick={() => setShowSensitiveInfo(!showSensitiveInfo)}
                className={cn(
                  "p-2 rounded-full transition-all border",
                  theme === 'dark' 
                    ? "bg-zinc-900 border-zinc-800 text-zinc-400" 
                    : "bg-white border-zinc-200 text-zinc-600"
                )}
              >
                {showSensitiveInfo ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>

              {/* Botão de Sincronizar (Mobile) */}
              <button 
                onClick={() => {
                  refreshData();
                  if (source === 'mercadolivre' && onRefreshMlDashboard) {
                    onRefreshMlDashboard();
                  }
                }}
                disabled={loading || isMlDashboardLoading}
                className={cn(
                  "p-2 rounded-full transition-all border",
                  theme === 'dark' 
                    ? "bg-zinc-900 border-zinc-800 text-zinc-400" 
                    : "bg-white border-zinc-200 text-zinc-600"
                )}
              >
                <RefreshCw size={16} className={cn((loading || isMlDashboardLoading) && "animate-spin")} />
              </button>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            <div className="flex items-center gap-2">
              {/* Toggle de Informações Sensíveis */}
              <button
                onClick={() => setShowSensitiveInfo(!showSensitiveInfo)}
                className={cn(
                  "p-1.5 sm:p-2 rounded-full transition-all border",
                  theme === 'dark' 
                    ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800" 
                    : "bg-white border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                )}
                title={showSensitiveInfo ? "Ocultar Sensíveis" : "Mostrar Sensíveis"}
              >
                {showSensitiveInfo ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>

              {/* Botão de Sincronizar */}
              <button 
                onClick={() => {
                  refreshData();
                  if (source === 'mercadolivre' && onRefreshMlDashboard) {
                    onRefreshMlDashboard();
                  }
                }}
                disabled={loading || isMlDashboardLoading}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full transition-all border font-bold text-xs",
                  theme === 'dark' 
                    ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800" 
                    : "bg-white border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50",
                  (loading || isMlDashboardLoading) && "opacity-50 cursor-not-allowed"
                )}
                title="Sincronizar Dados"
              >
                <RefreshCw size={16} className={cn((loading || isMlDashboardLoading) && "animate-spin")} />
                <span className="hidden sm:inline">Sincronizar</span>
              </button>

              {/* Filtro de Período (apenas para Mercado Livre) */}
              {source === 'mercadolivre' && (
                <div className="relative">
                  <button
                    onClick={() => {
                      const dropdown = document.getElementById('ml-period-dropdown');
                      if (dropdown) {
                        dropdown.classList.toggle('hidden');
                      }
                    }}
                    className={cn(
                      "p-1.5 sm:p-2 rounded-full transition-all border flex items-center justify-center relative",
                      theme === 'dark' 
                        ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800" 
                        : "bg-white border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                    )}
                    title="Filtro de Período"
                  >
                    <Calendar size={18} />
                    {mlPeriod !== '30d' && (
                      <span className="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-full"></span>
                    )}
                  </button>
                  
                  <div 
                    id="ml-period-dropdown" 
                    className={cn(
                      "hidden absolute right-0 top-full mt-2 w-64 p-3 rounded-2xl border shadow-xl z-50",
                      theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                    )}
                  >
                    <h4 className={cn("text-xs font-bold uppercase tracking-wider mb-2 px-1", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")}>Período</h4>
                    <div className="space-y-1 mb-3">
                      {[
                        { value: '7d', label: 'Últimos 7 dias' },
                        { value: '15d', label: 'Últimos 15 dias' },
                        { value: '30d', label: 'Últimos 30 dias' },
                        { value: '60d', label: 'Últimos 60 dias' },
                        { value: 'custom', label: 'Data Específica' },
                      ].map(option => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setMlPeriod(option.value);
                            if (option.value !== 'custom') {
                              document.getElementById('ml-period-dropdown')?.classList.add('hidden');
                            }
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all",
                            mlPeriod === option.value
                              ? (theme === 'dark' ? "bg-amber-500/10 text-amber-500" : "bg-amber-50 text-amber-600")
                              : (theme === 'dark' ? "text-zinc-300 hover:bg-zinc-800" : "text-zinc-700 hover:bg-zinc-100")
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    {mlPeriod === 'custom' && (
                      <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        <div>
                          <label className={cn("block text-[10px] font-bold uppercase mb-1", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")}>Início</label>
                          <input
                            type="date"
                            value={mlCustomDate.start}
                            onChange={(e) => setMlCustomDate({ ...mlCustomDate, start: e.target.value })}
                            className={cn(
                              "w-full px-3 py-2 rounded-xl text-xs font-medium border outline-none transition-all",
                              theme === 'dark' 
                                ? "bg-zinc-950 border-zinc-800 text-zinc-300 focus:border-amber-500/50" 
                                : "bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-amber-500/50"
                            )}
                          />
                        </div>
                        <div>
                          <label className={cn("block text-[10px] font-bold uppercase mb-1", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")}>Fim</label>
                          <input
                            type="date"
                            value={mlCustomDate.end}
                            onChange={(e) => setMlCustomDate({ ...mlCustomDate, end: e.target.value })}
                            className={cn(
                              "w-full px-3 py-2 rounded-xl text-xs font-medium border outline-none transition-all",
                              theme === 'dark' 
                                ? "bg-zinc-950 border-zinc-800 text-zinc-300 focus:border-amber-500/50" 
                                : "bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-amber-500/50"
                            )}
                          />
                        </div>
                        <button
                          onClick={() => document.getElementById('ml-period-dropdown')?.classList.add('hidden')}
                          className="w-full mt-2 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 transition-colors"
                        >
                          Aplicar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Grid de Métricas Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 px-4 sm:px-0">
        {source === 'estoque' ? (
          <>
            <StatCard 
              icon={Package} 
              label="Valor do Estoque" 
              value={metrics.valorTotalEstoque} 
              subValue={`${metrics.totalItensEstoque} itens em estoque`}
              color="bg-indigo-500" 
              theme={theme}
              isSensitive={true}
            />
            <StatCard 
              icon={TrendingUp} 
              label="Vendas (Mês)" 
              value={metrics.valorVendasMes} 
              subValue={`${metrics.totalVendasMes} vendas no mês`}
              color="bg-teal-500" 
              theme={theme}
              isSensitive={true}
            />
            
            {/* Gráfico Estiloso que ocupa o espaço de 2 cards */}
            <div className={cn(
              "col-span-2 border rounded-2xl p-5 transition-all duration-300 relative overflow-hidden flex flex-col h-full",
              theme === 'dark' 
                ? "bg-zinc-900/40 border-zinc-800/50 shadow-lg" 
                : "bg-white border-zinc-200 shadow-sm"
            )}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "p-2 rounded-xl",
                    theme === 'dark' ? "bg-zinc-800/50 text-zinc-400" : "bg-zinc-100 text-zinc-500"
                  )}>
                    <BarChart3 size={16} strokeWidth={2.5} />
                  </div>
                  <span className={cn("text-[9px] font-black uppercase tracking-[0.2em] opacity-60", theme === 'dark' ? "text-zinc-400" : "text-zinc-500")}>
                    Desempenho Semanal
                  </span>
                </div>
              </div>
              <div className="flex-1 min-h-[120px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.slice(-7)}>
                    <defs>
                      <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className={cn(
                              "p-2 rounded-lg border shadow-xl text-[10px] font-bold",
                              theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-100 text-zinc-900"
                            )}>
                              <p className="opacity-60 mb-1">{payload[0].payload.label}</p>
                              <p className={cn("text-emerald-400", !showSensitiveInfo && "blur-sm select-none")}>
                                {showSensitiveInfo ? formatCurrency(payload[0].value) : "R$ ***"}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="vendas" 
                      stroke="#10b981" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#colorVendas)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <StatCard 
              icon={DollarSign} 
              label="Saídas (Mês)" 
              value={metrics.valorSaidasMes} 
              subValue="despesas operacionais"
              color="bg-rose-400" 
              theme={theme} 
              isSensitive={true}
            />
            <StatCard 
              icon={ShoppingCart} 
              label="Ticket Médio" 
              value={metrics.ticketMedio} 
              subValue="por venda realizada"
              color="bg-amber-400" 
              theme={theme} 
              isSensitive={true}
            />
          </>
        ) : (
          <>
    <StatCard 
      icon={Box} 
      label="Anúncios Ativos" 
      value={metrics.activeListings} 
      subValue={`De ${metrics.totalItensEstoque} anúncios totais`}
      color="bg-indigo-500" 
      theme={theme} 
      onClick={onFetchAllMlListings}
      isCurrency={false}
    />
    <StatCard 
      icon={BarChart3} 
      label="Vendas ML (Mês)" 
      value={metrics.valorVendasMes} 
      subValue={`${metrics.totalVendasMes} pedidos no período`}
      color="bg-teal-500" 
      theme={theme} 
      isSensitive={true}
    />
    <StatCard 
      icon={MessageCircle} 
      label="Perguntas" 
      value={`${metrics.perguntasPendentes} / ${metrics.totalPerguntas || '...'}`}
      subValue="pendentes / total"
      color="bg-rose-400" 
      theme={theme} 
      trend={metrics.perguntasPendentes > 0 ? -10 : 0}
      onClick={() => setIsQuestionsModalOpen(true)}
      isCurrency={false}
    />
    <QuestionsModal isOpen={isQuestionsModalOpen} onClose={() => setIsQuestionsModalOpen(false)} theme={theme} />
    <StatCard 
      icon={Truck} 
      label="Prontas para Envio" 
      value={metrics.pendingShipments} 
      subValue="pedidos aguardando despacho"
      color="bg-amber-400" 
      theme={theme} 
      trend={metrics.pendingShipments > 0 ? 10 : 0}
      isCurrency={false}
      onClick={() => {
        // Scroll to sales section and set tab to pending
        const salesSection = document.getElementById('vendas-section');
        if (salesSection) {
          salesSection.scrollIntoView({ behavior: 'smooth' });
          setMlSalesSubTab('pending');
        }
      }}
    />
          </>
        )}
      </div>

          <div className="h-[300px] hidden sm:block">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={source === 'estoque' ? "#8b5cf6" : "#10b981"} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={source === 'estoque' ? "#8b5cf6" : "#10b981"} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? "#27272a" : "#e5e7eb"} vertical={false} />
                <XAxis 
                  dataKey="label" 
                  stroke="#71717a" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fontWeight: 600 }}
                />
                <YAxis 
                  stroke="#71717a" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => formatCurrency(value)}
                  tick={{ fontWeight: 600 }}
                />
                <Tooltip 
                  formatter={(value: number) => [showSensitiveInfo ? formatCurrency(value) : "R$ ***", ""]}
                  contentStyle={{ 
                    backgroundColor: theme === 'dark' ? '#18181b' : '#fff', 
                    border: `1px solid ${theme === 'dark' ? '#27272a' : '#e5e7eb'}`, 
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="vendas" name="Vendas" stroke={source === 'estoque' ? "#8b5cf6" : "#10b981"} strokeWidth={3} fillOpacity={1} fill="url(#colorVendas)" />
                {source === 'estoque' && (
                  <Area type="monotone" dataKey="saidas" name="Saídas" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorSaidas)" />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Mobile Simplified View */}
          <div className={cn(
            "sm:hidden border p-4 rounded-2xl transition-all duration-300 mb-12",
            theme === 'dark' 
              ? "bg-zinc-900/40 border-zinc-800/50 shadow-lg" 
              : "bg-white border-zinc-200 shadow-sm"
          )}>
            <div className="flex items-center gap-2 mb-4 opacity-60">
              <Activity size={14} className="text-violet-500" />
              <span className={cn("text-[9px] font-black uppercase tracking-widest", theme === 'dark' ? "text-zinc-400" : "text-zinc-500")}>
                Fluxo Recente
              </span>
            </div>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.slice(-15)}>
                  <defs>
                    <linearGradient id="colorVendasMobile" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={source === 'estoque' ? "#8b5cf6" : "#10b981"} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={source === 'estoque' ? "#8b5cf6" : "#10b981"} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area 
                    type="monotone" 
                    dataKey="vendas" 
                    stroke={source === 'estoque' ? "#8b5cf6" : "#10b981"} 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorVendasMobile)" 
                    animationDuration={1000}
                  />
                  <Tooltip 
                    formatter={(value: number) => [showSensitiveInfo ? formatCurrency(value) : "R$ ***", ""]}
                    contentStyle={{ 
                      backgroundColor: theme === 'dark' ? '#18181b' : '#fff', 
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '10px'
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[8px] text-center text-zinc-500 font-black uppercase tracking-[0.3em] mt-4">
              Últimos 15 dias
            </p>
          </div>

        {/* Gráfico Secundário / Ações Rápidas */}
        <div className="space-y-6">
          <div className={cn(
            "border p-6 rounded-2xl transition-all duration-300",
            theme === 'dark' 
              ? "bg-zinc-900/40 border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-violet-500/30" 
              : "bg-white border-zinc-200 shadow-sm"
          )}>
            <h3 className={cn("text-lg font-bold tracking-tight mb-6", theme === 'dark' ? "text-white" : "text-zinc-900")}>
              {source === 'estoque' ? "Vendas por Tipo" : "Status de Anúncios"}
            </h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={source === 'estoque' ? pieData : [
                      { name: 'Ativos', value: metrics.activeListings },
                      { name: 'Inativos', value: metrics.totalItensEstoque - metrics.activeListings }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {(source === 'estoque' ? pieData : [
                      { name: 'Ativos', value: metrics.activeListings },
                      { name: 'Inativos', value: metrics.totalItensEstoque - metrics.activeListings }
                    ]).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={source === 'estoque' ? COLORS[index % COLORS.length] : (index === 0 ? '#10b981' : '#f43f5e')} />
                    ))}
                  </Pie>
                <Tooltip 
                    formatter={(value: number) => source === 'estoque' ? (showSensitiveInfo ? formatCurrency(value) : "R$ ***") : value}
                    contentStyle={{ 
                      backgroundColor: theme === 'dark' ? '#18181b' : '#fff', 
                      border: `1px solid ${theme === 'dark' ? '#27272a' : '#e5e7eb'}`, 
                      borderRadius: '12px' 
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {(source === 'estoque' ? pieData : [
                { name: 'Ativos', value: metrics.activeListings, color: '#10b981' },
                { name: 'Inativos', value: metrics.totalItensEstoque - metrics.activeListings, color: '#f43f5e' }
              ]).map((item: any, index: number) => (
                <div 
                  key={index} 
                  className={cn(
                    "group relative px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-2 transition-all w-fit",
                    theme === 'dark' 
                      ? "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-100" 
                      : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900"
                  )}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: source === 'estoque' ? COLORS[index % COLORS.length] : item.color }} />
                  {item.name}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                    {source === 'estoque' ? (showSensitiveInfo ? formatCurrency(item.value) : "R$ ***") : item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ações Rápidas ML */}
          {source === 'mercadolivre' && (
            <div className={cn(
              "border p-6 rounded-2xl transition-all duration-300",
              theme === 'dark' 
                ? "bg-zinc-900/40 border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)]" 
                : "bg-white border-zinc-200 shadow-sm"
            )}>
              <h3 className={cn("text-sm font-bold tracking-tight mb-4 uppercase text-zinc-500", theme === 'dark' ? "text-zinc-400" : "text-zinc-500")}>
                Ações Rápidas ML
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => onTabChange('mercadolivre')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 transition-all group"
                >
                  <MessageSquare className="text-violet-500 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Responder</span>
                </button>
                <button 
                  onClick={() => onTabChange('mercadolivre')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all group"
                >
                  <Package className="text-amber-500 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Anúncios</span>
                </button>
              </div>
            </div>
          )}
        </div>
        {/* Últimas Vendas / Pedidos ML */}
        <div id="vendas-section" className={cn(
          "lg:col-span-3 border rounded-2xl overflow-hidden transition-all duration-300 mt-6",
          theme === 'dark' 
            ? "bg-zinc-900/40 border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)]" 
            : "bg-white border-zinc-200 shadow-sm"
        )}>
          <div className={cn(
            "p-4 border-b flex items-center justify-between relative",
            theme === 'dark' ? "border-zinc-800/50" : "border-zinc-100"
          )}>
            <h3 className={cn("font-bold tracking-tight", theme === 'dark' ? "text-white" : "text-zinc-900")}>
              {source === 'estoque' ? "Últimas Vendas" : "Vendas (Mercado Livre)"}
            </h3>
            
            <div className="flex items-center gap-2">
              {source === 'estoque' && (
                <div className="relative">
                  <button 
                    onClick={() => setShowPaymentFilter(!showPaymentFilter)}
                    className={cn(
                      "p-3 rounded-xl transition-all active:scale-95 border flex items-center justify-center min-w-[44px] min-h-[44px]",
                      theme === 'dark' 
                        ? "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:text-white" 
                        : "bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900",
                      paymentFilter !== 'TODOS' && "border-violet-500/50 text-violet-500 bg-violet-500/10"
                    )}
                  >
                    <Filter size={20} />
                  </button>
                  
                  <AnimatePresence>
                    {showPaymentFilter && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className={cn(
                          "absolute right-0 mt-2 w-48 rounded-2xl border shadow-2xl z-50 p-2",
                          theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                        )}
                      >
                        {['TODOS', 'CRÉDITO', 'DÉBITO', 'DINHEIRO', 'MARCELO', 'PENDÊNCIA', 'PIX'].map((type) => (
                          <button
                            key={type}
                            onClick={() => {
                              setPaymentFilter(type);
                              setShowPaymentFilter(false);
                            }}
                            className={cn(
                              "w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-colors",
                              paymentFilter === type
                                ? "bg-violet-500 text-white"
                                : theme === 'dark'
                                  ? "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                            )}
                          >
                            {type}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              <History size={16} className="text-zinc-500" />
            </div>
          </div>
          
          {source === 'estoque' ?
            <div className="overflow-x-auto">
              {/* Desktop Table */}
              <table className="hidden md:table w-full text-left text-sm">
                <thead>
                  <tr className={cn(
                    "text-[10px] uppercase font-bold tracking-wider",
                    theme === 'dark' ? "bg-zinc-800/30 text-zinc-500" : "bg-zinc-50 text-zinc-500"
                  )}>
                    <th className="px-4 py-3">Peça</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Data</th>
                  </tr>
                </thead>
                <tbody className={cn("divide-y", theme === 'dark' ? "divide-zinc-800/30" : "divide-zinc-100")}>
                  {filteredLastSales.slice(0, 5).map((sale: any) => (
                    <tr 
                      key={sale.id} 
                      onClick={() => onSelectItem(sale)}
                      className="transition-colors group cursor-pointer hover:bg-zinc-800/20"
                    >
                      <td className={cn("px-4 py-3 font-bold", theme === 'dark' ? "text-zinc-200" : "text-zinc-900")}>
                        <div className="flex flex-col min-w-0">
                          <span className="truncate max-w-[200px]" title={sale.nome}>
                            {sale.nome ? sale.nome.charAt(0).toUpperCase() + sale.nome.slice(1) : ''}
                          </span>
                          {sale.moto && (
                            <span className="text-[9px] font-bold uppercase text-violet-400 tracking-wider">
                              {sale.moto.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-emerald-400 font-black font-mono drop-shadow-[0_0_8px_rgba(52,211,153,0.2)]">
                        {formatCurrency(sale.valor)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                          sale.tipo?.toUpperCase() === 'PIX' ? (theme === 'dark' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-600 border-emerald-200") :
                          sale.tipo?.toUpperCase() === 'DINHEIRO' ? (theme === 'dark' ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-green-50 text-green-600 border-green-200") :
                          sale.tipo?.toUpperCase() === 'CRÉDITO' ? (theme === 'dark' ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : "bg-orange-50 text-orange-600 border-orange-200") :
                          sale.tipo?.toUpperCase() === 'DÉBITO' ? (theme === 'dark' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-blue-50 text-blue-600 border-blue-200") :
                          sale.tipo?.toUpperCase() === 'MARCELO' ? (theme === 'dark' ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-violet-50 text-violet-600 border-violet-200") :
                          sale.tipo?.toUpperCase().includes('MERCADO LIVRE') ? (theme === 'dark' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-amber-50 text-amber-600 border-amber-200") :
                          (theme === 'dark' ? "bg-zinc-800 text-zinc-400 border-zinc-700/50" : "bg-zinc-100 text-zinc-600")
                        )}>
                          {sale.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                          theme === 'dark' ? "bg-zinc-800/50 text-zinc-500 border-zinc-700/50" : "bg-zinc-50 text-zinc-500 border-zinc-200"
                        )}>
                          {new Date(sale.data).toLocaleDateString('pt-BR')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile Cards */}
              <div className="md:hidden flex flex-col max-h-[500px] overflow-y-auto scrollbar-hide divide-y divide-zinc-800/10 px-8">
                {filteredLastSales.slice(0, 10).map((sale: any) => {
                  const isSaida = sale.tipo === 'SAÍDA';
                  return (
                    <div 
                      key={sale.id}
                      onClick={() => onSelectItem(sale)}
                      className="py-3 flex flex-col gap-1.5 active:bg-zinc-800/20 transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-col min-w-0">
                          <span className={cn(
                            "font-bold text-[13px] leading-tight truncate", 
                            theme === 'dark' ? "text-zinc-300" : "text-zinc-700"
                          )}>
                            {sale.nome ? sale.nome.charAt(0).toUpperCase() + sale.nome.slice(1) : ''}
                          </span>
                          <span className={cn(
                            "font-black text-base tracking-tight transition-all duration-300",
                            isSaida 
                              ? "text-rose-500 [text-shadow:0_0_10px_rgba(244,63,94,0.5)]" 
                              : "text-emerald-500 [text-shadow:0_0_10px_rgba(16,185,129,0.5)]"
                          )}>
                            {isSaida ? '-' : ''}{formatCurrency(Math.abs(sale.valor))}
                          </span>
                        </div>
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border",
                          theme === 'dark' ? "bg-zinc-800/50 text-zinc-500 border-zinc-700/50" : "bg-zinc-50 text-zinc-500 border-zinc-200"
                        )}>
                          {new Date(sale.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border shadow-sm",
                          isSaida 
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : (
                              sale.tipo?.toUpperCase() === 'PIX' ? (theme === 'dark' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-600 border-emerald-200") :
                              sale.tipo?.toUpperCase() === 'DINHEIRO' ? (theme === 'dark' ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-green-50 text-green-600 border-green-200") :
                              sale.tipo?.toUpperCase() === 'CRÉDITO' ? (theme === 'dark' ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : "bg-orange-50 text-orange-600 border-orange-200") :
                              sale.tipo?.toUpperCase() === 'DÉBITO' ? (theme === 'dark' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-blue-50 text-blue-600 border-blue-200") :
                              sale.tipo?.toUpperCase() === 'MARCELO' ? (theme === 'dark' ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-violet-50 text-violet-600 border-violet-200") :
                              sale.tipo?.toUpperCase().includes('MERCADO LIVRE') ? (theme === 'dark' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-amber-50 text-amber-600 border-amber-200") :
                              (theme === 'dark' ? "bg-zinc-800 text-zinc-500 border border-zinc-700" : "bg-zinc-100 text-zinc-400 border border-zinc-200")
                            )
                        )}>
                          {sale.tipo}
                        </span>
                        {sale.moto && (
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border",
                            theme === 'dark' ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-violet-50 text-violet-600 border-violet-200"
                          )}>
                            {sale.moto.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          :
            <div className="flex flex-col gap-4 p-4">
              {/* Resumo de Envios */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
                <button 
                  onClick={() => setMlSalesSubTab('pending')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors",
                    mlSalesSubTab === 'pending' 
                      ? (theme === 'dark' ? "bg-zinc-800 text-white" : "bg-zinc-100 text-zinc-900")
                      : (theme === 'dark' ? "text-zinc-400 hover:bg-zinc-800/50" : "text-zinc-500 hover:bg-zinc-50")
                  )}
                >
                  Envios pendentes
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full transition-colors",
                    mlSalesSubTab === 'pending' ? "bg-blue-500 text-white" : (theme === 'dark' ? "bg-zinc-800 text-zinc-500" : "bg-zinc-200 text-zinc-400")
                  )}>
                    {metrics.ultimasVendas.filter((s: any) => {
                      const isCancelled = s.is_cancelled || s.status === 'cancelled' || s.shipping_status?.startsWith('cancelled') || s.shipping_substatus === 'cancelled' || s.shipping_substatus === 'not_delivered';
                      const isReadyToShip = s.shipping_status?.startsWith('ready_to_ship') || s.shipping_status === 'pending' || s.shipping_status?.includes('ready_to_print') || s.shipping_status?.includes('printed') || s.shipping_status?.includes('invoice_pending');
                      return !s.has_dispute && isReadyToShip && !isCancelled;
                    }).length}
                  </span>
                </button>

                {metrics.ultimasVendas.some((s: any) => s.has_dispute) && (
                  <button 
                    onClick={() => setMlSalesSubTab('dispute')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors",
                      mlSalesSubTab === 'dispute' 
                        ? (theme === 'dark' ? "bg-zinc-800 text-white" : "bg-zinc-100 text-zinc-900")
                        : (theme === 'dark' ? "text-zinc-400 hover:bg-zinc-800/50" : "text-zinc-500 hover:bg-zinc-50")
                    )}
                  >
                    Mediações
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full transition-colors",
                      mlSalesSubTab === 'dispute' ? "bg-red-500 text-white" : (theme === 'dark' ? "bg-zinc-800 text-zinc-500" : "bg-zinc-200 text-zinc-400")
                    )}>
                      {metrics.ultimasVendas.filter((s: any) => s.has_dispute).length}
                    </span>
                  </button>
                )}

                <button 
                  onClick={() => setMlSalesSubTab('shipped')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors",
                    mlSalesSubTab === 'shipped' 
                      ? (theme === 'dark' ? "bg-zinc-800 text-white" : "bg-zinc-100 text-zinc-900")
                      : (theme === 'dark' ? "text-zinc-400 hover:bg-zinc-800/50" : "text-zinc-500 hover:bg-zinc-50")
                  )}
                >
                  Em trânsito
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full transition-colors",
                    mlSalesSubTab === 'shipped' ? "bg-violet-500 text-white" : (theme === 'dark' ? "bg-zinc-800 text-zinc-500" : "bg-zinc-200 text-zinc-400")
                  )}>
                    {metrics.ultimasVendas.filter((s: any) => s.shipping_status === 'shipped' && s.shipping_status !== 'cancelled' && s.shipping_substatus !== 'cancelled' && s.shipping_substatus !== 'not_delivered').length}
                  </span>
                </button>
                <button 
                  onClick={() => setMlSalesSubTab('delivered')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors",
                    mlSalesSubTab === 'delivered' 
                      ? (theme === 'dark' ? "bg-zinc-800 text-white" : "bg-zinc-100 text-zinc-900")
                      : (theme === 'dark' ? "text-zinc-400 hover:bg-zinc-800/50" : "text-zinc-500 hover:bg-zinc-50")
                  )}
                >
                  Finalizadas
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full transition-colors",
                    mlSalesSubTab === 'delivered' ? "bg-emerald-500 text-white" : (theme === 'dark' ? "bg-zinc-800 text-zinc-500" : "bg-zinc-200 text-zinc-400")
                  )}>
                    {metrics.ultimasVendas.filter((s: any) => s.shipping_status === 'delivered' && s.shipping_substatus !== 'cancelled' && s.shipping_substatus !== 'not_delivered').length}
                  </span>
                </button>
                <button 
                  onClick={() => setMlSalesSubTab('cancelled')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors",
                    mlSalesSubTab === 'cancelled' 
                      ? (theme === 'dark' ? "bg-zinc-800 text-white" : "bg-zinc-100 text-zinc-900")
                      : (theme === 'dark' ? "text-zinc-400 hover:bg-zinc-800/50" : "text-zinc-500 hover:bg-zinc-50")
                  )}
                >
                  Canceladas
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full transition-colors",
                    mlSalesSubTab === 'cancelled' ? "bg-red-500 text-white" : (theme === 'dark' ? "bg-zinc-800 text-zinc-500" : "bg-zinc-200 text-zinc-400")
                  )}>
                    {metrics.ultimasVendas.filter((s: any) => s.shipping_status === 'cancelled' || s.shipping_substatus === 'cancelled' || s.shipping_substatus === 'not_delivered').length}
                  </span>
                </button>
                <button 
                  onClick={() => setMlSalesSubTab('all')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors",
                    mlSalesSubTab === 'all' 
                      ? (theme === 'dark' ? "bg-zinc-800 text-white" : "bg-zinc-100 text-zinc-900")
                      : (theme === 'dark' ? "text-zinc-400 hover:bg-zinc-800/50" : "text-zinc-500 hover:bg-zinc-50")
                  )}
                >
                  Todas
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full transition-colors",
                    mlSalesSubTab === 'all' ? "bg-zinc-600 text-white" : (theme === 'dark' ? "bg-zinc-800 text-zinc-500" : "bg-zinc-200 text-zinc-400")
                  )}>
                    {metrics.ultimasVendas.length}
                  </span>
                </button>
              </div>

              {filteredSales.map((sale: any) => {
                const getShippingStatusInfo = (sale: any) => {
                  if (sale.shipping_status === 'cancelled' || sale.shipping_substatus === 'cancelled' || sale.shipping_substatus === 'not_delivered') {
                    return {
                      title: 'Cancelada',
                      titleColor: 'text-red-500',
                      description: 'A venda foi cancelada.',
                      buttonText: 'Ver detalhes',
                      buttonAction: 'view'
                    };
                  }
                  if (sale.has_dispute) {
                    return {
                      title: 'Mediação em curso',
                      titleColor: 'text-red-500',
                      description: 'Responda à mediação para prosseguir com a venda.',
                      buttonText: 'Responder mediação',
                      buttonAction: 'dispute'
                    };
                  }
                  if (sale.shipping_status?.startsWith('ready_to_ship') || sale.shipping_status?.includes('ready_to_print') || sale.shipping_status?.includes('printed') || sale.shipping_status?.includes('invoice_pending')) {
                    if (sale.shipping_status?.includes('ready_to_print') || sale.shipping_substatus === 'ready_to_print') {
                      return {
                        title: 'Pronta para gerar etiqueta',
                        titleColor: 'text-orange-500',
                        description: 'Você deve despachar o pacote hoje ou amanhã em Correios.',
                        buttonText: 'GERAR ETIQUETA',
                        buttonAction: 'print'
                      };
                    }
                    if (sale.shipping_status.includes('printed') || sale.shipping_substatus === 'printed') {
                      return {
                        title: 'Etiqueta já impressa',
                        titleColor: 'text-blue-500',
                        description: 'Aguardar coleta ou despachar o pacote.',
                        buttonText: 'Reimprimir etiqueta',
                        buttonAction: 'print'
                      };
                    }
                    if (sale.shipping_status.includes('invoice_pending') || sale.shipping_substatus === 'invoice_pending') {
                      return {
                        title: 'Aguardando nota fiscal',
                        titleColor: 'text-amber-500',
                        description: 'Enviar XML da NF para liberar a etiqueta.',
                        buttonText: 'Emitir NF',
                        buttonAction: 'invoice'
                      };
                    }
                    // Default for ready_to_ship
                    return {
                      title: 'Pronta para envio',
                      titleColor: 'text-orange-500',
                      description: 'Você deve despachar o pacote.',
                      buttonText: 'GERAR ETIQUETA',
                      buttonAction: 'print'
                    };
                  }
                  if (sale.shipping_status === 'shipped') {
                    return {
                      title: 'Em trânsito',
                      titleColor: 'text-violet-500',
                      description: 'O pacote está a caminho do comprador.',
                      buttonText: 'Acompanhar envio',
                      buttonAction: 'track'
                    };
                  }
                  if (sale.shipping_status === 'delivered') {
                    return {
                      title: 'Entregue',
                      titleColor: 'text-emerald-500',
                      description: 'O pacote foi entregue ao comprador.',
                      buttonText: 'Ver detalhes',
                      buttonAction: 'view'
                    };
                  }
                  if (sale.shipping_status === 'pending') {
                    return {
                      title: 'Envio pendente',
                      titleColor: 'text-amber-500',
                      description: 'Aguardando liberação da etiqueta.',
                      buttonText: 'Ver detalhes',
                      buttonAction: 'view'
                    };
                  }
                  if (sale.status === 'cancelled') {
                    return {
                      title: 'Cancelada',
                      titleColor: 'text-red-500',
                      description: 'A venda foi cancelada.',
                      buttonText: 'Ver detalhes',
                      buttonAction: 'view'
                    };
                  }
                  return {
                    title: sale.status === 'Pago' ? 'Pagamento aprovado' : sale.status,
                    titleColor: 'text-zinc-500',
                    description: 'Aguardando atualização de envio.',
                    buttonText: 'Ver detalhes',
                    buttonAction: 'view'
                  };
                };
                
                const statusInfo = getShippingStatusInfo(sale);

                return (
                <div key={sale.id} className={cn(
                  "border rounded-xl p-4 flex flex-col gap-4 transition-all",
                  theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                )}>
                  {/* Header do Card */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-amber-400 text-black text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm">ML</div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-200">#{sale.id}</span>
                        <span className="text-[10px] text-zinc-500">{new Date(sale.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={cn("text-sm font-semibold truncate max-w-[140px]", theme === 'dark' ? "text-zinc-100" : "text-zinc-900")}>
                          {sale.cliente || sale.nickname}
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate max-w-[140px]">{sale.nickname}</div>
                      </div>
                      <button 
                        onClick={() => window.open(`https://myaccount.mercadolivre.com.br/messaging/orders/${sale.id}`, '_blank')}
                        className="p-2 rounded-full hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-blue-400"
                        title="Mensagens"
                      >
                        <MessageSquare size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Ação Principal e Detalhes */}
                  <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5">
                    <div className="flex flex-col gap-0.5">
                      <span className={cn("font-bold text-sm", statusInfo.titleColor)}>{statusInfo.title}</span>
                      <span className="text-zinc-400 text-xs">{statusInfo.description}</span>
                    </div>
                    {statusInfo.buttonAction === 'print' ? (
                      <button 
                        onClick={async () => {
                          if (!sale.shipping_id) {
                            alert('ID de envio não encontrado para este pedido.');
                            return;
                          }
                          try {
                            const res = await fetchWithRetry(`/api/ml/shipment-label/${sale.shipping_id}`);
                            if (!res.ok) throw new Error('Falha ao baixar etiqueta');
                            const blob = await res.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            
                            const contentDisposition = res.headers.get('Content-Disposition');
                            let filename = `etiqueta-${sale.shipping_id}.pdf`;
                            if (contentDisposition) {
                              const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                              if (filenameMatch && filenameMatch.length === 2) {
                                filename = filenameMatch[1];
                              } else {
                                const filenameMatch2 = contentDisposition.match(/filename=([^;]+)/);
                                if (filenameMatch2 && filenameMatch2.length === 2) {
                                  filename = filenameMatch2[1];
                                }
                              }
                            }
                            
                            a.download = filename;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            window.URL.revokeObjectURL(url);
                          } catch (err) {
                            console.error('Erro ao baixar etiqueta:', err);
                            alert('Erro ao baixar etiqueta. Verifique se o pedido já possui etiqueta gerada.');
                          }
                        }}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                      >
                        {statusInfo.buttonText}
                      </button>
                    ) : statusInfo.buttonAction === 'dispute' ? (
                      <button 
                        onClick={() => window.open(`https://myaccount.mercadolivre.com.br/messaging/orders/${sale.id}`, '_blank')}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                      >
                        {statusInfo.buttonText}
                      </button>
                    ) : (
                      <button 
                        onClick={() => window.open(`https://myaccount.mercadolivre.com.br/sales/${sale.id}/detail`, '_blank')}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-bold transition-colors border",
                          theme === 'dark' ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800" : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                        )}
                      >
                        {statusInfo.buttonText}
                      </button>
                    )}
                  </div>

                  {/* Detalhes do Item */}
                  <div className={cn(
                    "flex items-center justify-between p-3 rounded-lg",
                    theme === 'dark' ? "bg-zinc-800/30" : "bg-zinc-50"
                  )}>
                    <div className="flex items-center gap-3 min-w-0">
                      {sale.thumbnail && (
                        <img loading="lazy" src={sale.thumbnail} className="w-10 h-10 rounded-lg object-cover border border-zinc-800 shrink-0" referrerPolicy="no-referrer" />
                      )}
                      <span className={cn(
                        "text-sm font-semibold truncate",
                        theme === 'dark' ? "text-zinc-100" : "text-zinc-900"
                      )} title={sale.itens}>{sale.itens}</span>
                    </div>
                    <div className="flex items-center gap-8">
                      <span className={cn("text-zinc-500 text-sm font-mono", !showSensitiveInfo && "blur-sm select-none")}>
                        {showSensitiveInfo ? formatCurrency(sale.valor) : "R$ ***"}
                      </span>
                      <span className="text-zinc-500 text-sm">{sale.quantidade} unidade{sale.quantidade > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              )})}
              {filteredSales.length === 0 && (
                <div className="text-center py-12 px-4 border-2 border-dashed border-zinc-800 rounded-2xl">
                  <Package className="mx-auto text-zinc-700 mb-3 opacity-20" size={40} />
                  <p className="text-zinc-500 font-medium">Nenhuma encomenda nesta categoria.</p>
                </div>
              )}
              {source === 'mercadolivre' && metrics.ultimasVendas.length > 0 && (
                <div className="flex justify-center pt-4">
                  <button 
                    onClick={() => onTabChange('mercadolivre')}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95",
                      theme === 'dark' ? "bg-zinc-800 text-zinc-300 hover:text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    )}
                  >
                    <ShoppingCart size={16} className="text-violet-500" />
                    Ver todas as vendas no Mercado Livre
                  </button>
                </div>
              )}
            </div>
          }
        </div>

        {/* Últimos Itens / Anúncios Recentes ML */}
        <div className={cn(
          "lg:col-span-3 border rounded-2xl overflow-hidden transition-all duration-300 mt-6",
          theme === 'dark' 
            ? "bg-zinc-900/40 border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)]" 
            : "bg-white border-zinc-200 shadow-sm"
        )}>
          <div className={cn(
            "p-4 border-b flex items-center justify-between",
            theme === 'dark' ? "border-zinc-800/50" : "border-zinc-100"
          )}>
            <h3 className={cn("font-bold tracking-tight", theme === 'dark' ? "text-white" : "text-zinc-900")}>
              {source === 'estoque' ? "Últimos itens adicionados" : "Anúncios Recentes ML"}
            </h3>
            <Package size={16} className="text-violet-500" />
          </div>
          <div className="overflow-x-auto">
            {/* Desktop Table */}
            <table className="hidden md:table w-full text-left text-sm">
              <thead>
                <tr className={cn(
                  "text-[10px] uppercase font-bold tracking-wider",
                  theme === 'dark' ? "bg-zinc-800/30 text-zinc-500" : "bg-zinc-50 text-zinc-500"
                )}>
                  <th className="px-4 py-3">{source === 'estoque' ? "Peça" : "Anúncio"}</th>
                  <th className="px-4 py-3 text-center">{source === 'estoque' ? "Qtd" : "Vendas"}</th>
                  <th className="px-4 py-3">{source === 'estoque' ? "Moto" : "Status"}</th>
                  {source === 'mercadolivre' && <th className="px-4 py-3">Criado em</th>}
                  <th className="px-4 py-3">Valor</th>
                </tr>
              </thead>
              <tbody className={cn("divide-y", theme === 'dark' ? "divide-zinc-800/30" : "divide-zinc-100")}>
                {metrics.ultimosItens.map((item: any) => (
                  <tr 
                    key={item.id} 
                    onClick={() => {
                      if (source === 'estoque') onSelectItem(item);
                      else if (item.permalink) window.open(item.permalink, '_blank');
                    }}
                    className={cn(
                      "transition-colors group cursor-pointer",
                      theme === 'dark' ? "hover:bg-zinc-800/20" : "hover:bg-zinc-50"
                    )}
                  >
                    <td className={cn("px-4 py-3 font-bold", theme === 'dark' ? "text-zinc-200" : "text-zinc-900")}>
                      <div className="flex items-center gap-3">
                        {source === 'mercadolivre' && item.thumbnail && (
                          <img loading="lazy" src={item.thumbnail} className="w-10 h-10 rounded-lg object-cover border border-zinc-800" referrerPolicy="no-referrer" />
                        )}
                        <span className="">{source === 'mercadolivre' ? (item.titulo || item.id) : (item.nome || item.title)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider",
                        theme === 'dark' ? "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30" : "bg-violet-100 text-violet-600"
                      )}>
                        {source === 'mercadolivre' ? (item.estoque || item.vendidos || 0) : (item.estoque || 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                        {source === 'mercadolivre' ? (item.status === 'active' ? 'Ativo' : item.status) : (item.moto || item.status)}
                      </span>
                    </td>
                    {source === 'mercadolivre' && (
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className={cn("text-[10px] font-bold", theme === 'dark' ? "text-zinc-300" : "text-zinc-700")}>
                            {item.date_created ? new Date(item.date_created).toLocaleDateString('pt-BR') : '-'}
                          </span>
                          <span className="text-[9px] text-zinc-500 italic">
                            {item.date_created ? formatRelativeTime(item.date_created) : ''}
                          </span>
                        </div>
                      </td>
                    )}
                    <td className={cn("px-4 py-3 font-black", theme === 'dark' ? "text-zinc-100" : "text-zinc-900")}>
                      {formatCurrency(source === 'mercadolivre' ? (item.preco || 0) : (item.valor || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="md:hidden flex flex-col max-h-[500px] overflow-y-auto scrollbar-hide divide-y divide-zinc-800/10 px-8">
              {metrics.ultimosItens.map((item: any) => (
                <div 
                  key={item.id}
                  onClick={() => {
                    if (source === 'estoque') onSelectItem(item);
                    else if (item.permalink) window.open(item.permalink, '_blank');
                  }}
                  className="py-3 flex flex-col gap-2 active:bg-zinc-800/20 transition-all duration-200 cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    {source === 'mercadolivre' && item.thumbnail && (
                      <img loading="lazy" src={item.thumbnail} className="w-10 h-10 rounded-lg object-cover border border-zinc-800 shadow-sm shrink-0" referrerPolicy="no-referrer" />
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className={cn(
                        "font-bold text-[13px] leading-tight truncate", 
                        theme === 'dark' ? "text-zinc-300" : "text-zinc-700"
                      )}>
                        {source === 'mercadolivre' ? (item.titulo || item.id) : (item.nome || item.title)}
                      </span>
                      <span className="text-emerald-400 font-black text-base tracking-tight">
                        {formatCurrency(source === 'mercadolivre' ? (item.preco || 0) : (item.valor || 0))}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shadow-sm",
                      theme === 'dark' ? "bg-violet-500/10 text-violet-400 border border-violet-500/20" : "bg-violet-100 text-violet-600 border border-violet-200"
                    )}>
                      Qtd: {source === 'mercadolivre' ? (item.estoque || item.vendidos || 0) : (item.estoque || 0)}
                    </span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shadow-sm ml-auto",
                      theme === 'dark' ? "bg-zinc-800 text-zinc-500 border border-zinc-700" : "bg-zinc-100 text-zinc-400 border border-zinc-200"
                    )}>
                      {source === 'mercadolivre' ? (item.status === 'active' ? 'Ativo' : item.status) : (item.moto || item.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal de Transações por Tipo */}
      <AnimatePresence>
        {selectedPaymentType && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "w-full max-w-4xl max-h-[80vh] overflow-visible rounded-3xl border shadow-2xl flex flex-col",
                theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
              )}
            >
              <div className="p-6 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/50">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white flex items-center gap-3">
                    <History className="text-violet-500" />
                    Transações: {selectedPaymentType}
                  </h3>
                  <p className="text-zinc-500 text-sm mt-1">
                    Total de {filteredSalesByType.length} registros encontrados
                  </p>
                </div>
                
                <div className="flex flex-col items-end mr-4 md:mr-8">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Soma Total</span>
                  <div className="text-lg md:text-2xl font-black text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.4)]">
                    {formatCurrency(filteredSalesByType.reduce((sum, s) => sum + s.valor, 0))}
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedPaymentType(null)}
                  className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-0">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className={cn(
                      "text-[10px] uppercase font-bold tracking-wider",
                      theme === 'dark' ? "bg-zinc-800 text-zinc-500" : "bg-zinc-50 text-zinc-500"
                    )}>
                      <th className="px-6 py-4 border-b border-zinc-800/50">Item / Descrição</th>
                      <th className="px-6 py-4 border-b border-zinc-800/50">Valor</th>
                      <th className="px-6 py-4 border-b border-zinc-800/50">Data</th>
                      <th className="px-6 py-4 border-b border-zinc-800/50">RK ID</th>
                    </tr>
                  </thead>
                  <tbody className={cn("divide-y", theme === 'dark' ? "divide-zinc-800/30" : "divide-zinc-100")}>
                    {filteredSalesByType.length > 0 ? (
                      filteredSalesByType.map((sale) => (
                        <tr 
                          key={sale.id} 
                          className={cn(
                            "transition-colors",
                            theme === 'dark' ? "hover:bg-zinc-800/20" : "hover:bg-zinc-50"
                          )}
                        >
                          <td className="px-6 py-4">
                            <div className="font-bold text-white">{sale.nome}</div>
                            {sale.descricao && <div className="text-xs text-zinc-500 mt-1 line-clamp-1">{sale.descricao}</div>}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-emerald-400 font-bold">
                              {formatCurrency(sale.valor)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-zinc-400 text-xs">
                            {new Date(sale.data).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-zinc-500 font-mono text-xs">{sale.rk_id || '-'}</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                          Nenhuma transação encontrada para este tipo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="p-4 border-t border-zinc-800/50 bg-zinc-900/30 flex justify-end">
                <button 
                  onClick={() => setSelectedPaymentType(null)}
                  className="px-6 py-2 rounded-xl bg-zinc-800 text-white font-bold hover:bg-zinc-700 transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Todos os Anúncios ML */}
      <AnimatePresence>
        {showAllMlAds && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "w-full max-w-5xl max-h-[90vh] overflow-visible rounded-3xl border shadow-2xl flex flex-col",
                theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
              )}
            >
              <div className="p-6 border-b border-zinc-800/50 flex flex-col gap-4 bg-zinc-900/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white flex items-center gap-3">
                    <Package className="text-amber-500" />
                    Anúncios Ativos
                  </h3>
                  <button 
                    onClick={() => setShowAllMlAds(false)}
                    className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
                <input 
                  type="text"
                  placeholder="Buscar peça ou moto..."
                  value={mlSearchTerm}
                  onChange={(e) => { setMlSearchTerm(e.target.value); setMlCurrentPage(1); }}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800 text-white text-sm border border-zinc-700 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex-1 overflow-auto p-0">
                {isMlListingsLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="animate-spin text-amber-500" size={40} />
                    <p className="text-zinc-500 font-bold animate-pulse">Buscando anúncios...</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile View */}
                    <div className="md:hidden p-4 space-y-3">
                      {paginatedMlListings.map((item) => {
                        // Heuristic: extract moto name from title
                        // Assuming title format: "Peça Moto" or "Peça (Moto)"
                        const title = item.titulo || item.id;
                        const parts = title.split(/\s\(/)[0].split(/\s/);
                        const motoName = parts.slice(-2).join(' ');
                        const pieceName = parts.slice(0, -2).join(' ') || title;
                        
                        return (
                          <div 
                            key={item.id}
                            onClick={() => window.open(item.link, '_blank')}
                            className={cn(
                              "p-3 rounded-2xl border flex items-center gap-3 transition-colors cursor-pointer",
                              theme === 'dark' ? "bg-zinc-800/40 border-zinc-700 hover:bg-zinc-800" : "bg-white border-zinc-200 hover:bg-zinc-50"
                            )}
                          >
                            <img loading="lazy" src={item.thumbnail} className="w-16 h-16 rounded-xl object-cover border border-zinc-700" referrerPolicy="no-referrer" />
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="font-bold text-sm truncate">{pieceName}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-emerald-500 font-black text-sm">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.preco) || 0)}
                                </span>
                                <span className="text-[10px] bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full font-medium">
                                  {motoName}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Desktop View */}
                    <table className="hidden md:table w-full text-left text-sm border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className={cn(
                        "text-[10px] uppercase font-bold tracking-wider",
                        theme === 'dark' ? "bg-zinc-800 text-zinc-500" : "bg-zinc-50 text-zinc-500"
                      )}>
                        <th className="px-6 py-4 border-b border-zinc-800/50 cursor-pointer" onClick={() => toggleMlSort('titulo')}>Anúncio {mlSortConfig.key === 'titulo' && (mlSortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                        <th className="px-6 py-4 border-b border-zinc-800/50 cursor-pointer" onClick={() => toggleMlSort('preco')}>Preço {mlSortConfig.key === 'preco' && (mlSortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                        <th className="px-6 py-4 border-b border-zinc-800/50 text-center cursor-pointer" onClick={() => toggleMlSort('estoque')}>Estoque {mlSortConfig.key === 'estoque' && (mlSortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                        <th className="px-6 py-4 border-b border-zinc-800/50 cursor-pointer" onClick={() => toggleMlSort('criado_em')}>Data {mlSortConfig.key === 'criado_em' && (mlSortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                        <th className="px-6 py-4 border-b border-zinc-800/50">Status</th>
                      </tr>
                    </thead>
                    <tbody className={cn("divide-y", theme === 'dark' ? "divide-zinc-800/30" : "divide-zinc-100")}>
                      {paginatedMlListings.map((item) => (
                        <tr 
                          key={item.id} 
                          onClick={() => window.open(item.link, '_blank')}
                          className={cn(
                            "transition-colors cursor-pointer",
                            theme === 'dark' ? "hover:bg-zinc-800/20" : "hover:bg-zinc-50"
                          )}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <img loading="lazy" src={item.thumbnail} className="w-12 h-12 rounded-xl object-cover border border-zinc-800" referrerPolicy="no-referrer" />
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-white truncate max-w-[300px]">{item.titulo || item.id}</span>
                                <span className="text-[10px] text-zinc-500 font-mono">{item.id}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-emerald-400 font-black">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.preco) || 0)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-300 font-bold text-xs">
                              {item.estoque}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-zinc-400 font-mono text-xs">
                            {item.criado_em ? new Date(item.criado_em).toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                              item.status === 'active' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                            )}>
                              {item.status === 'active' ? 'Ativo' : item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              </div>
              
              <div className="p-4 border-t border-zinc-800/50 bg-zinc-900/30 flex justify-between items-center">
                <span className="text-sm text-zinc-500">Página {mlCurrentPage} de {mlTotalPages || 1}</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setMlCurrentPage(p => Math.max(1, p - 1))}
                    disabled={mlCurrentPage === 1}
                    className="px-4 py-2 rounded-xl bg-zinc-800 text-white font-bold hover:bg-zinc-700 transition-all disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button 
                    onClick={() => setMlCurrentPage(p => Math.min(mlTotalPages, p + 1))}
                    disabled={mlCurrentPage >= mlTotalPages}
                    className="px-4 py-2 rounded-xl bg-zinc-800 text-white font-bold hover:bg-zinc-700 transition-all disabled:opacity-50"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
};

const InventoryRow = memo(({ 
  item, 
  theme, 
  selectedIds, 
  toggleSelect, 
  onSelectItem, 
  readOnly, 
  handleInventoryInlineEdit, 
  editingCell, 
  handleInventoryInlineSave, 
  setEditingCell, 
  columns, 
  formatCurrency, 
  formatDate,
  openEditModal,
  setItemToDelete,
  setIsDeleteConfirmOpen
}: any) => (
  <tr 
    key={item.id} 
    onClick={() => onSelectItem(item)}
    className={cn(
      "transition-all duration-200 group cursor-pointer transform-gpu",
      selectedIds.includes(item.id) 
        ? theme === 'dark' ? "bg-violet-500/10" : "bg-violet-50"
        : theme === 'dark' ? "hover:bg-zinc-800/20" : "hover:bg-zinc-50"
    )}
  >
    <td className="px-3 py-2">
      <div 
        className={cn(
          "w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-all",
          selectedIds.includes(item.id) 
            ? "bg-violet-600 border-violet-600 opacity-100" 
            : cn(
                "opacity-0 group-hover:opacity-100",
                theme === 'dark' ? "border-zinc-700" : "border-zinc-300"
              )
        )}
        onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
      >
        {selectedIds.includes(item.id) && <Check className="text-white" size={10} />}
      </div>
    </td>
    {columns.map((col: any) => (
      <td key={`${item.id}-${col.key}`} className={cn(
        "px-3 py-2 text-xs transition-colors",
        theme === 'dark' ? "text-zinc-400" : "text-zinc-600"
      )} onDoubleClick={() => !readOnly && handleInventoryInlineEdit(item.id, col.key)}>
        {editingCell?.itemId === item.id && editingCell?.field === col.key ? (
          <input 
            defaultValue={item[col.key]}
            onBlur={(e) => handleInventoryInlineSave(item.id, col.key, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleInventoryInlineSave(item.id, col.key, e.currentTarget.value);
              if (e.key === 'Escape') setEditingCell(null);
            }}
            autoFocus
            className="w-full bg-transparent border-b border-violet-500 outline-none"
          />
        ) : col.key === 'valor' ? (
          <span className="font-bold text-emerald-500">{formatCurrency(item[col.key])}</span>
        ) : col.key === 'criado_em' ? (
          <span className="text-[10px] text-zinc-500">{formatDate(item[col.key])}</span>
        ) : col.key === 'ml_link' && item[col.key] ? (
          <a 
            href={item[col.key]} 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 inline-block"
          >
            <ExternalLink size={12} />
          </a>
        ) : col.key === 'imagem' && item[col.key] ? (
          <div className={cn(
            "w-8 h-8 rounded-lg overflow-hidden border relative",
            theme === 'dark' ? "border-zinc-800/50" : "border-zinc-200"
          )}>
            <img 
              loading="lazy"
              src={item[col.key]} 
              alt={item.nome} 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer" 
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 -z-10">
              <Package size={12} className="text-zinc-400 opacity-50" />
            </div>
          </div>
        ) : col.key === 'categoria' ? (
          <span className={cn(
            "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors",
            theme === 'dark' ? "bg-violet-500/10 text-violet-400 border border-violet-500/20" : "bg-zinc-100 text-zinc-600"
          )}>
            {item[col.key]}
          </span>
        ) : col.key === 'moto' ? (
          <span className={cn(
            "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-colors",
            theme === 'dark' ? "bg-zinc-800 text-zinc-300 border-zinc-700" : "bg-zinc-100 text-zinc-600 border-zinc-200"
          )}>
            {item[col.key]}
          </span>
        ) : col.key === 'actions' ? (
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(item);
              }}
              className={cn(
                "p-2 rounded-lg transition-all",
                theme === 'dark' ? "bg-violet-500/10 text-violet-400 hover:bg-violet-500/20" : "text-zinc-400 hover:text-violet-600 hover:bg-violet-50"
              )}
              title="Editar item"
            >
              <Edit2 size={16} />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setItemToDelete(item.id);
                setIsDeleteConfirmOpen(true);
              }}
              className={cn(
                "p-2 rounded-lg transition-all",
                theme === 'dark' ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "text-zinc-400 hover:text-red-600 hover:bg-red-50"
              )}
              title="Excluir item"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <span className="truncate block max-w-[150px]">{item[col.key] || '-'}</span>
        )}
      </td>
    ))}
  </tr>
));

const InventoryView = memo(({ theme, onSelectItem, onRegisterActions, isSearchOpen, readOnly = false, pendingEditItem, setPendingEditItem }: { 
  theme: 'light' | 'dark', 
  onSelectItem: (item: any) => void,
  onRegisterActions?: (actions: { edit: (item: any) => void, delete: (id: string) => void, focusSearch?: () => void }) => void,
  isSearchOpen?: boolean,
  readOnly?: boolean,
  pendingEditItem?: any | null,
  setPendingEditItem?: (item: any | null) => void
}) => {
  const { inventory: items, loading, setInventory, refreshData } = useContext(DataContext);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  
  const handleInventoryInlineEdit = (itemId: string, field: string) => {
    setEditingCell({ itemId, field });
  };

  const handleInventoryInlineSave = async (itemId: string, field: string, value: string) => {
    setEditingCell(null);
    
    const itemToUpdate = items.find(s => s.id === itemId);
    if (!itemToUpdate || itemToUpdate[field as keyof typeof itemToUpdate] === value) return;

    const updatedData = { [field]: field === 'valor' ? Number(value) : value };
    
    // Optimistic update
    setInventory(prev => prev.map(item => item.id === itemId ? { ...item, ...updatedData } : item));

    try {
      const response = await fetchWithRetry(`/api/inventory/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Falha ao atualizar item');
      }
      refreshData();
    } catch (err: any) {
      alert(err.message);
      refreshData();
    }
  };
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [selectedMoto, setSelectedMoto] = useState('Todas');
  const [onlyWithStock, setOnlyWithStock] = useState(false);
  const [showWithPhotoFirst, setShowWithPhotoFirst] = useState(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(window.innerWidth < 768 ? 10 : 25);

  // Sort states
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({
    key: 'criado_em',
    direction: 'desc'
  });

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editingCell, setEditingCell] = useState<{ itemId: string, field: string } | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    nome: '',
    categoria: '',
    novaCategoria: '',
    moto: '',
    outraMoto: '',
    valor: '',
    estoque: '1',
    ano: '',
    descricao: '',
    ml_link: '',
    imagem: ''
  });

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
  };

  // Extract unique categories and motos for filters
  const categories = Array.from(new Set(items.map(item => item.categoria).filter(Boolean)));
  const motos = Array.from(new Set(items.map(item => item.moto).filter(Boolean)));

  // Sorting logic
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filtering and Sorting logic
  const filteredAndSortedItems = useMemo(() => {
    const searchTerms = debouncedSearchTerm.toLowerCase().split(' ').filter(t => t.length > 0);
    
    let result = [...items].filter(item => {
      const matchesSearch = searchTerms.length === 0 || searchTerms.every(term => 
        (item.nome?.toLowerCase() || '').includes(term) ||
        (item.moto?.toLowerCase() || '').includes(term) ||
        (item.rk_id?.toLowerCase() || '').includes(term) ||
        (item.categoria?.toLowerCase() || '').includes(term)
      );
      
      const matchesCategory = selectedCategory === 'Todas' || item.categoria === selectedCategory;
      const matchesMoto = selectedMoto === 'Todas' || item.moto === selectedMoto;
      const matchesStock = !onlyWithStock || (item.estoque > 0);

      return matchesSearch && matchesCategory && matchesMoto && matchesStock;
    });

    result.sort((a, b) => {
      // 1. Primary Sort: sortConfig
      if (sortConfig.key && sortConfig.direction) {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue !== bValue) {
          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        }
      }

      // 2. Secondary Sort: Photo priority (if enabled)
      if (showWithPhotoFirst) {
        const aHasPhoto = !!a.imagem;
        const bHasPhoto = !!b.imagem;
        if (aHasPhoto !== bHasPhoto) {
          if (aHasPhoto && !bHasPhoto) return -1;
          if (!aHasPhoto && bHasPhoto) return 1;
        }
      }

      return 0;
    });

    return result;
  }, [items, debouncedSearchTerm, selectedCategory, selectedMoto, onlyWithStock, sortConfig, showWithPhotoFirst]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedItems, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedItems.length / itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedMoto, onlyWithStock, itemsPerPage, showWithPhotoFirst]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('Todas');
    setSelectedMoto('Todas');
    setOnlyWithStock(false);
    setShowWithPhotoFirst(true);
    setSortConfig({ key: 'criado_em', direction: 'desc' });
    setSelectedIds([]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedItems.map(item => item.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const idsToRemove = [...selectedIds];
    setIsBulkDeleteConfirmOpen(false);
    
    // Optimistic update
    setInventory(prev => prev.filter(item => !idsToRemove.includes(item.id)));
    setSelectedIds([]);

    try {
      const response = await fetchWithRetry('/api/inventory/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToRemove })
      });
      
      if (!response.ok) throw new Error('Falha ao excluir itens');
    } catch (err: any) {
      alert(err.message);
      refreshData();
    }
  };

  const handleBulkUpdateStock = async (amount: number) => {
    if (!selectedIds.length) return;
    const idsToUpdate = [...selectedIds];
    
    // Optimistic update
    setInventory(prev => prev.map(item => {
      if (idsToUpdate.includes(item.id)) {
        return { ...item, estoque: Math.max(0, (item.estoque || 0) + amount) };
      }
      return item;
    }));

    try {
      const response = await fetchWithRetry('/api/inventory/bulk-update-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToUpdate, amount })
      });
      
      if (!response.ok) throw new Error('Falha ao atualizar estoque');
    } catch (err: any) {
      alert(err.message);
      refreshData();
    }
  };

  const handleBulkUpdateCategory = async () => {
    if (!selectedIds.length || !bulkCategory) return;
    const idsToUpdate = [...selectedIds];
    const newCategory = bulkCategory;
    setIsCategoryModalOpen(false);

    // Optimistic update
    setInventory(prev => prev.map(item => {
      if (idsToUpdate.includes(item.id)) {
        return { ...item, categoria: newCategory };
      }
      return item;
    }));
    setSelectedIds([]);
    setBulkCategory('');

    try {
      const response = await fetchWithRetry('/api/inventory/bulk-update-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToUpdate, categoria: newCategory })
      });

      if (!response.ok) throw new Error('Falha ao atualizar categoria');
    } catch (err: any) {
      setError(err.message);
      refreshData();
    }
  };

  useEffect(() => {
    if (isModalOpen || isDeleteConfirmOpen || isBulkDeleteConfirmOpen || isCategoryModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen, isDeleteConfirmOpen, isBulkDeleteConfirmOpen, isCategoryModalOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    const payload = {
      ...formData,
      categoria: formData.categoria === 'nova' ? formData.novaCategoria : formData.categoria,
      moto: formData.moto === 'outra' ? formData.outraMoto : formData.moto,
      valor: Number(formData.valor) || 0,
      estoque: Number(formData.estoque) || 0,
    };

    try {
      if (editingItem) {
        // Update
        const response = await fetchWithRetry(`/api/inventory/${editingItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
          throw new Error(errorData.error || `Erro ao atualizar item (Status ${response.status})`);
        }
        
        const updatedItem = await response.json();
        setInventory(prev => prev.map(item => item.id === editingItem.id ? updatedItem : item));
      } else {
        // Create
        const response = await fetchWithRetry('/api/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
          throw new Error(errorData.error || `Erro ao salvar item (Status ${response.status})`);
        }
        
        const newItem = await response.json();
        setInventory(prev => [newItem, ...prev]);
      }
      
      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({
        nome: '',
        categoria: '',
        novaCategoria: '',
        moto: '',
        outraMoto: '',
        valor: '',
        estoque: '1',
        ano: '',
        descricao: '',
        ml_link: '',
        imagem: ''
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleteConfirmOpen(false);
    const targetId = id || itemToDelete;
    if (!targetId) return;
    
    // Optimistic update
    setInventory(prev => prev.filter(item => item.id !== targetId));
    setSelectedIds(prev => prev.filter(i => i !== targetId));
    setItemToDelete(null);

    try {
      const response = await fetchWithRetry(`/api/inventory/${targetId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Falha ao excluir item');
    } catch (err: any) {
      setError(err.message);
      refreshData();
    }
  };

  const openEditModal = useCallback((item: any) => {
    setEditingItem(item);
    setFormData({
      nome: item.nome || '',
      categoria: item.categoria || '',
      novaCategoria: '',
      moto: item.moto || '',
      outraMoto: '',
      valor: item.valor ? item.valor.toString() : '',
      estoque: item.estoque ? item.estoque.toString() : '1',
      ano: item.ano || '',
      descricao: item.descricao || '',
      ml_link: item.ml_link || '',
      imagem: item.imagem || ''
    });
    setIsModalOpen(true);
  }, []);

  // Handle pending edit from other tabs
  useEffect(() => {
    if (pendingEditItem && setPendingEditItem) {
      openEditModal(pendingEditItem);
      setPendingEditItem(null);
    }
  }, [pendingEditItem, setPendingEditItem, openEditModal]);

  // Register actions for global access (e.g. from DetailModal)
  useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({
        edit: openEditModal,
        delete: (id: string) => {
          setItemToDelete(id);
          setIsDeleteConfirmOpen(true);
        },
        focusSearch: () => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
            searchInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    }
  }, [onRegisterActions, openEditModal]);

  useEffect(() => {
    const checkMobile = () => {
      if (window.innerWidth < 768) {
        setViewMode('card');
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (loading && items.length === 0) {
    // Não bloquear a tela
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-rose-400 gap-4">
        <AlertCircle size={40} />
        <p>Erro: {error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-zinc-800 rounded-lg text-white hover:bg-zinc-700 transition-colors"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  const columns = [
    { key: 'nome', label: 'Peça' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'valor', label: 'Valor' },
    { key: 'moto', label: 'Moto' },
    { key: 'estoque', label: 'Estoque' },
    { key: 'ano', label: 'Ano' },
    { key: 'rk_id', label: 'ID' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'criado_em', label: 'Criado em' },
    { key: 'imagem', label: 'Imagem' },
    { key: 'ml_link', label: 'ML LINK' },
    ...(!readOnly ? [{ key: 'actions', label: 'Ações' }] : []),
  ];

  const formatCurrency = (value: any) => {
    const num = Number(value);
    if (isNaN(num)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar Profissional e Compacta */}
      <div className={cn(
        "relative z-50 p-3 md:p-4 rounded-3xl flex flex-col gap-3 transition-all duration-300 shadow-xl border",
        theme === 'dark' 
          ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800 shadow-black/40" 
          : "bg-white/90 backdrop-blur-xl border-zinc-100 shadow-zinc-200/40",
        isSearchOpen && "blur-md pointer-events-none opacity-50"
      )}>
        {/* Search Bar Compacta */}
        <div className="w-full relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-violet-500 transition-colors" size={18} />
          <input 
            ref={searchInputRef}
            type="text" 
            placeholder={readOnly ? "Buscar no catálogo..." : "Buscar no estoque..."} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              "w-full rounded-xl py-2.5 pl-11 pr-4 text-sm font-medium outline-none transition-all duration-200 border shadow-inner",
              theme === 'dark' 
                ? "bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50" 
                : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:bg-white"
            )}
          />
        </div>

        {/* Filtros e Ações Compactos */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <CustomDropdown
              theme={theme}
              icon={<Filter size={14} />}
              value={selectedCategory}
              className="flex-1 md:flex-none min-w-[120px]"
              onChange={(val) => {
                setSelectedCategory(val);
                setCurrentPage(1);
              }}
              options={[
                { value: 'Todas', label: 'Categorias' },
                ...CATEGORIAS_OFICIAIS.map(cat => ({ value: cat, label: cat }))
              ]}
            />
            
            <CustomDropdown
              theme={theme}
              icon={<Bike size={14} />}
              value={selectedMoto}
              className="flex-1 md:flex-none min-w-[120px]"
              onChange={(val) => {
                setSelectedMoto(val);
                setCurrentPage(1);
              }}
              options={[
                { value: 'Todas', label: 'Motos' },
                ...MOTOS_OFICIAIS.map(moto => ({ value: moto, label: moto }))
              ]}
            />

            <CustomDropdown
              theme={theme}
              icon={<ArrowDownAZ size={14} />}
              value={sortConfig.key}
              className="flex-1 md:flex-none min-w-[120px]"
              onChange={(val) => {
                setSortConfig({ key: val, direction: 'desc' });
                setCurrentPage(1);
              }}
              options={[
                { value: 'criado_em', label: 'Recentes' },
                { value: 'valor', label: 'Preço' },
                { value: 'nome', label: 'Nome' },
                { value: 'estoque', label: 'Estoque' }
              ]}
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button 
              onClick={handleManualRefresh}
              disabled={loading || isRefreshing}
              className={cn(
                "flex-1 md:flex-none flex items-center justify-center gap-2 h-10 px-4 rounded-xl transition-all duration-200 border text-[11px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md",
                theme === 'dark' 
                  ? "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700" 
                  : "bg-zinc-100 border-zinc-200 text-zinc-500 hover:bg-zinc-200"
              )}
            >
              <RefreshCw size={14} className={cn((loading || isRefreshing) && "animate-spin")} />
              <span className="hidden sm:inline">Sincronizar</span>
            </button>

            {!readOnly && (
              <button 
                onClick={() => {
                  setEditingItem(null);
                  setFormData({
                    nome: '',
                    categoria: '',
                    novaCategoria: '',
                    moto: '',
                    outraMoto: '',
                    valor: '',
                    estoque: '1',
                    ano: '',
                    descricao: '',
                    ml_link: '',
                    imagem: ''
                  });
                  setIsModalOpen(true);
                }}
                className={cn(
                  "flex-1 md:flex-none flex items-center justify-center gap-2 h-10 px-6 rounded-xl transition-all duration-200 border text-[11px] font-bold uppercase tracking-wider shadow-md",
                  theme === 'dark'
                    ? "bg-violet-600 border-violet-500 text-white hover:bg-violet-500 shadow-violet-500/20"
                    : "bg-violet-600 border-violet-500 text-white hover:bg-violet-500 shadow-violet-500/30"
                )}
              >
                <Plus size={16} />
                <span>Novo Item</span>
              </button>
            )}

            {(searchTerm || selectedCategory !== 'Todas' || selectedMoto !== 'Todas') && (
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('Todas');
                  setSelectedMoto('Todas');
                  setCurrentPage(1);
                }}
                className={cn(
                  "flex-1 md:flex-none flex items-center justify-center gap-2 h-10 px-4 rounded-xl transition-all duration-200 border text-[11px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md",
                  theme === 'dark' 
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/20" 
                    : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                )}
              >
                <X size={16} />
                <span>Limpar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border transition-colors backdrop-blur-xl",
              theme === 'dark' ? "bg-zinc-900/90 border-zinc-800 text-white" : "bg-white/90 border-zinc-200 text-zinc-900"
            )}
          >
            <span className="text-sm font-medium mr-4">
              {selectedIds.length} item(s) selecionado(s)
            </span>
            
            <div className={cn("flex items-center gap-2 border-l pl-4", theme === 'dark' ? "border-zinc-800" : "border-zinc-200")}>
              <button 
                onClick={() => handleBulkUpdateStock(1)}
                className={cn("p-2 rounded-lg transition-all active:scale-95 text-emerald-400", theme === 'dark' ? "hover:bg-zinc-800" : "hover:bg-zinc-100")}
                title="Aumentar estoque"
              >
                <Plus size={18} />
              </button>
              <button 
                onClick={() => handleBulkUpdateStock(-1)}
                className={cn("p-2 rounded-lg transition-all active:scale-95 text-rose-400", theme === 'dark' ? "hover:bg-zinc-800" : "hover:bg-zinc-100")}
                title="Diminuir estoque"
              >
                <Minus size={18} />
              </button>
              <button 
                onClick={() => setIsCategoryModalOpen(true)}
                className={cn("p-2 rounded-lg transition-all active:scale-95 text-violet-400", theme === 'dark' ? "hover:bg-zinc-800" : "hover:bg-zinc-100")}
                title="Mudar categoria"
              >
                <Layers size={18} />
              </button>
              <button 
                onClick={() => setIsBulkDeleteConfirmOpen(true)}
                className={cn("p-2 rounded-lg transition-all active:scale-95 text-zinc-400", theme === 'dark' ? "hover:bg-rose-500/20 hover:text-rose-400" : "hover:bg-rose-50 hover:text-rose-600")}
                title="Excluir selecionados"
              >
                <Trash2 size={18} />
              </button>
            </div>

            <button 
              onClick={() => setSelectedIds([])}
              className={cn(
                "ml-4 text-xs transition-colors active:scale-95",
                theme === 'dark' ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"
              )}
            >
              Desmarcar tudo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table Container */}
      <div className={cn(
        "border rounded-2xl overflow-visible relative transition-all duration-300",
        theme === 'dark' 
          ? "bg-zinc-900/40 border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)]" 
          : "bg-white border-zinc-200 shadow-sm"
      )}>
        {loading && (
          <div className={cn(
            "absolute inset-0 backdrop-blur-[2px] z-10 flex items-center justify-center",
            theme === 'dark' ? "bg-zinc-950/50" : "bg-white/50"
          )}>
            <Loader2 className="animate-spin text-violet-500" size={32} />
          </div>
        )}
        <div className={cn(
          "p-4 md:p-6 border-b flex items-center justify-between transition-all duration-300",
          theme === 'dark' ? "border-zinc-800/50 bg-zinc-900/10" : "border-zinc-100 bg-zinc-50/50"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
              theme === 'dark' ? "bg-zinc-800 text-violet-400" : "bg-white text-violet-600 border border-zinc-100"
            )}>
              <Box size={20} />
            </div>
            <div className="flex flex-col">
              <h3 className={cn(
                "text-lg font-bold tracking-tight transition-colors",
                theme === 'dark' ? "text-white" : "text-zinc-900"
              )}>Estoque de Peças</h3>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  theme === 'dark' ? "text-zinc-500" : "text-zinc-400"
                )}>Sincronizado</span>
              </div>
            </div>
          </div>

          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-md",
            theme === 'dark' ? "bg-zinc-950/50 border-zinc-800" : "bg-white border-zinc-200"
          )}>
            <span className={cn("text-[10px] font-bold uppercase tracking-wider", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")}>
              {filteredAndSortedItems.length} itens
            </span>
          </div>
        </div>

        {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className={cn(
                  "transition-colors",
                  theme === 'dark' ? "bg-zinc-800/30" : "bg-zinc-50"
                )}>
                  <th className="px-3 py-2 w-10">
                    <div 
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-all",
                        selectedIds.length === paginatedItems.length && paginatedItems.length > 0
                          ? "bg-violet-600 border-violet-600" 
                          : theme === 'dark' ? "border-zinc-700" : "border-zinc-300"
                      )}
                      onClick={toggleSelectAll}
                    >
                      {selectedIds.length === paginatedItems.length && paginatedItems.length > 0 && <Check className="text-white" size={10} />}
                    </div>
                  </th>
                  {columns.map(col => (
                    <th 
                      key={col.key} 
                      onClick={() => handleSort(col.key)}
                      className={cn(
                        "px-3 py-2 text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all group",
                        theme === 'dark' ? "text-zinc-500 hover:bg-zinc-800/40" : "text-zinc-500 hover:bg-zinc-100",
                        sortConfig.key === col.key && (theme === 'dark' ? "text-violet-400 bg-violet-500/5" : "text-violet-600 bg-violet-50")
                      )}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        <div className="flex flex-col text-[6px] leading-[3px] opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className={cn(sortConfig.key === col.key && sortConfig.direction === 'asc' ? "text-violet-400" : "text-zinc-600")}>▲</span>
                          <span className={cn(sortConfig.key === col.key && sortConfig.direction === 'desc' ? "text-violet-400" : "text-zinc-600")}>▼</span>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={cn(
                "divide-y transition-colors",
                theme === 'dark' ? "divide-zinc-800/30" : "divide-zinc-100"
              )}>
                {loading && items.length === 0 ? (
                  Array(10).fill(0).map((_, i) => <SkeletonRow key={i} theme={theme} />)
                ) : paginatedItems.map((item) => (
                  <tr 
                    key={item.id} 
                    onClick={() => onSelectItem(item)}
                    className={cn(
                      "transition-all duration-200 group cursor-pointer",
                      selectedIds.includes(item.id) 
                        ? theme === 'dark' ? "bg-violet-500/10" : "bg-violet-50"
                        : theme === 'dark' ? "hover:bg-zinc-800/20" : "hover:bg-zinc-50"
                    )}
                  >
                    <td className="px-3 py-2">
                      <div 
                        className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-all",
                          selectedIds.includes(item.id) 
                            ? "bg-violet-600 border-violet-600 opacity-100" 
                            : cn(
                                "opacity-0 group-hover:opacity-100",
                                theme === 'dark' ? "border-zinc-700" : "border-zinc-300"
                              )
                        )}
                        onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                      >
                        {selectedIds.includes(item.id) && <Check className="text-white" size={10} />}
                      </div>
                    </td>
                    {columns.map(col => (
                      <td key={`${item.id}-${col.key}`} className={cn(
                        "px-3 py-2 text-xs transition-colors",
                        theme === 'dark' ? "text-zinc-400" : "text-zinc-600"
                      )} onDoubleClick={() => !readOnly && handleInventoryInlineEdit(item.id, col.key)}>
                        {editingCell?.itemId === item.id && editingCell?.field === col.key ? (
                          <input 
                            defaultValue={item[col.key]}
                            onBlur={(e) => handleInventoryInlineSave(item.id, col.key, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleInventoryInlineSave(item.id, col.key, e.currentTarget.value);
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            autoFocus
                            className="w-full bg-transparent border-b border-violet-500 outline-none"
                          />
                        ) : col.key === 'valor' ? (
                          <span className="font-bold text-emerald-500">{formatCurrency(item[col.key])}</span>
                        ) : col.key === 'criado_em' ? (
                          <span className="text-[10px] text-zinc-500">{formatDate(item[col.key])}</span>
                        ) : col.key === 'ml_link' && item[col.key] ? (
                          <a 
                            href={item[col.key]} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 rounded bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 inline-block"
                          >
                            <ExternalLink size={12} />
                          </a>
                        ) : col.key === 'imagem' && item[col.key] ? (
                          <div className={cn(
                            "w-8 h-8 rounded-lg overflow-hidden border relative",
                            theme === 'dark' ? "border-zinc-800/50" : "border-zinc-200"
                          )}>
                            <img 
                              loading="lazy"
                              src={item[col.key]} 
                              alt={item.nome} 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer" 
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 -z-10">
                              <Package size={12} className="text-zinc-400 opacity-50" />
                            </div>
                          </div>
                        ) : col.key === 'categoria' ? (
                          <span className={cn(
                            "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors",
                            theme === 'dark' ? "bg-violet-500/10 text-violet-400 border border-violet-500/20" : "bg-zinc-100 text-zinc-600"
                          )}>
                            {item[col.key]}
                          </span>
                        ) : col.key === 'moto' ? (
                          <span className={cn(
                            "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-colors",
                            theme === 'dark' ? "bg-zinc-800 text-zinc-300 border-zinc-700" : "bg-zinc-100 text-zinc-600 border-zinc-200"
                          )}>
                            {item[col.key]}
                          </span>
                        ) : col.key === 'actions' ? (
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(item);
                              }}
                              className={cn(
                                "p-2 rounded-lg transition-all",
                                theme === 'dark' ? "bg-violet-500/10 text-violet-400 hover:bg-violet-500/20" : "text-zinc-400 hover:text-violet-600 hover:bg-violet-50"
                              )}
                              title="Editar item"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setItemToDelete(item.id);
                                setIsDeleteConfirmOpen(true);
                              }}
                              className={cn(
                                "p-2 rounded-lg transition-all",
                                theme === 'dark' ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20" : "text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                              )}
                              title="Excluir item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ) : (
                          (typeof item[col.key] === 'number' && isNaN(item[col.key])) ? "0" : (item[col.key] || <span className="text-zinc-600 italic">-</span>)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-3 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 bg-zinc-50/50 dark:bg-zinc-900/20">
            {loading && items.length === 0 ? (
              Array(8).fill(0).map((_, i) => (
                <div key={i} className={cn("h-64 rounded-2xl animate-pulse", theme === 'dark' ? "bg-zinc-800/50" : "bg-zinc-200/50")} />
              ))
            ) : paginatedItems.map((item) => (
              <div 
                key={item.id}
                onClick={() => onSelectItem(item)}
                className={cn(
                  "group relative flex flex-col rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden hover:-translate-y-1 hover:shadow-xl",
                  selectedIds.includes(item.id)
                    ? theme === 'dark' ? "bg-violet-500/10 border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.15)]" : "bg-violet-50 border-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                    : theme === 'dark' ? "bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700" : "bg-white border-zinc-200 hover:border-zinc-300"
                )}
              >
                {/* Selection Checkbox */}
                <div 
                  onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                  className={cn(
                    "absolute top-3 left-3 z-10 w-6 h-6 rounded-md border flex items-center justify-center transition-all duration-200 backdrop-blur-md",
                    selectedIds.includes(item.id)
                      ? "bg-violet-600 border-violet-600 shadow-[0_0_10px_rgba(139,92,246,0.5)] opacity-100"
                      : cn(
                          "opacity-0 group-hover:opacity-100",
                          theme === 'dark' ? "bg-zinc-900/80 border-zinc-600" : "bg-white/80 border-zinc-300"
                        )
                  )}
                >
                  {selectedIds.includes(item.id) && <Check className="text-white" size={14} strokeWidth={3} />}
                </div>

                {/* Actions Menu */}
                {!readOnly && (
                  <div className="absolute top-3 right-3 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(item);
                      }}
                      className={cn(
                        "p-2 rounded-xl backdrop-blur-md transition-all shadow-lg",
                        theme === 'dark' ? "bg-zinc-900/90 text-violet-400 hover:bg-violet-500 hover:text-white" : "bg-white/90 text-violet-600 hover:bg-violet-600 hover:text-white"
                      )}
                      title="Editar item"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemToDelete(item.id);
                        setIsDeleteConfirmOpen(true);
                      }}
                      className={cn(
                        "p-2 rounded-xl backdrop-blur-md transition-all shadow-lg",
                        theme === 'dark' ? "bg-zinc-900/90 text-rose-400 hover:bg-rose-500 hover:text-white" : "bg-white/90 text-rose-600 hover:bg-rose-600 hover:text-white"
                      )}
                      title="Excluir item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}

                {/* Image Section - Hidden on Mobile for sleek list view */}
                <div className={cn(
                  "hidden sm:block relative aspect-video w-full overflow-hidden border-b",
                  theme === 'dark' ? "border-zinc-800/50 bg-zinc-950" : "border-zinc-100 bg-zinc-50"
                )}>
                  {item.imagem ? (
                    <>
                      <img 
                        loading="lazy"
                        src={item.imagem} 
                        alt={item.nome} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-900 -z-10">
                        <Package size={32} className="text-zinc-400 opacity-20" />
                        <span className="text-[8px] uppercase font-bold tracking-widest mt-2 text-zinc-500 opacity-40">Sem Imagem</span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-20">
                      <Package size={48} />
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shadow-md backdrop-blur-md",
                      item.estoque > 0 
                        ? "bg-emerald-500/90 text-white" 
                        : "bg-rose-500/90 text-white"
                    )}>
                      {item.estoque > 0 ? `${item.estoque} UN` : 'ESGOTADO'}
                    </span>
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-3 md:p-4 flex flex-col flex-1">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h4 className={cn(
                      "font-bold text-sm md:text-base leading-tight line-clamp-2",
                      theme === 'dark' ? "text-zinc-100" : "text-zinc-900"
                    )}>
                      {item.nome}
                    </h4>
                    {/* Mobile only value display */}
                    <span className="sm:hidden font-black text-emerald-500 text-sm whitespace-nowrap drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">
                      {formatCurrency(item.valor)}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                      theme === 'dark' ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-violet-50 text-violet-600 border-violet-100"
                    )}>
                      {item.categoria}
                    </span>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                      theme === 'dark' ? "bg-zinc-800 text-zinc-400 border-zinc-700" : "bg-zinc-100 text-zinc-500 border-zinc-200"
                    )}>
                      {item.moto}
                    </span>
                    {/* Mobile only stock badge */}
                    <span className={cn(
                      "sm:hidden px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                      item.estoque > 0 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    )}>
                      {item.estoque > 0 ? `${item.estoque} UN` : 'ESGOTADO'}
                    </span>
                  </div>

                  <div className="hidden sm:flex mt-auto pt-3 border-t border-zinc-800/20 items-center justify-between">
                    <span className="font-black text-emerald-500 text-sm">
                      {formatCurrency(item.valor)}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {item.rk_id}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        <div className={cn(
          "p-4 border-t flex flex-wrap items-center justify-between gap-4 transition-colors",
          theme === 'dark' ? "bg-zinc-900/30 border-zinc-800" : "bg-zinc-50 border-zinc-200"
        )}>
          <div className="text-sm text-zinc-500">
            Mostrando <span className={cn("font-medium transition-colors", theme === 'dark' ? "text-zinc-300" : "text-zinc-900")}>{(currentPage - 1) * itemsPerPage + 1}</span>-
            <span className={cn("font-medium transition-colors", theme === 'dark' ? "text-zinc-300" : "text-zinc-900")}>{Math.min(currentPage * itemsPerPage, filteredAndSortedItems.length)}</span> de 
            <span className={cn("font-medium transition-colors", theme === 'dark' ? "text-zinc-300" : "text-zinc-900")}> {filteredAndSortedItems.length}</span> itens
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={cn(
                "px-3 py-1.5 border rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-medium",
                theme === 'dark' 
                  ? "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800" 
                  : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              )}
            >
              Anterior
            </button>
            <span className={cn(
              "px-3 py-1.5 text-sm font-medium",
              theme === 'dark' ? "text-zinc-400" : "text-zinc-600"
            )}>
              Página {currentPage} de {totalPages}
            </span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className={cn(
                "px-3 py-1.5 border rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-medium",
                theme === 'dark' 
                  ? "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800" 
                  : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              )}
            >
              Próximo
            </button>
          </div>

          <CustomDropdown
            theme={theme}
            value={itemsPerPage.toString()}
            onChange={(val) => {
              setItemsPerPage(Number(val));
              setCurrentPage(1);
            }}
            options={[
              { value: '25', label: '25 por página' },
              { value: '50', label: '50 por página' },
              { value: '100', label: '100 por página' },
            ]}
            className="w-40"
          />
        </div>

        {filteredAndSortedItems.length === 0 && (
          <div className={cn(
            "p-12 text-center transition-colors",
            theme === 'dark' ? "text-zinc-500" : "text-zinc-400"
          )}>
            Nenhum item corresponde aos filtros aplicados.
          </div>
        )}
      </div>

      {/* New Item Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={cn(
                "relative w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden rounded-2xl shadow-2xl transition-colors",
                theme === 'dark' ? "bg-zinc-900 text-white" : "bg-white text-zinc-900"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={cn(
                "flex items-center justify-between p-4 border-b",
                theme === 'dark' ? "border-zinc-800" : "border-zinc-200"
              )}>
                <h2 className="text-xl font-semibold">
                  {editingItem ? 'Editar Item' : '+ Novo Item no Estoque'}
                </h2>
                <button
                  onClick={() => { setIsModalOpen(false); setEditingItem(null); }}
                  className={cn(
                    "p-1 rounded-full transition-colors",
                    theme === 'dark' ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-zinc-200 text-zinc-500"
                  )}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">URL da Imagem</label>
                    <input 
                      type="url"
                      value={formData.imagem}
                      onChange={(e) => setFormData({...formData, imagem: e.target.value})}
                      placeholder="https://..."
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Nome da Peça *</label>
                    <input 
                      required
                      type="text"
                      value={formData.nome}
                      onChange={(e) => {
                        const novoNome = e.target.value;
                        setFormData(prev => {
                          const novoEstado = {...prev, nome: novoNome};
                          if (novoNome.length < 3) {
                            novoEstado.moto = '';
                            novoEstado.categoria = '';
                          } else {
                            const modelo = extrairModeloMoto(novoNome);
                            if (modelo) novoEstado.moto = modelo;
                            
                            const categoria = extrairCategoria(novoNome);
                            if (categoria) novoEstado.categoria = categoria;
                          }
                          return novoEstado;
                        });
                      }}
                      placeholder="Ex: Relé de Partida"
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Categoria</label>
                    <CustomDropdown
                      theme={theme}
                      variant="form"
                      value={formData.categoria}
                      onChange={(val) => setFormData({...formData, categoria: val})}
                      options={[
                        { value: '', label: 'Selecione...' },
                        ...CATEGORIAS_OFICIAIS.map(cat => ({ value: cat, label: cat })),
                        { value: 'nova', label: '+ Nova Categoria' }
                      ]}
                    />
                    {formData.categoria === 'nova' && (
                      <input 
                        type="text"
                        value={formData.novaCategoria}
                        onChange={(e) => setFormData({...formData, novaCategoria: e.target.value})}
                        placeholder="Nome da nova categoria"
                        className={cn(
                          "w-full mt-2 border rounded-xl py-2 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                          theme === 'dark' ? "bg-zinc-950 border-violet-500/50 text-zinc-200" : "bg-white border-violet-500/50 text-zinc-900"
                        )}
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Moto</label>
                    <CustomDropdown
                      theme={theme}
                      variant="form"
                      value={formData.moto}
                      onChange={(val) => setFormData({...formData, moto: val})}
                      options={[
                        { value: '', label: 'Selecione...' },
                        ...MOTOS_OFICIAIS.map(moto => ({ value: moto, label: moto })),
                        { value: 'outra', label: '+ Outra' }
                      ]}
                    />
                    {formData.moto === 'outra' && (
                      <input 
                        type="text"
                        value={formData.outraMoto}
                        onChange={(e) => setFormData({...formData, outraMoto: e.target.value})}
                        placeholder="Modelo da moto"
                        className={cn(
                          "w-full mt-2 border rounded-xl py-2 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                          theme === 'dark' ? "bg-zinc-950 border-violet-500/50 text-zinc-200" : "bg-white border-violet-500/50 text-zinc-900"
                        )}
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Ano</label>
                    <input 
                      type="text"
                      value={formData.ano}
                      onChange={(e) => setFormData({...formData, ano: e.target.value})}
                      placeholder="Ex: 2014-2018"
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Valor (R$)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={formData.valor}
                      onChange={(e) => setFormData({...formData, valor: e.target.value})}
                      placeholder="0,00"
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Estoque</label>
                    <input 
                      type="number"
                      value={formData.estoque}
                      onChange={(e) => setFormData({...formData, estoque: e.target.value})}
                      placeholder="1"
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Link Mercado Livre</label>
                  <input 
                    type="url"
                    value={formData.ml_link}
                    onChange={(e) => setFormData({...formData, ml_link: e.target.value})}
                    placeholder="https://produto.mercadolivre.com.br/..."
                    className={cn(
                      "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                    )}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Descrição / Observações</label>
                  <textarea 
                    rows={3}
                    value={formData.descricao}
                    onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                    placeholder="Detalhes adicionais da peça..."
                    className={cn(
                      "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                    )}
                  />
                </div>

                <div className="pt-4 flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className={cn(
                      "flex-1 px-6 py-3 rounded-xl font-medium transition-all active:scale-95",
                      theme === 'dark' ? "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-100 border border-zinc-200 text-zinc-600 hover:bg-zinc-200"
                    )}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className={cn(
                      "flex-1 px-8 py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
                      theme === 'dark'
                        ? "bg-violet-600 border border-violet-500 text-white shadow-lg shadow-violet-900/20 hover:bg-violet-500"
                        : "bg-violet-600 border border-violet-500 text-white shadow-lg shadow-violet-200/50 hover:bg-violet-700"
                    )}
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Salvar no Notion
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Exclusão Individual */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-md p-6 rounded-2xl border shadow-2xl",
                theme === 'dark' ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.2)] text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <div className="flex items-center gap-4 text-rose-500 mb-4">
                <div className="p-3 bg-rose-500/10 rounded-full">
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-xl font-bold">Excluir Item?</h3>
              </div>
              <p className={cn("mb-6", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
                Tem certeza que deseja excluir este item do estoque? Esta ação não pode ser desfeita no Notion.
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className={cn(
                    "px-6 py-3 rounded-xl font-medium transition-all active:scale-95",
                    theme === 'dark' ? "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-100 border border-zinc-200 text-zinc-600 hover:bg-zinc-200"
                  )}
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleDelete(itemToDelete!)}
                  className={cn(
                    "px-8 py-3 rounded-xl font-bold transition-all active:scale-95",
                    theme === 'dark'
                      ? "bg-rose-600 border border-rose-500 text-white shadow-lg shadow-rose-900/20 hover:bg-rose-500"
                      : "bg-rose-600 border border-rose-500 text-white shadow-lg shadow-rose-200/50 hover:bg-rose-700"
                  )}
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Exclusão em Massa */}
      <AnimatePresence>
        {isBulkDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-md p-6 rounded-2xl border shadow-2xl",
                theme === 'dark' ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.2)] text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <div className="flex items-center gap-4 text-rose-500 mb-4">
                <div className="p-3 bg-rose-500/10 rounded-full">
                  <Trash2 size={24} />
                </div>
                <h3 className="text-xl font-bold">Excluir {selectedIds.length} itens?</h3>
              </div>
              <p className={cn("mb-6", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
                Tem certeza que deseja excluir permanentemente os itens selecionados?
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setIsBulkDeleteConfirmOpen(false)}
                  className={cn(
                    "px-6 py-3 rounded-xl font-medium transition-all active:scale-95",
                    theme === 'dark' ? "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-100 border border-zinc-200 text-zinc-600 hover:bg-zinc-200"
                  )}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleBulkDelete}
                  className={cn(
                    "px-8 py-3 rounded-xl font-bold transition-all active:scale-95",
                    theme === 'dark'
                      ? "bg-rose-600 border border-rose-500 text-white shadow-lg shadow-rose-900/20 hover:bg-rose-500"
                      : "bg-rose-600 border border-rose-500 text-white shadow-lg shadow-rose-200/50 hover:bg-rose-700"
                  )}
                >
                  Excluir Tudo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Mudança de Categoria em Massa */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-md p-6 rounded-2xl border shadow-2xl",
                theme === 'dark' ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.2)] text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <div className="flex items-center gap-4 text-violet-500 mb-4">
                <div className="p-3 bg-violet-500/10 rounded-full">
                  <Layers size={24} />
                </div>
                <h3 className="text-xl font-bold">Mudar Categoria</h3>
              </div>
              <p className={cn("mb-4 text-sm", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
                Selecione ou digite a nova categoria para os {selectedIds.length} itens selecionados.
              </p>
              
              <div className="space-y-4 mb-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Nova Categoria</label>
                  <input 
                    type="text"
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value)}
                    placeholder="Ex: Motor, Carenagem..."
                    className={cn(
                      "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                    )}
                    autoFocus
                  />
                </div>
                
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setBulkCategory(cat)}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs transition-colors",
                          bulkCategory === cat 
                            ? "bg-violet-600 text-white" 
                            : theme === 'dark' ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => {
                    setIsCategoryModalOpen(false);
                    setBulkCategory('');
                  }}
                  className={cn(
                    "px-6 py-3 rounded-xl font-medium transition-all active:scale-95",
                    theme === 'dark' ? "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-100 border border-zinc-200 text-zinc-600 hover:bg-zinc-200"
                  )}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleBulkUpdateCategory}
                  disabled={!bulkCategory}
                  className={cn(
                    "px-8 py-3 rounded-xl font-bold transition-all active:scale-95",
                    theme === 'dark'
                      ? "bg-violet-600 border border-violet-500 text-white shadow-lg shadow-violet-900/20 hover:bg-violet-500"
                      : "bg-violet-600 border border-violet-500 text-white shadow-lg shadow-violet-200/50 hover:bg-violet-700"
                  )}
                >
                  Atualizar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});

const SalesRow = memo(({ 
  item, 
  theme, 
  selectedIds, 
  toggleSelect, 
  onSelectItem, 
  handleInlineEdit, 
  editingCell, 
  handleSaleInlineSave, 
  setEditingCell, 
  columns, 
  formatCurrency, 
  formatDate,
  handleEditSale,
  setItemToDelete,
  setIsDeleteConfirmOpen
}: any) => (
  <tr 
    key={item.id} 
    onClick={() => onSelectItem(item)}
    className={cn(
      "transition-all duration-200 group cursor-pointer transform-gpu",
      selectedIds.includes(item.id) 
        ? theme === 'dark' ? "bg-violet-500/10" : "bg-violet-50"
        : theme === 'dark' ? "hover:bg-zinc-800/20" : "hover:bg-zinc-50"
    )}
  >
    <td className="px-3 py-2">
      <div 
        className={cn(
          "w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-all",
          selectedIds.includes(item.id) 
            ? "bg-violet-600 border-violet-600 opacity-100" 
            : cn(
                "opacity-0 group-hover:opacity-100",
                theme === 'dark' ? "border-zinc-700" : "border-zinc-300"
              )
        )}
        onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
      >
        {selectedIds.includes(item.id) && <Check className="text-white" size={10} />}
      </div>
    </td>
    {columns.map((col: any) => (
      <td key={`${item.id}-${col.key}`} className={cn(
        "px-3 py-2 text-xs transition-colors",
        theme === 'dark' ? "text-zinc-400" : "text-zinc-600"
      )} onDoubleClick={() => handleInlineEdit(item.id, col.key)}>
        {editingCell?.itemId === item.id && editingCell?.field === col.key ? (
          <input 
            defaultValue={item[col.key]}
            onBlur={(e) => handleSaleInlineSave(item.id, col.key, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaleInlineSave(item.id, col.key, e.currentTarget.value);
              if (e.key === 'Escape') setEditingCell(null);
            }}
            autoFocus
            className="w-full bg-transparent border-b border-violet-500 outline-none"
          />
        ) : col.key === 'valor' ? (
          <span className="font-bold text-emerald-500">{formatCurrency(item[col.key])}</span>
        ) : col.key === 'data' ? (
          <span className="text-[10px] text-zinc-500">{formatDate(item[col.key])}</span>
        ) : col.key === 'tipo' ? (
          <span className={cn(
            "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
            theme === 'dark' ? "bg-violet-500/10 text-violet-400" : "bg-violet-50 text-violet-600"
          )}>
            {item[col.key]}
          </span>
        ) : col.key === 'actions' ? (
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleEditSale(item);
              }}
              className={cn(
                "p-2 rounded-lg transition-all",
                theme === 'dark' ? "bg-violet-500/10 text-violet-400 hover:bg-violet-500/20" : "text-zinc-400 hover:text-violet-600 hover:bg-violet-50"
              )}
              title="Editar venda"
            >
              <Edit2 size={16} />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setItemToDelete(item.id);
                setIsDeleteConfirmOpen(true);
              }}
              className={cn(
                "p-2 rounded-lg transition-all",
                theme === 'dark' ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "text-zinc-400 hover:text-red-600 hover:bg-red-50"
              )}
              title="Excluir venda"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <span className="truncate block max-w-[150px]">{item[col.key] || '-'}</span>
        )}
      </td>
    ))}
  </tr>
));

const SalesView = memo(({ theme, onSelectItem, onRegisterActions, isSearchOpen }: { theme: 'light' | 'dark', onSelectItem: (item: any) => void, onRegisterActions?: (actions: any) => void, isSearchOpen?: boolean }) => {
  const { sales: items, loading, refreshData, setSales } = useContext(DataContext);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(window.innerWidth < 768 ? 10 : 25);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{ itemId: string, field: string } | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editingSale, setEditingSale] = useState<any | null>(null);

  useEffect(() => {
    if (isModalOpen || isEditModalOpen || isDeleteConfirmOpen || isBulkDeleteConfirmOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen, isEditModalOpen, isDeleteConfirmOpen, isBulkDeleteConfirmOpen]);

  const [formData, setFormData] = useState({
    nome: '',
    moto: '',
    categoria: '',
    valor: '',
    tipo: 'Pix',
    data: new Date().toISOString().split('T')[0]
  });

  const [editFormData, setEditFormData] = useState({
    nome: '',
    moto: '',
    valor: '',
    tipo: 'Pix',
    data: ''
  });

  // Novos estados de filtro
  const [quickFilter, setQuickFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentType, setPaymentType] = useState('Todos');

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedItems.map(item => item.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const idsToRemove = [...selectedIds];
    setIsBulkDeleteConfirmOpen(false);
    
    // Optimistic update
    setSales(prev => prev.filter(item => !idsToRemove.includes(item.id)));
    setSelectedIds([]);

    try {
      const response = await fetchWithRetry('/api/sales/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToRemove })
      });
      
      if (!response.ok) throw new Error('Falha ao excluir vendas');
    } catch (err: any) {
      alert(err.message);
      // Rollback if needed (optional, but good practice)
      refreshData();
    }
  };

  const handleDeleteSale = async () => {
    if (!itemToDelete) return;
    const idToRemove = itemToDelete;
    setIsDeleteConfirmOpen(false);
    
    // Optimistic update
    setSales(prev => prev.filter(item => item.id !== idToRemove));
    setSelectedIds(prev => prev.filter(i => i !== idToRemove));
    setItemToDelete(null);

    try {
      const response = await fetchWithRetry(`/api/sales/${idToRemove}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Falha ao excluir venda');
    } catch (err: any) {
      alert(err.message);
      refreshData();
    }
  };

  const handleEditSale = (sale: any) => {
    setEditingSale(sale);
    setEditFormData({
      nome: sale.nome || '',
      moto: sale.moto || '',
      valor: sale.valor?.toString() || '',
      tipo: sale.tipo || 'Pix',
      data: sale.data ? new Date(sale.data).toISOString().split('T')[0] : ''
    });
    setIsEditModalOpen(true);
  };

  const handleInlineEdit = (itemId: string, field: string) => {
    setEditingCell({ itemId, field });
  };

  const handleSaleInlineSave = async (itemId: string, field: string, value: string) => {
    setEditingCell(null);
    
    const itemToUpdate = items.find(s => s.id === itemId);
    if (!itemToUpdate || itemToUpdate[field as keyof typeof itemToUpdate] === value) return;

    const updatedData = { [field]: field === 'valor' ? Number(value) : value };
    
    // Optimistic update
    setSales(prev => prev.map(item => item.id === itemId ? { ...item, ...updatedData } : item));

    try {
      const response = await fetchWithRetry(`/api/sales/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Falha ao atualizar venda');
      }
      // Refresh to ensure consistency
      refreshData();
    } catch (err: any) {
      alert(err.message);
      refreshData();
    }
  };

  const handleUpdateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale) return;
    const saleId = editingSale.id;
    const updatedData = { ...editFormData, id: saleId, valor: Number(editFormData.valor) };
    
    // Optimistic update
    setSales(prev => prev.map(item => item.id === saleId ? { ...item, ...updatedData } : item));
    setIsEditModalOpen(false);
    setEditingSale(null);

    try {
      const response = await fetchWithRetry(`/api/sales/${saleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      });
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Falha ao atualizar venda');
      }
      // Update with real data from server if needed
      setSales(prev => prev.map(item => item.id === saleId ? result.data : item));
    } catch (err: any) {
      alert(err.message);
      refreshData();
    }
  };

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetchWithRetry('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      if (result.success) {
        setSales(prev => [result.data, ...prev]);
        setIsModalOpen(false);
        setFormData({
          nome: '',
          moto: '',
          categoria: '',
          valor: '',
          tipo: 'Pix',
          data: new Date().toISOString().split('T')[0]
        });
      } else {
        throw new Error(result.error || 'Falha ao salvar venda');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({
        edit: handleEditSale,
        delete: (id: string) => {
          setItemToDelete(id);
          setIsDeleteConfirmOpen(true);
        },
        focusSearch: () => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
            searchInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    }
  }, [onRegisterActions]);

  const paymentTypes = useMemo(() => {
    const types = new Set(items.map(item => item.tipo).filter(Boolean));
    return ['Todos', ...Array.from(types)];
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = [...items];

    // Filtro de busca
    if (debouncedSearchTerm) {
      const searchTerms = debouncedSearchTerm.toLowerCase().split(' ').filter(t => t.length > 0);
      result = result.filter(item => 
        searchTerms.every(term => 
          (item.nome?.toLowerCase() || '').includes(term) ||
          (item.numero_id?.toLowerCase() || '').includes(term) ||
          (item.moto?.toLowerCase() || '').includes(term)
        )
      );
    }

    // Filtro de Tipo de Pagamento
    if (paymentType && paymentType !== 'Todos') {
      result = result.filter(item => item.tipo === paymentType);
    }

    // Filtro de Data
    let start: Date | null = null;
    let end: Date | null = null;

    if (quickFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      switch (quickFilter) {
        case 'today':
          start = today;
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
          break;
        case 'yesterday':
          start = new Date(today);
          start.setDate(today.getDate() - 1);
          end = new Date(start);
          end.setHours(23, 59, 59, 999);
          break;
        case 'this-week':
          start = new Date(today);
          start.setDate(today.getDate() - today.getDay());
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
          break;
        case 'this-month':
          start = new Date(today.getFullYear(), today.getMonth(), 1);
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
          break;
        case 'last-30-days':
          start = new Date(today);
          start.setDate(today.getDate() - 30);
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
          break;
      }
    } else if (startDate || endDate) {
      if (startDate) {
        const [y, m, d] = startDate.split('-').map(Number);
        start = new Date(y, m - 1, d);
        start.setHours(0, 0, 0, 0);
      }
      if (endDate) {
        const [y, m, d] = endDate.split('-').map(Number);
        end = new Date(y, m - 1, d);
        end.setHours(23, 59, 59, 999);
      }
    }

    if (start || end) {
      result = result.filter(item => {
        let itemDate = new Date(item.data);
        
        // Se a data for apenas YYYY-MM-DD, o JS interpreta como UTC.
        // Vamos ajustar para local para que os filtros de "Hoje" e "Ontem" funcionem.
        if (typeof item.data === 'string' && item.data.length === 10 && item.data.includes('-')) {
          const [y, m, d] = item.data.split('-').map(Number);
          itemDate = new Date(y, m - 1, d);
        }

        if (start && itemDate < start) return false;
        if (end && itemDate > end) return false;
        return true;
      });
    }

    return result;
  }, [items, debouncedSearchTerm, quickFilter, startDate, endDate, paymentType]);

  const totalValue = useMemo(() => {
    return filteredItems.reduce((acc, item) => acc + (item.valor || 0), 0);
  }, [filteredItems]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  const clearAllFilters = () => {
    setSearchTerm('');
    setQuickFilter('all');
    setStartDate('');
    setEndDate('');
    setPaymentType('Todos');
    setCurrentPage(1);
  };

  const formatCurrency = (value: any) => {
    const num = Number(value);
    if (isNaN(num)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading && items.length === 0) {
    // Não bloquear a tela
  }

  return (
    <div className="space-y-4">
      {/* Toolbar Profissional e Compacta */}
      <div className={cn(
        "relative z-50 p-3 md:p-4 rounded-3xl flex flex-col gap-3 transition-all duration-300 shadow-xl border",
        theme === 'dark' 
          ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800 shadow-black/40" 
          : "bg-white/90 backdrop-blur-xl border-zinc-100 shadow-zinc-200/40",
        isSearchOpen && "blur-md pointer-events-none opacity-50"
      )}>
        {/* Search Bar Compacta */}
        <div className="w-full relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-violet-500 transition-colors" size={18} />
          <input 
            ref={searchInputRef}
            type="text" 
            placeholder="Buscar por peça, moto ou ID..." 
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className={cn(
              "w-full rounded-xl py-2.5 pl-11 pr-4 text-sm font-medium outline-none transition-all duration-200 border shadow-inner",
              theme === 'dark' 
                ? "bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50" 
                : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:bg-white"
            )}
          />
        </div>

        {/* Filtros e Ações Compactos */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CustomDropdown
              theme={theme}
              icon={<Filter size={14} />}
              value={paymentType}
              className="flex-1 md:flex-none"
              onChange={(val) => {
                setPaymentType(val);
                setCurrentPage(1);
              }}
              options={paymentTypes.map(type => ({ value: type, label: type }))}
            />

            <button 
              onClick={handleManualRefresh}
              disabled={loading || isRefreshing}
              className={cn(
                "flex-1 md:flex-none flex items-center justify-center gap-2 h-10 px-4 rounded-xl transition-all duration-200 border text-[11px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md",
                theme === 'dark' 
                  ? "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700" 
                  : "bg-zinc-100 border-zinc-200 text-zinc-500 hover:bg-zinc-200"
              )}
            >
              <RefreshCw size={14} className={cn((loading || isRefreshing) && "animate-spin")} />
              <span className="hidden md:inline">Sincronizar</span>
            </button>

            <button 
              onClick={() => setIsModalOpen(true)}
              className={cn(
                "flex-1 md:flex-none flex items-center justify-center gap-2 h-10 px-4 rounded-xl transition-all duration-200 border text-[11px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md",
                theme === 'dark' 
                  ? "bg-violet-600 border-violet-500 text-white shadow-violet-900/20 hover:bg-violet-500" 
                  : "bg-violet-600 border-violet-500 text-white shadow-violet-200/50 hover:bg-violet-700"
              )}
            >
              <Plus size={16} />
              <span>Nova Venda</span>
            </button>

            {(searchTerm || paymentType !== 'Todos') && (
              <button 
                onClick={clearAllFilters}
                className={cn(
                  "flex-1 md:flex-none flex items-center justify-center gap-2 h-10 px-4 rounded-xl transition-all duration-200 border text-[11px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md",
                  theme === 'dark' 
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/20" 
                    : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                )}
              >
                <X size={16} />
                <span>Limpar</span>
              </button>
            )}
          </div>
        </div>
      </div>
        {/* Filtros Rápidos e Período */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-4 border-t border-zinc-800/30">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'Tudo' },
              { id: 'today', label: 'Hoje' },
              { id: 'yesterday', label: 'Ontem' },
              { id: 'this-week', label: 'Semana' },
              { id: 'this-month', label: 'Mês' },
              { id: 'last-30-days', label: '30 Dias' },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => {
                  setQuickFilter(filter.id);
                  setStartDate('');
                  setEndDate('');
                  setCurrentPage(1);
                }}
                className={cn(
                  "px-3 md:px-4 py-1.5 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all border",
                  quickFilter === filter.id
                    ? "bg-violet-600 border-violet-500 text-white shadow-[0_8px_20px_rgba(139,92,246,0.3)]"
                    : theme === 'dark'
                      ? "bg-zinc-950 border-zinc-800/50 text-zinc-500 hover:border-zinc-700 hover:text-zinc-200"
                      : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="w-full sm:w-auto flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-1.5">
              <Calendar size={14} className="text-zinc-500" />
              <input 
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setQuickFilter('all');
                  setCurrentPage(1);
                }}
                className={cn(
                  "bg-transparent text-xs outline-none w-full",
                  theme === 'dark' ? "text-zinc-200" : "text-zinc-900"
                )}
              />
              <span className="text-zinc-500 text-xs">até</span>
              <input 
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setQuickFilter('all');
                  setCurrentPage(1);
                }}
                className={cn(
                  "bg-transparent text-xs outline-none w-full",
                  theme === 'dark' ? "text-zinc-200" : "text-zinc-900"
                )}
              />
            </div>

            <button 
              onClick={clearAllFilters}
              className={cn(
                "w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border",
                theme === 'dark'
                  ? "bg-zinc-950 border-zinc-800/50 text-zinc-500 hover:text-zinc-200"
                  : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-zinc-900"
              )}
            >
              Limpar
            </button>
          </div>
        </div>

      {/* Tabela / Cards */}
      <div className="space-y-4">
        {/* Desktop Table */}
        <div className={cn(
          "hidden md:block border rounded-2xl overflow-hidden relative transition-all duration-300",
          theme === 'dark' 
            ? "bg-zinc-900/40 border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)]" 
            : "bg-white border-zinc-200 shadow-sm"
        )}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
                <tr className={cn(
                  "transition-colors",
                  theme === 'dark' ? "bg-zinc-800/30" : "bg-zinc-50"
                )}>
                  <th className="px-6 py-4 w-10">
                    <div 
                      onClick={toggleSelectAll}
                      className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-all duration-200",
                        selectedIds.length === paginatedItems.length && paginatedItems.length > 0
                          ? "bg-violet-600 border-violet-600 shadow-[0_0_8px_rgba(139,92,246,0.3)]" 
                          : theme === 'dark' ? "border-zinc-700" : "border-zinc-300"
                      )}
                    >
                      {selectedIds.length === paginatedItems.length && paginatedItems.length > 0 && <Check className="text-white" size={14} />}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Peça</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Moto</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500 text-emerald-500">Valor</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tipo</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Data</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">ID</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500 text-right">Ações</th>
                </tr>
            </thead>
            <tbody className={cn(
              "divide-y transition-colors",
              theme === 'dark' ? "divide-zinc-800/30" : "divide-zinc-100"
            )}>
              {loading && items.length === 0 ? (
                Array(5).fill(0).map((_, i) => <SkeletonRow key={i} theme={theme} />)
              ) : paginatedItems.map((item) => (
                <tr 
                  key={item.id} 
                  onClick={() => onSelectItem(item)}
                  className={cn(
                    "transition-all duration-200 group cursor-pointer",
                    selectedIds.includes(item.id) 
                      ? theme === 'dark' ? "bg-violet-500/10" : "bg-violet-50"
                      : theme === 'dark' ? "hover:bg-zinc-800/20" : "hover:bg-zinc-50"
                  )}
                >
                  <td className="px-6 py-4">
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(item.id);
                      }}
                      className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-all duration-200",
                        selectedIds.includes(item.id)
                          ? "bg-violet-600 border-violet-600 shadow-[0_0_8px_rgba(139,92,246,0.3)]" 
                          : theme === 'dark' ? "border-zinc-700" : "border-zinc-300"
                      )}
                    >
                      {selectedIds.includes(item.id) && <Check className="text-white" size={14} />}
                    </div>
                  </td>
                  <td className="px-6 py-4" onDoubleClick={() => handleInlineEdit(item.id, 'nome')}>
                    <div className="flex items-center gap-3">
                      {item.imagem && (
                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-zinc-800/50">
                          <img loading="lazy" src={item.imagem} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}
                      {editingCell?.itemId === item.id && editingCell?.field === 'nome' ? (
                        <input 
                          defaultValue={item.nome}
                          onBlur={(e) => handleSaleInlineSave(item.id, 'nome', e.target.value)}
                          autoFocus
                          className="w-full bg-transparent border-b border-violet-500 outline-none"
                        />
                      ) : (
                        <span className={cn("text-sm font-bold tracking-tight", theme === 'dark' ? "text-white" : "text-zinc-900")}>
                          {item.nome ? item.nome.charAt(0).toUpperCase() + item.nome.slice(1) : ''}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-zinc-500" onDoubleClick={() => handleInlineEdit(item.id, 'moto')}>
                    {editingCell?.itemId === item.id && editingCell?.field === 'moto' ? (
                      <input 
                        defaultValue={item.moto}
                        onBlur={(e) => handleSaleInlineSave(item.id, 'moto', e.target.value)}
                        autoFocus
                        className="w-full bg-transparent border-b border-violet-500 outline-none"
                      />
                    ) : (
                      <span className="uppercase font-bold text-[10px] tracking-wider">{item.moto}</span>
                    )}
                  </td>
                  <td className="px-6 py-4" onDoubleClick={() => handleInlineEdit(item.id, 'valor')}>
                    {editingCell?.itemId === item.id && editingCell?.field === 'valor' ? (
                      <input 
                        defaultValue={item.valor}
                        onBlur={(e) => handleSaleInlineSave(item.id, 'valor', e.target.value)}
                        autoFocus
                        className="w-full bg-transparent border-b border-violet-500 outline-none"
                      />
                    ) : (
                      <span className={cn(
                        "text-sm font-black font-sans transition-all duration-300",
                        (item.tipo?.toUpperCase() === 'SAÍDA')
                          ? "text-rose-500 [text-shadow:0_0_10px_rgba(244,63,94,0.5)]"
                          : "text-emerald-500 [text-shadow:0_0_10px_rgba(16,185,129,0.5)]"
                      )}>
                        {item.tipo?.toUpperCase() === 'SAÍDA' ? '-' : ''}{formatCurrency(Math.abs(item.valor))}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {item.tipo && (
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm transition-colors",
                        item.tipo.toUpperCase() === 'PIX' ? (theme === 'dark' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-600 border-emerald-200") :
                        item.tipo.toUpperCase() === 'SAÍDA' ? (theme === 'dark' ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-rose-50 text-rose-600 border-rose-200") :
                        item.tipo.toUpperCase() === 'DINHEIRO' ? (theme === 'dark' ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-green-50 text-green-600 border-green-200") :
                        item.tipo.toUpperCase() === 'CRÉDITO' ? (theme === 'dark' ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : "bg-orange-50 text-orange-600 border-orange-200") :
                        item.tipo.toUpperCase() === 'DÉBITO' ? (theme === 'dark' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-blue-50 text-blue-600 border-blue-200") :
                        item.tipo.toUpperCase() === 'MARCELO' ? (theme === 'dark' ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-violet-50 text-violet-600 border-violet-200") :
                        item.tipo.toUpperCase().includes('MERCADO LIVRE') ? (theme === 'dark' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-amber-50 text-amber-600 border-amber-200") :
                        (theme === 'dark' ? "bg-zinc-800 text-zinc-300 border-zinc-700" : "bg-zinc-100 text-zinc-600 border-zinc-200")
                      )}>
                        {item.tipo}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm transition-colors font-mono",
                      theme === 'dark' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-blue-50 text-blue-600 border-blue-200"
                    )}>
                      {formatDate(item.data)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-zinc-600">{item.numero_id}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditSale(item);
                        }}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          theme === 'dark' ? "bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-700" : "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
                        )}
                        title="Editar"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemToDelete(item.id);
                          setIsDeleteConfirmOpen(true);
                        }}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          theme === 'dark' ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20" : "text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                        )}
                        title="Excluir"
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

        {/* Mobile Cards */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {loading && items.length === 0 ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className={cn(
                "p-4 rounded-2xl border animate-pulse",
                theme === 'dark' ? "bg-zinc-900/40 border-zinc-800/50" : "bg-white border-zinc-200"
              )}>
                <div className="flex justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-800" />
                    <div className="space-y-2">
                      <div className="w-24 h-4 bg-zinc-800 rounded" />
                      <div className="w-16 h-3 bg-zinc-800 rounded" />
                    </div>
                  </div>
                  <div className="w-20 h-6 bg-zinc-800 rounded" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-8 bg-zinc-800 rounded" />
                  <div className="h-8 bg-zinc-800 rounded" />
                </div>
              </div>
            ))
          ) : paginatedItems.map((item) => (
            <div 
              key={item.id}
              onClick={() => onSelectItem(item)}
              className={cn(
                "p-4 rounded-2xl border transition-all active:scale-[0.98]",
                theme === 'dark' 
                  ? "bg-zinc-900/40 border-zinc-800/50" 
                  : "bg-white border-zinc-200 shadow-sm"
              )}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  {item.imagem && (
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-zinc-800/50">
                      <img loading="lazy" src={item.imagem} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className={cn("font-bold text-base", theme === 'dark' ? "text-zinc-200" : "text-zinc-900")}>
                      {item.nome ? item.nome.charAt(0).toUpperCase() + item.nome.slice(1) : ''}
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border",
                        theme === 'dark' ? "bg-zinc-800 text-zinc-400 border-zinc-700" : "bg-zinc-100 text-zinc-500 border-zinc-200"
                      )}>
                        {item.numero_id}
                      </span>
                      {item.moto && (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border",
                          theme === 'dark' ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-violet-50 text-violet-600 border-violet-200"
                        )}>
                          {item.moto.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className={cn(
                  "text-lg font-black font-sans transition-all duration-300",
                  (item.tipo?.toUpperCase() === 'SAÍDA')
                    ? "text-rose-500 [text-shadow:0_0_10px_rgba(244,63,94,0.5)]"
                    : "text-emerald-500 [text-shadow:0_0_10px_rgba(16,185,129,0.5)]"
                )}>
                  {item.tipo?.toUpperCase() === 'SAÍDA' ? '-' : ''}{formatCurrency(Math.abs(item.valor))}
                </span>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {item.tipo && (
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm flex items-center gap-1.5",
                    item.tipo.toUpperCase() === 'PIX' ? (theme === 'dark' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-600 border-emerald-200") :
                    item.tipo.toUpperCase() === 'SAÍDA' ? (theme === 'dark' ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-rose-50 text-rose-600 border-rose-200") :
                    item.tipo.toUpperCase() === 'DINHEIRO' ? (theme === 'dark' ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-green-50 text-green-600 border-green-200") :
                    item.tipo.toUpperCase() === 'CRÉDITO' ? (theme === 'dark' ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : "bg-orange-50 text-orange-600 border-orange-200") :
                    item.tipo.toUpperCase() === 'DÉBITO' ? (theme === 'dark' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-blue-50 text-blue-600 border-blue-200") :
                    item.tipo.toUpperCase() === 'MARCELO' ? (theme === 'dark' ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-violet-50 text-violet-600 border-violet-200") :
                    item.tipo.toUpperCase().includes('MERCADO LIVRE') ? (theme === 'dark' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-amber-50 text-amber-600 border-amber-200") :
                    (theme === 'dark' ? "bg-zinc-800 text-zinc-300 border-zinc-700" : "bg-zinc-100 text-zinc-600 border-zinc-200")
                  )}>
                    {item.tipo}
                  </div>
                )}
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm flex items-center gap-1.5",
                  theme === 'dark' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-blue-50 text-blue-600 border-blue-200"
                )}>
                  <Calendar size={10} />
                  {formatDate(item.data)}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/30">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditSale(item);
                  }}
                  className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl flex items-center justify-center gap-2 text-xs font-bold"
                >
                  <Edit size={14} />
                  Editar
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setItemToDelete(item.id);
                    setIsDeleteConfirmOpen(true);
                  }}
                  className="flex-1 py-2 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center gap-2 text-xs font-bold"
                >
                  <Trash2 size={14} />
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      <div className={cn(
        "p-4 border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors",
        theme === 'dark' ? "bg-zinc-900/30 border-zinc-800/50" : "bg-zinc-50 border-zinc-200"
      )}>
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total: {filteredItems.length} vendas</span>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={cn(
              "p-2 border rounded-xl disabled:opacity-30 transition-all",
              theme === 'dark' ? "border-zinc-800 hover:bg-zinc-800" : "border-zinc-200 hover:bg-zinc-100"
            )}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs font-bold text-zinc-400">Página {currentPage} de {totalPages}</span>
          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className={cn(
              "p-2 border rounded-xl disabled:opacity-30 transition-all",
              theme === 'dark' ? "border-zinc-800 hover:bg-zinc-800" : "border-zinc-200 hover:bg-zinc-100"
            )}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Modal Nova Venda */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-lg p-8 rounded-3xl border shadow-2xl relative",
                theme === 'dark' ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.2)] text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-zinc-800 rounded-full transition-colors"
              >
                <X size={20} className="text-zinc-500" />
              </button>

              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-violet-600/10 rounded-2xl">
                  <ShoppingCart className="text-violet-500" size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Registrar Venda</h2>
                  <p className="text-sm text-zinc-500">Adicione os detalhes da nova transação</p>
                </div>
              </div>

              <form onSubmit={handleSaveSale} className="space-y-5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Nova Movimentação</label>
                  <input 
                    required
                    type="text" 
                    value={formData.nome}
                    onChange={(e) => {
                      const novoNome = e.target.value;
                      setFormData(prev => {
                        const novoEstado = {...prev, nome: novoNome};
                        // Lógica de extração automática
                        if (novoNome.length < 3) {
                          novoEstado.moto = '';
                          novoEstado.categoria = '';
                        } else {
                          const modelo = extrairModeloMoto(novoNome);
                          if (modelo) {
                            novoEstado.moto = modelo;
                          }
                          const categoria = extrairCategoria(novoNome);
                          if (categoria) {
                            novoEstado.categoria = categoria;
                          }
                        }
                        return novoEstado;
                      });
                    }}
                    placeholder="Ex: Motor Honda CB 300"
                    className={cn(
                      "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Moto</label>
                    <input 
                      type="text"
                      value={formData.moto}
                      onChange={(e) => setFormData({...formData, moto: e.target.value})}
                      placeholder="Ex: CB 300"
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Valor (R$)</label>
                    <input 
                      required
                      type="number"
                      step="0.01"
                      value={formData.valor}
                      onChange={(e) => setFormData({...formData, valor: e.target.value})}
                      placeholder="R$ 0,00"
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Pagamento</label>
                    <CustomDropdown
                      theme={theme}
                      variant="form"
                      value={formData.tipo}
                      onChange={(val) => setFormData({...formData, tipo: val})}
                      options={[
                        { value: '', label: 'Selecione...' },
                        ...PAGAMENTOS_OFICIAIS.map(p => ({ value: p, label: p })),
                        { value: 'VENDA MERCADO LIVRE', label: 'VENDA MERCADO LIVRE' },
                        { value: 'SAÍDA', label: 'SAÍDA' },
                      ]}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Data</label>
                    <input 
                      type="date"
                      value={formData.data}
                      onChange={(e) => setFormData({...formData, data: e.target.value})}
                      className={cn(
                      "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                    )}
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={cn(
                    "px-6 py-3 rounded-xl font-medium transition-all active:scale-95",
                    theme === 'dark' ? "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-100 border border-zinc-200 text-zinc-600 hover:bg-zinc-200"
                  )}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className={cn(
                    "px-8 py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center gap-2",
                    theme === 'dark'
                      ? "bg-violet-600 border border-violet-500 text-white shadow-lg shadow-violet-900/20 hover:bg-violet-500"
                      : "bg-violet-600 border border-violet-500 text-white shadow-lg shadow-violet-200/50 hover:bg-violet-700"
                  )}
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Registrar Venda
                </button>
              </div>
            </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Editar Venda */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-lg p-8 rounded-3xl border shadow-2xl relative",
                theme === 'dark' ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.2)] text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-zinc-800 rounded-full transition-colors"
              >
                <X size={20} className="text-zinc-500" />
              </button>

              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-violet-600/10 rounded-2xl">
                  <Edit className="text-violet-500" size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Editar Venda</h2>
                  <p className="text-sm text-zinc-500">Atualize os detalhes da transação</p>
                </div>
              </div>

              <form onSubmit={handleUpdateSale} className="space-y-5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Peça Vendida</label>
                  <input 
                    required
                    type="text" 
                    value={editFormData.nome}
                    onChange={(e) => setEditFormData({...editFormData, nome: e.target.value})}
                    placeholder="Ex: Motor Honda CB 300"
                    className={cn(
                      "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Moto</label>
                    <input 
                      type="text"
                      value={editFormData.moto}
                      onChange={(e) => setEditFormData({...editFormData, moto: e.target.value})}
                      placeholder="Ex: CB 300"
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Valor (R$)</label>
                    <input 
                      required
                      type="number"
                      step="0.01"
                      value={editFormData.valor}
                      onChange={(e) => setEditFormData({...editFormData, valor: e.target.value})}
                      placeholder="0,00"
                      className={cn(
                        "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Pagamento</label>
                    <CustomDropdown
                      theme={theme}
                      variant="form"
                      value={editFormData.tipo}
                      onChange={(val) => setEditFormData({...editFormData, tipo: val})}
                      options={[
                        { value: '', label: 'Selecione...' },
                        ...PAGAMENTOS_OFICIAIS.map(p => ({ value: p, label: p })),
                        { value: 'VENDA MERCADO LIVRE', label: 'VENDA MERCADO LIVRE' },
                        { value: 'SAÍDA', label: 'SAÍDA' },
                      ]}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Data</label>
                    <input 
                      type="date"
                      value={editFormData.data}
                      onChange={(e) => setEditFormData({...editFormData, data: e.target.value})}
                      className={cn(
                      "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-900"
                    )}
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className={cn(
                    "flex-1 px-6 py-3 rounded-xl font-medium transition-all active:scale-95",
                    theme === 'dark' ? "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-100 border border-zinc-200 text-zinc-600 hover:bg-zinc-200"
                  )}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className={cn(
                    "flex-1 px-8 py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2",
                    theme === 'dark'
                      ? "bg-violet-600 border border-violet-500 text-white shadow-lg shadow-violet-900/20 hover:bg-violet-500"
                      : "bg-violet-600 border border-violet-500 text-white shadow-lg shadow-violet-200/50 hover:bg-violet-700"
                  )}
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Salvar Alterações
                </button>
              </div>
            </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Confirmação Exclusão Individual */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-md p-8 rounded-3xl border shadow-2xl text-center",
                theme === 'dark' ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.2)] text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Excluir Venda?</h3>
              <p className="text-zinc-500 text-sm mb-8">
                Esta ação não pode ser desfeita. A venda será removida permanentemente do Notion.
              </p>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-xl font-medium transition-all active:scale-95",
                    theme === 'dark' ? "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-100 border border-zinc-200 text-zinc-600 hover:bg-zinc-200"
                  )}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDeleteSale}
                  disabled={isActionLoading}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2",
                    theme === 'dark'
                      ? "bg-rose-600 border border-rose-500 text-white shadow-lg shadow-rose-900/20 hover:bg-rose-500"
                      : "bg-rose-600 border border-rose-500 text-white shadow-lg shadow-rose-200/50 hover:bg-rose-700"
                  )}
                >
                  {isActionLoading ? <Loader2 className="animate-spin" size={18} /> : "Excluir"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Confirmação Exclusão em Massa */}
      <AnimatePresence>
        {isBulkDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-md p-8 rounded-3xl border shadow-2xl text-center",
                theme === 'dark' ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.2)] text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Excluir {selectedIds.length} Vendas?</h3>
              <p className="text-zinc-500 text-sm mb-8">
                Esta ação removerá permanentemente todas as vendas selecionadas do Notion.
              </p>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsBulkDeleteConfirmOpen(false)}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-xl font-medium transition-all active:scale-95",
                    theme === 'dark' ? "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-100 border border-zinc-200 text-zinc-600 hover:bg-zinc-200"
                  )}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleBulkDelete}
                  disabled={isActionLoading}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2",
                    theme === 'dark'
                      ? "bg-rose-600 border border-rose-500 text-white shadow-lg shadow-rose-900/20 hover:bg-rose-500"
                      : "bg-rose-600 border border-rose-500 text-white shadow-lg shadow-rose-200/50 hover:bg-rose-700"
                  )}
                >
                  {isActionLoading ? <Loader2 className="animate-spin" size={18} /> : "Excluir Todas"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border transition-colors backdrop-blur-xl",
              theme === 'dark' ? "bg-zinc-900/90 border-zinc-800 text-white" : "bg-white/90 border-zinc-200 text-zinc-900"
            )}
          >
            <span className="text-sm font-medium mr-4">
              {selectedIds.length} venda(s) selecionada(s)
            </span>
            
            <div className={cn("flex items-center gap-2 border-l pl-4", theme === 'dark' ? "border-zinc-800" : "border-zinc-200")}>
              <button 
                onClick={() => setIsBulkDeleteConfirmOpen(true)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95",
                  theme === 'dark'
                    ? "bg-rose-600/10 text-rose-500 hover:bg-rose-600 hover:text-white"
                    : "bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white"
                )}
              >
                <Trash2 size={16} />
                Excluir Selecionadas
              </button>
              <button 
                onClick={() => setSelectedIds([])}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors rounded-lg active:scale-95",
                  theme === 'dark' ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                )}
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// =============================================================================
// MOTOS VIEW COMPONENT
// =============================================================================

const MotoRow = memo(({ 
  item, 
  theme, 
  selectedIds, 
  toggleSelect, 
  onSelectItem, 
  readOnly, 
  handleMotoInlineEdit, 
  editingCell, 
  handleMotoInlineSave, 
  setEditingCell, 
  columns, 
  formatCurrency, 
  formatDate,
  handleEditMoto,
  setItemToDelete,
  setIsDeleteConfirmOpen
}: any) => (
  <tr 
    key={item.id} 
    onClick={() => onSelectItem(item)}
    className={cn(
      "transition-all duration-200 group cursor-pointer transform-gpu",
      selectedIds.includes(item.id) 
        ? theme === 'dark' ? "bg-violet-500/10" : "bg-violet-50"
        : theme === 'dark' ? "hover:bg-zinc-800/20" : "hover:bg-zinc-50"
    )}
  >
    <td className="px-3 py-2">
      <div 
        className={cn(
          "w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-all",
          selectedIds.includes(item.id) 
            ? "bg-violet-600 border-violet-600 opacity-100" 
            : cn(
                "opacity-0 group-hover:opacity-100",
                theme === 'dark' ? "border-zinc-700" : "border-zinc-300"
              )
        )}
        onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
      >
        {selectedIds.includes(item.id) && <Check className="text-white" size={10} />}
      </div>
    </td>
    {columns.map((col: any) => (
      <td key={`${item.id}-${col.key}`} className={cn(
        "px-3 py-2 text-xs transition-colors",
        theme === 'dark' ? "text-zinc-400" : "text-zinc-600"
      )} onDoubleClick={() => !readOnly && handleMotoInlineEdit(item.id, col.key)}>
        {editingCell?.itemId === item.id && editingCell?.field === col.key ? (
          <input 
            defaultValue={item[col.key]}
            onBlur={(e) => handleMotoInlineSave(item.id, col.key, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleMotoInlineSave(item.id, col.key, e.currentTarget.value);
              if (e.key === 'Escape') setEditingCell(null);
            }}
            autoFocus
            className="w-full bg-transparent border-b border-violet-500 outline-none"
          />
        ) : col.key === 'valor' ? (
          <span className="font-bold text-emerald-500">{formatCurrency(item[col.key])}</span>
        ) : col.key === 'criado_em' ? (
          <span className="text-[10px] text-zinc-500">{formatDate(item[col.key])}</span>
        ) : col.key === 'actions' ? (
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleEditMoto(item);
              }}
              className={cn(
                "p-2 rounded-lg transition-all",
                theme === 'dark' ? "bg-violet-500/10 text-violet-400 hover:bg-violet-500/20" : "text-zinc-400 hover:text-violet-600 hover:bg-violet-50"
              )}
              title="Editar moto"
            >
              <Edit2 size={16} />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setItemToDelete(item.id);
                setIsDeleteConfirmOpen(true);
              }}
              className={cn(
                "p-2 rounded-lg transition-all",
                theme === 'dark' ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "text-zinc-400 hover:text-red-600 hover:bg-red-50"
              )}
              title="Excluir moto"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <span className="truncate block max-w-[150px]">{item[col.key] || '-'}</span>
        )}
      </td>
    ))}
  </tr>
));

const MotosView = memo(({ theme, onSelectItem, onRegisterActions, isSearchOpen, readOnly = false }: { theme: 'light' | 'dark', onSelectItem: (item: any) => void, onRegisterActions?: (actions: any) => void, isSearchOpen?: boolean, readOnly?: boolean }) => {
  const { motos: items, loading, refreshData, setMotos } = useContext(DataContext);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(window.innerWidth < 768 ? 10 : 25);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editingMoto, setEditingMoto] = useState<any | null>(null);

  useEffect(() => {
    if (isModalOpen || isEditModalOpen || isDeleteConfirmOpen || isBulkDeleteConfirmOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen, isEditModalOpen, isDeleteConfirmOpen, isBulkDeleteConfirmOpen]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [inlineEditData, setInlineEditData] = useState<any>(null);
  const editRowRef = useRef<HTMLTableRowElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({
        edit: handleEditMoto,
        delete: (id: string) => {
          setItemToDelete(id);
          setIsDeleteConfirmOpen(true);
        },
        focusSearch: () => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
            searchInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    }
  }, [onRegisterActions]);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Função para lidar com seleção de arquivos
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      // Limitar a 15 arquivos
      if (files.length + selectedFiles.length > 15) {
        alert('Máximo de 15 fotos permitido');
        return;
      }
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  // Função para remover arquivo selecionado
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Função para fazer upload dos arquivos
  const uploadFiles = async (isEdit: boolean = false) => {
    if (selectedFiles.length === 0) return;
    
    const uploadedUrls = await performUpload();
    if (uploadedUrls.length > 0) {
      if (isEdit && editingMoto) {
        console.log('🎉 Todas as imagens enviadas:', uploadedUrls);

        // 3. ATUALIZAR A MOTO COM AS NOVAS IMAGENS
        // PEGAR AS IMAGENS EXISTENTES + AS NOVAS
        const imagensExistentes = editFormData.imagens || [];
        const todasImagens = [...imagensExistentes, ...uploadedUrls];

        console.log('📸 Imagens que serão salvas:', todasImagens);

        // Preparar os dados para atualização
        const motoData = {
          nome: editFormData.nome,
          marca: editFormData.marca,
          modelo: editFormData.modelo,
          ano: editFormData.ano,
          valor: Number(editFormData.valor),
          cor: editFormData.cor,
          cilindrada: Number(editFormData.cilindrada),
          lote: editFormData.lote,
          nome_nf: editFormData.nome_nf,
          pecas_retiradas: editFormData.pecas_retiradas,
          status: editFormData.status,
          descricao: editFormData.descricao,
          imagens: todasImagens // ← IMPORTANTE: incluir as imagens aqui
        };

        console.log('📤 Enviando atualização com imagens:', motoData);

        try {
          const updateResponse = await fetchWithRetry(`/api/motos/${editingMoto.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(motoData)
          });
          
          const responseText = await updateResponse.text();
          let result;
          try {
            result = JSON.parse(responseText);
          } catch (e) {
            console.error('❌ Resposta inválida do servidor:', responseText.substring(0, 200));
            throw new Error('O servidor retornou um formato inválido (HTML em vez de JSON).');
          }

          if (result.success) {
            setMotos(prev => prev.map(m => m.id === editingMoto.id ? result.data : m));
            setEditFormData(prev => ({
              ...prev,
              imagens: todasImagens,
              imagem: prev.imagem || todasImagens[0] || ''
            }));
            alert('✅ Imagens salvas com sucesso!');
          } else {
            alert('❌ Erro ao salvar imagens no banco: ' + result.error);
          }
        } catch (error) {
          console.error('Erro ao atualizar moto após upload:', error);
          alert('❌ Erro de conexão ao salvar imagens.');
        }
      } else {
        setFormData(prev => {
          const newImagens = [...prev.imagens, ...uploadedUrls];
          return {
            ...prev, 
            imagens: newImagens,
            imagem: prev.imagem || newImagens[0] || ''
          };
        });
      }
      setSelectedFiles([]);
    }
  };

  const performUpload = async () => {
    if (selectedFiles.length === 0) return [];
    
    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      // Realizar uploads em paralelo para maior velocidade
      const uploadPromises = selectedFiles.map(async (file) => {
        try {
          /* 
          // TENTATIVA 1: URL assinada (Desabilitado temporariamente devido a erro 500)
          const requestRes = await fetchWithRetry('/api/storage/request-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              fileType: file.type
            })
          });
          
          const requestText = await requestRes.text();
          let requestData;
          try {
            requestData = JSON.parse(requestText);
          } catch (e) {
            requestData = { success: false };
          }
          
          if (requestData.success) {
            const { uploadUrl, publicUrl } = requestData.data;
            const uploadRes = await fetchWithRetry(uploadUrl, {
              method: 'PUT',
              body: file,
              headers: { 'Content-Type': file.type }
            });
            
            if (uploadRes.ok) return publicUrl;
          }
          */
        } catch (e) {
          console.warn('Falha no upload assinado, tentando direto:', e);
        }

        // TENTATIVA 2: Upload direto (Fallback)
        const formData = new FormData();
        formData.append('file', file);
        const directRes = await fetchWithRetry('/api/storage/upload', {
          method: 'POST',
          body: formData
        });

        const directText = await directRes.text();
        const directData = JSON.parse(directText);
        if (directData.success) return directData.data.publicUrl;
        throw new Error(directData.error || 'Falha no upload');
      });

      const results = await Promise.all(uploadPromises);
      const successfulUrls = results.filter(url => !!url) as string[];
      
      setSelectedFiles([]);
      return successfulUrls;
    } catch (error: any) {
      console.error('Erro no upload:', error);
      alert('❌ Erro ao enviar fotos: ' + (error as Error).message);
      return [];
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editRowRef.current && !editRowRef.current.contains(event.target as Node)) {
        saveInlineEdit();
      }
    };

    if (editingRowId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingRowId, inlineEditData]);

  const [formData, setFormData] = useState({
    nome: '',
    marca: '',
    modelo: '',
    ano: '',
    valor: '',
    cor: '',
    cilindrada: '',
    lote: '',
    nome_nf: '',
    pecas_retiradas: '',
    status: '',
    descricao: '',
    imagem: '',
    imagens: [] as string[]
  });

  const [editFormData, setEditFormData] = useState({
    nome: '',
    marca: '',
    modelo: '',
    ano: '',
    valor: '',
    cor: '',
    cilindrada: '',
    lote: '',
    nome_nf: '',
    pecas_retiradas: '',
    status: '',
    descricao: '',
    imagem: '',
    imagens: [] as string[]
  });

  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null);
  const [brandFilter, setBrandFilter] = useState('Todas');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [cilindradaFilter, setCilindradaFilter] = useState('Todas');
  const [sortOrder, setSortOrder] = useState('Data de Criação');
  const [anoMinFilter, setAnoMinFilter] = useState('');
  const [valorMinFilter, setValorMinFilter] = useState('');
  const [valorMaxFilter, setValorMaxFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>(readOnly ? 'card' : 'card');

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 || readOnly) {
        setViewMode('card');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [readOnly]);

  const closeModals = () => {
    setIsModalOpen(false);
    setIsEditModalOpen(false);
    setSelectedFiles([]);
  };

  const getStatusColor = (status: string, isBadge: boolean = false) => {
    switch (status) {
      case 'Disponível':
        return isBadge ? "bg-emerald-500 text-white" : "bg-emerald-500/10 text-emerald-500";
      case 'Desmontada':
        return isBadge ? "bg-amber-500 text-white" : "bg-amber-500/10 text-amber-500";
      case 'Vendida':
        return isBadge ? "bg-rose-500 text-white" : "bg-rose-500/10 text-rose-500";
      case 'Em estoque':
        return isBadge ? "bg-zinc-600 text-white" : "bg-zinc-500/10 text-zinc-400";
      default:
        return isBadge ? "bg-violet-500 text-white" : "bg-violet-500/10 text-violet-500";
    }
  };

  const handleRowClick = (item: any) => {
    if (editingRowId === item.id) return;
    
    if (clickTimer) {
      clearTimeout(clickTimer);
      setClickTimer(null);
      handleInlineEdit(item);
    } else {
      const timer = setTimeout(() => {
        onSelectItem(item);
        setClickTimer(null);
      }, 250);
      setClickTimer(timer);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedItems.map(item => item.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const idsToRemove = [...selectedIds];
    setIsBulkDeleteConfirmOpen(false);
    
    setMotos(prev => prev.filter(item => !idsToRemove.includes(item.id)));
    setSelectedIds([]);

    try {
      const response = await fetchWithRetry('/api/motos/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToRemove })
      });
      
      if (!response.ok) throw new Error('Falha ao excluir motos');
    } catch (err: any) {
      alert(err.message);
      refreshData();
    }
  };

  const handleDeleteMoto = async () => {
    if (!itemToDelete) return;
    const idToRemove = itemToDelete;
    setIsDeleteConfirmOpen(false);
    
    setMotos(prev => prev.filter(item => item.id !== idToRemove));
    setSelectedIds(prev => prev.filter(i => i !== idToRemove));
    setItemToDelete(null);

    try {
      const response = await fetchWithRetry(`/api/motos/${idToRemove}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Falha ao excluir moto');
    } catch (err: any) {
      alert(err.message);
      refreshData();
    }
  };

  const handleEditMoto = (moto: any) => {
    setEditingMoto(moto);
    setEditFormData({
      nome: moto.nome || '',
      marca: moto.marca || '',
      modelo: moto.modelo || '',
      ano: moto.ano || '',
      valor: moto.valor?.toString() || '',
      cor: moto.cor || '',
      cilindrada: moto.cilindrada?.toString() || '',
      lote: moto.lote || '',
      nome_nf: moto.nome_nf || '',
      pecas_retiradas: moto.pecas_retiradas || '',
      status: moto.status || '',
      descricao: moto.descricao || '',
      imagem: moto.imagem || '',
      imagens: moto.imagens || []
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateMoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMoto) return;
    setIsSaving(true);

    try {
      // Upload automático se houver arquivos pendentes
      let currentImagens = [...editFormData.imagens];
      let currentImagem = editFormData.imagem;

      if (selectedFiles.length > 0) {
        const uploadedUrls = await performUpload();
        if (uploadedUrls.length > 0) {
          currentImagens = [...currentImagens, ...uploadedUrls];
          if (!currentImagem) currentImagem = uploadedUrls[0];
        }
      }

      const motoId = editingMoto.id;
      
      // Garantir que os campos obrigatórios estejam presentes e formatados
      const payload = {
        nome: editFormData.nome || editingMoto.nome,
        marca: editFormData.marca || editingMoto.marca,
        modelo: editFormData.modelo || editingMoto.modelo,
        ano: editFormData.ano || editingMoto.ano,
        valor: Number(editFormData.valor) || editingMoto.valor,
        cor: editFormData.cor || editingMoto.cor,
        cilindrada: Number(editFormData.cilindrada) || editingMoto.cilindrada,
        lote: editFormData.lote || editingMoto.lote,
        nome_nf: editFormData.nome_nf || editingMoto.nome_nf,
        pecas_retiradas: editFormData.pecas_retiradas || editingMoto.pecas_retiradas,
        status: editFormData.status || editingMoto.status,
        descricao: editFormData.descricao || editingMoto.descricao,
        imagens: currentImagens
      };
      
      console.log('📤 Enviando atualização:', payload);
      
      const response = await fetchWithRetry(`/api/motos/${motoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      console.log('📥 Resposta do servidor:', result);
      
      if (result.success) {
        // Atualizar o estado local com os dados retornados do servidor
        setMotos(prev => prev.map(m => m.id === motoId ? result.data : m));
        setIsEditModalOpen(false);
        setEditingMoto(null);
      } else {
        throw new Error(result.error || 'Erro ao atualizar');
      }
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
      refreshData();
    } finally {
      setIsSaving(false);
    }
  };

  const handleInlineEdit = (item: any) => {
    setEditingRowId(item.id);
    setInlineEditData({ ...item });
  };

  const saveInlineEdit = async () => {
    if (!editingRowId || !inlineEditData) return;
    const motoId = editingRowId;
    
    // Optimistic update
    setMotos(prev => prev.map(item => item.id === motoId ? { ...item, ...inlineEditData } : item));
    setEditingRowId(null);
    setInlineEditData(null);

    try {
      const response = await fetchWithRetry(`/api/motos/${motoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inlineEditData)
      });
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Falha ao atualizar moto');
      }
      setMotos(prev => prev.map(item => item.id === motoId ? result.data : item));
    } catch (err: any) {
      alert(err.message);
      refreshData();
    }
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveInlineEdit();
    } else if (e.key === 'Escape') {
      setEditingRowId(null);
      setInlineEditData(null);
    }
  };

  const handleSaveMoto = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Upload automático se houver arquivos pendentes
      let currentImagens = [...formData.imagens];
      let currentImagem = formData.imagem;

      if (selectedFiles.length > 0) {
        const uploadedUrls = await performUpload();
        if (uploadedUrls.length > 0) {
          currentImagens = [...currentImagens, ...uploadedUrls];
          if (!currentImagem) currentImagem = uploadedUrls[0];
        }
      }

      const finalData = {
        ...formData,
        imagens: currentImagens,
        imagem: currentImagens[0] || ''
      };

      const response = await fetchWithRetry('/api/motos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData)
      });
      
      const result = await response.json();
      if (result.success) {
        setMotos(prev => [result.data, ...prev]);
        setIsModalOpen(false);
        setFormData({
          nome: '',
          marca: '',
          modelo: '',
          ano: '',
          valor: '',
          cor: '',
          cilindrada: '',
          lote: '',
          nome_nf: '',
          pecas_retiradas: '',
          status: '',
          descricao: '',
          imagem: '',
          imagens: []
        });
      } else {
        throw new Error(result.error || 'Falha ao salvar moto');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const brands = useMemo(() => {
    const b = new Set(items.map(item => item.marca).filter(Boolean));
    return ['Todas', ...Array.from(b)];
  }, [items]);

  const statuses = useMemo(() => {
    const s = new Set(['Disponível', 'Em estoque', 'Desmontada', 'Vendida']);
    items.forEach(item => {
      if (item.status) s.add(item.status);
    });
    return ['Todos', ...Array.from(s)];
  }, [items]);

  const cilindradas = useMemo(() => {
    const c = new Set(items.map(item => item.cilindrada).filter(Boolean));
    return ['Todas', ...Array.from(c)];
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = [...items];

    if (debouncedSearchTerm) {
      const searchTerms = debouncedSearchTerm.toLowerCase().split(' ').filter(t => t.length > 0);
      result = result.filter(item => 
        searchTerms.every(term => 
          (item.nome?.toLowerCase() || '').includes(term) ||
          (item.marca?.toLowerCase() || '').includes(term) ||
          (item.modelo?.toLowerCase() || '').includes(term) ||
          (item.rk_id?.toLowerCase() || '').includes(term) ||
          (item.lote?.toLowerCase() || '').includes(term)
        )
      );
    }

    if (brandFilter && brandFilter !== 'Todas') {
      result = result.filter(item => item.marca === brandFilter);
    }

    if (statusFilter && statusFilter !== 'Todos') {
      result = result.filter(item => item.status === statusFilter);
    }

    if (cilindradaFilter && cilindradaFilter !== 'Todas') {
      result = result.filter(item => item.cilindrada === cilindradaFilter);
    }

    if (anoMinFilter) {
      result = result.filter(item => Number(item.ano) >= Number(anoMinFilter));
    }

    if (valorMinFilter) {
      result = result.filter(item => item.valor >= Number(valorMinFilter));
    }

    if (valorMaxFilter) {
      result = result.filter(item => item.valor <= Number(valorMaxFilter));
    }

    if (readOnly) {
      result = result.filter(item => item.status !== 'Vendida');
    }

    // Ordenar
    result.sort((a, b) => {
      // 1. Prioridade Máxima: Vendidas sempre para o final
      const aIsSold = a.status === 'Vendida';
      const bIsSold = b.status === 'Vendida';
      if (aIsSold && !bIsSold) return 1;
      if (!aIsSold && bIsSold) return -1;

      // 2. Prioridade Secundária: Com fotos no topo (se não for vendida)
      const aHasPhotos = (a.imagens && a.imagens.length > 0) || (a.imagem && a.imagem !== '');
      const bHasPhotos = (b.imagens && b.imagens.length > 0) || (b.imagem && b.imagem !== '');
      
      if (aHasPhotos && !bHasPhotos) return -1;
      if (!aHasPhotos && bHasPhotos) return 1;

      // 3. Ordenação selecionada
      let comparison = 0;
      switch (sortOrder) {
        case 'Cilindrada':
          comparison = (Number(a.cilindrada) || 0) - (Number(b.cilindrada) || 0);
          break;
        case 'Nome':
          comparison = (a.nome || '').localeCompare(b.nome || '');
          break;
        case 'Data de Criação':
          comparison = new Date(b.criado_em || 0).getTime() - new Date(a.criado_em || 0).getTime();
          break;
        case 'Data de Criação Antigo':
          comparison = new Date(a.criado_em || 0).getTime() - new Date(b.criado_em || 0).getTime();
          break;
        case 'Ano':
          comparison = (Number(a.ano) || 0) - (Number(b.ano) || 0);
          break;
        case 'Valor':
          comparison = (a.valor || 0) - (b.valor || 0);
          break;
        case 'Lote':
          comparison = (a.lote || '').localeCompare(b.lote || '');
          break;
        default:
          // Default: Recentemente adicionadas (Data de Criação desc)
          comparison = new Date(b.criado_em || 0).getTime() - new Date(a.criado_em || 0).getTime();
      }
      
      return comparison;
    });

    return result;
  }, [items, debouncedSearchTerm, brandFilter, statusFilter, cilindradaFilter, anoMinFilter, valorMinFilter, valorMaxFilter, sortOrder, readOnly]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  const formatCurrency = (value: any) => {
    const num = Number(value);
    if (isNaN(num)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  };

  if (loading && items.length === 0) {
    // Não bloquear a tela
  }

  return (
    <div className="space-y-4">
      {/* Toolbar Profissional e Compacta */}
      <div className={cn(
        "relative z-50 p-2 md:p-4 rounded-2xl md:rounded-3xl flex flex-col gap-2 md:gap-3 transition-all duration-300 shadow-xl border overflow-visible",
        theme === 'dark' 
          ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800 shadow-black/40" 
          : "bg-white/90 backdrop-blur-xl border-zinc-100 shadow-zinc-200/40",
        isSearchOpen && "blur-md pointer-events-none opacity-50"
      )}>
        {/* Search Bar Compacta */}
        <div className="w-full relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-violet-500 transition-colors" size={18} />
          <input 
            ref={searchInputRef}
            type="text" 
            placeholder="Buscar motos..." 
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className={cn(
              "w-full rounded-xl py-3 md:py-3.5 pl-12 md:pl-14 pr-4 text-xs md:text-sm font-medium outline-none transition-all duration-200 border shadow-inner",
              theme === 'dark' 
                ? "bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50" 
                : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:bg-white"
            )}
          />
        </div>

        {/* Filtros e Ações Compactos */}
        <div className="flex flex-col gap-3 overflow-visible">
          <div className="flex items-center gap-3 flex-wrap md:flex-nowrap overflow-visible">
            <div className="flex-1 md:flex-none md:min-w-[160px] flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 ml-1">Marca</label>
              <CustomDropdown
                theme={theme}
                icon={<Filter size={14} />}
                value={brandFilter}
                className="w-full"
                onChange={(val) => {
                  setBrandFilter(val);
                  setCurrentPage(1);
                }}
                options={brands.map(brand => ({ value: brand, label: brand }))}
              />
            </div>

            {!readOnly && (
              <div className="flex-1 md:flex-none md:min-w-[160px] flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 ml-1">Status</label>
                <CustomDropdown
                  theme={theme}
                  icon={<Layers size={14} />}
                  value={statusFilter}
                  className="w-full"
                  onChange={(val) => {
                    setStatusFilter(val);
                    setCurrentPage(1);
                  }}
                  options={statuses.map(s => ({ value: s, label: s }))}
                />
              </div>
            )}

            <div className="flex-1 md:flex-none md:min-w-[160px] flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 ml-1">Ordenação</label>
              <CustomDropdown
                theme={theme}
                icon={<ArrowDownAZ size={14} />}
                value={sortOrder}
                className="w-full"
                onChange={(val) => setSortOrder(val)}
                options={[
                  { value: "Data de Criação", label: "Mais recente" },
                  { value: "Data de Criação Antigo", label: "Mais antigo" },
                  { value: "Nome", label: "Nome" },
                  { value: "Cilindrada", label: "Cilindrada" },
                  { value: "Ano", label: "Ano" },
                  { value: "Valor", label: "Valor" },
                  ...(readOnly ? [] : [{ value: "Lote", label: "Lote" }]),
                ]}
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              {!readOnly && (
                <button 
                  onClick={handleManualRefresh}
                  disabled={loading || isRefreshing}
                  className={cn(
                    "flex-1 md:flex-none flex items-center justify-center gap-2 h-10 px-4 rounded-xl transition-all duration-200 border text-[11px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md",
                    theme === 'dark' 
                      ? "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700" 
                      : "bg-zinc-100 border-zinc-200 text-zinc-500 hover:bg-zinc-200"
                  )}
                >
                  <RefreshCw size={14} className={cn((loading || isRefreshing) && "animate-spin")} />
                  <span className="hidden md:inline">Sincronizar</span>
                </button>
              )}

              {!readOnly && (
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className={cn(
                    "flex-1 md:flex-none flex items-center justify-center gap-2 h-10 px-4 rounded-xl transition-all duration-200 border text-[11px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md",
                    theme === 'dark' 
                      ? "bg-violet-600 border-violet-500 text-white shadow-violet-900/20 hover:bg-violet-500" 
                      : "bg-violet-600 border-violet-500 text-white shadow-violet-200/50 hover:bg-violet-700"
                  )}
                >
                  <Plus size={16} />
                  <span>Nova Moto</span>
                </button>
              )}
            </div>

            {(searchTerm || brandFilter !== 'Todas' || statusFilter !== 'Todos' || cilindradaFilter !== 'Todas' || anoMinFilter || valorMinFilter || valorMaxFilter) && (
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setBrandFilter('Todas');
                  setStatusFilter('Todos');
                  setCilindradaFilter('Todas');
                  setAnoMinFilter('');
                  setValorMinFilter('');
                  setValorMaxFilter('');
                  setCurrentPage(1);
                }}
                className={cn(
                  "w-full md:w-auto flex items-center justify-center gap-2 h-10 px-4 rounded-xl transition-all duration-200 border text-[11px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md",
                  theme === 'dark' 
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/20" 
                    : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                )}
              >
                <X size={16} />
                <span>Limpar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filtros Secundários Compactos */}
      {!readOnly && (
        <div className={cn(
          "flex flex-wrap items-center gap-3 p-2 px-3 rounded-2xl border transition-all duration-300 overflow-visible",
          theme === 'dark' 
            ? "bg-zinc-900/50 border-zinc-800" 
            : "bg-zinc-50 border-zinc-200"
        )}>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Cilindrada:</span>
            <CustomDropdown
              theme={theme}
              value={cilindradaFilter}
              onChange={(val) => {
                setCilindradaFilter(val);
                setCurrentPage(1);
              }}
              options={cilindradas.map(c => ({ value: c, label: c }))}
              className="w-24"
              compact={false}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Ano:</span>
            <input 
              type="number"
              placeholder="Mín"
              value={anoMinFilter}
              onChange={(e) => {
                setAnoMinFilter(e.target.value);
                setCurrentPage(1);
              }}
              className={cn(
                "w-16 border rounded-xl py-1.5 px-2 text-[11px] font-bold outline-none transition-all",
                theme === 'dark' 
                  ? "bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-violet-500" 
                  : "bg-white border-zinc-200 text-zinc-900 focus:border-violet-500"
              )}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Valor:</span>
            <div className="flex items-center gap-1">
              <input 
                type="number"
                placeholder="Min"
                value={valorMinFilter}
                onChange={(e) => {
                  setValorMinFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className={cn(
                  "w-20 border rounded-xl py-1.5 px-2 text-[11px] font-bold outline-none transition-all",
                  theme === 'dark' 
                    ? "bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-violet-500" 
                    : "bg-white border-zinc-200 text-zinc-900 focus:border-violet-500"
                )}
              />
              <span className="text-zinc-500">-</span>
              <input 
                type="number"
                placeholder="Max"
                value={valorMaxFilter}
                onChange={(e) => {
                  setValorMaxFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className={cn(
                  "w-20 border rounded-xl py-1.5 px-2 text-[11px] font-bold outline-none transition-all",
                  theme === 'dark' 
                    ? "bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-violet-500" 
                    : "bg-white border-zinc-200 text-zinc-900 focus:border-violet-500"
                )}
              />
            </div>
          </div>

          {(brandFilter !== 'Todas' || statusFilter !== 'Todos' || cilindradaFilter !== 'Todas' || anoMinFilter || valorMinFilter || valorMaxFilter) && (
            <button 
              onClick={() => {
                setBrandFilter('Todas');
                setStatusFilter('Todos');
                setCilindradaFilter('Todas');
                setAnoMinFilter('');
                setValorMinFilter('');
                setValorMaxFilter('');
                setCurrentPage(1);
              }}
              className="text-xs text-rose-400 hover:text-rose-300 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors ml-auto"
            >
              <X size={14} />
              Limpar Filtros
            </button>
          )}
        </div>
      )}

      {viewMode === 'table' ? (
        <div className={cn(
          "border rounded-2xl overflow-visible relative transition-all duration-300",
          theme === 'dark' 
            ? "bg-zinc-900/40 border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)]" 
            : "bg-white border-zinc-200 shadow-sm"
        )}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className={cn(
                  "transition-colors",
                  theme === 'dark' ? "bg-zinc-800/30" : "bg-zinc-50"
                )}>
                  <th className="px-6 py-4 w-10">
                    <div 
                      onClick={toggleSelectAll}
                      className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-all duration-200",
                        selectedIds.length === paginatedItems.length && paginatedItems.length > 0
                          ? "bg-violet-600 border-violet-600 shadow-[0_0_8px_rgba(139,92,246,0.3)]" 
                          : theme === 'dark' ? "border-zinc-700" : "border-zinc-300"
                      )}
                    >
                      {selectedIds.length === paginatedItems.length && paginatedItems.length > 0 && <Check className="text-white" size={14} />}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">ID</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Moto</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Marca/Modelo</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Ano</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Lote</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Valor</th>
                  {!readOnly && <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className={cn(
                "divide-y transition-colors",
                theme === 'dark' ? "divide-zinc-800/30" : "divide-zinc-100"
              )}>
                {paginatedItems.map((item) => (
                  <tr 
                    key={item.id} 
                    ref={editingRowId === item.id ? editRowRef : null}
                    onClick={() => handleRowClick(item)}
                    className={cn(
                      "transition-all duration-200 group cursor-pointer",
                      selectedIds.includes(item.id) 
                        ? theme === 'dark' ? "bg-violet-500/10" : "bg-violet-50"
                        : theme === 'dark' ? "hover:bg-zinc-800/20" : "hover:bg-zinc-50",
                      editingRowId === item.id && (theme === 'dark' ? "bg-zinc-800/40" : "bg-zinc-100")
                    )}
                  >
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div 
                        onClick={() => toggleSelect(item.id)}
                        className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-all duration-200",
                          selectedIds.includes(item.id)
                            ? "bg-violet-600 border-violet-600 shadow-[0_0_8px_rgba(139,92,246,0.3)] opacity-100" 
                            : cn(
                                "opacity-0 group-hover:opacity-100",
                                theme === 'dark' ? "border-zinc-700 hover:border-zinc-500" : "border-zinc-300 hover:border-zinc-400"
                              )
                        )}
                      >
                        {selectedIds.includes(item.id) && <Check className="text-white" size={14} />}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-zinc-500">
                      {editingRowId === item.id ? (
                        <input 
                          autoFocus
                          type="text" 
                          value={inlineEditData.rk_id} 
                          onChange={(e) => setInlineEditData({...inlineEditData, rk_id: e.target.value})}
                          onKeyDown={handleInlineKeyDown}
                          className={cn("w-full bg-transparent border-b border-violet-500 outline-none px-1")}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : item.rk_id}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {item.imagem && (
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-zinc-800/50">
                            <img loading="lazy" src={item.imagem} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        )}
                        {editingRowId === item.id ? (
                          <input 
                            type="text" 
                            value={inlineEditData.nome} 
                            onChange={(e) => setInlineEditData({...inlineEditData, nome: e.target.value})}
                            onKeyDown={handleInlineKeyDown}
                            className={cn("w-full bg-transparent border-b border-violet-500 outline-none px-1 text-sm font-bold", theme === 'dark' ? "text-white" : "text-zinc-900")}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className={cn("text-sm font-bold tracking-tight", theme === 'dark' ? "text-white" : "text-zinc-900")}>{item.nome}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-500">
                      {editingRowId === item.id ? (
                        <div className="flex gap-1">
                          <input 
                            type="text" 
                            value={inlineEditData.marca} 
                            onChange={(e) => setInlineEditData({...inlineEditData, marca: e.target.value})}
                            onKeyDown={handleInlineKeyDown}
                            className={cn("w-1/2 bg-transparent border-b border-violet-500 outline-none px-1")}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <input 
                            type="text" 
                            value={inlineEditData.modelo} 
                            onChange={(e) => setInlineEditData({...inlineEditData, modelo: e.target.value})}
                            onKeyDown={handleInlineKeyDown}
                            className={cn("w-1/2 bg-transparent border-b border-violet-500 outline-none px-1")}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      ) : (
                        `${item.marca} ${item.modelo}`
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500">
                      {editingRowId === item.id ? (
                        <input 
                          type="text" 
                          value={inlineEditData.ano} 
                          onChange={(e) => setInlineEditData({...inlineEditData, ano: e.target.value})}
                          onKeyDown={handleInlineKeyDown}
                          className={cn("w-full bg-transparent border-b border-violet-500 outline-none px-1")}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (isNaN(Number(item.ano)) ? "0" : item.ano)}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500">
                      {editingRowId === item.id ? (
                        <input 
                          type="text" 
                          value={inlineEditData.lote} 
                          onChange={(e) => setInlineEditData({...inlineEditData, lote: e.target.value})}
                          onKeyDown={handleInlineKeyDown}
                          className={cn("w-full bg-transparent border-b border-violet-500 outline-none px-1")}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (isNaN(Number(item.lote)) ? "0" : item.lote)}
                    </td>
                    <td className="px-6 py-4">
                      {editingRowId === item.id ? (
                        <CustomDropdown
                          theme={theme}
                          variant="form"
                          value={inlineEditData.status} 
                          onChange={(val) => setInlineEditData({...inlineEditData, status: val})}
                          options={[
                            { value: 'Disponível', label: 'Disponível' },
                            { value: 'Em estoque', label: 'Em estoque' },
                            { value: 'Desmontada', label: 'Desmontada' },
                            { value: 'Vendida', label: 'Vendida' },
                          ]}
                          className="w-full"
                        />
                      ) : (
                        <span className={cn(
                          "px-2 py-1 rounded-md text-[10px] font-bold uppercase whitespace-normal break-words max-w-[120px] inline-block",
                          getStatusColor(item.status)
                        )}>
                          {item.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingRowId === item.id ? (
                        <input 
                          type="number" 
                          value={inlineEditData.valor} 
                          onChange={(e) => setInlineEditData({...inlineEditData, valor: Number(e.target.value)})}
                          onKeyDown={handleInlineKeyDown}
                          className={cn("w-full bg-transparent border-b border-violet-500 outline-none px-1 text-sm font-bold text-violet-400")}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-sm font-bold text-violet-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.2)]">
                          {formatCurrency(item.valor)}
                        </span>
                      )}
                    </td>
                    {!readOnly && (
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {editingRowId === item.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={saveInlineEdit}
                              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all"
                            >
                              <Check size={14} />
                            </button>
                            <button 
                              onClick={() => { setEditingRowId(null); setInlineEditData(null); }}
                              className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleEditMoto(item)}
                              className={cn(
                                "p-2 rounded-lg transition-all",
                                theme === 'dark' ? "bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-700" : "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
                              )}
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => {
                                setItemToDelete(item.id);
                                setIsDeleteConfirmOpen(true);
                              }}
                              className={cn(
                                "p-2 rounded-lg transition-all",
                                theme === 'dark' ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20" : "text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                              )}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-6">
          {paginatedItems.map((item) => (
            <MotoCard 
              key={item.id}
              item={item}
              theme={theme}
              onSelectItem={onSelectItem}
              handleEditMoto={handleEditMoto}
              setItemToDelete={setItemToDelete}
              setIsDeleteConfirmOpen={setIsDeleteConfirmOpen}
              getStatusColor={getStatusColor}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}

      <div className={cn(
          "p-4 border-t flex items-center justify-between transition-colors",
          theme === 'dark' ? "bg-zinc-900/30 border-zinc-800/50" : "bg-zinc-50 border-zinc-200"
        )}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total: {filteredItems.length} motos</span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={cn(
                "p-1.5 border rounded-lg disabled:opacity-30 transition-all",
                theme === 'dark' ? "border-zinc-800 hover:bg-zinc-800" : "border-zinc-200 hover:bg-zinc-100"
              )}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold text-zinc-400">Página {currentPage} de {totalPages}</span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className={cn(
                "p-1.5 border rounded-lg disabled:opacity-30 transition-all",
                theme === 'dark' ? "border-zinc-800 hover:bg-zinc-800" : "border-zinc-200 hover:bg-zinc-100"
              )}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

      {/* Modal Nova Moto */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-2xl max-h-[90vh] rounded-3xl border shadow-2xl relative overflow-visible",
                theme === 'dark' ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800/50 text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <form onSubmit={handleSaveMoto} className="flex flex-col max-h-[90vh]">
                <button type="button" onClick={closeModals} className="absolute top-6 right-6 p-2 hover:bg-zinc-800 rounded-full transition-colors z-10">
                  <X size={20} className="text-zinc-500" />
                </button>

                <div className="p-8 pb-4 flex items-center gap-4 border-b border-zinc-800/50">
                  <div className="p-3 bg-violet-600/10 rounded-2xl">
                    <Plus className="text-violet-500" size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Nova Moto</h2>
                    <p className="text-sm text-zinc-500">Adicione uma nova moto ao catálogo</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                  <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Nome/Título</label>
                    <input required type="text" value={formData.nome} onChange={(e) => setFormData({...formData, nome: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Marca</label>
                    <input type="text" value={formData.marca} onChange={(e) => setFormData({...formData, marca: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Modelo</label>
                    <input type="text" value={formData.modelo} onChange={(e) => setFormData({...formData, modelo: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Ano</label>
                    <input type="text" value={formData.ano} onChange={(e) => setFormData({...formData, ano: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Cilindrada</label>
                    <input type="number" value={formData.cilindrada} onChange={(e) => setFormData({...formData, cilindrada: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Valor (R$)</label>
                    <input required type="number" value={formData.valor} onChange={(e) => setFormData({...formData, valor: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Cor</label>
                    <input type="text" value={formData.cor} onChange={(e) => setFormData({...formData, cor: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Lote</label>
                    <input type="text" value={formData.lote} onChange={(e) => setFormData({...formData, lote: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Status</label>
                    <CustomDropdown
                      theme={theme}
                      variant="form"
                      value={formData.status}
                      onChange={(val) => setFormData({...formData, status: val})}
                      options={[
                        { value: 'Disponível', label: 'Disponível' },
                        { value: 'Em estoque', label: 'Em estoque' },
                        { value: 'Desmontada', label: 'Desmontada' },
                        { value: 'Vendida', label: 'Vendida' },
                      ]}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Nome NF</label>
                    <input type="text" value={formData.nome_nf} onChange={(e) => setFormData({...formData, nome_nf: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Peças Retiradas</label>
                  <input type="text" value={formData.pecas_retiradas} onChange={(e) => setFormData({...formData, pecas_retiradas: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Fotos (Máx 15)</label>
                  
                  {/* Imagens já salvas */}
                  {formData.imagens.length > 0 && (
                    <Reorder.Group 
                      axis="x" 
                      values={formData.imagens} 
                      onReorder={(newOrder) => setFormData({...formData, imagens: newOrder})}
                      className="flex gap-2 mb-3 overflow-x-auto pb-2 custom-scrollbar"
                    >
                      {formData.imagens.map((img) => (
                        <Reorder.Item 
                          key={img} 
                          value={img}
                          layout
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="relative flex-shrink-0 w-24 aspect-square rounded-lg overflow-hidden border border-zinc-800 group cursor-grab active:cursor-grabbing"
                        >
                          <img loading="lazy" src={img} className="w-full h-full object-cover pointer-events-none" referrerPolicy="no-referrer" />
                          <button 
                            type="button"
                            onClick={() => setFormData({...formData, imagens: formData.imagens.filter((i) => i !== img)})}
                            className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          >
                            <X size={10} />
                          </button>
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <Layers size={16} className="text-white/70" />
                          </div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  )}

                  {/* Pré-visualização das imagens selecionadas */}
                  {selectedFiles.length > 0 && (
                    <Reorder.Group 
                      axis="x" 
                      values={selectedFiles} 
                      onReorder={setSelectedFiles}
                      className="flex gap-2 mb-3 overflow-x-auto pb-2 custom-scrollbar"
                    >
                      {selectedFiles.map((file) => (
                        <Reorder.Item 
                          key={file.name + file.size + file.lastModified} 
                          value={file}
                          layout
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="relative flex-shrink-0 w-24 group aspect-square cursor-grab active:cursor-grabbing"
                        >
                          <img 
                            src={URL.createObjectURL(file)} 
                            alt={file.name}
                            className="w-full h-full object-cover rounded-lg border border-zinc-700 pointer-events-none"
                          />
                          <button
                            type="button"
                            onClick={() => setSelectedFiles(prev => prev.filter(f => f !== file))}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          >
                            <X size={14} />
                          </button>
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none rounded-lg">
                            <Layers size={16} className="text-white/70" />
                          </div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  )}
                  
                  {/* Botão de adicionar fotos */}
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={selectedFiles.length + formData.imagens.length >= 15}
                      className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <Plus size={18} />
                      Selecionar Fotos ({selectedFiles.length + formData.imagens.length}/15)
                    </button>
                    
                    {selectedFiles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => uploadFiles(false)}
                        disabled={uploading}
                        className="px-4 py-2 bg-violet-600 rounded-xl hover:bg-violet-500 transition-colors flex items-center gap-2 text-sm font-bold"
                      >
                        {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                        {uploading ? 'Enviando...' : 'Fazer Upload'}
                      </button>
                    )}
                  </div>
                  
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase font-bold tracking-widest">
                    Selecione imagens do seu computador (máx 15)
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Descrição</label>
                  <textarea rows={3} value={formData.descricao} onChange={(e) => setFormData({...formData, descricao: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                </div>
              </div>

              <div className="p-6 border-t border-zinc-800/50 bg-zinc-900/20 flex items-center justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={closeModals} 
                    className={cn(
                      "px-6 py-3 rounded-xl font-medium transition-all active:scale-95",
                      theme === 'dark' ? "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-100 border border-zinc-200 text-zinc-600 hover:bg-zinc-200"
                    )}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving} 
                    className={cn(
                      "px-8 py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center gap-2",
                      theme === 'dark'
                        ? "bg-violet-600 border border-violet-500 text-white shadow-lg shadow-violet-900/20 hover:bg-violet-500"
                        : "bg-violet-600 border border-violet-500 text-white shadow-lg shadow-violet-200/50 hover:bg-violet-700"
                    )}
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Salvar Moto
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Editar Moto */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-2xl max-h-[90vh] rounded-3xl border shadow-2xl relative overflow-visible",
                theme === 'dark' ? "bg-zinc-900/90 backdrop-blur-xl border-zinc-800/50 text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <form onSubmit={handleUpdateMoto} className="flex flex-col max-h-[90vh]">
                <button type="button" onClick={closeModals} className="absolute top-6 right-6 p-2 hover:bg-zinc-800 rounded-full transition-colors z-10">
                  <X size={20} className="text-zinc-500" />
                </button>

                <div className="p-8 pb-4 flex items-center gap-4 border-b border-zinc-800/50">
                  <div className="p-3 bg-violet-600/10 rounded-2xl">
                    <Edit className="text-violet-500" size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Editar Moto</h2>
                    <p className="text-sm text-zinc-500">Atualize as informações da moto</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                  <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Nome/Título</label>
                    <input required type="text" value={editFormData.nome} onChange={(e) => setEditFormData({...editFormData, nome: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Marca</label>
                    <input type="text" value={editFormData.marca} onChange={(e) => setEditFormData({...editFormData, marca: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Modelo</label>
                    <input type="text" value={editFormData.modelo} onChange={(e) => setEditFormData({...editFormData, modelo: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Ano</label>
                    <input type="text" value={editFormData.ano} onChange={(e) => setEditFormData({...editFormData, ano: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Cilindrada</label>
                    <input type="number" value={editFormData.cilindrada} onChange={(e) => setEditFormData({...editFormData, cilindrada: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Valor (R$)</label>
                    <input required type="number" value={editFormData.valor} onChange={(e) => setEditFormData({...editFormData, valor: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Cor</label>
                    <input type="text" value={editFormData.cor} onChange={(e) => setEditFormData({...editFormData, cor: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Lote</label>
                    <input type="text" value={editFormData.lote} onChange={(e) => setEditFormData({...editFormData, lote: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Status</label>
                    <CustomDropdown
                      theme={theme}
                      variant="form"
                      value={editFormData.status}
                      onChange={(val) => setEditFormData({...editFormData, status: val})}
                      options={[
                        { value: 'Disponível', label: 'Disponível' },
                        { value: 'Em estoque', label: 'Em estoque' },
                        { value: 'Desmontada', label: 'Desmontada' },
                        { value: 'Vendida', label: 'Vendida' },
                      ]}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Nome NF</label>
                    <input type="text" value={editFormData.nome_nf} onChange={(e) => setEditFormData({...editFormData, nome_nf: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Peças Retiradas</label>
                  <input type="text" value={editFormData.pecas_retiradas} onChange={(e) => setEditFormData({...editFormData, pecas_retiradas: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Fotos (Máx 15)</label>
                  
                  {/* Imagens já salvas */}
                  {editFormData.imagens.length > 0 && (
                    <Reorder.Group 
                      axis="x" 
                      values={editFormData.imagens} 
                      onReorder={(newOrder) => setEditFormData({...editFormData, imagens: newOrder})}
                      className="flex gap-2 mb-3 overflow-x-auto pb-2 custom-scrollbar"
                    >
                      {editFormData.imagens.map((img) => (
                        <Reorder.Item 
                          key={img} 
                          value={img}
                          layout
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="relative flex-shrink-0 w-24 aspect-square rounded-lg overflow-hidden border border-zinc-800 group cursor-grab active:cursor-grabbing"
                        >
                          <img loading="lazy" src={img} className="w-full h-full object-cover pointer-events-none" referrerPolicy="no-referrer" />
                          <button 
                            type="button"
                            onClick={() => setEditFormData({...editFormData, imagens: editFormData.imagens.filter((i) => i !== img)})}
                            className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          >
                            <X size={10} />
                          </button>
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <Layers size={16} className="text-white/70" />
                          </div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  )}

                  {/* Pré-visualização das imagens selecionadas */}
                  {selectedFiles.length > 0 && (
                    <Reorder.Group 
                      axis="x" 
                      values={selectedFiles} 
                      onReorder={setSelectedFiles}
                      className="flex gap-2 mb-3 overflow-x-auto pb-2 custom-scrollbar"
                    >
                      {selectedFiles.map((file) => (
                        <Reorder.Item 
                          key={file.name + file.size + file.lastModified} 
                          value={file}
                          layout
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="relative flex-shrink-0 w-24 group aspect-square cursor-grab active:cursor-grabbing"
                        >
                          <img 
                            src={URL.createObjectURL(file)} 
                            alt={file.name}
                            className="w-full h-full object-cover rounded-lg border border-zinc-700 pointer-events-none"
                          />
                          <button
                            type="button"
                            onClick={() => setSelectedFiles(prev => prev.filter(f => f !== file))}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          >
                            <X size={14} />
                          </button>
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none rounded-lg">
                            <Layers size={16} className="text-white/70" />
                          </div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  )}
                  
                  {/* Botão de adicionar fotos */}
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={selectedFiles.length + editFormData.imagens.length >= 15}
                      className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <Plus size={18} />
                      Selecionar Fotos ({selectedFiles.length + editFormData.imagens.length}/15)
                    </button>
                    
                    {selectedFiles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => uploadFiles(true)}
                        disabled={uploading}
                        className="px-4 py-2 bg-violet-600 rounded-xl hover:bg-violet-500 transition-colors flex items-center gap-2 text-sm font-bold"
                      >
                        {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                        {uploading ? 'Enviando...' : 'Fazer Upload'}
                      </button>
                    )}
                  </div>
                  
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase font-bold tracking-widest">
                    Selecione imagens do seu computador (máx 15)
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Descrição</label>
                  <textarea rows={3} value={editFormData.descricao} onChange={(e) => setEditFormData({...editFormData, descricao: e.target.value})} className={cn("w-full border rounded-xl py-2 px-4 text-sm", theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200")} />
                </div>
              </div>

              <div className="p-6 border-t border-zinc-800/50 bg-zinc-900/20 flex items-center justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={closeModals} 
                    className={cn(
                      "px-6 py-3 rounded-xl font-medium transition-all active:scale-95",
                      theme === 'dark' ? "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-100 border border-zinc-200 text-zinc-600 hover:bg-zinc-200"
                    )}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving} 
                    className={cn(
                      "px-8 py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center gap-2",
                      theme === 'dark'
                        ? "bg-violet-600 border border-violet-500 text-white shadow-lg shadow-violet-900/20 hover:bg-violet-500"
                        : "bg-violet-600 border border-violet-500 text-white shadow-lg shadow-violet-200/50 hover:bg-violet-700"
                    )}
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Confirmação Exclusão */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className={cn("w-full max-w-md p-8 rounded-3xl border shadow-2xl text-center", theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900")}>
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Excluir Moto?</h3>
              <p className="text-zinc-500 text-sm mb-8">Esta ação não pode ser desfeita. A moto será removida do Notion.</p>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsDeleteConfirmOpen(false)} 
                  className={cn(
                    "flex-1 py-3 px-4 rounded-xl font-medium transition-all active:scale-95",
                    theme === 'dark' ? "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-100 border border-zinc-200 text-zinc-600 hover:bg-zinc-200"
                  )}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDeleteMoto} 
                  className={cn(
                    "flex-1 py-3 px-4 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2",
                    theme === 'dark'
                      ? "bg-rose-600 border border-rose-500 text-white shadow-lg shadow-rose-900/20 hover:bg-rose-500"
                      : "bg-rose-600 border border-rose-500 text-white shadow-lg shadow-rose-200/50 hover:bg-rose-700"
                  )}
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className={cn("fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl", theme === 'dark' ? "bg-zinc-900/90 border-zinc-800 text-white" : "bg-white/90 border-zinc-200 text-zinc-900")}>
            <span className="text-sm font-medium mr-4">{selectedIds.length} moto(s) selecionada(s)</span>
            <div className="flex items-center gap-2 border-l pl-4 border-zinc-800">
              <button 
                onClick={() => setIsBulkDeleteConfirmOpen(true)} 
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95",
                  theme === 'dark'
                    ? "bg-rose-600/10 text-rose-500 hover:bg-rose-600 hover:text-white"
                    : "bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white"
                )}
              >
                <Trash2 size={16} />
                Excluir Selecionadas
              </button>
              <button 
                onClick={() => setSelectedIds([])} 
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors rounded-lg active:scale-95",
                  theme === 'dark' ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                )}
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Confirmação Exclusão em Massa */}
      <AnimatePresence>
        {isBulkDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className={cn("w-full max-w-md p-8 rounded-3xl border shadow-2xl text-center", theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900")}>
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Excluir {selectedIds.length} Motos?</h3>
              <p className="text-zinc-500 text-sm mb-8">Esta ação removerá permanentemente todas as motos selecionadas.</p>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsBulkDeleteConfirmOpen(false)} 
                  className={cn(
                    "flex-1 py-3 px-4 rounded-xl font-medium transition-all active:scale-95",
                    theme === 'dark' ? "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-100 border border-zinc-200 text-zinc-600 hover:bg-zinc-200"
                  )}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleBulkDelete} 
                  className={cn(
                    "flex-1 py-3 px-4 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2",
                    theme === 'dark'
                      ? "bg-rose-600 border border-rose-500 text-white shadow-lg shadow-rose-900/20 hover:bg-rose-500"
                      : "bg-rose-600 border border-rose-500 text-white shadow-lg shadow-rose-200/50 hover:bg-rose-700"
                  )}
                >
                  Excluir Todas
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});

// Helper to format relative time
const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) return 'hoje';
  if (diffInDays === 1) return 'ontem';
  if (diffInDays < 30) return `há ${diffInDays} dias`;
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths === 1) return 'há 1 mês';
  return `há ${diffInMonths} meses`;
};

import { Login } from './components/Login';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
        if (window.location.pathname === '/login') {
          window.history.replaceState(null, '', '/');
        }
      } else {
        setIsAuthenticated(false);
        if (window.location.pathname !== '/login') {
          window.history.replaceState(null, '', '/login');
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erro ao fazer logout no Firebase', error);
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_phone');
    setIsAuthenticated(false);
    window.history.replaceState(null, '', '/login');
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#0f1115] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={() => {
      // No-op: onAuthStateChanged will handle the state update
    }} />;
  }

  return (
    <DataProvider>
      <AppContent onLogout={handleLogout} />
    </DataProvider>
  );
}

// =============================================================================
// DETAIL MODAL COMPONENT
// =============================================================================

const DetailModal = ({ item, onClose, theme, userRole, onEdit, onDelete }: { 
  item: any, 
  onClose: () => void, 
  theme: 'light' | 'dark',
  userRole?: string,
  onEdit?: (item: any) => void,
  onDelete?: (id: string) => void
}) => {
  if (!item) return null;

  const [copied, setCopied] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    if (Math.abs(diff) > 50) { // threshold
      if (diff > 0) { // swipe left
        setCurrentImageIndex(prev => (prev + 1) % images.length);
      } else { // swipe right
        setCurrentImageIndex(prev => (prev - 1 + images.length) % images.length);
      }
    }
    setTouchStart(null);
  };

  // Scroll Lock
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const images = useMemo(() => {
    const imgs = item.imagens && item.imagens.length > 0 ? item.imagens : (item.imagem ? [item.imagem] : []);
    return imgs.filter(Boolean);
  }, [item.imagens, item.imagem]);

  const handleCopyLink = () => {
    const link = item.ml_link || item.permalink;
    if (link) {
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsAppShare = () => {
    const hour = new Date().getHours();
    let greeting = 'Bom dia';
    if (hour >= 12 && hour < 18) {
      greeting = 'Boa tarde';
    } else if (hour >= 18) {
      greeting = 'Boa noite';
    }
    const text = `${greeting}, quero mais detalhes da ${item.nome || item.titulo} que vi no seu site.`;
    window.open(`https://wa.me/5583982039490?text=${encodeURIComponent(text)}`, '_blank');
  };

  const parseValue = (val: any) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    
    let str = String(val).trim();
    
    // Remove R$ and spaces
    str = str.replace(/R\$\s?/g, '');
    
    // Check if it has both dots and commas (e.g. 1.200,50)
    if (str.includes('.') && str.includes(',')) {
      // Remove dots (thousands separators) and replace comma with dot
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
      // Only has comma, assume it's decimal separator
      str = str.replace(',', '.');
    }
    
    // Remove any other non-digit/dot/minus characters
    const cleaned = str.replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const formatCurrency = (value: any) => {
    if (typeof value === 'string' && value.includes('R$')) return value;
    const num = parseValue(value);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  };

  const isSale = item.tipo !== undefined && item.tipo !== null;
  const itemValue = item.valor || item.preco || item.preco_venda || item.price || 0;
  const itemName = item.nome || item.titulo || item.peca || item.title || 'Sem Nome';

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={cn(
          "w-[95%] md:max-w-2xl h-[90vh] md:h-auto md:max-h-[90vh] rounded-[2.5rem] overflow-hidden border shadow-2xl flex flex-col relative",
          theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200"
        )}
      >
        {/* Handle for mobile */}
        <div className="md:hidden w-full flex justify-center pt-4 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-zinc-800/50" />
        </div>

        {/* Close Button */}
        <button 
          onClick={onClose} 
          className={cn(
            "absolute top-6 right-6 z-50 p-2 rounded-full transition-all active:scale-90 shadow-xl border",
            theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white" : "bg-zinc-100 border-zinc-200 text-zinc-500 hover:text-zinc-900"
          )}
        >
          <X size={20} />
        </button>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* Image Gallery */}
          <div className="relative aspect-[4/3] w-full bg-zinc-950 overflow-hidden">
            {images.length > 0 ? (
              <div className="w-full h-full relative">
                <div 
                  className="flex transition-transform duration-500 ease-out h-full"
                  style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  {images.map((src: string, idx: number) => (
                    <div 
                      key={idx} 
                      className="w-full h-full flex-shrink-0 cursor-zoom-in"
                      onClick={() => setFullScreenImage(src)}
                    >
                      <img loading="lazy" src={src} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                  ))}
                </div>
                
                {images.length > 1 && (
                  <>
                    <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-4 pointer-events-none">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => (prev - 1 + images.length) % images.length); }}
                        className="p-2 rounded-full bg-black/20 backdrop-blur-md text-white pointer-events-auto active:scale-90 transition-all"
                      >
                        <ChevronLeft size={24} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => (prev + 1) % images.length); }}
                        className="p-2 rounded-full bg-black/20 backdrop-blur-md text-white pointer-events-auto active:scale-90 transition-all"
                      >
                        <ChevronRight size={24} />
                      </button>
                    </div>
                    <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
                      {images.map((_: any, idx: number) => (
                        <div 
                          key={idx} 
                          className={cn(
                            "h-1.5 rounded-full transition-all duration-300",
                            idx === currentImageIndex ? "w-8 bg-white" : "w-2 bg-white/40"
                          )}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-800">
                <Bike size={64} strokeWidth={1} className="opacity-10" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-8 space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-violet-500/10 text-violet-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-violet-500/20">
                    {item.categoria || (isSale ? 'Venda' : (item.marca ? 'Moto' : 'Peça'))}
                  </span>
                  {(item.status || item.tipo) && (
                    <span className={cn(
                      "px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border",
                      (item.status === 'Disponível' || item.status === 'DISPONÍVEL' || item.status === 'Ativo' || (isSale && item.tipo !== 'SAÍDA'))
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                    )}>
                      {item.status || item.tipo}
                    </span>
                  )}
                </div>
                <span className="text-zinc-500 text-[10px] font-mono font-bold">#{item.rk_id || (item.id && String(item.id).slice(0,4)) || 'N/A'}</span>
              </div>

              <h2 className={cn("text-3xl md:text-4xl font-black tracking-tight uppercase leading-none", theme === 'dark' ? "text-white" : "text-zinc-900")}>
                {itemName}
              </h2>

              <div className={cn(
                "text-4xl md:text-5xl font-black tracking-tighter transition-all duration-500",
                item.tipo === 'SAÍDA' ? "text-rose-500" : "text-emerald-500"
              )}>
                {formatCurrency(itemValue)}
              </div>
            </div>

            {/* Elegant Grid */}
            <div className="grid grid-cols-2 gap-4">
              {!isSale && !item.marca && (
                <>
                  <DetailItem label="Estoque" value={item.estoque !== undefined ? item.estoque : 'N/A'} icon={Package} theme={theme} />
                  <DetailItem label="Moto/Modelo" value={item.moto || item.modelo || 'N/A'} icon={Bike} theme={theme} />
                  <div className="col-span-2">
                    <DetailItem label="Ano" value={item.ano || 'N/A'} icon={Calendar} theme={theme} />
                  </div>
                </>
              )}
              
              {item.marca && (
                <>
                  <DetailItem label="Moto/Modelo" value={item.moto || item.modelo || 'N/A'} icon={Bike} theme={theme} />
                  <DetailItem label="Marca" value={item.marca} icon={Tag} theme={theme} />
                  <DetailItem label="Ano" value={item.ano || 'N/A'} icon={Calendar} theme={theme} />
                  <DetailItem label="Cilindrada" value={item.cilindrada ? `${item.cilindrada}cc` : 'N/A'} icon={Zap} theme={theme} />
                  <div className="col-span-2">
                    <DetailItem label="Lote" value={item.lote || 'N/A'} icon={Layers} theme={theme} />
                  </div>
                </>
              )}
              
              {isSale && (
                <>
                  <DetailItem label="Moto/Modelo" value={item.moto || item.modelo || 'N/A'} icon={Bike} theme={theme} />
                  <DetailItem label="Pagamento" value={item.forma_pagamento || item.tipo || 'N/A'} icon={CreditCard} theme={theme} />
                </>
              )}
            </div>

            {/* Description Section */}
            {(item.descricao || item.pecas_retiradas || item.observacoes) && (
              <div className="space-y-4">
                {(item.pecas_retiradas) && (
                  <div className={cn(
                    "p-6 rounded-3xl border space-y-2",
                    theme === 'dark' ? "bg-zinc-900/30 border-zinc-800" : "bg-zinc-50 border-zinc-100"
                  )}>
                    <h4 className="text-[10px] font-black uppercase text-violet-400 tracking-[0.1em] flex items-center gap-2">
                      <Wrench size={14} /> Peças Retiradas
                    </h4>
                    <p className={cn("text-sm leading-relaxed", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
                      {item.pecas_retiradas}
                    </p>
                  </div>
                )}
                {(item.descricao || item.observacoes) && (
                  <div className={cn(
                    "p-6 rounded-3xl border space-y-2",
                    theme === 'dark' ? "bg-zinc-900/30 border-zinc-800" : "bg-zinc-50 border-zinc-100"
                  )}>
                    <h4 className="text-[10px] font-black uppercase text-amber-400 tracking-[0.1em] flex items-center gap-2">
                      <FileText size={14} /> Observações
                    </h4>
                    <p className={cn("text-sm leading-relaxed", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
                      {item.descricao || item.observacoes}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Ações */}
            <div className="flex flex-col gap-3 pt-4">
              <button 
                onClick={handleWhatsAppShare}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3"
              >
                <MessageCircle size={20} />
                Tenho Interesse
              </button>
              
              {(item.ml_link || item.permalink) && (
                <motion.a 
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  href={item.ml_link || item.permalink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 w-full py-5 bg-[#FFE600] text-[#2D3277] font-black text-xs uppercase tracking-[0.1em] rounded-2xl hover:bg-[#F0D800] transition-all shadow-xl border border-[#FFE600]/20"
                >
                  <ExternalLink size={20} />
                  Abrir no Mercado Livre
                </motion.a>
              )}

              {onEdit && userRole !== 'client' && (
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => { onEdit(item); onClose(); }}
                    className={cn(
                      "py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all border flex items-center justify-center gap-2",
                      theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800" : "bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50"
                    )}
                  >
                    <Edit size={16} />
                    Editar
                  </button>
                  <button 
                    onClick={() => { 
                      if (window.confirm('Tem certeza que deseja excluir este item?')) {
                        onDelete?.(item.id || item.rk_id);
                        onClose();
                      }
                    }}
                    className="py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500/20 flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    Excluir
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Full Screen Image Viewer */}
      <AnimatePresence>
        {fullScreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[3000] bg-black flex items-center justify-center p-4 md:p-10"
            onClick={() => setFullScreenImage(null)}
          >
            <button 
              className="absolute top-6 right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all z-[3001]"
              onClick={(e) => { e.stopPropagation(); setFullScreenImage(null); }}
            >
              <X size={24} />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={fullScreenImage}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              referrerPolicy="no-referrer"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DetailItem = ({ label, value, theme, icon: Icon }: { label: string, value: any, theme: 'light' | 'dark', icon: any }) => {
  const displayValue = (value === null || value === undefined || value === "") ? "-" : value;
  
  return (
    <div className={cn(
      "p-4 rounded-2xl border flex flex-col gap-1.5 transition-all",
      theme === 'dark' ? "bg-zinc-900/40 border-zinc-800/50" : "bg-zinc-50 border-zinc-200"
    )}>
      <div className="flex items-center gap-2 text-zinc-500">
        <Icon size={14} strokeWidth={2.5} />
        <span className="text-[10px] uppercase font-black tracking-widest">{label}</span>
      </div>
      <span className={cn(
        "text-sm md:text-base font-black truncate uppercase",
        theme === 'dark' ? "text-zinc-100" : "text-zinc-900",
        (label === 'Estoque') && "text-emerald-400 [text-shadow:0_0_8px_rgba(16,185,129,0.3)]"
      )}>
        {displayValue}
      </span>
    </div>
  );
};

// =============================================================================
// MOTO CARD COMPONENT
// =============================================================================

const MOTO_COLORS: Record<string, string> = {
  'Preta': '#000000',
  'Branca': '#FFFFFF',
  'Vermelha': '#EF4444',
  'Azul': '#3B82F6',
  'Amarela': '#FBBF24',
  'Verde': '#10B981',
  'Cinza': '#6B7280',
  'Prata': '#D1D5DB',
  'Dourada': '#F59E0B',
  'Laranja': '#F97316',
  'Roxa': '#8B5CF6',
  'Rosa': '#EC4899',
  'Marrom': '#78350F',
  'Bege': '#F5F5DC',
  'Vinho': '#7F1D1D',
  'Grafite': '#374151',
  'Cobre': '#B45309',
  'Titanium': '#4B5563',
  'Azul Marinho': '#1E3A8A',
  'Verde Militar': '#365314'
};

const getMotoColor = (colorName: string) => {
  if (!colorName) return 'transparent';
  const normalized = colorName.trim().charAt(0).toUpperCase() + colorName.trim().slice(1).toLowerCase();
  return MOTO_COLORS[normalized] || 'transparent';
};

const MotoCard = React.memo(({ item, theme, onSelectItem, handleEditMoto, setItemToDelete, setIsDeleteConfirmOpen, getStatusColor, readOnly = false }: any) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const images = useMemo(() => {
    const imgs = item.imagens && item.imagens.length > 0 ? item.imagens : (item.imagem ? [item.imagem] : []);
    return imgs.filter(Boolean);
  }, [item.imagens, item.imagem]);

  // Preload images for smoother experience
  useEffect(() => {
    if (images.length > 0) {
      images.forEach(src => {
        const img = new Image();
        img.src = src;
      });
    }
  }, [images]);

  const handleMouseLeave = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    // Volta instantaneamente a disparar o reset, mas a transição suave é mantida pelo CSS
    setCurrentImageIndex(0);
  };

  const handleMouseEnter = () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleWheel = (e: WheelEvent) => {
      if (images.length <= 1) return;
      
      if (e.deltaY !== 0) {
        e.preventDefault();
        e.stopPropagation();
        
        if (e.deltaY > 0) {
          setCurrentImageIndex((prev) => (prev + 1) % images.length);
        } else {
          setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
        }
      }
    };

    let touchStartX = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (images.length <= 1) return;
      const touchEndX = e.changedTouches[0].clientX;
      const diff = touchStartX - touchEndX;

      if (Math.abs(diff) > 50) { // Threshold for swipe
        if (diff > 0) {
          setCurrentImageIndex((prev) => (prev + 1) % images.length);
        } else {
          setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
        }
      }
    };

    card.addEventListener('wheel', handleWheel, { passive: false });
    card.addEventListener('touchstart', handleTouchStart, { passive: true });
    card.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      card.removeEventListener('wheel', handleWheel);
      card.removeEventListener('touchstart', handleTouchStart);
      card.removeEventListener('touchend', handleTouchEnd);
    };
  }, [images.length]);

  return (
    <div 
      ref={cardRef}
      onClick={() => onSelectItem(item)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "group relative border rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer flex flex-col h-full",
        theme === 'dark' 
          ? "bg-zinc-900/40 border-zinc-800/50 hover:border-violet-500/50 hover:shadow-[0_8px_30px_rgba(139,92,246,0.1)]" 
          : "bg-white border-zinc-200 hover:border-violet-500/50 hover:shadow-lg",
        item.status === 'Vendida' && "opacity-60 grayscale-[0.5] brightness-75"
      )}
    >
      {/* Image Container */}
      <div className="aspect-[4/3] relative overflow-hidden bg-zinc-100 dark:bg-zinc-950">
        {images.length > 0 ? (
          <div className="w-full h-full relative">
            {imgLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900">
                <Loader2 size={24} className="animate-spin text-violet-500/50" />
              </div>
            )}
            <div 
              className="flex transition-transform duration-500 ease-out h-full"
              style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
            >
              {images.map((src: string, idx: number) => (
                <div key={idx} className="w-full h-full flex-shrink-0 relative">
                  <img 
                    loading="lazy"
                    src={src} 
                    onLoad={() => idx === currentImageIndex && setImgLoading(false)}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (idx === currentImageIndex) {
                        console.error("Failed to load image:", src);
                        // Hide failed image to show the icon behind it
                        target.style.display = 'none';
                      } else {
                        target.style.display = 'none';
                      }
                    }}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer" 
                  />
                  {/* Fallback if single image fails */}
                  <div className="absolute inset-0 -z-10 flex flex-col items-center justify-center text-zinc-400 bg-zinc-100 dark:bg-zinc-900/50">
                    <Bike size={48} strokeWidth={1} className="opacity-20" />
                    <span className="text-[10px] uppercase font-bold tracking-tighter mt-2 opacity-40">Erro ao carregar</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Image Indicators */}
            {images.length > 1 && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 px-2">
                {images.map((_: any, idx: number) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "h-1 rounded-full transition-all duration-300 shadow-sm",
                      idx === currentImageIndex ? "w-6 bg-white" : "w-1.5 bg-white/40"
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 bg-zinc-100 dark:bg-zinc-900/50">
            <Bike size={48} strokeWidth={1} className="opacity-20" />
            <span className="text-[10px] uppercase font-bold tracking-tighter mt-2 opacity-40">Sem Imagem</span>
          </div>
        )}
        
        {/* Status Badge - Removed as requested */}
        {/* {!readOnly && (
          <div className="absolute top-3 left-3">
            <span className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg backdrop-blur-md border border-white/10",
              getStatusColor(item.status, true)
            )}>
              {item.status}
            </span>
          </div>
        )} */}

        {/* Quick Actions - Repositioned to top right */}
        {!readOnly && (
          <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
            <button 
              onClick={(e) => { e.stopPropagation(); handleEditMoto(item); }}
              className="p-2.5 rounded-xl bg-white/90 backdrop-blur-sm text-zinc-900 hover:bg-violet-500 hover:text-white transition-all shadow-xl border border-zinc-200/50"
            >
              <Edit size={16} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setItemToDelete(item.id); setIsDeleteConfirmOpen(true); }}
              className="p-2.5 rounded-xl bg-white/90 backdrop-blur-sm text-zinc-900 hover:bg-rose-500 hover:text-white transition-all shadow-xl border border-zinc-200/50"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 md:p-5 flex-1 flex flex-col justify-between space-y-2 md:space-y-4">
        <div className="space-y-1 md:space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[8px] md:text-[10px] font-bold text-violet-500 uppercase tracking-widest">{item.marca}</span>
            </div>
            <span className="text-[8px] md:text-[10px] font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1 md:px-1.5 py-0.5 rounded">{item.rk_id}</span>
          </div>
          
          <div>
            <h3 className={cn(
              "font-black text-sm md:text-xl leading-tight line-clamp-2 tracking-tight",
              theme === 'dark' ? "text-white" : "text-zinc-900"
            )}>
              {item.nome && item.nome !== '-' ? item.nome : (item.modelo && item.modelo !== '-' ? item.modelo : 'Moto sem Nome')}
            </h3>
            {item.nome && item.nome !== '-' && item.modelo && item.modelo !== '-' && item.nome !== item.modelo && (
              <p className="text-[10px] md:text-xs text-zinc-500 font-medium mt-0.5 line-clamp-1">{item.modelo}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-y-1 md:gap-y-2 gap-x-2 md:gap-x-3 pt-1">
            {item.lote && !readOnly && (
              <div className="flex items-center gap-1 md:gap-1.5 text-[9px] md:text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-900/50 px-1.5 md:px-2 py-0.5 md:py-1 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <Layers size={10} className="text-violet-500" />
                <span className="font-bold">Lote: {item.lote}</span>
              </div>
            )}
            <div className="flex items-center gap-1 md:gap-1.5 text-[9px] md:text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-900/50 px-1.5 md:px-2 py-0.5 md:py-1 rounded-lg border border-zinc-100 dark:border-zinc-800">
              <Calendar size={10} className="text-violet-500" />
              <span>{item.ano}</span>
            </div>
            <div className="flex items-center gap-1 md:gap-1.5 text-[9px] md:text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-900/50 px-1.5 md:px-2 py-0.5 md:py-1 rounded-lg border border-zinc-100 dark:border-zinc-800">
              <div 
                className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full border border-zinc-300 dark:border-zinc-700 shadow-inner" 
                style={{ backgroundColor: getMotoColor(item.cor) }} 
              />
              <span>{item.cor || '-'}</span>
            </div>
            {item.cilindrada && item.cilindrada !== '-' && (
              <div className="flex items-center gap-1 md:gap-1.5 text-[9px] md:text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-900/50 px-1.5 md:px-2 py-0.5 md:py-1 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <TrendingUp size={10} className="text-violet-500" />
                <span>{item.cilindrada}cc</span>
              </div>
            )}
          </div>
        </div>

        <div className="pt-2 md:pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[8px] md:text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{readOnly ? 'Valor' : 'Investimento'}</span>
            <span className="text-sm md:text-xl font-black text-violet-500">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500 group-hover:bg-violet-500 group-hover:text-white transition-all duration-300 shadow-sm group-hover:shadow-violet-500/20">
            <ChevronRight size={20} />
          </div>
        </div>
      </div>
    </div>
  );
});

const LogoutModal = memo(({ isOpen, onClose, onLogout, theme }: { isOpen: boolean, onClose: () => void, onLogout: () => void, theme: 'light' | 'dark' }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className={cn(
          "relative w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl p-8 text-center",
          theme === 'dark' ? "bg-zinc-950 border border-zinc-800" : "bg-white"
        )}
      >
        <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto mb-6">
          <Trash2 size={40} />
        </div>
        <h2 className={cn("text-2xl font-black tracking-tight mb-2", theme === 'dark' ? "text-white" : "text-zinc-900")}>
          Sair da Conta?
        </h2>
        <p className="text-zinc-500 text-sm font-medium mb-8">
          Tem certeza que deseja encerrar sua sessão atual? Você precisará entrar novamente.
        </p>
        <div className="flex flex-col gap-3">
          <button 
            onClick={onLogout}
            className="w-full bg-rose-500 hover:bg-rose-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-rose-500/20"
          >
            Sim, Sair Agora
          </button>
          <button 
            onClick={onClose}
            className={cn(
              "w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all",
              theme === 'dark' ? "bg-zinc-900 text-zinc-400 hover:bg-zinc-800" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            )}
          >
            Cancelar
          </button>
        </div>
      </motion.div>
    </div>
  );
});

function AppContent({ onLogout }: { onLogout: () => void }) {
  const context = useContext(DataContext);
  const showSensitiveInfo = context?.showSensitiveInfo ?? true;
  const setShowSensitiveInfo = context?.setShowSensitiveInfo ?? (() => {});
  const [userRole, setUserRole] = useState<string>('client');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'estoque' | 'vendas' | 'motos' | 'atendimento' | 'frete' | 'clients' | 'mercadolivre' | 'users' | 'audit'>('dashboard');
  const [isAnyModalOpen, setIsAnyModalOpen] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem('user_role') || 'client';
    setUserRole(role as 'admin' | 'client');
    
    // Roteamento Client-Side: Sincronizar aba com a URL
    const path = window.location.pathname.replace('/', '');
    const validTabs = ['dashboard', 'estoque', 'vendas', 'motos', 'atendimento', 'frete', 'clients', 'mercadolivre', 'users', 'audit'];
    
    if (path && validTabs.includes(path)) {
      setActiveTab(path as any);
    } else {
      const defaultTab = role === 'admin' ? 'dashboard' : 'motos';
      setActiveTab(defaultTab);
      window.history.replaceState(null, '', `/${defaultTab}`);
    }
  }, []);

  // Atualizar URL quando a aba mudar
  useEffect(() => {
    if (activeTab) {
      window.history.pushState(null, '', `/${activeTab}`);
    }
  }, [activeTab]);
  const [pendingEditItem, setPendingEditItem] = useState<any | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [paymentFilter, setPaymentFilter] = useState<string>('TODOS');
  const [showPaymentFilter, setShowPaymentFilter] = useState(false);

  const [selectedDetailItem, setSelectedDetailItem] = useState<any | null>(null);
  const [inventoryActions, setInventoryActions] = useState<{ edit: (item: any) => void, delete: (id: string) => void, focusSearch?: () => void } | null>(null);
  const [salesActions, setSalesActions] = useState<{ edit: (item: any) => void, delete: (id: string) => void, focusSearch?: () => void } | null>(null);
  const [motosActions, setMotosActions] = useState<{ edit: (item: any) => void, delete: (id: string) => void, focusSearch?: () => void } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);

  // Atalho Ctrl + F para busca global
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mlDashboardData, setMlDashboardData] = useState<any>(null);
  const [isMlDashboardLoading, setIsMlDashboardLoading] = useState(false);
  const [dashboardSource, setDashboardSource] = useState<'estoque' | 'mercadolivre'>('estoque');
  const [mlPeriod, setMlPeriod] = useState('30d');
  const [mlCustomDate, setMlCustomDate] = useState({ start: '', end: '' });
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  // Atualiza a foto de perfil quando o usuário muda
  useEffect(() => {
    const phone = localStorage.getItem('user_phone');
    if (phone) {
      setProfilePhoto(localStorage.getItem(`profilePhoto_${phone}`));
    } else {
      setProfilePhoto(null);
    }
  }, []);
  const [allMlListings, setAllMlListings] = useState<any[]>([]);
  const [showAllMlAds, setShowAllMlAds] = useState(false);

  useEffect(() => {
    const shouldLock = showAllMlAds || showPaymentFilter || isBudgetModalOpen || isLogoutModalOpen || selectedDetailItem || isAnyModalOpen;
    
    if (shouldLock) {
      document.body.style.overflow = 'hidden';
      if (contentRef.current) contentRef.current.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      if (contentRef.current) contentRef.current.style.overflow = 'auto';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
      if (contentRef.current) contentRef.current.style.overflow = 'auto';
    };
  }, [showAllMlAds, showPaymentFilter, isBudgetModalOpen, isLogoutModalOpen, selectedDetailItem, isAnyModalOpen]);
  const [isMlListingsLoading, setIsMlListingsLoading] = useState(false);
  
  // Estados para filtros, ordenação e paginação
  const [mlSearchTerm, setMlSearchTerm] = useState('');
  const [mlSortConfig, setMlSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'criado_em', direction: 'desc' });
  const [mlCurrentPage, setMlCurrentPage] = useState(1);
  const mlItemsPerPage = 10;

  const toggleMlSort = (key: string) => {
    setMlSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const filteredMlListings = allMlListings
    .filter(item => 
      (item.titulo || '').toLowerCase().includes(mlSearchTerm.toLowerCase()) ||
      (item.id || '').toLowerCase().includes(mlSearchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[mlSortConfig.key as keyof typeof a];
      const bVal = b[mlSortConfig.key as keyof typeof b];
      if (aVal < bVal) return mlSortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return mlSortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const mlTotalPages = Math.ceil(filteredMlListings.length / mlItemsPerPage);
  const paginatedMlListings = filteredMlListings.slice(
    (mlCurrentPage - 1) * mlItemsPerPage,
    mlCurrentPage * mlItemsPerPage
  );
  
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    const socket = io();
    socket.on('whatsapp-notification', (data: { count: number }) => {
      setUnreadCount(data.count);
    });

    // A contagem agora pode vir das conversas globais, mas mantemos o fetch inicial por segurança
    /*
    fetchWithRetry('/api/whatsapp/messages')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUnreadCount(data.data.filter((m: any) => m.status === 'unread').length);
        }
      });
    */

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    setDashboardSource('estoque');
    window.scrollTo(0, 0);
    if (contentRef.current) {
      contentRef.current.scrollTo(0, 0);
    }
  }, [activeTab]);

  const fetchMlDashboard = useCallback(async () => {
    setIsMlDashboardLoading(true);
    try {
      let url = `/api/ml/dashboard?period=${mlPeriod}`;
      if (mlPeriod === 'custom' && mlCustomDate.start && mlCustomDate.end) {
        url += `&start=${mlCustomDate.start}&end=${mlCustomDate.end}`;
      }
      const res = await fetchWithRetry(url);
      const data = await res.json();
      if (data.success) {
        setMlDashboardData(data.data);
      }
    } catch (err) {
      console.error('Erro ao buscar dashboard ML:', err);
    } finally {
      setIsMlDashboardLoading(false);
    }
  }, [mlPeriod, mlCustomDate]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchMlDashboard();
    }
  }, [activeTab, fetchMlDashboard]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const phone = localStorage.getItem('user_phone');
    const firebaseToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;

    if (file && phone && firebaseToken) {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('phone', phone);

      try {
        const res = await fetch('/api/upload/profile', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firebaseToken}`
          },
          body: formData
        });

        const data = await res.json();
        if (data.success) {
          setProfilePhoto(data.url);
          localStorage.setItem(`profilePhoto_${phone}`, data.url);
          console.log('✅ Foto de perfil atualizada:', data.url);
        } else {
          alert('Erro ao enviar foto: ' + data.error);
        }
      } catch (error) {
        console.error('❌ Erro ao enviar foto de perfil:', error);
        alert('Erro de conexão ao enviar foto');
      }
    }
  };

  const handleRemovePhoto = () => {
    const phone = localStorage.getItem('user_phone');
    setProfilePhoto(null);
    if (phone) {
      localStorage.removeItem(`profilePhoto_${phone}`);
    }
    setIsProfileDropdownOpen(false);
  };

  const fetchAllMlListings = async () => {
    setIsMlListingsLoading(true);
    try {
      const res = await fetchWithRetry('/api/ml/listings?limit=50');
      const data = await parseJson(res);
      setAllMlListings(data.data || []);
      setShowAllMlAds(true);
    } catch (err) {
      console.error('Erro ao buscar todos os anúncios ML:', err);
    } finally {
      setIsMlListingsLoading(false);
    }
  };

  const itemActions = useMemo(() => {
    if (!selectedDetailItem) return { edit: undefined, delete: undefined };
    const item = selectedDetailItem;
    
    const wrapEdit = (originalEdit: any, tab: 'dashboard' | 'estoque' | 'vendas' | 'motos' | 'atendimento' | 'frete' | 'clients' | 'mercadolivre') => {
      if (!originalEdit) {
        return (item: any) => {
          setActiveTab(tab);
          setPendingEditItem(item);
        };
      }
      return (item: any) => {
        if (activeTab !== tab) {
          setActiveTab(tab);
          setPendingEditItem(item);
        } else {
          originalEdit(item);
        }
      };
    };

    if (item.marca) {
      return { 
        edit: wrapEdit(motosActions?.edit, 'motos'), 
        delete: motosActions?.delete 
      };
    }
    if (item.rk_id || item.categoria) {
      return { 
        edit: wrapEdit(inventoryActions?.edit, 'estoque'), 
        delete: inventoryActions?.delete 
      };
    }
    if (item.valor !== undefined) {
      return { 
        edit: wrapEdit(salesActions?.edit, 'vendas'), 
        delete: salesActions?.delete 
      };
    }
    return { edit: undefined, delete: undefined };
  }, [selectedDetailItem, inventoryActions, salesActions, motosActions, activeTab]);

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300 flex font-sans w-full relative overflow-x-hidden",
      theme === 'dark' 
        ? "bg-[radial-gradient(ellipse_at_top,_#1a1b1f,_#09090b)] text-zinc-100" 
        : "bg-zinc-50 text-zinc-900"
    )}>
      {/* Sidebar Backdrop for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      {userRole !== 'client' && (
        <aside className={cn(
          "fixed md:sticky top-0 h-screen inset-y-0 left-0 z-50 transition-all duration-300 ease-in-out border-r hidden md:flex",
          theme === 'dark' ? "bg-zinc-950/50 border-zinc-800/50 backdrop-blur-xl" : "bg-white border-zinc-200 shadow-xl",
          isSidebarOpen ? "w-64 translate-x-0" : "w-20 -translate-x-full md:translate-x-0",
          !isSidebarOpen && "md:w-20"
        )}>
          <div className={cn(
            "h-full flex flex-col p-4",
            theme === 'dark' ? "bg-zinc-950" : "bg-white"
          )}>
            <div className="flex items-center gap-3 px-2 mb-10 overflow-hidden">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <Wrench className={theme === 'dark' ? "text-zinc-100" : "text-zinc-900"} size={20} />
              </div>
              {isSidebarOpen && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex flex-col min-w-0"
                >
                  <span className={cn(
                    "font-black text-xl tracking-tighter truncate",
                    theme === 'dark' ? "text-white" : "text-zinc-900"
                  )}>
                    RK <span className="text-violet-500">SUCATAS</span>
                  </span>
                  <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Gestão Inteligente</span>
                </motion.div>
              )}
            </div>

            <nav className="flex-1 space-y-2">
              {(userRole === 'admin' || userRole === 'gerente') && (
                <SidebarItem 
                  icon={LayoutDashboard} 
                  label={isSidebarOpen ? "Dashboard" : ""} 
                  active={activeTab === 'dashboard'} 
                  onClick={() => setActiveTab('dashboard')} 
                  theme={theme}
                />
              )}
              <SidebarItem 
                icon={Package} 
                label={isSidebarOpen ? "Estoque" : ""} 
                active={activeTab === 'estoque'} 
                onClick={() => setActiveTab('estoque')} 
                theme={theme}
              />
              {(userRole === 'admin' || userRole === 'gerente') && (
                <SidebarItem 
                  icon={ShoppingCart} 
                  label={isSidebarOpen ? "Vendas" : ""} 
                  active={activeTab === 'vendas'} 
                  onClick={() => setActiveTab('vendas')} 
                  theme={theme}
                />
              )}
              {(userRole === 'admin' || userRole === 'gerente') && (
                <SidebarItem 
                  icon={TrendingUp} 
                  label={isSidebarOpen ? "Mercado Livre" : ""} 
                  active={activeTab === 'mercadolivre'} 
                  onClick={() => setActiveTab('mercadolivre')} 
                  theme={theme}
                  className="hidden md:flex"
                />
              )}
              {(userRole === 'admin' || userRole === 'gerente') && (
                <SidebarItem 
                  icon={UserCog} 
                  label={isSidebarOpen ? "Usuários" : ""} 
                  active={activeTab === 'users'} 
                  onClick={() => setActiveTab('users')} 
                  theme={theme}
                />
              )}
              {userRole === 'admin' && (
                <SidebarItem 
                  icon={Activity} 
                  label={isSidebarOpen ? "Auditoria" : ""} 
                  active={activeTab === 'audit'} 
                  onClick={() => setActiveTab('audit')} 
                  theme={theme}
                />
              )}
              <SidebarItem 
                icon={Bike} 
                label={isSidebarOpen ? "Motos" : ""} 
                active={activeTab === 'motos'} 
                onClick={() => setActiveTab('motos')} 
                theme={theme}
              />
              {(userRole === 'admin' || userRole === 'gerente') && (
                <SidebarItem 
                  icon={Truck} 
                  label={isSidebarOpen ? "Frete" : ""} 
                  active={activeTab === 'frete'} 
                  onClick={() => setActiveTab('frete')} 
                  theme={theme}
                />
              )}
              {(userRole === 'admin' || userRole === 'gerente') && (
                <SidebarItem 
                  icon={MessageSquare} 
                  label={isSidebarOpen ? "Atendimento" : ""} 
                  active={activeTab === 'atendimento'} 
                  onClick={() => setActiveTab('atendimento')} 
                  theme={theme}
                  badge={unreadCount > 0 ? unreadCount : undefined}
                />
              )}
            </nav>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 pb-nav-safe md:pb-0">
        {/* Header - Restored for clients as requested */}
        <header className={cn(
          "min-h-16 border-b backdrop-blur-md flex items-center justify-between px-4 md:px-6 sticky top-0 z-[100] transition-colors pt-safe",
          theme === 'dark' ? "bg-zinc-950/40 border-zinc-800/50" : "bg-white/50 border-zinc-200"
        )}>
          <div className="flex items-center gap-2 md:gap-4 relative z-50">
            <div className="relative z-50" ref={dropdownRef}>
              <button 
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className={cn(
                  "relative w-10 h-10 rounded-full overflow-hidden border-2 transition-all flex items-center justify-center shrink-0",
                  theme === 'dark' 
                    ? "border-zinc-800 hover:border-violet-500 bg-zinc-900" 
                    : "border-zinc-200 hover:border-violet-400 bg-zinc-100"
                )}
              >
                {profilePhoto ? (
                  <img loading="lazy" src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className={cn(
                    "w-full h-full flex items-center justify-center font-black text-lg uppercase",
                    theme === 'dark' ? "text-violet-400 bg-violet-500/10" : "text-violet-600 bg-violet-50"
                  )}>
                    {(localStorage.getItem('user_name') || 'U').charAt(0)}
                  </div>
                )}
              </button>

              <AnimatePresence>
                {isProfileDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className={cn(
                      "absolute left-0 mt-3 w-56 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border z-50 overflow-hidden backdrop-blur-2xl",
                      theme === 'dark' ? "bg-zinc-900/90 border-zinc-800" : "bg-white/90 border-zinc-200"
                    )}
                  >
                    <div className="p-3 border-b border-zinc-800/50 mb-1">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Conta</p>
                      <p className="text-sm font-bold truncate">{localStorage.getItem('user_name') || 'Usuário'}</p>
                    </div>
                    <div className="p-2 space-y-1">
                      <button
                        onClick={() => {
                          fileInputRef.current?.click();
                          setIsProfileDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all",
                          theme === 'dark' ? "hover:bg-violet-600/20 hover:text-violet-400 text-zinc-300" : "hover:bg-violet-50 hover:text-violet-600 text-zinc-700"
                        )}
                      >
                        <Camera size={18} />
                        {profilePhoto ? 'Trocar foto' : 'Escolher foto'}
                      </button>
                      {profilePhoto && (
                        <button
                          onClick={handleRemovePhoto}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all",
                            theme === 'dark' ? "hover:bg-rose-500/10 text-rose-400" : "hover:bg-rose-50 text-rose-600"
                          )}
                        >
                          <Trash2 size={18} />
                          Remover foto
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setIsLogoutModalOpen(true);
                          setIsProfileDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-rose-500",
                          theme === 'dark' ? "hover:bg-rose-500/10" : "hover:bg-rose-50"
                        )}
                      >
                        <LogOut size={18} />
                        Sair da conta
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <input 
                type="file" 
                ref={fileInputRef}
                accept="image/*" 
                className="hidden" 
                onChange={handleProfilePhotoUpload} 
              />
            </div>
            <h2 className={cn(
              "text-base md:text-lg font-semibold capitalize transition-colors truncate max-w-[120px] md:max-w-none",
              theme === 'dark' ? "text-white" : "text-zinc-900"
            )}>
              {activeTab === 'dashboard' ? 'Dashboard' :
               activeTab === 'vendas' ? 'Vendas' :
               activeTab === 'estoque' ? 'Estoque' :
               activeTab === 'motos' ? 'Motos' :
               activeTab === 'atendimento' ? 'Atendimento' :
               activeTab === 'clients' ? 'Clientes' :
               activeTab === 'mercadolivre' ? 'Mercado Livre' :
               activeTab === 'frete' ? 'Frete' :
               activeTab === 'users' ? 'Usuários' :
               activeTab === 'audit' ? 'Auditoria' :
               activeTab}
            </h2>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={toggleTheme}
              className={cn(
                "p-2 rounded-lg transition-all duration-300",
                theme === 'dark' ? "hover:bg-zinc-800 text-amber-400" : "hover:bg-zinc-100 text-violet-600"
              )}
              title={theme === 'dark' ? "Mudar para modo claro" : "Mudar para modo escuro"}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div ref={contentRef} className="p-4 md:p-6 pb-32 md:pb-6 overflow-y-auto flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full"
                >
              {activeTab === 'dashboard' ? (
                <DashboardView 
                  theme={theme} 
                  onSelectItem={setSelectedDetailItem} 
                  mlData={mlDashboardData}
                  source={dashboardSource}
                  onToggleSource={setDashboardSource}
                  onTabChange={setActiveTab}
                  allMlListings={allMlListings}
                  showAllMlAds={showAllMlAds}
                  setShowAllMlAds={setShowAllMlAds}
                  onFetchAllMlListings={fetchAllMlListings}
                  isMlListingsLoading={isMlListingsLoading}
                  onRefreshMlDashboard={fetchMlDashboard}
                  mlPeriod={mlPeriod}
                  setMlPeriod={setMlPeriod}
                  mlCustomDate={mlCustomDate}
                  setMlCustomDate={setMlCustomDate}
                  isMlDashboardLoading={isMlDashboardLoading}
                  mlSearchTerm={mlSearchTerm}
                  setMlSearchTerm={setMlSearchTerm}
                  mlSortConfig={mlSortConfig}
                  toggleMlSort={toggleMlSort}
                  mlCurrentPage={mlCurrentPage}
                  setMlCurrentPage={setMlCurrentPage}
                  mlTotalPages={mlTotalPages}
                  paginatedMlListings={paginatedMlListings}
                  paymentFilter={paymentFilter}
                  setPaymentFilter={setPaymentFilter}
                  showPaymentFilter={showPaymentFilter}
                  setShowPaymentFilter={setShowPaymentFilter}
                  isSearchOpen={isSearchOpen}
                />
              ) : activeTab === 'estoque' ? (
                <InventoryView 
                  theme={theme} 
                  onSelectItem={setSelectedDetailItem} 
                  onRegisterActions={setInventoryActions}
                  isSearchOpen={isSearchOpen}
                  readOnly={userRole === 'client'}
                  pendingEditItem={pendingEditItem}
                  setPendingEditItem={setPendingEditItem}
                />
              ) : activeTab === 'vendas' ? (
                <SalesView theme={theme} onSelectItem={setSelectedDetailItem} onRegisterActions={setSalesActions} isSearchOpen={isSearchOpen} />
              ) : activeTab === 'motos' ? (
                <MotosView 
                  theme={theme} 
                  onSelectItem={setSelectedDetailItem} 
                  onRegisterActions={setMotosActions} 
                  isSearchOpen={isSearchOpen} 
                  readOnly={userRole === 'client'}
                />
              ) : activeTab === 'mercadolivre' ? (
                <MercadoLivre theme={theme} />
              ) : activeTab === 'users' ? (
                <AdminUsers userRole={userRole} onModalChange={setIsAnyModalOpen} theme={theme} />
              ) : activeTab === 'audit' ? (
                <AuditLogs />
              ) : activeTab === 'atendimento' ? (
                <Atendimento theme={theme} />
              ) : activeTab === 'frete' ? (
                <FreteView theme={theme} />
              ) : (
                <div className={cn(
                  "flex flex-col items-center justify-center h-[60vh] transition-colors w-full",
                  theme === 'dark' ? "text-violet-500" : "text-violet-600"
                )}>
                  <Settings size={48} className="mb-4 opacity-50" />
                  <p className="text-lg font-bold">Funcionalidade em desenvolvimento</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      {userRole !== 'client' && (
        <MobileBottomNav 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          theme={theme} 
          userRole={userRole} 
          isMoreOpen={isMoreMenuOpen}
          setIsMoreOpen={setIsMoreMenuOpen}
        />
      )}
      
      {/* Grupo de ações flutuantes - Only for Admin/Gerente/Estoque */}
      {userRole !== 'client' && !isMoreMenuOpen && !isAnyModalOpen && (
        <div className="fixed bottom-24 md:bottom-8 right-6 z-[60] flex flex-col gap-3">
          <GlobalSearch 
            theme={theme} 
            onSelectItem={setSelectedDetailItem} 
            isOpen={isSearchOpen} 
            setIsOpen={setIsSearchOpen}
            customClick={() => {
              setIsSearchOpen(true);
            }}
          />

          {/* Budget FAB */}
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsBudgetModalOpen(true)}
            className={cn(
              "relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl group border",
              theme === 'dark' 
                ? "bg-zinc-800 hover:bg-zinc-700 border-zinc-700" 
                : "bg-white hover:bg-gray-50 border-zinc-200"
            )}
          >
            <DollarSign className={cn(
              "w-6 h-6 transition-transform group-hover:scale-110",
              theme === 'dark' ? "text-violet-400" : "text-violet-600"
            )} />
          </motion.button>
        </div>
      )}

      <BudgetModal 
        isOpen={isBudgetModalOpen} 
        onClose={() => setIsBudgetModalOpen(false)} 
        theme={theme} 
      />
      
      {/* Modal de Detalhes Global */}
      <AnimatePresence>
        {selectedDetailItem && (
          <DetailModal 
            item={selectedDetailItem} 
            theme={theme} 
            userRole={userRole}
            onClose={() => setSelectedDetailItem(null)} 
            onEdit={itemActions.edit}
            onDelete={itemActions.delete}
          />
        )}
      </AnimatePresence>

      {/* Modal de Logout */}
      <AnimatePresence>
        {isLogoutModalOpen && (
          <LogoutModal 
            isOpen={isLogoutModalOpen} 
            onClose={() => setIsLogoutModalOpen(false)} 
            onLogout={onLogout} 
            theme={theme} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
