$.fn.extend({
    animateCss: function (animationName, callback) {
        var animationEnd = (function (el) {
            var animations = {
                animation: 'animationend',
                OAnimation: 'oAnimationEnd',
                MozAnimation: 'mozAnimationEnd',
                WebkitAnimation: 'webkitAnimationEnd',
            };

            for (var t in animations) {
                if (el.style[t] !== undefined) {
                    return animations[t];
                }
            }
        })(document.createElement('div'));

        this.addClass('animated ' + animationName).one(animationEnd, function () {
            $(this).removeClass('animated ' + animationName);

            if (typeof callback === 'function') callback();
        });

        return this;
    },
});

$(function () {
    $('[data-toggle="tooltip"]').tooltip()
})

var { ipcRenderer, remote } = require('electron');


class Drone3D {
    constructor(container) {

        var canvas = document.createElement('canvas');
        canvas.setAttribute("style", "border: 1px solid red;");
        var context = canvas.getContext('webgl2');
        this.container = container;
        this.container.show();
        this.SCREEN_WIDTH = 300;
        this.SCREEN_HEIGHT = 200;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 10000);
        this.render = new THREE.WebGLRenderer({ canvas: canvas, context: context });

        // camera
        this.camera.position.z = 55;

        //scene

        // lights
        var ambient = new THREE.AmbientLight(0xffffff);
        this.scene.add(ambient);

        // more lights
        var directionalLight = new THREE.DirectionalLight(0xffffff);
        directionalLight.position.set(0, -70, 100).normalize();
        this.scene.add(directionalLight);

        // renderer
        this.render.setSize(this.SCREEN_WIDTH, this.SCREEN_HEIGHT);
        this.render.domElement.style.position = "relative";
        this.container.append(this.render.domElement);


        var geometry = new THREE.BoxGeometry(1, 1, 1);
        var material = new THREE.MeshNormalMaterial();
        this.cube = new THREE.Mesh(geometry, material);
        this.scene.add(this.cube);

        this.camera.position.z = 5;
        this.render.render(this.scene, this.camera);


        $("#container-calibration-test").show();
        window.addEventListener('resize', () => {
            var originalRatio = this.SCREEN_WIDTH / this.SCREEN_HEIGHT;
            var wscale = this.container.width() / this.SCREEN_WIDTH;
            var hscale = this.container.height() / this.SCREEN_HEIGHT;
            var newRatio = Math.min(hscale, wscale);
            var newsize = this.getSizeToFit(this.SCREEN_WIDTH, this.SCREEN_HEIGHT, this.container.width(), this.container.height());
            newRatio = newsize.computedWidth / newsize.computedHeight;
            this.camera.aspect = newRatio;
            this.camera.updateProjectionMatrix();
            this.render.setSize(newsize.computedWidth, newsize.computedHeight);
            return;
        }, false);

