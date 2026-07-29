// Minimal HTML escaping for values interpolated into email templates. Email
// clients render the HTML part, so an unescaped name or message body is an
// injection vector into whatever the recipient's client will run/render.
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
