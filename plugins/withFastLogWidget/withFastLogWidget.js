// @ts-check
/**
 * Custom Expo config plugin that wires the FastLog WidgetKit +
 * ActivityKit extension into the generated iOS project.
 *
 * Why custom:
 *   expo-widgets's "widget" Babel directive serializes JSX-like widget
 *   code into a string that is later evaluated inside a JS runtime
 *   hosted by the extension. That runtime is fragile (known open bug:
 *   https://github.com/expo/expo/issues/44123), giving us blank
 *   widgets. We pivot to hand-written Swift + SwiftUI, and this plugin
 *   handles all the Xcode wiring Expo's prebuild normally skips for
 *   non-managed targets.
 *
 * What it does:
 *   1. Copies the hand-authored Swift files under this plugin's
 *      `ios/` directory into `ios/<TARGET_NAME>/`.
 *   2. Generates `<TARGET_NAME>/Info.plist` and
 *      `<TARGET_NAME>/<TARGET_NAME>.entitlements`.
 *   3. Adds an `APPLICATION_EXTENSION` target to the Xcode project,
 *      with App Group entitlements and WidgetKit/SwiftUI/ActivityKit
 *      frameworks linked.
 *   4. Adds the same App Group to the main app's entitlements.
 *   5. Registers `NSSupportsLiveActivities` on the main app's
 *      Info.plist (redundant with app.config.ts but safe).
 *   6. Appends `target "<TARGET_NAME>" do ... end` to the Podfile so
 *      the extension has a clean (non-React-Native) pod scope.
 */

const path = require('path');
const fs = require('fs');
const plist = require('@expo/plist').default;
const {
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
  withPlugins,
  createRunOncePlugin,
} = require('expo/config-plugins');

const TARGET_NAME = 'FastLogWidgetExtension';
const GROUP_IDENTIFIER = 'group.com.fastlog.app';
const DEPLOYMENT_TARGET = '16.2';
const SWIFT_SOURCE_DIR = path.join(__dirname, 'ios');

function log(...args) {
  console.log('[withFastLogWidget]', ...args);
}

// ---------------------------------------------------------------------------
// 1. Copy Swift sources + Info.plist + entitlements into the target folder
// ---------------------------------------------------------------------------
const withSwiftSources = (config, { bundleIdentifier }) =>
  withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const targetDir = path.join(projectRoot, TARGET_NAME);
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
      fs.mkdirSync(targetDir, { recursive: true });

      const entries = fs.readdirSync(SWIFT_SOURCE_DIR);
      for (const entry of entries) {
        if (!entry.endsWith('.swift')) continue;
        const src = path.join(SWIFT_SOURCE_DIR, entry);
        const dest = path.join(targetDir, entry);
        fs.copyFileSync(src, dest);
      }
      log(`copied ${entries.length} files into ios/${TARGET_NAME}/`);

      const infoPlistPath = path.join(targetDir, 'Info.plist');
      fs.writeFileSync(
        infoPlistPath,
        plist.build({
          NSExtension: {
            NSExtensionPointIdentifier: 'com.apple.widgetkit-extension',
          },
          NSSupportsLiveActivities: true,
          CFBundleDisplayName: 'FastLog',
          CFBundleShortVersionString: config.version ?? '1.0.0',
          CFBundleVersion: config.ios?.buildNumber ?? '1',
        })
      );

      const entitlementsPath = path.join(targetDir, `${TARGET_NAME}.entitlements`);
      fs.writeFileSync(
        entitlementsPath,
        plist.build({
          'com.apple.security.application-groups': [GROUP_IDENTIFIER],
        })
      );

      return config;
    },
  ]);

// ---------------------------------------------------------------------------
// 2. App Group entitlement on the main target
// ---------------------------------------------------------------------------
const withAppEntitlement = (config) =>
  withEntitlementsPlist(config, (config) => {
    const key = 'com.apple.security.application-groups';
    const existing = Array.isArray(config.modResults[key])
      ? config.modResults[key]
      : [];
    if (!existing.includes(GROUP_IDENTIFIER)) {
      config.modResults[key] = [GROUP_IDENTIFIER, ...existing];
    }
    return config;
  });

// ---------------------------------------------------------------------------
// 3. Main Info.plist — NSSupportsLiveActivities (also set in app.config.ts
//    but keep it here for plugin self-sufficiency).
// ---------------------------------------------------------------------------
const withMainInfoPlistFlag = (config) =>
  withInfoPlist(config, (config) => {
    config.modResults.NSSupportsLiveActivities = true;
    return config;
  });

