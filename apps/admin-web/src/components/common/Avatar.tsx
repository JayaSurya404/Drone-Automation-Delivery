import React, { useState } from 'react';

interface AvatarProps {
  name?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  status?: 'online' | 'offline' | 'busy' | 'away' | 'active' | 'suspended';
  showBorder?: boolean;
}

const SIZE_MAP = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
  '2xl': 'w-20 h-20 text-2xl',
};

const STATUS_SIZE_MAP = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-3.5 h-3.5',
  '2xl': 'w-4 h-4',
};

// Deterministic gradient palettes based on name hash
const GRADIENTS = [
  'from-cyan-600 to-blue-700 text-white',
  'from-emerald-600 to-teal-700 text-white',
  'from-violet-600 to-purple-700 text-white',
  'from-indigo-600 to-blue-800 text-white',
  'from-amber-600 to-orange-700 text-white',
  'from-rose-600 to-pink-700 text-white',
  'from-teal-600 to-emerald-800 text-white',
  'from-sky-600 to-indigo-700 text-white',
];

const getInitials = (name?: string): string => {
  if (!name || !name.trim()) return 'SK';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getGradient = (name?: string): string => {
  if (!name) return GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index];
};

export const Avatar: React.FC<AvatarProps> = ({
  name = 'User',
  src,
  size = 'md',
  className = '',
  status,
  showBorder = true,
}) => {
  const [hasError, setHasError] = useState(!src);
  const initials = getInitials(name);
  const gradientClass = getGradient(name);
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;
  const statusSize = STATUS_SIZE_MAP[size] || STATUS_SIZE_MAP.md;

  const renderStatus = () => {
    if (!status) return null;
    let color = 'bg-emerald-500';
    if (status === 'busy' || status === 'suspended') color = 'bg-rose-500';
    else if (status === 'away') color = 'bg-amber-500';
    else if (status === 'offline') color = 'bg-slate-400';

    return (
      <span
        className={`absolute bottom-0 right-0 ${statusSize} rounded-full ${color} ring-2 ring-white dark:ring-slate-950`}
      />
    );
  };

  if (!hasError && src) {
    return (
      <div className={`relative inline-block shrink-0 ${className}`}>
        <img
          src={src}
          alt={name}
          onError={() => setHasError(true)}
          className={`${sizeClasses} rounded-full object-cover ${
            showBorder ? 'border-2 border-slate-200 dark:border-slate-800 shadow-sm' : ''
          }`}
        />
        {renderStatus()}
      </div>
    );
  }

  return (
    <div className={`relative inline-block shrink-0 ${className}`}>
      <div
        className={`${sizeClasses} rounded-full bg-gradient-to-tr ${gradientClass} flex items-center justify-center font-bold tracking-wider select-none shadow-sm ${
          showBorder ? 'ring-2 ring-white/20 dark:ring-slate-800' : ''
        }`}
        title={name}
      >
        <span>{initials}</span>
      </div>
      {renderStatus()}
    </div>
  );
};
