import axios from 'axios';

class MLClient {
  private baseURL: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string;
  private refreshToken: string;
  get userId() {
    return this._userId;
  }
  
  private _userId: string;

  constructor() {
    this.baseURL = 'https://api.mercadolibre.com';
    this.clientId = process.env.ML_CLIENT_ID || '';
    this.clientSecret = process.env.ML_CLIENT_SECRET || '';
    this.accessToken = process.env.ML_ACCESS_TOKEN || '';
    this.refreshToken = process.env.ML_REFRESH_TOKEN || '';
    this._userId = process.env.ML_USER_ID || '';

    // Validação das credenciais no início
    if (!this.clientId || !this.clientSecret) {
      console.warn('⚠️ ML_CLIENT_ID ou ML_CLIENT_SECRET não configurados');
    }
  }

  /**
   * Garante que o userId está correto (obtido do token)
   */
  async ensureUserId() {
    if (!this._userId || this._userId === 'undefined' || this._userId === 'null') {
      console.log('🔍 Obtendo User ID do token...');
      try {
        const user = await this.getUserInfo();
        this._userId = user.id.toString();
        console.log(`✅ User ID obtido: ${this._userId}`);
      } catch (error) {
        console.error('❌ Falha ao obter User ID do token');
        throw error;
      }
    }
    return this._userId;
  }

