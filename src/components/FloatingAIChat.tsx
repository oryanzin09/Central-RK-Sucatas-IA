import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Send, 
  Loader2, 
  Check,
  Package,
  TrendingUp
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  dados?: any;
}

interface FloatingAIChatProps {
  theme: 'light' | 'dark';
}

export const FloatingAIChat: React.FC<FloatingAIChatProps> = ({ theme }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    setMessages([]); // Limpa tudo ao fechar
    setInput('');
  };

  const handleOpen = () => {
    setIsOpen(true);
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: '👋 Olá! Faça sua pergunta sobre o estoque.\n\n💡 Exemplos:\n• "Tem farol da CG 150?"\n• "Vender painel da fan por 350 no pix"\n• "Relatório de hoje"',
      timestamp: new Date()
    }]);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta: userMessage.content })
      });

      const data = await response.json();

      if (!data.success) {
        const errorMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `❌ **Erro de conexão com a IA**\n\n${data.resposta || 'Tente novamente mais tarde.'}\n\nEnquanto isso, você pode buscar manualmente na página de Estoque.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsLoading(false);
        return;
      }

      const formatarResposta = (intencao: string, dados: any, respostaOriginal?: string) => {
        const linhas = [];
        
        if (respostaOriginal && intencao !== 'outro') {
          linhas.push(respostaOriginal);
          linhas.push('');
        }
        
        if (intencao === 'busca') {
          if (dados.itens?.length > 0) {
            linhas.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            linhas.push('🔍 RESULTADO DA BUSCA');
            linhas.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            linhas.push('');
            
            dados.itens.forEach((item: any) => {
              linhas.push(`📦 ${item.nome.toUpperCase()}`);
              linhas.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              if (item.moto) linhas.push(`🏍️ Moto: ${item.moto}`);
              if (item.rk_id) linhas.push(`🔢 ID: ${item.rk_id}`);
              if (item.valor) linhas.push(`💰 Valor: R$ ${item.valor.toFixed(2).replace('.', ',')}`);
              if (item.estoque !== undefined) linhas.push(`📊 Estoque: ${item.estoque} ${item.estoque === 1 ? 'unidade' : 'unidades'}`);
              linhas.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              linhas.push('📍 Ações: [Alterar] [Deletar] [Imagens]');
              linhas.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              linhas.push('');
            });
          } else {
            linhas.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            linhas.push('❌ NÃO ENCONTRADO');
            linhas.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            if (dados.sugestoes?.length > 0) {
              linhas.push('💡 Sugestões:');
              dados.sugestoes.forEach((s: string) => linhas.push(`• ${s}`));
              linhas.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            }
          }
        }
        
        else if (intencao === 'relatorio') {
          let titulo = '';
          switch (dados.periodo) {
            case 'hoje': titulo = 'RESUMO DO DIA'; break;
            case 'ontem': titulo = 'RESUMO DE ONTEM'; break;
            case 'semana': titulo = 'RESUMO DA SEMANA'; break;
            case 'mes': titulo = 'RESUMO DO MÊS'; break;
            default: titulo = 'RELATÓRIO';
          }
          
          linhas.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          linhas.push(`📊 ${titulo}`);
          linhas.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          linhas.push('');
          linhas.push('💰 Vendas');
          linhas.push(`R$ ${dados.totalVendas?.toFixed(2).replace('.', ',') || '0,00'}`);
          linhas.push('');
          linhas.push('📦 Quantidade');
          linhas.push(`${dados.quantidadeVendas || 0}`);
          if (dados.totalSaidas > 0) {
            linhas.push('');
            linhas.push('💸 Saídas');
            linhas.push(`R$ ${dados.totalSaidas?.toFixed(2).replace('.', ',') || '0,00'}`);
            linhas.push('');
            linhas.push('📉 Despesas');
            linhas.push(`${dados.quantidadeSaidas || 0}`);
          }
          linhas.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }
        else {
            linhas.push(data.resposta);
        }
        
        return linhas.join('\n');
      };

      const respostaFormatada = formatarResposta(data.intencao, data.dados, data.resposta);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: respostaFormatada,
        timestamp: new Date(),
        dados: data.dados
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Erro:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '❌ Erro ao processar sua pergunta. Tente novamente.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

  return (
    <>
      <motion.button
        className="fixed bottom-24 right-8 w-14 h-14 bg-violet-600 rounded-full shadow-xl flex items-center justify-center z-50 hover:bg-violet-500 transition-all duration-200 group"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleOpen}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
      >
        <Sparkles className="text-white w-6 h-6 group-hover:rotate-12 transition-transform" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[650px] z-50 rounded-2xl shadow-2xl overflow-hidden border flex flex-col"
            style={{
              backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
              borderColor: theme === 'dark' ? '#27272a' : '#e5e7eb'
            }}
          >
            <div className={cn(
              "p-4 border-b flex items-center justify-between z-10",
              theme === 'dark' ? "border-zinc-800 bg-zinc-900/90 backdrop-blur-md" : "border-zinc-200 bg-zinc-50/90 backdrop-blur-md"
            )}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-violet-600/20">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div>
                  <h3 className={cn("font-semibold", theme === 'dark' ? "text-white" : "text-zinc-900")}>
                    Assistente RK
                  </h3>
                  <p className="text-xs text-zinc-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Online - Perguntas rápidas
                  </p>
                </div>
              </div>
              
              <motion.button
                onClick={handleClose}
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group",
                  theme === 'dark' 
                    ? "bg-zinc-800 hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-400" 
                    : "bg-zinc-200 hover:bg-emerald-500/20 text-zinc-600 hover:text-emerald-600"
                )}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                title="Fechar e limpar chat"
              >
                <Check size={20} className="group-hover:scale-110 transition-transform" />
              </motion.button>
            </div>

            <div 
              className="flex-1 overflow-y-auto p-4 space-y-4 relative"
            >
              <div className="absolute inset-0 z-0">
                <img 
                  src="https://images.unsplash.com/photo-1565043666741-69f6646e95e0?q=80&w=2070&auto=format&fit=crop" 
                  alt="Oficina de motos"
                  className="w-full h-full object-cover opacity-5"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-900/50 to-zinc-900" />
              </div>
              
              <div className="relative z-10 space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[85%] rounded-2xl p-3 shadow-md",
                      msg.role === 'user'
                        ? "bg-violet-600 text-white rounded-tr-none"
                        : theme === 'dark'
                          ? "bg-zinc-800/90 backdrop-blur-md border border-zinc-700/50 text-zinc-100 rounded-tl-none"
                          : "bg-white/90 backdrop-blur-md border border-zinc-200 text-zinc-900 rounded-tl-none"
                    )}>
                      <p className={cn(
                        "text-sm whitespace-pre-wrap leading-relaxed",
                        msg.role === 'assistant' && "text-zinc-300 font-mono"
                      )}>{msg.content}</p>
                      
                      <p className={cn("text-[10px] mt-2 opacity-50", msg.role === 'user' ? "text-right" : "text-left")}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className={cn(
                      "max-w-[80%] rounded-2xl p-3 rounded-tl-none flex items-center gap-2 shadow-md",
                      theme === 'dark' ? "bg-zinc-800/90 backdrop-blur-md border border-zinc-700/50" : "bg-white/90 backdrop-blur-md border border-zinc-200"
                    )}>
                      <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                      <span className={cn("text-sm", theme === 'dark' ? "text-zinc-400" : "text-zinc-500")}>Pensando...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className={cn(
              "p-4 border-t z-10",
              theme === 'dark' ? "border-zinc-800 bg-zinc-900/90 backdrop-blur-md" : "border-zinc-200 bg-zinc-50/90 backdrop-blur-md"
            )}>
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Pergunte sobre peças, vendas..."
                  className={cn(
                    "flex-1 border rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-violet-500 transition-colors",
                    theme === 'dark' 
                      ? "bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500" 
                      : "bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400"
                  )}
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "p-3 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
                    "bg-violet-600 hover:bg-violet-500 text-white",
                    "shadow-lg shadow-violet-600/20"
                  )}
                >
                  <Send size={18} />
                </button>
              </div>
              <p className="text-[10px] text-center mt-2 text-zinc-500">
                Powered by Gemini • Conversas rápidas • Fechar com ✓
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
