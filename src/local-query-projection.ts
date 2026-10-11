import type { QueryClient, Query } from '@tanstack/react-query';
type LocalReader = { getLocalResult(key: readonly unknown[], previous?: unknown): { handled: boolean; value?: unknown } };
/** Project the already-observed House replica into donor Query observers, without navigation fetches. */
export function connectLocalQueryProjection(client: QueryClient, reader: LocalReader) {
  let active = true;
  function project(query: Query) {
    if (!active) return;
    try {
      const result = reader.getLocalResult(query.queryKey, query.state.data);
      if (result.handled) query.setData(result.value, { manual: true });
    } catch (value) {
      const error = value instanceof Error ? value : new Error(String(value));
      query.setState({ data: undefined, error, status: 'error', fetchStatus: 'idle' });
    }
  }
  const unsubscribe = client.getQueryCache().subscribe(event => { if (event.type === 'added') project(event.query); });
  return { refresh() { client.getQueryCache().getAll().forEach(project); }, close() { active = false; unsubscribe(); } };
}
