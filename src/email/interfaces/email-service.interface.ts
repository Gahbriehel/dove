export const EMAIL_SERVICE = 'EMAIL_SERVICE';

export interface RegistrationConfirmationEmailData {
  recipientEmail: string;
  recipientName: string;
  eventTitle: string;
  registrationNumber: string;
  qrToken: string;
  qrCodeDataUrl: string;
  teamName?: string;
  teamColor?: string;
}

export interface IEmailService {
  sendRegistrationConfirmation(
    data: RegistrationConfirmationEmailData,
  ): Promise<void>;
}
