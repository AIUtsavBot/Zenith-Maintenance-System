import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { 
  getUser, 
  saveUser, 
  getEmailPreferences, 
  saveEmailPreferences 
} from '../config/db.js';

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

    // Handle email change and reset verification status if changed
    if (email !== undefined && email !== user.email) {
      user.email = email.trim();
      user.emailVerified = false; // Reset verification on change
    }

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

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = await getUser(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.email) {
      return res.status(400).json({ error: 'Please add an email address first before verification' });
    }

    // In a production environment, this would verify a code sent to the email.
    // For development and testing, we automatically verify the email upon request.
    user.emailVerified = true;
    await saveUser(username, user);

    return res.json({ 
      message: 'Email successfully verified!', 
      profile: {
        username: user.username,
        name: user.name || user.username,
        email: user.email,
        timezone: user.timezone,
        emailVerified: true,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Verify email error:', error);
    return res.status(500).json({ error: 'Failed to verify email' });
  }
}
