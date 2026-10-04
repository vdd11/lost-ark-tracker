import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // The app's "@/..." imports (tsconfig paths). Matched with the slash so
    // packages like @testing-library/react aren't caught by it.
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)) }],
  },
  test: {
    // Pure logic runs in Node; component tests opt into a DOM with
    // `// @vitest-environment jsdom` at the top of the file.
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
  },
});
