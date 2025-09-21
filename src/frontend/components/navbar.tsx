'use client';

import { useNavigate } from '@tanstack/react-router';
import {
  BookOpen,
  Calendar,
  ChevronDown,
  Globe,
  GraduationCap,
  Loader2,
  LogIn,
  LogOut,
  Settings,
} from 'lucide-react';
import { useState } from 'react';
import { useCookies } from 'react-cookie';
import { useTranslation } from 'react-i18next';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '~/frontend/components/ui/avatar';
import { Button } from '~/frontend/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/frontend/components/ui/dropdown-menu';
import { authClient } from '~/frontend/utils/authentication';

export function Navbar() {
  const navigate = useNavigate();
  const { i18n, t } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState(
    (i18n.language?.toUpperCase() || 'EN') as 'EN' | 'HU'
  );
  const [, setCookie] = useCookies(['filc-lang']);
  const { data, isPending } = authClient.useSession();

  const languages = [
    { code: 'EN', name: 'English' },
    { code: 'HU', name: 'Magyar' },
  ] as const;

  const handleLanguageChange = async (
    code: (typeof languages)[number]['code']
  ) => {
    setSelectedLanguage(code);
    // Update i18n language and persist cookie for SSR detection
    await i18n.changeLanguage(code.toLowerCase());
    setCookie('filc-lang', code.toLowerCase(), { path: '/' });
  };

  return (
    <nav className="border-border border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground text-xl">filc</span>
        </div>

        <div className="ml-8 hidden items-center gap-6 md:flex">
          <Button
            className="text-muted-foreground hover:text-foreground"
            size="sm"
            variant="ghost"
          >
            <Calendar className="mr-2 h-4 w-4" />
            {t('schedule')}
          </Button>
          <Button
            className="text-muted-foreground hover:text-foreground"
            size="sm"
            variant="ghost"
          >
            <BookOpen className="mr-2 h-4 w-4" />
            {t('substitutions')}
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* <Button
            className="relative text-muted-foreground hover:text-foreground"
            size="sm"
            variant="ghost"
          >
            <Bell className="h-4 w-4" />
            <Badge className="-top-1 -right-1 absolute h-5 w-5 rounded-full bg-primary p-0 text-primary-foreground text-xs">
              3
            </Badge>
          </Button> */}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="text-muted-foreground hover:text-foreground"
                size="sm"
                variant="ghost"
              >
                <Globe className="mr-1 h-4 w-4" />
                {selectedLanguage}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuLabel>{t('selectLanguage')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {languages.map((lang) => (
                <DropdownMenuItem
                  className={selectedLanguage === lang.code ? 'bg-accent' : ''}
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                >
                  {lang.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {(() => {
            if (isPending) {
              return (
                <Button
                  className="h-9 w-24"
                  disabled
                  size="sm"
                  variant="outline"
                >
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                </Button>
              );
            }

            if (data?.user) {
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="relative h-9 w-9 rounded-full"
                      variant="ghost"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage
                          alt="Profile"
                          src={data.user.image ?? undefined}
                        />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {data.user.name
                            ?.split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2) ||
                            data.user.email?.slice(0, 2).toUpperCase() ||
                            'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="font-medium text-sm leading-none">
                          {data.user.name}
                        </p>
                        <p className="text-muted-foreground text-xs leading-none">
                          {data.user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>{t('settings')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={async () => {
                        await authClient.signOut();
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>{t('logout')}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }

            return (
              <Button
                className="gap-2"
                onClick={() => navigate({ to: '/auth/login' })}
                size="sm"
                variant="default"
              >
                <LogIn className="h-4 w-4" /> {t('sign_in') || 'Sign in'}
              </Button>
            );
          })()}
        </div>
      </div>
    </nav>
  );
}
