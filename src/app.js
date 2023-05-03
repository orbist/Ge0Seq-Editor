/*
 * Ge0synchronous Sequence Editor
 *
 * Main application processing for Ge0Seq UI
 * Allows 16 step sequences to be built, and sent to compatible devices
 * Allows device settings to be sent to compatible devices
 *
 */

const VERSION = "v1.5.0.0"
const VER_MAJ = 1;
const VER_MIN = 5;
const VER_FIX = 0;
const VER_BLD = 0;

const numbSteps = 16;

const STEP_DATA = 1;
const SEND_PPQN = 2;
const SEND_OUT_PPQN = 3;
const SEND_GATE_OFF_US = 4;
const SEND_SEQ = 5;
const ACTIVATE_SEQ = 6;
const SEND_SLIDET = 7;
const SEND_NOTEP = 8;
const SEND_MIDICH = 9;
const SEND_MOD_CC = 10;
const SEND_TRIG_DURATION = 11;
const SEND_CLOCK_DURATION = 12;
const SEND_MOD_DURATION = 14;
const TEST_COMMS = 15;

const LAST_STEP_NOTE = 127;

var stopped = 0;
var last_stop = 0;
const hideSteps = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
const showSteps = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
const stepLengthSave = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];


let $ = require('jquery');
var ipcRenderer = require('electron').ipcRenderer;
const remote = require('@electron/remote');
const { dialog } = remote;
const loadJsonFile = require('load-json-file');
const jetpack = require('fs-jetpack');


var currentSeq = null;
var currentFilename = null;
var devSettings = getDefaultDevSettings();


$(function(){

	createUI();

	currentSeq = getDefaultSeq();
	updateUIFromSeq();

	ipcRenderer.on('midi_port_options', function (event,message) {
			setMIDIPortOptions(message);
	});
	ipcRenderer.send('request_midi_port_options','');


	// Subscribe to events
    $("button#send").click( {type: SEND_SEQ}, sendMIDI );
    $("button#activate").click( {type: ACTIVATE_SEQ}, sendMIDI );
    $("button#devset").click( {type: SEND_MIDICH}, sendMIDI );
	$("button#testComms").click( {type: TEST_COMMS}, sendMIDI );

	$("button#loadSequence").on("click", loadSeqFromFile);
	$("button#saveSequence").on("click", saveSeqToFile);
	
    
    $(document).on("change", "#device-settings input", function(e) {
        limitInputFieldsToRange();
    });

	$(document).on("change", "#step-container select.type", function(e) {
		adaptStepSettings($(e.target).parent(), false);
		//console.log($(e.target).parent());
		limitInputFieldsToRange()
		
		$.each($("#step-container>div"), function(key, value) {
			if( ( parseInt(key) >= stopped && stopped > 0 ) || 
				( parseInt(key) >= last_stop && last_stop > 0 ) ) {
				var thisStepSeq = currentSeq.steps[parseInt(key)];
				updateStepFromSeq($(value), thisStepSeq);
			}
			
		});

		if( last_stop != 0 ) {
			last_stop = 0;
			stopped = 0;
		}

	});

	$(document).on("change", "#step-container select.length", function(e) {
		adaptStepSettings($(e.target).parent(), false);
		//console.log($(e.target).parent());
		limitInputFieldsToRange()
		
		$.each($("#step-container>div"), function(key, value) {
			if( hideSteps[ parseInt(key) ] == 1 ) {
				var thisStepSeq = currentSeq.steps[parseInt(key)];
				updateStepFromSeq($(value), thisStepSeq);
			}
            //hideSteps[ parseInt(key)] = 0;
			
		});

		$.each($("#step-container>div"), function(key, value) {
			if( showSteps[ parseInt(key) ] == 1 ) {
				var thisStepSeq = currentSeq.steps[parseInt(key)];
				updateStepFromSeq($(value), thisStepSeq);
			}
			showSteps[parseInt(key)] = 0 ;
			
		});

	});



	$(document).on("change", "#step-container select.octave", function(e) {
		adaptStepSettings($(e.target).parent(), false);
		limitInputFieldsToRange()
	});

	$(document).on("change", "#step-container tr:nth-of-type(1) input", function(e) {
		adaptStepSettings($(e.target).parent().parent().parent().parent().parent(), false);
		limitInputFieldsToRange()
	});

	

});
    
    


/* ***********
 * SAVE & LOAD
**************/


