// DOM Elements cache
const els = {};

const initApp = () => {
    // Cache elements by ID
    const ids = [
        'imageCompressorContainer', 'audioCompressorContainer', 'videoCompressorContainer',
        'fileInput', 'initOverlay', 'appInterface',
        'fileListContainer', 'previewStage', 'imgOriginal', 'imgOptimized',
        'zoomFrame', 'veloContainer', 'filesCountLabel', 'privacyDate',
        'btnAbout', 'modalAbout', 'backdropAbout', 'btnCloseAbout',
        'modalPrivacy', 'backdropPrivacy', 'btnClosePrivacy', 'linkPrivacy',
        'btnSelectImages', 'btnAddImg', 'globalFormat', 'btnClear', 'btnZip',
        'btnShowOriginal', 'btnShowOptimized', 'btnResetZoom'
    ];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) els[id] = el;
    });

    // Set Date
    if (els.privacyDate) {
        els.privacyDate.textContent = new Date().toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
    }

    setupEventListeners();
};

document.addEventListener('DOMContentLoaded', initApp);
document.addEventListener('velo-ready', initApp);

function setupEventListeners() {
    // Modals Helper
    const toggle = (id, show) => {
        const el = document.getElementById(id);
        if (el) show ? el.classList.remove('d-none') : el.classList.add('d-none');
    };

    // About Modal
    if (els.btnAbout) els.btnAbout.onclick = () => toggle('modalAbout', true);
    if (els.backdropAbout) els.backdropAbout.onclick = () => toggle('modalAbout', false);
    if (els.btnCloseAbout) els.btnCloseAbout.onclick = () => toggle('modalAbout', false);

    // Privacy Modal
    if (els.linkPrivacy) els.linkPrivacy.onclick = (e) => { e.preventDefault(); toggle('modalPrivacy', true); };
    if (els.backdropPrivacy) els.backdropPrivacy.onclick = () => toggle('modalPrivacy', false);
    if (els.btnClosePrivacy) els.btnClosePrivacy.onclick = () => toggle('modalPrivacy', false);

    // File Input & Selection
    if (els.btnSelectImages) els.btnSelectImages.onclick = () => els.fileInput.click();
    if (els.btnAddImg) els.btnAddImg.onclick = () => els.fileInput.click();
    if (els.fileInput) els.fileInput.onchange = (e) => handleFiles(e.target.files);

    // Drag & Drop
    // Prevent adding duplicate global listeners if initApp runs multiple times
    if (!window.hasGlobalDragListeners) {
        window.addEventListener('dragover', (e) => e.preventDefault(), false);
        window.addEventListener('drop', (e) => e.preventDefault(), false);
        window.hasGlobalDragListeners = true;
    }

    if (els.dropZone) {
        els.dropZone.ondragover = (e) => { e.preventDefault(); els.dropZone.classList.add('border-primary'); };
        els.dropZone.ondragleave = () => els.dropZone.classList.remove('border-primary');
        els.dropZone.ondrop = (e) => {
            e.preventDefault();
            els.dropZone.classList.remove('border-primary');
            if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
        };
    }

    // Global Actions
    if (els.btnClear) els.btnClear.onclick = clearAll;
    if (els.btnZip) els.btnZip.onclick = downloadZip;
    if (els.globalFormat) els.globalFormat.onchange = (e) => {
        state.globalFormat = e.target.value;
        state.files.forEach(f => {
            f.format = state.globalFormat;
            processFile(f);
        });
    };

    // Zoom Controls
    if (els.btnShowOriginal) els.btnShowOriginal.onclick = () => setPreviewMode(true);
    if (els.btnShowOptimized) els.btnShowOptimized.onclick = () => setPreviewMode(false);
    if (els.btnResetZoom) els.btnResetZoom.onclick = resetZoom;

    // Zoom Interaction (Pan & Wheel)
    if (els.veloContainer) {
        els.veloContainer.onwheel = handleWheel;
        els.veloContainer.onmousedown = startDrag;

        // Remove existing listeners before adding to avoid duplicates
        window.removeEventListener('mousemove', drag);
        window.removeEventListener('mouseup', stopDrag);

        window.addEventListener('mousemove', drag);
        window.addEventListener('mouseup', stopDrag);
    }

    function loadComponent(componentUrl) {
        console.log(`Tentativo di caricamento: ${componentUrl}`);
        fetch(componentUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Could not load ${componentUrl}: ${response.statusText}`);
                }
                return response.text();
            })
            .then(html => {
                console.log("HTML ricevuto con successo");

                const placeholder = document.getElementById('component-placeholder');
                const selector = document.getElementById('serviceSelector');

                if (selector) selector.classList.add('d-none');
                if (placeholder) {
                    placeholder.innerHTML = html;
                    console.log("Componente iniettato nel placeholder"); // DEBUG
                } else {
                    console.error("ERRORE: #component-placeholder non trovato!");
                }

                // document.getElementById('serviceSelector').classList.add('hidden');
                document.dispatchEvent(new Event('velo-ready'));
            })
            .catch(err => {
                console.error('Failed to load component:', err);
                const selector = document.getElementById('serviceSelector');
                const placeholder = document.getElementById('component-placeholder');

                // Hide selector to show error clearly
                if (selector) selector.classList.add('d-none');

                if (placeholder) {
                    placeholder.innerHTML = `
                            <div class="d-flex flex-column justify-content-center align-items-center vh-100 text-center text-danger">
                                <h3 class="mb-3">⚠️ Error Loading Component</h3>
                                <p class="lead">Browsers block loading external files when opening HTML directly via <code>file://</code>.</p>
                                <p class="text-white-50">Please serve this project using a local web server (e.g., VS Code Live Server).</p>
                                <button class="btn btn-outline-light mt-3" onclick="location.reload()">Reload</button>
                            </div>
                        `;
                }
            });
    }

    document.getElementById('btnHome').addEventListener('click', () => {
        const placeholder = document.getElementById('component-placeholder');
        const selector = document.getElementById('serviceSelector');

        if (placeholder) {
            placeholder.innerHTML = "";
            console.log("Componente iniettato nel placeholder"); // DEBUG
        } else {
            console.error("ERRORE: #component-placeholder non trovato!");
        }

        if (selector) selector.classList.remove('d-none');
        // document.getElementById('serviceSelector').classList.remove('hidden');
    });

    document.getElementById('btnLoadImageCompressor').addEventListener('click', () => {
        loadComponent('components/ImageCompressor.html');
    });
    // document.getElementById('btnLoadAudioCompressor').addEventListener('click', () => {
    //     loadComponent('components/AudioCompressor.html');
    // });
    // document.getElementById('btnLoadVideoCompressor').addEventListener('click', () => {
    //     loadComponent('components/AudioCompressor.html');
    // });
}
