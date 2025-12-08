import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { FontLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'https://unpkg.com/three@0.160.0/examples/jsm/geometries/TextGeometry.js';
import { EffectComposer } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { vertexShader, fragmentShader } from './shaders.js';

// --- Configuration ---
const FONT_FAMILY = '"Azeret Mono", monospace'; // Change this to change the font
const WORLD_SIZE = 25; // Size of the "world" box for keyword wrapping
const KEYWORDS = [
    "INTERACTION", "WEBGL", "THREE.JS", "DESIGN", "EXPERIENCE",
    "NARRATIVE", "IMMERSIVE", "CREATIVE", "CODING", "FUTURE",
    "INTERFACE", "SYSTEM", "CHAOS", "ORDER", "DIGITAL",
    "HUMAN", "CONNECTION", "DATA", "VISUALIZATION", "ART",
    "ALGORITHM", "GENERATIVE", "SPACE", "TIME", "MEMORY",
    "IDENTITY", "VIRTUAL", "REALITY", "NETWORK", "SIGNAL",
    "NOISE", "PATTERN", "STRUCTURE", "FLOW", "MOTION",
    "LIGHT", "SHADOW", "FORM", "FUNCTION", "PROCESS",
    "ENTROPY", "SYNTHESIS", "KINETIC", "CYBERNETIC", "ECHO",
    "VOID", "FLUX", "MOMENTUM", "GRAVITY", "HORIZON",
    "PERSPECTIVE", "DIMENSION", "SCALE", "TEXTURE", "RHYTHM",
    "HARMONY", "DISSONANCE", "RESONANCE", "FREQUENCY", "WAVE",
    "PARTICLE", "FIELD", "VECTOR", "TENSOR", "MATRIX",
    "NODE", "EDGE", "GRAPH", "TOPOLOGY", "MANIFOLD",
    // Additional keywords for density
    "PROTOTYPE", "FEEDBACK", "LOOP", "CYCLE", "ITERATION",
    "CONCEPT", "THEORY", "PRACTICE", "METHOD", "APPROACH",
    "SURFACE", "DEPTH", "LAYER", "CORE", "SHELL",
    "EXPAND", "CONTRACT", "ROTATE", "TRANSLATE", "TRANSFORM",
    "PIXEL", "VOXEL", "MESH", "VERTEX", "POLYGON",
    "RENDER", "COMPUTE", "PROCESS", "STREAM", "BUFFER",
    "INPUT", "OUTPUT", "STATE", "EVENT", "TRIGGER",
    "SENSE", "FEEL", "TOUCH", "SIGHT", "SOUND"
];

const PROJECTS = {
    "INTERACTION": { title: "Project Alpha", desc: "An exploration of touch." },
    "WEBGL": { title: "Project Beta", desc: "3D web experiences." },
    "DESIGN": { title: "Project Gamma", desc: "Visual systems." }
};

// --- State ---
const state = {
    view: 'field', // field, gallery, about, search
    fieldPhase: 'landing', // landing, shattering, active, project
    mouse: new THREE.Vector2(),
    targetMouse: new THREE.Vector2(),
    raycaster: new THREE.Raycaster(),
    collectedKeywords: [],
    lines: [],
    keys: { w: false, a: false, s: false, d: false },
    velocity: new THREE.Vector3(),
    rotationVelocity: 0
};

// --- Scene Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('canvas-container').appendChild(renderer.domElement);

// --- Post Processing ---
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.85; // Higher threshold = fewer things glow
bloomPass.strength = 0.4; // Lower strength = less intense
bloomPass.radius = 0.2; // Sharper glow
composer.addPass(bloomPass);

// --- Background Shader ---
// Create a plane that fills the camera view
const bgGeometry = new THREE.PlaneGeometry(1, 1);
const bgMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2() },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    },
    depthTest: false,
    depthWrite: false
});
const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
bgMesh.renderOrder = -999; // Ensure it renders behind everything

// Attach background to camera so it's always visible
const bgDistance = 10;
bgMesh.position.z = -bgDistance;
bgMesh.frustumCulled = false; // Prevent culling issues
camera.add(bgMesh);
scene.add(camera);

