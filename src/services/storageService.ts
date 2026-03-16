import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

// Inicializa o cliente do Cloud Storage (usa as credenciais padrão do ambiente Cloud Run)
const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'rksucatas';

export class StorageService {
  private bucket;

  constructor() {
    this.bucket = storage.bucket(BUCKET_NAME);
  }

  /**
   * Gera uma URL assinada para upload direto do navegador.
   * Esta é a forma MAIS SEGURA e eficiente de fazer upload.
   */
  async generateUploadUrl(filename?: string, fileType?: string) {
    try {
      const fileId = uuidv4();
      const extension = filename ? filename.split('.').pop() : 'jpg';
      const finalFilename = fileId + (extension ? `.${extension}` : '');
      const file = this.bucket.file(finalFilename);

      console.log(`📝 Tentando gerar URL assinada para: ${finalFilename}`);

      const options = {
        version: 'v4' as const,
        action: 'write' as const,
        expires: Date.now() + 15 * 60 * 1000, // 15 minutos para fazer o upload
        contentType: fileType || 'image/jpeg',
      };

      const [url] = await file.getSignedUrl(options);
      
      return {
        uploadUrl: url,
        publicUrl: `https://storage.googleapis.com/${BUCKET_NAME}/${finalFilename}`,
        filename: finalFilename,
      };
    } catch (error: any) {
      if (error.message.includes('IAM Service Account Credentials API')) {
        // Não logar como erro fatal, pois temos fallback
        console.log('ℹ️ Info: IAM API desativada. O sistema usará o upload direto como fallback.');
      } else {
        console.error('❌ Erro detalhado no StorageService:', error);
      }
      throw new Error(`Erro ao gerar URL assinada: ${error.message}`);
    }
  }

  /**
   * Faz upload de um arquivo diretamente do servidor para o bucket.
   * Útil como fallback se a URL assinada falhar.
   */
  async uploadFile(filePath: string, destination: string, contentType: string) {
    try {
      await this.bucket.upload(filePath, {
        destination,
        metadata: {
          contentType,
        },
      });
      
      return `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`;
    } catch (error: any) {
      console.error('❌ Erro no upload direto para GCS:', error);
      throw error;
    }
  }

  /**
   * Faz upload de um buffer diretamente para o bucket.
   */
  async uploadBuffer(buffer: Buffer, destination: string, contentType: string) {
    try {
      const file = this.bucket.file(destination);
      await file.save(buffer, {
        metadata: { contentType },
      });
      return `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`;
    } catch (error: any) {
      console.error('❌ Erro no upload de buffer para GCS:', error);
      throw error;
    }
  }
  async generateReadUrl(filename: string, expiresInMinutes = 60) {
    const file = this.bucket.file(filename);
    const options = {
      version: 'v4' as const,
      action: 'read' as const,
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    };

    const [url] = await file.getSignedUrl(options);
    return url;
  }

  /**
   * Deleta uma imagem do bucket
   */
  async deleteFile(filename: string) {
    try {
      await this.bucket.file(filename).delete();
      return true;
    } catch (error) {
      console.error('Erro ao deletar arquivo:', error);
      return false;
    }
  }
}

export default new StorageService();
