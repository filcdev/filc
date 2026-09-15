import {
  DEFAULT_IDLE_RESET_SECONDS,
  DEFAULT_PETRIK_NEWS_DWELL_SECONDS,
  DEFAULT_PETRIK_NEWS_ENABLED,
  DEFAULT_PETRIK_NEWS_FEED_URL,
  DEFAULT_PETRIK_NEWS_IDLE_SECONDS,
  DEFAULT_PETRIK_NEWS_MAX_ITEMS,
  type KioskKind,
  navigatorKioskConfigSchema,
  tvKioskConfigSchema,
} from '@filcdev/api/domains/kiosk/config';
import EditorView3D from '@filcdev/navigator-3d/editor-view';
import { Button } from '@filcdev/ui/components/button';
import { Checkbox } from '@filcdev/ui/components/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { Field, FieldLabel } from '@filcdev/ui/components/field';
import { Input } from '@filcdev/ui/components/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
} from '@filcdev/ui/components/select';
import { useForm, useStore } from '@tanstack/react-form';
import { Plus, Trash } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { BaseDialogProps } from '@/components/admin/admin.types';
import { type KioskRow, useCreateKiosk, useUpdateKiosk } from '@/hooks/kiosks';
import { useBuildings, useNavigatorGraph } from '@/hooks/navigator';

type DepartureStopForm = {
  key: string;
  routeFilter: string;
  stopId: string;
};

type DepartureGroupForm = {
  key: string;
  label: string;
  stops: DepartureStopForm[];
};

type KioskFormValues = {
  departures: DepartureGroupForm[];
  enabled: boolean;
  highlightedNews: boolean;
  idleResetSeconds: number;
  kind: KioskKind;
  machineId: string;
  name: string;
  newsImages: boolean;
  newsSlideSeconds: number;
  newsTickerSeconds: number;
  petrikNewsDwellSeconds: number;
  petrikNewsEnabled: boolean;
  petrikNewsFeedUrl: string;
  petrikNewsIdleSeconds: number;
  petrikNewsMaxItems: number;
  startBuildingId: string;
  startStorey: number;
  startX: number;
  startY: number;
};

const DEFAULT_NEWS_SLIDE_SECONDS = 20;
const DEFAULT_NEWS_TICKER_SECONDS = 60;

