import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DragControls } from 'three/addons/controls/DragControls.js';

// --- Konstanten ---
const GRAVITY = 9.81; // Erdbeschleunigung m/s^2
const TRAVERSE_MODEL_LENGTH = 3.0; // Feste Länge des Traversenmodells (z.B. 3 Meter)
const TRAVERSE_MODEL_HEIGHT = 0.29; // Typische F34-Masse: 29cm x 29cm
const TRAVERSE_MODEL_WIDTH = 0.29;  // Typische F34-Masse: 29cm x 29cm
const TRAVERSE_WEIGHT_PER_METER = 10; // kg/m - Beispielgewicht für Traverse
const LOAD_POINT_OFFSET_Y = -0.5; // Wie weit der Lastpunkt unter der Traverse hängt (in Weltkoordinaten)

// Lokale Offsets für die Positionen der 4 Chords (Hauptstreben) relativ zum Traversen-Mittelpunkt (0,0,0)
const CHORD_OFFSETS = [
    { y: TRAVERSE_MODEL_HEIGHT / 2, z: TRAVERSE_MODEL_WIDTH / 2, name: "Oben Vorne" },
    { y: TRAVERSE_MODEL_HEIGHT / 2, z: -TRAVERSE_MODEL_WIDTH / 2, name: "Oben Hinten" },
    { y: -TRAVERSE_MODEL_HEIGHT / 2, z: TRAVERSE_MODEL_WIDTH / 2, name: "Unten Vorne" },
    { y: -TRAVERSE_MODEL_HEIGHT / 2, z: -TRAVERSE_MODEL_WIDTH / 2, name: "Unten Hinten" }
];

// --- Szene-Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const threeContainer = document.getElementById('three-container'); // Ref auf das Div für Three.js

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0); // Transparenter Hintergrund
renderer.setSize(threeContainer.clientWidth, threeContainer.clientHeight);
threeContainer.appendChild(renderer.domElement);

camera.position.set(0, 3, 7);
camera.lookAt(0, 1, 0);

// --- Beleuchtung ---
const ambientLight = new THREE.AmbientLight(0x606060);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
directionalLight.position.set(2, 5, 3);
scene.add(directionalLight);

// --- Gitter und Achsenhelfer ---
const gridHelper = new THREE.GridHelper(10, 10);
gridHelper.material.opacity = 0.25;
gridHelper.material.transparent = true;
scene.add(gridHelper);
const axesHelper = new THREE.AxesHelper(3);
scene.add(axesHelper);

// --- Materialien ---
const ceilingAnchorMaterial = new THREE.MeshPhongMaterial({ color: 0x0000ff }); // Blau
const traverseAttachPointMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 }); // Rot
const loadPointMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 }); // Grün
const lineMaterialMain = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 }); // Für die Hauptseile (Decke zu Traverse)
const lineMaterialLoad = new THREE.LineBasicMaterial({ color: 0xffa500, linewidth: 2 }); // Für die Lastseile (Traverse zu Lastpunkt)

// --- Punkte und Linienverwaltung ---
let ceilingAnchors = []; // Array für Deckenanker
let traverseAttachPoints = []; // Array für Anschlagpunkte an der Traverse
let loadPoints = []; // Array für Lastpunkte


