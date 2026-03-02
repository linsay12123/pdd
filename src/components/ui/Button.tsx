"use client";

import * as React from "react";
import { cn } from "@/src/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", fullWidth, children, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
      primary: "bg-gradient-gold text-white hover:shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:scale-[1.02]",
      secondary: "bg-brand-800 text-cream-50 hover:bg-brand-700 border border-gray-200",
      outline: "border border-gold-500/50 text-gold-500 hover:bg-gold-500/10",
      ghost: "text-cream-50 hover:bg-gray-100"
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-5 py-2.5 text-base",
      lg: "px-8 py-4 text-lg font-semibold"
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], fullWidth && "w-full", className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
