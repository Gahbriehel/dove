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

export interface AdminWelcomeEmailProps {
  recipientName: string;
  recipientEmail: string;
  temporaryPassword: string;
  loginUrl?: string;
  churchName?: string;
}

export const AdminWelcomeEmail = ({
  recipientName = 'Administrator',
  recipientEmail = 'admin@example.com',
  temporaryPassword = 'password123',
  loginUrl = '',
  churchName = 'Dove Platform',
}: AdminWelcomeEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Welcome to {churchName} - Admin Account Credentials</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header Banner */}
          <Section style={headerSection}>
            <Text style={categoryBadge}>ADMINISTRATION</Text>
            <Heading style={heading}>Welcome to the Admin Team!</Heading>
          </Section>

          <Text style={paragraph}>Hello <strong>{recipientName}</strong>,</Text>
          <Text style={paragraph}>
            An administrator account has been created for you on <strong>{churchName}</strong>. Below are your initial login credentials:
          </Text>

          {/* Account Credentials Card */}
          <Section style={detailsCard}>
            <Text style={cardHeading}>Account Credentials</Text>

            <Section style={row}>
              <Text style={label}>Email Address</Text>
              <Text style={value}>{recipientEmail}</Text>
            </Section>

            <Section style={row}>
              <Text style={label}>Temporary Password</Text>
              <Text style={passBadge}>{temporaryPassword}</Text>
            </Section>

            {loginUrl && (
              <Section style={row}>
                <Text style={label}>Portal Login URL</Text>
                <Text style={value}>{loginUrl}</Text>
              </Section>
            )}
          </Section>

          {/* Warning Banner */}
          <Section style={warningBox}>
            <Text style={warningHeading}>⚠️ Security Warning</Text>
            <Text style={warningText}>
              The password provided above is <strong>temporary</strong> and was generated during account creation. For security reasons, please log in and change your password immediately under your profile settings.
            </Text>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            This is an automated email sent to {recipientEmail}. If you did not expect an admin account, please contact system administration.
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

const detailsCard = {
  padding: '20px',
  backgroundColor: '#f1f5f9',
  borderRadius: '8px',
  borderLeft: '4px solid #0f172a',
  margin: '20px 0',
};

const cardHeading = {
  fontSize: '15px',
  fontWeight: '700',
  color: '#0f172a',
  margin: '0 0 14px 0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const row = {
  marginBottom: '12px',
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

const passBadge = {
  fontSize: '16px',
  fontFamily: 'monospace',
  fontWeight: '700',
  color: '#b91c1c',
  backgroundColor: '#fef2f2',
  padding: '4px 10px',
  borderRadius: '4px',
  border: '1px solid #fca5a5',
  display: 'inline-block',
  margin: '0',
};

const warningBox = {
  backgroundColor: '#fffbeb',
  borderLeft: '4px solid #f59e0b',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '24px 0',
};

const warningHeading = {
  fontSize: '14px',
  fontWeight: '700',
  color: '#b45309',
  margin: '0 0 6px 0',
};

const warningText = {
  fontSize: '14px',
  lineHeight: '1.5',
  color: '#92400e',
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

export default AdminWelcomeEmail;
