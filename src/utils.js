/**
 * Formats a number of bytes into a human-readable string.
 * @param {number} bytes The number of bytes to format.
 * @returns {string} The formatted string.
 */
export function formatBytes(bytes) {
  if (bytes <= 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unitIndex = Math.min(i, sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, unitIndex)).toFixed(1)) + ' ' + sizes[unitIndex];
}
