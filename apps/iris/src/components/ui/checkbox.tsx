import { Checkbox as CheckboxPrimitive } from '@base-ui-components/react/checkbox';
import { FaCheck } from 'react-icons/fa6';

import { cn } from '@/utils/index';

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs outline-none transition-shadow focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground dark:bg-input/30 dark:data-[checked]:bg-primary dark:aria-invalid:ring-destructive/40',
        className
      )}
      data-slot="checkbox"
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="flex size-full items-center justify-center text-current transition-none"
        data-slot="checkbox-indicator"
      >
        <FaCheck className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
