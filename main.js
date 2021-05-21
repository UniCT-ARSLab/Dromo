var electron = require('electron');
var { app, BrowserWindow, ipcMain } = electron;
const fs = require("fs");
const settings = require('electron-settings');

//var bleat = require('bleat').classic;
//var noble = require('noble');
//noble.startScanning(); // any service UUID, no duplicates

let win

function loadSettings() {
  if (!settings.has('gamepads')) {
    settings.set('gamepads', []);
  }

}

function createWindow() {
  console.info("Application started")
  win = new BrowserWindow({
    width: 720,
    height: 590,
    'min-height': 590,
    'min-width': 590
  })

  win.loadFile('./ui/index.html')

  win.webContents.openDevTools()

  loadSettings();
  win.on('closed', () => {
    win = null
  })


}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (win === null) {
    createWindow()
  }
})

