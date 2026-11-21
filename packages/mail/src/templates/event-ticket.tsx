import { createTranslator } from '@filcdev/i18n';
import {
  Button,
  Column,
  Hr,
  Img,
  Link,
  Row,
  Section,
  Text,
} from '@react-email/components';
import { EmailLayout } from './email-layout';
import { renderEmailElement } from './render';
import {
  buttonStyle,
  detailLabelCellStyle,
  detailLabelStyle,
  detailsSectionStyle,
  detailValueCellStyle,
  detailValueStyle,
  dividerStyle,
  heroGreetingStyle,
  heroLeadStyle,
  heroStyle,
  textStyle,
} from './styles';
import type { Branding, EventTicketEmailData, RenderedEmail } from './types';

const QR_SIZE = 220;

const qrCellStyle = { margin: '0 0 16px', textAlign: 'center' } as const;
const codeStyle = {
  ...textStyle,
  fontFamily: 'monospace',
  fontSize: '20px',
  letterSpacing: '2px',
  margin: '0 0 4px',
} as const;
const hintStyle = { ...textStyle, fontSize: '13px' } as const;
const linkStyle = { color: 'inherit', textDecoration: 'underline' } as const;

/**
 * The guest ticket. The QR is an inline PNG the caller renders, because the
 * payload (the ticket id) belongs to the feature and the mail package never
 * talks to a QR library or the database.
 *
 * The link and the bare code are both here on purpose: a client that blocks
 * remote or inline images still leaves the visitor a way in.
 */
export const renderEventTicket = (
  data: EventTicketEmailData,
  branding: Branding
): Promise<RenderedEmail> => {
  const t = createTranslator(data.locale);
  const accent = 'teal';

  const hero = (
    <Section style={heroStyle(accent)}>
      <Text style={heroGreetingStyle(accent)}>
        {t('eventTicket.greeting', { name: data.visitorName })}
      </Text>
      <Text style={heroLeadStyle}>
        {t('eventTicket.intro', { title: data.eventTitle })}
      </Text>
    </Section>
  );

  const element = (
    <EmailLayout
      accent={accent}
      appName={branding.appName}
      hero={hero}
      lang={data.locale}
      preview={t('eventTicket.preview', { title: data.eventTitle })}
      title={t('eventTicket.title')}
      typeLabel={t('eventTicket.typeLabel')}
    >
      <Section style={qrCellStyle}>
        <Img
          alt={t('eventTicket.qrAlt')}
          height={QR_SIZE}
          src={data.qrDataUri}
          style={{ borderRadius: '12px' }}
          width={QR_SIZE}
        />
      </Section>
      <Text style={textStyle}>{t('eventTicket.codeLabel')}</Text>
      <Text style={codeStyle}>{data.code}</Text>
      <Hr style={dividerStyle(accent)} />
      <Section style={detailsSectionStyle(accent)}>
        <Row>
          <Column style={detailLabelCellStyle(accent, 0)}>
            <Text style={detailLabelStyle}>{t('eventTicket.eventLabel')}</Text>
          </Column>
          <Column style={detailValueCellStyle(accent, 0)}>
            <Text style={detailValueStyle}>{data.eventTitle}</Text>
          </Column>
        </Row>
        <Row>
          <Column style={detailLabelCellStyle(accent, 1)}>
            <Text style={detailLabelStyle}>{t('eventTicket.dateLabel')}</Text>
          </Column>
          <Column style={detailValueCellStyle(accent, 1)}>
            <Text style={detailValueStyle}>{data.eventDate}</Text>
          </Column>
        </Row>
        <Row>
          <Column style={detailLabelCellStyle(accent, 2)}>
            <Text style={detailLabelStyle}>{t('eventTicket.nameLabel')}</Text>
          </Column>
          <Column style={detailValueCellStyle(accent, 2)}>
            <Text style={detailValueStyle}>{data.visitorName}</Text>
          </Column>
        </Row>
      </Section>
      <Button href={data.ticketUrl} style={buttonStyle(accent)}>
        {t('eventTicket.openTicket')}
      </Button>
      <Text style={hintStyle}>
        {t('eventTicket.imageHint')}{' '}
        <Link href={data.ticketUrl} style={linkStyle}>
          {data.ticketUrl}
        </Link>
      </Text>
    </EmailLayout>
  );

  return renderEmailElement(
    element,
    t('eventTicket.subject', { title: data.eventTitle })
  );
};
