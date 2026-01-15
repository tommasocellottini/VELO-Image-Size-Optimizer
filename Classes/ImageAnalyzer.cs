using System;
using System.Threading.Tasks;

namespace Velo.Classes
{
    public class ImageAnalyzer
    {
        public record SamplingResult(string Mode, bool Confirmed420);

        public static async Task<SamplingResult> GetJpegSamplingAsync(byte[] data)
        {
            // Cerchiamo il marker SOF0 (0xFF, 0xC0)
            for (int i = 0; i < data.Length - 10; i++)
            {
                if (data[i] == 0xFF && data[i + 1] == 0xC0)
                {
                    // Il byte dei componenti è a i + 9
                    int components = data[i + 9];
                    if (components == 3) // Standard YCbCr
                    {
                        // Leggiamo il fattore di campionamento del primo componente (Y)
                        // All'offset i + 11 troviamo il byte dei fattori H/V
                        int yFactors = data[i + 11];
                        int h = (yFactors >> 4) & 0x0F;
                        int v = yFactors & 0x0F;

                        // Se H=2 e V=2 per la luminanza, e i successivi sono 1, è 4:2:0
                        if (h == 2 && v == 2)
                            return new SamplingResult("YCbCrRatio420", true);
                    }
                }
            }
            return new SamplingResult("Unknown", false);
        }
    }
}