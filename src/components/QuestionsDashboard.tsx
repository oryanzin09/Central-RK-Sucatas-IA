import React, { useState, useEffect } from 'react';
import { MessageSquare, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn } from '../utils';

interface Question {
  id: string;
  text: string;
  status: 'UNANSWERED' | 'ANSWERED';
  date_created: string;
  from: {
    id: string;
    nickname: string;
  };
  item_title: string;
  item_thumbnail: string;
  answer?: {
    text: string;
    date_created: string;
  };
}

export default function QuestionsDashboard({ theme }: { theme: 'light' | 'dark' }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [statusFilter, setStatusFilter] = useState<'TODAS' | 'UNANSWERED' | 'ANSWERED'>('UNANSWERED');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ml/questions?status=all&limit=50')
      .then(res => res.json())
      .then(data => {
        setQuestions(data.data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Erro ao buscar perguntas:', err);
        setLoading(false);
      });
  }, []);

  const filteredQuestions = questions.filter(q => 
    statusFilter === 'TODAS' ? true : q.status === statusFilter
  );

  return (
    <div className={cn(
      "p-4 space-y-4",
      theme === 'dark' ? "text-zinc-300" : "text-zinc-700"
    )}>
      <div className="flex gap-2 mb-4">
        {['UNANSWERED', 'ANSWERED', 'TODAS'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status as any)}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors",
              statusFilter === status
                ? "bg-violet-600 text-white"
                : theme === 'dark'
                  ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            )}
          >
            {status === 'UNANSWERED' ? 'Não respondidas' : status === 'ANSWERED' ? 'Respondidas' : 'Todas'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10">Carregando...</div>
      ) : filteredQuestions.length === 0 ? (
        <div className="text-center py-10 opacity-50">Nenhuma pergunta encontrada.</div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map(q => (
            <div key={q.id} className={cn(
              "p-4 rounded-2xl border transition-colors",
              theme === 'dark' 
                ? "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700" 
                : "bg-white border-zinc-200 hover:border-zinc-300"
            )}>
              <div className="flex items-start gap-4 mb-3">
                <img src={q.item_thumbnail} alt={q.item_title} className="w-12 h-12 rounded-lg object-cover" />
                <div>
                  <h4 className="font-bold text-sm">{q.item_title}</h4>
                  <p className="text-xs opacity-70">{q.from.nickname} • {new Date(q.date_created).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
              <p className="text-sm mb-3 pl-16">{q.text}</p>
              {q.answer && (
                <div className={cn(
                  "pl-4 border-l-2 ml-16 py-2",
                  theme === 'dark' ? "border-violet-500 bg-zinc-800/50" : "border-violet-400 bg-violet-50"
                )}>
                  <p className="text-xs font-bold mb-1">Sua Resposta:</p>
                  <p className="text-sm">{q.answer.text}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
