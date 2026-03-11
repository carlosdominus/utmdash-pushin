
import React, { useState, useEffect } from 'react';
import { BrainCircuit, RefreshCw, Link, Link2Off, LayoutGrid, Layers, BarChart3, History as HistoryIcon, Zap, FileUp, ExternalLink, Settings2 } from 'lucide-react';
import { DashboardData, DataRow, ViewMode, HistoryEntry } from './types';
import Dashboard from './components/Dashboard';
import { analyzeDataWithGemini } from './services/geminiService';

const DEFAULT_API_SHEET_URL = "https://docs.google.com/spreadsheets/d/1yZWChvQpDyBaZWSwzScd1iHN8wtUexPqHlyQVD0BXTI/edit?usp=sharing";
const SYNC_WEBHOOK_URL = "https://nen.auto-jornada.space/webhook/sincronizar";

const Logo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-layers2-icon lucide-layers-2">
    <path d="M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74z"/>
    <path d="m20 14.285 1.5.845a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74l1.5-.845"/>
  </svg>
);

const FolderSyncIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-folder-sync">
    <path d="M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v.5"/>
    <path d="M12 10v4h4"/>
    <path d="m12 14 1.535-1.605a5 5 0 0 1 8 1.5"/>
    <path d="M22 22v-4h-4"/>
    <path d="m22 18-1.535 1.605a5 5 0 0 1-8-1.5"/>
  </svg>
);

const TabButton = ({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: React.ReactNode }) => (
  <button 
    onClick={onClick} 
    className={`flex items-center px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
      active 
        ? 'bg-indigo-600 text-white shadow-md' 
        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
    }`}
  >
    {icon} 
    <span className="hidden lg:inline ml-2">{label}</span>
  </button>
);