        this.interval = setInterval(() => { this.update() }, 17);

    }

    update() {
        // this.cube.rotation.x += 0.01;
        // this.cube.rotation.y += 0.01;
        //this.rotate(.01, .01, 0);
        this.render.render(this.scene, this.camera);
    }

    toRadians(angle) {
        return angle * (Math.PI / 180);
    }

    toDegrees(angle) {
        return angle * (180 / Math.PI);
    }

    rotate(x, y, z) {


        var deltaRotationQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
            this.toRadians(x * 1),
            this.toRadians(y * 1),
            this.toRadians(z * 1),
            'XYZ'
        ));

        this.cube.quaternion.multiplyQuaternions(deltaRotationQuaternion, this.cube.quaternion);

        // this.cube.rotation.x += x;
        // this.cube.rotation.y += y;
        //  this.cube.rotation.z += z;
        //console.log(this.cube.rotation)

        var deltaRotationQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
            this.toRadians(x * 1),
            this.toRadians(y * 1),
            this.toRadians(z * 1),
            'XYZ'
        ));

        this.cube.rotation.x = Math.min(Math.max(this.cube.rotation.x, -Math.PI / 4), Math.PI / 4)
        this.cube.rotation.z = Math.min(Math.max(this.cube.rotation.z, -Math.PI / 4), Math.PI / 4)

    }

    clear() {
        clearInterval(this.interval);
        this.cube = null;
        this.scene = null;
        this.camera = null;
        this.render = null;
        this.container.empty();

    }

    getSizeToFit(currentWidth, currentHeight, desiredWidth, desiredHeight, showInConsole = false) {

        // get the aspect ratios in case we need to expand or shrink to fit
        var imageAspectRatio = currentWidth / currentHeight;
        var targetAspectRatio = desiredWidth / desiredHeight;

        // no need to adjust the size if current size is square
        var adjustedWidth = desiredWidth;
        var adjustedHeight = desiredHeight;

        // get the larger aspect ratio of the two
        // if aspect ratio is 1 then no adjustment needed
        if (imageAspectRatio > targetAspectRatio) {
            adjustedHeight = desiredWidth / imageAspectRatio;
        }
        else if (imageAspectRatio < targetAspectRatio) {
            adjustedWidth = desiredHeight * imageAspectRatio;
        }

        // set the adjusted size (same if square)
        var newSizes = {};
        newSizes.computedWidth = adjustedWidth;
        newSizes.computedHeight = adjustedHeight;

        if (showInConsole) {
            var info = "Image size: " + currentWidth + "x" + currentHeight;
            info += ", Desired size: " + desiredWidth + "x" + desiredHeight;
            info += ", Computed size: " + adjustedWidth + "x" + adjustedHeight;
            info += ", Image aspect ratio: " + imageAspectRatio;
            info += ", Desired size aspect ratio: " + targetAspectRatio;
            console.log(info);
        }

        return newSizes;
    }
}

class Controller {
    constructor(app) {
        this.application = app;
        this.process = remote.require("gamepad");
        this.process.init();
        this.gamepad = null;
        this.id = null;
        this.vendor = null;
        this.product = null;
        this.name = null;
        this.axis = null;
        this.calibrating = false;
        this.stepCalibration = 1;
        this.calibration3DModel = null;
        this.axisValues = { pitch: 0, roll: 0, yaw: 0, gas: 0 };
        this.deadZone = 0.025;
        this.minValue = 0;
        this.maxValue = 255;
        this.axisCalibrationSelect = 0;
        this.eventAttached = false;
        this.commands = {
            pitch: {
                name: "pitch",
                id: null,
                min: -1,
                max: 1,
                inverted: false,
                error: 0,
                sensitivity: 1,
                scaleFunction: () => { }
            },
            yaw: {
                name: "yaw",
                id: null,
                min: -1,
                max: 1,
                inverted: false,
                error: 0,
                sensitivity: 1,
                scaleFunction: () => { }
            },
            roll: {
                name: "roll",
                id: null,
                min: -1,
                max: 1,
                inverted: false,
                error: 0,
                sensitivity: 1,
                scaleFunction: () => { }
            },
            gas: {
                name: "gas",
                id: null,
                min: -1,
                max: 1,
                inverted: false,
                error: 0,
                sensitivity: 1,
                scaleFunction: () => { }
            }
        }

        this.powerGauge = null;

        //private

        this.intervals = {};
    }

    getGamePads() {
        var pads = [];

        this.process.shutdown()
        this.process.init();
        for (var i = 0, l = this.process.numDevices(); i < l; i++) {
            pads[i] = this.process.deviceAtIndex(i);
        }
        return pads;
    }

