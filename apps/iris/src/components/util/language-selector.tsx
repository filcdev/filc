import { ChevronDown, Globe } from 'lucide-react';
import { useCookies } from 'react-cookie';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type LangCode = 'EN' | 'HU';

const LANGUAGES: ReadonlyArray<{ code: LangCode; name: string }> = [
  { code: 'EN', name: 'English' },
  { code: 'HU', name: 'Magyar' },
] as const;

export function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const [, setCookie] = useCookies(['filc.language']);

  const current: LangCode = i18n.language as LangCode;

  const handleChange = async (code: LangCode) => {
    const lng = code.toLowerCase();
    await i18n.changeLanguage(lng);
    setCookie('filc.language', lng, { sameSite: 'lax' });
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lng;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className="text-muted-foreground hover:text-foreground"
            size="sm"
            variant="ghost"
          >
            <Globe className="mr-1 h-4 w-4" />
            {current?.toUpperCase()}
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        }
      />
      <DropdownMenuContent className="w-32">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('selectLanguage')}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            className={current === lang.code ? 'bg-accent' : ''}
            key={lang.code}
            onClick={() => handleChange(lang.code)}
          >
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSelector;