// 3D-Modell der Traverse
let traverseModel;
function createTraverseModel(length, height, width) {
    const group = new THREE.Group();
    const chordRadius = 0.025; // 5cm Durchmesser für Chords (Hauptstreben)
    const spindleRadius = 0.01;  // 2cm Durchmesser für Spindeln (Verstrebungen)
    const chordMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 }); // Dunkleres Grau für Chords
    const spindleMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 }); // Helleres Grau für Spindeln

    const numSegments = Math.max(1, Math.floor(length / 0.5)); // Alle 0.5m ein Segment für Verstrebungen
    const segmentSpan = length / numSegments;

    // 1. Hauptstreben (Chords)
    const chordGeometry = new THREE.CylinderGeometry(chordRadius, chordRadius, length, 8);
    chordGeometry.rotateZ(Math.PI / 2); // Entlang der X-Achse ausrichten

    // Positionen der 4 Chords
    CHORD_OFFSETS.forEach(offset => {
        let chord = new THREE.Mesh(chordGeometry, chordMaterial);
        chord.position.set(0, offset.y, offset.z); // Position relativ zum Gruppenmittelpunkt
        group.add(chord);
    });

    // 2. Horizontale und Diagonale Verstrebungen (Spindeln)
    for (let i = 0; i <= numSegments; i++) {
        const xPos = -length / 2 + i * segmentSpan;
        const midXPos = -length / 2 + (i * segmentSpan) + segmentSpan / 2;

        // Vertikale Verbindungen an den Enden der Segmente (wenn i==0 oder i==numSegments)
        if (i === 0 || i === numSegments) {
            const verticalBarGeom = new THREE.CylinderGeometry(spindleRadius, spindleRadius, height, 8);
            verticalBarGeom.rotateX(Math.PI / 2); // Entlang Y-Achse
            const horizontalDepthBarGeom = new THREE.CylinderGeometry(spindleRadius, spindleRadius, width, 8);
            horizontalDepthBarGeom.rotateY(Math.PI / 2); // Entlang Z-Achse

            // Vertikale Verbindungen zwischen oberen und unteren Chords (vorne/hinten)
            let bar = new THREE.Mesh(verticalBarGeom, spindleMaterial);
            bar.position.set(xPos, 0, width / 2); group.add(bar);
            bar = new THREE.Mesh(verticalBarGeom, spindleMaterial);
            bar.position.set(xPos, 0, -width / 2); group.add(bar);

            // Horizontale Verbindungen zwischen vorne/hinten Chords (oben/unten)
            bar = new THREE.Mesh(horizontalDepthBarGeom, spindleMaterial);
            bar.position.set(xPos, height / 2, 0); group.add(bar);
            bar = new THREE.Mesh(horizontalDepthBarGeom, spindleMaterial);
            bar.position.set(xPos, -height / 2, 0); group.add(bar);
        }

        if (i < numSegments) { // Horizontale und diagonale Verstrebungen innerhalb der Segmente
            // Horizontale Verbindungen zwischen Chords (oben/unten, vorne/hinten)
            const horizontalBarGeom = new THREE.CylinderGeometry(spindleRadius, spindleRadius, segmentSpan, 8);
            horizontalBarGeom.rotateZ(Math.PI / 2); // Entlang X-Achse
            
            let bar;
            bar = new THREE.Mesh(horizontalBarGeom, spindleMaterial);
            bar.position.set(midXPos, height / 2, width / 2); group.add(bar);
            bar = new THREE.Mesh(horizontalBarGeom, spindleMaterial);
            bar.position.set(midXPos, height / 2, -width / 2); group.add(bar);
            bar = new THREE.Mesh(horizontalBarGeom, spindleMaterial);
            bar.position.set(midXPos, -height / 2, width / 2); group.add(bar);
            bar = new THREE.Mesh(horizontalBarGeom, spindleMaterial);
            bar.position.set(midXPos, -height / 2, -width / 2); group.add(bar);

            // Diagonale Verstrebungen (Spindeln)
            const diagonalLength = Math.sqrt(segmentSpan * segmentSpan + height * height);
            const diagonalAngle = Math.atan2(height, segmentSpan);
            const diagonalSpindleGeom = new THREE.CylinderGeometry(spindleRadius, spindleRadius, diagonalLength, 8);

            // Vorderseite: Oben links nach Unten rechts
            bar = new THREE.Mesh(diagonalSpindleGeom, spindleMaterial);
            bar.position.set(midXPos, 0, width / 2);
            bar.rotation.z = -diagonalAngle; group.add(bar);

            // Vorderseite: Oben rechts nach Unten links
            bar = new THREE.Mesh(diagonalSpindleGeom, spindleMaterial);
            bar.position.set(midXPos, 0, width / 2);
            bar.rotation.z = diagonalAngle; group.add(bar);

            // Rückseite (analog)
            bar = new THREE.Mesh(diagonalSpindleGeom, spindleMaterial);
            bar.position.set(midXPos, 0, -width / 2);
            bar.rotation.z = -diagonalAngle; group.add(bar);

            bar = new THREE.Mesh(diagonalSpindleGeom, spindleMaterial);
            bar.position.set(midXPos, 0, -width / 2);
            bar.rotation.z = diagonalAngle; group.add(bar);
        }
    }

    return group;
}

traverseModel = createTraverseModel(TRAVERSE_MODEL_LENGTH, TRAVERSE_MODEL_HEIGHT, TRAVERSE_MODEL_WIDTH);
traverseModel.position.set(0, 2, 0); // Feste Position der Traverse im Raum
scene.add(traverseModel);

