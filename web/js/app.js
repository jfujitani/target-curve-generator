/**
 * Main Web Application Controller.
 * Binds UI inputs, curve store, DSP engine, chart view, and export manager.
 */

import { AudioChart } from "./chart_view.js";
import { CurveStorage } from "./curve_storage.js";
import {
  calculateFilterAttenuation,
  computeAcousticSummation,
  HIGH_RES_FREQS,
  interpolateLogCurve,
  ISO_FREQUENCIES_31,
  Q_STAGES
} from "./dsp_engine.js";
import { Exporter } from "./exporter.js";

// Standard channel setup: 3-way with front sub and rear sub
const DEFAULT_CHANNELS = [
  { id: "sub2", name: "Rear Sub", fileTag: "Sub2", color: "#e040fb", active: true, hp: 20, lp: 60, lastActiveHp: 20, lastActiveLp: 60, slope: "LR24" },
  { id: "sub1", name: "Front Sub", fileTag: "Sub1", color: "#2979ff", active: true, hp: 25, lp: 80, lastActiveHp: 25, lastActiveLp: 80, slope: "LR24" },
  { id: "mb", name: "Midbass", fileTag: "MB", color: "#00e676", active: true, hp: 80, lp: 350, lastActiveHp: 80, lastActiveLp: 350, slope: "LR24" },
  { id: "mid", name: "Midrange", fileTag: "Mid", color: "#ff9100", active: true, hp: 350, lp: 3500, lastActiveHp: 350, lastActiveLp: 3500, slope: "LR24" },
  { id: "tw", name: "Tweeter", fileTag: "Tw", color: "#ffd600", active: true, hp: 3500, lp: 0, lastActiveHp: 3500, lastActiveLp: 18000, slope: "LR24" }
];

class App {
  constructor() {
    this.storage = new CurveStorage();
    this.channels = JSON.parse(JSON.stringify(DEFAULT_CHANNELS));
    this.activeCurveName = "JBL";
    this.globalOffsetDb = 0.0;
    this.dbRangeKey = localStorage.getItem("tcg_db_range_key") || "default";
    this.chart = null;

    this.importedPendingValues = null;

    this.initElements();
    this.initChart();
    this.populateCurveSelector();
    this.renderChannelDeck();
    this.bindEvents();
    this.updateAudioTarget();
  }

  initElements() {
    this.elCurveSelect = document.getElementById("curveSelect");
    this.elGlobalOffset = document.getElementById("globalOffset");
    this.elDbRange = document.getElementById("dbRangeSelect");
    this.elChannelsContainer = document.getElementById("channelsContainer");
    this.elBtnExportZip = document.getElementById("btnExportZip");
    this.elBtnResetDefaults = document.getElementById("btnResetDefaults");

    // Modal elements
    this.modalManage = document.getElementById("modalManageCurves");
    this.modalEdit = document.getElementById("modalEditCurve");
    this.dropZone = document.getElementById("fileDropZone");
    this.fileInput = document.getElementById("fileInput");
    this.importCurveName = document.getElementById("importCurveName");
    this.btnSaveImported = document.getElementById("btnSaveImportedCurve");
    this.customCurvesList = document.getElementById("customCurvesList");
  }

  initChart() {
    const canvas = document.getElementById("mainAudioChart");
    this.chart = new AudioChart(canvas, this.dbRangeKey);
    if (this.elDbRange) this.elDbRange.value = this.dbRangeKey;
  }

