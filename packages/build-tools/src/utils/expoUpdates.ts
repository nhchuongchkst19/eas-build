import assert from 'assert';

import { Platform, Job } from '@expo/eas-build-job';
import { getRuntimeVersionNullable } from '@expo/config-plugins/build/utils/Updates';

import {
  androidSetRuntimeVersionNativelyAsync,
  androidSetChannelNativelyAsync,
  androidSetClassicReleaseChannelNativelyAsync,
  androidGetNativelyDefinedClassicReleaseChannelAsync,
  androidGetNativelyDefinedRuntimeVersionAsync,
  androidGetNativelyDefinedChannelAsync,
} from '../android/expoUpdates';
import {
  iosSetRuntimeVersionNativelyAsync,
  iosSetChannelNativelyAsync,
  iosSetClassicReleaseChannelNativelyAsync,
  iosGetNativelyDefinedClassicReleaseChannelAsync,
  iosGetNativelyDefinedRuntimeVersionAsync,
  iosGetNativelyDefinedChannelAsync,
} from '../ios/expoUpdates';
import { BuildContext } from '../context';

import isExpoUpdatesInstalledAsync from './isExpoUpdatesInstalled';

export async function setRuntimeVersionNativelyAsync(
  ctx: BuildContext<Job>,
  runtimeVersion: string
): Promise<void> {
  switch (ctx.job.platform) {
    case Platform.ANDROID: {
      await androidSetRuntimeVersionNativelyAsync(ctx, runtimeVersion);
      return;
    }
    case Platform.IOS: {
      await iosSetRuntimeVersionNativelyAsync(ctx, runtimeVersion);
      return;
    }
    default:
      throw new Error(`Platform is not supported.`);
  }
}

/**
 * Used for when Expo Updates is pointed at an EAS server.
 */
export async function setChannelNativelyAsync(ctx: BuildContext<Job>): Promise<void> {
  assert(ctx.job.updates?.channel, 'updates.channel must be defined');
  const newUpdateRequestHeaders: Record<string, string> = {
    'expo-channel-name': ctx.job.updates.channel,
  };

  const configFile = ctx.job.platform === Platform.ANDROID ? 'AndroidManifest.xml' : 'Expo.plist';
  ctx.logger.info(
    `Setting the update request headers in '${configFile}' to '${JSON.stringify(
      newUpdateRequestHeaders
    )}'`
  );

  switch (ctx.job.platform) {
    case Platform.ANDROID: {
      await androidSetChannelNativelyAsync(ctx);
      return;
    }
    case Platform.IOS: {
      await iosSetChannelNativelyAsync(ctx);
      return;
    }
    default:
      throw new Error(`Platform is not supported.`);
  }
}

/**
 * Used for classic Expo Updates
 */
export async function setClassicReleaseChannelNativelyAsync(ctx: BuildContext<Job>): Promise<void> {
  assert(ctx.job.releaseChannel, 'releaseChannel must be defined');

  const configFile = ctx.job.platform === Platform.ANDROID ? 'AndroidManifest.xml' : 'Expo.plist';
  ctx.logger.info(`Setting the release channel in '${configFile}' to '${ctx.job.releaseChannel}'`);

  switch (ctx.job.platform) {
    case Platform.ANDROID: {
      await androidSetClassicReleaseChannelNativelyAsync(ctx);
      return;
    }
    case Platform.IOS: {
      await iosSetClassicReleaseChannelNativelyAsync(ctx);
      return;
    }
    default:
      throw new Error(`Platform is not supported.`);
  }
}

/**
 * Used for classic Expo Updates
 */
export async function getNativelyDefinedClassicReleaseChannelAsync(
  ctx: BuildContext<Job>
): Promise<string | null> {
  switch (ctx.job.platform) {
    case Platform.ANDROID: {
      return androidGetNativelyDefinedClassicReleaseChannelAsync(ctx);
    }
    case Platform.IOS: {
      return iosGetNativelyDefinedClassicReleaseChannelAsync(ctx);
    }
    default:
      throw new Error(`Platform is not supported.`);
  }
}

