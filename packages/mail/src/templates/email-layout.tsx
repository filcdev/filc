import { createTranslator } from '@filcdev/i18n';
import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';
import {
  bodyContentStyle,
  bodyStyle,
  brandMarkCellStyle,
  brandWordmarkCellStyle,
  cardStyle,
  footerBrandStyle,
  footerLinkStyle,
  footerStyle,
  footerTextStyle,
  headerStyle,
  monogramStyle,
  titleStyle,
  typePillStyle,
  wordmarkStyle,
} from './styles';
import type { EmailAccent, Locale } from './types';

export type EmailLayoutProps = {
  accent?: EmailAccent;
  appName: string;
  children: ReactNode;
  hero?: ReactNode;
  lang: Locale;
  preview: string;
  title: string;
  typeLabel: string;
  unsubscribeUrl?: string;
  manageUrl?: string;
};

export const EmailLayout = ({
  accent = 'teal',
  appName,
  children,
  hero,
  lang,
  preview,
  title,
  typeLabel,
  unsubscribeUrl,
  manageUrl,
}: EmailLayoutProps) => {
  const t = createTranslator(lang);
  return (
    <Html lang={lang}>
      <Head>
        <meta content="light" name="color-scheme" />
        <meta name="x-apple-disable-message-reformatting" />
        <title>{title}</title>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={cardStyle}>
          <Section style={headerStyle(accent)}>
            <Row>
              <Column style={brandMarkCellStyle}>
                <Text aria-hidden="true" style={monogramStyle}>
                  F
                </Text>
              </Column>
              <Column style={brandWordmarkCellStyle}>
                <Text style={wordmarkStyle}>FILC</Text>
              </Column>
            </Row>
            <Text style={typePillStyle}>{typeLabel}</Text>
            <Heading style={titleStyle}>{title}</Heading>
          </Section>
          <Section style={bodyContentStyle}>
            {hero}
            {children}
          </Section>
          <Section style={footerStyle(accent)}>
            <Text style={footerBrandStyle(accent)}>{appName}</Text>
            <Text style={footerTextStyle}>{t('mail.autoMessage')}</Text>
            {unsubscribeUrl ? (
              <Text style={footerTextStyle}>{t('mail.unsubscribeNote')}</Text>
            ) : undefined}
            {manageUrl || unsubscribeUrl ? (
              <Text style={{ ...footerTextStyle, margin: 0 }}>
                {manageUrl ? (
                  <Link href={manageUrl} style={footerLinkStyle(accent)}>
                    {t('mail.manageLabel')}
                  </Link>
                ) : undefined}
                {manageUrl && unsubscribeUrl ? ' · ' : undefined}
                {unsubscribeUrl ? (
                  <Link href={unsubscribeUrl} style={footerLinkStyle(accent)}>
                    {t('mail.unsubscribeLabel')}
                  </Link>
                ) : undefined}
              </Text>
            ) : undefined}
          </Section>
        </Container>
      </Body>
    </Html>
  );
};
