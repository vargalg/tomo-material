/*******************************************************
 * conebeam.js
 * Handles the Three.js scene on the right side.
 * This file is loaded as a module, so we can import
 * 'three' and related controls via the import map.
 *******************************************************/
import * as THREE from 'three';
import { TrackballControls } from 'TrackballControls';
import { OrbitControls } from 'OrbitControls';

// Basic references
let scene, camera, renderer;
let controls;
let scene_group;      // the gantry: source + detector + fan, travels along the helix
let reference_group;  // the fixed reconstruction grid, stays at z = 0

// Example objects
let mesh_slice;
let mesh_detector, mesh_source, mesh_fan;
let mesh_pixel, mesh_ray;
let trajectory_mesh;

// If needed, keep the same constants in sync with the 2D side:
const fov_radius = 80;
const focusDistance = 200;
const detectorDistance = 220;
const pitch = 100;
const fowAngle = Math.asin(fov_radius / focusDistance);

// Initialize the 3D scene
initThree();
animateThree();

function initThree() {
    const rightColumn = document.querySelector('.right-column');

    // Create the Three.js scene
    scene = new THREE.Scene();

    // Create the camera
    const width = rightColumn.clientWidth;
    const height = rightColumn.clientHeight;
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
    // Start almost straight above the grid (looking down the helix axis, so the
    // 3D view initially matches the 2D one), but tilted just enough to avoid the
    // degenerate "up vector parallel to view" case and to hint at the helix.
    camera.position.set(0, 780, 120);
    camera.lookAt(0, 0, 0);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Attach the renderer's canvas to the .right-column
    rightColumn.appendChild(renderer.domElement);

    // Add OrbitControls or TrackballControls for navigation
    controls = new OrbitControls(camera, renderer.domElement);
    controls.rotateSpeed = 1.2;
    controls.panSpeed = 1.0;
    controls.target.set(0, 0, 0);
    controls.update();

    // Static reference frame: the reconstruction grid lives here. It stays at
    // z = 0 and never moves - it is the fixed reference the gantry travels around.
    reference_group = new THREE.Group();
    reference_group.rotation.x = -Math.PI / 2;
    scene.add(reference_group);

    // The gantry group (source + detector + fan). It orbits the helix axis and
    // climbs by one pitch per turn, so the source rides the magenta helix.
    scene_group = new THREE.Group();
    scene_group.rotation.x = -Math.PI / 2;
    scene.add(scene_group);

    // Example geometry: a plane for the "slice" (the fixed reconstruction grid)
    let geometry = new THREE.PlaneGeometry(2 * fov_radius, 2 * fov_radius, 20, 20);
    let material = new THREE.MeshBasicMaterial({ color: 'blue', wireframe: true });
    mesh_slice = new THREE.Mesh(geometry, material);
    reference_group.add(mesh_slice);

    // Create a group for the detector/source
    const projection_group = new THREE.Group();

    // Detector
    geometry = new THREE.CylinderGeometry(
        2 * detectorDistance,         // top radius
        2 * detectorDistance,         // bottom radius
        pitch,                        // height
        10, 5, true,                  // radialSegments, heightSegments, open-ended
        -fowAngle, 2 * fowAngle       // thetaStart, thetaLength
    );
    material = new THREE.MeshBasicMaterial({ color: 'green', wireframe: true });
    mesh_detector = new THREE.Mesh(geometry, material);
    mesh_detector.rotation.x = -Math.PI / 2;
    mesh_detector.position.y = -detectorDistance;
    projection_group.add(mesh_detector);

    // Source (simple sphere)
    geometry = new THREE.SphereGeometry(5);
    material = new THREE.MeshBasicMaterial({ color: 'red' });
    mesh_source = new THREE.Mesh(geometry, material);
    mesh_source.position.y = -detectorDistance;
    projection_group.add(mesh_source);

    // Fan region
    geometry = new THREE.CircleGeometry(
        2 * detectorDistance, 10,
        -fowAngle + Math.PI / 2, 2 * fowAngle
    );
    material = new THREE.MeshBasicMaterial({ color: 'green', wireframe: true });
    mesh_fan = new THREE.Mesh(geometry, material);
    mesh_fan.position.y = -detectorDistance;
    projection_group.add(mesh_fan);

    scene_group.add(projection_group);

    // "Pixel" sphere - a point in the fixed grid, so it belongs to reference_group
    geometry = new THREE.SphereGeometry(5);
    material = new THREE.MeshBasicMaterial({ color: 'red' });
    mesh_pixel = new THREE.Mesh(geometry, material);
    reference_group.add(mesh_pixel);

    // A simple ArrowHelper for the ray
    let dir = new THREE.Vector3(0, 1, 0);
    let origin = new THREE.Vector3();
    mesh_source.getWorldPosition(origin);
    let length = 2.4 * focusDistance;
    let hex = 0xffff00;
    mesh_ray = new THREE.ArrowHelper(dir, origin, length, hex, 10, 10);
    scene.add(mesh_ray);

    // Example "trajectory" line
    let vertices = [];
    for (let fraction = -1; fraction <= 1.001; fraction += 0.05) {
        const angle = (fraction + 0.25) * Math.PI * 2;
        vertices.push(
            detectorDistance * Math.cos(angle),
            -fraction * pitch,
            detectorDistance * Math.sin(angle)
        );
    }
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    material = new THREE.LineBasicMaterial({ color: 'magenta' });
    trajectory_mesh = new THREE.Line(geometry, material);
    scene.add(trajectory_mesh);

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Handle window resizing
    window.addEventListener('resize', onWindowResize, false);
}

