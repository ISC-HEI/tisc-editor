/**
 * Monarch syntax definition for the Typst language.
 * Defines regex rules for headings, keywords, variables, and math blocks.
 * Used by Monaco Editor to apply syntax highlighting.
 */
export const typstSyntax = {
  tokenizer: {
    root: [
      [/^=+.*$/, "keyword"], 
      [/\b(let|set|show|if|else|for|while|in|import|include|return|as)\b/, "keyword"],
      [/#[a-zA-Z_][\w-]*/, "variable"],
      [/\$[^$]*\$/, "string.quote"],
      [/"([^"\\]|\\.)*"/, "string"],
      [/\/\/.*/, "comment"],
      [/\/\*/, "comment", "@comment"],
      [/\*[^*]+\*/, "strong"],
      [/_[^_]+_/, "emphasis"],
    ],
    comment: [
      [/[^\/*]+/, "comment"],
      [/\*\//, "comment", "@pop"],
      [/[\/*]/, "comment"]
    ],
  }
};

/**
 * Editor configuration for Typst.
 * Defines comment toggling logic, bracket matching, and auto-closing pairs.
 */
export const typstConfig = {
  comments: { lineComment: "//", blockComment: ["/*", "*/"] },
  brackets: [["[", "]"], ["{", "}"], ["(", ")"]],
  autoClosingPairs: [
    { open: "[", close: "]" }, { open: "{", close: "}" },
    { open: "(", close: ")" }, { open: '"', close: '"' },
    { open: "$", close: "$" }
  ]
};