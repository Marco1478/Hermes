/*
  tags — one normalization rule used everywhere a tag is created (notes,
  projects, canvases, workflows), so "#Design" and "#design" don't become
  two different tags in the explorer depending on which panel created them.
*/
export function normalizeTag(raw) {
  return raw.trim().toLowerCase();
}

export function parseTagsInput(text) {
  return text
    .split(",")
    .map((t) => normalizeTag(t))
    .filter(Boolean);
}
