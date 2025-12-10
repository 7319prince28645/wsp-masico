import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Users, AlertCircle, CheckCircle, Loader2, LogOut } from 'lucide-react';
import { Socket } from 'socket.io-client';

interface DashboardProps {
  socket: Socket;
  isReady: boolean;
}

interface Progress {
  current: number;
  total: number;
  status: string;
  success: boolean;
}

export default function Dashboard({ socket, isReady }: DashboardProps) {
  const [numbers, setNumbers] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  const [successList, setSuccessList] = useState<string[]>([]);
  const [failedList, setFailedList] = useState<{number: string, reason: string}[]>([]);
  const [activeTab, setActiveTab] = useState<'logs' | 'success' | 'failed'>('logs');
    console.log(logs)
  useEffect(() => {
    socket.on('progress', (data: Progress) => {
      setProgress(data);
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${data.status}`, ...prev]);
        console.log(data)
      // Parse number from status string (to avoid server restart)
      const match = data.status.match(/(?:Sent to|Skipped|Failed to) (\d+)(?:: (.+))?/);
      if (match) {
        const number = match[1];
        const reason = match[2] || (data.success ? 'Enviado' : 'Error desconocido');
        
        if (data.success) {
          setSuccessList(prev => [...prev, number]);
        } else {
          setFailedList(prev => [...prev, { number, reason }]);
        }
      }
    });

    
    socket.on('batch_complete', ({ successCount, failCount }) => {
      setSending(false);
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] Batch complete. Success: ${successCount}, Failed: ${failCount}`, ...prev]);
      alert(`Proceso completado!\nExitosos: ${successCount}\nFallidos: ${failCount}`);
    });

    return () => {
      socket.off('progress');
      socket.off('batch_complete');
    };
  }, [socket]);

  const handleSend = async () => {
    if (!numbers.trim() || !message.trim()) return;

    const numberList = numbers.split(/[\n,]+/).map(n => n.trim()).filter(n => n.length > 0);
    
    if (numberList.length === 0) {
      alert('Por favor ingrese números válidos');
      return;
    }

    setSending(true);
    setLogs([]);
    setSuccessList([]);
    setFailedList([]);
    setProgress(null);
    setActiveTab('logs');

    // Use socket to send batch instead of REST API
    socket.emit('send_batch', {
      numbers: numberList,
      message
    });
  };

  const handleLogout = () => {
    if (confirm('¿Estás seguro de que quieres salir?')) {
      socket.emit('logout');
    }
  };

  const copyFailed = () => {
    const text = failedList.map(f => f.number).join('\n');
    navigator.clipboard.writeText(text);
    alert('Números fallidos copiados al portapapeles');
  };

  if (!isReady) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-semibold text-gray-700">Inicializando cliente...</h2>
        <p className="text-gray-500">Por favor, espera mientras sincronizamos la conexión</p>
      </div>
    );
  }

  return (
    <div className="w-full flex h-full relative">
      <p className="mt-8 text-sm text-gray-400 absolute bottom-2 right-2">By Prince Moreno</p>
      {/* Left Panel - Input */}
      <div className="w-1/2 p-8 border-r border-gray-100 flex flex-col">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
          <Send className="text-primary" /> Enviar mensaje
        </h2>

        <div className="space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Números de telefono (uno por linea)
            </label>
            <textarea
              value={numbers}
              onChange={(e) => setNumbers(e.target.value)}
              placeholder="999999999&#10;988888888"
              className="w-full h-48 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none font-mono text-sm"
              disabled={sending}
            />
            <p className="text-xs text-gray-500 mt-1">
              {numbers.split(/[\n,]+/).filter(n => n.trim().length > 0).length} números detectados
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mensaje
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hello! We invite you to the graduation ceremony..."
              className="w-full h-48 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              disabled={sending}
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleSend}
            disabled={sending || !numbers.trim() || !message.trim()}
            className={`w-full py-3 px-6 rounded-lg text-white font-semibold flex items-center justify-center gap-2 transition-all
              ${sending 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-primary hover:bg-green-600 shadow-lg hover:shadow-xl'
              }`}
          >
            {sending ? (
              <>
                <Loader2 className="animate-spin" size={20} /> Enviando...
              </>
            ) : (
              <>
                <Send size={20} /> Enviar Broadcast
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Panel - Status */}
      <div className="w-1/2 p-8 bg-gray-50 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="text-secondary" /> Dashboard de estado
          </h2>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut size={16} /> Salir
          </button>
        </div>

        {progress && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-600">Progreso</span>
              <span className="text-sm font-bold text-primary">
                {Math.round((progress.current / progress.total) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
              <div 
                className="bg-primary h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              ></div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              {progress.success ? (
                <CheckCircle size={16} className="text-green-500" />
              ) : (
                <AlertCircle size={16} className="text-red-500" />
              )}
              <span className="truncate">{progress.status}</span>
            </div>
          </motion.div>
        )}

        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
          <div className="flex border-b border-gray-100">
            <button 
              onClick={() => setActiveTab('logs')}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === 'logs' ? 'bg-gray-50 text-primary border-b-2 border-primary' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Actividad
            </button>
            <button 
              onClick={() => setActiveTab('success')}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === 'success' ? 'bg-gray-50 text-green-600 border-b-2 border-green-600' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Enviados ({successList.length})
            </button>
            <button 
              onClick={() => setActiveTab('failed')}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === 'failed' ? 'bg-gray-50 text-red-600 border-b-2 border-red-600' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Fallidos ({failedList.length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
            {activeTab === 'logs' && (
              logs.length === 0 ? (
                <p className="text-gray-400 text-center mt-10">No actividad registrada</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="text-gray-600 border-b border-gray-50 pb-1 last:border-0">
                    {log}
                  </div>
                ))
              )
            )}

            {activeTab === 'success' && (
              successList.length === 0 ? (
                <p className="text-gray-400 text-center mt-10">No hay envíos exitosos aún</p>
              ) : (
                successList.map((num, i) => (
                  <div key={i} className="flex items-center gap-2 text-green-700 border-b border-gray-50 pb-1 last:border-0">
                    <CheckCircle size={12} /> {num}
                  </div>
                ))
              )
            )}

            {activeTab === 'failed' && (
              <>
                {failedList.length > 0 && (
                  <div className="mb-4 flex justify-end">
                    <button onClick={copyFailed} className="text-xs bg-red-50 text-red-600 px-3 py-1 rounded hover:bg-red-100 transition-colors">
                      Copiar Lista
                    </button>
                  </div>
                )}
                {failedList.length === 0 ? (
                  <p className="text-gray-400 text-center mt-10">No hay envíos fallidos</p>
                ) : (
                  failedList.map((item, i) => (
                    <div key={i} className="flex flex-col text-red-700 border-b border-gray-50 pb-1 last:border-0">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertCircle size={12} /> {item.number}
                      </div>
                      <div className="pl-5 text-gray-500 opacity-75">{item.reason}</div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
