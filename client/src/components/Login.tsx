import { motion } from 'framer-motion';
import { QrCode, Smartphone } from 'lucide-react';

interface LoginProps {
  qrCode: string | null;
  loadingPercent: number | null;
  loadingMessage: string | null;
}

export default function Login({ qrCode, loadingPercent, loadingMessage }: LoginProps) {
  return (
    <div className="w-full flex flex-col items-center justify-center p-8 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">WhatsApp Envios</h1>
          <p className="text-gray-500">
            {loadingPercent !== null 
              ? "Syncing your data..." 
              : "Scan the QR code to connect your WhatsApp account"}
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 inline-block mb-8">
          {loadingPercent !== null ? (
            <div className="w-64 h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <div className="flex flex-col items-center text-gray-500 w-full px-8">
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                  <div 
                    className="bg-primary h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${loadingPercent}%` }}
                  ></div>
                </div>
                <p className="font-semibold text-lg mb-1">{loadingPercent}%</p>
                <p className="text-sm text-gray-400">{loadingMessage || 'Loading chats...'}</p>
              </div>
            </div>
          ) : qrCode ? (
            <img src={qrCode} alt="QR Code" className="w-64 h-64 object-contain" />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <div className="flex flex-col items-center text-gray-400">
                <div className="animate-spin mb-4">
                  <QrCode size={48} />
                </div>
                <p>Esperando el codigo QR...</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <Smartphone size={20} />
            <span>Abre whatsapp en su celular</span>
          </div>
          <span>→</span>
          <span>Menu/Settings</span>
          <span>→</span>
          <span>Dispositivos vinculados</span>
        </div>
      </motion.div>
      <p className="mt-8 text-sm text-gray-400">Hecho por Prince Moreno</p>

    </div>
  );
}