export async function configureClassicExpoUpdatesAsync(ctx: BuildContext<Job>): Promise<void> {
  if (ctx.job.releaseChannel) {
    await setClassicReleaseChannelNativelyAsync(ctx);
  } else {
    /**
     * If releaseChannel is not defined:
     *  1. Try to infer it from the native value.
     *  2. If it is not set, fallback to 'default'.
     */
    const releaseChannel = await getNativelyDefinedClassicReleaseChannelAsync(ctx);
    if (releaseChannel) {
      ctx.logger.info(
        `Using the release channel pre-configured in native project (${releaseChannel})`
      );
      ctx.logger.warn('Please add the "releaseChannel" field to your build profile (eas.json)');
    } else {
      ctx.logger.info(`Using default release channel for 'expo-updates' (default)`);
    }
  }
}

export async function configureEASExpoUpdatesAsync(ctx: BuildContext<Job>): Promise<void> {
  await setChannelNativelyAsync(ctx);
}

export async function configureExpoUpdatesIfInstalledAsync(ctx: BuildContext<Job>): Promise<void> {
  if (!(await isExpoUpdatesInstalledAsync(ctx.getReactNativeProjectDirectory()))) {
    return;
  }

  const appConfigRuntimeVersion =
    ctx.job.version?.runtimeVersion ?? getRuntimeVersionNullable(ctx.appConfig, ctx.job.platform);
  if (ctx.metadata?.runtimeVersion && ctx.metadata?.runtimeVersion !== appConfigRuntimeVersion) {
    ctx.markBuildPhaseHasWarnings();
    ctx.logger.warn(
      `Runtime version from the app config evaluated on your local machine (${ctx.metadata.runtimeVersion}) does not match the one resolved here (${appConfigRuntimeVersion}).`
    );
    ctx.logger.warn(
      "If you're using conditional app configs, e.g. depending on an environment variable, make sure to set the variable in eas.json or configure it with EAS Secret."
    );
  }

  if (isEASUpdateConfigured(ctx)) {
    if (ctx.job.updates?.channel !== undefined) {
      await configureEASExpoUpdatesAsync(ctx);
    } else {
      const channel = await getChannelAsync(ctx);
      if (channel !== null) {
        const configFile =
          ctx.job.platform === Platform.ANDROID ? 'AndroidManifest.xml' : 'Expo.plist';
        ctx.logger.info(`The channel name for EAS Update in ${configFile} is set to "${channel}"`);
      } else {
        if (ctx.job.releaseChannel !== undefined) {
          ctx.logger.warn(
            `This build is configured with EAS Update however has a Classic Updates releaseChannel set instead of having an EAS Update channel.`
          );
        } else {
          ctx.logger.warn(
            `This build is configured to query EAS Update for updates, however no channel is set in eas.json.`
          );
        }
        ctx.markBuildPhaseHasWarnings();
      }
    }
  } else {
    await configureClassicExpoUpdatesAsync(ctx);
  }

  if (ctx.job.version?.runtimeVersion) {
    ctx.logger.info('Updating runtimeVersion in Expo.plist');
    await setRuntimeVersionNativelyAsync(ctx, ctx.job.version.runtimeVersion);
  }
}

export async function getChannelAsync(ctx: BuildContext<Job>): Promise<string | null> {
  switch (ctx.job.platform) {
    case Platform.ANDROID: {
      return await androidGetNativelyDefinedChannelAsync(ctx);
    }
    case Platform.IOS: {
      return await iosGetNativelyDefinedChannelAsync(ctx);
    }
    default:
      throw new Error(`Platform is not supported.`);
  }
}

export async function getRuntimeVersionAsync(ctx: BuildContext<Job>): Promise<string | null> {
  switch (ctx.job.platform) {
    case Platform.ANDROID: {
      return await androidGetNativelyDefinedRuntimeVersionAsync(ctx);
    }
    case Platform.IOS: {
      return await iosGetNativelyDefinedRuntimeVersionAsync(ctx);
    }
    default:
      throw new Error(`Platform is not supported.`);
  }
}

export function isEASUpdateConfigured(ctx: BuildContext<Job>): boolean {
  const rawUrl = ctx.appConfig.updates?.url;
  if (!rawUrl) {
    return false;
  }
  try {
    const url = new URL(rawUrl);
    return ['u.expo.dev', 'staging-u.expo.dev'].includes(url.hostname);
  } catch (err) {
    ctx.logger.error({ err }, `Cannot parse expo.updates.url = ${rawUrl} as URL`);
    ctx.logger.error(`Assuming EAS Update is not configured`);
    return false;
  }
}
