import { RouterClient } from '@tanstack/react-router/ssr/client';
import { hydrateRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { createRouter } from '~/frontend/router';
import { i18n } from '~/frontend/utils/i18n';
import { reportWebVitals } from '~/frontend/utils/web-vitals';

const router = createRouter();

async function prepareI18n() {
  await new Promise<void>((resolve, reject) =>
    i18n.loadNamespaces(['translation'], (err) =>
      err ? reject(err) : resolve()
    )
  );
  if (typeof document !== 'undefined') {
    document.documentElement.lang = i18n.language;
  }
}

await prepareI18n();

router.update({
  context: {
    ...router.options.context,
    head: '',
    i18n,
  },
});

hydrateRoot(
  document,
  <I18nextProvider i18n={i18n}>
    <RouterClient router={router} />
  </I18nextProvider>
);

if (import.meta.env.DEV) {
  // TODO: replace console
  // biome-ignore lint/suspicious/noConsole: see above
  reportWebVitals(console.log);
}
