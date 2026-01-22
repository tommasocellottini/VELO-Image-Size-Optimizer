// --- Utilities ---

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function downloadSingle(file) {
    const a = document.createElement('a');
    a.href = file.compressedUrl;
    const ext = file.format === 'jpeg' ? 'jpg' : file.format;
    a.download = file.name.substring(0, file.name.lastIndexOf('.')) + '.' + ext;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

async function downloadZip() {
    if (state.files.length === 0) return;
    
    const zip = new JSZip();
    
    state.files.forEach(file => {
        const ext = file.format === 'jpeg' ? 'jpg' : file.format;
        const name = file.name.substring(0, file.name.lastIndexOf('.')) + '.' + ext;
        // Get blob data
        zip.file(name, file.compressedBlob);
    });

    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = "images.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}