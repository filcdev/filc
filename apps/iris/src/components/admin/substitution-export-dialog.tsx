import { pdf } from '@react-pdf/renderer';
import dayjs from 'dayjs';
import { Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type SubstitutionExportRow,
  SubstitutionPDF,
} from './substitution-pdf';

type SubstitutionItem = {
  substitution: { id: string; date: string };
  teacher: { firstName: string; lastName: string } | null;
  lessons: Array<
    | {
        id: string;
        teachers?: Array<{ id: string; name: string; short?: string }>;
        period?: { period: number } | null;
        cohorts?: string[];
      }
    | null
    | undefined
  >;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  substitutions: SubstitutionItem[];
};

function buildRows(
  substitutions: SubstitutionItem[],
  date: Date
): SubstitutionExportRow[] {
  const target = dayjs(date).format('YYYY-MM-DD');
  const rows: SubstitutionExportRow[] = [];

  for (const sub of substitutions) {
    if (dayjs(sub.substitution.date).format('YYYY-MM-DD') !== target) {
      continue;
    }
    const substituteTeacher = sub.teacher
      ? `${sub.teacher.firstName} ${sub.teacher.lastName}`
      : '';

    for (const lesson of sub.lessons) {
      if (!lesson) {
        continue;
      }
      const missingTeacher = (lesson.teachers ?? [])
        .map((t) => t.name)
        .join(', ');
      const cohorts = (lesson.cohorts ?? []).join(', ');
      const period = lesson.period ? `${lesson.period.period}.` : '?';
      rows.push({ cohorts, missingTeacher, period, substituteTeacher });
    }
  }

  return rows;
}

function downloadCsv(
  rows: SubstitutionExportRow[],
  filename: string,
  labels: {
    missingTeacher: string;
    substituteTeacher: string;
    class: string;
    period: string;
  }
) {
  const dangerous = ['=', '+', '-', '@', '\t', '\r'];
  const escapeS = (v: string) => {
    const safe = dangerous.some((c) => v.startsWith(c)) ? `'${v}` : v;
    return safe.includes(';') || safe.includes('"') || safe.includes('\n')
      ? `"${safe.replace(/"/g, '""')}"`
      : safe;
  };

  const lines = [
    [
      labels.missingTeacher,
      labels.substituteTeacher,
      labels.class,
      labels.period,
    ]
      .map(escapeS)
      .join(';'),
    ...rows.map((r) =>
      [r.missingTeacher, r.substituteTeacher, r.cohorts, r.period]
        .map(escapeS)
        .join(';')
    ),
  ];

  // BOM for Excel UTF-8 recognition
  const bom = '﻿';
  const blob = new Blob([bom + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SubstitutionExportDialog({
  open,
  onOpenChange,
  substitutions,
}: Props) {
  const { i18n, t } = useTranslation();
  const [date, setDate] = useState<Date>(new Date());
  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf');
  const [loading, setLoading] = useState(false);

  const labels = {
    class: t('substitution.exportClass'),
    missingTeacher: t('substitution.exportAbsentTeacher'),
    noSubstitutions: t('substitution.noSubstitutions'),
    period: t('substitution.period'),
    substituteTeacher: t('substitution.substituteTeacher'),
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const rows = buildRows(substitutions, date);
      const dateLabel = new Intl.DateTimeFormat(
        i18n.language === 'hu' ? 'hu-HU' : 'en-US'
      ).format(date);
      const isoDate = dayjs(date).format('YYYY-MM-DD');

      if (format === 'pdf') {
        const blob = await pdf(
          <SubstitutionPDF date={dateLabel} labels={labels} rows={rows} />
        ).toBlob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        downloadCsv(rows, `substitutions-${isoDate}.csv`, labels);
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(
        t('error.generic', {
          message: error instanceof Error ? error.message : 'Export failed',
        })
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent showCloseButton={!loading}>
        <DialogHeader>
          <DialogTitle>{t('substitution.exportTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t('substitution.date')}</Label>
            <DatePicker
              date={date}
              disabled={loading}
              onDateChange={(d) => d && setDate(d)}
              placeholder={t('substitution.datePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('substitution.exportFormat')}</Label>
            <Select
              disabled={loading}
              onValueChange={(v) => setFormat(v as 'pdf' | 'csv')}
              value={format}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter showCloseButton={!loading}>
          <Button disabled={loading} onClick={handleExport}>
            {loading ? (
              <>
                <Loader2Icon className="animate-spin" />
                {t('substitution.exporting')}
              </>
            ) : (
              t('substitution.export')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
