import { Button } from '@filcdev/ui/components/button';
import { Checkbox } from '@filcdev/ui/components/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { Label } from '@filcdev/ui/components/label';
import { Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (blackAndWhite: boolean) => Promise<void>;
};

export function PrintDialog({ open, onOpenChange, onGenerate }: Props) {
  const { t } = useTranslation();
  const [blackAndWhite, setBlackAndWhite] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      await onGenerate(blackAndWhite);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent showCloseButton={!loading}>
        <DialogHeader>
          <DialogTitle>{t('timetable.printDialog.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <Checkbox
            checked={blackAndWhite}
            disabled={loading}
            id="bw-toggle"
            onCheckedChange={(checked) => setBlackAndWhite(checked === true)}
          />
          <Label htmlFor="bw-toggle">
            {t('timetable.printDialog.blackAndWhite')}
          </Label>
        </div>

        <DialogFooter showCloseButton={!loading}>
          <Button disabled={loading} onClick={handleGenerate}>
            {loading ? (
              <>
                <Loader2Icon className="animate-spin" />
                {t('timetable.printDialog.generating')}
              </>
            ) : (
              t('timetable.printDialog.generate')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
