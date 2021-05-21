var noble = require('noble');
var gamepad = require("gamepad");
var CLI = require('clui');
var clc = require('cli-color');
var Spinner = CLI.Spinner;
var Line = CLI.Line;
var Gauge = CLI.Gauge;
var loading = new Spinner('', ['⣾','⣽','⣻','⢿','⡿','⣟','⣯','⣷']);

var headers = new Line()
  .padding(2)
  .column('Column One', 20, [clc.cyan])
  .column('Column Two', 20, [clc.cyan])
  .column('Column Three', 20, [clc.cyan])
  .column('Column Four', 20, [clc.cyan])
  .fill()
  .output();


var peripheralIdOrAddress =  process.argv[2] ? process.argv[2].toLowerCase() : "ce5023d3be43";

var drone = null;

var CHARACTERISTICS = {
    ERROR       : "00000002000e11e1ac360002a5d5c51b",
    RESPONSE    : "00000001000e11e1ac360002a5d5c51b",
    ACCEVENT    : "00000400000111e1ac360002a5d5c51b",
    LED2W       : "20000000000111e1ac360002a5d5c51b",
    SENSORS     : "00e00000000111e1ac360002a5d5c51b",
    COMMAND     : "00008000000111e1ac360002a5d5c51b"
}
var padValues = {
    yaw     : 0,
    roll    : 0,
    pitch   : 0,
    power   : 1
}

var char_controller = null;

var statusDrone = {
    armed :false,
    accelerometer : {x : 0, y : 0, z : 0},
    gyroscope : {x : 0, y : 0, z : 0},
    magnetometer : {x : 0, y : 0, z : 0},
    power : 0,
    yaw : 0,
    roll : 0,
    pitch : 0,
    connected : false

}


// Initialize the library
gamepad.init();

// List the state of all currently attached devices
for (var i = 0, l = gamepad.numDevices(); i < l; i++) {
  //  console.log(i, gamepad.deviceAtIndex());

}

setInterval(gamepad.processEvents, 16);


gamepad.on("move", function (id, axis, value) {
   /* console.log("move", {
      id: id,
      axis: axis,
      value: value,
    });*/

    switch(axis){

        case 1 :
        padValues.pitch = remapping(value,0.6627451181411743,-0.7411764860153198,0,255);
        break;
        case 2 :
        padValues.power = remapping(value,-0.6313725709915161,0.7333333492279053,0,128);
        break;
        case 4 :
        padValues.yaw = remapping(value,-0.6549019813537598,0.7333333492279053,0,255);
        break;
        case 0 :
        padValues.roll = remapping(value, -0.6313725709915161,0.7568627595901489,0,255);
        break;
    
    }   

    
  });
  

noble.on('stateChange', function(state) {
  if (state === 'poweredOn') {
    noble.startScanning();
  } else {
    drone = null;
    noble.stopScanning();
  }
});


noble.on('scanStart', () => {
    console.log("Scan start");

    setTimeout(() => {
        noble.stopScanning();
    } , 20000);

});

noble.on('scanStop', () => {
    console.info("Scan stopped");
    if(drone){

        drone.once('connect', () => {
            console.info("Drone connected");
            statusDrone.connected = true;
            explore(drone);

        });

        drone.once('disconnect', () => {
            console.info("Drone disconnected");
            drone = null;
            statusDrone.connected = false;
            noble.startScanning();
        });

        drone.once('servicesDiscover', (services) => {

        });

        if(drone.status=="connected"){
            drone.disconnect();
        }

        drone.connect();

    } else {
        console.info("Drone not found");
    }
});

noble.on('discover', function(peripheral) {
  if (peripheral.id === peripheralIdOrAddress || peripheral.address === peripheralIdOrAddress) {
    drone = peripheral;
    noble.stopScanning();
  }
});

function calibrateDrone(){
    var dataToSend = new Buffer([ 0, 0, 0, 0, 0 , 0, 2]);
    if(char_controller){
        char_controller.write(dataToSend, true, (error) => {
            if(error) console.error("ERROR", error);
            setTimeout(() => {
                var dataToSend = new Buffer([ 0, 0, 0, 0, 0 , 0, 0]);
                char_controller.write(dataToSend, true);
                console.info("===== DRONE CALIBRATED =====");
                armDrone();
            },5000)
        }); // data is a buffer, withoutResponse is true|false
    }
}


function disarmDrone(){
    statusDrone.armed = false;
    command(0,0,0,0,false);
}

