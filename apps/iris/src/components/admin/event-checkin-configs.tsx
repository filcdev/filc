import {
  defaultCheckinRules,
  type EventCheckinRule,
} from '@filcdev/api/domains/events/rules';
import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import { Label } from '@filcdev/ui/components/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
} from '@filcdev/ui/components/select';
import { Save, Undo2 } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckinRulesEditor } from '@/components/admin/event-checkin-rules';
import {
  type EventDetail,
  useDeleteEventCheckinConfig,
  useEventCheckinConfigs,
  useEventParticipants,
  useUpsertEventCheckinConfig,
} from '@/hooks/events';

/** The selector's value for the event default; a helper's own id otherwise. */
const DEFAULT = 'default';

type ScannerOption = { id: string; name: string };

/**
 * The door rules, per scanner.
 *
 * A scan is judged by the scanning helper's own config when they have one, the
 * event default otherwise — which is why the selector lists the default plus
 * every approved helper. A helper without an override opens the default rules
 * as a copy; saving writes their own row. Resetting deletes it and sends their
 * next scan back to the default.
 */
export function CheckinConfigs({ event }: { event: EventDetail }) {
  const { t } = useTranslation();
  const idPrefix = useId();
  const [selected, setSelected] = useState(DEFAULT);
  const configsQuery = useEventCheckinConfigs(event.id);
  // The approved helpers are the only people who can scan, so they are the
  // only scanners a config can belong to.
  const helpersQuery = useEventParticipants({
    id: event.id,
    limit: 100,
    role: 'helper',
    status: 'confirmed',
  });

  const configs = configsQuery.data?.items ?? [];
  const defaultConfig =
    configs.find((config) => config.userId === null) ?? null;
  // One stable seed for an event whose default row does not exist yet: a
  // catch-all allow. The editor only reads it on mount.
  const fallbackRules = useMemo(() => defaultCheckinRules(), []);

  const helpers = useMemo(() => {
    const byUser = new Map<string, ScannerOption>();
    for (const participant of helpersQuery.data?.items ?? []) {
      if (participant.userId) {
        byUser.set(participant.userId, {
          id: participant.userId,
          name: participant.name,
        });
      }
    }
    return [...byUser.values()];
  }, [helpersQuery.data]);

  const overrideUserIds = new Set(
    configs.flatMap((config) => (config.userId ? [config.userId] : []))
  );

  const selectedUserId = selected === DEFAULT ? null : selected;
  const selectedConfig =
    selectedUserId === null
      ? defaultConfig
      : (configs.find((config) => config.userId === selectedUserId) ?? null);
  // A helper without an override starts from the event default, so saving
  // copies it into their own row instead of starting from nothing.
  const initialRules =
    selectedConfig?.rules ?? defaultConfig?.rules ?? fallbackRules;
  const version = selectedConfig?.updatedAt.getTime() ?? 'new';
  const hasOverride = selectedUserId !== null && selectedConfig !== null;

  const hint =
    selectedUserId === null
      ? t('events.checkinConfigs.defaultHint')
      : t(
          hasOverride
            ? 'events.checkinConfigs.helperOverrideHint'
            : 'events.checkinConfigs.helperInheritHint'
        );

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-semibold text-lg">
          {t('events.checkinConfigs.title')}
        </h2>
        <p className="max-w-2xl text-muted-foreground text-sm">
          {t('events.checkinConfigs.hint')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-scanner`}>
          {t('events.checkinConfigs.scanner')}
        </Label>
        <Select
          items={[
            {
              label: t('events.checkinConfigs.defaultOption'),
              value: DEFAULT,
            },
            ...helpers.map((helper) => ({
              label: overrideUserIds.has(helper.id)
                ? `${helper.name} · ${t('events.checkinConfigs.overrideBadge')}`
                : helper.name,
              value: helper.id,
            })),
          ]}
          onValueChange={(value) => value && setSelected(value)}
          value={selected}
        >
          <SelectTrigger
            aria-label={t('events.checkinConfigs.scanner')}
            className="min-w-64"
            id={`${idPrefix}-scanner`}
          >
            <SelectValue />
          </SelectTrigger>
        </Select>

        {overrideUserIds.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
            <span>{t('events.checkinConfigs.overrides')}</span>
            {helpers
              .filter((helper) => overrideUserIds.has(helper.id))
              .map((helper) => (
                <Badge key={helper.id} variant="secondary">
                  {helper.name}
                </Badge>
              ))}
          </div>
        ) : null}
      </div>

      <ConfigEditor
        eventId={event.id}
        fields={event.fields}
        hasOverride={hasOverride}
        hint={hint}
        initialRules={initialRules}
        key={`${selected}:${version}`}
        userId={selectedUserId}
      />
    </section>
  );
}

type ConfigEditorProps = {
  eventId: string;
  fields: EventDetail['fields'];
  hasOverride: boolean;
  hint: string;
  initialRules: EventCheckinRule[];
  userId: string | null;
};

/**
 * One scanner's draft. The parent remounts it through its `key` when the
 * selection or the stored row changes, so the draft seeds itself on mount and
 * switching scanners discards unsaved edits.
 */
function ConfigEditor({
  eventId,
  fields,
  hasOverride,
  hint,
  initialRules,
  userId,
}: ConfigEditorProps) {
  const { t } = useTranslation();
  const [rules, setRules] = useState<EventCheckinRule[]>(initialRules);
  const upsert = useUpsertEventCheckinConfig();
  const reset = useDeleteEventCheckinConfig();

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <p className="text-muted-foreground text-xs">{hint}</p>

      <CheckinRulesEditor fields={fields} onChange={setRules} value={rules} />

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={upsert.isPending}
          onClick={() => upsert.mutate({ id: eventId, rules, userId })}
          type="button"
        >
          <Save className="h-4 w-4" />
          {upsert.isPending ? t('common.loading') : t('common.save')}
        </Button>
        {userId !== null && hasOverride ? (
          <Button
            disabled={reset.isPending}
            onClick={() => reset.mutate({ id: eventId, userId })}
            type="button"
            variant="outline"
          >
            <Undo2 className="h-4 w-4" />
            {t('events.checkinConfigs.reset')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
