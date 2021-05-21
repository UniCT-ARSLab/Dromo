


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