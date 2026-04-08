import { motion, AnimatePresence } from 'motion/react';
import { X, User, Phone, Loader2 } from 'lucide-react';
import { cn } from '../utils';
import { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const RegistroModal = ({ isOpen, onClose, theme }: { isOpen: boolean; onClose: () => void; theme: 'light' | 'dark' }) => {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }
    if (value.length > 10) {
      value = `${value.slice(0, 10)}-${value.slice(10)}`;
    }
    setTelefone(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !telefone) return;
    
    setLoading(true);
    
    // Feedback visual imediato (fecha o modal logo após iniciar o loading)
    // e salva no localStorage para liberar o catálogo imediatamente.
    localStorage.setItem('rk_client_registered', 'true');
    
    try {
      // Executa a gravação no Firestore em background sem bloquear a UI
      addDoc(collection(db, 'clients'), {
        name: nome,
        phone: telefone,
        createdAt: serverTimestamp(),
        status: 'ativo'
      }).catch(err => console.error("Erro silencioso ao salvar cliente no Firestore:", err));
      
      // Pequeno delay apenas para a animação do botão ser percebida
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error("Erro ao processar registro:", error);
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
          />
          <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center pointer-events-none">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={cn(
                "w-full md:max-w-md pointer-events-auto rounded-t-3xl md:rounded-3xl p-6 pb-nav-safe md:pb-6",
                theme === 'dark' ? "bg-zinc-900 border-t md:border border-zinc-800" : "bg-white border-t md:border border-zinc-200"
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className={cn("text-xl font-bold", theme === 'dark' ? "text-white" : "text-zinc-900")}>
                    Bem-vindo!
                  </h3>
                  <p className={cn("text-sm mt-1", theme === 'dark' ? "text-zinc-400" : "text-zinc-500")}>
                    Preencha para acessar o catálogo
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={cn("text-xs font-bold mb-1.5 block uppercase tracking-wider", theme === 'dark' ? "text-zinc-400" : "text-zinc-500")}>Nome Completo</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className={cn(
                      "w-full pl-10 pr-4 py-3 rounded-xl border outline-none transition-all",
                      theme === 'dark' ? "bg-zinc-800/50 border-zinc-700 text-white focus:border-violet-500" : "bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-violet-500 focus:bg-white"
                    )}
                    placeholder="Seu nome"
                  />
                </div>
              </div>

              <div>
                <label className={cn("text-xs font-bold mb-1.5 block uppercase tracking-wider", theme === 'dark' ? "text-zinc-400" : "text-zinc-500")}>WhatsApp</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="tel"
                    required
                    value={telefone}
                    onChange={handleTelefoneChange}
                    className={cn(
                      "w-full pl-10 pr-4 py-3 rounded-xl border outline-none transition-all",
                      theme === 'dark' ? "bg-zinc-800/50 border-zinc-700 text-white focus:border-violet-500" : "bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-violet-500 focus:bg-white"
                    )}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-violet-600 hover:bg-violet-700 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : 'Acessar Catálogo'}
              </button>
            </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
