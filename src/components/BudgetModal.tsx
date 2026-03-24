import React, { useState, useMemo, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Copy, 
  Check, 
  DollarSign,
  Bike,
  Package,
  ShoppingCart,
  Tag
} from 'lucide-react';
import { cn } from '../utils';
import { DataContext } from '../App';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
}

export const BudgetModal: React.FC<BudgetModalProps> = ({ isOpen, onClose, theme }) => {
  const { inventory: items } = useContext(DataContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [discount, setDiscount] = useState(0);
  const [copied, setCopied] = useState(false);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return items.filter(item => 
      item.nome.toLowerCase().includes(term) || 
      item.moto.toLowerCase().includes(term) ||
      item.categoria.toLowerCase().includes(term)
    ).slice(0, 10);
  }, [items, searchTerm]);

  const addToBudget = (item: any) => {
    const existing = selectedItems.find(i => i.id === item.id);
    if (existing) {
      setSelectedItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setSelectedItems(prev => [...prev, { ...item, quantity: 1 }]);
    }
    setSearchTerm('');
  };

  const removeFromBudget = (id: string) => {
    setSelectedItems(prev => prev.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setSelectedItems(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const clearBudget = () => {
    setSelectedItems([]);
    setDiscount(0);
  };

  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');

  const total = selectedItems.reduce((acc, item) => acc + (item.valor * item.quantity), 0);
  const discountAmount = discountType === 'fixed' ? discount : (total * (discount / 100));
  const finalTotal = Math.max(0, total - discountAmount);

  const copyBudget = () => {
    const budgetText = selectedItems.map(item => {
      // Extract moto name from part name to avoid duplication
      let cleanName = item.nome;
      const motoName = item.moto;
      
      // Case-insensitive replacement of moto name in part name
      // We also try to catch common separators around the moto name
      const separators = ['-', '/', '\\|', ':', '—'];
      const sepRegex = new RegExp(`\\s*(${separators.join('|')})?\\s*${motoName}\\s*(${separators.join('|')})?\\s*`, 'gi');
      
      cleanName = cleanName.replace(sepRegex, ' ').trim();
      
      // Final cleanup of any double spaces or trailing/leading separators
      cleanName = cleanName.replace(/\s+/g, ' ')
                          .replace(/^[\s\-\/|:—]+|[\s\-\/|:—]+$/g, '')
                          .trim();

      const itemTotal = item.valor * item.quantity;
      const priceDisplay = item.quantity > 1 
        ? `${item.quantity}x R$ ${item.valor.toFixed(2)} = R$ ${itemTotal.toFixed(2)}`
        : `R$ ${item.valor.toFixed(2)}`;

      return `• ${cleanName} (${motoName}) - ${priceDisplay}`;
    }).join('\n');

    const fullText = `📋 *ORÇAMENTO - RK SUCATAS*\n\n${budgetText}\n\n` +
      `--------------------------\n` +
      `Subtotal: R$ ${total.toFixed(2)}\n` +
      (discountAmount > 0 ? `Desconto (${discountType === 'fixed' ? 'R$' : discount + '%'}): R$ ${discountAmount.toFixed(2)}\n` : '') +
      `*TOTAL: R$ ${finalTotal.toFixed(2)}*\n\n` +
      `_Preços sujeitos a alteração sem aviso prévio._`;

    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          {/* Blur Overlay at Top */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 backdrop-blur-md bg-black/40 cursor-pointer"
          />
          
          {/* Modal Content */}
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: "0%" }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={cn(
              "relative h-[92vh] md:h-[85vh] w-full rounded-t-[2rem] md:rounded-t-[2.5rem] shadow-2xl flex flex-col overflow-hidden",
              theme === 'dark' ? "bg-zinc-950 text-white border-t border-zinc-800" : "bg-white text-zinc-900 border-t border-zinc-200"
            )}
          >
            {/* Header */}
            <div className="px-4 py-2.5 md:px-6 md:py-4 border-b border-zinc-800/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 bg-violet-500/20 rounded-xl">
                  <DollarSign className="text-violet-500" size={16} />
                </div>
                <div>
                  <h2 className="text-sm md:text-lg font-bold leading-tight">Orçamento</h2>
                  <p className="text-[8px] md:text-[10px] text-zinc-500">Gere orçamentos rápidos</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {selectedItems.length > 0 && (
                  <button 
                    onClick={clearBudget}
                    className={cn(
                      "p-2 rounded-xl transition-all active:scale-90 text-[10px] font-bold uppercase tracking-wider",
                      theme === 'dark' ? "hover:bg-rose-500/10 text-rose-400" : "hover:bg-rose-50 text-rose-600"
                    )}
                  >
                    Limpar
                  </button>
                )}
                <button 
                  onClick={onClose}
                  className={cn(
                    "p-2 rounded-full transition-colors active:scale-90",
                    theme === 'dark' ? "hover:bg-zinc-900 text-zinc-400" : "hover:bg-zinc-100 text-zinc-600"
                  )}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3 md:space-y-6 scrollbar-hide">
              {/* Search Section */}
              <div className="relative">
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-xl md:rounded-2xl border transition-all focus-within:ring-2 focus-within:ring-violet-500/50",
                  theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
                )}>
                  <Search size={14} className="text-zinc-500" />
                  <input 
                    type="text"
                    placeholder="Pesquisar peça, moto..."
                    className="bg-transparent border-none outline-none flex-1 text-xs md:text-sm py-0.5"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Search Results Dropdown */}
                <AnimatePresence>
                  {filteredItems.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className={cn(
                        "absolute top-full left-0 right-0 mt-2 z-10 rounded-2xl border shadow-2xl overflow-hidden",
                        theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                      )}
                    >
                      {filteredItems.map(item => (
                        <button
                          key={item.id}
                          onClick={() => addToBudget(item)}
                          className={cn(
                            "w-full p-3 flex items-center justify-between transition-colors text-left border-b last:border-none active:bg-violet-500/10",
                            theme === 'dark' ? "hover:bg-zinc-800 border-zinc-800/50" : "hover:bg-zinc-50 border-zinc-100"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                              <Package size={14} className="text-zinc-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate">{item.nome}</p>
                              <p className="text-[9px] text-zinc-500 flex items-center gap-1 truncate">
                                <Bike size={8} /> {item.moto}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-black text-emerald-400">R$ {item.valor.toFixed(2)}</p>
                            <p className="text-[8px] text-zinc-500 uppercase font-bold">Estoque: {item.estoque}</p>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Selected Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[9px] md:text-xs font-black uppercase tracking-widest text-zinc-500">Peças Selecionadas</h3>
                  {selectedItems.length > 0 && (
                    <span className="text-[9px] font-bold px-2 py-0.5 bg-violet-500/10 text-violet-500 rounded-full">
                      {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'itens'}
                    </span>
                  )}
                </div>
                
                {selectedItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 md:py-12 text-zinc-500 border-2 border-dashed border-zinc-800/30 rounded-2xl">
                    <ShoppingCart className="mb-2 opacity-10" size={32} />
                    <p className="text-[10px]">Nenhuma peça adicionada</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {selectedItems.map(item => (
                      <div 
                        key={item.id}
                        className={cn(
                          "p-2 md:p-4 rounded-xl md:rounded-2xl border flex items-center justify-between",
                          theme === 'dark' ? "bg-zinc-900/40 border-zinc-800/60" : "bg-zinc-50 border-zinc-200"
                        )}
                      >
                        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                          <button 
                            onClick={() => removeFromBudget(item.id)}
                            className="p-1 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
                          >
                            <Trash2 size={12} />
                          </button>
                          <div className="min-w-0">
                            <p className="text-[11px] md:text-xs font-bold truncate leading-tight">{item.nome}</p>
                            <p className="text-[8px] md:text-[9px] text-zinc-500 truncate">{item.moto}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 md:gap-6 shrink-0">
                          <div className={cn(
                            "flex items-center gap-1 rounded-lg p-0.5 border",
                            theme === 'dark' ? "bg-black border-zinc-800" : "bg-white border-zinc-200"
                          )}>
                            <button 
                              onClick={() => updateQuantity(item.id, -1)}
                              className={cn(
                                "p-0.5 md:p-1 rounded-md transition-colors",
                                theme === 'dark' ? "hover:bg-zinc-800" : "hover:bg-zinc-100"
                              )}
                            >
                              <Minus size={8} />
                            </button>
                            <span className="text-[9px] md:text-[10px] font-black w-3 text-center">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.id, 1)}
                              className={cn(
                                "p-0.5 md:p-1 rounded-md transition-colors",
                                theme === 'dark' ? "hover:bg-zinc-800" : "hover:bg-zinc-100"
                              )}
                            >
                              <Plus size={8} />
                            </button>
                          </div>
                          <div className="text-right min-w-[55px] md:min-w-[65px]">
                            <p className="text-[11px] md:text-xs font-black text-emerald-400">R$ {(item.valor * item.quantity).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer / Summary */}
            <div className={cn(
              "p-3 md:p-8 border-t space-y-3 md:space-y-6 shrink-0",
              theme === 'dark' ? "bg-zinc-950/95 border-zinc-800/50 backdrop-blur-2xl" : "bg-zinc-50/95 border-zinc-200 backdrop-blur-2xl"
            )}>
              {/* Discount Section */}
              <div className={cn(
                "group p-3 md:p-4 rounded-[1.2rem] md:rounded-[1.5rem] border transition-all duration-300",
                theme === 'dark' 
                  ? "bg-zinc-900/50 border-zinc-800/50 hover:border-violet-500/30 hover:bg-zinc-900/80" 
                  : "bg-white border-zinc-200 shadow-sm hover:border-violet-200"
              )}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-1.5 md:p-2 rounded-xl transition-colors",
                      theme === 'dark' ? "bg-violet-500/10 text-violet-400" : "bg-violet-50 text-violet-600"
                    )}>
                      <Tag size={14} className="md:w-4 md:h-4 animate-pulse" />
                    </div>
                    <div>
                      <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 block mb-0.5">Desconto Especial</span>
                      <p className="text-[8px] md:text-[9px] text-zinc-400 font-medium">Fixo ou porcentagem</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-2 md:gap-3">
                    {/* Toggle Fixed/Percent */}
                    <div className={cn(
                      "flex p-0.5 md:p-1 rounded-lg md:rounded-xl border",
                      theme === 'dark' ? "bg-black border-zinc-800" : "bg-zinc-100 border-zinc-200"
                    )}>
                      <button 
                        onClick={() => setDiscountType('fixed')}
                        className={cn(
                          "px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg text-[9px] md:text-[10px] font-black transition-all duration-300",
                          discountType === 'fixed' 
                            ? "bg-violet-600 text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]" 
                            : "text-zinc-500 hover:text-zinc-300"
                        )}
                      >
                        R$
                      </button>
                      <button 
                        onClick={() => setDiscountType('percent')}
                        className={cn(
                          "px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg text-[9px] md:text-[10px] font-black transition-all duration-300",
                          discountType === 'percent' 
                            ? "bg-violet-600 text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]" 
                            : "text-zinc-500 hover:text-zinc-300"
                        )}
                      >
                        %
                      </button>
                    </div>

                    <div className="relative group/input flex-1 sm:flex-none">
                      <div className={cn(
                        "absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none",
                        theme === 'dark' ? "text-violet-400" : "text-violet-600"
                      )}>
                        <span className="text-[10px] font-black">
                          {discountType === 'fixed' ? 'R$' : '%'}
                        </span>
                      </div>
                      <input 
                        type="number"
                        className={cn(
                          "w-full sm:w-24 pl-8 pr-4 py-2 md:py-2.5 rounded-xl border text-xs font-black text-right outline-none transition-all duration-300 focus:ring-2 focus:ring-violet-500/50",
                          theme === 'dark' 
                            ? "bg-black border-zinc-800 text-white focus:border-violet-500/50" 
                            : "bg-white border-zinc-200 text-zinc-900 focus:border-violet-500"
                        )}
                        value={discount || ''}
                        onChange={(e) => setDiscount(Number(e.target.value))}
                        placeholder="0.00"
                      />
                      {discount > 0 && (
                        <button 
                          onClick={() => setDiscount(0)}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 md:w-5 md:h-5 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                        >
                          <X size={8} className="md:w-2.5 md:h-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {discountType === 'percent' && (
                  <div className="flex gap-1.5 md:gap-2 mt-2 md:mt-3 pt-2 md:pt-3 border-t border-zinc-800/30">
                    {[5, 10, 15, 20].map(val => (
                      <button
                        key={val}
                        onClick={() => setDiscount(val)}
                        className={cn(
                          "flex-1 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black transition-all duration-300 border",
                          discount === val 
                            ? "bg-violet-600 text-white border-violet-500 shadow-lg" 
                            : theme === 'dark'
                              ? "bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300"
                              : "bg-white text-zinc-500 border-zinc-200 hover:border-violet-200 hover:text-violet-600"
                        )}
                      >
                        {val}%
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[8px] md:text-[10px] text-zinc-500 uppercase tracking-[0.3em] font-black mb-0.5 md:mb-1">Valor Total Final</span>
                    <div className="flex items-baseline gap-1.5 md:gap-2">
                      <span className="text-zinc-400 text-[10px] md:text-xs font-bold">R$</span>
                      <span className="text-2xl md:text-5xl font-black text-emerald-400 tracking-tighter [text-shadow:0_0_30px_rgba(52,211,153,0.4)]">
                        {finalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  {discountAmount > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-right"
                    >
                      <p className="text-[8px] md:text-[10px] font-black text-rose-400 flex items-center justify-end gap-1">
                        <Tag size={8} /> ECONOMIA
                      </p>
                      <p className="text-[10px] md:text-xs font-black text-rose-400">
                        - R$ {discountAmount.toFixed(2)}
                      </p>
                    </motion.div>
                  )}
                </div>

                <button 
                  onClick={copyBudget}
                  disabled={selectedItems.length === 0}
                  className={cn(
                    "relative group overflow-hidden flex items-center justify-center gap-2 md:gap-3 px-6 py-3.5 md:px-12 md:py-6 rounded-2xl md:rounded-[1.5rem] font-black transition-all duration-500 active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-[10px] md:text-sm uppercase tracking-[0.2em] shadow-2xl w-full",
                    copied 
                      ? "bg-emerald-500 text-white shadow-emerald-500/30" 
                      : "bg-violet-600 text-white hover:bg-violet-500 shadow-violet-600/40 hover:shadow-violet-600/60"
                  )}
                >
                  {/* Glossy Effect */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  {/* Animated Border/Glow */}
                  <div className="absolute -inset-[100%] bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:animate-[shimmer_2s_infinite] pointer-events-none" />

                  <div className="relative flex items-center gap-2 md:gap-3">
                    {copied ? <Check size={16} className="animate-bounce" /> : <Copy size={16} className="group-hover:rotate-12 transition-transform" />}
                    <span>{copied ? "Copiado com Sucesso!" : "Gerar Orçamento"}</span>
                  </div>
                </button>
              </div>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
