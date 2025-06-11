import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DragControls } from 'three/addons/controls/DragControls.js';

// --- Szene-Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const infoPanelWidth = 300;
const threeContainer = document.getElementById('three-container');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth - infoPanelWidth, window.innerHeight);
threeContainer.appendChild(renderer.domElement);

camera.position.set(5, 5, 5);
camera.lookAt(0, 0, 0);

// --- Beleuchtung ---
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// --- Gitter und Achsenhelfer ---
const gridHelper = new THREE.GridHelper(10, 10);
scene.add(gridHelper);
const axesHelper = new THREE.AxesHelper(3);
scene.add(axesHelper);

// --- Punkte und Linien ---
const pointMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
const lineMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 3 });

// Speichere die initialen Positionen
const initialPositions = {
    anchor1: new THREE.Vector3(-2, 2, 0),
    anchor2: new THREE.Vector3(2, 2, 0),
    attachmentPoint: new THREE.Vector3(0, 0, 0)
};

// Ankerpunkte
const anchor1 = new THREE.Mesh(new THREE.SphereGeometry(0.1), pointMaterial);
anchor1.position.copy(initialPositions.anchor1); // Setze initial
anchor1.name = 'anchor1';
scene.add(anchor1);

const anchor2 = new THREE.Mesh(new THREE.SphereGeometry(0.1), pointMaterial);
anchor2.position.copy(initialPositions.anchor2); // Setze initial
anchor2.name = 'anchor2';
scene.add(anchor2);

// Anschlagpunkt
const attachmentPoint = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshPhongMaterial({ color: 0x00ff00 }));
attachmentPoint.position.copy(initialPositions.attachmentPoint); // Setze initial
attachmentPoint.name = 'attachmentPoint';
scene.add(attachmentPoint);

// Traversenlinien
const line1Geometry = new THREE.BufferGeometry();
const line1 = new THREE.Line(line1Geometry, lineMaterial);
scene.add(line1);

const line2Geometry = new THREE.BufferGeometry();
const line2 = new THREE.Line(line2Geometry, lineMaterial);
scene.add(line2);

// --- Steuerung (Kamera und Drag) ---
const controls = new OrbitControls(camera, renderer.domElement);

const draggableObjects = [anchor1, anchor2, attachmentPoint];
const dragControls = new DragControls(draggableObjects, camera, renderer.domElement);

dragControls.addEventListener('dragstart', function (event) {
    controls.enabled = false;
});

dragControls.addEventListener('dragend', function (event) {
    controls.enabled = true;
    updateCalculations();
});

// --- UI-Elemente ---
const inputA1X = document.getElementById('a1-x');
const inputA1Y = document.getElementById('a1-y');
const inputA1Z = document.getElementById('a1-z');

const inputA2X = document.getElementById('a2-x');
const inputA2Y = document.getElementById('a2-y');
const inputA2Z = document.getElementById('a2-z');

const inputPX = document.getElementById('p-x');
const inputPY = document.getElementById('p-y');
const inputPZ = document.getElementById('p-z');

const lenA1P = document.getElementById('len-a1-p');
const lenA2P = document.getElementById('len-a2-p');
const angleA1Vert = document.getElementById('angle-a1-vert');
const angleA2Vert = document.getElementById('angle-a2-vert');
const angleOpen = document.getElementById('angle-open');

// Reset-Button Referenz
const resetButton = document.getElementById('reset-button');


// Synchronisieren von UI und 3D-Punkten
function updatePointFromInput(point, inputX, inputY, inputZ) {
    point.position.set(
        parseFloat(inputX.value),
        parseFloat(inputY.value),
        parseFloat(inputZ.value)
    );
    updateCalculations();
}

inputA1X.addEventListener('change', () => updatePointFromInput(anchor1, inputA1X, inputA1Y, inputA1Z));
inputA1Y.addEventListener('change', () => updatePointFromInput(anchor1, inputA1X, inputA1Y, inputA1Z));
inputA1Z.addEventListener('change', () => updatePointFromInput(anchor1, inputA1X, inputA1Y, inputA1Z));

