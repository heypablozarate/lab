// Replace the inner HTML of the element carrying data-i18n="key".
export function swapInner(html, key, value) {
  const attr = `data-i18n="${key}"`;
  const at = html.indexOf(attr);
  if (at < 0 || html.indexOf(attr, at + 1) >= 0) throw new Error(`marker ${key} must appear once`);
  const open = html.lastIndexOf('<', at);
  const tag = /^<([a-zA-Z0-9]+)/.exec(html.slice(open))[1];
  const start = html.indexOf('>', at) + 1;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
  re.lastIndex = start;
  let depth = 1;
  let m;
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(0, start) + value + html.slice(m.index);
  }
  throw new Error(`marker ${key} has no closing </${tag}>`);
}

export function once(html, from, to) {
  const n = html.split(from).length - 1;
  if (n !== 1) throw new Error(`expected one match for: ${from.slice(0, 80)} (found ${n})`);
  return html.replace(from, () => to);
}

export function attr(text) {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

