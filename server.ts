import express from "express";
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { createServer } from "http";
import { Server } from "socket.io";
import QRCode from 'qrcode';
import axios from 'axios';
import multer from 'multer';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import mlClient from './services/mlClient.js';
import { autenticar, requireRole } from './middleware/auth.js';
import { ML_CACHE_TTL, mlItemCache } from './services/mlCache.js';
import db from './services/db.js';
import { generateToken } from './utils/jwt.js';

dotenv.config();

// Carrega configuração do config.json se existir
let config: any = {};
try {
  if (fs.existsSync("./config.json")) {
    config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
  }
} catch (err) {
  console.error("Erro ao ler config.json:", err);
}

const NOTION_TOKEN = process.env.NOTION_TOKEN || "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";
const DATABASE_ID = process.env.NOTION_DATABASE_ID || process.env.NOTION_DB_ESTOQUE || "";
const MOTOS_DATABASE_ID = process.env.NOTION_DB_MOTOS || "";
const CLIENTS_DATABASE_ID = process.env.DATABASE_CLIENTES || process.env.NOTION_DB_CLIENTS || "";
const NOTION_VERSION = '2022-06-28';
const serverStartTime = new Date().toISOString();

// Cache para estrutura do banco de dados e resultados de query
const dbStructureCache: Record<string, { data: any, timestamp: number }> = {};
const notionDataCache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 1000 * 60 * 5; // 5 minutos
const DATA_CACHE_TTL = 1000 * 60 * 5; // 5 minutos para dados (RK Sucatas: cache otimizado)
const fetchLocks: Record<string, Promise<any> | null> = {};

function invalidateCache(databaseId?: string) {
  if (databaseId) {
    delete notionDataCache[databaseId];
    console.log(`🧹 Cache invalidado para o banco ${databaseId}`);
  } else {
    // Limpa tudo se não for passado ID
    Object.keys(notionDataCache).forEach(key => delete notionDataCache[key]);
    console.log('🧹 Todo o cache do Notion foi limpo');
  }
}

async function getCachedDbStructure(databaseId: string) {
  const cached = dbStructureCache[databaseId];
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      console.warn(`⚠️ Estrutura do banco não encontrada (ID: ${databaseId}). Retornando estrutura vazia.`);
      return { properties: {} };
    }
    throw new Error(`Não foi possível carregar a estrutura do banco: ${response.statusText}`);
  }
  const data = await response.json();
  dbStructureCache[databaseId] = { data, timestamp: Date.now() };
  return data;
}

