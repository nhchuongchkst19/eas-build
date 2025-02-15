import path from 'path';

import { createContext } from 'this-file';
import fs from 'fs-extra';

import { BuildStepFunction } from '../BuildStep.js';
import { BuildStepEnv } from '../BuildStepEnv.js';
import { SerializedBuildStepInput } from '../BuildStepInput.js';
import { SerializedBuildStepOutput } from '../BuildStepOutput.js';
import { SerializedBuildStepContext } from '../BuildStepContext.js';

import { spawnAsync } from './shell/spawn.js';

const thisFileCtx = createContext();

export const SCRIPTS_PATH = path.join(thisFileCtx.dirname, '../../dist_commonjs/scripts');

export interface SerializedCustomBuildFunctionArguments {
  env: BuildStepEnv;
  inputs: Record<string, SerializedBuildStepInput>;
  outputs: Record<string, SerializedBuildStepOutput>;
  ctx: SerializedBuildStepContext;
}

export function createCustomFunctionCall(rawCustomFunctionModulePath: string): BuildStepFunction {
  return async (ctx, { env, inputs, outputs }) => {
    let customFunctionModulePath = rawCustomFunctionModulePath;
    if (!(await fs.exists(ctx.global.projectSourceDirectory))) {
      const relative = path.relative(
        path.resolve(ctx.global.projectSourceDirectory),
        customFunctionModulePath
      );
      customFunctionModulePath = path.resolve(
        path.join(ctx.global.projectTargetDirectory, relative)
      );
    }
    const serializedArguments: SerializedCustomBuildFunctionArguments = {
      env,
      inputs: Object.fromEntries(
        Object.entries(inputs).map(([id, input]) => [id, input.serialize()])
      ),
      outputs: Object.fromEntries(
        Object.entries(outputs).map(([id, output]) => [id, output.serialize()])
      ),
      ctx: ctx.serialize(),
    };
    try {
      await spawnAsync(
        'node',
        [
          path.join(SCRIPTS_PATH, 'runCustomFunction.cjs'),
          customFunctionModulePath,
          JSON.stringify(serializedArguments),
        ],
        {
          logger: ctx.logger,
          cwd: ctx.workingDirectory,
          env,
        }
      );
    } catch {
      throw new Error(`Custom function exited with non-zero exit code.`);
    }
  };
}
