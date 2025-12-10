# WhatsApp Bulk Sender

Una interfaz profesional para enviar mensajes masivos de WhatsApp.

## Requisitos
- Node.js instalado.
- Google Chrome instalado (para que whatsapp-web.js funcione correctamente).

## Instrucciones de Uso

### 1. Iniciar el Servidor (Backend)
Abre una terminal en la carpeta `whatsapp-sender` y ejecuta:
```bash
cd server
npm install  # Solo la primera vez
node index.js
```
El servidor correrá en el puerto 3001.

### 2. Iniciar la Interfaz (Frontend)
Abre otra terminal en la carpeta `whatsapp-sender` y ejecuta:
```bash
cd client
npm install  # Solo la primera vez
npm run dev
```
La aplicación se abrirá en `http://localhost:5173`.

### 3. Enviar Mensajes
1. Escanea el código QR con tu WhatsApp (Dispositivos vinculados).
2. Espera a que se sincronice (puede tardar unos segundos).
3. Ingresa los números de teléfono (uno por línea) y el mensaje.
4. Haz clic en "Send Broadcast".

## Notas Importantes
- **Anti-Ban**: El sistema incluye un retraso aleatorio de 2-5 segundos entre mensajes para reducir el riesgo de bloqueo.
- **Formato de Números**: El sistema intenta detectar números de Perú (9 dígitos) y agrega el prefijo 51 automáticamente. Para otros países, ingresa el número completo con código de país (ej: 521234567890).
- **Mantén la ventana abierta**: No cierres la terminal del servidor mientras se envían los mensajes.
