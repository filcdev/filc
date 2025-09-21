import { RouterClient } from '@tanstack/react-router/ssr/client';
import { hydrateRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { createRouter } from '~/frontend/router';
import { i18n } from '~/frontend/utils/i18n';
import { reportWebVitals } from '~/frontend/utils/web-vitals';

const router = createRouter();

async function prepareI18n() {
  // Read language from cookie set by the server
  const cookie = document.cookie
    .split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith('i18next='));
  const fromCookie = cookie
    ? decodeURIComponent(cookie.split('=')[1] || '')
    : '';
  const lang = (fromCookie || 'hu') as 'en' | 'hu';
  if (i18n.language !== lang) {
    await i18n.changeLanguage(lang);
  }
  await new Promise<void>((resolve, reject) =>
    i18n.loadNamespaces(['translation'], (err) =>
      err ? reject(err) : resolve()
    )
  );
}

await prepareI18n();

router.update({
  context: {
    ...router.options.context,
    i18n,
    head: '',
  },
});

hydrateRoot(
  document,
  <I18nextProvider i18n={i18n}>
    <RouterClient router={router} />
  </I18nextProvider>
);

// TODO: replace console
// biome-ignore lint/suspicious/noConsole: see above
reportWebVitals(console.log);
