import { createFileRoute } from '@tanstack/react-router';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '~/frontend/components/ui/button';
import { authClient } from '~/frontend/utils/authentication';

export const Route = createFileRoute('/_app/')({
  component: App,
});

function App() {
  const { data, isPending } = authClient.useSession();
  const { t } = useTranslation();

  let content: JSX.Element;
  if (data) {
    content = (
      <div>
        Signed in as {data.user?.email}
        <Button onClick={async () => await authClient.signOut()}>Byebye</Button>
      </div>
    );
  } else if (isPending) {
    content = <div>Loading...</div>;
  } else {
    content = <div>Not signed in</div>;
  }

  return (
    <div className="flex grow flex-col items-center justify-center">
      {content}
      <h1>{t('welcome_message')}</h1>
    </div>
  );
}
