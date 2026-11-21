import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@filcdev/ui/components/card';
import { Spinner } from '@filcdev/ui/components/spinner';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CalendarDays, CheckCircle2, Ticket, User } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useEventTicket } from '@/hooks/events';
import { formatLocalizedDate } from '@/utils/date-locale';
import { orpc, prefetch } from '@/utils/orpc';

export const Route = createFileRoute('/_public/tickets/$ticketId/')({
  component: TicketPage,
  loader: ({ context, params }) =>
    prefetch(
      context.queryClient,
      orpc.tickets.get.queryOptions({ input: { ticketId: params.ticketId } })
    ),
});

/**
 * What the parent opens from the email, and what the door scans. The code is
 * shown as text as well as a QR: a phone at low brightness or a cracked screen
 * still has to get in.
 */
function TicketPage() {
  const { ticketId } = Route.useParams();
  const { i18n, t } = useTranslation();
  const { data: ticket, isPending } = useEventTicket(ticketId);

  useEffect(() => {
    document.title = ticket
      ? `${t('events.public.ticketTitle')} | Filc`
      : t('events.public.ticketNotFound');
  }, [ticket, t]);

  if (isPending) {
    return (
      <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center">
        <Spinner />
      </main>
    );
  }

  if (!ticket) {
    return (
      <main className="mx-auto w-full max-w-md space-y-4 p-6">
        <p className="text-muted-foreground">
          {t('events.public.ticketNotFound')}
        </p>
        <Button render={<Link to="/events" />} variant="outline">
          {t('events.public.backToEvents')}
        </Button>
      </main>
    );
  }

  return (
    <main className="flex grow flex-col items-center gap-6 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center space-y-2 text-center">
          <Badge variant="secondary">{t('events.public.ticketTitle')}</Badge>
          <CardTitle className="text-2xl">{ticket.eventTitle}</CardTitle>
          <p className="flex items-center gap-2 text-muted-foreground text-sm">
            <CalendarDays className="h-4 w-4" />
            {formatLocalizedDate(ticket.startsAt, i18n.language, {
              dateStyle: 'long',
            })}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center rounded-xl bg-white p-4">
            {/* The QR is the ticket id and nothing else, same payload as the email. */}
            <QRCodeSVG level="M" size={220} value={ticket.code} />
          </div>

          <p className="text-center font-mono text-sm">{ticket.code}</p>

          <div className="space-y-2 rounded-lg border p-3 text-sm">
            <p className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              {ticket.visitorName}
            </p>
            <p className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-muted-foreground" />
              {t('events.public.ticketShowAtDoor')}
            </p>
          </div>

          {ticket.checkedInAt && (
            <p className="flex items-center justify-center gap-2 font-medium text-primary text-sm">
              <CheckCircle2 className="h-4 w-4" />
              {t('events.public.ticketCheckedIn')}
            </p>
          )}

          <Button
            className="w-full"
            render={
              <Link
                params={{ eventId: ticket.eventId }}
                to="/events/$eventId"
              />
            }
            variant="outline"
          >
            {t('events.public.ticketBackToEvent')}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
