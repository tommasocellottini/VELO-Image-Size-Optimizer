(function(){
    function clamp(v,a,b){return Math.min(Math.max(v,a),b)}

    window.triggerClick = function(elem) {
        if(elem) elem.click();
    };

    window.downloadFromStream = async function(fileName, contentStreamReference) {
        const arrayBuffer = await contentStreamReference.arrayBuffer();
        const blob = new Blob([arrayBuffer]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
    };

    window.enableDragDrop = function(elem, input) {
        if (!elem || !input) return;
        const stop = e => { e.preventDefault(); e.stopPropagation(); };
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => elem.addEventListener(evt, stop));
        elem.addEventListener('drop', e => {
            if (e.dataTransfer && e.dataTransfer.files.length > 0) {
                input.files = e.dataTransfer.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    };

    window.enablePaste = function(input) {
        if (!input) return;
        window.addEventListener('paste', e => {
            if (e.clipboardData && e.clipboardData.files.length > 0) {
                e.preventDefault();
                input.files = e.clipboardData.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    };

    window.previewZoom = {
        init: function(elem){
            if(!elem) return;
            const el = elem instanceof HTMLElement ? elem : elem;
            if(!el) return;
            // If an instance already exists on this element, destroy it before creating a new one.
            if(el._pvZoom) {
                el._pvZoom.destroy();
            }

            const img = el.querySelector('.frame-img:not(.d-none)') || el.querySelector('.frame-img');
            if (!img) {
                console.error("Preview Zoom: Image element not found.");
                return;
            }

            let scale = 0.1;
            let minScale = 0.1, maxScale = 50;
            let fitScale = 0.1;
            let translateX = 0;
            let translateY = 0;
            let isPanning = false, startX = 0, startY = 0, startTranslateX = 0, startTranslateY = 0;
            let panningPointerId = null;

            const frame = el.querySelector('.zoom-frame');
            const frameImgs = el.querySelectorAll('.zoom-frame .frame-img');
            const setTransform = () => {
                if (frame) {
                    // use origin 0 0 and apply translate then scale: S = translate + scale * P
                    frame.style.transformOrigin = '0 0';
                    frame.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
                    frame.style.willChange = 'transform';
                }
            };

            const fitAndCenter = (retainZoom = false) => {
                if (img.naturalWidth > 0) {
                    const containerRect = el.getBoundingClientRect();
                    if (containerRect.width === 0 || containerRect.height === 0) return;
                    const hScale = containerRect.width / img.naturalWidth;
                    const vScale = containerRect.height / img.naturalHeight;
                    
                    // Calcola lo scale per adattare l'immagine
                    // Adatta l'immagine ai bordi (contain)
                    fitScale = Math.min(hScale, vScale);
                    minScale = fitScale * 0.1;

                    if (!retainZoom) {
                        scale = fitScale;
                        const imageWidth = img.naturalWidth * scale;
                        const imageHeight = img.naturalHeight * scale;
                        translateX = (containerRect.width - imageWidth) / 2;
                        translateY = (containerRect.height - imageHeight) / 2;
                    }
                    setTransform();
                }
            };

            const onWheel = (ev) => {
                ev.preventDefault();
                const rect = el.getBoundingClientRect();
                // get pointer position relative to element
                const cx = ev.clientX - rect.left;
                const cy = ev.clientY - rect.top;
                const delta = -ev.deltaY;
                const factor = delta > 0 ? 1.12 : 1/1.12;
                const newScale = clamp(scale * factor, minScale, maxScale);

                // element-space coordinates of the pointer (before zoom)
                const px = (cx - translateX) / scale;
                const py = (cy - translateY) / scale;

                // after changing scale we want the same element point px,py to be under the pointer
                scale = newScale;
                translateX = cx - px * scale;
                translateY = cy - py * scale;
                setTransform();
            };

            const onPointerDown = (ev) => {
                // prevent native browser drag behavior
                try { ev.preventDefault(); } catch(e) {}

                // don't start panning when clicking UI controls
                if (ev.target.closest && ev.target.closest('.zoom-controls')) return;

                // otherwise start panning
                isPanning = true;
                panningPointerId = ev.pointerId;
                try{ el.setPointerCapture(ev.pointerId); }catch(e){}
                startX = ev.clientX; startY = ev.clientY;
                startTranslateX = translateX; startTranslateY = translateY;
                el.style.cursor = 'grabbing';
            };

            const onDblClick = (ev) => {
                // don't zoom if double-clicking on the before/after buttons
                if (ev.target.closest && (ev.target.closest('.before-btn') || ev.target.closest('.after-btn'))) return;

                // toggle: if at fit scale, zoom to max; otherwise reset to fit
                if (Math.abs(scale - fitScale) < 0.001) {
                    // zoom to max at center
                    const rect = el.getBoundingClientRect();
                    const cx = rect.width / 2;
                    const cy = rect.height / 2;
                    const factor = maxScale;
                    const newScale = maxScale;
                    const px = (cx - translateX) / scale;
                    const py = (cy - translateY) / scale;
                    scale = newScale;
                    translateX = cx - px * scale;
                    translateY = cy - py * scale;
                    setTransform();
                } else {
                    // reset to min scale
                    fitAndCenter();
                }
            };

            el.addEventListener('wheel', onWheel, { passive: false });
            el.addEventListener('pointerdown', onPointerDown);
            el.addEventListener('dblclick', onDblClick);

            // Use ResizeObserver to handle container sizing/visibility changes
            const resizeObserver = new ResizeObserver(() => fitAndCenter(false));
            resizeObserver.observe(el);

            // Set initial zoom state
            const onImgLoad = () => fitAndCenter(false);
            img.addEventListener('load', onImgLoad);
            if (img.complete && img.naturalWidth > 0) {
                fitAndCenter(false);
            }

            // prevent native dragstart on images which can interfere with pointer pan
            try { frameImgs.forEach(img => img.addEventListener('dragstart', e => e.preventDefault())); } catch(e) {}

            // unified window pointer handlers to avoid conflicts between pan and slider
            const onWindowPointerMove = (ev) => {
                // panning
                if (isPanning && ev.pointerId === panningPointerId) {
                    const dx = ev.clientX - startX;
                    const dy = ev.clientY - startY;
                    translateX = startTranslateX + dx;
                    translateY = startTranslateY + dy;
                    setTransform();
                }
            };

            const onWindowPointerUp = (ev) => {
                if (isPanning && ev.pointerId === panningPointerId) {
                    isPanning = false;
                    panningPointerId = null;
                    try{ el.releasePointerCapture(ev.pointerId); }catch(e){}
                    el.style.cursor = 'default';
                }
            };

            // attach global handlers so we always receive pointermove/up
            window.addEventListener('pointermove', onWindowPointerMove);
            window.addEventListener('pointerup', onWindowPointerUp);
            window.addEventListener('pointercancel', onWindowPointerUp);

            if (frame) frame.style.transition = 'transform 120ms ease-out';
            el._pvZoom = {
                getState: () => ({ scale, translateX, translateY }),
                reset: () => fitAndCenter(),
                destroy: () => {
                    el.removeEventListener('wheel', onWheel);
                    el.removeEventListener('pointerdown', onPointerDown);
                    el.removeEventListener('dblclick', onDblClick);
                    resizeObserver.disconnect();
                    img.removeEventListener('load', onImgLoad);
                    window.removeEventListener('pointermove', onWindowPointerMove);
                    window.removeEventListener('pointerup', onWindowPointerUp);
                    window.removeEventListener('pointercancel', onWindowPointerUp);
                    delete el._pvZoom;
                }
            };
        },
        reset: function(elem) {
            const el = elem instanceof HTMLElement ? elem : elem;
            if(el && el._pvZoom && el._pvZoom.reset) el._pvZoom.reset();
        }
    };
})();
