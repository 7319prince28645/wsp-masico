const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the React client
app.use(express.static(path.join(__dirname, "../client/dist")));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Store active sessions: clientId -> { client, isReady }
const sessions = new Map();

// Función para generar saludo aleatorio basado en la hora
function getRandomGreeting() {
  const hour = new Date().getHours();

  const morningGreetings = [
    "Buenos días",
    "Buen día",
    "Feliz mañana",
    "Que tengas un excelente día",
    "Saludos cordiales",
  ];

  const afternoonGreetings = [
    "Buenas tardes",
    "Feliz tarde",
    "Que tengas una linda tarde",
    "Saludos",
    "Un cordial saludo",
  ];

  const eveningGreetings = [
    "Buenas noches",
    "Feliz noche",
    "Que tengas una linda noche",
    "Saludos cordiales",
    "Un cordial saludo",
  ];

  const generalPhrases = [
    "Gusto en saludarle",
    "Espero se encuentre bien",
    "Espero que esté muy bien",
    "Deseo que se encuentre excelente",
    "Espero que todo esté marchando bien",
    "Confío en que se encuentre de maravilla",
    "Espero que este mensaje le encuentre bien",
    "Deseo que tenga un excelente momento",
  ];

  let timeGreeting;
  if (hour >= 6 && hour < 12) {
    timeGreeting =
      morningGreetings[Math.floor(Math.random() * morningGreetings.length)];
  } else if (hour >= 12 && hour < 19) {
    timeGreeting =
      afternoonGreetings[Math.floor(Math.random() * afternoonGreetings.length)];
  } else {
    timeGreeting =
      eveningGreetings[Math.floor(Math.random() * eveningGreetings.length)];
  }

  // 70% de probabilidad de agregar frase adicional
  const addGeneralPhrase = Math.random() < 0.7;

  if (addGeneralPhrase) {
    const generalPhrase =
      generalPhrases[Math.floor(Math.random() * generalPhrases.length)];
    // Variar el formato
    const formats = [
      `${timeGreeting}! ${generalPhrase}.`,
      `${timeGreeting}, ${generalPhrase.toLowerCase()}.`,
      `${timeGreeting}. ${generalPhrase}.`,
      `${generalPhrase}. ${timeGreeting}.`,
    ];
    return formats[Math.floor(Math.random() * formats.length)];
  }

  return `${timeGreeting}!`;
}