/** Turn a stored kiosk row into the flat form values the dialog edits. */
function toFormValues(kiosk: KioskRow | null): KioskFormValues {
  if (!kiosk) {
    return {
      departures: [],
      enabled: true,
      highlightedNews: true,
      idleResetSeconds: DEFAULT_IDLE_RESET_SECONDS,
      kind: 'tv',
      machineId: '',
      name: '',
      newsImages: true,
      newsSlideSeconds: DEFAULT_NEWS_SLIDE_SECONDS,
      newsTickerSeconds: DEFAULT_NEWS_TICKER_SECONDS,
      petrikNewsDwellSeconds: DEFAULT_PETRIK_NEWS_DWELL_SECONDS,
      petrikNewsEnabled: DEFAULT_PETRIK_NEWS_ENABLED,
      petrikNewsFeedUrl: DEFAULT_PETRIK_NEWS_FEED_URL,
      petrikNewsIdleSeconds: DEFAULT_PETRIK_NEWS_IDLE_SECONDS,
      petrikNewsMaxItems: DEFAULT_PETRIK_NEWS_MAX_ITEMS,
      startBuildingId: '',
      startStorey: 0,
      startX: 0,
      startY: 0,
    };
  }

  const tvConfig = tvKioskConfigSchema.safeParse(kiosk.config);
  const navigatorConfig = navigatorKioskConfigSchema.safeParse(kiosk.config);
  const startLocation = navigatorConfig.success
    ? navigatorConfig.data.startLocation
    : null;
  const navigatorNews = navigatorConfig.success
    ? navigatorConfig.data
    : {
        petrikNewsDwellSeconds: DEFAULT_PETRIK_NEWS_DWELL_SECONDS,
        petrikNewsFeedUrl: DEFAULT_PETRIK_NEWS_FEED_URL,
        petrikNewsIdleSeconds: DEFAULT_PETRIK_NEWS_IDLE_SECONDS,
        petrikNewsMaxItems: DEFAULT_PETRIK_NEWS_MAX_ITEMS,
      };
  const departures =
    kiosk.kind === 'tv' && tvConfig.success
      ? tvConfig.data.departures.map((group) => ({
          key: crypto.randomUUID(),
          label: group.label,
          stops: group.stops.map((stop) => ({
            key: crypto.randomUUID(),
            routeFilter: stop.routeFilter ?? '',
            stopId: stop.stopId,
          })),
        }))
      : [];

  return {
    departures,
    enabled: kiosk.enabled,
    highlightedNews: tvConfig.success ? tvConfig.data.highlightedNews : true,
    idleResetSeconds: navigatorConfig.success
      ? navigatorConfig.data.idleResetSeconds
      : DEFAULT_IDLE_RESET_SECONDS,
    kind: kiosk.kind,
    machineId: kiosk.machineId,
    name: kiosk.name,
    newsImages: tvConfig.success ? tvConfig.data.newsImages : true,
    newsSlideSeconds: tvConfig.success
      ? tvConfig.data.newsSlideSeconds
      : DEFAULT_NEWS_SLIDE_SECONDS,
    newsTickerSeconds: tvConfig.success
      ? tvConfig.data.newsTickerSeconds
      : DEFAULT_NEWS_TICKER_SECONDS,
    petrikNewsDwellSeconds: navigatorNews.petrikNewsDwellSeconds,
    petrikNewsEnabled: navigatorConfig.success
      ? navigatorConfig.data.petrikNewsEnabled
      : DEFAULT_PETRIK_NEWS_ENABLED,
    petrikNewsFeedUrl: navigatorNews.petrikNewsFeedUrl,
    petrikNewsIdleSeconds: navigatorNews.petrikNewsIdleSeconds,
    petrikNewsMaxItems: navigatorNews.petrikNewsMaxItems,
    startBuildingId: startLocation?.buildingId ?? '',
    startStorey: startLocation?.storey ?? 0,
    startX: startLocation?.x ?? 0,
    startY: startLocation?.y ?? 0,
  };
}

type KioskDialogProps = BaseDialogProps & {
  kiosk: KioskRow | null;
};

