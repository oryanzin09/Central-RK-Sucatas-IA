import { Router } from 'express';
import { generateToken } from '../utils/jwt';

const router = Router();

// Rota de login
router.post('/login', async (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  // Verificar senha
  if (!password || password !== adminPassword) {
    return res.status(401).json({
      success: false,
      error: 'Senha inválida'
    });
  }

  // Gerar token JWT
  const token = generateToken({
    authenticated: true,
    timestamp: Date.now()
  });

  res.json({
    success: true,
    token: `Bearer ${adminPassword}`, // ou usar JWT
    message: 'Login realizado com sucesso'
  });
});

// Rota para verificar status da autenticação (opcional)
router.get('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const senhaCorreta = process.env.ADMIN_PASSWORD;

  if (!authHeader || authHeader !== `Bearer ${senhaCorreta}`) {
    return res.status(401).json({ authenticated: false });
  }

  res.json({ authenticated: true });
});

export default router;
