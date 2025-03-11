////////////////////
// 1) LEFT-SIDE UI //
////////////////////

// Get references to DOM elements
const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d');

const brushSizeInput     = document.getElementById('brushSize');
const colorPicker        = document.getElementById('colorPicker');
const clearBtn           = document.getElementById('clearBtn');
const fileInput          = document.getElementById('fileInput');
const angleSlider        = document.getElementById('angleSlider');
const angleValueSpan     = document.getElementById('angleValue');
const numRotationsSlider = document.getElementById('numRotationsSlider');
const numRotationsSpan   = document.getElementById('numRotationsValue');
const sinogramBtn        = document.getElementById('sinogramBtn');
const progressInfo       = document.getElementById('progressInfo');

const sinogramCanvas = document.getElementById('sinogramCanvas');
const sinogramCtx    = sinogramCanvas.getContext('2d');

// Initialize
ctx.fillStyle = "#000000";
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Brush settings
let brushSize  = parseInt(brushSizeInput.value, 10);
let brushColor = colorPicker.value;

// Update displayed angle slider text
angleValueSpan.textContent = angleSlider.value;

numRotationsSpan.textContent = numRotationsSlider.value;

// Event: brush size/color changed
brushSizeInput.addEventListener('input', () => {
    brushSize = parseInt(brushSizeInput.value, 10);
});
colorPicker.addEventListener('input', () => {
    brushColor = colorPicker.value;
});

// Attach one click handler for all swatch buttons
document.querySelectorAll('.swatchBtn').forEach(button => {
    button.addEventListener('click', () => {
        // Read the desired color from data-color
        brushColor = button.getAttribute('data-color');
        colorPicker.value = brushColor;
    });
});

// Event: angle slider changed
angleSlider.addEventListener('input', () => {
    angleValueSpan.textContent = angleSlider.value;
});

numRotationsSlider.addEventListener('input', () => {
    numRotationsSpan.textContent = numRotationsSlider.value;
})

// Clear button
clearBtn.addEventListener('click', () => {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
});

// Freehand drawing with mouse
let drawing = false;
let lastX = 0, lastY = 0;

canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    [lastX, lastY] = getMousePos(e);
});
canvas.addEventListener('mouseup',   () => drawing = false);
canvas.addEventListener('mouseleave',() => drawing = false);

canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    const [mouseX, mouseY] = getMousePos(e);

    ctx.strokeStyle = brushColor;
    ctx.lineWidth   = brushSize;
    ctx.lineCap     = 'round';

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(mouseX, mouseY);
    ctx.stroke();

    [lastX, lastY] = [mouseX, mouseY];
});

function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    return [
        evt.clientX - rect.left,
        evt.clientY - rect.top
    ];
}

// Load image into left canvas
fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const size   = 512;
            const aspect = img.width / img.height;
            let dw, dh;
            if (aspect > 1) {
                dw = size;
                dh = size / aspect;
            } else {
                dh = size;
                dw = size * aspect;
            }
            const offX = (size - dw) / 2;
            const offY = (size - dh) / 2;

            ctx.drawImage(img, offX, offY, dw, dh);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
});

// Compute sinogram button
sinogramBtn.addEventListener('click', computeSinogramAsync);

//////////////////////////////
// 2) ROW-BY-ROW SINOGRAM  //
//////////////////////////////

