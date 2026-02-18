import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SubstitutionView } from '@/components/subs-view';

// Map this page to /subs
export const Route = createFileRoute('/_public/subs')({
  component: App,
});

function App() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('PageTitles.substitutions');
  }, [t]);

  return <SubstitutionView />;
}
