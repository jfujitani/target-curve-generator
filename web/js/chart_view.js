/**
 * Classical Audio Logarithmic Chart Manager using Chart.js.
 * Configured with standard decade lines (20, 100, 1k, 10k, 20k) and audio subgrid.
 */

const MAJOR_AUDIO_TICKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

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
            min: 20,
            max: 20000,
            title: {
              display: true,
              text: "Frequency (Hz)",
              color: "#8b92a5",
              font: { size: 12, weight: 600 }
            },
            grid: {
              color: (context) => {
                const v = Math.round(context.tick.value);
                if ([20, 100, 1000, 10000, 20000].includes(v)) return "#42495d"; // Major decade lines
                if (MAJOR_AUDIO_TICKS.includes(v)) return "#282d3b";            // Semi-major
                return "#191d26";                                              // Sub-octave lines
              },
              lineWidth: (context) => {
                const v = Math.round(context.tick.value);
                return [20, 100, 1000, 10000, 20000].includes(v) ? 1.5 : 0.8;
              }
            },
            ticks: {
              color: "#8b92a5",
              font: { size: 11 },
              autoSkip: false,
              callback: (val) => {
                const v = Math.round(Number(val));
                if (!MAJOR_AUDIO_TICKS.includes(v)) return null;
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
                return context.tick.value === 0 ? "#42495d" : "#202430";
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
