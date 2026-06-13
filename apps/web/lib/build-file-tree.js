/**
 * Build a nested tree from flat workspace file paths.
 * @param {string[]} paths
 * @returns {{ name: string, path: string | null, isFile: boolean, children: Map<string, object> }}
 */
export function buildFileTreeFromPaths(paths) {
  const root = { name: "", path: "", isFile: false, children: new Map() };

  for (const filePath of paths) {
    const parts = filePath.split("/").filter(Boolean);
    let node = root;
    let prefix = "";
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      const isFile = index === parts.length - 1;
      prefix = prefix ? `${prefix}/${part}` : part;
      if (!node.children.has(part)) {
        node.children.set(part, {
          name: part,
          path: isFile ? filePath : prefix,
          isFile,
          children: new Map(),
        });
      }
      node = node.children.get(part);
      if (isFile) {
        node.path = filePath;
        node.isFile = true;
      } else {
        node.path = prefix;
        node.isFile = false;
      }
    }
  }

  return root;
}

/**
 * @param {Map<string, object>} children
 * @returns {object[]}
 */
export function sortTreeChildren(children) {
  return Array.from(children.values()).sort((a, b) => {
    if (a.isFile !== b.isFile) {
      return a.isFile ? 1 : -1;
    }
    return a.name.localeCompare(b.name);
  });
}
