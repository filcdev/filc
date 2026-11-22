import { Button } from '@filcdev/ui/components/button';
import { Checkbox } from '@filcdev/ui/components/checkbox';
import { Input } from '@filcdev/ui/components/input';
import { Label } from '@filcdev/ui/components/label';
import { cn } from '@filcdev/ui/lib/utils';
import { useForm, useStore } from '@tanstack/react-form';
import { Save } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { DateTimePicker } from '@/components/date-time-picker';
import { type EventDetail, useUpdateEvent } from '@/hooks/events';

/** A blank grade input is "unset" (`null`), never zero. */
function gradeOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

type HelperSettingsValues = {
  helperCapacity: string;
  helperMaxGrade: string;
  helperMinGrade: string;
  helperRegistrationClosesAt: Date | null;
  helperRegistrationEnabled: boolean;
  helperRegistrationOpensAt: Date | null;
  helperRegistrationSeparateWindow: boolean;
};

const toHelperSettingsValues = (event: EventDetail): HelperSettingsValues => ({
  helperCapacity: event.helperCapacity?.toString() ?? '',
  helperMaxGrade: event.helperMaxGrade?.toString() ?? '',
  helperMinGrade: event.helperMinGrade?.toString() ?? '',
  helperRegistrationClosesAt: event.helperRegistrationClosesAt
    ? new Date(event.helperRegistrationClosesAt)
    : null,
  helperRegistrationEnabled: event.helperRegistrationEnabled,
  helperRegistrationOpensAt: event.helperRegistrationOpensAt
    ? new Date(event.helperRegistrationOpensAt)
    : null,
  helperRegistrationSeparateWindow: event.helperRegistrationSeparateWindow,
});

/**
 * The helper signup configuration of one event: whether helpers may sign up,
 * their window and grade band. The door rules live one section below, per
 * scanner, because they are no longer a column of the event.
 *
 * The parent remounts this component when the event changes, so the form seeds
 * itself from the fresh row instead of re-seeding inside an effect.
 */
