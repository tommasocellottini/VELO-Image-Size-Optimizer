namespace Velo.Classes
{

    public class FileEntry
    {
        public string FileId { get; set; } = "";
        public string Name { get; set; } = "";
        public long Size { get; set; } // Peso Originale
        public bool Is420 { get; set; }
        public string? OriginalUrl { get; set; }


        // Campi per il post-ottimizzazione
        public long? CompressedSize { get; set; }
        public double? Savings { get; set; }
        public string? Url { get; set; }
        public byte[]? Data { get; set; }
        public int Quality { get; set; } = 75; // Qualità specifica per questo file
        public string OutputFormat { get; set; } = "jpeg";
    }
}