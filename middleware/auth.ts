import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';

// Lista de rotas que NÃO precisam de autenticação
const rotasPublicas = [
  '/health',
  '/login',
  '/public-stats'
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

  // Buscar token no header Authorization
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Acesso não autorizado',
      message: 'Token inválido ou ausente'
    });
  }

  const token = authHeader.split(' ')[1];
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
