import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const fromNumber = process.env.TWILIO_PHONE_NUMBER;

export class SMSService {
  async sendOTP(mobileNumber: string, code: string): Promise<boolean> {
    try {
      const message = await client.messages.create({
        body: `Your Kanteeravas Badminton Club verification code is: ${code}. Valid for 5 minutes.`,
        from: fromNumber,
        to: mobileNumber
      });

      console.log(`SMS sent successfully to ${mobileNumber}. SID: ${message.sid}`);
      return true;
    } catch (error) {
      console.error('Failed to send SMS:', error);
      return false;
    }
  }

  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

export const smsService = new SMSService();