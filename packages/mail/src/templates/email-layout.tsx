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
import { emailCopy } from './i18n';
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
  /** Hero panel rendered above the body content. */
  hero?: ReactNode;
  lang: Locale;
  preview: string;
  title: string;
  typeLabel: string;
  unsubscribeUrl?: string;
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
}: EmailLayoutProps) => {
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
            <Text style={footerTextStyle}>{emailCopy[lang].autoMessage}</Text>
            {unsubscribeUrl ? (
              <Text style={{ ...footerTextStyle, margin: 0 }}>
                <Link href={unsubscribeUrl} style={footerLinkStyle(accent)}>
                  {emailCopy[lang].unsubscribeLabel}
                </Link>
              </Text>
            ) : undefined}
          </Section>
        </Container>
      </Body>
    </Html>
  );
};
