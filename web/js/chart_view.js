/**
 * Classical Audio Logarithmic Chart Manager using Chart.js.
 * Configured with standard classical audio decade lines (10, 100, 1k, 10k),
 * semi-major lines (20, 50, 200, 500, 2k, 5k, 20k), and full 1-2-3-4-5-6-7-8-9
 * sub-octave grid spacing across the complete 10 Hz – 20 kHz audio range (3.301 decades).
 *
 * Each of the full audio decades (10–100 Hz, 100 Hz–1 kHz, 1 kHz–10 kHz) occupies
 * an identical physical pixel width on screen, exactly matching REW and Audio Precision.
 */

// Explicit classical audio frequency grid lines from 10 Hz to 20,000 Hz
export const AUDIO_TICKS = [
  10, 20, 30, 40, 50, 60, 70, 80, 90,
  100, 200, 300, 400, 500, 600, 700, 800, 900,
  1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000,
  10000, 20000
];

// Major decade boundaries (bold primary grid lines)
export const MAJOR_DECADE_TICKS = [10, 100, 1000, 10000];

// Semi-major intermediate division lines
export const SEMI_MAJOR_TICKS = [20, 50, 200, 500, 2000, 5000, 20000];

// Standard audio frequency labels shown along the X-axis
export const LABELED_AUDIO_TICKS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

export const DB_RANGE_PRESETS = {
  default: { label: "Standard (-40 to +30 dB)", min: -40, max: 30, stepSize: 10 },
  tuning:  { label: "Tuning Zoom (-25 to +20 dB)", min: -25, max: 20, stepSize: 5 },
  critical:{ label: "Critical Focus (-15 to +15 dB)", min: -15, max: 15, stepSize: 5 },
  deep:    { label: "Wide Dynamic (-60 to +30 dB)", min: -60, max: 30, stepSize: 10 },
};

export class AudioChart {
  constructor(canvasElement, initialRangeKey = "default") {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext("2d");
    this.chart = null;
    this.currentRangeKey = initialRangeKey;
    this.initChart();
  }

  getRangeConfig() {
    return DB_RANGE_PRESETS[this.currentRangeKey] || DB_RANGE_PRESETS.default;
  }

  initChart() {
    const range = this.getRangeConfig();

    this.chart = new window.Chart(this.ctx, {
      type: "line",
      data: { datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 100 },
        interaction: { mode: "nearest", intersect: false, axis: "x" },
        plugins: {
          legend: {
            position: "top",
            labels: {
              color: "#f0f2f8",
              boxWidth: 16,
              font: { size: 12, weight: 500 },
              padding: 12,
              usePointStyle: true,
              pointStyle: "line"
            }
          },
          tooltip: {
            backgroundColor: "rgba(20, 22, 28, 0.95)",
            titleColor: "#00e5ff",
            bodyColor: "#f0f2f8",
            borderColor: "#3a4052",
            borderWidth: 1,
            padding: 10,
            callbacks: {
              title: (items) => `${Math.round(items[0].parsed.x)} Hz`,
              label: (item) => ` ${item.dataset.label}: ${item.parsed.y.toFixed(1)} dB`
            }
          }
        },
        scales: {
          x: {
            type: "logarithmic",
            min: 10,
            max: 20000,
            title: {
              display: true,
              text: "Frequency (Hz)",
              color: "#8b92a5",
              font: { size: 12, weight: 600 }
            },
            // Enforce exact classical audio grid ticks across complete 10 Hz – 20 kHz span
            afterBuildTicks: (scale) => {
              scale.ticks = AUDIO_TICKS.map(f => ({ value: f }));
            },
            grid: {
              color: (context) => {
                const v = Math.round(context.tick.value);
                if (MAJOR_DECADE_TICKS.includes(v)) return "#4e566d"; // Prominent decade grid line (10, 100, 1k, 10k)
                if (SEMI_MAJOR_TICKS.includes(v)) return "#2d3342";   // Semi-major grid line (20, 50, 200, 500, 2k, 5k, 20k)
                return "#191c24";                                     // Fine sub-grid line (30, 40, 60, 70, 80, 90, 300, etc.)
              },
              lineWidth: (context) => {
                const v = Math.round(context.tick.value);
                if (MAJOR_DECADE_TICKS.includes(v)) return 1.5;
                if (SEMI_MAJOR_TICKS.includes(v)) return 1.0;
                return 0.75;
              }
            },
            ticks: {
              color: (context) => {
                const v = Math.round(context.tick.value);
                if (MAJOR_DECADE_TICKS.includes(v)) return "#00e5ff"; // Subtle accent for decade labels
                return "#8b92a5";
              },
              font: (context) => {
                const v = Math.round(context.tick.value);
                const isDecade = MAJOR_DECADE_TICKS.includes(v);
                return {
                  size: isDecade ? 11.5 : 10.5,
                  weight: isDecade ? "600" : "500"
                };
              },
              autoSkip: false,
              callback: (val) => {
                const v = Math.round(Number(val));
                if (!LABELED_AUDIO_TICKS.includes(v)) return null;
                return v >= 1000 ? `${v / 1000}k` : v.toString();
              }
            }
          },
          y: {
            min: range.min,
            max: range.max,
            title: {
              display: true,
              text: "Target Level (dB)",
              color: "#8b92a5",
              font: { size: 12, weight: 600 }
            },
            grid: {
              color: (context) => {
                return context.tick.value === 0 ? "#4e566d" : "#202430";
              },
              lineWidth: (context) => {
                return context.tick.value === 0 ? 1.5 : 1;
              }
            },
            ticks: {
              color: "#8b92a5",
              stepSize: range.stepSize,
              font: { size: 11 },
              callback: (val) => `${val > 0 ? "+" : ""}${val} dB`
            }
          }
        }
      }
    });
  }

  setDbRange(presetKey) {
    if (!DB_RANGE_PRESETS[presetKey]) return;
    this.currentRangeKey = presetKey;
    const range = DB_RANGE_PRESETS[presetKey];

    this.chart.options.scales.y.min = range.min;
    this.chart.options.scales.y.max = range.max;
    this.chart.options.scales.y.ticks.stepSize = range.stepSize;
    this.chart.update();
  }

  updateDatasets(datasets) {
    this.chart.data.datasets = datasets;
    this.chart.update();
  }

  resize() {
    if (this.chart) this.chart.resize();
  }
}
