import { useForm } from '@tanstack/react-form';
import { useRouter } from '@tanstack/react-router';
import { parseResponse } from 'hono/client';
import { Bug, Send } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/utils/hc';

type BugReportForm = {
  description: string;
  subject: string;
};

const initialState: BugReportForm = {
  description: '',
  subject: '',
};

export function BugReportDialog() {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    defaultValues: initialState,
    onSubmit: async ({ value }) => {
      setSubmitting(true);
      try {
        const res = await parseResponse(
          api.bugReport.index.$post({
            json: {
              description: value.description,
              page: router.state.location.pathname,
              subject: value.subject,
            },
          })
        );

        if (!res.success) {
          throw new Error('Failed to submit bug report');
        }

        toast.success(t('bugReport.success'));
        form.reset(initialState);
        setOpen(false);
      } catch {
        toast.error(t('bugReport.error'));
      } finally {
        setSubmitting(false);
      }
    },
    validators: {
      onSubmit: ({ value }) => {
        const errors: Record<string, string[]> = {};
        if (value.subject.trim().length < 3) {
          errors.subject = [t('bugReport.subjectTooShort')];
        }
        if (value.description.trim().length < 10) {
          errors.description = [t('bugReport.descriptionTooShort')];
        }
        return errors;
      },
    },
  });

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button size="sm" variant="ghost">
            <Bug className="h-4 w-4" />
            <span className="hidden lg:inline">{t('bugReport.button')}</span>
          </Button>
        }
      />
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col p-2">
        <div className="flex-1 overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>{t('bugReport.title')}</DialogTitle>
            <DialogDescription>
              {t('bugReport.dialogDescription')}
            </DialogDescription>
          </DialogHeader>

          <form
            className="mt-4 space-y-4"
            id="bugReportForm"
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <form.Field name="subject">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t('bugReport.subject')}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('bugReport.subjectPlaceholder')}
                    value={field.state.value}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            <form.Field name="description">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={`${field.name}-textarea`}>
                    {t('bugReport.description')}
                  </FieldLabel>
                  <Textarea
                    id={`${field.name}-textarea`}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('bugReport.descriptionPlaceholder')}
                    rows={6}
                    value={field.state.value}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
          </form>
        </div>

        <DialogFooter className="border-t p-4">
          <Button disabled={submitting} form="bugReportForm" type="submit">
            <Send className="h-4 w-4" />
            {t('bugReport.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
