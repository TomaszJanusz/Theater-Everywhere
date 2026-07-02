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
    console.log('No CHANGELOG.md found. Falling back to auto-generated notes.');
    process.exit(0);
  }

  const content = fs.readFileSync(changelogPath, 'utf8');
  
  // Match ## [1.0.1] or ## 1.0.1 or ## [v1.0.1] etc., optionally followed by date
  const escapedVersion = version.replace(/\./g, '\\.');
  const regex = new RegExp(`##\\s*\\[?v?${escapedVersion}\\]?(?:\\s*-\\s*\\d{4}-\\d{2}-\\d{2})?\\r?\\n([\\s\\S]*?)(?=\\r?\\n##\\s|$)`);
  const match = content.match(regex);

  if (match && match[1]) {
    const notes = match[1].trim();
    if (notes) {
      // Ensure output directory exists
      const outputDir = path.resolve(__dirname, '../dist');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(path.resolve(outputDir, 'release_notes.md'), notes, 'utf8');
      console.log('Extracted release notes successfully.');
      process.exit(0);
    }
  }

  console.log(`Version ${version} section not found in CHANGELOG.md. Falling back to auto-generated notes.`);
}

main();