    scanForGamePads() {
        var interval = setInterval(this.process.detectDevices, 500);
        var $this = this;
        swal({
            html: '<i class="fas fa-cog fa-spin"></i> Looking for Gamepads',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            timer: 5000
        }).then(() => {

            clearInterval(interval);
            var pads = this.getGamePads();
            var content = '<div class="container"> <div class="row">';
            if (pads.length > 0) {

                for (var i = 0, l = pads.length; i < l; i++) {
                    content += '<div class="col">\
                <button type="button" data-orderid="'+ i + '" class="btn btn-outline-primary btn-block btn-select-joystick">\
                <i class="fas fa-gamepad fa-3x"></i><br>'+ pads[i].description + "\
                </button>\
                </div>";
                }
            }
            else {
                content += '<div class="col"><i class="fab fa-usb fa-4x"></i><br> Plug-in your gamepad then refresh to search again</div>';
            }

            content += '</div><div class="mt-3"><button type="button" class="btn btn-secondary btn-joystick-refresh">Refresh</button></div></div>';


            swal({
                titleText: "Select the USB Joystick / Gamepad",
                html: content,
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false
            })

            $(".btn-joystick-refresh").one("click", () => {
                $this.scanForGamePads();
            });

            $(".btn-select-joystick").one("click", (e) => {
                var selectedPad = pads[Number.parseInt($(e.currentTarget).data("orderid"))];
                $this.setGamePad(selectedPad);
                $this.application.setGamePad();
                $this.attachEvents();
            })

        });
    }

    setGamePad(gp) {
        this.gamepad = gp;
        this.id = gp.deviceID;
        this.vendor = gp.vendorID;
        this.product = gp.productID;
        this.name = gp.description;
        this.axis = gp.axisStates.length;
        this.axisCalibrationSelect = 1;
        console.info("Gamepad selected", this.name, "ID : "+this.id, this.vendor, this.product)

    }

    attachEvents() {
        var $this = this;

        if(this.eventAttached) return;
        this.eventAttached = true;
        $this.intervals["backgroundProcess"] = setInterval(this.process.processEvents, 16);
        $this.process.on("move", function (id, axis, value) {
            if (id == $this.id) {

                if ($this.commands[axis]) {
                    var auxVal = value.toFixed(2) * $this.commands[axis].sensitivity * ($this.commands[axis].inverted ? -1 : 1);
                    auxVal = (Math.abs(auxVal) <= $this.deadZone) ? 0 : auxVal;

                    if ($this.commands[axis].name != 'gas') {
                        $this.axisValues[$this.commands[axis].name] = $this.remapping(auxVal, $this.commands[axis].min, $this.commands[axis].max, $this.minValue, $this.maxValue);
                    } else {
                        $this.axisValues[$this.commands[axis].name] = $this.remapping(auxVal, $this.commands[axis].min * $this.commands[axis].sensitivity, $this.commands[axis].max, $this.minValue, $this.maxValue);
                    }

                    if ($this.powerGauge) {
                        $this.powerGauge.refresh($this.axisValues['gas']);
                    }

                    if ($this.calibrating) {
                        $(".calibrating-value-test[data-test='" + $this.commands[axis].name + "']").html($this.commands[axis].name + " : " + $this.axisValues[$this.commands[axis].name]);
                    }

                }

                if (axis == Number.parseInt($this.axisCalibrationSelect))
                    $("#value-axis-calibrate").val((Math.abs(value) <= $this.deadZone) ? 0 : value);
            }
        });
        console.info("Controller events are ready")

    }