// Hilfsfunktion: Fügt einen Punkt zur Szene hinzu und macht ihn dragbar
// initialXPos: Welt-X für CeilingAnchor und TraverseAttachPoint. X-Offset relativ zur Traverse für LoadPoint.
// initialChordIndex: Für TAP, welcher der 4 Chords (0-3)
// connectedCaUuid: Für TAP, UUID des Deckenankers, mit dem er verbunden ist (Optional)
function addPoint(type, initialXPos = 0, initialChordIndex = 0, connectedCaUuid = null) { 
    let mesh;
    let line = null;
    let idCounter = 0; 

    if (type === 'ceilingAnchor') {
        idCounter = ceilingAnchors.length + 1;
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15), ceilingAnchorMaterial);
        mesh.userData.type = 'ceilingAnchor';
        mesh.userData.name = `Deckenanker ${idCounter}`;
        mesh.position.set(initialXPos, 4, 0); // initialXPos ist Welt-X für CA
        ceilingAnchors.push(mesh);
    } else if (type === 'traverseAttachPoint') {
        idCounter = traverseAttachPoints.length + 1;
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1), traverseAttachPointMaterial);
        mesh.userData.type = 'traverseAttachPoint';
        mesh.userData.name = `Aufhängepunkt ${idCounter}`;
        line = new THREE.Line(new THREE.BufferGeometry(), lineMaterialMain); // Hauptseil
        mesh.userData.line = line;
        
        mesh.userData.chordIndex = initialChordIndex % CHORD_OFFSETS.length; // Sicherstellen, dass Index gültig ist
        mesh.userData.connectedCeilingAnchorUuid = connectedCaUuid; // Speichere die UUID des verbundenen CA

        // Die initiale X-Position des TAPs wird direkt als Welt-X gesetzt,
        // um die vertikale Ausrichtung zum Deckenanker zu gewährleisten.
        mesh.position.x = initialXPos; 
        mesh.position.y = traverseModel.position.y + CHORD_OFFSETS[mesh.userData.chordIndex].y;
        mesh.position.z = traverseModel.position.z + CHORD_OFFSETS[mesh.userData.chordIndex].z;

        scene.add(line);
        traverseAttachPoints.push(mesh);
    } else if (type === 'loadPoint') {
        idCounter = loadPoints.length + 1;
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15), loadPointMaterial);
        mesh.userData.type = 'loadPoint';
        mesh.userData.name = `Lastpunkt ${idCounter}`;
        line = new THREE.Line(new THREE.BufferGeometry(), lineMaterialLoad); // Lastseil
        mesh.userData.line = line;

        // Lastpunkt's X ist ein Offset relativ zum Traversen-Zentrum
        mesh.position.x = traverseModel.position.x + initialXPos; // initialXPos ist relativer Offset für LP
        mesh.position.y = traverseModel.position.y + LOAD_POINT_OFFSET_Y;
        mesh.position.z = traverseModel.position.z; // Z-Position auf Mitte der Traverse

        scene.add(line);
        loadPoints.push(mesh);
    }
    
    scene.add(mesh);
    updateDraggableObjects(); // DragControls aktualisieren
    updateCalculations(); // Berechnungen und UI-Listen aktualisieren
    return mesh;
}

// Hilfsfunktion: Entfernt einen Punkt (nur den letzten des Typs)
function removePoint(type) {
    let array;
    if (type === 'ceilingAnchor') array = ceilingAnchors;
    else if (type === 'traverseAttachPoint') array = traverseAttachPoints;
    else if (type === 'loadPoint') array = loadPoints;

    if (array && array.length > 0) {
        const lastPoint = array[array.length - 1]; // Letzten Punkt nehmen
        deletePointByUuid(lastPoint.uuid); // Und dann per UUID löschen, um Ressourcen freizugeben
    }
}

// NEUE Hilfsfunktion: Entfernt einen spezifischen Punkt nach UUID
function deletePointByUuid(uuidToDelete) {
    // Funktionen zum Finden und Entfernen aus jedem Array
    const findAndRemove = (arr) => {
        const index = arr.findIndex(p => p.uuid === uuidToDelete);
        if (index !== -1) {
            const point = arr[index];
            scene.remove(point);
            if (point.userData.line) {
                point.userData.line.geometry.dispose(); // Geometrie freigeben
                point.userData.line.material.dispose(); // Material freigeben
                scene.remove(point.userData.line);
            }
            point.geometry.dispose(); // Geometrie des Mesh freigeben
            point.material.dispose(); // Material des Mesh freigeben
            arr.splice(index, 1); // Entferne das Element aus dem Array
            return true;
        }
        return false;
    };

    if (findAndRemove(ceilingAnchors) ||
        findAndRemove(traverseAttachPoints) ||
        findAndRemove(loadPoints)) {
        updateDraggableObjects();
        updateCalculations();
    }
}


// --- Steuerung (Kamera und Drag) ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);

let dragControls; // Declare here

// Initialisiere dragControls sofort nach controls setup
updateDraggableObjects(); // Rufe es einmal initial auf, um dragControls einzurichten

