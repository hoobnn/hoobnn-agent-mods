import * as fs from '../shims/fs.js';
import * as path from '../shims/path.js';
import * as readline from '../shims/readline.js';
import { getIo } from '../shims/host.js';
import { createDebug } from './debug.js';
import type { AgentEntry, SessionTokenUsage, TodoItem, ToolEntry, TranscriptData } from './types.js';
import { displayLabel, sanitizeDisplayText } from './utils/sanitize.js';
import { truncateString } from './utils/truncate.js';
import { sanitizeTranscriptModel } from './model-source.js';

const debug = createDebug('transcript');

const TOOLS_KEPT = 20;
const AGENTS_KEPT = 10;
// Tools are tracked beyond those shown so an MCP call's late error still counts, but
// bounded so the parser stays small however long the session runs.
const TOOLS_TRACKED = 256;
const NAME_MAX_LEN = 64;
const ADVISOR_MODEL_MAX_LEN = 64;
const MESSAGE_ID_MAX_LEN = 128;
const MESSAGE_IDS_MAX = 4096;
const MCP_ERRORS_MAX = 64;
const MCP_TOOL = /^mcp__(.+?)__(.+)$/;
// Claude Code's /effort output; anchored so prose quoting it can't flip ultracode.
const EFFORT_COMMAND = /^<local-command-stdout>Set effort level to (\w+)/;

interface Usage {
  input_tokens?: unknown;
  output_tokens?: unknown;
  cache_creation_input_tokens?: unknown;
  cache_read_input_tokens?: unknown;
}

interface Block {
  type?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  is_error?: boolean;
}

interface Entry {
  type?: string;
  subtype?: string;
  operation?: string;
  content?: unknown;
  timestamp?: string;
  isSidechain?: boolean;
  advisorModel?: unknown;
  message?: { id?: unknown; model?: unknown; content?: Block[] | string; usage?: Usage };
  toolUseResult?: { resolvedModel?: unknown; isAsync?: unknown; status?: unknown };
  compactMetadata?: { postTokens?: unknown };
  attachment?: { type?: string; prompt?: unknown };
}

const emptyTranscript = (): TranscriptData => ({ tools: [], skills: [], mcpServers: [], mcpErrors: [], agents: [], todos: [] });

const ZERO_USAGE: SessionTokenUsage = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 };
const USAGE_FIELDS = Object.keys(ZERO_USAGE) as (keyof SessionTokenUsage)[];

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;

function addUsage(total: SessionTokenUsage, usage: SessionTokenUsage): void {
  for (const field of USAGE_FIELDS) total[field] += usage[field];
}

const name = (value: unknown): string | undefined => displayLabel(value, NAME_MAX_LEN, '…') || undefined;

const mcpServer = (toolName: string): string | undefined => name(MCP_TOOL.exec(toolName)?.[1]);

// Tool inputs are written by the model, so their text is untrusted terminal input.
const text = (value: unknown): string | undefined =>
  typeof value === 'string' ? sanitizeDisplayText(value) || undefined : undefined;

function toolTarget(toolName: string, input: Record<string, unknown> | undefined): string | undefined {
  if (!input) return undefined;
  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return text(input.file_path ?? input.path);
    case 'Glob':
    case 'Grep':
      return text(input.pattern);
    case 'Skill':
      return name(input.skill);
    case 'Bash': {
      const command = text(input.command)?.replace(/\s+/g, ' ').trim();
      if (!command) return undefined;
      return command.length > 30 ? `${truncateString(command, 30, '').trimEnd()}...` : command;
    }
  }
  return undefined;
}

function taskStatus(status: unknown): TodoItem['status'] | null {
  switch (status) {
    case 'pending':
    case 'not_started':
      return 'pending';
    case 'in_progress':
    case 'running':
      return 'in_progress';
    case 'completed':
    case 'complete':
    case 'done':
      return 'completed';
    default:
      return null;
  }
}

function toTodo(value: unknown): TodoItem[] {
  const todo = value as { content?: unknown; status?: unknown } | null;
  const content = text(todo?.content);
  const status = taskStatus(todo?.status);
  return content && status ? [{ content, status }] : [];
}