  /**
   * Método base para todas as requisições com retry automático em caso de token expirado
   */
  async request(endpoint: string, options: any = {}) {
    try {
      console.log(`📡 Chamando API ML: ${endpoint}`);
      const response = await axios({
        url: `${this.baseURL}${endpoint}`,
        timeout: 10000,
        ...options,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(options.headers || {})
        }
      });
      return response.data;
    } catch (error: any) {
      // Se for erro 401 (token expirado), tenta refresh automático
      if (error.response?.status === 401) {
        console.log('🔄 Token expirado, tentando renovar...');
        const renewed = await this.refreshAccessToken();
        if (renewed) {
          console.log('✅ Token renovado, retentando requisição');
          return this.request(endpoint, options);
        }
      }
      
      // Log detalhado do erro
      if (error.response?.status === 403) {
        console.error('🚫 Erro 403 (Forbidden) no Mercado Livre. Verifique se o ML_USER_ID corresponde ao token e se o token tem as permissões necessárias.');
        console.error('Detalhes do erro:', JSON.stringify(error.response.data, null, 2));
      }

      console.error(`❌ Erro na requisição ${endpoint}:`, {
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
  async refreshAccessToken(): Promise<boolean> {
    try {
      console.log('🔄 Executando refresh token...');
      const response = await axios.post('https://api.mercadolibre.com/oauth/token', {
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });

      if (response.data.access_token) {
        this.accessToken = response.data.access_token;
        // O refresh token também é renovado!
        if (response.data.refresh_token) {
          this.refreshToken = response.data.refresh_token;
        }
        console.log('✅ Token renovado com sucesso');
        
        // Aqui você pode salvar os novos tokens no ambiente (opcional)
        // process.env.ML_ACCESS_TOKEN = this.accessToken;
        // process.env.ML_REFRESH_TOKEN = this.refreshToken;
        
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('❌ Erro ao renovar token:', error.response?.data || error.message);
      return false;
    }
  }

  // ========== MÉTODOS PÚBLICOS DA API ==========

  /**
   * Busca informações do usuário (para teste)
   */
  async getUserInfo() {
    return this.request('/users/me');
  }

  /**
   * Busca anúncios do vendedor
   */
  async getListings(status: string = 'active', sort: string = 'date_desc', limit: number = 50, offset: number = 0) {
    try {
      await this.ensureUserId();

      console.log(`🔍 Buscando anúncios (status: ${status}, sort: ${sort}, limit: ${limit}, offset: ${offset})...`);
      
      // Se o limite for maior que 50, precisamos fazer múltiplas requisições
      if (limit > 50) {
        let allResults: string[] = [];
        let currentOffset = offset;
        let total = 0;
        
        while (allResults.length < limit) {
          const currentLimit = Math.min(50, limit - allResults.length);
          const response = await this.request(`/users/${this.userId}/items/search`, {
            params: {
              status: status === 'all' ? undefined : status,
              sort,
              limit: currentLimit,
              offset: currentOffset
            }
          });
          
          total = response.paging?.total || 0;
          if (!response.results || response.results.length === 0) break;
          
          allResults = [...allResults, ...response.results];
          currentOffset += response.results.length;
          
          if (allResults.length >= total) break;
        }
        
        return { total, results: allResults };
      }

      // Requisição simples para limite <= 50
      const params: any = {
        limit: limit,
        offset: offset,
        sort: sort
      };
      
      if (status !== 'all') {
        params.status = status;
      }

      const response = await this.request(`/users/${this.userId}/items/search`, {
        params
      });
      
      console.log(`📦 Total de anúncios encontrados: ${response.paging?.total || 0}`);
      return {
        total: response.paging?.total || 0,
        results: response.results || []
      };
    } catch (error) {
      console.error('Erro ao buscar anúncios:', error);
      return { total: 0, results: [] };
    }
  }

  /**
   * Busca perguntas do vendedor
   */
  async getQuestions(status: string = 'UNANSWERED', limit: number = 50) {
    try {
      await this.ensureUserId();

      console.log(`🔍 Buscando perguntas (${status})...`);
      const response = await this.request('/questions/search', {
        params: {
          seller_id: this.userId,
          status,
          limit: Math.min(limit, 50),
          sort: 'date_desc'
        }
      });
      
      return {
        total: response.paging?.total || 0,
        questions: response.questions || []
      };
    } catch (error) {
      console.error('Erro ao buscar perguntas:', error);
      return { total: 0, questions: [] };
    }
  }

  /**
   * Responde uma pergunta
   */
  async answerQuestion(questionId: number, answer: string) {
    try {
      console.log(`📝 Respondendo pergunta ${questionId}...`);
      const response = await this.request('/answers', {
        method: 'POST',
        data: {
          question_id: questionId,
          text: answer
        }
      });
      return response;
    } catch (error) {
      console.error('Erro ao responder pergunta:', error);
      throw error;
    }
  }

  /**
   * Busca métricas de vendas em um período
   */
  async getSalesMetrics(dateFrom: string, dateTo: string) {
    try {
      await this.ensureUserId();

      console.log(`📊 Buscando métricas de ${dateFrom} a ${dateTo}...`);
      const orders = await this.request('/orders/search', {
        params: {
          seller: this.userId,
          'order.date_created.from': `${dateFrom}T00:00:00.000-00:00`,
          'order.date_created.to': `${dateTo}T23:59:59.000-00:00`,
          limit: 50 
        }
      });
      
      let totalAmount = 0;
      let totalSales = 0;
      const dailyData: Record<string, number> = {};
      
      if (orders.results && Array.isArray(orders.results)) {
        orders.results.forEach((order: any) => {
          if (order.status === 'paid') {
            totalSales++;
            totalAmount += order.total_amount || 0;
            
            // Extract date (YYYY-MM-DD)
            if (order.date_created) {
              const dateStr = order.date_created.split('T')[0];
              dailyData[dateStr] = (dailyData[dateStr] || 0) + (order.total_amount || 0);
            }
          }
        });
      }
      
      const average = totalSales > 0 ? totalAmount / totalSales : 0;
      
      return {
        total: totalAmount,
        count: totalSales,
        average: average,
        dailyData: dailyData
      };
    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
      return { total: 0, count: 0, average: 0 };
    }
  }

  /**
   * Baixa a etiqueta de envio
   */
  async getShippingLabel(shipmentId: string) {
    try {
      console.log(`🏷️ Baixando etiqueta para envio ${shipmentId}...`);
      const response = await this.request(`/shipment_labels?shipment_ids=${shipmentId}&response_type=pdf`, {
        responseType: 'arraybuffer',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/pdf, application/zip, application/octet-stream'
        }
      });
      return response;
    } catch (error) {
      console.error('Erro ao baixar etiqueta:', error);
      throw error;
    }
  }

  /**
   * Atualiza um anúncio
   */
  async updateListing(itemId: string, data: any) {
    try {
      console.log(`📝 Atualizando anúncio ${itemId}...`);
      const response = await this.request(`/items/${itemId}`, {
        method: 'PUT',
        data
      });
      return response;
    } catch (error) {
      console.error('Erro ao atualizar anúncio:', error);
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
        message: '✅ Conexão com Mercado Livre OK'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: '❌ Falha na conexão com Mercado Livre'
      };
    }
  }
}

// Exporta uma instância única (singleton)
export default new MLClient();
