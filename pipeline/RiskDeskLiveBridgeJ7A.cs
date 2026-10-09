#region Using declarations
using System;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.IO;
using NinjaTrader.Cbi;
using NinjaTrader.Data;
using NinjaTrader.NinjaScript;
#endregion

namespace NinjaTrader.NinjaScript.Indicators
{
    public class RiskDeskLiveBridgeJ7A : Indicator
    {
        private static readonly object FileLock = new object();
        private string outputFile;
        private DateTime[] lastWrittenUtc;

        [NinjaScriptProperty]
        [Display(Name = "NQ Instrument", Order = 1, GroupName = "Instruments")]
        public string NQInstrument { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "ZQ Instrument", Order = 2, GroupName = "Instruments")]
        public string ZQInstrument { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "ZT Instrument", Order = 3, GroupName = "Instruments")]
        public string ZTInstrument { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "ZN Instrument", Order = 4, GroupName = "Instruments")]
        public string ZNInstrument { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Output Folder", Order = 1, GroupName = "Output")]
        public string OutputFolder { get; set; }

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Description = "Risk Desk J7A live bridge. Writes 1-minute NQ/ZQ/ZT/ZN bars to a local CSV. Does not place orders.";
                Name = "RiskDeskLiveBridgeJ7A";
                Calculate = Calculate.OnBarClose;
                IsOverlay = true;
                DisplayInDataBox = false;
                PaintPriceMarkers = false;
                IsSuspendedWhileInactive = false;

                NQInstrument = "NQ 12-26";
                ZQInstrument = "ZQ 11-26";
                ZTInstrument = "ZT 12-26";
                ZNInstrument = "ZN 12-26";

                OutputFolder = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                    "NinjaTrader 8",
                    "LaranjinhaML",
                    "Live");
            }
            else if (State == State.Configure)
            {
                AddDataSeries(NQInstrument, BarsPeriodType.Minute, 1);
                AddDataSeries(ZQInstrument, BarsPeriodType.Minute, 1);
                AddDataSeries(ZTInstrument, BarsPeriodType.Minute, 1);
                AddDataSeries(ZNInstrument, BarsPeriodType.Minute, 1);
            }
            else if (State == State.DataLoaded)
            {
                Directory.CreateDirectory(OutputFolder);
                outputFile = Path.Combine(OutputFolder, "RiskDeskLiveBridge_J7A.csv");
                lastWrittenUtc = new DateTime[BarsArray.Length];

                lock (FileLock)
                {
                    if (!File.Exists(outputFile))
                        File.WriteAllText(outputFile, "ts_utc,asset,symbol,price,volume,source" + Environment.NewLine);
                }
            }
        }

        protected override void OnBarUpdate()
        {
            if (BarsInProgress < 1 || BarsInProgress > 4)
                return;
            if (CurrentBars[BarsInProgress] < 0)
                return;

            string asset;
            switch (BarsInProgress)
            {
                case 1: asset = "NQ"; break;
                case 2: asset = "ZQ"; break;
                case 3: asset = "ZT"; break;
                case 4: asset = "ZN"; break;
                default: return;
            }

            DateTime localBarTime = Times[BarsInProgress][0];
            DateTime unspecified = DateTime.SpecifyKind(localBarTime, DateTimeKind.Unspecified);
            DateTime utc;
            try
            {
                utc = TimeZoneInfo.ConvertTimeToUtc(unspecified, Core.Globals.GeneralOptions.TimeZoneInfo);
            }
            catch
            {
                return;
            }

            if (lastWrittenUtc[BarsInProgress] == utc)
                return;

            string symbol = BarsArray[BarsInProgress].Instrument.FullName;
            double price = Closes[BarsInProgress][0];
            double volume = Volumes[BarsInProgress][0];

            string line = string.Join(",",
                utc.ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture),
                asset,
                EscapeCsv(symbol),
                price.ToString("R", CultureInfo.InvariantCulture),
                volume.ToString("R", CultureInfo.InvariantCulture),
                "NINJATRADER");

            lock (FileLock)
                File.AppendAllText(outputFile, line + Environment.NewLine);

            lastWrittenUtc[BarsInProgress] = utc;
        }

        private static string EscapeCsv(string value)
        {
            if (value == null) return "";
            if (value.Contains(",") || value.Contains(""") || value.Contains("\n"))
                return """ + value.Replace(""", """") + """;
            return value;
        }
    }
}
