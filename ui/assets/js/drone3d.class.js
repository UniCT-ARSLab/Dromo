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