import { Button } from '@filcdev/ui/components/button';
import type { ScanLocale } from '@/i18n';

type Props = {
  label: string;
  locale: ScanLocale;
  onChange: (locale: ScanLocale) => void;
};

/** Flips the app between its two languages; the label names the switch itself. */
export const LocaleToggle = ({ label, locale, onChange }: Props) => (
  <Button
    aria-label={label}
    className="min-w-12 text-muted-foreground"
    onClick={() => onChange(locale === 'hu' ? 'en' : 'hu')}
    size="lg"
    type="button"
    variant="ghost"
  >
    {locale === 'hu' ? 'EN' : 'HU'}
  </Button>
);
