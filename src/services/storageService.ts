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
    const fileId = uuidv4();
    const extension = filename ? filename.split('.').pop() : 'jpg';
    const finalFilename = fileId + (extension ? `.${extension}` : '');
    const file = this.bucket.file(finalFilename);

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
  }

  /**
   * Gera uma URL assinada para LEITURA (se o bucket for privado, o que é recomendado)
   */
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
