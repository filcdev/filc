import { Field, FieldLabel } from '@filcdev/ui/components/field';
import { cn } from '@filcdev/ui/lib/utils';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { EventRoomItem } from '@/hooks/events';

type EventRoomPickerProps = {
  onChange: (roomId: string) => void;
  rooms: EventRoomItem[];
  value: string;
};

/**
 * The room choice of a signup form: one radio per room with its free places,
 * and a full room disabled rather than hidden. Shared by the student and the
 * guest form, so both ask for a room the same way and a full one reads the same
 * on both.
 */
export function EventRoomPicker({
  onChange,
  rooms,
  value,
}: EventRoomPickerProps) {
  const { t } = useTranslation();
  const idPrefix = useId();

  if (rooms.length === 0) {
    return null;
  }

  return (
    <Field>
      <FieldLabel id={`${idPrefix}-label`}>
        {t('events.public.roomLabel')}
        <span aria-hidden="true"> *</span>
        <span className="sr-only"> ({t('events.questionRequired')})</span>
      </FieldLabel>
      <p className="text-muted-foreground text-xs">
        {t('events.public.roomHint')}
      </p>
      <div
        aria-labelledby={`${idPrefix}-label`}
        className="space-y-2"
        role="radiogroup"
      >
        {rooms.map((room) => {
          const full = room.remaining === 0;
          const roomId = `${idPrefix}-${room.id}`;
          return (
            <label
              className={cn(
                'flex cursor-pointer items-center justify-between gap-3 rounded-md border p-3 text-sm',
                full && 'cursor-not-allowed opacity-60',
                value === room.id && 'border-primary'
              )}
              htmlFor={roomId}
              key={room.id}
            >
              <span className="flex items-center gap-2">
                <input
                  checked={value === room.id}
                  disabled={full}
                  id={roomId}
                  name={`${idPrefix}-room`}
                  onChange={() => onChange(room.id)}
                  type="radio"
                  value={room.id}
                />
                <span className="font-medium">{room.name}</span>
              </span>
              <span
                className={cn(
                  'text-muted-foreground text-xs',
                  full && 'font-medium text-destructive'
                )}
              >
                {full
                  ? t('events.public.reasons.room_full')
                  : t('events.public.roomSeatsLeft', {
                      count: room.remaining,
                    })}
              </span>
            </label>
          );
        })}
      </div>
    </Field>
  );
}
