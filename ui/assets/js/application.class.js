

var { ipcRenderer, remote } = require('electron');
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