// Function to update background size
function updateBackgroundSize() {
    const vFOV = THREE.MathUtils.degToRad(camera.fov);
    const height = 2 * Math.tan(vFOV / 2) * bgDistance;
    const width = height * camera.aspect;
    bgMesh.scale.set(width, height, 1);
}
updateBackgroundSize();

// --- Objects ---
let keywordGroup = new THREE.Group();
keywordGroup.visible = false; // Start hidden, will be shown when entering 'active' phase
scene.add(keywordGroup);
let particles = null;

// --- Font Loader (Removed, using Sprites) ---
// Pre-generate keywords but keep them hidden
createKeywords();

// --- Functions ---

function createTextSprite(text) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fontSize = 64;
    ctx.font = `200 ${fontSize}px ${FONT_FAMILY}`;
    
    // Measure text
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    
    // Resize canvas with EXTRA PADDING for easier hover
    const padding = 40; 
    canvas.width = textWidth + padding * 2;
    canvas.height = fontSize + padding * 2;
    
    // Draw text
    ctx.font = `200 ${fontSize}px ${FONT_FAMILY}`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    
    // Use Mesh instead of Sprite for better raycasting (rectangular hit area)
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0, // Start invisible
        color: 0xffffff,
        depthTest: false,
        side: THREE.DoubleSide // Visible from both sides
    });    const scaleFactor = 0.005;
    const geometry = new THREE.PlaneGeometry(canvas.width * scaleFactor, canvas.height * scaleFactor);
    const mesh = new THREE.Mesh(geometry, material);
    
    return mesh;
}

function createKeywords() {
    KEYWORDS.forEach((word, i) => {
        const mesh = createTextSprite(word);
        
        // Random position - fill the entire world space
        // Use WORLD_SIZE to ensure keywords are distributed across the whole looping area
        mesh.position.x = (Math.random() - 0.5) * WORLD_SIZE * 1.8;
        mesh.position.y = (Math.random() - 0.5) * WORLD_SIZE * 1.2; // Less vertical spread
        mesh.position.z = (Math.random() - 0.5) * WORLD_SIZE * 1.8;
        
        mesh.userData = { 
            originalPos: mesh.position.clone(),
            word: word,
            velocity: new THREE.Vector3((Math.random()-0.5)*0.01, (Math.random()-0.5)*0.01, (Math.random()-0.5)*0.01),
            hovered: false,
            selected: false,
            baseScaleX: 1,
            baseScaleY: 1
        };
        
        keywordGroup.add(mesh);
    });
}

function createExplosion(position) {
    const particleCount = 500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];
    
    for(let i=0; i<particleCount; i++) {
        positions[i*3] = position.x + (Math.random() - 0.5) * 0.5;
        positions[i*3+1] = position.y + (Math.random() - 0.5) * 0.2;
        positions[i*3+2] = position.z;
        
        velocities.push({
            x: (Math.random() - 0.5) * 0.2,
            y: (Math.random() - 0.5) * 0.2,
            z: (Math.random() - 0.5) * 0.2
        });
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
        color: 0xe3e4ff,
        size: 0.05,
        transparent: true,
        opacity: 1
    });
    
    particles = new THREE.Points(geometry, material);
    particles.userData = { velocities: velocities };
    scene.add(particles);
}

// --- Interaction ---

