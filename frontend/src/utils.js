export function titleCase(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function campusName(nome) {
  if (!nome) return "";
  return titleCase(nome.replace(/c[âa]mpus\s+/i, ""));
}
