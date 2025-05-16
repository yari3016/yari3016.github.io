// script.js

const addEquationButton = document.getElementById('addEquationButton');
const clearGraphButton = document.getElementById('clearGraphButton');
const equationsList = document.getElementById('equations-list');
const graphAllButton = document.getElementById('graphAllButton');
const canvas = document.getElementById('mathGraph');
const ctx = canvas.getContext('2d');
const hoverCoordsDiv = document.getElementById('hover-coords');
const errorMessageDiv = document.getElementById('error-message');
const legendList = document.getElementById('legend-list');

const canvasWidth = canvas.width;
const canvasHeight = canvas.height;

// --- State Variables ---
let equations = [];
let nextEquationId = 0;

let xMin = -10;
let xMax = 10;
let yMin = -10;
let yMax = 10;

let isPanning = false;
let lastMouseX = 0;
let lastMouseY = 0;

// --- Utility Functions ---

function getScaleX() { return canvasWidth / (xMax - xMin); }
function getScaleY() { return canvasHeight / (yMax - yMin); }
function getOriginX() { return -xMin * getScaleX(); }
function getOriginY() { return yMax * getScaleY(); }

function toCanvasCoords(x, y) {
    const pixelX = getOriginX() + x * getScaleX();
    const pixelY = getOriginY() - y * getScaleY();
    return { x: pixelX, y: pixelY };
}

function toMathCoords(pixelX, pixelY) {
    const x = (pixelX - getOriginX()) / getScaleX();
    const y = (getOriginY() - pixelY) / getScaleY();
    return { x: x, y: y };
}

function addEquationInput(equation = '', color = getRandomColor()) {
    const equationId = nextEquationId++;
    const equationGroup = document.createElement('div');
    equationGroup.classList.add('equation-input-group');
    equationGroup.dataset.id = equationId;

    equationGroup.innerHTML = `
        <label for="equationInput${equationId}">Eq ${equationId + 1}:</label>
        <input type="text" id="equationInput${equationId}" class="equation-input" value="${equation}">
        <input type="color" class="equation-color" value="${color}">
        <button class="remove-equation-button">Remove</button>
    `;

    equationsList.appendChild(equationGroup);

    equationGroup.querySelector('.remove-equation-button').addEventListener('click', () => {
        removeEquationInput(equationId);
    });

    equations.push({ id: equationId, expression: equation, color: color, compiled: null });
    updateLegend();
}

function removeEquationInput(equationId) {
    const equationGroup = equationsList.querySelector(`.equation-input-group[data-id="${equationId}"]`);
    if (equationGroup) {
        equationsList.removeChild(equationGroup);
        equations = equations.filter(eq => eq.id !== equationId);
        plotAllEquations();
        updateLegend();
    }
}

