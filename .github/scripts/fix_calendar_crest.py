from pathlib import Path

path = Path('react-migration/src/pages/CalendarPage.jsx')
text = path.read_text()

old = """function normalizeAssetUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith('/../')) return raw.replace(/^\/\.\.\//, '../');
  if (raw.startsWith('../') || raw.startsWith('./')) return raw;
  if (raw.startsWith('/')) return `..${raw}`;
  return `../${raw.replace(/^\/+/, '')}`;
}"""

new = """function normalizeAssetUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  const relative = raw
    .replace(/^(?:\.\.\/)+/, '')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
  if (!relative) return null;
  return new URL(relative, document.baseURI).href;
}"""

if old not in text:
    raise SystemExit('normalizeAssetUrl marker not found')

path.write_text(text.replace(old, new, 1))