export class Parser {
  private tools = new Map<string, ToolEntry>();
  private agents = new Map<string, AgentEntry>();
  private skills = new Set<string>();
  private mcpServers = new Set<string>();
  private mcpErrors = new Set<string>();
  private todos: TodoItem[] = [];
  // Task id -> index in todos; -1 marks a task that was deleted or dropped by TodoWrite.
  private taskIndex = new Map<string, number>();
  // Claude Code numbers TaskCreate tasks 1, 2, 3... and never reuses a number.
  private nextTaskId = 1;
  // hud mod: Claude Code logs an assistant message again after its tool results, so a
  // tool_use seen twice would be marked running again (and a TaskCreate counted twice).
  private seenToolUses = new Set<string>();
  private agentCompletions = new Map<string, Date>();
  // Some task-notifications omit <tool-use-id>, carrying only <task-id> (= the
  // launch toolUseResult's agentId). Map agentId -> toolUseId from the launch
  // result so those notifications can still resolve completion.
  private agentIdToToolUseId = new Map<string, string>();
  // Claude Code logs one API response several times, sometimes non-adjacently, so usage
  // is the per-field max per message id. Ids evicted to bound memory settle into `settled`.
  private usageById = new Map<string, SessionTokenUsage>();
  private settled: SessionTokenUsage = { ...ZERO_USAGE };
  private lastIdlessUsage: string | undefined;
  private data: TranscriptData = { ...emptyTranscript(), compactionCount: 0 };

  line(raw: string): void {
    let entry: Entry | null = null;
    try {
      entry = raw.trim() ? JSON.parse(raw) : null;
    } catch {
      // Malformed lines are skipped.
    }
    if (!entry || typeof entry !== 'object') {
      this.lastIdlessUsage = undefined;
      return;
    }

    const time = entry.timestamp ? new Date(entry.timestamp) : null;
    const at = time && !Number.isNaN(time.getTime()) ? time : null;
    if (at && !this.data.sessionStart) this.data.sessionStart = at;

    if (entry.type === 'assistant') {
      this.assistant(entry, at);
    } else {
      this.lastIdlessUsage = undefined;
    }
    if (entry.type === 'user' && typeof entry.message?.content === 'string') {
      const effort = EFFORT_COMMAND.exec(entry.message.content);
      if (effort) this.data.ultracodeActive = effort[1].toLowerCase() === 'ultracode';
    }
    if (entry.type === 'attachment') {
      if (entry.attachment?.type === 'ultra_effort_enter') this.data.ultracodeActive = true;
      if (entry.attachment?.type === 'ultra_effort_exit') this.data.ultracodeActive = false;
    }
    if (entry.type === 'system' && entry.subtype === 'compact_boundary' && at) {
      this.data.compactionCount = (this.data.compactionCount ?? 0) + 1;
      const post = entry.compactMetadata?.postTokens;
      this.data.contextTokens = typeof post === 'number' && Number.isFinite(post) && post >= 0 ? Math.trunc(post) : undefined;
    }
    // A background agent's tool_result lands at launch; its completion is this enqueue,
    // or (forked/resumed sessions) a queued_command attachment carrying the same notice.
    const notice =
      entry.type === 'queue-operation' && entry.operation === 'enqueue' ? entry.content
      : entry.type === 'attachment' && entry.attachment?.type === 'queued_command' ? entry.attachment.prompt
      : undefined;
    if (typeof notice === 'string' && at) {
      const taskId = /<task-id>([^<]+)<\/task-id>/.exec(notice)?.[1];
      const toolUseId =
        /<tool-use-id>([^<]+)<\/tool-use-id>/.exec(notice)?.[1] ??
        (taskId ? this.agentIdToToolUseId.get(taskId) : undefined);
      // Both carriers can log the same notice; the earliest is when the agent finished.
      // Background Bash and Monitor tasks send the same notice; only agents' are kept.
      const prev = toolUseId && this.agentCompletions.get(toolUseId);
      if (toolUseId && taskId && this.agents.has(toolUseId) && !(prev && prev <= at)) this.agentCompletions.set(toolUseId, at);
    }

    // Only real turns carry activity; api-request-blob lines replay earlier messages' blocks.
    if ((entry.type === 'assistant' || entry.type === 'user') && Array.isArray(entry.message?.content)) {
      for (const block of entry.message.content) {
        if (block?.type === 'tool_use' && block.id && block.name) this.toolUse(block, at ?? new Date());
        if (block?.type === 'tool_result' && block.tool_use_id) this.toolResult(block, entry, at ?? new Date());
      }
    }
  }

