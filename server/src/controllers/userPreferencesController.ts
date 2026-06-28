import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { 
  getUser, 
  saveUser, 
  getEmailPreferences, 
  saveEmailPreferences 
} from '../config/db.js';
import { sendVerificationOtp, isSmtpConfigured } from '../services/emailService.js';

const pendingVerifications = new Map<string, { email: string; otp: string; expires: number }>();

export async function getUserProfile(req: AuthenticatedRequest, res: Response) {
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = await getUser(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let prefs = await getEmailPreferences(username);
    if (!prefs) {
      prefs = {
        username: user.username,
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
      await saveEmailPreferences(username, prefs);
    }

    return res.json({
      profile: {
        username: user.username,
        name: user.name || user.username,
        email: user.email || '',
        timezone: user.timezone || 'UTC',
        emailVerified: user.emailVerified || false,
        role: user.role
      },
      preferences: prefs
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    return res.status(500).json({ error: 'Failed to retrieve profile data' });
  }
}

export async function updateUserProfile(req: AuthenticatedRequest, res: Response) {
  const username = req.user?.username;
  const { email, timezone, name, preferences } = req.body;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = await getUser(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user profile fields
    if (name !== undefined) user.name = name;
    if (timezone !== undefined) user.timezone = timezone;

    // We do NOT update the email here directly anymore.
    // Email updates must go through the verification flow (verify-email OTP) to ensure it is verified before saving to the DB.

    await saveUser(username, user);

    // Update preferences if provided
    let prefs = await getEmailPreferences(username);
    if (!prefs) {
      prefs = {
        username: user.username,
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

    if (preferences) {
      prefs.receiveReminderEmails = preferences.receiveReminderEmails !== undefined ? preferences.receiveReminderEmails : prefs.receiveReminderEmails;
      prefs.receiveTaskEmails = preferences.receiveTaskEmails !== undefined ? preferences.receiveTaskEmails : prefs.receiveTaskEmails;
      prefs.receiveGoalEmails = preferences.receiveGoalEmails !== undefined ? preferences.receiveGoalEmails : prefs.receiveGoalEmails;
      prefs.receiveWeeklyReports = preferences.receiveWeeklyReports !== undefined ? preferences.receiveWeeklyReports : prefs.receiveWeeklyReports;
      prefs.receiveAiReports = preferences.receiveAiReports !== undefined ? preferences.receiveAiReports : prefs.receiveAiReports;
      prefs.receiveMarketingEmails = preferences.receiveMarketingEmails !== undefined ? preferences.receiveMarketingEmails : prefs.receiveMarketingEmails;
      prefs.enableDND = preferences.enableDND !== undefined ? preferences.enableDND : prefs.enableDND;
      prefs.quietHoursStart = preferences.quietHoursStart || prefs.quietHoursStart;
      prefs.quietHoursEnd = preferences.quietHoursEnd || prefs.quietHoursEnd;

      await saveEmailPreferences(username, prefs);
    }

    return res.json({
      message: 'Profile updated successfully',
      profile: {
        username: user.username,
        name: user.name || user.username,
        email: user.email || '',
        timezone: user.timezone || 'UTC',
        emailVerified: user.emailVerified || false,
        role: user.role
      },
      preferences: prefs
    });
  } catch (error) {
    console.error('Update user profile error:', error);
    return res.status(500).json({ error: 'Failed to update profile data' });
  }
}

export async function verifyEmail(req: AuthenticatedRequest, res: Response) {
  const username = req.user?.username;
  const { otp, email } = req.body;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = await getUser(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const normalizedUser = username.toLowerCase();

    // If OTP is provided, perform validation
    if (otp !== undefined) {
      const activeVerification = pendingVerifications.get(normalizedUser);
      if (!activeVerification) {
        return res.status(400).json({ error: 'No verification request active. Please request a new code.' });
      }

      if (Date.now() > activeVerification.expires) {
        pendingVerifications.delete(normalizedUser);
        return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
      }

      if (activeVerification.otp !== otp.trim()) {
        return res.status(400).json({ error: 'Incorrect verification code. Please try again.' });
      }

      // Valid OTP: set email and mark as verified in database now
      user.email = activeVerification.email;
      user.emailVerified = true;
      await saveUser(username, user);
      
      // Clean up the map
      pendingVerifications.delete(normalizedUser);

      return res.json({ 
        status: 'verified',
        message: 'Email successfully verified and updated!', 
        profile: {
          username: user.username,
          name: user.name || user.username,
          email: user.email,
          timezone: user.timezone || 'UTC',
          emailVerified: true,
          role: user.role
        }
      });
    }

    // If OTP is NOT provided, generate and send a new OTP for the proposed email
    const targetEmail = email || user.email;
    if (!targetEmail) {
      return res.status(400).json({ error: 'Please enter a valid email address first.' });
    }

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    pendingVerifications.set(normalizedUser, {
      email: targetEmail.trim(),
      otp: generatedOtp,
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes expiration
    });

    const emailSent = await sendVerificationOtp(user.username, targetEmail.trim(), generatedOtp);

    const payload: any = {
      status: 'pending',
      message: 'A verification code (OTP) has been sent to your email.'
    };

    if (!emailSent || !isSmtpConfigured()) {
      payload.otp = generatedOtp;
      if (!emailSent && isSmtpConfigured()) {
        payload.warning = 'SMTP host was unreachable or authentication failed. Check credentials.';
      }
    }

    return res.json(payload);
  } catch (error) {
    console.error('Verify email error:', error);
    return res.status(500).json({ error: 'Failed to process email verification' });
  }
}
