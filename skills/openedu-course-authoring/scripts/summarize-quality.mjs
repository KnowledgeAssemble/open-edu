#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadWidgetCatalog, getCanonicalWidgetIds, isDeprecatedWidget, resolveLegacyWidgetId, getWidgetById } from './widget-catalog.mjs';
import { resolveProfile, loadProfileConfig, getGradeBandConfig, GRADE_BANDS } from './profiles.mjs';

const nonMeasurableVerbs = [
  'understand', 'know', 'learn', 'appreciate', 'be familiar', 'grasp',
  'realize', 'believe', 'think about', 'feel', 'perceive',
];

const PEDAGOGICAL_STEPS = ['observe', 'guided_practice', 'independent_practice', 'mastery_check', 'positive_completion'];

// Profile-scoped heuristic vocabularies (QC-ACC-05/06, QC-SCH-01, QC-COL-01).
const NON_LITERAL_PHRASES = [
  'conquer', 'on fire', 'genius', 'amazing', 'crush it', "let's battle", 'warrior',
  'champion', 'ninja', 'superstar', 'rock star', "you're a star", 'piece of cake',
  'break a leg', 'in the zone',
];
const TASK_VERBS = [
  'count', 'add', 'subtract', 'multiply', 'divide', 'solve', 'identify', 'compare',
  'match', 'write', 'read', 'draw', 'find', 'name', 'circle', 'select', 'choose',
  'list', 'explain', 'describe', 'calculate', 'complete', 'fill', 'sort', 'order',
  'group', 'label', 'measure', 'convert', 'color', 'trace',
];
const COMPOUND_TASK_PATTERN = new RegExp(
  `\\b(${TASK_VERBS.join('|')})\\b[^.;]*\\b(?:and|also|then|plus)\\b[^.;]*\\b(${TASK_VERBS.join('|')})\\b`,
  'i',
);
const ADULT_CONTEXT_WORDS = [
  'mortgage', 'salary', 'tax return', 'resume', 'lease', 'alcohol', 'cigarette',
  'voting', 'health insurance', '401k', 'payroll', 'credit score', 'investing',
];
const ACADEMIC_REGISTER_MARKERS = [
  'analyze', 'critique', 'evaluate', 'synthesize', 'thesis', 'framework',
  'methodology', 'theory', 'paradigm', 'implication',
];

/**
 * Combines validation diagnostics with a lesson blueprint to produce a quality report.
 *
 * @param {string} outputDir - directory containing blueprint and report artifacts
 * @param {object} validationResult - result from validateCourseSpec
 * @param {QualityOptions} [options]
 * @returns {QualityResult}
 */
