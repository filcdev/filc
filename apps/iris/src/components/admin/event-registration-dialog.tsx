import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { Separator } from '@filcdev/ui/components/separator';
import { Link } from '@tanstack/react-router';
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { EventParticipantItem } from '@/hooks/events';
import { formatLocalizedDate } from '@/utils/date-locale';
import { formatEventAnswer } from '@/utils/event-fields';

type Props = {
  eventId: string;
  item: EventParticipantItem | null;
  onCancel: (item: EventParticipantItem) => void;
  onDecide: (
    item: EventParticipantItem,
    decision: 'approve' | 'decline'
  ) => void;
  onOpenChange: (open: boolean) => void;
  onRevoke: (item: EventParticipantItem) => void;
  revokePending: boolean;
};

/**
 * One registration in full, opened from its participant row: who they are, every
 * answer, and the door access this row has. The actions live here so an
 * organizer does not have to hunt across the table, but each of them still goes
 * through the page's confirmation and mutation, which own the query cache.
 */
export function EventRegistrationDialog({
  eventId,
  item,
  onCancel,
  onDecide,
  onOpenChange,
  onRevoke,
  revokePending,
}: Props) {
  const { i18n, t } = useTranslation();

  return (
    <Dialog onOpenChange={onOpenChange} open={item !== null}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        {item ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-balance">{item.name}</DialogTitle>
              <DialogDescription className="break-all">
                {item.email}
              </DialogDescription>
            </DialogHeader>

            <section className="space-y-3">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Detail
                  label={t('events.registrationDialog.role')}
                  value={t(`events.participants.roles.${item.role}`)}
                />
                <Detail
                  label={t('events.registrationDialog.status')}
                  value={t(`events.participants.statuses.${item.status}`)}
                />
                <Detail
                  label={t('events.registrationDialog.registeredAt')}
                  value={formatLocalizedDate(item.registeredAt, i18n.language, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                />
                <Detail
                  label={t('events.registrationDialog.checkedInAt')}
                  value={
                    item.checkedInAt
                      ? formatLocalizedDate(item.checkedInAt, i18n.language, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : '—'
                  }
                />
              </dl>
            </section>

            <Separator />

            <AnswersSection answers={item.answers} />

            <Separator />

            <section className="space-y-3">
              <h3 className="font-semibold text-sm">
                {t('events.registrationDialog.doorAccess')}
              </h3>
              <div className="flex items-start gap-2">
                {item.checkinGrant ? (
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <p className="text-sm">
                  {item.checkinGrant
                    ? t('events.registrationDialog.grantActive', {
                        date: formatLocalizedDate(
                          item.checkinGrant.expiresAt,
                          i18n.language,
                          { dateStyle: 'medium', timeStyle: 'short' }
                        ),
                      })
                    : t('events.registrationDialog.grantNone')}
                </p>
              </div>
              <p className="text-muted-foreground text-xs">
                {t('events.registrationDialog.rulesHint')}{' '}
                <Link
                  className="underline underline-offset-4"
                  params={{ eventId }}
                  to="/admin/events/$eventId/helpers"
                >
                  {t('events.helpersPage.link')}
                </Link>
              </p>
            </section>

            <DialogFooter className="flex-wrap gap-2">
              {item.status === 'pending' ? (
                <>
                  <Button
                    aria-label={t('events.registrationDialog.approveAria', {
                      name: item.name,
                    })}
                    onClick={() => onDecide(item, 'approve')}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {t('events.registrationDialog.grant')}
                  </Button>
                  <Button
                    aria-label={t('events.registrationDialog.declineAria', {
                      name: item.name,
                    })}
                    onClick={() => onDecide(item, 'decline')}
                    variant="outline"
                  >
                    <XCircle className="h-4 w-4" />
                    {t('events.participants.decline')}
                  </Button>
                </>
              ) : null}

              {item.status === 'confirmed' && item.checkinGrant ? (
                <Button
                  aria-label={t('events.registrationDialog.revokeAria', {
                    name: item.name,
                  })}
                  disabled={revokePending}
                  onClick={() => onRevoke(item)}
                  variant="outline"
                >
                  {t('events.registrationDialog.revoke')}
                </Button>
              ) : null}

              {item.status === 'confirmed' ? (
                <Button
                  aria-label={t('events.registrationDialog.cancelAria', {
                    name: item.name,
                  })}
                  onClick={() => onCancel(item)}
                  variant="destructive"
                >
                  {t('events.participants.cancel')}
                </Button>
              ) : null}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Every question of the event, with this registration's own answer. */
function AnswersSection({
  answers,
}: {
  answers: EventParticipantItem['answers'];
}) {
  const { t } = useTranslation();

  return (
    <section className="space-y-2">
      <h3 className="font-semibold text-sm">
        {t('events.registrationDialog.answers')}
      </h3>
      {answers.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t('events.participants.noAnswers')}
        </p>
      ) : (
        <dl className="space-y-2">
          {answers.map((answer) => (
            <div
              className="grid grid-cols-[1fr_auto] gap-3"
              key={answer.fieldId}
            >
              <dt className="text-muted-foreground text-sm">{answer.label}</dt>
              <dd className="text-right text-sm">
                {formatEventAnswer(answer.type, answer.value, t)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium">
        {value || <Badge variant="secondary">—</Badge>}
      </dd>
    </div>
  );
}
