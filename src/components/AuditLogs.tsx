import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Loader2, Activity, User, Clock, FileText } from 'lucide-react';

interface AuditLog {
  id: number;
  user_id: number | null;
  user_name: string | null;
  user_phone: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: string | null;
  created_at: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/admin/audit-logs');
      if (response.success) {
        setLogs(response.data);
      } else {
        setError(response.error || 'Erro ao carregar logs de auditoria');
      }
    } catch (err: any) {
      setError(err.message || 'Erro de conexão ao buscar logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatAction = (action: string) => {
    const actionMap: Record<string, { label: string, color: string }> = {
      'UPDATE_USER_ROLE': { label: 'Alterou Permissão', color: 'text-blue-400 bg-blue-400/10' },
      'DELETE_USER': { label: 'Excluiu Usuário', color: 'text-red-400 bg-red-400/10' },
      'CREATE_CLIENT': { label: 'Criou Cliente', color: 'text-emerald-400 bg-emerald-400/10' },
      'UPDATE_CLIENT': { label: 'Atualizou Cliente', color: 'text-yellow-400 bg-yellow-400/10' },
      'DELETE_CLIENT': { label: 'Excluiu Cliente', color: 'text-red-400 bg-red-400/10' },
    };

    const mapped = actionMap[action];
    if (mapped) {
      return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${mapped.color}`}>
          {mapped.label}
        </span>
      );
    }
    return <span className="px-2.5 py-1 rounded-full text-xs font-medium text-gray-400 bg-gray-800">{action}</span>;
  };

  const formatDetails = (detailsStr: string | null) => {
    if (!detailsStr) return '-';
    try {
      const parsed = JSON.parse(detailsStr);
      return (
        <div className="text-xs text-gray-400 max-w-xs truncate" title={JSON.stringify(parsed, null, 2)}>
          {Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join(', ')}
        </div>
      );
    } catch (e) {
      return detailsStr;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
        <p>Erro: {error}</p>
        <button onClick={fetchLogs} className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors">
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="w-6 h-6 text-blue-400" />
          Logs de Auditoria
        </h2>
        <div className="text-sm text-gray-400">
          Últimos {logs.length} registros
        </div>
      </div>

      <div className="bg-[#1a1d24] rounded-xl border border-gray-800 overflow-hidden hidden sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-xs text-gray-400 uppercase bg-[#0f1115]/50 border-b border-gray-800">
              <tr>
                <th className="px-6 py-4 font-medium">Data/Hora</th>
                <th className="px-6 py-4 font-medium">Usuário</th>
                <th className="px-6 py-4 font-medium hidden sm:table-cell">Ação</th>
                <th className="px-6 py-4 font-medium hidden md:table-cell">Alvo</th>
                <th className="px-6 py-4 font-medium hidden lg:table-cell text-right">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-[#222630] transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Clock className="w-4 h-4" />
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-white truncate">{log.user_name || 'Sistema'}</div>
                        <div className="text-xs text-gray-500 sm:hidden">{log.action.replace(/_/g, ' ')}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                    {formatAction(log.action)}
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className="text-gray-400">
                      {log.entity_type} <span className="font-mono text-gray-500">#{log.entity_id}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell text-right">
                    <div className="flex items-center justify-end gap-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                      {formatDetails(log.details)}
                    </div>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Nenhum log de auditoria encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards for Audit Logs */}
      <div className="grid grid-cols-1 gap-4 sm:hidden">
        {logs.map((log) => (
          <div key={log.id} className="bg-[#1a1d24] rounded-2xl border border-gray-800 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                <Clock className="w-3.5 h-3.5" />
                {new Date(log.created_at).toLocaleString('pt-BR')}
              </div>
              <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {log.entity_type}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-white">{log.user_name || 'Sistema'}</div>
                <div className="text-xs text-emerald-400 font-medium">{formatAction(log.action)}</div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-800/50">
              <div className="flex items-start gap-2 text-xs text-gray-400">
                <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span className="italic">{formatDetails(log.details)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