function updateDraggableObjects() {
    const newDraggableObjects = [...ceilingAnchors, ...traverseAttachPoints, ...loadPoints];
    if (dragControls) { // Jetzt existiert dragControls, also ist dispose sicher
        dragControls.dispose(); // Alte Instanz entsorgen
    }
    dragControls = new DragControls(newDraggableObjects, camera, renderer.domElement);

    dragControls.addEventListener('dragstart', (event) => {
        controls.enabled = false;
    });
    dragControls.addEventListener('drag', (event) => {
        const draggedObject = event.object;

        if (draggedObject.userData.type === 'traverseAttachPoint') {
            // Nur die X-Koordinate des TAPs ist frei verschiebbar entlang der Traverse
            let newXWorld = draggedObject.position.x;
            // Begrenze X auf die Länge der Traverse (in Weltkoordinaten, relativ zur Traversenmitte)
            newXWorld = Math.max(traverseModel.position.x - TRAVERSE_MODEL_LENGTH / 2, 
                                 Math.min(traverseModel.position.x + TRAVERSE_MODEL_LENGTH / 2, newXWorld));
            
            draggedObject.position.x = newXWorld;
            // Y und Z sind durch den ausgewählten Chord fest definiert
            draggedObject.position.y = traverseModel.position.y + CHORD_OFFSETS[draggedObject.userData.chordIndex].y;
            draggedObject.position.z = traverseModel.position.z + CHORD_OFFSETS[draggedObject.userData.chordIndex].z;

        } else if (draggedObject.userData.type === 'loadPoint') {
            // Nur die X-Koordinate des LoadPoints ist frei verschiebbar entlang der Traverse
            let newXWorld = draggedObject.position.x;
            // Begrenze X auf die Länge der Traverse (in Weltkoordinaten, relativ zur Traversenmitte)
            newXWorld = Math.max(traverseModel.position.x - TRAVERSE_MODEL_LENGTH / 2, 
                                 Math.min(traverseModel.position.x + TRAVERSE_MODEL_LENGTH / 2, newXWorld));
            
            draggedObject.position.x = newXWorld;
            // Y und Z sind fest definiert (Mitte der Traverse + Offset)
            draggedObject.position.y = traverseModel.position.y + LOAD_POINT_OFFSET_Y;
            draggedObject.position.z = traverseModel.position.z; // Z-Position auf Mitte der Traverse
            

        } else if (draggedObject.userData.type === 'ceilingAnchor') {
            // Deckenanker können sich frei bewegen
            // Ihre Position ist bereits die Weltposition
        }
        updateCalculations(); // Berechnungen und UI-Listen aktualisieren
    });
    dragControls.addEventListener('dragend', () => { controls.enabled = true; });
}


// --- UI-Elemente (müssen vor den ersten Funktionsaufrufen stehen, die sie nutzen!) ---
const addCeilingAnchorButton = document.getElementById('add-ceiling-anchor');
const removeCeilingAnchorButton = document.getElementById('remove-ceiling-anchor');
const addTraverseAttachPointButton = document.getElementById('add-traverse-attach-point');
const removeTraverseAttachPointButton = document.getElementById('remove-traverse-attach-point');
const addLoadPointButton = document.getElementById('add-load-point');
const removeLoadPointButton = document.getElementById('remove-load-point');

const loadMassInput = document.getElementById('load-mass');
const totalTraverseLoadEl = document.getElementById('total-traverse-load'); // Gesamte vertikale Last auf Traverse
const forcesOutputDiv = document.getElementById('forces-output'); // Für dynamische Kraftausgabe

const resetButton = document.getElementById('reset-button');

// Sidebar UI-Elemente
const sidebar = document.getElementById('right-sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle');
const ceilingAnchorsListDiv = document.getElementById('ceiling-anchors-list');
const traverseAttachPointsListDiv = document.getElementById('traverse-attach-points-list');
const loadPointsListDiv = document.getElementById('load-points-list');


// --- Initialisiere mit einigen Standardpunkten ---
// Diese Aufrufe müssen NACH der Initialisierung von dragControls und den UI-Elementen erfolgen.
// Feste Initialpunkte:
let initialCA1 = addPoint('ceilingAnchor', traverseModel.position.x - 1); // CA1 Welt-X
let initialCA2 = addPoint('ceilingAnchor', traverseModel.position.x + 1); // CA2 Welt-X

