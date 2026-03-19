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
  theme?: 'light' | 'dark'; // Keep for compatibility but don't strictly rely on it
  className?: string;
  icon?: React.ReactNode;
  hideValue?: boolean;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({ options, value, onChange, className, icon, hideValue }) => {
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

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between border rounded-xl py-2.5 px-4 text-sm outline-none transition-all shadow-sm",
          isOpen ? "ring-2 ring-violet-500/20 border-violet-500" : "focus:ring-2 focus:ring-violet-500/20",
          "bg-white dark:bg-zinc-900 border-[#eef2f6] dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700"
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {icon && <span className="text-zinc-500 dark:text-zinc-400">{icon}</span>}
          {!hideValue && <span className="truncate font-medium">{selectedOption?.label || 'Selecione...'}</span>}
        </div>
        {!hideValue && <ChevronDown size={16} className={cn("transition-transform text-zinc-400 ml-2", isOpen ? "rotate-180 text-violet-500" : "")} />}
      </button>

      {isOpen && (
        <div className={cn(
          "absolute top-full left-0 w-full mt-1.5 rounded-xl border shadow-2xl z-[100] overflow-y-auto max-h-60 py-1 animate-in fade-in slide-in-from-top-2 duration-200",
          "bg-white dark:bg-zinc-900 border-[#eef2f6] dark:border-zinc-800 shadow-zinc-200/50 dark:shadow-black/50"
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
                "w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between",
                value === option.value
                  ? "bg-violet-50 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 font-bold"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
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
