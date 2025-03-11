/*******************************************************
 * right.js
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
let scene_group;

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
    // Position or rotate camera as needed
    camera.position.y = 800;

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Attach the renderer's canvas to the .right-column
    rightColumn.appendChild(renderer.domElement);

    // Add OrbitControls or TrackballControls for navigation
    controls = new OrbitControls(camera, rightColumn);
    controls.rotateSpeed = 5.0;
    controls.panSpeed = 1.0;

    // Create a group that we can rotate, etc.
    scene_group = new THREE.Group();
    scene_group.rotation.x = -Math.PI / 2;
    scene.add(scene_group);

    // Example geometry: a plane for the "slice"
    let geometry = new THREE.PlaneGeometry(2 * fov_radius, 2 * fov_radius, 20, 20);
    let material = new THREE.MeshBasicMaterial({ color: 'blue', wireframe: true });
    mesh_slice = new THREE.Mesh(geometry, material);
    scene_group.add(mesh_slice);

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

    // "Pixel" sphere
    geometry = new THREE.SphereGeometry(5);
    material = new THREE.MeshBasicMaterial({ color: 'red' });
    mesh_pixel = new THREE.Mesh(geometry, material);
    scene_group.add(mesh_pixel);

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

    // If you want to read the same dotX, dotY from the 2D side, you need to
    // fetch them from window or a shared data store. For now, let's assume
    // we still define them here or replicate the logic.

    // Example: read global variables from left side (if you store them on window)
    // let { dotX, dotY, centerX, centerY } = window.leftState; // if you had set that up

    // The following lines assume we have the same 2D variables in global scope
    // if fanbeam.js sets them on window or so. Otherwise, replicate the logic.

    // We do have references to:
    //   dotX, dotY, centerX, centerY, focusDistance, projectionAngle
    // from the fanbeam.js scope. If they are truly global, this will work:
    let rad = (projectionAngle + 90) * Math.PI / 180;
    const focusPoint = getIntersectionWithCircle(dotX, dotY, rad, centerX, centerY, focusDistance);

    let proj_dir = Math.atan2(centerX - focusPoint.x, centerY - focusPoint.y);

    // Rotation around the Z axis
    scene_group.rotation.z = proj_dir + Math.PI;

    rad -= Math.PI / 2;
    proj_dir = Math.PI - proj_dir;
    proj_dir = rad + ((proj_dir - rad + Math.PI) % (2 * Math.PI)) - Math.PI;
    let height = proj_dir / (2 * Math.PI);
    scene_group.position.z = -height * pitch;

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
