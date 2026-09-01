/**
 * @fileoverview Módulo de la interfaz de usuario (setup).
 *
 * @module setup
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
