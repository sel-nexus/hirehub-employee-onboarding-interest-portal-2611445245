/** Register DOM assertions and reset component-test state after each test. */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(
  /** Remove mounted trees and restore browser storage and test doubles. */
  () => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  },
);
