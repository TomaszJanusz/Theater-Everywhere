import { build } from 'vite';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';

function copyFolderRecursiveSync(source: string, target: string) {
  let files: string[] = [];

  // Check if folder needs to be created
  const targetFolder = path.join(target, path.basename(source));
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  // Copy
  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source);
    files.forEach((file) => {
      const curSource = path.join(source, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder);
      } else {
        fs.copyFileSync(curSource, path.join(targetFolder, file));
      }
    });
  }
}

function copyDirContentSync(srcDir: string, destDir: string) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const items = fs.readdirSync(srcDir);
  for (const item of items) {
    const srcPath = path.join(srcDir, item);
    const destPath = path.join(destDir, item);
    if (fs.lstatSync(srcPath).isDirectory()) {
      copyFolderRecursiveSync(srcPath, destDir);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function zipDirectory(sourceDir: string, outPath: string): Promise<void> {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const stream = fs.createWriteStream(outPath);

  return new Promise((resolve, reject) => {
    archive
      .directory(sourceDir, false)
      .on('error', (err) => reject(err))
      .pipe(stream);

    stream.on('close', () => resolve());
    archive.finalize();
  });
}

async function run() {
  try {
    console.log('=== Starting TypeScript + Vite Bundle & Build ===');
    
    // 1. Run Vite build
    console.log('Compiling TypeScript and HTML via Vite...');
    await build();

    const distDir = path.resolve(__dirname, '../dist');
    const chromeStagingDir = path.resolve(__dirname, '../chrome-unpacked');
    const firefoxStagingDir = path.resolve(__dirname, '../firefox-unpacked');

    // Clean any prior temp directories
    fs.rmSync(chromeStagingDir, { recursive: true, force: true });
    fs.rmSync(firefoxStagingDir, { recursive: true, force: true });

    // 2. Copy Vite dist output to target packages
    console.log('Copying build assets to staging folders...');
    copyDirContentSync(distDir, chromeStagingDir);
    copyDirContentSync(distDir, firefoxStagingDir);

    // Clean dist folder itself temporarily so it only houses the final zip outputs and unpacked extensions
    fs.rmSync(distDir, { recursive: true, force: true });
    fs.mkdirSync(distDir, { recursive: true });

    // 3. Copy manifest and icons to both targets
    console.log('Copying static manifests and icons...');
    fs.copyFileSync(
      path.resolve(__dirname, '../manifest.json'),
      path.resolve(chromeStagingDir, 'manifest.json')
    );
    fs.copyFileSync(
      path.resolve(__dirname, '../manifest.json'),
      path.resolve(firefoxStagingDir, 'manifest.json')
    );

    copyFolderRecursiveSync(
      path.resolve(__dirname, '../icons'),
      chromeStagingDir
    );
    copyFolderRecursiveSync(
      path.resolve(__dirname, '../icons'),
      firefoxStagingDir
    );

    // 4. Inject Gecko settings for Firefox manifest.json
    console.log('Injecting Firefox-specific manifest settings...');
    const firefoxManifestPath = path.resolve(firefoxStagingDir, 'manifest.json');
    const firefoxManifest = JSON.parse(fs.readFileSync(firefoxManifestPath, 'utf8'));
    firefoxManifest.browser_specific_settings = {
      gecko: {
        id: 'theater-everywhere@tomaszjanusz.com',
        strict_min_version: '109.0'
      }
    };
    if (!firefoxManifest.permissions) {
      firefoxManifest.permissions = [];
    }
    if (!firefoxManifest.permissions.includes('theme')) {
      firefoxManifest.permissions.push('theme');
    }
    fs.writeFileSync(
      firefoxManifestPath,
      JSON.stringify(firefoxManifest, null, 2),
      'utf8'
    );

    // 5. Package into ZIP files
    console.log('Archiving extensions...');
    await zipDirectory(chromeStagingDir, path.resolve(distDir, 'theater-everywhere-chrome.zip'));
    console.log('  - Created dist/theater-everywhere-chrome.zip');

    await zipDirectory(firefoxStagingDir, path.resolve(distDir, 'theater-everywhere-firefox.zip'));
    console.log('  - Created dist/theater-everywhere-firefox.zip');

    // 6. Move staging folders to dist for development/unpacked testing
    console.log('Moving unpacked extensions to dist/ for easy browser loading...');
    fs.renameSync(chromeStagingDir, path.resolve(distDir, 'chrome-unpacked'));
    console.log('  - Created dist/chrome-unpacked/');
    
    fs.renameSync(firefoxStagingDir, path.resolve(distDir, 'firefox-unpacked'));
    console.log('  - Created dist/firefox-unpacked/');

    console.log('=== TypeScript + Vite Extension Build Successful! ===');
  } catch (error) {
    console.error('Build failed with error:', error);
    process.exit(1);
  }
}

run();