// TAPs für CA1:
// Jetzt wird die Welt-X-Position des CA übergeben, um die vertikale Ausrichtung zu gewährleisten
addPoint('traverseAttachPoint', initialCA1.position.x, 0, initialCA1.uuid); // TAP1 (Oben Vorne, X ausgerichtet an CA1)
addPoint('traverseAttachPoint', initialCA1.position.x, 1, initialCA1.uuid); // TAP2 (Oben Hinten, X ausgerichtet an CA1)

// TAPs für CA2:
addPoint('traverseAttachPoint', initialCA2.position.x, 0, initialCA2.uuid);  // TAP3 (Oben Vorne, X ausgerichtet an CA2)
addPoint('traverseAttachPoint', initialCA2.position.x, 1, initialCA2.uuid);  // TAP4 (Oben Hinten, X ausgerichtet an CA2)

addPoint('loadPoint', 0); // Zentraler Lastpunkt (X-Offset 0)


// --- UI-Events ---
addCeilingAnchorButton.addEventListener('click', () => addPoint('ceilingAnchor', traverseModel.position.x)); 
removeCeilingAnchorButton.addEventListener('click', () => removePoint('ceilingAnchor'));
addTraverseAttachPointButton.addEventListener('click', () => {
    // Wenn ein neuer TAP hinzugefügt wird, standardmässig den ersten Deckenanker zuweisen
    // und dessen X-Position für die initiale TAP-Position verwenden.
    let defaultCaUuid = null;
    let initialXForNewTAP = traverseModel.position.x; // Fallback, wenn keine CAs vorhanden

    if (ceilingAnchors.length > 0) {
        defaultCaUuid = ceilingAnchors[0].uuid;
        initialXForNewTAP = ceilingAnchors[0].position.x; // X-Position des ersten CA
    }
    // initialXForNewTAP ist jetzt eine Welt-X-Koordinate
    addPoint('traverseAttachPoint', initialXForNewTAP, 0, defaultCaUuid); // Chord 0 ist Standard
}); 
removeTraverseAttachPointButton.addEventListener('click', () => removePoint('traverseAttachPoint'));
addLoadPointButton.addEventListener('click', () => addPoint('loadPoint', 0)); 
removeLoadPointButton.addEventListener('click', () => removePoint('loadPoint'));

loadMassInput.addEventListener('input', updateCalculations);

resetButton.addEventListener('click', () => {
    // Alle Punkte entfernen
    [...ceilingAnchors].forEach(p => deletePointByUuid(p.uuid));
    [...traverseAttachPoints].forEach(p => deletePointByUuid(p.uuid));
    [...loadPoints].forEach(p => deletePointByUuid(p.uuid));

    // Initialpunkte wieder hinzufügen, angepasst an die neue Logik
    const newInitialCA1 = addPoint('ceilingAnchor', traverseModel.position.x - 1);
    const newInitialCA2 = addPoint('ceilingAnchor', traverseModel.position.x + 1);
    
    addPoint('traverseAttachPoint', newInitialCA1.position.x, 0, newInitialCA1.uuid); 
    addPoint('traverseAttachPoint', newInitialCA1.position.x, 1, newInitialCA1.uuid); 
    addPoint('traverseAttachPoint', newInitialCA2.position.x, 0, newInitialCA2.uuid);  
    addPoint('traverseAttachPoint', newInitialCA2.position.x, 1, newInitialCA2.uuid);  
    addPoint('loadPoint', 0); // 0 ist Offset für Lastpunkt

    updateCalculations();
});

// Sidebar Toggle Event
sidebarToggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('sidebar-open');
});


// --- Berechnungs-Hauptfunktion ---
function updateCalculations() {
    // Traverse-Modell ist jetzt fest positioniert und rotiert nicht (wird einmal gesetzt in der Initialisierung)
    // -> Keine Anpassungen der traverseModel.position oder rotation hier

    // Seile zwischen TAPs und CAs basierend auf userData.connectedCeilingAnchorUuid verbinden
    let connectedRopesCount = 0; // Zähler für tatsächlich verbundene Seile

    traverseAttachPoints.forEach(tap => {
        let connectedCa = null;
        if (tap.userData.connectedCeilingAnchorUuid) {
            // Finde den Deckenanker anhand der UUID
            connectedCa = ceilingAnchors.find(ca => ca.uuid === tap.userData.connectedCeilingAnchorUuid);
        }
        
        tap.userData.connectedCeilingAnchor = connectedCa; // Speichern der Referenz zum Objekt

        if (connectedCa) {
            tap.userData.line.geometry.setFromPoints([connectedCa.position, tap.position]);
            connectedRopesCount++;
        } else {
            // Wenn kein verbundener CA gefunden wurde, Linie auf Null setzen und Farbe grau
            tap.userData.line.geometry.setFromPoints([tap.position, tap.position]); 
            tap.userData.line.material.color.setHex(0x888888); // Grau für unverbundene Seile
        }
    });

    // Lastpunkt-Linien aktualisieren
    loadPoints.forEach(lp => {
        // Die Linie soll vom Lastpunkt zum Punkt auf der Traverse direkt über ihm gehen
        const lpConnectionPointOnTraverse = lp.position.clone();
        lpConnectionPointOnTraverse.y -= LOAD_POINT_OFFSET_Y; // Entferne den Offset, um auf die Traversenebene zu kommen
        lp.userData.line.geometry.setFromPoints([lp.position, lpConnectionPointOnTraverse]);
    });

    calculateAndDisplayForces(connectedRopesCount); // Anzahl der tatsächlich verbundenen Seile übergeben
    updateUIListings(); // Punkte in der Sidebar aktualisieren
    // updateVisualFeedback(); wird von calculateAndDisplayForces aufgerufen
}

