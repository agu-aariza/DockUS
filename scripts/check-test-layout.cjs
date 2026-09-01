const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');
const productionRoots = ['backend/src', 'frontend/src'];
const testFilePattern = /\.(?:spec|test|e2e-spec)\.[cm]?[jt]sx?$/i;
const testDirectoryNames = new Set(['test', 'tests', '__tests__', 'test-support']);
const violations = [];

function visit(currentPath, relativePath) {
  for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
    const absoluteEntryPath = path.join(currentPath, entry.name);
    const relativeEntryPath = path.join(relativePath, entry.name);

    if (entry.isDirectory()) {
      if (testDirectoryNames.has(entry.name)) {
        violations.push(relativeEntryPath);
        continue;
      }
      visit(absoluteEntryPath, relativeEntryPath);
      continue;
    }

    const pathParts = relativeEntryPath.split(path.sep);
    const isTestDirectory = pathParts.some((part) => testDirectoryNames.has(part));
    if (testFilePattern.test(entry.name) || isTestDirectory) {
      violations.push(relativeEntryPath);
    }
  }
}

for (const productionRoot of productionRoots) {
  const absoluteRoot = path.join(repositoryRoot, productionRoot);
  visit(absoluteRoot, productionRoot);
}

if (violations.length > 0) {
  console.error('Test files must live outside production source roots:');
  for (const violation of violations.sort()) {
    console.error(`- ${violation}`);
  }
  process.exitCode = 1;
} else {
  console.log('Test layout OK: backend/src and frontend/src contain production files only.');
}
