window.imageConverter = {
    convert: async function (inputId, outputFormat, quality) {
        const input = document.getElementById(inputId);
        if (!input || !input.files || input.files.length === 0) {
            alert('Seleziona prima un file immagine.');
            return;
        }

        const file = input.files[0];
        const nameOrig = file.name || 'output';
        console.log('imageConverter.convert start', { inputId: inputId, file: nameOrig });

        function downloadBlob(blob, outName) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = outName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        }

        let mime = outputFormat || 'image/png';
        const extMap = {
            'image/png': '.png',
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/webp': '.webp',
            'image/avif': '.avif',
            'image/tiff': '.tiff',
            'image/tif': '.tif',
            'image/psd': '.psd',
            'image/exr': '.exr',
            'image/xcf': '.xcf',
            'application/x-krita': '.kra',
            'application/x-pdn': '.pdn'
        };
        extMap['image/x-icon'] = '.ico';
        const outExt = extMap[mime] || '.png';
        const outName = nameOrig.replace(/(\.[^.]+)?$/, outExt);

        // Normalizza qualità (0.1 - 1.0)
        let q = (typeof quality === 'number') ? quality : 0.92;
        if (q <= 0 || q > 1) q = 0.92;

        // Funzione che disegna un ImageBitmap o Image su canvas e restituisce il blob nel formato richiesto
        async function drawAndExportBitmap(bitmap) {
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0);

            if (mime === 'image/bmp') {
                return canvasToBMPBlob(canvas);
            }

            if (mime === 'image/x-icon') {
                return await canvasToICOBlob(canvas);
            }

            if (mime === 'application/x-pdn') {
                return await canvasToPDNBlob(canvas);
            }

            const qArg = (mime === 'image/png') ? undefined : q;
            return await new Promise((resolve) => canvas.toBlob(resolve, mime, qArg));
        }

        function canvasToBMPBlob(canvas) {
            const w = canvas.width;
            const h = canvas.height;
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, w, h).data;

            const rowSize = Math.floor((24 * w + 31) / 32) * 4; // bytes per row (padded)
            const pixelArraySize = rowSize * h;
            const headerSize = 54;
            const buffer = new ArrayBuffer(headerSize + pixelArraySize);
            const view = new DataView(buffer);

            // BMP header
            view.setUint8(0, 0x42); view.setUint8(1, 0x4D); // 'BM'
            view.setUint32(2, headerSize + pixelArraySize, true);
            view.setUint32(6, 0, true);
            view.setUint32(10, headerSize, true);

            // DIB header (BITMAPINFOHEADER)
            view.setUint32(14, 40, true);
            view.setInt32(18, w, true);
            view.setInt32(22, h, true);
            view.setUint16(26, 1, true);
            view.setUint16(28, 24, true);
            view.setUint32(30, 0, true);
            view.setUint32(34, pixelArraySize, true);
            view.setInt32(38, 2835, true);
            view.setInt32(42, 2835, true);
            view.setUint32(46, 0, true);
            view.setUint32(50, 0, true);

            // Pixel data (BGR, bottom-up)
            let p = headerSize;
            const pad = rowSize - w * 3;
            for (let y = h - 1; y >= 0; y--) {
                for (let x = 0; x < w; x++) {
                    const i = (y * w + x) * 4;
                    view.setUint8(p++, imageData[i + 2]); // B
                    view.setUint8(p++, imageData[i + 1]); // G
                    view.setUint8(p++, imageData[i]);     // R
                }
                for (let k = 0; k < pad; k++) view.setUint8(p++, 0);
            }

            return new Blob([buffer], { type: 'image/bmp' });
        }

        // Genera un file .ico (container) contenente PNG a varie risoluzioni.
        async function canvasToICOBlob(canvas) {
            const sizes = [256, 128, 64, 48, 32, 16];
            const pngBuffers = [];
            const width = canvas.width, height = canvas.height;

            for (const s of sizes) {
                // Creiamo un canvas temporaneo di dimensione s x s
                const tmp = document.createElement('canvas');
                tmp.width = s; tmp.height = s;
                const tctx = tmp.getContext('2d');
                // disegniamo con fit (manteniamo proporzioni centrando)
                tctx.clearRect(0,0,s,s);
                tctx.drawImage(canvas, 0, 0, width, height, 0, 0, s, s);
                const blob = await new Promise((res) => tmp.toBlob(res, 'image/png'));
                if (blob) {
                    const buf = await blob.arrayBuffer();
                    pngBuffers.push(new Uint8Array(buf));
                }
            }

            if (pngBuffers.length === 0) return null;

            const count = pngBuffers.length;
            const headerSize = 6 + 16 * count;
            let dataSize = 0;
            for (const b of pngBuffers) dataSize += b.length;

            const outBuffer = new ArrayBuffer(headerSize + dataSize);
            const view = new DataView(outBuffer);
            // ICONDIR
            view.setUint16(0, 0, true); // reserved
            view.setUint16(2, 1, true); // type: 1 = ICO
            view.setUint16(4, count, true);

            let offset = headerSize;
            // directory entries
            for (let i = 0; i < count; i++) {
                const s = sizes[i];
                const png = pngBuffers[i];
                const entryOffset = 6 + i * 16;
                view.setUint8(entryOffset + 0, s === 256 ? 0 : s); // width (0 means 256)
                view.setUint8(entryOffset + 1, s === 256 ? 0 : s); // height
                view.setUint8(entryOffset + 2, 0); // color count
                view.setUint8(entryOffset + 3, 0); // reserved
                view.setUint16(entryOffset + 4, 0, true); // planes (0 for PNG)
                view.setUint16(entryOffset + 6, 0, true); // bitcount (0 for PNG)
                view.setUint32(entryOffset + 8, png.length, true); // bytes in resource
                view.setUint32(entryOffset + 12, offset, true); // image offset
                offset += png.length;
            }

            // write image data
            const outU8 = new Uint8Array(outBuffer);
            let pos = headerSize;
            for (const b of pngBuffers) {
                outU8.set(b, pos);
                pos += b.length;
            }

            return new Blob([outBuffer], { type: 'image/x-icon' });
        }

        // Supporto PDN output: generiamo un PNG e lo inseriamo in un archivio .pdn (ZIP) se JSZip è presente
        async function canvasToPDNBlob(canvas) {
            if (typeof JSZip === 'undefined') {
                alert('Per esportare in PDN è richiesta la libreria JSZip (aggiungi wwwroot/js/vendor/jszip.min.js)');
                return null;
            }
            // creiamo la PNG intermedia
            const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
            const zip = new JSZip();
            // PDN minimale: includiamo mergedimage.png; potrebbe non essere pienamente compatibile con tutte le versioni di Paint.NET
            zip.file('mergedimage.png', pngBlob);
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            return new Blob([zipBlob], { type: 'application/x-pdn' });
        }

        // Batch mode: se l'utente seleziona più file, convertiamo ciascuno (formati raster comuni)
        // e impacchettiamo i risultati in un .zip usando JSZip (caricato dinamicamente se necessario).
        const filesList = input.files ? Array.from(input.files) : [];
        if (filesList.length > 1) {
            const supportedBatch = ['image/png','image/jpeg','image/jpg','image/webp','image/avif','image/bmp','image/tiff','image/x-icon'];
            if (!supportedBatch.includes(mime)) {
                alert('Batch conversion supporta solo PNG, JPEG, WEBP, AVIF, BMP, TIFF, ICO. Seleziona uno di questi formati.');
                input.value = '';
                return;
            }

            async function ensureJSZip() {
                if (typeof JSZip !== 'undefined') return;
                const candidates = [
                    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
                    'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
                    new URL('js/vendor/jszip.min.js', document.baseURI).href
                ];
                for (const url of candidates) {
                    try {
                        await new Promise((resolve, reject) => {
                            const s = document.createElement('script');
                            s.src = url;
                            s.async = true;
                            s.onload = () => resolve();
                            s.onerror = (e) => reject(e);
                            document.head.appendChild(s);
                        });
                        if (typeof JSZip !== 'undefined') return;
                    } catch (e) {
                        // try next
                    }
                }
            }

            try {
                await ensureJSZip();
                if (typeof JSZip === 'undefined') { alert('JSZip non disponibile: aggiungi js/vendor/jszip.min.js o connettiti a internet.'); input.value = ''; return; }

                const zip = new JSZip();
                for (let i = 0; i < filesList.length; i++) {
                    const f = filesList[i];
                    // skip formats that the simplified batch flow doesn't handle
                    if (f.type.includes('mpo') || /\.mpo$/i.test(f.name) || f.type.includes('psd') || /\.psd$/i.test(f.name) || /\.pdn$/i.test(f.name) || /\.exr$/i.test(f.name) || /\.xcf$/i.test(f.name) || /\.kra$/i.test(f.name)) {
                        console.warn('Batch: skipping unsupported file', f.name);
                        continue;
                    }

                    let blobOut = null;
                    try {
                        let bitmap = null;
                        try { bitmap = await createImageBitmap(f); } catch (e) {
                            // fallback to dataURL -> Image
                            const dataUrl = await new Promise((resolve, reject) => {
                                const fr = new FileReader();
                                fr.onload = () => resolve(fr.result);
                                fr.onerror = () => reject(fr.error || new Error('FileReader error'));
                                fr.readAsDataURL(f);
                            });
                            const img = new Image();
                            await new Promise((resolve, reject) => {
                                img.onload = () => resolve();
                                img.onerror = () => reject(new Error('Impossibile caricare l\'immagine'));
                                img.src = dataUrl;
                            });
                            const canvas = document.createElement('canvas');
                            canvas.width = img.naturalWidth || img.width;
                            canvas.height = img.naturalHeight || img.height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0);
                            blobOut = await new Promise((resolve) => canvas.toBlob(resolve, mime, mime === 'image/png' ? undefined : q));
                        }

                        if (!blobOut && bitmap) {
                            blobOut = await drawAndExportBitmap(bitmap);
                        }
                    } catch (e) {
                        console.warn('Batch conversion failed for', f.name, e);
                    }

                    if (blobOut) {
                        const entryName = f.name.replace(/(\.[^.]+)?$/, outExt);
                        zip.file(entryName, blobOut);
                    }
                }

                const zipBlob = await zip.generateAsync({ type: 'blob' });
                const base = (nameOrig && nameOrig !== 'output') ? nameOrig.replace(/(\.[^.]+)?$/, '') : 'converted_images';
                const zipName = base + '_converted.zip';
                const url = URL.createObjectURL(zipBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = zipName;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 10000);
                input.value = '';
                return;
            } catch (e) {
                alert('Errore batch ZIP: ' + e);
                input.value = '';
                return;
            }
        }

        // Nota: supportiamo ora l'encoding TIFF client-side tramite UTIF.encodeImage (se UTIF.js è caricato)

        // Gestione HEIC (usa heic2any) per file in input
        async function loadHeic2any() {
            if (typeof heic2any !== 'undefined') return;
            const candidates = [
                'https://unpkg.com/heic2any@0.0.6/dist/heic2any.min.js',
                'https://cdn.jsdelivr.net/npm/heic2any@0.0.6/dist/heic2any.min.js',
                new URL('js/vendor/heic2any.min.js', document.baseURI).href
            ];

            for (const url of candidates) {
                try {
                    await new Promise((resolve, reject) => {
                        const s = document.createElement('script');
                        s.src = url;
                        s.async = true;
                        s.onload = () => resolve();
                        s.onerror = (e) => reject(e);
                        document.head.appendChild(s);
                    });
                    if (typeof heic2any !== 'undefined') return;
                } catch (e) {
                    // proviamo il prossimo URL
                }
            }
        }

        if (file.type.includes('heic') || /\.heic$/i.test(nameOrig)) {
            // proviamo a caricare heic2any dinamicamente se necessario
            if (typeof heic2any === 'undefined') {
                try { await loadHeic2any(); } catch (e) { /* ignore */ }
            }

            if (typeof heic2any !== 'undefined') {
                try {
                    let toType = mime;
                    if (!['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(toType)) toType = 'image/png';
                    const opts = { blob: file, toType: toType };
                    if (typeof q === 'number') opts.quality = q;
                    const converted = await heic2any(opts);
                    const blob = converted instanceof Blob ? converted : (Array.isArray(converted) ? converted[0] : null);
                    if (!blob) { alert('Impossibile convertire HEIC'); input.value = ''; return; }
                    downloadBlob(blob, outName);
                } catch (e) {
                    alert('Errore conversione HEIC (heic2any): ' + e);
                    input.value = '';
                }
                return;
            }

            // Se heic2any non è disponibile, proviamo createImageBitmap
            try {
                const bitmap = await createImageBitmap(file);
                const outBlob = await drawAndExportBitmap(bitmap);
                if (!outBlob) { alert('Impossibile creare il file di output.'); input.value = ''; return; }
                downloadBlob(outBlob, outName);
                input.value = '';
                return;
            } catch (e) {
                alert('HEIC non supportato dal browser e heic2any non disponibile. Per conversione HEIC client-side installa la libreria heic2any o usa il server.');
                input.value = '';
                return;
            }
        }

        // Gestione MPO (Multi Picture Object) - split to multiple JPEGs
        console.log('imageConverter: checking MPO for', nameOrig);
        if (file.type.includes('mpo') || /\.mpo$/i.test(nameOrig)) {
            try {
                const buf = await file.arrayBuffer();
                const bytes = new Uint8Array(buf);
                const starts = [];
                for (let i = 0; i < bytes.length - 1; i++) {
                    if (bytes[i] === 0xFF && bytes[i + 1] === 0xD8) starts.push(i);
                }
                if (starts.length === 0) { alert('MPO non valido: nessuna immagine JPEG trovata'); input.value = ''; return; }

                const frames = [];
                for (let s = 0; s < starts.length; s++) {
                    const start = starts[s];
                    let end = bytes.length;
                    for (let k = start + 2; k < bytes.length - 1; k++) {
                        if (bytes[k] === 0xFF && bytes[k + 1] === 0xD9) { end = k + 2; break; }
                    }
                    frames.push(bytes.slice(start, end).buffer);
                }

                // Prepara dati utili per eventuale riparazione dei frame: alcuni MPO
                // utilizzano tabelle (DQT/DHT) solo nel primo frame. Qui estraiamo
                // l'header (tra SOI e SOS) del primo frame per poterlo innestare
                // su frame successivi che dovessero essere incompleti.
                const frameUint8s = frames.map(f => new Uint8Array(f));
                function findSOS(bytes) {
                    for (let i = 0; i < bytes.length - 1; i++) {
                        if (bytes[i] === 0xFF && bytes[i + 1] === 0xDA) return i;
                    }
                    return -1;
                }
                let headerFromFirst = null;
                const firstSOS = frameUint8s.length > 0 ? findSOS(frameUint8s[0]) : -1;
                if (firstSOS > 0) {
                    // slice exclude SOI (first two bytes)
                    headerFromFirst = frameUint8s[0].slice(2, firstSOS);
                }

                const total = frames.length;
                console.log('imageConverter: MPO frames parsed:', total);
                let downloadAll = false;
                if (total > 1) downloadAll = confirm(`File MPO con ${total} immagini. Vuoi scaricare tutte le immagini separate? (OK = tutte, Annulla = solo la prima)`);

                async function processFrameBuffer(frameBuf, idx) {
                    // Primo passo: creare sempre una JPEG intermedia dal frame MPO
                    const jpegBlob = new Blob([frameBuf], { type: 'image/jpeg' });
                    let repairedBlob = null; // se generiamo una versione riparata, la salviamo qui

                    // Ora usiamo quella JPEG come sorgente unica: creiamo un bitmap e poi
                    // convertiamo il bitmap nel formato scelto dall'utente (mime).
                    let bitmap = null;
                    try {
                        bitmap = await createImageBitmap(jpegBlob);
                    } catch (e) {
                        // fallback: proviamo prima con Object URL (più efficiente e spesso più affidabile)
                        let loaded = false;
                        let lastErr = e;

                        // Tentativo di riparazione: alcuni MPO omettono DQT/DHT nei frame
                        // successivi; proviamo a innestare l'header del primo frame
                        // (se disponibile) prima della porzione di scan del frame attuale.
                        if (headerFromFirst) {
                            try {
                                const curBytes = new Uint8Array(frameBuf);
                                const sos = findSOS(curBytes);
                                if (sos > 0) {
                                    const repairedLen = 2 + headerFromFirst.length + (curBytes.length - sos);
                                    const repaired = new Uint8Array(repairedLen);
                                    repaired[0] = 0xFF; repaired[1] = 0xD8; // SOI
                                    repaired.set(headerFromFirst, 2);
                                    repaired.set(curBytes.subarray(sos), 2 + headerFromFirst.length);
                                    repairedBlob = new Blob([repaired.buffer], { type: 'image/jpeg' });
                                } else {
                                    // Non abbiamo trovato SOS: proviamo a rimuovere il SOI corrente
                                    // e premettere l'header del primo frame davanti al resto dei dati.
                                    const tail = (curBytes.length > 2) ? curBytes.subarray(2) : curBytes;
                                    const repaired = new Uint8Array(2 + headerFromFirst.length + tail.length);
                                    repaired[0] = 0xFF; repaired[1] = 0xD8;
                                    repaired.set(headerFromFirst, 2);
                                    repaired.set(tail, 2 + headerFromFirst.length);
                                    repairedBlob = new Blob([repaired.buffer], { type: 'image/jpeg' });
                                }
                                    try {
                                        const repairedBitmap = await createImageBitmap(repairedBlob);
                                        const exportedRepaired = await drawAndExportBitmap(repairedBitmap);
                                        if (!exportedRepaired) { throw new Error('Impossibile creare output dal frame riparato'); }
                                        const fnameR = outName.replace(/(\.[^.]+)?$/, `_frame${idx + 1}${outExt}`);
                                        downloadBlob(exportedRepaired, fnameR);
                                        return;
                                    } catch (repErr) {
                                        lastErr = repErr;
                                        // prosegui con altri fallback
                                    }
                                }
                            } catch (repairErr) {
                                lastErr = repairErr;
                            }
                        }
                        try {
                            const objUrl = URL.createObjectURL(jpegBlob);
                            const img = new Image();
                            await new Promise((resolve, reject) => {
                                img.onload = () => resolve();
                                img.onerror = () => reject(new Error('Impossibile caricare l\'immagine (frame MPO) via objectURL'));
                                img.src = objUrl;
                            });
                            // disegniamo su canvas
                            const canvas = document.createElement('canvas');
                            canvas.width = img.naturalWidth || img.width;
                            canvas.height = img.naturalHeight || img.height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0);
                            const outBlob = await new Promise((resolve) => canvas.toBlob(resolve, mime, mime === 'image/png' ? undefined : q));
                            const fname = outName.replace(/(\.[^.]+)?$/, `_frame${idx + 1}${outExt}`);
                            downloadBlob(outBlob, fname);
                            URL.revokeObjectURL(objUrl);
                            loaded = true;
                            return;
                        } catch (objErr) {
                            lastErr = objErr;
                        }

                        if (!loaded) {
                            // ultima risorsa: dataURL
                            try {
                                const dataUrl = await new Promise((resolve, reject) => {
                                    const fr = new FileReader();
                                    fr.onload = () => resolve(fr.result);
                                    fr.onerror = () => reject(fr.error || new Error('FileReader error'));
                                    fr.readAsDataURL(jpegBlob);
                                });
                                const img = new Image();
                                await new Promise((resolve, reject) => {
                                    img.onload = () => resolve();
                                    img.onerror = () => reject(new Error('Impossibile caricare l\'immagine (frame MPO) via dataURL'));
                                    img.src = dataUrl;
                                });
                                const canvas = document.createElement('canvas');
                                canvas.width = img.naturalWidth || img.width;
                                canvas.height = img.naturalHeight || img.height;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0);
                                const outBlob = await new Promise((resolve) => canvas.toBlob(resolve, mime, mime === 'image/png' ? undefined : q));
                                const fname = outName.replace(/(\.[^.]+)?$/, `_frame${idx + 1}${outExt}`);
                                downloadBlob(outBlob, fname);
                                return;
                            } catch (dataErr) {
                                lastErr = dataErr;
                            }
                        }

                        // Se arrivate qui, non siamo riusciti a caricare il frame: mostra diagnostica utile
                        const sizeInfo = (jpegBlob && typeof jpegBlob.size === 'number') ? `${jpegBlob.size} bytes` : 'dimensione sconosciuta';
                        const errMsg = (lastErr && lastErr.message) ? lastErr.message : String(lastErr);
                        console.error(`MPO frame ${idx + 1} load failed (${sizeInfo}):`, lastErr);
                        // Offriamo all'utente di scaricare il frame grezzo e (se esiste) la versione riparata per ispezione
                        const save = confirm(`Impossibile caricare l'immagine (frame ${idx + 1}, ${sizeInfo}): ${errMsg}\n\nVuoi scaricare il frame grezzo per ispezione? (OK = scarica)`);
                        if (save) {
                            const rawName = outName.replace(/(\.[^.]+)?$/, `_frame${idx + 1}_raw.jpg`);
                            try { downloadBlob(jpegBlob, rawName); } catch (dErr) { console.error('Errore download raw blob', dErr); }
                            if (repairedBlob) {
                                const repName = outName.replace(/(\.[^.]+)?$/, `_frame${idx + 1}_repaired.jpg`);
                                try { downloadBlob(repairedBlob, repName); } catch (dErr) { console.error('Errore download repaired blob', dErr); }
                            }
                        }
                        alert(`Impossibile caricare l'immagine (frame ${idx + 1}): ${errMsg}`);
                        return;
                    }

                    // Convertiamo infine il bitmap (ottenuto dall'intermedia JPEG) nel formato richiesto
                    const exported = await drawAndExportBitmap(bitmap);
                    if (!exported) { alert('Impossibile creare il file di output per frame ' + (idx + 1)); return; }
                    const fname = outName.replace(/(\.[^.]+)?$/, `_frame${idx + 1}${outExt}`);
                    downloadBlob(exported, fname);
                }

                if (downloadAll) {
                    for (let i = 0; i < frames.length; i++) { console.log('imageConverter: processing MPO frame', i+1); await processFrameBuffer(frames[i], i); }
                } else {
                    console.log('imageConverter: processing MPO first frame only');
                    await processFrameBuffer(frames[0], 0);
                }
                console.log('imageConverter: MPO processing complete');
                } catch (e) {
                const msg = (e && e.message) ? e.message : String(e);
                console.error('MPO parse error:', e);
                console.error(msg);
                alert('Errore parsing MPO: ' + msg);
            }
            input.value = '';
            return;
        }

        // Gestione PSD / EXR / XCF / KRA (input + output fall-back)
        if (file.type.includes('psd') || /\.psd$/i.test(nameOrig)) {
            // PSD input: prova a usare psd.js se presente
            if (typeof PSD !== 'undefined' && PSD.fromArrayBuffer) {
                try {
                    const buf = await file.arrayBuffer();
                    const psd = PSD.fromArrayBuffer(buf);
                    // try common outputs
                    if (psd.image && typeof psd.image.toPng === 'function') {
                        const pngBuffer = psd.image.toPng();
                        const blob = new Blob([pngBuffer], { type: 'image/png' });
                        const fname = outName.replace(/(\.[^.]+)?$/, '.png');
                        downloadBlob(blob, fname);
                    } else if (psd.image && typeof psd.image.toCanvas === 'function') {
                        const canvas = psd.image.toCanvas();
                        const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
                        downloadBlob(blob, outName.replace(/(\.[^.]+)?$/, '.png'));
                    } else {
                        alert('PSD decodificato ma API della libreria non riconosciuta.');
                    }
                } catch (e) {
                    alert('Errore decodifica PSD: ' + e);
                }
            } else {
                alert('PSD non supportato: aggiungi psd.js in wwwroot/js/vendor per abilitare la decodifica client-side.');
            }
            input.value = '';
            return;
        }

        if (file.type.includes('exr') || /\.exr$/i.test(nameOrig)) {
            // EXR: richiede decoder (tinyexr WASM o altro). Se presente, provare a usarlo.
            if (typeof EXR !== 'undefined' && typeof EXR.decode === 'function') {
                try {
                    const buf = await file.arrayBuffer();
                    const rgba = EXR.decode(buf); // api-dependent
                    // convert rgba -> canvas
                    const w = rgba.width || rgba.w || 0;
                    const h = rgba.height || rgba.h || 0;
                    if (w && h && rgba.data) {
                        const canvas = document.createElement('canvas');
                        canvas.width = w; canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        const imgData = new ImageData(new Uint8ClampedArray(rgba.data), w, h);
                        ctx.putImageData(imgData, 0, 0);
                        const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
                        downloadBlob(blob, outName.replace(/(\.[^.]+)?$/, '.png'));
                    } else alert('EXR decodificato ma formato risultato non riconosciuto.');
                } catch (e) { alert('Errore decodifica EXR: ' + e); }
            } else {
                alert('EXR non supportato client-side: aggiungi un decoder EXR (tinyexr WASM) in wwwroot/js/vendor.');
            }
            input.value = '';
            return;
        }

        if (file.type.includes('xcf') || /\.xcf$/i.test(nameOrig)) {
            if (typeof XCF !== 'undefined' && typeof XCF.parse === 'function') {
                try {
                    const buf = await file.arrayBuffer();
                    const img = XCF.parse(buf);
                    if (img && img.width && img.height && img.data) {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width; canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        const imgData = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
                        ctx.putImageData(imgData, 0, 0);
                        const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
                        downloadBlob(blob, outName.replace(/(\.[^.]+)?$/, '.png'));
                    } else alert('XCF decodificato ma risultato non valido.');
                } catch (e) { alert('Errore decodifica XCF: ' + e); }
            } else {
                alert('XCF non supportato client-side: aggiungi xcf.js in wwwroot/js/vendor per abilitare la decodifica.');
            }
            input.value = '';
            return;
        }

        // PDN (Paint.NET) input handling + fallback KRA handling
        if (file.type.includes('pdn') || /\.pdn$/i.test(nameOrig)) {
            // PDN è un archivio; cerchiamo immagini comuni (mergedimage.png, image.png, ecc.)
            if (typeof JSZip !== 'undefined') {
                try {
                    const buf = await file.arrayBuffer();
                    const zip = await JSZip.loadAsync(buf);
                    const candidates = ['mergedimage.png','mergedimage.jpg','merged.png','image.png','image.jpg','image0.png'];
                    let found = null;
                    for (const name of candidates) if (zip.file(name)) { found = name; break; }
                    if (!found) {
                        // fallback: cerca qualsiasi .png o .jpg nella radice
                        const allFiles = Object.keys(zip.files);
                        for (const n of allFiles) {
                            if (/\.png$/i.test(n) || /\.jpe?g$/i.test(n)) { found = n; break; }
                        }
                    }
                    if (!found) { alert('PDN aperto ma non ho trovato immagini comuni nel file.'); input.value = ''; return; }
                    const data = await zip.file(found).async('uint8array');
                    const blob = new Blob([data], { type: found.endsWith('.png') ? 'image/png' : 'image/jpeg' });
                    // convert or download depending on output
                    if (mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/jpg') {
                        downloadBlob(blob, outName.replace(/(\.[^.]+)?$/, found.substring(found.lastIndexOf('.'))));
                    } else if (mime === 'application/x-pdn') {
                        // If user wants PDN output, repackage the extracted image into a PDN zip
                        const zipOut = new JSZip();
                        zipOut.file('mergedimage.png', blob);
                        const zipBlob = await zipOut.generateAsync({ type: 'blob' });
                        downloadBlob(zipBlob, outName.replace(/(\.[^.]+)?$/, '.pdn'));
                    } else {
                        const bitmap = await createImageBitmap(blob);
                        const outBlob = await drawAndExportBitmap(bitmap);
                        downloadBlob(outBlob, outName);
                    }
                } catch (e) { alert('Errore apertura PDN: ' + e); }
            } else {
                alert('PDN non supportato client-side: aggiungi JSZip in wwwroot/js/vendor per estrarre le immagini interne.');
            }
            input.value = '';
            return;
        }

        if (file.type.includes('kra') || /\.kra$/i.test(nameOrig)) {
            // KRA è un zip; cerchiamo mergedimage.png usando JSZip se presente
            if (typeof JSZip !== 'undefined') {
                try {
                    const buf = await file.arrayBuffer();
                    const zip = await JSZip.loadAsync(buf);
                    const candidates = ['mergedimage.png', 'mergedimage.jpg', 'merged.png', 'merged.jpg'];
                    let found = null;
                    for (const name of candidates) if (zip.file(name)) { found = name; break; }
                    if (!found) { alert('KRA aperto ma non ho trovato mergedimage.* nel file.'); input.value = ''; return; }
                    const data = await zip.file(found).async('uint8array');
                    const blob = new Blob([data], { type: found.endsWith('.png') ? 'image/png' : 'image/jpeg' });
                    // convert or download depending on output
                    if (mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/jpg') {
                        downloadBlob(blob, outName.replace(/(\.[^.]+)?$/, found.substring(found.lastIndexOf('.'))));
                    } else {
                        // convert via createImageBitmap
                        const bitmap = await createImageBitmap(blob);
                        const outBlob = await drawAndExportBitmap(bitmap);
                        downloadBlob(outBlob, outName);
                    }
                } catch (e) { alert('Errore apertura KRA: ' + e); }
            } else {
                alert('KRA non supportato client-side: aggiungi JSZip in wwwroot/js/vendor per estrarre le immagini interne.');
            }
            input.value = '';
            return;
        }
        // Gestione TIFF (usa UTIF)
        if (file.type.includes('tiff') || file.type.includes('tif') || /\.tiff?$/i.test(nameOrig)) {
            if (typeof UTIF === 'undefined') {
                alert('TIFF non supportato: libreria UTIF mancante. Aggiungi UTIF.js in wwwroot/js.');
                return;
            }
            try {
                const buf = await file.arrayBuffer();
                const ifds = UTIF.decode(buf);
                if (!ifds || ifds.length === 0) { alert('TIFF non valido'); input.value = ''; return; }
                // Decodifica i pixel della prima immagine
                UTIF.decodeImage(buf, ifds[0]);
                const first = ifds[0];
                const rgba = UTIF.toRGBA8(first);
                const width = first.width;
                const height = first.height;
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                const imgData = new ImageData(new Uint8ClampedArray(rgba), width, height);
                ctx.putImageData(imgData, 0, 0);

                // Se l'output richiesto è TIFF, codifichiamo con UTIF.encodeImage
                if (mime === 'image/tiff' || mime === 'image/tif') {
                    if (typeof UTIF.encodeImage !== 'function') { alert('UTIF.encodeImage non disponibile.'); input.value = ''; return; }
                    const imgDataObj = ctx.getImageData(0, 0, width, height);
                    const tiffBuffer = UTIF.encodeImage(imgDataObj.data.buffer, width, height);
                    const tiffBlob = new Blob([tiffBuffer], { type: 'image/tiff' });
                    downloadBlob(tiffBlob, outName.replace(/\.(png|jpg|jpeg|webp|avif)$/i, '.tiff'));
                } else {
                    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, mime === 'image/png' ? undefined : 0.92));
                    if (!blob) { alert('Impossibile creare il file di output.'); input.value = ''; return; }
                    downloadBlob(blob, outName);
                }
            } catch (e) {
                alert('Errore conversione TIFF: ' + e);
            }
            input.value = '';
            return;
        }

        // Per gli altri formati (BMP, PNG, JPEG, WebP, ecc.) proviamo a usare createImageBitmap
        try {
            let bitmap = null;
            try {
                bitmap = await createImageBitmap(file);
            } catch (e) {
                // fallback a Image() via dataURL
                const dataUrl = await new Promise((resolve, reject) => {
                    const fr = new FileReader();
                    fr.onload = () => resolve(fr.result);
                    fr.onerror = () => reject(fr.error || new Error('FileReader error'));
                    fr.readAsDataURL(file);
                });
                const img = new Image();
                await new Promise((resolve, reject) => {
                    img.onload = () => resolve();
                    img.onerror = () => reject(new Error('Impossibile caricare l\'immagine'));
                    img.src = dataUrl;
                });
                // draw image into a canvas
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, mime === 'image/png' ? undefined : 0.92));
                if (!blob) { alert('Impossibile creare il file di output.'); input.value = ''; return; }
                downloadBlob(blob, outName);
                input.value = '';
                return;
            }

            const outBlob = await drawAndExportBitmap(bitmap);
            if (!outBlob) { alert('Impossibile creare il file di output.'); input.value = ''; return; }
            downloadBlob(outBlob, outName);
            input.value = '';
            return;
        } catch (err) {
            alert('Errore durante la conversione: ' + err);
            input.value = '';
            return;
        }
    }
};
