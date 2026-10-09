import type {
  WidgetDefinition,
  WidgetDefinitionV2,
  WidgetRegistry,
  WidgetSearchFilters,
  RemoteWidgetManifest,
  RemoteWidgetRegistration,
} from './types';
import { WidgetRegistrationError } from './types';
import { WIDGET_ALIAS_MAP } from './domains';
import { BUILTIN_WIDGETS } from './builtin-roster';
import { matchesIntentTagFilters } from './search-filter';

export function createWidgetRegistry(): WidgetRegistry {
  const widgets = new Map<string, WidgetDefinition>();
  const aliases = new Map<string, string>();
  const remoteWidgets = new Map<string, RemoteWidgetRegistration>();

  function resolveAndLookup(id: string): WidgetDefinition | undefined {
    const direct = widgets.get(id);
    if (direct) return direct;
    const resolved = aliases.get(id) ?? id;
    return widgets.get(resolved);
  }

  return {
    register(definition: WidgetDefinition) {
      if (widgets.has(definition.id)) {
        throw new WidgetRegistrationError(definition.id);
      }
      widgets.set(definition.id, definition);
    },
    get(id: string) {
      return resolveAndLookup(id);
    },
    has(id: string) {
      return resolveAndLookup(id) !== undefined;
    },
    registerAlias(aliasId: string, targetId: string) {
      aliases.set(aliasId, targetId);
    },
    resolveAlias(id: string) {
      return aliases.get(id) ?? id;
    },
    getAll() {
      return Array.from(widgets.values());
    },
    getByDomain(domain: string) {
      const prefix = `${domain}.`;
      return Array.from(widgets.values()).filter((w) => w.id.startsWith(prefix));
    },
    search(query: string) {
      const lower = query.trim().toLowerCase();
      return Array.from(widgets.values()).filter((w) => {
        if (w.id.toLowerCase().includes(lower)) return true;
        const v2 = w as WidgetDefinitionV2;
        if (v2.name?.toLowerCase().includes(lower)) return true;
        if (v2.description?.toLowerCase().includes(lower)) return true;
        if (v2.keywords?.some((k) => k.toLowerCase().includes(lower))) return true;
        return false;
      });
    },
    searchWithFilters(filters: WidgetSearchFilters) {
      return Array.from(widgets.values()).filter((w) => {
        const v2 = w as WidgetDefinitionV2;

        if (filters.query) {
          const lower = filters.query.trim().toLowerCase();
          const textMatch =
            w.id.toLowerCase().includes(lower) ||
            v2.name?.toLowerCase().includes(lower) ||
            v2.description?.toLowerCase().includes(lower) ||
            v2.keywords?.some((k) => k.toLowerCase().includes(lower));
          if (!textMatch) return false;
        }

        if (filters.domain && v2.domain !== filters.domain) return false;

        const intents = filters.intents ?? (filters.intent ? [filters.intent] : undefined);
        if (
          !matchesIntentTagFilters(
            { intents: v2.learningIntents, subjectTags: v2.ai?.subjectTags },
            { intents, subjectTags: filters.subjectTags },
          )
        ) {
          return false;
        }

        if (filters.difficulty && v2.ai?.difficulty !== filters.difficulty) return false;

        if (filters.status && v2.status !== filters.status) return false;

        if (filters.capability && !v2.capabilities?.[filters.capability]) return false;

        if (filters.accessibility && !v2.accessibility?.[filters.accessibility]) return false;

        return true;
      });
    },
    registerRemote(manifest: RemoteWidgetManifest) {
      const key = `${manifest.id}@${manifest.version}`;
      if (remoteWidgets.has(key)) {
        return;
      }
      remoteWidgets.set(key, { manifest, status: 'pending' });
    },
    getRemoteRegistration(manifest: RemoteWidgetManifest): RemoteWidgetRegistration | undefined {
      return remoteWidgets.get(`${manifest.id}@${manifest.version}`);
    },
    updateRemoteStatus(
      manifest: RemoteWidgetManifest,
      status: RemoteWidgetRegistration['status'],
      error?: string,
    ) {
      const key = `${manifest.id}@${manifest.version}`;
      const existing = remoteWidgets.get(key);
      if (existing) {
        existing.status = status;
        existing.error = error;
      }
    },
  };
}

export function registerAllBuiltins(registry: WidgetRegistry): void {
  for (const widget of BUILTIN_WIDGETS) {
    registry.register(widget);
  }
  for (const [aliasId, targetId] of Object.entries(WIDGET_ALIAS_MAP)) {
    registry.registerAlias(aliasId, targetId);
  }
}

export function createDefaultRegistry(): WidgetRegistry {
  const registry = createWidgetRegistry();
  registerAllBuiltins(registry);
  return registry;
}
