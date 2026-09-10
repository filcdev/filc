import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
} from 'react';

type CollapsibleContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null);

function useCollapsibleContext() {
  const context = useContext(CollapsibleContext);
  if (!context) {
    throw new Error('Collapsible components must be used within Collapsible');
  }
  return context;
}

interface CollapsibleProps extends ComponentProps<'div'> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

function Collapsible({
  open = false,
  onOpenChange,
  children,
  ...props
}: CollapsibleProps) {
  return (
    <CollapsibleContext.Provider
      value={{ onOpenChange: (next) => onOpenChange?.(next), open }}
    >
      <div {...props}>{children}</div>
    </CollapsibleContext.Provider>
  );
}

interface CollapsibleTriggerProps extends ComponentProps<'button'> {}

function CollapsibleTrigger({ onClick, ...props }: CollapsibleTriggerProps) {
  const { open, onOpenChange } = useCollapsibleContext();
  return (
    <button
      onClick={(event) => {
        onClick?.(event);
        onOpenChange(!open);
      }}
      type="button"
      {...props}
    />
  );
}

function CollapsibleContent({
  className,
  children,
  ...props
}: ComponentProps<'div'>) {
  const { open } = useCollapsibleContext();

  if (!open) {
    return null;
  }

  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
