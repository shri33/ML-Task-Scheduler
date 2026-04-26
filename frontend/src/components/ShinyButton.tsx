import { ReactNode, ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface ShinyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}

export default function ShinyButton({ 
  children, 
  className, 
  innerClassName,
  ...props 
}: ShinyButtonProps) {
  return (
    <button 
      className={clsx("btn-shiny rounded-2xl", className)}
      {...props}
    >
      <div className={clsx("btn-inner font-bold text-white", innerClassName)}>
        {children}
      </div>
    </button>
  );
}