async function notionQuery(databaseId: string) {
  console.log(`🔍 Fazendo query no banco: ${databaseId}`);
  
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION
    },
    body: JSON.stringify({ 
      page_size: 100,
      sorts: [
        {
          timestamp: "created_time",
          direction: "descending"
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ Erro Notion ${response.status}:`, error);
    throw new Error(`Notion API error (${response.status}): ${error.substring(0, 200)}`);
  }

  const data = await response.json();
  console.log(`✅ Encontradas ${data.results?.length || 0} páginas`);
  return data;
}

async function fetchAllFromNotion(databaseId: string) {
  // Verificar cache
  const cached = notionDataCache[databaseId];
  if (cached && (Date.now() - cached.timestamp < DATA_CACHE_TTL)) {
    console.log(`📦 Usando cache para o banco ${databaseId}`);
    return cached.data;
  }

  // Se já houver uma busca em andamento para este banco, aguarda ela
  if (fetchLocks[databaseId]) {
    console.log(`⏳ Aguardando busca em andamento para o banco ${databaseId}`);
    return fetchLocks[databaseId];
  }

  const fetchPromise = (async () => {
    try {
      let allResults: any[] = [];
      let cursor = undefined;
      let hasMore = true;
      
      console.log(`🔄 Buscando TODAS as páginas do banco ${databaseId}`);
      
      while (hasMore) {
        const payload: any = { 
          page_size: 100,
          sorts: [
            {
              timestamp: "created_time",
              direction: "descending"
            }
          ]
        };
        if (cursor) payload.start_cursor = cursor;
        
        const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Content-Type': 'application/json',
            'Notion-Version': NOTION_VERSION
          },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const error = await response.text();
          console.error(`❌ Erro Notion ${response.status}:`, error);
          
          if (response.status === 404) {
            console.warn(`⚠️ Banco de dados não encontrado (ID: ${databaseId}). Verifique se ele foi compartilhado com a integração.`);
            return []; // Retorna array vazio para não quebrar o app
          }
          
          throw new Error(`Notion API error (${response.status}): ${error.substring(0, 200)}`);
        }

        const data = await response.json();
        allResults = [...allResults, ...data.results];
        
        hasMore = data.has_more;
        cursor = data.next_cursor;
        
        console.log(`   → +${data.results.length} itens. Total: ${allResults.length}`);
      }
      
      // Salvar no cache
      notionDataCache[databaseId] = { data: allResults, timestamp: Date.now() };
      return allResults;
    } finally {
      fetchLocks[databaseId] = null;
    }
  })();

  fetchLocks[databaseId] = fetchPromise;
  return fetchPromise;
}

import storageService from './src/services/storageService.js';

// Helper function to log audit events
function logAudit(userId: number | null, action: string, entityType: string, entityId: number | null, details: any = null) {
  try {
    const detailsStr = details ? JSON.stringify(details) : null;
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, action, entityType, entityId, detailsStr);
  } catch (error) {
    console.error('❌ Erro ao registrar log de auditoria:', error);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  
  // Configuração para ambientes com proxy (Cloud Run, Nginx, etc.)
  app.set('trust proxy', 1);
  
  // Garantir que a pasta uploads existe
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('📁 Pasta uploads criada com sucesso');
  }

  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  const salesDbId = process.env.DATABASE_VENDAS_ID || process.env.NOTION_DB_VENDAS || "";

  app.use(express.json());

  // Configuração do CORS
  const allowedOrigins = [
    'https://aistudio.google.com',
    'http://localhost:3000',
    'https://rk-sucatas-987595911324.southamerica-east1.run.app'
  ];
  
  if (process.env.APP_URL) {
    allowedOrigins.push(process.env.APP_URL);
  }

  app.use(cors({
    origin: (origin, callback) => {
      // Permitir requisições sem origin (como mobile apps ou curl)
      if (!origin) return callback(null, true);
      
      const isAllowed = allowedOrigins.some(allowed => 
        origin === allowed || origin.startsWith(allowed)
      );
      
      if (isAllowed) {
        callback(null, true);
      } else {
        console.log(`⚠️ Origin não permitida pelo CORS: ${origin}`);
        callback(null, true); // Permitir por enquanto para debug, mas logar
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // Middleware para interpretar JSON no corpo das requisições
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Middleware de log para API
  app.use('/api', (req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
  });

  // Rotas de autenticação (públicas)
  app.post('/api/register', async (req, res) => {
    try {
      const { phone, password, name } = req.body;

      if (!phone || !password) {
        return res.status(400).json({ success: false, error: 'Telefone e senha são obrigatórios' });
      }

      // Criptografa a senha
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Verifica se é o primeiro usuário (Admin)
      const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
      if (userCount.count === 0) {
        const insertStmt = db.prepare('INSERT INTO users (phone, password_hash, name, role) VALUES (?, ?, ?, ?)');
        const result = insertStmt.run(phone, passwordHash, name || '', 'admin');
        const token = generateToken({ id: Number(result.lastInsertRowid), phone, role: 'admin' });
        
        res.cookie('auth_token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 24 * 60 * 60 * 1000 });
        return res.status(201).json({ success: true, message: 'Admin registrado', token: 'secure_cookie_active', user: { id: result.lastInsertRowid, phone, name, role: 'admin' } });
      }

      // Verifica se já existe em users (Staff)
      const existingUser = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
      if (existingUser) {
        return res.status(409).json({ success: false, error: 'Usuário já cadastrado com este telefone' });
      }

      // Verifica se existe em clients
      const existingClient = db.prepare('SELECT id, password_hash, name FROM clients WHERE phone = ?').get(phone) as any;
      
      let clientId;
      let clientName = name || '';

      if (existingClient) {
        if (existingClient.password_hash) {
          return res.status(409).json({ success: false, error: 'Cliente já cadastrado com este telefone' });
        }
        // Atualiza a senha do cliente existente
        db.prepare('UPDATE clients SET password_hash = ?, name = COALESCE(name, ?) WHERE id = ?').run(passwordHash, name || null, existingClient.id);
        clientId = existingClient.id;
        clientName = existingClient.name || name || '';
      } else {
        // Insere novo cliente
        const insertStmt = db.prepare('INSERT INTO clients (phone, password_hash, name) VALUES (?, ?, ?)');
        const result = insertStmt.run(phone, passwordHash, name || null);
        clientId = Number(result.lastInsertRowid);
      }

      // Gera o token (role 'client')
      const token = generateToken({ id: clientId, phone, role: 'client' });

      // Configura o cookie HttpOnly
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
      });

      res.status(201).json({
        success: true,
        message: 'Cliente registrado com sucesso',
        token: 'secure_cookie_active',
        user: { id: clientId, phone, name: clientName, role: 'client' }
      });
    } catch (error: any) {
      console.error('❌ Erro no registro:', error);
      res.status(500).json({ success: false, error: 'Erro interno ao registrar usuário' });
    }
  });

  app.post('/api/login', async (req, res) => {
    try {
      const { phone, password } = req.body;

      if (!phone || !password) {
        return res.status(400).json({ success: false, error: 'Telefone e senha são obrigatórios' });
      }

      // 1. Busca em users (Staff)
      let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone) as any;
      let isClient = false;

      // 2. Se não achou, busca em clients
      if (!user) {
        user = db.prepare('SELECT * FROM clients WHERE phone = ?').get(phone) as any;
        isClient = true;
      }

      if (!user || !user.password_hash) {
        return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
      }

      // Compara a senha
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
      }

      // Atualiza o último login
      if (isClient) {
        db.prepare('UPDATE clients SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
      } else {
        db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
      }

      const role = isClient ? 'client' : user.role;

      // Gera o token
      const token = generateToken({ id: user.id, phone: user.phone, role });

      // Configura o cookie HttpOnly
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
      });

      res.json({
        success: true,
        message: 'Login realizado com sucesso',
        token: 'secure_cookie_active',
        user: { id: user.id, phone: user.phone, name: user.name, role }
      });
    } catch (error: any) {
      console.error('❌ Erro no login:', error);
      res.status(500).json({ success: false, error: 'Erro interno ao realizar login' });
    }
  });

  app.post('/api/logout', (req, res) => {
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: true,
      sameSite: 'none'
    });
    res.json({ success: true, message: 'Logout realizado com sucesso' });
  });

  // Middleware de autenticação global para todas as rotas de API subsequentes
  app.use('/api', autenticar);

  // Rotas de Administração de Usuários (Protegidas)
  app.get('/api/admin/users', requireRole(['admin', 'gerente']), async (req, res) => {
    try {
      const users = db.prepare('SELECT id, phone, name, role, created_at, last_login FROM users').all();
      res.json({ success: true, data: users });
    } catch (error: any) {
      console.error('❌ Erro ao listar usuários:', error);
      res.status(500).json({ success: false, error: 'Erro ao buscar usuários' });
    }
  });

  app.put('/api/admin/users/:id/role', requireRole(['admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      const adminId = (req as any).user.id;
      
      if (!['admin', 'client', 'gerente', 'estoque'].includes(role)) {
        return res.status(400).json({ success: false, error: 'Role inválida' });
      }

      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
      logAudit(adminId, 'UPDATE_USER_ROLE', 'user', Number(id), { newRole: role });
      res.json({ success: true, message: 'Role atualizada com sucesso' });
    } catch (error: any) {
      console.error('❌ Erro ao atualizar role:', error);
      res.status(500).json({ success: false, error: 'Erro ao atualizar role' });
    }
  });

  app.delete('/api/admin/users/:id', requireRole(['admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const adminId = (req as any).user.id;
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      logAudit(adminId, 'DELETE_USER', 'user', Number(id));
      res.json({ success: true, message: 'Usuário removido com sucesso' });
    } catch (error: any) {
      console.error('❌ Erro ao remover usuário:', error);
      res.status(500).json({ success: false, error: 'Erro ao remover usuário' });
    }
  });

  // ==========================================
  // ROTAS DE CLIENTES (ADMIN)
  // ==========================================

  // Listar clientes
  app.get('/api/admin/clients', requireRole(['admin', 'gerente']), async (req, res) => {
    try {
      const clients = db.prepare('SELECT id, phone, name, interests, purchases, created_at, last_login FROM clients').all();
      res.json({ success: true, data: clients });
    } catch (error: any) {
      console.error('❌ Erro ao listar clientes:', error);
      res.status(500).json({ success: false, error: 'Erro ao buscar clientes' });
    }
  });

  // Criar cliente
  app.post('/api/admin/clients', requireRole(['admin', 'gerente']), async (req, res) => {
    try {
      const { phone, name, password, interests, purchases } = req.body;
      
      if (!phone) {
        return res.status(400).json({ success: false, error: 'O telefone é obrigatório' });
      }

      const existingClient = db.prepare('SELECT id FROM clients WHERE phone = ?').get(phone);
      if (existingClient) {
        return res.status(400).json({ success: false, error: 'Este telefone já está cadastrado' });
      }

      let passwordHash = null;
      if (password) {
        passwordHash = await bcrypt.hash(password, 10);
      }

      const result = db.prepare(`
        INSERT INTO clients (phone, password_hash, name, interests, purchases)
        VALUES (?, ?, ?, ?, ?)
      `).run(phone, passwordHash, name || null, interests || null, purchases || null);

      const adminId = (req as any).user.id;
      logAudit(adminId, 'CREATE_CLIENT', 'client', Number(result.lastInsertRowid), { phone, name });

      res.json({ success: true, message: 'Cliente criado com sucesso', id: result.lastInsertRowid });
    } catch (error: any) {
      console.error('❌ Erro ao criar cliente:', error);
      res.status(500).json({ success: false, error: 'Erro ao criar cliente' });
    }
  });

  // Atualizar cliente
  app.put('/api/admin/clients/:id', requireRole(['admin', 'gerente']), async (req, res) => {
    try {
      const { id } = req.params;
      const { phone, name, password, interests, purchases } = req.body;
      
      if (!phone) {
        return res.status(400).json({ success: false, error: 'O telefone é obrigatório' });
      }

      const existingClient = db.prepare('SELECT id FROM clients WHERE phone = ? AND id != ?').get(phone, id);
      if (existingClient) {
        return res.status(400).json({ success: false, error: 'Este telefone já está sendo usado por outro cliente' });
      }

      if (password) {
        const passwordHash = await bcrypt.hash(password, 10);
        db.prepare(`
          UPDATE clients SET phone = ?, name = ?, interests = ?, purchases = ?, password_hash = ? WHERE id = ?
        `).run(phone, name || null, interests || null, purchases || null, passwordHash, id);
      } else {
        db.prepare(`
          UPDATE clients SET phone = ?, name = ?, interests = ?, purchases = ? WHERE id = ?
        `).run(phone, name || null, interests || null, purchases || null, id);
      }

      const adminId = (req as any).user.id;
      logAudit(adminId, 'UPDATE_CLIENT', 'client', Number(id), { phone, name, interests, purchases });

      res.json({ success: true, message: 'Cliente atualizado com sucesso' });
    } catch (error: any) {
      console.error('❌ Erro ao atualizar cliente:', error);
      res.status(500).json({ success: false, error: 'Erro ao atualizar cliente' });
    }
  });

  // Deletar cliente
  app.delete('/api/admin/clients/:id', requireRole(['admin', 'gerente']), async (req, res) => {
    try {
      const { id } = req.params;
      const adminId = (req as any).user.id;
      db.prepare('DELETE FROM clients WHERE id = ?').run(id);
      logAudit(adminId, 'DELETE_CLIENT', 'client', Number(id));
      res.json({ success: true, message: 'Cliente removido com sucesso' });
    } catch (error: any) {
      console.error('❌ Erro ao remover cliente:', error);
      res.status(500).json({ success: false, error: 'Erro ao remover cliente' });
    }
  });

  // ==========================================
  // ROTAS DE AUDITORIA (ADMIN)
  // ==========================================

  app.get('/api/admin/audit-logs', requireRole(['admin']), async (req, res) => {
    try {
      // Join with users table to get the name of the user who performed the action
      const logs = db.prepare(`
        SELECT a.*, u.name as user_name, u.phone as user_phone
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC
        LIMIT 100
      `).all();
      res.json({ success: true, data: logs });
    } catch (error: any) {
      console.error('❌ Erro ao buscar logs de auditoria:', error);
      res.status(500).json({ success: false, error: 'Erro ao buscar logs de auditoria' });
    }
  });

  // Dashboard - Métricas principais
  app.get('/api/ml/dashboard', async (req, res) => {
    try {
      const { period = '30d', start, end } = req.query;
      console.log('📊 Iniciando busca do dashboard ML...');
      
      // Inicializar dados padrão
      let activeListingsCount = 0;
      let totalListingsCount = 0;
      let pendingQuestionsCount = 0;
      let monthlySalesTotal = 0;
      let totalSalesCount = 0;
      let pendingShipmentsCount = 0;
      let avgTicketValue = 0;
      let recentListings = [];

        // 1. Buscar anúncios (Total e Ativos)
        try {
          // 'start_time_desc' is the standard for newest items
          console.log('🔍 Buscando IDs dos anúncios mais recentes (start_time_desc)...');
          const allListings = await mlClient.getListings('active', 'start_time_desc', 100);
          totalListingsCount = allListings.total;
          
          if (allListings.results && allListings.results.length > 0) {
            try {
              const recentIds = allListings.results.slice(0, 50);
              const itemsToFetch: string[] = recentIds; // Bypass cache for dashboard to be 100% sure
              const results: any[] = [];
  
              if (itemsToFetch.length > 0) {
                const chunks = [];
                for (let i = 0; i < itemsToFetch.length; i += 20) {
                  chunks.push(itemsToFetch.slice(i, i + 20));
                }

                for (const chunk of chunks) {
                  const ids = chunk.join(',');
                  const itemsResponse = await mlClient.request('/items', {
                    params: { ids, attributes: 'id,title,price,thumbnail,status,permalink,pictures,date_created,available_quantity,sold_quantity' }
                  });
                  
                  if (Array.isArray(itemsResponse)) {
                    itemsResponse.forEach((item: any) => {
                      const body = item.body;
                      if (!body) return;
                      const formatted = {
                        id: body.id,
                        titulo: body.title,
                        preco: body.price,
                        thumbnail: body.thumbnail,
                        status: body.status,
                        link: body.permalink,
                        estoque: body.available_quantity,
                        vendidos: body.sold_quantity,
                        criado_em: body.date_created,
                        fotos: body.pictures?.map((p: any) => p.url) || []
                      };
                      // Still update cache for other parts of the app
                      mlItemCache.set(formatted.id, { data: formatted, timestamp: Date.now() });
                      results.push(formatted);
                    });
                  }
                }
              }
              
              // Sort manually by date_created DESC
              recentListings = results
                .sort((a: any, b: any) => {
                  const dateA = new Date(a.criado_em).getTime();
                  const dateB = new Date(b.criado_em).getTime();
                  return dateB - dateA;
                })
                .slice(0, 5)
                .map((item: any) => {
                  const highResImage = item.fotos && item.fotos.length > 0 
                    ? item.fotos[0] 
                    : item.thumbnail;
                    
                  return {
                    id: item.id,
                    titulo: item.titulo,
                    preco: item.preco,
                    thumbnail: highResImage,
                    status: item.status,
                    permalink: item.link,
                    date_created: item.criado_em,
                    estoque: item.estoque,
                    vendidos: item.vendidos
                  };
                });
              
              if (recentListings.length > 0) {
                console.log(`✅ Dashboard ML: Exibindo ${recentListings.length} anúncios. O mais recente é de: ${recentListings[0].date_created}`);
              }
            } catch (err) {
              console.error('⚠️ Erro ao buscar detalhes dos anúncios recentes:', err);
            }
          }
  
          // Also get total count just for the stat card
          const totalListings = await mlClient.getListings('all', 'start_time_desc', 1);
        totalListingsCount = totalListings.total;
        activeListingsCount = allListings.total;
      } catch (err) {
        console.error('⚠️ Erro ao buscar anúncios:', err);
      }
      
      // 2. Buscar perguntas pendentes
      try {
        const questions = await mlClient.getQuestions('UNANSWERED', 1);
        pendingQuestionsCount = questions.total;
      } catch (err) {
        console.error('⚠️ Erro ao buscar perguntas:', err);
      }
      
      // 3. Buscar métricas de vendas e dados para o gráfico
      let chartData = [];
      let recentSales = [];
      try {
        let endDate = new Date();
        let startDate = new Date();
        let days = 30;

        if (start && end) {
          startDate = new Date(start as string);
          endDate = new Date(end as string);
          days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
        } else {
          days = parseInt(period as string) || 30;
          startDate.setDate(startDate.getDate() - days);
        }
        
        const formatDate = (date: Date) => date.toISOString().split('T')[0];
        
        const salesMetrics = await mlClient.getSalesMetrics(
          formatDate(startDate),
          formatDate(endDate)
        );
        monthlySalesTotal = salesMetrics.total;
        avgTicketValue = salesMetrics.average;

        // Buscar ordens recentes para a lista de vendas
        // Buscar métricas e ordens em paralelo para maior performance
        const [ordersResponse, readyToShipOrdersResponse] = await Promise.all([
          mlClient.request(`/orders/search`, {
            params: {
              seller: await mlClient.ensureUserId(),
              sort: 'date_desc',
              limit: 15,
              'order.date_created.from': formatDate(startDate) + 'T00:00:00.000-00:00',
              'order.date_created.to': formatDate(endDate) + 'T23:59:59.000-00:00'
            }
          }),
          mlClient.request(`/orders/search`, {
            params: {
              seller: await mlClient.ensureUserId(),
              'shipping.status': 'ready_to_ship',
              sort: 'date_desc',
              limit: 15
            }
          }).catch(err => {
            console.error("⚠️ Erro ao buscar ordens prontas para envio no dashboard:", err.message);
            return { results: [] };
          })
        ]);

        pendingShipmentsCount = readyToShipOrdersResponse.paging?.total || 0;
        totalSalesCount = ordersResponse.paging?.total || ordersResponse.total || 0;

        // Mesclar ordens recentes e prontas para envio, removendo duplicatas
        const allOrders = [
          ...(ordersResponse.results || []),
          ...(readyToShipOrdersResponse.results || [])
        ];
        
        const uniqueOrdersMap = new Map();
        allOrders.forEach((order: any) => {
          if (!uniqueOrdersMap.has(order.id)) {
            uniqueOrdersMap.set(order.id, order);
          }
        });
        const orders = Array.from(uniqueOrdersMap.values());

        // Buscar detalhes de envio para as ordens para ter o substatus correto
        const shippingIds = orders.map((o: any) => o.shipping?.id).filter(Boolean);
        const shipmentsMap = new Map();

        if (shippingIds.length > 0) {
          // Buscar todos os detalhes de envio em paralelo para máxima velocidade
          const shipmentPromises = shippingIds.map((id: any) => 
            mlClient.request(`/shipments/${id}`, {
              headers: { 'x-format-new': 'true' }
            }).catch(() => null)
          );
          
          const shipments = await Promise.all(shipmentPromises);
          shipments.forEach((s: any) => {
            if (s && s.id) shipmentsMap.set(s.id, s);
          });
        }

        recentSales = orders.map((order: any) => {
          const buyer = order.buyer || {};
          const nomeCliente = buyer.first_name && buyer.last_name 
            ? `${buyer.first_name} ${buyer.last_name}` 
            : (buyer.nickname || 'Cliente ML');
            
          const shipmentDetails = order.shipping?.id ? shipmentsMap.get(order.shipping.id) : null;
          const shippingStatus = shipmentDetails?.status || order.shipping?.status;
          const shippingSubstatus = shipmentDetails?.substatus || order.shipping?.substatus;
          
          let statusFinal = shippingStatus;
          if (shippingStatus === 'ready_to_ship' || shippingStatus === 'shipped' || shippingStatus === 'delivered' || shippingStatus === 'cancelled' || shippingStatus === 'not_delivered') {
            statusFinal = shippingSubstatus ? `${shippingStatus}_${shippingSubstatus}` : shippingStatus;
          }

          return {
            id: order.id,
            cliente: nomeCliente,
            nickname: buyer.nickname,
            valor: order.total_amount,
            data: order.date_created,
            status: order.status === 'paid' ? 'Pago' : order.status,
            shipping_status: statusFinal,
            shipping_substatus: shippingSubstatus,
            itens: order.order_items?.map((i: any) => i.item?.title || i.item?.id || 'Produto ML').join(', '),
            thumbnail: order.order_items?.[0]?.item?.thumbnail,
            shipping_id: order.shipping?.id,
            quantidade: order.order_items?.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0) || 1
          };
        });

        // Gerar dados para o gráfico (agrupados por dia)
        const dailyData: Record<string, number> = {};
        for (let i = days; i >= 0; i--) {
          const d = new Date(endDate);
          d.setDate(endDate.getDate() - i);
          const dateStr = formatDate(d);
          dailyData[dateStr] = salesMetrics.dailyData?.[dateStr] || 0;
        }

        chartData = Object.entries(dailyData)
          .map(([date, total]) => {
            const [y, m, d] = date.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            return {
              date,
              label: dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
              vendas: total
            };
          })
          .sort((a, b) => a.date.localeCompare(b.date));

      } catch (err) {
        console.error('⚠️ Erro ao buscar métricas de vendas:', err);
      }
      
      res.json({
        success: true,
        data: {
          activeListings: activeListingsCount,
          totalListings: totalListingsCount,
          pendingQuestions: pendingQuestionsCount,
          monthlySales: monthlySalesTotal,
          totalSalesCount: totalSalesCount,
          pendingShipments: pendingShipmentsCount,
          avgTicket: avgTicketValue,
          recentListings,
          recentSales,
          chartData,
          period
        }
      });
    } catch (error: any) {
      console.error('❌ Erro crítico no dashboard ML:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message
      });
    }
  });

  // Baixar etiqueta de envio
  app.get('/api/ml/shipment-label/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const buffer = await mlClient.getShippingLabel(id);
      const uint8Array = new Uint8Array(buffer);
      
      // Detectar se é PDF ou ZIP
      const isZip = uint8Array.length > 2 && uint8Array[0] === 0x50 && uint8Array[1] === 0x4B;
      const contentType = isZip ? 'application/zip' : 'application/pdf';
      const extension = isZip ? 'zip' : 'pdf';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename=etiqueta-${id}.${extension}`);
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      console.error(`❌ Erro ao baixar etiqueta ${req.params.id}:`, error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Erro ao baixar etiqueta'
      });
    }
  });

  // Perguntas - Listar
  app.get('/api/ml/questions', async (req, res) => {
    try {
      const { status = 'UNANSWERED', limit = 50 } = req.query;
      
      const result = await mlClient.getQuestions(status as string, Number(limit));
      console.log('🔍 Estrutura da primeira pergunta:', JSON.stringify(result.questions?.[0], null, 2));
      
      // Buscar detalhes dos itens para cada pergunta de forma resiliente usando cache
      const enrichedQuestions = await Promise.all(
        (result.questions || []).map(async (q: any) => {
          try {
            // Verificar cache primeiro
            const cached = mlItemCache.get(q.item_id);
            if (cached && (Date.now() - cached.timestamp < ML_CACHE_TTL)) {
              return { 
                ...q, 
                item_title: cached.data.titulo, 
                item_thumbnail: cached.data.thumbnail,
                item_price: cached.data.preco
              };
            }

            // Se não estiver no cache, buscar no ML
            const item = await mlClient.request(`/items/${q.item_id}`);
            const itemData = {
              id: item.id,
              titulo: item.title,
              preco: item.price,
              thumbnail: item.thumbnail
            };
            
            // Salvar no cache (formato simplificado para o cache de itens)
            mlItemCache.set(item.id, { 
              data: {
                ...itemData,
                status: item.status,
                link: item.permalink,
                estoque: item.available_quantity,
                vendidos: item.sold_quantity,
                criado_em: item.date_created
              }, 
              timestamp: Date.now() 
            });

            return { 
              ...q, 
              item_title: item.title, 
              item_thumbnail: item.thumbnail,
              item_price: item.price
            };
          } catch (err) {
            console.error(`⚠️ Erro ao buscar item ${q.item_id} para pergunta ${q.id}:`, err.message);
            return {
              ...q,
              item_title: 'Item não disponível',
              item_thumbnail: '',
              item_price: 0
            };
          }
        })
      );
      
      res.json({
        success: true,
        data: enrichedQuestions,
        total: result.total
      });
    } catch (error: any) {
      console.error('❌ Erro ao listar perguntas ML:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Responder pergunta
  app.post('/api/ml/questions/:id/answer', async (req, res) => {
    try {
      const { id } = req.params;
      const { answer } = req.body;
      
      const result = await mlClient.answerQuestion(parseInt(id), answer);
      
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Limpar cache do Mercado Livre
  app.post('/api/ml/cache/clear', (req, res) => {
    mlItemCache.clear();
    console.log('🧹 Cache do Mercado Livre limpo manualmente');
    res.json({ success: true, message: 'Cache limpo com sucesso' });
  });

  // Anúncios ativos - Listar com detalhes
  app.get('/api/ml/listings', async (req, res) => {
    try {
      const { status = 'active', limit = 50, offset = 0, category, moto } = req.query;
      
      console.log(`🔍 Buscando anúncios ML: status=${status}, limit=${limit}, offset=${offset}`);
      
      // Buscamos os IDs para o status (limitado a um número razoável, ex: 1000)
      const listings = await mlClient.getListings(status as any, 'date_desc', 1000, 0);
      
      if (listings.results && listings.results.length > 0) {
        const allDetails: any[] = [];
        const idsToFetch: string[] = [];
        
        // Verificar o que já temos no cache
        listings.results.forEach((id: string) => {
          const cached = mlItemCache.get(id);
          if (cached && (Date.now() - cached.timestamp < ML_CACHE_TTL)) {
            allDetails.push(cached.data);
          } else {
            idsToFetch.push(id);
          }
        });

        if (idsToFetch.length > 0) {
          console.log(`📡 Buscando detalhes de ${idsToFetch.length} itens no ML...`);
          const batchSize = 20;
          const batches = [];
          
          for (let i = 0; i < idsToFetch.length; i += batchSize) {
            batches.push(idsToFetch.slice(i, i + batchSize).join(','));
          }
          
          // Buscar lotes em paralelo (máximo 5 por vez para não sobrecarregar)
          const fetchBatch = async (batchIds: string) => {
            try {
              const itemsResponse = await mlClient.request('/items', {
                params: { ids: batchIds, attributes: 'id,title,price,thumbnail,status,permalink,pictures,date_created,available_quantity,sold_quantity' }
              });
              
              return itemsResponse.map((item: any) => {
                const body = item.body;
                if (!body) return null;
                const formatted = {
                  id: body.id,
                  titulo: body.title,
                  preco: body.price,
                  thumbnail: body.thumbnail,
                  status: body.status,
                  link: body.permalink,
                  estoque: body.available_quantity,
                  vendidos: body.sold_quantity,
                  criado_em: body.date_created,
                  fotos: body.pictures?.map((p: any) => p.url) || []
                };
                
                // Salvar no cache
                mlItemCache.set(formatted.id, { data: formatted, timestamp: Date.now() });
                return formatted;
              }).filter(Boolean);
            } catch (err) {
              console.error(`❌ Erro ao buscar lote de itens ML:`, err);
              return [];
            }
          };

          // Executar batches em paralelo com limite de concorrência
          const results = await Promise.all(batches.map(batch => fetchBatch(batch)));
          results.forEach(batchResult => allDetails.push(...batchResult));
        }
        
        // Reordenar para manter a ordem original dos IDs (que vieram ordenados por data)
        const sortedDetails = listings.results
          .map((id: string) => allDetails.find(d => d.id === id))
          .filter(Boolean);

        // Aplicar filtros de busca (categoria e moto do Notion)
        let filteredResults = sortedDetails;
        
        if (category && category !== 'all') {
          const catStr = String(category).toLowerCase();
          filteredResults = filteredResults.filter(item => 
            item.titulo.toLowerCase().includes(catStr)
          );
        }
        
        if (moto && moto !== 'all') {
          const motoStr = String(moto).toLowerCase();
          filteredResults = filteredResults.filter(item => 
            item.titulo.toLowerCase().includes(motoStr)
          );
        }
        
        const totalFiltered = filteredResults.length;
        const paginatedResults = filteredResults.slice(Number(offset), Number(offset) + Number(limit));
        
        res.json({ 
          success: true, 
          data: paginatedResults,
          total: totalFiltered
        });
      } else {
        res.json({ success: true, data: [], total: 0 });
      }
    } catch (error: any) {
      console.error('❌ Erro ao buscar anúncios ML:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Atualizar anúncio
  app.put('/api/ml/listings/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      console.log(`📝 Recebida solicitação de atualização para o anúncio ${id}:`, updateData);
      const result = await mlClient.updateListing(id, updateData);
      
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error(`❌ Erro ao atualizar anúncio ${req.params.id}:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Listar vendas
  app.get('/api/ml/sales', async (req, res) => {
    try {
      const trintaDiasAtras = new Date();
      trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
      
      const userId = await mlClient.ensureUserId();
      console.log(`📡 Buscando vendas ML para o usuário: ${userId}`);
      
      // Busca as ordens recentes (últimos 30 dias)
      const recentOrdersPromise = mlClient.request(`/orders/search`, {
        params: { 
          seller: userId, 
          'order.date_created.from': trintaDiasAtras.toISOString().split('.')[0] + '-00:00',
          sort: 'date_desc', 
          limit: 15 
        }
      });

      // Busca especificamente ordens pendentes (não entregues) para garantir que não percamos nenhuma
      const pendingOrdersPromise = mlClient.request(`/orders/search`, {
        params: {
          seller: userId,
          'order.status': 'paid',
          tags: 'not_delivered',
          sort: 'date_desc',
          limit: 15
        }
      }).catch(err => {
        console.error("⚠️ Erro ao buscar ordens pendentes:", err.message);
        return { results: [] };
      });

      // Busca especificamente ordens prontas para envio
      const readyToShipOrdersPromise = mlClient.request(`/orders/search`, {
        params: {
          seller: userId,
          'shipping.status': 'ready_to_ship',
          sort: 'date_desc',
          limit: 15
        }
      }).catch(err => {
        console.error("⚠️ Erro ao buscar ordens prontas para envio:", err.message);
        return { results: [] };
      });

      const [recentOrdersResponse, pendingOrdersResponse, readyToShipOrdersResponse] = await Promise.all([
        recentOrdersPromise, 
        pendingOrdersPromise,
        readyToShipOrdersPromise
      ]);
      
      const allOrders = [
        ...(recentOrdersResponse.results || []), 
        ...(pendingOrdersResponse.results || []),
        ...(readyToShipOrdersResponse.results || [])
      ];
      
      // Remove duplicatas
      const uniqueOrdersMap = new Map();
      allOrders.forEach(order => uniqueOrdersMap.set(order.id, order));
      const orders = Array.from(uniqueOrdersMap.values());

      const shippingIds = Array.from(new Set(orders.map((o: any) => o.shipping?.id).filter(Boolean)));
      
      const shipmentsMap = new Map();
      if (shippingIds.length > 0) {
        try {
          console.log(`🚚 Buscando detalhes de ${shippingIds.length} envios com x-format-new em chunks...`);
          
          const chunkSize = 10;
          for (let i = 0; i < shippingIds.length; i += chunkSize) {
            const chunk = shippingIds.slice(i, i + chunkSize);
            const shipmentPromises = chunk.map((id: any) => 
              mlClient.request(`/shipments/${id}`, {
                headers: { 'x-format-new': 'true' }
              }).catch(err => {
                console.error(`⚠️ Erro ao buscar envio ${id}:`, err.message);
                return null;
              })
            );
            
            const shipments = await Promise.all(shipmentPromises);
            shipments.forEach((s: any) => {
              if (s && s.id) {
                shipmentsMap.set(s.id, s);
              }
            });
            
            if (shippingIds.length > chunkSize) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        } catch (err) {
          console.error('⚠️ Erro ao buscar detalhes de envios:', err);
        }
      }

      const salesMap = new Map();
      orders.forEach((order: any) => {
        if (salesMap.has(order.id)) return;
        
        const buyer = order.buyer || {};
        const nomeCliente = buyer.first_name && buyer.last_name 
          ? `${buyer.first_name} ${buyer.last_name}` 
          : (buyer.nickname || 'Cliente ML');
          
        const shipmentDetails = order.shipping?.id ? shipmentsMap.get(order.shipping.id) : null;
        const shippingStatus = shipmentDetails?.status || order.shipping?.status;
        const shippingSubstatus = shipmentDetails?.substatus || order.shipping?.substatus;
        
        // Log para debug da venda específica se necessário
        if (order.id === 2000015614957750 || String(order.id) === '2000015614957750') {
          console.log(`🎯 Venda Carcaça CG 150 encontrada! Status: ${order.status}, Shipping Status: ${shippingStatus}, Substatus: ${shippingSubstatus}`);
        }
        
        // Mapeamento preciso para o frontend
        
        // Determina o status unificado para o frontend
        let statusFinal = shippingStatus;
        if (shippingStatus === 'ready_to_ship' || shippingStatus === 'shipped' || shippingStatus === 'delivered' || shippingStatus === 'cancelled' || shippingStatus === 'not_delivered') {
          statusFinal = shippingSubstatus ? `${shippingStatus}_${shippingSubstatus}` : shippingStatus;
        }
        
        const isCancelled = order.status === 'cancelled' || shippingStatus === 'cancelled' || shippingSubstatus === 'cancelled_manually' || shippingSubstatus === 'time_expired' || shippingSubstatus === 'returning_to_sender';

        salesMap.set(order.id, {
          id: order.id,
          cliente: nomeCliente,
          nickname: buyer.nickname,
          valor: order.total_amount,
          data: order.date_created,
          status: order.status === 'paid' ? 'Pago' : order.status,
          shipping_status: statusFinal,
          shipping_substatus: shippingSubstatus,
          has_dispute: order.status_detail === 'mediation' || order.tags?.includes('disputed'),
          itens: order.order_items?.map((i: any) => i.item?.title || i.item?.id || 'Produto ML').join(', '),
          thumbnail: order.order_items?.[0]?.item?.thumbnail,
          shipping_id: order.shipping?.id,
          quantidade: order.order_items?.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0) || 1,
          is_cancelled: isCancelled
        });
      });
      
      const salesData = Array.from(salesMap.values());
      console.log('📦 Sales data sent to frontend:', JSON.stringify(salesData.slice(0, 5), null, 2));
      
      res.json({ success: true, data: salesData });
    } catch (error: any) {
      console.error('❌ Erro ao listar vendas ML:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Configurar multer para upload
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });

  const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Apenas imagens são permitidas'));
      }
    }
  });

  // Rota de upload de foto de perfil
  app.post('/api/upload/profile', autenticar, (req, res) => {
    upload.single('photo')(req, res, async (err) => {
      if (err) {
        console.error('❌ Erro no multer (profile):', err);
        return res.status(400).json({ success: false, error: err.message });
      }

      try {
        const file = req.file;
        const userPhone = req.body.phone;

        if (!file) {
          return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
        }

        if (!userPhone) {
          return res.status(400).json({ success: false, error: 'Número de telefone não fornecido' });
        }

        const uploadDir = path.join(process.cwd(), 'uploads', 'profiles');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Nome do arquivo baseado no telefone para ser único por usuário
        const ext = path.extname(file.originalname);
        const newFilename = `profile_${userPhone.replace(/\D/g, '')}${ext}`;
        const newPath = path.join(uploadDir, newFilename);

        // Move o arquivo para o local definitivo
        fs.renameSync(file.path, newPath);

        const baseUrl = process.env.APP_URL || `http://localhost:${PORT}`;
        const url = `${baseUrl}/uploads/profiles/${newFilename}`;

        console.log(`👤 Foto de perfil atualizada para ${userPhone}: ${url}`);

        res.json({ 
          success: true, 
          url: url,
          message: 'Foto de perfil atualizada com sucesso'
        });
      } catch (error: any) {
        console.error('❌ Erro no processamento de upload de perfil:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  });

  // Rota de upload geral
  app.post('/api/upload', (req, res) => {
    upload.array('files', 15)(req, res, async (err) => {
      if (err) {
        console.error('❌ Erro no multer:', err);
        return res.status(400).json({ 
          success: false, 
          error: err.message || 'Erro ao processar arquivos' 
        });
      }

      try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
        }

        const baseUrl = process.env.APP_URL || `http://localhost:${PORT}`;
        console.log(`🚀 Upload de ${files.length} arquivos. BaseURL: ${baseUrl}`);
        
        const urls = files.map(file => ({
          filename: file.filename,
          url: `${baseUrl}/uploads/${file.filename}`
        }));
        
        res.json({ 
          success: true, 
          urls: urls.map(u => u.url),
          message: `${files.length} arquivo(s) enviado(s) com sucesso`
        });
      } catch (error: any) {
        console.error('❌ Erro no processamento de upload:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  });

  // ==================== FRETE ROUTES ====================
  app.post('/api/frete/calculate', async (req, res) => {
    console.log('Recebida requisição de frete:', req.body);
    console.log('Token presente:', !!process.env.MELHOR_ENVIO_TOKEN);
    try {
      const { cep_origem, cep_destino, peso, largura, altura, comprimento } = req.body;
      
      // Melhor Envio API call
      const token = process.env.MELHOR_ENVIO_TOKEN || process.env.MELHOR_ENVIO_TO;
      console.log('Token utilizado:', token ? 'Token presente' : 'Token ausente');

      const response = await axios.post('https://melhorenvio.com.br/api/v2/me/shipment/calculate', {
        from: { postal_code: cep_origem },
        to: { postal_code: cep_destino },
        products: [{
          id: "sucata1",
          weight: parseFloat(peso),
          width: parseFloat(largura),
          height: parseFloat(altura),
          length: parseFloat(comprimento),
          insurance_value: 0.0,
          quantity: 1
        }],
        options: {
          insurance_value: 0.0,
          receipt: false,
          own_hand: false
        }
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'RK Sucatas (contato@rksucatas.com.br)'
        }
      });
      
      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error('❌ Erro detalhado ao calcular frete:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      res.status(500).json({ success: false, error: error.response?.data?.message || error.message });
    }
  });

  // ==================== GOOGLE CLOUD STORAGE ROUTES ====================

  // Endpoint para upload direto para o servidor (fallback se URL assinada falhar)
  app.post('/api/storage/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
      }

      console.log(`🚀 Recebido arquivo para upload direto para GCS: ${req.file.filename}`);
      
      const publicUrl = await storageService.uploadFile(
        req.file.path,
        req.file.filename,
        req.file.mimetype
      );

      // Opcional: deletar o arquivo local após o upload para o GCS
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('Erro ao deletar arquivo temporário:', e);
      }

      res.json({
        success: true,
        data: {
          publicUrl,
          filename: req.file.filename
        }
      });
    } catch (error: any) {
      console.error('❌ Erro no upload direto para GCS:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Endpoint para solicitar uma URL de upload
  app.post('/api/storage/request-upload', async (req, res) => {
    try {
      const { filename, fileType } = req.body;
      
      console.log(` Generating upload URL for: ${filename} (${fileType}) in bucket: ${process.env.GCS_BUCKET_NAME || 'rksucatas'}`);
      const uploadData = await storageService.generateUploadUrl(filename, fileType);
      console.log('✅ Upload URL generated successfully');
      
      res.json({
        success: true,
        data: uploadData
      });
    } catch (error: any) {
      // Log informativo: o frontend tem fallback para upload direto
      if (error.message.includes('IAM Service Account Credentials API')) {
        console.log('ℹ️ Info: API de Assinatura de URL desativada no GCP. O sistema usará o fallback de upload direto automaticamente.');
      } else {
        console.error('❌ Erro ao gerar URL de upload:', error.message);
      }
      res.status(500).json({ success: false, error: 'URL signing unavailable' });
    }
  });

  // Endpoint para deletar uma imagem (opcional)
  app.delete('/api/storage/files/:filename', async (req, res) => {
    try {
      const { filename } = req.params;
      await storageService.deleteFile(filename);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Servir arquivos estáticos da pasta uploads com log de erro se não encontrar
  app.use('/uploads', (req, res, next) => {
    const filePath = path.join(process.cwd(), 'uploads', req.path);
    if (!fs.existsSync(filePath)) {
      console.error(`⚠️ Arquivo não encontrado em /uploads: ${req.path}`);
    }
    next();
  }, express.static(path.join(process.cwd(), 'uploads')));

  function formatInventoryItem(page: any) {
    const props = page.properties;
    console.log("\n📄 Processando página. Propriedades disponíveis:", Object.keys(props));
    
    const result: any = {
      id: page.id,
      rk_id: '-',
      nome: '-',
      categoria: '-',
      moto: '-',
      ano: '-',
      valor: 0,
      estoque: 0,
      imagem: '',
      ml_link: '',
      descricao: '',
      criado_em: page.created_time
    };

    // Para cada propriedade, tenta extrair o valor
    for (const [key, prop] of Object.entries(props)) {
      const value = prop as any;
      const lowerKey = key.toLowerCase();
      
      console.log(`  🔑 Propriedade: "${key}" (tipo: ${value.type})`);
      
      try {
        // TÍTULO (nome da peça)
        if (value.type === 'title' && value.title?.[0]?.plain_text) {
          result.nome = value.title[0].plain_text;
          console.log(`    → NOME encontrado: "${result.nome}"`);
        }
        
        // NÚMERO (valor, estoque, ano)
        else if (value.type === 'number') {
          if (lowerKey.includes('valor') || lowerKey.includes('preço') || lowerKey.includes('preco')) {
            result.valor = value.number || 0;
            console.log(`    → VALOR encontrado: ${result.valor}`);
          } else if (lowerKey.includes('estoque') || lowerKey.includes('quant')) {
            result.estoque = value.number || 0;
            console.log(`    → ESTOQUE encontrado: ${result.estoque}`);
          } else if (lowerKey.includes('ano')) {
            result.ano = value.number;
          }
        }
        
        // FORMULA (valor, estoque)
        else if (value.type === 'formula') {
          const formulaValue = value.formula?.number || value.formula?.string || 0;
          if (lowerKey.includes('valor') || lowerKey.includes('preço') || lowerKey.includes('preco')) {
            result.valor = Number(formulaValue) || 0;
            console.log(`    → VALOR (fórmula) encontrado: ${result.valor}`);
          } else if (lowerKey.includes('estoque') || lowerKey.includes('quant')) {
            result.estoque = Number(formulaValue) || 0;
            console.log(`    → ESTOQUE (fórmula) encontrado: ${result.estoque}`);
          }
        }
        
        // FALLBACK PARA VALOR/ESTOQUE EM TEXTO
        else if (value.type === 'rich_text' && value.rich_text?.[0]?.plain_text) {
          const text = value.rich_text[0].plain_text;
          if (lowerKey.includes('desc') || lowerKey.includes('obs')) {
            result.descricao = text;
          } else if (lowerKey.includes('ano')) {
            result.ano = text;
          } else if ((lowerKey.includes('valor') || lowerKey.includes('preço') || lowerKey.includes('preco')) && result.valor === 0) {
            // Tenta extrair número de texto (ex: "R$ 1.200,00" -> 1200)
            const cleaned = text.replace(/[^\d,.-]/g, '').replace(',', '.');
            result.valor = parseFloat(cleaned) || 0;
            if (result.valor > 0) console.log(`    → VALOR (texto) extraído: ${result.valor}`);
          } else if ((lowerKey.includes('estoque') || lowerKey.includes('quant')) && result.estoque === 0) {
            result.estoque = parseInt(text.replace(/[^\d]/g, '')) || 0;
            if (result.estoque > 0) console.log(`    → ESTOQUE (texto) extraído: ${result.estoque}`);
          }
        }
        
        // SELECT (moto)
        else if (value.type === 'select' && value.select?.name) {
          if (lowerKey.includes('moto')) {
            result.moto = value.select.name;
            console.log(`    → MOTO encontrada: "${result.moto}"`);
          }
        }
        
        // MULTI-SELECT (categoria)
        else if (value.type === 'multi_select' && value.multi_select?.length > 0) {
          if (lowerKey.includes('categoria') || lowerKey.includes('cat')) {
            result.categoria = value.multi_select.map((s: any) => s.name).join(', ');
            console.log(`    → CATEGORIA encontrada: "${result.categoria}"`);
          }
        }
        
        // UNIQUE ID (código RK)
        else if (value.type === 'unique_id' && value.unique_id) {
          const prefix = value.unique_id.prefix ? `${value.unique_id.prefix}-` : '';
          result.rk_id = `${prefix}${value.unique_id.number}`;
          console.log(`    → RK_ID encontrado: "${result.rk_id}"`);
        }
        
        // FILES (imagem)
        else if (value.type === 'files' && value.files?.[0]) {
          const file = value.files[0];
          result.imagem = file.file?.url || file.external?.url || '';
          console.log(`    → IMAGEM encontrada`);
        }
        
        // URL (link do ML)
        else if (value.type === 'url' && value.url) {
          if (lowerKey.includes('ml') || lowerKey.includes('link') || lowerKey.includes('mercadolivre')) {
            result.ml_link = value.url;
            console.log(`    → ML_LINK encontrado`);
          }
        }
        
      } catch (e) {
        console.error(`    ❌ Erro ao processar ${key}:`, e);
      }
    }
    
    // Se não encontrou nome em lugar nenhum, tenta qualquer propriedade title
    if (result.nome === '-') {
      for (const [key, prop] of Object.entries(props)) {
        const value = prop as any;
        if (value.type === 'title' && value.title?.[0]?.plain_text) {
          result.nome = value.title[0].plain_text;
          console.log(`    → NOME (fallback) encontrado em "${key}": "${result.nome}"`);
          break;
        }
      }
    }
    
    return result;
  }
  
  function formatMotosItem(page: any) {
    const props = page.properties;
    console.log(`\n🏍️ Formatando Moto: ${page.id}`);
    
    // Encontrar o campo de título dinamicamente
    const titleProp = Object.values(props).find((p: any) => p.type === 'title') as any;
    const nome = titleProp?.title?.[0]?.plain_text || '-';

    const result: any = {
      id: page.id,
      nome: nome,
      marca: '-',
      modelo: '-',
      ano: '-',
      rk_id: '-', 
      cilindrada: '-',
      lote: '-',
      nome_nf: '-',
      pecas_retiradas: '-',
      status: '-',
      valor: 0,
      cor: '-',
      descricao: '',
      imagem: '',
      imagens: [],
      criado_em: page.created_time
    };

    for (const [key, prop] of Object.entries(props)) {
      const value = prop as any;
      const lowerKey = key.toLowerCase();
      
      // Rich Text
      if (value.type === 'rich_text') {
        const text = value.rich_text?.[0]?.plain_text || '-';
        if (lowerKey === 'marca') result.marca = text;
        else if (lowerKey === 'modelo') result.modelo = text;
        else if (lowerKey === 'cor') result.cor = text;
        else if (lowerKey === 'observações' || lowerKey === 'observacoes' || lowerKey === 'descrição') result.descricao = text;
        else if (lowerKey === 'nome nf') result.nome_nf = text;
        else if (lowerKey === 'peças retiradas' || lowerKey === 'pecas retiradas') result.pecas_retiradas = text;
      }
      // Number
      else if (value.type === 'number') {
        if (lowerKey === 'valor') result.valor = value.number || 0;
        else if (lowerKey === 'cilindrada') result.cilindrada = value.number || 0;
        else if (lowerKey === 'ano') result.ano = value.number?.toString() || '-';
      }
      // Select
      else if (value.type === 'select' && value.select) {
        if (lowerKey === 'lote') result.lote = value.select.name;
      }
      // Status
      else if (value.type === 'status' && value.status) {
        if (lowerKey === 'status') result.status = value.status.name;
      }
      // Files (Fotos)
      else if (value.type === 'files') {
        const urls = value.files.map((file: any) => file.file?.url || file.external?.url || '').filter(Boolean);
        if (urls.length > 0) {
          result.imagens = urls;
          if (!result.imagem) result.imagem = urls[0];
        }
      }
      // Unique ID (ID)
      else if (value.type === 'unique_id' && value.unique_id) {
        if (lowerKey === 'id') {
          result.rk_id = `${value.unique_id.prefix ? value.unique_id.prefix + '-' : ''}${value.unique_id.number}`;
        }
      }
    }
    
    // Fallback: se o nome for '-' mas o modelo existir, usa o modelo
    if (result.nome === '-' && result.modelo !== '-') {
      result.nome = result.modelo;
    }
    
    return result;
  }

  function formatSalesItem(page: any) {
    const props = page.properties;
    const result: any = {
      id: page.id,
      nome: '-',
      moto: '-',
      valor: 0,
      data: page.created_time,
      numero_id: '-'
    };

    // Primeiro, tenta encontrar a propriedade de título (obrigatória no Notion)
    const titlePropName = Object.keys(props).find(key => props[key].type === 'title');
    if (titlePropName && props[titlePropName].title?.[0]?.plain_text) {
      result.nome = props[titlePropName].title[0].plain_text;
    }

    for (const [key, prop] of Object.entries(props)) {
      const value = prop as any;
      const lowerKey = key.toLowerCase();
      
      // Se já temos um nome do título, só sobrescrevemos se encontrarmos uma propriedade chamada "Nome" ou "Peça" que seja rich_text
      if (value.type === 'rich_text' && value.rich_text?.[0]?.plain_text) {
        const text = value.rich_text[0].plain_text;
        if (lowerKey.includes('moto')) {
          result.moto = text;
        } else if ((lowerKey.includes('nome') || lowerKey.includes('peça')) && !lowerKey.includes('obs')) {
          result.nome = text;
        }
      }
      
      // Número (valor)
      else if (value.type === 'number' && 
              (lowerKey.includes('valor') || lowerKey.includes('preço'))) {
        result.valor = value.number || 0;
      }
      
      // Fórmula (valor)
      else if (value.type === 'formula' && 
              (lowerKey.includes('valor') || lowerKey.includes('preço'))) {
        result.valor = Number(value.formula?.number || value.formula?.string || 0) || 0;
      }
      
      // Date
      else if (value.type === 'date' && value.date?.start) {
        result.data = value.date.start;
      }
      
      // Unique ID (se houver)
      else if (value.type === 'unique_id' && value.unique_id) {
        const prefix = value.unique_id.prefix ? `${value.unique_id.prefix}-` : '';
        result.numero_id = `${prefix}${value.unique_id.number}`;
      }
      
      // Select (Tipo de Pagamento ou Moto)
      else if (value.type === 'select' && value.select) {
        if (lowerKey.includes('tipo') || lowerKey.includes('pagamento') || lowerKey.includes('forma')) {
          result.tipo = value.select.name;
        } else if (lowerKey.includes('moto')) {
          result.moto = value.select.name;
        }
      }
    }
    
    return result;
  }

  // --- ROTAS DE CLIENTES ---
  app.get('/api/clients', async (req, res) => {
    try {
      const results = await fetchAllFromNotion(CLIENTS_DATABASE_ID);
      if (results.length > 0) {
        console.log('📄 Exemplo de propriedades do cliente no Notion:', JSON.stringify(results[0].properties, null, 2));
      }
      const clients = results.map((page: any) => {
        const p = page.properties;
        return {
          id: page.id,
          nome: p.Nome?.title?.[0]?.plain_text || '',
          numero: p['Número']?.phone_number || '',
          cpf: p.CPF?.number?.toString() || '',
          senha: p.Senha?.rich_text?.[0]?.plain_text || '',
          itensComprados: p['Itens comprados']?.rich_text?.[0]?.plain_text || '',
          interesses: p['Interesses']?.multi_select?.map((m: any) => m.name) || [],
          userId: p.ID?.unique_id ? (p.ID.unique_id.prefix ? `${p.ID.unique_id.prefix}-${p.ID.unique_id.number}` : p.ID.unique_id.number.toString()) : ''
        };
      });
      res.json({ success: true, data: clients });
    } catch (error: any) {
      console.error('Erro ao buscar clientes:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/clients', async (req, res) => {
    try {
      const { nome, numero, cpf, itensComprados, senha, interesses } = req.body;
      console.log('📝 Criando novo cliente no Notion...', { nome, numero });
      
      const hashedPassword = senha ? await bcrypt.hash(senha, 10) : '';
      
      const response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_VERSION
        },
        body: JSON.stringify({
          parent: { database_id: CLIENTS_DATABASE_ID },
          properties: {
            Nome: { title: [{ text: { content: nome || '' } }] },
            'Número': { phone_number: numero || '' },
            'CPF': { number: cpf ? Number(String(cpf).replace(/\D/g, '')) : 0 },
            Senha: { rich_text: [{ text: { content: hashedPassword } }] },
            'Itens comprados': { rich_text: [{ text: { content: itensComprados || '' } }] },
            'Interesses': { multi_select: (interesses || []).map((name: string) => ({ name })) },
            Tipo: { select: { name: 'CLIENTE' } }
          }
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro ao criar cliente no Notion:', errorText);
        let errorMessage = 'Erro ao criar cliente no Notion';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = `Erro Notion: ${errorJson.message || errorText}`;
        } catch (e) {
          errorMessage = `Erro Notion: ${errorText}`;
        }
        throw new Error(errorMessage);
      }
      invalidateCache(CLIENTS_DATABASE_ID);
      console.log('✅ Cliente criado com sucesso no Notion.');
      res.json({ success: true });
    } catch (error: any) {
      console.error('❌ Erro na rota POST /api/clients:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.put('/api/clients/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { nome, numero, cpf, itensComprados, senha, interesses } = req.body;
      console.log(`📝 Atualizando cliente ${id} no Notion...`);
      
      const properties: any = {
        Nome: { title: [{ text: { content: nome || '' } }] },
        'Número': { phone_number: numero || '' },
        'CPF': { number: cpf ? Number(String(cpf).replace(/\D/g, '')) : 0 },
        'Itens comprados': { rich_text: [{ text: { content: itensComprados || '' } }] },
        'Interesses': { multi_select: (interesses || []).map((name: string) => ({ name })) }
      };

      if (senha) {
        // Se a senha não começar com $2b$ (não for hash), fazemos o hash
        const hashedPassword = senha.startsWith('$2b$') ? senha : await bcrypt.hash(senha, 10);
        properties.Senha = { rich_text: [{ text: { content: hashedPassword } }] };
      }

      const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_VERSION
        },
        body: JSON.stringify({ properties })
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Erro ao atualizar cliente no Notion:', errorData);
        throw new Error(`Erro no Notion: ${errorData.message || 'Erro desconhecido'}`);
      }
      invalidateCache(CLIENTS_DATABASE_ID);
      console.log(`✅ Cliente ${id} atualizado com sucesso.`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('❌ Erro na rota PUT /api/clients/:id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/clients/:id', async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`🗑️ Deletando cliente ${id} no Notion...`);
      const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_VERSION
        },
        body: JSON.stringify({ archived: true })
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Erro ao deletar cliente no Notion:', errorData);
        throw new Error(`Erro no Notion: ${errorData.message || 'Erro desconhecido'}`);
      }
      invalidateCache(CLIENTS_DATABASE_ID);
      console.log(`✅ Cliente ${id} deletado com sucesso.`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('❌ Erro na rota DELETE /api/clients/:id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route for Notion Inventory
  app.get("/api/inventory", async (req, res) => {
    console.log("🔍 Acessando /api/inventory");
    try {
      const force = req.query.force === 'true';
      if (force) invalidateCache(DATABASE_ID);
      const allItems = await fetchAllFromNotion(DATABASE_ID);
      const formattedData = allItems.map(formatInventoryItem);
      res.json({ success: true, data: formattedData, total: allItems.length });
    } catch (error: any) {
      console.error("Notion API Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Buscar categorias do Notion
  app.get("/api/notion/categories", async (req, res) => {
    try {
      const dbData = await getCachedDbStructure(DATABASE_ID);
      const dbProps = dbData.properties;
      
      // Encontrar a propriedade de categoria
      let catProp = Object.entries(dbProps).find(([key, prop]: [string, any]) => 
        key.toLowerCase().includes('categoria') || key.toLowerCase().includes('cat')
      );
      
      if (catProp && (catProp[1] as any).type === 'multi_select') {
        const options = (catProp[1] as any).multi_select.options.map((opt: any) => opt.name);
        res.json({ success: true, data: options.sort() });
      } else {
        res.json({ success: true, data: [] });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Buscar motos do Notion
  app.get("/api/notion/motos", async (req, res) => {
    try {
      const allMotos = await fetchAllFromNotion(MOTOS_DATABASE_ID);
      const formattedMotos = allMotos.map(formatMotosItem);
      const motoNames = Array.from(new Set(formattedMotos.map((m: any) => m.nome))).filter(Boolean);
      res.json({ success: true, data: motoNames.sort() });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/inventory", async (req, res) => {
    try {
      const { nome, categoria, moto, valor, estoque, ano, descricao, ml_link } = req.body;

      // Busca a estrutura do banco (usando cache)
      const dbData = await getCachedDbStructure(DATABASE_ID);
      const dbProps = dbData.properties;

      // Mapeia os campos para os nomes reais das propriedades
      let nameProp = "Peça";
      let catProp = "Categoria";
      let motoProp = "Moto";
      let valorProp = "Valor";
      let estoqueProp = "Estoque";
      let anoProp = "Ano";
      let descProp = "Descrição";
      let mlProp = "ML LINK";
      let imgProp = "Imagem";
 
      for (const [key, prop] of Object.entries(dbProps)) {
        const p = prop as any;
        const lowerKey = key.toLowerCase();
        
        if (p.type === 'title') nameProp = key;
        else if (lowerKey.includes('categoria') || lowerKey.includes('cat')) catProp = key;
        else if (lowerKey.includes('moto')) motoProp = key;
        else if (lowerKey.includes('valor') || lowerKey.includes('preço')) valorProp = key;
        else if (lowerKey.includes('estoque') || lowerKey.includes('quant')) estoqueProp = key;
        else if (lowerKey.includes('ano')) anoProp = key;
        else if (lowerKey.includes('desc') || lowerKey.includes('obs')) descProp = key;
        else if (lowerKey.includes('ml') || lowerKey.includes('link')) mlProp = key;
        else if (lowerKey.includes('img') || lowerKey.includes('foto')) imgProp = key;
      }

      const properties: any = {
        [nameProp]: {
          title: [{ text: { content: nome } }]
        }
      };

      if (catProp && dbProps[catProp] && dbProps[catProp].type === 'multi_select' && categoria) {
        properties[catProp] = { multi_select: [{ name: categoria }] };
      }

      if (motoProp && dbProps[motoProp] && dbProps[motoProp].type === 'select' && moto) {
        properties[motoProp] = { select: { name: moto } };
      }

      if (valorProp && dbProps[valorProp] && dbProps[valorProp].type === 'number') {
        properties[valorProp] = { number: Number(valor) };
      }

      if (estoqueProp && dbProps[estoqueProp] && dbProps[estoqueProp].type === 'number') {
        properties[estoqueProp] = { number: Number(estoque) };
      }

      if (anoProp && dbProps[anoProp]) {
        if (dbProps[anoProp].type === 'rich_text') {
          properties[anoProp] = { rich_text: [{ text: { content: ano || "" } }] };
        } else if (dbProps[anoProp].type === 'number') {
          properties[anoProp] = { number: Number(ano) };
        }
      }

      if (descProp && dbProps[descProp] && dbProps[descProp].type === 'rich_text') {
        properties[descProp] = { rich_text: [{ text: { content: descricao || "" } }] };
      }

      if (mlProp && dbProps[mlProp] && dbProps[mlProp].type === 'url') {
        properties[mlProp] = { url: ml_link || null };
      }

      if (imgProp && dbProps[imgProp] && dbProps[imgProp].type === 'files' && req.body.imagem) {
        const imagem = req.body.imagem;
        const isNotionUrl = imagem && (imagem.includes('s3.us-west-2.amazonaws.com') || imagem.includes('notion-static.com'));
        
        if (imagem && (imagem.startsWith('http://') || imagem.startsWith('https://')) && !isNotionUrl) {
          properties[imgProp] = { 
            files: [{ 
              name: 'Imagem', 
              type: 'external', 
              external: { url: imagem } 
            }] 
          };
        }
      }

      const response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_VERSION
        },
        body: JSON.stringify({
          parent: { database_id: DATABASE_ID },
          properties
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Notion API error: ${error}`);
      }

      const data = await response.json();
      invalidateCache(DATABASE_ID);
      res.json(formatInventoryItem(data));
    } catch (error: any) {
      console.error("Create Item Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/inventory/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { nome, categoria, moto, valor, estoque, ano, descricao, ml_link, imagem } = req.body;

      console.log(`📝 Editando item ${id}:`, { nome, categoria, moto, valor, estoque, ano, descricao, ml_link, imagem });

      // Busca a estrutura do banco (usando cache)
      const dbData = await getCachedDbStructure(DATABASE_ID);
      const dbProps = dbData.properties;

      // Mapeia os campos para os nomes reais das propriedades
      let nameProp = "Peça";
      let catProp = "Categoria";
      let motoProp = "Moto";
      let valorProp = "Valor";
      let estoqueProp = "Estoque";
      let anoProp = "Ano";
      let descProp = "Descrição";
      let mlProp = "ML LINK";
      let imgProp = "Imagem";

      for (const [key, prop] of Object.entries(dbProps)) {
        const p = prop as any;
        const lowerKey = key.toLowerCase();
        
        if (p.type === 'title') nameProp = key;
        else if (lowerKey.includes('categoria') || lowerKey.includes('cat')) catProp = key;
        else if (lowerKey.includes('moto')) motoProp = key;
        else if (lowerKey.includes('valor') || lowerKey.includes('preço')) valorProp = key;
        else if (lowerKey.includes('estoque') || lowerKey.includes('quant')) estoqueProp = key;
        else if (lowerKey.includes('ano')) anoProp = key;
        else if (lowerKey.includes('desc') || lowerKey.includes('obs')) descProp = key;
        else if (lowerKey.includes('ml') || lowerKey.includes('link')) mlProp = key;
        else if (lowerKey.includes('img') || lowerKey.includes('foto')) imgProp = key;
      }

      const properties: any = {};

      if (nome !== undefined) {
        properties[nameProp] = { title: [{ text: { content: nome } }] };
      }

      if (catProp && dbProps[catProp] && dbProps[catProp].type === 'multi_select' && categoria !== undefined) {
        properties[catProp] = { multi_select: categoria ? [{ name: categoria }] : [] };
      }

      if (motoProp && dbProps[motoProp] && dbProps[motoProp].type === 'select' && moto !== undefined) {
        properties[motoProp] = { select: moto ? { name: moto } : null };
      }

      if (valorProp && dbProps[valorProp] && dbProps[valorProp].type === 'number' && valor !== undefined) {
        properties[valorProp] = { number: Number(valor) };
      }

      if (estoqueProp && dbProps[estoqueProp] && dbProps[estoqueProp].type === 'number' && estoque !== undefined) {
        properties[estoqueProp] = { number: Number(estoque) };
      }

      if (anoProp && dbProps[anoProp] && ano !== undefined) {
        if (dbProps[anoProp].type === 'rich_text') {
          properties[anoProp] = { rich_text: [{ text: { content: String(ano) || "" } }] };
        } else if (dbProps[anoProp].type === 'number') {
          properties[anoProp] = { number: Number(ano) };
        }
      }

      if (descProp && dbProps[descProp] && dbProps[descProp].type === 'rich_text' && descricao !== undefined) {
        properties[descProp] = { rich_text: [{ text: { content: descricao || "" } }] };
      }

      if (mlProp && dbProps[mlProp] && dbProps[mlProp].type === 'url' && ml_link !== undefined) {
        properties[mlProp] = { url: ml_link || null };
      }

      if (imgProp && dbProps[imgProp] && dbProps[imgProp].type === 'files' && imagem !== undefined) {
        const isNotionUrl = imagem && (imagem.includes('s3.us-west-2.amazonaws.com') || imagem.includes('notion-static.com'));

        if (imagem && (imagem.startsWith('http://') || imagem.startsWith('https://')) && !isNotionUrl) {
          properties[imgProp] = { 
            files: [{ 
              name: 'Imagem', 
              type: 'external', 
              external: { url: imagem } 
            }] 
          };
        } else if (!imagem) {
          properties[imgProp] = { files: [] };
        }
        // Se for uma URL do Notion, ignoramos para evitar erro de validação (presumindo que não mudou)
      }

      const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_VERSION
        },
        body: JSON.stringify({ properties })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Notion API error: ${error}`);
      }

      const updatedPage = await response.json();
      invalidateCache(DATABASE_ID);
      res.json(formatInventoryItem(updatedPage));
    } catch (error: any) {
      console.error("Update Item Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/inventory/bulk-delete", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ success: false, error: "IDs inválidos" });
      }

      console.log(`🗑️ Excluindo em massa ${ids.length} itens`);

      // Notion doesn't have a bulk delete, we must do it in parallel
      const deletePromises = ids.map(id => 
        fetch(`https://api.notion.com/v1/pages/${id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Content-Type': 'application/json',
            'Notion-Version': NOTION_VERSION
          },
          body: JSON.stringify({ archived: true })
        })
      );

      const results = await Promise.all(deletePromises);
      const failed = results.filter(r => !r.ok);

      if (failed.length > 0) {
        console.error(`❌ Falha ao excluir ${failed.length} itens`);
      }

      invalidateCache(DATABASE_ID);
      res.json({ success: true, deletedCount: ids.length - failed.length, failedCount: failed.length });
    } catch (error: any) {
      console.error("Bulk Delete Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/inventory/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_VERSION
        },
        body: JSON.stringify({ archived: true })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Notion API error: ${error}`);
      }

      invalidateCache(DATABASE_ID);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete Item Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/inventory/bulk-update-stock", async (req, res) => {
    try {
      const { ids, amount } = req.body;
      console.log(`📦 Atualizando estoque em massa: ${amount} para ${ids.length} itens`);

      // We need to get current stock first for each item if we want to increment/decrement
      // But Notion doesn't support relative updates easily in bulk.
      // For simplicity, let's fetch them first or assume the client sends the new value.
      // Since the client sends "amount" (+1 or -1), we MUST fetch first.
      
      const updatePromises = ids.map(async (id: string) => {
        // Fetch current
        const getRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': NOTION_VERSION
          }
        });
        if (!getRes.ok) return;
        const page = await getRes.json();
        
        // Find stock property name
        let stockPropName = "Estoque";
        for (const key of Object.keys(page.properties)) {
          if (key.toLowerCase().includes('estoque') || key.toLowerCase().includes('quant')) {
            stockPropName = key;
            break;
          }
        }

        const currentStock = page.properties[stockPropName]?.number || 0;
        const newStock = Math.max(0, currentStock + amount);

        return fetch(`https://api.notion.com/v1/pages/${id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Content-Type': 'application/json',
            'Notion-Version': NOTION_VERSION
          },
          body: JSON.stringify({
            properties: {
              [stockPropName]: { number: newStock }
            }
          })
        });
      });

      await Promise.all(updatePromises);
      invalidateCache(DATABASE_ID);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Bulk Update Stock Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/inventory/bulk-update-category", async (req, res) => {
    try {
      const { ids, categoria } = req.body;
      console.log(`🏷️ Atualizando categoria em massa: "${categoria}" para ${ids.length} itens`);

      const updatePromises = ids.map(async (id: string) => {
        // Find category property name
        const getRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': NOTION_VERSION
          }
        });
        if (!getRes.ok) return;
        const page = await getRes.json();
        
        let catPropName = "Categoria";
        for (const key of Object.keys(page.properties)) {
          if (key.toLowerCase().includes('categoria') || key.toLowerCase().includes('cat')) {
            catPropName = key;
            break;
          }
        }

        return fetch(`https://api.notion.com/v1/pages/${id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Content-Type': 'application/json',
            'Notion-Version': NOTION_VERSION
          },
          body: JSON.stringify({
            properties: {
              [catPropName]: { 
                multi_select: [{ name: categoria }] 
              }
            }
          })
        });
      });

      await Promise.all(updatePromises);
      invalidateCache(DATABASE_ID);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Bulk Update Category Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/sales", async (req, res) => {
    try {
      const { nome, moto, valor, tipo, data } = req.body;

      // Busca a estrutura do banco (usando cache)
      const dbData = await getCachedDbStructure(salesDbId);
      const dbProps = dbData.properties;

      // Mapeia os campos para os nomes reais das propriedades
      let nameProp = "";
      let motoProp = "";
      let valorProp = "";
      let tipoProp = "";
      let dataProp = "";
      let fallbackNameProp = ""; // Para caso o título não seja "Nome" ou "Peça"

      for (const [key, prop] of Object.entries(dbProps)) {
        const p = prop as any;
        const lowerKey = key.toLowerCase();
        
        if (p.type === 'title') {
          nameProp = key;
        } else if (lowerKey.includes('moto')) {
          motoProp = key;
        } else if (lowerKey.includes('valor') || lowerKey.includes('preço')) {
          valorProp = key;
        } else if (lowerKey.includes('tipo') || lowerKey.includes('pagamento') || lowerKey.includes('forma')) {
          tipoProp = key;
        } else if (lowerKey.includes('data')) {
          dataProp = key;
        } else if (p.type === 'rich_text' && (lowerKey.includes('nome') || lowerKey.includes('peça'))) {
          fallbackNameProp = key;
        }
      }

      // Se não encontrou o título pelo tipo (o que é impossível no Notion, mas por segurança)
      if (!nameProp) {
        nameProp = Object.keys(dbProps).find(k => dbProps[k].type === 'title') || "Peça";
      }

      const properties: any = {
        [nameProp]: {
          title: [{ text: { content: nome || "-" } }]
        }
      };

      // Se existe uma propriedade de texto chamada "Nome" ou "Peça" que não é o título, preenche ela também
      if (fallbackNameProp && fallbackNameProp !== nameProp) {
        properties[fallbackNameProp] = { rich_text: [{ text: { content: nome || "-" } }] };
      }

      if (motoProp && dbProps[motoProp] && motoProp !== nameProp) {
        if (dbProps[motoProp].type === 'rich_text') {
          properties[motoProp] = { rich_text: [{ text: { content: moto || "" } }] };
        } else if (dbProps[motoProp].type === 'select' && moto) {
          properties[motoProp] = { select: { name: moto } };
        }
      }

      if (valorProp && dbProps[valorProp] && dbProps[valorProp].type === 'number') {
        properties[valorProp] = { number: Number(valor) };
      }

      if (tipoProp && dbProps[tipoProp] && dbProps[tipoProp].type === 'select') {
        properties[tipoProp] = { select: { name: tipo } };
      }

      if (dataProp && dbProps[dataProp] && dbProps[dataProp].type === 'date') {
        properties[dataProp] = { date: { start: data || new Date().toISOString() } };
      }

      const response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_VERSION
        },
        body: JSON.stringify({
          parent: { database_id: salesDbId },
          properties
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Notion API error: ${error}`);
      }

      const result = await response.json();
      invalidateCache(salesDbId);
      res.json({ success: true, data: formatSalesItem(result) });
    } catch (error: any) {
      console.error("Create Sale Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.patch("/api/sales/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { nome, moto, valor, tipo, data } = req.body;

      // Busca a estrutura do banco (usando cache)
      const dbData = await getCachedDbStructure(salesDbId);
      const dbProps = dbData.properties;

      // Mapeia os campos para os nomes reais das propriedades
      let nameProp = "";
      let motoProp = "";
      let valorProp = "";
      let tipoProp = "";
      let dataProp = "";
      let fallbackNameProp = "";

      for (const [key, prop] of Object.entries(dbProps)) {
        const p = prop as any;
        const lowerKey = key.toLowerCase();
        
        if (p.type === 'title') nameProp = key;
        else if (lowerKey.includes('moto')) motoProp = key;
        else if (lowerKey.includes('valor') || lowerKey.includes('preço')) valorProp = key;
        else if (lowerKey.includes('tipo') || lowerKey.includes('pagamento') || lowerKey.includes('forma')) tipoProp = key;
        else if (lowerKey.includes('data')) dataProp = key;
        else if (p.type === 'rich_text' && (lowerKey.includes('nome') || lowerKey.includes('peça'))) fallbackNameProp = key;
      }

      const properties: any = {};

      if (nameProp) {
        properties[nameProp] = { title: [{ text: { content: nome || "-" } }] };
      }

      if (fallbackNameProp && fallbackNameProp !== nameProp) {
        properties[fallbackNameProp] = { rich_text: [{ text: { content: nome || "-" } }] };
      }

      if (motoProp && dbProps[motoProp] && motoProp !== nameProp) {
        if (dbProps[motoProp].type === 'rich_text') {
          properties[motoProp] = { rich_text: [{ text: { content: moto || "" } }] };
        } else if (dbProps[motoProp].type === 'select' && moto) {
          properties[motoProp] = { select: { name: moto } };
        }
      }

      if (valorProp && dbProps[valorProp] && dbProps[valorProp].type === 'number') {
        properties[valorProp] = { number: Number(valor) };
      }

      if (tipoProp && dbProps[tipoProp] && dbProps[tipoProp].type === 'select') {
        properties[tipoProp] = { select: { name: tipo } };
      }

      if (dataProp && dbProps[dataProp] && dbProps[dataProp].type === 'date') {
        properties[dataProp] = { date: { start: data || new Date().toISOString() } };
      }

      const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_VERSION
        },
        body: JSON.stringify({ properties })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Notion API error: ${error}`);
      }

      const result = await response.json();
      invalidateCache(salesDbId);
      res.json({ success: true, data: formatSalesItem(result) });
    } catch (error: any) {
      console.error("Update Sale Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/sales/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_VERSION
        },
        body: JSON.stringify({ archived: true })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Notion API error: ${error}`);
      }

      const salesDbId = process.env.DATABASE_VENDAS_ID || "";
      invalidateCache(salesDbId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete Sale Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/sales/bulk-delete", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ success: false, error: "IDs inválidos" });
      }

      const deletePromises = ids.map(id => 
        fetch(`https://api.notion.com/v1/pages/${id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Content-Type': 'application/json',
            'Notion-Version': NOTION_VERSION
          },
          body: JSON.stringify({ archived: true })
        })
      );

      await Promise.all(deletePromises);
      const salesDbId = process.env.DATABASE_VENDAS_ID || process.env.NOTION_DB_VENDAS || "";
      invalidateCache(salesDbId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Bulk Delete Sales Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/sales", async (req, res) => {
    try {
      // Use o ID correto do banco de vendas
      const force = req.query.force === 'true';
      
      if (force) {
        invalidateCache(salesDbId);
      }
      
      console.log(`📊 Consultando banco de vendas: ${salesDbId}`);
      
      const allItems = await fetchAllFromNotion(salesDbId);
      const formattedData = allItems.map(formatSalesItem);
      
      console.log(`✅ Encontradas ${allItems.length} vendas`);
      
      res.json({ success: true, data: formattedData, total: allItems.length });
    } catch (error: any) {
      console.error("Sales API Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==================== IA ASSISTANTE ====================
  app.post("/api/ai/ask", async (req, res) => {
    try {
      const { pergunta } = req.body;
      console.log(`\n🤖 IA Assistant: "${pergunta}"`);
      
      const PORT = Number(process.env.PORT) || 3000;
      
      // Carrega dados do sistema
      const [inventoryRes, salesRes] = await Promise.all([
        fetch(`http://127.0.0.1:${PORT}/api/inventory`),
        fetch(`http://127.0.0.1:${PORT}/api/sales`)
      ]);
      
      const inventory = await inventoryRes.json();
      const sales = await salesRes.json();
      
      // Prepara contexto
      const contexto = {
        estoque: inventory.data || [],
        vendas: sales.data || [],
        totalItens: inventory.total || 0,
        totalVendas: sales.total || 0
      };
      
      // Chama Gemini para interpretar a intenção
      console.log('🔑 Verificando chave Gemini...');
      
      // Tenta pegar do config.json primeiro, depois do ambiente
      const apiKey = config.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      
      console.log('🔑 Chave presente:', !!apiKey);
      console.log('🔑 Primeiros caracteres:', apiKey?.substring(0, 4));

      let iaResponse: any = null;
      let useFallback = false;
      let fallbackReason = "";

      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        console.error('❌ GEMINI_API_KEY não configurada');
        useFallback = true;
        fallbackReason = "A chave da API do Gemini não está configurada no servidor.";
      } else {
        try {
          const { GoogleGenAI, Type } = await import("@google/genai");
          const ai = new GoogleGenAI({ apiKey });
          
          const prompt = `
            Você é o assistente do RK Sucatas. Responda em português de forma amigável.
            
            Contexto atual:
            - Estoque: ${contexto.totalItens} itens
            - Vendas: ${contexto.totalVendas} registros
            
            Pergunta: "${pergunta}"
            
            Identifique a intenção e retorne APENAS UM JSON com:
            {
              "intencao": "busca" | "relatorio" | "venda" | "outro",
              "termo": "termo de busca (se for busca)",
              "periodo": "hoje" | "ontem" | "semana" | "mes" | "personalizado" (se for relatorio),
              "dataInicio": "YYYY-MM-DD" (se periodo personalizado),
              "dataFim": "YYYY-MM-DD",
              "resposta": "mensagem amigável para o usuário"
            }
          `;
          
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  intencao: { type: Type.STRING },
                  termo: { type: Type.STRING },
                  periodo: { type: Type.STRING },
                  dataInicio: { type: Type.STRING },
                  dataFim: { type: Type.STRING },
                  resposta: { type: Type.STRING }
                },
                required: ["intencao", "resposta"]
              }
            }
          });
          
          const text = response.text;
          try {
            iaResponse = JSON.parse(text || '{}');
          } catch {
            iaResponse = { intencao: "outro", resposta: text };
          }
        } catch (error: any) {
          console.error("❌ Erro detalhado do Gemini:", error);
          useFallback = true;
          if (error.message?.includes("API key not valid") || error.message?.includes("API_KEY_INVALID") || error.status === 403) {
            fallbackReason = "A chave da API Gemini é inválida ou foi bloqueada. Acesse Google AI Studio, gere uma nova chave e atualize a variável de ambiente.";
          } else {
            fallbackReason = "Erro de conexão com a IA. Tente novamente mais tarde.";
          }
        }
      }

      if (useFallback || !iaResponse) {
        console.log("⚠️ Usando busca de fallback. Motivo:", fallbackReason);
        const termo = pergunta.toLowerCase().replace('tem ', '').replace('busca ', '').replace('procura ', '');
        iaResponse = {
          intencao: 'busca',
          termo: termo,
          resposta: `⚠️ **Aviso: ${fallbackReason}**\n\nUsando busca simplificada por palavras-chave:`
        };
      }
      
      // Executa ações baseado na intenção
      let dados: any = {};
      let respostaFormatada = iaResponse.resposta || "";
      
      if (iaResponse.intencao === 'busca' && iaResponse.termo) {
        const termo = iaResponse.termo.toLowerCase();
        const itensEncontrados = contexto.estoque.filter((item: any) => 
          item.nome?.toLowerCase().includes(termo) ||
          item.moto?.toLowerCase().includes(termo) ||
          item.rk_id?.toLowerCase().includes(termo)
        ).slice(0, 5);
        
        dados = { itens: itensEncontrados };
        
        // Se não encontrou, prepara sugestões
        if (itensEncontrados.length === 0) {
          const sugestoes = contexto.estoque
            .filter((item: any) => 
              item.categoria?.toLowerCase().includes(termo) ||
              item.nome?.toLowerCase().split(' ').some((p: string) => termo.includes(p))
            )
            .slice(0, 3)
            .map((item: any) => `${item.nome} (${item.rk_id}) - R$ ${item.valor}`);
          
          dados.sugestoes = sugestoes;
        }
      }
      
      else if (iaResponse.intencao === 'relatorio') {
        const hoje = new Date();
        let dataInicio: Date;
        let dataFim: Date = new Date(hoje);
        
        switch (iaResponse.periodo) {
          case 'hoje':
            dataInicio = new Date(hoje.setHours(0,0,0,0));
            dataFim = new Date(hoje.setHours(23,59,59,999));
            break;
          case 'ontem':
            const ontem = new Date(hoje);
            ontem.setDate(ontem.getDate() - 1);
            dataInicio = new Date(ontem.setHours(0,0,0,0));
            dataFim = new Date(ontem.setHours(23,59,59,999));
            break;
          case 'semana':
            dataInicio = new Date(hoje);
            dataInicio.setDate(hoje.getDate() - 7);
            dataInicio.setHours(0,0,0,0);
            dataFim = new Date(hoje.setHours(23,59,59,999));
            break;
          case 'mes':
            dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23,59,59,999);
            break;
          default:
            dataInicio = new Date(hoje.setHours(0,0,0,0));
            dataFim = new Date(hoje.setHours(23,59,59,999));
        }
        
        const parseDate = (dateStr: string) => {
          if (!dateStr) return new Date(0);
          if (dateStr.includes('T')) {
            return new Date(dateStr); // ISO string with time, parse normally
          } else {
            // Date-only string (YYYY-MM-DD), parse as local time at noon
            const [year, month, day] = dateStr.split('-').map(Number);
            return new Date(year, month - 1, day, 12, 0, 0);
          }
        };

        const vendasPeriodo = contexto.vendas.filter((v: any) => {
          const dataVenda = parseDate(v.data);
          return dataVenda >= dataInicio && dataVenda <= dataFim && v.tipo !== 'SAÍDA';
        });
        
        const saidasPeriodo = contexto.vendas.filter((v: any) => {
          const dataVenda = parseDate(v.data);
          return dataVenda >= dataInicio && dataVenda <= dataFim && v.tipo === 'SAÍDA';
        });
        
        dados = {
          periodo: iaResponse.periodo || 'hoje',
          totalVendas: vendasPeriodo.reduce((sum: number, v: any) => sum + (v.valor || 0), 0),
          quantidadeVendas: vendasPeriodo.length,
          totalSaidas: saidasPeriodo.reduce((sum: number, v: any) => sum + (v.valor || 0), 0),
          quantidadeSaidas: saidasPeriodo.length
        };
      }
      
      res.json({
        success: true,
        intencao: iaResponse.intencao,
        dados: dados,
        resposta: respostaFormatada
      });
      
    } catch (error: any) {
      console.error('❌ Erro no assistente:', error);
      res.status(500).json({ 
        success: false, 
        resposta: "Desculpe, tive um problema ao processar sua pergunta."
      });
    }
  });

  app.get("/api/motos", async (req, res) => {
    try {
      const force = req.query.force === 'true';
      if (force) invalidateCache(MOTOS_DATABASE_ID);
      console.log(`🏍️ Consultando banco de motos: ${MOTOS_DATABASE_ID}`);
      const allItems = await fetchAllFromNotion(MOTOS_DATABASE_ID);
      const formattedData = allItems.map(formatMotosItem);
      res.json({ success: true, data: formattedData, total: allItems.length });
    } catch (error: any) {
      console.error("Motos API Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/motos", async (req, res) => {
    try {
      const data = req.body;
      console.log('📝 Criando nova moto:', data);
      
      const dbData = await getCachedDbStructure(MOTOS_DATABASE_ID);
      const dbProps = dbData.properties;

      const properties: any = {};
      
      // Mapeamento explícito baseado na estrutura do Notion fornecida pelo usuário
      const mapping: Record<string, string> = {
        'nome': 'Nome',
        'cilindrada': 'Cilindrada',
        'ano': 'Ano',
        'lote': 'Lote',
        'imagens': 'Fotos',
        'descricao': 'Observações',
        'nome_nf': 'Nome NF',
        'pecas_retiradas': 'Peças Retiradas',
        'valor': 'Valor',
        'marca': 'Marca',
        'status': 'Status',
        'cor': 'Cor',
        'modelo': 'Modelo'
      };

      for (const [field, value] of Object.entries(data)) {
        if (value === undefined || value === null) continue;
        
        const mappedName = mapping[field];
        if (!mappedName) continue;
        
        // Busca insensível a maiúsculas/minúsculas no dbProps
        const notionPropName = Object.keys(dbProps).find(k => k.toLowerCase() === mappedName.toLowerCase());
        if (!notionPropName) {
          console.log(`⚠️ Propriedade "${mappedName}" não encontrada no Notion`);
          continue;
        }
        
        const propType = dbProps[notionPropName].type;
        
        if (propType === 'title') {
          properties[notionPropName] = {
            title: [{ text: { content: String(value || '-') } }]
          };
        } else if (propType === 'rich_text') {
          properties[notionPropName] = {
            rich_text: [{ text: { content: String(value || '') } }]
          };
        } else if (propType === 'number') {
          properties[notionPropName] = {
            number: Number(value) || 0
          };
        } else if (propType === 'select') {
          if (value) properties[notionPropName] = { select: { name: String(value) } };
        } else if (propType === 'status') {
          if (value) properties[notionPropName] = { status: { name: String(value) } };
        } else if (propType === 'files' && Array.isArray(value)) {
          // Filtramos URLs que venham do s3 da amazon ou do notion-static
          const externalUrls = value.filter((url: string) => {
            if (!url || typeof url !== 'string') return false;
            return !url.includes('notion-static.com') && !url.includes('amazonaws.com');
          });

          if (externalUrls.length > 0) {
            properties[notionPropName] = {
              files: externalUrls.map((url: string) => ({
                name: `foto_${Date.now()}.jpg`,
                type: 'external',
                external: { url }
              }))
            };
          }
        }
      }

      console.log("📤 Enviando para o Notion (POST):", JSON.stringify(properties, null, 2));

      const response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_VERSION
        },
        body: JSON.stringify({
          parent: { database_id: MOTOS_DATABASE_ID },
          properties
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ Erro Notion (POST):', error);
        throw new Error(`Notion API error: ${error}`);
      }

      const result = await response.json();
      console.log('✅ Moto criada com sucesso');
      
      invalidateCache(MOTOS_DATABASE_ID);
      
      res.json({ success: true, data: formatMotosItem(result) });
    } catch (error: any) {
      console.error("Create Moto Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.patch("/api/motos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      console.log('📝 Recebida requisição PATCH para moto:', id);
      console.log('📦 Dados recebidos para atualização:', JSON.stringify(req.body, null, 2));
      console.log('📸 Campo imagens:', req.body.imagens);
      
      // Buscar estrutura do banco
      const dbData = await getCachedDbStructure(MOTOS_DATABASE_ID);
      const dbProps = dbData.properties;
      
      // Construir properties no formato do Notion
      const properties: any = {};
      
      // Mapear campos
      const fieldMapping: Record<string, string> = {
        nome: 'Nome',
        marca: 'Marca',
        modelo: 'Modelo',
        ano: 'Ano',
        valor: 'Valor',
        cor: 'Cor',
        cilindrada: 'Cilindrada',
        lote: 'Lote',
        nome_nf: 'Nome NF',
        pecas_retiradas: 'Peças Retiradas',
        status: 'Status',
        descricao: 'Observações', // Ajustado para bater com o banco real
        imagens: 'Fotos'
      };
      
      for (const [field, value] of Object.entries(updateData)) {
        if (value === undefined || value === null) continue;
        
        const propName = fieldMapping[field];
        if (!propName) continue;

        // Busca insensível a maiúsculas/minúsculas no dbProps
        let notionPropName = Object.keys(dbProps).find(k => k.toLowerCase() === propName.toLowerCase());
        
        // Fallback especial para imagens
        if (!notionPropName && field === 'imagens') {
          notionPropName = Object.keys(dbProps).find(k => 
            k.toLowerCase() === 'imagem' || 
            dbProps[k].type === 'files'
          );
        }

        if (!notionPropName) {
          console.log(`⚠️ Propriedade "${propName}" não encontrada no Notion`);
          continue;
        }
        
        const propType = dbProps[notionPropName].type;
        
        if (propType === 'title') {
          properties[notionPropName] = {
            title: [{ text: { content: String(value) } }]
          };
        } else if (propType === 'rich_text') {
          properties[notionPropName] = {
            rich_text: [{ text: { content: String(value) } }]
          };
        } else if (propType === 'number') {
          properties[notionPropName] = {
            number: Number(value)
          };
        } else if (propType === 'select') {
          properties[notionPropName] = {
            select: { name: String(value) }
          };
        } else if (propType === 'status') {
          properties[notionPropName] = {
            status: { name: String(value) }
          };
        } else if (propType === 'files' && Array.isArray(value)) {
          // FILTRO CRÍTICO: O Notion não aceita suas próprias URLs temporárias como 'external'
          // Filtramos URLs que venham do s3 da amazon ou do notion-static
          const externalUrls = value.filter((url: string) => {
            if (!url || typeof url !== 'string') return false;
            const isNotionUrl = url.includes('notion-static.com') || url.includes('amazonaws.com') || url.includes('secure.notion-static.com');
            return !isNotionUrl;
          });

          if (externalUrls.length > 0) {
            properties[notionPropName] = {
              files: externalUrls.map((url: string) => ({
                name: `foto_${Date.now()}.jpg`,
                type: 'external',
                external: { url }
              }))
            };
          }
        }
      }
      
      console.log('📤 Enviando para Notion:', JSON.stringify(properties, null, 2));
      
      const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_VERSION
        },
        body: JSON.stringify({ properties })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro Notion:', response.status, errorText);
        throw new Error(`Notion error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Resposta do Notion:', result);
      
      invalidateCache(MOTOS_DATABASE_ID);
      
      res.json({ success: true, data: formatMotosItem(result) });
      
    } catch (error: any) {
      console.error("Update Moto Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/motos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_VERSION
        },
        body: JSON.stringify({ archived: true })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Notion API error: ${error}`);
      }

      invalidateCache(MOTOS_DATABASE_ID);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete Moto Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/motos/bulk-delete", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ success: false, error: "IDs inválidos" });
      }

      const deletePromises = ids.map(id => 
        fetch(`https://api.notion.com/v1/pages/${id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Content-Type': 'application/json',
            'Notion-Version': NOTION_VERSION
          },
          body: JSON.stringify({ archived: true })
        })
      );

      await Promise.all(deletePromises);
      invalidateCache(MOTOS_DATABASE_ID);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Bulk Delete Motos Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==================== WHATSAPP INTEGRATION (VERSÃO ULTRA ESTÁVEL 2026) ====================
  const BAILEY_CONFIG = {
    connectTimeoutMs: 120000,           // mais tolerante
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,         // Baileys gerencia sozinho
    retryRequestDelayMs: 1000,
    markOnlineOnConnect: true,
    shouldSyncHistoryMessage: () => false,
    syncFullHistory: false,
    fireInitQueries: false,
    emitOwnEvents: false,
  };

  let whatsappMessages: any[] = [];
  let conversations: Map<string, any> = new Map();
  let contacts: Map<string, any> = new Map();
  let qrCodeData: string | null = null;
  let isWhatsAppConnected = false;
  let whatsappLogs: string[] = [];
  let isReconnecting = false;
  let reconnectAttempts = 0;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let currentSocket: any = null;
  let messageQueue: any[] = [];
  let isProcessingQueue = false;
  const profilePicCache = new Map<string, string>();

  function addLog(msg: string) {
    const log = `${new Date().toISOString()} [PID:${process.pid}] - ${msg}`;
    console.log(log);
    whatsappLogs.push(log);
    if (whatsappLogs.length > 100) whatsappLogs.shift();
  }

  function emitStatus() {
    io.emit('whatsapp-status', {
      connected: isWhatsAppConnected,
      isConnecting: isReconnecting,
      reconnectAttempts,
      qr: !!qrCodeData
    });
  }

  async function processMessageQueue() {
    if (isProcessingQueue || messageQueue.length === 0) return;
    isProcessingQueue = true;

    addLog(`📥 Processando fila (${messageQueue.length} pendentes)`);

    while (messageQueue.length > 0) {
      const msg = messageQueue[0];
      try {
        if (msg.type === 'send') {
          if (!currentSocket || !isWhatsAppConnected || currentSocket.ws.readyState !== 1) {
            addLog(`⚠️ Socket desconectado. Pausando envio.`);
            break;
          }

          addLog(`📤 Enviando mensagem enfileirada para ${msg.number}`);
          const sendPromise = currentSocket.sendMessage(msg.jid, msg.message);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout 30s')), 30000)
          );

          await Promise.race([sendPromise, timeoutPromise]);
          addLog(`✅ Mensagem enviada`);

          // atualiza status na conversa
          if (conversations.has(msg.number)) {
            const conv = conversations.get(msg.number);
            const idx = conv.messages.findIndex((m: any) => m.id === msg.sentMessageId);
            if (idx !== -1) conv.messages[idx].status = 'sent';
            conversations.set(msg.number, conv);
            io.emit('whatsapp-conversations', Array.from(conversations.values()));
          }
        } else {
          await Promise.race([detectIntent(msg), new Promise((_, r) => setTimeout(() => r(new Error('Timeout intent')), 30000))]);
        }
        messageQueue.shift();
      } catch (error: any) {
        addLog(`❌ Erro na fila: ${error.message}`);
        const failed = messageQueue.shift();
        if (failed) {
          failed.retryCount = (failed.retryCount || 0) + 1;
          if (failed.retryCount < 3) messageQueue.push(failed);
          else addLog(`⚠️ Mensagem descartada após 3 tentativas`);
        }
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    isProcessingQueue = false;
  }

  function scheduleReconnect(delayMs: number) {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    addLog(`⏳ Agendando reconexão em ${delayMs}ms (tentativa ${reconnectAttempts})`);
    reconnectTimer = setTimeout(() => {
      isReconnecting = false;
      connectToWhatsApp();
    }, delayMs);
  }

  async function connectToWhatsApp() {
    if (isReconnecting) return;
    isReconnecting = true;

    // === LIMPEZA TOTAL DO SOCKET ANTERIOR ===
    if (currentSocket) {
      try {
        currentSocket.ev.removeAllListeners();
        currentSocket.end(undefined);
      } catch {}
      currentSocket = null;
    }
    await new Promise(r => setTimeout(r, 800)); // dá tempo real de fechar

    try {
      const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = await import("@whiskeysockets/baileys");
      const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
      const { version } = await fetchLatestBaileysVersion();

      const pino = (await import('pino')).default;
      const logger = pino({ level: 'warn' }, {
        write: (data: string) => {
          try {
            const log = JSON.parse(data);
            if (log.level >= 40) addLog(`[Baileys] ${log.msg}`);
          } catch {
            addLog(`[Baileys] ${data.trim()}`);
          }
        }
      });

      const sock = makeWASocket({
        ...BAILEY_CONFIG,
        version,
        auth: state,
        logger,
        printQRInTerminal: false,
        // === UA REALISTA (principal causa de estabilidade) ===
        browser: ['Ubuntu', 'Chrome', '130.0.0'],
      });

      currentSocket = sock;
      (app as any).whatsappSock = sock;

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !state.creds?.registered) {
          qrCodeData = await QRCode.toDataURL(qr);
          io.emit('whatsapp-qr', qrCodeData);
          emitStatus();
        }

        if (connection === 'open') {
          isWhatsAppConnected = true;
          reconnectAttempts = 0;
          isReconnecting = false;
          qrCodeData = null;
          addLog('✅ WhatsApp CONECTADO e ESTÁVEL!');
          processMessageQueue();
          emitStatus();
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode ??
                             (lastDisconnect?.error as any)?.statusCode;

          if (statusCode === DisconnectReason.loggedOut) {
            isWhatsAppConnected = false;
            addLog('🚪 Logout detectado. Limpando sessão...');
            const authPath = path.join(process.cwd(), 'baileys_auth_info');
            if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
            qrCodeData = null;
            emitStatus();
          } else {
            isWhatsAppConnected = false;
            reconnectAttempts++;
            
            let delay = Math.min(3000 * reconnectAttempts, 60000); // backoff inteligente
            if (statusCode === 440) delay = 45000;
            if (statusCode === 515) delay = 15000;
            if (statusCode === 409) delay = 8000;

            addLog(`🔄 Conexão fechada (${statusCode}). Reconectando em ${delay}ms...`);
            scheduleReconnect(delay);
          }
        }
      });

      // === MENSAGENS (mantido exatamente como você gostava) ===
      sock.ev.on('messages.upsert', async (m) => {
        if (m.type === 'notify') {
          for (const msg of m.messages) {
            // Apenas mensagens recebidas (não enviadas por mim) e que tenham conteúdo de texto
            if (!msg.key.fromMe && msg.message) {
              const remoteJid = msg.key.remoteJid || '';
              const from = remoteJid.split('@')[0] || '';
              
              // BLACKLIST: Não exibir mensagens desse número
              if (from === '558382039490') {
                continue;
              }

              const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
              
              // Buscar informações do contato
              let contactName = msg.pushName || from;
              const cachedContact = contacts.get(remoteJid);
              if (cachedContact) {
                contactName = cachedContact.name || cachedContact.verifiedName || cachedContact.notify || contactName;
              }

              let profilePic = profilePicCache.get(remoteJid) || null;
              
              // Buscar foto de perfil em background se não estiver no cache
              if (!profilePic && isWhatsAppConnected) {
                try {
                  profilePic = await sock.profilePictureUrl(remoteJid, 'image').catch(() => null);
                  if (profilePic) profilePicCache.set(remoteJid, profilePic);
                } catch (e) {}
              }

              // Evitar duplicatas (Baileys às vezes re-envia mensagens recentes)
              if (whatsappMessages.some(m => m.id === msg.key.id)) continue;

              const newMessage = {
                id: msg.key.id,
                key: msg.key, // Guardar a chave para deletar depois
                remoteJid,
                from,
                number: from, // Adicionar o número explicitamente
                name: contactName,
                body,
                profilePic: profilePic || '',
                timestamp: new Date(),
                status: 'unread',
                processed: false
              };

              whatsappMessages.push(newMessage);

              // ATUALIZAR OU CRIAR CONVERSA NO MAPA
              if (!conversations.has(from)) {
                conversations.set(from, {
                  number: from,
                  remoteJid: remoteJid, // Guardar o JID real para envio
                  name: contactName,
                  profilePic: profilePic || '',
                  lastMessage: body,
                  lastTimestamp: new Date(),
                  unreadCount: 1,
                  messages: [newMessage],
                  status: 'online'
                });
              } else {
                const conv = conversations.get(from);
                conv.remoteJid = remoteJid; // Atualizar JID por segurança
                conv.name = contactName; // Atualizar nome se mudou
                conv.profilePic = profilePic || conv.profilePic;
                conv.lastMessage = body;
                conv.lastTimestamp = new Date();
                conv.unreadCount = (conv.unreadCount || 0) + 1;
                conv.messages.push(newMessage);
                conversations.set(from, conv);
              }

              io.emit('whatsapp-conversations', Array.from(conversations.values()).filter(c => c.number !== '558382039490'));
              io.emit('whatsapp-notification', { count: whatsappMessages.filter(m => m.status === 'unread' && m.from !== '558382039490').length });

              // Adicionar à fila de processamento da IA
              messageQueue.push(newMessage);
              processMessageQueue();
            }
          }
        }
      });

    } catch (error) {
      console.error('Erro na conexão WhatsApp:', error);
      isReconnecting = false;
      setTimeout(connectToWhatsApp, 10000);
    }
  }

  async function detectIntent(message: any) {
    const apiKey = config.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") return;

    try {
      const { GoogleGenAI, Type, ThinkingLevel } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
        Você é o assistente de atendimento do RK Sucatas.
        Mensagem do cliente: "${message.body}"
        Identifique a intenção e retorne APENAS UM JSON com:
        {
          "intencao": "busca" | "orcamento" | "compra" | "duvida" | "outro",
          "termo": "termo de busca (se for busca)",
          "resumo": "resumo do que o cliente quer em 1 frase"
        }
      `;
      
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intencao: { type: Type.STRING },
              termo: { type: Type.STRING },
              resumo: { type: Type.STRING }
            },
            required: ["intencao", "resumo"]
          }
        }
      });
      
      const intent = JSON.parse(result.text || '{}');
      const index = whatsappMessages.findIndex(m => m.id === message.id);
      if (index !== -1) {
        whatsappMessages[index].intent = intent;
        whatsappMessages[index].processed = true;
        io.emit('whatsapp-message-updated', whatsappMessages[index]);
      }
    } catch (error) {
      console.error('Erro ao detectar intenção:', error);
    }
  }

  // ==================== MERCADO LIVRE ROUTES ====================

  // Endpoint de teste
  // (Removido daqui e movido para cima)

  app.get("/api/whatsapp/status", (req, res) => {
    res.json({ 
      connected: isWhatsAppConnected, 
      qr: qrCodeData,
      queue: messageQueue.length,
      isConnecting: isReconnecting,
      reconnectAttempts,
      serverStartTime
    });
  });

  app.get("/api/whatsapp/messages", (req, res) => {
    res.json({ success: true, data: whatsappMessages });
  });

  app.get("/api/whatsapp/conversations", (req, res) => {
    const conversationsList = Array.from(conversations.values())
      .sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
    res.json({ success: true, data: conversationsList });
  });

  app.get("/api/whatsapp/conversations/:number/messages", (req, res) => {
    const { number } = req.params;
    const conv = conversations.get(number);
    res.json({ success: true, data: conv?.messages || [] });
  });

  app.post("/api/whatsapp/messages/:id/read", (req, res) => {
    const { id } = req.params;
    const index = whatsappMessages.findIndex(m => m.id === id);
    if (index !== -1) {
      whatsappMessages[index].status = 'read';
      const from = whatsappMessages[index].from;
      if (conversations.has(from)) {
        const conv = conversations.get(from);
        const mIdx = conv.messages.findIndex((m: any) => m.id === id);
        if (mIdx !== -1) conv.messages[mIdx].status = 'read';
        conv.unreadCount = Math.max(0, conv.unreadCount - 1);
        conversations.set(from, conv);
        io.emit('whatsapp-conversations', Array.from(conversations.values()));
      }
      io.emit('whatsapp-notification', { count: whatsappMessages.filter(m => m.status === 'unread').length });
    }
    res.json({ success: true });
  });

  app.delete("/api/whatsapp/conversations/:number", async (req, res) => {
    try {
      const { number } = req.params;
      if (!conversations.has(number)) throw new Error("Conversa não encontrada");

      // Remover todas as mensagens associadas a este número
      whatsappMessages = whatsappMessages.filter(m => m.from !== number);
      
      // Remover a conversa do mapa
      conversations.delete(number);

      io.emit('whatsapp-conversations', Array.from(conversations.values()).filter(c => c.number !== '558382039490'));
      io.emit('whatsapp-notification', { count: whatsappMessages.filter(m => m.status === 'unread' && m.from !== '558382039490').length });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Erro ao deletar conversa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/whatsapp/messages/:id", (req, res) => {
    const { id } = req.params;
    const msg = whatsappMessages.find(m => m.id === id);
    if (msg) {
      const from = msg.from;
      whatsappMessages = whatsappMessages.filter(m => m.id !== id);
      if (conversations.has(from)) {
        const conv = conversations.get(from);
        conv.messages = conv.messages.filter((m: any) => m.id !== id);
        if (conv.messages.length === 0) {
          conversations.delete(from);
        } else {
          conv.lastMessage = conv.messages[conv.messages.length - 1].body;
          conv.lastTimestamp = conv.messages[conv.messages.length - 1].timestamp;
          conversations.set(from, conv);
        }
        io.emit('whatsapp-conversations', Array.from(conversations.values()));
      }
      io.emit('whatsapp-notification', { count: whatsappMessages.filter(m => m.status === 'unread').length });
    }
    res.json({ success: true });
  });

  app.delete("/api/whatsapp/messages/:id/remote", async (req, res) => {
    try {
      const { id } = req.params;
      const msg = whatsappMessages.find(m => m.id === id);
      if (!msg) throw new Error("Mensagem não encontrada");

      const sock = (app as any).whatsappSock;
      if (!sock) throw new Error("WhatsApp não conectado");

      // Deletar para todos (revoke)
      await sock.sendMessage(msg.remoteJid, { delete: msg.key });
      
      // Remover do sistema também
      const from = msg.from;
      whatsappMessages = whatsappMessages.filter(m => m.id !== id);
      if (conversations.has(from)) {
        const conv = conversations.get(from);
        conv.messages = conv.messages.filter((m: any) => m.id !== id);
        if (conv.messages.length === 0) {
          conversations.delete(from);
        } else {
          conv.lastMessage = conv.messages[conv.messages.length - 1].body;
          conv.lastTimestamp = conv.messages[conv.messages.length - 1].timestamp;
          conversations.set(from, conv);
        }
        io.emit('whatsapp-conversations', Array.from(conversations.values()));
      }
      io.emit('whatsapp-notification', { count: whatsappMessages.filter(m => m.status === 'unread').length });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Erro ao deletar mensagem remota:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/whatsapp/send", async (req, res) => {
    try {
      const { number, message, replyToId } = req.body;
      addLog(`📤 Solicitando envio de mensagem para ${number}...`);
      
      const sock = currentSocket;
      
      // Determinar JID correto
      let jid = `${number}@s.whatsapp.net`;
      if (conversations.has(number)) {
        jid = conversations.get(number).remoteJid;
      } else if (number.includes('-')) {
        jid = `${number}@g.us`; // Provável grupo
      }

      const sentMessage = {
        id: `send_${Date.now()}`,
        from: 'me',
        body: message,
        timestamp: new Date(),
        status: 'sending'
      };

      // Adicionar a mensagem à conversa imediatamente (otimista)
      if (conversations.has(number)) {
        const conv = conversations.get(number);
        conv.messages.push(sentMessage);
        conv.lastMessage = message;
        conv.lastTimestamp = new Date();
        conversations.set(number, conv);
      } else {
        conversations.set(number, {
          number: number,
          remoteJid: jid,
          name: number,
          lastMessage: message,
          lastTimestamp: new Date(),
          unreadCount: 0,
          messages: [sentMessage],
          status: 'online'
        });
      }
      io.emit('whatsapp-conversations', Array.from(conversations.values()));

      // Função para atualizar o status da mensagem
      const updateMessageStatus = (status: string) => {
        if (conversations.has(number)) {
          const conv = conversations.get(number);
          const msgIndex = conv.messages.findIndex((m: any) => m.id === sentMessage.id);
          if (msgIndex !== -1) {
            conv.messages[msgIndex].status = status;
            conversations.set(number, conv);
            io.emit('whatsapp-conversations', Array.from(conversations.values()));
          }
        }
      };

      if (!sock || !isWhatsAppConnected || sock.ws.readyState !== 1) {
        addLog(`⚠️ WhatsApp não conectado no momento. Enfileirando mensagem para ${number}...`);
        
        // Adicionar à fila de mensagens enviadas
        messageQueue.push({
          type: 'send',
          jid,
          message: { text: message },
          sentMessageId: sentMessage.id,
          number
        });
        
        updateMessageStatus('queued');

        return res.status(202).json({ 
          success: true, 
          message: "Mensagem enfileirada. Será enviada quando a conexão for restabelecida.",
          status: 'queued'
        });
      }

      // Tentar enviar diretamente
      try {
        const sendPromise = sock.sendMessage(jid, { text: message });
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout ao enviar mensagem')), 30000)
        );
        
        await Promise.race([sendPromise, timeoutPromise]);
        addLog(`✅ Mensagem enviada para ${number}`);
        updateMessageStatus('sent');

      } catch (sendError: any) {
        addLog(`⚠️ Falha ao enviar diretamente para ${number}, enfileirando. Erro: ${sendError.message}`);
        messageQueue.push({
          type: 'send',
          jid,
          message: { text: message },
          sentMessageId: sentMessage.id,
          number
        });
        updateMessageStatus('queued');
        
        return res.status(202).json({ 
          success: true, 
          message: "Mensagem enfileirada após falha inicial.",
          status: 'queued'
        });
      }

      if (replyToId) {
        const index = whatsappMessages.findIndex(m => m.id === replyToId);
        if (index !== -1) {
          whatsappMessages[index].replied = true;
          whatsappMessages[index].repliedAt = new Date();
          // Atualizar na conversa também
          const from = whatsappMessages[index].from;
          if (conversations.has(from)) {
            const conv = conversations.get(from);
            const mIdx = conv.messages.findIndex((m: any) => m.id === replyToId);
            if (mIdx !== -1) {
              conv.messages[mIdx].replied = true;
              conv.messages[mIdx].repliedAt = new Date();
            }
            conversations.set(from, conv);
            io.emit('whatsapp-conversations', Array.from(conversations.values()).filter(c => c.number !== '558382039490'));
          }
        }
      }

      res.json({ 
        success: true, 
        message: 'Mensagem enviada',
        status: 'connected'
      });
      
    } catch (error: any) {
      addLog(`❌ Erro crítico ao processar envio de mensagem: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        status: isWhatsAppConnected ? 'connected' : 'disconnected'
      });
    }
  });

  app.get("/api/whatsapp/logs", (req, res) => {
    res.json({ success: true, logs: whatsappLogs });
  });

  app.post("/api/whatsapp/logout", async (req, res) => {
    try {
      addLog('🚪 Solicitando logout do WhatsApp...');
      const sock = (app as any).whatsappSock;
      if (sock) {
        await sock.logout();
      }
      
      // Limpar pasta de autenticação
      const authPath = path.join(process.cwd(), 'baileys_auth_info');
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
      }
      
      isWhatsAppConnected = false;
      qrCodeData = null;
      emitStatus();
      
      // Reiniciar conexão para gerar novo QR
      isReconnecting = false;
      connectToWhatsApp();
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Erro ao deslogar WhatsApp:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/whatsapp/reconnect", async (req, res) => {
    try {
      addLog('🔄 Solicitando reconexão manual...');
      isReconnecting = false; // Reset flag to allow new connection
      connectToWhatsApp();
      res.json({ success: true, message: 'Reconexão iniciada' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/whatsapp/force-qr", async (req, res) => {
    try {
      addLog('🔄 Forçando novo QR Code...');
      const sock = (app as any).whatsappSock;
      if (sock) {
        try {
          sock.ev.removeAllListeners('connection.update');
          sock.ev.removeAllListeners('creds.update');
          sock.ev.removeAllListeners('messages.upsert');
          sock.end(new Error('Forçando novo QR'));
        } catch (e) {}
      }
      
      // Limpar pasta de autenticação para garantir novo QR
      const authPath = path.join(process.cwd(), 'baileys_auth_info');
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
      }
      
      isWhatsAppConnected = false;
      qrCodeData = null;
      isReconnecting = false;
      
      // Pequeno delay antes de reconectar
      setTimeout(() => {
        connectToWhatsApp();
      }, 1000);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Erro ao forçar QR:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Error handler for API routes
  app.use('/api', (err: any, req: any, res: any, next: any) => {
    console.error('❌ Erro na API:', err);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Erro interno no servidor'
    });
  });

  // Catch-all para rotas /api não encontradas (evita retornar HTML)
  app.all('/api/*', (req, res) => {
    res.status(404).json({ 
      success: false, 
      error: `Rota API não encontrada: ${req.method} ${req.url}` 
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT} [PID:${process.pid}]`);
    console.log(`🔗 APP_URL: ${process.env.APP_URL || 'Não definida (usando localhost)'}`);
    
    // Warm-up do cache do Notion para login rápido
    console.log('🔥 Iniciando warm-up do cache do Notion...');
    Promise.all([
      fetchAllFromNotion(DATABASE_ID).catch(() => null),
      fetchAllFromNotion(MOTOS_DATABASE_ID).catch(() => null),
      fetchAllFromNotion(CLIENTS_DATABASE_ID).catch(() => null)
    ]).then(() => {
      console.log('✅ Warm-up do cache do Notion concluído.');
    });

    console.log("📱 Inicializando WhatsApp (Baileys)...");
    // Pequeno delay para evitar conflitos se o servidor estiver reiniciando rápido
    setTimeout(() => {
      connectToWhatsApp().catch(err => {
        console.error("❌ Erro ao inicializar WhatsApp:", err);
      });
    }, 10000);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('🛑 Encerrando servidor...');
    const sock = (app as any).whatsappSock;
    if (sock) {
      try {
        sock.ev.removeAllListeners('connection.update');
        sock.end(undefined);
        console.log('✅ Socket WhatsApp encerrado.');
      } catch (e) {}
    }
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