function updateEquationList() {
    const updatedEquations = [];
    equationsList.querySelectorAll('.equation-input-group').forEach(group => {
        const equationId = parseInt(group.dataset.id);
        const equationInput = group.querySelector('.equation-input');
        const colorInput = group.querySelector('.equation-color');
        const existingEquation = equations.find(eq => eq.id === equationId);

        updatedEquations.push({
            id: equationId,
            expression: equationInput.value.trim(),
            color: colorInput.value,
            compiled: (existingEquation && existingEquation.expression === equationInput.value.trim()) ? existingEquation.compiled : null
        });
    });
    equations = updatedEquations;
    updateLegend();
}

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function updateLegend() {
    legendList.innerHTML = '';
    equations.forEach(eq => {
        if (eq.expression) {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span class="legend-color-box" style="background-color: ${eq.color};"></span>
                ${eq.expression}
            `;
            legendList.appendChild(listItem);
        }
    });
}

// --- Drawing Functions ---

function drawAxes() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const currentXScale = getScaleX();
    const currentYScale = getScaleY();
    const currentOriginX = getOriginX();
    const currentOriginY = getOriginY();

    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#333';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Simplified tick intervals, still somewhat adaptive for panning
    let xTickInterval = 1;
    const currentXRange = xMax - xMin;
    if (currentXRange > 40) xTickInterval = 10;
    else if (currentXRange > 20) xTickInterval = 5;
    else if (currentXRange < 5) xTickInterval = 0.5;
    else if (currentXRange < 2) xTickInterval = 0.2;


    let yTickInterval = 1;
    const currentYRange = yMax - yMin;
    if (currentYRange > 40) yTickInterval = 10;
    else if (currentYRange > 20) yTickInterval = 5;
    else if (currentYRange < 5) yTickInterval = 0.5;
    else if (currentYRange < 2) yTickInterval = 0.2;


    for (let x = Math.ceil(xMin / xTickInterval) * xTickInterval; x <= Math.floor(xMax / xTickInterval) * xTickInterval; x += xTickInterval) {
        const pixelX = currentOriginX + x * currentXScale;
        if (pixelX >= 0 && pixelX <= canvasWidth) {
            ctx.beginPath();
            ctx.moveTo(pixelX, 0);
            ctx.lineTo(pixelX, canvasHeight);
            ctx.stroke();
            if (Math.abs(x) > 1e-6) {
                let labelY = currentOriginY + 5;
                if (currentOriginY < 15 && currentOriginY >=0) labelY = 5;
                else if (currentOriginY > canvasHeight - 15 && currentOriginY <= canvasHeight) labelY = canvasHeight - 15;
                else if (currentOriginY < 0) labelY = 5;
                else if (currentOriginY > canvasHeight) labelY = canvasHeight - 15;
                ctx.fillText(x.toFixed(getDecimalPlaces(xTickInterval)), pixelX, labelY);
            }
        }
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = Math.ceil(yMin / yTickInterval) * yTickInterval; y <= Math.floor(yMax / yTickInterval) * yTickInterval; y += yTickInterval) {
        const pixelY = currentOriginY - y * currentYScale;
        if (pixelY >= 0 && pixelY <= canvasHeight) {
            ctx.beginPath();
            ctx.moveTo(0, pixelY);
            ctx.lineTo(canvasWidth, pixelY);
            ctx.stroke();
            if (Math.abs(y) > 1e-6) {
                let labelX = currentOriginX - 5;
                if (currentOriginX < 25 && currentOriginX >=0) labelX = 5;
                else if (currentOriginX > canvasWidth - 25 && currentOriginX <= canvasWidth) labelX = canvasWidth - 5;
                else if (currentOriginX < 0) labelX = 5;
                else if (currentOriginX > canvasWidth) labelX = canvasWidth - 5;
                ctx.fillText(y.toFixed(getDecimalPlaces(yTickInterval)), labelX, pixelY);
            }
        }
    }

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;

    if (currentOriginY >= 0 && currentOriginY <= canvasHeight) {
        ctx.beginPath();
        ctx.moveTo(0, currentOriginY);
        ctx.lineTo(canvasWidth, currentOriginY);
        ctx.stroke();
    }
    if (currentOriginX >= 0 && currentOriginX <= canvasWidth) {
        ctx.beginPath();
        ctx.moveTo(currentOriginX, 0);
        ctx.lineTo(currentOriginX, canvasHeight);
        ctx.stroke();
    }

    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (currentOriginX > 0 && currentOriginX < canvasWidth && currentOriginY > 0 && currentOriginY < canvasHeight) {
        let zeroLabelX = currentOriginX - 7;
        let zeroLabelY = currentOriginY + 7;
        ctx.fillText('0', zeroLabelX, zeroLabelY);
    }

    function getDecimalPlaces(num) {
        const str = num.toString();
        if (str.includes('.')) {
            return str.split('.')[1].length;
        }
        return 0;
    }
}

function plotSingleEquation(equation) {
    if (!equation.expression) return;

    if (errorMessageDiv.textContent.includes(`"${equation.expression}"`)) {
        errorMessageDiv.textContent = '';
    }

    try {
        if (!equation.compiled) {
            equation.compiled = math.compile(equation.expression);
        }

        const currentXRange = xMax - xMin;
        if (currentXRange > 35) {
            ctx.lineWidth = 1;
        } else if (currentXRange > 20) {
            ctx.lineWidth = 1.5;
        } else {
            ctx.lineWidth = 2;
        }

        ctx.strokeStyle = equation.color;
        ctx.beginPath();

        let firstPoint = true;
        let prevMathY = null;

        for (let pixelX = 0; pixelX <= canvasWidth; pixelX++) {
            const mathX = toMathCoords(pixelX, 0).x;
            try {
                const mathY = equation.compiled.evaluate({ x: mathX });
                if (!isFinite(mathY)) {
                    firstPoint = true;
                    prevMathY = null;
                    continue;
                }

                const pixelCoords = toCanvasCoords(mathX, mathY);
                const currentGetScaleY = getScaleY();
                const scaledYJump = Math.abs(mathY - (prevMathY !== null ? prevMathY : mathY)) * currentGetScaleY;
                const discontinuityPixelThreshold = canvasHeight * 0.95;

                if (prevMathY !== null &&
                    scaledYJump >= discontinuityPixelThreshold &&
                    Math.abs(currentGetScaleY) > 1e-6) {
                    firstPoint = true;
                }

                if (firstPoint) {
                    if (pixelCoords.y > -canvasHeight * 5 && pixelCoords.y < canvasHeight * 6) {
                        ctx.moveTo(pixelCoords.x, pixelCoords.y);
                        firstPoint = false;
                    } else {
                        prevMathY = mathY;
                        continue;
                    }
                } else {
                    if (pixelCoords.y > -canvasHeight * 5 && pixelCoords.y < canvasHeight * 6) {
                        ctx.lineTo(pixelCoords.x, pixelCoords.y);
                    } else {
                        firstPoint = true;
                    }
                }
                prevMathY = mathY;
            } catch (evalError) {
                firstPoint = true;
                prevMathY = null;
            }
        }
        ctx.stroke();
    } catch (parseError) {
        console.error("Error parsing equation:", equation.expression, parseError);
        errorMessageDiv.textContent = `Error in equation "${equation.expression}": ${parseError.message}`;
    }
}

function plotAllEquations() {
    errorMessageDiv.textContent = '';
    equations.forEach(eq => {
        if (eq.expression && !eq.compiled) {
            try {
                eq.compiled = math.compile(eq.expression);
            } catch (parseError) {
                eq.compiled = null;
            }
        } else if (!eq.expression) {
            eq.compiled = null;
        }
    });

    let calculatedYMin = Infinity;
    let calculatedYMax = -Infinity;
    const xRange = xMax - xMin;
    const step = (xRange > 1e-9) ? xRange / canvasWidth : 0;

    let yValues = [];
    if (step > 0) {
        equations.forEach(eq => {
            if (eq.compiled) {
                for (let mathX = xMin; mathX <= xMax; mathX += step) {
                    try {
                        const mathY = eq.compiled.evaluate({ x: mathX });
                        if (isFinite(mathY)) {
                            yValues.push(mathY);
                        }
                    } catch (evalError) { /* Ignore for range */ }
                }
            }
        });
    }

    if (yValues.length > 0) {
        if (yValues.length < 20 || Math.floor(yValues.length * 0.025) < 1 || Math.ceil(yValues.length * 0.975) > yValues.length ) {
            calculatedYMin = Math.min(...yValues);
            calculatedYMax = Math.max(...yValues);
        } else {
            yValues.sort((a, b) => a - b);
            const percentile = 0.025;
            const lowerIndex = Math.floor(yValues.length * percentile);
            const upperIndex = Math.ceil(yValues.length * (1 - percentile)) - 1;
            calculatedYMin = yValues[Math.max(0, lowerIndex)];
            calculatedYMax = yValues[Math.min(yValues.length - 1, upperIndex)];
            if (calculatedYMin > calculatedYMax) {
                calculatedYMin = yValues[0];
                calculatedYMax = yValues[yValues.length -1];
            }
        }
    }

    if (isFinite(calculatedYMin) && isFinite(calculatedYMax)) {
        const ySpan = calculatedYMax - calculatedYMin;
        let yPadding;
        if (Math.abs(ySpan) < 1e-9) {
            yPadding = 1;
        } else {
            yPadding = ySpan * 0.1;
        }
        yMin = calculatedYMin - yPadding;
        yMax = calculatedYMax + yPadding;
        if (Math.abs(yMin - yMax) < 1e-9) {
            yMin -= 1;
            yMax += 1;
        }
    } else {
        yMin = -10;
        yMax = 10;
    }

    drawAxes();
    equations.forEach(equation => {
        plotSingleEquation(equation);
    });
    updateLegend();
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    addEquationInput('tan(x)', '#0000ff');
    plotAllEquations();
});

addEquationButton.addEventListener('click', () => {
    addEquationInput();
});

clearGraphButton.addEventListener('click', () => {
    equations = [];
    equationsList.innerHTML = '';
    nextEquationId = 0;
    xMin = -10; xMax = 10; yMin = -10; yMax = 10; // Reset view
    drawAxes();
    errorMessageDiv.textContent = '';
    updateLegend();
});

graphAllButton.addEventListener('click', () => {
    updateEquationList();
    plotAllEquations();
});

canvas.addEventListener('mousedown', (e) => {
    isPanning = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    canvas.style.cursor = 'grabbing';
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mousePixelX = e.clientX - rect.left;
    const mousePixelY = e.clientY - rect.top;

    if (mousePixelX >= 0 && mousePixelX <= canvasWidth && mousePixelY >= 0 && mousePixelY <= canvasHeight && !isPanning) {
        const mathCoords = toMathCoords(mousePixelX, mousePixelY);
        hoverCoordsDiv.textContent = `x: ${mathCoords.x.toFixed(3)}, y: ${mathCoords.y.toFixed(3)}`;
        hoverCoordsDiv.style.display = 'block';
    } else {
        hoverCoordsDiv.style.display = 'none';
    }

    if (!isPanning) return;

    const deltaX = e.clientX - lastMouseX;
    const deltaY = e.clientY - lastMouseY;

    const currentXScale = getScaleX();
    const currentYScale = getScaleY();

    if (Math.abs(currentXScale) < 1e-9 || Math.abs(currentYScale) < 1e-9) {
        isPanning = false;
        canvas.style.cursor = 'grab';
        return;
    }

    const mathDeltaX = deltaX / currentXScale;
    const mathDeltaY = deltaY / currentYScale;

    xMin -= mathDeltaX;
    xMax -= mathDeltaX;
    yMin += mathDeltaY;
    yMax += mathDeltaY;

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    plotAllEquations();
});

canvas.addEventListener('mouseup', () => {
    isPanning = false;
    canvas.style.cursor = 'grab';
});

canvas.addEventListener('mouseleave', () => {
    if (isPanning) {
        isPanning = false;
        canvas.style.cursor = 'grab';
    }
    hoverCoordsDiv.style.display = 'none';
});

// REMOVED: canvas.addEventListener('wheel', (e) => { ... zoom logic ... });

equationsList.addEventListener('input', (e) => {
    if (e.target.classList.contains('equation-input') || e.target.classList.contains('equation-color')) {
        updateEquationList();
        plotAllEquations();
    }
});