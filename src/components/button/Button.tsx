import './Button.css';

interface ButtonProps extends React.ComponentProps<'button'> {
  variant?: 'submit' | 'close' | 'basic' | 'menu-item' | 'menu-item-danger' | 'danger';
}

export function Button({
  variant = 'basic',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const hasStandardPadding = variant === 'submit' || variant === 'close';
  
  const classNames = [
    'app-btn',
    `app-btn--${variant}`,
    hasStandardPadding ? 'app-btn--padded' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <button className={classNames} {...props}>
      {children}
    </button>
  );
}