function onMouseMove(event) {
    // Normalize mouse for shader
    state.targetMouse.x = event.clientX / window.innerWidth;
    state.targetMouse.y = 1.0 - event.clientY / window.innerHeight;
    
    // Normalize for raycaster
    state.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    state.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Custom Cursor Logic
    const cursor = document.getElementById('cursor');
    const windVane = cursor.querySelector('.wind-vane');
    
    // Move cursor container to exact mouse position
    gsap.to(cursor, {
        x: event.clientX,
        y: event.clientY,
        duration: 0.1
    });
    
    // Rotate based on movement direction
    // Default orientation of our arrow shape is pointing Top-Right (45 deg)
    // We want it to point in the direction of movement
    const dx = event.movementX;
    const dy = event.movementY;
    
    if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        // Calculate angle of movement
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        
        // IMPORTANT: The uploaded cursor image should point to the RIGHT (East).
        // If your image points UP, change this to: angle + 90
        // If your image points Top-Right, change this to: angle - 45
        
        gsap.to(windVane, {
            rotation: angle,
            duration: 0.5
        });
    }

    // --- Hover Logic ---
    if (state.view === 'field' && state.fieldPhase === 'active') {
        // Raycast for keywords
        state.raycaster.setFromCamera(state.mouse, camera);
        const intersects = state.raycaster.intersectObjects(keywordGroup.children);
        
        // Reset hover state for all
        keywordGroup.children.forEach(sprite => {
            if (!sprite.userData.selected) {
                if (sprite.userData.hovered) {
                    sprite.userData.hovered = false;
                    gsap.to(sprite.material, { opacity: 0.6, duration: 0.3 });
                    gsap.to(sprite.material.color, { r: 1, g: 1, b: 1, duration: 0.3 });
                    gsap.to(sprite.scale, { x: sprite.userData.baseScaleX, y: sprite.userData.baseScaleY, duration: 0.3 });
                }
            }
        });

        if (intersects.length > 0) {
            const object = intersects[0].object;
            
            // Store base scale if not stored
            if (!object.userData.baseScaleX) {
                object.userData.baseScaleX = object.scale.x;
                object.userData.baseScaleY = object.scale.y;
            }

            // Hover Effect
            if (!object.userData.hovered && !object.userData.selected) {
                object.userData.hovered = true;
                gsap.to(object.material, { opacity: 1.0, duration: 0.2 });
                // Target Color: #408F98 -> r:0.25, g:0.56, b:0.60
                gsap.to(object.material.color, { r: 0.25, g: 0.56, b: 0.60, duration: 0.2 });
                gsap.to(object.scale, { x: object.userData.baseScaleX * 1.2, y: object.userData.baseScaleY * 1.2, duration: 0.2 });
            }
        }
    }
}



function onClick(event) {
    // Only allow interactions if we are in the Field View
    if (state.view !== 'field') return;

    // Prevent interaction if clicking on UI elements (Nav, etc.)
    // Check if the click target is within the UI layer but NOT the canvas
    // Actually, the UI layer covers everything. We need to check if the target is a specific UI element.
    // But wait, pointer-events: none is on #ui-layer, so clicks pass through to canvas unless they hit a child with pointer-events: auto.
    // If the user clicks a nav link, the event listener on the link handles it.
    // However, the click event might propagate to the window.
    // Let's check the event target.
    if (event.target.closest('.nav-link') || event.target.closest('.menu-item') || event.target.closest('.search-container')) {
        return;
    }

    if (state.fieldPhase === 'landing') {
        // Shatter Title
        // const title = document.querySelector('.title-container'); // Handled by updateVisibility now
        // title.classList.add('hidden');
        
        createExplosion(new THREE.Vector3(0, 0, 0));
        state.fieldPhase = 'shattering';
        updateVisibility(); // Hide title immediately
        
        // Transition to Field
        setTimeout(() => {
            state.fieldPhase = 'active';
            updateVisibility(); // Show keywords
            // Fade in keywords
            keywordGroup.children.forEach(mesh => {
                gsap.to(mesh.material, { opacity: 0.6, duration: 2 });
            });
        }, 1000);
        
    } else if (state.fieldPhase === 'active') {
        // Raycast for keywords
        state.raycaster.setFromCamera(state.mouse, camera);
        const intersects = state.raycaster.intersectObjects(keywordGroup.children);
        
        if (intersects.length > 0) {
            const object = intersects[0].object;
            
            // Select Logic
            if (!state.collectedKeywords.includes(object)) {
                state.collectedKeywords.push(object);
                object.userData.selected = true;
                
                // Strong feedback
                object.material.color.setHex(0x408F98); // Teal
                object.material.opacity = 1;
                
                // Bloom burst
                const light = new THREE.PointLight(0x408F98, 5, 10);
                light.position.copy(object.position);
                scene.add(light);
                gsap.to(light, { intensity: 0, duration: 1.5, onComplete: () => scene.remove(light) });

                // Rearrange others
                rearrangeKeywords(object);
            }
            
            // Check for project formation (e.g., 3 keywords)
            if (state.collectedKeywords.length >= 3) {
                formProject();
            }
        }
    }
}

