import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'rk-sucatas-secret-key';

export function generateToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}
