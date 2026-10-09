import { describe, it } from 'node:test';
import { ok, strictEqual } from 'node:assert';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { summarizeQuality } from '../summarize-quality.mjs';

function createTempDir() {
  const base = join(tmpdir(), `quality-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(base, { recursive: true });
  return base;
}

function makeCompleteBlueprint() {
  return [
    {
      id: 'lesson-01',
      title: 'Lesson One',
      objectives: ['Identify parts of a fraction', 'Compare fractions with same denominator'],
      coreIdea: 'Fractions represent parts of a whole',
      examples: ['1/2 of a pizza', '3/4 of a chocolate bar'],
      misconceptions: ['Larger denominator means larger fraction'],
      activityPlan: [
        { type: 'reading', step: 'observe', order: 1, description: 'Read intro' },
        { type: 'widget', step: 'guided_practice', order: 2, widgetId: 'math.fraction-visual', description: 'Practice' },
        { type: 'exercise', step: 'independent_practice', order: 3, description: 'Solo practice' },
        { type: 'quiz', step: 'mastery_check', order: 4, description: 'Assessment' },
        { type: 'reflection', step: 'positive_completion', order: 5, description: 'Reflect' },
      ],
      estimatedMinutes: 20,
    },
    {
      id: 'lesson-02',
      title: 'Lesson Two',
      objectives: ['Add fractions with like denominators'],
      coreIdea: 'Adding fractions with same denominator adds numerators',
      examples: ['1/5 + 2/5 = 3/5'],
      misconceptions: ['You add both numerator and denominator'],
      activityPlan: [
        { type: 'reading', step: 'observe', order: 1, description: 'Read intro' },
        { type: 'widget', step: 'guided_practice', order: 2, widgetId: 'math.fraction-visual', description: 'Practice' },
        { type: 'exercise', step: 'independent_practice', order: 3, description: 'Solo' },
        { type: 'quiz', step: 'mastery_check', order: 4, description: 'Quiz' },
        { type: 'reflection', step: 'positive_completion', order: 5, description: 'Reflect' },
      ],
      estimatedMinutes: 20,
    },
  ];
}

function makeValidationResult(overrides = {}) {
  return {
    success: true,
    errors: [],
    warnings: [],
    data: { lessonCount: 2, activityCount: 5 },
    compilerAvailable: false,
    ...overrides,
  };
}

function makeFixtureCatalog() {
  return [
    { id: 'math.fraction-visual', name: 'Fraction Visual', status: 'stable' },
    { id: 'core.matching', name: 'Matching', status: 'stable' },
    { id: 'core.multiple-choice', name: 'Multiple Choice', status: 'stable' },
  ];
}

describe('summarize-quality (base)', () => {
  it('reports success for fully aligned course with catalog', () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(makeCompleteBlueprint()));
      const result = summarizeQuality(dir, makeValidationResult(), {
        preloadedCatalog: makeFixtureCatalog(),
      });
      strictEqual(result.success, true, `errors: ${result.findings.filter((f) => f.severity === 'error').map((f) => f.message).join('; ')}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('emits QC-WDG-00 warning in portable mode without catalog', () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify([{
        id: 'l1', title: 'L1', objectives: ['obj1'], coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [{ type: 'reading', step: 'observe', order: 1, description: 'Read' }, { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz' }],
        estimatedMinutes: 15,
      }]));
      const result = summarizeQuality(dir, makeValidationResult(), { mode: 'portable' });
      const wdg00 = result.findings.filter((f) => f.checkId === 'QC-WDG-00');
      ok(wdg00.length > 0);
      strictEqual(wdg00[0].severity, 'warning');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('emits QC-WDG-00 error in repository mode without catalog', () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify([{
        id: 'l1', title: 'L1', objectives: ['obj1'], coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [{ type: 'reading', step: 'observe', order: 1, description: 'Read' }, { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz' }],
        estimatedMinutes: 15,
      }]));
      const result = summarizeQuality(dir, makeValidationResult(), { mode: 'repository' });
      const wdg00 = result.findings.filter((f) => f.checkId === 'QC-WDG-00');
      ok(wdg00.length > 0);
      strictEqual(wdg00[0].severity, 'error');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('flags legacy widget IDs against catalog', () => {
    const dir = createTempDir();
    try {
      const blueprint = [{
        id: 'l1', title: 'L1',
        objectives: ['obj1'], coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [
          { type: 'widget', step: 'guided_practice', widgetId: 'open-edu.multiple-choice', order: 1, description: 'Widget' },
          { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz' },
        ],
        estimatedMinutes: 15,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), { preloadedCatalog: makeFixtureCatalog(), reportPath: false });
      const wdgFindings = result.findings.filter((f) => f.checkId === 'QC-WDG-01');
      ok(wdgFindings.length > 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('flags deprecated widget IDs against catalog', () => {
    const dir = createTempDir();
    try {
      const catalog = [
        ...makeFixtureCatalog(),
        { id: 'open-edu.multiple-choice-practice', name: 'MC Legacy', status: 'deprecated', deprecated: true },
      ];
      const blueprint = [{
        id: 'l1', title: 'L1',
        objectives: ['obj1'], coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [
          { type: 'widget', step: 'guided_practice', widgetId: 'open-edu.multiple-choice-practice', order: 1, description: 'Widget' },
          { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz' },
        ],
        estimatedMinutes: 15,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), { preloadedCatalog: catalog, reportPath: false });
      const depWarnings = result.findings.filter((f) => f.checkId === 'QC-WDG-02');
      ok(depWarnings.length > 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('accepts new widget IDs without code changes', () => {
    const dir = createTempDir();
    try {
      const catalog = [
        ...makeFixtureCatalog(),
        { id: 'physics.quantum-simulator', name: 'Quantum Sim', status: 'stable' },
      ];
      const blueprint = [{
        id: 'l1', title: 'L1',
        objectives: ['obj1'], coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [
          { type: 'widget', step: 'guided_practice', widgetId: 'physics.quantum-simulator', order: 1, description: 'Widget' },
          { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz' },
        ],
        estimatedMinutes: 15,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), { preloadedCatalog: catalog, reportPath: false });
      const wdg01 = result.findings.filter((f) => f.checkId === 'QC-WDG-01');
      strictEqual(wdg01.length, 0);
      strictEqual(result.success, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports QC-OBJ-01 for uncovered objective', () => {
    const dir = createTempDir();
    try {
      const blueprint = [{
        id: 'l1', title: 'L1', objectives: ['Obj without activity'],
        coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [], estimatedMinutes: 15,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult({ data: { lessonCount: 1, activityCount: 0 } }), { reportPath: false });
      ok(result.findings.some((f) => f.checkId === 'QC-OBJ-01'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('flags QC-DUR-02 for overlong lesson', () => {
    const dir = createTempDir();
    try {
      const blueprint = [{
        id: 'l1', title: 'L1', objectives: ['obj1'],
        coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [
          { type: 'reading', step: 'observe', order: 1, description: 'Read' },
          { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz' },
        ],
        estimatedMinutes: 60,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), { reportPath: false });
      ok(result.findings.some((f) => f.checkId === 'QC-DUR-02'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('flags QC-ASM-02 for missing mastery_check', () => {
    const dir = createTempDir();
    try {
      const blueprint = [{
        id: 'l1', title: 'L1', objectives: ['obj1'],
        coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [
          { type: 'reading', step: 'observe', order: 1, description: 'Read' },
          { type: 'exercise', step: 'independent_practice', order: 2, description: 'Practice' },
        ],
        estimatedMinutes: 15,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult({ data: { lessonCount: 1, activityCount: 2 } }), { reportPath: false });
      ok(result.findings.some((f) => f.checkId === 'QC-ASM-02'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('summarize-quality (rubric extension)', () => {
  it('QC-OBJ-02: flags missing assessment signal when no mastery_check/quiz/feedback', () => {
    const dir = createTempDir();
    try {
      const blueprint = [{
        id: 'l1', title: 'L1', objectives: ['obj1', 'obj2'],
        coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [
          { type: 'reading', step: 'observe', order: 1, description: 'Read' },
          { type: 'exercise', step: 'independent_practice', order: 2, description: 'Practice' },
        ],
        estimatedMinutes: 15,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), { reportPath: false });
      ok(result.findings.some((f) => f.checkId === 'QC-OBJ-02'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('QC-ASM-01: flags assessment concept not in introduced concepts', () => {
    const dir = createTempDir();
    try {
      const blueprint = [{
        id: 'l1', title: 'L1', objectives: ['obj1'],
        coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        conceptsIntroduced: ['concept-a'],
        activityPlan: [
          { type: 'reading', step: 'observe', order: 1, description: 'Read' },
          { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz', conceptRefs: ['concept-b'] },
        ],
        estimatedMinutes: 15,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), { reportPath: false });
      ok(result.findings.some((f) => f.checkId === 'QC-ASM-01'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('QC-ASM-01: no error when assessment concepts are subset', () => {
    const dir = createTempDir();
    try {
      const blueprint = [{
        id: 'l1', title: 'L1', objectives: ['obj1'],
        coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        conceptsIntroduced: ['concept-a', 'concept-b'],
        activityPlan: [
          { type: 'reading', step: 'observe', order: 1, description: 'Read' },
          { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz', conceptRefs: ['concept-a'] },
        ],
        estimatedMinutes: 15,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), { reportPath: false });
      ok(!result.findings.some((f) => f.checkId === 'QC-ASM-01'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('QC-ASM-03: flags lesson difficulty mismatch', () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'course-spec.json'), JSON.stringify({
        metadata: { difficulty: 'beginner', estimatedHours: 1 },
      }));
      const blueprint = [{
        id: 'l1', title: 'L1', objectives: ['obj1'],
        coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        difficulty: 'advanced',
        activityPlan: [
          { type: 'reading', step: 'observe', order: 1, description: 'Read' },
          { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz' },
        ],
        estimatedMinutes: 15,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), { reportPath: false });
      ok(result.findings.some((f) => f.checkId === 'QC-ASM-03'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('QC-DUR-01: flags duration mismatch vs estimatedHours', () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'course-spec.json'), JSON.stringify({
        metadata: { estimatedHours: 2 },
      }));
      const blueprint = [{
        id: 'l1', title: 'L1', objectives: ['obj1'],
        coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [
          { type: 'reading', step: 'observe', order: 1, description: 'Read' },
          { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz' },
        ],
        estimatedMinutes: 10,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), { reportPath: false });
      ok(result.findings.some((f) => f.checkId === 'QC-DUR-01'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('QC-PROG-01: flags missing pedagogical step', () => {
    const dir = createTempDir();
    try {
      const blueprint = [{
        id: 'l1', title: 'L1', objectives: ['obj1'],
        coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [
          { type: 'reading', step: 'observe', order: 1, description: 'Read' },
          { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz' },
        ],
        estimatedMinutes: 15,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), { reportPath: false });
      const prog01 = result.findings.filter((f) => f.checkId === 'QC-PROG-01');
      ok(prog01.length >= 3, 'should flag missing guided_practice, independent_practice, positive_completion');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('QC-PROG-03: flags when first activity is not observe', () => {
    const dir = createTempDir();
    try {
      const blueprint = [{
        id: 'l1', title: 'L1', objectives: ['obj1'],
        coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [
          { type: 'exercise', step: 'independent_practice', order: 1, description: 'Jump right in' },
          { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz' },
        ],
        estimatedMinutes: 15,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), { reportPath: false });
      ok(result.findings.some((f) => f.checkId === 'QC-PROG-03'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('QC-WDG-03: flags missing required config fields', () => {
    const dir = createTempDir();
    try {
      const catalog = [
        { id: 'core.quiz-builder', name: 'Quiz Builder', status: 'stable', requiredConfig: ['questionCount', 'timeLimit'] },
      ];
      const blueprint = [{
        id: 'l1', title: 'L1', objectives: ['obj1'],
        coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [
          { type: 'widget', step: 'guided_practice', order: 1, widgetId: 'core.quiz-builder', description: 'Widget', widgetConfig: { questionCount: 5 } },
          { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz' },
        ],
        estimatedMinutes: 15,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), { preloadedCatalog: catalog, reportPath: false });
      ok(result.findings.some((f) => f.checkId === 'QC-WDG-03'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('QC-WDG-03: passes when all required config fields present', () => {
    const dir = createTempDir();
    try {
      const catalog = [
        { id: 'core.quiz-builder', name: 'Quiz Builder', status: 'stable', requiredConfig: ['questionCount'] },
      ];
      const blueprint = [{
        id: 'l1', title: 'L1', objectives: ['obj1'],
        coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [
          { type: 'widget', step: 'guided_practice', order: 1, widgetId: 'core.quiz-builder', description: 'Widget', widgetConfig: { questionCount: 5 } },
          { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz' },
        ],
        estimatedMinutes: 15,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), { preloadedCatalog: catalog, reportPath: false });
      ok(!result.findings.some((f) => f.checkId === 'QC-WDG-03'), 'should not flag when config is complete');
      strictEqual(result.success, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('QC-WDG-04: includes widget rationale when provided', () => {
    const dir = createTempDir();
    try {
      const blueprint = [{
        id: 'l1', title: 'L1', objectives: ['obj1'],
        coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [
          { type: 'widget', step: 'guided_practice', order: 1, widgetId: 'math.fraction-visual', description: 'Widget', widgetRationale: 'Visual aids help understand fractions' },
          { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz' },
        ],
        estimatedMinutes: 15,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), { preloadedCatalog: makeFixtureCatalog(), reportPath: false });
      ok(result.findings.some((f) => f.checkId === 'QC-WDG-04'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('QC-ACC-03: flags color-only wording in descriptions', () => {
    const dir = createTempDir();
    try {
      const blueprint = [{
        id: 'l1', title: 'L1', objectives: ['obj1'],
        coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [
          { type: 'reading', step: 'observe', order: 1, description: 'Click the red button' },
          { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz' },
        ],
        estimatedMinutes: 15,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), { reportPath: false });
      ok(result.findings.some((f) => f.checkId === 'QC-ACC-03'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('QC-OBJ-02: explicit assessmentObjectiveIds with valid mapping passes', () => {
    const dir = createTempDir();
    try {
      const blueprint = [{
        id: 'l1', title: 'L1',
        objectives: ['obj-a', 'obj-b'],
        objectiveIds: ['obj-a', 'obj-b'],
        assessmentObjectiveIds: ['obj-a', 'obj-b'],
        coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [
          { type: 'reading', step: 'observe', order: 1, description: 'Read' },
          { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz' },
        ],
        estimatedMinutes: 15,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), { reportPath: false });
      const obj02Errors = result.findings.filter((f) => f.checkId === 'QC-OBJ-02');
      strictEqual(obj02Errors.length, 0, 'should not flag when assessmentObjectiveIds match objectiveIds');
      strictEqual(result.success, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('QC-OBJ-02: explicit assessmentObjectiveIds with mismatched IDs flags', () => {
    const dir = createTempDir();
    try {
      const blueprint = [{
        id: 'l1', title: 'L1',
        objectives: ['obj-a'],
        objectiveIds: ['obj-a'],
        assessmentObjectiveIds: ['obj-nonexistent'],
        coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [
          { type: 'reading', step: 'observe', order: 1, description: 'Read' },
        ],
        estimatedMinutes: 15,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), { reportPath: false });
      ok(result.findings.some((f) => f.checkId === 'QC-OBJ-02'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('summarize-quality (profile-scoped checks)', () => {
  function writeSpec(dir, audience) {
    writeFileSync(join(dir, 'course-spec.json'), JSON.stringify({ metadata: { audience } }));
  }

  function makeAutismBlueprint() {
    return [{
      id: 'l1', title: 'L1',
      objectives: ['Count objects'],
      coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
      activityPlan: [
        {
          type: 'reading', step: 'observe', order: 1, description: 'Read intro',
          instructions: 'Let us conquer the counting challenge.',
        },
        { type: 'widget', step: 'guided_practice', order: 2, widgetId: 'math.fraction-visual', description: 'Practice' },
        {
          type: 'exercise', step: 'independent_practice', order: 3, description: 'Practice',
          instructions: 'Count the apples and subtract the oranges.',
        },
        { type: 'quiz', step: 'mastery_check', order: 4, description: 'Quiz' },
        { type: 'reflection', step: 'positive_completion', order: 5, description: 'Reflect' },
      ],
      estimatedMinutes: 15,
    }];
  }

  it('QC-ACC-05/06 fire only for the autism profile', () => {
    const dir = createTempDir();
    try {
      writeSpec(dir, 'autism');
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(makeAutismBlueprint()));
      const autismResult = summarizeQuality(dir, makeValidationResult(), {
        preloadedCatalog: makeFixtureCatalog(),
        reportPath: false,
      });
      ok(autismResult.findings.some((f) => f.checkId === 'QC-ACC-05'));
      ok(autismResult.findings.some((f) => f.checkId === 'QC-ACC-06'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    const neuroDir = createTempDir();
    try {
      writeSpec(neuroDir, 'neurotypical');
      writeFileSync(join(neuroDir, 'lesson-blueprints.json'), JSON.stringify(makeAutismBlueprint()));
      const neuroResult = summarizeQuality(neuroDir, makeValidationResult(), {
        preloadedCatalog: makeFixtureCatalog(),
        reportPath: false,
      });
      strictEqual(neuroResult.findings.some((f) => f.checkId === 'QC-ACC-05'), false);
      strictEqual(neuroResult.findings.some((f) => f.checkId === 'QC-ACC-06'), false);
    } finally {
      rmSync(neuroDir, { recursive: true, force: true });
    }
  });

  it('QC-ACC-06 does not fire for single-task instructions', () => {
    const dir = createTempDir();
    try {
      writeSpec(dir, 'autism');
      const blueprint = makeAutismBlueprint();
      blueprint[0].activityPlan[2].instructions = 'Count the apples.';
      blueprint[0].activityPlan[0].instructions = 'Read the introduction.';
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), { reportPath: false });
      strictEqual(result.findings.some((f) => f.checkId === 'QC-ACC-06'), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('QC-ACC-07 fires info for autism when an animated widget lacks reduced-motion support', () => {
    const dir = createTempDir();
    try {
      writeSpec(dir, 'autism');
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(makeAutismBlueprint()));
      const catalog = [
        { id: 'math.fraction-visual', name: 'Fraction Visual', status: 'stable', capabilities: ['supportsAnimation'] },
      ];
      const result = summarizeQuality(dir, makeValidationResult(), {
        preloadedCatalog: catalog,
        reportPath: false,
      });
      ok(result.findings.some((f) => f.checkId === 'QC-ACC-07'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('QC-ACC-07 does not fire when an animated widget declares ReducedMotion', () => {
    const dir = createTempDir();
    try {
      writeSpec(dir, 'autism');
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(makeAutismBlueprint()));
      const catalog = [
        { id: 'math.fraction-visual', name: 'Fraction Visual', status: 'stable', capabilities: ['supportsAnimation'], accessibility: ['reducedMotion'] },
      ];
      const result = summarizeQuality(dir, makeValidationResult(), {
        preloadedCatalog: catalog,
        reportPath: false,
      });
      strictEqual(result.findings.some((f) => f.checkId === 'QC-ACC-07'), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('QC-ACC-07 does not fire for static widgets without animation', () => {
    const dir = createTempDir();
    try {
      writeSpec(dir, 'autism');
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(makeAutismBlueprint()));
      const catalog = [
        { id: 'math.fraction-visual', name: 'Fraction Visual', status: 'stable', capabilities: ['Keyboard'] },
      ];
      const result = summarizeQuality(dir, makeValidationResult(), {
        preloadedCatalog: catalog,
        reportPath: false,
      });
      strictEqual(result.findings.some((f) => f.checkId === 'QC-ACC-07'), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('QC-SCH-01 fires for the school profile with adult context', () => {
    const dir = createTempDir();
    try {
      writeSpec(dir, 'school');
      const blueprint = [{
        id: 'l1', title: 'L1', objectives: ['obj1'],
        coreIdea: 'idea', examples: ['Compare two salary offers'], misconceptions: ['mc'],
        activityPlan: [
          { type: 'reading', step: 'observe', order: 1, description: 'Read' },
          { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz' },
        ],
        estimatedMinutes: 15,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), { reportPath: false });
      ok(result.findings.some((f) => f.checkId === 'QC-SCH-01'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('QC-COL-01 fires info for the college profile without academic markers', () => {
    const dir = createTempDir();
    try {
      writeSpec(dir, 'college');
      const blueprint = [{
        id: 'l1', title: 'L1', objectives: ['count objects'],
        coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [
          { type: 'reading', step: 'observe', order: 1, description: 'Read' },
          { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz' },
        ],
        estimatedMinutes: 15,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), { reportPath: false });
      ok(result.findings.some((f) => f.checkId === 'QC-COL-01'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('QC-SCH-02 fires error for an unknown grade band', () => {
    const dir = createTempDir();
    try {
      writeSpec(dir, 'school');
      const result = summarizeQuality(dir, makeValidationResult(), {
        reportPath: false,
        context: { gradeBand: 'phd' },
      });
      ok(result.findings.some((f) => f.checkId === 'QC-SCH-02'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('QC-SCH-02 does not fire for a known grade band', () => {
    const dir = createTempDir();
    try {
      writeSpec(dir, 'school');
      const result = summarizeQuality(dir, makeValidationResult(), {
        reportPath: false,
        context: { gradeBand: 'middle_school' },
      });
      strictEqual(result.findings.some((f) => f.checkId === 'QC-SCH-02'), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('QC-SCH-03 fires warning when lesson pacing is outside the grade band', () => {
    const dir = createTempDir();
    try {
      writeSpec(dir, 'school');
      const blueprint = [{
        id: 'l1', title: 'L1', objectives: ['obj1'],
        coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [
          { type: 'reading', step: 'observe', order: 1, description: 'Read' },
          { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz' },
        ],
        estimatedMinutes: 60,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), {
        reportPath: false,
        context: { gradeBand: 'early_primary' },
      });
      ok(result.findings.some((f) => f.checkId === 'QC-SCH-03'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('QC-SCH-03 does not fire when lesson pacing is within the grade band', () => {
    const dir = createTempDir();
    try {
      writeSpec(dir, 'school');
      const blueprint = [{
        id: 'l1', title: 'L1', objectives: ['obj1'],
        coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [
          { type: 'reading', step: 'observe', order: 1, description: 'Read' },
          { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz' },
        ],
        estimatedMinutes: 15,
      }];
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify(blueprint));
      const result = summarizeQuality(dir, makeValidationResult(), {
        reportPath: false,
        context: { gradeBand: 'early_primary' },
      });
      strictEqual(result.findings.some((f) => f.checkId === 'QC-SCH-03'), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('records learnerProfile in the quality summary', () => {
    const dir = createTempDir();
    try {
      writeSpec(dir, 'school');
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify([{
        id: 'l1', title: 'L1', objectives: ['obj1'],
        coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [
          { type: 'reading', step: 'observe', order: 1, description: 'Read' },
          { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz' },
        ],
        estimatedMinutes: 15,
      }]));
      const result = summarizeQuality(dir, makeValidationResult(), { reportPath: false });
      ok(result.summary.learnerProfile);
      strictEqual(result.summary.learnerProfile.key, 'school');
      strictEqual(result.summary.learnerProfile.name, 'School (K-12)');
      strictEqual(result.summary.learnerProfile.source, 'explicit');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('defaults learnerProfile to defaulted neurotypical when audience is absent', () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'lesson-blueprints.json'), JSON.stringify([{
        id: 'l1', title: 'L1', objectives: ['obj1'],
        coreIdea: 'idea', examples: ['ex'], misconceptions: ['mc'],
        activityPlan: [
          { type: 'reading', step: 'observe', order: 1, description: 'Read' },
          { type: 'quiz', step: 'mastery_check', order: 2, description: 'Quiz' },
        ],
        estimatedMinutes: 15,
      }]));
      const result = summarizeQuality(dir, makeValidationResult(), { reportPath: false });
      ok(result.summary.learnerProfile);
      strictEqual(result.summary.learnerProfile.key, 'neurotypical');
      strictEqual(result.summary.learnerProfile.source, 'defaulted');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('surfaces educational context in the quality summary when provided', () => {
    const dir = createTempDir();
    try {
      writeSpec(dir, 'school');
      const result = summarizeQuality(dir, makeValidationResult(), {
        reportPath: false,
        context: { educationLevel: 'school', gradeBand: 'middle_school', curriculum: 'nios' },
      });
      ok(result.summary.context);
      strictEqual(result.summary.context.educationLevel, 'school');
      strictEqual(result.summary.context.gradeBand, 'middle_school');
      strictEqual(result.summary.context.curriculum, 'nios');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('defaults context to null when not provided', () => {
    const dir = createTempDir();
    try {
      writeSpec(dir, 'school');
      const result = summarizeQuality(dir, makeValidationResult(), { reportPath: false });
      strictEqual(result.summary.context, null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});