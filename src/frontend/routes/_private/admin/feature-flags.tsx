import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { FaSpinner, FaToggleOff, FaToggleOn } from 'react-icons/fa6';
import { toast } from 'sonner';
import { PermissionGuard } from '~/frontend/components/permission-guard';
import { Badge } from '~/frontend/components/ui/badge';
import { Button } from '~/frontend/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/frontend/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/frontend/components/ui/table';

export const Route = createFileRoute('/_private/admin/feature-flags')({
  component: RouteComponent,
});

type FeatureFlag = {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function RouteComponent() {
  return (
    <PermissionGuard permission="feature-flags:read">
      <FeatureFlagsPage />
    </PermissionGuard>
  );
}

function FeatureFlagsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: flagsData, isLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const res = await fetch('/api/feature-flags');
      if (!res.ok) {
        throw new Error('Failed to fetch feature flags');
      }
      const json = await res.json();
      return json.data as FeatureFlag[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({
      name,
      isEnabled,
    }: {
      name: string;
      isEnabled: boolean;
    }) => {
      const res = await fetch(`/api/feature-flags/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to toggle feature flag');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(t('featureFlags.toggleSuccess'));
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
    onError: () => {
      toast.error(t('featureFlags.toggleError'));
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center p-4">
        <FaSpinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('featureFlags.manage')}
        </h1>
        <p className="text-muted-foreground">{t('featureFlags.description')}</p>
      </div>

      {!flagsData || flagsData.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[300px] items-center justify-center p-8">
            <p className="text-center text-muted-foreground">
              {t('featureFlags.noFlags')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('featureFlags.title')}</CardTitle>
            <CardDescription>
              Toggle features on and off across the application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('featureFlags.name')}</TableHead>
                    <TableHead>{t('featureFlags.flagDescription')}</TableHead>
                    <TableHead>{t('featureFlags.status')}</TableHead>
                    <TableHead className="text-right">
                      {t('featureFlags.toggle')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flagsData.map((flag) => (
                    <TableRow key={flag.id}>
                      <TableCell className="font-medium font-mono text-sm">
                        {flag.name}
                      </TableCell>
                      <TableCell>{flag.description}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            flag.isEnabled
                              ? 'bg-green-500 hover:bg-green-600'
                              : 'bg-gray-400'
                          }
                          variant={flag.isEnabled ? 'default' : 'secondary'}
                        >
                          {flag.isEnabled
                            ? t('featureFlags.enabled')
                            : t('featureFlags.disabled')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          disabled={toggleMutation.isPending}
                          onClick={() =>
                            toggleMutation.mutate({
                              name: flag.name,
                              isEnabled: !flag.isEnabled,
                            })
                          }
                          size="sm"
                          variant={flag.isEnabled ? 'outline' : 'default'}
                        >
                          {flag.isEnabled ? (
                            <>
                              <FaToggleOff className="mr-2 h-4 w-4" />
                              Turn Off
                            </>
                          ) : (
                            <>
                              <FaToggleOn className="mr-2 h-4 w-4" />
                              Turn On
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