// ---------------------------------------------------------------------------
// 4. Xcode target wiring. Uses xcode's PBX apis via config.modResults.
// ---------------------------------------------------------------------------
const withXcodeTarget = (config, { bundleIdentifier, appleTeamId }) =>
  withXcodeProject(config, (config) => {
    const pbx = config.modResults;

    // Skip if already added (idempotent for repeated prebuilds).
    const existing = pbx.pbxNativeTargetSection();
    for (const uuid of Object.keys(existing)) {
      const node = existing[uuid];
      if (node && typeof node === 'object' && node.name === TARGET_NAME) {
        log('target already present — skipping Xcode wiring');
        return config;
      }
    }

    const targetUuid = pbx.generateUuid();
    const groupName = 'Embed Foundation Extensions';
    const marketingVersion = config.version ?? '1.0.0';
    const currentProjectVersion = config.ios?.buildNumber ?? '1';

    const commonBuildSettings = {
      PRODUCT_NAME: '"$(TARGET_NAME)"',
      SWIFT_VERSION: '5.0',
      TARGETED_DEVICE_FAMILY: '"1,2"',
      INFOPLIST_FILE: `${TARGET_NAME}/Info.plist`,
      CURRENT_PROJECT_VERSION: `"${currentProjectVersion}"`,
      IPHONEOS_DEPLOYMENT_TARGET: `"${DEPLOYMENT_TARGET}"`,
      PRODUCT_BUNDLE_IDENTIFIER: `"${bundleIdentifier}"`,
      GENERATE_INFOPLIST_FILE: '"YES"',
      INFOPLIST_KEY_CFBundleDisplayName: '"FastLog Widget"',
      INFOPLIST_KEY_NSHumanReadableCopyright: '""',
      MARKETING_VERSION: `"${marketingVersion}"`,
      SWIFT_OPTIMIZATION_LEVEL: '"-Onone"',
      CODE_SIGN_ENTITLEMENTS: `"${TARGET_NAME}/${TARGET_NAME}.entitlements"`,
      APPLICATION_EXTENSION_API_ONLY: '"YES"',
      SKIP_INSTALL: 'NO',
      ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS: 'NO',
      LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
      ...(appleTeamId ? { DEVELOPMENT_TEAM: appleTeamId } : {}),
    };

    const buildConfigurationsList = [
      { name: 'Debug', isa: 'XCBuildConfiguration', buildSettings: { ...commonBuildSettings } },
      { name: 'Release', isa: 'XCBuildConfiguration', buildSettings: { ...commonBuildSettings } },
    ];

    const xCConfigurationList = pbx.addXCConfigurationList(
      buildConfigurationsList,
      'Release',
      `Build configuration list for PBXNativeTarget "${TARGET_NAME}"`
    );

    // Product reference (the .appex file).
    const productFile = pbx.addProductFile(TARGET_NAME, {
      basename: `${TARGET_NAME}.appex`,
      group: groupName,
      explicitFileType: 'wrapper.app-extension',
      settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] },
      includeInIndex: 0,
      path: `${TARGET_NAME}.appex`,
      sourceTree: 'BUILT_PRODUCTS_DIR',
    });

    // Native target.
    const target = {
      uuid: targetUuid,
      pbxNativeTarget: {
        isa: 'PBXNativeTarget',
        name: TARGET_NAME,
        productName: TARGET_NAME,
        productReference: productFile.fileRef,
        productType: '"com.apple.product-type.app-extension"',
        buildConfigurationList: xCConfigurationList.uuid,
        buildPhases: [],
        buildRules: [],
        dependencies: [],
      },
    };
    pbx.addToPbxNativeTargetSection(target);
    pbx.addToPbxProjectSection(target);

    // Target attributes so Xcode sets ProvisioningStyle + last-swift-migration.
    const pbxProjectSection = pbx.pbxProjectSection();
    const firstProject = pbxProjectSection[pbx.getFirstProject().uuid];
    if (!firstProject.attributes.TargetAttributes) {
      firstProject.attributes.TargetAttributes = {};
    }
    firstProject.attributes.TargetAttributes[targetUuid] = {
      LastSwiftMigration: 1250,
    };

    // Dependency: main app depends on the widget extension.
    if (!pbx.hash.project.objects.PBXTargetDependency) {
      pbx.hash.project.objects.PBXTargetDependency = {};
    }
    if (!pbx.hash.project.objects.PBXContainerItemProxy) {
      pbx.hash.project.objects.PBXContainerItemProxy = {};
    }
    pbx.addTargetDependency(pbx.getFirstTarget().uuid, [targetUuid]);

    // Enumerate swift source files inside the target directory.
    const swiftFiles = fs
      .readdirSync(SWIFT_SOURCE_DIR)
      .filter((f) => f.endsWith('.swift'));

    // Sources build phase.
    pbx.addBuildPhase(
      [...swiftFiles],
      'PBXSourcesBuildPhase',
      groupName,
      targetUuid,
      'app_extension',
      '""'
    );

    // Frameworks build phase (empty here — frameworks come from the
    // implicit SDK imports in Swift; explicit add below for clarity).
    pbx.addBuildPhase(
      [],
      'PBXFrameworksBuildPhase',
      groupName,
      targetUuid,
      'app_extension',
      '""'
    );

    const frameworksPhase = pbx.buildPhaseObject(
      'PBXFrameworksBuildPhase',
      groupName,
      targetUuid
    );
    if (frameworksPhase) {
      const frameworks = ['WidgetKit', 'SwiftUI', 'ActivityKit'];
      for (const framework of frameworks) {
        pbx.addFramework(`${framework}.framework`, {
          target: targetUuid,
          customFramework: false,
          embed: false,
          sign: false,
        });
      }
    }

    // Copy-files build phase: embed the .appex into the main app bundle.
    pbx.addBuildPhase(
      [],
      'PBXCopyFilesBuildPhase',
      groupName,
      pbx.getFirstTarget().uuid,
      'app_extension',
      '""'
    );
    const copyPhase = pbx.buildPhaseObject(
      'PBXCopyFilesBuildPhase',
      groupName,
      productFile.target
    );
    if (copyPhase) {
      copyPhase.files.push({
        value: productFile.uuid,
        comment: `${productFile.basename} in ${productFile.group}`,
      });
    }
    pbx.addToPbxBuildFileSection(productFile);

    // PBX group for the widget target's files in the file tree.
    const { uuid: pbxGroupUuid } = pbx.addPbxGroup(
      [...swiftFiles, `${TARGET_NAME}.entitlements`, 'Info.plist'],
      TARGET_NAME,
      TARGET_NAME
    );
    if (pbxGroupUuid) {
      const groups = pbx.hash.project.objects.PBXGroup;
      for (const key of Object.keys(groups)) {
        if (
          typeof groups[key] === 'object' &&
          groups[key].name === undefined &&
          groups[key].path === undefined
        ) {
          pbx.addToPbxGroup(pbxGroupUuid, key);
        }
      }
    }

    log('wired Xcode target', TARGET_NAME);
    return config;
  });

