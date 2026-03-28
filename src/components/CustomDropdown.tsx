import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../utils';

interface Option {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  theme?: 'light' | 'dark';
  className?: string;
  icon?: React.ReactNode;
  hideValue?: boolean;
  compact?: boolean; // Novo: modo apenas ícone redondo
  variant?: 'pill' | 'form'; // Novo: variante para formulários
  label?: string;
  placeholder?: string;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({ 
  options, 
  value, 
  onChange, 
  className, 
  icon, 
  hideValue, 
  compact, 
  variant = 'pill', 
  theme = 'light',
  label,
  placeholder
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);
  const isDefault = value === 'Todas' || value === 'criado_em' || value === '';

  // Estilo padronizado (fundo branco, borda #eef2f6, border-radius 12px)
  const pillStyles = cn(
    "flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 border text-sm font-medium whitespace-nowrap shadow-sm",
    theme === 'dark'
      ? "bg-zinc-900 border-zinc-800 text-zinc-200 hover:border-zinc-700"
      : "bg-white border-[#eef2f6] text-zinc-700 hover:border-zinc-300"
  );

  // Estilo "Form" para modais
  const formStyles = cn(
    "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none transition-all flex items-center justify-between",
    theme === 'dark' 
      ? "bg-zinc-900 border-zinc-800 text-zinc-200 hover:border-zinc-700" 
      : "bg-white border-[#eef2f6] text-zinc-700 hover:border-zinc-300",
    isOpen && "border-violet-500 ring-1 ring-violet-500/20"
  );

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={selectedOption?.label}
        className={cn(
          variant === 'form' ? formStyles : (compact ? "w-10 h-10 rounded-xl flex items-center justify-center border transition-all shadow-sm" : pillStyles),
          isOpen && variant !== 'form' && "ring-2 ring-violet-500/20 border-violet-500/50",
          compact && !isDefault ? "bg-violet-50 border-violet-200 text-violet-600 dark:bg-violet-500/10 dark:border-violet-500/30 dark:text-violet-500" : compact ? (theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-zinc-400" : "bg-white border-[#eef2f6] text-zinc-500") : ""
        )}
      >
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-2 overflow-hidden">
            {icon && <span className={cn("transition-colors shrink-0", !isDefault && variant !== 'form' && "text-violet-500")}>{icon}</span>}
            {!compact && <span className="truncate">{selectedOption?.label || placeholder || 'Selecione...'}</span>}
          </div>
          {!compact && <ChevronDown size={14} className={cn("transition-transform opacity-50 shrink-0", isOpen ? "rotate-180" : "")} />}
        </div>
      </button>

      {isOpen && (
        <div className={cn(
          "absolute top-full mt-2 rounded-2xl border shadow-2xl z-[150] overflow-y-auto max-h-60 py-2 animate-in fade-in slide-in-from-top-2 duration-200",
          compact ? "right-0 w-48" : "left-0 min-w-[180px] w-full",
          "bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-zinc-100 dark:border-zinc-800 shadow-zinc-200/50 dark:shadow-black/50"
        )}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={cn(
                "w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center justify-between",
                value === option.value
                  ? "bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 font-bold"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              )}
            >
              {option.label}
              {value === option.value && (
                <div className="w-1.5 h-1.5 rounded-full bg-violet-600 dark:bg-violet-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
