
import React from 'react';
import { render } from 'ink';
import { App } from '../ui/tui.js';

export function runTUI() {
    console.clear();
    render(<App />);
}
