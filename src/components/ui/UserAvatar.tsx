'use client';

import React, { useState, useEffect } from 'react';

export interface UserAvatarProps {
  src?: string | null;
  imageUrl?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  alt?: string;
  bordered?: boolean;
}

const sizeClasses: Record<NonNullable<UserAvatarProps['size']>, { container: string; text: string }> = {
  xs: { container: 'w-6 h-6', text: 'text-[10px]' },
  sm: { container: 'w-8 h-8', text: 'text-xs' },
  md: { container: 'w-10 h-10', text: 'text-sm' },
  lg: { container: 'w-14 h-14', text: 'text-lg font-extrabold' },
  xl: { container: 'w-24 h-24 sm:w-28 sm:h-28', text: 'text-3xl sm:text-4xl font-black' },
};

/**
 * Extracts clean user initials from full name.
 * Examples:
 * - "Gayathri" -> "G"
 * - "Rahul Kumar" -> "RK"
 * - "Rajesh Sharma" -> "RS"
 */
export function getInitials(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'U';
  const clean = name.trim();
  if (!clean) return 'U';

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function UserAvatar({
  src,
  imageUrl,
  name,
  size = 'md',
  className = '',
  alt,
  bordered = true,
}: UserAvatarProps) {
  const effectiveSrc = imageUrl ?? src;
  const [hasError, setHasError] = useState(false);

  // Reset error status if the source image changes
  useEffect(() => {
    setHasError(false);
  }, [effectiveSrc]);

  const sizeStyle = sizeClasses[size] || sizeClasses.md;
  const initials = getInitials(name);
  const altText = alt || (name ? `${name} profile picture` : 'User profile picture');

  const borderClass = bordered ? 'border border-emerald-300/80 shadow-xs' : '';

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold select-none overflow-hidden flex-shrink-0 ${sizeStyle.container} ${borderClass} ${className}`}
      aria-label={altText}
    >
      {effectiveSrc && !hasError ? (
        <img
          src={effectiveSrc}
          alt={altText}
          onError={() => setHasError(true)}
          className="w-full h-full object-cover rounded-full"
          loading="lazy"
        />
      ) : (
        <span className={`${sizeStyle.text} uppercase tracking-tight`}>
          {initials}
        </span>
      )}
    </div>
  );
}
