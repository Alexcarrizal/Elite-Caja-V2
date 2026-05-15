import React from 'react';
import { CreditCard, Check, ArrowUpRight } from 'lucide-react';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export default function Logo({ className = '', showText = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Icon portion */}
      <div className="relative flex-shrink-0 flex items-center justify-center">
        <div className="relative z-10 w-12 h-14 bg-gradient-to-br from-[#d4af37] to-[#aa8c2c] rounded-md shadow-lg flex flex-col items-center p-1.5 border border-[#e6c762]">
          <div className="w-6 h-3 bg-white/20 rounded-sm mb-1"></div>
          <div className="w-8 h-5 bg-white/90 rounded-sm mb-1 flex items-center justify-center">
             <Check className="w-4 h-4 text-[#d4af37] font-bold" strokeWidth={4} />
          </div>
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 bg-white/50 rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-white/50 rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-white/50 rounded-full"></div>
          </div>
        </div>
        {/* Swoosh arrow */}
        <div className="absolute -right-2 top-0 z-20 text-[#d4af37] transform rotate-12">
          <ArrowUpRight className="w-7 h-7" strokeWidth={3} />
        </div>
      </div>

      {/* Text portion */}
      {showText && (
        <div className="flex flex-col justify-center">
           <span className="text-3xl font-extrabold text-[#0a192f] dark:text-white tracking-tight leading-none" style={{ fontFamily: 'sans-serif' }}>
            EliteCaja
          </span>
          <span className="text-[0.6rem] font-bold text-[#0a192f] dark:text-gray-300 tracking-[0.15em] mt-1 whitespace-nowrap">
            SISTEMA DE PUNTO DE VENTA
          </span>
        </div>
      )}
    </div>
  );
}
