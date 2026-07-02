import React from 'react';

interface AppLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function AppLogo({ size = 24, className = '', style }: AppLogoProps) {
  return (
    <div className={`flex items-center justify-center ${className}`} style={style}>
      <img
        src="/logo.svg"
        alt="App Logo"
        width={size}
        height={size}
        className="object-contain"
      />
    </div>
  );
}