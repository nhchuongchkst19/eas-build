import assert from 'assert';

import fs from 'fs-extra';
import { AndroidConfig, XML } from '@expo/config-plugins';
import { Job } from '@expo/eas-build-job';

import { BuildContext } from '../context';

export enum AndroidMetadataName {
  UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY = 'expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY',
  RELEASE_CHANNEL = 'expo.modules.updates.EXPO_RELEASE_CHANNEL',
  RUNTIME_VERSION = 'expo.modules.updates.EXPO_RUNTIME_VERSION',
}

export async function androidSetRuntimeVersionNativelyAsync(
  ctx: BuildContext<Job>,
  runtimeVersion: string
): Promise<void> {
  const manifestPath = await AndroidConfig.Paths.getAndroidManifestAsync(
    ctx.getReactNativeProjectDirectory()
  );

  if (!(await fs.pathExists(manifestPath))) {
    throw new Error(`Couldn't find Android manifest at ${manifestPath}`);
  }

  const androidManifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
  const mainApp = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  AndroidConfig.Manifest.addMetaDataItemToMainApplication(
    mainApp,
    AndroidMetadataName.RUNTIME_VERSION,
    runtimeVersion,
    'value'
  );
  await AndroidConfig.Manifest.writeAndroidManifestAsync(manifestPath, androidManifest);
}

export async function androidSetChannelNativelyAsync(ctx: BuildContext<Job>): Promise<void> {
  assert(ctx.job.updates?.channel, 'updates.channel must be defined');

  const manifestPath = await AndroidConfig.Paths.getAndroidManifestAsync(
    ctx.getReactNativeProjectDirectory()
  );

  if (!(await fs.pathExists(manifestPath))) {
    throw new Error(`Couldn't find Android manifest at ${manifestPath}`);
  }

  const androidManifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
  const mainApp = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  const stringifiedUpdatesRequestHeaders = AndroidConfig.Manifest.getMainApplicationMetaDataValue(
    androidManifest,
    AndroidMetadataName.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY
  );
  AndroidConfig.Manifest.addMetaDataItemToMainApplication(
    mainApp,
    AndroidMetadataName.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY,
    JSON.stringify({
      ...JSON.parse(stringifiedUpdatesRequestHeaders ?? '{}'),
      'expo-channel-name': ctx.job.updates.channel,
    }),
    'value'
  );
  await AndroidConfig.Manifest.writeAndroidManifestAsync(manifestPath, androidManifest);
}

export async function androidGetNativelyDefinedChannelAsync(
  ctx: BuildContext<Job>
): Promise<string | null> {
  const manifestPath = await AndroidConfig.Paths.getAndroidManifestAsync(
    ctx.getReactNativeProjectDirectory()
  );

  if (!(await fs.pathExists(manifestPath))) {
    return null;
  }

  const androidManifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
  const stringifiedUpdatesRequestHeaders = AndroidConfig.Manifest.getMainApplicationMetaDataValue(
    androidManifest,
    AndroidMetadataName.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY
  );
  try {
    const updatesRequestHeaders = JSON.parse(stringifiedUpdatesRequestHeaders ?? '{}');
    return updatesRequestHeaders['expo-channel-name'] ?? null;
  } catch (err: any) {
    throw new Error(
      `Failed to parse ${AndroidMetadataName.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY} from AndroidManifest.xml: ${err.message}`
    );
  }
}

export async function androidSetClassicReleaseChannelNativelyAsync(
  ctx: BuildContext<Job>
): Promise<void> {
  const { releaseChannel } = ctx.job;
  assert(releaseChannel, 'releaseChannel must be defined');
  const escapedReleaseChannel = XML.escapeAndroidString(releaseChannel);

  const manifestPath = await AndroidConfig.Paths.getAndroidManifestAsync(
    ctx.getReactNativeProjectDirectory()
  );
  if (!(await fs.pathExists(manifestPath))) {
    throw new Error(`Couldn't find Android manifest at ${manifestPath}`);
  }

  // Store the release channel in a string resource to ensure it is interpreted as a string
  const stringResourcePath = await AndroidConfig.Strings.getProjectStringsXMLPathAsync(
    ctx.getReactNativeProjectDirectory()
  );
  const stringResourceObject = await AndroidConfig.Resources.readResourcesXMLAsync({
    path: stringResourcePath,
  });

  const resourceName = 'release_channel';
  const releaseChannelResourceItem = AndroidConfig.Resources.buildResourceItem({
    name: resourceName,
    value: escapedReleaseChannel,
  });
  const newStringResourceObject = AndroidConfig.Strings.setStringItem(
    [releaseChannelResourceItem],
    stringResourceObject
  );
  await XML.writeXMLAsync({ path: stringResourcePath, xml: newStringResourceObject });

  const androidManifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
  const mainApp = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  AndroidConfig.Manifest.addMetaDataItemToMainApplication(
    mainApp,
    AndroidMetadataName.RELEASE_CHANNEL,
    `@string/${resourceName}`,
    'value'
  );
  await AndroidConfig.Manifest.writeAndroidManifestAsync(manifestPath, androidManifest);
}

export async function androidGetNativelyDefinedClassicReleaseChannelAsync(
  ctx: BuildContext<Job>
): Promise<string | null> {
  const manifestPath = await AndroidConfig.Paths.getAndroidManifestAsync(
    ctx.getReactNativeProjectDirectory()
  );
  if (!(await fs.pathExists(manifestPath))) {
    return null;
  }

  const androidManifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
  return AndroidConfig.Manifest.getMainApplicationMetaDataValue(
    androidManifest,
    AndroidMetadataName.RELEASE_CHANNEL
  );
}

export async function androidGetNativelyDefinedRuntimeVersionAsync(
  ctx: BuildContext<Job>
): Promise<string | null> {
  const manifestPath = await AndroidConfig.Paths.getAndroidManifestAsync(
    ctx.getReactNativeProjectDirectory()
  );
  if (!(await fs.pathExists(manifestPath))) {
    return null;
  }

  const androidManifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
  return AndroidConfig.Manifest.getMainApplicationMetaDataValue(
    androidManifest,
    AndroidMetadataName.RUNTIME_VERSION
  );
}