// --- Update UI Listings Funktion (NEU) ---
function updateUIListings() {
    // Leere alle Listen vor dem Neuzeichnen
    ceilingAnchorsListDiv.innerHTML = '';
    traverseAttachPointsListDiv.innerHTML = '';
    loadPointsListDiv.innerHTML = '';

    // Hilfsfunktion zum Erstellen eines Punkt-Eingabeelements
    function createPointItem(point, listDiv) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'point-item';
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'point-item-header';

        const pointName = document.createElement('div');
        pointName.className = 'point-name';
        pointName.textContent = point.userData.name;
        headerDiv.appendChild(pointName);

        // Löschen-Button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.textContent = '✖'; 
        deleteButton.title = `Lösche ${point.userData.name}`;
        deleteButton.addEventListener('click', () => {
            deletePointByUuid(point.uuid); 
        });
        headerDiv.appendChild(deleteButton);

        itemDiv.appendChild(headerDiv);


        const coordsDiv = document.createElement('div');
        coordsDiv.className = 'coordinates-inputs';

        // Für jeden Punkt: X, Y, Z Koordinaten-Inputs
        ['x', 'y', 'z'].forEach(axis => {
            const wrapperDiv = document.createElement('div'); // Wrapper für Label und Input
            const label = document.createElement('label');
            label.textContent = `${axis.toUpperCase()}:`;
            
            const input = document.createElement('input');
            input.type = 'number';
            input.step = '0.01'; // Feinere Steuerung der Positionen
            input.value = point.position[axis].toFixed(2); // Zeigt Weltkoordinaten
            input.dataset.axis = axis; // Speichern der Achse im Dataset
            input.dataset.pointUuid = point.uuid; // Speichern der UUID des 3D-Punkts

            // Setze Y und Z für TAPs und LPs als readonly, da sie durch die Traverse/Chords bestimmt werden
            if (point.userData.type === 'traverseAttachPoint' || point.userData.type === 'loadPoint') {
                if (axis === 'y' || axis === 'z') {
                    input.readOnly = true;
                    input.classList.add('readonly-input');
                }
            }

            input.addEventListener('input', (event) => {
                const targetAxis = event.target.dataset.axis;
                const newVal = parseFloat(event.target.value);
                
                let targetPoint = null;
                const allPoints = [...ceilingAnchors, ...traverseAttachPoints, ...loadPoints];
                for(const p of allPoints) {
                    if (p.uuid === event.target.dataset.pointUuid) {
                        targetPoint = p;
                        break;
                    }
                }

                if (targetPoint && !isNaN(newVal)) {
                    if (targetPoint.userData.type === 'traverseAttachPoint' || targetPoint.userData.type === 'loadPoint') {
                        // Für Punkte auf der Traverse: Nur X-Position ändern
                        if (targetAxis === 'x') {
                            // newVal ist die absolute X-Weltkoordinate aus dem Input
                            // Begrenze auf Traversenlänge (Weltkoordinaten)
                            let newXWorld = newVal; 
                            newXWorld = Math.max(traverseModel.position.x - TRAVERSE_MODEL_LENGTH / 2, 
                                                 Math.min(traverseModel.position.x + TRAVERSE_MODEL_LENGTH / 2, newXWorld));
                            targetPoint.position.x = newXWorld;
                        }
                        // Y und Z werden durch Drag/Chord-Auswahl gesetzt, nicht durch direkte Eingabe
                    } else { // CeilingAnchor
                        targetPoint.position[targetAxis] = newVal;
                    }
                    updateCalculations(); 
                }
            });
            wrapperDiv.appendChild(label);
            wrapperDiv.appendChild(input);
            coordsDiv.appendChild(wrapperDiv);
        });

        // Dropdown für Chord-Auswahl nur für TraverseAttachPoints
        if (point.userData.type === 'traverseAttachPoint') {
            const chordSelectDiv = document.createElement('div');
            chordSelectDiv.className = 'chord-select-group'; 
            const chordLabel = document.createElement('label');
            chordLabel.textContent = 'Chord:';
            chordSelectDiv.appendChild(chordLabel);

            const chordSelect = document.createElement('select');
            chordSelect.className = 'chord-select';
            CHORD_OFFSETS.forEach((offset, idx) => {
                const option = document.createElement('option');
                option.value = idx;
                option.textContent = offset.name;
                chordSelect.appendChild(option);
            });
            chordSelect.value = point.userData.chordIndex; // Aktuellen Chord auswählen
            chordSelect.dataset.pointUuid = point.uuid; // UUID zum Zuordnen

            chordSelect.addEventListener('change', (event) => {
                const targetPointUuid = event.target.dataset.pointUuid;
                let targetPoint = null;
                for(const p of traverseAttachPoints) {
                    if (p.uuid === targetPointUuid) {
                        targetPoint = p;
                        break;
                    }
                }

                if (targetPoint) {
                    const newChordIndex = parseInt(event.target.value);
                    targetPoint.userData.chordIndex = newChordIndex;
                    // Position des TAP basierend auf neuem Chord-Index aktualisieren
                    // X-Koordinate bleibt wie sie ist (Weltkoordinate)
                    targetPoint.position.y = traverseModel.position.y + CHORD_OFFSETS[newChordIndex].y;
                    targetPoint.position.z = traverseModel.position.z + CHORD_OFFSETS[newChordIndex].z;
                    updateCalculations();
                }
            });
            chordSelectDiv.appendChild(chordSelect);
            coordsDiv.appendChild(chordSelectDiv); 

            // Dropdown für Deckenanker-Auswahl
            const caSelectDiv = document.createElement('div');
            caSelectDiv.className = 'ca-select-group';
            const caLabel = document.createElement('label');
            caLabel.textContent = 'Deckenanker:';
            caSelectDiv.appendChild(caLabel);

            const caSelect = document.createElement('select');
            caSelect.className = 'ca-select';
            
            // Füge eine "Nicht verbunden" Option hinzu
            const noCaOption = document.createElement('option');
            noCaOption.value = ''; // Leerer Wert für nicht verbunden
            noCaOption.textContent = 'Nicht verbunden';
            caSelect.appendChild(noCaOption);

            // Füge alle vorhandenen Deckenanker als Optionen hinzu
            ceilingAnchors.forEach(ca => {
                const option = document.createElement('option');
                option.value = ca.uuid; // Wert ist die UUID des Deckenankers
                option.textContent = ca.userData.name;
                caSelect.appendChild(option);
            });
            // Wähle den aktuell verbundenen Deckenanker aus
            caSelect.value = point.userData.connectedCeilingAnchorUuid || ''; // Setze auf leeren String, wenn nicht verbunden
            caSelect.dataset.pointUuid = point.uuid; // UUID des TAP zum Zuordnen

            caSelect.addEventListener('change', (event) => {
                const targetPointUuid = event.target.dataset.pointUuid;
                let targetPoint = null;
                for(const p of traverseAttachPoints) {
                    if (p.uuid === targetPointUuid) {
                        targetPoint = p;
                        break;
                    }
                }

                if (targetPoint) {
                    targetPoint.userData.connectedCeilingAnchorUuid = event.target.value || null; // Speichere UUID oder null
                    updateCalculations(); // Alles neu berechnen und neu zeichnen
                }
            });
            caSelectDiv.appendChild(caSelect);
            coordsDiv.appendChild(caSelectDiv);
        }

        itemDiv.appendChild(coordsDiv);
        listDiv.appendChild(itemDiv);
    }

    ceilingAnchors.forEach(point => createPointItem(point, ceilingAnchorsListDiv));
    traverseAttachPoints.forEach(point => createPointItem(point, traverseAttachPointsListDiv));
    loadPoints.forEach(point => createPointItem(point, loadPointsListDiv));
}


