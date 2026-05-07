'use client';

import React from 'react';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  animate?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  className = '',
  variant = 'rectangular',
  animate = true,
}) => {
  const baseStyles = 'bg-slate-200';

  const variantStyles = {
    text: 'rounded',
    circular: '',
    rectangular: 'rounded-lg',
  };

  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    ...(variant === 'circular' && { borderRadius: '50%' }),
  };

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${animate ? 'animate-pulse' : ''} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
};

export interface SkeletonGroupProps {
  children: React.ReactNode;
  className?: string;
  spacing?: string | number;
}

export const SkeletonGroup: React.FC<SkeletonGroupProps> = ({
  children,
  className = '',
  spacing = '1rem',
}) => {
  const spacingValue = typeof spacing === 'number' ? `${spacing}px` : spacing;

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: spacingValue }}>
      {children}
    </div>
  );
};

export default Skeleton;