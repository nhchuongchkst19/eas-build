import path from 'path';

import { BuildFunction, BuildStepInput, BuildStepInputValueTypeName } from '@expo/steps';
import nullthrows from 'nullthrows';

import { ArtifactType } from '../../context';
import { CustomBuildContext } from '../../customBuildContext';

enum BuildArtifactType {
  APPLICATION_ARCHIVE = 'application-archive',
  BUILD_ARTIFACT = 'build-artifact',
}

export function createUploadArtifactBuildFunction(ctx: CustomBuildContext): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'upload_artifact',
    name: 'Upload artifact',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'type',
        defaultValue: BuildArtifactType.APPLICATION_ARCHIVE,
        allowedValues: [BuildArtifactType.APPLICATION_ARCHIVE, BuildArtifactType.BUILD_ARTIFACT],
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
      BuildStepInput.createProvider({
        id: 'path',
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
    ],
    fn: async (stepsCtx, { inputs }) => {
      const artifactType = validateAndConvertBuildArtifactType(
        nullthrows(inputs.type.value).toString()
      );
      const filePath = path.resolve(
        stepsCtx.workingDirectory,
        nullthrows(inputs.path.value).toString()
      );
      await ctx.runtimeApi.uploadArtifacts(artifactType, [filePath], stepsCtx.logger);
    },
  });
}

function validateAndConvertBuildArtifactType(input: string): ArtifactType {
  const allowedValues: string[] = Object.values(BuildArtifactType);
  if (!allowedValues.includes(input)) {
    throw new Error(
      `"${input}" is not allowed artifact type, allowed values: ${allowedValues
        .map((i) => `"${i}"`)
        .join(', ')}`
    );
  }
  return input === BuildArtifactType.APPLICATION_ARCHIVE
    ? ArtifactType.APPLICATION_ARCHIVE
    : ArtifactType.BUILD_ARTIFACTS;
}