function loadSeqFromFile() {
	  var seqFilePath = dialog.showOpenDialogSync({
			title: "Open Sequence",
			defaultPath: "./",
			buttonLabel: "Load Sequence"
		});
		if (seqFilePath) {
			try {
				var data = loadJsonFile.sync(seqFilePath[0]);
				currentSeq = data;
				currentFilename = seqFilePath[0];
				updateUIFromSeq();
				showFileOperationStatus("Loaded Preset File");
			}
			catch(err) {
				showFileOperationStatus("Could not load " + seqFilePath[0], {error: true});
				console.log(err);
				currentSeq = null;
				currentFilename = null;
			}
		}
}

function saveSeqToFile() {
	  var seqFilePath = dialog.showSaveDialogSync({
			title: "Save Sequence",
			defaultPath: "./",
			buttonLabel: "Save Sequence"
		});
		if (seqFilePath) {
			updateSeqFromUI();
			try {
				jetpack.write(seqFilePath, JSON.stringify(currentSeq, undefined, 4));
				showFileOperationStatus("Saved Sequence to File");
			}
			catch(err) {
				showFileOperationStatus("Could not save");
			}
		}
}

/*******
 * MIDI
 *******/

function setMIDIPortOptions(portOptions) {
	var portSelect = $("#portselect select");
	portSelect.html("");
	for (var i=0; i<portOptions.length; i++){
		var el = $("<option></<option>");
		el.text(portOptions[i]);
		el.val(i);
		portSelect.append(el);
	}
}


function sendMIDI( event ) {

	updateSeqFromUI();
    var messages = [];
    var display_task = "";
    var display_done = "";
    var type = event.data.type;
    
    if( type == ACTIVATE_SEQ ) {
        // activate seq on device
        messages.push([ACTIVATE_SEQ, currentSeq.seqID]);
        display_task = "Activating...";
        display_done = "Activated";
    } else if( type == SEND_MIDICH ) {
        // set device params,
		messages.push( [ SEND_NOTEP, devSettings.priority ] );
        messages.push( [ SEND_MOD_CC, devSettings.mod_cc ] );
		messages.push( [ SEND_PPQN, devSettings.ppqn ] );
        messages.push( [ SEND_OUT_PPQN, devSettings.ppqn_out ] );
        messages.push( [ SEND_GATE_OFF_US, devSettings.gate_delay ] );
        messages.push( [ SEND_MOD_DURATION, devSettings.mod_duration ] );
        messages.push( [ SEND_TRIG_DURATION, devSettings.trig_duration ] );
        messages.push( [ SEND_CLOCK_DURATION, devSettings.clock_duration ] );
        // midi channel last as it reboots device
        messages.push([SEND_MIDICH, devSettings.channel ]);
        
        display_task = "Sending device settings...";
        display_done = "Device settings sent";
    } else if( type == SEND_SEQ ) {
        // send the sequence data
        messages = generateSysExFromPreset();
        display_task = "Sending sequence...";
        display_done = "Sequence sent";
    } else if( type == TEST_COMMS ) {
		// send the version number as a test
		messages.push([ TEST_COMMS, VER_MAJ, VER_MIN, VER_FIX ]);
		display_task = "Sending test SysEx messages...";
		display_done = "Test message sent";
	}
	
	var sysExStream = messagePayloadToSysEx( messages );

	console.log(JSON.stringify(sysExStream, undefined, 4));
	showSendStatus( display_task, type, {persistent: true});

	setTimeout(function() {
		// send port number and midi data to main process
		ipcRenderer.send('send_midi_data', {
				port: $("#portselect select")[0].value,
				data: sysExStream
		});
		ipcRenderer.once('send_midi_data', function(event, message) {
			if (message.result) {
				showSendStatus( display_done, type );
			} else {
				showSendStatus("Error: " + message.message, type, true);
			}
		});
	}, 500);
}

 function messagePayloadToSysEx(messages) {
	 var sysExStream = [];
	 $.each(messages, function(mkey, mvalue) {
		 var thisMessage = [];
		 // SysEx Start
		 thisMessage.push(240);
		 // Manufacturer ID
		 thisMessage.push(99);
		 // Payload
		 $.each(mvalue, function(bkey, bvalue) {
			 bvalue = parseInt(bvalue);
			 if (bvalue <= 127) {
				 thisMessage.push(bvalue);
			 } else {
				 console.log("Value out of range");
			 }
		 });
		 // SysEx Stop
		 thisMessage.push(247);
		 sysExStream.push(thisMessage);
	 });
	 return sysExStream;
 }


/* *************
 * PRESET -> UI
****************/

