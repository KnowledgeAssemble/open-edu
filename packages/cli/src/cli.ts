#!/usr/bin/env node
import { Command } from 'commander';
import { validatePackage } from './commands/validate.js';
import { createPackage } from './commands/create.js';
import { lintContent } from './commands/lint-content.js';
import { devPackage } from './commands/dev.js';
import { buildPackage } from './commands/build.js';
import { packagePackage } from './commands/package.js';
import { widgetCreate } from './commands/widget-create.js';
import { reportTelemetry } from './commands/report.js';
import { generatePrompt, generateFromDescription } from './commands/generate.js';
import { patchPackage } from './commands/patch.js';
import { importLearnEasyCommand } from './commands/import.js';
import { createCompileCommand } from '@open-edu/course-compiler';
import { buildOep } from './commands/oep-build.js';
import { buildOepBundle } from './commands/oep-build-bundle.js';
import { i18nExtract } from './commands/i18n-extract.js';
import { i18nValidate } from './commands/i18n-validate.js';
import { i18nMissing } from './commands/i18n-missing.js';
import { CLI_VERSION } from './index.js';
import { formatJsonResult } from './utils/json-output.js';
import type { CliResult } from './utils/json-output.js';
import { createLogger } from '@open-edu/logger';
import { applyCliLogLevel } from './utils/cli-logger.js';

const cliLogger = createLogger({ scope: 'cli:main' });

const program = new Command();

program.name('edu').description('Open-Edu educational package toolkit').version(CLI_VERSION);

program.option('--json', 'Output results as structured JSON');
program.option('--verbose', 'Enable verbose diagnostic logging');
program.option('--quiet', 'Suppress all non-error output');

program.hook('preAction', () => {
  applyCliLogLevel(program.optsWithGlobals());
  cliLogger.debug('CLI command invoked', { argv: process.argv.slice(2) });
});

program
  .command('validate')
  .description('Validate an educational package')
  .argument('<package-dir>', 'Path to the educational package directory')
  .option('--verify-integrity', 'Verify file integrity against build manifest')
  .action(async (packageDir: string, cmdOptions: { verifyIntegrity?: boolean }) => {
    const json = program.optsWithGlobals().json;
    const result = await validatePackage(packageDir, {
      json,
      verifyIntegrity: cmdOptions.verifyIntegrity,
    });
    handleResult(result, json);
  });

program
  .command('dev')
  .description('Start the dev server for an educational package')
  .argument('<package-dir>', 'Path to the educational package directory')
  .action(async (packageDir: string) => {
    const json = program.optsWithGlobals().json;
    const result = await devPackage(packageDir, { json });
    handleResult(result, json);
  });

program
  .command('build')
  .description('Build an educational package for distribution')
  .argument('<package-dir>', 'Path to the educational package directory')
  .option('--out-dir <path>', 'Output directory')
  .action(async (packageDir: string, cmdOptions: { outDir?: string }) => {
    const json = program.optsWithGlobals().json;
    const result = await buildPackage(packageDir, cmdOptions.outDir, { json });
    handleResult(result, json);
  });

program
  .command('package')
  .description('Create a distributable archive of an educational package')
  .argument('<package-dir>', 'Path to the educational package directory')
  .option('--output <path>', 'Output directory for the archive')
  .action(async (packageDir: string, cmdOptions: { output?: string }) => {
    const json = program.optsWithGlobals().json;
    const result = await packagePackage(packageDir, cmdOptions.output, { json });
    handleResult(result, json);
  });

program
  .command('oep:build')
  .description('Build a portable .oep distribution artifact from a course directory')
  .argument('<package-dir>', 'Path to the course package directory')
  .option('-o, --output <dir>', 'Output directory (default: cwd)')
  .option('--json', 'Emit JSON output')
  .option('--geo-assets-dir <path>', 'Geo-assets dist directory containing catalog.json')
  .action(
    async (
      packageDir: string,
      options: { output?: string; json?: boolean; geoAssetsDir?: string },
    ) => {
      const json = program.optsWithGlobals().json ?? options.json;
      const result = await buildOep(packageDir, options.output, {
        json,
        geoAssetsDir: options.geoAssetsDir,
      });
      if (!result.success) process.exitCode = 1;
    },
  );

