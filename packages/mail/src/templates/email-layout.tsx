import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';
import { emailCopy } from './i18n';
import {
  bodyContentStyle,
  bodyStyle,
  cardStyle,
  footerLinkStyle,
  footerStyle,
  footerTextStyle,
  headerStyle,
  titleStyle,
  typePillStyle,
} from './styles';
import type { Locale } from './types';

export type EmailLayoutProps = {
  children: ReactNode;
  lang: Locale;
  preview: string;
  title: string;
  typeLabel: string;
  unsubscribeUrl?: string;
};

export const EmailLayout = ({
  children,
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
          <Section style={headerStyle}>
            <Text style={typePillStyle}>{typeLabel}</Text>
            <Heading style={titleStyle}>{title}</Heading>
          </Section>
          <Section style={bodyContentStyle}>{children}</Section>
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>{emailCopy[lang].autoMessage}</Text>
            {unsubscribeUrl ? (
              <Text style={{ ...footerTextStyle, margin: 0 }}>
                <Link href={unsubscribeUrl} style={footerLinkStyle}>
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
