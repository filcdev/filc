import { Button, Column, Row, Section, Text } from '@react-email/components';
import { EmailLayout } from './email-layout';
import { emailCopy, greetingFor } from './i18n';
import { renderEmailElement } from './render';
import {
  buttonStyle,
  detailLabelCellStyle,
  detailLabelStyle,
  detailsSectionStyle,
  detailValueCellStyle,
  detailValueStyle,
  greetingStyle,
  textStyle,
} from './styles';
import type { Branding, NotificationEmailData, RenderedEmail } from './types';

const PARAGRAPH_BREAK = /\n+/;

export const renderNotification = (
  data: NotificationEmailData,
  branding: Branding
): Promise<RenderedEmail> => {
  const paragraphs = data.content
    .split(PARAGRAPH_BREAK)
    .filter((paragraph) => paragraph.trim().length > 0);

  const element = (
    <EmailLayout
      lang={data.locale}
      preview={data.content}
      title={data.title}
      typeLabel={data.typeLabel}
      unsubscribeUrl={data.unsubscribeUrl}
    >
      <Text style={greetingStyle}>
        {greetingFor(data.locale, data.recipientName)}
      </Text>
      {paragraphs.map((paragraph) => (
        <Text key={paragraph} style={textStyle}>
          {paragraph}
        </Text>
      ))}
      {data.details?.length ? (
        <Section style={detailsSectionStyle}>
          {data.details.map((detail) => (
            <Row key={detail.label}>
              <Column style={detailLabelCellStyle}>
                <Text style={detailLabelStyle}>{detail.label}</Text>
              </Column>
              <Column style={detailValueCellStyle}>
                <Text style={detailValueStyle}>{detail.value}</Text>
              </Column>
            </Row>
          ))}
        </Section>
      ) : undefined}
      <Button href={branding.appUrl} style={buttonStyle}>
        {emailCopy[data.locale].viewLabel}
      </Button>
    </EmailLayout>
  );
  return renderEmailElement(element, data.title);
};
