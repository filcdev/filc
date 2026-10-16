import { Skeleton } from '@filcdev/ui/components/skeleton';
import { cn } from '@filcdev/ui/lib/utils';
import { useTranslation } from 'react-i18next';
import { Lazy } from '@/components/lazy';
import { useNavigatorGraph } from '@/hooks/navigator';

// The 3D editor is three.js (~560 kB). It is the bulk of this page, so it
// loads into its own chunk instead of with the route that hosts the preview.
const loadEditorView3D = () => import('@filcdev/navigator-3d/editor-view');

type NavigatorPreviewProps = {
  className?: string;
};

/** Read-only full-campus canvas: every entity shown, no gizmo. */
export function NavigatorPreview({ className }: NavigatorPreviewProps) {
  const { t } = useTranslation();
  const graph = useNavigatorGraph();

  if (graph.isLoading) {
    return <Skeleton className={cn('h-[70vh] w-full', className)} />;
  }

  return (
    <div
      className={cn(
        'h-[70vh] w-full overflow-hidden rounded-xl border',
        className
      )}
    >
      <Lazy
        appearance={{ emphasis: { dimOthers: true } }}
        emptyLabel={t('ui.common.no_data')}
        graph={graph.data ?? null}
        initialDistance={120}
        load={loadEditorView3D}
        showAxes
      />
    </div>
  );
}
