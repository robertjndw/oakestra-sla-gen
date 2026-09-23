export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : (many || one + "s")}`;
}

export function joinWords(items) {
  if (items.length <= 1) return items.join("");
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

export function formatMb(mb) {
  if (mb >= 1024) return `${Math.round((mb / 1024) * 10) / 10} GB`;
  return `${mb} MB`;
}
