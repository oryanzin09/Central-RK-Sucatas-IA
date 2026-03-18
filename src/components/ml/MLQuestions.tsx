import React, { useState, useEffect } from 'react';
import { MessageSquare, RefreshCw, Send, CheckCircle, Clock, ExternalLink, Package, User, ChevronRight, AlertCircle } from 'lucide-react';
import { mlApiFetch } from '../../utils/api';
import { cn } from '../../utils';

export const MLQuestions = ({ theme }: { theme: string }) => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('UNANSWERED');
  const [answeringId, setAnsweringId] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const result = await mlApiFetch(`/api/ml/questions?status=${status}&limit=50`);
      if (result.success) {
        setQuestions(result.data);
      }
    } catch (error) {
      console.error('Erro ao buscar perguntas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [status]);

  const handleAnswer = async (questionId: number) => {
    if (!answerText.trim()) return;
    
    setIsSubmitting(true);
    try {
      const result = await mlApiFetch(`/api/ml/questions/${questionId}/answer`, {
        method: 'POST',
        body: JSON.stringify({ answer: answerText })
      });
      
      if (result.success) {
        setQuestions(prev => prev.filter(q => q.id !== questionId));
        setAnsweringId(null);
        setAnswerText('');
        // Se for respondida, removemos da lista de não respondidas
        if (status === 'UNANSWERED') {
          setQuestions(prev => prev.filter(q => q.id !== questionId));
        }
      }
    } catch (error) {
      console.error('Erro ao responder pergunta:', error);
      alert('Erro ao enviar resposta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className={cn(
        "p-4 rounded-2xl border flex flex-col md:flex-row gap-4 items-center justify-between",
        theme === 'dark' ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-200"
      )}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatus('UNANSWERED')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all",
              status === 'UNANSWERED'
                ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                : theme === 'dark' ? "bg-zinc-800 text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900"
            )}
          >
            Não Respondidas
          </button>
          <button
            onClick={() => setStatus('ANSWERED')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all",
              status === 'ANSWERED'
                ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                : theme === 'dark' ? "bg-zinc-800 text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900"
            )}
          >
            Respondidas
          </button>
        </div>
        
        <button
          onClick={() => fetchQuestions()}
          className={cn(
            "p-2 rounded-xl transition-colors",
            theme === 'dark' ? "bg-zinc-800 text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900"
          )}
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Lista de Perguntas */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-4">
          <RefreshCw className="animate-spin text-violet-500" size={40} />
          <p>Buscando perguntas no Mercado Livre...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <div key={q.id} className={cn(
              "border rounded-2xl overflow-hidden transition-all",
              theme === 'dark' ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-200"
            )}>
              {/* Item Info */}
              <div className={cn(
                "p-4 border-b flex items-center gap-4",
                theme === 'dark' ? "border-zinc-800 bg-zinc-950/40" : "border-zinc-100 bg-zinc-50/40"
              )}>
                <div className="w-12 h-12 bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700 flex-shrink-0">
                  <img src={q.item_thumbnail} alt={q.item_title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={cn("font-bold text-sm truncate", theme === 'dark' ? "text-white" : "text-zinc-900")}>
                    {q.item_title}
                  </h4>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-violet-500 font-bold text-xs">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(q.item_price)}
                    </span>
                    <span className="text-zinc-500 text-[10px]">#{q.item_id}</span>
                  </div>
                </div>
                <button 
                  onClick={() => window.open(`https://pergunta.mercadolivre.com.br/MLB-${q.item_id}`, '_blank')}
                  className="p-2 text-zinc-500 hover:text-violet-500 transition-colors"
                >
                  <ExternalLink size={16} />
                </button>
              </div>

              {/* Question Content */}
              <div className="p-6 space-y-4">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                    <User size={20} className="text-violet-500" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={cn("text-xs font-bold", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
                        Comprador
                      </span>
                      <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(q.date_created).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className={cn("text-sm leading-relaxed", theme === 'dark' ? "text-zinc-200" : "text-zinc-800")}>
                      {q.text}
                    </p>
                  </div>
                </div>

                {q.status === 'ANSWERED' && q.answer && (
                  <div className="flex gap-4 pl-14">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={16} className="text-emerald-500" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <span className={cn("text-xs font-bold", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
                        Sua Resposta
                      </span>
                      <p className={cn("text-sm italic opacity-80", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
                        {q.answer.text}
                      </p>
                    </div>
                  </div>
                )}

                {status === 'UNANSWERED' && (
                  <div className="pl-14 pt-2">
                    {answeringId === q.id ? (
                      <div className="space-y-3">
                        <textarea
                          autoFocus
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          placeholder="Digite sua resposta..."
                          className={cn(
                            "w-full p-4 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-violet-500/50 min-h-[100px] resize-none",
                            theme === 'dark' 
                              ? "bg-zinc-950 border-zinc-800 text-zinc-200 placeholder:text-zinc-600" 
                              : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400"
                          )}
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setAnsweringId(null);
                              setAnswerText('');
                            }}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-colors",
                              theme === 'dark' ? "text-zinc-400 hover:text-white" : "text-zinc-500 hover:text-zinc-900"
                            )}
                          >
                            Cancelar
                          </button>
                          <button
                            disabled={isSubmitting || !answerText.trim()}
                            onClick={() => handleAnswer(q.id)}
                            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-violet-600/20"
                          >
                            {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                            Enviar Resposta
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAnsweringId(q.id)}
                        className="text-violet-500 text-sm font-bold flex items-center gap-2 hover:gap-3 transition-all"
                      >
                        Responder agora <ChevronRight size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {questions.length === 0 && (
            <div className="py-20 text-center text-zinc-500 italic flex flex-col items-center gap-4">
              <CheckCircle size={48} className="text-emerald-500/20" />
              <p>Tudo em dia! Nenhuma pergunta pendente.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
