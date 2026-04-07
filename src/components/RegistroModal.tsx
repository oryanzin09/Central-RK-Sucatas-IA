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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !telefone) return;
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'clients'), {
        name: nome,
        phone: telefone,
        createdAt: serverTimestamp(),
        status: 'ativo'
      });
      // Salva no dispositivo para não pedir de novo
      localStorage.setItem('rk_client_registered', 'true');
      onClose();
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      alert("Erro ao registrar. Tente novamente.");
    } finally {
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] md:hidden"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              "fixed bottom-0 left-0 right-0 z-[75] md:hidden rounded-t-3xl p-6 pb-nav-safe",
              theme === 'dark' ? "bg-zinc-900 border-t border-zinc-800" : "bg-white border-t border-zinc-200"
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
              <button onClick={onClose} className={cn("p-2 rounded-full", theme === 'dark' ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-500")}>
                <X size={20} />
              </button>
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
                    onChange={(e) => setTelefone(e.target.value)}
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
        </>
      )}
    </AnimatePresence>
  );
};
