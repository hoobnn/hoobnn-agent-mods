// hud mod: git runs through the engine's `$.process.run` (via the
// child_process shim); the Windows worker and its tree-kill have no place in
// the hooks environment.
import { execFile } from '../shims/child_process.js';

export const GIT_MAX_OUTPUT_BYTES = 1024 * 1024;

export class GitTimeoutError extends Error {}

export function createGitEnvironment(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return { ...base, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' };
}

/** Run git and resolve with its stdout. Rejects on non-zero exit or timeout. */
export function runGit(cwd: string, args: readonly string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', [...args], {
      cwd,
      timeout,
      env: { GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
    }, (error: unknown, stdout?: string) => {
      if (!error) resolve(stdout ?? '');
      else reject((error as { killed?: boolean }).killed ? new GitTimeoutError(`git ${args.join(' ')} timed out`) : error);
    });
  });
}
