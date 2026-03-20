import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateRelative(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

  let relative = '';
  if (diffDays === 0) relative = 'hoje';
  else if (diffDays === 1) relative = 'ontem';
  else relative = `${diffDays} dias atrás`;

  return `${formattedDate} (${relative})`;
}
