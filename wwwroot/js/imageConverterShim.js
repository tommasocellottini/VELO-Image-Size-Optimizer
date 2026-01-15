(function(){
    if (window.__imageConverterShimInstalled) return;
    window.__imageConverterShimInstalled = true;

    // Placeholder object; real one should replace this when imageConverter.js executes
    const shimConvert = async function(inputId, outputFormat, quality) {
        // If real implementation already present, forward
        if (window.__imageConverterLoaded && window.imageConverter && window.imageConverter._isReal) {
            return window.imageConverter.convert(inputId, outputFormat, quality);
        }
        // Otherwise attempt to fetch+parse the main script to detect syntax errors before injecting
        const scriptUrl = new URL('js/imageConverter.js', document.baseURI).href;
        try {
            const resp = await fetch(scriptUrl, { cache: 'no-store' });
            if (!resp.ok) throw new Error('Failed to fetch ' + scriptUrl + ' (status ' + resp.status + ')');
            const src = await resp.text();
            try {
                // Parse-only check to expose syntax errors early
                new Function(src);
            } catch (parseErr) {
                throw new Error('Syntax error in imageConverter.js: ' + (parseErr && parseErr.message ? parseErr.message : String(parseErr)));
            }
        } catch (e) {
            console.error('imageConverterShim: preflight fetch/parse failed', e);
            throw e;
        }

        // Inject the real script cache-busted
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = scriptUrl + (scriptUrl.indexOf('?') === -1 ? '?' : '&') + '_=' + Date.now();
            s.onload = () => {
                window.__imageConverterLoaded = true;
                // If the loaded script defined the real API, call it
                try {
                    if (window.imageConverter && typeof window.imageConverter.convert === 'function' && window.imageConverter !== api) {
                        resolve(window.imageConverter.convert(inputId, outputFormat, quality));
                        return;
                    }
                    reject(new Error('imageConverter loaded but API not available'));
                } catch (err) { reject(err); }
            };
            s.onerror = (err) => { reject(new Error('Failed to load imageConverter.js: ' + (err && err.message ? err.message : String(err)))); };
            document.head.appendChild(s);
        });
    };

    const api = {
        convert: shimConvert
    };

    // Ensure shim is present before loader runs
    window.imageConverter = window.imageConverter || api;
})();
