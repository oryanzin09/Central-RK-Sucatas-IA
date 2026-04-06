import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'gen-lang-client-0969674405'
  });
}

// Lista de rotas que NÃO precisam de autenticação
const rotasPublicas = [
  '/health',
  '/login',
  '/public-stats',
  '/register',
  '/api/register',
  '/api/login'
];

export async function autenticar(req: Request, res: Response, next: NextFunction) {
  // Verificar se a rota atual é pública
  const isPublic = rotasPublicas.some(rota => {
    return req.path === rota || req.originalUrl.includes(rota);
  });

  if (isPublic) {
    return next(); // Rota pública, prossegue sem autenticação
  }

  // Buscar token no cookie ou no header Authorization (fallback)
  const token = req.cookies?.auth_token || (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].split(' ')[1] : null);
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Acesso não autorizado',
      message: 'Token inválido ou ausente'
    });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    // Adicionar dados do usuário ao request para uso posterior
    (req as any).user = decoded;
    next(); // Autenticado, prossegue
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Acesso não autorizado',
      message: 'Token inválido ou expirado'
    });
  }
}

// Middleware ACL para verificar roles específicas (deprecated, roles are handled by Firestore rules now)
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // We no longer enforce roles in the backend since admin routes are moved to frontend/Firestore
    next();
  };
}
