/** `sp_5271a03e…` style IDs → `sp_5271…a03e`. Short IDs are returned unchanged. */
export function shortId(id: string) {
  const cut = id.indexOf('_') + 1;
  const prefix = id.slice(0, cut), rest = id.slice(cut);
  return rest.length > 10 ? `${prefix}${rest.slice(0, 4)}…${rest.slice(-4)}` : id;
}