  populateCurveSelector() {
    const { presetNames, customNames } = this.storage.getAllCurveNames();
    this.elCurveSelect.innerHTML = "";

    const optGroupPresets = document.createElement("optgroup");
    optGroupPresets.label = "Built-in Presets";
    presetNames.forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      optGroupPresets.appendChild(opt);
    });
    this.elCurveSelect.appendChild(optGroupPresets);

    if (customNames.length > 0) {
      const optGroupCustom = document.createElement("optgroup");
      optGroupCustom.label = "Custom User Curves";
      customNames.forEach(name => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        optGroupCustom.appendChild(opt);
      });
      this.elCurveSelect.appendChild(optGroupCustom);
    }

    this.elCurveSelect.value = this.activeCurveName;
  }

  renderChannelDeck() {
    const slopes = Object.keys(Q_STAGES);

    this.elChannelsContainer.innerHTML = this.channels.map((ch, idx) => {
      const isHpBypassed = ch.hp <= 0;
      const isLpBypassed = ch.lp <= 0;
      return `
      <div class="channel-card ${ch.active ? "" : "inactive"}" id="card-${ch.id}">
        <div class="card-top">
          <div class="channel-tag-title">
            <span class="channel-dot" style="background-color: ${ch.color};"></span>
            <span>${ch.name}</span>
            <span style="font-size:0.75rem; color:var(--text-muted);">(${ch.fileTag})</span>
          </div>
          <div class="card-actions">
            <label style="font-size:0.78rem; display:flex; align-items:center; gap:4px; cursor:pointer;">
              <input type="checkbox" ${ch.active ? "checked" : ""} onchange="window.app.toggleChannel(${idx}, this.checked)" />
              Active
            </label>
            <select style="font-size:0.75rem; padding:2px 4px;" onchange="window.app.changeSlope(${idx}, this.value)">
              ${slopes.map(s => `<option value="${s}" ${ch.slope === s ? "selected" : ""}>${s}</option>`).join("")}
            </select>
          </div>
        </div>

        <!-- High-Pass Control -->
        <div class="crossover-row">
          <div class="crossover-header">
            <span>High-Pass</span>
            <button id="btn-bypass-hp-${idx}" class="btn btn-sm ${isHpBypassed ? "btn-bypassed" : ""}"
                    onclick="window.app.toggleBypass(${idx}, 'hp')">
              ${isHpBypassed ? "Bypassed" : "Bypass"}
            </button>
          </div>
          <div class="crossover-controls">
            <input type="range" id="slider-hp-${idx}" min="0" max="8000" step="5" value="${ch.hp}"
                   oninput="window.app.setFreq(${idx}, 'hp', this.value, 'slider')" />
            <input type="number" id="num-hp-${idx}" class="freq-input" value="${ch.hp}" min="0" max="20000"
                   oninput="window.app.setFreq(${idx}, 'hp', this.value, 'num')"
                   onchange="window.app.setFreq(${idx}, 'hp', this.value, 'num')" />
            <span style="font-size:0.75rem; color:var(--text-muted);">Hz</span>
          </div>
        </div>

        <!-- Low-Pass Control -->
        <div class="crossover-row">
          <div class="crossover-header">
            <span>Low-Pass</span>
            <button id="btn-bypass-lp-${idx}" class="btn btn-sm ${isLpBypassed ? "btn-bypassed" : ""}"
                    onclick="window.app.toggleBypass(${idx}, 'lp')">
              ${isLpBypassed ? "Bypassed" : "Bypass"}
            </button>
          </div>
          <div class="crossover-controls">
            <input type="range" id="slider-lp-${idx}" min="0" max="20000" step="10" value="${ch.lp}"
                   oninput="window.app.setFreq(${idx}, 'lp', this.value, 'slider')" />
            <input type="number" id="num-lp-${idx}" class="freq-input" value="${ch.lp}" min="0" max="20000"
                   oninput="window.app.setFreq(${idx}, 'lp', this.value, 'num')"
                   onchange="window.app.setFreq(${idx}, 'lp', this.value, 'num')" />
            <span style="font-size:0.75rem; color:var(--text-muted);">Hz</span>
          </div>
        </div>

        <div class="card-footer">
          <button class="btn btn-sm" onclick="window.app.downloadSingleChannel(${idx})">Download REW .txt</button>
        </div>
      </div>
    `;
    }).join("");
  }

  setFreq(idx, type, val, source = "all") {
    const num = Math.max(0, parseFloat(val) || 0);
    this.channels[idx][type] = num;
    if (num > 0) {
      if (type === "hp") this.channels[idx].lastActiveHp = num;
      if (type === "lp") this.channels[idx].lastActiveLp = num;
    }

    const slider = document.getElementById(`slider-${type}-${idx}`);
    const numInput = document.getElementById(`num-${type}-${idx}`);
    const bypassBtn = document.getElementById(`btn-bypass-${type}-${idx}`);

    if (slider && source !== "slider") slider.value = num;
    if (numInput && source !== "num") numInput.value = num;

    if (bypassBtn) {
      const isBypassed = num <= 0;
      bypassBtn.classList.toggle("btn-bypassed", isBypassed);
      bypassBtn.textContent = isBypassed ? "Bypassed" : "Bypass";
    }

    this.updateAudioTarget();
  }

  toggleBypass(idx, type) {
    const currentVal = this.channels[idx][type];
    if (currentVal > 0) {
      // Currently active -> bypass to 0
      if (type === "hp") this.channels[idx].lastActiveHp = currentVal;
      if (type === "lp") this.channels[idx].lastActiveLp = currentVal;
      this.setFreq(idx, type, 0, "all");
    } else {
      // Currently bypassed -> restore last active value (or reasonable default)
      let restoreVal = type === "hp"
        ? (this.channels[idx].lastActiveHp || 80)
        : (this.channels[idx].lastActiveLp || 3500);
      if (restoreVal <= 0) restoreVal = type === "hp" ? 80 : 3500;
      this.setFreq(idx, type, restoreVal, "all");
    }
  }

  changeSlope(idx, slopeVal) {
    this.channels[idx].slope = slopeVal;
    this.updateAudioTarget();
  }

  toggleChannel(idx, activeState) {
    this.channels[idx].active = activeState;
    const card = document.getElementById(`card-${this.channels[idx].id}`);
    if (card) {
      card.classList.toggle("inactive", !activeState);
    }
    this.updateAudioTarget();
  }

  updateAudioTarget() {
    const rawCurve = this.storage.getCurve(this.activeCurveName);
    const offset = this.globalOffsetDb;

    // High-resolution evaluation for smooth plotting
    const highResCurve = interpolateLogCurve(ISO_FREQUENCIES_31, rawCurve, HIGH_RES_FREQS);
    const datasets = [];

    // 1. Overall House Target Trace
    const overallPoints = HIGH_RES_FREQS.map((f, i) => ({
      x: f,
      y: Math.abs(highResCurve[i] + offset) < 0.1 ? 0.0 : (highResCurve[i] + offset)
    }));
    datasets.push({
      label: "Overall Target",
      data: overallPoints,
      borderColor: "#00e5ff",
      backgroundColor: "#00e5ff",
      borderWidth: 2.8,
      tension: 0.25,
      pointRadius: 0
    });

    // 2. Active Channel Traces
    const channelAttenuations = [];
    this.channels.forEach(ch => {
      if (!ch.active) return;

      const hpAtten = calculateFilterAttenuation(HIGH_RES_FREQS, ch.hp, ch.slope, true);
      const lpAtten = calculateFilterAttenuation(HIGH_RES_FREQS, ch.lp, ch.slope, false);
      const totalAtten = hpAtten.map((h, i) => h + lpAtten[i]);
      channelAttenuations.push(totalAtten);

      const chPoints = HIGH_RES_FREQS.map((f, i) => {
        const val = highResCurve[i] + totalAtten[i] + offset;
        return { x: f, y: Math.abs(val) < 0.1 ? 0.0 : val };
      });

      datasets.push({
        label: ch.name,
        data: chPoints,
        borderColor: ch.color,
        backgroundColor: ch.color,
        borderWidth: 2.0,
        tension: 0.2,
        pointRadius: 0
      });
    });

    // 3. Summed Acoustic Response
    if (channelAttenuations.length > 0) {
      const summedDb = computeAcousticSummation(highResCurve, channelAttenuations, offset);
      const summedPoints = HIGH_RES_FREQS.map((f, i) => ({ x: f, y: summedDb[i] }));
      datasets.push({
        label: "Summed Acoustic",
        data: summedPoints,
        borderColor: "#ff1744",
        backgroundColor: "#ff1744",
        borderWidth: 2.2,
        borderDash: [5, 4],
        tension: 0.2,
        pointRadius: 0
      });
    }

    this.chart.updateDatasets(datasets);
  }

  // File Generation and Exporting
  generateRewFilesMap() {
    const rawCurve = this.storage.getCurve(this.activeCurveName);
    const offset = this.globalOffsetDb;
    const files = {};

    const cleanLabel = this.activeCurveName.trim().replace(/\s+/g, "_").replace(/^\./, "0.");

    // Overall file
    const overallValues = rawCurve.map(v => Math.abs(v + offset) < 0.1 ? 0.0 : (v + offset));
    files[`${cleanLabel}_Overall_REW.txt`] = Exporter.formatRewText(ISO_FREQUENCIES_31, overallValues);

    // Channel files
    this.channels.forEach(ch => {
      if (!ch.active) return;
      const hpAtten = calculateFilterAttenuation(ISO_FREQUENCIES_31, ch.hp, ch.slope, true);
      const lpAtten = calculateFilterAttenuation(ISO_FREQUENCIES_31, ch.lp, ch.slope, false);

      const chValues = rawCurve.map((h, i) => {
        const val = h + hpAtten[i] + lpAtten[i] + offset;
        return Math.abs(val) < 0.1 ? 0.0 : val;
      });

      const parts = [cleanLabel, ch.fileTag];
      if (ch.hp > 0) parts.push(`HP${ch.hp}`);
      if (ch.lp > 0) parts.push(`LP${ch.lp}`);
      const filename = `${parts.join("_")}_REW.txt`;

      files[filename] = Exporter.formatRewText(ISO_FREQUENCIES_31, chValues);
    });

    return files;
  }

  downloadSingleChannel(idx) {
    const ch = this.channels[idx];
    const rawCurve = this.storage.getCurve(this.activeCurveName);
    const offset = this.globalOffsetDb;

    const hpAtten = calculateFilterAttenuation(ISO_FREQUENCIES_31, ch.hp, ch.slope, true);
    const lpAtten = calculateFilterAttenuation(ISO_FREQUENCIES_31, ch.lp, ch.slope, false);

    const chValues = rawCurve.map((h, i) => {
      const val = h + hpAtten[i] + lpAtten[i] + offset;
      return Math.abs(val) < 0.1 ? 0.0 : val;
    });

    const cleanLabel = this.activeCurveName.trim().replace(/\s+/g, "_").replace(/^\./, "0.");
    const parts = [cleanLabel, ch.fileTag];
    if (ch.hp > 0) parts.push(`HP${ch.hp}`);
    if (ch.lp > 0) parts.push(`LP${ch.lp}`);
    const filename = `${parts.join("_")}_REW.txt`;

    Exporter.downloadTextFile(filename, Exporter.formatRewText(ISO_FREQUENCIES_31, chValues));
  }

  async exportAllZip() {
    const files = this.generateRewFilesMap();
    const cleanLabel = this.activeCurveName.trim().replace(/\s+/g, "_").replace(/^\./, "0.");
    const zipName = `${cleanLabel}_REW_Targets.zip`;
    await Exporter.downloadZipArchive(zipName, files);
  }

  bindEvents() {
    this.elCurveSelect.addEventListener("change", (e) => {
      this.activeCurveName = e.target.value;
      this.updateAudioTarget();
    });

    if (this.elDbRange) {
      this.elDbRange.addEventListener("change", (e) => {
        this.dbRangeKey = e.target.value;
        localStorage.setItem("tcg_db_range_key", this.dbRangeKey);
        this.chart.setDbRange(this.dbRangeKey);
      });
    }

    this.elGlobalOffset.addEventListener("input", (e) => {
      this.globalOffsetDb = parseFloat(e.target.value) || 0.0;
      this.updateAudioTarget();
    });

    this.elBtnExportZip.addEventListener("click", () => this.exportAllZip());

    this.elBtnResetDefaults.addEventListener("click", () => {
      this.channels = JSON.parse(JSON.stringify(DEFAULT_CHANNELS));
      this.renderChannelDeck();
      this.updateAudioTarget();
    });

    // Modals
    document.getElementById("btnManageCurves").addEventListener("click", () => this.openManageModal());
    document.getElementById("btnEditCurve").addEventListener("click", () => this.openEditModal());

    document.querySelectorAll("[data-close]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const modalId = e.currentTarget.getAttribute("data-close");
        document.getElementById(modalId).classList.remove("open");
      });
    });

    // File Drag & Drop
    this.dropZone.addEventListener("click", () => this.fileInput.click());
    this.fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) this.handleFile(e.target.files[0]);
    });

    this.dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.dropZone.classList.add("dragover");
    });

    this.dropZone.addEventListener("dragleave", () => {
      this.dropZone.classList.remove("dragover");
    });

    this.dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      this.dropZone.classList.remove("dragover");
      if (e.dataTransfer.files.length > 0) {
        this.handleFile(e.dataTransfer.files[0]);
      }
    });

    this.btnSaveImported.addEventListener("click", () => {
      const name = this.importCurveName.value.trim();
      if (!name) return alert("Please enter a curve name.");
      if (!this.importedPendingValues) return alert("No curve data loaded.");

      this.storage.addCustomCurve(name, this.importedPendingValues);
      this.populateCurveSelector();
      this.activeCurveName = name;
      this.elCurveSelect.value = name;
      this.renderCustomCurvesList();
      this.modalManage.classList.remove("open");
      this.updateAudioTarget();
    });

    // JSON Library Backup & Restore
    document.getElementById("btnExportLibraryJson").addEventListener("click", () => {
      const json = this.storage.exportLibraryAsJSON();
      Exporter.downloadTextFile("tcg_custom_curves_backup.json", json);
    });

    document.getElementById("jsonLibraryInput").addEventListener("change", (e) => {
      if (e.target.files.length === 0) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const count = this.storage.importLibraryFromJSON(evt.target.result);
          alert(`Successfully imported ${count} custom curves!`);
          this.populateCurveSelector();
          this.renderCustomCurvesList();
        } catch (err) {
          alert(`Failed to import JSON: ${err.message}`);
        }
      };
      reader.readAsText(e.target.files[0]);
    });

    // Edit Curve Points
    document.getElementById("btnSaveEditedPoints").addEventListener("click", () => {
      const inputs = document.querySelectorAll(".point-db-input");
      const values = Array.from(inputs).map(inp => parseFloat(inp.value) || 0.0);
      let targetName = this.activeCurveName;

      // If editing a preset, save as custom copy
      if (this.storage.presets[targetName]) {
        targetName = prompt(`'${targetName}' is a read-only preset. Save as new custom curve name:`, `${targetName} (Custom)`);
        if (!targetName) return;
      }

      this.storage.addCustomCurve(targetName, values);
      this.populateCurveSelector();
      this.activeCurveName = targetName;
      this.elCurveSelect.value = targetName;
      this.modalEdit.classList.remove("open");
      this.updateAudioTarget();
    });
  }

  handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        this.importedPendingValues = this.storage.parseRewFile(text);
        const suggestedName = file.name.replace(/\.[^/.]+$/, "");
        this.importCurveName.value = suggestedName;
        this.btnSaveImported.disabled = false;
        this.dropZone.innerHTML = `
          <div style="color:var(--success); font-weight:600; margin-bottom:4px;">Loaded: ${file.name}</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">Mapped across 31 ISO frequency bands. Click 'Save to Library'.</div>
        `;
      } catch (err) {
        alert(`Error parsing curve file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  openManageModal() {
    this.renderCustomCurvesList();
    this.modalManage.classList.add("open");
  }

  renderCustomCurvesList() {
    const { customNames } = this.storage.getAllCurveNames();
    if (customNames.length === 0) {
      this.customCurvesList.innerHTML = "<em>No custom curves saved yet.</em>";
      return;
    }
    this.customCurvesList.innerHTML = customNames.map(name => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #20222a;">
        <span>${name}</span>
        <button class="btn btn-sm btn-danger" onclick="window.app.deleteCustom('${name}')">Delete</button>
      </div>
    `).join("");
  }

  deleteCustom(name) {
    if (confirm(`Delete custom curve '${name}'?`)) {
      this.storage.deleteCustomCurve(name);
      if (this.activeCurveName === name) {
        this.activeCurveName = "JBL";
      }
      this.populateCurveSelector();
      this.renderCustomCurvesList();
      this.updateAudioTarget();
    }
  }

  openEditModal() {
    document.getElementById("editCurveTitle").textContent = `Edit Points: ${this.activeCurveName}`;
    const values = this.storage.getCurve(this.activeCurveName);
    const tbody = document.getElementById("pointsTableBody");

    tbody.innerHTML = ISO_FREQUENCIES_31.map((f, i) => `
      <tr>
        <td style="font-weight:500;">${f >= 1000 ? (f / 1000) + ' kHz' : f + ' Hz'}</td>
        <td>
          <input type="number" step="0.1" class="point-db-input" value="${values[i].toFixed(2)}" style="width:100%;" />
        </td>
      </tr>
    `).join("");

    this.modalEdit.classList.add("open");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.app = new App();
});
