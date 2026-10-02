// hud mod: git runs through the engine's `$.process.run` (the original's
// Windows worker and process-tree handling have no place in the hooks
// environment).
import { execFile } from '../shims/child_process.js';
import { promisify } from '../shims/util.js';

const execFileAsync = promisify(execFile);

export const GIT_MAX_OUTPUT_BYTES = 1024 * 1024;

export interface GitCommandRunner {
  run(args: readonly string[], timeout: number): Promise<{ stdout: string }>;
  close(): Promise<void>;
}

export function createGitEnvironment(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    ...base,
    GIT_OPTIONAL_LOCKS: '0',
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'Never',
  };
}

class DirectGitRunner implements GitCommandRunner {
  constructor(private readonly cwd: string) {}

  async run(args: readonly string[], timeout: number): Promise<{ stdout: string }> {
    const { stdout } = await execFileAsync('git', [...args], {
      cwd: this.cwd,
      timeout,
      env: { GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
    });
    return { stdout };
  }

  async close(): Promise<void> {}
}

export function createGitRunner(cwd: string): GitCommandRunner {
  return new DirectGitRunner(cwd);
}
