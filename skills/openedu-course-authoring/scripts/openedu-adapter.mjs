#!/usr/bin/env node
import { existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/**
 * Discovers an Open-Edu repository from `startDir`, walking upward.
 * Returns capabilities based on actual executable presence, not just directory detection.
 *
 * @param {string} startDir
 * @returns {DiscoveryResult}
 */
export function discoverRepository(startDir = process.cwd()) {
  const repoRoot = findRepoRoot(startDir);

  const result = {
    mode: repoRoot ? 'repository' : 'portable',
    repoRoot,
    capabilities: {
      compiler: { packagePresent: false, executable: false },
      cli: { packagePresent: false, executable: false },
      widgetCatalog: false,
      engineSkillsCatalog: false,
      domainGuidance: false,
      pipeline: { packagePresent: false, executable: false },
      examples: false,
    },
    commands: {},
    paths: {
      compilerRoot: null,
      cliRoot: null,
      widgetsRoot: null,
      pipelineRoot: null,
      catalogData: null,
      guidanceData: null,
      examplesDir: null,
      engineSkillsManifest: null,
      engineSkillsRoot: null,
    },
    unavailable: [],
  };

  if (!repoRoot) {
    result.unavailable = [
      'compiler',
      'cli',
      'widgetCatalog',
      'engineSkillsCatalog',
      'pipeline',
      'examples',
    ];
    return result;
  }

  const compilerPath = join(repoRoot, 'packages', 'course-compiler');
  if (existsSync(join(compilerPath, 'package.json'))) {
    result.capabilities.compiler.packagePresent = true;
    result.paths.compilerRoot = compilerPath;
  }

  const cliPath = join(repoRoot, 'packages', 'cli');
  if (existsSync(join(cliPath, 'package.json'))) {
    result.capabilities.cli.packagePresent = true;
    result.paths.cliRoot = cliPath;

    const cliEntry = join(cliPath, 'dist', 'cli.js');
    if (existsSync(cliEntry) && statSync(cliEntry).isFile()) {
      result.capabilities.cli.executable = true;
    }
  }

  const widgetsPath = join(repoRoot, 'packages', 'widgets');
  if (existsSync(join(widgetsPath, 'package.json'))) {
    result.paths.widgetsRoot = widgetsPath;
  }

  const catalogDataPath = join(repoRoot, 'packages', 'core', 'src', 'widget-catalog-data.json');
  if (existsSync(catalogDataPath)) {
    result.capabilities.widgetCatalog = true;
    result.paths.catalogData = catalogDataPath;
  }

  const domainGuidanceDataPath = join(repoRoot, 'packages', 'domain-guidance', 'src', 'data');
  if (existsSync(domainGuidanceDataPath)) {
    result.capabilities.domainGuidance = true;
    result.paths.guidanceData = domainGuidanceDataPath;
  }

  const engineSkillsManifestPath = join(
    repoRoot,
    'node_modules',
    '@knowledgeassemble',
    'engine-skills',
    'manifest.json',
  );
  if (existsSync(engineSkillsManifestPath)) {
    result.capabilities.engineSkillsCatalog = true;
    result.paths.engineSkillsManifest = engineSkillsManifestPath;
    result.paths.engineSkillsRoot = join(
      repoRoot,
      'node_modules',
      '@knowledgeassemble',
      'engine-skills',
    );
  }

  const pipelinePath = join(repoRoot, 'packages', 'pipeline');
  if (existsSync(join(pipelinePath, 'package.json'))) {
    result.capabilities.pipeline.packagePresent = true;
    result.paths.pipelineRoot = pipelinePath;
  }

  const examplesPath = join(repoRoot, 'examples');
  if (existsSync(examplesPath)) {
    result.capabilities.examples = true;
    result.paths.examplesDir = examplesPath;
  }

  Object.assign(result.commands, resolveOpenEduCommands(result));

  const flatCaps = {
    compiler: result.capabilities.compiler.executable,
    cli: result.capabilities.cli.executable,
    widgetCatalog: result.capabilities.widgetCatalog,
    engineSkillsCatalog: result.capabilities.engineSkillsCatalog,
    pipeline: result.capabilities.pipeline.packagePresent,
    examples: result.capabilities.examples,
  };
  for (const [key, val] of Object.entries(flatCaps)) {
    if (!val) result.unavailable.push(key);
  }

  return result;
}

/**
 * Resolves how Open-Edu commands can actually be invoked.
 * Returns structured argv arrays, never shell-interpolated strings.
 *
 * @param {DiscoveryResult} discovery
 * @returns {Record<string, CommandResolution>}
 */
export function resolveOpenEduCommands(discovery) {
  /** @type {Record<string, CommandResolution>} */
  const commands = {};

  const repoRoot = discovery.repoRoot;
  if (!repoRoot) return commands;

  const cli = discovery.capabilities.cli;

  if (cli?.executable && discovery.paths.cliRoot) {
    const cliEntry = join(discovery.paths.cliRoot, 'dist', 'cli.js');

    commands.compile = {
      executable: true,
      argv: ['node', cliEntry, 'compile', '{spec}', '--output', '{dir}', '--validate'],
      prerequisites: [],
    };

    commands.validate = {
      executable: true,
      argv: ['node', cliEntry, 'validate', '{dir}'],
      prerequisites: [],
    };

    commands.lintContent = {
      executable: true,
      argv: ['node', cliEntry, 'lint-content', '{dir}'],
      prerequisites: [],
    };

    commands.dev = {
      executable: true,
      argv: ['node', cliEntry, 'dev', '{dir}'],
      prerequisites: [],
    };
  } else if (cli?.packagePresent) {
    commands.compile = {
      executable: false,
      argv: null,
      prerequisites: [
        { type: 'build', command: ['pnpm', '--filter', '@open-edu/cli', 'build'] },
      ],
    };

    commands.validate = {
      executable: false,
      argv: null,
      prerequisites: [
        { type: 'build', command: ['pnpm', '--filter', '@open-edu/cli', 'build'] },
      ],
    };

    commands.lintContent = {
      executable: false,
      argv: null,
      prerequisites: [
        { type: 'build', command: ['pnpm', '--filter', '@open-edu/cli', 'build'] },
      ],
    };

    commands.dev = {
      executable: false,
      argv: null,
      prerequisites: [
        { type: 'build', command: ['pnpm', '--filter', '@open-edu/cli', 'build'] },
      ],
    };
  }

  if (discovery.paths.widgetsRoot) {
    commands.generateCatalog = {
      executable: true,
      argv: ['pnpm', '--filter', '@open-edu/widgets', 'generate:catalog'],
      prerequisites: [],
    };
  }

  if (discovery.capabilities.pipeline.packagePresent) {
    commands.pipelineGenerate = {
      executable: true,
      argv: [
        'pnpm', '--filter', '@open-edu/pipeline', 'curriculum:generate',
        '--pdf', '{file}', '--subject', '{subject}',
      ],
      prerequisites: [],
    };
  }

  commands.installEngineSkills = {
    executable: false,
    argv: null,
    prerequisites: [
      { type: 'install', command: ['pnpm', 'add', '@knowledgeassemble/engine-skills'] },
    ],
    hint: 'Install @knowledgeassemble/engine-skills to enable interactive lesson node authoring.',
  };

  commands.buildAll = {
    executable: true,
    argv: ['pnpm', 'build'],
    prerequisites: [],
  };

  return commands;
}

/**
 * Runs an Open-Edu command using structured argv. Never invokes a shell.
 *
 * @param {string[]} argv - command arguments array
 * @param {RunOptions} [options]
 * @returns {CommandResult}
 */
export function runOpenEduCommand(argv, options = {}) {
  const start = Date.now();
  const [program, ...args] = argv;

  const result = spawnSync(program, args, {
    cwd: options.cwd || process.cwd(),
    env: { ...process.env, ...options.env },
    timeout: options.timeout || 120_000,
    encoding: 'utf-8',
    maxBuffer: options.maxBuffer || 10 * 1024 * 1024,
  });

  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    command: argv,
    durationMs: Date.now() - start,
    signal: result.signal || null,
    error: result.error ? { message: result.error.message, code: result.error.code } : null,
  };
}

