export const EMAIL_SERVICE = 'EMAIL_SERVICE';

export interface RegistrationConfirmationEmailData {
  recipientEmail: string;
  recipientName: string;
  eventTitle: string;
  eventDate?: string;
  eventLocation?: string;
  contactEmail?: string;
  contactPhone?: string;
  registrationNumber: string;
  qrToken: string;
  qrCodeDataUrl: string;
  teamName?: string;
  teamColor?: string;
  googleCalendarUrl?: string;
  icsBuffer?: Buffer;
}

export interface AdminWelcomeEmailData {
  recipientEmail: string;
  recipientName: string;
  temporaryPassword: string;
  loginUrl?: string;
  churchName?: string;
}

export interface IEmailService {
  sendRegistrationConfirmation(
    data: RegistrationConfirmationEmailData,
  ): Promise<void>;
  sendAdminWelcome(data: AdminWelcomeEmailData): Promise<void>;
}
