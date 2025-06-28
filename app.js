import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DragControls } from 'three/addons/controls/DragControls.js';

// --- Konstanten ---
const GRAVITY = 9.81; // Erdbeschleunigung m/s^2
const TRAVERSE_MODEL_LENGTH = 3.0; // Feste Länge des Traversenmodells (z.B. 3 Meter)
const TRAVERSE_MODEL_HEIGHT = 0.29; // Typische F34-Masse: 29cm
const TRAVERSE_MODEL_WIDTH = 0.29;  // Typische F34-Masse: 29cm
const TRAVERSE_WEIGHT_PER_METER = 10; // kg/m - Beispielgewicht für Traverse
const LOAD_POINT_OFFSET_Y = -0.5; // Wie weit der Lastpunkt unter der Traverse hängt (Y-Offset in Weltkoordinaten)
// ATTACH_POINT_VERTICAL_OFFSET und ATTACH_POINT_LATERAL_OFFSET bleiben gleich,
// da sie sich auf die halbe Höhe/Breite der Traverse beziehen und die Punkte
// direkt an den Chords (Hauptstreben) positionieren.
const ATTACH_POINT_VERTICAL_OFFSET = TRAVERSE_MODEL_HEIGHT / 2;
const ATTACH_POINT_LATERAL_OFFSET = TRAVERSE_MODEL_WIDTH / 2;

// --- Szene-Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const infoPanel = document.getElementById('info-panel');
const threeContainer = document.getElementById('three-container');

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

// Initialpositionen - diese sind jetzt nur Startwerte für die dynamischen Punkte
const initialPositions = {
    // Traverse Endpunkte - Diese definieren die Position und Ausrichtung des Modells
    traverseEndPoint1: new THREE.Vector3(-TRAVERSE_MODEL_LENGTH / 2, 2, 0),
    traverseEndPoint2: new THREE.Vector3(TRAVERSE_MODEL_LENGTH / 2, 2, 0),
};

