import axios from 'axios';

class MLClient {
  baseURL: string;
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  userId: string;

  constructor() {
    this.baseURL = 'https://api.mercadolibre.com';
    this.clientId = process.env.ML_CLIENT_ID || '458087912144789';
    this.clientSecret = process.env.ML_CLIENT_SECRET || 'FpzTCzJmEG7FdcaMWk81H9nnNpxUTAQc';
    this.accessToken = process.env.ML_ACCESS_TOKEN || 'APP_USR-458087912144789-031314-82c06a646fbda963d7fc2568a1e8f89b-2908181527';
    this.refreshToken = process.env.ML_REFRESH_TOKEN || 'TG-69b456d706333000017bd997-2908181527';
    this.userId = process.env.ML_USER_ID || '2908181527';
  }

  async request(endpoint: string, options: any = {}) {
    try {
      console.log(`📡 Chamando API ML: ${endpoint}`);
      const response = await axios({
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        ...options
      });
      console.log(`✅ Resposta recebida de ${endpoint}`);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Erro na requisição ${endpoint}:`, error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        console.log('🔄 Token expirado, renovando...');
        await this.refreshAccessToken();
        return this.request(endpoint, options);
      }
      throw error;
    }
  }

  async refreshAccessToken() {
    try {
      const response = await axios.post('https://api.mercadolibre.com/oauth/token', {
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken
      });
      
      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      
      console.log('✅ Token renovado com sucesso');
      return this.accessToken;
    } catch (error: any) {
      console.error('❌ Erro ao renovar token:', error.message);
      throw error;
    }
  }

  // ========== MÉTRICAS ==========
  async getUserInfo() {
    return this.request('/users/me');
  }

  async getSalesMetrics(dateFrom: string, dateTo: string) {
    // Primeiro, vamos buscar as vendas do período
    const orders = await this.request(`/orders/search`, {
      params: {
        seller: this.userId,
        order_date_from: dateFrom,
        order_date_to: dateTo,
        limit: 100
      }
    });
    
    // Calcular métricas manualmente
    let totalSales = 0;
    let totalAmount = 0;
    
    if (orders.results) {
      orders.results.forEach((order: any) => {
        if (order.status === 'paid') {
          totalSales++;
          totalAmount += order.total_amount || 0;
        }
      });
    }
    
    const average = totalSales > 0 ? totalAmount / totalSales : 0;
    
    return {
      total: totalAmount,
      count: totalSales,
      average: average
    };
  }

  // ========== ANÚNCIOS ==========
  async getListings(status = 'active', limit = 50) {
    try {
      console.log(`🔍 Buscando anúncios com status: ${status}`);
      
      const search = await this.request(`/users/${this.userId}/items/search`, {
        params: { status, limit }
      });
      
      console.log('📦 Resultado da busca:', search);
      
      if (search.results && search.results.length > 0) {
        const items = await this.request('/items', {
          params: { 
            ids: search.results.join(','), 
            attributes: 'id,title,price,available_quantity,status,permalink,thumbnail,condition' 
          }
        });
        
        return items.map((item: any) => item.body);
      }
      return [];
    } catch (error) {
      console.error('Erro ao buscar anúncios:', error);
      return [];
    }
  }

  // ========== PERGUNTAS ==========
  async getQuestions(status = 'UNANSWERED', limit = 50) {
    try {
      const response = await this.request('/marketplace/questions/search', {
        params: {
          seller_id: this.userId,
          status,
          limit,
          api_version: 4
        }
      });
      return response;
    } catch (error) {
      console.error('Erro ao buscar perguntas:', error);
      return { questions: [], total: 0 };
    }
  }

  async answerQuestion(questionId: string, answer: string) {
    return this.request('/answers', {
      method: 'POST',
      data: {
        question_id: questionId,
        text: answer
      }
    });
  }
}

export default new MLClient();
