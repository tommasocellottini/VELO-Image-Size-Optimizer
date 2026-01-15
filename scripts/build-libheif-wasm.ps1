<#
build-libheif-wasm.ps1

Script d'aiuto (Windows PowerShell) per compilare libheif/elheif in un bundle JS+WASM
da copiare in `wwwroot/js/vendor/` del progetto Blazor.

Non esegue tutto automaticamente: verifica prerequisiti e mostra i comandi consigliati.

Usalo da PowerShell (esegui come Administrator se necessario):
  pwsh scripts\build-libheif-wasm.ps1

#>

function Check-Command($cmd) {
    $null = Get-Command $cmd -ErrorAction SilentlyContinue
    return $?
}

Write-Host "=== Build helper per libheif WASM ==="

if (-not (Check-Command 'git')) { Write-Host "git non trovato; installalo e riprova."; exit 1 }

Write-Host "Verifico emsdk (Emscripten)..."
if (-not (Test-Path "$env:EMSDK")) {
    Write-Host "Variabile EMSDK non impostata. Se non hai emsdk, segui le istruzioni in README_libheif_wasm.md" -ForegroundColor Yellow
} else {
    Write-Host "EMSDK trovato in $env:EMSDK" -ForegroundColor Green
}

Write-Host "Passaggi consigliati (esegui a mano):`n"
Write-Host "1) Installa emsdk e attivalo nella sessione PowerShell:" -ForegroundColor Cyan
Write-Host "   git clone https://github.com/emscripten-core/emsdk.git"
Write-Host "   cd emsdk"
Write-Host "   ./emsdk install latest"
Write-Host "   ./emsdk activate latest"
Write-Host "   ./emsdk_env.ps1" -ForegroundColor Gray

Write-Host "2) Installa dipendenze di sistema: cmake, python3, yasm/nasm" -ForegroundColor Cyan

Write-Host "3) Clona il progetto elheif (wrapper già pronto):" -ForegroundColor Cyan
Write-Host "   git clone https://github.com/hpp2334/elheif.git"
Write-Host "   cd elheif" -ForegroundColor Gray

Write-Host "4) Costruzione (esempio usando npm/pnpm se presente nel repo):" -ForegroundColor Cyan
Write-Host "   npm install  # oppure pnpm install"
Write-Host "   npm run build  # o pnpm build  (questo dovrebbe generare pkg/elheif.js + wasm)" -ForegroundColor Gray

Write-Host "SE il repo non offre script pronti, puoi usare CMake+emcmake/emmake:" -ForegroundColor Cyan
Write-Host "   mkdir build && cd build"
Write-Host "   emcmake cmake .. -DCMAKE_BUILD_TYPE=Release"
Write-Host "   emmake make -j$(nproc)"

Write-Host "5) Copia gli artefatti generati (es. elheif.js / elheif.wasm o pkg/) in:" -ForegroundColor Cyan
Write-Host "   <tuo-progetto>\\wwwroot\\js\\vendor\\" -ForegroundColor Gray

Write-Host "Note:" -ForegroundColor Yellow
Write-Host " - La build di libheif richiede codec (libde265, kvazaar) che devono essere compilati insieme; il progetto elheif semplifica questo." -ForegroundColor Gray
Write-Host " - Se incontri errori di memoria, puoi abilitare ALLOW_MEMORY_GROWTH o aumentare initialMemory nelle flags emcc." -ForegroundColor Gray

Write-Host "Ho terminato: leggi README_libheif_wasm.md per istruzioni dettagliate." -ForegroundColor Green

exit 0