export function summarizeQuality(outputDir, validationResult, options = {}) {
  /** @type {QualityFinding[]} */
  const findings = [];

  let mode = options.mode || 'portable';

  // --- Catalog loading ---
  let catalog = [];
  let catalogAvailable = false;
  if (options.preloadedCatalog) {
    catalog = options.preloadedCatalog;
    catalogAvailable = true;
  } else if (options.catalogPath) {
    const catalogResult = loadWidgetCatalog(options.catalogPath);
    catalogAvailable = catalogResult.available;
    catalog = catalogResult.catalog;
  }

  // QC-WDG-00: catalog unavailable
  if (!catalogAvailable && mode === 'repository') {
    findings.push({
      checkId: 'QC-WDG-00',
      severity: 'error',
      message: 'Widget catalog is not available; widget ID validation cannot run',
    });
  } else if (!catalogAvailable) {
    findings.push({
      checkId: 'QC-WDG-00',
      severity: 'warning',
      message: 'Widget catalog is not available; widget IDs have not been validated against catalog',
    });
  }

  const canonicalWidgetSet = catalogAvailable ? getCanonicalWidgetIds(catalog) : new Set();

  // --- Load blueprint ---
  let blueprint = [];
  const blueprintPath = join(outputDir, 'lesson-blueprints.json');
  if (existsSync(blueprintPath)) {
    try {
      blueprint = JSON.parse(readFileSync(blueprintPath, 'utf-8'));
    } catch {
      findings.push({
        checkId: 'QC-COM-02',
        severity: 'warning',
        message: 'lesson-blueprints.json could not be parsed',
      });
    }
  }

  // --- Merge validation errors/warnings ---
  if (validationResult?.errors) {
    for (const e of validationResult.errors) {
      findings.push({
        checkId: 'QC-COM-01',
        severity: 'error',
        message: e.message,
      });
    }
  }
  if (validationResult?.warnings) {
    for (const w of validationResult.warnings) {
      findings.push({
        checkId: 'QC-COM-03',
        severity: 'warning',
        message: w.message,
      });
    }
  }

  // --- Course-level metadata extraction ---
  let courseEstimatedHours = null;
  let courseDifficulty = null;
  let courseAudience = null;
  try {
    const specPath = join(outputDir, 'course-spec.json');
    if (existsSync(specPath)) {
      const spec = JSON.parse(readFileSync(specPath, 'utf-8'));
      courseEstimatedHours = spec.metadata?.estimatedHours;
      courseDifficulty = spec.metadata?.difficulty;
      courseAudience = spec.metadata?.audience;
    }
  } catch { /* best-effort */ }

  // --- Active learner profile (drives profile-scoped QC checks) ---
  const activeProfile = courseAudience
    ? resolveProfile(courseAudience)
    : { key: 'neurotypical', source: 'defaulted' };
  const profileKey = activeProfile.key;
  let profileName = profileKey;
  try {
    const cfg = loadProfileConfig(profileKey);
    profileName = cfg.name;
  } catch { /* config unavailable; fall back to key */ }

  // --- Educational context (authoring/brief layer; optional) ---
  const context = options.context && typeof options.context === 'object'
    ? {
        educationLevel: options.context.educationLevel || null,
        gradeBand: options.context.gradeBand || null,
        curriculum: options.context.curriculum || null,
      }
    : null;

  const isSchool = profileKey === 'school' || context?.educationLevel === 'school' || Boolean(context?.gradeBand);
  const isCollege = profileKey === 'college' || context?.educationLevel === 'college';
  const gradeBand = context?.gradeBand || null;
  const gradeBandValid = gradeBand ? GRADE_BANDS.includes(gradeBand) : true;
  const gradeBandRange = gradeBand && gradeBandValid
    ? getGradeBandConfig('school', gradeBand)?.pacingRangeMinutes || null
    : null;

  // --- QC-SCH-02 (school): grade band must be a known value ---
  if (gradeBand && !gradeBandValid) {
    findings.push({
      checkId: 'QC-SCH-02',
      severity: 'error',
      message: `Unknown grade band "${gradeBand}". Expected one of: ${GRADE_BANDS.join(', ')}`,
    });
  }

  let totalObjectives = 0;
  let totalActivities = 0;
  let totalMinutes = 0;
  let widgetsUsed = 0;

  for (let lessonIdx = 0; lessonIdx < blueprint.length; lessonIdx++) {
    const lesson = blueprint[lessonIdx];
    const lessonObj = lesson.objectives || [];
    const activities = lesson.activityPlan || [];
    const lessonId = lesson.id || 'unknown';
    totalObjectives += lessonObj.length;
    totalActivities += activities.length;
    totalMinutes += lesson.estimatedMinutes || 0;

    // --- QC-OBJ-01: Every objective covered ---
    if (lessonObj.length > 0 && activities.length === 0) {
      findings.push({
        checkId: 'QC-OBJ-01',
        severity: 'error',
        message: `Lesson "${lessonId}" has ${lessonObj.length} objective(s) but no activities`,
      });
    }

    // --- QC-OBJ-02: Every objective has assessment signal ---
    if (lessonObj.length > 0) {
      const assessmentSignals = activities.filter(
        (a) => a.step === 'mastery_check' || a.type === 'quiz' || (a.type === 'exercise' && a.feedback),
      );
      const assessmentObjectiveIds = new Set(lesson.assessmentObjectiveIds || []);
      const objectiveIdSet = new Set(lesson.objectiveIds || lessonObj.map((_, i) => `obj-${i}`));

      // With explicit mappings
      if (lesson.assessmentObjectiveIds && lesson.assessmentObjectiveIds.length > 0) {
        for (const oid of lesson.assessmentObjectiveIds) {
          if (!objectiveIdSet.has(oid)) {
            findings.push({
              checkId: 'QC-OBJ-02',
              severity: 'warning',
              message: `Assessment objective "${oid}" in lesson "${lessonId}" does not match any objective ID`,
            });
          }
        }
      } else if (assessmentSignals.length === 0) {
        // Without explicit mappings, warn if no assessment at all
        findings.push({
          checkId: 'QC-OBJ-02',
          severity: 'warning',
          message: `Lesson "${lessonId}" has ${lessonObj.length} objective(s) but no assessment signal (quiz, mastery_check, or feedback exercise)`,
        });
      }
    }

    // --- QC-OBJ-03: No lesson > 6 objectives ---
    if (lessonObj.length > 6) {
      findings.push({
        checkId: 'QC-OBJ-03',
        severity: 'warning',
        message: `Lesson "${lessonId}" has ${lessonObj.length} objectives (max recommended: 6)`,
      });
    }

    // --- QC-OBJ-04: Measurable action verbs ---
    for (const obj of lessonObj) {
      const lower = obj.toLowerCase();
      for (const verb of nonMeasurableVerbs) {
        if (lower.startsWith(verb)) {
          findings.push({
            checkId: 'QC-OBJ-04',
            severity: 'warning',
            message: `Objective "${obj}" in lesson "${lessonId}" uses non-measurable verb "${verb}"`,
          });
          break;
        }
      }
    }

    // --- QC-ASM-01: Assessment concept references are subset of introduced concepts ---
    const conceptsIntroduced = lesson.conceptsIntroduced || [];
    const assessmentConcepts = [];
    for (const act of activities) {
      if (act.step === 'mastery_check' || act.type === 'quiz') {
        if (Array.isArray(act.conceptRefs)) {
          assessmentConcepts.push(...act.conceptRefs);
        }
      }
    }

    if (assessmentConcepts.length > 0 && conceptsIntroduced.length > 0) {
      const introSet = new Set(conceptsIntroduced);
      for (const ac of assessmentConcepts) {
        if (!introSet.has(ac)) {
          findings.push({
            checkId: 'QC-ASM-01',
            severity: 'error',
            message: `Assessment in lesson "${lessonId}" references concept "${ac}" which was not introduced in this lesson`,
          });
        }
      }
    } else if (assessmentConcepts.length > 0 && conceptsIntroduced.length === 0) {
      findings.push({
        checkId: 'QC-ASM-01',
        severity: 'warning',
        message: `Lesson "${lessonId}" has assessment concept references but no conceptsIntroduced metadata; cannot verify alignment`,
      });
    }

    // --- QC-ASM-02: Every lesson with > 0 activities has mastery_check or quiz ---
    if (activities.length > 0) {
      const hasAssessment = activities.some(
        (a) => a.step === 'mastery_check' || a.type === 'quiz',
      );
      if (!hasAssessment) {
        findings.push({
          checkId: 'QC-ASM-02',
          severity: 'warning',
          message: `Lesson "${lessonId}" has activities but no mastery_check or quiz`,
        });
      }
    }

    // --- QC-ASM-03: Assessment difficulty matches course difficulty ---
    if (courseDifficulty && lesson.difficulty && lesson.difficulty !== courseDifficulty) {
      findings.push({
        checkId: 'QC-ASM-03',
        severity: 'warning',
        message: `Lesson "${lessonId}" difficulty "${lesson.difficulty}" does not match course difficulty "${courseDifficulty}"`,
      });
    }

    // --- QC-DUR-02: No single lesson > 45 min ---
    if (lesson.estimatedMinutes && lesson.estimatedMinutes > 45) {
      findings.push({
        checkId: 'QC-DUR-02',
        severity: 'warning',
        message: `Lesson "${lessonId}" is ${lesson.estimatedMinutes} min (max recommended: 45)`,
      });
    }

    // --- QC-DUR-03: No lesson < 5 min unless intentional ---
    if (lesson.estimatedMinutes !== undefined && lesson.estimatedMinutes < 5) {
      findings.push({
        checkId: 'QC-DUR-03',
        severity: 'warning',
        message: `Lesson "${lessonId}" is only ${lesson.estimatedMinutes} min`,
      });
    }

    // --- QC-PROG-02: Sequential order ---
    for (let i = 0; i < activities.length; i++) {
      const act = activities[i];
      if (act.order !== undefined && act.order !== i + 1) {
        findings.push({
          checkId: 'QC-PROG-02',
          severity: 'warning',
          message: `Lesson "${lessonId}" activity ${i} has order ${act.order} (expected ${i + 1})`,
        });
        break;
      }
    }

    // --- QC-PROG-01: At least one activity per pedagogical step type ---
    const presentSteps = new Set(activities.map((a) => a.step));
    for (const step of PEDAGOGICAL_STEPS) {
      if (!presentSteps.has(step)) {
        findings.push({
          checkId: 'QC-PROG-01',
          severity: 'warning',
          message: `Lesson "${lessonId}" is missing "${step}" activity step`,
        });
      }
    }

    // --- QC-PROG-03: First activity is observe ---
    if (activities.length > 0 && activities[0].step !== 'observe') {
      findings.push({
        checkId: 'QC-PROG-03',
        severity: 'info',
        message: `Lesson "${lessonId}" first activity is "${activities[0].step}" (recommended: observe)`,
      });
    }

    // --- Widget checks ---
    for (let i = 0; i < activities.length; i++) {
      const act = activities[i];
      if (act.type !== 'widget' || !act.widgetId) continue;
      widgetsUsed++;

      if (catalogAvailable) {
        if (!canonicalWidgetSet.has(act.widgetId)) {
          const canonical = resolveLegacyWidgetId(catalog, act.widgetId);
          findings.push({
            checkId: 'QC-WDG-01',
            severity: 'error',
            message: `Widget "${act.widgetId}" in lesson "${lessonId}" is not a canonical ID${canonical ? ` (use "${canonical}" instead)` : ''}`,
          });
        }

        if (isDeprecatedWidget(catalog, act.widgetId)) {
          findings.push({
            checkId: 'QC-WDG-02',
            severity: 'error',
            message: `Widget "${act.widgetId}" in lesson "${lessonId}" is deprecated`,
          });
        }

        // QC-WDG-03: widgetConfig includes required fields when schema available
        const widgetEntry = getWidgetById(catalog, act.widgetId);
        if (widgetEntry?.requiredConfig) {
          if (!act.widgetConfig || typeof act.widgetConfig !== 'object') {
            findings.push({
              checkId: 'QC-WDG-03',
              severity: 'error',
              message: `Widget "${act.widgetId}" in lesson "${lessonId}" requires config but none provided`,
            });
          } else {
            for (const field of widgetEntry.requiredConfig) {
              if (!(field in act.widgetConfig)) {
                findings.push({
                  checkId: 'QC-WDG-03',
                  severity: 'error',
                  message: `Widget "${act.widgetId}" in lesson "${lessonId}" missing required config field "${field}"`,
                });
              }
            }
          }
        } else if (widgetEntry) {
          // Widget exists but has no config schema - note this is unknown, not validated
          findings.push({
            checkId: 'QC-WDG-03',
            severity: 'info',
            message: `Widget "${act.widgetId}" in lesson "${lessonId}" has no config schema available; config not validated`,
          });
        }
      }

      // QC-WDG-04: Widget choice justified by learning intent
      if (act.widgetRationale) {
        findings.push({
          checkId: 'QC-WDG-04',
          severity: 'info',
          message: `Widget "${act.widgetId}" in lesson "${lessonId}" rationale: ${act.widgetRationale}`,
        });
      }
    }

    // --- QC-ACC-01: Instructions use plain language ---
    for (const act of activities) {
      if (act.instructions && act.instructions.length > 500) {
        findings.push({
          checkId: 'QC-ACC-01',
          severity: 'warning',
          message: `Activity "${act.description || 'unnamed'}" in lesson "${lessonId}" has very long instructions (${act.instructions.length} chars)`,
        });
      }
    }

    // --- QC-ACC-05 (autism): literal language ---
    if (profileKey === 'autism') {
      for (const act of activities) {
        const text = `${act.description || ''} ${act.instructions || ''}`.toLowerCase();
        for (const phrase of NON_LITERAL_PHRASES) {
          if (text.includes(phrase)) {
            findings.push({
              checkId: 'QC-ACC-05',
              severity: 'warning',
              message: `Activity "${act.description || 'unnamed'}" in lesson "${lessonId}" uses non-literal phrasing ("${phrase}")`,
            });
            break;
          }
        }
      }
    }

    // --- QC-ACC-06 (autism): one concept per activity ---
    if (profileKey === 'autism') {
      for (const act of activities) {
        const text = act.instructions || '';
        if (COMPOUND_TASK_PATTERN.test(text)) {
          findings.push({
            checkId: 'QC-ACC-06',
            severity: 'warning',
            message: `Activity "${act.description || 'unnamed'}" in lesson "${lessonId}" combines multiple tasks in one instruction; keep one concept per activity`,
          });
        }
      }
    }

    // --- QC-ACC-02: Widget choices support keyboard interaction ---
    for (const act of activities) {
      if (act.type === 'widget' && act.widgetId && catalogAvailable) {
        const widgetEntry = getWidgetById(catalog, act.widgetId);
        if (widgetEntry?.accessibility && !widgetEntry.accessibility.includes('keyboardOnly')) {
          findings.push({
            checkId: 'QC-ACC-02',
            severity: 'info',
            message: `Widget "${act.widgetId}" in lesson "${lessonId}" does not declare keyboard-only support`,
          });
        }
      }
    }

    // --- QC-ACC-07 (autism): widget selection avoids high-sensory-load defaults ---
    // Only flag widgets that animate without offering a reduced-motion fallback;
    // static widgets are not flagged (avoids noise until a catalog allowlist lands).
    if (profileKey === 'autism') {
      for (const act of activities) {
        if (act.type === 'widget' && act.widgetId && catalogAvailable) {
          const widgetEntry = getWidgetById(catalog, act.widgetId);
          const capabilities = widgetEntry?.capabilities || [];
          const tags = widgetEntry?.accessibility || [];
          if (capabilities.includes('supportsAnimation') && !tags.includes('reducedMotion')) {
            findings.push({
              checkId: 'QC-ACC-07',
              severity: 'info',
              message: `Widget "${act.widgetId}" in lesson "${lessonId}" uses animation without reduced-motion support; prefer calm, predictable widgets for this profile`,
            });
          }
        }
      }
    }

    // --- QC-ACC-03: Color is not sole differentiator ---
    // Check for color-only wording in descriptions
    for (const act of activities) {
      const text = (act.description || '') + (act.instructions || '');
      const colorOnlyPatterns = [/red\s+button/i, /green\s+text/i, /blue\s+link/i, /click\s+the\s+yellow/i];
      for (const pattern of colorOnlyPatterns) {
        if (pattern.test(text)) {
          findings.push({
            checkId: 'QC-ACC-03',
            severity: 'warning',
            message: `Activity "${act.description || 'unnamed'}" in lesson "${lessonId}" may use color as sole differentiator`,
          });
          break;
        }
      }
    }

    // --- QC-ACC-04: Content is chunked ---
    for (const act of activities) {
      if (act.instructions && act.instructions.length > 1000) {
        findings.push({
          checkId: 'QC-ACC-04',
          severity: 'warning',
          message: `Activity "${act.description || 'unnamed'}" in lesson "${lessonId}" instructions exceed 1000 chars; consider chunking`,
        });
      }
    }

    // --- QC-SCH-01 (school): objectives/examples are age-appropriate ---
    if (isSchool) {
      const learnerText = [
        ...lessonObj,
        ...(lesson.examples || []),
        lesson.coreIdea || '',
      ].join(' ').toLowerCase();
      for (const word of ADULT_CONTEXT_WORDS) {
        if (learnerText.includes(word)) {
          findings.push({
            checkId: 'QC-SCH-01',
            severity: 'warning',
            message: `Lesson "${lessonId}" references adult context ("${word}") that may not be age-appropriate`,
          });
        }
      }
    }

    // --- QC-SCH-03 (school): lesson pacing within the grade band ---
    if (gradeBandRange && lesson.estimatedMinutes !== undefined) {
      const [min, max] = gradeBandRange;
      if (lesson.estimatedMinutes < min || lesson.estimatedMinutes > max) {
        findings.push({
          checkId: 'QC-SCH-03',
          severity: 'warning',
          message: `Lesson "${lessonId}" is ${lesson.estimatedMinutes} min, outside the ${gradeBand} band range [${min}, ${max}]`,
        });
      }
    }

    // --- QC-COL-01 (college): academic register present ---
    if (isCollege) {
      const learnerText = [
        ...lessonObj,
        ...(lesson.examples || []),
        lesson.coreIdea || '',
      ].join(' ').toLowerCase();
      const hasAcademicMarker = ACADEMIC_REGISTER_MARKERS.some((m) => learnerText.includes(m));
      if (!hasAcademicMarker) {
        findings.push({
          checkId: 'QC-COL-01',
          severity: 'info',
          message: `Lesson "${lessonId}" shows no academic register markers (e.g. analyze, critique, evaluate, methodology)`,
        });
      }
    }

    // --- QC-COM-03: coreIdea, examples, misconceptions ---
    if (!lesson.coreIdea || lesson.coreIdea.trim().length === 0) {
      findings.push({
        checkId: 'QC-COM-03',
        severity: 'error',
        message: `Lesson "${lessonId}" is missing coreIdea`,
      });
    }
    if (!Array.isArray(lesson.examples) || lesson.examples.length === 0) {
      findings.push({
        checkId: 'QC-COM-03',
        severity: 'error',
        message: `Lesson "${lessonId}" is missing examples`,
      });
    }
    if (!Array.isArray(lesson.misconceptions) || lesson.misconceptions.length === 0) {
      findings.push({
        checkId: 'QC-COM-03',
        severity: 'error',
        message: `Lesson "${lessonId}" is missing misconceptions`,
      });
    }
  }

  // --- QC-DUR-01: Sum of estimatedMinutes within 20% of total estimatedHours ---
  if (courseEstimatedHours && totalMinutes > 0) {
    const estimatedFromHours = courseEstimatedHours * 60;
    const tolerance = estimatedFromHours * 0.2;
    const diff = Math.abs(totalMinutes - estimatedFromHours);
    if (diff > tolerance) {
      findings.push({
        checkId: 'QC-DUR-01',
        severity: 'warning',
        message: `Sum of lesson minutes (${totalMinutes} min) deviates from course estimatedHours (${estimatedFromHours} min) by ${Math.round(diff)} min`,
      });
    }
  }

  // --- QC-PROG-03 (course-level): Report missing pedagogical steps across all lessons ---
  // Already handled per-lesson above

  const errorCount = findings.filter((f) => f.severity === 'error').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;
  const infoCount = findings.filter((f) => f.severity === 'info').length;

  const report = {
    success: errorCount === 0,
    timestamp: new Date().toISOString(),
    summary: {
      lessons: blueprint.length || (validationResult?.data?.lessonCount || 0),
      objectives: totalObjectives,
      activities: totalActivities || (validationResult?.data?.activityCount || 0),
      widgetsUsed,
      totalEstimatedMinutes: totalMinutes,
      errors: errorCount,
      warnings: warningCount,
      infos: infoCount,
      learnerProfile: {
        key: profileKey,
        name: profileName,
        source: activeProfile.source,
      },
      context,
    },
    findings,
  };

  // Write report
  if (options.reportPath !== false) {
    const reportFilePath = typeof options.reportPath === 'string'
      ? options.reportPath
      : join(outputDir, 'quality-report.json');
    writeFileSync(reportFilePath, JSON.stringify(report, null, 2));
  }

  return report;
}