function updateUIFromSeq() {

	$("label#version").each(function() {
		var text = $(this).text();
		text = text.replace("version", VERSION);
		$(this).text(text);
	});

	if (currentSeq) {

		$.each($("#step-container>div"), function(key, value) {
			var thisStepSeq = currentSeq.steps[parseInt(key)];
			updateStepFromSeq($(value), thisStepSeq);
		});

		$("#device-settings tr:first-of-type   input")[0].value  = devSettings.channel;
        $("#device-settings tr:nth-of-type(2) select")[0].value = devSettings.priority;
        $("#device-settings tr:nth-of-type(3)  input")[0].value = devSettings.mod_cc;
		$("#device-settings tr:nth-of-type(4) select")[0].value = devSettings.ppqn;
        $("#device-settings tr:nth-of-type(5) select")[0].value = devSettings.ppqn_out;
        $("#device-settings tr:nth-of-type(6)  input")[0].value = devSettings.gate_delay;
        $("#device-settings tr:nth-of-type(7)  input")[0].value = devSettings.mod_duration;
        $("#device-settings tr:nth-of-type(8)  input")[0].value = devSettings.trig_duration;
        $("#device-settings tr:nth-of-type(9)  input")[0].value = devSettings.clock_duration;
 
		$("#seq-settings tr:first-of-type select")[0].value = currentSeq.slideType;
		$("#seq-slot     tr:first-of-type select")[0].value = currentSeq.seqID;
	}
}

function updateStepFromSeq(UIElement, settings) {
	
	var fieldNote = UIElement.find("select.type")[0];
	var fieldOct = UIElement.find("select.octave")[0];
	var fieldLength = UIElement.find("select.length")[0];
	var fieldRest = UIElement.find("tr:nth-of-type(1) input")[0];
	var fieldAccent = UIElement.find("tr:nth-of-type(2) input")[0];
	var fieldSlide = UIElement.find("tr:nth-of-type(3) input")[0];

	fieldNote.value = settings.valNote;
	fieldOct.value = settings.valOct;
	fieldLength.value = settings.valLength;
	fieldRest.value = settings.valRest;
	fieldAccent.value = settings.valAccent;
	fieldSlide.value = settings.valSlide;

	adaptStepSettings(UIElement, false);

}


/* *************
 * UI -> PRESET
****************/

function updateSeqFromUI() {
	currentSeq = {steps: []};

	$.each($("#step-container>div"), function(key, value) {
		currentSeq.steps.push(updateSeqFromStep($(value)));
	});
    
    devSettings.channel        = $("#device-settings tr:first-of-type   input")[0].value;
    devSettings.priority       = $("#device-settings tr:nth-of-type(2) select")[0].value;
    devSettings.mod_cc         = $("#device-settings tr:nth-of-type(3)  input")[0].value;
	devSettings.ppqn           = $("#device-settings tr:nth-of-type(4) select")[0].value;
    devSettings.ppqn_out       = $("#device-settings tr:nth-of-type(5) select")[0].value;
    devSettings.gate_delay     = $("#device-settings tr:nth-of-type(6)  input")[0].value;
    devSettings.mod_duration   = $("#device-settings tr:nth-of-type(7)  input")[0].value;
    devSettings.trig_duration  = $("#device-settings tr:nth-of-type(8)  input")[0].value;
    devSettings.clock_duration = $("#device-settings tr:nth-of-type(9)  input")[0].value;
    
    currentSeq.slideType = $("#seq-settings tr:first-of-type select")[0].value;
    currentSeq.seqID     = $("#seq-slot     tr:first-of-type select")[0].value;
}


function updateSeqFromStep(UIElement) {
	var fieldNote = UIElement.find("select.type")[0];
	var fieldOct = UIElement.find("select.octave")[0];
	var fieldLength = UIElement.find("select.length")[0];
	var fieldRest = UIElement.find("tr:nth-of-type(1) input")[0];
	var fieldAccent = UIElement.find("tr:nth-of-type(2) input")[0];
	var fieldSlide = UIElement.find("tr:nth-of-type(3) input")[0];

	return {
		valNote: fieldNote.value,
		valOct: fieldOct.value,
		valLength: fieldLength.value,
		valRest: fieldRest.value,
		valAccent: fieldAccent.value,
		valSlide: fieldSlide.value
	};
}

/* ***************
 * PRESET -> SYSEX
******************/