    calibrate() {
        var $this = this;
        $this.calibrating = true;
        $this.stepCalibration = 1;

        $(".calibration-step").hide();
        $("#select-axis").empty();

        for (var i = 0; i < $this.axis; i++) {
            $("#select-axis").append("<option value='" + (i) + "'>" + (i) + "</option>")
        }

        $("#select-axis").off("change");
        $("#select-axis").on("change", (e) => {
            var value = $(e.currentTarget).val();
            $this.axisCalibrationSelect = value;
        })

        $(".calibration-step:first").show();
        $("#container-calibration").show();

        $(".btn-next-calibration").on("click", (e) => {


            $(".calibration-step[data-step='" + $this.stepCalibration + "']").hide();

            if ($this.stepCalibration < 8) {
                var whatget = $(".calibration-step[data-step='" + $this.stepCalibration + "']").data("get");
                var value = $("#value-axis-calibrate").val();
                var axis = Number.parseInt($("#select-axis").val());
                $this.commands[whatget.substring(0, whatget.indexOf("-"))].id = axis;
                $this.commands[whatget.substring(0, whatget.indexOf("-"))][whatget.substring(whatget.indexOf("-") + 1, whatget.length)] = Number.parseFloat(value);

                console.log(whatget, whatget.substring(whatget.indexOf("-") + 1, whatget.length), Number.parseFloat(value), "axis", axis)
                $this.stepCalibration++;
                $(".calibration-step[data-step='" + $this.stepCalibration + "']").show();
            } else {

                var newArray = [];
                Object.keys($this.commands).forEach((key) => {
                    newArray[$this.commands[key].id] = $this.commands[key];
                })

                $this.commands = newArray;
                $("#container-calibration").hide();
                $this.testCalibration();
            }


        });
    }

    testCalibration() {

        var $this = this;
        $this.calibration3DModel = new Drone3D($("#container-calibration-test .dronemodel"));
        console.log($this.commands)

        $("#container-calibration-test .invert-axis-value").off("change");
        $("#container-calibration-test .invert-axis-value").on("change", (e) => {
            var $element = $(e.currentTarget);
            var what = $element.data("what");
            var value = $element.is(":checked");

            $this.commands.forEach((command, index) => {
                if (command.name == what) {
                    $this.commands[index].inverted = value;
                    console.log("Axis inverted", what, value)
                }
            })

        });

        $("#container-calibration-test .sensitivity-value").off("change");
        $("#container-calibration-test .sensitivity-value").on("change", (e) => {
            var $element = $(e.currentTarget);
            var what = $element.data("what");
            var value = $element.val();

            $this.commands.forEach((command, index) => {
                if (command.name == what) {
                    $this.commands[index].sensitivity = value;
                    console.log("Sensitivity changed", what, value)
                }
            })

        });

        $("#save-gamepad-settings-btn").off("click");
        $("#save-gamepad-settings-btn").on("click", (e) => {

            $this.finishCalibration();

        });

        $this.intervals["testDrone3Dloop"] = setInterval(() => {
            $this.calibration3DModel.rotate($this.axisValues['pitch'] / 255, $this.axisValues['yaw'] / 255, $this.axisValues['roll'] / 255);
        }, 17)

    }

    finishCalibration() {

        var $this = this;
        $this.calibration3DModel.clear();
        $this.calibrating = false;
        $this.stepCalibration = 1;
        clearInterval($this.intervals["testDrone3Dloop"]);
        $this.application.saveControllerInfo();
    }

    loadGamepad(gp) {

        var newArray = [];
        gp.commands.forEach((obj) => {
            newArray[obj.id] = obj
        })
        this.commands = newArray;
        this.name = gp.name;
        this.product = gp.product;
        this.vendor = gp.vendor;
    }

    remapping(value, min1, max1, min2, max2) {

        value = min2 + (value - (min1)) * (max2 - min2) / (max1 - (min1))

        if (value < min2) value = min2;
        if (value > max2) value = max2;
        return Math.ceil(value);

    }
}

class Bluetooth {

    constructor(app) {
        var $this = this;
        this.application = app;
        this.devicesDisscovered = [];
        this.deviceConnected = null;
        this.onDiscovery = null;

        this.intervalSendCommands = null;

        this.droneCharacteristics = {};

        this.SERVICES = {
            FEEDACK: "00000000000e11e19ab40002a5d5c51b",
            INTERACT: "00000000000111e19ab40002a5d5c51b",
            BATTERY: "180f"
        }

        this.CHARACTERISTICS = {
            ERROR: "00000002000e11e1ac360002a5d5c51b",
            RESPONSE: "00000001000e11e1ac360002a5d5c51b",
            ACCEVENT: "00000400000111e1ac360002a5d5c51b",
            LED2W: "20000000000111e1ac360002a5d5c51b",
            SENSORS: "00e00000000111e1ac360002a5d5c51b",
            COMMAND: "00008000000111e1ac360002a5d5c51b",
            BATTERY: "2a19"
        }

        if (!this.application.isWindows)
            this.module = remote.require("noble");
        else
            this.module = remote.require("noble-winrt");

        this.attachEvents();

    }

