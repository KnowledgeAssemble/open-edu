import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { useObserveMode } from '../../use-observe-mode';

const calloutTypeSchema = z
  .enum([
    'note',
    'tip',
    'warning',
    'important',
    'definition',
    'example',
    'fun-fact',
    'quote',
    'success',
    'question',
  ])
  .catch('note');

const calloutSchema = z.object({
  type: calloutTypeSchema.optional().default('note'),
  title: z.string().optional(),
  content: z.string().min(1),
  icon: z.string().optional(),
  collapsible: z.boolean().optional().default(false),
  defaultExpanded: z.boolean().optional().default(true),
  colorVariant: z.enum(['default', 'primary', 'success', 'warning', 'error']).optional(),
  interactive: z.boolean().optional().default(false),
});

type CalloutType = z.infer<typeof calloutTypeSchema>;

const CALLOUT_STYLES: Record<
  CalloutType,
  { borderColor: string; backgroundColor: string; accentColor: string }
> = {
  note: {
    borderColor: 'var(--oe-color-primary, #3b82f6)',
    backgroundColor: 'var(--oe-color-primary-container, #eff6ff)',
    accentColor: 'var(--oe-color-primary, #3b82f6)',
  },
  tip: {
    borderColor: 'var(--oe-success, #22c55e)',
    backgroundColor: 'var(--oe-color-success-container, #f0fdf4)',
    accentColor: 'var(--oe-success, #22c55e)',
  },
  warning: {
    borderColor: 'var(--oe-warning, #eab308)',
    backgroundColor: 'var(--oe-color-warning-container, #fefce8)',
    accentColor: 'var(--oe-warning, #eab308)',
  },
  important: {
    borderColor: 'var(--oe-error, #ef4444)',
    backgroundColor: 'var(--oe-color-error-container, #fef2f2)',
    accentColor: 'var(--oe-error, #ef4444)',
  },
  definition: {
    borderColor: 'var(--oe-color-primary, #3b82f6)',
    backgroundColor: 'var(--oe-color-primary-container, #eff6ff)',
    accentColor: 'var(--oe-color-primary, #3b82f6)',
  },
  example: {
    borderColor: 'var(--oe-color-secondary, #a855f7)',
    backgroundColor: 'var(--oe-color-secondary-container, #faf5ff)',
    accentColor: 'var(--oe-color-secondary, #a855f7)',
  },
  'fun-fact': {
    borderColor: 'var(--oe-success, #22c55e)',
    backgroundColor: 'var(--oe-color-success-container, #f0fdf4)',
    accentColor: 'var(--oe-success, #22c55e)',
  },
  quote: {
    borderColor: 'var(--oe-color-outline-variant, #6b7280)',
    backgroundColor: 'var(--oe-color-surface-container-lowest, #f9fafb)',
    accentColor: 'var(--oe-color-outline-variant, #6b7280)',
  },
  success: {
    borderColor: 'var(--oe-success, #22c55e)',
    backgroundColor: 'var(--oe-color-success-container, #f0fdf4)',
    accentColor: 'var(--oe-success, #22c55e)',
  },
  question: {
    borderColor: 'var(--oe-color-primary, #3b82f6)',
    backgroundColor: 'var(--oe-color-primary-container, #eff6ff)',
    accentColor: 'var(--oe-color-primary, #3b82f6)',
  },
};

const CALLOUT_ICONS: Record<CalloutType, string> = {
  note: '\u2139\ufe0f',
  tip: '\ud83d\udca1',
  warning: '\u26a0\ufe0f',
  important: '\ud83d\udd34',
  definition: '\ud83d\udcd6',
  example: '\ud83d\udcdd',
  'fun-fact': '\u2728',
  quote: '\ud83d\udcac',
  success: '\u2705',
  question: '\u2753',
};

const CALLOUT_ROLES: Record<CalloutType, string> = {
  note: 'note',
  tip: 'note',
  warning: 'alert',
  important: 'alert',
  definition: 'note',
  example: 'note',
  'fun-fact': 'note',
  quote: 'note',
  success: 'note',
  question: 'note',
};

const CalloutStateSchema = z.object({
  acknowledged: z.boolean(),
});