function generateSysExFromPreset() {
	var messages = [];
	var command = STEP_DATA;

	$.each(currentSeq.steps, function(key, value) {
		var id = key;
		var note = value.valNote;
		var octave = value.valOct;
		var length = value.valLength;
		var rest = value.valRest;
		var accent = value.valAccent;
		var slide = value.valSlide;
		var actualNote = 0;

		//console.log('Extracted : id %s - %s %s %s %s %s', id, note, octave, rest, accent, slide );

		var stepMessage = [command,id];

		// note LAST_STEP_NOTE says end sequence here
		if( note != LAST_STEP_NOTE ) {
			actualNote = parseInt(note) + (parseInt(octave) * 12);
		} else {
			actualNote = LAST_STEP_NOTE;
		}
		//console.log('Actual note : %d', actualNote);
		stepMessage.push(parseInt(actualNote));
		stepMessage.push(parseInt(length));
		stepMessage.push(parseInt(rest));
		stepMessage.push(parseInt(accent));
		stepMessage.push(parseInt(slide));
		
		messages.push(stepMessage);
		
	});

	messages.push([SEND_SLIDET, currentSeq.slideType]);
	messages.push([SEND_SEQ, currentSeq.seqID]);

	//$.each(messages, function(key,value) {
	//	$.each(value, function (mkey, mvalue) {
	//		console.log('step:',key,' - field',mkey,' - value ', mvalue );
	//	})
	//});

	return messages;
}

/***********************
 * MODIFY USER INTERFACE
 ***********************/

function createUI() {
	var stepContainer = $("#step-container");
	var singleStep = stepContainer.find("div:first-of-type");
	for (var i=1; i<numbSteps; i++) {
		var thisStep = singleStep.clone();
		thisStep.find("header").text((i+1).toString());
		stepContainer.append(thisStep);
	}
}
/*
 * Adapt the form fields for a single knob depending on
 * the type that is set for this knob
 * Knob is passed as jquery reference to dom
*/
function adaptStepSettings(step, resetFieldValues) {

	// Get form fields for this step
	var index = parseInt( step.find("header")[0].innerText );
	var newNote = step.find("select.type")[0].value;

	var selectNote = step.find("select.type");
	var selectOctave = step.find("select.octave");
	var selectLength = step.find("select.length");
	var lengthValue = parseInt( step.find("select.length")[0].value );
	var fieldRest = step.find("tr:nth-of-type(1)");
	var fieldAccent = step.find("tr:nth-of-type(2)");
	var fieldSlide = step.find("tr:nth-of-type(3)");

	if( lengthValue != stepLengthSave[ index - 1 ] ) {
		// the note length has changed and was previously > 1 step
		// clear the hide/show settings, to show those that were
		// hidden by old length
		if( stepLengthSave[ index - 1 ] == 24 ) {
			hideSteps[ index + 2 ] = 0;
			showSteps[ index + 2 ] = 1;
			hideSteps[ index + 1 ] = 0;
			showSteps[ index + 1 ] = 1;
		} 
		if( stepLengthSave[ index - 1 ] >= 12 ) {
			hideSteps[ index ] = 0;
			showSteps[ index ] = 1;
		}
	}

	// this step is more than just one, so set the hide bits
	if( lengthValue > 6 ) {
		if( index <= numbSteps ) {
			// this step spans more than one
			hideSteps[ index ] = 1;
            
			if( lengthValue == 24 ) {
				if( index + 1 <= numbSteps ) {
					hideSteps[ index + 1 ] = 1;
				}
				if( index + 2 <= numbSteps ) {
					hideSteps[ index + 2 ] = 1;
				}
			}
		}
		stepLengthSave[ index - 1 ] = lengthValue;
	} else {
		stepLengthSave[ index - 1 ] = 0;
	}
    
    // reset any hidden steps that are now hidden by this one
    
    if( lengthValue == 24 ) {
        // we have to check the next three steps
        if( stepLengthSave[ index ] == 24 ) {
            // clear the 4th step if it exists.
            if( index + 3 <= numbSteps ) {
                showSteps[ index + 3 ] = 1;
                hideSteps[ index + 3 ] = 0;
            }
        }
        stepLengthSave[ index ] = 0;
            
        if( stepLengthSave[ index + 1 ] == 24 ) {
            // clear the 5th step if it exists.
            if( index + 4 <= numbSteps ) {
                showSteps[ index + 3 ] = 1;
                hideSteps[ index + 3 ] = 0;
                showSteps[ index + 4 ] = 1;
                hideSteps[ index + 4 ] = 0;
            }
        }
        stepLengthSave[ index + 1 ] = 0;
        
        if( stepLengthSave[ index + 2 ] >= 12 ) {
            // clear the 7th step if it exists.
            if( index + 5 <= numbSteps ) {
                showSteps[ index + 3 ] = 1;
                hideSteps[ index + 3 ] = 0;
                showSteps[ index + 4 ] = 1;
                hideSteps[ index + 4 ] = 0;
                showSteps[ index + 5 ] = 1;
                hideSteps[ index + 5 ] = 0;
            }
        }
        stepLengthSave[ index + 2 ] = 0;
    }
    
    
	
	// handle sequences less than 16 steps

	if( stopped != 0 && index > stopped ) {
	
		// If we have already set a stop note, and this
		// step is after that, hide the fields.
	
		selectNote.hide();
		selectOctave.hide();
		selectLength.hide();
		fieldRest.hide();
		fieldAccent.hide();
		fieldSlide.hide();

	} else {

		// Otherwise we are showing this step, but first
		// check if we have just changed it to stop, so
		// hide the fields, but leave the note

		if( newNote == 127 ) {
			selectOctave.hide();
			selectLength.hide();
			fieldRest.hide();
			fieldAccent.hide();
			fieldSlide.hide();
			// save away our stop value
			stopped = parseInt(index);
		
		} else {

			// not stopped 

			if( hideSteps[index-1] != 0) {
				//we need to hide this step
				selectNote.hide();
				selectOctave.hide();
				selectLength.hide();
				fieldRest.hide();
				fieldAccent.hide();
				fieldSlide.hide();
			} else {

				// not stopped, nor hidden via step length
		
				if( index == stopped ) {
					// this note used to be stop, so revert
					stopped = 0;
					last_stop = index;
				}
				selectNote.show();
				selectOctave.show();
				selectLength.show();
		
				fieldRest.show().find('label').text("Rest");
				fieldRest.find('input').attr("min", 0);
				fieldRest.find('input').attr("max", 1);
				if (resetFieldValues) fieldRest.find('input').val(0);
	
				fieldAccent.show().find('label').text("Accent");
				fieldAccent.find('input').attr("min", 0);
				fieldAccent.find('input').attr("max", 1);
				if (resetFieldValues) fieldAccent.find('input').val(0);
	
				fieldSlide.show().find('label').text("Slide");
				fieldSlide.find('input').attr("min", 0);
				fieldSlide.find('input').attr("max", 1);
				if (resetFieldValues) fieldSlide.find('input').val(0);
			} 
		}
	}
	//console.log("Hide Steps :");
	//console.log(hideSteps);
	//console.log("Show Steps :");
	//console.log(showSteps);
	//console.log("stepLengthSave : ");
	//console.log(stepLengthSave);
}


