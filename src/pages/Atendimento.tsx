import React, { useState, useEffect, useRef, useContext } from 'react';
import { 
  MessageSquare, Send, Search, Phone, MoreVertical, 
  ChevronDown, Package, DollarSign, Loader2, Bot, 
  User, Clock, Check, X, AlertCircle, Archive,
  QrCode, RefreshCw, Trash2, Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DataContext } from '../App';

interface WhatsAppMessage {
  id: string;
  from: string;
  number?: string;
  name: string;
  body: string;
  profilePic?: string;
  timestamp: string | Date;
  status: 'unread' | 'read';
  processed: boolean;
  intent?: {
    intencao: string;
    termo: string;
    resumo: string;
  };
  replied?: boolean;
  repliedAt?: string | Date;
}
interface AtendimentoProps {
  theme: 'light' | 'dark';
}

export const Atendimento: React.FC<AtendimentoProps> = ({ theme }) => {
  const { 
    whatsappStatus, 
    whatsappConversations: conversations, 
    whatsappQr: qrCode,
    refreshData: refreshGlobalData 
  } = useContext(DataContext);

  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [conversationMessages, setConversationMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showReconnecting, setShowReconnecting] = useState(false);
  
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  const isConnected = whatsappStatus.connected;
  const connectionStatus = whatsappStatus.connected ? 'connected' : whatsappStatus.isConnecting ? 'connecting' : 'disconnected';

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (whatsappStatus.isConnecting) {
      timeout = setTimeout(() => {
        setShowReconnecting(true);
      }, 10000); // 10 segundos
    } else {
      setShowReconnecting(false);
    }
    return () => clearTimeout(timeout);
  }, [whatsappStatus.isConnecting]);

  useEffect(() => {
    // Atualizar mensagens da conversa selecionada quando as conversas globais mudarem
    if (selectedConversation) {
      const updatedSelected = conversations.find(c => c.number === selectedConversation.number);
      if (updatedSelected) {
        setConversationMessages(updatedSelected.messages || []);
      }
    }
  }, [conversations, selectedConversation]);

  useEffect(() => {
    // Verificar status da conexão ao carregar a página para garantir persistência
    const checkConnectionStatus = async () => {
      try {
        // await fetch('/api/whatsapp/status');
        // O status será atualizado via socket no DataContext global
      } catch (error) {
        console.error('Erro ao verificar status:', error);
      }
    };
    
    checkConnectionStatus();
    
    // Buscar logs iniciais
    fetchLogs();
    
    // Log do tempo de início do servidor para depuração
    /*
    fetch('/api/whatsapp/status')
      .then(res => res.json())
      .then(data => {
        if (data.serverStartTime) {
          addLog(`🚀 Servidor iniciado em: ${new Date(data.serverStartTime).toLocaleString()}`);
        }
      });
    */
  }, []);

  const fetchLogs = async () => {
    try {
      /*
      const logsRes = await fetch('/api/whatsapp/logs');
      const logsData = await logsRes.json();
      if (logsData.success) {
        setLogs(logsData.logs);
      }
      */
    } catch (e) {}
  };

  const addLog = (message: string) => {
    setLogs(prev => [`${new Date().toLocaleTimeString()} - ${message}`, ...prev].slice(0, 50));
  };

  const forceNewQR = async () => {
    addLog('🔄 Forçando novo QR Code...');
    try {
      /*
      const response = await fetch('/api/whatsapp/force-qr', { method: 'POST' });
      const data = await response.json();
      if (!data.success) {
        addLog(`❌ Erro ao forçar QR: ${data.error}`);
      }
      */
    } catch (error: any) {
      addLog(`❌ Erro de rede ao forçar QR: ${error.message}`);
    }
  };

  const handleSelectConversation = async (conv: any) => {
    setSelectedConversation(conv);
    setConversationMessages(conv.messages || []);
    
    // Marcar como lida se tiver mensagens não lidas
    if (conv.unreadCount > 0) {
      try {
        // Encontrar a última mensagem não lida e marcar como lida
        const lastUnread = conv.messages.findLast((m: any) => m.status === 'unread');
        if (lastUnread) {
          // await fetch(`/api/whatsapp/messages/${lastUnread.id}/read`, { method: 'POST' });
        }
      } catch (e) {}
    }

    // Se tiver intenção de busca, pesquisar no estoque
    if (conv.intent?.termo) {
      searchInventory(conv.intent.termo);
    }
    
    setTimeout(() => {
      replyInputRef.current?.focus();
    }, 100);
  };

  const handleLogout = async () => {
    if (!window.confirm('Deseja realmente desconectar o WhatsApp? Isso irá gerar um novo QR Code.')) return;
    
    setIsLoggingOut(true);
    try {
      /*
      const response = await fetch('/api/whatsapp/logout', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        // O socket vai emitir o novo QR em breve
      }
      */
    } catch (error) {
      console.error('Erro ao deslogar:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLogs();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleDeleteLocal = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Deseja excluir esta mensagem do sistema?")) return;
    
    try {
      /*
      const res = await fetch(`/api/whatsapp/messages/${id}`, { method: 'DELETE' });
      if (res.ok) {
        addLog(`🗑️ Mensagem deletada localmente`);
        // A atualização virá via socket (whatsapp-conversations)
      }
      */
    } catch (error) {
      console.error('Erro ao excluir mensagem local:', error);
    }
  };

  const handleDeleteRemote = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Deseja excluir esta mensagem do WhatsApp (Apagar para todos)?")) return;
    
    try {
      /*
      const res = await fetch(`/api/whatsapp/messages/${id}/remote`, { method: 'DELETE' });
      if (res.ok) {
        addLog(`🗑️ Mensagem deletada remotamente`);
        // A atualização virá via socket (whatsapp-conversations)
      } else {
        const data = await res.json();
        alert("Erro ao excluir do WhatsApp: " + data.error);
      }
      */
    } catch (error) {
      console.error('Erro ao excluir mensagem remota:', error);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, number: string) => {
    e.stopPropagation();
    if (!window.confirm("Deseja excluir toda a conversa com este contato? Esta ação não pode ser desfeita.")) return;
    
    try {
      /*
      const res = await fetch(`/api/whatsapp/conversations/${number}`, { method: 'DELETE' });
      if (res.ok) {
        addLog(`🗑️ Conversa com ${number} excluída`);
        if (selectedConversation?.number === number) {
          setSelectedConversation(null);
          setConversationMessages([]);
        }
      }
      */
    } catch (error) {
      console.error('Erro ao excluir conversa:', error);
    }
  };

  const searchInventory = async (termo: string) => {
    setSearching(true);
    try {
      const response = await fetch(`/api/inventory`);
      const data = await response.json();
      if (data.success) {
        const filtered = data.data.filter((item: any) => 
          item.nome.toLowerCase().includes(termo.toLowerCase()) ||
          item.moto.toLowerCase().includes(termo.toLowerCase())
        ).slice(0, 5);
        setSearchResults(filtered);
      }
    } catch (error) {
      console.error('Erro ao buscar estoque:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConversation || sending) return;

    setSending(true);
    setSendError(null);
    try {
      /*
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: selectedConversation.number,
          message: replyText
        })
      });

      const data = await response.json();
      if (response.ok || data.success) {
        setReplyText('');
        if (data.status === 'queued') {
          addLog(`⏳ Mensagem enfileirada para ${selectedConversation.name}`);
          setSendError("Mensagem enfileirada. Será enviada assim que a conexão for restabelecida.");
          setTimeout(() => setSendError(null), 5000);
        } else {
          addLog(`✅ Resposta enviada para ${selectedConversation.name}`);
        }
      } else {
        setSendError(data.error || 'Erro ao enviar mensagem');
        addLog(`❌ Erro ao enviar: ${data.error}`);
      }
      */
    } catch (error: any) {
      setSendError('Erro de conexão ao tentar enviar');
      console.error('Erro ao enviar resposta:', error);
    } finally {
      setSending(false);
    }
  };

  const insertProductIntoReply = (product: any) => {
    const productText = `🔹 *${product.nome}*\n💰 R$ ${product.valor.toFixed(2)}\n🔢 ID: ${product.rk_id}\n📦 Estoque: ${product.estoque}`;
    setReplyText(prev => prev + (prev ? '\n\n' : '') + productText);
  };

  const formatTime = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    
    if (d.toDateString() === hoje.toDateString()) {
      return `Hoje ${formatTime(d)}`;
    } else if (d.toDateString() === ontem.toDateString()) {
      return `Ontem ${formatTime(d)}`;
    } else {
      return d.toLocaleDateString('pt-BR') + ' ' + formatTime(d);
    }
  };

  const getIntentIcon = (intencao: string) => {
    switch (intencao) {
      case 'busca': return '🔍';
      case 'orcamento': return '💰';
      case 'compra': return '🛒';
      case 'saudacao': return '👋';
      default: return '💬';
    }
  };

  const filteredConversations = conversations.filter(conv => {
    // Blacklist
    if (conv.number === '558382039490') return false;
    
    if (showOnlyUnread && conv.unreadCount > 0) return true;
    if (!showOnlyUnread) return true;
    return false;
  }).filter(conv => 
    conv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.lastMessage.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.number.includes(searchTerm)
  );

  const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

  return (
    <div className="h-[calc(100vh-120px)] flex gap-4">
      {/* Lista de Conversas */}
      <div className={cn(
        "w-96 border rounded-2xl overflow-hidden flex flex-col",
        theme === 'dark' ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-200"
      )}>
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Mensagens WhatsApp</h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowLogs(!showLogs)}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  theme === 'dark' ? "hover:bg-zinc-800 text-zinc-500" : "hover:bg-zinc-100 text-zinc-400"
                )}
                title="Ver Logs de Conexão"
              >
                <Clock size={14} />
              </button>
              <button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  theme === 'dark' ? "hover:bg-zinc-800 text-zinc-500" : "hover:bg-zinc-100 text-zinc-400",
                  isRefreshing && "animate-spin"
                )}
              >
                <RefreshCw size={14} />
              </button>
              {isConnected ? (
                <div className="flex items-center gap-2">
                  {showReconnecting ? (
                    <span className="flex items-center gap-1 text-[10px] text-amber-500 font-bold uppercase tracking-wider" title="O sistema está tentando restabelecer a conexão silenciosamente">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Reconectando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Sistema Ativo
                    </span>
                  )}
                  <button 
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="text-[10px] text-zinc-500 hover:text-rose-400 font-bold uppercase transition-colors"
                  >
                    Sair
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {/* Indicador discreto de offline para o admin */}
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Offline" />
                  
                  <button 
                    onClick={forceNewQR}
                    className="text-[10px] text-zinc-500 hover:text-violet-400 font-bold uppercase transition-colors"
                  >
                    Conectar
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou número..."
              className={cn(
                "w-full border rounded-xl py-2 pl-9 pr-4 text-sm",
                theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-zinc-50 border-zinc-200"
              )}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOnlyUnread(true)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium transition-colors",
                showOnlyUnread
                  ? "bg-violet-600 text-white"
                  : theme === 'dark' ? "bg-zinc-800 text-zinc-400" : "bg-zinc-200 text-zinc-600"
              )}
            >
              Não lidas
            </button>
            <button
              onClick={() => setShowOnlyUnread(false)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium transition-colors",
                !showOnlyUnread
                  ? "bg-violet-600 text-white"
                  : theme === 'dark' ? "bg-zinc-800 text-zinc-400" : "bg-zinc-200 text-zinc-600"
              )}
            >
              Todas
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {showLogs && (
            <div className={cn(
              "p-4 text-[10px] font-mono border-b border-zinc-800 max-h-40 overflow-y-auto",
              theme === 'dark' ? "bg-black text-zinc-400" : "bg-zinc-100 text-zinc-600"
            )}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold uppercase">Logs de Conexão</span>
                <button onClick={() => setShowLogs(false)} className="hover:text-white">Fechar</button>
              </div>
              {logs.length === 0 ? "Nenhum log disponível" : logs.map((log, i) => (
                <div key={i} className="mb-1">{log}</div>
              ))}
            </div>
          )}

          {qrCode && !isConnected && (
            <div className="p-4 mb-4 bg-zinc-800/50 rounded-xl border border-zinc-700 mx-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Ação Necessária
                  </span>
                </div>
                <button
                  onClick={forceNewQR}
                  className="text-[10px] px-3 py-1 bg-violet-600 text-white rounded-lg hover:bg-violet-500 font-bold uppercase"
                >
                  Novo QR
                </button>
              </div>
              
              <div className="flex flex-col items-center">
                <div className="bg-white p-3 rounded-xl mb-2">
                  <img src={qrCode} alt="QR Code" className="w-40 h-40" />
                </div>
                <p className="text-[10px] text-zinc-500 text-center">
                  Escaneie para conectar o WhatsApp
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-violet-500" size={24} />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.number}
                onClick={() => handleSelectConversation(conv)}
                className={cn(
                  "p-4 border-b border-zinc-800 cursor-pointer transition-colors group",
                  selectedConversation?.number === conv.number 
                    ? theme === 'dark' ? "bg-violet-500/10" : "bg-violet-50"
                    : "hover:bg-zinc-800/20",
                  conv.unreadCount > 0 && "border-l-4 border-l-violet-500"
                )}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center overflow-hidden border border-zinc-700 flex-shrink-0">
                      {conv.profilePic ? (
                        <img src={conv.profilePic} alt={conv.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User size={20} className="text-zinc-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm leading-tight truncate">{conv.name}</h4>
                      <p className="text-[10px] text-zinc-500 truncate">{conv.number}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-[10px] text-zinc-500">{formatTime(conv.lastTimestamp)}</p>
                    {conv.unreadCount > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] bg-violet-600 text-white rounded-full font-bold">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
                
                <p className="text-xs line-clamp-2 mt-2 text-zinc-400">
                  {conv.lastMessage}
                </p>
                
                {conv.intent && (
                  <div className="mt-2 flex items-center gap-1">
                    <span className="text-[10px] bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded-full border border-violet-500/20 font-bold uppercase">
                      {getIntentIcon(conv.intent.intencao)} {conv.intent.resumo}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Área de Atendimento */}
      {selectedConversation ? (
        <div className={cn(
          "flex-1 border rounded-2xl overflow-hidden flex flex-col",
          theme === 'dark' ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-200"
        )}>
          {/* Header */}
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center overflow-hidden border border-zinc-700">
                {selectedConversation.profilePic ? (
                  <img src={selectedConversation.profilePic} alt={selectedConversation.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User size={20} className="text-zinc-500" />
                )}
              </div>
              <div>
                <h3 className="font-semibold leading-tight">{selectedConversation.name}</h3>
                <p className="text-xs text-zinc-500">{selectedConversation.number}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-xs text-zinc-500">
                Última atividade: {formatDate(selectedConversation.lastTimestamp)}
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400">
                  <Phone size={18} />
                </button>
                <button 
                  onClick={(e) => handleDeleteConversation(e, selectedConversation.number)}
                  className="p-2 hover:bg-rose-500/10 hover:text-rose-500 rounded-lg text-zinc-400 transition-colors"
                  title="Excluir Conversa"
                >
                  <Trash2 size={18} />
                </button>
                <button className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400">
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>
          </div>

          <div 
            className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 relative"
            style={{
              backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')`,
              backgroundSize: '400px',
              backgroundRepeat: 'repeat',
              backgroundColor: theme === 'dark' ? '#0b141a' : '#e5ddd5',
              backgroundAttachment: 'local'
            }}
          >
            {/* Overlay para suavizar o padrão no dark mode */}
            {theme === 'dark' && <div className="absolute inset-0 bg-black/60 pointer-events-none" />}
            
            <div className="relative z-10 flex flex-col gap-6">
              {conversationMessages.map((msg: any) => (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[70%] w-fit p-4 rounded-2xl relative group shadow-lg border",
                    msg.from === 'me'
                      ? "self-end bg-violet-600 text-white rounded-tr-none border-violet-500"
                      : theme === 'dark' 
                        ? "bg-zinc-800 text-white rounded-tl-none border-zinc-700" 
                        : "bg-white text-zinc-900 rounded-tl-none border-zinc-200"
                  )}
                >
                  {/* Foto do remetente (ajustada para fora da bolha) */}
                  {msg.from !== 'me' && selectedConversation?.profilePic && (
                    <div className="absolute -left-14 bottom-0">
                      <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-zinc-900 shadow-xl bg-zinc-800">
                        <img 
                          src={selectedConversation.profilePic} 
                          alt={selectedConversation.name}
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-4 mb-1">
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{msg.body}</p>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                      <button 
                        onClick={(e) => handleDeleteLocal(e, msg.id)}
                        className="p-1 hover:bg-black/20 rounded text-white/70"
                        title="Excluir localmente"
                      >
                        <Trash2 size={12} />
                      </button>
                      {msg.from === 'me' && (
                        <button 
                          onClick={(e) => handleDeleteRemote(e, msg.id)}
                          className="p-1 hover:bg-black/20 rounded text-white/70"
                          title="Apagar para todos"
                        >
                          <Smartphone size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[10px] opacity-60 font-medium">
                      {formatTime(msg.timestamp)}
                    </span>
                    {msg.from === 'me' && (
                      <>
                        {msg.status === 'queued' || msg.status === 'sending' ? (
                          <Clock size={10} className="opacity-60" />
                        ) : msg.status === 'error' ? (
                          <AlertCircle size={10} className="text-rose-400" />
                        ) : (
                          <Check size={10} className="opacity-60" />
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Área de Resposta */}
          <div className="p-4 border-t border-zinc-800">
            {selectedConversation.intent && (
              <div className="mb-3 p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-start gap-3">
                <div className="p-2 bg-violet-500/20 rounded-lg">
                  <Bot size={16} className="text-violet-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">Sugestão da IA</span>
                    <span className="text-[10px] px-2 py-0.5 bg-violet-500/20 text-violet-300 rounded-full">
                      {selectedConversation.intent.intencao}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300">{selectedConversation.intent.resumo}</p>
                </div>
              </div>
            )}

            {sendError && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "mb-4 p-3 rounded-xl border flex items-center gap-3 text-sm",
                  sendError.includes('reconectando') || sendError.includes('enfileirada')
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                    : "bg-red-500/10 border-red-500/20 text-red-500"
                )}
              >
                <AlertCircle size={18} />
                <span className="flex-1">{sendError}</span>
                <button onClick={() => setSendError(null)} className="p-1 hover:bg-black/10 rounded-lg transition-colors">
                  <X size={14} />
                </button>
              </motion.div>
            )}

            <div className="flex gap-2">
              <textarea
                ref={replyInputRef}
                value={replyText}
                onChange={(e) => {
                  setReplyText(e.target.value);
                  if (sendError) setSendError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendReply();
                  }
                }}
                placeholder="Digite sua resposta..."
                className={cn(
                  "flex-1 border rounded-xl p-3 text-sm resize-none h-20 outline-none transition-all",
                  theme === 'dark' ? "bg-zinc-950 border-zinc-800 focus:border-violet-500/50" : "bg-zinc-50 border-zinc-200 focus:border-violet-500"
                )}
              />
              <button
                onClick={handleSendReply}
                disabled={!replyText.trim() || sending || !isConnected}
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                  replyText.trim() && isConnected
                    ? "bg-violet-600 text-white hover:bg-violet-500"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                )}
              >
                {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={cn(
          "flex-1 border rounded-2xl flex items-center justify-center",
          theme === 'dark' ? "bg-zinc-900/20 border-zinc-800/50" : "bg-zinc-50 border-zinc-200"
        )}>
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-violet-500/10 flex items-center justify-center mx-auto mb-6">
              <MessageSquare size={40} className="text-violet-500/40" />
            </div>
            <h3 className="text-xl font-bold mb-2">Central de Atendimento</h3>
            <p className="text-zinc-500 max-w-xs mx-auto">Selecione uma conversa na lateral para iniciar o atendimento manual.</p>
          </div>
        </div>
      )}
    </div>
  );
};
