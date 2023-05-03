# Ge0Seq-Editor
Editor for Ge0Seq Sequencer Module

This is the companion application for the Ge0Seq MIDI to CV and Sequencer Module used in the Ge0sync Synth TB-Seq and Destop semi-modular synthesisers.

This editor allows you to upload device settings, create and upload 1-16 step sequences and save/load sequences from the local filesystem.

All communication with the device is via MIDI SysEx messages - requires a USB to 5pin DIN MIDI interface - either your audio interface MIDI or via a USB connected MIDI controller / keyboard that has MIDI-OUT or MIDI-Thru on 5-pin DIN.

Packages are built for :

* Windows 7,10,11 x86_64
* Mac (Intel based - x86_64)
* Mac (Apple Mx based = arm64)

See the Users Guide in the docs folder for more information.

# Building the Editor

The application uses node.js and the electron toolkit. See the scripts folder for basic info.
Requires nvm, npm and a C compiler for the MIDI functions.

You need to copy the relevant package.json.xxx to package.json for your OS.

After installing nvm, node, and npm run :

* npm i   - to download and build all dependencies
* npm run start    - to validate the build and run the application
* npm run release  - to build setup / pkg install media
