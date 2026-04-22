import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TimetableItem } from '@/components/timetable/types';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

type TimetableEditDialogProps = {
  item?: TimetableItem | null;
  isSubmitting: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: {
    validFrom?: string;
    validTo?: string | null;
  }) => Promise<void>;
};

export function TimetableEditDialog({
  item,
  isSubmitting,
  open,
  onOpenChange,
  onSubmit,
}: TimetableEditDialogProps) {
  const { t } = useTranslation();

  const [validFrom, setValidFrom] = useState<Date | undefined>(
    item?.validFrom ? new Date(item.validFrom) : undefined
  );
  const [validTo, setValidTo] = useState<Date | undefined>(
    item?.validTo ? new Date(item.validTo) : undefined
  );

  useEffect(() => {
    if (open) {
      setValidFrom(item?.validFrom ? new Date(item.validFrom) : undefined);
      setValidTo(item?.validTo ? new Date(item.validTo) : undefined);
    }
  }, [open, item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      validFrom: validFrom?.toISOString().slice(0, 10),
      validTo: validTo ? validTo.toISOString().slice(0, 10) : null,
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
            <Button disabled={isSubmitting} type="submit">
              <Save className="mr-2 h-4 w-4" />
              {t('substitution.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
