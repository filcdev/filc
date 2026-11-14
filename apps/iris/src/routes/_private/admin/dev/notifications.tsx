import { permissions } from '@filcdev/api/permissions';
import { Button } from '@filcdev/ui/components/button';
import { Checkbox } from '@filcdev/ui/components/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { Field, FieldLabel } from '@filcdev/ui/components/field';
import { Input } from '@filcdev/ui/components/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
} from '@filcdev/ui/components/select';
import { Textarea } from '@filcdev/ui/components/textarea';
import { useForm, useStore } from '@tanstack/react-form';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { Eye, Monitor, Send, Smartphone } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PermissionGuard } from '@/components/util/permission-guard';
import {
  describeTestNotificationError,
  NOTIFICATION_MOCKS,
  NOTIFICATION_TYPES,
  usePreviewTestNotification,
  useSendTestNotification,
  useTestNotificationRecordOptions,
} from '@/hooks/dev-notifications';

type ChannelKey = 'channelEmail' | 'channelInApp' | 'channelPush';

type PreviewMode = 'desktop' | 'phone';

const CHANNELS: Array<{ key: ChannelKey; label: string }> = [
  { key: 'channelInApp', label: 'devNotifications.channelInApp' },
  { key: 'channelEmail', label: 'devNotifications.channelEmail' },
  { key: 'channelPush', label: 'devNotifications.channelPush' },
];

type FormValues = {
  content: string;
  email: string;
  language: 'en' | 'hu';
  subject: string;
  type: (typeof NOTIFICATION_TYPES)[number];
} & Record<ChannelKey, boolean>;

const defaultValues: FormValues = {
  channelEmail: true,
  channelInApp: true,
  channelPush: false,
  content: '',
  email: '',
  language: 'hu',
  subject: '',
  type: 'test',
};

export const Route = createFileRoute('/_private/admin/dev/notifications')({
  component: () => {
    if (import.meta.env.MODE !== 'development') {
      return <Navigate replace to="/admin" />;
    }
    return (
      <PermissionGuard permission={permissions.announcementsCreate}>
        <DevNotificationsPage />
      </PermissionGuard>
    );
  },
});

