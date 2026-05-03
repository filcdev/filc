import type { ValidationError } from '@tanstack/react-form';
import type { ComponentProps } from 'react';
import { cn } from '@/utils';

type FieldProps = ComponentProps<'div'> & {
  orientation?: 'horizontal' | 'responsive';
};

function Field({ className, orientation, ...props }: FieldProps) {
  return (
    <div
      className={cn(
        orientation === 'horizontal' || orientation === 'responsive'
          ? 'flex items-center justify-between gap-4'
          : 'space-y-2',
        className
      )}
      {...props}
    />
  );
}

function FieldGroup({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('space-y-4', className)} {...props} />;
}

function FieldContent({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('flex flex-1 flex-col gap-1', className)} {...props} />
  );
}

function FieldLabel({ className, ...props }: ComponentProps<'label'>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: used with htmlFor prop in form fields
    <label
      className={cn(
        'flex select-none items-center gap-2 font-medium text-sm leading-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50',
        className
      )}
      {...props}
    />
  );
}

function FieldError({
  errors,
  className,
}: {
  errors: ValidationError[];
  className?: string;
}) {
  const messages = errors
    .map((e) => {
      if (typeof e === 'string') {
        return e;
      }
      if (typeof e === 'object' && e !== null && 'message' in e) {
        return String((e as { message: unknown }).message);
      }
      return String(e);
    })
    .filter(Boolean);

  if (!messages.length) {
    return null;
  }

  return (
    <p className={cn('text-destructive text-sm', className)}>
      {messages.join(', ')}
    </p>
  );
}

function FieldDescription({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p className={cn('text-muted-foreground text-sm', className)} {...props} />
  );
}

function FieldSet({ className, ...props }: ComponentProps<'fieldset'>) {
  return (
    <fieldset
      className={cn('m-0 space-y-3 border-none p-0', className)}
      {...props}
    />
  );
}

type FieldLegendProps = ComponentProps<'legend'> & { variant?: 'label' };

function FieldLegend({ className, variant, ...props }: FieldLegendProps) {
  return (
    <legend
      className={cn(
        variant === 'label'
          ? 'font-medium text-sm leading-none'
          : 'font-semibold text-base',
        className
      )}
      {...props}
    />
  );
}

function FieldTitle({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('font-medium text-sm', className)} {...props} />;
}

function FieldSeparator({ className }: { className?: string }) {
  return <div className={cn('border-t', className)} />;
}

export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
};
