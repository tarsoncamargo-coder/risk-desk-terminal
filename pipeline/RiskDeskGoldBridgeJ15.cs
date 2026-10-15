#region Using declarations
using System;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.IO;
using NinjaTrader.Data;
using NinjaTrader.NinjaScript;
#endregion

// J15 Gold: data-only NinjaTrader 8 bridge.
// Install on an MGC 1-minute chart. Does not touch Laranjinha, PR/DP/GF, orders or plots.
// The bar timestamp is the NinjaTrader end-of-minute time (not the start of the minute).
// LIVE ONLY: historical NinjaTrader processing is intentionally excluded.
namespace NinjaTrader.NinjaScript.Indicators
{
    public class RiskDeskGoldBridgeJ15 : Indicator
    {
        private static readonly object OutputLock = new object();
        private string csvFile;
        private DateTime lastWrittenUtc = DateTime.MinValue;
        private bool chartValidated;
        private bool warnedAboutChart;

        [NinjaScriptProperty]
        [Display(Name = "Output Folder", Order = 1, GroupName = "Bridge")]
        public string OutputFolder { get; set; }

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Name = "RiskDeskGoldBridgeJ15";
                Description = "Data-only MGC 1-minute closed-bar bridge for Risk Desk. No orders, drawings, strategy changes or historical replay.";
                Calculate = Calculate.OnBarClose;
                IsOverlay = true;
                DisplayInDataBox = false;
                PaintPriceMarkers = false;
                IsSuspendedWhileInactive = false;
                OutputFolder = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                    "NinjaTrader 8", "LaranjinhaML", "Live");
            }
            else if (State == State.DataLoaded)
            {
                chartValidated = false;
                warnedAboutChart = false;
                if (Instrument != null && Instrument.MasterInstrument != null &&
                    String.Equals(Instrument.MasterInstrument.Name, "MGC",
                        StringComparison.OrdinalIgnoreCase) &&
                    BarsPeriod != null &&
                    BarsPeriod.BarsPeriodType == BarsPeriodType.Minute &&
                    BarsPeriod.Value == 1)
                {
                    chartValidated = true;
                    Directory.CreateDirectory(OutputFolder);
                    csvFile = Path.Combine(OutputFolder, "RiskDeskGoldBridge_MGC_M1.csv");
                    lock (OutputLock)
                    {
                        if (!File.Exists(csvFile))
                        {
                            File.WriteAllText(csvFile,
                                "bar_timestamp_utc,asset,contract,close_price,volume,source,nt_observed_at_utc"
                                + Environment.NewLine);
                        }
                    }
                }
                else
                {
                    Print("[RiskDesk Gold J15] Add this indicator ONLY to an MGC 1-minute chart. Nothing will be written.");
                    warnedAboutChart = true;
                }
            }
        }

        protected override void OnBarUpdate()
        {
            // Never backfill a bar received during historical processing/reload.
            if (State != State.Realtime || !chartValidated || BarsInProgress != 0)
                return;

            if (CurrentBar < 1 || String.IsNullOrWhiteSpace(csvFile))
                return;

            try
            {
                DateTime chartTime = DateTime.SpecifyKind(Time[0], DateTimeKind.Unspecified);
                DateTime barUtc = TimeZoneInfo.ConvertTimeToUtc(
                    chartTime, Core.Globals.GeneralOptions.TimeZoneInfo);
                DateTime observedUtc = DateTime.UtcNow;

                // OnBarClose should be observed shortly after the stamped bar end.
                // A stale queue/replay and a future clock are NOT live closed bars.
                double lagMinutes = (observedUtc - barUtc).TotalMinutes;
                if (lagMinutes < -1.0 || lagMinutes > 3.0)
                    return;
                if (barUtc <= lastWrittenUtc)
                    return;

                double closePrice = Close[0];
                double barVolume = Volume[0];
                if (Double.IsNaN(closePrice) || Double.IsInfinity(closePrice) ||
                    closePrice <= 100 || closePrice >= 100000 ||
                    barVolume < 0 || Double.IsNaN(barVolume) || Double.IsInfinity(barVolume))
                    return;

                string contract = Instrument.FullName;
                if (String.IsNullOrEmpty(contract) ||
                    !contract.StartsWith("MGC ", StringComparison.OrdinalIgnoreCase))
                    return;

                string line = String.Join(",",
                    barUtc.ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture),
                    "MGC",
                    contract,
                    closePrice.ToString("R", CultureInfo.InvariantCulture),
                    barVolume.ToString("R", CultureInfo.InvariantCulture),
                    "NINJATRADER_GOLD_BRIDGE",
                    observedUtc.ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture));

                lock (OutputLock)
                {
                    File.AppendAllText(csvFile, line + Environment.NewLine);
                }
                lastWrittenUtc = barUtc;
            }
            catch (Exception ex)
            {
                Print("[RiskDesk Gold J15] Write error: " + ex.Message);
            }
        }
    }
}
