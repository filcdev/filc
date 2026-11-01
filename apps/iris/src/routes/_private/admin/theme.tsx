import type { SiteTheme } from '@filcdev/api/domains/theme';
import { permissions } from '@filcdev/api/permissions';
import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import { Spinner } from '@filcdev/ui/components/spinner';
import { cn } from '@filcdev/ui/lib/utils';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChristmasArt,
  DefaultArt,
  HalloweenArt,
} from '@/components/admin/theme-art';
import { PermissionGuard } from '@/components/util/permission-guard';
import { useSiteTheme, useUpdateSiteTheme } from '@/hooks/site-theme';
import { orpc, prefetch } from '@/utils/orpc';

type ThemeOption = {
  id: SiteTheme;
  nameKey: string;
  descriptionKey: string;
  Art: typeof DefaultArt;
  swatches: string[];
};

const THEMES: ThemeOption[] = [
  {
    id: 'default',
    nameKey: 'siteTheme.default.name',
    descriptionKey: 'siteTheme.default.description',
    Art: DefaultArt,
    swatches: ['#16a34a', '#18181b', '#fafafa', '#71717a'],
  },
  {
    id: 'halloween',
    nameKey: 'siteTheme.halloween.name',
    descriptionKey: 'siteTheme.halloween.description',
    Art: HalloweenArt,
    swatches: ['#ea580c', '#7c3aed', '#f59e0b', '#2d2a26'],
  },
  {
    id: 'christmas',
    nameKey: 'siteTheme.christmas.name',
    descriptionKey: 'siteTheme.christmas.description',
    Art: ChristmasArt,
    swatches: ['#dc2626', '#16a34a', '#0ea5e9', '#14532d'],
  },
];

export const Route = createFileRoute('/_private/admin/theme')({
  component: () => (
    <PermissionGuard permission={permissions.rolesManage}>
      <ThemePage />
    </PermissionGuard>
  ),
  loader: ({ context }) =>
    prefetch(
      context.queryClient,
      orpc.theme.get.queryOptions({ staleTime: 5 * 60_000 })
    ),
});

function ThemePage() {
  const { t } = useTranslation();
  const siteThemeQuery = useSiteTheme();
  const activeTheme = siteThemeQuery.data?.theme ?? 'default';
  const [selected, setSelected] = useState<SiteTheme>(activeTheme);
  const updateMutation = useUpdateSiteTheme();

  const selectedOption =
    THEMES.find((option) => option.id === selected) ?? THEMES[0];
  const activeOption =
    THEMES.find((option) => option.id === activeTheme) ?? THEMES[0];
  const SelectedArt = selectedOption.Art;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <SelectedArt className="absolute inset-0 h-full w-full" />
        <div className="relative space-y-2 p-8">
          <h1 className="font-bold text-3xl tracking-tight">
            {t('siteTheme.heroTitle')}
          </h1>
          <p className="max-w-xl text-muted-foreground">
            {t('siteTheme.heroDescription')}
          </p>
        </div>
      </div>

      {siteThemeQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((option) => (
            <Skeleton className="h-96 w-full rounded-2xl" key={option.id} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {THEMES.map((option) => (
              <ThemeCard
                active={option.id === activeTheme}
                key={option.id}
                onSelect={() => setSelected(option.id)}
                option={option}
                selected={option.id === selected}
              />
            ))}
          </div>

          <div className="sticky bottom-0 flex items-center justify-end gap-3 rounded-2xl border bg-card/95 p-4 backdrop-blur">
            <span className="text-muted-foreground text-sm">
              {t('siteTheme.currentTheme')}: {t(activeOption.nameKey)}
            </span>
            <Button
              disabled={updateMutation.isPending || selected === activeTheme}
              onClick={() => updateMutation.mutate({ theme: selected })}
            >
              {updateMutation.isPending && <Spinner className="mr-2 h-4 w-4" />}
              {updateMutation.isPending
                ? t('siteTheme.applying')
                : t('siteTheme.apply')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

type ThemeCardProps = {
  active: boolean;
  option: ThemeOption;
  selected: boolean;
  onSelect: () => void;
};

function ThemeCard({ active, option, selected, onSelect }: ThemeCardProps) {
  const { t } = useTranslation();
  const Art = option.Art;

  return (
    <button
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border text-left transition-all',
        'hover:-translate-y-0.5 hover:shadow-lg',
        selected
          ? 'ring-2 ring-ring ring-offset-2 ring-offset-background'
          : 'hover:border-primary/40'
      )}
      onClick={onSelect}
      type="button"
    >
      <div className="relative h-32 w-full overflow-hidden">
        <Art className="h-full w-full" />
        {active && (
          <Badge className="absolute top-2 right-2">
            {t('siteTheme.active')}
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{t(option.nameKey)}</h2>
          <div className="flex gap-1.5">
            {option.swatches.map((color) => (
              <span
                className="h-4 w-4 rounded-full border border-black/10"
                key={color}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          {t(option.descriptionKey)}
        </p>
        <ThemePreview themeId={option.id} />
      </div>
    </button>
  );
}

function ThemePreview({ themeId }: { themeId: SiteTheme }) {
  const { t } = useTranslation();
  return (
    <div className="mt-auto space-y-1.5">
      <p className="text-muted-foreground text-xs">
        {t('siteTheme.previewLabel')}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <MiniUi dark={false} themeId={themeId} />
        <MiniUi dark themeId={themeId} />
      </div>
    </div>
  );
}

function MiniUi({ dark, themeId }: { dark: boolean; themeId: SiteTheme }) {
  return (
    <div
      {...(themeId === 'default' ? {} : { 'data-site-theme': themeId })}
      className={cn(
        'space-y-1.5 rounded-lg border border-border bg-background p-2 text-foreground',
        dark && 'dark'
      )}
    >
      {/* top bar */}
      <div className="flex items-center justify-between rounded-md bg-card px-1.5 py-1">
        <span className="h-1.5 w-8 rounded-full bg-primary" />
        <span className="h-2 w-2 rounded-full bg-muted" />
      </div>
      {/* two text lines */}
      <div className="h-1.5 w-full rounded-full bg-muted" />
      <div className="h-1.5 w-2/3 rounded-full bg-muted" />
      {/* primary button */}
      <div className="inline-flex h-4 items-center rounded bg-primary px-1.5">
        <span className="h-1 w-6 rounded-full bg-primary-foreground" />
      </div>
      {/* muted row */}
      <div className="flex items-center gap-1 rounded bg-muted px-1.5 py-1">
        <span className="h-1 w-1 rounded-full bg-muted-foreground" />
        <span className="h-1.5 flex-1 rounded-full bg-muted-foreground/40" />
      </div>
    </div>
  );
}
