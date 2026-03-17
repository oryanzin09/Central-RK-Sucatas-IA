import React, { useState } from 'react';
import { TrendingUp, MessageSquare, Package, LayoutDashboard, Truck } from 'lucide-react';
import { MLDashboard } from '../components/ml/MLDashboard';
import { MobileDashboard } from '../components/ml/MobileDashboard';
import { MLQuestions } from '../components/ml/MLQuestions';
import { MLCatalog } from '../components/ml/MLCatalog';
import { MLSales } from '../components/ml/MLSales';

export const MercadoLivre = ({ theme }: { theme: string }) => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sales', label: 'Vendas', icon: Truck },
    { id: 'questions', label: 'Perguntas', icon: MessageSquare },
    { id: 'catalog', label: 'Catálogo', icon: Package }
  ];

  const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

  return (
    <div className="space-y-6">
      {/* Header com título e tabs */}
      <div className="flex items-center justify-between">
        <h2 className={cn("text-2xl font-bold", theme === 'dark' ? "text-white" : "text-zinc-900")}>
          Mercado Livre
        </h2>
        <div className={cn("flex items-center gap-2 p-1 rounded-xl", theme === 'dark' ? "bg-zinc-800/50" : "bg-zinc-200/50")}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                  : theme === 'dark' ? "text-zinc-400 hover:text-white" : "text-zinc-600 hover:text-zinc-900"
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo das abas */}
      <div>
        {activeTab === 'dashboard' && (
          <>
            <div className="hidden md:block">
              <MLDashboard theme={theme} />
            </div>
            <div className="md:hidden">
              <MobileDashboard theme={theme} />
            </div>
          </>
        )}
        {activeTab === 'sales' && <MLSales theme={theme} />}
        {activeTab === 'questions' && <MLQuestions theme={theme} />}
        {activeTab === 'catalog' && <MLCatalog theme={theme} />}
      </div>
    </div>
  );
};
