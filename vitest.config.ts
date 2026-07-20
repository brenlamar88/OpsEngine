import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const alias = { "@": path.resolve(__dirname, "./src") };

// Two vitest "projects" so the cross-tenant isolation suite (which talks to
// a real Postgres over `pg` and needs a plain node environment) never shares
// a runtime with the jsdom-based component/hook tests (whose
// src/test/setup.ts touches `window`, which does not exist under the node
// environment). Splitting by project — rather than editing setup.ts — keeps
// the existing jsdom suite untouched.
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./src/test/setup.ts"],
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          exclude: ["src/test/isolation.test.ts", "**/node_modules/**"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "isolation",
          environment: "node",
          globals: true,
          include: ["src/test/isolation.test.ts"],
        },
      },
    ],
  },
});