/**
 * Walks upward from `start` looking for `pnpm-workspace.yaml`.
 * @param {string} start
 * @returns {string|null}
 */
function findRepoRoot(start) {
  let dir = start;
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// CLI mode: print JSON to stdout
if (import.meta.url === `file://${process.argv[1]}`) {
  const startDir = process.argv[2] || process.cwd();
  const discovery = discoverRepository(startDir);
  console.log(JSON.stringify(discovery, null, 2));
}

/**
 * @typedef {object} CompilerCapability
 * @property {boolean} packagePresent
 * @property {boolean} executable
 */

/**
 * @typedef {object} CliCapability
 * @property {boolean} packagePresent
 * @property {boolean} executable
 */

/**
 * @typedef {object} PipelineCapability
 * @property {boolean} packagePresent
 * @property {boolean} executable
 */

/**
 * @typedef {object} DiscoveryResult
 * @property {'portable'|'repository'} mode
 * @property {string|null} repoRoot
 * @property {{ compiler: CompilerCapability, cli: CliCapability, widgetCatalog: boolean, engineSkillsCatalog: boolean, domainGuidance: boolean, pipeline: PipelineCapability, examples: boolean }} capabilities
 * @property {Record<string, CommandResolution>} commands
 * @property {{ compilerRoot: string|null, cliRoot: string|null, widgetsRoot: string|null, pipelineRoot: string|null, catalogData: string|null, guidanceData: string|null, examplesDir: string|null, engineSkillsManifest: string|null, engineSkillsRoot: string|null }} paths
 * @property {string[]} unavailable
 */

/**
 * @typedef {object} Prerequisite
 * @property {'build'} type
 * @property {string[]} command
 */

/**
 * @typedef {object} CommandResolution
 * @property {boolean} executable
 * @property {string[]|null} argv
 * @property {Prerequisite[]} prerequisites
 */

/**
 * @typedef {object} RunOptions
 * @property {string} [cwd]
 * @property {Record<string, string>} [env]
 * @property {number} [timeout]
 * @property {number} [maxBuffer]
 */

/**
 * @typedef {object} CommandResult
 * @property {number|null} status
 * @property {string} stdout
 * @property {string} stderr
 * @property {string[]} command
 * @property {number} durationMs
 * @property {string|null} signal
 * @property {{ message: string, code: string }|null} error
 */