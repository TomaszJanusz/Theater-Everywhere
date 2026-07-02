import * as fs from 'fs';
import * as path from 'path';

function main() {
  const version = process.argv[2];
  if (!version) {
    console.error('Please provide a version number (e.g. 1.0.1)');
    process.exit(1);
  }

  const changelogPath = path.resolve(__dirname, '../CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    console.error('Error: CHANGELOG.md not found. Release notes must be extracted from the changelog.');
    process.exit(1);
  }

  const content = fs.readFileSync(changelogPath, 'utf8');
  
  // Try to find the section matching the specific version (e.g. ## [1.0.1] or ## 1.0.1)
  const escapedVersion = version.replace(/\./g, '\\.');
  const versionRegex = new RegExp(`##\\s*\\[?v?${escapedVersion}\\]?(?:\\s*-\\s*\\d{4}-\\d{2}-\\d{2})?\\r?\\n([\\s\\S]*?)(?=\\r?\\n##\\s|$)`);
  let match = content.match(versionRegex);

  // Fallback: If not found, try to extract the [Unreleased] section
  if (!match) {
    console.log(`Section for version ${version} not found. Attempting to extract [Unreleased] section...`);
    const unreleasedRegex = /##\s*\[?Unreleased\]?\r?\n([\s\S]*?)(?=\r?\n##\s|$)/i;
    match = content.match(unreleasedRegex);
  }

  if (match && match[1]) {
    const notes = match[1].trim();
    if (notes) {
      const outputDir = path.resolve(__dirname, '../dist');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(path.resolve(outputDir, 'release_notes.md'), notes, 'utf8');
      console.log('Extracted release notes successfully.');
      process.exit(0);
    }
  }

  console.error(`Error: Could not find section for version ${version} or [Unreleased] in CHANGELOG.md.`);
  process.exit(1);
}

main();