  private assistant(entry: Entry, at: Date | null): void {
    if (at) this.data.lastAssistantResponseAt = at;
    if (typeof entry.advisorModel === 'string' && entry.advisorModel) {
      this.data.advisorModel = truncateString(entry.advisorModel, ADVISOR_MODEL_MAX_LEN, '');
    }
    const model = sanitizeTranscriptModel(entry.message?.model);
    // Claude Code writes '<synthetic>' on assistant records it generates locally.
    if (model && model !== '<synthetic>') this.data.lastAssistantModel = model;

    const raw = entry.message?.usage;
    if (!raw) {
      this.lastIdlessUsage = undefined;
      return;
    }
    const usage: SessionTokenUsage = {
      inputTokens: count(raw.input_tokens),
      outputTokens: count(raw.output_tokens),
      cacheCreationTokens: count(raw.cache_creation_input_tokens),
      cacheReadTokens: count(raw.cache_read_input_tokens),
    };
    // A main-conversation request always sends some context, so zero is a placeholder: gateways that
    // write one record per content block give thinking blocks all-zero usage. Keep the last real size.
    const contextTokens = usage.inputTokens + usage.cacheCreationTokens + usage.cacheReadTokens;
    if (entry.isSidechain !== true && contextTokens > 0) {
      this.data.contextTokens = contextTokens;
    }

    const id = entry.message?.id;
    if (typeof id === 'string' && id && id.length <= MESSAGE_ID_MAX_LEN) {
      this.lastIdlessUsage = undefined;
      const previous = this.usageById.get(id);
      this.usageById.set(id, previous ? maxUsage(previous, usage) : usage);
      if (this.usageById.size > MESSAGE_IDS_MAX) {
        const [oldestId, oldest] = this.usageById.entries().next().value as [string, SessionTokenUsage];
        this.usageById.delete(oldestId);
        addUsage(this.settled, oldest);
      }
      return;
    }
    // Without an id, only an identical record right after the previous one is a duplicate.
    const fingerprint = JSON.stringify(usage);
    if (fingerprint !== this.lastIdlessUsage) addUsage(this.settled, usage);
    this.lastIdlessUsage = fingerprint;
  }

  private toolUse(block: Block, at: Date): void {
    if (this.seenToolUses.has(block.id as string)) return;
    this.seenToolUses.add(block.id as string);
    const toolName = block.name as string;
    const input = block.input;
    const skill = toolName === 'Skill' ? name(input?.skill) : undefined;
    if (skill) this.skills.add(skill);
    const server = mcpServer(toolName);
    if (server) this.mcpServers.add(server);

    if (toolName === 'Task' || toolName === 'Agent') {
      this.agents.set(block.id as string, {
        id: block.id as string,
        type: (input?.subagent_type as string) ?? 'agent',
        model: sanitizeTranscriptModel(input?.model),
        description: (input?.description as string) ?? undefined,
        status: 'running',
        startTime: at,
        background: input?.run_in_background === true,
      });
      if (cap(this.agents, AGENTS_KEPT)) {
        // Completions and launch ids only matter for agents still tracked.
        for (const id of this.agentCompletions.keys()) if (!this.agents.has(id)) this.agentCompletions.delete(id);
        for (const [agentId, id] of this.agentIdToToolUseId) if (!this.agents.has(id)) this.agentIdToToolUseId.delete(agentId);
      }
    } else if (toolName === 'TodoWrite') {
      if (Array.isArray(input?.todos)) this.replaceTodos(input.todos.flatMap(toTodo));
    } else if (toolName === 'TaskCreate') {
      const content = text(input?.subject) ?? text(input?.description);
      this.todos.push({ content: content ?? 'Untitled task', status: taskStatus(input?.status) ?? 'pending' });
      const numbered = String(this.nextTaskId++);
      const explicit = typeof input?.taskId === 'string' || typeof input?.taskId === 'number' ? String(input.taskId) : null;
      for (const id of explicit ? [explicit] : [numbered, block.id]) if (id) this.taskIndex.set(id, this.todos.length - 1);
    } else if (toolName === 'TaskUpdate') {
      const index = this.findTask(input?.taskId);
      if (index === null) return;
      const todo = this.todos[index];
      if (input?.status === 'deleted') {
        // Drop the task, retire its ids, and shift later tasks' ids up one.
        this.todos.splice(index, 1);
        this.moveTasks((i) => (i === index ? -1 : i > index ? i - 1 : i));
        return;
      }
      const status = taskStatus(input?.status);
      if (status) todo.status = status;
      const content = text(input?.subject) ?? text(input?.description);
      if (content) todo.content = content;
    } else {
      this.tools.set(block.id as string, {
        id: block.id as string,
        name: toolName,
        target: toolTarget(toolName, input),
        status: 'running',
        startTime: at,
      });
      cap(this.tools, TOOLS_TRACKED);
    }
  }