// 3D-Modell der Traverse (Aktualisierte Funktion für F34-Optik)
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
    const chordPositions = [
        new THREE.Vector3(0, height / 2, width / 2),
        new THREE.Vector3(0, height / 2, -width / 2),
        new THREE.Vector3(0, -height / 2, width / 2),
        new THREE.Vector3(0, -height / 2, -width / 2)
    ];

    chordPositions.forEach(pos => {
        let chord = new THREE.Mesh(chordGeometry, chordMaterial);
        chord.position.copy(pos);
        group.add(chord);
    });

    // 2. Horizontale und Diagonale Verstrebungen (Spindeln)
    for (let i = 0; i <= numSegments; i++) {
        const xPos = -length / 2 + i * segmentSpan;
        const nextXPos = -length / 2 + (i + 1) * segmentSpan;
        const midXPos = xPos + segmentSpan / 2;

        // Vertikale Streben (an den Segmentenden, falls 4-Punkt mit vertikalen Beinen)
        // Hier in F34 meist durch Chords und Diagonale gelöst, aber zur Vollständigkeit
        // kann man am Anfang und Ende kleine Vertikalen hinzufügen, die die Chords verbinden.
        if (i === 0 || i === numSegments) {
            // An den Enden vertikale Verbindungen
            const verticalBarGeom = new THREE.CylinderGeometry(spindleRadius, spindleRadius, height, 8);
            verticalBarGeom.rotateX(Math.PI / 2); // Entlang Y-Achse
            let bar;

            // Verbindungen zwischen oberen und unteren Chords (vorne/hinten)
            bar = new THREE.Mesh(verticalBarGeom, spindleMaterial);
            bar.position.set(xPos, 0, width / 2); group.add(bar);
            bar = new THREE.Mesh(verticalBarGeom, spindleMaterial);
            bar.position.set(xPos, 0, -width / 2); group.add(bar);

            // Verbindungen zwischen vorne/hinten Chords (oben/unten)
            const horizontalDepthBarGeom = new THREE.CylinderGeometry(spindleRadius, spindleRadius, width, 8);
            horizontalDepthBarGeom.rotateY(Math.PI / 2); // Entlang Z-Achse
            bar = new THREE.Mesh(horizontalDepthBarGeom, spindleMaterial);
            bar.position.set(xPos, height / 2, 0); group.add(bar);
            bar = new THREE.Mesh(horizontalDepthBarGeom, spindleMaterial);
            bar.position.set(xPos, -height / 2, 0); group.add(bar);
        }

        if (i < numSegments) { // Horizontale und diagonale Verstrebungen innerhalb der Segmente
            // Horizontal connections between chords at the segment ends
            const horizontalBarGeom = new THREE.CylinderGeometry(spindleRadius, spindleRadius, segmentSpan, 8);
            horizontalBarGeom.rotateZ(Math.PI / 2); // Entlang X-Achse
            let bar;

            // Obere und untere Verbindungen
            bar = new THREE.Mesh(horizontalBarGeom, spindleMaterial);
            bar.position.set(midXPos, height / 2, width / 2); group.add(bar);
            bar = new THREE.Mesh(horizontalBarGeom, spindleMaterial);
            bar.position.set(midXPos, height / 2, -width / 2); group.add(bar);
            bar = new THREE.Mesh(horizontalBarGeom, spindleMaterial);
            bar.position.set(midXPos, -height / 2, width / 2); group.add(bar);
            bar = new THREE.Mesh(horizontalBarGeom, spindleMaterial);
            bar.position.set(midXPos, -height / 2, -width / 2); group.add(bar);

            // Diagonal bracing (simplified for visual representation)
            // Connects corners diagonally
            const diagonalLength = Math.sqrt(segmentSpan * segmentSpan + height * height);
            const diagonalAngle = Math.atan2(height, segmentSpan);
            const diagonalSpindleGeom = new THREE.CylinderGeometry(spindleRadius, spindleRadius, diagonalLength, 8);

            // Diagonale in XY-Ebene (vorne und hinten)
            // Startet an xPos, endet an nextXPos
            // Vorderseite: von (xPos, -h/2, w/2) nach (nextXPos, h/2, w/2)
            bar = new THREE.Mesh(diagonalSpindleGeom, spindleMaterial);
            bar.position.set(xPos + segmentSpan / 2, 0, width / 2);
            bar.rotation.z = diagonalAngle; group.add(bar);

            // Vorderseite: von (xPos, h/2, w/2) nach (nextXPos, -h/2, w/2)
            bar = new THREE.Mesh(diagonalSpindleGeom, spindleMaterial);
            bar.position.set(xPos + segmentSpan / 2, 0, width / 2);
            bar.rotation.z = -diagonalAngle; group.add(bar);

            // Rückseite (gleiche Logik)
            bar = new THREE.Mesh(diagonalSpindleGeom, spindleMaterial);
            bar.position.set(xPos + segmentSpan / 2, 0, -width / 2);
            bar.rotation.z = diagonalAngle; group.add(bar);

            bar = new THREE.Mesh(diagonalSpindleGeom, spindleMaterial);
            bar.position.set(xPos + segmentSpan / 2, 0, -width / 2);
            bar.rotation.z = -diagonalAngle; group.add(bar);


            // Diagonalen in YZ-Ebene (zwischen Seitenflächen - dies ist der F34-Typ)
            // Von (xPos, h/2, w/2) zu (nextXPos, -h/2, -w/2)
            const diagonalCrossLength = Math.sqrt(segmentSpan * segmentSpan + height * height + width * width);
            const diagonalCrossAngleX = Math.atan2(Math.sqrt(height*height + width*width), segmentSpan);
            
            const crossSpindleGeom = new THREE.CylinderGeometry(spindleRadius, spindleRadius, diagonalCrossLength, 8);
            
            // From TLF to BRB
            let crossBar = new THREE.Mesh(crossSpindleGeom, spindleMaterial);
            crossBar.position.set(midXPos, 0, 0);
            crossBar.rotation.x = -Math.atan2(width, height); // Adjust for Z
            crossBar.rotation.y = Math.PI / 2; // Point along X
            crossBar.rotation.z = -Math.atan2(height, segmentSpan); // Adjust for Y
            // Complex to get right with simple rotation. Better define start/end points.
            // This is just a placeholder for the visual effect.

            // The exact F34 diagonal pattern is more complex to generate procedurally with simple primitives.
            // For a perfect representation, loading a pre-made 3D model would be ideal.
            // However, this setup gives the characteristic skeletal look.
        }
    }

    return group;
}

traverseModel = createTraverseModel(TRAVERSE_MODEL_LENGTH, TRAVERSE_MODEL_HEIGHT, TRAVERSE_MODEL_WIDTH);
scene.add(traverseModel);

