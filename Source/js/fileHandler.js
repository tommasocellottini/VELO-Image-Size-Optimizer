// --- File Handling ---

const state = {
    files: [], // Array of file objects { id, name, originalFile, originalUrl, compressedBlob, compressedUrl, quality, format, size, compressedSize, savings }
    selectedFileId: null,
    globalFormat: 'jpeg',
    showingOriginal: false,
    zoom: { scale: 1, x: 0, y: 0, isDragging: false, startX: 0, startY: 0 }
};

async function handleFiles(fileList) {
    const newFiles = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (newFiles.length === 0) return;

    for (const file of newFiles) {
        // Avoid duplicates by name
        if (state.files.some(f => f.name === file.name)) continue;

        const fileEntry = {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            originalFile: file,
            originalUrl: URL.createObjectURL(file),
            size: file.size,
            quality: 75,
            format: state.globalFormat,
            compressedBlob: null,
            compressedUrl: null,
            compressedSize: 0,
            savings: 0
        };

        state.files.push(fileEntry);
        if (!state.selectedFileId) state.selectedFileId = fileEntry.id;
        
        // Process (Compress)
        await processFile(fileEntry);
    }

    if(els.fileInput) els.fileInput.value = ''; // Reset input
    updateUI();
}

async function processFile(fileEntry) {
    const img = new Image();
    img.src = fileEntry.originalUrl;
    await new Promise(r => img.onload = r);

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const mimeType = `image/${fileEntry.format === 'jpg' ? 'jpeg' : fileEntry.format}`;
    
    // Compression logic using Canvas API
    canvas.toBlob((blob) => {
        if (fileEntry.compressedUrl) URL.revokeObjectURL(fileEntry.compressedUrl);
        
        fileEntry.compressedBlob = blob;
        fileEntry.compressedUrl = URL.createObjectURL(blob);
        fileEntry.compressedSize = blob.size;
        
        // Calculate savings
        fileEntry.savings = 100 - ((blob.size / fileEntry.size) * 100);

        updateUI(); // Refresh UI with new stats
    }, mimeType, fileEntry.quality / 100);
}

function removeFile(id) {
    const idx = state.files.findIndex(f => f.id === id);
    if (idx > -1) {
        const f = state.files[idx];
        URL.revokeObjectURL(f.originalUrl);
        if (f.compressedUrl) URL.revokeObjectURL(f.compressedUrl);
        state.files.splice(idx, 1);
        
        if (state.selectedFileId === id) {
            state.selectedFileId = state.files.length > 0 ? state.files[0].id : null;
        }
        updateUI();
    }
}

function clearAll() {
    state.files.forEach(f => {
        URL.revokeObjectURL(f.originalUrl);
        if (f.compressedUrl) URL.revokeObjectURL(f.compressedUrl);
    });
    state.files = [];
    state.selectedFileId = null;
    updateUI();
}


