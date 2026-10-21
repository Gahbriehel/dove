import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { isHtmlContent, sanitizeEmailHtml } from '../utils/sanitize-html.util';

export interface BirthdayGreetingEmailProps {
  recipientName?: string;
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

export const BirthdayGreetingEmail = ({
  subject = 'Happy Birthday!',
  heading: customHeading,
  message = 'Wishing you a very happy and blessed birthday! May God grace you with joy, health, and peace in this new year of your life.',
  ctaLabel,
  ctaUrl,
  churchName = 'Dove Church',
  contactEmail,
  contactPhone,
  imageUrl,
}: BirthdayGreetingEmailProps) => {
  const displayHeading = customHeading || subject;

  // Rich-text editors emit HTML, so detect and sanitize if present
  const messageIsHtml = isHtmlContent(message);
  const sanitizedMessageHtml = messageIsHtml
    ? sanitizeEmailHtml(message)
    : undefined;

  // Split multi-paragraph plain-text messages
  const paragraphs = messageIsHtml
    ? []
    : message.split('\n\n').filter((p) => p.trim().length > 0);

  return (
    <Html>
      <Head />
      <Preview>{displayHeading}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header Banner - clean & celebratory, avoiding promotional tags */}
          <Section style={headerSection}>
            {churchName && <Text style={churchBadge}>{churchName}</Text>}
            <Heading style={heading}>{displayHeading}</Heading>
          </Section>

          {/* Optional Birthday Card / Flyer Image */}
          {imageUrl && (
            <Section style={imageSection}>
              <Img
                src={imageUrl}
                alt={displayHeading || 'Birthday Celebration'}
                width="100%"
                style={cardImage}
              />
            </Section>
          )}

          {/* Message Content - directly renders user message without redundant "Hello firstName" */}
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

          {/* Optional CTA Button if provided */}
          {ctaLabel && ctaUrl && (
            <Section style={ctaSection}>
              <Link href={ctaUrl} style={ctaButton}>
                {ctaLabel}
              </Link>
            </Section>
          )}

          <Hr style={hr} />

          {/* Warm, personal sign-off from church leadership */}
          <Section style={closingSection}>
            <Text style={closingSalutation}>With love, prayers & blessings,</Text>
            <Text style={closingChurch}>{churchName || 'Dove Church'}</Text>
            {(contactPhone || contactEmail) && (
              <Text style={contactDetails}>
                {[
                  contactPhone ? `📞 ${contactPhone}` : null,
                  contactEmail ? `✉️ ${contactEmail}` : null,
                ]
                  .filter(Boolean)
                  .join('  •  ')}
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: '#f8fafc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  padding: '36px 0',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '36px 32px',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  maxWidth: '560px',
};

const headerSection = {
  marginBottom: '24px',
};

const churchBadge = {
  fontSize: '12px',
  fontWeight: '700',
  color: '#4f46e5',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  margin: '0 0 6px 0',
};

const heading = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#0f172a',
  margin: '0',
  lineHeight: '1.3',
};

const imageSection = {
  margin: '0 0 24px 0',
  textAlign: 'center' as const,
};

const cardImage = {
  maxWidth: '100%',
  height: 'auto',
  borderRadius: '8px',
  display: 'block',
  margin: '0 auto',
};

const paragraph = {
  margin: '0 0 16px',
  fontSize: '15px',
  lineHeight: '1.65',
  color: '#334155',
};

const ctaSection = {
  textAlign: 'center' as const,
  margin: '28px 0',
};

const ctaButton = {
  backgroundColor: '#4f46e5',
  color: '#ffffff',
  padding: '12px 28px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: '600',
  fontSize: '14px',
  display: 'inline-block',
};

const hr = {
  borderColor: '#e2e8f0',
  margin: '28px 0 20px',
};

const closingSection = {
  textAlign: 'center' as const,
};

const closingSalutation = {
  fontSize: '14px',
  color: '#64748b',
  margin: '0 0 4px',
  fontStyle: 'italic',
};

const closingChurch = {
  fontSize: '15px',
  fontWeight: '700',
  color: '#0f172a',
  margin: '0 0 8px',
};

const contactDetails = {
  fontSize: '12px',
  color: '#94a3b8',
  margin: '0',
};

export default BirthdayGreetingEmail;
