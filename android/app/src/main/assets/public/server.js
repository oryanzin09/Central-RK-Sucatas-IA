// server.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { createServer } from "http";
import { Server } from "socket.io";
import QRCode from "qrcode";
import axios2 from "axios";
import multer from "multer";
import bcrypt from "bcrypt";

// services/mlClient.ts
import axios from "axios";
var MLClient = class {
  constructor() {
    this.lastRequestTime = 0;
    this.minDelay = 300;
    this.baseURL = "https://api.mercadolibre.com";
    this.clientId = process.env.ML_CLIENT_ID || "";
    this.clientSecret = process.env.ML_CLIENT_SECRET || "";
    this.accessToken = process.env.ML_ACCESS_TOKEN || "";
    this.refreshToken = process.env.ML_REFRESH_TOKEN || "";
    this._userId = process.env.ML_USER_ID || "";
    if (!this.clientId || !this.clientSecret) {
      console.warn("\u26A0\uFE0F ML_CLIENT_ID ou ML_CLIENT_SECRET n\xE3o configurados");
    }
  }
  get userId() {
    return this._userId;
  }
  /**
   * Garante que o userId está correto (obtido do token)
   */
  async ensureUserId() {
    if (!this._userId || this._userId === "undefined" || this._userId === "null") {
      console.log("\u{1F50D} Obtendo User ID do token...");
      try {
        const user = await this.getUserInfo();
        this._userId = user.id.toString();
        console.log(`\u2705 User ID obtido: ${this._userId}`);
      } catch (error) {
        console.error("\u274C Falha ao obter User ID do token");
        throw error;
      }
    }
    return this._userId;
  }
  // 300ms delay between requests
  /**
   * Método base para todas as requisições com retry automático em caso de token expirado
   */
  async request(endpoint, options = {}) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minDelay) {
      await new Promise((resolve) => setTimeout(resolve, this.minDelay - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();
    try {
      console.log(`\u{1F4E1} Chamando API ML: ${endpoint}`);
      const response = await axios({
        url: `${this.baseURL}${endpoint}`,
        timeout: 1e4,
        ...options,
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
          "x-format-new": "true",
          // Header obrigatório para obter substatus corretos
          ...options.headers || {}
        }
      });
      if (typeof response.data === "string" && response.data.includes("Rate exceeded")) {
        throw new Error("Rate exceeded.");
      }
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        console.log("\u{1F504} Token expirado, tentando renovar...");
        const renewed = await this.refreshAccessToken();
        if (renewed) {
          console.log("\u2705 Token renovado, retentando requisi\xE7\xE3o");
          return this.request(endpoint, options);
        }
      }
      if (error.response?.status === 403) {
        console.error("\u{1F6AB} Erro 403 (Forbidden) no Mercado Livre.");
        console.error("URL da requisi\xE7\xE3o:", `${this.baseURL}${endpoint}`);
        console.error("Headers enviados:", JSON.stringify(options.headers || {}, null, 2));
        console.error("Detalhes do erro:", JSON.stringify(error.response.data, null, 2));
      }
      console.error(`\u274C Erro na requisi\xE7\xE3o ${endpoint}:`, {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  }
  /**
   * Renova o access token usando o refresh token
   */
  async refreshAccessToken() {
    try {
      console.log("\u{1F504} Executando refresh token...");
      const response = await axios.post("https://api.mercadolibre.com/oauth/token", {
        grant_type: "refresh_token",
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken
      }, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        }
      });
      if (response.data.access_token) {
        this.accessToken = response.data.access_token;
        if (response.data.refresh_token) {
          this.refreshToken = response.data.refresh_token;
        }
        console.log("\u2705 Token renovado com sucesso");
        return true;
      }
      return false;
    } catch (error) {
      console.error("\u274C Erro ao renovar token:", error.response?.data || error.message);
      return false;
    }
  }
  // ========== MÉTODOS PÚBLICOS DA API ==========
  /**
   * Busca informações do usuário (para teste)
   */
  async getUserInfo() {
    return this.request("/users/me");
  }
  /**
   * Busca anúncios do vendedor
   */
  async getListings(status = "active", sort = "date_desc", limit = 50, offset = 0) {
    try {
      await this.ensureUserId();
      console.log(`\u{1F50D} Buscando an\xFAncios (status: ${status}, sort: ${sort}, limit: ${limit}, offset: ${offset})...`);
      if (limit > 50) {
        let allResults = [];
        let currentOffset = offset;
        let total = 0;
        while (allResults.length < limit) {
          const currentLimit = Math.min(50, limit - allResults.length);
          const response2 = await this.request(`/users/${this.userId}/items/search`, {
            params: {
              status: status === "all" ? void 0 : status,
              sort_by: "DATE",
              order_by: "DESC",
              limit: currentLimit,
              offset: currentOffset
            }
          });
          total = response2.paging?.total || 0;
          if (!response2.results || response2.results.length === 0) break;
          allResults = [...allResults, ...response2.results];
          currentOffset += response2.results.length;
          if (allResults.length >= total) break;
        }
        return { total, results: allResults };
      }
      const params = {
        limit,
        offset,
        sort_by: "DATE",
        order_by: "DESC"
      };
      if (status !== "all") {
        params.status = status;
      }
      const response = await this.request(`/users/${this.userId}/items/search`, {
        params
      });
      console.log(`\u{1F4E6} Total de an\xFAncios encontrados: ${response.paging?.total || 0}`);
      return {
        total: response.paging?.total || 0,
        results: response.results || []
      };
    } catch (error) {
      console.error("Erro ao buscar an\xFAncios:", error);
      return { total: 0, results: [] };
    }
  }
  /**
   * Busca perguntas do vendedor
   */
  async getQuestions(status = "UNANSWERED", limit = 50) {
    try {
      await this.ensureUserId();
      console.log(`\u{1F50D} Buscando perguntas (${status}) para usu\xE1rio ${this.userId}...`);
      const params = {
        seller_id: this.userId,
        limit: Math.min(limit, 50)
      };
      if (status.toUpperCase() !== "ALL") {
        params.status = status.toLowerCase();
      }
      console.log("\u{1F4E1} Par\xE2metros da requisi\xE7\xE3o de perguntas:", params);
      const response = await this.request("/questions/search", {
        params
      });
      return {
        total: response.paging?.total || 0,
        questions: response.questions || []
      };
    } catch (error) {
      console.error("\u274C Erro ao buscar perguntas:", error);
      throw error;
    }
  }
  /**
   * Responde uma pergunta
   */
  async answerQuestion(questionId, answer) {
    try {
      console.log(`\u{1F4DD} Respondendo pergunta ${questionId}...`);
      const response = await this.request("/answers", {
        method: "POST",
        data: {
          question_id: questionId,
          text: answer
        }
      });
      return response;
    } catch (error) {
      console.error("Erro ao responder pergunta:", error);
      throw error;
    }
  }
  /**
   * Busca métricas de vendas em um período
   */
  async getSalesMetrics(dateFrom, dateTo) {
    try {
      await this.ensureUserId();
      console.log(`\u{1F4CA} Buscando m\xE9tricas de ${dateFrom} a ${dateTo}...`);
      const orders = await this.request("/orders/search", {
        params: {
          seller: this.userId,
          "order.date_created.from": `${dateFrom}T00:00:00.000-00:00`,
          "order.date_created.to": `${dateTo}T23:59:59.000-00:00`,
          limit: 15
        }
      });
      let totalAmount = 0;
      let totalSales = 0;
      const dailyData = {};
      if (orders.results && Array.isArray(orders.results)) {
        orders.results.forEach((order) => {
          if (order.status === "paid") {
            totalSales++;
            totalAmount += order.total_amount || 0;
            if (order.date_created) {
              const dateStr = order.date_created.split("T")[0];
              dailyData[dateStr] = (dailyData[dateStr] || 0) + (order.total_amount || 0);
            }
          }
        });
      }
      const average = totalSales > 0 ? totalAmount / totalSales : 0;
      return {
        total: totalAmount,
        count: totalSales,
        average,
        dailyData
      };
    } catch (error) {
      console.error("Erro ao buscar m\xE9tricas:", error);
      return { total: 0, count: 0, average: 0 };
    }
  }
  /**
   * Baixa a etiqueta de envio
   */
  async getShippingLabel(shipmentId) {
    try {
      console.log(`\u{1F3F7}\uFE0F Baixando etiqueta para envio ${shipmentId}...`);
      const response = await this.request(`/shipment_labels?shipment_ids=${shipmentId}&response_type=pdf`, {
        responseType: "arraybuffer",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "Accept": "application/pdf, application/zip, application/octet-stream"
        }
      });
      return response;
    } catch (error) {
      console.error("Erro ao baixar etiqueta:", error);
      throw error;
    }
  }
  /**
   * Atualiza um anúncio
   */
  async updateListing(itemId, data) {
    try {
      console.log(`\u{1F4DD} Atualizando an\xFAncio ${itemId}...`);
      const response = await this.request(`/items/${itemId}`, {
        method: "PUT",
        data
      });
      return response;
    } catch (error) {
      console.error("Erro ao atualizar an\xFAncio:", error);
      throw error;
    }
  }
  /**
   * Método de teste para verificar conexão
   */
  async testConnection() {
    try {
      const user = await this.getUserInfo();
      const listings = await this.getListings();
      return {
        success: true,
        user: user.nickname,
        userId: user.id,
        listings: listings.total,
        message: "\u2705 Conex\xE3o com Mercado Livre OK"
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: "\u274C Falha na conex\xE3o com Mercado Livre"
      };
    }
  }
};
var mlClient_default = new MLClient();

// middleware/auth.ts
import admin from "firebase-admin";
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "gen-lang-client-0969674405"
  });
}
var rotasPublicas = [
  "/health",
  "/login",
  "/public-stats",
  "/register",
  "/api/register",
  "/api/login"
];
async function autenticar(req, res, next) {
  const isPublic = rotasPublicas.some((rota) => {
    return req.path === rota || req.originalUrl.includes(rota);
  });
  if (isPublic) {
    return next();
  }
  const token = req.cookies?.auth_token || (req.headers["authorization"]?.startsWith("Bearer ") ? req.headers["authorization"].split(" ")[1] : null);
  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Acesso n\xE3o autorizado",
      message: "Token inv\xE1lido ou ausente"
    });
  }
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "Acesso n\xE3o autorizado",
      message: "Token inv\xE1lido ou expirado"
    });
  }
}

// services/mlCache.ts
var ML_CACHE_TTL = 1e3 * 60 * 60;
var mlItemCache = /* @__PURE__ */ new Map();

// src/services/storageService.ts
import { Storage } from "@google-cloud/storage";
import { v4 as uuidv4 } from "uuid";
var storage = new Storage();
var BUCKET_NAME = process.env.GCS_BUCKET_NAME || "rksucatas";
var StorageService = class {
  constructor() {
    this.bucket = storage.bucket(BUCKET_NAME);
  }
  /**
   * Gera uma URL assinada para upload direto do navegador.
   * Esta é a forma MAIS SEGURA e eficiente de fazer upload.
   */
  async generateUploadUrl(filename, fileType) {
    try {
      const fileId = uuidv4();
      const extension = filename ? filename.split(".").pop() : "jpg";
      const finalFilename = fileId + (extension ? `.${extension}` : "");
      const file = this.bucket.file(finalFilename);
      console.log(`\u{1F4DD} Tentando gerar URL assinada para: ${finalFilename}`);
      const options = {
        version: "v4",
        action: "write",
        expires: Date.now() + 15 * 60 * 1e3,
        // 15 minutos para fazer o upload
        contentType: fileType || "image/jpeg"
      };
      const [url] = await file.getSignedUrl(options);
      return {
        uploadUrl: url,
        publicUrl: `https://storage.googleapis.com/${BUCKET_NAME}/${finalFilename}`,
        filename: finalFilename
      };
    } catch (error) {
      if (error.message.includes("IAM Service Account Credentials API")) {
        console.log("\u2139\uFE0F Info: IAM API desativada. O sistema usar\xE1 o upload direto como fallback.");
      } else {
        console.error("\u274C Erro detalhado no StorageService:", error);
      }
      throw new Error(`Erro ao gerar URL assinada: ${error.message}`);
    }
  }
  /**
   * Faz upload de um arquivo diretamente do servidor para o bucket.
   * Útil como fallback se a URL assinada falhar.
   */
  async uploadFile(filePath, destination, contentType) {
    try {
      await this.bucket.upload(filePath, {
        destination,
        metadata: {
          contentType
        }
      });
      return `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`;
    } catch (error) {
      console.error("\u274C Erro no upload direto para GCS:", error);
      throw error;
    }
  }
  /**
   * Faz upload de um buffer diretamente para o bucket.
   */
  async uploadBuffer(buffer, destination, contentType) {
    try {
      const file = this.bucket.file(destination);
      await file.save(buffer, {
        metadata: { contentType }
      });
      return `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`;
    } catch (error) {
      console.error("\u274C Erro no upload de buffer para GCS:", error);
      throw error;
    }
  }
  async generateReadUrl(filename, expiresInMinutes = 60) {
    const file = this.bucket.file(filename);
    const options = {
      version: "v4",
      action: "read",
      expires: Date.now() + expiresInMinutes * 60 * 1e3
    };
    const [url] = await file.getSignedUrl(options);
    return url;
  }
  /**
   * Deleta uma imagem do bucket
   */
  async deleteFile(filename) {
    try {
      await this.bucket.file(filename).delete();
      return true;
    } catch (error) {
      console.error("Erro ao deletar arquivo:", error);
      return false;
    }
  }
};
var storageService_default = new StorageService();

