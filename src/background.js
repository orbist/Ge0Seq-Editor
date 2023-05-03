'use strict';

var electron = require('electron');
const remoteMain = require('@electron/remote/main');
remoteMain.initialize();


var app = electron.app;
var BrowserWindow = electron.BrowserWindow;
var midi = require('midi');
var ipcMain = electron.ipcMain;

var mainWindow = null;
var midiOut = new midi.Output();


function sendMIDIPortOptions() {
  var midiPortList = [];
  for (var i= 0; i<midiOut.getPortCount(); i++){
    midiPortList.push(midiOut.getPortName(i));
  }
  if(midiOut.getPortCount() == 0) {
    midiPortList.push("empty");
  } 
	mainWindow.webContents.send('midi_port_options', midiPortList);
}

function sendMIDIData(data) {
  try {
    midiOut.openPort(parseInt(data.port));
    data.data.forEach(function(item, index) {
      midiOut.sendMessage(item);
    });
    midiOut.closePort();
    return true;
  }
  catch(err) {
    return false;
  }
}

app.on('ready', function() {
    mainWindow = new BrowserWindow({
        height: 1100,
        width: 1420,
        icon: __dirname + '/icon.png',
        webPreferences: {
          nodeIntegration: true,
          nodeIntegrationInWorker: true,
          nodeIntegrationInSubFrames: true,
          enableRemoteModule: true,
          contextIsolation: false
        }
    });
    
    remoteMain.enable(mainWindow.webContents);

    mainWindow.loadURL('file://' + __dirname + '/app.html');
   // mainWindow.openDevTools();

    ipcMain.on('send_midi_data', function (event,message) {
        if (sendMIDIData(message)) {
          event.sender.send('send_midi_data',{result: true});
        } else {
          event.sender.send('send_midi_data',{result: false, message: "Could not send"});
        }
    });
    ipcMain.on('request_midi_port_options', function (event,message) {
        sendMIDIPortOptions();
    });

});
