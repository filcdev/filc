import {
  categoryDefaults,
  type EventCategory,
  type EventCheckinDisplay,
  type EventHelperRequirement,
  type EventStatus,
  eventCategories,
  eventCheckinDisplays,
  eventStatuses,
  helperRequirementOpsByFieldType,
} from '@filcdev/api/domains/events/event';
import {
  type EventFieldAudience,
  type EventFieldType,
  eventFieldAudiences,
  eventFieldTypes,
} from '@filcdev/api/domains/events/fields';
import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import { Checkbox } from '@filcdev/ui/components/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { FieldError } from '@filcdev/ui/components/field';
import { Input } from '@filcdev/ui/components/input';
import { Label } from '@filcdev/ui/components/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
} from '@filcdev/ui/components/select';
import { Separator } from '@filcdev/ui/components/separator';
import { cn } from '@filcdev/ui/lib/utils';
import { useForm, useStore } from '@tanstack/react-form';
import {
  CalendarClock,
  ClipboardList,
  FileText,
  Image,
  ListChecks,
  type LucideIcon,
  Plus,
  Save,
  Trash,
  UserRoundPlus,
} from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AudiencePicker } from '@/components/admin/audience-picker';
import { ImageField } from '@/components/admin/image-field';
import { DateTimePicker } from '@/components/date-time-picker';
import {
  type EventDetail,
  type EventFieldItem,
  type EventPayload,
  useCreateEvent,
  useDeleteEventImage,
  useReplaceEventFields,
  useUpdateEvent,
  useUploadEventImage,
} from '@/hooks/events';
import { useCohorts } from '@/hooks/news';
import { textToContent } from '@/utils/content';
import { type EventFieldDraft, newEventFieldDraft } from '@/utils/event-fields';
import { apiBaseUrl } from '@/utils/orpc';
import type { BaseDialogProps } from './admin.types';

type EventDialogProps = BaseDialogProps & {
  item?: EventDetail | null;
};

/** The door's configured answers; an event without any has none. */
const toCheckinFields = (item: EventDetail | null | undefined): string[] =>
  item?.checkinFields ?? [];

type EventFormValues = {
  capacity: string;
  category: EventCategory;
  checkinDisplay: EventCheckinDisplay;
  cohortIds: string[];
  description: string;
  endsAt: Date | null;
  guestRegistrationEnabled: boolean;
  helperMaxGrade: string;
  helperMinGrade: string;
  helperRegistrationClosesAt: Date | null;
  helperRegistrationEnabled: boolean;
  helperRegistrationOpensAt: Date | null;
  helperRegistrationSeparateWindow: boolean;
  maxGrade: string;
  minGrade: string;
  registrationClosesAt: Date | null;
  registrationEnabled: boolean;
  registrationOpensAt: Date | null;
  startsAt: Date | null;
  status: EventStatus;
  title: string;
};

type EventSectionId =
  | 'basics'
  | 'schedule'
  | 'registration'
  | 'guests'
  | 'questions'
  | 'banner';

type EventSection = {
  /** The fields that badge the section when their validation fails. */
  fields: (keyof EventFormValues)[];
  icon: LucideIcon;
  id: EventSectionId;
  labelKey: string;
};

/**
 * The panes of the event form, in the order the nav lists them. The form stays
 * one form: the nav only picks which pane is visible, so every field keeps
 * validating and submitting exactly as it did on the single scroll.
 */
const EVENT_SECTIONS: EventSection[] = [
  {
    fields: ['title', 'description', 'category', 'status'],
    icon: FileText,
    id: 'basics',
    labelKey: 'events.sections.basics',
  },
  {
    fields: ['startsAt', 'endsAt'],
    icon: CalendarClock,
    id: 'schedule',
    labelKey: 'events.sections.schedule',
  },
  {
    fields: [
      'registrationEnabled',
      'registrationOpensAt',
      'registrationClosesAt',
      'capacity',
      'minGrade',
      'maxGrade',
      'cohortIds',
      'helperRegistrationEnabled',
      'helperRegistrationSeparateWindow',
      'helperRegistrationOpensAt',
      'helperRegistrationClosesAt',
    ],
    icon: ClipboardList,
    id: 'registration',
    labelKey: 'events.sections.registration',
  },
  {
    fields: ['guestRegistrationEnabled'],
    icon: UserRoundPlus,
    id: 'guests',
    labelKey: 'events.sections.guests',
  },
  {
    fields: [],
    icon: ListChecks,
    id: 'questions',
    labelKey: 'events.sections.questions',
  },
  { fields: [], icon: Image, id: 'banner', labelKey: 'events.banner' },
];

