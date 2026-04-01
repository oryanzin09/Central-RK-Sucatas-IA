import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';

// Lista de rotas que NÃO precisam de autenticação
const rotasPublicas = [
  '/health',
  '/login',
  '/public-stats',
  '/register',
  '/api/register',
  '/api/login'
];

export function autenticar(req: Request, res: Response, next: NextFunction) {
  // Verificar se a rota atual é pública
  const isPublic = rotasPublicas.some(rota => {
    // req.path já não tem o prefixo /api quando montado com app.use('/api', autenticar)
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

  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: 'Acesso não autorizado',
      message: 'Token inválido ou expirado'
    });
  }

  // Adicionar dados do usuário ao request para uso posterior
  (req as any).user = decoded;
  next(); // Autenticado, prossegue
}

// Middleware ACL para verificar roles específicas
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Acesso não autorizado',
        message: 'Usuário não autenticado'
      });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        message: 'Você não tem permissão para acessar este recurso.'
      });
    }

    next();
  };
}
