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
}

export default function QuestionsDashboard({ theme }: { theme: 'light' | 'dark' }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [statusFilter, setStatusFilter] = useState<'TODAS' | 'UNANSWERED' | 'ANSWERED'>('UNANSWERED');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ml/questions?status=all&limit=50')
      .then(res => res.json())
      .then(data => {
        setQuestions(data.questions || []);
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
      "border rounded-2xl overflow-hidden transition-all duration-300 mt-6",
      theme === 'dark' 
        ? "bg-zinc-900/40 border-zinc-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)]" 
        : "bg-white border-zinc-200 shadow-sm"
    )}>
      <div className={cn(
        "p-4 border-b flex items-center justify-between",
        theme === 'dark' ? "border-zinc-800/50" : "border-zinc-100"
      )}>
        <h3 className={cn("font-bold tracking-tight", theme === 'dark' ? "text-white" : "text-zinc-900")}>
          Perguntas (Mercado Livre)
        </h3>
        <div className="flex gap-2">
          {['UNANSWERED', 'ANSWERED', 'TODAS'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as any)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors",
                statusFilter === status
                  ? "bg-violet-500 text-white"
                  : theme === 'dark'
                    ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              )}
            >
              {status === 'UNANSWERED' ? 'Não respondidas' : status === 'ANSWERED' ? 'Respondidas' : 'Todas'}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className={cn(
              "text-[10px] uppercase font-bold tracking-wider",
              theme === 'dark' ? "bg-zinc-800/30 text-zinc-500" : "bg-zinc-50 text-zinc-500"
            )}>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">Pergunta</th>
              <th className="px-4 py-3">Última mensagem</th>
            </tr>
          </thead>
          <tbody className={cn("divide-y", theme === 'dark' ? "divide-zinc-800/30" : "divide-zinc-100")}>
            {filteredQuestions.map(q => (
              <tr key={q.id} className={cn("transition-colors", theme === 'dark' ? "hover:bg-zinc-800/20" : "hover:bg-zinc-50")}>
                <td className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-200">{q.from.nickname}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs truncate max-w-[200px]">{q.item_title}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs truncate max-w-[200px]">{q.text}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs">
                  {new Date(q.date_created).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
