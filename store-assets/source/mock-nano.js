// Screenshot-only stub: headless Chromium has no Gemini Nano.
self.Summarizer = { availability: async () => new URLSearchParams(location.search).get('nano') || 'available', create: async () => ({ destroy() {} }) };
