import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { parseResponse } from 'hono/client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCircleCheck, FaCircleXmark, FaPlus } from 'react-icons/fa6';
import { toast } from 'sonner';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/frontend/components/ui/dialog';
import { Input } from '~/frontend/components/ui/input';
import { Label } from '~/frontend/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/frontend/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/frontend/components/ui/table';
import { authClient } from '~/frontend/utils/authentication';
import { apiClient } from '~/frontend/utils/hc';

export const Route = createFileRoute('/_private/admin/doors/logs')({
  component: RouteComponent,
});

const fetchLogs = async (result: 'granted' | 'denied' | 'all') => {
  const query = result === 'all' ? {} : { result };
  const res = await parseResponse(
    apiClient.doorlock.logs.$get({
      query,
    })
  );
  if (!res?.success) {
    throw new Error('Failed to fetch logs');
  }
  return res.data ?? [];
};

const fetchUnknownTags = async () => {
  const res = await parseResponse(
    apiClient.doorlock.logs['unknown-tags'].$get()
  );
  if (!res?.success) {
    throw new Error('Failed to fetch unknown tags');
  }
  return res.data ?? [];
};

type AccessLog = Awaited<ReturnType<typeof fetchLogs>>[number];
type UnknownTag = Awaited<ReturnType<typeof fetchUnknownTags>>[number];

type User = {
  id: string;
  name: string;
  email: string;
};