const App: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('central');
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    const saved = localStorage.getItem('utmdash_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [linkedFilters, setLinkedFilters] = useState<boolean>(() => {
    const saved = localStorage.getItem('utmdash_linked_filters');
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('utmdash_linked_filters', linkedFilters.toString());
  }, [linkedFilters]);

  useEffect(() => {
    localStorage.setItem('utmdash_history', JSON.stringify(history));
  }, [history]);

  const addToHistory = (newData: DashboardData, sourceName: string) => {
    const faturamentoHeader = newData.headers.find(h => h.toLowerCase().includes('valor') || h.toLowerCase().includes('faturamento') || h.toLowerCase().includes('amount')) || '';
    const statusHeader = newData.headers.find(h => h.toLowerCase() === 'status') || '';
    
    const validRows = newData.rows.filter(row => String(row[statusHeader] || '').toLowerCase() !== 'pending');
    const totalFat = validRows.reduce((acc, row) => acc + (Number(row[faturamentoHeader]) || 0), 0);
    
    const newEntry: HistoryEntry = {
      id: crypto.randomUUID(),
      name: sourceName,
      timestamp: Date.now(),
      data: newData,
      stats: {
        vendas: validRows.length,
        faturamento: totalFat
      }
    };
    setHistory(prev => [newEntry, ...prev].slice(0, 10)); // Mantém os últimos 10
  };

  const deleteFromHistory = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const loadFromHistory = (entry: HistoryEntry) => {
    setData(entry.data);
    setInsights(null);
    setViewMode('central');
  };

  const handleSyncWebhook = async () => {
    try {
      await fetch(SYNC_WEBHOOK_URL, { 
        method: 'POST',
        mode: 'no-cors'
      });
    } catch (e) {
      console.error("Webhook trigger error:", e);
    } finally {
      window.location.reload();
    }
  };

  const parseCSV = (csvText: string, layoutType: 'standard' | 'alternative' = 'standard') => {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return null;

    let headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    // Se for layout alternativo, garantimos que os headers tenham nomes que o Dashboard reconheça
    // ou simplesmente confiamos nos índices depois. No App.tsx apenas extraímos.
    
    const cleanAndParse = (val: string) => {
      if (val === undefined || val === null || val.trim() === '') return '';
      let cleaned = val.trim().replace(/^"|"$/g, '');
      if (cleaned.includes('R$') || cleaned.includes('%') || /^-?[\d\.]+,[\d]+$/.test(cleaned)) {
        cleaned = cleaned.replace('R$', '').replace('%', '').replace(/\s/g, '');
        if (cleaned.includes(',') && cleaned.includes('.')) {
          cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else if (cleaned.includes(',')) {
          cleaned = cleaned.replace(',', '.');
        }
      }
      const num = Number(cleaned);
      return !isNaN(num) && cleaned !== '' ? num : cleaned;
    };

    const rows = lines.slice(1).map(line => {
      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim());
      const row: DataRow = {};
      headers.forEach((header, index) => {
        row[header] = cleanAndParse(values[index] || '');
      });
      return row;
    });

    const types: Record<string, 'number' | 'string'> = {};
    headers.forEach(header => {
      const firstVal = rows.find(r => r[header] !== undefined && r[header] !== '' && typeof r[header] === 'number')?.[header];
      types[header] = typeof firstVal === 'number' ? 'number' : 'string';
    });

    return { headers, rows, types, layoutType };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed) {
        setData(parsed);
        addToHistory(parsed, file.name);
      }
      setLoading(false);
    };
    reader.readAsText(file);
  };

  const loadFromUrl = async (customUrl?: string, layoutType: 'standard' | 'alternative' = 'standard') => {
    const targetInput = customUrl || sheetUrl;
    if (!targetInput) return;
    
    setLoading(true);
    try {
      let csvUrl = targetInput;
      if (targetInput.includes('/edit')) {
        csvUrl = targetInput.replace(/\/edit.*$/, '/export?format=csv');
      } else if (!targetInput.includes('/export?format=csv')) {
        csvUrl = targetInput.endsWith('/') ? `${targetInput}export?format=csv` : `${targetInput}/export?format=csv`;
      }

      const response = await fetch(csvUrl);
      const csvText = await response.text();
      const parsed = parseCSV(csvText, layoutType);
      if (parsed) {
        setData(parsed);
        addToHistory(parsed, customUrl ? "Integração API" : `Planilha (${layoutType === 'alternative' ? 'Layout B' : 'Link'})`);
      }
    } catch (error) {
      alert("Erro ao carregar link. Certifique-se de que a planilha está 'Publicada na Web' como CSV.");
    } finally {
      setLoading(false);
    }
  };

  const generateAIInsights = async () => {
    if (!data) return;
    setAnalyzing(true);
    const result = await analyzeDataWithGemini(data);
    setInsights(result);
    setAnalyzing(false);
  };

  const handleLogoClick = () => {
    setViewMode('central');
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/20 blur-[120px] rounded-full" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center space-y-8 max-w-md w-full">
          <div className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] shadow-2xl mb-4">
            <div className="text-indigo-500">
              <Logo />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">UTMDASH</h1>
            <p className="text-slate-400 text-sm font-medium tracking-wide">Performance & Analytics Dashboard</p>
          </div>

          <button 
            onClick={() => {
              loadFromUrl(DEFAULT_API_SHEET_URL);
            }}
            disabled={loading}
            className="group relative w-full py-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[24px] font-black text-xl uppercase tracking-widest transition-all shadow-2xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-6 h-6 animate-spin mx-auto" />
            ) : (
              "Bora otimizar essa porra"
            )}
          </button>

          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Powered by Dominus AI</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="fixed top-0 left-0 right-0 z-50 px-4 py-3 sm:px-6">
        <header className="max-w-full mx-auto bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl rounded-[24px] h-16 flex items-center justify-between px-6 transition-all">
          <div 
            className="flex items-center space-x-3 cursor-pointer group transition-all shrink-0"
            onClick={handleLogoClick}
          >
            <div className="p-2 bg-[#4F46E5] rounded-xl shadow-indigo-200 shadow-lg text-white group-hover:scale-110 transition-transform">
              <Logo />
            </div>
            <h1 className="text-lg font-black text-slate-800 tracking-tighter uppercase hidden sm:block">UtmDash</h1>
          </div>

          {data && (
            <div className="flex bg-slate-100/50 p-1 rounded-2xl items-center mx-4 overflow-hidden">
              <TabButton active={viewMode === 'central'} onClick={() => setViewMode('central')} label="Análise Central" icon={<LayoutGrid className="w-4 h-4" />} />
              <TabButton active={viewMode === 'utmdash'} onClick={() => setViewMode('utmdash')} label="UTM DASH" icon={<Layers className="w-4 h-4" />} />
              <TabButton active={viewMode === 'graphs'} onClick={() => setViewMode('graphs')} label="Gráficos" icon={<BarChart3 className="w-4 h-4" />} />
              <TabButton active={viewMode === 'history'} onClick={() => setViewMode('history')} label="Histórico" icon={<HistoryIcon className="w-4 h-4" />} />
            </div>
          )}

          <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">
            <div className="hidden md:flex items-center space-x-2">
              <button 
                onClick={() => setLinkedFilters(!linkedFilters)}
                className={`relative w-12 h-6 rounded-full transition-all duration-300 flex items-center px-1 ${linkedFilters ? 'bg-emerald-500' : 'bg-rose-500'}`}
                title={linkedFilters ? 'Filtros Vinculados' : 'Filtros Desvinculados'}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center ${linkedFilters ? 'translate-x-6' : 'translate-x-0'}`}>
                  {linkedFilters ? <Link className="w-2.5 h-2.5 text-emerald-600" /> : <Link2Off className="w-2.5 h-2.5 text-rose-600" />}
                </div>
              </button>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={handleSyncWebhook}
                title="Sincronizar Dados"
                className="p-2.5 bg-[#4F46E5] text-white rounded-xl shadow-md shadow-indigo-100 hover:bg-[#4338CA] transition-all hover:scale-105"
              >
                <FolderSyncIcon />
              </button>

              {data && (
                <button
                  onClick={generateAIInsights}
                  disabled={analyzing}
                  className="inline-flex items-center p-2 sm:px-4 sm:py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-md shadow-indigo-100"
                >
                  <BrainCircuit className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">{analyzing ? 'Analisando...' : 'Insights'}</span>
                </button>
              )}
              
              <button onClick={() => { setData(null); setInsights(null); setViewMode('central'); }} className="p-2.5 text-slate-400 hover:text-indigo-600 transition-colors bg-slate-100 rounded-xl">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>
      </div>

      <main className="max-w-full mx-auto px-4 pt-24 pb-12 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {insights && (
            <div className="bg-indigo-950 rounded-[32px] p-8 text-white shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500 border border-white/10 mx-auto max-w-full">
              <h3 className="text-xl font-black mb-4 flex items-center text-indigo-400"><BrainCircuit className="w-6 h-6 mr-2" /> ESTRATÉGIA IA</h3>
              <div className="prose prose-invert max-w-none text-indigo-100 font-medium whitespace-pre-line">{insights}</div>
            </div>
          )}
          <Dashboard 
            data={data} 
            viewMode={viewMode} 
            setViewMode={setViewMode} 
            linkedFilters={linkedFilters}
            history={history}
            onLoadFromHistory={loadFromHistory}
            onDeleteFromHistory={deleteFromHistory}
          />
        </div>
      </main>
    </div>
  );
};

export default App;
