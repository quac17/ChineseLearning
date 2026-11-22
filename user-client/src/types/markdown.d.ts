/** Markdown content files are imported as plain text (see next.config.mjs). */
declare module '*.md' {
  const source: string;
  export default source;
}