function animateThree() {
    requestAnimationFrame(animateThree);

    // dotX, dotY, centerX, centerY, focusDistance and projectionAngle come from
    // fanbeam.js - top-level `const`/`let` there live in the global lexical scope,
    // which this module shares.
    let rad = (projectionAngle + 90) * Math.PI / 180;
    const focusPoint = getIntersectionWithCircle(dotX, dotY, rad, centerX, centerY, focusDistance);
    if (!focusPoint) {
        controls.update();
        renderer.render(scene, camera);
        return;
    }

    // Angular position of the source on the focus circle - i.e. the fan-beam
    // view that actually contains the requested (direction, point) ray.
    const proj_dir = Math.atan2(centerX - focusPoint.x, centerY - focusPoint.y);

    // Orbit the gantry about the helix axis (local Z, which is world "up" after
    // the -90 deg tilt). The grid never moves; only this group does.
    scene_group.rotation.z = proj_dir + Math.PI;

    // Climb the helix: unwrap the source angle so it follows the projection
    // angle continuously, then advance by one pitch per full turn. For most
    // views the source ends up above / below the grid plane - which is exactly
    // why the requested in-plane ray is generally not measured in a helical scan.
    const projRad = projectionAngle * Math.PI / 180;
    const beta = -projRad + wrapToPi((proj_dir - Math.PI) + projRad);
    scene_group.position.y = (beta / (2 * Math.PI)) * pitch;

    // Move the "pixel" object to the dot location (relative to center)
    mesh_pixel.position.set(dotX - centerX, -(dotY - centerY), 0);

    // Recompute arrow direction from source to pixel
    let origin = new THREE.Vector3();
    mesh_source.getWorldPosition(origin);

    let center_pos = new THREE.Vector3();
    mesh_pixel.getWorldPosition(center_pos);

    let dir = new THREE.Vector3().subVectors(center_pos, origin);
    mesh_ray.position.set(origin.x, origin.y, origin.z);
    mesh_ray.setDirection(dir.normalize());
    // mesh_ray.setLength(2.4 * focusDistance); // optionally reset length

    // Let user rotate/zoom the scene
    controls.update();
    renderer.render(scene, camera);
}

function onWindowResize() {
    const rightColumn = document.querySelector('.right-column');
    const width = rightColumn.clientWidth;
    const height = rightColumn.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// Wrap an angle to (-pi, pi].
function wrapToPi(a) {
    return a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
}

/**
 * If your 3D code also needs the circle-intersection logic, you can replicate
 * the function here or import it from a shared module. For now, we copy/paste
 * from the 2D logic.
 */
function getIntersectionWithCircle(dotX, dotY, rad, cx, cy, circleRadius) {
    const dx0 = dotX - cx;
    const dy0 = dotY - cy;
    const B = 2 * (dx0 * Math.cos(rad) + dy0 * Math.sin(rad));
    const C = dx0 * dx0 + dy0 * dy0 - circleRadius * circleRadius;
    const D = B * B - 4 * C;
    if (D < 0) return null;
    const sqrtD = Math.sqrt(D);
    const t1 = (-B + sqrtD) / 2;
    const t2 = (-B - sqrtD) / 2;
    const ts = [t1, t2].filter((val) => val > 0).sort((a, b) => a - b);
    if (ts.length === 0) return null;
    const t = ts[0];
    return {
        x: dotX + t * Math.cos(rad),
        y: dotY + t * Math.sin(rad)
    };
}
