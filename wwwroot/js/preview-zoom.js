(function(){
    function clamp(v,a,b){return Math.min(Math.max(v,a),b)}

    window.previewZoom = {
        init: function(elem){
            if(!elem) return;
            const el = elem instanceof HTMLElement ? elem : elem;
            if(!el) return;
            if(el._pvZoom) return; // already initialized

            let scale = 1, minScale = 1, maxScale = 8;
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
                translateX = 0; translateY = 0; setTransform();
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
                const rect = el.getBoundingClientRect();
                let dividerPercent = null;
                try {
                    if (sliderDivider && sliderDivider.style && sliderDivider.style.left) {
                        dividerPercent = parseFloat(sliderDivider.style.left);
                    }
                } catch (e) {}
                if (dividerPercent === null && sliderInput && sliderInput.value) {
                    dividerPercent = parseFloat(sliderInput.value) || 0;
                }
                if (dividerPercent === null) dividerPercent = 50;

                const dividerX = rect.left + rect.width * (dividerPercent / 100);
                const proximityPx = 40; // how far from divider we still start sliding
                if (Math.abs(ev.clientX - dividerX) <= proximityPx) {
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
                scale = 1; translateX = 0; translateY = 0; setTransform();
            };

            el.addEventListener('wheel', onWheel, { passive: false });
            el.addEventListener('pointerdown', onPointerDown);
            el.addEventListener('dblclick', onDblClick);

            const onResize = () => { if (scale === 1 && !isPanning) recenter(); };
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
                reset: () => { scale = 1; recenter(); }
            };

            if (frame) frame.style.transition = 'transform 120ms ease-out';
            setTransform();
            // prevent native dragstart on images which can interfere with pointer pan
            try { frameImgs.forEach(img => img.addEventListener('dragstart', e => e.preventDefault())); } catch(e) {}

            // Slider drag handling: only move slider when user clicks and drags the divider
            const sliderDivider = el.querySelector('.slider-divider');
            const sliderInput = el.querySelector('.slider-invisible-input');
            let draggingSlider = false;

            const updateSliderPosition = (percent) => {
                percent = clamp(percent, 0, 100);
                if (sliderInput) {
                    try {
                        sliderInput.value = percent;
                        sliderInput.dispatchEvent(new Event('input', { bubbles: true }));
                    } catch (e) {}
                }
                if (sliderDivider) sliderDivider.style.left = percent + '%';
                // also set overlay clip-path so visual stays in sync under transforms
                try {
                    const overlay = el.querySelector('.overlay-clipping');
                    if (overlay) overlay.style.clipPath = `inset(0 calc(100% - ${percent}%) 0 0)`;
                } catch (e) {}
            };

            // unified window pointer handlers to avoid conflicts between pan and slider
            let sliderPointerId = null;

            const onWindowPointerMove = (ev) => {
                // panning
                if (isPanning && ev.pointerId === panningPointerId) {
                    const dx = ev.clientX - startX;
                    const dy = ev.clientY - startY;
                    translateX = startTranslateX + dx;
                    translateY = startTranslateY + dy;
                    setTransform();
                }

                // slider dragging
                if (draggingSlider && ev.pointerId === sliderPointerId) {
                    const rect = frame ? frame.getBoundingClientRect() : el.getBoundingClientRect();
                    const percent = ((ev.clientX - rect.left) / rect.width) * 100;
                    updateSliderPosition(percent);
                }
            };

            const onWindowPointerUp = (ev) => {
                if (isPanning && ev.pointerId === panningPointerId) {
                    isPanning = false;
                    panningPointerId = null;
                    try{ el.releasePointerCapture(ev.pointerId); }catch(e){}
                    el.style.cursor = 'default';
                }

                if (draggingSlider && ev.pointerId === sliderPointerId) {
                    draggingSlider = false;
                    sliderPointerId = null;
                    try { sliderDivider && sliderDivider.releasePointerCapture(ev.pointerId); } catch(e) {}
                }
            };

            // attach global handlers so we always receive pointermove/up
            window.addEventListener('pointermove', onWindowPointerMove);
            window.addEventListener('pointerup', onWindowPointerUp);
            window.addEventListener('pointercancel', onWindowPointerUp);

            if (sliderDivider) {
                const sliderDown = (ev) => {
                    ev.preventDefault();
                    draggingSlider = true;
                    sliderPointerId = ev.pointerId;
                    try { sliderDivider.setPointerCapture(ev.pointerId); } catch(e) {}
                };
                sliderDivider.addEventListener('pointerdown', sliderDown);
                // initialize position from input value if present
                try {
                    if (sliderInput && sliderInput.value) {
                        const v = parseFloat(sliderInput.value) || 0;
                        sliderDivider.style.left = v + '%';
                    }
                } catch (e) {}

                // cleanup will remove this listener

                // cleanup slider and window listeners on destroy
                const origDestroy = el._pvZoom?.destroy;
                el._pvZoom.destroy = () => {
                    sliderDivider.removeEventListener('pointerdown', sliderDown);
                    window.removeEventListener('pointermove', onWindowPointerMove);
                    window.removeEventListener('pointerup', onWindowPointerUp);
                    window.removeEventListener('pointercancel', onWindowPointerUp);
                    if (origDestroy) origDestroy();
                };
            } else {
                // ensure window handlers for panning still removed on destroy
                const origDestroy = el._pvZoom?.destroy;
                el._pvZoom.destroy = () => {
                    window.removeEventListener('pointermove', onWindowPointerMove);
                    window.removeEventListener('pointerup', onWindowPointerUp);
                    window.removeEventListener('pointercancel', onWindowPointerUp);
                    if (origDestroy) origDestroy();
                };
            }
        },
        zoomIn: function(elem){ if(elem && elem._pvZoom) elem._pvZoom.zoomIn(); },
        zoomOut: function(elem){ if(elem && elem._pvZoom) elem._pvZoom.zoomOut(); },
        reset: function(elem){ if(elem && elem._pvZoom) elem._pvZoom.reset(); },
        destroy: function(elem){ if(elem && elem._pvZoom) elem._pvZoom.destroy(); }
    };
})();
