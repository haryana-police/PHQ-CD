import { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  isLoading?: boolean;
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  children,
  isLoading,
  className = '',
  disabled,
  ...props
}: ButtonProps) => {
  const variantClass =
    variant === 'primary'
      ? 'btn-primary-theme'
      : variant === 'danger'
      ? 'btn-danger'
      : 'btn-secondary';

  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';

  return (
    <button
      className={`btn ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
};

interface LinkButtonProps {
  to: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  className?: string;
}

export const LinkButton = ({
  to,
  variant = 'primary',
  size = 'md',
  children,
  className = '',
}: LinkButtonProps) => {
  const variantClass =
    variant === 'primary'
      ? 'btn-primary-theme'
      : variant === 'danger'
      ? 'btn-danger'
      : 'btn-secondary';

  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';

  return (
    <Link to={to} className={`btn ${variantClass} ${sizeClass} ${className}`}>
      {children}
    </Link>
  );
};