program
  .command('oep:build-bundle')
  .description('Build a portable .oep distribution artifact from a bundle directory')
  .argument('<bundle-dir>', 'Path to the bundle directory (containing bundle.json)')
  .option('-o, --output <dir>', 'Output directory (default: cwd)')
  .option('--json', 'Emit JSON output')
  .option('--geo-assets-dir <path>', 'Geo-assets dist directory containing catalog.json')
  .action(
    async (
      bundleDir: string,
      options: { output?: string; json?: boolean; geoAssetsDir?: string },
    ) => {
      const json = program.optsWithGlobals().json ?? options.json;
      const result = await buildOepBundle(bundleDir, options.output, {
        json,
        geoAssetsDir: options.geoAssetsDir,
      });
      if (!result.success) process.exitCode = 1;
    },
  );

program.addCommand(createCompileCommand());

program
  .command('create')
  .description('Create a new educational package scaffold')
  .argument('<package-dir>', 'Directory to create the package in')
  .option('--id <id>', 'Package ID (kebab-case)')
  .option('--title <title>', 'Package title')
  .option('--author <author>', 'Package author')
  .option('--force', 'Overwrite existing files in non-empty directory')
  .action(
    async (
      packageDir: string,
      cmdOptions: { id?: string; title?: string; author?: string; force?: boolean },
    ) => {
      const json = program.optsWithGlobals().json;
      const id =
        cmdOptions.id || packageDir.split('/').pop() || packageDir.split('\\').pop() || 'package';
      const title = cmdOptions.title || id;
      const author = cmdOptions.author || 'Open-Edu Author';
      const result = await createPackage(packageDir, {
        id,
        title,
        author,
        force: cmdOptions.force,
      });
      const cliResult: CliResult = result.success
        ? { success: true, data: { files: result.files } }
        : { success: false, error: result.error!, code: 1 };
      handleResult(cliResult, json);
    },
  );

program
  .command('report')
  .description('Generate a report from a telemetry JSONL file')
  .argument('<telemetry-jsonl>', 'Path to the telemetry JSONL file')
  .action((filePath: string) => {
    const json = program.optsWithGlobals().json;
    const result = reportTelemetry(filePath, { json });
    handleResult(result, json);
  });

program
  .command('lint-content')
  .description('Run content quality checks on an educational package')
  .argument('<package-dir>', 'Path to the educational package directory')
  .option('--max-warnings <number>', 'Maximum number of warnings allowed', parseInt)
  .action(async (packageDir: string, cmdOptions: { maxWarnings?: number }) => {
    const json = program.optsWithGlobals().json;
    const result = await lintContent(packageDir, { json, maxWarnings: cmdOptions.maxWarnings });
    handleResult(result, json);
  });

const widget = program.command('widget').description('Widget management commands');

widget
  .command('create')
  .description('Create a new widget package')
  .argument('<dir>', 'Directory to create the widget in')
  .option('--id <id>', 'Widget ID')
  .option('--title <title>', 'Widget title')
  .option('--force', 'Overwrite existing files')
  .action(async (dir: string, cmdOptions: { id?: string; title?: string; force?: boolean }) => {
    const json = program.optsWithGlobals().json;
    const id = cmdOptions.id || dir.split('/').pop() || dir.split('\\').pop() || 'widget';
    const result = await widgetCreate(dir, {
      id,
      title: cmdOptions.title,
      force: cmdOptions.force,
    });
    const cliResult: CliResult = result.success
      ? { success: true, data: { files: result.files } }
      : { success: false, error: result.error!, code: 1 };
    handleResult(cliResult, json);
  });

