// Prova a caricare e instanziare libheif.wasm e loggare le esportazioni.
(async function(){
    console.log('[libheif-loader] start');
    console.log('[libheif-loader] document.baseURI =', document.baseURI);

    // Prova prima a caricare un wrapper JS precompilato (es. elheif.js / pkg/index.js)
    const wrapperCandidates = [
        new URL('js/vendor/elheif.js', document.baseURI).href,
        new URL('js/vendor/elheif.min.js', document.baseURI).href,
        new URL('js/vendor/elheif/pkg/index.js', document.baseURI).href,
        new URL('js/vendor/elheif-wasm.js', document.baseURI).href
    ];

    async function loadScript(url) {
        return new Promise((res, rej) => {
            console.log('[libheif-loader] injecting script', url);
            const s = document.createElement('script');
            s.src = url;
            s.onload = () => res(true);
            s.onerror = (e) => rej(e);
            document.head.appendChild(s);
        });
    }

    async function tryInstantiate(url) {
        console.log('[libheif-loader] Trying', url);
        try {
            // First try instantiateStreaming if available
            if ('instantiateStreaming' in WebAssembly) {
                try {
                    const res = await WebAssembly.instantiateStreaming(fetch(url), {});
                    return res;
                } catch (e) {
                    // fallback to manual fetch
                }
            }

            const resp = await fetch(url);
            if (!resp.ok) throw new Error('fetch failed: ' + resp.status + ' ' + resp.statusText);
            const bytes = await resp.arrayBuffer();
            if (!bytes || bytes.byteLength === 0) throw new Error('empty wasm bytes');
            const res = await WebAssembly.instantiate(bytes, {});
            return res;
        } catch (e) {
            console.warn('[libheif-loader] instantiate failed for', url, e);
            return null;
        }
    }

    // Carica wrapper JS se presente e prova ad inizializzarlo
    for (const w of wrapperCandidates) {
        try {
            await loadScript(w);

            // API common from elheif package
            if (window.elheif && typeof window.elheif.ensureInitialized === 'function') {
                console.log('[libheif-loader] Wrapper elheif caricato, chiamando ensureInitialized()');
                await window.elheif.ensureInitialized();
                window.elheifReady = true;
                window.elheifApi = window.elheif;
                console.log('[libheif-loader] elheif inizializzato e pronto');
                return;
            }

            // Funzione globale ensureInitialized
            if (typeof ensureInitialized === 'function') {
                console.log('[libheif-loader] Funzione globale ensureInitialized trovata, chiamando');
                await ensureInitialized();
                window.elheifReady = true;
                console.log('[libheif-loader] ensureInitialized completata');
                return;
            }

            // Emscripten Module pattern
            if (window.Module && typeof window.Module.onRuntimeInitialized === 'function') {
                console.log('[libheif-loader] Wrapper con Module trovato, attendendo onRuntimeInitialized');
                await new Promise((res) => {
                    const prev = window.Module.onRuntimeInitialized;
                    window.Module.onRuntimeInitialized = () => { prev && prev(); res(); };
                });
                window.elheifReady = true;
                console.log('[libheif-loader] Module runtime inizializzato');
                return;
            }

            console.log('[libheif-loader] Wrapper caricato ma non individuata API di init, proseguo ai wasm raw');
        } catch (e) {
            console.warn('[libheif-loader] caricamento wrapper JS fallito per', w, e);
        }
    }

    // Se non abbiamo trovato un wrapper JS, proviamo a caricare un raw .wasm
    const candidates = [
        new URL('js/vendor/libheif.wasm', document.baseURI).href,
        new URL('libheif.wasm', document.baseURI).href,
        '/js/vendor/libheif.wasm',
        '/libheif.wasm'
    ];
    let result = null;
    for (const url of candidates) {
        result = await tryInstantiate(url);
        if (result) {
            console.log('[libheif-loader] Success loading wasm from', url);
            break;
        }
    }

    if (!result) {
        console.warn('[libheif-loader] Errore caricamento libheif.wasm: nessun percorso valido trovato');
        window.libheifWasm = null;
        return;
    }

    const exports = result && result.instance && result.instance.exports ? result.instance.exports : null;
    console.log('[libheif-loader] Istanza wasm creata. Export keys:', exports ? Object.keys(exports) : 'none');

    // Espongo un wrapper minimo per testare la presenza di funzioni utili
    window.libheifWasm = {
        instance: result.instance,
        exports: exports
    };
})();
