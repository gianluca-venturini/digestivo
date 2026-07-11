// Map a failure to a short, human-readable message shown in the button's title=.
// The real/raw error is logged to console.error separately and never shown here.
export function curateError({ stage, code, name } = {}) {
  if (name === 'NetworkError' || code === 0) {
    return 'Network error — check your connection';
  }

  if (stage === 'fetch') {
    if (code === 401) return 'Jina key rejected — check it in settings';
    if (code === 429) return 'Jina rate limit — try again shortly';
    return "Couldn't fetch the page";
  }

  // stage === 'summarize' (OpenRouter)
  if (name === 'EmptyContent') return 'Model returned no summary — try another model';
  if (code === 401) return 'OpenRouter key rejected — check it in settings';
  if (code === 402) return 'Out of OpenRouter credits';
  if (code === 429) return 'Rate limited — try again shortly';
  if (code === 502 || code === 503) return 'Model unavailable — try another model';
  return 'API error';
}