program
  .command('generate')
  .description('Generate agent prompt or scaffold a package from a description')
  .option('--prompt', 'Output the agent prompt template for LLM-based package generation')
  .option('--from-description <text>', 'Generate a package from a natural language description')
  .option('--force', 'Overwrite existing files (used with --from-description)')
  .argument('[package-dir]', 'Package directory (required with --from-description)')
  .action(
    async (
      packageDir: string | undefined,
      cmdOptions: { prompt?: boolean; fromDescription?: string; force?: boolean },
    ) => {
      const json = program.optsWithGlobals().json;

      if (cmdOptions.prompt) {
        const result = await generatePrompt({ json });
        handleResult(result, json);
        return;
      }

      if (cmdOptions.fromDescription) {
        if (!packageDir) {
          const result: CliResult = {
            success: false,
            error: 'package-dir argument is required with --from-description',
            code: 1,
          };
          handleResult(result, json);
          return;
        }
        const result = await generateFromDescription(packageDir, cmdOptions.fromDescription, {
          json,
          force: cmdOptions.force,
        });
        handleResult(result, json);
        return;
      }

      const result: CliResult = {
        success: false,
        error: 'Specify --prompt or --from-description <text>',
        code: 1,
      };
      handleResult(result, json);
    },
  );

program
  .command('patch')
  .description('Apply a deterministic patch to an educational package')
  .argument('<package-dir>', 'Path to the educational package directory')
  .argument('<patch-file>', 'Path to the patch JSON file')
  .option('--dry-run', 'Show planned changes without modifying files')
  .action(async (packageDir: string, patchFile: string, cmdOptions: { dryRun?: boolean }) => {
    const json = program.optsWithGlobals().json;
    const result = await patchPackage(packageDir, patchFile, {
      json,
      dryRun: cmdOptions.dryRun,
    });
    handleResult(result, json);
  });

const importCmd = program.command('import').description('Import commands');

importCmd
  .command('learn-easy')
  .description('Import a Learn-Easy curriculum as an Open-Edu bundle')
  .argument('<source-dir>', 'Path to the Learn-Easy curriculum directory')
  .argument('[output-dir]', 'Output directory for the bundle')
  .option('--bundle-title <title>', 'Override bundle title')
  .option('--bundle-id <id>', 'Override bundle id')
  .action(
    async (
      sourceDir: string,
      outputDir: string | undefined,
      cmdOptions: { bundleTitle?: string; bundleId?: string },
    ) => {
      const json = program.optsWithGlobals().json;
      const result = await importLearnEasyCommand(sourceDir, outputDir || './output', {
        bundleTitle: cmdOptions.bundleTitle,
        bundleId: cmdOptions.bundleId,
        json,
      });
      handleResult(result, json);
    },
  );

const i18n = program.command('i18n').description('Internationalization commands');

i18n
  .command('extract')
  .description('Extract translation keys from source files')
  .argument('<source-dir>', 'Source directory to scan')
  .argument('[output-dir]', 'Output directory for extracted keys')
  .action(async (sourceDir: string, outputDir: string | undefined) => {
    const json = program.optsWithGlobals().json;
    const result = await i18nExtract(sourceDir, outputDir ?? sourceDir);
    if (!json) {
      console.log(
        result.success
          ? `Extracted ${result.data!.keysCount} keys to ${result.data!.outputPath}`
          : result.error,
      );
    }
    handleResult(result, json);
  });

i18n
  .command('validate')
  .description('Validate locale files against the reference locale')
  .argument('<locales-dir>', 'Path to locale files directory')
  .action(async (localesDir: string) => {
    const json = program.optsWithGlobals().json;
    const result = await i18nValidate(localesDir);
    if (!json) {
      console.log(result.success ? `All locales are valid` : result.error);
    }
    handleResult(result, json);
  });

i18n
  .command('missing')
  .description('Detect missing translations for a target locale')
  .argument('<locales-dir>', 'Path to locale files directory')
  .argument('<target-locale>', 'Target locale code (e.g., hi, or)')
  .action(async (localesDir: string, targetLocale: string) => {
    const json = program.optsWithGlobals().json;
    const result = await i18nMissing(localesDir, targetLocale);
    if (!json) {
      console.log(result.success ? `No missing keys for "${targetLocale}"` : result.error);
    }
    handleResult(result, json);
  });

function handleResult(result: CliResult, json: boolean | undefined): void {
  if (json) {
    console.log(formatJsonResult(result));
  }
  process.exit(result.success ? 0 : result.code);
}

program.parse(process.argv);