    attachEvents() {

        var $this = this;
        this.module.on('stateChange', (state) => {
            console.info("Bluetooth state:", state)
            $this.state = state;
        });

        this.module.on('scanStart', () => {
            // console.log("Scan start");
        });

        this.module.on('discover', function (peripheral) {

            if (peripheral.state == "connected") {
                peripheral.disconnect();
            }



            console.log('peripheral with ID ' + peripheral.id + ' found');
            var advertisement = peripheral.advertisement;
            var localName = advertisement.localName;
            var txPowerLevel = advertisement.txPowerLevel;
            var manufacturerData = advertisement.manufacturerData;
            var serviceData = advertisement.serviceData;
            var serviceUuids = advertisement.serviceUuids;
            console.log(peripheral)


            if (peripheral.connectable) {
                $this.devicesDisscovered[peripheral.id] = peripheral;
                var content = '<div class="col-sm-12 col-md-6">\
                <button type="button" data-deviceid="'+ peripheral.id + '" class="btn btn-outline-primary btn-block btn-select-device">\
                <i class="fab fa-bluetooth-b fa-2x"></i><br>'+ (localName ? localName : peripheral.id) + ' - RSSI: ' + peripheral.rssi + '<br>\
                <small>('+ peripheral.address + ')</small>\
                </button>\
                </div>';
            }

            $("#list-bluetooth-devices").append(content);

            $(".btn-select-device").off("click");
            $(".btn-select-device").on("click", (e) => {
                var $btn = $(e.currentTarget);
                var id = $btn.data("deviceid");
                $this.connectToDevice($this.devicesDisscovered[id]);

            })

        });

    }

    endScan() {
        var $this = this;
        console.log("Scan stop")
        $("#lookingformsg").empty();
        $("#list-bluetooth-devices").parent().append('<div class="mt-3"><button type="button" class="btn btn-secondary btn-devices-refresh">Refresh</button></div>');
        $(".btn-devices-refresh").on("click", () => {
            $this.scanDevices();
        })
    }

    scanDevices(callback = () => { }) {
        var $this = this;
        $this.devicesDisscovered = [];

        if ($this.module.state == 'poweredOn') {
            $this.module.startScanning();
            console.log("Scan start");
            setTimeout(() => {
                $this.module.stopScanning();
                $this.endScan();
            }, 10000);

        } else {
            $this.module.stopScanning();
            setTimeout(() => {
                $this.scanDevices(callback);
            }, 2000)
        }

        swal({
            html: '<div id="lookingformsg"><i class="fas fa-cog fa-spin"></i> Looking for Devices</div> <div class="row" id="list-bluetooth-devices"><div class="container"></div></div>',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false
        })

    }

    connectToDevice(device, callbackConnect, callbackDisconnect) {

        var $this = this;

        swal({
            html: '<i class="fas fa-cog fa-spin"></i> Connecting to Device (' + device.address + ')',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: true,
            confirmButtonText: "Abort"
        }).then(() => {
            $this.scanDevices();

            device.disconnect();
            return;
        })


        if (device.state == "connected") {
            device.disconnect();
        }

        device.once('connect', () => {
            $this.deviceConnected = device;
            console.info("Device connected", $this.deviceConnected.address)

            swal({
                html: '<i class="fas fa-cog fa-spin"></i> Device connected, checking the Drone (' + device.address + ')',
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: true,
                confirmButtonText: "Abort"
            }).then(() => {
                device.disconnect();
                $this.scanDevices();
                return;
            })

            $this.checkDrone();
            if (callbackConnect) callbackConnect();
        });

        device.once('disconnect', () => {
            $this.deviceConnected = null;
            console.warn("DRONE DISCONNECTED")
            swal({
                html: 'Device disconnected!',
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: true,
                type: "error"
            }).then(() => {
                $this.scanDevices();
            })
            if (callbackDisconnect) callbackDisconnect();
        });

        console.log(device.id, device.state)

        device.connect();

    }

