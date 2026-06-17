import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getSavedPasswordHash, savePasswordHash } from '../config/db.js';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';

const JWT_SECRET = process.env.JWT_SECRET || 'productivity_secret_key_123!';
const DEFAULT_PASSWORD = process.env.APP_PASSWORD || 'admin123';

export async function login(req: Request, res: Response) {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  try {
    const savedHash = getSavedPasswordHash();
    let isPasswordValid = false;

    if (savedHash) {
      isPasswordValid = await bcrypt.compare(password, savedHash);
    } else {
      // If no custom password is saved in local db, match against default config password
      isPasswordValid = password === DEFAULT_PASSWORD;
      
      // Auto-save hashed password into db to make it permanent and secure
      if (isPasswordValid) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        savePasswordHash(hash);
      }
    }

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Generate session token (expires in 30 days)
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function changePassword(req: AuthenticatedRequest, res: Response) {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Old and new passwords are required' });
  }

  try {
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

    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export function validateToken(req: AuthenticatedRequest, res: Response) {
  return res.json({ valid: true });
}
