/**
 * File upload handler
 */

export function createFileHandler(scanAndAlert) {
  return function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('text/') && !file.name.match(/\.(txt|md|csv|log)$/i)) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const fileContent = e.target?.result;
      if (fileContent && typeof fileContent === 'string') {
        scanAndAlert(fileContent, 'file', file.name);
      }
    };
    reader.onerror = () => {};
    reader.readAsText(file);
  };
}
