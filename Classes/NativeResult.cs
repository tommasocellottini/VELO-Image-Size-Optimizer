namespace Velo.Classes
{

    public class NativeResult
    {
        public byte[] Data { get; set; } = Array.Empty<byte>();
        public string Url { get; set; } = "";
        public long OrigSize { get; set; }
        public string FileName { get; set; } = "";
    }
}