// --- Zoom Logic ---
function resetZoom() {
    const img = els.imgOriginal;
    const container = els.veloContainer;

    if (!img || !container) return;

    if (!img.complete || img.naturalWidth === 0) {
        img.onload = resetZoom;
        return;
    }

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const scaleX = rect.width / img.naturalWidth;
    const scaleY = rect.height / img.naturalHeight;
    const scale = Math.min(scaleX, scaleY) * 0.9;

    const x = (rect.width - img.naturalWidth * scale) / 2;
    const y = (rect.height - img.naturalHeight * scale) / 2;

    state.zoom = { scale, x, y, isDragging: false, startX: 0, startY: 0 };
    applyZoom();
}

function applyZoom() {
    if(els.zoomFrame) els.zoomFrame.style.transform = `translate(${state.zoom.x}px, ${state.zoom.y}px) scale(${state.zoom.scale})`;
}

function handleWheel(e) {
    e.preventDefault();

    const rect = els.veloContainer.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const oldScale = state.zoom.scale;
    let newScale = oldScale * delta;
    newScale = Math.min(Math.max(0.1, newScale), 10); // Clamp

    const scaleRatio = newScale / oldScale;

    state.zoom.x = mx - (mx - state.zoom.x) * scaleRatio;
    state.zoom.y = my - (my - state.zoom.y) * scaleRatio;
    state.zoom.scale = newScale;

    applyZoom();
}

function startDrag(e) {
    state.zoom.isDragging = true;
    state.zoom.startX = e.clientX - state.zoom.x;
    state.zoom.startY = e.clientY - state.zoom.y;
    if(els.veloContainer) els.veloContainer.style.cursor = 'grabbing';
}

function drag(e) {
    if (!state.zoom.isDragging) return;
    e.preventDefault();
    state.zoom.x = e.clientX - state.zoom.startX;
    state.zoom.y = e.clientY - state.zoom.startY;
    applyZoom();
}

function stopDrag() {
    state.zoom.isDragging = false;
    if(els.veloContainer) els.veloContainer.style.cursor = 'grab';
}