    droneNotCompatible() {
        var $this = this;
        $this.deviceConnected.disconnect();
        swal({
            html: 'The connected device is not a compatible Drone',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: true,
            type: "error"
        }).then(() => {
            $this.scanDevices();
        })

    }

    checkDrone() {

        var $this = this;

        $this.deviceConnected.discoverServices([$this.SERVICES.INTERACT], function (error, services) {

            if (services.length == 0) {
                $this.droneNotCompatible();
                return;
            }

            services.forEach((service) => {
                service.discoverCharacteristics([$this.CHARACTERISTICS.COMMAND], function (error, characteristics) {

                    if (characteristics.length == 0) {
                        $this.droneNotCompatible();
                        return;
                    }
                    characteristics.forEach((characteristic) => {

                        switch (characteristic.uuid) {

                            case $this.CHARACTERISTICS.COMMAND:
                                characteristic.name = "[COMMAND]";

                                $this.connectDrone();

                                break;

                        }

                    })

                });
            });
            if (services.length == 0) {
                setTimeout(() => { $this.checkDrone() }, 1000);
            }
        });

    }

    connectDrone() {

        var $this = this;
        var promises = [];

        swal({
            html: '<i class="fas fa-cog fa-spin"></i> Configuring the Drone',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false
        })

        setInterval(() => {
            $this.deviceConnected.updateRssi((error, rssi) => {
                if (!error) {
                    $("#rssi-container .value").html(rssi);
                }
            });
        }, 2000);

        $this.deviceConnected.discoverServices([$this.SERVICES.INTERACT], function (error, services) {

            services.forEach((service) => {

                var auxPromise = new Promise((resolve, reject) => {

                    service.discoverCharacteristics([$this.CHARACTERISTICS.COMMAND], function (error, characteristics) {

                        if (characteristics.length == 0) {
                            $this.droneNotCompatible();
                            return;
                        }
                        characteristics.forEach((characteristic) => {

                            switch (characteristic.uuid) {

                                case $this.CHARACTERISTICS.ERROR:
                                    characteristic.name = "ERROR";
                                    break;

                                case $this.CHARACTERISTICS.RESPONSE:
                                    characteristic.name = "RESPONSE";
                                    break;

                                case $this.CHARACTERISTICS.SENSORS:
                                    characteristic.name = "SENSORS";
                                    break;

                                case $this.CHARACTERISTICS.ACCEVENT:
                                    characteristic.name = "ACC. EVENT";
                                    break;

                                case $this.CHARACTERISTICS.LED2W:
                                    characteristic.name = "LEDW2ST";
                                    break;

                                case $this.CHARACTERISTICS.COMMAND:
                                    characteristic.name = "COMMAND";
                                    break;

                            }

                            if (characteristic.name) {

                                if (characteristic.properties.indexOf("notify") != -1 &&
                                    (
                                        characteristic.uuid == $this.CHARACTERISTICS.ERROR ||
                                        characteristic.uuid == $this.CHARACTERISTICS.RESPONSE ||
                                        characteristic.uuid == $this.CHARACTERISTICS.COMMAND
                                    )
                                ) {
                                    characteristic.on('notify', (state) => {
                                        console.info("notify", characteristic.name, state)
                                    });
                                    characteristic.subscribe();
                                }

                                characteristic.on('data', (data, isNotification) => {
                                    console.log("data", characteristic.name, data)
                                });

                                $this.droneCharacteristics[characteristic.uuid] = characteristic;

                            }
                            resolve();

                        })

                    });

                });

                promises.push(auxPromise);

            });


            Promise.all(promises).then(() => {
                swal({
                    html: 'The Drone is Ready',
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    showConfirmButton: true,
                    type: "success"
                }).then(() => {
                    $this.application.flyView();
                })
            });
        });


    }

