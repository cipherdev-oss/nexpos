import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Button({ 
  className, 
  variant = 'primary', 
  size = 'md',
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger',
  size?: 'sm' | 'md' | 'lg'
}) {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 rounded-xl font-semibold',
    secondary: 'bg-slate-800 text-slate-200 hover:bg-slate-700 rounded-xl',
    outline: 'border border-white/10 text-slate-300 hover:bg-white/5 rounded-xl',
    ghost: 'text-slate-400 hover:bg-white/5 hover:text-slate-200 rounded-xl',
    danger: 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 rounded-xl'
  };
  
  const sizes = {
    sm: 'px-4 py-2 text-xs tracking-wide',
    md: 'px-6 py-2.5 text-sm tracking-wide',
    lg: 'px-8 py-3 text-base tracking-wide'
  };

  return (
    <button 
      className={cn(
        'inline-flex items-center justify-center transition-all focus:outline-none active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-slate-200 text-sm placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all',
        className
      )}
      {...props}
    />
  );
}

export function Card({ className, children, title, ...props }: React.HTMLAttributes<HTMLDivElement> & { title?: string }) {
  return (
    <div className={cn('glass-card flex flex-col rounded-2xl overflow-hidden', className)} {...props}>
      {title && (
        <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between bg-white/5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</span>
          <div className="flex gap-1.5">
            <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
            <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
          </div>
        </div>
      )}
      <div className="p-6 flex-1">
        {children}
      </div>
    </div>
  );
}

export function formatCurrency(amount: number, currencyCode: string = 'USD') {
  const symbols: Record<string, string> = {
    'USD': '$',
    'LKR': 'Rs.',
    'EUR': '€',
    'GBP': '£',
    'INR': '₹'
  };
  const symbol = symbols[currencyCode] || currencyCode;
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function MonospaceValue({ value, label, className }: { value: string | number, label: string, className?: string }) {
  return (
    <div className={cn("flex flex-col", className)}>
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</span>
      <span className="text-sm font-mono font-medium text-slate-100">{value}</span>
    </div>
  );
}
