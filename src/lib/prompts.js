// System prompts + output caps for the two summary lengths.
export const PROMPTS = {
  short:
    'You summarize web pages for a Hacker News reader. Write a 2-3 sentence TL;DR of the content below. ' +
    'Be factual and neutral. No preamble, no "this article" — just the summary.',
  long:
    'You summarize web pages for a Hacker News reader. Summarize the content below as: one sentence of overview, ' +
    'then 4-7 concise bullet points (each starting with "- ") covering the key claims and takeaways. ' +
    'Be factual and neutral. No preamble.',
};

// Generous caps: for reasoning models (gpt-5, o-series, r1) max_tokens also
// covers reasoning tokens, so a tight cap yields empty content. The prompt,
// not this cap, controls how long the summary actually is.
export const MAX_TOKENS = { short: 1000, long: 2000 };
