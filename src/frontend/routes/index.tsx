import { createFileRoute } from '@tanstack/react-router';
import { Button } from '~/frontend/components/ui/button';
import { authClient } from '~/frontend/utils/authentication';

export const Route = createFileRoute('/')({
  component: App,
});

function App() {
  const { data, isPending } = authClient.useSession();

  return (
    <div className="flex grow flex-col items-center justify-center">
      {data ? (
        <div>
          Signed in as {data.user?.email}
          <Button onClick={async () => await authClient.signOut()}>
            Byebye
          </Button>
        </div>
      ) : isPending ? (
        <div>Loading...</div>
      ) : (
        <div>Not signed in</div>
      )}
      <h1>Honey i rewrote the filc</h1>
    </div>
  );
}
