import { LayoutDashboard, Package, ShoppingCart, Bike, Truck, TrendingUp } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MobileBottomNav = ({ activeTab, setActiveTab, theme }: any) => {
  const userRole = localStorage.getItem('user_role') || 'client';
  
  const allItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Início', roles: ['admin'] },
    { id: 'estoque', icon: Package, label: userRole === 'admin' ? 'Estoque' : 'Catálogo', roles: ['admin', 'client'] },
    { id: 'vendas', icon: ShoppingCart, label: 'Vendas', roles: ['admin'] },
    { id: 'motos', icon: Bike, label: 'Motos', roles: ['admin', 'client'] },
  ];

  const items = allItems.filter(item => item.roles.includes(userRole));

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 md:hidden border-t pb-safe",
      theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200"
    )}>
      <div className="flex justify-around items-center h-16">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-full h-full transition-colors relative",
              activeTab === item.id 
                ? "text-violet-500" 
                : theme === 'dark' ? "text-zinc-500" : "text-zinc-400"
            )}
          >
            <item.icon size={22} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