    discoverServices(peripheral, callback = () => { }) {
        peripheral.discoverServices([], callback);
    }

    discoverCharacteristics(service, callback = () => { }) {
        service.discoverCharacteristics([], callback);
    }

    calibrateDrone(callback) {
        var $this = this;
        var dataToSend = new Buffer([0, 0, 0, 0, 0, 0, 2]);
        $this.droneCharacteristics[$this.CHARACTERISTICS.COMMAND].write(dataToSend, true, (error) => {
            if (error) console.error("ERROR", error);
            setTimeout(callback, 5000)
        }); // data is a buffer, withoutResponse is true|false
    }

    armDrone() {
        var $this = this;
        $this.sendCommand(0, 0, 0, 0, true);
        $this.intervalSendCommands = setInterval(() => {
            $this.application.gamepad.axisValues;
            $this.sendCommand(
                $this.application.gamepad.axisValues["yaw"],
                $this.application.gamepad.axisValues["roll"],
                $this.application.gamepad.axisValues["pitch"],
                $this.application.gamepad.axisValues["gas"],
                true
            );
        }, 200);
    }

    disarmDrone() {
        this.sendCommand(0, 0, 0, 0, false);
        clearInterval(this.intervalSendCommands);
    }

    sendCommand(yaw, roll, pitch, power, armed) {
        var dataToSend = new Buffer([0, yaw, power, roll, pitch, 0, armed ? 4 : 0]);
        if ($this.droneCharacteristics[$this.CHARACTERISTICS.COMMAND]) {
            $this.droneCharacteristics[$this.CHARACTERISTICS.COMMAND].write(dataToSend, true, (error) => {
                if (error) console.error("ERROR", error);
            }); // data is a buffer, withoutResponse is true|false
        }
    }

}

class Application {

    constructor() {
        this.settings = remote.require("electron-settings");
        this.isWindows = process.platform === "win32";
        this.gamepad = new Controller(this);
        this.bluetooth = new Bluetooth(this);
        this.getSettings();
    }

    exitHandler(options, exitCode) {


        if (this.bluetooth.deviceConnected) {
            this.bluetooth.deviceConnected.disconnect();
        }

        if (options.cleanup) console.log('clean');
        if (exitCode || exitCode === 0) console.log(exitCode);
        if (options.exit) process.exit();
    }

    attachEvents() {
        var $this = this;
        //do something when app is closing
        process.on('exit', $this.exitHandler.bind(null, { cleanup: true }));

        //catches ctrl+c event
        process.on('SIGINT', $this.exitHandler.bind(null, { exit: true }));

        // catches "kill pid" (for example: nodemon restart)
        process.on('SIGUSR1', $this.exitHandler.bind(null, { exit: true }));
        process.on('SIGUSR2', $this.exitHandler.bind(null, { exit: true }));

        //catches uncaught exceptions
        process.on('uncaughtException', $this.exitHandler.bind(null, { exit: true }));
    }

    scanForGamePads() {
        this.gamepad.scanForGamePads();
    }

    setGamePad(gp) {
        var $this = this;

        if ($this.settings.has("gamepads[" + this.gamepad.vendor + "-" + this.gamepad.product + "]")) {
            var gp = $this.settings.get("gamepads[" + this.gamepad.vendor + "-" + this.gamepad.product + "]");
            $this.gamepad.loadGamepad(gp);
            swal.close();
            $this.scanDevices();
        } else {
            console.log("cosa nuova");
            swal({
                title: "Calibration required",
                text: 'The selected Gamepad seems new and then it requires to be calibrated',
                allowOutsideClick: false,
                allowEscapeKey: false
            }).then(() => {
                $this.gamepad.calibrate();
            });
        }

    }

