import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export interface RegistrationConfirmationEmailProps {
  recipientName: string;
  eventTitle: string;
  registrationNumber: string;
  qrCodeDataUrl: string;
  teamName?: string;
  teamColor?: string;
}

export const RegistrationConfirmationEmail = ({
  recipientName = 'Valued Guest',
  eventTitle = 'Church Event',
  registrationNumber = 'REG-123456',
  qrCodeDataUrl = '',
  teamName,
  teamColor,
}: RegistrationConfirmationEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Registration Confirmed for {eventTitle}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Registration Confirmed!</Heading>
          <Text style={paragraph}>Hello {recipientName},</Text>
          <Text style={paragraph}>
            You have successfully registered for <strong>{eventTitle}</strong>. Below are your registration details and event check-in pass.
          </Text>

          <Section style={card}>
            <Text style={cardText}>
              <strong>Registration Number:</strong> {registrationNumber}
            </Text>
            {teamName && (
              <Text style={cardText}>
                <strong>Assigned Team:</strong>{' '}
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: teamColor || '#3B82F6',
                    color: '#ffffff',
                    fontWeight: 'bold',
                  }}
                >
                  {teamName}
                </span>
              </Text>
            )}
          </Section>

          {qrCodeDataUrl && (
            <Section style={qrSection}>
              <Text style={paragraph}>
                Present this QR code at check-in when you arrive:
              </Text>
              <Img
                src={qrCodeDataUrl}
                width="200"
                height="200"
                alt="Check-in QR Code"
                style={qrImage}
              />
            </Section>
          )}

          <Hr style={hr} />

          <Text style={footer}>
            If you have any questions or need help, please reach out to the event organizers.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 48px 48px',
  marginBottom: '64px',
  borderRadius: '8px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
};

const heading = {
  fontSize: '24px',
  letterSpacing: '-0.5px',
  lineHeight: '1.3',
  fontWeight: '400',
  color: '#484848',
  padding: '17px 0 0',
};

const paragraph = {
  margin: '0 0 15px',
  fontSize: '15px',
  lineHeight: '1.4',
  color: '#3c4149',
};

const card = {
  padding: '16px',
  backgroundColor: '#f4f4f7',
  borderRadius: '6px',
  margin: '16px 0',
};

const cardText = {
  margin: '6px 0',
  fontSize: '14px',
  color: '#3c4149',
};

const qrSection = {
  textAlign: 'center' as const,
  margin: '24px 0',
};

const qrImage = {
  margin: '0 auto',
  display: 'block',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '1.5',
};

export default RegistrationConfirmationEmail;
