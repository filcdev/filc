import { type SiteTheme, siteThemeIds } from '@filcdev/api/domains/theme';
import { permissions } from '@filcdev/api/permissions';
import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import { SiteThemeArt } from '@filcdev/ui/components/site-theme-art';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import { Spinner } from '@filcdev/ui/components/spinner';
import { cn } from '@filcdev/ui/lib/utils';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PermissionGuard } from '@/components/util/permission-guard';
import { useSiteTheme, useUpdateSiteTheme } from '@/hooks/site-theme';
import { orpc, prefetch } from '@/utils/orpc';

/**
 * The label keys for each skin, keyed by the contract's id list. Declaring it
 * as a `Record<SiteTheme, …>` is what makes a new skin a compile error until it
 * is named in both locales, instead of a missing card at runtime.
 */
const THEME_COPY: Record<
  SiteTheme,
  { descriptionKey: string; nameKey: string }
> = {
  christmas: {
    descriptionKey: 'siteTheme.christmas.description',
    nameKey: 'siteTheme.christmas.name',
  },
  default: {
    descriptionKey: 'siteTheme.default.description',
    nameKey: 'siteTheme.default.name',
  },
  easter: {
    descriptionKey: 'siteTheme.easter.description',
    nameKey: 'siteTheme.easter.name',
  },
  halloween: {
    descriptionKey: 'siteTheme.halloween.description',
    nameKey: 'siteTheme.halloween.name',
  },
  march15: {
    descriptionKey: 'siteTheme.march15.description',
    nameKey: 'siteTheme.march15.name',
  },
  newYear: {
    descriptionKey: 'siteTheme.newYear.description',
    nameKey: 'siteTheme.newYear.name',
  },
  summer: {
    descriptionKey: 'siteTheme.summer.description',
    nameKey: 'siteTheme.summer.name',
  },
  valentines: {
    descriptionKey: 'siteTheme.valentines.description',
    nameKey: 'siteTheme.valentines.name',
  },
};

/** One card per skin, in the contract's order (which is the calendar's). */
const THEMES = siteThemeIds.map((id) => ({ id, ...THEME_COPY[id] }));

type ThemeOption = (typeof THEMES)[number];

export const Route = createFileRoute('/_private/admin/theme')({
  component: () => (
    <PermissionGuard permission={permissions.siteThemeManage}>
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

  const activeOption =
    THEMES.find((option) => option.id === activeTheme) ?? THEMES[0];

  return (
    <div className="space-y-6">
      <div className="from-primary/10 via-background to-accent/10 relative overflow-hidden rounded-2xl border bg-gradient-to-br">
        <SiteThemeArt
          className="absolute inset-0 h-full w-full"
          theme={selected}
        />
        <div
          aria-hidden="true"
          className="from-background via-background/80 absolute inset-0 bg-gradient-to-r to-transparent"
        />
        <div className="relative space-y-2 p-8">
          <h1 className="text-3xl font-bold tracking-tight">
            {t('siteTheme.heroTitle')}
          </h1>
          <p className="text-muted-foreground max-w-xl">
            {t('siteTheme.heroDescription')}
          </p>
        </div>
      </div>

      {siteThemeQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {THEMES.map((option) => (
            <Skeleton className="h-96 w-full rounded-2xl" key={option.id} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

          <div className="bg-card/95 sticky bottom-0 flex items-center justify-end gap-3 rounded-2xl border p-4 backdrop-blur">
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

  return (
    <button
      aria-pressed={selected}
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border text-left transition-all',
        'hover:-translate-y-0.5 hover:shadow-lg',
        selected
          ? 'ring-ring ring-offset-background ring-2 ring-offset-2'
          : 'hover:border-primary/40'
      )}
      onClick={onSelect}
      type="button"
    >
      <div className="relative h-32 w-full overflow-hidden">
        <SiteThemeArt className="h-full w-full" theme={option.id} />
        {active && (
          <Badge className="absolute top-2 right-2">
            {t('siteTheme.active')}
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="font-semibold">{t(option.nameKey)}</span>
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
      className={cn(
        'border-border bg-background text-foreground space-y-1.5 rounded-lg border p-2',
        dark && 'dark'
      )}
      data-site-theme={themeId}
    >
      {/* palette swatches, driven by this card's own tokens */}
      <div aria-hidden="true" className="flex gap-1">
        <span className="bg-primary h-3 w-3 rounded-full" />
        <span className="bg-accent h-3 w-3 rounded-full" />
        <span className="border-border bg-background h-3 w-3 rounded-full border" />
        <span className="bg-foreground h-3 w-3 rounded-full" />
      </div>
      {/* top bar */}
      <div className="bg-card flex items-center justify-between rounded-md px-1.5 py-1">
        <span className="bg-primary h-1.5 w-8 rounded-full" />
        <span className="bg-muted h-2 w-2 rounded-full" />
      </div>
      {/* two text lines */}
      <div className="bg-muted h-1.5 w-full rounded-full" />
      <div className="bg-muted h-1.5 w-2/3 rounded-full" />
      {/* primary button */}
      <div className="bg-primary inline-flex h-4 items-center rounded px-1.5">
        <span className="bg-primary-foreground h-1 w-6 rounded-full" />
      </div>
      {/* muted row */}
      <div className="bg-muted flex items-center gap-1 rounded px-1.5 py-1">
        <span className="bg-muted-foreground h-1 w-1 rounded-full" />
        <span className="bg-muted-foreground/40 h-1.5 flex-1 rounded-full" />
      </div>
    </div>
  );
}
