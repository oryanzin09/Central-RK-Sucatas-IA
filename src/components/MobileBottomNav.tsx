import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Bike, 
  Truck, 
  Users, 
  MoreHorizontal, 
  MessageSquare, 
  Store, 
  UserCog, 
  Activity,
  X
} from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MobileBottomNav = ({ activeTab, setActiveTab, theme, userRole }: any) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  
  const allItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Início', roles: ['admin', 'gerente'] },
    { id: 'estoque', icon: Package, label: 'Estoque', roles: ['admin', 'gerente', 'estoque'] },
    { id: 'vendas', icon: ShoppingCart, label: 'Vendas', roles: ['admin', 'gerente'] },
    { id: 'motos', icon: Bike, label: 'Motos', roles: ['admin', 'gerente', 'estoque', 'client'] },
    { id: 'atendimento', icon: MessageSquare, label: 'Chat', roles: ['admin', 'gerente', 'estoque'] },
    { id: 'clients', icon: Users, label: 'Clientes', roles: ['admin', 'gerente'] },
    { id: 'mercadolivre', icon: Store, label: 'ML', roles: ['admin', 'gerente'] },
    { id: 'frete', icon: Truck, label: 'Frete', roles: ['admin', 'gerente'] },
    { id: 'users', icon: UserCog, label: 'Staff', roles: ['admin'] },
    { id: 'audit', icon: Activity, label: 'Auditoria', roles: ['admin'] },
  ];

  const allowedItems = allItems.filter(item => item.roles.includes(userRole));
  
  // Primeiros 4 itens para a barra principal
  const mainItems = allowedItems.slice(0, 4);
  // Itens restantes para o menu "Mais"
  const moreItems = allowedItems.slice(4);

  const handleTabClick = (id: string) => {
    setActiveTab(id);
    setIsMoreOpen(false);
  };

  return (
    <>
      <div className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden border-t pb-safe",
        theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200"
      )}>
        <div className="flex justify-around items-center h-16">
          {mainItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-full h-full transition-colors relative",
                activeTab === item.id 
                  ? "text-violet-500" 
                  : theme === 'dark' ? "text-zinc-500" : "text-zinc-400"
              )}
            >
              <item.icon size={22} />
              <span className="text-[10px] font-medium truncate w-full text-center px-1">{item.label}</span>
            </button>
          ))}
          
          {moreItems.length > 0 && (
            <button
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-full h-full transition-colors relative",
                isMoreOpen || moreItems.some(i => i.id === activeTab)
                  ? "text-violet-500" 
                  : theme === 'dark' ? "text-zinc-500" : "text-zinc-400"
              )}
            >
              <MoreHorizontal size={22} />
              <span className="text-[10px] font-medium">Mais</span>
            </button>
          )}
        </div>
      </div>

      {/* Menu "Mais" Overlay */}
      <AnimatePresence>
        {isMoreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMoreOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] md:hidden"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={cn(
                "fixed bottom-0 left-0 right-0 z-[60] md:hidden rounded-t-3xl p-6 pb-nav-safe",
                theme === 'dark' ? "bg-zinc-900 border-t border-zinc-800" : "bg-white border-t border-zinc-200"
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className={cn(
                  "text-lg font-bold",
                  theme === 'dark' ? "text-white" : "text-zinc-900"
                )}>
                  Mais Opções
                </h3>
                <button 
                  onClick={() => setIsMoreOpen(false)}
                  className={cn(
                    "p-2 rounded-full",
                    theme === 'dark' ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-500"
                  )}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {moreItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-3 p-4 rounded-2xl transition-all",
                      activeTab === item.id
                        ? "bg-violet-500/10 text-violet-500 border border-violet-500/20"
                        : theme === 'dark' ? "bg-zinc-800/50 text-zinc-400 border border-transparent" : "bg-zinc-50 text-zinc-500 border border-transparent"
                    )}
                  >
                    <item.icon size={24} />
                    <span className="text-[11px] font-bold text-center">{item.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
