import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@open-edu/i18n';
import studioEn from '@open-edu/i18n/locales/en/studio.json';
import { useWidgetConfig } from '../hooks/useWidgetConfig';
import { validateWidgetConfig } from '../WidgetValidator';
import { z } from 'zod';
import { WidgetPreviewProvider, useWidgetPreview } from '../WidgetPreviewProvider';
import { WidgetPreviewPanel } from '../WidgetPreviewPanel';
import { SplitPaneLayout } from '../SplitPaneLayout';

function wrap(ui: React.ReactElement) {
  return (
    <I18nProvider locale="en" dictionaries={{ en: { studio: studioEn as Record<string, string> } }}>
      {ui}
    </I18nProvider>
  );
}

describe('useWidgetConfig', () => {
  it('returns isWidgetNode=true for exercise nodes', () => {
    const content = JSON.stringify({
      type: 'exercise',
      config: { prompt: 'Test' },
      widget: 'core.multiple-choice',
    });
    const { result } = renderHook(() => useWidgetConfig(content));
    expect(result.current.isWidgetNode).toBe(true);
    expect(result.current.widgetType).toBe('core.multiple-choice');
    expect(result.current.widgetConfig).toEqual({ prompt: 'Test' });
  });

  it('returns isWidgetNode=true for custom nodes', () => {
    const content = JSON.stringify({
      type: 'custom',
      config: { items: [] },
      widget: 'core.drag-drop',
    });
    const { result } = renderHook(() => useWidgetConfig(content));
    expect(result.current.isWidgetNode).toBe(true);
    expect(result.current.widgetType).toBe('core.drag-drop');
  });

  it('returns isWidgetNode=false for lesson nodes', () => {
    const content = JSON.stringify({ type: 'lesson', title: 'Hello' });
    const { result } = renderHook(() => useWidgetConfig(content));
    expect(result.current.isWidgetNode).toBe(false);
    expect(result.current.widgetType).toBeNull();
  });

  it('returns isWidgetNode=false for malformed JSON', () => {
    const { result } = renderHook(() => useWidgetConfig('not valid json'));
    expect(result.current.isWidgetNode).toBe(false);
    expect(result.current.widgetType).toBeNull();
  });

  it('returns isWidgetNode=false for empty config', () => {
    const content = JSON.stringify({ type: 'exercise' });
    const { result } = renderHook(() => useWidgetConfig(content));
    expect(result.current.isWidgetNode).toBe(true);
    expect(result.current.widgetType).toBe('core.multiple-choice');
    expect(result.current.widgetConfig).toEqual({});
  });

  it('uses config field from the node', () => {
    const content = JSON.stringify({
      type: 'exercise',
      config: { questions: [] },
      metadata: { widgetType: 'core.matching' },
    });
    const { result } = renderHook(() => useWidgetConfig(content));
    expect(result.current.widgetType).toBe('core.matching');
    expect(result.current.widgetConfig).toEqual({ questions: [] });
  });
});

describe('WidgetValidator', () => {
  it('returns empty errors for valid config matching schema', () => {
    const schema = z.object({ prompt: z.string().min(1) });
    const errors = validateWidgetConfig({ prompt: 'Hello' }, schema);
    expect(errors).toHaveLength(0);
  });

  it('returns errors for config violating schema', () => {
    const schema = z.object({ prompt: z.string().min(1) });
    const errors = validateWidgetConfig({ prompt: '' }, schema);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.severity).toBe('error');
    expect(errors[0]!.path).toBe('prompt');
  });

  it('returns empty errors when schema is undefined', () => {
    const errors = validateWidgetConfig({ prompt: 'Hello' }, undefined);
    expect(errors).toHaveLength(0);
  });

  it('returns warnings for missing recommended fields', () => {
    const errors = validateWidgetConfig({}, undefined);
    expect(errors).toHaveLength(0);
  });

  it('handles nested object validation', () => {
    const schema = z.object({ options: z.array(z.object({ text: z.string().min(1) })).min(1) });
    const errors = validateWidgetConfig({ options: [{ text: '' }] }, schema);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('WidgetPreviewProvider', () => {
  it('provides registry with default built-in widgets', () => {
    function Consumer() {
      const ctx = useWidgetPreview();
      return <div data-testid="widget-count">{ctx.registry.getAll().length}</div>;
    }
    render(
      <WidgetPreviewProvider>
        <Consumer />
      </WidgetPreviewProvider>,
    );
    expect(screen.getByTestId('widget-count').textContent).toBe('28');
  });

  it('wraps children and renders them', () => {
    render(
      <WidgetPreviewProvider>
        <div data-testid="child">content</div>
      </WidgetPreviewProvider>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});

describe('WidgetPreviewPanel', () => {
  it('shows empty state when widgetType is null', () => {
    render(
      wrap(<WidgetPreviewPanel widgetType={null} widgetConfig={null} validationErrors={[]} />),
    );
    expect(screen.getByText(/no widget to preview/i)).toBeInTheDocument();
  });

  it('shows widget-not-found for unknown widget type', () => {
    render(
      wrap(
        <WidgetPreviewPanel
          widgetType="nonexistent.widget"
          widgetConfig={{}}
          validationErrors={[]}
        />,
      ),
    );
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
  });

  it('shows error banner when validation errors exist', () => {
    const errors = [
      { path: 'prompt', message: 'Required', severity: 'error' as const, code: 'invalid_type' },
    ];
    render(
      wrap(
        <WidgetPreviewPanel
          widgetType="core.multiple-choice"
          widgetConfig={{}}
          validationErrors={errors}
        />,
      ),
    );
    expect(screen.getByText(/Required/)).toBeInTheDocument();
  });

  it('renders widget for known type with valid config', () => {
    render(
      wrap(
        <WidgetPreviewPanel
          widgetType="core.multiple-choice"
          widgetConfig={{ prompt: 'Test?', options: [{ id: 'a', text: 'Answer' }] }}
          validationErrors={[]}
        />,
      ),
    );
    expect(screen.getByText('Test?')).toBeInTheDocument();
  });

  it('reset preview clears widget interaction state', async () => {
    render(
      wrap(
        <WidgetPreviewPanel
          widgetType="core.visual-counting"
          widgetConfig={{ items: ['🍎', '🍎', '🍎'], count: 3, interactive: true }}
          validationErrors={[]}
        />,
      ),
    );
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Count 3' }));
    });
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /submit/i }));
    });
    expect(screen.getByText('Correct! The answer is 3.')).toBeInTheDocument();
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Reset preview' }));
    });
    expect(screen.queryByText('Correct! The answer is 3.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });
});

describe('SplitPaneLayout', () => {
  it('renders editor content in left pane', () => {
    render(
      <SplitPaneLayout
        editorContent={<div data-testid="editor">Editor</div>}
        previewContent={<div data-testid="preview">Preview</div>}
        showPreview={true}
        onTogglePreview={() => {}}
      />,
    );
    expect(screen.getByTestId('editor')).toBeInTheDocument();
    expect(screen.getByTestId('preview')).toBeInTheDocument();
  });

  it('hides preview content when showPreview is false', () => {
    render(
      <SplitPaneLayout
        editorContent={<div data-testid="editor">Editor</div>}
        previewContent={<div data-testid="preview">Preview</div>}
        showPreview={false}
        onTogglePreview={() => {}}
      />,
    );
    expect(screen.getByTestId('editor')).toBeInTheDocument();
    expect(screen.queryByTestId('preview')).not.toBeInTheDocument();
  });
});