export function KioskDialog({ kiosk, onOpenChange, open }: KioskDialogProps) {
  const { t } = useTranslation();
  const createKiosk = useCreateKiosk({ onSaved: () => onOpenChange(false) });
  const updateKiosk = useUpdateKiosk({ onSaved: () => onOpenChange(false) });
  const graph = useNavigatorGraph();
  const buildings = useBuildings();

  const submit = (value: KioskFormValues, config: unknown) => {
    if (kiosk) {
      updateKiosk.mutate({
        id: kiosk.id,
        payload: {
          config,
          enabled: value.enabled,
          kind: value.kind,
          name: value.name,
        },
      });
      return;
    }
    createKiosk.mutate({
      config,
      kind: value.kind,
      machineId: value.machineId,
      name: value.name,
    });
  };

  const form = useForm({
    defaultValues: toFormValues(kiosk),
    onSubmit: ({ value }) => {
      if (value.kind === 'tv') {
        const config = tvKioskConfigSchema.safeParse({
          departures: value.departures.map((group) => ({
            label: group.label,
            stops: group.stops.map((stop) => ({
              routeFilter: stop.routeFilter.trim() || null,
              stopId: stop.stopId,
            })),
          })),
          highlightedNews: value.highlightedNews,
          newsImages: value.newsImages,
          newsSlideSeconds: value.newsSlideSeconds,
          newsTickerSeconds: value.newsTickerSeconds,
        });
        if (!config.success) {
          toast.error(t('kiosk.configError'));
          return;
        }
        submit(value, config.data);
        return;
      }

      const config = navigatorKioskConfigSchema.safeParse({
        idleResetSeconds: value.idleResetSeconds,
        petrikNewsDwellSeconds: value.petrikNewsDwellSeconds,
        petrikNewsEnabled: value.petrikNewsEnabled,
        petrikNewsFeedUrl: value.petrikNewsFeedUrl,
        petrikNewsIdleSeconds: value.petrikNewsIdleSeconds,
        petrikNewsMaxItems: value.petrikNewsMaxItems,
        startLocation: value.startBuildingId
          ? {
              buildingId: value.startBuildingId,
              storey: value.startStorey,
              x: value.startX,
              y: value.startY,
            }
          : null,
      });
      if (!config.success) {
        toast.error(t('kiosk.configError'));
        return;
      }
      submit(value, config.data);
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(kiosk));
    }
  }, [open, kiosk, form.reset]);

  const values = useStore(form.store, (state) => state.values);

  const buildingItems = (buildings.data ?? []).map((building) => ({
    label: building.name,
    value: building.id,
  }));

  const myLocation = values.startBuildingId
    ? {
        buildingId: values.startBuildingId,
        storey: values.startStorey,
        x: values.startX,
        y: values.startY,
      }
    : null;

  const isPending = createKiosk.isPending || updateKiosk.isPending;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {kiosk ? t('kiosk.editTitle') : t('kiosk.createTitle')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="name">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t('kiosk.fields.name')}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="machineId">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t('kiosk.fields.machineId')}
                  </FieldLabel>
                  <Input
                    disabled={kiosk !== null}
                    id={field.name}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="kind">
              {(field) => (
                <Field>
                  <FieldLabel>{t('kiosk.fields.kind')}</FieldLabel>
                  <Select
                    items={[
                      { label: t('kiosk.kindTv'), value: 'tv' },
                      { label: t('kiosk.kindNavigator'), value: 'navigator' },
                    ]}
                    onValueChange={(value) =>
                      field.handleChange((value ?? 'tv') as KioskKind)
                    }
                    value={field.state.value}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('kiosk.fields.kind')} />
                    </SelectTrigger>
                  </Select>
                </Field>
              )}
            </form.Field>
            <form.Field name="enabled">
              {(field) => (
                <Field orientation="horizontal">
                  <FieldLabel htmlFor={field.name}>
                    {t('kiosk.fields.enabled')}
                  </FieldLabel>
                  <Checkbox
                    checked={field.state.value}
                    id={field.name}
                    onCheckedChange={(checked) =>
                      field.handleChange(checked === true)
                    }
                  />
                </Field>
              )}
            </form.Field>
          </div>

          {values.kind === 'tv' ? (
            <div className="space-y-4">
              <form.Field mode="array" name="departures">
                {(groupsField) => (
                  <div className="space-y-4">
                    {groupsField.state.value.map((group, groupIndex) => (
                      <div
                        className="space-y-3 rounded-md border p-3"
                        key={group.key}
                      >
                        <div className="flex items-end gap-2">
                          <form.Field name={`departures[${groupIndex}].label`}>
                            {(field) => (
                              <Field className="flex-1">
                                <FieldLabel htmlFor={field.name}>
                                  {t('kiosk.fields.groupLabel')}
                                </FieldLabel>
                                <Input
                                  id={field.name}
                                  onChange={(event) =>
                                    field.handleChange(event.target.value)
                                  }
                                  value={field.state.value}
                                />
                              </Field>
                            )}
                          </form.Field>
                          <Button
                            aria-label={t('kiosk.removeGroup')}
                            onClick={() => groupsField.removeValue(groupIndex)}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                          >
                            <Trash className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>

                        <form.Field
                          mode="array"
                          name={`departures[${groupIndex}].stops`}
                        >
                          {(stopsField) => (
                            <div className="space-y-2">
                              {stopsField.state.value.map((stop, stopIndex) => (
                                <div
                                  className="flex items-end gap-2"
                                  key={stop.key}
                                >
                                  <form.Field
                                    name={`departures[${groupIndex}].stops[${stopIndex}].stopId`}
                                  >
                                    {(field) => (
                                      <Field className="flex-1">
                                        <FieldLabel htmlFor={field.name}>
                                          {t('kiosk.fields.stopId')}
                                        </FieldLabel>
                                        <Input
                                          id={field.name}
                                          onChange={(event) =>
                                            field.handleChange(
                                              event.target.value
                                            )
                                          }
                                          value={field.state.value}
                                        />
                                      </Field>
                                    )}
                                  </form.Field>
                                  <form.Field
                                    name={`departures[${groupIndex}].stops[${stopIndex}].routeFilter`}
                                  >
                                    {(field) => (
                                      <Field className="flex-1">
                                        <FieldLabel htmlFor={field.name}>
                                          {t('kiosk.fields.routeFilter')}
                                        </FieldLabel>
                                        <Input
                                          id={field.name}
                                          onChange={(event) =>
                                            field.handleChange(
                                              event.target.value
                                            )
                                          }
                                          value={field.state.value}
                                        />
                                      </Field>
                                    )}
                                  </form.Field>
                                  <Button
                                    aria-label={t('kiosk.removeStop')}
                                    onClick={() =>
                                      stopsField.removeValue(stopIndex)
                                    }
                                    size="icon-sm"
                                    type="button"
                                    variant="ghost"
                                  >
                                    <Trash className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              ))}
                              <Button
                                onClick={() =>
                                  stopsField.pushValue({
                                    key: crypto.randomUUID(),
                                    routeFilter: '',
                                    stopId: '',
                                  })
                                }
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                <Plus className="h-4 w-4" />
                                {t('kiosk.addStop')}
                              </Button>
                            </div>
                          )}
                        </form.Field>
                      </div>
                    ))}
                    <Button
                      onClick={() =>
                        groupsField.pushValue({
                          key: crypto.randomUUID(),
                          label: '',
                          stops: [
                            {
                              key: crypto.randomUUID(),
                              routeFilter: '',
                              stopId: '',
                            },
                          ],
                        })
                      }
                      type="button"
                      variant="outline"
                    >
                      <Plus className="h-4 w-4" />
                      {t('kiosk.addGroup')}
                    </Button>
                  </div>
                )}
              </form.Field>

              <div className="space-y-3 rounded-md border p-3">
                <form.Field name="highlightedNews">
                  {(field) => (
                    <Field orientation="horizontal">
                      <FieldLabel htmlFor={field.name}>
                        {t('kiosk.fields.highlightedNews')}
                      </FieldLabel>
                      <Checkbox
                        checked={field.state.value}
                        id={field.name}
                        onCheckedChange={(checked) =>
                          field.handleChange(checked === true)
                        }
                      />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="newsImages">
                  {(field) => (
                    <Field orientation="horizontal">
                      <FieldLabel htmlFor={field.name}>
                        {t('kiosk.fields.newsImages')}
                      </FieldLabel>
                      <Checkbox
                        checked={field.state.value}
                        id={field.name}
                        onCheckedChange={(checked) =>
                          field.handleChange(checked === true)
                        }
                      />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="newsSlideSeconds">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('kiosk.fields.newsSlideSeconds')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        max={120}
                        min={5}
                        onChange={(event) =>
                          field.handleChange(Number(event.target.value))
                        }
                        type="number"
                        value={field.state.value}
                      />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="newsTickerSeconds">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('kiosk.fields.newsTickerSeconds')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        max={600}
                        min={5}
                        onChange={(event) =>
                          field.handleChange(Number(event.target.value))
                        }
                        type="number"
                        value={field.state.value}
                      />
                    </Field>
                  )}
                </form.Field>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <form.Field name="idleResetSeconds">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      {t('kiosk.fields.idleResetSeconds')}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      max={600}
                      min={10}
                      onChange={(event) =>
                        field.handleChange(Number(event.target.value))
                      }
                      type="number"
                      value={field.state.value}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Field name="petrikNewsEnabled">
                {(field) => (
                  <Field orientation="horizontal">
                    <FieldLabel htmlFor={field.name}>
                      {t('kiosk.fields.petrikNewsEnabled')}
                    </FieldLabel>
                    <Checkbox
                      checked={field.state.value}
                      id={field.name}
                      onCheckedChange={(checked) =>
                        field.handleChange(checked === true)
                      }
                    />
                  </Field>
                )}
              </form.Field>
              {values.petrikNewsEnabled && (
                <>
                  <form.Field name="petrikNewsIdleSeconds">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>
                          {t('kiosk.fields.petrikNewsIdleSeconds')}
                        </FieldLabel>
                        <Input
                          id={field.name}
                          max={600}
                          min={10}
                          onChange={(event) =>
                            field.handleChange(Number(event.target.value))
                          }
                          type="number"
                          value={field.state.value}
                        />
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="petrikNewsDwellSeconds">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>
                          {t('kiosk.fields.petrikNewsDwellSeconds')}
                        </FieldLabel>
                        <Input
                          id={field.name}
                          max={120}
                          min={5}
                          onChange={(event) =>
                            field.handleChange(Number(event.target.value))
                          }
                          type="number"
                          value={field.state.value}
                        />
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="petrikNewsFeedUrl">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>
                          {t('kiosk.fields.petrikNewsFeedUrl')}
                        </FieldLabel>
                        <Input
                          id={field.name}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          placeholder={DEFAULT_PETRIK_NEWS_FEED_URL}
                          type="text"
                          value={field.state.value}
                        />
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="petrikNewsMaxItems">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>
                          {t('kiosk.fields.petrikNewsMaxItems')}
                        </FieldLabel>
                        <Input
                          id={field.name}
                          max={30}
                          min={1}
                          onChange={(event) =>
                            field.handleChange(Number(event.target.value))
                          }
                          type="number"
                          value={field.state.value}
                        />
                      </Field>
                    )}
                  </form.Field>
                </>
              )}
              <div className="grid gap-4 sm:grid-cols-3">
                <form.Field name="startBuildingId">
                  {(field) => (
                    <Field>
                      <FieldLabel>{t('kiosk.fields.building')}</FieldLabel>
                      <Select
                        items={buildingItems}
                        onValueChange={(value) =>
                          field.handleChange(value ?? '')
                        }
                        value={field.state.value}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={t('kiosk.fields.building')}
                          />
                        </SelectTrigger>
                      </Select>
                    </Field>
                  )}
                </form.Field>
                <form.Field name="startStorey">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('kiosk.fields.storey')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        onChange={(event) =>
                          field.handleChange(Number(event.target.value))
                        }
                        type="number"
                        value={field.state.value}
                      />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="startX">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('kiosk.fields.x')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        onChange={(event) =>
                          field.handleChange(Number(event.target.value))
                        }
                        step="any"
                        type="number"
                        value={field.state.value}
                      />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="startY">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t('kiosk.fields.y')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        onChange={(event) =>
                          field.handleChange(Number(event.target.value))
                        }
                        step="any"
                        type="number"
                        value={field.state.value}
                      />
                    </Field>
                  )}
                </form.Field>
              </div>
              <div className="h-[40vh] overflow-hidden rounded-xl border">
                <EditorView3D
                  emptyLabel={t('ui.common.no_data')}
                  graph={graph.data ?? null}
                  initialDistance={120}
                  myLocation={myLocation}
                  onTransform={(patch) => {
                    if (patch.x !== undefined) {
                      form.setFieldValue('startX', patch.x);
                    }
                    if (patch.y !== undefined) {
                      form.setFieldValue('startY', patch.y);
                    }
                  }}
                  showAxes
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {t('common.cancel')}
            </Button>
            <Button
              disabled={isPending || values.name.length === 0}
              type="submit"
            >
              {isPending ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