// CLI mode
if (import.meta.url === `file://${process.argv[1]}`) {
  const outputDir = process.argv[2] || process.cwd();
  let validationResult = null;
  const vrPath = join(outputDir, 'quality-report.json');
  if (existsSync(vrPath)) {
    try {
      validationResult = JSON.parse(readFileSync(vrPath, 'utf-8'));
    } catch { /* ignore */ }
  }
  const catalogPath = process.argv[3] || null;
  const options = catalogPath ? { catalogPath } : {};
  const result = summarizeQuality(outputDir, validationResult || { errors: [], warnings: [], data: null }, options);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

/**
 * @typedef {object} QualityOptions
 * @property {string} [mode]
 * @property {string} [catalogPath]
 * @property {import('./widget-catalog.mjs').WidgetEntry[]} [preloadedCatalog]
 * @property {string|boolean} [reportPath]
 * @property {{ educationLevel?: string, gradeBand?: string, curriculum?: string }} [context]
 */

/**
 * @typedef {object} QualityFinding
 * @property {string} checkId
 * @property {'error'|'warning'|'info'|'pass'} severity
 * @property {string} message
 */

/**
 * @typedef {object} QualityResult
 * @property {boolean} success
 * @property {string} timestamp
 * @property {object} summary
 * @property {QualityFinding[]} findings
 */