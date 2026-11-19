// Keep units beside the fraction and measure the stacked form for SVG placement.
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
function metrics(text, size) {
  const match = String(text).match(/^(-?\d+)\/(\d+)([AVΩ]?)$/);
  if (!match) return { width: String(text).length * size * .62 };
  const [, numerator, denominator, unit] = match;
  const bar = Math.max(numerator.length, denominator.length) * size * .56 + size * .25;
  return { numerator, denominator, unit, bar, width: bar + (unit ? size * .8 : 0) };
}
export function labelWidth(parts, size) {
  return parts.reduce((sum, part) => sum + metrics(part.text, size).width, 0);
}
export function svgLabel(parts, x, y, size, anchor = 'middle', className = '') {
  const width = labelWidth(parts, size);
  let left = x - (anchor === 'middle' ? width / 2 : anchor === 'end' ? width : 0);
  const content = parts.map(part => {
    const m = metrics(part.text, size), start = left;
    left += m.width;
    const attrs = `${part.fill ? ` fill="${escape(part.fill)}"` : ''}`;
    if (!m.numerator) return `<text${attrs}${part.className ? ` class="${escape(part.className)}"` : ''} x="${start}" y="${y}" font-size="${size}">${escape(part.text)}</text>`;
    return `<g${attrs} class="${escape(part.className || '')} fraction"><text x="${start + m.bar / 2}" y="${y - size * .65}" text-anchor="middle" font-size="${size * .9}">${m.numerator}</text><rect class="fraction-bar" x="${start}" y="${y - size * .4}" width="${m.bar}" height="${Math.max(1, size * .065)}" stroke="none"/><text x="${start + m.bar / 2}" y="${y + size * .6}" text-anchor="middle" font-size="${size * .9}">${m.denominator}</text>${m.unit ? `<text x="${start + m.bar + size * .15}" y="${y}" font-size="${size}">${m.unit}</text>` : ''}</g>`;
  }).join('');
  return `<g class="${escape(className)}" role="img" aria-label="${escape(parts.map(part => part.text).join(''))}">${content}</g>`;
}