function calculateAndDisplayForces(connectedRopesCount) { // Nimmt jetzt die Anzahl der tatsächlich verbundenen Seile entgegen
    const loadMass = parseFloat(loadMassInput.value) || 0;
    const traverseWeight = TRAVERSE_MODEL_LENGTH * TRAVERSE_WEIGHT_PER_METER;
    const totalVerticalForce = (loadMass + traverseWeight) * GRAVITY; // Gesamte Last (Newton)

    totalTraverseLoadEl.textContent = `${totalVerticalForce.toFixed(2)} N`;

    forcesOutputDiv.innerHTML = ''; // Vorherige Ergebnisse löschen

    // Finde die Anzahl der tatsächlich verbundenen Seile, die zur Lastaufnahme beitragen
    let effectiveConnectedRopesCount = 0;
    traverseAttachPoints.forEach(tap => {
        if (tap.userData.connectedCeilingAnchor) {
            effectiveConnectedRopesCount++;
        }
    });


    if (effectiveConnectedRopesCount === 0) { 
        forcesOutputDiv.innerHTML = '<p>Keine aktiven Seile zur Decke.</p>';
        // Setze alle TAP-Linien auf grau, falls vorhanden
        traverseAttachPoints.forEach(tap => {
            if(tap.userData.line) tap.userData.line.material.color.setHex(0x888888);
        });
        return;
    }

    // Vereinfachte Lastverteilung: Gesamtlast wird auf die vertikalen Anteile der Seile verteilt,
    // proportional zum Kosinus des Winkels zur Vertikalen.
    let sumOfCosines = 0;
    const verticalVector = new THREE.Vector3(0, 1, 0); // Vektor nach oben

    // Erste Iteration: Summe der Kosinusse aller verbundenen Seile berechnen
    // Nur TAPs, die auch wirklich mit einem CA verbunden sind, tragen bei
    traverseAttachPoints.forEach(tap => {
        const ceilingAnchor = tap.userData.connectedCeilingAnchor;
        if (ceilingAnchor) {
            const ropeVector = new THREE.Vector3().subVectors(ceilingAnchor.position, tap.position);
            const angleToVertical = Math.abs(ropeVector.angleTo(verticalVector));
            sumOfCosines += Math.cos(angleToVertical);
        }
    });

    if (sumOfCosines < 1e-6) {
        forcesOutputDiv.innerHTML = '<p>Unbestimmter Lastfall oder keine tragenden Seile (Winkel zu horizontal).</p>';
        traverseAttachPoints.forEach(tap => {
            if(tap.userData.line) tap.userData.line.material.color.setHex(0xff0000);
        });
        return;
    }

    // Zweite Iteration: Spannung für jedes Seil basierend auf seinem Anteil an der Summe der Kosinusse berechnen
    traverseAttachPoints.forEach((tap, i) => {
        const ceilingAnchor = tap.userData.connectedCeilingAnchor;
        if (!ceilingAnchor) {
             const p = document.createElement('p');
             p.innerHTML = `<strong>Seil ${i + 1} (${tap.userData.name} zu keinem Deckenanker verbunden):</strong> Keine Kraft berechenbar.`;
             forcesOutputDiv.appendChild(p);
             tap.userData.line.material.color.setHex(0x888888); // Grau für unverbundene Seile
             return;
        }

        const ropeVector = new THREE.Vector3().subVectors(ceilingAnchor.position, tap.position);
        const angleToVertical = Math.abs(ropeVector.angleTo(verticalVector)); 
        
        let tension = 0;
        const cosineAngle = Math.cos(angleToVertical);

        if (Math.abs(cosineAngle) > 1e-6) { 
            const verticalForceContributionOfThisRope = (cosineAngle / sumOfCosines) * totalVerticalForce;
            tension = verticalForceContributionOfThisRope / cosineAngle; 
        } else {
            tension = Infinity; 
        }

        const angleDeg = THREE.MathUtils.radToDeg(angleToVertical).toFixed(2);
        
        const p = document.createElement('p');
        p.innerHTML = `<strong>Seil ${i + 1} (${tap.userData.name} zu ${ceilingAnchor.userData.name}):</strong> Kraft: ${tension.toFixed(2)} N, Winkel zur Vertikalen: ${angleDeg} °`;
        forcesOutputDiv.appendChild(p);

        let color = 0x00ff00; // Grün
        if (angleDeg > 60) color = 0xff0000; // Rot
        else if (angleDeg > 45) color = 0xffff00; // Gelb
        tap.userData.line.material.color.setHex(color);
    });
}

function updateVisualFeedback() {
    // Die visuelle Farbgebung der Seile wird direkt in calculateAndDisplayForces() vorgenommen.
}

// --- Initialisierung und Animations-Loop ---
function onWindowResize() {
    const newWidth = threeContainer.clientWidth;
    const newHeight = threeContainer.clientHeight;
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
}
window.addEventListener('resize', onWindowResize);

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Ersten Aufruf und Start
onWindowResize(); 

addPoint('loadPoint', 0); // Zentraler Lastpunkt (X-Offset 0)


updateCalculations();
animate();