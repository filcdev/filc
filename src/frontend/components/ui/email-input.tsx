'use client';

import { cn } from '~/frontend/utils';

interface EmailInputProps
  extends Omit<React.ComponentProps<'input'>, 'type' | 'value' | 'onChange'> {
  domain: string;
  value?: string;
  onChange?: (value: string) => void;
  onFullEmailChange?: (fullEmail: string) => void;
}

function EmailInput({
  className,
  domain,
  value = '',
  onChange,
  onFullEmailChange,
  placeholder = 'username',
  ...props
}: EmailInputProps) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Remove @ symbol if user tries to type it
    // biome-ignore lint/performance/useTopLevelRegex: doesn't matter
    const cleanValue = inputValue.replace(/@.*$/, '');

    onChange?.(cleanValue);
    onFullEmailChange?.(cleanValue ? `${cleanValue}@${domain}` : '');
  };

  return (
    <div className="relative flex items-center">
      <input
        className={cn(
          'flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
          'pr-24', // Add padding for the domain suffix
          className
        )}
        data-slot="input"
        onChange={handleInputChange}
        placeholder={placeholder}
        type="text"
        value={value}
        {...props}
      />
      <div className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 text-muted-foreground text-sm md:text-sm">
        @{domain}
      </div>
    </div>
  );
}

export { EmailInput };