// server.ts
dotenv.config();
var config = {};
try {
  if (fs.existsSync("./config.json")) {
    config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
  }
} catch (err) {
  console.error("Erro ao ler config.json:", err);
}
var NOTION_TOKEN = process.env.NOTION_TOKEN || "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";
var DATABASE_ID = process.env.NOTION_DATABASE_ID || process.env.NOTION_DB_ESTOQUE || "";
var MOTOS_DATABASE_ID = process.env.NOTION_DB_MOTOS || "";
var CLIENTS_DATABASE_ID = process.env.DATABASE_CLIENTES || process.env.NOTION_DB_CLIENTS || "";
var NOTION_VERSION = "2022-06-28";
var serverStartTime = (/* @__PURE__ */ new Date()).toISOString();
var dbStructureCache = {};
var notionDataCache = {};
var CACHE_TTL = 1e3 * 60 * 5;
var DATA_CACHE_TTL = 1e3 * 60 * 5;
var fetchLocks = {};
function invalidateCache(databaseId) {
  if (databaseId) {
    delete notionDataCache[databaseId];
    console.log(`\u{1F9F9} Cache invalidado para o banco ${databaseId}`);
  } else {
    Object.keys(notionDataCache).forEach((key) => delete notionDataCache[key]);
    console.log("\u{1F9F9} Todo o cache do Notion foi limpo");
  }
}
async function getCachedDbStructure(databaseId) {
  const cached = dbStructureCache[databaseId];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    headers: {
      "Authorization": `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION
    }
  });
  if (!response.ok) {
    if (response.status === 404) {
      console.warn(`\u26A0\uFE0F Estrutura do banco n\xE3o encontrada (ID: ${databaseId}). Retornando estrutura vazia.`);
      return { properties: {} };
    }
    throw new Error(`N\xE3o foi poss\xEDvel carregar a estrutura do banco: ${response.statusText}`);
  }
  const data = await response.json();
  dbStructureCache[databaseId] = { data, timestamp: Date.now() };
  return data;
}
async function fetchAllFromNotion(databaseId) {
  const cached = notionDataCache[databaseId];
  if (cached && Date.now() - cached.timestamp < DATA_CACHE_TTL) {
    console.log(`\u{1F4E6} Usando cache para o banco ${databaseId}`);
    return cached.data;
  }
  if (fetchLocks[databaseId]) {
    console.log(`\u23F3 Aguardando busca em andamento para o banco ${databaseId}`);
    return fetchLocks[databaseId];
  }
  const fetchPromise = (async () => {
    try {
      let allResults = [];
      let cursor = void 0;
      let hasMore = true;
      console.log(`\u{1F504} Buscando TODAS as p\xE1ginas do banco ${databaseId}`);
      while (hasMore) {
        const payload = {
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
          method: "POST",
          headers: {
            "Authorization": `Bearer ${NOTION_TOKEN}`,
            "Content-Type": "application/json",
            "Notion-Version": NOTION_VERSION
          },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const error = await response.text();
          console.error(`\u274C Erro Notion ${response.status}:`, error);
          if (response.status === 404) {
            console.warn(`\u26A0\uFE0F Banco de dados n\xE3o encontrado (ID: ${databaseId}). Verifique se ele foi compartilhado com a integra\xE7\xE3o.`);
            return [];
          }
          throw new Error(`Notion API error (${response.status}): ${error.substring(0, 200)}`);
        }
        const data = await response.json();
        allResults = [...allResults, ...data.results];
        hasMore = data.has_more;
        cursor = data.next_cursor;
        console.log(`   \u2192 +${data.results.length} itens. Total: ${allResults.length}`);
      }
      notionDataCache[databaseId] = { data: allResults, timestamp: Date.now() };
      return allResults;
    } finally {
      fetchLocks[databaseId] = null;
    }
  })();
  fetchLocks[databaseId] = fetchPromise;
  return fetchPromise;
}
async function startServer() {
  const app = express();
  const PORT = 3e3;
  const httpServer = createServer(app);
  app.set("trust proxy", 1);
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log("\u{1F4C1} Pasta uploads criada com sucesso");
  }
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });
  const salesDbId = process.env.DATABASE_VENDAS_ID || process.env.NOTION_DB_VENDAS || "";
  app.use(express.json());
  const allowedOrigins = [
    "https://aistudio.google.com",
    "http://localhost:3000",
    "https://rk-sucatas-987595911324.southamerica-east1.run.app"
  ];
  if (process.env.APP_URL) {
    allowedOrigins.push(process.env.APP_URL);
  }
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed = allowedOrigins.some(
        (allowed) => origin === allowed || origin.startsWith(allowed)
      );
      if (isAllowed) {
        callback(null, true);
      } else {
        console.log(`\u26A0\uFE0F Origin n\xE3o permitida pelo CORS: ${origin}`);
        callback(null, true);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use("/api", (req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
  app.get("/api/health", (req, res) => {
    res.json({ success: true, status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.use("/api", autenticar);
  app.get("/api/ml/dashboard", async (req, res) => {
    try {
      const { period = "30d", start, end } = req.query;
      console.log("\u{1F4CA} Iniciando busca do dashboard ML...");
      let activeListingsCount = 0;
      let totalListingsCount = 0;
      let pendingQuestionsCount = 0;
      let monthlySalesTotal = 0;
      let totalSalesCount = 0;
      let pendingShipmentsCount = 0;
      let avgTicketValue = 0;
      let recentListings = [];
      try {
        console.log("\u{1F50D} Buscando IDs dos an\xFAncios mais recentes (start_time_desc)...");
        const allListings = await mlClient_default.getListings("active", "start_time_desc", 100);
        totalListingsCount = allListings.total;
        if (allListings.results && allListings.results.length > 0) {
          try {
            const recentIds = allListings.results.slice(0, 50);
            const itemsToFetch = recentIds;
            const results = [];
            if (itemsToFetch.length > 0) {
              const chunks = [];
              for (let i = 0; i < itemsToFetch.length; i += 20) {
                chunks.push(itemsToFetch.slice(i, i + 20));
              }
              for (const chunk of chunks) {
                const ids = chunk.join(",");
                const itemsResponse = await mlClient_default.request("/items", {
                  params: { ids, attributes: "id,title,price,thumbnail,status,permalink,pictures,date_created,available_quantity,sold_quantity" }
                });
                if (Array.isArray(itemsResponse)) {
                  itemsResponse.forEach((item) => {
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
                      fotos: body.pictures?.map((p) => p.url) || []
                    };
                    mlItemCache.set(formatted.id, { data: formatted, timestamp: Date.now() });
                    results.push(formatted);
                  });
                }
              }
            }
            recentListings = results.sort((a, b) => {
              const dateA = new Date(a.criado_em).getTime();
              const dateB = new Date(b.criado_em).getTime();
              return dateB - dateA;
            }).slice(0, 5).map((item) => {
              const highResImage = item.fotos && item.fotos.length > 0 ? item.fotos[0] : item.thumbnail;
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
              console.log(`\u2705 Dashboard ML: Exibindo ${recentListings.length} an\xFAncios. O mais recente \xE9 de: ${recentListings[0].date_created}`);
            }
          } catch (err) {
            console.error("\u26A0\uFE0F Erro ao buscar detalhes dos an\xFAncios recentes:", err);
          }
        }
        const totalListings = await mlClient_default.getListings("all", "start_time_desc", 1);
        totalListingsCount = totalListings.total;
        activeListingsCount = allListings.total;
      } catch (err) {
        console.error("\u26A0\uFE0F Erro ao buscar an\xFAncios:", err);
      }
      try {
        const questions = await mlClient_default.getQuestions("UNANSWERED", 1);
        pendingQuestionsCount = questions.total;
      } catch (err) {
        console.error("\u26A0\uFE0F Erro ao buscar perguntas:", err);
      }
      let chartData = [];
      let recentSales = [];
      try {
        let endDate = /* @__PURE__ */ new Date();
        let startDate = /* @__PURE__ */ new Date();
        let days = 30;
        if (start && end) {
          startDate = new Date(start);
          endDate = new Date(end);
          days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1e3 * 60 * 60 * 24)));
        } else {
          days = parseInt(period) || 30;
          startDate.setDate(startDate.getDate() - days);
        }
        const formatDate = (date) => date.toISOString().split("T")[0];
        const salesMetrics = await mlClient_default.getSalesMetrics(
          formatDate(startDate),
          formatDate(endDate)
        );
        monthlySalesTotal = salesMetrics.total;
        avgTicketValue = salesMetrics.average;
        const [ordersResponse, readyToShipOrdersResponse] = await Promise.all([
          mlClient_default.request(`/orders/search`, {
            params: {
              seller: await mlClient_default.ensureUserId(),
              sort: "date_desc",
              limit: 15,
              "order.date_created.from": formatDate(startDate) + "T00:00:00.000-00:00",
              "order.date_created.to": formatDate(endDate) + "T23:59:59.000-00:00"
            }
          }),
          mlClient_default.request(`/orders/search`, {
            params: {
              seller: await mlClient_default.ensureUserId(),
              "shipping.status": "ready_to_ship",
              sort: "date_desc",
              limit: 15
            }
          }).catch((err) => {
            console.error("\u26A0\uFE0F Erro ao buscar ordens prontas para envio no dashboard:", err.message);
            return { results: [] };
          })
        ]);
        pendingShipmentsCount = readyToShipOrdersResponse.paging?.total || 0;
        totalSalesCount = ordersResponse.paging?.total || ordersResponse.total || 0;
        const allOrders = [
          ...ordersResponse.results || [],
          ...readyToShipOrdersResponse.results || []
        ];
        const uniqueOrdersMap = /* @__PURE__ */ new Map();
        allOrders.forEach((order) => {
          if (!uniqueOrdersMap.has(order.id)) {
            uniqueOrdersMap.set(order.id, order);
          }
        });
        const orders = Array.from(uniqueOrdersMap.values());
        const shippingIds = orders.map((o) => o.shipping?.id).filter(Boolean);
        const shipmentsMap = /* @__PURE__ */ new Map();
        if (shippingIds.length > 0) {
          const shipmentPromises = shippingIds.map(
            (id) => mlClient_default.request(`/shipments/${id}`, {
              headers: { "x-format-new": "true" }
            }).catch(() => null)
          );
          const shipments = await Promise.all(shipmentPromises);
          shipments.forEach((s) => {
            if (s && s.id) shipmentsMap.set(s.id, s);
          });
        }
        recentSales = orders.map((order) => {
          const buyer = order.buyer || {};
          const nomeCliente = buyer.first_name && buyer.last_name ? `${buyer.first_name} ${buyer.last_name}` : buyer.nickname || "Cliente ML";
          const shipmentDetails = order.shipping?.id ? shipmentsMap.get(order.shipping.id) : null;
          const shippingStatus = shipmentDetails?.status || order.shipping?.status;
          const shippingSubstatus = shipmentDetails?.substatus || order.shipping?.substatus;
          let statusFinal = shippingStatus;
          if (shippingStatus === "ready_to_ship" || shippingStatus === "shipped" || shippingStatus === "delivered" || shippingStatus === "cancelled" || shippingStatus === "not_delivered") {
            statusFinal = shippingSubstatus ? `${shippingStatus}_${shippingSubstatus}` : shippingStatus;
          }
          return {
            id: order.id,
            cliente: nomeCliente,
            nickname: buyer.nickname,
            valor: order.total_amount,
            data: order.date_created,
            status: order.status === "paid" ? "Pago" : order.status,
            shipping_status: statusFinal,
            shipping_substatus: shippingSubstatus,
            itens: order.order_items?.map((i) => i.item?.title || i.item?.id || "Produto ML").join(", "),
            thumbnail: order.order_items?.[0]?.item?.thumbnail,
            shipping_id: order.shipping?.id,
            quantidade: order.order_items?.reduce((acc, item) => acc + (item.quantity || 1), 0) || 1
          };
        });
        const dailyData = {};
        for (let i = days; i >= 0; i--) {
          const d = new Date(endDate);
          d.setDate(endDate.getDate() - i);
          const dateStr = formatDate(d);
          dailyData[dateStr] = salesMetrics.dailyData?.[dateStr] || 0;
        }
        chartData = Object.entries(dailyData).map(([date, total]) => {
          const [y, m, d] = date.split("-").map(Number);
          const dateObj = new Date(y, m - 1, d);
          return {
            date,
            label: dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
            vendas: total
          };
        }).sort((a, b) => a.date.localeCompare(b.date));
      } catch (err) {
        console.error("\u26A0\uFE0F Erro ao buscar m\xE9tricas de vendas:", err);
      }
      res.json({
        success: true,
        data: {
          activeListings: activeListingsCount,
          totalListings: totalListingsCount,
          pendingQuestions: pendingQuestionsCount,
          monthlySales: monthlySalesTotal,
          totalSalesCount,
          pendingShipments: pendingShipmentsCount,
          avgTicket: avgTicketValue,
          recentListings,
          recentSales,
          chartData,
          period
        }
      });
    } catch (error) {
      console.error("\u274C Erro cr\xEDtico no dashboard ML:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  app.get("/api/ml/shipment-label/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const buffer = await mlClient_default.getShippingLabel(id);
      const uint8Array = new Uint8Array(buffer);
      const isZip = uint8Array.length > 2 && uint8Array[0] === 80 && uint8Array[1] === 75;
      const contentType = isZip ? "application/zip" : "application/pdf";
      const extension = isZip ? "zip" : "pdf";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename=etiqueta-${id}.${extension}`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error(`\u274C Erro ao baixar etiqueta ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: error.message || "Erro ao baixar etiqueta"
      });
    }
  });
  app.get("/api/ml/questions", async (req, res) => {
    try {
      const { status = "UNANSWERED", limit = 50 } = req.query;
      const result = await mlClient_default.getQuestions(status, Number(limit));
      console.log("\u{1F50D} Estrutura da primeira pergunta:", JSON.stringify(result.questions?.[0], null, 2));
      const enrichedQuestions = await Promise.all(
        (result.questions || []).map(async (q) => {
          try {
            const cached = mlItemCache.get(q.item_id);
            if (cached && Date.now() - cached.timestamp < ML_CACHE_TTL) {
              return {
                ...q,
                item_title: cached.data.titulo,
                item_thumbnail: cached.data.thumbnail,
                item_price: cached.data.preco
              };
            }
            const item = await mlClient_default.request(`/items/${q.item_id}`);
            const itemData = {
              id: item.id,
              titulo: item.title,
              preco: item.price,
              thumbnail: item.thumbnail
            };
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
            console.error(`\u26A0\uFE0F Erro ao buscar item ${q.item_id} para pergunta ${q.id}:`, err.message);
            return {
              ...q,
              item_title: "Item n\xE3o dispon\xEDvel",
              item_thumbnail: "",
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
    } catch (error) {
      console.error("\u274C Erro ao listar perguntas ML:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.post("/api/ml/questions/:id/answer", async (req, res) => {
    try {
      const { id } = req.params;
      const { answer } = req.body;
      const result = await mlClient_default.answerQuestion(parseInt(id), answer);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.post("/api/ml/cache/clear", (req, res) => {
    mlItemCache.clear();
    console.log("\u{1F9F9} Cache do Mercado Livre limpo manualmente");
    res.json({ success: true, message: "Cache limpo com sucesso" });
  });
  app.get("/api/ml/listings", async (req, res) => {
    try {
      const { status = "active", limit = 50, offset = 0, category, moto } = req.query;
      console.log(`\u{1F50D} Buscando an\xFAncios ML: status=${status}, limit=${limit}, offset=${offset}`);
      const listings = await mlClient_default.getListings(status, "date_desc", 1e3, 0);
      if (listings.results && listings.results.length > 0) {
        const allDetails = [];
        const idsToFetch = [];
        listings.results.forEach((id) => {
          const cached = mlItemCache.get(id);
          if (cached && Date.now() - cached.timestamp < ML_CACHE_TTL) {
            allDetails.push(cached.data);
          } else {
            idsToFetch.push(id);
          }
        });
        if (idsToFetch.length > 0) {
          console.log(`\u{1F4E1} Buscando detalhes de ${idsToFetch.length} itens no ML...`);
          const batchSize = 20;
          const batches = [];
          for (let i = 0; i < idsToFetch.length; i += batchSize) {
            batches.push(idsToFetch.slice(i, i + batchSize).join(","));
          }
          const fetchBatch = async (batchIds) => {
            try {
              const itemsResponse = await mlClient_default.request("/items", {
                params: { ids: batchIds, attributes: "id,title,price,thumbnail,status,permalink,pictures,date_created,available_quantity,sold_quantity" }
              });
              return itemsResponse.map((item) => {
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
                  fotos: body.pictures?.map((p) => p.url) || []
                };
                mlItemCache.set(formatted.id, { data: formatted, timestamp: Date.now() });
                return formatted;
              }).filter(Boolean);
            } catch (err) {
              console.error(`\u274C Erro ao buscar lote de itens ML:`, err);
              return [];
            }
          };
          const results = await Promise.all(batches.map((batch) => fetchBatch(batch)));
          results.forEach((batchResult) => allDetails.push(...batchResult));
        }
        const sortedDetails = listings.results.map((id) => allDetails.find((d) => d.id === id)).filter(Boolean);
        let filteredResults = sortedDetails;
        if (category && category !== "all") {
          const catStr = String(category).toLowerCase();
          filteredResults = filteredResults.filter(
            (item) => item.titulo.toLowerCase().includes(catStr)
          );
        }
        if (moto && moto !== "all") {
          const motoStr = String(moto).toLowerCase();
          filteredResults = filteredResults.filter(
            (item) => item.titulo.toLowerCase().includes(motoStr)
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
    } catch (error) {
      console.error("\u274C Erro ao buscar an\xFAncios ML:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.put("/api/ml/listings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      console.log(`\u{1F4DD} Recebida solicita\xE7\xE3o de atualiza\xE7\xE3o para o an\xFAncio ${id}:`, updateData);
      const result = await mlClient_default.updateListing(id, updateData);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error(`\u274C Erro ao atualizar an\xFAncio ${req.params.id}:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.get("/api/ml/sales", async (req, res) => {
    try {
      const trintaDiasAtras = /* @__PURE__ */ new Date();
      trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
      const userId = await mlClient_default.ensureUserId();
      console.log(`\u{1F4E1} Buscando vendas ML para o usu\xE1rio: ${userId}`);
      const recentOrdersPromise = mlClient_default.request(`/orders/search`, {
        params: {
          seller: userId,
          "order.date_created.from": trintaDiasAtras.toISOString().split(".")[0] + "-00:00",
          sort: "date_desc",
          limit: 15
        }
      });
      const pendingOrdersPromise = mlClient_default.request(`/orders/search`, {
        params: {
          seller: userId,
          "order.status": "paid",
          tags: "not_delivered",
          sort: "date_desc",
          limit: 15
        }
      }).catch((err) => {
        console.error("\u26A0\uFE0F Erro ao buscar ordens pendentes:", err.message);
        return { results: [] };
      });
      const readyToShipOrdersPromise = mlClient_default.request(`/orders/search`, {
        params: {
          seller: userId,
          "shipping.status": "ready_to_ship",
          sort: "date_desc",
          limit: 15
        }
      }).catch((err) => {
        console.error("\u26A0\uFE0F Erro ao buscar ordens prontas para envio:", err.message);
        return { results: [] };
      });
      const [recentOrdersResponse, pendingOrdersResponse, readyToShipOrdersResponse] = await Promise.all([
        recentOrdersPromise,
        pendingOrdersPromise,
        readyToShipOrdersPromise
      ]);
      const allOrders = [
        ...recentOrdersResponse.results || [],
        ...pendingOrdersResponse.results || [],
        ...readyToShipOrdersResponse.results || []
      ];
      const uniqueOrdersMap = /* @__PURE__ */ new Map();
      allOrders.forEach((order) => uniqueOrdersMap.set(order.id, order));
      const orders = Array.from(uniqueOrdersMap.values());
      const shippingIds = Array.from(new Set(orders.map((o) => o.shipping?.id).filter(Boolean)));
      const shipmentsMap = /* @__PURE__ */ new Map();
      if (shippingIds.length > 0) {
        try {
          console.log(`\u{1F69A} Buscando detalhes de ${shippingIds.length} envios com x-format-new em chunks...`);
          const chunkSize = 10;
          for (let i = 0; i < shippingIds.length; i += chunkSize) {
            const chunk = shippingIds.slice(i, i + chunkSize);
            const shipmentPromises = chunk.map(
              (id) => mlClient_default.request(`/shipments/${id}`, {
                headers: { "x-format-new": "true" }
              }).catch((err) => {
                console.error(`\u26A0\uFE0F Erro ao buscar envio ${id}:`, err.message);
                return null;
              })
            );
            const shipments = await Promise.all(shipmentPromises);
            shipments.forEach((s) => {
              if (s && s.id) {
                shipmentsMap.set(s.id, s);
              }
            });
            if (shippingIds.length > chunkSize) {
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }
        } catch (err) {
          console.error("\u26A0\uFE0F Erro ao buscar detalhes de envios:", err);
        }
      }
      const salesMap = /* @__PURE__ */ new Map();
      orders.forEach((order) => {
        if (salesMap.has(order.id)) return;
        const buyer = order.buyer || {};
        const nomeCliente = buyer.first_name && buyer.last_name ? `${buyer.first_name} ${buyer.last_name}` : buyer.nickname || "Cliente ML";
        const shipmentDetails = order.shipping?.id ? shipmentsMap.get(order.shipping.id) : null;
        const shippingStatus = shipmentDetails?.status || order.shipping?.status;
        const shippingSubstatus = shipmentDetails?.substatus || order.shipping?.substatus;
        if (order.id === 2000015614957750 || String(order.id) === "2000015614957750") {
          console.log(`\u{1F3AF} Venda Carca\xE7a CG 150 encontrada! Status: ${order.status}, Shipping Status: ${shippingStatus}, Substatus: ${shippingSubstatus}`);
        }
        let statusFinal = shippingStatus;
        if (shippingStatus === "ready_to_ship" || shippingStatus === "shipped" || shippingStatus === "delivered" || shippingStatus === "cancelled" || shippingStatus === "not_delivered") {
          statusFinal = shippingSubstatus ? `${shippingStatus}_${shippingSubstatus}` : shippingStatus;
        }
        const isCancelled = order.status === "cancelled" || shippingStatus === "cancelled" || shippingSubstatus === "cancelled_manually" || shippingSubstatus === "time_expired" || shippingSubstatus === "returning_to_sender";
        salesMap.set(order.id, {
          id: order.id,
          cliente: nomeCliente,
          nickname: buyer.nickname,
          valor: order.total_amount,
          data: order.date_created,
          status: order.status === "paid" ? "Pago" : order.status,
          shipping_status: statusFinal,
          shipping_substatus: shippingSubstatus,
          has_dispute: order.status_detail === "mediation" || order.tags?.includes("disputed"),
          itens: order.order_items?.map((i) => i.item?.title || i.item?.id || "Produto ML").join(", "),
          thumbnail: order.order_items?.[0]?.item?.thumbnail,
          shipping_id: order.shipping?.id,
          quantidade: order.order_items?.reduce((acc, item) => acc + (item.quantity || 1), 0) || 1,
          is_cancelled: isCancelled
        });
      });
      const salesData = Array.from(salesMap.values());
      console.log("\u{1F4E6} Sales data sent to frontend:", JSON.stringify(salesData.slice(0, 5), null, 2));
      res.json({ success: true, data: salesData });
    } catch (error) {
      console.error("\u274C Erro ao listar vendas ML:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  const storage2 = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir2 = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadDir2)) {
        fs.mkdirSync(uploadDir2, { recursive: true });
      }
      cb(null, uploadDir2);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });
  const upload = multer({
    storage: storage2,
    limits: { fileSize: 10 * 1024 * 1024 },
    // 10MB
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Apenas imagens s\xE3o permitidas"));
      }
    }
  });
  app.post("/api/upload/profile", autenticar, (req, res) => {
    upload.single("photo")(req, res, async (err) => {
      if (err) {
        console.error("\u274C Erro no multer (profile):", err);
        return res.status(400).json({ success: false, error: err.message });
      }
      try {
        const file = req.file;
        const userPhone = req.body.phone;
        if (!file) {
          return res.status(400).json({ success: false, error: "Nenhum arquivo enviado" });
        }
        if (!userPhone) {
          return res.status(400).json({ success: false, error: "N\xFAmero de telefone n\xE3o fornecido" });
        }
        const uploadDir2 = path.join(process.cwd(), "uploads", "profiles");
        if (!fs.existsSync(uploadDir2)) {
          fs.mkdirSync(uploadDir2, { recursive: true });
        }
        const ext = path.extname(file.originalname);
        const newFilename = `profile_${userPhone.replace(/\D/g, "")}${ext}`;
        const newPath = path.join(uploadDir2, newFilename);
        fs.renameSync(file.path, newPath);
        const baseUrl = process.env.APP_URL || `http://localhost:${PORT}`;
        const url = `${baseUrl}/uploads/profiles/${newFilename}`;
        console.log(`\u{1F464} Foto de perfil atualizada para ${userPhone}: ${url}`);
        res.json({
          success: true,
          url,
          message: "Foto de perfil atualizada com sucesso"
        });
      } catch (error) {
        console.error("\u274C Erro no processamento de upload de perfil:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  });
  app.post("/api/upload", (req, res) => {
    upload.array("files", 15)(req, res, async (err) => {
      if (err) {
        console.error("\u274C Erro no multer:", err);
        return res.status(400).json({
          success: false,
          error: err.message || "Erro ao processar arquivos"
        });
      }
      try {
        const files = req.files;
        if (!files || files.length === 0) {
          return res.status(400).json({ success: false, error: "Nenhum arquivo enviado" });
        }
        const baseUrl = process.env.APP_URL || `http://localhost:${PORT}`;
        console.log(`\u{1F680} Upload de ${files.length} arquivos. BaseURL: ${baseUrl}`);
        const urls = files.map((file) => ({
          filename: file.filename,
          url: `${baseUrl}/uploads/${file.filename}`
        }));
        res.json({
          success: true,
          urls: urls.map((u) => u.url),
          message: `${files.length} arquivo(s) enviado(s) com sucesso`
        });
      } catch (error) {
        console.error("\u274C Erro no processamento de upload:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  });
  app.post("/api/frete/calculate", async (req, res) => {
    console.log("Recebida requisi\xE7\xE3o de frete:", req.body);
    console.log("Token presente:", !!process.env.MELHOR_ENVIO_TOKEN);
    try {
      const { cep_origem, cep_destino, peso, largura, altura, comprimento } = req.body;
      const token = process.env.MELHOR_ENVIO_TOKEN || process.env.MELHOR_ENVIO_TO;
      console.log("Token utilizado:", token ? "Token presente" : "Token ausente");
      const response = await axios2.post("https://melhorenvio.com.br/api/v2/me/shipment/calculate", {
        from: { postal_code: cep_origem },
        to: { postal_code: cep_destino },
        products: [{
          id: "sucata1",
          weight: parseFloat(peso),
          width: parseFloat(largura),
          height: parseFloat(altura),
          length: parseFloat(comprimento),
          insurance_value: 0,
          quantity: 1
        }],
        options: {
          insurance_value: 0,
          receipt: false,
          own_hand: false
        }
      }, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "RK Sucatas (contato@rksucatas.com.br)"
        }
      });
      res.json({ success: true, data: response.data });
    } catch (error) {
      console.error("\u274C Erro detalhado ao calcular frete:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      res.status(500).json({ success: false, error: error.response?.data?.message || error.message });
    }
  });
  app.post("/api/storage/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "Nenhum arquivo enviado" });
      }
      console.log(`\u{1F680} Recebido arquivo para upload direto para GCS: ${req.file.filename}`);
      const publicUrl = await storageService_default.uploadFile(
        req.file.path,
        req.file.filename,
        req.file.mimetype
      );
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error("Erro ao deletar arquivo tempor\xE1rio:", e);
      }
      res.json({
        success: true,
        data: {
          publicUrl,
          filename: req.file.filename
        }
      });
    } catch (error) {
      console.error("\u274C Erro no upload direto para GCS:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.post("/api/storage/request-upload", async (req, res) => {
    try {
      const { filename, fileType } = req.body;
      console.log(` Generating upload URL for: ${filename} (${fileType}) in bucket: ${process.env.GCS_BUCKET_NAME || "rksucatas"}`);
      const uploadData = await storageService_default.generateUploadUrl(filename, fileType);
      console.log("\u2705 Upload URL generated successfully");
      res.json({
        success: true,
        data: uploadData
      });
    } catch (error) {
      if (error.message.includes("IAM Service Account Credentials API")) {
        console.log("\u2139\uFE0F Info: API de Assinatura de URL desativada no GCP. O sistema usar\xE1 o fallback de upload direto automaticamente.");
      } else {
        console.error("\u274C Erro ao gerar URL de upload:", error.message);
      }
      res.status(500).json({ success: false, error: "URL signing unavailable" });
    }
  });
  app.delete("/api/storage/files/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      await storageService_default.deleteFile(filename);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.use("/uploads", (req, res, next) => {
    const filePath = path.join(process.cwd(), "uploads", req.path);
    if (!fs.existsSync(filePath)) {
      console.error(`\u26A0\uFE0F Arquivo n\xE3o encontrado em /uploads: ${req.path}`);
    }
    next();
  }, express.static(path.join(process.cwd(), "uploads")));
  function formatInventoryItem(page) {
    const props = page.properties;
    console.log("\n\u{1F4C4} Processando p\xE1gina. Propriedades dispon\xEDveis:", Object.keys(props));
    const result = {
      id: page.id,
      rk_id: "-",
      nome: "-",
      categoria: "-",
      moto: "-",
      ano: "-",
      valor: 0,
      estoque: 0,
      imagem: "",
      ml_link: "",
      descricao: "",
      criado_em: page.created_time
    };
    for (const [key, prop] of Object.entries(props)) {
      const value = prop;
      const lowerKey = key.toLowerCase();
      console.log(`  \u{1F511} Propriedade: "${key}" (tipo: ${value.type})`);
      try {
        if (value.type === "title" && value.title?.[0]?.plain_text) {
          result.nome = value.title[0].plain_text;
          console.log(`    \u2192 NOME encontrado: "${result.nome}"`);
        } else if (value.type === "number") {
          if (lowerKey.includes("valor") || lowerKey.includes("pre\xE7o") || lowerKey.includes("preco")) {
            result.valor = value.number || 0;
            console.log(`    \u2192 VALOR encontrado: ${result.valor}`);
          } else if (lowerKey.includes("estoque") || lowerKey.includes("quant")) {
            result.estoque = value.number || 0;
            console.log(`    \u2192 ESTOQUE encontrado: ${result.estoque}`);
          } else if (lowerKey.includes("ano")) {
            result.ano = value.number;
          }
        } else if (value.type === "formula") {
          const formulaValue = value.formula?.number || value.formula?.string || 0;
          if (lowerKey.includes("valor") || lowerKey.includes("pre\xE7o") || lowerKey.includes("preco")) {
            result.valor = Number(formulaValue) || 0;
            console.log(`    \u2192 VALOR (f\xF3rmula) encontrado: ${result.valor}`);
          } else if (lowerKey.includes("estoque") || lowerKey.includes("quant")) {
            result.estoque = Number(formulaValue) || 0;
            console.log(`    \u2192 ESTOQUE (f\xF3rmula) encontrado: ${result.estoque}`);
          }
        } else if (value.type === "rich_text" && value.rich_text?.[0]?.plain_text) {
          const text = value.rich_text[0].plain_text;
          if (lowerKey.includes("desc") || lowerKey.includes("obs")) {
            result.descricao = text;
          } else if (lowerKey.includes("ano")) {
            result.ano = text;
          } else if ((lowerKey.includes("valor") || lowerKey.includes("pre\xE7o") || lowerKey.includes("preco")) && result.valor === 0) {
            const cleaned = text.replace(/[^\d,.-]/g, "").replace(",", ".");
            result.valor = parseFloat(cleaned) || 0;
            if (result.valor > 0) console.log(`    \u2192 VALOR (texto) extra\xEDdo: ${result.valor}`);
          } else if ((lowerKey.includes("estoque") || lowerKey.includes("quant")) && result.estoque === 0) {
            result.estoque = parseInt(text.replace(/[^\d]/g, "")) || 0;
            if (result.estoque > 0) console.log(`    \u2192 ESTOQUE (texto) extra\xEDdo: ${result.estoque}`);
          }
        } else if (value.type === "select" && value.select?.name) {
          if (lowerKey.includes("moto")) {
            result.moto = value.select.name;
            console.log(`    \u2192 MOTO encontrada: "${result.moto}"`);
          }
        } else if (value.type === "multi_select" && value.multi_select?.length > 0) {
          if (lowerKey.includes("categoria") || lowerKey.includes("cat")) {
            result.categoria = value.multi_select.map((s) => s.name).join(", ");
            console.log(`    \u2192 CATEGORIA encontrada: "${result.categoria}"`);
          }
        } else if (value.type === "unique_id" && value.unique_id) {
          const prefix = value.unique_id.prefix ? `${value.unique_id.prefix}-` : "";
          result.rk_id = `${prefix}${value.unique_id.number}`;
          console.log(`    \u2192 RK_ID encontrado: "${result.rk_id}"`);
        } else if (value.type === "files" && value.files?.[0]) {
          const file = value.files[0];
          result.imagem = file.file?.url || file.external?.url || "";
          console.log(`    \u2192 IMAGEM encontrada`);
        } else if (value.type === "url" && value.url) {
          if (lowerKey.includes("ml") || lowerKey.includes("link") || lowerKey.includes("mercadolivre")) {
            result.ml_link = value.url;
            console.log(`    \u2192 ML_LINK encontrado`);
          }
        }
      } catch (e) {
        console.error(`    \u274C Erro ao processar ${key}:`, e);
      }
    }
    if (result.nome === "-") {
      for (const [key, prop] of Object.entries(props)) {
        const value = prop;
        if (value.type === "title" && value.title?.[0]?.plain_text) {
          result.nome = value.title[0].plain_text;
          console.log(`    \u2192 NOME (fallback) encontrado em "${key}": "${result.nome}"`);
          break;
        }
      }
    }
    return result;
  }
  function formatMotosItem(page) {
    const props = page.properties;
    console.log(`
\u{1F3CD}\uFE0F Formatando Moto: ${page.id}`);
    const titleProp = Object.values(props).find((p) => p.type === "title");
    const nome = titleProp?.title?.[0]?.plain_text || "-";
    const result = {
      id: page.id,
      nome,
      marca: "-",
      modelo: "-",
      ano: "-",
      rk_id: "-",
      cilindrada: "-",
      lote: "-",
      nome_nf: "-",
      pecas_retiradas: "-",
      status: "-",
      valor: 0,
      cor: "-",
      descricao: "",
      imagem: "",
      imagens: [],
      criado_em: page.created_time
    };
    for (const [key, prop] of Object.entries(props)) {
      const value = prop;
      const lowerKey = key.toLowerCase();
      if (value.type === "rich_text") {
        const text = value.rich_text?.[0]?.plain_text || "-";
        if (lowerKey === "marca") result.marca = text;
        else if (lowerKey === "modelo") result.modelo = text;
        else if (lowerKey === "cor") result.cor = text;
        else if (lowerKey === "observa\xE7\xF5es" || lowerKey === "observacoes" || lowerKey === "descri\xE7\xE3o") result.descricao = text;
        else if (lowerKey === "nome nf") result.nome_nf = text;
        else if (lowerKey === "pe\xE7as retiradas" || lowerKey === "pecas retiradas") result.pecas_retiradas = text;
      } else if (value.type === "number") {
        if (lowerKey === "valor") result.valor = value.number || 0;
        else if (lowerKey === "cilindrada") result.cilindrada = value.number || 0;
        else if (lowerKey === "ano") result.ano = value.number?.toString() || "-";
      } else if (value.type === "select" && value.select) {
        if (lowerKey === "lote") result.lote = value.select.name;
      } else if (value.type === "status" && value.status) {
        if (lowerKey === "status") result.status = value.status.name;
      } else if (value.type === "files") {
        const urls = value.files.map((file) => file.file?.url || file.external?.url || "").filter(Boolean);
        if (urls.length > 0) {
          result.imagens = urls;
          if (!result.imagem) result.imagem = urls[0];
        }
      } else if (value.type === "unique_id" && value.unique_id) {
        if (lowerKey === "id") {
          result.rk_id = `${value.unique_id.prefix ? value.unique_id.prefix + "-" : ""}${value.unique_id.number}`;
        }
      }
    }
    if (result.nome === "-" && result.modelo !== "-") {
      result.nome = result.modelo;
    }
    return result;
  }
  function formatSalesItem(page) {
    const props = page.properties;
    const result = {
      id: page.id,
      nome: "-",
      moto: "-",
      valor: 0,
      data: page.created_time,
      numero_id: "-"
    };
    const titlePropName = Object.keys(props).find((key) => props[key].type === "title");
    if (titlePropName && props[titlePropName].title?.[0]?.plain_text) {
      result.nome = props[titlePropName].title[0].plain_text;
    }
    for (const [key, prop] of Object.entries(props)) {
      const value = prop;
      const lowerKey = key.toLowerCase();
      if (value.type === "rich_text" && value.rich_text?.[0]?.plain_text) {
        const text = value.rich_text[0].plain_text;
        if (lowerKey.includes("moto")) {
          result.moto = text;
        } else if ((lowerKey.includes("nome") || lowerKey.includes("pe\xE7a")) && !lowerKey.includes("obs")) {
          result.nome = text;
        }
      } else if (value.type === "number" && (lowerKey.includes("valor") || lowerKey.includes("pre\xE7o"))) {
        result.valor = value.number || 0;
      } else if (value.type === "formula" && (lowerKey.includes("valor") || lowerKey.includes("pre\xE7o"))) {
        result.valor = Number(value.formula?.number || value.formula?.string || 0) || 0;
      } else if (value.type === "date" && value.date?.start) {
        result.data = value.date.start;
      } else if (value.type === "unique_id" && value.unique_id) {
        const prefix = value.unique_id.prefix ? `${value.unique_id.prefix}-` : "";
        result.numero_id = `${prefix}${value.unique_id.number}`;
      } else if (value.type === "select" && value.select) {
        if (lowerKey.includes("tipo") || lowerKey.includes("pagamento") || lowerKey.includes("forma")) {
          result.tipo = value.select.name;
        } else if (lowerKey.includes("moto")) {
          result.moto = value.select.name;
        }
      }
    }
    return result;
  }
  app.get("/api/clients", async (req, res) => {
    try {
      const results = await fetchAllFromNotion(CLIENTS_DATABASE_ID);
      if (results.length > 0) {
        console.log("\u{1F4C4} Exemplo de propriedades do cliente no Notion:", JSON.stringify(results[0].properties, null, 2));
      }
      const clients = results.map((page) => {
        const p = page.properties;
        return {
          id: page.id,
          nome: p.Nome?.title?.[0]?.plain_text || "",
          numero: p["N\xFAmero"]?.phone_number || "",
          cpf: p.CPF?.number?.toString() || "",
          senha: p.Senha?.rich_text?.[0]?.plain_text || "",
          itensComprados: p["Itens comprados"]?.rich_text?.[0]?.plain_text || "",
          interesses: p["Interesses"]?.multi_select?.map((m) => m.name) || [],
          userId: p.ID?.unique_id ? p.ID.unique_id.prefix ? `${p.ID.unique_id.prefix}-${p.ID.unique_id.number}` : p.ID.unique_id.number.toString() : ""
        };
      });
      res.json({ success: true, data: clients });
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.post("/api/clients", async (req, res) => {
    try {
      const { nome, numero, cpf, itensComprados, senha, interesses } = req.body;
      console.log("\u{1F4DD} Criando novo cliente no Notion...", { nome, numero });
      const hashedPassword = senha ? await bcrypt.hash(senha, 10) : "";
      const response = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VERSION
        },
        body: JSON.stringify({
          parent: { database_id: CLIENTS_DATABASE_ID },
          properties: {
            Nome: { title: [{ text: { content: nome || "" } }] },
            "N\xFAmero": { phone_number: numero || "" },
            "CPF": { number: cpf ? Number(String(cpf).replace(/\D/g, "")) : 0 },
            Senha: { rich_text: [{ text: { content: hashedPassword } }] },
            "Itens comprados": { rich_text: [{ text: { content: itensComprados || "" } }] },
            "Interesses": { multi_select: (interesses || []).map((name) => ({ name })) },
            Tipo: { select: { name: "CLIENTE" } }
          }
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("\u274C Erro ao criar cliente no Notion:", errorText);
        let errorMessage = "Erro ao criar cliente no Notion";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = `Erro Notion: ${errorJson.message || errorText}`;
        } catch (e) {
          errorMessage = `Erro Notion: ${errorText}`;
        }
        throw new Error(errorMessage);
      }
      invalidateCache(CLIENTS_DATABASE_ID);
      console.log("\u2705 Cliente criado com sucesso no Notion.");
      res.json({ success: true });
    } catch (error) {
      console.error("\u274C Erro na rota POST /api/clients:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.put("/api/clients/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { nome, numero, cpf, itensComprados, senha, interesses } = req.body;
      console.log(`\u{1F4DD} Atualizando cliente ${id} no Notion...`);
      const properties = {
        Nome: { title: [{ text: { content: nome || "" } }] },
        "N\xFAmero": { phone_number: numero || "" },
        "CPF": { number: cpf ? Number(String(cpf).replace(/\D/g, "")) : 0 },
        "Itens comprados": { rich_text: [{ text: { content: itensComprados || "" } }] },
        "Interesses": { multi_select: (interesses || []).map((name) => ({ name })) }
      };
      if (senha) {
        const hashedPassword = senha.startsWith("$2b$") ? senha : await bcrypt.hash(senha, 10);
        properties.Senha = { rich_text: [{ text: { content: hashedPassword } }] };
      }
      const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VERSION
        },
        body: JSON.stringify({ properties })
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error("\u274C Erro ao atualizar cliente no Notion:", errorData);
        throw new Error(`Erro no Notion: ${errorData.message || "Erro desconhecido"}`);
      }
      invalidateCache(CLIENTS_DATABASE_ID);
      console.log(`\u2705 Cliente ${id} atualizado com sucesso.`);
      res.json({ success: true });
    } catch (error) {
      console.error("\u274C Erro na rota PUT /api/clients/:id:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.delete("/api/clients/:id", async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`\u{1F5D1}\uFE0F Deletando cliente ${id} no Notion...`);
      const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VERSION
        },
        body: JSON.stringify({ archived: true })
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error("\u274C Erro ao deletar cliente no Notion:", errorData);
        throw new Error(`Erro no Notion: ${errorData.message || "Erro desconhecido"}`);
      }
      invalidateCache(CLIENTS_DATABASE_ID);
      console.log(`\u2705 Cliente ${id} deletado com sucesso.`);
      res.json({ success: true });
    } catch (error) {
      console.error("\u274C Erro na rota DELETE /api/clients/:id:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.get("/api/inventory", async (req, res) => {
    console.log("\u{1F50D} Acessando /api/inventory");
    try {
      const force = req.query.force === "true";
      if (force) invalidateCache(DATABASE_ID);
      const allItems = await fetchAllFromNotion(DATABASE_ID);
      const formattedData = allItems.map(formatInventoryItem);
      res.json({ success: true, data: formattedData, total: allItems.length });
    } catch (error) {
      console.error("Notion API Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.get("/api/notion/categories", async (req, res) => {
    try {
      const dbData = await getCachedDbStructure(DATABASE_ID);
      const dbProps = dbData.properties;
      let catProp = Object.entries(dbProps).find(
        ([key, prop]) => key.toLowerCase().includes("categoria") || key.toLowerCase().includes("cat")
      );
      if (catProp && catProp[1].type === "multi_select") {
        const options = catProp[1].multi_select.options.map((opt) => opt.name);
        res.json({ success: true, data: options.sort() });
      } else {
        res.json({ success: true, data: [] });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.get("/api/notion/motos", async (req, res) => {
    try {
      const allMotos = await fetchAllFromNotion(MOTOS_DATABASE_ID);
      const formattedMotos = allMotos.map(formatMotosItem);
      const motoNames = Array.from(new Set(formattedMotos.map((m) => m.nome))).filter(Boolean);
      res.json({ success: true, data: motoNames.sort() });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.post("/api/inventory", async (req, res) => {
    try {
      const { nome, categoria, moto, valor, estoque, ano, descricao, ml_link } = req.body;
      const dbData = await getCachedDbStructure(DATABASE_ID);
      const dbProps = dbData.properties;
      let nameProp = "Pe\xE7a";
      let catProp = "Categoria";
      let motoProp = "Moto";
      let valorProp = "Valor";
      let estoqueProp = "Estoque";
      let anoProp = "Ano";
      let descProp = "Descri\xE7\xE3o";
      let mlProp = "ML LINK";
      let imgProp = "Imagem";
      for (const [key, prop] of Object.entries(dbProps)) {
        const p = prop;
        const lowerKey = key.toLowerCase();
        if (p.type === "title") nameProp = key;
        else if (lowerKey.includes("categoria") || lowerKey.includes("cat")) catProp = key;
        else if (lowerKey.includes("moto")) motoProp = key;
        else if (lowerKey.includes("valor") || lowerKey.includes("pre\xE7o")) valorProp = key;
        else if (lowerKey.includes("estoque") || lowerKey.includes("quant")) estoqueProp = key;
        else if (lowerKey.includes("ano")) anoProp = key;
        else if (lowerKey.includes("desc") || lowerKey.includes("obs")) descProp = key;
        else if (lowerKey.includes("ml") || lowerKey.includes("link")) mlProp = key;
        else if (lowerKey.includes("img") || lowerKey.includes("foto")) imgProp = key;
      }
      const properties = {
        [nameProp]: {
          title: [{ text: { content: nome } }]
        }
      };
      if (catProp && dbProps[catProp] && dbProps[catProp].type === "multi_select" && categoria) {
        properties[catProp] = { multi_select: [{ name: categoria }] };
      }
      if (motoProp && dbProps[motoProp] && dbProps[motoProp].type === "select" && moto) {
        properties[motoProp] = { select: { name: moto } };
      }
      if (valorProp && dbProps[valorProp] && dbProps[valorProp].type === "number") {
        properties[valorProp] = { number: Number(valor) };
      }
      if (estoqueProp && dbProps[estoqueProp] && dbProps[estoqueProp].type === "number") {
        properties[estoqueProp] = { number: Number(estoque) };
      }
      if (anoProp && dbProps[anoProp]) {
        if (dbProps[anoProp].type === "rich_text") {
          properties[anoProp] = { rich_text: [{ text: { content: ano || "" } }] };
        } else if (dbProps[anoProp].type === "number") {
          properties[anoProp] = { number: Number(ano) };
        }
      }
      if (descProp && dbProps[descProp] && dbProps[descProp].type === "rich_text") {
        properties[descProp] = { rich_text: [{ text: { content: descricao || "" } }] };
      }
      if (mlProp && dbProps[mlProp] && dbProps[mlProp].type === "url") {
        properties[mlProp] = { url: ml_link || null };
      }
      if (imgProp && dbProps[imgProp] && dbProps[imgProp].type === "files" && req.body.imagem) {
        const imagem = req.body.imagem;
        const isNotionUrl = imagem && (imagem.includes("s3.us-west-2.amazonaws.com") || imagem.includes("notion-static.com"));
        if (imagem && (imagem.startsWith("http://") || imagem.startsWith("https://")) && !isNotionUrl) {
          properties[imgProp] = {
            files: [{
              name: "Imagem",
              type: "external",
              external: { url: imagem }
            }]
          };
        }
      }
      const response = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VERSION
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
    } catch (error) {
      console.error("Create Item Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.patch("/api/inventory/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { nome, categoria, moto, valor, estoque, ano, descricao, ml_link, imagem } = req.body;
      console.log(`\u{1F4DD} Editando item ${id}:`, { nome, categoria, moto, valor, estoque, ano, descricao, ml_link, imagem });
      const dbData = await getCachedDbStructure(DATABASE_ID);
      const dbProps = dbData.properties;
      let nameProp = "Pe\xE7a";
      let catProp = "Categoria";
      let motoProp = "Moto";
      let valorProp = "Valor";
      let estoqueProp = "Estoque";
      let anoProp = "Ano";
      let descProp = "Descri\xE7\xE3o";
      let mlProp = "ML LINK";
      let imgProp = "Imagem";
      for (const [key, prop] of Object.entries(dbProps)) {
        const p = prop;
        const lowerKey = key.toLowerCase();
        if (p.type === "title") nameProp = key;
        else if (lowerKey.includes("categoria") || lowerKey.includes("cat")) catProp = key;
        else if (lowerKey.includes("moto")) motoProp = key;
        else if (lowerKey.includes("valor") || lowerKey.includes("pre\xE7o")) valorProp = key;
        else if (lowerKey.includes("estoque") || lowerKey.includes("quant")) estoqueProp = key;
        else if (lowerKey.includes("ano")) anoProp = key;
        else if (lowerKey.includes("desc") || lowerKey.includes("obs")) descProp = key;
        else if (lowerKey.includes("ml") || lowerKey.includes("link")) mlProp = key;
        else if (lowerKey.includes("img") || lowerKey.includes("foto")) imgProp = key;
      }
      const properties = {};
      if (nome !== void 0) {
        properties[nameProp] = { title: [{ text: { content: nome } }] };
      }
      if (catProp && dbProps[catProp] && dbProps[catProp].type === "multi_select" && categoria !== void 0) {
        properties[catProp] = { multi_select: categoria ? [{ name: categoria }] : [] };
      }
      if (motoProp && dbProps[motoProp] && dbProps[motoProp].type === "select" && moto !== void 0) {
        properties[motoProp] = { select: moto ? { name: moto } : null };
      }
      if (valorProp && dbProps[valorProp] && dbProps[valorProp].type === "number" && valor !== void 0) {
        properties[valorProp] = { number: Number(valor) };
      }
      if (estoqueProp && dbProps[estoqueProp] && dbProps[estoqueProp].type === "number" && estoque !== void 0) {
        properties[estoqueProp] = { number: Number(estoque) };
      }
      if (anoProp && dbProps[anoProp] && ano !== void 0) {
        if (dbProps[anoProp].type === "rich_text") {
          properties[anoProp] = { rich_text: [{ text: { content: String(ano) || "" } }] };
        } else if (dbProps[anoProp].type === "number") {
          properties[anoProp] = { number: Number(ano) };
        }
      }
      if (descProp && dbProps[descProp] && dbProps[descProp].type === "rich_text" && descricao !== void 0) {
        properties[descProp] = { rich_text: [{ text: { content: descricao || "" } }] };
      }
      if (mlProp && dbProps[mlProp] && dbProps[mlProp].type === "url" && ml_link !== void 0) {
        properties[mlProp] = { url: ml_link || null };
      }
      if (imgProp && dbProps[imgProp] && dbProps[imgProp].type === "files" && imagem !== void 0) {
        const isNotionUrl = imagem && (imagem.includes("s3.us-west-2.amazonaws.com") || imagem.includes("notion-static.com"));
        if (imagem && (imagem.startsWith("http://") || imagem.startsWith("https://")) && !isNotionUrl) {
          properties[imgProp] = {
            files: [{
              name: "Imagem",
              type: "external",
              external: { url: imagem }
            }]
          };
        } else if (!imagem) {
          properties[imgProp] = { files: [] };
        }
      }
      const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VERSION
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
    } catch (error) {
      console.error("Update Item Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/inventory/bulk-delete", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ success: false, error: "IDs inv\xE1lidos" });
      }
      console.log(`\u{1F5D1}\uFE0F Excluindo em massa ${ids.length} itens`);
      const deletePromises = ids.map(
        (id) => fetch(`https://api.notion.com/v1/pages/${id}`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${NOTION_TOKEN}`,
            "Content-Type": "application/json",
            "Notion-Version": NOTION_VERSION
          },
          body: JSON.stringify({ archived: true })
        })
      );
      const results = await Promise.all(deletePromises);
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        console.error(`\u274C Falha ao excluir ${failed.length} itens`);
      }
      invalidateCache(DATABASE_ID);
      res.json({ success: true, deletedCount: ids.length - failed.length, failedCount: failed.length });
    } catch (error) {
      console.error("Bulk Delete Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.delete("/api/inventory/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VERSION
        },
        body: JSON.stringify({ archived: true })
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Notion API error: ${error}`);
      }
      invalidateCache(DATABASE_ID);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete Item Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.post("/api/inventory/bulk-update-stock", async (req, res) => {
    try {
      const { ids, amount } = req.body;
      console.log(`\u{1F4E6} Atualizando estoque em massa: ${amount} para ${ids.length} itens`);
      const updatePromises = ids.map(async (id) => {
        const getRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
          headers: {
            "Authorization": `Bearer ${NOTION_TOKEN}`,
            "Notion-Version": NOTION_VERSION
          }
        });
        if (!getRes.ok) return;
        const page = await getRes.json();
        let stockPropName = "Estoque";
        for (const key of Object.keys(page.properties)) {
          if (key.toLowerCase().includes("estoque") || key.toLowerCase().includes("quant")) {
            stockPropName = key;
            break;
          }
        }
        const currentStock = page.properties[stockPropName]?.number || 0;
        const newStock = Math.max(0, currentStock + amount);
        return fetch(`https://api.notion.com/v1/pages/${id}`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${NOTION_TOKEN}`,
            "Content-Type": "application/json",
            "Notion-Version": NOTION_VERSION
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
    } catch (error) {
      console.error("Bulk Update Stock Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.post("/api/inventory/bulk-update-category", async (req, res) => {
    try {
      const { ids, categoria } = req.body;
      console.log(`\u{1F3F7}\uFE0F Atualizando categoria em massa: "${categoria}" para ${ids.length} itens`);
      const updatePromises = ids.map(async (id) => {
        const getRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
          headers: {
            "Authorization": `Bearer ${NOTION_TOKEN}`,
            "Notion-Version": NOTION_VERSION
          }
        });
        if (!getRes.ok) return;
        const page = await getRes.json();
        let catPropName = "Categoria";
        for (const key of Object.keys(page.properties)) {
          if (key.toLowerCase().includes("categoria") || key.toLowerCase().includes("cat")) {
            catPropName = key;
            break;
          }
        }
        return fetch(`https://api.notion.com/v1/pages/${id}`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${NOTION_TOKEN}`,
            "Content-Type": "application/json",
            "Notion-Version": NOTION_VERSION
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
    } catch (error) {
      console.error("Bulk Update Category Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.post("/api/sales", async (req, res) => {
    try {
      const { nome, moto, valor, tipo, data } = req.body;
      const dbData = await getCachedDbStructure(salesDbId);
      const dbProps = dbData.properties;
      let nameProp = "";
      let motoProp = "";
      let valorProp = "";
      let tipoProp = "";
      let dataProp = "";
      let fallbackNameProp = "";
      for (const [key, prop] of Object.entries(dbProps)) {
        const p = prop;
        const lowerKey = key.toLowerCase();
        if (p.type === "title") {
          nameProp = key;
        } else if (lowerKey.includes("moto")) {
          motoProp = key;
        } else if (lowerKey.includes("valor") || lowerKey.includes("pre\xE7o")) {
          valorProp = key;
        } else if (lowerKey.includes("tipo") || lowerKey.includes("pagamento") || lowerKey.includes("forma")) {
          tipoProp = key;
        } else if (lowerKey.includes("data")) {
          dataProp = key;
        } else if (p.type === "rich_text" && (lowerKey.includes("nome") || lowerKey.includes("pe\xE7a"))) {
          fallbackNameProp = key;
        }
      }
      if (!nameProp) {
        nameProp = Object.keys(dbProps).find((k) => dbProps[k].type === "title") || "Pe\xE7a";
      }
      const properties = {
        [nameProp]: {
          title: [{ text: { content: nome || "-" } }]
        }
      };
      if (fallbackNameProp && fallbackNameProp !== nameProp) {
        properties[fallbackNameProp] = { rich_text: [{ text: { content: nome || "-" } }] };
      }
      if (motoProp && dbProps[motoProp] && motoProp !== nameProp) {
        if (dbProps[motoProp].type === "rich_text") {
          properties[motoProp] = { rich_text: [{ text: { content: moto || "" } }] };
        } else if (dbProps[motoProp].type === "select" && moto) {
          properties[motoProp] = { select: { name: moto } };
        }
      }
      if (valorProp && dbProps[valorProp] && dbProps[valorProp].type === "number") {
        properties[valorProp] = { number: Number(valor) };
      }
      if (tipoProp && dbProps[tipoProp] && dbProps[tipoProp].type === "select") {
        properties[tipoProp] = { select: { name: tipo } };
      }
      if (dataProp && dbProps[dataProp] && dbProps[dataProp].type === "date") {
        properties[dataProp] = { date: { start: data || (/* @__PURE__ */ new Date()).toISOString() } };
      }
      const response = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VERSION
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
    } catch (error) {
      console.error("Create Sale Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.patch("/api/sales/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { nome, moto, valor, tipo, data } = req.body;
      const dbData = await getCachedDbStructure(salesDbId);
      const dbProps = dbData.properties;
      let nameProp = "";
      let motoProp = "";
      let valorProp = "";
      let tipoProp = "";
      let dataProp = "";
      let fallbackNameProp = "";
      for (const [key, prop] of Object.entries(dbProps)) {
        const p = prop;
        const lowerKey = key.toLowerCase();
        if (p.type === "title") nameProp = key;
        else if (lowerKey.includes("moto")) motoProp = key;
        else if (lowerKey.includes("valor") || lowerKey.includes("pre\xE7o")) valorProp = key;
        else if (lowerKey.includes("tipo") || lowerKey.includes("pagamento") || lowerKey.includes("forma")) tipoProp = key;
        else if (lowerKey.includes("data")) dataProp = key;
        else if (p.type === "rich_text" && (lowerKey.includes("nome") || lowerKey.includes("pe\xE7a"))) fallbackNameProp = key;
      }
      const properties = {};
      if (nameProp) {
        properties[nameProp] = { title: [{ text: { content: nome || "-" } }] };
      }
      if (fallbackNameProp && fallbackNameProp !== nameProp) {
        properties[fallbackNameProp] = { rich_text: [{ text: { content: nome || "-" } }] };
      }
      if (motoProp && dbProps[motoProp] && motoProp !== nameProp) {
        if (dbProps[motoProp].type === "rich_text") {
          properties[motoProp] = { rich_text: [{ text: { content: moto || "" } }] };
        } else if (dbProps[motoProp].type === "select" && moto) {
          properties[motoProp] = { select: { name: moto } };
        }
      }
      if (valorProp && dbProps[valorProp] && dbProps[valorProp].type === "number") {
        properties[valorProp] = { number: Number(valor) };
      }
      if (tipoProp && dbProps[tipoProp] && dbProps[tipoProp].type === "select") {
        properties[tipoProp] = { select: { name: tipo } };
      }
      if (dataProp && dbProps[dataProp] && dbProps[dataProp].type === "date") {
        properties[dataProp] = { date: { start: data || (/* @__PURE__ */ new Date()).toISOString() } };
      }
      const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VERSION
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
    } catch (error) {
      console.error("Update Sale Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.delete("/api/sales/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VERSION
        },
        body: JSON.stringify({ archived: true })
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Notion API error: ${error}`);
      }
      const salesDbId2 = process.env.DATABASE_VENDAS_ID || "";
      invalidateCache(salesDbId2);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete Sale Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.post("/api/sales/bulk-delete", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ success: false, error: "IDs inv\xE1lidos" });
      }
      const deletePromises = ids.map(
        (id) => fetch(`https://api.notion.com/v1/pages/${id}`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${NOTION_TOKEN}`,
            "Content-Type": "application/json",
            "Notion-Version": NOTION_VERSION
          },
          body: JSON.stringify({ archived: true })
        })
      );
      await Promise.all(deletePromises);
      const salesDbId2 = process.env.DATABASE_VENDAS_ID || process.env.NOTION_DB_VENDAS || "";
      invalidateCache(salesDbId2);
      res.json({ success: true });
    } catch (error) {
      console.error("Bulk Delete Sales Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.get("/api/sales", async (req, res) => {
    try {
      const force = req.query.force === "true";
      if (force) {
        invalidateCache(salesDbId);
      }
      console.log(`\u{1F4CA} Consultando banco de vendas: ${salesDbId}`);
      const allItems = await fetchAllFromNotion(salesDbId);
      const formattedData = allItems.map(formatSalesItem);
      console.log(`\u2705 Encontradas ${allItems.length} vendas`);
      res.json({ success: true, data: formattedData, total: allItems.length });
    } catch (error) {
      console.error("Sales API Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.post("/api/ai/ask", async (req, res) => {
    try {
      const { pergunta } = req.body;
      console.log(`
\u{1F916} IA Assistant: "${pergunta}"`);
      const PORT2 = Number(process.env.PORT) || 3e3;
      const [inventoryRes, salesRes] = await Promise.all([
        fetch(`http://127.0.0.1:${PORT2}/api/inventory`),
        fetch(`http://127.0.0.1:${PORT2}/api/sales`)
      ]);
      const inventory = await inventoryRes.json();
      const sales = await salesRes.json();
      const contexto = {
        estoque: inventory.data || [],
        vendas: sales.data || [],
        totalItens: inventory.total || 0,
        totalVendas: sales.total || 0
      };
      console.log("\u{1F511} Verificando chave Gemini...");
      const apiKey = config.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      console.log("\u{1F511} Chave presente:", !!apiKey);
      console.log("\u{1F511} Primeiros caracteres:", apiKey?.substring(0, 4));
      let iaResponse = null;
      let useFallback = false;
      let fallbackReason = "";
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        console.error("\u274C GEMINI_API_KEY n\xE3o configurada");
        useFallback = true;
        fallbackReason = "A chave da API do Gemini n\xE3o est\xE1 configurada no servidor.";
      } else {
        try {
          const { GoogleGenAI, Type } = await import("@google/genai");
          const ai = new GoogleGenAI({ apiKey });
          const prompt = `
            Voc\xEA \xE9 o assistente do RK Sucatas. Responda em portugu\xEAs de forma amig\xE1vel.
            
            Contexto atual:
            - Estoque: ${contexto.totalItens} itens
            - Vendas: ${contexto.totalVendas} registros
            
            Pergunta: "${pergunta}"
            
            Identifique a inten\xE7\xE3o e retorne APENAS UM JSON com:
            {
              "intencao": "busca" | "relatorio" | "venda" | "outro",
              "termo": "termo de busca (se for busca)",
              "periodo": "hoje" | "ontem" | "semana" | "mes" | "personalizado" (se for relatorio),
              "dataInicio": "YYYY-MM-DD" (se periodo personalizado),
              "dataFim": "YYYY-MM-DD",
              "resposta": "mensagem amig\xE1vel para o usu\xE1rio"
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
            iaResponse = JSON.parse(text || "{}");
          } catch {
            iaResponse = { intencao: "outro", resposta: text };
          }
        } catch (error) {
          console.error("\u274C Erro detalhado do Gemini:", error);
          useFallback = true;
          if (error.message?.includes("API key not valid") || error.message?.includes("API_KEY_INVALID") || error.status === 403) {
            fallbackReason = "A chave da API Gemini \xE9 inv\xE1lida ou foi bloqueada. Acesse Google AI Studio, gere uma nova chave e atualize a vari\xE1vel de ambiente.";
          } else {
            fallbackReason = "Erro de conex\xE3o com a IA. Tente novamente mais tarde.";
          }
        }
      }
      if (useFallback || !iaResponse) {
        console.log("\u26A0\uFE0F Usando busca de fallback. Motivo:", fallbackReason);
        const termo = pergunta.toLowerCase().replace("tem ", "").replace("busca ", "").replace("procura ", "");
        iaResponse = {
          intencao: "busca",
          termo,
          resposta: `\u26A0\uFE0F **Aviso: ${fallbackReason}**

Usando busca simplificada por palavras-chave:`
        };
      }
      let dados = {};
      let respostaFormatada = iaResponse.resposta || "";
      if (iaResponse.intencao === "busca" && iaResponse.termo) {
        const termo = iaResponse.termo.toLowerCase();
        const itensEncontrados = contexto.estoque.filter(
          (item) => item.nome?.toLowerCase().includes(termo) || item.moto?.toLowerCase().includes(termo) || item.rk_id?.toLowerCase().includes(termo)
        ).slice(0, 5);
        dados = { itens: itensEncontrados };
        if (itensEncontrados.length === 0) {
          const sugestoes = contexto.estoque.filter(
            (item) => item.categoria?.toLowerCase().includes(termo) || item.nome?.toLowerCase().split(" ").some((p) => termo.includes(p))
          ).slice(0, 3).map((item) => `${item.nome} (${item.rk_id}) - R$ ${item.valor}`);
          dados.sugestoes = sugestoes;
        }
      } else if (iaResponse.intencao === "relatorio") {
        const hoje = /* @__PURE__ */ new Date();
        let dataInicio;
        let dataFim = new Date(hoje);
        switch (iaResponse.periodo) {
          case "hoje":
            dataInicio = new Date(hoje.setHours(0, 0, 0, 0));
            dataFim = new Date(hoje.setHours(23, 59, 59, 999));
            break;
          case "ontem":
            const ontem = new Date(hoje);
            ontem.setDate(ontem.getDate() - 1);
            dataInicio = new Date(ontem.setHours(0, 0, 0, 0));
            dataFim = new Date(ontem.setHours(23, 59, 59, 999));
            break;
          case "semana":
            dataInicio = new Date(hoje);
            dataInicio.setDate(hoje.getDate() - 7);
            dataInicio.setHours(0, 0, 0, 0);
            dataFim = new Date(hoje.setHours(23, 59, 59, 999));
            break;
          case "mes":
            dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
          default:
            dataInicio = new Date(hoje.setHours(0, 0, 0, 0));
            dataFim = new Date(hoje.setHours(23, 59, 59, 999));
        }
        const parseDate = (dateStr) => {
          if (!dateStr) return /* @__PURE__ */ new Date(0);
          if (dateStr.includes("T")) {
            return new Date(dateStr);
          } else {
            const [year, month, day] = dateStr.split("-").map(Number);
            return new Date(year, month - 1, day, 12, 0, 0);
          }
        };
        const vendasPeriodo = contexto.vendas.filter((v) => {
          const dataVenda = parseDate(v.data);
          return dataVenda >= dataInicio && dataVenda <= dataFim && v.tipo !== "SA\xCDDA";
        });
        const saidasPeriodo = contexto.vendas.filter((v) => {
          const dataVenda = parseDate(v.data);
          return dataVenda >= dataInicio && dataVenda <= dataFim && v.tipo === "SA\xCDDA";
        });
        dados = {
          periodo: iaResponse.periodo || "hoje",
          totalVendas: vendasPeriodo.reduce((sum, v) => sum + (v.valor || 0), 0),
          quantidadeVendas: vendasPeriodo.length,
          totalSaidas: saidasPeriodo.reduce((sum, v) => sum + (v.valor || 0), 0),
          quantidadeSaidas: saidasPeriodo.length
        };
      }
      res.json({
        success: true,
        intencao: iaResponse.intencao,
        dados,
        resposta: respostaFormatada
      });
    } catch (error) {
      console.error("\u274C Erro no assistente:", error);
      res.status(500).json({
        success: false,
        resposta: "Desculpe, tive um problema ao processar sua pergunta."
      });
    }
  });
  app.get("/api/motos", async (req, res) => {
    try {
      const force = req.query.force === "true";
      if (force) invalidateCache(MOTOS_DATABASE_ID);
      console.log(`\u{1F3CD}\uFE0F Consultando banco de motos: ${MOTOS_DATABASE_ID}`);
      const allItems = await fetchAllFromNotion(MOTOS_DATABASE_ID);
      const formattedData = allItems.map(formatMotosItem);
      res.json({ success: true, data: formattedData, total: allItems.length });
    } catch (error) {
      console.error("Motos API Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.post("/api/motos", async (req, res) => {
    try {
      const data = req.body;
      console.log("\u{1F4DD} Criando nova moto:", data);
      const dbData = await getCachedDbStructure(MOTOS_DATABASE_ID);
      const dbProps = dbData.properties;
      const properties = {};
      const mapping = {
        "nome": "Nome",
        "cilindrada": "Cilindrada",
        "ano": "Ano",
        "lote": "Lote",
        "imagens": "Fotos",
        "descricao": "Observa\xE7\xF5es",
        "nome_nf": "Nome NF",
        "pecas_retiradas": "Pe\xE7as Retiradas",
        "valor": "Valor",
        "marca": "Marca",
        "status": "Status",
        "cor": "Cor",
        "modelo": "Modelo"
      };
      for (const [field, value] of Object.entries(data)) {
        if (value === void 0 || value === null) continue;
        const mappedName = mapping[field];
        if (!mappedName) continue;
        const notionPropName = Object.keys(dbProps).find((k) => k.toLowerCase() === mappedName.toLowerCase());
        if (!notionPropName) {
          console.log(`\u26A0\uFE0F Propriedade "${mappedName}" n\xE3o encontrada no Notion`);
          continue;
        }
        const propType = dbProps[notionPropName].type;
        if (propType === "title") {
          properties[notionPropName] = {
            title: [{ text: { content: String(value || "-") } }]
          };
        } else if (propType === "rich_text") {
          properties[notionPropName] = {
            rich_text: [{ text: { content: String(value || "") } }]
          };
        } else if (propType === "number") {
          properties[notionPropName] = {
            number: Number(value) || 0
          };
        } else if (propType === "select") {
          if (value) properties[notionPropName] = { select: { name: String(value) } };
        } else if (propType === "status") {
          if (value) properties[notionPropName] = { status: { name: String(value) } };
        } else if (propType === "files" && Array.isArray(value)) {
          const externalUrls = value.filter((url) => {
            if (!url || typeof url !== "string") return false;
            return !url.includes("notion-static.com") && !url.includes("amazonaws.com");
          });
          if (externalUrls.length > 0) {
            properties[notionPropName] = {
              files: externalUrls.map((url) => ({
                name: `foto_${Date.now()}.jpg`,
                type: "external",
                external: { url }
              }))
            };
          }
        }
      }
      console.log("\u{1F4E4} Enviando para o Notion (POST):", JSON.stringify(properties, null, 2));
      const response = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VERSION
        },
        body: JSON.stringify({
          parent: { database_id: MOTOS_DATABASE_ID },
          properties
        })
      });
      if (!response.ok) {
        const error = await response.text();
        console.error("\u274C Erro Notion (POST):", error);
        throw new Error(`Notion API error: ${error}`);
      }
      const result = await response.json();
      console.log("\u2705 Moto criada com sucesso");
      invalidateCache(MOTOS_DATABASE_ID);
      res.json({ success: true, data: formatMotosItem(result) });
    } catch (error) {
      console.error("Create Moto Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.patch("/api/motos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      console.log("\u{1F4DD} Recebida requisi\xE7\xE3o PATCH para moto:", id);
      console.log("\u{1F4E6} Dados recebidos para atualiza\xE7\xE3o:", JSON.stringify(req.body, null, 2));
      console.log("\u{1F4F8} Campo imagens:", req.body.imagens);
      const dbData = await getCachedDbStructure(MOTOS_DATABASE_ID);
      const dbProps = dbData.properties;
      const properties = {};
      const fieldMapping = {
        nome: "Nome",
        marca: "Marca",
        modelo: "Modelo",
        ano: "Ano",
        valor: "Valor",
        cor: "Cor",
        cilindrada: "Cilindrada",
        lote: "Lote",
        nome_nf: "Nome NF",
        pecas_retiradas: "Pe\xE7as Retiradas",
        status: "Status",
        descricao: "Observa\xE7\xF5es",
        // Ajustado para bater com o banco real
        imagens: "Fotos"
      };
      for (const [field, value] of Object.entries(updateData)) {
        if (value === void 0 || value === null) continue;
        const propName = fieldMapping[field];
        if (!propName) continue;
        let notionPropName = Object.keys(dbProps).find((k) => k.toLowerCase() === propName.toLowerCase());
        if (!notionPropName && field === "imagens") {
          notionPropName = Object.keys(dbProps).find(
            (k) => k.toLowerCase() === "imagem" || dbProps[k].type === "files"
          );
        }
        if (!notionPropName) {
          console.log(`\u26A0\uFE0F Propriedade "${propName}" n\xE3o encontrada no Notion`);
          continue;
        }
        const propType = dbProps[notionPropName].type;
        if (propType === "title") {
          properties[notionPropName] = {
            title: [{ text: { content: String(value) } }]
          };
        } else if (propType === "rich_text") {
          properties[notionPropName] = {
            rich_text: [{ text: { content: String(value) } }]
          };
        } else if (propType === "number") {
          properties[notionPropName] = {
            number: Number(value)
          };
        } else if (propType === "select") {
          properties[notionPropName] = {
            select: { name: String(value) }
          };
        } else if (propType === "status") {
          properties[notionPropName] = {
            status: { name: String(value) }
          };
        } else if (propType === "files" && Array.isArray(value)) {
          const externalUrls = value.filter((url) => {
            if (!url || typeof url !== "string") return false;
            const isNotionUrl = url.includes("notion-static.com") || url.includes("amazonaws.com") || url.includes("secure.notion-static.com");
            return !isNotionUrl;
          });
          if (externalUrls.length > 0) {
            properties[notionPropName] = {
              files: externalUrls.map((url) => ({
                name: `foto_${Date.now()}.jpg`,
                type: "external",
                external: { url }
              }))
            };
          }
        }
      }
      console.log("\u{1F4E4} Enviando para Notion:", JSON.stringify(properties, null, 2));
      const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VERSION
        },
        body: JSON.stringify({ properties })
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("\u274C Erro Notion:", response.status, errorText);
        throw new Error(`Notion error: ${response.status} - ${errorText}`);
      }
      const result = await response.json();
      console.log("\u2705 Resposta do Notion:", result);
      invalidateCache(MOTOS_DATABASE_ID);
      res.json({ success: true, data: formatMotosItem(result) });
    } catch (error) {
      console.error("Update Moto Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.delete("/api/motos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VERSION
        },
        body: JSON.stringify({ archived: true })
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Notion API error: ${error}`);
      }
      invalidateCache(MOTOS_DATABASE_ID);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete Moto Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.post("/api/motos/bulk-delete", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ success: false, error: "IDs inv\xE1lidos" });
      }
      const deletePromises = ids.map(
        (id) => fetch(`https://api.notion.com/v1/pages/${id}`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${NOTION_TOKEN}`,
            "Content-Type": "application/json",
            "Notion-Version": NOTION_VERSION
          },
          body: JSON.stringify({ archived: true })
        })
      );
      await Promise.all(deletePromises);
      invalidateCache(MOTOS_DATABASE_ID);
      res.json({ success: true });
    } catch (error) {
      console.error("Bulk Delete Motos Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  const BAILEY_CONFIG = {
    connectTimeoutMs: 12e4,
    // mais tolerante
    defaultQueryTimeoutMs: 6e4,
    keepAliveIntervalMs: 3e4,
    // Baileys gerencia sozinho
    retryRequestDelayMs: 1e3,
    markOnlineOnConnect: true,
    shouldSyncHistoryMessage: () => false,
    syncFullHistory: false,
    fireInitQueries: false,
    emitOwnEvents: false
  };
  let whatsappMessages = [];
  let conversations = /* @__PURE__ */ new Map();
  let contacts = /* @__PURE__ */ new Map();
  let qrCodeData = null;
  let isWhatsAppConnected = false;
  let whatsappLogs = [];
  let isReconnecting = false;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let currentSocket = null;
  let messageQueue = [];
  let isProcessingQueue = false;
  const profilePicCache = /* @__PURE__ */ new Map();
  function addLog(msg) {
    const log = `${(/* @__PURE__ */ new Date()).toISOString()} [PID:${process.pid}] - ${msg}`;
    console.log(log);
    whatsappLogs.push(log);
    if (whatsappLogs.length > 100) whatsappLogs.shift();
  }
  function emitStatus() {
    io.emit("whatsapp-status", {
      connected: isWhatsAppConnected,
      isConnecting: isReconnecting,
      reconnectAttempts,
      qr: !!qrCodeData
    });
  }
  async function processMessageQueue() {
    if (isProcessingQueue || messageQueue.length === 0) return;
    isProcessingQueue = true;
    addLog(`\u{1F4E5} Processando fila (${messageQueue.length} pendentes)`);
    while (messageQueue.length > 0) {
      const msg = messageQueue[0];
      try {
        if (msg.type === "send") {
          if (!currentSocket || !isWhatsAppConnected || currentSocket.ws.readyState !== 1) {
            addLog(`\u26A0\uFE0F Socket desconectado. Pausando envio.`);
            break;
          }
          addLog(`\u{1F4E4} Enviando mensagem enfileirada para ${msg.number}`);
          const sendPromise = currentSocket.sendMessage(msg.jid, msg.message);
          const timeoutPromise = new Promise(
            (_, reject) => setTimeout(() => reject(new Error("Timeout 30s")), 3e4)
          );
          await Promise.race([sendPromise, timeoutPromise]);
          addLog(`\u2705 Mensagem enviada`);
          if (conversations.has(msg.number)) {
            const conv = conversations.get(msg.number);
            const idx = conv.messages.findIndex((m) => m.id === msg.sentMessageId);
            if (idx !== -1) conv.messages[idx].status = "sent";
            conversations.set(msg.number, conv);
            io.emit("whatsapp-conversations", Array.from(conversations.values()));
          }
        } else {
          await Promise.race([detectIntent(msg), new Promise((_, r) => setTimeout(() => r(new Error("Timeout intent")), 3e4))]);
        }
        messageQueue.shift();
      } catch (error) {
        addLog(`\u274C Erro na fila: ${error.message}`);
        const failed = messageQueue.shift();
        if (failed) {
          failed.retryCount = (failed.retryCount || 0) + 1;
          if (failed.retryCount < 3) messageQueue.push(failed);
          else addLog(`\u26A0\uFE0F Mensagem descartada ap\xF3s 3 tentativas`);
        }
        await new Promise((r) => setTimeout(r, 2e3));
      }
    }
    isProcessingQueue = false;
  }
  function scheduleReconnect(delayMs) {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    addLog(`\u23F3 Agendando reconex\xE3o em ${delayMs}ms (tentativa ${reconnectAttempts})`);
    reconnectTimer = setTimeout(() => {
      isReconnecting = false;
      connectToWhatsApp();
    }, delayMs);
  }
  async function connectToWhatsApp() {
    if (isReconnecting) return;
    isReconnecting = true;
    if (currentSocket) {
      try {
        currentSocket.ev.removeAllListeners();
        currentSocket.end(void 0);
      } catch {
      }
      currentSocket = null;
    }
    await new Promise((r) => setTimeout(r, 800));
    try {
      const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = await import("@whiskeysockets/baileys");
      const { state, saveCreds } = await useMultiFileAuthState("baileys_auth_info");
      const { version } = await fetchLatestBaileysVersion();
      const pino = (await import("pino")).default;
      const logger = pino({ level: "warn" }, {
        write: (data) => {
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
        browser: ["Ubuntu", "Chrome", "130.0.0"]
      });
      currentSocket = sock;
      app.whatsappSock = sock;
      sock.ev.on("creds.update", saveCreds);
      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr && !state.creds?.registered) {
          qrCodeData = await QRCode.toDataURL(qr);
          io.emit("whatsapp-qr", qrCodeData);
          emitStatus();
        }
        if (connection === "open") {
          isWhatsAppConnected = true;
          reconnectAttempts = 0;
          isReconnecting = false;
          qrCodeData = null;
          addLog("\u2705 WhatsApp CONECTADO e EST\xC1VEL!");
          processMessageQueue();
          emitStatus();
        }
        if (connection === "close") {
          const statusCode = lastDisconnect?.error?.output?.statusCode ?? lastDisconnect?.error?.statusCode;
          if (statusCode === DisconnectReason.loggedOut) {
            isWhatsAppConnected = false;
            addLog("\u{1F6AA} Logout detectado. Limpando sess\xE3o...");
            const authPath = path.join(process.cwd(), "baileys_auth_info");
            if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
            qrCodeData = null;
            emitStatus();
          } else {
            isWhatsAppConnected = false;
            reconnectAttempts++;
            let delay = Math.min(3e3 * reconnectAttempts, 6e4);
            if (statusCode === 440) delay = 45e3;
            if (statusCode === 515) delay = 15e3;
            if (statusCode === 409) delay = 8e3;
            addLog(`\u{1F504} Conex\xE3o fechada (${statusCode}). Reconectando em ${delay}ms...`);
            scheduleReconnect(delay);
          }
        }
      });
      sock.ev.on("messages.upsert", async (m) => {
        if (m.type === "notify") {
          for (const msg of m.messages) {
            if (!msg.key.fromMe && msg.message) {
              const remoteJid = msg.key.remoteJid || "";
              const from = remoteJid.split("@")[0] || "";
              if (from === "558382039490") {
                continue;
              }
              const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
              let contactName = msg.pushName || from;
              const cachedContact = contacts.get(remoteJid);
              if (cachedContact) {
                contactName = cachedContact.name || cachedContact.verifiedName || cachedContact.notify || contactName;
              }
              let profilePic = profilePicCache.get(remoteJid) || null;
              if (!profilePic && isWhatsAppConnected) {
                try {
                  profilePic = await sock.profilePictureUrl(remoteJid, "image").catch(() => null);
                  if (profilePic) profilePicCache.set(remoteJid, profilePic);
                } catch (e) {
                }
              }
              if (whatsappMessages.some((m2) => m2.id === msg.key.id)) continue;
              const newMessage = {
                id: msg.key.id,
                key: msg.key,
                // Guardar a chave para deletar depois
                remoteJid,
                from,
                number: from,
                // Adicionar o número explicitamente
                name: contactName,
                body,
                profilePic: profilePic || "",
                timestamp: /* @__PURE__ */ new Date(),
                status: "unread",
                processed: false
              };
              whatsappMessages.push(newMessage);
              if (!conversations.has(from)) {
                conversations.set(from, {
                  number: from,
                  remoteJid,
                  // Guardar o JID real para envio
                  name: contactName,
                  profilePic: profilePic || "",
                  lastMessage: body,
                  lastTimestamp: /* @__PURE__ */ new Date(),
                  unreadCount: 1,
                  messages: [newMessage],
                  status: "online"
                });
              } else {
                const conv = conversations.get(from);
                conv.remoteJid = remoteJid;
                conv.name = contactName;
                conv.profilePic = profilePic || conv.profilePic;
                conv.lastMessage = body;
                conv.lastTimestamp = /* @__PURE__ */ new Date();
                conv.unreadCount = (conv.unreadCount || 0) + 1;
                conv.messages.push(newMessage);
                conversations.set(from, conv);
              }
              io.emit("whatsapp-conversations", Array.from(conversations.values()).filter((c) => c.number !== "558382039490"));
              io.emit("whatsapp-notification", { count: whatsappMessages.filter((m2) => m2.status === "unread" && m2.from !== "558382039490").length });
              messageQueue.push(newMessage);
              processMessageQueue();
            }
          }
        }
      });
    } catch (error) {
      console.error("Erro na conex\xE3o WhatsApp:", error);
      isReconnecting = false;
      setTimeout(connectToWhatsApp, 1e4);
    }
  }
  async function detectIntent(message) {
    const apiKey = config.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") return;
    try {
      const { GoogleGenAI, Type, ThinkingLevel } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
        Voc\xEA \xE9 o assistente de atendimento do RK Sucatas.
        Mensagem do cliente: "${message.body}"
        Identifique a inten\xE7\xE3o e retorne APENAS UM JSON com:
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
      const intent = JSON.parse(result.text || "{}");
      const index = whatsappMessages.findIndex((m) => m.id === message.id);
      if (index !== -1) {
        whatsappMessages[index].intent = intent;
        whatsappMessages[index].processed = true;
        io.emit("whatsapp-message-updated", whatsappMessages[index]);
      }
    } catch (error) {
      console.error("Erro ao detectar inten\xE7\xE3o:", error);
    }
  }
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
    const conversationsList = Array.from(conversations.values()).sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
    res.json({ success: true, data: conversationsList });
  });
  app.get("/api/whatsapp/conversations/:number/messages", (req, res) => {
    const { number } = req.params;
    const conv = conversations.get(number);
    res.json({ success: true, data: conv?.messages || [] });
  });
  app.post("/api/whatsapp/messages/:id/read", (req, res) => {
    const { id } = req.params;
    const index = whatsappMessages.findIndex((m) => m.id === id);
    if (index !== -1) {
      whatsappMessages[index].status = "read";
      const from = whatsappMessages[index].from;
      if (conversations.has(from)) {
        const conv = conversations.get(from);
        const mIdx = conv.messages.findIndex((m) => m.id === id);
        if (mIdx !== -1) conv.messages[mIdx].status = "read";
        conv.unreadCount = Math.max(0, conv.unreadCount - 1);
        conversations.set(from, conv);
        io.emit("whatsapp-conversations", Array.from(conversations.values()));
      }
      io.emit("whatsapp-notification", { count: whatsappMessages.filter((m) => m.status === "unread").length });
    }
    res.json({ success: true });
  });
  app.delete("/api/whatsapp/conversations/:number", async (req, res) => {
    try {
      const { number } = req.params;
      if (!conversations.has(number)) throw new Error("Conversa n\xE3o encontrada");
      whatsappMessages = whatsappMessages.filter((m) => m.from !== number);
      conversations.delete(number);
      io.emit("whatsapp-conversations", Array.from(conversations.values()).filter((c) => c.number !== "558382039490"));
      io.emit("whatsapp-notification", { count: whatsappMessages.filter((m) => m.status === "unread" && m.from !== "558382039490").length });
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao deletar conversa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.delete("/api/whatsapp/messages/:id", (req, res) => {
    const { id } = req.params;
    const msg = whatsappMessages.find((m) => m.id === id);
    if (msg) {
      const from = msg.from;
      whatsappMessages = whatsappMessages.filter((m) => m.id !== id);
      if (conversations.has(from)) {
        const conv = conversations.get(from);
        conv.messages = conv.messages.filter((m) => m.id !== id);
        if (conv.messages.length === 0) {
          conversations.delete(from);
        } else {
          conv.lastMessage = conv.messages[conv.messages.length - 1].body;
          conv.lastTimestamp = conv.messages[conv.messages.length - 1].timestamp;
          conversations.set(from, conv);
        }
        io.emit("whatsapp-conversations", Array.from(conversations.values()));
      }
      io.emit("whatsapp-notification", { count: whatsappMessages.filter((m) => m.status === "unread").length });
    }
    res.json({ success: true });
  });
  app.delete("/api/whatsapp/messages/:id/remote", async (req, res) => {
    try {
      const { id } = req.params;
      const msg = whatsappMessages.find((m) => m.id === id);
      if (!msg) throw new Error("Mensagem n\xE3o encontrada");
      const sock = app.whatsappSock;
      if (!sock) throw new Error("WhatsApp n\xE3o conectado");
      await sock.sendMessage(msg.remoteJid, { delete: msg.key });
      const from = msg.from;
      whatsappMessages = whatsappMessages.filter((m) => m.id !== id);
      if (conversations.has(from)) {
        const conv = conversations.get(from);
        conv.messages = conv.messages.filter((m) => m.id !== id);
        if (conv.messages.length === 0) {
          conversations.delete(from);
        } else {
          conv.lastMessage = conv.messages[conv.messages.length - 1].body;
          conv.lastTimestamp = conv.messages[conv.messages.length - 1].timestamp;
          conversations.set(from, conv);
        }
        io.emit("whatsapp-conversations", Array.from(conversations.values()));
      }
      io.emit("whatsapp-notification", { count: whatsappMessages.filter((m) => m.status === "unread").length });
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao deletar mensagem remota:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.post("/api/whatsapp/send", async (req, res) => {
    try {
      const { number, message, replyToId } = req.body;
      addLog(`\u{1F4E4} Solicitando envio de mensagem para ${number}...`);
      const sock = currentSocket;
      let jid = `${number}@s.whatsapp.net`;
      if (conversations.has(number)) {
        jid = conversations.get(number).remoteJid;
      } else if (number.includes("-")) {
        jid = `${number}@g.us`;
      }
      const sentMessage = {
        id: `send_${Date.now()}`,
        from: "me",
        body: message,
        timestamp: /* @__PURE__ */ new Date(),
        status: "sending"
      };
      if (conversations.has(number)) {
        const conv = conversations.get(number);
        conv.messages.push(sentMessage);
        conv.lastMessage = message;
        conv.lastTimestamp = /* @__PURE__ */ new Date();
        conversations.set(number, conv);
      } else {
        conversations.set(number, {
          number,
          remoteJid: jid,
          name: number,
          lastMessage: message,
          lastTimestamp: /* @__PURE__ */ new Date(),
          unreadCount: 0,
          messages: [sentMessage],
          status: "online"
        });
      }
      io.emit("whatsapp-conversations", Array.from(conversations.values()));
      const updateMessageStatus = (status) => {
        if (conversations.has(number)) {
          const conv = conversations.get(number);
          const msgIndex = conv.messages.findIndex((m) => m.id === sentMessage.id);
          if (msgIndex !== -1) {
            conv.messages[msgIndex].status = status;
            conversations.set(number, conv);
            io.emit("whatsapp-conversations", Array.from(conversations.values()));
          }
        }
      };
      if (!sock || !isWhatsAppConnected || sock.ws.readyState !== 1) {
        addLog(`\u26A0\uFE0F WhatsApp n\xE3o conectado no momento. Enfileirando mensagem para ${number}...`);
        messageQueue.push({
          type: "send",
          jid,
          message: { text: message },
          sentMessageId: sentMessage.id,
          number
        });
        updateMessageStatus("queued");
        return res.status(202).json({
          success: true,
          message: "Mensagem enfileirada. Ser\xE1 enviada quando a conex\xE3o for restabelecida.",
          status: "queued"
        });
      }
      try {
        const sendPromise = sock.sendMessage(jid, { text: message });
        const timeoutPromise = new Promise(
          (_, reject) => setTimeout(() => reject(new Error("Timeout ao enviar mensagem")), 3e4)
        );
        await Promise.race([sendPromise, timeoutPromise]);
        addLog(`\u2705 Mensagem enviada para ${number}`);
        updateMessageStatus("sent");
      } catch (sendError) {
        addLog(`\u26A0\uFE0F Falha ao enviar diretamente para ${number}, enfileirando. Erro: ${sendError.message}`);
        messageQueue.push({
          type: "send",
          jid,
          message: { text: message },
          sentMessageId: sentMessage.id,
          number
        });
        updateMessageStatus("queued");
        return res.status(202).json({
          success: true,
          message: "Mensagem enfileirada ap\xF3s falha inicial.",
          status: "queued"
        });
      }
      if (replyToId) {
        const index = whatsappMessages.findIndex((m) => m.id === replyToId);
        if (index !== -1) {
          whatsappMessages[index].replied = true;
          whatsappMessages[index].repliedAt = /* @__PURE__ */ new Date();
          const from = whatsappMessages[index].from;
          if (conversations.has(from)) {
            const conv = conversations.get(from);
            const mIdx = conv.messages.findIndex((m) => m.id === replyToId);
            if (mIdx !== -1) {
              conv.messages[mIdx].replied = true;
              conv.messages[mIdx].repliedAt = /* @__PURE__ */ new Date();
            }
            conversations.set(from, conv);
            io.emit("whatsapp-conversations", Array.from(conversations.values()).filter((c) => c.number !== "558382039490"));
          }
        }
      }
      res.json({
        success: true,
        message: "Mensagem enviada",
        status: "connected"
      });
    } catch (error) {
      addLog(`\u274C Erro cr\xEDtico ao processar envio de mensagem: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
        status: isWhatsAppConnected ? "connected" : "disconnected"
      });
    }
  });
  app.get("/api/whatsapp/logs", (req, res) => {
    res.json({ success: true, logs: whatsappLogs });
  });
  app.post("/api/whatsapp/logout", async (req, res) => {
    try {
      addLog("\u{1F6AA} Solicitando logout do WhatsApp...");
      const sock = app.whatsappSock;
      if (sock) {
        await sock.logout();
      }
      const authPath = path.join(process.cwd(), "baileys_auth_info");
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
      }
      isWhatsAppConnected = false;
      qrCodeData = null;
      emitStatus();
      isReconnecting = false;
      connectToWhatsApp();
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao deslogar WhatsApp:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.post("/api/whatsapp/reconnect", async (req, res) => {
    try {
      addLog("\u{1F504} Solicitando reconex\xE3o manual...");
      isReconnecting = false;
      connectToWhatsApp();
      res.json({ success: true, message: "Reconex\xE3o iniciada" });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.post("/api/whatsapp/force-qr", async (req, res) => {
    try {
      addLog("\u{1F504} For\xE7ando novo QR Code...");
      const sock = app.whatsappSock;
      if (sock) {
        try {
          sock.ev.removeAllListeners("connection.update");
          sock.ev.removeAllListeners("creds.update");
          sock.ev.removeAllListeners("messages.upsert");
          sock.end(new Error("For\xE7ando novo QR"));
        } catch (e) {
        }
      }
      const authPath = path.join(process.cwd(), "baileys_auth_info");
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
      }
      isWhatsAppConnected = false;
      qrCodeData = null;
      isReconnecting = false;
      setTimeout(() => {
        connectToWhatsApp();
      }, 1e3);
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao for\xE7ar QR:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.use("/api", (err, req, res, next) => {
    console.error("\u274C Erro na API:", err);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || "Erro interno no servidor"
    });
  });
  app.all("/api/*", (req, res) => {
    res.status(404).json({
      success: false,
      error: `Rota API n\xE3o encontrada: ${req.method} ${req.url}`
    });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
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
    console.log(`\u{1F680} Server running on http://localhost:${PORT} [PID:${process.pid}]`);
    console.log(`\u{1F517} APP_URL: ${process.env.APP_URL || "N\xE3o definida (usando localhost)"}`);
    console.log("\u{1F525} Iniciando warm-up do cache do Notion...");
    Promise.all([
      fetchAllFromNotion(DATABASE_ID).catch(() => null),
      fetchAllFromNotion(MOTOS_DATABASE_ID).catch(() => null),
      fetchAllFromNotion(CLIENTS_DATABASE_ID).catch(() => null)
    ]).then(() => {
      console.log("\u2705 Warm-up do cache do Notion conclu\xEDdo.");
    });
    console.log("\u{1F4F1} Inicializando WhatsApp (Baileys)...");
    setTimeout(() => {
      connectToWhatsApp().catch((err) => {
        console.error("\u274C Erro ao inicializar WhatsApp:", err);
      });
    }, 1e4);
  });
  const shutdown = async () => {
    console.log("\u{1F6D1} Encerrando servidor...");
    const sock = app.whatsappSock;
    if (sock) {
      try {
        sock.ev.removeAllListeners("connection.update");
        sock.end(void 0);
        console.log("\u2705 Socket WhatsApp encerrado.");
      } catch (e) {
      }
    }
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
startServer();
