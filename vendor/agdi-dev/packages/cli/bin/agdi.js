#!/usr/bin/env node

// ES module dynamic import for bin executable
import('../dist/index.js').catch(err => {
    console.error('Failed to load agdi:', err);
    process.exit(1);
});
