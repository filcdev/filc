import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
} from 'react';

type CollapsibleContextValue = {
  open: boolean;
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
    <CollapsibleContext.Provider value={{ open }}>
      <div {...props}>{children}</div>
    </CollapsibleContext.Provider>
  );
}

interface CollapsibleTriggerProps extends ComponentProps<'button'> {
  onOpenChange?: (open: boolean) => void;
}

function CollapsibleTrigger({ onClick, ...props }: CollapsibleTriggerProps) {
  return <button onClick={onClick} type="button" {...props} />;
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