  private toolResult(block: Block, entry: Entry, at: Date): void {
    const id = block.tool_use_id as string;
    const tool = this.tools.get(id);
    if (tool) {
      tool.status = block.is_error ? 'error' : 'completed';
      tool.endTime = at;
      const server = mcpServer(tool.name);
      if (server && block.is_error) {
        this.mcpErrors.add(server);
        cap(this.mcpErrors, MCP_ERRORS_MAX);
      } else if (server) {
        this.mcpErrors.delete(server);
      }
    }

    const agent = this.agents.get(id);
    if (agent) {
      const agentId = (entry.toolUseResult as { agentId?: unknown } | undefined)?.agentId;
      if (typeof agentId === 'string' && agentId) {
        this.agentIdToToolUseId.set(agentId, id);
        agent.agentId = agentId;
      }
      // resolvedModel is what the subagent actually ran on, so it beats the caller's alias.
      agent.model = sanitizeTranscriptModel(entry.toolUseResult?.resolvedModel) ?? agent.model;
      if (entry.toolUseResult?.isAsync === true || entry.toolUseResult?.status === 'async_launched') {
        agent.background = true;
      }
      if (!agent.background) agent.endTime = at;
    }
  }

  // TodoWrite replaces the list. Each todo takes over the ids of the first unclaimed old todo
  // with the same content, so duplicate-content todos each keep their own; dropped todos' ids retire.
  private replaceTodos(next: TodoItem[]): void {
    const oldByContent = new Map<string, number[]>();
    this.todos.forEach((todo, index) => oldByContent.set(todo.content, [...(oldByContent.get(todo.content) ?? []), index]));
    const moved = new Map<number, number>();
    next.forEach((todo, index) => {
      const old = oldByContent.get(todo.content)?.shift();
      if (old !== undefined) moved.set(old, index);
    });
    this.todos = [...next];
    this.moveTasks((index) => moved.get(index) ?? -1);
  }

  // Points each live task id at its todo's new index, or retires it with -1 so it can't
  // fall back to whichever task now holds its old position.
  private moveTasks(to: (index: number) => number): void {
    for (const [id, index] of this.taskIndex) if (index >= 0) this.taskIndex.set(id, to(index));
  }

  // TaskUpdate names a task by the id TaskCreate returned, or by its 1-based position.
  // A retired id finds nothing rather than falling back to a position.
  private findTask(taskId: unknown): number | null {
    if (typeof taskId !== 'string' && typeof taskId !== 'number') return null;
    const key = String(taskId);
    const mapped = this.taskIndex.get(key);
    if (mapped !== undefined) return mapped >= 0 ? mapped : null;
    const position = /^\d+$/.test(key) ? Number(key) - 1 : -1;
    return position >= 0 && position < this.todos.length ? position : null;
  }

