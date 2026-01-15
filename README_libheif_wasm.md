README: Compilare libheif (HEIC) in WASM per uso client-side
===========================================================

Scopo
-----
Questa guida spiega come compilare una build WebAssembly di libheif (decoder+encoder)
con il wrapper JS necessario (Emscripten) così da poter generare file `.js` + `.wasm`
utilizzabili direttamente nel browser (senza inviare file al server).

Panoramica
---------
- Il solo file `.wasm` non è sufficiente: la build Emscripten produce anche un file JS "glue"
  che configura l'import object e le API esposte. Senza quel JS la instanziazione fallisce con
  errori del tipo "Import #0 'a' ... module is not an object or function".
- Il repository `elheif` fornisce un wrapper già pronto che compila libheif + codec in WASM.

Prerequisiti (Windows)
-----------------------
- Git
- Python 3
- CMake
- Visual Studio Build Tools (MSVC) o toolchain compatibile
- nasm o yasm (per alcuni codec)
- Emscripten SDK (emsdk) (https://emscripten.org/docs/getting_started/downloads.html)
- Node.js + npm (opzionale, se il repo usa npm/pnpm per build helper)

Procedure consigliata (usando il progetto elheif)
-----------------------------------------------
1. Installa e attiva emsdk:

   git clone https://github.com/emscripten-core/emsdk.git
   cd emsdk
   ./emsdk install latest
   ./emsdk activate latest
   ./emsdk_env.ps1

2. Clona `elheif` e costruisci:

   git clone https://github.com/hpp2334/elheif.git
   cd elheif

   # Se il progetto fornisce script npm/pnpm:
   npm install
   npm run build

   # Oppure usa CMake con emcmake/emmake (se non esiste uno script ready-made):
   mkdir build && cd build
   emcmake cmake .. -DCMAKE_BUILD_TYPE=Release
   emmake make -j4

3. Risultati attesi

- La build dovrebbe generare un file JS (es. `elheif.js`, `elheif-wasm.js` o nella cartella `pkg/`) e
  un file `.wasm` corrispondente.

4. Copia in progetto Blazor

   Copia i file generati in `wwwroot/js/vendor/` del tuo progetto:

   - wwwroot/js/vendor/elheif.js
   - wwwroot/js/vendor/elheif.wasm
   (o la cartella `wwwroot/js/vendor/elheif/pkg/` se il progetto ne genera una)

5. Avvia l'app e testa

   - Il loader aggiornato (`wwwroot/js/vendor/libheif-loader.js`) prova prima a caricare
     il wrapper JS e chiamare `ensureInitialized()` (o attendere `Module.onRuntimeInitialized`).
   - Se presente, `window.elheifApi` sarà impostato e puoi chiamare `jsEncodeImage()`/`jsDecodeImage()`
     secondo l'API del wrapper.

Se non vuoi compilare localmente
--------------------------------
- Puoi usare una build precompilata (cioè trovare una release che fornisca `elheif.js` + `.wasm`) e
  copiarla in `wwwroot/js/vendor/`.

Se hai bisogno, posso generare comandi più dettagliati per la tua macchina, o preparare
un file .bat/.ps1 che provi ad automatizzare l'intero flusso (ma richiederà comunque emsdk
installato e configurato localmente).
