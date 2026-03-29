/**
 * EAS Build hook: replaces deprecated jcenter() with mavenCentral()
 * in react-native-shared-group-preferences build.gradle.
 *
 * Run as: node scripts/fix-jcenter.js
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-shared-group-preferences',
  'android',
  'build.gradle'
);

if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('jcenter()')) {
    content = content.replace(/jcenter\(\)/g, 'mavenCentral()');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[fix-jcenter] Replaced jcenter() with mavenCentral()');
  } else {
    console.log('[fix-jcenter] No jcenter() found, skipping');
  }
} else {
  console.log('[fix-jcenter] File not found, skipping');
}
