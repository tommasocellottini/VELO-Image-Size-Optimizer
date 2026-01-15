window.imageConverterLoader = {
    ensureAndConvert: function (inputId, outputFormat, quality) {
        console.log('imageConverterLoader.ensureAndConvert called', { inputId, outputFormat, quality });
        return new Promise((resolve, reject) => {
            // timeout per diagnosticare promise appese
            const timeoutMs = 30000;
            const to = setTimeout(() => {
                const msg = `imageConverterLoader: timeout after ${timeoutMs}ms`;
                console.error(msg);
                reject(msg);
            }, timeoutMs);
            function callConvert() {
                try {
                    if (window.imageConverter && typeof window.imageConverter.convert === 'function') {
                        // imageConverter.convert may return a promise
                        console.log('imageConverterLoader: calling imageConverter.convert');
                        const res = window.imageConverter.convert(inputId, outputFormat, quality);
                        if (res && typeof res.then === 'function') res.then((v) => { clearTimeout(to); resolve(v); }).catch((e) => { clearTimeout(to); reject(e); });
                        else { clearTimeout(to); resolve(res); }
                    } else {
                        clearTimeout(to);
                        reject('imageConverter not available');
                    }
                } catch (e) {
                    clearTimeout(to);
                    reject(e);
                }
            }

            if (window.imageConverter && typeof window.imageConverter.convert === 'function') {
                console.log('imageConverterLoader: imageConverter already available');
                callConvert();
                return;
            }

            // Carichiamo lo script dinamicamente, risolvendo rispetto al base della pagina
            const scriptUrl = new URL('js/imageConverter.js', document.baseURI).href;
            const existing = Array.from(document.getElementsByTagName('script')).find(s => s.src && s.src.indexOf('js/imageConverter.js') !== -1);
            if (existing) {
                console.log('imageConverterLoader: found existing script tag for imageConverter.js, waiting load or polling for readiness');
                // se esiste ma ancora non definito attendiamo il load; alcuni browser/strumenti potrebbero non emettere load,
                // quindi aggiungiamo anche un polling che verifica l'esistenza di window.imageConverter.
                existing.addEventListener('load', () => callConvert());
                existing.addEventListener('error', (e) => { clearTimeout(to); reject(e); });

                const pollInterval = 200;
                const poll = setInterval(() => {
                    if (window.imageConverter && typeof window.imageConverter.convert === 'function') {
                        clearInterval(poll);
                        console.log('imageConverterLoader: detected imageConverter via polling');
                        try { callConvert(); } catch (e) { clearTimeout(to); reject(e); }
                    }
                }, pollInterval);

                // If polling doesn't detect imageConverter, try adding a new script tag (cache-busted)
                setTimeout(() => {
                    if (window.imageConverter && typeof window.imageConverter.convert === 'function') return;
                    try {
                        console.log('imageConverterLoader: polling fallback - injecting new script tag');
                        const s2 = document.createElement('script');
                        s2.src = scriptUrl + (scriptUrl.indexOf('?') === -1 ? '?' : '&') + '_=' + Date.now();
                        s2.onload = () => {
                            clearInterval(poll);
                            console.log('imageConverterLoader: injected script loaded');
                            try { callConvert(); } catch (e) { clearTimeout(to); reject(e); }
                        };
                        s2.onerror = (err) => { console.warn('imageConverterLoader: injected script failed', err); };
                        document.head.appendChild(s2);
                    } catch (err) {
                        console.warn('imageConverterLoader: inject fallback failed', err);
                    }
                }, 500);

                return;
            }

            try {
                const s = document.createElement('script');
                s.src = scriptUrl;
                s.onload = () => callConvert();
                s.onerror = (e) => { clearTimeout(to); reject(e || ('Failed to load ' + scriptUrl)); };
                document.head.appendChild(s);
            } catch (ex) {
                clearTimeout(to);
                reject(ex);
            }
        });
    }
};