function armDrone(){
    console.log("--- ARMING DRONE ---")
  //  if(padValues.power == 0){ 
        statusDrone.armed = true;
        command(0,0,0,0,true);
        console.info("######## DRONE ARMED #######")
   // } else {
   //     console.log("--- SET POWER TO 0 BEFORE! ---")
   // }


   setInterval(() => {
    if(statusDrone.connected  && statusDrone.armed){
        // console.log(Gauge(padValues.power, 100, 20, 18, "POWER"));
         command(padValues.yaw, padValues.roll, padValues.pitch, padValues.power, statusDrone.armed);
         console.log("[CONTROLLER]", padValues)
     }
   }, 100);
}

function command(yaw, roll, pitch, power, armed){


    var dataToSend = new Buffer([ 0, yaw, power, roll, pitch , 0, armed ? 4 : 0]);
    if(char_controller){
        char_controller.write(dataToSend, true, (error) => {
            if(error) console.error("ERROR", error);
        }); // data is a buffer, withoutResponse is true|false
    }
}

function explore(peripheral) {
 
    peripheral.discoverServices([], function(error, services) {

        var servicesList = [];
        var promises = [];

        console.log();
        console.log("======== SERVICES LOADING ========");

        services.forEach((service)=>{

            servicesList[service.uuid] = service;
            servicesList[service.uuid]["charaList"] = [];


            var auxPromise = new Promise( (resolve, reject) => {

                
                service.discoverCharacteristics([], function(error, characteristics) {
                    servicesList[service.uuid]["charaList"] = characteristics;
                    resolve();
                });

                service.discoverIncludedServices([], function(error, includedServiceUuids) {
                    servicesList[service.uuid]["included"] = includedServiceUuids;
                });


                setTimeout(resolve,5000);

            });

            promises.push(auxPromise);

        });

        Promise.all(promises).then((result) => {
        //    console.log();
         //   console.log("======== SERVICES ========");
            Object.keys(servicesList).forEach((uuidservice) => {
                var service = servicesList[uuidservice];
        //        console.info("[SERVICE]",service.uuid);
                service.charaList.forEach((characteristic) => {

                    switch(characteristic.uuid){

                        case CHARACTERISTICS.ERROR:
                        characteristic.name = "[ERROR]";
                        break;

                        case CHARACTERISTICS.RESPONSE:
                        characteristic.name = "[RESPONSE]";
                        break;

                        case CHARACTERISTICS.SENSORS :
                        characteristic.name = "[MOVE]";
                        break;

                        case CHARACTERISTICS.ACCEVENT :
                        characteristic.name = "[ACC. EVENT]";
                        break;

                        case CHARACTERISTICS.LED2W :
                        characteristic.name = "[LEDW2ST]";
                        break;


                        case CHARACTERISTICS.COMMAND :
                        characteristic.name = "[COMMAND]";
                        char_controller = characteristic;
                        break;

                        default :
                            characteristic.name = "[???]";
                        break;

                    }





                    
                    if(characteristic.properties.indexOf("notify") != -1 && 
                        (characteristic.uuid==CHARACTERISTICS.ERROR || characteristic.uuid==CHARACTERISTICS.RESPONSE  || characteristic.uuid==CHARACTERISTICS.COMMAND)
                    ){
                        characteristic.once('notify', (state) => {console.info("|_____",characteristic.uuid, state)});
                        characteristic.subscribe();
                    }

                    characteristic.on('data', (data, isNotification) => {


                        /*
                        DATA : [2byte TIMESTAMP], [18 byte PAYLOAD]
                        */

                       var timestamp = data.readUInt16LE(0) / 1000;
                       var payload = data.slice(2);


                       switch(characteristic.uuid){

                        case CHARACTERISTICS.ERROR:
                            console.error(characteristic.name, timestamp, payload.toString())
                        break;

                        case CHARACTERISTICS.RESPONSE:
                            console.error(characteristic.name, timestamp, payload.toString())
                        break;


                        case CHARACTERISTICS.SENSORS:

                            var datas = [];
                            for( var i = 0; i < payload.length; i = i+2){
                                datas.push(payload.readInt16LE(i))
                            }
                            console.info(characteristic.name,timestamp, datas);
                        break;

                        case CHARACTERISTICS.ACCEVENT:
                            console.info(characteristic.name,timestamp, payload)
                        break;

                        case CHARACTERISTICS.LED2W:
                            console.info(characteristic.name,timestamp, payload)
                        break;

                        case CHARACTERISTICS.COMMAND:
                            console.info(characteristic.name,timestamp, payload)
                        break;

                        default:
                        console.info("[NON GESTITO]", characteristic.uuid, timestamp, payload)
                        break;

                       }

                        
                    });


                   
                    
                });


            });
            console.log("====== SERVICES LOADED ======");

            calibrateDrone();
            
        });
        
    });
}

function remapping(value, min1, max1, min2, max2){

    value = min2 + (value - (min1)) * (max2 - min2) / (max1 - (min1))

    if(value < min2) value = min2;
    if(value > max2) value = max2;
    return  Math.ceil(value);

}

