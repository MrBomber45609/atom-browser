import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes } from '../src/utils.js';

describe('formatBytes utility', () => {
  test('should return "0 B" for 0 bytes', () => {
    assert.strictEqual(formatBytes(0), '0 B');
  });

  test('should return "0 B" for negative numbers', () => {
    assert.strictEqual(formatBytes(-1), '0 B');
    assert.strictEqual(formatBytes(-1024), '0 B');
  });

  test('should return "0 B" for NaN', () => {
    assert.strictEqual(formatBytes(NaN), '0 B');
  });

  test('should format bytes correctly', () => {
    assert.strictEqual(formatBytes(1), '1 B');
    assert.strictEqual(formatBytes(512), '512 B');
    assert.strictEqual(formatBytes(1023), '1023 B');
  });

  test('should format kilobytes correctly', () => {
    assert.strictEqual(formatBytes(1024), '1 KB');
    assert.strictEqual(formatBytes(1024 * 1.5), '1.5 KB');
    assert.strictEqual(formatBytes(1024 * 1023), '1023 KB');
  });

  test('should format megabytes correctly', () => {
    assert.strictEqual(formatBytes(1024 * 1024), '1 MB');
    assert.strictEqual(formatBytes(1024 * 1024 * 2.7), '2.7 MB');
  });

  test('should format gigabytes correctly', () => {
    assert.strictEqual(formatBytes(Math.pow(1024, 3)), '1 GB');
    assert.strictEqual(formatBytes(Math.pow(1024, 3) * 500.5), '500.5 GB');
  });

  test('should format terabytes correctly', () => {
    assert.strictEqual(formatBytes(Math.pow(1024, 4)), '1 TB');
  });

  test('should format petabytes correctly', () => {
    assert.strictEqual(formatBytes(Math.pow(1024, 5)), '1 PB');
  });

  test('should handle very large values with YB as the highest unit', () => {
    // YB is the last unit in our sizes array
    assert.strictEqual(formatBytes(Math.pow(1024, 8)), '1 YB');
    assert.strictEqual(formatBytes(Math.pow(1024, 9)), '1024 YB');
  });

  test('should round to 1 decimal place', () => {
    assert.strictEqual(formatBytes(1024 * 1.234), '1.2 KB');
    assert.strictEqual(formatBytes(1024 * 1.256), '1.3 KB');
  });

  test('should not show decimal if it is .0', () => {
    // parseFloat(...toFixed(1)) removes trailing .0
    assert.strictEqual(formatBytes(1024 * 2.0), '2 KB');
  });
});