inputA2X.addEventListener('change', () => updatePointFromInput(anchor2, inputA2X, inputA2Y, inputA2Z));
inputA2Y.addEventListener('change', () => updatePointFromInput(anchor2, inputA2X, inputA2Y, inputA2Z));
inputA2Z.addEventListener('change', () => updatePointFromInput(anchor2, inputA2X, inputA2Y, inputA2Z));

inputPX.addEventListener('change', () => updatePointFromInput(attachmentPoint, inputPX, inputPY, inputPZ));
inputPY.addEventListener('change', () => updatePointFromInput(attachmentPoint, inputPX, inputPY, inputPZ));
inputPZ.addEventListener('change', () => updatePointFromInput(attachmentPoint, inputPX, inputPY, inputPZ));

// --- Reset-Funktion ---
function resetPoints() {
    anchor1.position.copy(initialPositions.anchor1);
    anchor2.position.copy(initialPositions.anchor2);
    attachmentPoint.position.copy(initialPositions.attachmentPoint);
    updateCalculations(); // Berechnungen nach dem Reset aktualisieren
}

// Event Listener für den Reset-Button
resetButton.addEventListener('click', resetPoints);


// --- Berechnungen und Aktualisierung der Anzeige ---
function updateCalculations() {
    // Aktualisiere Input-Felder basierend auf 3D-Positionen
    inputA1X.value = anchor1.position.x.toFixed(2);
    inputA1Y.value = anchor1.position.y.toFixed(2);
    inputA1Z.value = anchor1.position.z.toFixed(2);

    inputA2X.value = anchor2.position.x.toFixed(2);
    inputA2Y.value = anchor2.position.y.toFixed(2);
    inputA2Z.value = anchor2.position.z.toFixed(2);

    inputPX.value = attachmentPoint.position.x.toFixed(2);
    inputPY.value = attachmentPoint.position.y.toFixed(2);
    inputPZ.value = attachmentPoint.position.z.toFixed(2);

    // Aktualisiere Liniengeometrie
    line1Geometry.setFromPoints([anchor1.position, attachmentPoint.position]);
    line2Geometry.setFromPoints([anchor2.position, attachmentPoint.position]);

    // Vektoren
    const vec1 = new THREE.Vector3().subVectors(attachmentPoint.position, anchor1.position);
    const vec2 = new THREE.Vector3().subVectors(attachmentPoint.position, anchor2.position);

    // Längen
    const length1 = vec1.length();
    const length2 = vec2.length();
    lenA1P.textContent = length1.toFixed(2);
    lenA2P.textContent = length2.toFixed(2);

    // Neigungswinkel (Vertikal - Z-Achse ist 'up' in Three.js)
    const upVector = new THREE.Vector3(0, 0, 1); // Z-Achse ist vertikal
    const angleRad1 = vec1.angleTo(upVector); // Winkel zwischen dem Vektor und der Z-Achse
    const angleDeg1 = THREE.MathUtils.radToDeg(angleRad1);
    angleA1Vert.textContent = (90 - angleDeg1).toFixed(2); // Neigung zur Horizontalen

    const angleRad2 = vec2.angleTo(upVector);
    const angleDeg2 = THREE.MathUtils.radToDeg(angleRad2);
    angleA2Vert.textContent = (90 - angleDeg2).toFixed(2); // Neigung zur Horizontalen

    // Öffnungswinkel zwischen den Traversen
    const dotProduct = vec1.dot(vec2);
    const magnitudeProduct = vec1.length() * vec2.length();
    let openingAngleRad = Math.acos(dotProduct / magnitudeProduct);
    if (isNaN(openingAngleRad)) { // Handle potential floating point errors for acos domain
        openingAngleRad = 0;
    }
    const openingAngleDeg = THREE.MathUtils.radToDeg(openingAngleRad);
    angleOpen.textContent = openingAngleDeg.toFixed(2);
}

// Initialberechnung beim Laden
updateCalculations();

// --- Animations-Loop ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// --- Responsives Design ---
window.addEventListener('resize', () => {
    camera.aspect = (window.innerWidth - infoPanelWidth) / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth - infoPanelWidth, window.innerHeight);
});