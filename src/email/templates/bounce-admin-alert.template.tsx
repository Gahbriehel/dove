import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export interface BounceAdminAlertEmailProps {
  bouncedEmail: string;
  eventType: string;
  reason?: string;
  recipientName?: string;
  recipientType?: string;
  churchName?: string;
}

export const BounceAdminAlertEmail = ({
  bouncedEmail = 'user@example.com',
  eventType = 'email.bounced',
  reason = 'Recipient address does not exist.',
  recipientName = 'Unknown Recipient',
  recipientType = 'Person',
  churchName = 'Dove Platform',
}: BounceAdminAlertEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>🚨 Action Required: Email Bounce Alert for {bouncedEmail}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header Banner */}
          <Section style={headerSection}>
            <Text style={categoryBadge}>SYSTEM ALERT</Text>
            <Heading style={heading}>Email Delivery Failed</Heading>
          </Section>

          <Text style={paragraph}>
            An email sent via <strong>{churchName}</strong> could not be delivered and resulted in a bounce or drop.
          </Text>

          {/* Details Card */}
          <Section style={detailsCard}>
            <Text style={cardHeading}>Delivery Failure Details</Text>

            <Section style={row}>
              <Text style={label}>Bounced Email</Text>
              <Text style={valueHighlight}>{bouncedEmail}</Text>
            </Section>

            <Section style={row}>
              <Text style={label}>Recipient Name / Type</Text>
              <Text style={value}>{recipientName} ({recipientType})</Text>
            </Section>

            <Section style={row}>
              <Text style={label}>Event Type</Text>
              <Text style={value}>{eventType}</Text>
            </Section>

            <Section style={row}>
              <Text style={label}>Failure Reason</Text>
              <Text style={reasonText}>{reason || 'No detailed reason provided by mail server.'}</Text>
            </Section>
          </Section>

          {/* Warning & Action Box */}
          <Section style={actionBox}>
            <Text style={actionHeading}>💡 Recommended Action</Text>
            <Text style={actionText}>
              Please log in to your Admin Dashboard to check for typos in the recipient's email address, contact them through an alternative method (like phone), and update their record to restore delivery.
            </Text>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            This is an automated system security & delivery notification from {churchName}.
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
  color: '#dc2626',
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

const detailsCard = {
  padding: '20px',
  backgroundColor: '#fef2f2',
  borderRadius: '8px',
  borderLeft: '4px solid #dc2626',
  margin: '20px 0',
};

const cardHeading = {
  fontSize: '15px',
  fontWeight: '700',
  color: '#991b1b',
  margin: '0 0 14px 0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const row = {
  marginBottom: '12px',
};

const label = {
  fontSize: '12px',
  color: '#991b1b',
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

const valueHighlight = {
  fontSize: '15px',
  color: '#991b1b',
  fontWeight: '700',
  fontFamily: 'monospace',
  margin: '0',
};

const reasonText = {
  fontSize: '14px',
  color: '#7f1d1d',
  lineHeight: '1.4',
  margin: '0',
};

const actionBox = {
  backgroundColor: '#eff6ff',
  borderLeft: '4px solid #2563eb',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '24px 0',
};

const actionHeading = {
  fontSize: '14px',
  fontWeight: '700',
  color: '#1e40af',
  margin: '0 0 6px 0',
};

const actionText = {
  fontSize: '14px',
  lineHeight: '1.5',
  color: '#1e3a8a',
  margin: '0',
};

const hr = {
  borderColor: '#e2e8f0',
  margin: '28px 0 20px 0',
};

const footer = {
  color: '#94a3b8',
  fontSize: '12px',
  textAlign: 'center' as const,
  lineHeight: '1.5',
  margin: '0',
};

export default BounceAdminAlertEmail;
