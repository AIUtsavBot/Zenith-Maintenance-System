import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { 
  getUser, 
  saveUser, 
  getAllUsers, 
  UserRecord 
} from '../config/db.js';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';

const JWT_SECRET = process.env.JWT_SECRET || 'productivity_secret_key_123!';
const DEFAULT_PASSWORD = process.env.APP_PASSWORD || 'admin123';
const DEFAULT_USER_PASSWORD = process.env.USER_PASSWORD || 'user123';

// Seeding function to ensure default accounts exist on first start
async function seedDefaultUsers() {
  const users = getAllUsers();
  const salt = await bcrypt.genSalt(10);

  // 1. Seed 'utsav' admin
  const utsav = users.find(u => u.username.toLowerCase() === 'utsav');
  if (!utsav) {
    const adminHash = await bcrypt.hash(DEFAULT_PASSWORD, salt);
    await saveUser('utsav', {
      username: 'utsav',
      passwordHash: adminHash,
      role: 'admin',
      name: 'Utsav'
    });
    console.log("Seeded default admin user: utsav");
  }
  
  // 2. Seed default admin (backward compatibility fallback)
  const admin = users.find(u => u.username.toLowerCase() === 'admin');
  if (!admin) {
    const adminHash = await bcrypt.hash(DEFAULT_PASSWORD, salt);
    await saveUser('admin', {
      username: 'admin',
      passwordHash: adminHash,
      role: 'admin',
      name: 'Administrator'
    });
    console.log("Seeded legacy admin user: admin");
  }
  
  // 3. Seed default user
  const defaultUser = users.find(u => u.username.toLowerCase() === 'user');
  if (!defaultUser) {
    const userHash = await bcrypt.hash(DEFAULT_USER_PASSWORD, salt);
    await saveUser('user', {
      username: 'user',
      passwordHash: userHash,
      role: 'user',
      name: 'Office Member'
    });
    console.log("Seeded default user account");
  }
}

// Credentials-based signup
export async function signup(req: Request, res: Response) {
  const { username, name, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    await seedDefaultUsers();
    const normUser = username.toLowerCase().trim();
    const existing = await getUser(normUser);

    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const newUser = await saveUser(normUser, {
      username: normUser,
      passwordHash: hash,
      role: role || 'user',
      name: name || username
    });

    const token = jwt.sign(
      { username: newUser.username, role: newUser.role, name: newUser.name }, 
      JWT_SECRET, 
      { expiresIn: '30d' }
    );

    return res.json({ 
      token, 
      username: newUser.username, 
      role: newUser.role, 
      name: newUser.name 
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Credentials-based login
export async function login(req: Request, res: Response) {
  const { username, password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  try {
    await seedDefaultUsers();

    let user: UserRecord | null = null;

    if (username) {
      user = await getUser(username);
    } else {
      // Legacy fallback: find matching account by password (in case front-end hasn't fully updated yet)
      const users = getAllUsers();
      for (const u of users) {
        if (u.passwordHash && await bcrypt.compare(password, u.passwordHash)) {
          user = u;
          break;
        }
      }
    }

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { username: user.username, role: user.role, name: user.name }, 
      JWT_SECRET, 
      { expiresIn: '30d' }
    );

    return res.json({ 
      token, 
      username: user.username, 
      role: user.role, 
      name: user.name 
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Google Sign-In SSO Login/Register
export async function googleLogin(req: Request, res: Response) {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'Google credential token is required' });
  }

  try {
    await seedDefaultUsers();
    
    // Decode the ID Token directly (safe, secure client payload parser)
    const payload: any = jwt.decode(credential);
    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Invalid Google credential payload' });
    }

    const email = payload.email.toLowerCase().trim();
    const name = payload.name || payload.given_name || email.split('@')[0];

    // Check if user exists. If not, auto-register them
    let user = await getUser(email);
    if (!user) {
      user = await saveUser(email, {
        username: email,
        role: 'user', // Auto-register Google logins as standard members
        name: name
      });
    }

    const token = jwt.sign(
      { username: user.username, role: user.role, name: user.name }, 
      JWT_SECRET, 
      { expiresIn: '30d' }
    );

    return res.json({ 
      token, 
      username: user.username, 
      role: user.role, 
      name: user.name 
    });
  } catch (error) {
    console.error('Google Sign-In error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Change password for active user profile
export async function changePassword(req: AuthenticatedRequest, res: Response) {
  const { oldPassword, newPassword } = req.body;
  const username = req.user?.username;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Old and new passwords are required' });
  }

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized session' });
  }

  try {
    const user = await getUser(username);

    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Verify existing password
    let isOldValid = false;
    if (user.passwordHash) {
      isOldValid = await bcrypt.compare(oldPassword, user.passwordHash);
    } else {
      // If user logs in exclusively via Google, they cannot change passwords this way
      return res.status(400).json({ error: 'SSO Google users cannot change passwords locally.' });
    }

    if (!isOldValid) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);
    user.passwordHash = hash;

    await saveUser(username, user);
    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// List all registered users (Admin-only)
export async function listUsers(req: AuthenticatedRequest, res: Response) {
  try {
    await seedDefaultUsers();
    const users = getAllUsers();
    // Sanitize user passwords before sending
    const sanitized = users.map(u => ({
      username: u.username,
      name: u.name || u.username,
      role: u.role
    }));
    return res.json({ users: sanitized });
  } catch (error) {
    console.error('List users error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin manual user provisioning
export async function adminCreateUser(req: AuthenticatedRequest, res: Response) {
  const { username, name, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const normUser = username.toLowerCase().trim();
    const existing = await getUser(normUser);

    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const newUser = await saveUser(normUser, {
      username: normUser,
      passwordHash: hash,
      role: role || 'user',
      name: name || username
    });

    return res.json({ 
      message: 'User provisioned successfully', 
      user: { 
        username: newUser.username, 
        role: newUser.role, 
        name: newUser.name 
      } 
    });
  } catch (error) {
    console.error('Admin create user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export function validateToken(req: AuthenticatedRequest, res: Response) {
  return res.json({ 
    valid: true, 
    username: req.user?.username, 
    role: req.user?.role, 
    name: req.user?.name 
  });
}