function rearrangeKeywords(excludeObject) {
    // "World Flow" Effect:
    // When a keyword is selected, the universe reorganizes around it.
    // Create a massive vortex/orbit effect
    
    const center = excludeObject.position.clone();
    
    keywordGroup.children.forEach((sprite, index) => {
        if (sprite !== excludeObject && !sprite.userData.selected) {
            
            // Calculate current direction relative to the selected object
            let direction = new THREE.Vector3().subVectors(sprite.position, center).normalize();
            if (direction.lengthSq() === 0) direction.set(1, 0, 0); // Safety
            
            // Define a target orbit radius
            // Distribute them in layers
            const layer = (index % 3) + 1;
            const targetRadius = 6 + layer * 3; // 9, 12, 15...
            
            // Calculate a target position on a sphere/ring around the selected object
            // We want them to swirl, so we add a rotation to their current angle
            const axis = new THREE.Vector3(0, 1, 0);
            const angle = Math.PI / 2 + (Math.random() * 0.5); // Rotate 90 degrees around center
            
            direction.applyAxisAngle(axis, angle);
            
            const targetPos = center.clone().add(direction.multiplyScalar(targetRadius));
            
            // Add some vertical variation
            targetPos.y += (Math.random() - 0.5) * 5;
            
            // Animate with a "slingshot" ease
            gsap.to(sprite.position, {
                x: targetPos.x,
                y: targetPos.y,
                z: targetPos.z,
                duration: 2.5,
                ease: "power4.inOut"
            });
            
            // Rotate the sprite itself to add to the chaos/flow
            // Sprites always face camera, but we can animate their z-rotation (roll)
            gsap.to(sprite.material, { rotation: Math.PI * 2, duration: 2.5, ease: "power2.inOut" });
            
            // Dim them
            gsap.to(sprite.material, { opacity: 0.2, duration: 1.5 });
        }
    });
}

function formProject() {
    state.fieldPhase = 'project';
    
    // Fade out uncollected
    keywordGroup.children.forEach(mesh => {
        if (!state.collectedKeywords.includes(mesh)) {
            gsap.to(mesh.material, { opacity: 0, duration: 1 });
        }
    });
    
    // Move collected to center
    state.collectedKeywords.forEach((mesh, i) => {
        gsap.to(mesh.position, {
            x: (i - 1) * 2,
            y: 0,
            z: 2,
            duration: 1.5,
            ease: "power2.inOut"
        });
        
        // Connect lines
        /* REMOVED UGLY BLUE LINES
        if (i > 0) {
            const prev = state.collectedKeywords[i-1];
            const geometry = new THREE.BufferGeometry().setFromPoints([prev.position, mesh.position]);
            const material = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0 });
            const line = new THREE.Line(geometry, material);
            scene.add(line);
            
            state.lines.push({
                line: line,
                startMesh: prev,
                endMesh: mesh
            });

            gsap.to(material, { opacity: 1, duration: 1.5, delay: 0.5 });
        }
        */
    });
}

