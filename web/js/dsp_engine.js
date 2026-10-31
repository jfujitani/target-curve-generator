/**
 * Mathematical DSP Engine for Acoustic Crossovers and Gain Summation.
 * Mirroring the analytical cascaded biquad transfer functions in filter_engine.py.
 */

export const ISO_FREQUENCIES_31 = [
  20, 25, 31, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500,
  630, 800, 1000, 1200, 1600, 2000, 2500, 3100, 4000, 5000, 6300, 8000,
  10000, 12000, 16000, 20000
];

// 220 logarithmically spaced calculation points for ultra-smooth graph rendering
export function generateLogFrequencies(minFreq = 20, maxFreq = 20000, points = 220) {
  const freqs = [];
  const minLog = Math.log10(minFreq);
  const maxLog = Math.log10(maxFreq);
  for (let i = 0; i < points; i++) {
    const logF = minLog + (i / (points - 1)) * (maxLog - minLog);
    freqs.push(Math.pow(10, logF));
  }
  return freqs;
}

export const HIGH_RES_FREQS = generateLogFrequencies();

export const Q_STAGES = {
  LR12: [0.5],
  LR24: [0.7071, 0.7071],
  LR48: [0.5412, 1.3065, 0.5412, 1.3065],
  BW12: [0.7071],
  BW24: [0.5412, 1.3065],
  BW36: [0.5177, 0.7071, 1.9320],
  BW48: [0.5098, 0.6013, 0.8999, 2.5628]
};

function biquadDenominator(x, q) {
  return Math.pow(1.0 - x * x, 2) + Math.pow(x / q, 2);
}

/**
 * Calculates attenuation (in dB) across a frequency sequence.
 */
export function calculateFilterAttenuation(frequencies, cutoffHz, topology, isHighPass) {
  if (!cutoffHz || cutoffHz <= 0 || topology === "BYPASS" || !Q_STAGES[topology]) {
    return frequencies.map(() => 0.0);
  }
  const qs = Q_STAGES[topology];
  return frequencies.map(f => {
    const x = f / cutoffHz;
    let sumDb = 0.0;
    for (const q of qs) {
      const denom = biquadDenominator(x, q);
      if (isHighPass) {
        sumDb += 40.0 * Math.log10(x) - 10.0 * Math.log10(denom);
      } else {
        sumDb += -10.0 * Math.log10(denom);
      }
    }
    return sumDb;
  });
}

/**
 * Logarithmic frequency interpolation between known 31-band ISO values.
 */
export function interpolateLogCurve(isoFreqs, isoValues, targetFreqs) {
  return targetFreqs.map(tf => {
    if (tf <= isoFreqs[0]) return isoValues[0];
    if (tf >= isoFreqs[isoFreqs.length - 1]) return isoValues[isoValues.length - 1];
    let idx = 0;
    while (idx < isoFreqs.length - 1 && isoFreqs[idx + 1] < tf) idx++;
    const f0 = isoFreqs[idx], f1 = isoFreqs[idx + 1];
    const v0 = isoValues[idx], v1 = isoValues[idx + 1];
    const t = (Math.log10(tf) - Math.log10(f0)) / (Math.log10(f1) - Math.log10(f0));
    return v0 + t * (v1 - v0);
  });
}

/**
 * Coherent acoustic summation across all active driver channels:
 * Total Gain = sum( 10^(A_c / 20) )
 * Summed dB = BaseHouseCurve + Offset + 20 * log10(Total Gain)
 */
export function computeAcousticSummation(baseCurve, channelAttenuations, offsetDb = 0.0) {
  return baseCurve.map((baseVal, i) => {
    let sumAmp = 0.0;
    for (const att of channelAttenuations) {
      sumAmp += Math.pow(10.0, att[i] / 20.0);
    }
    const sumDb = sumAmp <= 1e-6 ? -120.0 : 20.0 * Math.log10(sumAmp);
    const total = baseVal + offsetDb + sumDb;
    return Math.abs(total) < 0.1 ? 0.0 : total;
  });
}