    getSettings() {
        this.showBottomMessage('<i class="fas fa-cog fa-spin"></i> Loading configuration file');
        var sett = this.settings.getAll();
        this.hideBottomMessage();
        return sett;
    }

    saveControllerInfo() {
        $("#container-calibration").hide();
        $("#container-calibration-test").hide();
        var $this = this;
        var toSave = {
            commands: $this.gamepad.commands,
            name: $this.gamepad.name,
            product: $this.gamepad.product,
            vendor: $this.gamepad.vendor,
            id : $this.gamepad.id
        }
        $this.settings.set("gamepads[" + $this.gamepad.vendor + "-" + $this.gamepad.product + "]", toSave);
        console.info("Gamepad", toSave.name, "saved!");
        swal({
            title: "Gamepad saved",
            text: 'The Gamepad information are saved',
            allowOutsideClick: false,
            allowEscapeKey: false
        }).then(() => {
            app.scanDevices();
        });


    }

    scanDevices() {
        this.bluetooth.scanDevices(() => {
            console.log("Fine scan")
        });
    }

    flyView() {

        var $this = this;
        swal.close();

        $("#btn-arm-drone").off("click");
        $("#btn-arm-drone").on("click", (e) => {
            var $element = $(e.currentTarget);

            if ($element.hasClass("btn-danger")) {
                //arming
                swal({
                    html: '<img width="100" src="./assets/img/drone_ground.svg" /> <br>\
                    <p>Place the Drone on the floor and set the Power to the minimum, then continue with the arming</p>',
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    showConfirmButton: true,
                }).then(() => {

                    if ($this.gamepad.axisValues["gas"] > 0) {
                        //error
                        swal({
                            html: 'Set the Power to the minimum, then continue with the arming',
                            allowOutsideClick: false,
                            allowEscapeKey: false,
                            showConfirmButton: true,
                            type: "error"
                        }).then(() => {
                            $("#btn-arm-drone").click();
                        })
                    } else {
                        //calibrate


                        $element.removeClass("btn-danger");
                        $element.addClass("btn-warning");
                        $element.parent().next("p").html("CALIBRATING...");
                        $element.html('<i class="fas fa-cog fa-spin fa-2x"></i>');
                        $element.attr("title", "Calibrating the drone")
                        $this.bluetooth.calibrateDrone(() => {

                            $element.removeClass("btn-warning");
                            $element.addClass("btn-primary");
                            $element.parent().next("p").html("DISARM DRONE");
                            $element.html('<i class="fas fa-power-off fa-2x""></i>');
                            $element.attr("title", "Disarm the drone")
                            //arm
                            $this.bluetooth.armDrone();
                        });

                    }

                })
            } else if ($element.hasClass("btn-primary")) {
                //disarm
                $element.removeClass("btn-primary");
                $element.addClass("btn-danger");
                $element.parent().next("p").html("ARM DRONE");
                $element.html('<i class="fas fa-power-off fa-2x""></i>');
                $element.attr("title", "Arm the drone")
                //arm
                $this.bluetooth.disarmDrone();

            }
        });

        $("#container-fly-view").show();

        $this.gamepad.powerGauge = new JustGage({
            id: "gauge-power",
            value: 67,
            min: 0,
            max: 255,
            title: "",
            hideMinMax: true,
            hideValue: true,
            pointer: true,
            gaugeColor: "#22252f",
            levelColors: [
                "#3498db",
                "#2ecc71",
                "#f1c40f",
                "#c0392b"
            ],
            refreshAnimationTime:1
        });

    }

    showBottomMessage(message, type) {
        var $container = $("#container-message-info .card-body");
        $container.empty();

        switch (type) {
            case "error":
                break;

            default:
                $container.html(message);
                break;
        }

        $("#container-message-info").show();
        $('#container-message-info').animateCss('bounceInUp');

    }

    hideBottomMessage() {

        $('#container-message-info').animateCss('bounceOutDown', function () {
            // Do something after animation
            $("#container-message-info").hide();
        });
    }

}