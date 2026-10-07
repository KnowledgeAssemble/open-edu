import { describe, it } from 'node:test';
import { ok, strictEqual, deepStrictEqual } from 'node:assert';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverRepository, resolveOpenEduCommands, runOpenEduCommand } from '../openedu-adapter.mjs';

function createTempDir() {
  const base = join(tmpdir(), `adapter-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(base, { recursive: true });
  return base;
}

function addFile(dir, subpath, content = '') {
  const full = join(dir, subpath);
  const parent = join(full, '..');
  if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
  writeFileSync(full, content);
}

describe('openedu-adapter discoverRepository', () => {
  it('reports portable mode for a non-repo directory', () => {
    const dir = createTempDir();
    try {
      const result = discoverRepository(dir);
      strictEqual(result.mode, 'portable');
      strictEqual(result.repoRoot, null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects repository root via pnpm-workspace.yaml', () => {
    const dir = createTempDir();
    try {
      addFile(dir, 'pnpm-workspace.yaml', 'packages:\n  - "packages/*"');
      const result = discoverRepository(dir);
      strictEqual(result.mode, 'repository');
      strictEqual(result.repoRoot, dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('sets compiler.packagePresent but executable=false when no CLI dist', () => {
    const dir = createTempDir();
    try {
      addFile(dir, 'pnpm-workspace.yaml');
      addFile(dir, 'packages/course-compiler/package.json', '{}');
      addFile(dir, 'packages/cli/package.json', '{}');
      const result = discoverRepository(dir);
      strictEqual(result.capabilities.cli.packagePresent, true);
      strictEqual(result.capabilities.cli.executable, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('sets cli.executable=true when dist/cli.js exists', () => {
    const dir = createTempDir();
    try {
      addFile(dir, 'pnpm-workspace.yaml');
      addFile(dir, 'packages/cli/package.json', '{"bin":{"edu":"./dist/cli.js"}}');
      addFile(dir, 'packages/cli/dist/cli.js', '#!/usr/bin/env node');
      const result = discoverRepository(dir);
      strictEqual(result.capabilities.cli.packagePresent, true);
      strictEqual(result.capabilities.cli.executable, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects widget catalog when catalog data file exists', () => {
    const dir = createTempDir();
    try {
      addFile(dir, 'pnpm-workspace.yaml');
      addFile(dir, 'packages/core/src/widget-catalog-data.json', '[]');
      const result = discoverRepository(dir);
      strictEqual(result.capabilities.widgetCatalog, true);
      ok(result.paths.catalogData !== null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects engine skills catalog when manifest exists', () => {
    const dir = createTempDir();
    try {
      addFile(dir, 'pnpm-workspace.yaml');
      addFile(dir, 'node_modules/@knowledgeassemble/engine-skills/manifest.json', '{}');
      const result = discoverRepository(dir);
      strictEqual(result.capabilities.engineSkillsCatalog, true);
      ok(result.paths.engineSkillsManifest !== null);
      ok(result.paths.engineSkillsRoot !== null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('engine skills catalog false when manifest missing', () => {
    const dir = createTempDir();
    try {
      addFile(dir, 'pnpm-workspace.yaml');
      const result = discoverRepository(dir);
      strictEqual(result.capabilities.engineSkillsCatalog, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('engineSkillsCatalog appears in unavailable when missing', () => {
    const dir = createTempDir();
    try {
      addFile(dir, 'pnpm-workspace.yaml');
      const result = discoverRepository(dir);
      ok(result.unavailable.includes('engineSkillsCatalog'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects pipeline when packages/pipeline exists', () => {
    const dir = createTempDir();
    try {
      addFile(dir, 'pnpm-workspace.yaml');
      addFile(dir, 'packages/pipeline/package.json', '{"name":"@open-edu/pipeline"}');
      const result = discoverRepository(dir);
      strictEqual(result.capabilities.pipeline.packagePresent, true);
      ok(result.paths.pipelineRoot !== null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('walks upward to find repo root from a subdirectory', () => {
    const dir = createTempDir();
    try {
      addFile(dir, 'pnpm-workspace.yaml');
      const subDir = join(dir, 'some/deep/nested/path');
      mkdirSync(subDir, { recursive: true });
      const result = discoverRepository(subDir);
      strictEqual(result.repoRoot, dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('lists unavailable capabilities', () => {
    const dir = createTempDir();
    try {
      addFile(dir, 'pnpm-workspace.yaml');
      const result = discoverRepository(dir);
      ok(Array.isArray(result.unavailable));
      ok(result.unavailable.includes('compiler'));
      ok(result.unavailable.includes('engineSkillsCatalog'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('openedu-adapter resolveOpenEduCommands', () => {
  it('returns empty commands in portable mode', () => {
    const discovery = {
      mode: 'portable',
      repoRoot: null,
      capabilities: {
        compiler: { packagePresent: false, executable: false },
        cli: { packagePresent: false, executable: false },
        widgetCatalog: false,
        engineSkillsCatalog: false,
        pipeline: { packagePresent: false, executable: false },
        examples: false,
      },
      paths: { compilerRoot: null, cliRoot: null, widgetsRoot: null, pipelineRoot: null, catalogData: null, guidanceData: null, examplesDir: null, engineSkillsManifest: null, engineSkillsRoot: null },
    };
    const commands = resolveOpenEduCommands(discovery);
    deepStrictEqual(commands, {});
  });

  it('resolves CLI commands as structured argv when executable', () => {
    const dir = createTempDir();
    try {
      addFile(dir, 'pnpm-workspace.yaml');
      addFile(dir, 'packages/cli/dist/cli.js', '// cli');
      const entry = join(dir, 'packages', 'cli', 'dist', 'cli.js');
      const discovery = {
        mode: 'repository',
        repoRoot: dir,
        capabilities: {
          compiler: { packagePresent: true, executable: false },
          cli: { packagePresent: true, executable: true },
          widgetCatalog: false,
          engineSkillsCatalog: false,
          pipeline: { packagePresent: false, executable: false },
          examples: false,
        },
        paths: { compilerRoot: join(dir, 'packages/course-compiler'), cliRoot: join(dir, 'packages/cli'), widgetsRoot: null, pipelineRoot: null, catalogData: null, guidanceData: null, examplesDir: null, engineSkillsManifest: null, engineSkillsRoot: null },
      };
      const commands = resolveOpenEduCommands(discovery);
      strictEqual(commands.compile.executable, true);
      ok(Array.isArray(commands.compile.argv));
      ok(commands.compile.argv.includes(entry), 'argv should include absolute CLI path');
      strictEqual(commands.compile.argv[0], 'node');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns build prerequisites when CLI package present but not built', () => {
    const dir = createTempDir();
    try {
      addFile(dir, 'pnpm-workspace.yaml');
      const discovery = {
        mode: 'repository',
        repoRoot: dir,
        capabilities: {
          compiler: { packagePresent: true, executable: false },
          cli: { packagePresent: true, executable: false },
          widgetCatalog: false,
          engineSkillsCatalog: false,
          pipeline: { packagePresent: false, executable: false },
          examples: false,
        },
        paths: { compilerRoot: join(dir, 'packages/course-compiler'), cliRoot: join(dir, 'packages/cli'), widgetsRoot: null, pipelineRoot: null, catalogData: null, guidanceData: null, examplesDir: null, engineSkillsManifest: null, engineSkillsRoot: null },
      };
      const commands = resolveOpenEduCommands(discovery);
      strictEqual(commands.compile.executable, false);
      strictEqual(commands.compile.argv, null);
      ok(commands.compile.prerequisites.length > 0, 'should have build prerequisites');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('handles spaces in paths by using argv array (no shell interpolation)', () => {
    const dir = createTempDir();
    try {
      addFile(dir, 'some spaces here', 'pnpm-workspace.yaml');
      addFile(dir, 'some spaces here', 'packages/cli/dist/cli.js', '// cli');
      const repoWithSpaces = join(dir, 'some spaces here');
      const discovery = {
        mode: 'repository',
        repoRoot: repoWithSpaces,
        capabilities: {
          compiler: { packagePresent: false, executable: false },
          cli: { packagePresent: true, executable: true },
          widgetCatalog: false,
          engineSkillsCatalog: false,
          pipeline: { packagePresent: false, executable: false },
          examples: false,
        },
        paths: { compilerRoot: null, cliRoot: join(repoWithSpaces, 'packages/cli'), widgetsRoot: null, pipelineRoot: null, catalogData: null, guidanceData: null, examplesDir: null, engineSkillsManifest: null, engineSkillsRoot: null },
      };
      const commands = resolveOpenEduCommands(discovery);
      const cliEntry = join(repoWithSpaces, 'packages', 'cli', 'dist', 'cli.js');
      strictEqual(commands.compile.argv[1], cliEntry);
      strictEqual(commands.compile.argv[0], 'node');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('includes installEngineSkills command', () => {
    const dir = createTempDir();
    try {
      addFile(dir, 'pnpm-workspace.yaml');
      const discovery = {
        mode: 'repository',
        repoRoot: dir,
        capabilities: {
          compiler: { packagePresent: false, executable: false },
          cli: { packagePresent: false, executable: false },
          widgetCatalog: false,
          engineSkillsCatalog: false,
          pipeline: { packagePresent: false, executable: false },
          examples: false,
        },
        paths: { compilerRoot: null, cliRoot: null, widgetsRoot: null, pipelineRoot: null, catalogData: null, guidanceData: null, examplesDir: null, engineSkillsManifest: null, engineSkillsRoot: null },
      };
      const commands = resolveOpenEduCommands(discovery);
      ok(commands.installEngineSkills, 'installEngineSkills command should exist');
      strictEqual(commands.installEngineSkills.executable, false);
      ok(commands.installEngineSkills.prerequisites.length > 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('openedu-adapter runOpenEduCommand', () => {
  it('executes a simple command and captures status/stdout/stderr/duration', () => {
    const result = runOpenEduCommand(['node', '-e', 'console.log("hello")']);
    strictEqual(result.status, 0);
    ok(result.stdout.includes('hello'));
    strictEqual(result.stderr, '');
    ok(result.durationMs >= 0);
  });

  it('captures non-zero exit status', () => {
    const result = runOpenEduCommand(['node', '-e', 'process.exit(42)']);
    strictEqual(result.status, 42);
  });

  it('captures stderr output', () => {
    const result = runOpenEduCommand(['node', '-e', 'console.error("err msg")']);
    ok(result.stderr.includes('err msg'));
  });

  it('records command argv in result', () => {
    const argv = ['node', '-e', 'console.log("test")'];
    const result = runOpenEduCommand(argv);
    deepStrictEqual(result.command, argv);
  });

  it('handles command not found gracefully', () => {
    const result = runOpenEduCommand(['nonexistent-command-12345', 'arg1']);
    ok(result.status !== 0 || result.error !== null, 'should fail');
  });
});