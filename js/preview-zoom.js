(function(){
    function clamp(v,a,b){return Math.min(Math.max(v,a),b)}

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

    window.previewZoom = {
        init: function(elem){
            if(!elem) return;
            const el = elem instanceof HTMLElement ? elem : elem;
            if(!el) return;
            if(el._pvZoom) return; // already initialized

            let scale = 0.8, minScale = 0.8, maxScale = 10;
            let translateX = 0, translateY = 0;
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

            const recenter = () => {
                if (frame && scale < 1) {
                    // center the image when scaled down
                    const containerRect = el.getBoundingClientRect();
                    const frameRect = frame.getBoundingClientRect();
                    translateX = (containerRect.width * (1 - scale)) / 2;
                    translateY = (containerRect.height * (1 - scale)) / 2;
                } else {
                    translateX = 0; translateY = 0;
                }
                setTransform();
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

                // if the exact target is the slider divider (or inside it), start slider drag and avoid panning
                try {
                    if (ev.target.closest && ev.target.closest('.slider-divider')) {
                        draggingSlider = true;
                        sliderPointerId = ev.pointerId;
                        try { const sd = el.querySelector('.slider-divider'); sd && sd.setPointerCapture(ev.pointerId); } catch(e) {}
                        return;
                    }
                } catch(e) {}

                // If click is close to the divider, start slider drag instead of panning
                // determine proximity to the visible slider knob (use actual DOM rect)
                let proximity = false;
                try {
                    if (sliderDivider) {
                        const srect = sliderDivider.getBoundingClientRect();
                        const knobX = srect.left + srect.width / 2;
                        const proximityPx = 40;
                        if (Math.abs(ev.clientX - knobX) <= proximityPx) proximity = true;
                    }
                } catch (e) {}

                if (proximity) {
                    // start slider dragging
                    draggingSlider = true;
                    sliderPointerId = ev.pointerId;
                    try { sliderDivider && sliderDivider.setPointerCapture(ev.pointerId); } catch(e) {}
                    return;
                }

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

                // toggle: if at min scale, zoom to max; otherwise reset to min
                if (scale === minScale) {
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
                    scale = minScale; recenter();
                }
            };

            el.addEventListener('wheel', onWheel, { passive: false });
            el.addEventListener('pointerdown', onPointerDown);
            el.addEventListener('dblclick', onDblClick);

            const onResize = () => { if (scale === minScale && !isPanning) recenter(); };
            window.addEventListener('resize', onResize);

            el._pvZoom = {
                destroy: () => {
                    el.removeEventListener('wheel', onWheel);
                    el.removeEventListener('pointerdown', onPointerDown);
                    el.removeEventListener('dblclick', onDblClick);
                    window.removeEventListener('resize', onResize);
                    // window pointer handlers and slider cleanup removed later by assigned destroy
                    delete el._pvZoom;
                },
                zoomIn: (step=1.2) => {
                    const rect = el.getBoundingClientRect();
                    const cx = rect.width/2, cy = rect.height/2;
                    const factor = step;
                    const newScale = clamp(scale*factor, minScale, maxScale);
                    const dx = (cx - translateX) / scale;
                    const dy = (cy - translateY) / scale;
                    scale = newScale;
                    translateX = cx - dx*scale;
                    translateY = cy - dy*scale;
                    setTransform();
                },
                zoomOut: (step=1.2) => {
                    const rect = el.getBoundingClientRect();
                    const cx = rect.width/2, cy = rect.height/2;
                    const factor = 1/step;
                    const newScale = clamp(scale*factor, minScale, maxScale);
                    const dx = (cx - translateX) / scale;
                    const dy = (cy - translateY) / scale;
                    scale = newScale;
                    translateX = cx - dx*scale;
                    translateY = cy - dy*scale;
                    setTransform();
                },
                reset: () => { scale = minScale; recenter(); }
            };

            if (frame) frame.style.transition = 'transform 120ms ease-out';
            setTransform();
            recenter();  // center the image on init
            // prevent native dragstart on images which can interfere with pointer pan
            try { frameImgs.forEach(img => img.addEventListener('dragstart', e => e.preventDefault())); } catch(e) {}

            // Slider drag handling removed - using simple toggle button instead
            const sliderDivider = null;
            const sliderInput = null;

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
            setTransform();
            // prevent native dragstart on images which can interfere with pointer pan
            try { frameImgs.forEach(img => img.addEventListener('dragstart', e => e.preventDefault())); } catch(e) {}

            el._pvZoom = {
                destroy: () => {
                    el.removeEventListener('wheel', onWheel);
                    el.removeEventListener('pointerdown', onPointerDown);
                    el.removeEventListener('dblclick', onDblClick);
                    window.removeEventListener('resize', onResize);
                    window.removeEventListener('pointermove', onWindowPointerMove);
                    window.removeEventListener('pointerup', onWindowPointerUp);
                    window.removeEventListener('pointercancel', onWindowPointerUp);
                    delete el._pvZoom;
                },
                zoomIn: (step=1.2) => {
                    const rect = el.getBoundingClientRect();
                    const cx = rect.width/2, cy = rect.height/2;
                    const factor = step;
                    const newScale = clamp(scale*factor, minScale, maxScale);
                    const dx = (cx - translateX) / scale;
                    const dy = (cy - translateY) / scale;
                    scale = newScale;
                    translateX = cx - dx*scale;
                    translateY = cy - dy*scale;
                    setTransform();
                },
                zoomOut: (step=1.2) => {
                    const rect = el.getBoundingClientRect();
                    const cx = rect.width/2, cy = rect.height/2;
                    const factor = 1/step;
                    const newScale = clamp(scale*factor, minScale, maxScale);
                    const dx = (cx - translateX) / scale;
                    const dy = (cy - translateY) / scale;
                    scale = newScale;
                    translateX = cx - dx*scale;
                    translateY = cy - dy*scale;
                    setTransform();
                },
                reset: () => { scale = minScale; recenter(); }
            };
        },
    };
})();
