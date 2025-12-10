const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store active sessions: clientId -> { client, isReady }
const sessions = new Map();

io.on('connection', (socket) => {
  const clientId = socket.handshake.query.clientId;
  
  if (!clientId) {
    console.log('Connection rejected: No clientId');
    return socket.disconnect();
  }

  console.log(`Client connected: ${clientId} (Socket: ${socket.id})`);
  
  // Join a room specific to this clientId so we can emit events to it regardless of socket ID
  socket.join(clientId);

  let session = sessions.get(clientId);

  if (session) {
    console.log(`Restoring existing session for ${clientId}`);
    // If session exists, just check status and emit
    if (session.isReady) {
      socket.emit('ready');
      socket.emit('authenticated');
    } else {
      // If not ready but exists, it might be loading or waiting for QR
      // We can trigger a QR refresh if needed, but usually the client events will handle it
    }
  } else {
    console.log(`Creating NEW session for ${clientId}`);
    
    // 1. Initialize unique client for this USER (clientId)
    const client = new Client({
      authStrategy: new LocalAuth({ clientId: clientId }),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    session = { client, isReady: false };
    sessions.set(clientId, session);

    // 2. Setup Event Listeners (Emit to ROOM 'clientId')
    client.on('loading_screen', (percent, message) => {
      io.to(clientId).emit('loading_screen', { percent, message });
    });

    client.on('qr', (qr) => {
      console.log(`QR for ${clientId}`);
      qrcode.toDataURL(qr, (err, url) => {
        if (!err) io.to(clientId).emit('qr', url);
      });
    });

    client.on('ready', () => {
      console.log(`Client ${clientId} is ready!`);
      session.isReady = true;
      io.to(clientId).emit('ready');
    });

    client.on('authenticated', () => {
      io.to(clientId).emit('authenticated');
    });

    client.on('auth_failure', (msg) => {
      io.to(clientId).emit('auth_failure', msg);
    });

    client.on('disconnected', (reason) => {
      console.log(`Client ${clientId} disconnected:`, reason);
      session.isReady = false;
      io.to(clientId).emit('disconnected', reason);
    });

    // 3. Initialize Client
    client.initialize().catch(err => console.error('Init error:', err));
  }

  // 4. Handle Batch Sending via Socket
  socket.on('send_batch', async ({ numbers, message }) => {
    const currentSession = sessions.get(clientId);
    
    if (!currentSession || !currentSession.isReady) {
      return socket.emit('error', 'WhatsApp no está listo');
    }

    console.log(`Starting batch for ${clientId}, count: ${numbers.length}`);
    
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < numbers.length; i++) {
      // Stop if session died
      if (!sessions.has(clientId) || !currentSession.isReady) {
        break;
      }

      const number = numbers[i];
      const cleanNumber = number.replace(/\D/g, '');
      let formattedNumber = cleanNumber;
      if (cleanNumber.length === 9) {
        formattedNumber = `51${cleanNumber}`;
      }
      
      try {
        const registered = await currentSession.client.getNumberId(formattedNumber);
        
        if (!registered) {
          failCount++;
          io.to(clientId).emit('progress', { 
            current: i + 1, 
            total: numbers.length, 
            status: `Saltado ${formattedNumber}: No registrado`,
            success: false 
          });
          continue;
        }

        await currentSession.client.sendMessage(registered._serialized, message);
        
        successCount++;
        io.to(clientId).emit('progress', { 
          current: i + 1, 
          total: numbers.length, 
          status: `Enviado a ${formattedNumber}`,
          success: true 
        });
        
      } catch (error) {
        console.log(`Failed to send to ${formattedNumber}: ${error.message}`);
        failCount++;
        io.to(clientId).emit('progress', { 
          current: i + 1, 
          total: numbers.length, 
          status: `Fallo ${formattedNumber}: ${error.message}`,
          success: false 
        });
      }

      // Delay 3-5 seconds
      const delay = Math.floor(Math.random() * 2000) + 10000; 
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    io.to(clientId).emit('batch_complete', { successCount, failCount });
  });

  // 5. Handle Logout
  socket.on('logout', async () => {
    console.log(`Logout requested by ${clientId}`);
    const currentSession = sessions.get(clientId);
    if (!currentSession) return;

    currentSession.isReady = false;
    io.to(clientId).emit('disconnected', 'User initiated logout');
    
    try {
      await currentSession.client.logout();
    } catch (e) {
      console.log('Logout error (ignoring):', e.message);
    }
    
    try {
      await currentSession.client.destroy();
    } catch (e) {}
    
    // Clean up session map
    sessions.delete(clientId);
    
    // Note: We do NOT automatically re-init here. 
    // The user is logged out. If they want to log in again, they should refresh 
    // or we can implement a 'login' event. 
    // For now, let's just leave it dead so they can refresh to start over if needed,
    // OR we can re-create the session object immediately.
    // Let's re-create it to show QR code again immediately.
    
    // Re-trigger connection logic effectively by asking client to reload?
    // Or just re-run the init logic?
    // Simplest: The client receives 'disconnected', sets state to false.
    // If we want to show QR again, we need a new Client instance.
    
    // Let's just delete it. The user can refresh the page to get a new QR.
    // OR, better UX:
    socket.emit('force_refresh'); // We can implement this in client
  });

  // 6. Handle Disconnect (Tab closed)
  socket.on('disconnect', async () => {
    console.log(`Socket ${socket.id} disconnected (Client: ${clientId})`);
    // We do NOT destroy the client here. That's the whole point of persistence!
    // The client stays alive in 'sessions' map.
    // If the user comes back, they reconnect to the same session.
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
