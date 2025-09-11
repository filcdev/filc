import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowRight, CheckCircle, Mail, User } from 'lucide-react';
import { Button } from '~/frontend/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/frontend/components/ui/card';
import { authClient } from '~/frontend/utils/authentication';

export const Route = createFileRoute('/auth/welcome')({
  component: RouteComponent,
});

function RouteComponent() {
  const { data, error, isPending } = authClient.useSession();
  const navigate = useNavigate();

  if (isPending) {
    return (
      <main className="grow items-center justify-center">
        <p className="text-foreground">Loading...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="grow items-center justify-center">
        <p className="text-red-500">Error: {error.message}</p>
      </main>
    );
  }

  if (!(data?.session && data?.user)) {
    navigate({ to: '/auth/login' });
    return null;
  }

  const { user } = data;

  return (
    <div className="grid grow grid-cols-2 gap-12 p-12">
      <div className="flex flex-col justify-center space-y-4">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle className="h-10 w-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="font-bold text-4xl text-foreground">
              Welcome, {user.name || user.email.split('@')[0]}!
            </h1>
            <p className="text-balance text-muted-foreground text-xl">
              You've successfully signed in to your account
            </p>
          </div>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <User className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg">Account Details</CardTitle>
            <CardDescription>Your login information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground text-sm">Email</p>
                <p className="truncate text-muted-foreground text-sm">
                  {user.email}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col justify-center">
        <h2 className="mb-6 text-center font-bold text-2xl">
          What would you like to do?
        </h2>
        <div className="flex flex-col items-center gap-4">
          <Card className="group cursor-pointer border-border/50 shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">Dashboard</h3>
                  <p className="text-muted-foreground text-sm">
                    View your account overview and recent activity
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="group cursor-pointer border-border/50 shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">Settings</h3>
                  <p className="text-muted-foreground text-sm">
                    Manage your account preferences and security
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
            </CardContent>
          </Card>

          <Button
            className="bg-transparent text-sm shadow-lg"
            onClick={() => {
              authClient.signOut();
              navigate({ to: '/auth/login' });
            }}
            variant="outline"
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
