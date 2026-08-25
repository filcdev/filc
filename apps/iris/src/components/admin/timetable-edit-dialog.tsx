import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type TimetableRow,
  useUpdateTimetable,
} from '@/hooks/timetables-admin';
import type { BaseDialogProps } from './admin.types';

type TimetableEditDialogProps = BaseDialogProps & {
  item?: TimetableRow | null;
};

export function TimetableEditDialog({
  item,
  onOpenChange,
  open,
}: TimetableEditDialogProps) {
  const { t } = useTranslation();

  const [name, setName] = useState(item?.name ?? '');
  const [validFrom, setValidFrom] = useState<Date | undefined>(
    item?.validFrom ? new Date(item.validFrom) : undefined
  );
  const [validTo, setValidTo] = useState<Date | undefined>(
    item?.validTo ? new Date(item.validTo) : undefined
  );

  useEffect(() => {
    if (open) {
      setName(item?.name ?? '');
      setValidFrom(item?.validFrom ? new Date(item.validFrom) : undefined);
      setValidTo(item?.validTo ? new Date(item.validTo) : undefined);
    }
  }, [open, item]);

  const updateMutation = useUpdateTimetable({
    onSaved: () => onOpenChange(false),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) {
      return;
    }
    await updateMutation.mutateAsync({
      id: item.id,
      payload: {
        name: name.trim() || undefined,
        validFrom: validFrom?.toISOString().slice(0, 10),
        validTo: validTo ? validTo.toISOString().slice(0, 10) : null,
      },
    });
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('timetable.editTitle')}: {item?.name}
          </DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="timetable-name">{t('timetable.nameLabel')}</Label>
            <Input
              autoComplete="off"
              id="timetable-name"
              onChange={(e) => setName(e.target.value)}
              placeholder={t('timetable.importNamePlaceholder')}
              value={name}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('timetable.validFromLabel')}</Label>
            <DatePicker
              date={validFrom}
              onDateChange={setValidFrom}
              placeholder={t('timetable.validFromPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('timetable.validToLabel')}</Label>
            <DatePicker
              date={validTo}
              onDateChange={setValidTo}
              placeholder={t('timetable.validToPlaceholder')}
            />
            <p className="text-muted-foreground text-xs">
              {t('timetable.validToDescription')}
            </p>
          </div>
          <DialogFooter>
            <Button disabled={updateMutation.isPending} type="submit">
              <Save className="mr-2 h-4 w-4" />
              {t('substitution.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
