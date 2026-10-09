import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { useObserveMode } from '../../use-observe-mode';

const compareSchema = z.object({
  numerator: z.number().int().min(0),
  denominator: z.number().int().min(1),
});

export const fractionVisualSchema = z.object({
  numerator: z.number().int().min(0),
  denominator: z.number().int().min(1),
  mode: z.enum(['bar', 'circle']).optional().default('bar'),
  label: z.string().optional(),
  showLabel: z.boolean().optional().default(true),
  interactive: z.boolean().optional().default(true),
  compare: compareSchema.optional(),
  size: z.number().optional().default(200),
});

export type FractionVisualConfig = z.infer<typeof fractionVisualSchema>;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    'Z',
  ].join('');
}

function computeComparison(n1: number, d1: number, n2: number, d2: number): '=' | '<' | '>' {
  const v1 = n1 / d1;
  const v2 = n2 / d2;
  if (v1 === v2) return '=';
  return v1 > v2 ? '>' : '<';
}

function segmentLabel(index: number, total: number): string {
  return `${index + 1} of ${total}`;
}

function countBits(mask: number): number {
  let count = 0;
  while (mask > 0) {
    count += mask & 1;
    mask >>= 1;
  }
  return count;
}

function FractionNotation({ numerator, denominator }: { numerator: number; denominator: number }) {
  return (
    <span
      className="inline-flex flex-col items-center leading-none"
      aria-label={`${numerator} over ${denominator}`}
    >
      <span className="border-on-surface border-b-2 px-1 text-lg font-semibold">{numerator}</span>
      <span className="px-1 text-lg font-semibold">{denominator}</span>
    </span>
  );
}

const FractionVisualStateSchema = z.object({
  submitted: z.boolean(),
  shadedMask: z.number().nullable(),
});

function FractionVisualComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState } = props;
  const parsed = fractionVisualSchema.safeParse(rawConfig);
  const content = parsed.success ? parsed.data : null;

  const parsedState = useMemo(() => {
    const result = FractionVisualStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const [submitted, setSubmitted] = useState(parsedState?.submitted ?? false);
  const initialShadedMask =
    parsedState?.shadedMask ?? (content?.compare && content?.interactive ? 0 : null);
  const [shadedMask, setShadedMask] = useState<number | null>(initialShadedMask);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const isObserve = content && !content.interactive;
  const size = content?.size ?? 200;
  const mode = content?.mode ?? 'bar';

  const initialMask = content ? (1 << content.numerator) - 1 : 0;
  const effectiveMask = shadedMask ?? initialMask;
  const shadedCount = countBits(effectiveMask);

  const {
    acknowledged,
    handleAcknowledge: handleObserveAcknowledge,
    showAcknowledgeButton,
  } = useObserveMode({
    isObserve: !!isObserve,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'math.fraction-visual',
  });

  const handleSegmentClick = useCallback(
    (index: number) => {
      if (!content?.interactive || submitted || !content) return;
      setShadedMask((prev) => {
        const mask = prev ?? (1 << content.numerator) - 1;
        return mask ^ (1 << index);
      });
    },
    [content, submitted],
  );

  const handleSubmit = useCallback(() => {
    if (!content || submitted) return;
    const correct = shadedCount === content.numerator;
    emitInteraction({
      type: 'widget.interaction',
      action: 'submit',
      shaded: shadedCount,
      expected: content.numerator,
      correct,
      widgetId: 'math.fraction-visual',
    });
    setSubmitted(true);
  }, [content, submitted, shadedCount, emitInteraction]);

  const handleContinue = useCallback(() => {
    if (!content) return;
    const correct = shadedCount === content.numerator;
    const score = correct ? 100 : 0;
    complete(score, { submitted: true, shadedMask });
  }, [content, shadedCount, shadedMask, complete]);

  if (!parsed.success || !content) {
    return (
      <div
        role="alert"
        data-testid="widget-config-error"
        className="bg-error/10 border-error/30 p-md text-on-surface rounded-lg border"
      >
        <p className="text-error font-semibold">Invalid widget configuration.</p>
        <p className="text-on-surface/70 mt-xs text-sm">
          Please check the fraction settings and try again.
        </p>
      </div>
    );
  }

  if (content.denominator > 12) {
    return (
      <div data-testid="fraction-too-many">
        <div className="border-outline-variant bg-surface-container-lowest p-md rounded-xl border text-center">
          <p className="text-on-surface-variant">
            This fraction has too many parts to display visually.
          </p>
        </div>
      </div>
    );
  }

  const barHeight = Math.max(40, size / 4);

  function renderBarSvg(baseNum: number, den: number, interactive: boolean, svgTestId: string) {
    const segWidth = size / den;
    const mask = interactive ? effectiveMask : (1 << baseNum) - 1;
    const segs: React.ReactNode[] = [];

    for (let i = 0; i < den; i++) {
      const isShaded = (mask & (1 << i)) !== 0;
      const isHovered = hoverIndex === i;
      let fillColor = isShaded
        ? interactive
          ? 'var(--oe-color-primary, #3b82f6)'
          : 'var(--oe-color-primary-fixed-dim, #2563eb)'
        : 'var(--oe-color-surface-container-high, #f3f4f6)';
      if (interactive && isHovered) {
        fillColor = isShaded
          ? 'var(--oe-color-primary-container, #60a5fa)'
          : 'var(--oe-color-surface-variant, #e5e7eb)';
      }
      segs.push(
        <rect
          key={i}
          x={i * segWidth}
          y={0}
          width={segWidth + 0.5}
          height={barHeight}
          fill={fillColor}
          stroke="var(--oe-color-outline, #1e3a5f)"
          strokeWidth={1}
          data-testid="bar-segment"
          data-shaded={isShaded ? 'true' : 'false'}
          aria-label={`Segment ${segmentLabel(i, den)} ${isShaded ? 'shaded' : 'unshaded'}`}
          role={interactive ? 'button' : undefined}
          tabIndex={interactive ? 0 : undefined}
          onClick={interactive ? () => handleSegmentClick(i) : undefined}
          onMouseEnter={interactive ? () => setHoverIndex(i) : undefined}
          onMouseLeave={interactive ? () => setHoverIndex(null) : undefined}
          onKeyDown={
            interactive
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleSegmentClick(i);
                }
              : undefined
          }
          className={interactive ? 'cursor-pointer' : undefined}
        />,
      );
    }

    return (
      <svg
        width={size}
        height={barHeight}
        viewBox={`0 0 ${size} ${barHeight}`}
        data-testid={svgTestId}
        aria-label={`Fraction bar: ${baseNum}/${den}`}
        role="img"
      >
        {segs}
      </svg>
    );
  }

  function renderCircleSvg(baseNum: number, den: number, interactive: boolean, svgTestId: string) {
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 2;
    const anglePerSeg = 360 / den;
    const mask = interactive ? effectiveMask : (1 << baseNum) - 1;
    const segs: React.ReactNode[] = [];

    for (let i = 0; i < den; i++) {
      const startAngle = i * anglePerSeg;
      const endAngle = (i + 1) * anglePerSeg;
      const isShaded = (mask & (1 << i)) !== 0;
      const isHovered = hoverIndex === i;
      let fillColor = isShaded
        ? interactive
          ? 'var(--oe-color-primary, #3b82f6)'
          : 'var(--oe-color-primary-fixed-dim, #2563eb)'
        : 'var(--oe-color-surface-container-high, #f3f4f6)';
      if (interactive && isHovered) {
        fillColor = isShaded
          ? 'var(--oe-color-primary-container, #60a5fa)'
          : 'var(--oe-color-surface-variant, #e5e7eb)';
      }
      const d = describeArc(cx, cy, r, startAngle, endAngle);
      segs.push(
        <path
          key={i}
          d={d}
          fill={fillColor}
          stroke="var(--oe-color-outline, #1e3a5f)"
          strokeWidth={1}
          data-testid="circle-segment"
          data-shaded={isShaded ? 'true' : 'false'}
          aria-label={`Segment ${segmentLabel(i, den)} ${isShaded ? 'shaded' : 'unshaded'}`}
          role={interactive ? 'button' : undefined}
          tabIndex={interactive ? 0 : undefined}
          onClick={interactive ? () => handleSegmentClick(i) : undefined}
          onMouseEnter={interactive ? () => setHoverIndex(i) : undefined}
          onMouseLeave={interactive ? () => setHoverIndex(null) : undefined}
          onKeyDown={
            interactive
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleSegmentClick(i);
                }
              : undefined
          }
          className={interactive ? 'cursor-pointer' : undefined}
        />,
      );
    }

    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        data-testid={svgTestId}
        aria-label={`Fraction circle: ${baseNum}/${den}`}
        role="img"
      >
        {segs}
      </svg>
    );
  }

  function renderFraction(num: number, den: number, interactive: boolean, svgTestId: string) {
    if (mode === 'circle') {
      return renderCircleSvg(num, den, interactive, svgTestId);
    }
    return renderBarSvg(num, den, interactive, svgTestId);
  }

  const isInteractive = content.interactive ?? false;
  const displayIndex = `${content.numerator}/${content.denominator}`;

  if (content.compare) {
    const comparison = computeComparison(
      content.numerator,
      content.denominator,
      content.compare.numerator,
      content.compare.denominator,
    );
    return (
      <div
        data-testid="fraction-compare"
        style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}
      >
        <div style={{ textAlign: 'center' }}>
          {renderFraction(content.numerator, content.denominator, isInteractive, 'fraction-bar')}
          <div aria-label={`Fraction value: ${content.numerator}/${content.denominator}`}>
            <FractionNotation numerator={content.numerator} denominator={content.denominator} />
          </div>
        </div>
        <div
          style={{ fontSize: '2rem', fontWeight: 'bold' }}
          aria-label={`comparison: ${comparison}`}
        >
          {comparison}
        </div>
        <div style={{ textAlign: 'center' }}>
          {renderFraction(
            content.compare.numerator,
            content.compare.denominator,
            isInteractive,
            'fraction-bar',
          )}
          <div
            aria-label={`Fraction value: ${content.compare.numerator}/${content.compare.denominator}`}
          >
            <FractionNotation
              numerator={content.compare.numerator}
              denominator={content.compare.denominator}
            />
          </div>
        </div>
        {isInteractive && !submitted && (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <Button
              variant="default"
              onClick={handleSubmit}
              disabled={shadedCount === 0 && shadedMask === null}
            >
              Submit
            </Button>
          </div>
        )}
        {submitted && (
          <div data-testid="feedback" role="status" aria-live="assertive">
            {shadedCount === content.numerator ? (
              <p>Correct!</p>
            ) : (
              <p>
                You shaded {shadedCount} out of {content.numerator} segments.
              </p>
            )}
          </div>
        )}
        {submitted && (
          <div style={{ marginTop: '0.5rem' }}>
            <Button variant="default" onClick={handleContinue} data-testid="continue-button">
              Continue
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-testid="fraction-visual" aria-label={`Fraction visual: ${displayIndex}`}>
      {content.showLabel !== false && content.label && <p>{content.label}</p>}

      <div role="status" aria-live="polite" data-testid="fraction-live-region" aria-atomic="true">
        <FractionNotation numerator={content.numerator} denominator={content.denominator} />
      </div>

      {renderFraction(content.numerator, content.denominator, isInteractive, `fraction-${mode}`)}

      {isInteractive && !submitted && (
        <div style={{ marginTop: '1rem' }}>
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={shadedCount === 0 && shadedMask === null}
          >
            Submit
          </Button>
        </div>
      )}

      {isInteractive && submitted && (
        <div data-testid="feedback" role="status" aria-live="assertive">
          {shadedCount === content.numerator ? (
            <p>Correct!</p>
          ) : (
            <p>
              You shaded {shadedCount} out of {content.numerator} segments.
            </p>
          )}
        </div>
      )}

      {isInteractive && submitted && (
        <div style={{ marginTop: '0.5rem' }}>
          <Button variant="default" onClick={handleContinue} data-testid="continue-button">
            Continue
          </Button>
        </div>
      )}

      {!isInteractive && showAcknowledgeButton && (
        <div
          role="status"
          aria-live="assertive"
          data-testid="observe-complete"
          style={{ marginTop: '1rem' }}
        >
          <Button
            variant="secondary"
            onClick={handleObserveAcknowledge}
            data-testid="observe-acknowledge"
          >
            Acknowledge
          </Button>
        </div>
      )}

      {!isInteractive && acknowledged && (
        <div
          role="status"
          aria-live="assertive"
          data-testid="observe-complete"
          style={{ marginTop: '1rem' }}
        >
          <p>Content acknowledged.</p>
        </div>
      )}
    </div>
  );
}

const FractionVisualWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Visualize and interact with fractions using circle or bar models.',
    whatItDoes:
      'The Fraction Visual widget shows fractions as shaded parts of a circle or bar. Students can see the relationship between numerator and denominator, compare fractions visually, and practice shading the correct portion.',
    whenToUse: [
      'Introducing fractions to early learners',
      'Visualizing equivalent fractions',
      'Comparing fraction sizes',
      'Building intuitive understanding of numerator and denominator',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "math.fraction-visual"',
      'Set the numerator and denominator',
      'Choose circle or bar mode',
      'Set interactive to true if students should shade the fraction themselves',
    ],
    configFields: [
      {
        name: 'numerator',
        type: 'number',
        required: true,
        description: 'The top number in the fraction (parts shaded).',
      },
      {
        name: 'denominator',
        type: 'number',
        required: true,
        description: 'The bottom number in the fraction (total parts). Keep to 12 or less.',
      },
      {
        name: 'mode',
        type: 'string',
        required: false,
        description: '"circle" (default) or "bar" representation.',
      },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: 'Instructions for the student.',
      },
      {
        name: 'showLabel',
        type: 'boolean',
        required: false,
        description: 'Show the fraction label as text. Defaults to false.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        required: false,
        description: 'When true, students shade the fraction themselves. Defaults to false.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "Fraction Shading",\n  "widget": "math.fraction-visual",\n  "config": {\n    "description": "Shade 3/4 of the circle.",\n    "numerator": 3,\n    "denominator": 4,\n    "mode": "circle",\n    "showLabel": true,\n    "interactive": true\n  }\n}',
    tips: [
      'Limit denominator to 12 or less for clear visualization',
      'Use circle mode for fractions under 1 whole',
      'Use bar mode for comparing multiple fractions',
      'Always show the fraction label for reinforcement',
    ],
    sidebarPosition: 1,
    relatedWidgets: [
      {
        id: 'math.number-line',
        name: 'Number Line',
        domain: 'math',
        slug: 'number-line',
      },
      {
        id: 'math.grid-area',
        name: 'Grid Area',
        domain: 'math',
        slug: 'grid-area',
      },
    ],
  },
  id: 'math.fraction-visual',
  name: 'Fraction Visual',
  description: 'Visualize and manipulate fractions with interactive models',
  domain: 'math',
  version: '1.0.0',
  schema: fractionVisualSchema,
  render: FractionVisualComponent,
  learningIntents: [LearningIntent.Observe, LearningIntent.Explore],
  capabilities: {
    supportsKeyboard: true,
    supportsScreenReader: true,
    supportsHints: true,
    supportsRetry: true,
    supportsScoring: true,
    supportsTouch: true,
    supportsMouse: true,
    supportsAnalytics: true,
    supportsRewards: true,
    supportsAccessibility: true,
    supportsAnimation: true,
    supportsOffline: true,
    supportsObserveMode: true,
  },
  accessibility: {
    highContrast: true,
    keyboardOnly: true,
    screenReader: true,
    tts: true,
    focusManagement: true,
    ariaSupport: true,
  },
  analytics: {
    trackAttempts: true,
    trackCompletionTime: true,
    trackSuccessRate: true,
    trackHints: true,
    trackRetries: true,
  },
  reward: {
    completionXP: 10,
    confetti: true,
    achievement: 'first-fraction',
    positiveMessage: 'Fraction understood!',
  },
  ai: {
    difficulty: 'easy',
    estimatedMinutes: 3,
    bloomsLevel: 'understand',
    cognitiveLoad: 'low',
    subjectTags: ['math', 'fractions'],
    authoringPrompt: 'Create a fraction visualization exercise with clear visual models',
    recommendedAge: [5, 10],
    readingLevel: 'pre-reader',
    learningObjectives: [
      'Understand that a fraction represents parts of a whole',
      'Visualize the relationship between numerator and denominator',
      'Compare two fractions using visual models',
    ],
    commonMisconceptions: [
      'Thinking a larger denominator means a larger fraction',
      'Confusing the shaded region with the unshaded region',
      'Not recognizing equivalent fractions across different models',
    ],
    generationHints: [
      'Limit denominator to 12 or less for clear visualization',
      'Use circle mode for comparisons under 1 whole',
      'Always include the fraction notation alongside the visual model',
    ],
    exampleConfigs: [
      { numerator: 1, denominator: 2, mode: 'bar' },
      { numerator: 3, denominator: 4, mode: 'circle' },
      {
        left: { numerator: 1, denominator: 2 },
        right: { numerator: 2, denominator: 4 },
        mode: 'compare',
      },
    ],
  },
  icon: 'pie-chart',
  keywords: ['fraction', 'visual', 'math', '分数'],
  status: 'stable',
};

export { FractionVisualWidget as fractionVisual };
export default FractionVisualWidget;
