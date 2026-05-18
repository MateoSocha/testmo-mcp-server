/**
 * Integration tests — require a real Testmo instance.
 * All tests are READ-ONLY: no resources are created or deleted.
 *
 * Run locally:
 *   TESTMO_BASE_URL=https://your-instance.testmo.net \
 *   TESTMO_ACCESS_TOKEN=your-token \
 *   npm test
 *
 * Tests skip automatically when credentials are absent (safe for CI).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ToolResponse = {
  isError: boolean;
  text: string;
  json<T = unknown>(): T;
};

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {}
): Promise<ToolResponse> {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as Array<{ type: string; text?: string }>;
  const text = content.find((c) => c.type === "text")?.text ?? "";
  return {
    isError: result.isError === true,
    text,
    json<T>(): T {
      return JSON.parse(text) as T;
    },
  };
}

type ListResponse<T> = { result: T[]; total: number };

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const SKIP = !process.env.TESTMO_BASE_URL || !process.env.TESTMO_ACCESS_TOKEN;

describe.skipIf(SKIP)("testmo MCP server — integration", () => {
  let client: Client;
  let transport: StdioClientTransport;
  let projectId: number;

  beforeAll(async () => {
    const childEnv = Object.fromEntries(
      Object.entries(process.env).filter(([, v]) => v !== undefined)
    ) as Record<string, string>;

    transport = new StdioClientTransport({
      command: "node",
      args: ["dist/server.js"],
      env: childEnv,
    });
    client = new Client({ name: "vitest-client", version: "1.0.0" }, {});
    await client.connect(transport);

    const res = await callTool(client, "list_projects");
    const data = res.json<ListResponse<{ id: number }>>();
    projectId = data.result[0].id;
  });

  afterAll(async () => {
    await transport.close();
  });

  // ---------------------------------------------------------------------------
  // Smoke — basic connectivity and read operations
  // ---------------------------------------------------------------------------

  describe("smoke", () => {
    it("lists projects", async () => {
      const res = await callTool(client, "list_projects");
      expect(res.isError).toBe(false);
      const data = res.json<ListResponse<unknown>>();
      expect(Array.isArray(data.result)).toBe(true);
      expect(data.result.length).toBeGreaterThan(0);
    });

    it("gets a project by ID", async () => {
      const res = await callTool(client, "get_project", { id: projectId });
      expect(res.isError).toBe(false);
      const data = res.json<{ result: { id: number } }>();
      expect(data.result.id).toBe(projectId);
    });

    it("returns the authenticated user with email via get_user", async () => {
      // get_current_user returns a flat object with id and name but no email.
      // Fetch the full profile via get_user to also assert email.
      const currentRes = await callTool(client, "get_current_user");
      expect(currentRes.isError).toBe(false);
      const current = currentRes.json<{ id: number; name: string }>();
      expect(current.name).toBeTruthy();

      const userRes = await callTool(client, "get_user", { id: current.id });
      expect(userRes.isError).toBe(false);
      const user = userRes.json<{ result: { email: string; name: string } }>();
      expect(user.result.email).toBeTruthy();
      expect(user.result.name).toBe(current.name);
    });

    it("lists users", async () => {
      const res = await callTool(client, "list_users", { limit: 5 });
      expect(res.isError).toBe(false);
      const data = res.json<ListResponse<unknown>>();
      expect(Array.isArray(data.result)).toBe(true);
    });

    it("lists folders", async () => {
      const res = await callTool(client, "list_folders", { project_id: projectId });
      expect(res.isError).toBe(false);
    });

    it("lists test cases", async () => {
      const res = await callTool(client, "list_cases", { project_id: projectId, limit: 5 });
      expect(res.isError).toBe(false);
    });

    it("lists roles", async () => {
      const res = await callTool(client, "list_roles");
      expect(res.isError).toBe(false);
    });

    it("lists automation runs", async () => {
      const res = await callTool(client, "list_runs", { project_id: projectId });
      expect(res.isError).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling — withErrorRecovery returns isError, server does not crash
  // ---------------------------------------------------------------------------

  describe("error handling", () => {
    it("returns isError for a non-existent project (404)", async () => {
      const res = await callTool(client, "get_project", { id: 999_999_999 });
      expect(res.isError).toBe(true);
      expect(res.text).toMatch(/\b(404|not found)\b/i);
    });

    it("returns isError for a non-existent test case (404)", async () => {
      const res = await callTool(client, "get_case", { case_id: 999_999_999 });
      expect(res.isError).toBe(true);
    });

    it("server stays alive after an error — next call still works", async () => {
      await callTool(client, "get_project", { id: 999_999_999 });
      const res = await callTool(client, "list_projects");
      expect(res.isError).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Zod input validation — rejected before any API call (no network traffic)
  // ---------------------------------------------------------------------------

  describe("input validation", () => {
    it("rejects custom_priority outside 1–4", async () => {
      const res = await callTool(client, "create_case", {
        project_id: projectId,
        name: "should not reach API",
        custom_priority: 99,
      });
      expect(res.isError).toBe(true);
    });

    it("rejects case_ids array longer than 100", async () => {
      const ids = Array.from({ length: 101 }, (_, i) => i + 1);
      const res = await callTool(client, "delete_cases", {
        project_id: projectId,
        case_ids: ids,
      });
      expect(res.isError).toBe(true);
    });

    it("rejects folder_ids array longer than 100", async () => {
      const ids = Array.from({ length: 101 }, (_, i) => i + 1);
      const res = await callTool(client, "delete_folders", {
        project_id: projectId,
        folder_ids: ids,
      });
      expect(res.isError).toBe(true);
    });
  });
});