function DevNotificationsPage() {
  const { t } = useTranslation();
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop');
  const [selectedRecord, setSelectedRecord] = useState<{
    id: string;
    type: FormValues['type'];
  } | null>(null);
  const recordFieldId = useId();

  const sendNotification = useSendTestNotification();
  const sendAllNotification = useSendTestNotification({ silent: true });
  const previewNotification = usePreviewTestNotification();

  const form = useForm({
    defaultValues,
    onSubmit: ({ value }) => {
      sendNotification.mutate({
        channels: {
          email: value.channelEmail,
          inApp: value.channelInApp,
          push: value.channelPush,
        },
        content: value.content || undefined,
        email: value.email || undefined,
        language: value.language,
        subject: value.subject || undefined,
        type: value.type,
      });
    },
  });

  const values = useStore(form.store, (state) => state.values);
  const recordOptions = useTestNotificationRecordOptions(values.type);
  const recordId =
    selectedRecord &&
    selectedRecord.type === values.type &&
    recordOptions.some((option) => option.id === selectedRecord.id)
      ? selectedRecord.id
      : '';
  const recordSelected = recordId !== '';

  // Keep subject/content filled with per-type mock data when the type or
  // language changes, so each type can be previewed/sent with one click.
  useEffect(() => {
    const mock = NOTIFICATION_MOCKS[values.type]?.[values.language];
    if (mock) {
      form.setFieldValue('subject', mock.title);
      form.setFieldValue('content', mock.content);
    }
  }, [values.type, values.language, form.setFieldValue]);

  const handlePreview = async () => {
    try {
      const html = await previewNotification.mutateAsync(
        recordSelected
          ? {
              entityId: recordId,
              language: values.language,
              type: values.type,
            }
          : {
              content: values.content || undefined,
              language: values.language,
              subject: values.subject || undefined,
              type: values.type,
            }
      );
      setPreviewHtml(html);
      setPreviewOpen(true);
    } catch {
      // onError toasts the failure.
    }
  };

  const handleSendAll = async () => {
    const channels = {
      email: values.channelEmail,
      inApp: values.channelInApp,
      push: values.channelPush,
    };
    try {
      await Promise.all(
        NOTIFICATION_TYPES.map((type) => {
          const mock = NOTIFICATION_MOCKS[type][values.language];
          return sendAllNotification.mutateAsync({
            channels,
            content: mock.content,
            email: values.email || undefined,
            language: values.language,
            subject: mock.title,
            type,
          });
        })
      );
      toast.success(t('devNotifications.sendAllSuccess'));
    } catch (error) {
      toast.error(
        describeTestNotificationError(error, {
          disabled: t('devNotifications.disabled'),
          fallback: t('devNotifications.sendError'),
        })
      );
    }
  };

  const typeOptions = NOTIFICATION_TYPES.map((type) => ({
    label: type,
    value: type,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('devNotifications.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('devNotifications.description')}
        </p>
      </div>

      <form
        className="space-y-4 rounded-md border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row">
          <form.Field name="type">
            {(field) => (
              <Field className="flex-1">
                <FieldLabel>{t('devNotifications.type')}</FieldLabel>
                <Select
                  items={typeOptions}
                  onValueChange={(value) =>
                    field.handleChange(value as FormValues['type'])
                  }
                  value={field.state.value}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </Select>
              </Field>
            )}
          </form.Field>
          <form.Field name="language">
            {(field) => (
              <Field className="flex-1">
                <FieldLabel>{t('devNotifications.language')}</FieldLabel>
                <Select
                  items={[
                    { label: 'hu', value: 'hu' },
                    { label: 'en', value: 'en' },
                  ]}
                  onValueChange={(value) =>
                    field.handleChange(value as FormValues['language'])
                  }
                  value={field.state.value}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </Select>
              </Field>
            )}
          </form.Field>
        </div>

        {recordOptions.length > 0 && (
          <Field>
            <FieldLabel htmlFor={recordFieldId}>
              {t('devNotifications.record')}
            </FieldLabel>
            <Select
              items={[
                {
                  label: t('devNotifications.recordNone'),
                  value: '',
                },
                ...recordOptions.map((option) => ({
                  label: option.label,
                  value: option.id,
                })),
              ]}
              onValueChange={(value) =>
                setSelectedRecord(
                  value ? { id: value, type: values.type } : null
                )
              }
              value={recordId}
            >
              <SelectTrigger className="w-full" id={recordFieldId}>
                <SelectValue
                  placeholder={t('devNotifications.recordPlaceholder')}
                />
              </SelectTrigger>
            </Select>
            {recordSelected && (
              <p className="text-muted-foreground text-xs">
                {t('devNotifications.recordHint')}
              </p>
            )}
          </Field>
        )}

        <form.Field name="email">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>
                {t('devNotifications.recipientEmail')}
              </FieldLabel>
              <Input
                autoComplete="off"
                id={field.name}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder={t('devNotifications.recipientEmailPlaceholder')}
                type="email"
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>

        <form.Field name="subject">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>
                {t('devNotifications.subject')}
              </FieldLabel>
              <Input
                disabled={recordSelected}
                id={field.name}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder={t('devNotifications.subjectPlaceholder')}
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>

        <form.Field name="content">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>
                {t('devNotifications.content')}
              </FieldLabel>
              <Textarea
                disabled={recordSelected}
                id={field.name}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder={t('devNotifications.contentPlaceholder')}
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>

        <Field>
          <FieldLabel>{t('devNotifications.channels')}</FieldLabel>
          <div className="flex flex-wrap gap-4">
            {CHANNELS.map((channel) => (
              <form.Field key={channel.key} name={channel.key}>
                {(field) => (
                  <label
                    className="flex items-center gap-2 text-sm"
                    htmlFor={channel.key}
                  >
                    <Checkbox
                      checked={field.state.value}
                      id={channel.key}
                      onCheckedChange={(checked) =>
                        field.handleChange(Boolean(checked))
                      }
                    />
                    {t(channel.label)}
                  </label>
                )}
              </form.Field>
            ))}
          </div>
        </Field>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!form.state.canSubmit || sendNotification.isPending}
            type="submit"
          >
            <Send className="size-4" />
            {t('devNotifications.send')}
          </Button>
          <Button
            disabled={previewNotification.isPending}
            onClick={handlePreview}
            type="button"
            variant="outline"
          >
            <Eye className="size-4" />
            {t('devNotifications.preview')}
          </Button>
          <Button
            disabled={sendAllNotification.isPending}
            onClick={handleSendAll}
            type="button"
            variant="secondary"
          >
            <Send className="size-4" />
            {t('devNotifications.sendAll')}
          </Button>
        </div>
      </form>

      <Dialog
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) {
            setPreviewHtml(null);
          }
        }}
        open={previewOpen}
      >
        <DialogContent className="flex h-[85dvh] max-w-[calc(100%-2rem)] flex-col gap-3 p-3 sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{t('devNotifications.previewTitle')}</DialogTitle>
            <DialogDescription>
              {t('devNotifications.previewDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Button
              aria-pressed={previewMode === 'desktop'}
              onClick={() => setPreviewMode('desktop')}
              size="sm"
              type="button"
              variant={previewMode === 'desktop' ? 'default' : 'outline'}
            >
              <Monitor className="size-4" />
              {t('devNotifications.previewDesktop')}
            </Button>
            <Button
              aria-pressed={previewMode === 'phone'}
              onClick={() => setPreviewMode('phone')}
              size="sm"
              type="button"
              variant={previewMode === 'phone' ? 'default' : 'outline'}
            >
              <Smartphone className="size-4" />
              {t('devNotifications.previewPhone')}
            </Button>
          </div>
          {previewHtml && (
            <div className="min-h-0 flex-1">
              {previewMode === 'desktop' ? (
                <iframe
                  className="h-full w-full rounded-md border"
                  sandbox=""
                  srcDoc={previewHtml}
                  title={t('devNotifications.previewTitle')}
                />
              ) : (
                <div className="mx-auto h-full max-h-[844px] w-full max-w-[390px] overflow-hidden rounded-[2rem] border-4 border-foreground/10">
                  <iframe
                    className="h-full w-full"
                    sandbox=""
                    srcDoc={previewHtml}
                    title={t('devNotifications.previewTitle')}
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
