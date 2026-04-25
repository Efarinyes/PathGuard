"use client";

import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "critical";
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  fullWidth = false,
  className = "",
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl px-6 py-3 min-h-[44px] text-lg";
  
  const variants = {
    primary: "bg-primary text-white hover:bg-opacity-90 active:bg-opacity-100",
    secondary: "bg-secondary text-white hover:bg-opacity-90 active:bg-opacity-100",
    critical: "bg-critical text-white hover:bg-opacity-90 active:bg-opacity-100",
  };

  const widthStyle = fullWidth ? "w-full" : "";

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${widthStyle} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
