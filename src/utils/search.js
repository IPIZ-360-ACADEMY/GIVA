export function normalizeText(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function matchesSearch(query, terms) {
  if (!query) {
    return true;
  }
  return normalizeText(terms).includes(normalizeText(query));
}