/********
 * HELPER
 ********/

function clearSteps( index, count ) {
    
    if( count == 12 ) {
        if( index + 1 < numbSteps ) {
            showSteps[ index +1 ] = 1;
        }
    }
    
}

function getDefaultSeq() {
	var thisSeq = {
		seqID: 1,
		slideType: 6,
		steps: []
	};

	for (var i=0; i<numbSteps; i++) {
		thisSeq.steps.push({
			valNote: 24,
			valOct: 2,
			valLength: 6,
			valRest: 0,
			valAccent: 0,
			valSlide: 0
		});
	}
	return thisSeq;
}

function getDefaultDevSettings() {
    var thisDevSet = {
        channel: 0,
        priority: 0,
		ppqn: 24,
        ppqn_out: 4,
        gate_delay: 5,
        mod_cc: 1,
        mod_duration: 0,
        clock_duration: 2,
        trig_duration: 2
    };
    return thisDevSet;
}


function limitInputFieldsToRange() {
	$.each($("input"), function(key, element) {
		var element = $(element);
		var value = parseInt($(element).val());
		var min = $(element).prop('min');
		var max = $(element).prop('max');

		if (max && value > max) $(element).val(max);
		if (min && value < min) $(element).val(min);
	});
}

function showSendStatus(status, task,  options) {
    var element;
    
    if( task == SEND_SEQ ) {
        element = $("#wr_result .result");
    } else if( task == ACTIVATE_SEQ ) {
        element = $("#av_result .result");
    } else if( task == SEND_MIDICH ) {
        element = $("#midi_result .result");
    } else if( task == TEST_COMMS ) {
		element = $("#test_result .result");
	}
	updateResult(element, status, options||{});
}


function showFileOperationStatus(status, options) {
	var element = $("#loadsafe .result");
	updateResult(element, status, options||{});
}

function updateResult(element, status, options) {
	element.text(status);
	element.fadeIn(100, 'linear');
	if (options.error) {
		element.addClass("error");
		if (!options.persistent) element.fadeOut(5000, 'swing');
	} else {
		element.removeClass("error");
		if (!options.persistent) element.fadeOut(3000, 'swing');
	}
}



