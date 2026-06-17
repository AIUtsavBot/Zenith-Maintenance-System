import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  onClick?: () => void;
  id?: string;
  style?: React.CSSProperties;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  hoverEffect = false,
  onClick,
  id,
  style
}) => {
  const baseClass = 'glass-panel';
  const hoverClass = hoverEffect ? 'glass-panel-hover' : '';
  const clickClass = onClick ? 'cursor-pointer' : '';

  return (
    <div
      id={id}
      onClick={onClick}
      className={`${baseClass} ${hoverClass} ${clickClass} ${className}`}
      style={{
        padding: '1.5rem',
        ...style
      }}
    >
      {children}
    </div>
  );
};
