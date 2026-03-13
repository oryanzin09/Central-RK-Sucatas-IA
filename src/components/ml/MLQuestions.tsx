import React from 'react';

export const MLQuestions = ({ theme }: { theme: string }) => {
  return (
    <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'}`}>
      <h3 className="text-lg font-bold mb-4">Perguntas</h3>
      <p className="text-zinc-500">Módulo de perguntas em desenvolvimento...</p>
    </div>
  );
};