// --- UI Logic ---
const ui = {
    nav: {
        about: document.getElementById('nav-about'),
        field: document.getElementById('nav-field'),
        gallery: document.getElementById('nav-gallery'),
        search: document.getElementById('nav-search'),
        menu: document.getElementById('nav-menu')
    },
    views: {
        field: document.getElementById('canvas-container'), // Field is the canvas
        gallery: document.getElementById('gallery-view'),
        about: document.getElementById('about-view')
    },
    overlays: {
        search: document.getElementById('search-overlay'),
        menu: document.getElementById('side-menu'),
        contact: document.getElementById('contact-overlay')
    },
    menuItems: {
        home: document.getElementById('menu-home'),
        about: document.getElementById('menu-about'),
        find: document.getElementById('menu-find'),
        contact: document.getElementById('menu-contact'),
        close: document.getElementById('menu-close')
    },
    inputs: {
        search: document.getElementById('search-input'),
        searchClose: document.getElementById('search-close'),
        contactClose: document.getElementById('contact-close')
    },
    containers: {
        canvas: document.getElementById('canvas-container'),
        uiLayer: document.getElementById('ui-layer')
    }
};

function updateVisibility() {
    const landingTitle = document.getElementById('landing-title');
    
    // 1. Handle HTML Title Visibility
    if (state.view === 'field' && state.fieldPhase === 'landing') {
        landingTitle.style.opacity = '1';
        landingTitle.style.pointerEvents = 'auto';
    } else {
        landingTitle.style.opacity = '0';
        landingTitle.style.pointerEvents = 'none';
    }

    // 2. Handle 3D Keywords Visibility
    // Keywords should only be visible if we are in Field View AND Field Phase is active (or project)
    const showKeywords = (state.view === 'field' && (state.fieldPhase === 'active' || state.fieldPhase === 'project'));
    
    if (keywordGroup) {
        keywordGroup.visible = showKeywords;
    }
    
    // 3. Handle Particles Visibility
    // Particles are transient, but if we switch away, maybe hide them?
    if (particles) {
        particles.visible = (state.view === 'field');
    }
}

function switchView(viewName) {
    state.view = viewName;

    // Update Nav Active State
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    if (ui.nav[viewName]) ui.nav[viewName].classList.add('active');

    // Hide all views first
    ui.views.gallery.classList.add('hidden');
    ui.views.about.classList.add('hidden');
    
    // Reset Canvas Blur
    ui.containers.canvas.style.filter = 'none';
    
    // Handle specific views
    if (viewName === 'field') {
        // Show Canvas
        ui.containers.canvas.style.opacity = '1';
        ui.containers.canvas.style.pointerEvents = 'auto';
        // Don't change fieldPhase here, just resume
    } else if (viewName === 'gallery') {
        // Hide Canvas (or fade it)
        ui.containers.canvas.style.opacity = '0.5'; // Keep it visible but dim
        ui.containers.canvas.style.pointerEvents = 'none';
        ui.views.gallery.classList.remove('hidden');
    } else if (viewName === 'about') {
        ui.containers.canvas.style.opacity = '0.5';
        ui.containers.canvas.style.pointerEvents = 'none';
        ui.views.about.classList.remove('hidden');
    }
    
    updateVisibility();
}

// Back Button Listener - REMOVED
// document.getElementById('about-back').addEventListener('click', () => {
//     switchView('field');
// });

// Nav Listeners
ui.nav.about.addEventListener('click', (e) => {
    e.preventDefault();
    if (state.view === 'about') {
        // If already on About page, go back to Field
        switchView('field');
    } else {
        switchView('about');
    }
});

ui.nav.field.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('field');
});

ui.nav.gallery.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('gallery');
});

// Search Listener
ui.nav.search.addEventListener('click', (e) => {
    e.preventDefault();
    ui.overlays.search.classList.remove('hidden');
    ui.containers.canvas.style.filter = 'blur(10px)'; // Blur the background
    ui.containers.uiLayer.style.filter = 'blur(10px)'; // Blur the UI
    ui.inputs.search.focus();
});

ui.inputs.searchClose.addEventListener('click', () => {
    ui.overlays.search.classList.add('hidden');
    ui.containers.canvas.style.filter = 'none'; // Remove blur
    ui.containers.uiLayer.style.filter = 'none';
});

// Close search on Escape key
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !ui.overlays.search.classList.contains('hidden')) {
        ui.overlays.search.classList.add('hidden');
        ui.containers.canvas.style.filter = 'none';
        ui.containers.uiLayer.style.filter = 'none';
    }
});

