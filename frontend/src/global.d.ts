/**
 * @fileoverview Módulo de la interfaz de usuario (global.d).
 *
 * @module global.d
 */

import React from 'react';

declare global {
  namespace JSX {
    type Element = React.JSX.Element;
    type IntrinsicElements = React.JSX.IntrinsicElements;
  }
}