function getDefaultIcon(type: CalloutType): string {
  return CALLOUT_ICONS[type] ?? '\u2139\ufe0f';
}

function getStyles(type: CalloutType): {
  borderColor: string;
  backgroundColor: string;
  accentColor: string;
} {
  return CALLOUT_STYLES[type] ?? CALLOUT_STYLES.note;
}

function CalloutComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState } = props;
  const parsed = calloutSchema.safeParse(rawConfig);
  const content = parsed.success ? parsed.data : null;
  const hasValidContent = parsed.success && content;

  const parsedState = useMemo(() => {
    const result = CalloutStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const [expanded, setExpanded] = useState(content?.defaultExpanded ?? true);
  const [localAcknowledged, setLocalAcknowledged] = useState(parsedState?.acknowledged ?? false);

  const isObserve = !!(content?.interactive !== true && hasValidContent);

  const { handleAcknowledge: handleObserveAcknowledge, showAcknowledgeButton } = useObserveMode({
    isObserve,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'core.callout',
  });

  const handleGotIt = useCallback(() => {
    emitInteraction({
      type: 'widget.interaction',
      action: 'acknowledge',
      widgetId: 'core.callout',
    });
    complete(100, { acknowledged: true });
    setLocalAcknowledged(true);
  }, [complete, emitInteraction]);

  if (!hasValidContent) {
    return (
      <div role="alert" data-testid="widget-config-error">
        <p>This activity could not be loaded.</p>
      </div>
    );
  }

  const calloutType = content.type;
  const styles = getStyles(calloutType);
  const defaultIcon = getDefaultIcon(calloutType);
  const displayIcon = content.icon ?? defaultIcon;
  const role = CALLOUT_ROLES[calloutType];

  const finalAcknowledged = parsedState?.acknowledged ?? localAcknowledged;

  const containerStyle: React.CSSProperties = {
    borderLeft: `4px solid ${styles.borderColor}`,
    backgroundColor: styles.backgroundColor,
    borderRadius: '0.375rem',
    padding: '0.75rem',
    marginBottom: '0.75rem',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: content.collapsible && !expanded ? 0 : '0.5rem',
    cursor: content.collapsible ? 'pointer' : undefined,
  };

  const toggleButton = content.collapsible ? (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setExpanded((prev) => !prev);
      }}
      aria-expanded={expanded}
      aria-controls={`callout-content-${props.nodeId}`}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '0.25rem',
        fontSize: '0.75rem',
        color: styles.accentColor,
        marginLeft: 'auto',
      }}
      data-testid="callout-toggle"
      aria-label={expanded ? 'Collapse' : 'Expand'}
    >
      {expanded ? '\u25B2' : '\u25BC'}
    </button>
  ) : null;

  const acknowledgeButton = isObserve ? (
    showAcknowledgeButton && !finalAcknowledged ? (
      <div style={{ marginTop: '0.75rem' }}>
        <Button
          variant="default"
          onClick={handleObserveAcknowledge}
          data-testid="observe-acknowledge"
        >
          Mark as seen ✓
        </Button>
      </div>
    ) : (
      <div
        role="status"
        aria-live="assertive"
        data-testid="observe-complete"
        style={{ marginTop: '0.75rem' }}
      >
        <p>Content acknowledged.</p>
      </div>
    )
  ) : !finalAcknowledged ? (
    <div style={{ marginTop: '0.75rem' }}>
      <Button variant="default" onClick={handleGotIt} data-testid="callout-got-it">
        Got it ✓
      </Button>
    </div>
  ) : (
    <div
      role="status"
      aria-live="assertive"
      data-testid="callout-acknowledged"
      style={{ marginTop: '0.75rem' }}
    >
      <p>Acknowledged.</p>
    </div>
  );

  return (
    <div
      role={role}
      data-testid="callout"
      aria-label={content.title ?? calloutType}
      style={containerStyle}
    >
      <div
        style={headerStyle}
        onClick={content.collapsible ? () => setExpanded((e) => !e) : undefined}
      >
        <span aria-hidden="true" data-testid="callout-icon">
          {displayIcon}
        </span>
        {content.title && <span style={{ fontWeight: 600 }}>{content.title}</span>}
        {toggleButton}
      </div>
      <div
        id={`callout-content-${props.nodeId}`}
        data-testid="callout-content"
        style={{
          display: content.collapsible && !expanded ? 'none' : 'block',
        }}
      >
        <p style={{ margin: 0 }}>{content.content}</p>
        {acknowledgeButton}
      </div>
    </div>
  );
}

const CalloutWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Highlight key information with a styled callout card.',
    whatItDoes:
      'The Callout widget displays important information in a visually distinct card. You can choose from different styles — tip, info, warning, or success — and add an optional icon. It is a passive display widget, not interactive.',
    whenToUse: [
      'Highlighting key takeaways or important notes',
      'Displaying fun facts or "Did you know?" boxes',
      'Showing safety warnings or reminders',
      'Adding emphasis to critical information',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "core.callout"',
      'Choose a type: tip, info, warning, or success',
      'Write a title and the content text',
      'Optionally add an emoji icon',
    ],
    configFields: [
      {
        name: 'type',
        type: 'string',
        required: true,
        description: 'The callout style: "tip", "info", "warning", or "success".',
      },
      {
        name: 'title',
        type: 'string',
        required: false,
        description: 'A heading for the callout card.',
      },
      {
        name: 'content',
        type: 'string',
        required: true,
        description: 'The main text content of the callout.',
      },
      {
        name: 'icon',
        type: 'string',
        required: false,
        description: 'An emoji icon to display with the callout, e.g. "💡" for tips.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "Did you know?",\n  "widget": "core.callout",\n  "config": {\n    "type": "tip",\n    "title": "Did you know?",\n    "content": "Plants make their own food using sunlight, water, and carbon dioxide through a process called photosynthesis.",\n    "icon": "🌿"\n  }\n}',
    tips: [
      'Keep content concise — 1-3 sentences is ideal',
      'Use the right type for your message: tip for helpful hints, warning for important cautions',
      'Emoji icons add visual appeal but are optional',
      'Callouts work well between other activities to break up the lesson flow',
    ],
    sidebarPosition: 10,
    relatedWidgets: [],
  },
  id: 'core.callout',
  version: '1.0.0',
  name: 'Callout',
  description: 'Highlight important information with styled callout boxes',
  domain: 'core',
  render: CalloutComponent,
  learningIntents: [LearningIntent.Observe],
  capabilities: {
    supportsObserveMode: true,
    supportsKeyboard: true,
    supportsScreenReader: true,
    supportsOffline: true,
    supportsTouch: true,
    supportsMouse: true,
    supportsAnalytics: true,
    supportsRewards: true,
    supportsAccessibility: true,
  },
  accessibility: {
    highContrast: true,
    keyboardOnly: true,
    screenReader: true,
    focusManagement: true,
    ariaSupport: true,
  },
  analytics: {
    trackAttempts: true,
    trackCompletionTime: true,
    trackSuccessRate: true,
  },
  reward: {
    completionXP: 10,
    confetti: true,
    achievement: 'first-callout',
    positiveMessage: 'Content reviewed!',
  },
  ai: {
    difficulty: 'easy',
    estimatedMinutes: 1,
    bloomsLevel: 'remember',
    cognitiveLoad: 'low',
    recommendedAge: [5, 18],
    readingLevel: 'grade-2',
    subjectTags: ['general'],
    learningObjectives: [
      'Identify and understand highlighted key information',
      'Recognize different types of informational callouts',
    ],
    commonMisconceptions: ['Confusing callout types (e.g., thinking a warning is a tip)'],
    generationHints: [
      'Keep callout content concise and focused on one key point',
      'Use type that matches the intent (warning for cautions, tip for advice)',
      'Include a descriptive title when the content needs context',
    ],
    authoringPrompt: 'Create a callout to highlight key information',
    exampleConfigs: [
      {
        type: 'tip',
        title: 'Study Tip',
        content: 'Break study sessions into 25-minute focused blocks.',
      },
      {
        type: 'warning',
        title: 'Common Mistake',
        content: 'Do not forget to carry over when adding multi-digit numbers.',
      },
    ],
  },
  icon: 'alert-circle',
  keywords: ['callout', 'highlight', 'note', 'info', 'tip', 'warning'],
  status: 'stable',
};

export { CalloutWidget as callout };
export default CalloutWidget;
