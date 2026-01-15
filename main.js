const { app, BrowserWindow } = require('electron');
const path = require('path');

// Import the server to start it
// This assumes server/index.js starts listening immediately when required
// If it exports a function to start, we should call it.
// Based on previous view, it starts listening at the end of the file.
require('./server/index.js');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'assets/icon.png') // Optional: Add an icon later
  });

  // Load the app
  // Since the server is running on port 3000 and serving the client
  win.loadURL('http://localhost:3000');

  // Open DevTools in development
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
