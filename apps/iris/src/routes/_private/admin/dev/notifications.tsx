import { permissions } from '@filcdev/api/permissions';

import { useForm, useStore } from '@tanstack/react-form';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { Eye, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PermissionGuard } from '@/components/util/permission-guard';
import {
  NOTIFICATION_MOCKS,
  NOTIFICATION_TYPES,
  usePreviewTestNotification,
  useSendTestNotification,
} from '@/hooks/dev-notifications';

type ChannelKey = 'emailEnabled' | 'inAppEnabled' | 'pushEnabled';

const CHANNELS: Array<{ key: ChannelKey; label: string }> = [
  { key: 'inAppEnabled', label: 'devNotifications.channelInApp' },
  { key: 'emailEnabled', label: 'devNotifications.channelEmail' },
  { key: 'pushEnabled', label: 'devNotifications.channelPush' },
];

type FormValues = {
  content: string;
  email: string;
  language: 'en' | 'hu';
  subject: string;
  type: (typeof NOTIFICATION_TYPES)[number];
} & Record<ChannelKey, boolean>;

const defaultValues: FormValues = {
  content: '',
  email: '',
  emailEnabled: true,
  inAppEnabled: true,
  language: 'hu',
  pushEnabled: false,
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

  const sendNotification = useSendTestNotification();
  const sendAllNotification = useSendTestNotification({ silent: true });
  const previewNotification = usePreviewTestNotification();

  const form = useForm({
    defaultValues,
    onSubmit: ({ value }) => {
      sendNotification.mutate({
        channels: {
          email: value.emailEnabled,
          inApp: value.inAppEnabled,
          push: value.pushEnabled,
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
      const html = await previewNotification.mutateAsync({
        content: values.content || undefined,
        language: values.language,
        subject: values.subject || undefined,
        type: values.type,
      });
      setPreviewHtml(html);
      setPreviewOpen(true);
    } catch {
      // onError toasts the failure.
    }
  };

  const handleSendAll = async () => {
    const channels = {
      email: values.emailEnabled,
      inApp: values.inAppEnabled,
      push: values.pushEnabled,
    };
    try {
      for (const type of NOTIFICATION_TYPES) {
        const mock = NOTIFICATION_MOCKS[type][values.language];
        await sendAllNotification.mutateAsync({
          channels,
          content: mock.content,
          email: values.email || undefined,
          language: values.language,
          subject: mock.title,
          type,
        });
      }
      toast.success(t('devNotifications.sendAllSuccess'));
    } catch {
      toast.error(t('devNotifications.sendError'));
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

      <Dialog onOpenChange={setPreviewOpen} open={previewOpen}>
        <DialogContent className="h-[80vh] w-full max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('devNotifications.previewTitle')}</DialogTitle>
            <DialogDescription>
              {t('devNotifications.previewDescription')}
            </DialogDescription>
          </DialogHeader>
          {previewHtml && (
            <iframe
              className="h-full w-full rounded-md border"
              srcDoc={previewHtml}
              title={t('devNotifications.previewTitle')}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
