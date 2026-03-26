#!/usr/bin/env node
'use strict';

/**
 * Converts a string to a URL-friendly slug.
 * Lowercases, trims, replaces spaces with dashes, removes non-alphanumerics
 * (except dashes), and collapses multiple dashes.
 */
function toSlug(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // replace spaces with dash
    .replace(/[^a-z0-9-]/g, '') // remove non-alphanumeric except dash
    .replace(/-+/g, '-'); // collapse multiple dashes
}

// Export for programmatic use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { toSlug };
}

// CLI: read from args or stdin
if (require.main === module) {
  const argvText = process.argv.slice(2).join(' ');

  const print = (text) => {
    process.stdout.write(text + '\n');
  };

  if (argvText) {
    print(toSlug(argvText));
  } else {
    // Read from stdin (supports piping)
    const chunks = [];
    if (process.stdin.isTTY) {
      // No input provided
      console.error('Usage: to-slug "Some Text"  OR  echo "Some Text" | to-slug');
      process.exit(1);
    }
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => {
      const input = chunks.join('').trim();
      print(toSlug(input));
    });
  }
}