// Menu Listener
ui.nav.menu.addEventListener('click', (e) => {
    e.preventDefault();
    ui.overlays.menu.classList.toggle('open');
});

// Menu Items Logic
ui.menuItems.home.addEventListener('click', (e) => {
    e.preventDefault();
    ui.overlays.menu.classList.remove('open');
    
    // Reset to Field Landing
    switchView('field');
    state.fieldPhase = 'landing';
    state.collectedKeywords = []; // Clear collected
    
    // Reset Keywords
    keywordGroup.children.forEach(mesh => {
        mesh.userData.selected = false;
        mesh.userData.hovered = false;
        mesh.material.opacity = 0; // Hide them
        mesh.material.color.setHex(0xffffff);
        mesh.position.copy(mesh.userData.originalPos);
    });
    
    updateVisibility();
});

ui.menuItems.about.addEventListener('click', (e) => {
    e.preventDefault();
    ui.overlays.menu.classList.remove('open');
    switchView('about');
});

ui.menuItems.find.addEventListener('click', (e) => {
    e.preventDefault();
    // Placeholder for "Find Yourself"
    console.log("Find Yourself clicked");
});

ui.menuItems.contact.addEventListener('click', (e) => {
    e.preventDefault();
    ui.overlays.menu.classList.remove('open');
    ui.overlays.contact.classList.remove('hidden');
});

ui.menuItems.close.addEventListener('click', (e) => {
    e.preventDefault();
    ui.overlays.menu.classList.remove('open');
});

ui.inputs.contactClose.addEventListener('click', () => {
    ui.overlays.contact.classList.add('hidden');
});

// Close menu when clicking outside (optional, but good UX)
document.addEventListener('click', (e) => {
    if (!ui.overlays.menu.contains(e.target) && e.target !== ui.nav.menu) {
        ui.overlays.menu.classList.remove('open');
    }
});

// --- Animation Loop ---

