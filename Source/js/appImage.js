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
}
