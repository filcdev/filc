import EditorView3D from '@filcdev/navigator-3d/editor-view';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import { cn } from '@filcdev/ui/lib/utils';
import { useTranslation } from 'react-i18next';
import { useNavigatorGraph } from '@/hooks/navigator';

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
      <EditorView3D
        appearance={{ emphasis: { dimOthers: true } }}
        emptyLabel={t('ui.common.no_data')}
        graph={graph.data ?? null}
        initialDistance={120}
        showAxes
      />
    </div>
  );
}
