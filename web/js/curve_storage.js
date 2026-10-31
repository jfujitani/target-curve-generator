/**
 * Curve Storage & File Import/Export Manager.
 * Manages built-in presets and persistent custom curves via localStorage.
 */

import { ISO_FREQUENCIES_31 } from "./dsp_engine.js";
import { PRESET_HOUSE_CURVES } from "./presets_data.js";

const STORAGE_KEY = "tcg_custom_curves_v1";

export class CurveStorage {
  constructor() {
    this.presets = { ...PRESET_HOUSE_CURVES };
    this.customCurves = this.loadCustomCurves();
  }

  loadCustomCurves() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.warn("Failed to read localStorage:", e);
      return {};
    }
  }

  saveCustomCurves() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.customCurves));
    } catch (e) {
      console.warn("Failed to save to localStorage:", e);
    }
  }

  getAllCurveNames() {
    const presetNames = Object.keys(this.presets);
    const customNames = Object.keys(this.customCurves);
    return { presetNames, customNames };
  }

  getCurve(name) {
    if (this.customCurves[name]) {
      return [...this.customCurves[name]];
    }
    if (this.presets[name]) {
      return [...this.presets[name]];
    }
    return new Array(ISO_FREQUENCIES_31.length).fill(0.0);
  }

  addCustomCurve(name, values) {
    if (!name || !name.trim()) throw new Error("Curve name cannot be empty");
    if (!values || values.length !== ISO_FREQUENCIES_31.length) {
      throw new Error(`Curve must have exactly ${ISO_FREQUENCIES_31.length} values`);
    }
    this.customCurves[name.trim()] = [...values];
    this.saveCustomCurves();
  }

  deleteCustomCurve(name) {
    if (this.customCurves[name]) {
      delete this.customCurves[name];
      this.saveCustomCurves();
      return true;
    }
    return false;
  }

  exportLibraryAsJSON() {
    return JSON.stringify(this.customCurves, null, 2);
  }

  importLibraryFromJSON(jsonString) {
    const data = JSON.parse(jsonString);
    if (typeof data !== "object" || data === null) {
      throw new Error("Invalid JSON structure");
    }
    let count = 0;
    for (const [name, values] of Object.entries(data)) {
      if (Array.isArray(values) && values.length === ISO_FREQUENCIES_31.length) {
        this.customCurves[name] = values.map(Number);
        count++;
      }
    }
    this.saveCustomCurves();
    return count;
  }

  /**
   * Parse REW text file or CSV format.
   * Format: Frequency <whitespace or comma> dB
   */
  parseRewFile(textContent) {
    const lines = textContent.split(/\r?\n/);
    const parsedPairs = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("*") || trimmed.startsWith("#") || trimmed.startsWith("//")) {
        continue;
      }
      const parts = trimmed.split(/[\s,]+/);
      if (parts.length >= 2) {
        const freq = parseFloat(parts[0]);
        const db = parseFloat(parts[1]);
        if (!isNaN(freq) && !isNaN(db) && freq > 0) {
          parsedPairs.push({ freq, db });
        }
      }
    }

    if (parsedPairs.length === 0) {
      throw new Error("No valid frequency and dB data found in file.");
    }

    parsedPairs.sort((a, b) => a.freq - b.freq);

    // Map/interpolate parsed pairs to 31 ISO frequencies
    const interpolatedValues = ISO_FREQUENCIES_31.map(isoF => {
      if (isoF <= parsedPairs[0].freq) return parsedPairs[0].db;
      if (isoF >= parsedPairs[parsedPairs.length - 1].freq) return parsedPairs[parsedPairs.length - 1].db;

      let idx = 0;
      while (idx < parsedPairs.length - 1 && parsedPairs[idx + 1].freq < isoF) idx++;
      const p0 = parsedPairs[idx];
      const p1 = parsedPairs[idx + 1];

      if (p0.freq === p1.freq) return p0.db;
      const t = (Math.log10(isoF) - Math.log10(p0.freq)) / (Math.log10(p1.freq) - Math.log10(p0.freq));
      const val = p0.db + t * (p1.db - p0.db);
      return Math.round(val * 100) / 100;
    });

    return interpolatedValues;
  }
}
