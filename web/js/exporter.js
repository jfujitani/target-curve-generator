/**
 * REW File Exporter & Zip Bundler.
 * Generates clean 2-column REW format: "Frequency <space> dB".
 */

export class Exporter {
  static formatRewText(frequencies, dbValues) {
    const lines = [];
    for (let i = 0; i < frequencies.length; i++) {
      const f = frequencies[i];
      const db = dbValues[i] + 0.0; // avoid -0.0
      lines.push(`${f} ${db.toFixed(1)}`);
    }
    return lines.join("\n") + "\n";
  }

  static downloadTextFile(filename, textContent) {
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static async downloadZipArchive(zipFilename, filesMap) {
    if (!window.JSZip) {
      alert("JSZip library not found. Falling back to individual file downloads.");
      for (const [filename, content] of Object.entries(filesMap)) {
        this.downloadTextFile(filename, content);
      }
      return;
    }

    const zip = new window.JSZip();
    for (const [filename, content] of Object.entries(filesMap)) {
      zip.file(filename, content);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = zipFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