/** The rich-text payload the announcement editor writes, flattened for a textarea. */
function contentToText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .map((block) => {
      if (
        block &&
        typeof block === 'object' &&
        'content' in block &&
        typeof block.content === 'string'
      ) {
        return block.content;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

/** The minute the API and the picker both carry, seconds dropped. */
function toMinuteDate(date: Date | null | undefined): Date | null {
  if (!date) {
    return null;
  }
  const next = new Date(date);
  next.setSeconds(0, 0);
  return next;
}

function numberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * A capacity is either unset (unlimited, `null`) or at least one seat. The
 * input's `min` is only a hint, and the contract rejects zero with a raw 400,
 * so the value is clamped here instead of surfacing that error.
 */
function capacityOrNull(value: string): number | null {
  const parsed = numberOrNull(value);
  return parsed === null ? null : Math.max(1, Math.trunc(parsed));
}

function toFieldDrafts(
  fields: EventFieldItem[] | undefined
): EventFieldDraft[] {
  return (fields ?? []).map((field) => ({
    audiences: field.audiences,
    id: field.id,
    key: field.id,
    label: field.label,
    optionsText: (field.options ?? []).join(', '),
    required: field.required,
    type: field.type,
  }));
}

function toFormValues(item: EventDetail | null | undefined): EventFormValues {
  const category = item?.category ?? 'open_day';
  return {
    capacity: item?.capacity?.toString() ?? '',
    category,
    checkinDisplay: item?.checkinDisplay ?? 'name',
    cohortIds: item?.cohortIds ?? [],
    description: contentToText(item?.description),
    endsAt: toMinuteDate(item?.endsAt),
    guestRegistrationEnabled: item?.guestRegistrationEnabled ?? false,
    helperMaxGrade: item?.helperMaxGrade?.toString() ?? '',
    helperMinGrade: item?.helperMinGrade?.toString() ?? '',
    helperRegistrationClosesAt: toMinuteDate(item?.helperRegistrationClosesAt),
    helperRegistrationEnabled: item?.helperRegistrationEnabled ?? false,
    helperRegistrationOpensAt: toMinuteDate(item?.helperRegistrationOpensAt),
    helperRegistrationSeparateWindow:
      item?.helperRegistrationSeparateWindow ?? false,
    maxGrade: item?.maxGrade?.toString() ?? '',
    minGrade: item?.minGrade?.toString() ?? '',
    registrationClosesAt: toMinuteDate(item?.registrationClosesAt),
    registrationEnabled:
      item?.registrationEnabled ??
      categoryDefaults(category).registrationEnabled,
    registrationOpensAt: toMinuteDate(item?.registrationOpensAt),
    startsAt: toMinuteDate(item?.startsAt),
    // A new event starts published; an edited event keeps its own status.
    status: item?.status ?? 'published',
    title: item?.title ?? '',
  };
}

const splitOptions = (text: string): string[] =>
  text
    .split(',')
    .map((option) => option.trim())
    .filter(Boolean);

/** One condition while it is edited, with a stable client-side key. */
type HelperRequirementDraft = EventHelperRequirement & { key: string };

const toRequirementDrafts = (
  requirements: EventHelperRequirement[] | undefined
): HelperRequirementDraft[] =>
  (requirements ?? []).map((requirement) => ({
    ...requirement,
    key: crypto.randomUUID(),
  }));

type HelperRequirementRowProps = {
  fields: EventFieldItem[];
  formId: string;
  index: number;
  onFieldChange: (index: number, fieldId: string) => void;
  onOpChange: (index: number, op: EventHelperRequirement['op']) => void;
  onRemove: (index: number) => void;
  onValueChange: (index: number, value: string) => void;
  requirement: HelperRequirementDraft;
};

/** The value control follows the picked question's type. */
function RequirementValueControl({
  field,
  id,
  onChange,
  value,
}: {
  field: EventFieldItem | undefined;
  id: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const { t } = useTranslation();

  if (field?.type === 'checkbox') {
    return (
      <p className="py-2 text-muted-foreground text-xs">
        {t('events.helperRequirementNoValue')}
      </p>
    );
  }

  if (field?.type === 'select') {
    return (
      <Select
        items={(field.options ?? []).map((option) => ({
          label: option,
          value: option,
        }))}
        onValueChange={(next) => onChange(next ?? '')}
        value={value}
      >
        <SelectTrigger className="w-full" id={id}>
          <SelectValue />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Input
      id={id}
      onChange={(event) => onChange(event.target.value)}
      step={field?.type === 'number' ? 'any' : undefined}
      type={field?.type === 'number' ? 'number' : 'text'}
      value={value}
    />
  );
}

/** One condition row: question, operator and the value it compares against. */
function HelperRequirementRow({
  fields,
  formId,
  index,
  onFieldChange,
  onOpChange,
  onRemove,
  onValueChange,
  requirement,
}: HelperRequirementRowProps) {
  const { t } = useTranslation();
  const field = fields.find(
    (candidate) => candidate.id === requirement.fieldId
  );
  const ops = field
    ? helperRequirementOpsByFieldType[field.type]
    : ([] as const);
  const fieldKey = `${requirement.fieldId}-${index}`;

  return (
    <div className="space-y-2 rounded-md border p-2">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor={`${formId}-requirement-field-${fieldKey}`}>
            {t('events.helperRequirementField')}
          </Label>
          <Select
            items={fields.map((candidate) => ({
              label: candidate.label,
              value: candidate.id,
            }))}
            onValueChange={(value) => onFieldChange(index, value ?? '')}
            value={requirement.fieldId}
          >
            <SelectTrigger
              className="w-full"
              id={`${formId}-requirement-field-${fieldKey}`}
            >
              <SelectValue />
            </SelectTrigger>
          </Select>
        </div>
        <Button
          aria-label={t('events.removeHelperRequirement')}
          onClick={() => onRemove(index)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Trash className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${formId}-requirement-op-${fieldKey}`}>
            {t('events.helperRequirementOperator')}
          </Label>
          <Select
            items={ops.map((op) => ({
              label: t(`events.helperRequirementOps.${op}`),
              value: op,
            }))}
            onValueChange={(value) =>
              onOpChange(
                index,
                (value ?? ops[0] ?? 'equals') as EventHelperRequirement['op']
              )
            }
            value={requirement.op}
          >
            <SelectTrigger
              className="w-full"
              id={`${formId}-requirement-op-${fieldKey}`}
            >
              <SelectValue />
            </SelectTrigger>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`${formId}-requirement-value-${fieldKey}`}>
            {t('events.helperRequirementValue')}
          </Label>
          <RequirementValueControl
            field={field}
            id={`${formId}-requirement-value-${fieldKey}`}
            onChange={(value) => onValueChange(index, value)}
            value={requirement.value}
          />
        </div>
      </div>
    </div>
  );
}

type HelperRequirementEditorProps = {
  fields: EventFieldItem[];
  /** Helper signups are off: the fieldset is inert, so explain that instead. */
  helpersEnabled: boolean;
  /** Append a question draft and open the Questions pane. */
  onAddQuestion: () => void;
  requirements: HelperRequirementDraft[];
  setRequirements: Dispatch<SetStateAction<HelperRequirementDraft[]>>;
};

/**
 * The answers a helper application must satisfy. Only a saved, student-facing
 * question can be picked: a condition stores a field id, and the backend
 * rejects an id that is not on this event. Adding a question and a condition in
 * the same visit therefore needs one save in between, which is why the empty
 * state says so.
 *
 * The empty button is a way out, not a dead end: with no usable question it
 * adds a draft and jumps to the Questions pane, and with helper signups off
 * there is no button at all, only the reason the section is disabled.
 */
function HelperRequirementEditor({
  fields,
  helpersEnabled,
  onAddQuestion,
  requirements,
  setRequirements,
}: HelperRequirementEditorProps) {
  const { t } = useTranslation();
  const formId = useId();
  const usableFields = fields.filter((field) =>
    field.audiences.includes('helper')
  );

  const update = (
    index: number,
    patch: Partial<EventHelperRequirement>
  ): void => {
    setRequirements((current) =>
      current.map((requirement, position) =>
        position === index ? { ...requirement, ...patch } : requirement
      )
    );
  };

  const remove = (index: number): void => {
    setRequirements((current) =>
      current.filter((_requirement, position) => position !== index)
    );
  };

  const selectField = (index: number, fieldId: string): void => {
    const field = usableFields.find((candidate) => candidate.id === fieldId);
    if (!field) {
      return;
    }
    const op = helperRequirementOpsByFieldType[field.type][0] ?? 'equals';
    const value = field.type === 'select' ? (field.options?.[0] ?? '') : '';
    update(index, { fieldId, op, value });
  };

  const add = (): void => {
    const field = usableFields[0];
    if (!field) {
      return;
    }
    const op = helperRequirementOpsByFieldType[field.type][0] ?? 'equals';
    setRequirements((current) => [
      ...current,
      {
        fieldId: field.id,
        key: crypto.randomUUID(),
        op,
        value: field.type === 'select' ? (field.options?.[0] ?? '') : '',
      },
    ]);
  };

  // One line above the rows, naming the actual blocker: the helper signup
  // switch, a missing student question, or nothing at all.
  let explanation: string | null = null;
  if (!helpersEnabled) {
    explanation = t('events.helperRequirementsNeedHelpers');
  } else if (usableFields.length === 0) {
    explanation = t('events.noStudentQuestionsForRequirements');
  } else if (requirements.length === 0) {
    explanation = t('events.noHelperRequirements');
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-medium text-sm">
            {t('events.helperRequirementsTitle')}
          </p>
          <p className="text-muted-foreground text-xs">
            {t('events.helperRequirementsHint')}
          </p>
        </div>
        {helpersEnabled && usableFields.length === 0 && (
          <Button
            onClick={onAddQuestion}
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            {t('events.addQuestion')}
          </Button>
        )}
        {helpersEnabled && usableFields.length > 0 && (
          <Button onClick={add} size="sm" type="button" variant="outline">
            <Plus className="h-4 w-4" />
            {t('events.addHelperRequirement')}
          </Button>
        )}
      </div>

      {explanation && (
        <p className="text-muted-foreground text-xs">{explanation}</p>
      )}

      {requirements.map((requirement, index) => (
        <HelperRequirementRow
          fields={usableFields}
          formId={formId}
          index={index}
          key={requirement.key}
          onFieldChange={selectField}
          onOpChange={(position, op) => update(position, { op })}
          onRemove={remove}
          onValueChange={(position, value) => update(position, { value })}
          requirement={requirement}
        />
      ))}
    </div>
  );
}

type CheckinFieldPickerProps = {
  fields: EventFieldItem[];
  onToggle: (fieldId: string, checked: boolean) => void;
  selected: string[];
};

/** The event's saved questions, each one shown at the door when ticked. */
function CheckinFieldPicker({
  fields,
  onToggle,
  selected,
}: CheckinFieldPickerProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <p className="font-medium text-sm">{t('events.checkinFields')}</p>
      <p className="text-muted-foreground text-xs">
        {t('events.checkinFieldsHint')}
      </p>
      {fields.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          {t('events.checkinFieldsEmpty')}
        </p>
      ) : (
        <div className="space-y-2">
          {fields.map((question) => (
            <div className="flex items-center gap-2" key={question.id}>
              <Checkbox
                checked={selected.includes(question.id)}
                id={`checkin-field-${question.id}`}
                onCheckedChange={(checked) =>
                  onToggle(question.id, checked === true)
                }
              />
              <label
                className="cursor-pointer font-medium text-sm leading-none"
                htmlFor={`checkin-field-${question.id}`}
              >
                {question.label}
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type FieldAudiencePickerProps = {
  audiences: EventFieldAudience[];
  idPrefix: string;
  onChange: (audiences: EventFieldAudience[]) => void;
};

/**
 * Who sees the question. Ticking several is the point: the old "both" is now
 * guest + student. The last remaining tick cannot be removed, because a
 * question on no form is never shown and never answerable.
 */
function FieldAudiencePicker({
  audiences,
  idPrefix,
  onChange,
}: FieldAudiencePickerProps) {
  const { t } = useTranslation();

  const toggle = (audience: EventFieldAudience, checked: boolean): void => {
    if (checked) {
      onChange([...audiences, audience]);
      return;
    }
    if (audiences.length === 1) {
      return;
    }
    onChange(audiences.filter((value) => value !== audience));
  };

  return (
    <fieldset className="space-y-2">
      <legend className="font-medium text-sm">
        {t('events.questionAudiences')}
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {eventFieldAudiences.map((audience) => {
          const checked = audiences.includes(audience);
          return (
            <div className="flex items-center gap-2" key={audience}>
              <Checkbox
                checked={checked}
                disabled={checked && audiences.length === 1}
                id={`${idPrefix}-${audience}`}
                onCheckedChange={(next) => toggle(audience, next === true)}
              />
              <label
                className="cursor-pointer font-medium text-sm leading-none"
                htmlFor={`${idPrefix}-${audience}`}
              >
                {t(`events.audiences.${audience}`)}
              </label>
            </div>
          );
        })}
      </div>
      <p className="text-muted-foreground text-xs">
        {t('events.questionAudiencesHint')}
      </p>
    </fieldset>
  );
}

type FieldEditorProps = {
  fields: EventFieldDraft[];
  setFields: Dispatch<SetStateAction<EventFieldDraft[]>>;
};

function FieldEditor({ fields, setFields }: FieldEditorProps) {
  const { t } = useTranslation();

  const updateField = (key: string, patch: Partial<EventFieldDraft>) => {
    setFields((current) =>
      current.map((field) =>
        field.key === key ? { ...field, ...patch } : field
      )
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <Button
          onClick={() =>
            setFields((current) => [...current, newEventFieldDraft()])
          }
          size="sm"
          type="button"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          {t('events.addQuestion')}
        </Button>
      </div>
      {fields.length === 0 && (
        <p className="text-muted-foreground text-xs">
          {t('events.noQuestions')}
        </p>
      )}
      {fields.map((field) => (
        <div className="space-y-2 rounded-md border p-2" key={field.key}>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor={`field-label-${field.key}`}>
                {t('events.questionLabel')}
              </Label>
              <Input
                id={`field-label-${field.key}`}
                onChange={(event) =>
                  updateField(field.key, { label: event.target.value })
                }
                value={field.label}
              />
            </div>
            <Button
              aria-label={t('events.removeQuestion')}
              onClick={() =>
                setFields((current) =>
                  current.filter((item) => item.key !== field.key)
                )
              }
              size="icon"
              type="button"
              variant="ghost"
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`field-type-${field.key}`}>
                {t('events.questionType')}
              </Label>
              <Select
                items={eventFieldTypes.map((type) => ({
                  label: t(`events.fieldTypes.${type}`),
                  value: type,
                }))}
                onValueChange={(value) =>
                  value &&
                  updateField(field.key, { type: value as EventFieldType })
                }
                value={field.type}
              >
                <SelectTrigger
                  className="w-full"
                  id={`field-type-${field.key}`}
                >
                  <SelectValue />
                </SelectTrigger>
              </Select>
            </div>
            <FieldAudiencePicker
              audiences={field.audiences}
              idPrefix={`field-audiences-${field.key}`}
              onChange={(audiences) => updateField(field.key, { audiences })}
            />
          </div>
          {field.type === 'select' && (
            <div className="space-y-1">
              <Label htmlFor={`field-options-${field.key}`}>
                {t('events.questionOptions')}
              </Label>
              <Input
                id={`field-options-${field.key}`}
                onChange={(event) =>
                  updateField(field.key, { optionsText: event.target.value })
                }
                placeholder={t('events.questionOptionsPlaceholder')}
                value={field.optionsText}
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Checkbox
              checked={field.required}
              id={`field-required-${field.key}`}
              onCheckedChange={(checked) =>
                updateField(field.key, { required: checked === true })
              }
            />
            <label
              className="cursor-pointer font-medium text-sm leading-none"
              htmlFor={`field-required-${field.key}`}
            >
              {t('events.questionRequired')}
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}

export function EventDialog({ item, onOpenChange, open }: EventDialogProps) {
  const { t } = useTranslation();
  const close = () => onOpenChange(false);

  const createMutation = useCreateEvent();
  const updateMutation = useUpdateEvent();
  const replaceFields = useReplaceEventFields();
  const uploadImage = useUploadEventImage({
    onSaved: () => setBannerRemoved(false),
  });
  const removeImage = useDeleteEventImage({
    onSaved: () => setBannerRemoved(true),
  });
  const { data: cohorts = [] } = useCohorts(open);

  const formId = useId();
  const categoryId = useId();
  const statusId = useId();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [bannerRemoved, setBannerRemoved] = useState(false);
  // A create that got far enough to write the event is followed by question and
  // banner writes; if one of those fails the dialog stays open, and retrying
  // must update the event it already made instead of making a second one.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<EventSectionId>('basics');
  // The scroll container is one node for every pane, so focusing it is what
  // puts the keyboard at the top of the pane that just opened.
  const paneRef = useRef<HTMLDivElement>(null);
  const [fields, setFields] = useState<EventFieldDraft[]>(() =>
    toFieldDrafts(item?.fields)
  );
  const [requirements, setRequirements] = useState<HelperRequirementDraft[]>(
    () => toRequirementDrafts(item?.helperRequirements)
  );
  // The door's answers are a saved list of question ids, like the helper
  // requirements: a question added in this visit needs a save before it can be
  // selected here.
  const [checkinFields, setCheckinFields] = useState<string[]>(() =>
    toCheckinFields(item)
  );

  const imageRow = uploadImage.data ?? (bannerRemoved ? null : item);
  const imageKey = imageRow?.imageKey ?? null;
  const imageUrl = imageKey
    ? `${apiBaseUrl}/events/${imageRow?.id}/image?includeDrafts=true&v=${imageRow?.imageUpdatedAt?.getTime() ?? ''}`
    : null;

  const form = useForm({
    defaultValues: toFormValues(item),
    onSubmit: async ({ value }) => {
      // The field validators block an empty start or end before this runs; the
      // branch keeps the types honest and says why if it is ever reached.
      const { endsAt, startsAt } = value;
      if (!(startsAt && endsAt)) {
        toast.error(t('events.datesRequired'));
        return;
      }

      // Everything but the description, which an untouched legacy row has
      // nothing valid to send for.
      const payload: Omit<EventPayload, 'description'> = {
        capacity: capacityOrNull(value.capacity),
        category: value.category,
        checkinDisplay: value.checkinDisplay,
        checkinFields,
        cohortIds: value.cohortIds,
        endsAt,
        guestRegistrationEnabled: value.guestRegistrationEnabled,
        helperMaxGrade: numberOrNull(value.helperMaxGrade),
        helperMinGrade: numberOrNull(value.helperMinGrade),
        helperRegistrationClosesAt: value.helperRegistrationClosesAt,
        helperRegistrationEnabled: value.helperRegistrationEnabled,
        helperRegistrationOpensAt: value.helperRegistrationOpensAt,
        helperRegistrationSeparateWindow:
          value.helperRegistrationSeparateWindow,
        helperRequirements: requirements.map(
          ({ key: _key, ...requirement }) => requirement
        ),
        maxGrade: numberOrNull(value.maxGrade),
        minGrade: numberOrNull(value.minGrade),
        registrationClosesAt: value.registrationClosesAt,
        registrationEnabled: value.registrationEnabled,
        registrationOpensAt: value.registrationOpensAt,
        startsAt,
        status: value.status,
        title: value.title.trim(),
      };

      // A description the editor never touched is not rewritten: a stored block
      // array goes back as it is, and a legacy flat string is left out of the
      // request rather than reshaped into blocks.
      const description = textToContent(value.description, item?.description);

      try {
        // An event created by a failed earlier attempt is updated from then on.
        let eventId = item?.id ?? createdId;

        if (eventId) {
          await updateMutation.mutateAsync({
            ...payload,
            ...(description === undefined ? {} : { description }),
            id: eventId,
          });
        } else {
          const created = await createMutation.mutateAsync({
            ...payload,
            description: textToContent(value.description, undefined),
          });
          eventId = created.id;
          setCreatedId(created.id);
        }

        // Questions are their own replace endpoint; the dialog sends the
        // complete list so existing rows keep their ids.
        await replaceFields.mutateAsync({
          fields: fields
            .filter((field) => field.label.trim())
            .map((field, position) => ({
              audiences: field.audiences,
              ...(field.id ? { id: field.id } : {}),
              label: field.label.trim(),
              options:
                field.type === 'select'
                  ? splitOptions(field.optionsText)
                  : null,
              position,
              required: field.required,
              type: field.type,
            })),
          id: eventId,
        });

        if (imageFile) {
          await uploadImage.mutateAsync({ file: imageFile, id: eventId });
        }

        close();
      } catch {
        // The hooks already toasted the failure; keep the dialog open so the
        // entered values and the picked file survive a retry.
      }
    },
    onSubmitInvalid: ({ formApi }) => {
      // The panes are all mounted, so every field has validated by now: open
      // the first one that failed instead of leaving the user in a section
      // that looks filled in while Save does nothing visible.
      const firstInvalid = EVENT_SECTIONS.find((section) =>
        section.fields.some(
          (name) => (formApi.state.fieldMeta[name]?.errors.length ?? 0) > 0
        )
      );
      if (firstInvalid) {
        setActiveSection(firstInvalid.id);
        paneRef.current?.focus();
      }
    },
  });

  const cohortIds = useStore(form.store, (state) => state.values.cohortIds);
  const fieldMeta = useStore(form.store, (state) => state.fieldMeta);
  // A visitor is a kind of registration, so the guest switch is inert until
  // the master switch is on.
  const registrationEnabled = useStore(
    form.store,
    (state) => state.values.registrationEnabled
  );
  const helperRegistrationEnabled = useStore(
    form.store,
    (state) => state.values.helperRegistrationEnabled
  );
  const helperSeparateWindow = useStore(
    form.store,
    (state) => state.values.helperRegistrationSeparateWindow
  );

  const sectionNav = EVENT_SECTIONS.map((section) => ({
    ...section,
    errorCount: section.fields.filter((name) => fieldMeta[name]?.errors.length)
      .length,
  }));

  const activeLabelKey =
    sectionNav.find((section) => section.id === activeSection)?.labelKey ??
    'events.sections.basics';

  const goToSection = (next: EventSectionId) => {
    setActiveSection(next);
    // The mobile section picker hands focus back to its trigger when it
    // closes, so the pane is focused on the next frame: that lands the
    // keyboard at the top of the section that just opened.
    requestAnimationFrame(() => paneRef.current?.focus());
  };

  /**
   * The way out of the empty requirement editor: a saved question is what a
   * condition can name, so this adds a draft and takes the organizer to the
   * pane where it is filled in and saved with the event.
   */
  const addQuestionForRequirements = () => {
    setFields((current) => [...current, newEventFieldDraft()]);
    goToSection('questions');
  };

  const toggleCheckinField = (fieldId: string, checked: boolean): void => {
    setCheckinFields((current) => {
      if (checked) {
        return [...current, fieldId];
      }
      return current.filter((id) => id !== fieldId);
    });
  };

  const toggleCohort = (cohortId: string, checked: boolean) => {
    const current = form.getFieldValue('cohortIds');
    form.setFieldValue(
      'cohortIds',
      checked ? [...current, cohortId] : current.filter((id) => id !== cohortId)
    );
  };

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    replaceFields.isPending ||
    uploadImage.isPending;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="flex h-[85vh] max-h-[680px] flex-col gap-0 overflow-hidden p-0 md:max-w-3xl md:p-0"
        initialFocus={paneRef}
      >
        <DialogHeader className="shrink-0 border-b px-4 py-3 pr-14">
          <DialogTitle>
            {item ? t('events.edit') : t('events.create')}
          </DialogTitle>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          id={formId}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <nav
              aria-label={t('events.sectionsNav')}
              className="hidden w-52 shrink-0 flex-col gap-1 overflow-y-auto border-r p-3 md:flex"
            >
              {sectionNav.map((section) => (
                <button
                  aria-current={
                    section.id === activeSection ? 'true' : undefined
                  }
                  className={cn(
                    'flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-sm transition-colors',
                    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                    section.id === activeSection &&
                      'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                  )}
                  key={section.id}
                  onClick={() => goToSection(section.id)}
                  type="button"
                >
                  <section.icon className="size-4 shrink-0" />
                  <span className="flex-1 truncate">{t(section.labelKey)}</span>
                  {section.errorCount > 0 && (
                    <Badge variant="destructive">{section.errorCount}</Badge>
                  )}
                </button>
              ))}
            </nav>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 p-4 md:hidden">
                <label className="sr-only" htmlFor={`${formId}-section`}>
                  {t('events.sectionsNav')}
                </label>
                <Select
                  items={sectionNav.map((section) => ({
                    label:
                      section.errorCount > 0
                        ? `${t(section.labelKey)} (${section.errorCount})`
                        : t(section.labelKey),
                    value: section.id,
                  }))}
                  onValueChange={(value) => {
                    if (value) {
                      goToSection(value as EventSectionId);
                    }
                  }}
                  value={activeSection}
                >
                  <SelectTrigger className="w-full" id={`${formId}-section`}>
                    <SelectValue />
                  </SelectTrigger>
                </Select>
              </div>

              <header className="hidden h-11 shrink-0 items-center px-4 md:flex">
                <h2 className="font-medium text-base">{t(activeLabelKey)}</h2>
              </header>
              <Separator />

              <div
                className="min-h-0 flex-1 overflow-y-auto p-4 outline-none"
                ref={paneRef}
                tabIndex={-1}
              >
                <div className="space-y-4" hidden={activeSection !== 'basics'}>
                  <form.Field
                    name="title"
                    validators={{
                      // The form runs `noValidate`: a hidden pane's `required` input
                      // would block submission with no focusable control to point
                      // at, so the rule lives where the pane can show it.
                      onSubmit: ({ value }) =>
                        value.trim() ? undefined : t('events.titleRequired'),
                    }}
                  >
                    {(field) => (
                      <div className="space-y-2">
                        <Label htmlFor={field.name}>
                          {t('events.titleLabel')}
                        </Label>
                        <Input
                          id={field.name}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          placeholder={t('events.titlePlaceholder')}
                          required
                          value={field.state.value}
                        />
                        <FieldError errors={field.state.meta.errors} />
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="description">
                    {(field) => (
                      <div className="space-y-2">
                        <Label htmlFor={field.name}>
                          {t('events.descriptionLabel')}
                        </Label>
                        <textarea
                          className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                          id={field.name}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          placeholder={t('events.descriptionPlaceholder')}
                          value={field.state.value}
                        />
                      </div>
                    )}
                  </form.Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <form.Field name="category">
                      {(field) => (
                        <div className="space-y-2">
                          <Label htmlFor={categoryId}>
                            {t('events.category')}
                          </Label>
                          <Select
                            items={eventCategories.map((category) => ({
                              label: t(`events.categories.${category}`),
                              value: category,
                            }))}
                            onValueChange={(value) => {
                              if (!value) {
                                return;
                              }
                              field.handleChange(value as EventCategory);
                              // The category only pre-fills the switch; the organizer
                              // stays free to flip it back.
                              form.setFieldValue(
                                'registrationEnabled',
                                categoryDefaults(value as EventCategory)
                                  .registrationEnabled
                              );
                            }}
                            value={field.state.value}
                          >
                            <SelectTrigger className="w-full" id={categoryId}>
                              <SelectValue />
                            </SelectTrigger>
                          </Select>
                        </div>
                      )}
                    </form.Field>

                    <form.Field name="status">
                      {(field) => (
                        <div className="space-y-2">
                          <Label htmlFor={statusId}>{t('events.status')}</Label>
                          <Select
                            items={eventStatuses.map((status) => ({
                              label: t(`events.statuses.${status}`),
                              value: status,
                            }))}
                            onValueChange={(value) =>
                              value && field.handleChange(value as EventStatus)
                            }
                            value={field.state.value}
                          >
                            <SelectTrigger className="w-full" id={statusId}>
                              <SelectValue />
                            </SelectTrigger>
                          </Select>
                        </div>
                      )}
                    </form.Field>
                  </div>
                </div>

                <div
                  className="space-y-4"
                  hidden={activeSection !== 'schedule'}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <form.Field
                      name="startsAt"
                      validators={{
                        onSubmit: ({ value }) =>
                          value ? undefined : t('events.datesRequired'),
                      }}
                    >
                      {(field) => (
                        <div className="space-y-2">
                          <Label htmlFor={field.name}>
                            {t('events.startsAt')}
                          </Label>
                          <DateTimePicker
                            id={field.name}
                            invalid={field.state.meta.errors.length > 0}
                            onChange={field.handleChange}
                            value={field.state.value}
                          />
                          <FieldError errors={field.state.meta.errors} />
                        </div>
                      )}
                    </form.Field>
                    <form.Field
                      name="endsAt"
                      validators={{
                        onSubmit: ({ value }) =>
                          value ? undefined : t('events.datesRequired'),
                      }}
                    >
                      {(field) => (
                        <div className="space-y-2">
                          <Label htmlFor={field.name}>
                            {t('events.endsAt')}
                          </Label>
                          <DateTimePicker
                            id={field.name}
                            invalid={field.state.meta.errors.length > 0}
                            onChange={field.handleChange}
                            value={field.state.value}
                          />
                          <FieldError errors={field.state.meta.errors} />
                        </div>
                      )}
                    </form.Field>
                  </div>
                </div>

                <div
                  className="space-y-4"
                  hidden={activeSection !== 'registration'}
                >
                  <fieldset className="space-y-3 rounded-md border p-3">
                    <legend className="px-1 font-medium text-sm">
                      {t('events.registrationGroup')}
                    </legend>

                    <form.Field name="registrationEnabled">
                      {(field) => (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={field.state.value}
                            id={`${formId}-registration`}
                            onCheckedChange={(checked) =>
                              field.handleChange(checked === true)
                            }
                          />
                          <label
                            className="cursor-pointer font-medium text-sm leading-none"
                            htmlFor={`${formId}-registration`}
                          >
                            {t('events.registrationEnabled')}
                          </label>
                        </div>
                      )}
                    </form.Field>

                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs">
                        {t('events.registrationWindowHint')}
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <form.Field name="registrationOpensAt">
                          {(field) => (
                            <div className="space-y-2">
                              <Label htmlFor={field.name}>
                                {t('events.registrationOpensAt')}
                              </Label>
                              <DateTimePicker
                                clearable
                                id={field.name}
                                onChange={field.handleChange}
                                value={field.state.value}
                              />
                            </div>
                          )}
                        </form.Field>
                        <form.Field name="registrationClosesAt">
                          {(field) => (
                            <div className="space-y-2">
                              <Label htmlFor={field.name}>
                                {t('events.registrationClosesAt')}
                              </Label>
                              <DateTimePicker
                                clearable
                                id={field.name}
                                onChange={field.handleChange}
                                value={field.state.value}
                              />
                            </div>
                          )}
                        </form.Field>
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="space-y-3 rounded-md border p-3">
                    <legend className="px-1 font-medium text-sm">
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

                    {/* A native disabled fieldset takes its controls out of the
                        tab order, which is what "helpers are off" means here. */}
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

                      {helperSeparateWindow && (
                        <div className="space-y-2">
                          <p className="text-muted-foreground text-xs">
                            {t('events.helperRegistrationSeparateWindowHint')}
                          </p>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <form.Field name="helperRegistrationOpensAt">
                              {(field) => (
                                <div className="space-y-2">
                                  <Label htmlFor={field.name}>
                                    {t('events.helperRegistrationOpensAt')}
                                  </Label>
                                  <DateTimePicker
                                    clearable
                                    id={field.name}
                                    onChange={field.handleChange}
                                    value={field.state.value}
                                  />
                                </div>
                              )}
                            </form.Field>
                            <form.Field name="helperRegistrationClosesAt">
                              {(field) => (
                                <div className="space-y-2">
                                  <Label htmlFor={field.name}>
                                    {t('events.helperRegistrationClosesAt')}
                                  </Label>
                                  <DateTimePicker
                                    clearable
                                    id={field.name}
                                    onChange={field.handleChange}
                                    value={field.state.value}
                                  />
                                </div>
                              )}
                            </form.Field>
                          </div>
                        </div>
                      )}

                      <div className="grid gap-4 sm:grid-cols-2">
                        <form.Field name="helperMinGrade">
                          {(field) => (
                            <div className="space-y-2">
                              <Label htmlFor={field.name}>
                                {t('events.helperMinGrade')}
                              </Label>
                              <Input
                                id={field.name}
                                max={13}
                                min={1}
                                onChange={(event) =>
                                  field.handleChange(event.target.value)
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
                              <Label htmlFor={field.name}>
                                {t('events.helperMaxGrade')}
                              </Label>
                              <Input
                                id={field.name}
                                max={13}
                                min={1}
                                onChange={(event) =>
                                  field.handleChange(event.target.value)
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
                        {t('events.helperGradeHint')}
                      </p>

                      <HelperRequirementEditor
                        fields={item?.fields ?? []}
                        helpersEnabled={helperRegistrationEnabled}
                        onAddQuestion={addQuestionForRequirements}
                        requirements={requirements}
                        setRequirements={setRequirements}
                      />
                    </fieldset>
                  </fieldset>

                  <fieldset className="space-y-3 rounded-md border p-3">
                    <legend className="px-1 font-medium text-sm">
                      {t('events.checkinDisplayGroup')}
                    </legend>
                    <form.Field name="checkinDisplay">
                      {(field) => (
                        <div className="space-y-2">
                          <Label htmlFor={`${formId}-checkin-display`}>
                            {t('events.checkinDisplay')}
                          </Label>
                          <Select
                            items={eventCheckinDisplays.map((display) => ({
                              label: t(`events.checkinDisplays.${display}`),
                              value: display,
                            }))}
                            onValueChange={(value) =>
                              value &&
                              field.handleChange(value as EventCheckinDisplay)
                            }
                            value={field.state.value}
                          >
                            <SelectTrigger
                              className="w-full"
                              id={`${formId}-checkin-display`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                          </Select>
                          <p className="text-muted-foreground text-xs">
                            {t(
                              `events.checkinDisplayHints.${field.state.value}`
                            )}
                          </p>
                        </div>
                      )}
                    </form.Field>

                    <CheckinFieldPicker
                      fields={item?.fields ?? []}
                      onToggle={toggleCheckinField}
                      selected={checkinFields}
                    />
                  </fieldset>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <form.Field name="capacity">
                      {(field) => (
                        <div className="space-y-2">
                          <Label htmlFor={field.name}>
                            {t('events.capacity')}
                          </Label>
                          <Input
                            id={field.name}
                            min={1}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            placeholder={t('events.capacityHint')}
                            type="number"
                            value={field.state.value}
                          />
                        </div>
                      )}
                    </form.Field>
                    <form.Field name="minGrade">
                      {(field) => (
                        <div className="space-y-2">
                          <Label htmlFor={field.name}>
                            {t('events.minGrade')}
                          </Label>
                          <Input
                            id={field.name}
                            max={13}
                            min={1}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            type="number"
                            value={field.state.value}
                          />
                        </div>
                      )}
                    </form.Field>
                    <form.Field name="maxGrade">
                      {(field) => (
                        <div className="space-y-2">
                          <Label htmlFor={field.name}>
                            {t('events.maxGrade')}
                          </Label>
                          <Input
                            id={field.name}
                            max={13}
                            min={1}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            type="number"
                            value={field.state.value}
                          />
                        </div>
                      )}
                    </form.Field>
                  </div>

                  <p className="text-muted-foreground text-xs">
                    {t('events.gradeHint')}
                  </p>

                  <AudiencePicker
                    allHint={t('events.everyoneHint')}
                    allLabel={t('events.everyone')}
                    hint={t('events.cohortsHint')}
                    idPrefix="event-cohort"
                    items={cohorts}
                    label={t('events.cohorts')}
                    onClear={() => form.setFieldValue('cohortIds', [])}
                    onToggle={toggleCohort}
                    selectedIds={cohortIds}
                  />
                </div>

                <div className="space-y-4" hidden={activeSection !== 'guests'}>
                  <fieldset
                    className={cn(
                      'space-y-3 rounded-md border p-3 transition-opacity',
                      !registrationEnabled && 'opacity-60'
                    )}
                    disabled={!registrationEnabled}
                  >
                    <legend className="px-1 font-medium text-sm">
                      {t('events.guestGroup')}
                    </legend>
                    <form.Field name="guestRegistrationEnabled">
                      {(field) => (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={field.state.value}
                              id={`${formId}-guest-registration`}
                              onCheckedChange={(checked) =>
                                field.handleChange(checked === true)
                              }
                            />
                            <label
                              className="cursor-pointer font-medium text-sm leading-none"
                              htmlFor={`${formId}-guest-registration`}
                            >
                              {t('events.guestRegistrationEnabled')}
                            </label>
                          </div>
                          <p className="text-muted-foreground text-xs">
                            {t('events.guestRegistrationHint')}
                          </p>
                        </div>
                      )}
                    </form.Field>
                  </fieldset>
                </div>

                <div
                  className="space-y-4"
                  hidden={activeSection !== 'questions'}
                >
                  <FieldEditor fields={fields} setFields={setFields} />
                </div>

                <div className="space-y-4" hidden={activeSection !== 'banner'}>
                  <ImageField
                    file={imageFile}
                    id={item?.id ?? null}
                    imageKey={imageKey}
                    imageUrl={imageUrl}
                    isRemoving={removeImage.isPending}
                    labels={{
                      hint: t('events.bannerHint'),
                      onSave: t('events.bannerOnSave'),
                      remove: t('events.bannerRemove'),
                      title: t('events.banner'),
                      upload: t('events.bannerUpload'),
                    }}
                    onFileChange={setImageFile}
                    onRemove={(id) => removeImage.mutate({ id })}
                    upload={(file, id) => uploadImage.mutateAsync({ file, id })}
                  />
                </div>
              </div>
            </div>
          </div>
        </form>

        <DialogFooter className="shrink-0 border-t p-4">
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            {t('common.cancel')}
          </Button>
          <Button disabled={isSaving} form={formId} type="submit">
            <Save className="h-4 w-4" />
            {t('events.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
