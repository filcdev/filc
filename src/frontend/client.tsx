import { RouterClient } from '@tanstack/react-router/ssr/client';
import { hydrateRoot } from 'react-dom/client';
import { createRouter } from '~/frontend/router';
import { reportWebVitals } from '~/frontend/utils/web-vitals';

const router = createRouter();

hydrateRoot(document, <RouterClient router={router} />);

// TODO: replace console
// biome-ignore lint/suspicious/noConsole: see above
reportWebVitals(console.log);
