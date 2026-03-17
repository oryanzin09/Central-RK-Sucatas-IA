import { useState } from 'react';
import { Truck, Loader2, Package, Ruler, Weight, MapPin, DollarSign, Clock } from 'lucide-react';
import { cn } from '../utils';

export const FreteView = ({ theme }: { theme: 'light' | 'dark' }) => {
  const [cep, setCep] = useState('');
  const [peso, setPeso] = useState('');
  const [largura, setLargura] = useState('');
  const [altura, setAltura] = useState('');
  const [comprimento, setComprimento] = useState('');
  const [sortBy, setSortBy] = useState<'price' | 'time'>('price');
  const [originCity, setOriginCity] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<any[]>([]);

  const fetchCityByCep = async (cep: string) => {
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep.replace('-', '')}/json/`);
      const data = await response.json();
      return data.localidade || '';
    } catch (error) {
      console.error('Erro ao buscar cidade:', error);
      return '';
    }
  };

  const handleCalculate = async () => {
    setLoading(true);
    try {
      // Fetch cities
      const [origin, dest] = await Promise.all([
        fetchCityByCep('58660-000'),
        fetchCityByCep(cep)
      ]);
      setOriginCity(origin);
      setDestinationCity(dest);

      const response = await fetch('/api/frete/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cep_origem: '58660-000',
          cep_destino: cep,
          peso,
          largura,
          altura,
          comprimento
        })
      });
      const data = await response.json();
      setOptions(data.data || []);
    } catch (error) {
      console.error('Erro ao calcular frete:', error);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = cn(
    "w-full p-3 rounded-xl border transition-all duration-200 outline-none focus:ring-2",
    theme === 'dark' 
      ? "bg-zinc-800 border-zinc-700 text-white focus:ring-amber-500/50 focus:border-amber-500" 
      : "bg-white border-zinc-300 text-zinc-900 focus:ring-amber-500/50 focus:border-amber-500"
  );

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-amber-500/10 rounded-2xl">
          <Truck className="text-amber-500" size={32} />
        </div>
        <div>
          <h2 className={cn("text-3xl font-bold tracking-tight", theme === 'dark' ? "text-white" : "text-zinc-900")}>
            Calculadora de Frete
          </h2>
          <p className={theme === 'dark' ? "text-zinc-400" : "text-zinc-500"}>
            Simule o envio de peças com segurança e rapidez.
          </p>
        </div>
      </div>

      <div className={cn("p-8 rounded-3xl border shadow-sm", theme === 'dark' ? "bg-zinc-900/50 border-zinc-800" : "bg-white border-zinc-200")}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2 space-y-2">
            <label className={cn("text-sm font-medium flex items-center gap-2", theme === 'dark' ? "text-zinc-300" : "text-zinc-700")}>
              <MapPin size={16} /> CEP de Destino
            </label>
            <input type="text" placeholder="00000-000" value={cep} onChange={(e) => setCep(e.target.value)} className={inputClass} />
          </div>
          
          <div className="space-y-2">
            <label className={cn("text-sm font-medium flex items-center gap-2", theme === 'dark' ? "text-zinc-300" : "text-zinc-700")}>
              <Weight size={16} /> Peso (kg)
            </label>
            <input type="number" placeholder="Ex: 1.5" value={peso} onChange={(e) => setPeso(e.target.value)} className={inputClass} />
          </div>

          <div className="space-y-2">
            <label className={cn("text-sm font-medium flex items-center gap-2", theme === 'dark' ? "text-zinc-300" : "text-zinc-700")}>
              <Ruler size={16} /> Largura (cm)
            </label>
            <input type="number" placeholder="Ex: 20" value={largura} onChange={(e) => setLargura(e.target.value)} className={inputClass} />
          </div>

          <div className="space-y-2">
            <label className={cn("text-sm font-medium flex items-center gap-2", theme === 'dark' ? "text-zinc-300" : "text-zinc-700")}>
              <Ruler size={16} /> Altura (cm)
            </label>
            <input type="number" placeholder="Ex: 15" value={altura} onChange={(e) => setAltura(e.target.value)} className={inputClass} />
          </div>

          <div className="space-y-2">
            <label className={cn("text-sm font-medium flex items-center gap-2", theme === 'dark' ? "text-zinc-300" : "text-zinc-700")}>
              <Ruler size={16} /> Comprimento (cm)
            </label>
            <input type="number" placeholder="Ex: 30" value={comprimento} onChange={(e) => setComprimento(e.target.value)} className={inputClass} />
          </div>
        </div>
        
        <button 
          onClick={handleCalculate} 
          disabled={loading} 
          className="mt-8 w-full p-4 rounded-xl bg-amber-500 text-white font-bold text-lg hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98]"
        >
          {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Calcular Frete'}
        </button>
      </div>

      {options.length > 0 && (
        <div className={cn("p-6 rounded-3xl border shadow-sm mb-8", theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200")}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className={cn("text-xs font-bold uppercase tracking-wider mb-3", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")}>Rota</div>
            <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <span className={cn("px-3 py-1 rounded-full text-sm font-medium", theme === 'dark' ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-700")}>
                    58660-000
                  </span>
                  <span className={cn("text-xs mt-1 text-center", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")}>{originCity}</span>
                </div>
                <span className="text-amber-500">→</span>
                <div className="flex flex-col">
                  <span className={cn("px-3 py-1 rounded-full text-sm font-medium", theme === 'dark' ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-700")}>
                    {cep || '---'}
                  </span>
                  <span className={cn("text-xs mt-1 text-center", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")}>{destinationCity}</span>
                </div>
              </div>
            </div>
            <div>
              <div className={cn("text-xs font-bold uppercase tracking-wider mb-3", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")}>Volume</div>
              <div className={cn("font-semibold text-lg", theme === 'dark' ? "text-white" : "text-zinc-900")}>
                {largura} x {altura} x {comprimento} cm
              </div>
              <div className={cn("text-sm", theme === 'dark' ? "text-zinc-400" : "text-zinc-500")}>{peso} kg</div>
            </div>
            <div>
              <div className={cn("text-xs font-bold uppercase tracking-wider mb-3", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")}>Seguro</div>
              <div className={cn("font-semibold text-lg", theme === 'dark' ? "text-white" : "text-zinc-900")}>R$ 0,00</div>
            </div>
          </div>
        </div>
      )}

      {options.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className={cn("text-xl font-semibold", theme === 'dark' ? "text-white" : "text-zinc-900")}>Opções de Envio</h3>
            <div className="flex gap-2">
              <button 
                onClick={() => setSortBy('price')}
                className={cn("flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all", 
                  sortBy === 'price' 
                    ? (theme === 'dark' ? "bg-amber-900/30 text-amber-500 border border-amber-500/50" : "bg-amber-100 text-amber-700 border border-amber-500/50")
                    : (theme === 'dark' ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200")
                )}>
                <DollarSign size={16} /> Mais barato
              </button>
              <button 
                onClick={() => setSortBy('time')}
                className={cn("flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all", 
                  sortBy === 'time'
                    ? (theme === 'dark' ? "bg-amber-900/30 text-amber-500 border border-amber-500/50" : "bg-amber-100 text-amber-700 border border-amber-500/50")
                    : (theme === 'dark' ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200")
                )}>
                <Clock size={16} /> Menor prazo
              </button>
            </div>
          </div>
          {options
            .filter(opt => !isNaN(parseFloat(opt.price)))
            .sort((a, b) => {
              if (sortBy === 'price') return parseFloat(a.price) - parseFloat(b.price);
              return parseInt(a.delivery_time) - parseInt(b.delivery_time);
            })
            .map((opt, i) => (
              <div key={i} className={cn("p-5 rounded-2xl border flex justify-between items-center transition-all hover:border-amber-500/50", theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200")}>
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-zinc-800 rounded-lg">
                    <Package className="text-amber-500" size={24} />
                  </div>
                  <div>
                    <div className={cn("font-bold text-lg", theme === 'dark' ? "text-white" : "text-zinc-900")}>
                      {opt.company?.name || 'Transportadora'}
                    </div>
                    <div className={cn("text-xs font-medium uppercase tracking-wider", theme === 'dark' ? "text-amber-500" : "text-amber-600")}>
                      {opt.name}
                    </div>
                    <div className={cn("text-sm mt-1", theme === 'dark' ? "text-zinc-400" : "text-zinc-500")}>
                      Prazo: {opt.delivery_time ? `${opt.delivery_time} dias` : 'Não informado'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-emerald-400 font-bold text-lg">R$ {parseFloat(opt.price).toFixed(2).replace('.', ',')}</div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