function RouteComponent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [selectedUnknownTag, setSelectedUnknownTag] = useState<
    UnknownTag | undefined
  >();
  const [addCardDialogOpen, setAddCardDialogOpen] = useState(false);
  const [newCardUserId, setNewCardUserId] = useState('');
  const [newCardLabel, setNewCardLabel] = useState('');

  // Fetch logs
  const { data: logsData, isLoading: logsLoading } = useQuery<AccessLog[]>({
    queryFn: () => fetchLogs(resultFilter as 'granted' | 'denied' | 'all'),
    queryKey: ['doorlock-logs', resultFilter],
  });

  // Fetch unknown tags
  const { data: unknownTagsData } = useQuery<UnknownTag[]>({
    queryFn: fetchUnknownTags,
    queryKey: ['doorlock-unknown-tags'],
  });

  // Fetch users for dropdown
  const { data: usersData } = useQuery({
    queryFn: async () => {
      const session = await authClient.getSession();
      if (session?.error || !session?.data) {
        return [];
      }
      // Assuming there's an endpoint to list users
      // This might need adjustment based on your API
      return [
        {
          email: session.data.user.email,
          id: session.data.user.id,
          name: session.data.user.name,
        },
      ] as User[];
    },
    queryKey: ['users'],
  });

  // Add unknown card mutation
  const addCardMutation = useMutation({
    mutationFn: async (data: {
      tag: string;
      userId: string;
      label: string;
    }) => {
      const res = await parseResponse(
        apiClient.doorlock.logs['add-unknown-card'].$post({
          json: data,
        })
      );
      if (!res?.success) {
        throw new Error('Failed to add card');
      }

      if (!res.data) {
        throw new Error('No data returned from server');
      }

      return res.data;
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doorlock-logs'] });
      queryClient.invalidateQueries({ queryKey: ['doorlock-unknown-tags'] });
      queryClient.invalidateQueries({ queryKey: ['doorlock-cards'] });
      toast.success(t('doorlock.cardAdded'));
      setAddCardDialogOpen(false);
      setSelectedUnknownTag(undefined);
      setNewCardUserId('');
      setNewCardLabel('');
    },
  });

  const handleAddUnknownCard = (tag: UnknownTag) => {
    setSelectedUnknownTag(tag);
    setNewCardLabel(`Card ${tag.tag}`);
    setAddCardDialogOpen(true);
  };

  const handleSubmitAddCard = () => {
    const hasNoTag = !selectedUnknownTag;
    const hasNoUserId = !newCardUserId;
    if (hasNoTag || hasNoUserId) {
      toast.error(t('doorlock.selectUser'));
      return;
    }
    addCardMutation.mutate({
      label: newCardLabel,
      tag: selectedUnknownTag.tag,
      userId: newCardUserId,
    });
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl">{t('doorlock.accessLogs')}</h1>
          <p className="text-muted-foreground">
            {t('doorlock.viewAccessLogs')}
          </p>
        </div>
        <Link to="/admin/doors">
          <Button variant="outline">{t('common.back')}</Button>
        </Link>
      </div>

      {/* Unknown Tags Section */}
      {unknownTagsData && unknownTagsData.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('doorlock.unknownTags')}</CardTitle>
            <CardDescription>
              {t('doorlock.unknownTagsDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('doorlock.tag')}</TableHead>
                  <TableHead>{t('doorlock.device')}</TableHead>
                  <TableHead>{t('doorlock.attempts')}</TableHead>
                  <TableHead>{t('doorlock.lastSeen')}</TableHead>
                  <TableHead>{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unknownTagsData.map((tag) => (
                  <TableRow key={`${tag.tag}-${tag.deviceId}`}>
                    <TableCell className="font-mono">{tag.tag}</TableCell>
                    <TableCell>{tag.deviceName || tag.deviceId}</TableCell>
                    <TableCell>{tag.accessCount}</TableCell>
                    <TableCell>
                      {new Date(tag.lastSeen).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        onClick={() => handleAddUnknownCard(tag)}
                        size="sm"
                        variant="outline"
                      >
                        <FaPlus className="mr-2 h-3 w-3" />
                        {t('doorlock.addCard')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Logs Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('doorlock.logs')}</CardTitle>
              <CardDescription>
                {t('doorlock.allAccessAttempts')}
              </CardDescription>
            </div>
            <Select onValueChange={setResultFilter} value={resultFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('doorlock.filterByResult')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                <SelectItem value="granted">{t('doorlock.granted')}</SelectItem>
                <SelectItem value="denied">{t('doorlock.denied')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <p>{t('common.loading')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('doorlock.timestamp')}</TableHead>
                  <TableHead>{t('doorlock.device')}</TableHead>
                  <TableHead>{t('doorlock.tag')}</TableHead>
                  <TableHead>{t('doorlock.user')}</TableHead>
                  <TableHead>{t('doorlock.result')}</TableHead>
                  <TableHead>{t('doorlock.reason')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsData && logsData.length > 0 ? (
                  logsData.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>{log.deviceName || log.deviceId}</TableCell>
                      <TableCell className="font-mono">{log.tag}</TableCell>
                      <TableCell>
                        {log.userName ||
                          log.cardLabel ||
                          (log.cardId ? t('doorlock.unknownUser') : '—')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.result === 'granted' ? 'default' : 'destructive'
                          }
                        >
                          {log.result === 'granted' ? (
                            <>
                              <FaCircleCheck className="mr-1 h-3 w-3" />
                              {t('doorlock.granted')}
                            </>
                          ) : (
                            <>
                              <FaCircleXmark className="mr-1 h-3 w-3" />
                              {t('doorlock.denied')}
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.reason || '—'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell className="text-center" colSpan={6}>
                      {t('doorlock.noLogs')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Card Dialog */}
      <Dialog onOpenChange={setAddCardDialogOpen} open={addCardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('doorlock.addUnknownCard')}</DialogTitle>
            <DialogDescription>
              {t('doorlock.addUnknownCardDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tag">{t('doorlock.tag')}</Label>
              <Input
                className="font-mono"
                disabled
                id="tag"
                value={selectedUnknownTag?.tag || ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userId">{t('doorlock.assignToUser')}</Label>
              <Select onValueChange={setNewCardUserId} value={newCardUserId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('doorlock.selectUser')} />
                </SelectTrigger>
                <SelectContent>
                  {usersData?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">{t('doorlock.cardLabel')}</Label>
              <Input
                id="label"
                onChange={(e) => setNewCardLabel(e.target.value)}
                placeholder={t('doorlock.cardLabelPlaceholder')}
                value={newCardLabel}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setAddCardDialogOpen(false)}
              variant="outline"
            >
              {t('common.cancel')}
            </Button>
            <Button
              disabled={addCardMutation.isPending}
              onClick={handleSubmitAddCard}
            >
              {addCardMutation.isPending
                ? t('common.saving')
                : t('doorlock.addCard')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
