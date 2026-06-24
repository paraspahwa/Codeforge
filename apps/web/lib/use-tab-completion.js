/** Register Monaco inline ghost-text completions (Tab to accept) */

let debounceTimer = null;

export function registerTabCompletionProvider(monaco, editor, requestCompletion) {
  if (!monaco || !editor || !requestCompletion) {
    return () => undefined;
  }

  const provider = monaco.languages.registerInlineCompletionsProvider("*", {
    provideInlineCompletions: async (model, position) => {
      const path = model.uri.path.replace(/^\//, "") || "untitled.txt";
      const content = model.getValue();
      const lineNumber = position.lineNumber;
      const column = position.column;

      return new Promise((resolve) => {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(async () => {
          try {
            const result = await requestCompletion({
              path,
              content,
              lineNumber,
              column,
            });
            const text = String(result?.completion || "");
            if (!text) {
              resolve({ items: [] });
              return;
            }
            resolve({
              items: [
                {
                  insertText: text,
                  range: new monaco.Range(lineNumber, column, lineNumber, column),
                },
              ],
            });
          } catch {
            resolve({ items: [] });
          }
        }, 280);
      });
    },
    freeInlineCompletions: () => undefined,
  });

  return () => provider.dispose();
}
