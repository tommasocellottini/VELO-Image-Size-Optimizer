namespace Velo.Classes
{

    public class VeloProcessedResult
    {
        public string FileName { get; set; } = "";
        public string Url { get; set; } = "";
        public byte[] Data { get; set; }
        public long CompressedSize { get; set; }
        public double Savings { get; set; }
    }
}