  finish(): TranscriptData {
    for (const [id, endTime] of this.agentCompletions) {
      const agent = this.agents.get(id);
      if (agent?.background) agent.endTime = endTime;
    }
    for (const agent of this.agents.values()) {
      if (agent.endTime) agent.status = 'completed';
    }
    const sessionTokens = { ...this.settled };
    for (const usage of this.usageById.values()) addUsage(sessionTokens, usage);
    return {
      ...this.data,
      tools: [...this.tools.values()].slice(-TOOLS_KEPT),
      agents: [...this.agents.values()],
      skills: [...this.skills],
      mcpServers: [...this.mcpServers],
      mcpErrors: [...this.mcpErrors],
      todos: this.todos,
      sessionTokens,
    };
  }
}

/** Drops the oldest entries past `max`, returning whether any went. */
function cap<K>(collection: Map<K, unknown> | Set<K>, max: number): boolean {
  const over = collection.size > max;
  for (const key of collection.keys()) {
    if (collection.size <= max) break;
    collection.delete(key);
  }
  return over;
}

function maxUsage(a: SessionTokenUsage, b: SessionTokenUsage): SessionTokenUsage {
  return {
    inputTokens: Math.max(a.inputTokens, b.inputTokens),
    outputTokens: Math.max(a.outputTokens, b.outputTokens),
    cacheCreationTokens: Math.max(a.cacheCreationTokens, b.cacheCreationTokens),
    cacheReadTokens: Math.max(a.cacheReadTokens, b.cacheReadTokens),
  };
}

// hud mod: the mod parses the transcript incrementally (only appended lines,
// one Parser kept per transcript) and answers here; the stream read below
// stays as upstream wrote it for when no provider is set.
let transcriptProvider: ((transcriptPath: string) => Promise<TranscriptData | null>) | null = null;

export function setTranscriptProvider(provider: (transcriptPath: string) => Promise<TranscriptData | null>): void {
  transcriptProvider = provider;
}

export async function parseTranscript(transcriptPath: string): Promise<TranscriptData> {
  if (transcriptProvider) {
    const provided = await transcriptProvider(transcriptPath);
    if (provided) return provided;
  }
  try {
    if (!transcriptPath || !fs.statSync(transcriptPath).isFile()) return emptyTranscript();
  } catch {
    return emptyTranscript();
  }
  const parser = new Parser();
  try {
    const input = fs.createReadStream(transcriptPath);
    for await (const raw of readline.createInterface({ input, crlfDelay: Infinity })) {
      parser.line(raw);
    }
  } catch (err) {
    // A read cut short still renders what was parsed.
    debug('Transcript read failed:', err instanceof Error ? err.message : err);
  }
  return parser.finish();
}

// The id comes from the transcript and names a file, so only a plain token is used.
const AGENT_ID = /^[\w-]{1,64}$/;
// A subagent's effort is set by its first reply and never changes, so each is looked up once.
const efforts = new Map<string, string>();

/** A subagent's effort, from the first assistant record of `<session>/subagents/agent-<id>.jsonl`. */
async function subagentEffort(transcriptPath: string, agentId: string): Promise<string | undefined> {
  if (!AGENT_ID.test(agentId)) return undefined;
  const known = efforts.get(agentId);
  if (known !== undefined) return known || undefined;
  const file = path.join(path.dirname(transcriptPath), path.basename(transcriptPath, '.jsonl'), 'subagents', `agent-${agentId}.jsonl`);
  // grep stops at the first few candidates, so a long subagent transcript isn't read whole.
  const out = await getIo().run(['grep', '-m', '4', '-F', '"type":"assistant"', file], { timeoutMs: 1_000 }).catch(() => null);
  if (!out || out.exitCode !== 0) return undefined;
  for (const raw of out.stdout.split('\n')) {
    let entry: { type?: unknown; effort?: unknown } | null = null;
    try {
      entry = JSON.parse(raw);
    } catch {
      continue;
    }
    if (entry?.type !== 'assistant') continue;
    const effort = typeof entry.effort === 'string' ? entry.effort : '';
    efforts.set(agentId, effort);
    return effort || undefined;
  }
  return undefined;
}

/** Sets each agent's effort in place; agents without a known id or first reply stay without one. */
export async function addSubagentEfforts(transcriptPath: string, agents: AgentEntry[]): Promise<void> {
  await Promise.all(agents.map(async (agent) => {
    if (agent.agentId) agent.effort = await subagentEffort(transcriptPath, agent.agentId);
  }));
}
