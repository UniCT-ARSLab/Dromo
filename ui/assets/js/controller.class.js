


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