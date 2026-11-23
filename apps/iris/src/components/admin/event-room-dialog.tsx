import { Button } from '@filcdev/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { Input } from '@filcdev/ui/components/input';
import { Label } from '@filcdev/ui/components/label';
import { useForm, useStore } from '@tanstack/react-form';
import { Save } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type EventRoomItem,
  useCreateEventRoom,
  useUpdateEventRoom,
} from '@/hooks/events';
import type { BaseDialogProps } from './admin.types';

type EventRoomDialogProps = BaseDialogProps & {
  eventId: string;
  room?: EventRoomItem | null;
};

type EventRoomFormValues = {
  capacity: string;
  name: string;
};

/** A blank capacity is invalid, never zero; the backend requires a positive one. */
function capacityOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * The create/edit form of one room. Self-contained: it calls the room's own
 * mutation hooks and closes through `onSaved`. The parent remounts it with a
 * key when the edited room changes, so `useForm` seeds itself on mount and no
 * effect writes state from a prop.
 */
export function EventRoomDialog({
  eventId,
  onOpenChange,
  open,
  room,
}: EventRoomDialogProps) {
  const { t } = useTranslation();
  const formId = useId();
  const nameId = useId();
  const capacityId = useId();
  const close = () => onOpenChange(false);
  const createMutation = useCreateEventRoom({ onSaved: close });
  const updateMutation = useUpdateEventRoom({ onSaved: close });
  const isEdit = Boolean(room);

  const form = useForm({
    defaultValues: {
      capacity: room ? String(room.capacity) : '',
      name: room?.name ?? '',
    } satisfies EventRoomFormValues,
    onSubmit: ({ value }) => {
      const capacity = capacityOrNull(value.capacity);
      const name = value.name.trim();
      if (!(capacity && name)) {
        return;
      }
      if (room) {
        updateMutation.mutate({
          capacity,
          id: eventId,
          name,
          roomId: room.id,
        });
        return;
      }
      createMutation.mutate({ capacity, id: eventId, name });
    },
  });

  const values = useStore(form.store, (state) => state.values);
  const valid =
    values.name.trim().length > 0 && capacityOrNull(values.capacity) !== null;
  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('events.rooms.editTitle')
              : t('events.rooms.createTitle')}
          </DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          id={formId}
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={nameId}>{t('events.rooms.name')}</Label>
                <Input
                  id={nameId}
                  onChange={(change) => field.handleChange(change.target.value)}
                  placeholder={t('events.rooms.namePlaceholder')}
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="capacity">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={capacityId}>{t('events.rooms.capacity')}</Label>
                <Input
                  id={capacityId}
                  min={1}
                  onChange={(change) => field.handleChange(change.target.value)}
                  placeholder={t('events.rooms.capacityPlaceholder')}
                  type="number"
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>
        </form>

        <DialogFooter>
          <Button onClick={close} variant="outline">
            {t('common.cancel')}
          </Button>
          <Button disabled={!valid || pending} form={formId} type="submit">
            <Save className="h-4 w-4" />
            {isEdit ? t('events.save') : t('events.rooms.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