function animate() {
    requestAnimationFrame(animate);
    
    const time = performance.now() * 0.001;
    
    // WASD Navigation (Smooth with Inertia)
    // Only active if we are in Field View AND (Field Phase is active or project)
    if (state.view === 'field' && (state.fieldPhase === 'active' || state.fieldPhase === 'project')) {
        const accel = 0.008;
        const rotAccel = 0.0015; // Reduced from 0.003 for less sensitive rotation
        const friction = 0.96; // Back to normal friction for responsive controls
        const minDriftSpeed = 0.0008; // Very slow drift speed

        // Acceleration
        if (state.keys.w) state.velocity.z -= accel;
        if (state.keys.s) state.velocity.z += accel;
        if (state.keys.a) state.rotationVelocity += rotAccel;
        if (state.keys.d) state.rotationVelocity -= rotAccel;

        // Friction
        state.velocity.z *= friction;
        state.rotationVelocity *= friction;
        
        // If velocity is very small, apply a gentle forward drift
        if (Math.abs(state.velocity.z) < minDriftSpeed) {
            state.velocity.z = -minDriftSpeed; // Negative = forward
        }

        // Apply
        camera.translateZ(state.velocity.z);
        camera.rotateY(state.rotationVelocity);
    }

    // Update Shader
    bgMaterial.uniforms.uTime.value = time;
    bgMaterial.uniforms.uMouse.value.lerp(state.targetMouse, 0.05);
    
    // Update Particles (Explosion)
    if (particles && particles.visible) {
        const positions = particles.geometry.attributes.position.array;
        const vels = particles.userData.velocities;
        
        for(let i=0; i<vels.length; i++) {
            positions[i*3] += vels[i].x;
            positions[i*3+1] += vels[i].y;
            positions[i*3+2] += vels[i].z;
            
            // Drag
            vels[i].x *= 0.98;
            vels[i].y *= 0.98;
            vels[i].z *= 0.98;
        }
        particles.geometry.attributes.position.needsUpdate = true;
        particles.material.opacity -= 0.01;
        if (particles.material.opacity <= 0) {
            scene.remove(particles);
            particles = null;
        }
    }
    
    // Update Keywords (Field Phase, Project Phase, Gallery, About)
    // Only update if visible
    if (keywordGroup && keywordGroup.visible) {
        // Get camera's forward direction for proper Z wrapping
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        
        // Pre-calculate camera axes (do this once, not per mesh)
        const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
        const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        
        keywordGroup.children.forEach(mesh => {
            // Skip if selected (keep selected ones fully visible)
            if (mesh.userData.selected) return;
            
            // Gentle float
            mesh.position.y += Math.sin(time + mesh.position.x) * 0.002;
            
            // BILLBOARD EFFECT: Make meshes face the camera
            mesh.quaternion.copy(camera.quaternion);
            
            // INFINITE LOOP: Wrap keywords around in all directions
            // Calculate position relative to camera in WORLD space
            const toMesh = mesh.position.clone().sub(camera.position);
            const distance = toMesh.length();
            
            // DISTANCE-BASED OPACITY: Fade out far keywords
            // Multi-stage fade for more natural appearance
            // Close (0-10): full opacity (0.6)
            // Mid (10-20): gradual fade to 0.25
            // Far (20-WORLD_SIZE): fade to 0.08
            // Very Far (beyond WORLD_SIZE): fade to 0
            let targetOpacity = 0.6;
            
            if (distance > 10 && distance <= 20) {
                // Mid range: fade from 0.6 to 0.25
                const t = (distance - 10) / 10;
                targetOpacity = 0.6 - t * 0.35; // 0.6 -> 0.25
            } else if (distance > 20 && distance <= WORLD_SIZE) {
                // Far range: fade from 0.25 to 0.08
                const t = (distance - 20) / (WORLD_SIZE - 20);
                targetOpacity = 0.25 - t * 0.17; // 0.25 -> 0.08
            } else if (distance > WORLD_SIZE) {
                // Very far: fade to 0
                const t = Math.min(1, (distance - WORLD_SIZE) / 5);
                targetOpacity = 0.08 * (1 - t); // 0.08 -> 0
            }
            
            // Smoothly interpolate opacity (don't use gsap here, direct lerp is smoother in animation loop)
            mesh.material.opacity += (targetOpacity - mesh.material.opacity) * 0.1;
            
            // Get distances along each camera axis
            const distRight = toMesh.dot(camRight);
            const distUp = toMesh.dot(camUp);
            const distForward = toMesh.dot(camForward);
            
            // Wrap along camera's RIGHT axis (left-right)
            if (distRight > WORLD_SIZE) {
                mesh.position.sub(camRight.clone().multiplyScalar(WORLD_SIZE * 2));
            } else if (distRight < -WORLD_SIZE) {
                mesh.position.add(camRight.clone().multiplyScalar(WORLD_SIZE * 2));
            }
            
            // Wrap along camera's UP axis (up-down)
            if (distUp > WORLD_SIZE) {
                mesh.position.sub(camUp.clone().multiplyScalar(WORLD_SIZE * 2));
            } else if (distUp < -WORLD_SIZE) {
                mesh.position.add(camUp.clone().multiplyScalar(WORLD_SIZE * 2));
            }
            
            // Wrap along camera's FORWARD axis (depth)
            if (distForward > WORLD_SIZE) {
                mesh.position.sub(camForward.clone().multiplyScalar(WORLD_SIZE * 2));
            } else if (distForward < -WORLD_SIZE) {
                mesh.position.add(camForward.clone().multiplyScalar(WORLD_SIZE * 2));
            }
        });
    }
    
    // Update Lines (Project Phase) - REMOVED, no more lines
    // if (state.phase === 'project') { ... }
    
    composer.render();
}

// --- Listeners ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    bgMaterial.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    updateBackgroundSize();
});

window.addEventListener('mousemove', onMouseMove);
window.addEventListener('click', onClick);

// Keyboard Controls
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (state.keys.hasOwnProperty(key)) state.keys[key] = true;
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (state.keys.hasOwnProperty(key)) state.keys[key] = false;
});

// Initialize visibility state on load
updateVisibility();

// Start
animate();
