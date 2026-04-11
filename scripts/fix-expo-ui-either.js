/**
 * Postinstall patch: adds Equatable conformance to expo-modules-core Either class.
 * Fixes @expo/ui build error where PickerView.swift and ListView.swift use
 * .onChange(of:) which requires Equatable on Either<String, Double>.
 *
 * Run as: node scripts/fix-expo-ui-either.js
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-modules-core',
  'ios',
  'Core',
  'Arguments',
  'Either.swift'
);

const conformance = `
// MARK: - Equatable (patch for @expo/ui .onChange compatibility)

extension Either: Equatable where FirstType: Equatable, SecondType: Equatable {
  public static func == (lhs: Either<FirstType, SecondType>, rhs: Either<FirstType, SecondType>) -> Bool {
    if let l = lhs.value as? FirstType, let r = rhs.value as? FirstType {
      return l == r
    }
    if let l = lhs.value as? SecondType, let r = rhs.value as? SecondType {
      return l == r
    }
    return false
  }
}
`;

if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('extension Either: Equatable')) {
    console.log('[fix-expo-ui-either] Already patched, skipping');
  } else {
    content += conformance;
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[fix-expo-ui-either] Added Equatable conformance to Either');
  }
} else {
  console.log('[fix-expo-ui-either] Either.swift not found, skipping');
}
