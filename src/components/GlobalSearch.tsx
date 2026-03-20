import React, { useState, useRef, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, Package, ShoppingCart, Bike } from 'lucide-react';
import { DataContext } from '../App';

interface GlobalSearchProps {
  theme: 'light' | 'dark';
  onSelectItem: (item: any) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ theme, onSelectItem }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { inventory, sales, motos } = useContext(DataContext);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    setQuery('');
  };

  const getResults = () => {
    if (!query.trim()) return [];
    
    const lowerQuery = query.toLowerCase();
    const results = [];

    // Search Inventory
    const inventoryMatches = inventory.filter(item => 
      item.name?.toLowerCase().includes(lowerQuery) || 
      item.sku?.toLowerCase().includes(lowerQuery) ||
      item.category?.toLowerCase().includes(lowerQuery)
    ).map(item => ({ ...item, type: 'estoque' }));
    results.push(...inventoryMatches);

    // Search Sales
    const salesMatches = sales.filter(sale => 
      sale.customer?.toLowerCase().includes(lowerQuery) || 
      sale.items?.some((i: any) => i.name?.toLowerCase().includes(lowerQuery)) ||
      sale.id?.toLowerCase().includes(lowerQuery)
    ).map(sale => ({ ...sale, type: 'venda' }));
    results.push(...salesMatches);

    // Search Motos
    const motosMatches = motos.filter(moto => 
      moto.model?.toLowerCase().includes(lowerQuery) || 
      moto.brand?.toLowerCase().includes(lowerQuery) ||
      moto.plate?.toLowerCase().includes(lowerQuery)
    ).map(moto => ({ ...moto, type: 'moto' }));
    results.push(...motosMatches);

    return results.slice(0, 8); // Limit total results
  };

  const results = getResults();

  const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

  return (
    <>
      <motion.button
        className={cn(
          "fixed bottom-8 right-8 w-14 h-14 rounded-full flex items-center justify-center z-50 transition-all duration-300 group",
          theme === 'dark' 
            ? "bg-[#1E1E2F] hover:bg-[#2D2D44] border border-[#A5B4FC]/10 shadow-[0_8px_30px_rgba(0,0,0,0.3)]" 
            : "bg-white hover:bg-gray-50 border border-indigo-600/10 shadow-[0_8px_30px_rgba(0,0,0,0.1)]"
        )}
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
      >
        <Search className={cn(
          "w-6 h-6 transition-transform group-hover:scale-110",
          theme === 'dark' ? "text-[#A5B4FC]" : "text-indigo-600"
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
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn(
                "fixed bottom-28 right-8 w-[400px] max-h-[600px] z-50 rounded-2xl shadow-2xl overflow-hidden border flex flex-col",
                theme === 'dark' ? "bg-[#1E1E2F] border-[#A5B4FC]/10" : "bg-white border-indigo-600/10"
              )}
            >
              {/* Results Area (Appears above input) */}
              <div className="flex-1 overflow-y-auto p-2 flex flex-col">
                {query.trim() && results.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500">
                    Nenhum resultado encontrado para "{query}"
                  </div>
                ) : (
                  <div className="space-y-1">
                    {results.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          onSelectItem(item);
                          handleClose();
                        }}
                        className={cn(
                          "w-full text-left p-3 rounded-xl flex items-center gap-3 transition-colors",
                          theme === 'dark' 
                            ? "hover:bg-[#2D2D44] text-zinc-300" 
                            : "hover:bg-gray-50 text-zinc-700"
                        )}
                      >
                        <div className={cn(
                          "p-2 rounded-lg",
                          theme === 'dark' ? "bg-[#1E1E2F] text-[#A5B4FC]" : "bg-indigo-50 text-indigo-600"
                        )}>
                          {item.type === 'estoque' && <Package size={16} />}
                          {item.type === 'venda' && <ShoppingCart size={16} />}
                          {item.type === 'moto' && <Bike size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {item.name || item.customer || item.model}
                          </p>
                          <p className="text-xs opacity-60 truncate">
                            {item.type === 'estoque' && `SKU: ${item.sku} • ${item.category}`}
                            {item.type === 'venda' && `ID: ${item.id} • ${new Date(item.date).toLocaleDateString()}`}
                            {item.type === 'moto' && `Placa: ${item.plate} • ${item.brand}`}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Search Input Area */}
              <div className={cn(
                "p-4 border-t",
                theme === 'dark' ? "border-[#A5B4FC]/10 bg-[#1E1E2F]" : "border-indigo-600/10 bg-white"
              )}>
                <div className="relative">
                  <Search className={cn(
                    "absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5",
                    theme === 'dark' ? "text-[#A5B4FC]" : "text-indigo-600"
                  )} />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar em todo o sistema..."
                    className={cn(
                      "w-full pl-10 pr-10 py-3 rounded-xl outline-none transition-colors",
                      theme === 'dark' 
                        ? "bg-[#2D2D44] text-white placeholder-zinc-500 focus:ring-1 focus:ring-[#A5B4FC]/50" 
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
