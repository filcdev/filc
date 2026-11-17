import { createTranslator } from '@filcdev/i18n';
import {
  Button,
  Column,
  Hr,
  Row,
  Section,
  Text,
} from '@react-email/components';
import { EmailLayout } from './email-layout';
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
  const t = createTranslator(data.locale);
  const recipientName = data.recipientName?.trim();
  const greeting = recipientName
    ? t('mail.greetingNamed', { name: recipientName })
    : t('mail.greeting');
  const accent = data.accent ?? 'teal';
  const paragraphs = data.content
    .split(PARAGRAPH_BREAK)
    .filter((paragraph) => paragraph.trim().length > 0);
  const [lead, ...bodyParagraphs] = paragraphs;
  const highlights = [
    ...new Set(
      (data.highlights ?? [])
        .map((highlight) => highlight.trim())
        .filter((highlight) => highlight.length > 0)
    ),
  ].slice(0, MAX_HIGHLIGHTS);

  const hero = (
    <Section style={heroStyle(accent)}>
      <Text style={heroGreetingStyle(accent)}>{greeting}</Text>
      {lead ? <Text style={heroLeadStyle}>{lead}</Text> : undefined}
      {highlights.length > 0 ? (
        <Section style={chipRowStyle}>
          {highlights.map((highlight, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: highlights are trimmed and deduplicated above, so the index is stable and unique.
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
      {bodyParagraphs.map((paragraph, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs are split from one string, so the index is the position in the message and no two are the same text by construction.
        <Text key={index} style={textStyle}>
          {paragraph}
        </Text>
      ))}
      {data.details?.length ? (
        <>
          <Hr style={dividerStyle(accent)} />
          <Section style={detailsSectionStyle(accent)}>
            {data.details.map((detail, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a detail's label repeats in real payloads, so it cannot key the row; the index is the row's position in the block.
              <Row key={index}>
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
        {t('mail.viewLabel')}
      </Button>
    </EmailLayout>
  );
  return renderEmailElement(element, data.title);
};
