import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { FaSpinner } from 'react-icons/fa6';
import { Badge } from '~/frontend/components/ui/badge';
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
import { authClient } from '~/frontend/utils/authentication';

export const Route = createFileRoute('/_private/admin/doors/cards')({
  component: RouteComponent,
});

const USER_ID_DISPLAY_LENGTH = 8;

type DoorlockCard = {
  id: string;
  tag: string;
  userId: string;
  frozen: boolean;
  disabled: boolean;
  label: string | null;
};

function isCardActive(card: DoorlockCard): boolean {
  return !(card.frozen || card.disabled);
}

function RouteComponent() {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.permissions.includes('card:read');

  const { data: cardsData, isLoading } = useQuery({
    queryKey: ['cards'],
    queryFn: async () => {
      const res = await fetch('/api/doorlock/cards');
      if (!res.ok) {
        throw new Error('Failed to fetch cards');
      }
      const json = await res.json();
      return json.data as DoorlockCard[];
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
          {isAdmin ? t('doorlock.allCards') : t('doorlock.myCards')}
        </h1>
        <p className="text-muted-foreground">
          {isAdmin ? 'Manage all access cards' : 'View your access cards'}
        </p>
      </div>

      {!cardsData || cardsData.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[300px] items-center justify-center p-8">
            <p className="text-center text-muted-foreground">
              {t('doorlock.noCardsFound')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {isAdmin ? t('doorlock.allCards') : t('doorlock.myCards')}
            </CardTitle>
            <CardDescription>
              {isAdmin
                ? 'View all access cards in the system'
                : 'View your access cards'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('doorlock.cardTag')}</TableHead>
                    <TableHead>{t('doorlock.cardLabel')}</TableHead>
                    {isAdmin && <TableHead>{t('doorlock.userId')}</TableHead>}
                    <TableHead>{t('doorlock.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cardsData.map((card) => (
                    <TableRow key={card.id}>
                      <TableCell className="font-mono text-sm">
                        {card.tag}
                      </TableCell>
                      <TableCell className="font-medium">
                        {card.label || '-'}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="font-mono text-sm">
                          {card.userId.slice(0, USER_ID_DISPLAY_LENGTH)}...
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex gap-1">
                          {card.frozen && (
                            <Badge variant="secondary">
                              {t('doorlock.frozen')}
                            </Badge>
                          )}
                          {card.disabled && (
                            <Badge variant="destructive">
                              {t('doorlock.disabled')}
                            </Badge>
                          )}
                          {isCardActive(card) && (
                            <Badge className="bg-green-500" variant="default">
                              Active
                            </Badge>
                          )}
                        </div>
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