// Hilfsfunktion: Fügt einen Punkt zur Szene hinzu und macht ihn dragbar
function addPoint(type, initialXLocalPos = 0) { // initialXLocalPos ist X-Koordinate relativ zur Traversenmitte
    let mesh;
    let line = null;
    let idCounter = 0; 

    // Die Positionierung muss in lokalen Koordinaten der Traverse erfolgen
    let localPos = new THREE.Vector3(initialXLocalPos, 0, 0); // Startet auf der X-Achse der Traverse

    if (type === 'ceilingAnchor') {
        idCounter = ceilingAnchors.length + 1;
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15), ceilingAnchorMaterial);
        mesh.userData.type = 'ceilingAnchor';
        mesh.userData.name = `Deckenanker ${idCounter}`;
        // Setze initial an einer sinnvollen Weltposition, X kommt aus Parameter
        mesh.position.set(initialXLocalPos, 4, 0); 
        ceilingAnchors.push(mesh);
    } else if (type === 'traverseAttachPoint') {
        idCounter = traverseAttachPoints.length + 1;
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1), traverseAttachPointMaterial);
        mesh.userData.type = 'traverseAttachPoint';
        mesh.userData.name = `Aufhängepunkt ${idCounter}`;
        line = new THREE.Line(new THREE.BufferGeometry(), lineMaterialMain); // Hauptseil
        mesh.userData.line = line;
        
        // Z-Position für den Aufhängepunkt an der Traverse festlegen (wechselseitig)
        mesh.userData.zSide = (traverseAttachPoints.length % 2 === 0) ? ATTACH_POINT_LATERAL_OFFSET : -ATTACH_POINT_LATERAL_OFFSET;
        // Y-Position des Aufhängepunktes ist auf der Oberseite der Traverse
        localPos.y = ATTACH_POINT_VERTICAL_OFFSET;
        localPos.z = mesh.userData.zSide; // Z-Offset in lokalen Koordinaten
        
        // Wandle die lokale Position in eine Weltposition um
        mesh.position.copy(localPos.applyMatrix4(traverseModel.matrixWorld));

        scene.add(line);
        traverseAttachPoints.push(mesh);
    } else if (type === 'loadPoint') {
        idCounter = loadPoints.length + 1;
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15), loadPointMaterial);
        mesh.userData.type = 'loadPoint';
        mesh.userData.name = `Lastpunkt ${idCounter}`;
        line = new THREE.Line(new THREE.BufferGeometry(), lineMaterialLoad); // Lastseil
        mesh.userData.line = line;

        // Y-Offset nach unten für den Lastpunkt
        localPos.y = 0; // Lastpunkt ist auf der Mittelebene der Traverse (lokal)
        localPos.z = 0; // Lastpunkt ist auf der Mittelebene der Traverse (lokal)
        // Wandle die lokale Position in eine Weltposition um
        mesh.position.copy(localPos.applyMatrix4(traverseModel.matrixWorld));
        mesh.position.y += LOAD_POINT_OFFSET_Y; // Zusätzlicher Y-Offset nach unten (Weltkoordinaten)

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
        const lastPoint = array.pop();
        scene.remove(lastPoint);
        if (lastPoint.userData.line) {
            lastPoint.userData.line.geometry.dispose(); // Geometrie freigeben
            lastPoint.userData.line.material.dispose(); // Material freigeben
            scene.remove(lastPoint.userData.line);
        }
        lastPoint.geometry.dispose(); // Geometrie des Mesh freigeben
        lastPoint.material.dispose(); // Material des Mesh freigeben
        updateDraggableObjects();
        updateCalculations(); // Berechnungen und UI-Listen aktualisieren
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
        // Speichere die inverse Transformationsmatrix der Traverse ZU BEGINN des Drags
        // Dies ist entscheidend, damit die Punkte auf der Traverse bleiben,
        // auch wenn sich die Traverse selbst (durch Bewegen von TAPs) dreht.
        if (event.object.userData.type === 'traverseAttachPoint' || event.object.userData.type === 'loadPoint') {
            // Speichere die lokale Position des Punktes auf der Traverse
            event.object.userData.initialLocalTraversePos = event.object.position.clone().applyMatrix4(traverseModel.matrixWorld.clone().invert());
        }
    });
    dragControls.addEventListener('drag', (event) => {
        if (event.object.userData.type === 'traverseAttachPoint' || event.object.userData.type === 'loadPoint') {
            // Die neue Position in Weltkoordinaten
            const newWorldPos = event.object.position.clone();
            
            // Konvertiere die neue Weltposition zurück in das lokale Koordinatensystem der Traverse
            // Verwende die INVERSE Matrix der Traverse ZUM ZEITPUNKT DES DRAGS
            const currentTraverseInverseMatrix = traverseModel.matrixWorld.clone().invert();
            const newLocalPos = newWorldPos.applyMatrix4(currentTraverseInverseMatrix);

            // Beschränke X auf die Länge der Traverse (im lokalen Koordinatensystem)
            newLocalPos.x = Math.max(-TRAVERSE_MODEL_LENGTH / 2, Math.min(TRAVERSE_MODEL_LENGTH / 2, newLocalPos.x));

            // Y und Z Positionen relativ zur Traverse beibehalten
            if (event.object.userData.type === 'traverseAttachPoint') {
                newLocalPos.y = ATTACH_POINT_VERTICAL_OFFSET;
                newLocalPos.z = event.object.userData.zSide; // Behält die Z-Seite bei
            } else if (event.object.userData.type === 'loadPoint') {
                newLocalPos.y = 0; // Lastpunkt ist auf der Mittelebene der Traverse (lokal)
                newLocalPos.z = 0; // Lastpunkt ist auf der Mittelebene der Traverse (lokal)
            }

            // Konvertiere die lokale, beschränkte Position zurück in Weltkoordinaten
            // Verwende die AKTUELLE Matrix der Traverse
            event.object.position.copy(newLocalPos.applyMatrix4(traverseModel.matrixWorld));

            // Füge den globalen Y-Offset für Lastpunkte hinzu
            if (event.object.userData.type === 'loadPoint') {
                event.object.position.y += LOAD_POINT_OFFSET_Y;
            }

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
// Füge Punkte an sinnvollen X-Positionen entlang der Traverse hinzu
addPoint('ceilingAnchor', 0); // Zentral
addPoint('ceilingAnchor', 2); // Rechts
addPoint('traverseAttachPoint', -TRAVERSE_MODEL_LENGTH / 4); // Links der Mitte
addPoint('traverseAttachPoint', TRAVERSE_MODEL_LENGTH / 4);  // Rechts der Mitte
addPoint('loadPoint', 0); // Zentral


// --- UI-Events ---
addCeilingAnchorButton.addEventListener('click', () => addPoint('ceilingAnchor', 0)); // Fügt an Default-Position hinzu
removeCeilingAnchorButton.addEventListener('click', () => removePoint('ceilingAnchor'));
addTraverseAttachPointButton.addEventListener('click', () => addPoint('traverseAttachPoint', 0)); // Fügt an Default-Position hinzu
removeTraverseAttachPointButton.addEventListener('click', () => removePoint('traverseAttachPoint'));
addLoadPointButton.addEventListener('click', () => addPoint('loadPoint', 0)); // Fügt an Default-Position hinzu
removeLoadPointButton.addEventListener('click', () => removePoint('loadPoint'));

loadMassInput.addEventListener('input', updateCalculations);

resetButton.addEventListener('click', () => {
    // Alle Punkte entfernen
    while (ceilingAnchors.length > 0) deletePointByUuid(ceilingAnchors[0].uuid);
    while (traverseAttachPoints.length > 0) deletePointByUuid(traverseAttachPoints[0].uuid);
    while (loadPoints.length > 0) deletePointByUuid(loadPoints[0].uuid);

    // Initialpunkte wieder hinzufügen
    addPoint('ceilingAnchor', 0);
    addPoint('ceilingAnchor', 2);
    addPoint('traverseAttachPoint', -TRAVERSE_MODEL_LENGTH / 4);
    addPoint('traverseAttachPoint', TRAVERSE_MODEL_LENGTH / 4);
    addPoint('loadPoint', 0);

    updateCalculations();
});

// Sidebar Toggle Event
sidebarToggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('sidebar-open');
});


// --- Berechnungs-Hauptfunktion ---
function updateCalculations() {
    // Traverse-Modell ausrichten
    // Der Mittelpunkt der Traverse wird als Referenzpunkt für die Positionierung des Modells verwendet.
    // Wenn es Aufhängepunkte gibt, nutze deren Mittelpunkt. Sonst default.
    let currentTraverseMid = new THREE.Vector3(0, initialPositions.traverseEndPoint1.y, 0); // Default, wenn keine TAPs
    if (traverseAttachPoints.length > 0) {
        currentTraverseMid.set(0,0,0);
        traverseAttachPoints.forEach(tap => currentTraverseMid.add(tap.position));
        currentTraverseMid.divideScalar(traverseAttachPoints.length);
    }
    traverseModel.position.copy(currentTraverseMid);
    
    // Ausrichtung der Traverse basierend auf den Aufhängepunkten
    if (traverseAttachPoints.length >= 2) {
        // Die Traverse soll entlang der Linie zwischen dem ersten und letzten Aufhängepunkt ausgerichtet werden
        const p1 = traverseAttachPoints[0].position;
        const pLast = traverseAttachPoints[traverseAttachPoints.length - 1].position;
        
        const traverseVec = new THREE.Vector3().subVectors(pLast, p1);
        const initialTraverseDirection = new THREE.Vector3(1, 0, 0); // Modell ist initial entlang der X-Achse ausgerichtet
        const currentTraverseDirection = traverseVec.clone().normalize();

        const angle = initialTraverseDirection.angleTo(currentTraverseDirection);
        const axis = new THREE.Vector3().crossVectors(initialTraverseDirection, currentTraverseDirection).normalize();
        
        if (axis.lengthSq() < 1e-6) { // Wenn Vektoren parallel oder entgegengesetzt sind (Achse ist null)
            if (currentTraverseDirection.x < 0) { // 180 Grad Drehung
                traverseModel.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI); // Um Y-Achse
            } else { // Keine Drehung (0 Grad)
                traverseModel.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0), 0);
            }
        } else {
            traverseModel.quaternion.setFromAxisAngle(axis, angle); 
        }

    } else {
        // Wenn weniger als 2 Anschlagpunkte, bleibt Traverse an initialer Position/Ausrichtung
        traverseModel.quaternion.set(0,0,0,1); // Keine Rotation
    }
    traverseModel.scale.x = 1; // Sicherstellen, dass Skalierung nicht verzerrt

    // Linien aktualisieren: Deckenanker zu Traversen-Aufhängepunkten
    traverseAttachPoints.forEach((tap) => {
        // Finden des nächstgelegenen Deckenankers für die Linie (statt index-basierter Kopplung)
        let closestCeilingAnchor = null;
        let minDist = Infinity;
        ceilingAnchors.forEach(ca => {
            const dist = tap.position.distanceTo(ca.position);
            if (dist < minDist) {
                minDist = dist;
                closestCeilingAnchor = ca;
            }
        });

        if (closestCeilingAnchor) {
            tap.userData.line.geometry.setFromPoints([closestCeilingAnchor.position, tap.position]);
            tap.userData.connectedCeilingAnchor = closestCeilingAnchor; // Speichern der Verbindung
        } else {
            tap.userData.line.geometry.setFromPoints([tap.position, tap.position]); // Linie auf Null setzen
            tap.userData.connectedCeilingAnchor = null;
        }
    });

    // Lastpunkt-Linien aktualisieren
    loadPoints.forEach(lp => {
        // Die Linie soll vom Lastpunkt zum Punkt auf der Traverse direkt über ihm gehen
        const lpConnectionPointOnTraverse = lp.position.clone().sub(new THREE.Vector3(0, LOAD_POINT_OFFSET_Y, 0));
        lp.userData.line.geometry.setFromPoints([lp.position, lpConnectionPointOnTraverse]);
    });

    calculateAndDisplayForces();
    updateUIListings(); // Punkte in der Sidebar aktualisieren
    updateVisualFeedback(); 
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

        // NEU: Löschen-Button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.textContent = '✖'; // Oder ein Icon, z.B. &#10006;
        deleteButton.title = `Lösche ${point.userData.name}`;
        deleteButton.addEventListener('click', () => {
            deletePointByUuid(point.uuid); // Verwende die UUID des 3D-Punkts zum Löschen
        });
        headerDiv.appendChild(deleteButton);

        itemDiv.appendChild(headerDiv);


        const coordsDiv = document.createElement('div');
        coordsDiv.className = 'coordinates-inputs';

        ['x', 'y', 'z'].forEach(axis => {
            const label = document.createElement('label');
            label.textContent = `${axis.toUpperCase()}:`;
            
            const input = document.createElement('input');
            input.type = 'number';
            input.step = '0.01'; // Feinere Steuerung der Positionen
            input.value = point.position[axis].toFixed(2);
            input.dataset.axis = axis; // Speichern der Achse im Dataset
            input.dataset.pointUuid = point.uuid; // Speichern der UUID des 3D-Punkts

            input.addEventListener('input', (event) => {
                const targetAxis = event.target.dataset.axis;
                const newVal = parseFloat(event.target.value);
                // Finde den richtigen 3D-Punkt anhand der UUID
                let targetPoint = null;
                // Durchlaufe alle Punkt-Arrays, um den Punkt zu finden
                const allPoints = [...ceilingAnchors, ...traverseAttachPoints, ...loadPoints];
                for(const p of allPoints) {
                    if (p.uuid === event.target.dataset.pointUuid) {
                        targetPoint = p;
                        break;
                    }
                }

                if (targetPoint && !isNaN(newVal)) {
                    // Spezielle Logik für traverseAttachPoint und loadPoint
                    if (targetPoint.userData.type === 'traverseAttachPoint' || targetPoint.userData.type === 'loadPoint') {
                        // Für Punkte auf der Traverse:
                        // Wir müssen die Eingabe in lokale Koordinaten der Traverse umwandeln,
                        // dann beschränken, dann zurück in Weltkoordinaten.
                        const currentWorldPos = targetPoint.position.clone();
                        // Temporär den Offset entfernen, um auf der Traverse zu arbeiten
                        if (targetPoint.userData.type === 'loadPoint') {
                            currentWorldPos.y -= LOAD_POINT_OFFSET_Y;
                        }

                        // Verwende die aktuelle inverse Matrix der Traverse
                        const currentTraverseInverseMatrix = traverseModel.matrixWorld.clone().invert();
                        const localPos = currentWorldPos.applyMatrix4(currentTraverseInverseMatrix);
                        
                        // Ändere die lokale Koordinate basierend auf Input
                        localPos[targetAxis] = newVal; 

                        // Beschränke X wieder auf die Traversenlänge
                        localPos.x = Math.max(-TRAVERSE_MODEL_LENGTH / 2, Math.min(TRAVERSE_MODEL_LENGTH / 2, localPos.x));
                        
                        // Y und Z sind relativ zur Traverse fixiert für diese Punkte
                        if (targetPoint.userData.type === 'traverseAttachPoint') {
                            // Wenn Y oder Z geändert werden soll, aber der Punkt an der Traverse gebunden ist,
                            // ignorieren wir die Eingabe für Y und Z, da sie durch die Traverse bestimmt werden.
                            // Ausnahme: wenn man die Z-Seite wechseln will, müsste man das hier erlauben.
                            // Für jetzt: Y und Z bleiben fest relativ zur Traverse.
                            localPos.y = ATTACH_POINT_VERTICAL_OFFSET;
                            localPos.z = targetPoint.userData.zSide; // Behält die Z-Seite bei
                        } else if (targetPoint.userData.type === 'loadPoint') {
                            localPos.y = 0; // Lastpunkt ist auf der Mittelebene der Traverse (lokal)
                            localPos.z = 0; // Lastpunkt ist auf der Mittelebene der Traverse (lokal)
                        }

                        // Konvertiere die lokale, beschränkte Position zurück in Weltkoordinaten
                        // Verwende die AKTUELLE Matrix der Traverse
                        targetPoint.position.copy(localPos.applyMatrix4(traverseModel.matrixWorld));

                        // Y-Offset wieder anwenden für Lastpunkte
                        if (targetPoint.userData.type === 'loadPoint') {
                            targetPoint.position.y += LOAD_POINT_OFFSET_Y;
                        }

                    } else {
                        // Für normale (Decken-)Ankerpunkte: direkt die Weltkoordinaten setzen
                        targetPoint.position[targetAxis] = newVal;
                    }
                    updateCalculations(); // Alles neu berechnen und neu zeichnen
                }
            });

            coordsDiv.appendChild(label);
            coordsDiv.appendChild(input);
        });
        itemDiv.appendChild(coordsDiv);
        listDiv.appendChild(itemDiv);
    }

    ceilingAnchors.forEach(point => createPointItem(point, ceilingAnchorsListDiv));
    traverseAttachPoints.forEach(point => createPointItem(point, traverseAttachPointsListDiv));
    loadPoints.forEach(point => createPointItem(point, loadPointsListDiv));
}