function computeSinogramAsync() {
    // Grab user parameters
    const nAngles = parseInt(angleSlider.value, 10);
    const detectorCount = 600;
    const numRotation = parseInt(numRotationsSlider.value);

    // Setup sinogram canvas
    sinogramCanvas.width  = detectorCount;
    sinogramCanvas.height = nAngles;

    // Extract image data from left canvas
    const imgWidth  = canvas.width;  // 512
    const imgHeight = canvas.height; // 512
    const sourceData = ctx.getImageData(0, 0, imgWidth, imgHeight);

    // Arrays to store partial color sums
    const sinogramData_r = new Float32Array(nAngles * detectorCount);
    const sinogramData_g = new Float32Array(nAngles * detectorCount);
    const sinogramData_b = new Float32Array(nAngles * detectorCount);

    let globalMin = Infinity;
    let globalMax = -Infinity;

    // Helper to sample a pixel
    function samplePixel(x, y) {
        const xx = Math.floor(x), yy = Math.floor(y);
        if (xx < 0 || yy < 0 || xx >= imgWidth || yy >= imgHeight) {
            return [0, 0, 0];
        }
        const idx = (yy * imgWidth + xx) * 4;
        const r = sourceData.data[idx + 0];
        const g = sourceData.data[idx + 1];
        const b = sourceData.data[idx + 2];
        return [r, g, b];
    }

    // Basic geometry
    const centerX  = imgWidth / 2;  // 256
    const centerY  = imgHeight / 2; // 256
    const halfSize = imgHeight / 2; // integrate from -256..+256
    const stepSize = 1;

    // We'll do row-by-row
    let currentAngleIndex = 0;

    function computeOneRow() {
        if (currentAngleIndex >= nAngles) {
            // Done
            progressInfo.textContent = "Sinogram complete!";
            return;
        }

        const a = currentAngleIndex;
        // 0..π for half circle, or use (2*Math.PI*a)/nAngles for full circle
        const angle = (2*Math.PI * numRotation * a) / nAngles;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        for (let d = 0; d < detectorCount; d++) {
            const offset = d - detectorCount / 2;

            let sum_r = 0, sum_g = 0, sum_b = 0;
            let count = 0;

            for (let t = -halfSize; t < halfSize; t += stepSize) {
                const xx = centerX + t * cosA - offset * sinA;
                const yy = centerY + t * sinA + offset * cosA;
                const [r, g, b] = samplePixel(xx, yy);
                sum_r += r;
                sum_g += g;
                sum_b += b;
                count++;
            }

            const idx = a * detectorCount + d;
            const avg_r = (count > 0) ? (sum_r / count) : 0;
            const avg_g = (count > 0) ? (sum_g / count) : 0;
            const avg_b = (count > 0) ? (sum_b / count) : 0;

            sinogramData_r[idx] = avg_r;
            sinogramData_g[idx] = avg_g;
            sinogramData_b[idx] = avg_b;

            // Update global min/max
            if (avg_r < globalMin) globalMin = avg_r;
            if (avg_g < globalMin) globalMin = avg_g;
            if (avg_b < globalMin) globalMin = avg_b;
            if (avg_r > globalMax) globalMax = avg_r;
            if (avg_g > globalMax) globalMax = avg_g;
            if (avg_b > globalMax) globalMax = avg_b;
        }

        // Render the partial sinogram [rows 0..a]
        renderSoFar(a);

        // Progress
        progressInfo.textContent = `Row ${a+1}/${nAngles} done...`;

        // Move to next row in next animation frame
        currentAngleIndex++;
        requestAnimationFrame(computeOneRow);
    }

    function renderSoFar(lastRow) {
        // We'll create an ImageData the full size,
        // but only fill rows up to lastRow.
        const output = sinogramCtx.createImageData(detectorCount, nAngles);
        const range = Math.max(1, globalMax - globalMin);

        for (let row = 0; row <= lastRow; row++) {
            for (let d = 0; d < detectorCount; d++) {
                const i = row * detectorCount + d;
                const R = sinogramData_r[i];
                const G = sinogramData_g[i];
                const B = sinogramData_b[i];

                const normR = (R - globalMin) / range;
                const normG = (G - globalMin) / range;
                const normB = (B - globalMin) / range;

                const px_r = Math.floor(normR * 255);
                const px_g = Math.floor(normG * 255);
                const px_b = Math.floor(normB * 255);

                const outIdx = i * 4;
                output.data[outIdx + 0] = px_r;
                output.data[outIdx + 1] = px_g;
                output.data[outIdx + 2] = px_b;
                output.data[outIdx + 3] = 255;
            }
        }

        sinogramCtx.putImageData(output, 0, 0);
    }

    // Start row-by-row
    currentAngleIndex = 0;
    progressInfo.textContent = "Starting sinogram...";
    requestAnimationFrame(computeOneRow);
}