export function HelperSettings({ event }: { event: EventDetail }) {
  const { t } = useTranslation();
  const formId = useId();
  const updateMutation = useUpdateEvent();

  const form = useForm({
    defaultValues: toHelperSettingsValues(event),
    onSubmit: ({ value }) => {
      // PATCH: only these columns move; `updatedAt` does not change when the
      // values are already stored, so saving an untouched page is a no-op.
      updateMutation.mutate({
        helperCapacity: gradeOrNull(value.helperCapacity),
        helperMaxGrade: gradeOrNull(value.helperMaxGrade),
        helperMinGrade: gradeOrNull(value.helperMinGrade),
        helperRegistrationClosesAt: value.helperRegistrationClosesAt,
        helperRegistrationEnabled: value.helperRegistrationEnabled,
        helperRegistrationOpensAt: value.helperRegistrationOpensAt,
        helperRegistrationSeparateWindow:
          value.helperRegistrationSeparateWindow,
        id: event.id,
      });
    },
  });

  const helperRegistrationEnabled = useStore(
    form.store,
    (state) => state.values.helperRegistrationEnabled
  );
  const separateWindow = useStore(
    form.store,
    (state) => state.values.helperRegistrationSeparateWindow
  );

  return (
    <form
      className="space-y-8"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        form.handleSubmit();
      }}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <fieldset className="space-y-3">
          {' '}
          <legend className="mb-2 font-medium text-sm">
            {t('events.helperRegistrationGroup')}
          </legend>
          <form.Field name="helperRegistrationEnabled">
            {(field) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={field.state.value}
                  id={`${formId}-helper-registration`}
                  onCheckedChange={(checked) =>
                    field.handleChange(checked === true)
                  }
                />
                <label
                  className="cursor-pointer font-medium text-sm leading-none"
                  htmlFor={`${formId}-helper-registration`}
                >
                  {t('events.helperRegistrationEnabled')}
                </label>
              </div>
            )}
          </form.Field>
          <p className="text-muted-foreground text-xs">
            {t('events.helperRegistrationHint')}
          </p>
          {/* Off means off: a disabled fieldset takes the controls out of the
              tab order exactly as the dialog does. */}
          <fieldset
            className={cn(
              'space-y-3 transition-opacity',
              !helperRegistrationEnabled && 'opacity-60'
            )}
            disabled={!helperRegistrationEnabled}
          >
            <form.Field name="helperRegistrationSeparateWindow">
              {(field) => (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={field.state.value}
                    id={`${formId}-helper-window`}
                    onCheckedChange={(checked) =>
                      field.handleChange(checked === true)
                    }
                  />
                  <label
                    className="cursor-pointer font-medium text-sm leading-none"
                    htmlFor={`${formId}-helper-window`}
                  >
                    {t('events.helperRegistrationSeparateWindow')}
                  </label>
                </div>
              )}
            </form.Field>

            {separateWindow && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs">
                  {t('events.helperRegistrationSeparateWindowHint')}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <form.Field name="helperRegistrationOpensAt">
                    {(field) => (
                      <div className="space-y-2">
                        <Label htmlFor={`${formId}-helper-opens`}>
                          {t('events.helperRegistrationOpensAt')}
                        </Label>
                        <DateTimePicker
                          clearable
                          id={`${formId}-helper-opens`}
                          onChange={field.handleChange}
                          value={field.state.value}
                        />
                      </div>
                    )}
                  </form.Field>
                  <form.Field name="helperRegistrationClosesAt">
                    {(field) => (
                      <div className="space-y-2">
                        <Label htmlFor={`${formId}-helper-closes`}>
                          {t('events.helperRegistrationClosesAt')}
                        </Label>
                        <DateTimePicker
                          clearable
                          id={`${formId}-helper-closes`}
                          onChange={field.handleChange}
                          value={field.state.value}
                        />
                      </div>
                    )}
                  </form.Field>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <form.Field name="helperCapacity">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={`${formId}-helper-capacity`}>
                      {t('events.helperCapacity')}
                    </Label>
                    <Input
                      id={`${formId}-helper-capacity`}
                      min={1}
                      onChange={(changeEvent) =>
                        field.handleChange(changeEvent.target.value)
                      }
                      placeholder={t('events.unlimited')}
                      type="number"
                      value={field.state.value}
                    />
                  </div>
                )}
              </form.Field>
              <form.Field name="helperMinGrade">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={`${formId}-helper-min-grade`}>
                      {t('events.helperMinGrade')}
                    </Label>
                    <Input
                      id={`${formId}-helper-min-grade`}
                      max={13}
                      min={1}
                      onChange={(changeEvent) =>
                        field.handleChange(changeEvent.target.value)
                      }
                      placeholder={t('events.noGradeBound')}
                      type="number"
                      value={field.state.value}
                    />
                  </div>
                )}
              </form.Field>
              <form.Field name="helperMaxGrade">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={`${formId}-helper-max-grade`}>
                      {t('events.helperMaxGrade')}
                    </Label>
                    <Input
                      id={`${formId}-helper-max-grade`}
                      max={13}
                      min={1}
                      onChange={(changeEvent) =>
                        field.handleChange(changeEvent.target.value)
                      }
                      placeholder={t('events.noGradeBound')}
                      type="number"
                      value={field.state.value}
                    />
                  </div>
                )}
              </form.Field>
            </div>
            <p className="text-muted-foreground text-xs">
              {t('events.helperCapacityHint')}
            </p>
            <p className="text-muted-foreground text-xs">
              {t('events.helperGradeHint')}
            </p>
          </fieldset>
        </fieldset>
      </div>

      <Button disabled={updateMutation.isPending} type="submit">
        <Save className="h-4 w-4" />
        {updateMutation.isPending ? t('common.loading') : t('common.save')}
      </Button>
    </form>
  );
}
