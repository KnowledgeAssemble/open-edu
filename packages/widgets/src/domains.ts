import { WIDGET_ALIAS_MAP } from '@open-edu/schemas';

export { WIDGET_ALIAS_MAP };

export enum WidgetDomain {
  Core = 'core',
  Math = 'math',
  Language = 'language',
  Science = 'science',
  Social = 'social',
}

export function resolveWidgetId(id: string): string {
  return WIDGET_ALIAS_MAP[id] ?? id;
}

export function migrateWidgetId(id: string): {
  oldId: string;
  newId: string;
  migrated: boolean;
} {
  const newId = resolveWidgetId(id);
  return {
    oldId: id,
    newId,
    migrated: id !== newId,
  };
}

export function getDomainPrefix(widgetId: string): string {
  const dotIndex = widgetId.indexOf('.');
  if (dotIndex === -1) return '';
  return widgetId.substring(0, dotIndex);
}
