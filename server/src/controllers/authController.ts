import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getSavedPasswordHash, savePasswordHash, getSavedUserPasswordHash, saveUserPasswordHash } from '../config/db.js';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';

const JWT_SECRET = process.env.JWT_SECRET || 'productivity_secret_key_123!';
const DEFAULT_PASSWORD = process.env.APP_PASSWORD || 'admin123';
const DEFAULT_USER_PASSWORD = process.env.USER_PASSWORD || 'user123';

export async function login(req: Request, res: Response) {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  try {
    // 1. Check if matches admin password
    const savedAdminHash = getSavedPasswordHash();
    let isAdminPasswordValid = false;

    if (savedAdminHash) {
      isAdminPasswordValid = await bcrypt.compare(password, savedAdminHash);
    } else {
      // Fallback to default admin password
      isAdminPasswordValid = password === DEFAULT_PASSWORD;
      
      // Auto-save hashed password into db to make it permanent and secure
      if (isAdminPasswordValid) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        savePasswordHash(hash);
      }
    }

    if (isAdminPasswordValid) {
      // Generate session token (expires in 30 days)
      const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '30d' });
      return res.json({ token, role: 'admin' });
    }

    // 2. Check if matches user password
    const savedUserHash = getSavedUserPasswordHash();
    let isUserPasswordValid = false;

    if (savedUserHash) {
      isUserPasswordValid = await bcrypt.compare(password, savedUserHash);
    } else {
      // Fallback to default user password
      isUserPasswordValid = password === DEFAULT_USER_PASSWORD;
      
      // Auto-save hashed password into db to make it permanent and secure
      if (isUserPasswordValid) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        saveUserPasswordHash(hash);
      }
    }

    if (isUserPasswordValid) {
      // Generate session token (expires in 30 days)
      const token = jwt.sign({ role: 'user' }, JWT_SECRET, { expiresIn: '30d' });
      return res.json({ token, role: 'user' });
    }

    return res.status(401).json({ error: 'Invalid password' });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function changePassword(req: AuthenticatedRequest, res: Response) {
  const { oldPassword, newPassword } = req.body;
  const role = req.user?.role;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Old and new passwords are required' });
  }

  try {
    if (role === 'admin') {
      const savedHash = getSavedPasswordHash();
      let isOldValid = false;

      if (savedHash) {
        isOldValid = await bcrypt.compare(oldPassword, savedHash);
      } else {
        isOldValid = oldPassword === DEFAULT_PASSWORD;
      }

      if (!isOldValid) {
        return res.status(400).json({ error: 'Incorrect current password' });
      }

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(newPassword, salt);
      savePasswordHash(hash);

      return res.json({ message: 'Admin password changed successfully' });
    } else if (role === 'user') {
      const savedHash = getSavedUserPasswordHash();
      let isOldValid = false;

      if (savedHash) {
        isOldValid = await bcrypt.compare(oldPassword, savedHash);
      } else {
        isOldValid = oldPassword === DEFAULT_USER_PASSWORD;
      }

      if (!isOldValid) {
        return res.status(400).json({ error: 'Incorrect current password' });
      }

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(newPassword, salt);
      saveUserPasswordHash(hash);

      return res.json({ message: 'User password changed successfully' });
    } else {
      return res.status(403).json({ error: 'Access denied: Unknown role' });
    }
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export function validateToken(req: AuthenticatedRequest, res: Response) {
  return res.json({ valid: true, role: req.user?.role });
}