function calculateAndDisplayForces() {
    const loadMass = parseFloat(loadMassInput.value) || 0;
    const traverseWeight = TRAVERSE_MODEL_LENGTH * TRAVERSE_WEIGHT_PER_METER;
    const totalVerticalForce = (loadMass + traverseWeight) * GRAVITY; // Gesamte Last (Newton)

    totalTraverseLoadEl.textContent = `${totalVerticalForce.toFixed(2)} N`;

    // Anzeige der Kräfte für jedes Seil
    forcesOutputDiv.innerHTML = ''; // Vorherige Ergebnisse löschen

    const numActiveAttachPoints = traverseAttachPoints.length; 
    const numActiveCeilingAnchors = ceilingAnchors.length;

    if (numActiveAttachPoints === 0 || numActiveCeilingAnchors === 0) { 
        forcesOutputDiv.innerHTML = '<p>Keine aktiven Seile zur Decke.</p>';
        // Setze alle TAP-Linien auf grau, falls vorhanden
        traverseAttachPoints.forEach(tap => {
            if(tap.userData.line) tap.userData.line.material.color.setHex(0x888888);
        });
        return;
    }

    // Vereinfachte Lastverteilung: Gesamtlast wird auf die vertikalen Anteile der Seile verteilt,
    // proportional zum Kosinus des Winkels zur Vertikalen.
    // D.h., Seile, die näher an der Vertikalen sind, tragen einen proportional größeren Teil der Last.
    let sumOfCosines = 0;
    const verticalVector = new THREE.Vector3(0, 1, 0); // Vektor nach oben

    // Erste Iteration: Summe der Kosinusse aller verbundenen Seile berechnen
    traverseAttachPoints.forEach(tap => {
        const ceilingAnchor = tap.userData.connectedCeilingAnchor;
        if (ceilingAnchor) {
            const ropeVector = new THREE.Vector3().subVectors(ceilingAnchor.position, tap.position);
            const angleToVertical = Math.abs(ropeVector.angleTo(verticalVector));
            sumOfCosines += Math.cos(angleToVertical);
        }
    });

    // Wenn keine Seile effektiv zur vertikalen Lastaufnahme beitragen (z.B. alle horizontal),
    // oder wenn sumOfCosines sehr klein ist, um Division durch Null zu vermeiden.
    if (sumOfCosines < 1e-6) {
        forcesOutputDiv.innerHTML = '<p>Unbestimmter Lastfall oder keine tragenden Seile (Winkel zu horizontal).</p>';
        // Alle Seile auf Rot setzen
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
        const angleToVertical = Math.abs(ropeVector.angleTo(verticalVector)); // Winkel zur Vertikalen (nach oben)
        
        let tension = 0;
        const cosineAngle = Math.cos(angleToVertical);

        if (Math.abs(cosineAngle) > 1e-6) { // Vermeide Division durch Null
            // Der vertikale Kraftbeitrag dieses Seils ist proportional zu seinem Kosinusanteil
            const verticalForceContributionOfThisRope = (cosineAngle / sumOfCosines) * totalVerticalForce;
            tension = verticalForceContributionOfThisRope / cosineAngle; // Tatsächliche Spannung im Seil
        } else {
            tension = Infinity; // Seil ist horizontal oder fast horizontal, führt zu unendlicher Spannung
        }

        const angleDeg = THREE.MathUtils.radToDeg(angleToVertical).toFixed(2);
        
        // Dynamische Anzeige der Seilkräfte und Winkel
        const p = document.createElement('p');
        p.innerHTML = `<strong>Seil ${i + 1} (${tap.userData.name} zu ${ceilingAnchor.userData.name}):</strong> Kraft: ${tension.toFixed(2)} N, Winkel zur Vertikalen: ${angleDeg} °`;
        forcesOutputDiv.appendChild(p);

        // Visuelles Feedback für jedes Seil
        let color = 0x00ff00; // Grün
        if (angleDeg > 60) color = 0xff0000; // Rot (Winkel > 60 Grad ist ungünstig)
        else if (angleDeg > 45) color = 0xffff00; // Gelb (Winkel > 45 Grad ist Vorsicht)
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
onWindowResize(); // Setzt die Grösse initial
// Initialpunkte hinzufügen. Die updateCalculations wird am Ende des addPoint aufgerufen.
// Wenn alle Initialpunkte hinzugefügt sind, wird einmal updateCalculations am Ende aufgerufen.
updateCalculations();
animate();