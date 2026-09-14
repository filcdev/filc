import type { Classroom } from '@filcdev/api/domains/navigator/classroom';
import type { FullGraph } from '@filcdev/api/domains/navigator/graph';
import type { MyLocation } from '@filcdev/api/domains/navigator/my-location';
import type { KioskNode } from '@filcdev/navigator-3d/kiosk/types';
import type {
  IsolatedFloor,
  KioskHighlight,
  KioskSelection,
} from '@filcdev/navigator-3d/kiosk-view';
import KioskView3D from '@filcdev/navigator-3d/kiosk-view';
import { GraphPathBuilder } from '@filcdev/navigator-3d/path/path-builder';
import { CANVAS_BG_LIGHT } from '@filcdev/navigator-3d/types/three/material-types';
import type { Vec3 } from '@filcdev/navigator-3d/types/three/vector';
import { Alert, AlertDescription } from '@filcdev/ui/components/alert';
import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import { Spinner } from '@filcdev/ui/components/spinner';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import { VirtualKeyboardProvider } from '@/components/keyboard/virtual-keyboard-context';
import { NavigatePanel } from '@/components/navigator/navigate-panel';
import { SearchPanel } from '@/components/navigator/search-panel';
import { TypeHighlighter } from '@/components/navigator/type-highlighter';
import { useKioskHeartbeat } from '@/hooks/kiosk';
import { useIdleTimer } from '@/hooks/use-idle-timer';
import { useKioskTranslations } from '@/hooks/use-kiosk-translations';
import { api, useApiQuery } from '@/utils/api';
import type { Translator } from '@/utils/classroom-search';
import { REFETCH_INTERVALS } from '@/utils/constants';

export const Route = createFileRoute('/_kiosk/navigator')({
  component: NavigatorKioskPage,
});

type View = 'search' | 'navigate';

/** Reset the kiosk after this long with no user input, unless the kiosk's own
 *  configuration says otherwise. */
const DEFAULT_IDLE_MS = 60_000;

/** Route to draw: an explicit start wins, otherwise the kiosk's configured
 *  location. Anything shorter than two waypoints is not a route. */
function computePath(options: {
  barrierFree: boolean;
  myLocation: MyLocation | null;
  pathBuilder: GraphPathBuilder | null;
  startId: string | null;
  targetId: string | null;
  view: View;
}): Vec3[] {
  const { barrierFree, myLocation, pathBuilder, startId, targetId, view } =
    options;

  if (!pathBuilder || view !== 'navigate' || !targetId) {
    return [];
  }

  if (startId) {
    const result = pathBuilder.getPath(startId, targetId, barrierFree);
    return result.length >= 2 ? result : [];
  }

  if (myLocation) {
    const result = pathBuilder.getPathFromLocation(targetId, barrierFree);
    return result.length >= 2 ? result : [];
  }

  return [];
}

type CanvasOverlayProps = {
  /** Name of the room under the pointer, if any. */
  hoveredName: string | null;
  onClearHighlight: () => void;
  onReset: () => void;
  showClearHighlight: boolean;
  t: Translator;
};

/** The badges and buttons floating above the campus canvas. */
function CanvasOverlay({
  hoveredName,
  onClearHighlight,
  onReset,
  showClearHighlight,
  t,
}: CanvasOverlayProps) {
  return (
    <>
      {hoveredName && (
        <Badge className="absolute bottom-2 left-2 h-7 bg-foreground px-3 text-background md:h-9 md:px-4 md:text-base">
          {hoveredName}
        </Badge>
      )}

      <div className="absolute right-2 bottom-2 space-x-2">
        {showClearHighlight && (
          <Button
            onClick={onClearHighlight}
            size="lg"
            type="button"
            variant="outline"
          >
            {t('ui.kiosk.clear_highlight')}
          </Button>
        )}
        <Button onClick={onReset} size="lg" type="button" variant="outline">
          {t('ui.kiosk.reset')}
        </Button>
      </div>
    </>
  );
}

