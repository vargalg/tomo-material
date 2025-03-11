/*******************************************************
 * fanbeam.js
 * Handles the 2D canvas logic: the dot, the FOV circle,
 * and user interaction (mouse + angle slider).
 *******************************************************/
const screenLeft = document.getElementById('page-left');
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

// Dot can move within this circle (FOV)
const fov_radius = 80;

// The "focus" circle radius, where the line intersects
const focusDistance = 200;
const detectorDistance = 220;

const fowAngle = Math.asin(fov_radius / focusDistance);

// Canvas center
const centerX = canvas.width / 2;
const centerY = canvas.height / 2;

// Dot position
let dotX = centerX;
let dotY = centerY;

// Projection angle in degrees (controlled by slider)
let projectionAngle = 0;

// Slider references
const angleSlider = document.getElementById('angleSlider');
const angleValue = document.getElementById('angleValue');

angleSlider.addEventListener('input', () => {
    projectionAngle = parseFloat(angleSlider.value);
    angleValue.textContent = projectionAngle;
});

// Also allow scroll to change angle on the left column
screenLeft.addEventListener('wheel', (event) => {
    event.preventDefault(); // block page scrolling
    // Adjust angle by wheel
    projectionAngle += event.deltaY * 0.1;
    // clamp / wrap angle:  keep it between -360..360
    projectionAngle = (projectionAngle + 360 + 720) % 720 - 360;
    angleSlider.value = projectionAngle;
    angleValue.textContent = projectionAngle.toFixed(0);
}, { passive: false });

// Basic animation loop for 2D
function animate2D() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1) Draw FOV circle (where dot can move)
    ctx.beginPath();
    ctx.arc(centerX, centerY, fov_radius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 2) Draw dot
    ctx.beginPath();
    ctx.arc(dotX, dotY, 5, 0, 2 * Math.PI);
    ctx.fillStyle = 'red';
    ctx.fill();

    // 3) Draw the "projection line" through the dot
    const rad = ((projectionAngle + 90) * Math.PI) / 180;

    // 4) Intersection logic
    const focusPoint = getIntersectionWithCircle(dotX, dotY, rad, centerX, centerY, focusDistance);

    // Example: draw the detector line for reference
    ctx.beginPath();
    ctx.moveTo(
        centerX - Math.cos(rad) * detectorDistance + Math.sin(-rad) * fov_radius,
        centerY - Math.sin(rad) * detectorDistance + Math.cos(-rad) * fov_radius
    );
    ctx.lineTo(
        centerX - Math.cos(rad) * detectorDistance - Math.sin(-rad) * fov_radius,
        centerY - Math.sin(rad) * detectorDistance - Math.cos(-rad) * fov_radius
    );
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (focusPoint) {
        // Draw focus circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, focusDistance, 0, 2 * Math.PI);
        ctx.strokeStyle = 'magenta';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw the focus point
        ctx.beginPath();
        ctx.arc(focusPoint.x, focusPoint.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = 'magenta';
        ctx.fill();

        // Now draw a line from the focus point into the scene
        const lineLen = 410;
        const xLine1 = focusPoint.x;
        const yLine1 = focusPoint.y;
        const xLine2 = xLine1 - lineLen * Math.cos(rad);
        const yLine2 = yLine1 - lineLen * Math.sin(rad);

        ctx.beginPath();
        ctx.moveTo(xLine1, yLine1);
        ctx.lineTo(xLine2, yLine2);
        ctx.strokeStyle = 'green';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Extra lines in red
        const projAngle = Math.atan2(centerX - focusPoint.x, centerY - focusPoint.y);
        const xProjEnd1 = focusPoint.x + Math.sin(projAngle - fowAngle) * lineLen;
        const yProjEnd1 = focusPoint.y + Math.cos(projAngle - fowAngle) * lineLen;
        const xProjEnd2 = focusPoint.x + Math.sin(projAngle + fowAngle) * lineLen;
        const yProjEnd2 = focusPoint.y + Math.cos(projAngle + fowAngle) * lineLen;

        ctx.beginPath();
        ctx.moveTo(xLine1, yLine1);
        ctx.lineTo(xProjEnd1, yProjEnd1);
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(xLine1, yLine1);
        ctx.lineTo(xProjEnd2, yProjEnd2);
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    requestAnimationFrame(animate2D);
}

// Intersection function used by the 2D logic
function getIntersectionWithCircle(dotX, dotY, rad, cx, cy, circleRadius) {
    const dx0 = dotX - cx;
    const dy0 = dotY - cy;
    const B = 2 * (dx0 * Math.cos(rad) + dy0 * Math.sin(rad));
    const C = dx0 * dx0 + dy0 * dy0 - circleRadius * circleRadius;
    const D = B * B - 4 * C; // discriminant
    if (D < 0) return null;  // no real solutions => no intersection
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

// Mouse handling to move the dot inside the circle
let isMouseDown = false;

function fowSelect(event) {
    if (!isMouseDown) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let dx = x - centerX;
    let dy = y - centerY;
    let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > fov_radius) {
        dx = (dx / dist) * fov_radius;
        dy = (dy / dist) * fov_radius;
    }
    dotX = centerX + dx;
    dotY = centerY + dy;
}

canvas.addEventListener('mousedown', (event) => {
    isMouseDown = true;
    fowSelect(event);
});
canvas.addEventListener('mouseup', () => {
    isMouseDown = false;
});
canvas.addEventListener('mousemove', fowSelect);

// Start the 2D rendering loop
animate2D();
