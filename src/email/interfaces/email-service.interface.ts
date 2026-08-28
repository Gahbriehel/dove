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
  churchId?: string;
  personId?: string;
}

export interface AdminWelcomeEmailData {
  recipientEmail: string;
  recipientName: string;
  temporaryPassword: string;
  loginUrl?: string;
  churchName?: string;
  churchId?: string;
  userId?: string;
}

export interface CustomEmailData {
  recipientEmail: string;
  recipientName: string;
  subject: string;
  heading?: string;
  message: string;
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
  churchId?: string;
  personId?: string;
  userId?: string;
}

export interface BounceAdminAlertEmailData {
  recipientEmail: string;
  bouncedEmail: string;
  eventType: string;
  reason?: string;
  recipientName?: string;
  recipientType?: string;
  churchName?: string;
}

export interface BatchCustomEmailResult {
  totalTargeted: number;
  totalWithEmail: number;
  totalSent: number;
  totalFailed: number;
  failedRecipients: Array<{ recipient: string; reason: string }>;
}

export interface IEmailService {
  sendRegistrationConfirmation(
    data: RegistrationConfirmationEmailData,
  ): Promise<void>;
  sendAdminWelcome(data: AdminWelcomeEmailData): Promise<void>;
  sendCustomBroadcast(data: CustomEmailData): Promise<void>;
  sendBatchCustomBroadcast(
    data: CustomEmailData[],
  ): Promise<BatchCustomEmailResult>;
  sendBounceAdminAlert(data: BounceAdminAlertEmailData): Promise<void>;
}
