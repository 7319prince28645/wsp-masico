import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

// Generate a persistent ID for this browser/tab
const getClientId = () => {
  let id = localStorage.getItem('whatsapp-client-id');
  if (!id) {
    id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('whatsapp-client-id', id);
  }
  return id;
};

const clientId = getClientId();
const socket = io(`http://${window.location.hostname}:3000`, {
  query: { clientId }
});

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const [loadingPercent, setLoadingPercent] = useState<number | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('qr', (qr) => {
      console.log('QR Code received');
      setQrCode(qr);
      setIsAuthenticated(false);
      setLoadingPercent(null); // Reset loading on new QR
    });

    socket.on('loading_screen', ({ percent, message }) => {
      setLoadingPercent(percent);
      setLoadingMessage(message);
      setQrCode(null); // Hide QR when loading starts
    });

    socket.on('authenticated', () => {
      console.log('Authenticated');
      setIsAuthenticated(true);
      setQrCode(null);
      setLoadingPercent(null);
    });

    socket.on('ready', () => {
      console.log('Ready');
      setIsReady(true);
      setIsAuthenticated(true); // Ensure we show dashboard if ready
    });

    socket.on('disconnected', () => {
      setIsAuthenticated(false);
      setIsReady(false);
      setQrCode(null);
    });

    return () => {
      socket.off('connect');
      socket.off('qr');
      socket.off('authenticated');
      socket.off('ready');
      socket.off('disconnected');
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden min-h-[600px] flex">
        {!isAuthenticated ? (
          <Login qrCode={qrCode} loadingPercent={loadingPercent} loadingMessage={loadingMessage} />
        ) : (
          <Dashboard socket={socket} isReady={isReady} />
        )}
      </div>
    </div>
  );
}

export default App;
