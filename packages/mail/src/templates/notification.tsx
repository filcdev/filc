import {
  Button,
  Column,
  Hr,
  Row,
  Section,
  Text,
} from '@react-email/components';
import { EmailLayout } from './email-layout';
import { emailCopy, greetingFor } from './i18n';
import { renderEmailElement } from './render';
import {
  buttonStyle,
  chipRowStyle,
  chipStyle,
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
import type { Branding, NotificationEmailData, RenderedEmail } from './types';

const PARAGRAPH_BREAK = /\n+/;
const MAX_HIGHLIGHTS = 4;

export const renderNotification = (
  data: NotificationEmailData,
  branding: Branding
): Promise<RenderedEmail> => {
  const accent = data.accent ?? 'teal';
  const paragraphs = data.content
    .split(PARAGRAPH_BREAK)
    .filter((paragraph) => paragraph.trim().length > 0);
  const [lead, ...bodyParagraphs] = paragraphs;
  const highlights = [...new Set(data.highlights ?? [])].slice(
    0,
    MAX_HIGHLIGHTS
  );

  const hero = (
    <Section style={heroStyle(accent)}>
      <Text style={heroGreetingStyle(accent)}>
        {greetingFor(data.locale, data.recipientName)}
      </Text>
      {lead ? <Text style={heroLeadStyle}>{lead}</Text> : undefined}
      {highlights.length > 0 ? (
        <Section style={chipRowStyle}>
          {highlights.map((highlight, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: highlights are deduplicated above, so the index is stable and unique.
            <Text key={index} style={chipStyle(accent)}>
              {highlight}
            </Text>
          ))}
        </Section>
      ) : undefined}
    </Section>
  );

  const element = (
    <EmailLayout
      accent={accent}
      appName={branding.appName}
      hero={hero}
      lang={data.locale}
      manageUrl={data.manageUrl}
      preview={data.content}
      title={data.title}
      typeLabel={data.typeLabel}
      unsubscribeUrl={data.unsubscribeUrl}
    >
      {bodyParagraphs.map((paragraph) => (
        <Text key={paragraph} style={textStyle}>
          {paragraph}
        </Text>
      ))}
      {data.details?.length ? (
        <>
          <Hr style={dividerStyle(accent)} />
          <Section style={detailsSectionStyle(accent)}>
            {data.details.map((detail, index) => (
              <Row key={detail.label}>
                <Column style={detailLabelCellStyle(accent, index)}>
                  <Text style={detailLabelStyle}>{detail.label}</Text>
                </Column>
                <Column style={detailValueCellStyle(accent, index)}>
                  <Text style={detailValueStyle}>{detail.value}</Text>
                </Column>
              </Row>
            ))}
          </Section>
        </>
      ) : undefined}
      <Button href={branding.appUrl} style={buttonStyle(accent)}>
        {emailCopy[data.locale].viewLabel}
      </Button>
    </EmailLayout>
  );
  return renderEmailElement(element, data.title);
};