io.on("connection", (socket) => {
  const clientId = socket.handshake.query.clientId;

  if (!clientId) {
    console.log("Connection rejected: No clientId");
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
      socket.emit("ready");
      socket.emit("authenticated");
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
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--disable-gpu",
        ],
      },
      // DESACTIVAR funciones que causan error markedUnread
      markOnlineOnConnect: false,
      // No marcar mensajes como vistos automáticamente
      qrMaxRetries: 5,
    });

    // PARCHEAR sendSeen cuando el cliente esté listo para evitar error markedUnread
    client.on("ready", async () => {
      try {
        // Sobrescribir sendSeen con una función vacía que no hace nada
        await client.pupPage.evaluate(() => {
          // Guardar la función original por si acaso
          window.WWebJS._originalSendSeen = window.WWebJS.sendSeen;
          // Reemplazar con función que no hace nada
          window.WWebJS.sendSeen = async function (chatId) {
            // No hacer nada - evita el error markedUnread
            return true;
          };
        });
        console.log("✅ sendSeen parcheado exitosamente");
      } catch (e) {
        console.log("⚠️ No se pudo parchear sendSeen:", e.message);
      }
    });

    session = { client, isReady: false };
    sessions.set(clientId, session);

    // 2. Setup Event Listeners (Emit to ROOM 'clientId')
    client.on("loading_screen", (percent, message) => {
      io.to(clientId).emit("loading_screen", { percent, message });
    });

    client.on("qr", (qr) => {
      console.log(`QR for ${clientId}`);
      qrcode.toDataURL(qr, (err, url) => {
        if (!err) io.to(clientId).emit("qr", url);
      });
    });

    client.on("ready", () => {
      console.log(`Client ${clientId} is ready!`);
      session.isReady = true;
      io.to(clientId).emit("ready");
    });

    client.on("authenticated", () => {
      io.to(clientId).emit("authenticated");
    });

    client.on("auth_failure", (msg) => {
      io.to(clientId).emit("auth_failure", msg);
    });

    client.on("disconnected", (reason) => {
      console.log(`Client ${clientId} disconnected:`, reason);
      session.isReady = false;
      io.to(clientId).emit("disconnected", reason);
    });

    // 3. Initialize Client
    client.initialize().catch((err) => console.error("Init error:", err));
  }

  // 4. Handle Batch Sending via Socket (ANTI-BAN VERSION)
  socket.on("send_batch", async ({ numbers, message, messageVariations }) => {
    const currentSession = sessions.get(clientId);

    if (!currentSession || !currentSession.isReady) {
      return socket.emit("error", "WhatsApp no está listo");
    }

    console.log(`Starting batch for ${clientId}, count: ${numbers.length}`);

    // LÍMITE DE SEGURIDAD: Máximo 100 mensajes por sesión
    const MAX_MESSAGES_PER_SESSION = 100;
    if (numbers.length > MAX_MESSAGES_PER_SESSION) {
      return socket.emit(
        "error",
        `⚠️ Por seguridad, el límite es ${MAX_MESSAGES_PER_SESSION} mensajes por sesión. Divide tu lista en lotes más pequeños.`
      );
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < numbers.length; i++) {
      // Stop if session died
      if (!sessions.has(clientId) || !currentSession.isReady) {
        break;
      }

      const number = numbers[i];
      const cleanNumber = number.replace(/\D/g, "");
      let formattedNumber = cleanNumber;
      if (cleanNumber.length === 9) {
        formattedNumber = `51${cleanNumber}`;
      }

      try {
        const registered = await currentSession.client.getNumberId(
          formattedNumber
        );

        if (!registered) {
          failCount++;
          io.to(clientId).emit("progress", {
            current: i + 1,
            total: numbers.length,
            status: `Saltado ${formattedNumber}: No registrado`,
            success: false,
          });

          // Pequeño delay incluso en fallos
          await new Promise((resolve) =>
            setTimeout(resolve, Math.random() * 2000 + 1000)
          );
          continue;
        }

        // SIMULAR ESCRITURA HUMANA: Enviar "escribiendo..."
        const typingDelay =
          Math.floor(message.length / 10) * 100 + Math.random() * 2000;
        io.to(clientId).emit("progress", {
          current: i + 1,
          total: numbers.length,
          status: `✍️ Escribiendo a ${formattedNumber}...`,
          success: null,
        });

        await new Promise((resolve) => setTimeout(resolve, typingDelay));

        // VARIACIÓN DE MENSAJE: Usar variaciones si están disponibles
        let finalMessage = message;
        if (messageVariations && messageVariations.length > 0) {
          finalMessage =
            messageVariations[
              Math.floor(Math.random() * messageVariations.length)
            ];
        }

        // AGREGAR SALUDO ALEATORIO basado en la hora
        const greeting = getRandomGreeting();
        finalMessage = `${greeting}\n\n${finalMessage}`;

        // ENVÍO SIMPLE - sendSeen ya está parcheado
        const chatId = registered._serialized;
        await currentSession.client.sendMessage(chatId, finalMessage);

        successCount++;
        io.to(clientId).emit("progress", {
          current: i + 1,
          total: numbers.length,
          status: `✅ Enviado a ${formattedNumber}`,
          success: true,
        });
      } catch (error) {
        console.log(`Failed to send to ${formattedNumber}: ${error.message}`);
        failCount++;
        io.to(clientId).emit("progress", {
          current: i + 1,
          total: numbers.length,
          status: `❌ Fallo ${formattedNumber}: ${error.message}`,
          success: false,
        });
      }

      // DELAYS VARIABLES Y NATURALES (15-45 segundos base)
      // Genera entre 5,000 y 10,000 milisegundos
      const baseDelay = Math.floor(Math.random() * 5000) + 5000;

      // PAUSA LARGA ALEATORIA cada 5-10 mensajes (simular humano tomando descanso)
      if (
        successCount > 0 &&
        successCount % (Math.floor(Math.random() * 5) + 5) === 0
      ) {
        const longPause = Math.floor(Math.random() * 60000) + 120000; // 2-3 minutos
        io.to(clientId).emit("progress", {
          current: i + 1,
          total: numbers.length,
          status: `☕ Pausa de seguridad (${Math.floor(longPause / 1000)}s)...`,
          success: null,
        });
        await new Promise((resolve) => setTimeout(resolve, longPause));
      } else {
        // Delay normal
        io.to(clientId).emit("progress", {
          current: i + 1,
          total: numbers.length,
          status: `⏳ Esperando ${Math.floor(baseDelay / 1000)}s...`,
          success: null,
        });
        await new Promise((resolve) => setTimeout(resolve, baseDelay));
      }
    }

    io.to(clientId).emit("batch_complete", { successCount, failCount });
  });

  // 5. Handle Logout
  socket.on("logout", async () => {
    console.log(`Logout requested by ${clientId}`);
    const currentSession = sessions.get(clientId);
    if (!currentSession) return;

    currentSession.isReady = false;
    io.to(clientId).emit("disconnected", "User initiated logout");

    try {
      await currentSession.client.logout();
    } catch (e) {
      console.log("Logout error (ignoring):", e.message);
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
    socket.emit("force_refresh"); // We can implement this in client
  });

  // 6. Handle Disconnect (Tab closed)
  socket.on("disconnect", async () => {
    console.log(`Socket ${socket.id} disconnected (Client: ${clientId})`);
    // We do NOT destroy the client here. That's the whole point of persistence!
    // The client stays alive in 'sessions' map.
    // If the user comes back, they reconnect to the same session.
  });
});

// Handle React routing, return all requests to React app
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

const PORT = 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