/** Placeholder shown while the campus graph is still on its way, or when it
 *  could not be loaded at all. */
function GraphPlaceholder({ isError, t }: { isError: boolean; t: Translator }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center p-4">
      {isError ? (
        <Alert className="w-auto" variant="destructive">
          <AlertDescription>
            {t('ui.kiosk.error', {
              error: t('ui.common.unknown'),
            })}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner className="size-5" />
          <span>{t('ui.kiosk.loading')}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Kiosk navigator. Two modes share one live 3D canvas:
 *  - "search": find a classroom by name/description, see its info + location.
 *  - "navigate": route to that classroom from a chosen start (or the kiosk's
 *    configured "you are here" position).
 *
 * All interaction state lives here; KioskView3D is fully controlled. After the
 * configured idle timeout everything resets to the default search view without
 * a page reload.
 */
function NavigatorKioskPage() {
  const { machine } = Route.useSearch();
  const { t } = useKioskTranslations();
  const heartbeat = useKioskHeartbeat(machine);

  const graphQuery = useApiQuery<FullGraph>(() => api.navigator.graph.$get(), {
    queryKey: ['navigator', 'graph'],
    refetchInterval: REFETCH_INTERVALS.navigatorGraph,
  });
  const graph = graphQuery.data ?? null;

  const config = heartbeat?.state === 'navigator' ? heartbeat.config : null;
  // The marker is owned by the kiosk record in Chronos, not by the box.
  const myLocation = config?.startLocation ?? null;

  const [view, setView] = useState<View>('search');

  // The classroom chosen in search → becomes the navigation target.
  const [targetId, setTargetId] = useState<string | null>(null);
  // Explicit navigation start. null + a configured location ⇒ route from there.
  const [startId, setStartId] = useState<string | null>(null);

  const [isolatedFloor, setIsolatedFloor] = useState<IsolatedFloor>(null);
  const [highlightTypeIds, setHighlightTypeIds] = useState<string[]>([]);
  const [barrierFree, setBarrierFree] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Bumped to force the 3D camera back to the default campus framing.
  const [viewResetToken, setViewResetToken] = useState(0);

  const classroomById = useMemo(() => {
    const map = new Map<string, Classroom>();
    for (const classroom of graph?.classrooms ?? []) {
      map.set(classroom.id, classroom);
    }
    return map;
  }, [graph]);

  const nameOf = useCallback(
    (id?: string | null): string =>
      id ? t(classroomById.get(id)?.name ?? id) : '—',
    [classroomById, t]
  );

  const resetAll = useCallback(() => {
    setView('search');
    setTargetId(null);
    setStartId(null);
    setIsolatedFloor(null);
    setHighlightTypeIds([]);
    setBarrierFree(false);
    setHoveredId(null);
    setViewResetToken((previous) => previous + 1);
  }, []);

  useIdleTimer(resetAll, config?.idleResetMs ?? DEFAULT_IDLE_MS);

  const selectTarget = (id: string) => {
    setTargetId(id);
    const classroom = classroomById.get(id);
    if (classroom) {
      setIsolatedFloor({
        buildingId: classroom.building_id,
        storey: classroom.storey,
      });
    }
  };

  const onObjectClick = (node: KioskNode) => {
    if (node.kind !== 'classroom') {
      return;
    }

    if (view === 'navigate') {
      if (startId !== node.id) {
        setStartId(node.id);
      }
      return;
    }

    selectTarget(node.id);
  };

  const onObjectHover = (node: KioskNode | null) => {
    if (!node) {
      setHoveredId(null);
      return;
    }

    if (node.kind !== 'classroom') {
      return;
    }

    setHoveredId(node.id);
  };

  // ---- Navigation start/target & pathfinding -----------------------------
  const goToNavigate = useCallback(() => {
    if (!targetId) {
      return;
    }
    setView('navigate');
    setStartId(null); // default to the configured location (if any)
    setIsolatedFloor(null); // show the whole campus so the route is visible
  }, [targetId]);

  const backToSearch = useCallback(() => {
    setView('search');
    const classroom = targetId ? classroomById.get(targetId) : null;
    if (classroom) {
      setIsolatedFloor({
        buildingId: classroom.building_id,
        storey: classroom.storey,
      });
    }
  }, [classroomById, targetId]);

  const pathBuilder = useMemo(() => {
    if (!graph) {
      return null;
    }
    return new GraphPathBuilder(graph, barrierFree, myLocation);
  }, [barrierFree, graph, myLocation]);

  const path = useMemo<Vec3[]>(
    () =>
      computePath({
        barrierFree,
        myLocation,
        pathBuilder,
        startId,
        targetId,
        view,
      }),
    [barrierFree, myLocation, pathBuilder, startId, targetId, view]
  );

  const hasStart = !!startId || (view === 'navigate' && !!myLocation);
  const noRoute =
    view === 'navigate' && !!targetId && hasStart && path.length < 2;
  const needsStart = view === 'navigate' && !!targetId && !hasStart;

  // ---- Props passed to the 3D view ---------------------------------------
  const selection = useMemo<KioskSelection>(() => {
    if (view === 'navigate') {
      return { end: targetId, start: startId };
    }
    // Search mode: highlight the located room as the "start" marker.
    return { end: null, start: targetId };
  }, [startId, targetId, view]);

  const highlight = useMemo<KioskHighlight>(
    () => ({
      dimOthers: highlightTypeIds.length > 0,
      typeIds: highlightTypeIds,
    }),
    [highlightTypeIds]
  );

  // Re-enrolled as a TV box: follow the registry instead of showing a campus.
  if (heartbeat?.state === 'tv') {
    return <Navigate replace search={{ machine }} to="/tv" />;
  }

  if (!graph) {
    return <GraphPlaceholder isError={graphQuery.isError} t={t} />;
  }

  return (
    <VirtualKeyboardProvider>
      <div className="flex flex-col md:h-screen">
        <main className="min-h-0 flex-1 overflow-auto p-4 md:overflow-hidden">
          <div className="flex h-full min-h-0 flex-col gap-4 xl:flex-row">
            <div className="relative min-h-[50%] flex-1 overflow-hidden rounded-xl border border-border md:min-h-0">
              <KioskView3D
                background={CANVAS_BG_LIGHT}
                className="h-full w-full"
                emptyLabel={t('ui.common.no_data')}
                graph={graph}
                highlight={highlight}
                isolatedFloor={isolatedFloor}
                markerLabel={t('kiosk.location.marker')}
                myLocation={myLocation}
                onObjectClick={onObjectClick}
                onObjectHover={onObjectHover}
                path={path}
                selection={selection}
                viewResetToken={viewResetToken}
              />

              <CanvasOverlay
                hoveredName={hoveredId ? nameOf(hoveredId) : null}
                onClearHighlight={() => setHighlightTypeIds([])}
                onReset={resetAll}
                showClearHighlight={highlightTypeIds.length > 0}
                t={t}
              />
            </div>

            {/* Control panel: type filter first, then the search (which fills
                the rest) or the routing controls. */}
            <div className="flex min-h-0 flex-1 flex-col gap-3 xl:w-96 xl:flex-none">
              <TypeHighlighter
                selectedIds={highlightTypeIds}
                setSelectedIds={setHighlightTypeIds}
                types={graph.classroom_types}
              />

              {view === 'search' ? (
                <SearchPanel
                  graph={graph}
                  key={viewResetToken}
                  onNavigate={goToNavigate}
                  onSelect={selectTarget}
                  selectedId={targetId}
                  selectedTypeIds={highlightTypeIds}
                />
              ) : (
                <NavigatePanel
                  barrierFree={barrierFree}
                  endId={targetId ?? ''}
                  graph={graph}
                  hasPos={!!myLocation}
                  needsStart={needsStart}
                  noRoute={noRoute}
                  onBack={backToSearch}
                  onSelectStart={setStartId}
                  setBarrierFree={setBarrierFree}
                  startId={startId}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </VirtualKeyboardProvider>
  );
}
