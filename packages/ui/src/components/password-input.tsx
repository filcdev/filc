import { Eye, EyeOff } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { cn } from '../lib/utils';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from './input-group';

type PasswordInputProps = ComponentProps<'input'> & {
  hidePasswordLabel?: string;
  showPasswordLabel?: string;
};

function PasswordInput({
  className,
  disabled,
  hidePasswordLabel = 'Hide password',
  showPasswordLabel = 'Show password',
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <InputGroup
      className={cn(className)}
      data-disabled={disabled ? 'true' : undefined}
    >
      <InputGroupInput
        disabled={disabled}
        type={showPassword ? 'text' : 'password'}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          aria-label={showPassword ? hidePasswordLabel : showPasswordLabel}
          className="cursor-pointer"
          disabled={disabled}
          onClick={() => setShowPassword((prev) => !prev)}
          onMouseDown={(e) => e.preventDefault()}
          size="icon-xs"
          type="button"
        >
          {showPassword ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

export { PasswordInput };
