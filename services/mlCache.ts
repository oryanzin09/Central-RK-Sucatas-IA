export const ML_CACHE_TTL = 1000 * 60 * 60; // 1 hora
export const mlItemCache: Map<string, { data: any, timestamp: number }> = new Map();
