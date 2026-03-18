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
  theme: 'light' | 'dark';
  className?: string;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({ options, value, onChange, theme, className }) => {
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
          "w-full flex items-center justify-between border rounded-xl py-2.5 px-4 text-sm outline-none transition-all",
          isOpen ? "ring-2 ring-violet-500/50 border-violet-500" : "focus:ring-2 focus:ring-violet-500/50",
          theme === 'dark' 
            ? "bg-zinc-950 border-zinc-800 text-zinc-200 hover:border-zinc-700" 
            : "bg-white border-zinc-200 text-zinc-900 hover:border-zinc-300"
        )}
      >
        <span className="truncate">{selectedOption?.label || 'Selecione...'}</span>
        <ChevronDown size={16} className={cn("transition-transform text-zinc-500", isOpen ? "rotate-180 text-violet-500" : "")} />
      </button>

      {isOpen && (
        <div className={cn(
          "absolute top-full left-0 w-full mt-1.5 rounded-xl border shadow-2xl z-[100] overflow-y-auto max-h-60 py-1 animate-in fade-in slide-in-from-top-2 duration-200",
          theme === 'dark' ? "bg-zinc-900 border-zinc-800 shadow-black/50" : "bg-white border-zinc-200 shadow-zinc-200/50"
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
                  ? theme === 'dark' ? "bg-violet-600/20 text-violet-400" : "bg-violet-50 text-violet-600"
                  : theme === 'dark'
                    ? "text-zinc-300 hover:bg-zinc-800"
                    : "text-zinc-700 hover:bg-zinc-100"
              )}
            >
              {option.label}
              {value === option.value && (
                <div className={cn("w-2 h-2 rounded-full", theme === 'dark' ? "bg-violet-400" : "bg-violet-600")} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
