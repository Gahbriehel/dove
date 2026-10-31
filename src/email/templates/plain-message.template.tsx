import * as React from 'react';
import { Body, Head, Html, Img, Link, Text } from '@react-email/components';
import { isHtmlContent, sanitizeEmailHtml } from '../utils/sanitize-html.util';

export interface PlainMessageEmailProps {
  subject?: string;
  heading?: string;
  message?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  churchName?: string;
  contactEmail?: string;
  contactPhone?: string;
  imageUrl?: string;
}

/**
 * Minimal, personal-looking layout for announcements and invitations: no
 * banner, cards or footer chrome, just text and a signature. Mail that looks
 * like a letter is far less likely to be filed under Gmail's Promotions tab
 * than the styled CustomBroadcastEmail campaign layout.
 */
export const PlainMessageEmail = ({
  heading,
  message = 'We have an important announcement for you.',
  ctaLabel,
  ctaUrl,
  churchName,
  contactEmail,
  contactPhone,
  imageUrl,
}: PlainMessageEmailProps) => {
  const messageIsHtml = isHtmlContent(message);
  const sanitizedMessageHtml = messageIsHtml
    ? sanitizeEmailHtml(message)
    : undefined;
  const paragraphs = messageIsHtml
    ? []
    : message.split('\n\n').filter((p) => p.trim().length > 0);

  return (
    <Html>
      <Head />
      <Body style={main}>
        {heading && <Text style={headingStyle}>{heading}</Text>}

        {imageUrl && (
          <Img
            src={imageUrl}
            alt={heading || 'Announcement'}
            width="100%"
            style={image}
          />
        )}

        {messageIsHtml ? (
          <div
            style={paragraph}
            dangerouslySetInnerHTML={{ __html: sanitizedMessageHtml! }}
          />
        ) : (
          paragraphs.map((para, idx) => (
            <Text key={idx} style={paragraph}>
              {para}
            </Text>
          ))
        )}

        {ctaLabel && ctaUrl && (
          <Text style={paragraph}>
            <Link href={ctaUrl} style={link}>
              {ctaLabel}
            </Link>
          </Text>
        )}

        {(churchName || contactEmail || contactPhone) && (
          <Text style={signature}>
            {churchName && <>{churchName}</>}
            {contactPhone && (
              <>
                <br />
                {contactPhone}
              </>
            )}
            {contactEmail && (
              <>
                <br />
                {contactEmail}
              </>
            )}
          </Text>
        )}
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Arial, Helvetica, sans-serif',
  maxWidth: '600px',
  margin: '0 auto',
  padding: '16px',
};

const headingStyle = {
  fontSize: '18px',
  fontWeight: '700',
  color: '#202124',
  margin: '0 0 16px',
};

const image = {
  maxWidth: '100%',
  height: 'auto',
  display: 'block',
  margin: '0 0 16px',
};

const paragraph = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#202124',
  margin: '0 0 16px',
};

const link = {
  color: '#1a0dab',
  textDecoration: 'underline',
};

const signature = {
  fontSize: '14px',
  lineHeight: '1.5',
  color: '#5f6368',
  margin: '24px 0 0',
};

export default PlainMessageEmail;
