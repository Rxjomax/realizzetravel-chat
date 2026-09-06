import React from 'react';

interface RealizzeLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  variant?: 'badge' | 'horizontal' | 'icon';
  className?: string;
}

export const RealizzeLogo: React.FC<RealizzeLogoProps> = ({
  size = 'md',
  variant = 'badge',
  className = '',
}) => {
  const pixelSizes = {
    sm: 32,
    md: 44,
    lg: 64,
    xl: 96,
  };

  const dimension = typeof size === 'number' ? size : pixelSizes[size] || 44;

  if (variant === 'horizontal') {
    return (
      <div className={`inline-flex items-center gap-2.5 ${className}`}>
        {/* Navy square badge with star and logo */}
        <div
          style={{ width: dimension, height: dimension }}
          className="rounded-xl overflow-hidden shadow-sm shrink-0 bg-[#040e21] border border-amber-500/30 flex items-center justify-center p-1"
        >
          <img
            src="/realizze-logo.svg"
            alt="RealizzeTravel Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-1">
            <span className="font-extrabold tracking-wider text-amber-500 font-sans text-base leading-none">
              REALIZZE
            </span>
            <span className="text-amber-400 text-xs">✦</span>
          </div>
          <span className="text-[11px] font-semibold text-slate-400 tracking-widest leading-none mt-0.5">
            travel
          </span>
        </div>
      </div>
    );
  }

  // Badge or icon variant
  return (
    <div
      style={{ width: dimension, height: dimension }}
      className={`relative inline-block rounded-xl overflow-hidden shrink-0 shadow-sm bg-[#040e21] border border-amber-500/25 ${className}`}
    >
      <img
        src="/realizze-logo.svg"
        alt="RealizzeTravel Logo"
        className="w-full h-full object-contain"
      />
    </div>
  );
};
