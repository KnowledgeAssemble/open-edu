import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { useObserveMode } from '../../use-observe-mode';
import { WidgetError } from '../WidgetError';

const cardSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
  image: z.string().optional(),
  audio: z.string().optional(),
  hint: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
});

const flashcardSchema = z.object({
  cards: z.array(cardSchema).min(1),
  mode: z.enum(['flip', 'multiple', 'spaced']).optional().default('flip'),
  interactive: z.boolean().optional().default(false),
  shuffle: z.boolean().optional().default(false),
});

const FlashcardStateSchema = z.object({
  currentIndex: z.number(),
  flipped: z.array(z.number()),
  correct: z.array(z.number()),
  incorrect: z.array(z.number()),
  confidence: z.record(z.number(), z.number()).optional(),
});

function shuffleArray<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

function FlashcardComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
  resolveAsset?: (path: string) => string;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState, resolveAsset } = props;
  const parsed = flashcardSchema.safeParse(rawConfig);
  const parsedState = useMemo(() => {
    const result = FlashcardStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const [currentIndex, setCurrentIndex] = useState(parsedState?.currentIndex ?? 0);
  const [flipped, setFlipped] = useState(parsedState?.flipped ?? []);
  const [correctCards, setCorrectCards] = useState<number[]>(parsedState?.correct ?? []);
  const [incorrectCards, setIncorrectCards] = useState<number[]>(parsedState?.incorrect ?? []);
  const [showHint, setShowHint] = useState(false);

  const isObserve = parsed.success && !parsed.data.interactive;
  const { handleAcknowledge, showAcknowledgeButton } = useObserveMode({
    isObserve,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'language.flashcard',
  });

  const cards = useMemo(() => {
    if (!parsed.success) return [];
    return parsed.data.shuffle ? shuffleArray(parsed.data.cards, 42) : parsed.data.cards;
  }, [parsed]);

  const currentCard = cards[currentIndex];
  const isFlipped = flipped.includes(currentIndex);
  const totalCards = cards.length;
  const allReviewed = correctCards.length + incorrectCards.length >= totalCards;

  const handleFlip = useCallback(() => {
    if (isObserve) return;
    setFlipped((prev) => (prev.includes(currentIndex) ? prev : [...prev, currentIndex]));
    emitInteraction({
      type: 'widget.interaction',
      widgetId: 'language.flashcard',
      action: 'flip',
      cardIndex: currentIndex,
    });
  }, [currentIndex, isObserve, emitInteraction]);

  const handleSelfAssess = useCallback(
    (isCorrect: boolean) => {
      const list = isCorrect ? correctCards : incorrectCards;
      if (!list.includes(currentIndex)) {
        if (isCorrect) setCorrectCards((prev) => [...prev, currentIndex]);
        else setIncorrectCards((prev) => [...prev, currentIndex]);
      }
      emitInteraction({
        type: 'widget.interaction',
        widgetId: 'language.flashcard',
        action: isCorrect ? 'correct' : 'incorrect',
        cardIndex: currentIndex,
      });
      if (currentIndex < totalCards - 1) {
        setCurrentIndex((prev) => prev + 1);
        setShowHint(false);
      }
    },
    [currentIndex, correctCards, incorrectCards, totalCards, emitInteraction],
  );

  const handleContinue = useCallback(() => {
    const score = (correctCards.length / totalCards) * 100;
    complete(score, {
      currentIndex,
      flipped,
      correct: correctCards,
      incorrect: incorrectCards,
    });
  }, [correctCards, incorrectCards, flipped, currentIndex, totalCards, complete]);

  const handleRetryIncorrect = useCallback(() => {
    const incorrectIndices = incorrectCards;
    if (incorrectIndices.length > 0) {
      setCurrentIndex(incorrectIndices[0]!);
      setFlipped((prev) => prev.filter((i) => !incorrectIndices.includes(i)));
      setIncorrectCards([]);
      setShowHint(false);
    }
  }, [incorrectCards]);

  if (!parsed.success || !currentCard) {
    return <WidgetError />;
  }

  if (isObserve) {
    return (
      <div role="group" aria-label="Flashcard activity" data-testid="flashcard-observe">
        {cards.map((card, idx) => (
          <div
            key={idx}
            className="border-outline-variant bg-surface-container-lowest mb-sm p-md rounded-lg border"
          >
            <p className="text-on-surface font-semibold">{card.front}</p>
            <p className="text-on-surface/70 mt-xs">{card.back}</p>
          </div>
        ))}
        {showAcknowledgeButton && (
          <div className="p-md border-outline-variant mt-md flex items-center justify-center border-t">
            <Button variant="default" onClick={handleAcknowledge} data-testid="observe-acknowledge">
              Mark as seen ✓
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div role="group" aria-label="Flashcard activity" data-testid="flashcard">
      <p className="text-on-surface/70 mb-sm text-sm">
        Card {currentIndex + 1} of {totalCards}
      </p>

      <div
        className={`border-outline-variant bg-surface-container-lowest p-lg flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border text-center`}
        onClick={handleFlip}
        role="button"
        aria-label={
          isFlipped
            ? 'Card back: ' + currentCard.back
            : 'Card front: ' + currentCard.front + '. Click to flip.'
        }
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleFlip();
          }
        }}
        data-testid="flashcard-card"
      >
        {currentCard.image && (
          <img
            src={
              resolveAsset?.(currentCard.image) ??
              `/assets/${currentCard.image.replace(/^assets\//, '')}`
            }
            alt=""
            className="mb-sm max-h-32 rounded"
            aria-hidden="true"
          />
        )}
        <p className="text-on-surface text-lg font-medium">
          {isFlipped ? currentCard.back : currentCard.front}
        </p>
        {!isFlipped && <p className="text-on-surface/50 mt-sm text-sm">Click to flip</p>}
      </div>

      {currentCard.hint && !isFlipped && (
        <div className="mt-sm text-center">
          <Button variant="ghost" size="sm" onClick={() => setShowHint(!showHint)}>
            {showHint ? 'Hide Hint' : 'Show Hint'}
          </Button>
          {showHint && <p className="text-on-surface/70 mt-xs text-sm">{currentCard.hint}</p>}
        </div>
      )}

      {isFlipped && (
        <div className="mt-md gap-sm flex justify-center">
          <Button
            variant="outline"
            onClick={() => handleSelfAssess(false)}
            data-testid="btn-incorrect"
          >
            ✗ Incorrect
          </Button>
          <Button
            variant="default"
            onClick={() => handleSelfAssess(true)}
            data-testid="btn-correct"
          >
            ✓ Correct
          </Button>
        </div>
      )}

      {allReviewed && (
        <div
          role="status"
          aria-live="assertive"
          data-testid="flashcard-complete"
          className="mt-md text-center"
        >
          <p className="text-on-surface font-semibold">
            Done! {correctCards.length} correct, {incorrectCards.length} incorrect.
          </p>
          <div className="mt-sm gap-sm flex justify-center">
            {incorrectCards.length > 0 && (
              <Button variant="outline" onClick={handleRetryIncorrect} data-testid="btn-retry">
                Retry Incorrect
              </Button>
            )}
            <Button variant="default" onClick={handleContinue} data-testid="continue-button">
              Continue
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const FlashcardWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Study terms and concepts with interactive flip-card flashcards.',
    whatItDoes:
      'The Flashcard widget shows cards with a front and back — tap to flip and reveal the answer. Students can rate their confidence (easy/medium/hard), shuffle the deck, and track their progress. It supports flip, multiple-choice, and spaced repetition modes.',
    whenToUse: [
      'Vocabulary and spelling practice',
      'Memorizing key terms and definitions',
      'Language learning',
      'Quick revision before assessments',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "language.flashcard"',
      'Create your cards — each needs a front and back',
      'Optionally add hints, categories, and difficulty levels',
      'Choose a study mode: flip, multiple, or spaced',
    ],
    configFields: [
      {
        name: 'cards',
        type: 'array of objects',
        required: true,
        description:
          'Flashcards. Each has front (string), back (string), and optional hint (string), category (string), difficulty ("easy"/"medium"/"hard"), image (string), and audio (string).',
      },
      {
        name: 'mode',
        type: 'string',
        required: false,
        description:
          'Study mode: "flip" (default), "multiple" for multiple-choice, or "spaced" for spaced repetition.',
      },
      {
        name: 'shuffle',
        type: 'boolean',
        required: false,
        description: 'Randomize card order. Defaults to false.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        required: false,
        description: 'When false, shows cards in view-only mode. Defaults to false.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "Spanish Vocabulary",\n  "widget": "language.flashcard",\n  "config": {\n    "cards": [\n      { "front": "Hola", "back": "Hello", "hint": "Common greeting", "category": "Greetings" },\n      { "front": "Gracias", "back": "Thank you", "category": "Politeness" },\n      { "front": "Adios", "back": "Goodbye", "category": "Greetings" },\n      { "front": "Por favor", "back": "Please", "category": "Politeness" }\n    ],\n    "mode": "flip",\n    "shuffle": true,\n    "interactive": true\n  }\n}',
    tips: [
      'Keep front text short — one word or phrase',
      'Use detailed back text for definitions and context',
      'Add categories to help students organize their study',
      'Group related cards together (e.g., all greetings, all food words)',
    ],
    sidebarPosition: 1,
    relatedWidgets: [
      {
        id: 'core.matching',
        name: 'Matching',
        domain: 'core',
        slug: 'matching',
      },
      {
        id: 'core.fill-blank',
        name: 'Fill in the Blank',
        domain: 'core',
        slug: 'fill-blank',
      },
    ],
  },
  id: 'language.flashcard',
  name: 'Flashcard',
  description: 'Vocabulary and memory practice with flip cards',
  domain: 'language',
  version: '1.0.0',
  schema: flashcardSchema,
  render: FlashcardComponent,
  learningIntents: [LearningIntent.Practice, LearningIntent.Recall],
  capabilities: {
    supportsObserveMode: true,
    supportsKeyboard: true,
    supportsScreenReader: true,
    supportsHints: true,
    supportsRetry: true,
    supportsTouch: true,
    supportsMouse: true,
    supportsAnalytics: true,
    supportsRewards: true,
    supportsAccessibility: true,
    supportsOffline: true,
    supportsLocalization: true,
  },
  accessibility: {
    highContrast: true,
    keyboardOnly: true,
    screenReader: true,
    ariaSupport: true,
    focusManagement: true,
  },
  analytics: {
    trackAttempts: true,
    trackCompletionTime: true,
    trackHints: true,
    trackSuccessRate: true,
    trackConfidence: true,
    trackInteractions: true,
    trackMistakes: true,
    trackRetries: true,
  },
  reward: {
    completionXP: 15,
    confetti: true,
    positiveMessage: 'Great memorization!',
    achievement: 'first-flashcard',
  },
  ai: {
    difficulty: 'easy',
    estimatedMinutes: 5,
    bloomsLevel: 'remember',
    cognitiveLoad: 'low',
    recommendedAge: [6, 18],
    readingLevel: 'grade-2',
    subjectTags: ['language', 'vocabulary'],
    learningObjectives: [
      'Recall vocabulary or concepts from flashcards',
      'Self-assess understanding through flip interaction',
      'Practice retrieval through spaced repetition metadata',
    ],
    commonMisconceptions: [
      'Confusing similar-looking words or concepts',
      'Overconfidence after seeing the answer',
    ],
    generationHints: [
      'Keep card fronts concise (1-5 words)',
      'Write clear, specific backs',
      'Add images for concrete nouns',
      'Include pronunciation guides for language cards',
    ],
    authoringPrompt: 'Create flashcard sets for vocabulary or concept memorization',
    exampleConfigs: [
      {
        cards: [
          { front: 'Hola', back: 'Hello', hint: 'Spanish greeting', category: 'Greetings' },
          { front: 'Gracias', back: 'Thank you', category: 'Greetings' },
          { front: 'Adios', back: 'Goodbye', category: 'Greetings' },
        ],
        mode: 'flip',
        interactive: true,
        shuffle: true,
      },
    ],
  },
  icon: 'layers',
  keywords: ['flashcard', 'vocabulary', 'memory', 'recall', 'flip', 'quiz'],
  status: 'stable',
};

export { FlashcardWidget as flashcard, flashcardSchema };
export default FlashcardWidget;
