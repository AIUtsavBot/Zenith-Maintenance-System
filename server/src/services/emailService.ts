import nodemailer from 'nodemailer';
import { getEmailPreferences, getUser } from '../config/db.js';

export function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

// Setup email transporter. Uses SMTP settings from env if available, otherwise falls back to console logging.
const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
  }
  
  // Console logging transport fallback for development
  return {
    sendMail: async (options: any) => {
      console.log('--- DEVELOPMENT EMAIL MOCK ---');
      console.log(`To: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log(`Body Snippet: ${options.text || options.html?.slice(0, 200)}...`);
      console.log('------------------------------');
      return { messageId: 'mock-id-12345' };
    }
  } as any;
};

const transporter = createTransporter();

// Helper to check if a user is within their Quiet Hours
function isUserInQuietHours(start: string, end: string, timezone: string = 'UTC'): boolean {
  try {
    const now = new Date();
    // Format current time in user's timezone to HH:MM format
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone
    });
    const parts = formatter.formatToParts(now);
    const hour = parts.find(p => p.type === 'hour')?.value || '12';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    const nowStr = `${hour}:${minute}`;

    if (start <= end) {
      return nowStr >= start && nowStr <= end;
    } else {
      // Over-midnight quiet hours, e.g. 22:00 to 08:00
      return nowStr >= start || nowStr <= end;
    }
  } catch (err) {
    console.error('Error parsing quiet hours:', err);
    return false;
  }
}

interface EmailOptions {
  toUsername: string;
  subject: string;
  category: 'reminder' | 'task' | 'goal' | 'weekly_report' | 'ai_report';
  html: string;
  text: string;
}

export async function sendEmail({ toUsername, subject, category, html, text }: EmailOptions): Promise<boolean> {
  try {
    const user = await getUser(toUsername);
    if (!user || !user.email) {
      console.log(`Skipping email: No email address for user ${toUsername}`);
      return false;
    }

    if (!user.emailVerified) {
      console.log(`Skipping email: User ${toUsername}'s email is not verified.`);
      return false;
    }

    // Load preferences
    let prefs = await getEmailPreferences(toUsername);
    if (!prefs) {
      // Default preferences
      prefs = {
        username: toUsername,
        receiveReminderEmails: true,
        receiveTaskEmails: true,
        receiveGoalEmails: true,
        receiveWeeklyReports: true,
        receiveAiReports: true,
        receiveMarketingEmails: false,
        enableDND: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00'
      };
    }

    // Check Do Not Disturb
    if (prefs.enableDND) {
      console.log(`Skipping email: User ${toUsername} has DND enabled.`);
      return false;
    }

    // Check category preferences
    if (category === 'reminder' && !prefs.receiveReminderEmails) return false;
    if (category === 'task' && !prefs.receiveTaskEmails) return false;
    if (category === 'goal' && !prefs.receiveGoalEmails) return false;
    if (category === 'weekly_report' && !prefs.receiveWeeklyReports) return false;
    if (category === 'ai_report' && !prefs.receiveAiReports) return false;

    // Check quiet hours
    const tz = user.timezone || 'UTC';
    if (isUserInQuietHours(prefs.quietHoursStart, prefs.quietHoursEnd, tz)) {
      console.log(`Skipping email: User ${toUsername} is currently in Quiet Hours (${prefs.quietHoursStart} - ${prefs.quietHoursEnd}) in timezone ${tz}.`);
      return false;
    }

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Zenith Focus" <noreply@zenithfocus.app>',
      to: user.email,
      subject,
      html,
      text
    });

    console.log(`Email sent successfully to ${user.email}: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`Error sending email to ${toUsername}:`, err);
    return false;
  }
}

// Generate template wrapper for email styling
export function getEmailTemplate(title: string, bodyContent: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            background-color: #0b0a10;
            color: #cbd5e1;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #12121c;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          }
          .header {
            background: linear-gradient(135deg, #818cf8 0%, #c084fc 100%);
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            color: #ffffff;
            font-size: 24px;
            font-weight: 800;
            letter-spacing: -0.5px;
          }
          .content {
            padding: 30px;
            line-height: 1.6;
            color: #cbd5e1;
            font-size: 16px;
          }
          .content h2 {
            color: #f8fafc;
            font-size: 20px;
            margin-top: 0;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #818cf8 0%, #c084fc 100%);
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: bold;
            margin: 20px 0;
            text-align: center;
          }
          .footer {
            padding: 20px 30px;
            background-color: rgba(0, 0, 0, 0.3);
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            text-align: center;
            font-size: 12px;
            color: #64748b;
          }
          .footer a {
            color: #818cf8;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Zenith Focus</h1>
          </div>
          <div class="content">
            ${bodyContent}
          </div>
          <div class="footer">
            <p>You received this because of your notification settings in Zenith Focus.</p>
            <p><a href="https://zenithfocus.app/settings">Manage Preferences</a> | <a href="https://zenithfocus.app/dnd">Enable DND</a></p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendVerificationOtp(username: string, email: string, otp: string): Promise<boolean> {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Zenith Focus" <noreply@zenithfocus.app>',
      to: email,
      subject: 'Verify your Zenith Focus email address',
      html: getEmailTemplate(
        'Verify your email',
        `<p>Hello ${username},</p>
         <p>Thank you for registering your email address with Zenith Focus.</p>
         <p>Please use the following One-Time Password (OTP) to verify your email address:</p>
         <div style="background-color: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 4px; border: 1px solid rgba(255,255,255,0.1); margin: 20px 0; color: #ffffff;">
           ${otp}
         </div>
         <p>This code will expire in 10 minutes.</p>
         <p>If you did not request this, you can safely ignore this email.</p>`
      ),
      text: `Hello ${username},\n\nYour OTP for email verification is: ${otp}\n\nThis code will expire in 10 minutes.`
    });
    console.log(`Verification OTP email sent successfully to ${email}: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`Error sending verification OTP to ${username} (${email}):`, err);
    return false;
  }
}

