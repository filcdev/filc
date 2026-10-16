import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@filcdev/ui/components/card';
import { createFileRoute } from '@tanstack/react-router';
import { ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

/**
 * The `policy.sections` resource is a JSON array, so i18next hands it back as
 * `unknown` data with `returnObjects`. Validating it beats asserting it: a
 * translation that drifts from this shape fails here, loudly, instead of
 * rendering a half-empty page.
 */
const policySectionsSchema = z.array(
  z.object({
    bullets: z.array(z.string()).optional(),
    paragraphs: z.array(z.string()).optional(),
    title: z.string(),
  })
);

export const Route = createFileRoute('/_public/policy')({
  component: PolicyPage,
});

function PolicyPage() {
  const { t } = useTranslation('policy');
  const sections = policySectionsSchema.parse(
    t('sections', { returnObjects: true })
  );

  useEffect(() => {
    document.title = t('pageTitle');
  }, [t]);

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="font-bold text-3xl text-foreground sm:text-4xl">
              {t('title')}
            </h1>
            <p className="text-muted-foreground">{t('subtitle')}</p>
            <p className="text-muted-foreground text-sm">
              {t('effectiveDate')}
            </p>
          </div>
        </header>

        <div className="space-y-5">
          {sections.map((section) => (
            <Card className="border-border/60" key={section.title}>
              <CardHeader>
                <CardTitle className="text-xl">{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground leading-7">
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets && section.bullets.length > 0 ? (
                  <ul className="list-disc space-y-2 pl-6">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>

        <footer className="space-y-2 border-t pt-6 text-center text-muted-foreground text-sm">
          <p>{t('lastUpdated')}</p>
          <p>
            <a
              className="underline transition-colors hover:text-foreground"
              href="mailto:gdpr@petrik.hu"
            >
              gdpr@petrik.hu
            </a>
            {' · '}
            <a
              className="underline transition-colors hover:text-foreground"
              href="https://www.naih.hu/"
              rel="noreferrer"
              target="_blank"
            >
              NAIH
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
