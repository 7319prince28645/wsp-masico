# WhatsApp Sender Desktop App

Esta aplicación ha sido convertida para funcionar como una aplicación de escritorio de Windows usando Electron.

## Estructura
- **main.js**: Punto de entrada de Electron. Inicia el servidor backend y abre la ventana.
- **server/**: Backend (Node.js/Express). Ahora sirve también los archivos estáticos del frontend.
- **client/**: Frontend (React/Vite). Se compila a archivos estáticos en `client/dist`.

## Comandos

### Desarrollo
Para probar la aplicación en modo desarrollo (con recarga en caliente):
```bash
npm run electron:dev
```

### Crear Ejecutable (Carpeta)
Para crear una carpeta con el ejecutable (.exe) y todos los archivos necesarios:
```bash
npm run pack
```
El resultado estará en la carpeta `dist-packager`. Dentro encontrarás `Whatsapp Sender.exe`. Puedes comprimir esta carpeta y enviarla.

### Crear Instalador (Opcional)
Para crear un instalador (.exe único):
```bash
npm run dist
```
*Nota: Puede requerir permisos adicionales o configuración de firma de código.*

## Notas
- Las dependencias del servidor se han movido a la raíz para asegurar que se empaqueten correctamente.
- El servidor se inicia automáticamente cuando abres la aplicación.
