import React, { useState, useRef, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, Package, ShoppingCart, Bike, Tag, Layers } from 'lucide-react';
import { DataContext } from '../App';
import { cn, formatDateRelative } from '../utils';

interface GlobalSearchProps {
  theme: 'light' | 'dark';
  onSelectItem: (item: any) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  customClick?: () => void;
}

function normalizarTexto(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

const CatalogItemCard = ({ item, theme, onClick }: { item: any, theme: string, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full text-left p-2.5 rounded-lg flex items-center gap-3 transition-all border",
      theme === 'dark' 
        ? "bg-zinc-900 border-zinc-800 hover:border-violet-500/50" 
        : "bg-white border-zinc-200 hover:border-indigo-500/50"
    )}
  >
    <div className={cn(
      "w-12 h-12 rounded-lg overflow-hidden flex-shrink-0",
      theme === 'dark' ? "bg-zinc-800" : "bg-zinc-100"
    )}>
      {item.imagem ? (
        <img 
          src={item.imagem} 
          alt={item.nome} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-zinc-400">
          <Package size={18} />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className={cn("font-bold text-xs mb-1 truncate", theme === 'dark' ? "text-zinc-100" : "text-zinc-900")}>
        {item.nome}
      </p>
      <div className="flex flex-wrap gap-1">
        <span className={cn("flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold", theme === 'dark' ? "bg-violet-500/10 text-violet-400" : "bg-violet-50 text-violet-600")}>
          <Tag size={8} /> {item.rk_id}
        </span>
        <span className={cn("flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold", theme === 'dark' ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600")}>
          <Layers size={8} /> {item.categoria}
        </span>
        <span className={cn("flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold", theme === 'dark' ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-600")}>
          <Package size={8} /> {item.estoque} un
        </span>
      </div>
    </div>
    <p className="font-black text-emerald-500 text-xs [text-shadow:0_0_10px_rgba(16,185,129,0.5)]">
      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.valor))}
    </p>
  </button>
);

const MotoItemCard = ({ item, theme, onClick }: { item: any, theme: string, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full text-left p-2.5 rounded-lg flex items-center gap-3 transition-all border",
      theme === 'dark' 
        ? "bg-zinc-900 border-zinc-800 hover:border-blue-500/50" 
        : "bg-white border-zinc-200 hover:border-blue-500/50"
    )}
  >
    <div className={cn(
      "w-16 h-12 rounded-lg overflow-hidden flex-shrink-0",
      theme === 'dark' ? "bg-zinc-800" : "bg-zinc-100"
    )}>
      {item.imagens?.[0] || item.imagem ? (
        <img 
          src={item.imagens?.[0] || item.imagem} 
          alt={item.nome} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-zinc-400">
          <Bike size={20} />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className={cn("font-bold text-xs mb-1 truncate uppercase", theme === 'dark' ? "text-zinc-100" : "text-zinc-900")}>
        {item.nome}
      </p>
      <div className="flex flex-wrap gap-1">
        <span className={cn("px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider border shadow-sm", theme === 'dark' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-blue-50 text-blue-600 border-blue-200")}>
          {item.marca}
        </span>
        <span className={cn("px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider border shadow-sm", theme === 'dark' ? "bg-zinc-800 text-zinc-300 border-zinc-700" : "bg-zinc-100 text-zinc-600 border-zinc-200")}>
          {item.ano}
        </span>
        <span className={cn("px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider border shadow-sm", theme === 'dark' ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-violet-50 text-violet-600 border-violet-200")}>
          {item.cilindrada}cc
        </span>
        {item.status && (
          <span className={cn(
            "px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider border shadow-sm",
            item.status === 'DISPONÍVEL' ? (theme === 'dark' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-600 border-emerald-200") :
            item.status === 'VENDIDA' ? (theme === 'dark' ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-rose-50 text-rose-600 border-rose-200") :
            (theme === 'dark' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-amber-50 text-amber-600 border-amber-200")
          )}>
            {item.status}
          </span>
        )}
      </div>
    </div>
    <p className="font-black text-emerald-500 text-xs [text-shadow:0_0_10px_rgba(16,185,129,0.5)]">
      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.valor))}
    </p>
  </button>
);

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ theme, onSelectItem, isOpen, setIsOpen, customClick }) => {
  const [query, setQuery] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const inputRef = useRef<HTMLInputElement>(null);
  const { inventory, sales, motos } = useContext(DataContext);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    setQuery('');
  };

  const getResults = () => {
    if (!query.trim()) return [];
    
    const normalizedQuery = normalizarTexto(query);
    const queryWords = normalizedQuery.split(' ').filter(Boolean);
    const results: { type: 'estoque' | 'venda' | 'moto', data: any, score: number }[] = [];

    // Search Inventory (Peças)
    inventory.forEach(item => {
      const itemText = normalizarTexto(`${item.nome} ${item.rk_id} ${item.categoria}`);
      
      // Score calculation:
      // Exact name match gets highest score
      const exactNameMatch = normalizarTexto(item.nome || '') === normalizedQuery;
      // All words match gets high score
      const matchesAll = queryWords.every(word => itemText.includes(word));
      
      if (exactNameMatch || matchesAll) {
        results.push({ 
          type: 'estoque', 
          data: item, 
          score: exactNameMatch ? 10 : (matchesAll ? 5 : 0) 
        });
      }
    });

    // Search Sales (Vendas)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    sales.forEach(sale => {
      if (!sale.tipo) return;
      
      const saleDate = new Date(sale.data);
      const isSameMonth = saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear;
      
      const normalizedTipo = normalizarTexto(sale.tipo);
      
      if (isSameMonth && normalizedTipo.includes(normalizedQuery)) {
        results.push({
          type: 'venda',
          data: sale,
          score: 8
        });
      }
    });

    // Search Motos
    motos.forEach(moto => {
      const motoText = normalizarTexto(`${moto.nome} ${moto.marca} ${moto.modelo} ${moto.lote || ''}`);
      
      const exactNameMatch = normalizarTexto(moto.nome || '') === normalizedQuery;
      const matchesAll = queryWords.every(word => motoText.includes(word));
      
      if (exactNameMatch || matchesAll) {
        results.push({
          type: 'moto',
          data: moto,
          score: exactNameMatch ? 12 : (matchesAll ? 7 : 0)
        });
      }
    });

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score).slice(0, 8);
  };

  const results = getResults();

  return (
    <>
      <motion.button
        className={cn(
          "fixed right-6 w-14 h-14 rounded-full flex items-center justify-center z-50 transition-all duration-300 group",
          theme === 'dark' 
            ? "bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 shadow-xl" 
            : "bg-white hover:bg-gray-50 border border-zinc-200 shadow-xl"
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.95 }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (customClick) {
            customClick();
          } else {
            setIsOpen(true);
          }
        }}
        initial={{ scale: 0, bottom: '0px' }}
        animate={{ 
          scale: 1,
          bottom: '185px'
        }}
      >
        <Search className={cn(
          "w-6 h-6 transition-transform group-hover:scale-110",
          theme === 'dark' ? "text-violet-400" : "text-violet-600"
        )} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              onClick={handleClose}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: isMobile ? 20 : 0 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: isMobile ? 20 : 0 }}
              className={cn(
                "fixed z-[110] rounded-lg shadow-2xl overflow-hidden border flex flex-col",
                isMobile 
                  ? "bottom-20 left-4 right-4 max-h-[60vh]" 
                  : "bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl max-h-[70vh]",
                theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-indigo-600/10"
              )}
            >
              {/* Results Area */}
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                {query.trim() && results.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500">
                    Nenhum resultado encontrado para "{query}"
                  </div>
                ) : (
                  <div className="space-y-2">
                    {results.map((result, idx) => (
                      <React.Fragment key={idx}>
                        {result.type === 'estoque' && (
                          <CatalogItemCard 
                            item={result.data} 
                            theme={theme} 
                            onClick={() => {
                              onSelectItem(result.data);
                              handleClose();
                            }} 
                          />
                        )}
                        {result.type === 'moto' && (
                          <MotoItemCard 
                            item={result.data} 
                            theme={theme} 
                            onClick={() => {
                              onSelectItem(result.data);
                              handleClose();
                            }} 
                          />
                        )}
                        {result.type === 'venda' && (
                          <div 
                            className={cn(
                              "p-3 rounded-lg border cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200",
                              theme === 'dark' ? "bg-zinc-900/50 border-zinc-800" : "bg-white border-zinc-200"
                            )}
                            onClick={() => {
                              onSelectItem(result.data);
                              handleClose();
                            }}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className={cn("font-bold text-sm truncate pr-2", theme === 'dark' ? "text-zinc-200" : "text-zinc-900")}>
                                {result.data.nome ? result.data.nome.charAt(0).toUpperCase() + result.data.nome.slice(1) : ''}
                              </span>
                              <span className={cn(
                                "font-black text-sm whitespace-nowrap transition-all duration-300",
                                (result.data.tipo?.toUpperCase() === 'SAÍDA')
                                  ? "text-rose-500 [text-shadow:0_0_10px_rgba(244,63,94,0.5)]"
                                  : "text-emerald-500 [text-shadow:0_0_10px_rgba(16,185,129,0.5)]"
                              )}>
                                {result.data.tipo?.toUpperCase() === 'SAÍDA' ? '-' : ''}{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(result.data.valor))}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border shadow-sm",
                                result.data.tipo?.toUpperCase() === 'PIX' ? (theme === 'dark' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-600 border-emerald-200") :
                                result.data.tipo?.toUpperCase() === 'SAÍDA' ? (theme === 'dark' ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-rose-50 text-rose-600 border-rose-200") :
                                result.data.tipo?.toUpperCase() === 'DINHEIRO' ? (theme === 'dark' ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-green-50 text-green-600 border-green-200") :
                                result.data.tipo?.toUpperCase() === 'CRÉDITO' ? (theme === 'dark' ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : "bg-orange-50 text-orange-600 border-orange-200") :
                                result.data.tipo?.toUpperCase() === 'DÉBITO' ? (theme === 'dark' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-blue-50 text-blue-600 border-blue-200") :
                                result.data.tipo?.toUpperCase() === 'MARCELO' ? (theme === 'dark' ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-violet-50 text-violet-600 border-violet-200") :
                                result.data.tipo?.toUpperCase().includes('MERCADO LIVRE') ? (theme === 'dark' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-amber-50 text-amber-600 border-amber-200") :
                                (theme === 'dark' ? "bg-zinc-800 text-zinc-300 border-zinc-700" : "bg-zinc-100 text-zinc-600 border-zinc-200")
                              )}>
                                {result.data.tipo}
                              </span>
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border shadow-sm",
                                theme === 'dark' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-blue-50 text-blue-600 border-blue-200"
                              )}>
                                {formatDateRelative(result.data.data)}
                              </span>
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>

              {/* Search Input Area */}
              <div className={cn(
                "p-3 border-t",
                theme === 'dark' ? "border-zinc-800 bg-zinc-900" : "border-indigo-600/10 bg-white"
              )}>
                <div className="relative">
                  <Search className={cn(
                    "absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5",
                    theme === 'dark' ? "text-zinc-500" : "text-indigo-600"
                  )} />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar..."
                    className={cn(
                      "w-full pl-10 pr-10 py-2.5 rounded-lg outline-none transition-colors text-sm",
                      theme === 'dark' 
                        ? "bg-zinc-950 text-white placeholder-zinc-500 focus:ring-0" 
                        : "bg-gray-50 text-zinc-900 placeholder-zinc-400 focus:ring-1 focus:ring-indigo-600/50"
                    )}
                  />
                  {query && (
                    <button
                      onClick={() => setQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-zinc-400"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
