import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  theme?: 'light' | 'dark';
  maxWidth?: string;
  icon?: React.ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  theme = 'dark',
  maxWidth = 'max-w-2xl',
  icon,
  iconBgColor = 'bg-zinc-800/50',
  iconColor = 'text-zinc-400',
  footer
}) => {
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

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className={cn(
        "relative w-full rounded-3xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col",
        maxWidth,
        theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900"
      )}>
        {/* Header */}
        <div className={cn(
          "p-6 border-b flex items-center justify-between shrink-0",
          theme === 'dark' ? "border-zinc-800/50" : "border-zinc-100"
        )}>
          <div className="flex items-center gap-3">
            {icon && (
              <div className={cn("p-2 rounded-xl", iconBgColor, iconColor)}>
                {icon}
              </div>
            )}
            {title && <h3 className="text-lg font-bold">{title}</h3>}
          </div>
          <button 
            onClick={onClose}
            className={cn(
              "p-2 rounded-xl transition-colors",
              theme === 'dark' ? "hover:bg-zinc-800 text-zinc-500" : "hover:bg-zinc-100 text-zinc-400"
            )}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(100vh-12rem)]">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className={cn(
            "p-6 border-t flex items-center justify-end gap-3 shrink-0",
            theme === 'dark' ? "border-zinc-800/50 bg-zinc-950/20" : "border-zinc-100 bg-zinc-50/50"
          )}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
