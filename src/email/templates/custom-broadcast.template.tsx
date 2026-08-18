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

export interface CustomBroadcastEmailProps {
  recipientName?: string;
  subject?: string;
  heading?: string;
  message?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  churchName?: string;
  contactEmail?: string;
  contactPhone?: string;
  eventTitle?: string;
  eventDate?: string;
  eventLocation?: string;
  registrationNumber?: string;
  qrCodeDataUrl?: string;
  teamName?: string;
  teamColor?: string;
}

export const CustomBroadcastEmail = ({
  recipientName = 'Member',
  subject = 'Update from Church Administration',
  heading: customHeading,
  message = 'We have an important announcement for you.',
  ctaLabel,
  ctaUrl,
  churchName = 'Dove Church',
  contactEmail,
  contactPhone,
  eventTitle,
  eventDate,
  eventLocation,
  registrationNumber,
  qrCodeDataUrl,
  teamName,
  teamColor,
}: CustomBroadcastEmailProps) => {
  const displayHeading = customHeading || subject;

  // Split multi-paragraph messages
  const paragraphs = message.split('\n\n').filter((p) => p.trim().length > 0);

  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header Banner */}
          <Section style={headerSection}>
            <Text style={categoryBadge}>
              {churchName ? churchName.toUpperCase() : 'ANNOUNCEMENT'}
            </Text>
            <Heading style={heading}>{displayHeading}</Heading>
          </Section>

          <Text style={paragraph}>
            Hello <strong>{recipientName}</strong>,
          </Text>

          {/* Render Message Paragraphs */}
          {paragraphs.map((para, idx) => (
            <Text key={idx} style={paragraph}>
              {para}
            </Text>
          ))}

          {/* Primary CTA Button if provided */}
          {ctaLabel && ctaUrl && (
            <Section style={ctaSection}>
              <Link href={ctaUrl} style={ctaButton}>
                {ctaLabel}
              </Link>
            </Section>
          )}

          {/* Optional Event & Registration Card */}
          {(eventTitle || registrationNumber) && (
            <Section style={detailsCard}>
              <Text style={cardHeading}>Event Details</Text>

              {eventTitle && (
                <Section style={row}>
                  <Text style={label}>Event</Text>
                  <Text style={value}>{eventTitle}</Text>
                </Section>
              )}

              {registrationNumber && (
                <Section style={row}>
                  <Text style={label}>Pass #</Text>
                  <Text style={regNumberBadge}>{registrationNumber}</Text>
                </Section>
              )}

              {eventDate && (
                <Section style={row}>
                  <Text style={label}>Date & Time</Text>
                  <Text style={value}>{eventDate}</Text>
                </Section>
              )}

              {eventLocation && (
                <Section style={row}>
                  <Text style={label}>Location</Text>
                  <Text style={value}>{eventLocation}</Text>
                </Section>
              )}

              {teamName && (
                <Section style={row}>
                  <Text style={label}>Assigned Team</Text>
                  <Text style={teamValue}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        backgroundColor: teamColor || '#2563eb',
                        color: '#ffffff',
                        fontWeight: 'bold',
                        fontSize: '13px',
                      }}
                    >
                      {teamName}
                    </span>
                  </Text>
                </Section>
              )}
            </Section>
          )}

          {/* QR Code Pass Section if provided */}
          {qrCodeDataUrl && (
            <Section style={qrSection}>
              <Text style={qrHeading}>Check-in Pass</Text>
              <Text style={qrSubtext}>
                Please present this QR code at the event entrance:
              </Text>
              <Img
                src={qrCodeDataUrl}
                width="160"
                height="160"
                alt="Check-in QR Code"
                style={qrImage}
              />
            </Section>
          )}

          <Hr style={hr} />

          {/* Contact / Help Section */}
          <Section style={contactSection}>
            <Text style={contactHeading}>
              Need assistance or have questions?
            </Text>
            {contactPhone && (
              <Text style={contactItem}>
                📞 <strong>Phone:</strong> {contactPhone}
              </Text>
            )}
            {contactEmail && (
              <Text style={contactItem}>
                ✉️ <strong>Email:</strong> {contactEmail}
              </Text>
            )}
            {!contactPhone && !contactEmail && (
              <Text style={contactItem}>
                Please reach out to the church administration or event
                coordinators.
              </Text>
            )}
          </Section>

          <Text style={footer}>
            Sent via {churchName || 'Dove Platform'}. Thank you!
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: '#f8fafc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  padding: '40px 0',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '36px',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
  maxWidth: '560px',
};

const headerSection = {
  marginBottom: '24px',
};

const categoryBadge = {
  fontSize: '11px',
  fontWeight: '700',
  letterSpacing: '1px',
  color: '#2563eb',
  margin: '0 0 6px 0',
};

const heading = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#0f172a',
  margin: '0',
  lineHeight: '1.25',
};

const paragraph = {
  margin: '0 0 16px',
  fontSize: '15px',
  lineHeight: '1.5',
  color: '#334155',
};

const ctaSection = {
  textAlign: 'center' as const,
  margin: '24px 0',
};

const ctaButton = {
  display: 'inline-block',
  backgroundColor: '#2563eb',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  fontSize: '15px',
  fontWeight: '700',
  textDecoration: 'none',
  textAlign: 'center' as const,
};

const detailsCard = {
  padding: '20px',
  backgroundColor: '#f1f5f9',
  borderRadius: '8px',
  borderLeft: '4px solid #0f172a',
  margin: '20px 0',
};

const cardHeading = {
  fontSize: '14px',
  fontWeight: '700',
  color: '#0f172a',
  margin: '0 0 12px 0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const row = {
  marginBottom: '10px',
};

const label = {
  fontSize: '12px',
  color: '#64748b',
  fontWeight: '600',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 2px 0',
};

const value = {
  fontSize: '15px',
  color: '#0f172a',
  fontWeight: '500',
  margin: '0',
};

const regNumberBadge = {
  fontSize: '15px',
  fontFamily: 'monospace',
  fontWeight: '700',
  color: '#0f172a',
  backgroundColor: '#ffffff',
  padding: '4px 10px',
  borderRadius: '4px',
  border: '1px solid #cbd5e1',
  display: 'inline-block',
  margin: '0',
};

const teamValue = {
  margin: '2px 0 0 0',
};

const qrSection = {
  textAlign: 'center' as const,
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
};

const qrHeading = {
  fontSize: '16px',
  fontWeight: '700',
  color: '#0f172a',
  margin: '0 0 4px 0',
};

const qrSubtext = {
  fontSize: '13px',
  color: '#64748b',
  margin: '0 0 16px 0',
};

const qrImage = {
  margin: '0 auto',
  display: 'block',
  borderRadius: '6px',
  border: '1px solid #f1f5f9',
};

const hr = {
  borderColor: '#e2e8f0',
  margin: '28px 0 20px 0',
};

const contactSection = {
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  padding: '16px 20px',
  border: '1px solid #e2e8f0',
  margin: '0 0 24px 0',
};

const contactHeading = {
  fontSize: '14px',
  fontWeight: '700',
  color: '#0f172a',
  margin: '0 0 4px 0',
};

const contactItem = {
  fontSize: '13px',
  color: '#334155',
  margin: '4px 0',
};

const footer = {
  color: '#94a3b8',
  fontSize: '12px',
  textAlign: 'center' as const,
  lineHeight: '1.5',
  margin: '0',
};

export default CustomBroadcastEmail;
