import { Button, Text } from '@react-email/components';
import { EmailLayout } from './email-layout';
import { emailCopy, greetingFor } from './i18n';
import { renderEmailElement } from './render';
import { buttonStyle, greetingStyle, textStyle } from './styles';
import type { Branding, NotificationEmailData, RenderedEmail } from './types';

export const renderNotification = (
  data: NotificationEmailData,
  branding: Branding
): Promise<RenderedEmail> => {
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
      <Text style={textStyle}>{data.content}</Text>
      <Button href={branding.appUrl} style={buttonStyle}>
        {emailCopy[data.locale].viewLabel}
      </Button>
    </EmailLayout>
  );
  return renderEmailElement(element, data.title);
};