// ---------------------------------------------------------------------------
// 5. Podfile — give the extension target its own minimal pod scope.
// ---------------------------------------------------------------------------
const withPodfileTarget = (config, { bundleIdentifier }) =>
  withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (contents.includes(`target '${TARGET_NAME}' do`)) {
        return config;
      }

      // Widget extension Podfile block. Using a plain `target` pod
      // scope (no React Native, no Expo modules) keeps the extension
      // lean — its only deps are system frameworks declared in Swift.
      const block = `
target '${TARGET_NAME}' do
  use_frameworks! :linkage => :static
  platform :ios, '${DEPLOYMENT_TARGET}'
end
`;

      // Insert the widget extension target BEFORE the main app target.
      // That side-steps Ruby block-matching (avoiding false positives
      // on `if/end`, `do/end`, etc. nested inside the main target).
      const appName =
        (config.modRequest && config.modRequest.projectName) || 'FastLog';
      const targetHeader = `target '${appName}' do`;
      const headerIdx = contents.indexOf(targetHeader);
      if (headerIdx === -1) {
        contents += block;
      } else {
        // Walk back to the beginning of the line containing the header.
        let lineStart = headerIdx;
        while (lineStart > 0 && contents[lineStart - 1] !== '\n') lineStart--;
        contents =
          contents.slice(0, lineStart) + block + '\n' + contents.slice(lineStart);
      }

      fs.writeFileSync(podfilePath, contents, 'utf8');
      return config;
    },
  ]);

// ---------------------------------------------------------------------------
// Root plugin
// ---------------------------------------------------------------------------
const withFastLogWidget = (config, props = {}) => {
  const bundleIdentifier =
    props.bundleIdentifier ?? `${config.ios?.bundleIdentifier}.widgets`;
  const appleTeamId = props.appleTeamId ?? config.ios?.appleTeamId;

  return withPlugins(config, [
    [withSwiftSources, { bundleIdentifier }],
    [withAppEntitlement],
    [withMainInfoPlistFlag],
    [withXcodeTarget, { bundleIdentifier, appleTeamId }],
    [withPodfileTarget, { bundleIdentifier }],
  ]);
};

module.exports = createRunOncePlugin(
  withFastLogWidget,
  'with-fast-log-widget',
  '1.0.0'
);
