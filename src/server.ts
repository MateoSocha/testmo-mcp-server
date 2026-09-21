import { createRequire } from "module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { TestmoClient } from "./client.js";
import { env } from "./env.js";

const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

const client = new TestmoClient(env.TESTMO_BASE_URL, env.TESTMO_ACCESS_TOKEN, version);
const server = new McpServer({ name: "testmo", version });

type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

function withErrorRecovery<T extends object>(
  name: string,
  fn: (args: T) => Promise<ToolResult>
): (args: T) => Promise<ToolResult> {
  return async (args) => {
    const t0 = Date.now();
    process.stderr.write(`[testmo] ${name} called\n`);
    try {
      const result = await fn(args);
      process.stderr.write(`[testmo] ${name} ok (${Date.now() - t0}ms)\n`);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[testmo] ${name} error: ${message}\n`);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  };
}

function json(result: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

// Real API pagination fields, confirmed against the OpenAPI spec's response envelope
// (page/prev_page/next_page/last_page/per_page/total/result/expands on every list endpoint).
// NOTE: `per_page` (not `limit`) is the documented query param name; kept here for all
// list tools for consistency even where a given endpoint's params aren't spelled out
// per-operation in the spec.
const paginationSchema = {
  page: z.number().int().positive().optional().describe("Page number"),
  per_page: z.number().int().positive().max(1000).optional().describe("Results per page"),
};

const artifactSchema = z.object({
  name: z.string().describe("Artifact name"),
  url: z.string().url().describe("Artifact URL"),
  note: z.string().optional().describe("Note"),
  mime_type: z.string().optional().describe("MIME type"),
  size: z.number().int().nonnegative().optional().describe("Size in bytes"),
});

const linkSchema = z.object({
  name: z.string().describe("Link name"),
  url: z.string().url().describe("Link URL"),
  note: z.string().optional().describe("Note"),
});

const fieldValueSchema = z.object({
  type: z.string().describe("Field type"),
  name: z.string().describe("Field name"),
  value: z.unknown().describe("Field value"),
});

// ── Projects ──────────────────────────────────────────────────────────────────

server.registerTool(
  "list_projects",
  {
    title: "List Projects",
    description: "List all projects in Testmo.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      is_completed: z.boolean().optional().describe("Filter by completed status"),
    },
  },
  withErrorRecovery("list_projects", async ({ is_completed }) => {
    const result = await client.listProjects({ is_completed });
    return json(result);
  })
);

server.registerTool(
  "get_project",
  {
    title: "Get Project",
    description: "Get details of a Testmo project by ID.",
    annotations: { readOnlyHint: true },
    inputSchema: { id: z.number().int().positive().describe("Project ID") },
  },
  withErrorRecovery("get_project", async ({ id }) => {
    const result = await client.getProject(id);
    return json(result);
  })
);

// ── Folders ───────────────────────────────────────────────────────────────────

server.registerTool(
  "list_folders",
  {
    title: "List Folders",
    description: "List folders in a Testmo project.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      parent_id: z.number().int().positive().optional().describe("Filter by parent folder ID"),
      name: z.string().optional().describe("Filter by folder name"),
      ...paginationSchema,
    },
  },
  withErrorRecovery("list_folders", async ({ project_id, parent_id, name, page, per_page }) => {
    const result = await client.listFolders(project_id, { page, per_page, parent_id, name });
    return json(result);
  })
);

server.registerTool(
  "get_folder",
  {
    title: "Get Folder",
    description: "Get details of a single repository folder by ID.",
    annotations: { readOnlyHint: true },
    inputSchema: { folder_id: z.number().int().positive().describe("Folder ID") },
  },
  withErrorRecovery("get_folder", async ({ folder_id }) => {
    const result = await client.getFolder(folder_id);
    return json(result);
  })
);

server.registerTool(
  "create_folders",
  {
    title: "Create Folders",
    description: "Create one or more folders in a Testmo project (up to 100).",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      folders: z
        .array(
          z.object({
            name: z.string().min(1).describe("Folder name"),
            parent_id: z.number().int().positive().optional().describe("Parent folder ID"),
            docs: z.string().optional().describe("Folder documentation/notes"),
            display_order: z.number().int().optional().describe("Display order"),
          })
        )
        .min(1)
        .max(100)
        .describe("Folders to create"),
    },
  },
  withErrorRecovery("create_folders", async ({ project_id, folders }) => {
    const result = await client.createFolders(project_id, folders);
    return json(result);
  })
);

server.registerTool(
  "update_folders",
  {
    title: "Update Folders",
    description: "Update one or more folders (each applied individually; up to 100 per call).",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      folders: z
        .array(
          z.object({
            id: z.number().int().positive().describe("Folder ID"),
            name: z.string().min(1).optional().describe("New folder name"),
            parent_id: z.number().int().positive().optional().describe("New parent folder ID"),
            docs: z.string().optional().describe("New folder documentation/notes"),
          })
        )
        .min(1)
        .max(100)
        .describe("Folders to update"),
    },
  },
  withErrorRecovery("update_folders", async ({ project_id, folders }) => {
    const result = await client.updateFolders(project_id, folders);
    return json(result);
  })
);

server.registerTool(
  "delete_folders",
  {
    title: "Delete Folders",
    description: "Delete one or more folders in bulk (up to 100).",
    annotations: { destructiveHint: true },
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      folder_ids: z
        .array(z.number().int().positive())
        .min(1)
        .max(100)
        .describe("Folder IDs to delete"),
    },
  },
  withErrorRecovery("delete_folders", async ({ project_id, folder_ids }) => {
    await client.deleteFolders(project_id, folder_ids);
    return { content: [{ type: "text", text: `Deleted ${folder_ids.length} folder(s).` }] };
  })
);

// ── Test Cases ────────────────────────────────────────────────────────────────
// NOTE: Testmo's REST API has no "get one case by ID" endpoint — case detail is only
// available through the project case listing (optionally filtered), so there is no
// get_case tool here. Use list_cases with folder_id/name filters instead.

server.registerTool(
  "list_cases",
  {
    title: "List Cases",
    description: "List test cases in a Testmo project (returns full case detail per row).",
    annotations: { readOnlyHint: true },
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      folder_id: z.number().int().positive().optional().describe("Filter by folder ID"),
      state_id: z.number().int().positive().optional().describe("Filter by state ID"),
      status_id: z.number().int().positive().optional().describe("Filter by status ID"),
      name: z.string().optional().describe("Filter by case name (substring match)"),
      tags: z.string().optional().describe("Filter by tags (comma-separated)"),
      recursive: z.boolean().optional().describe("Include cases in subfolders"),
      ...paginationSchema,
    },
  },
  withErrorRecovery(
    "list_cases",
    async ({
      project_id,
      folder_id,
      state_id,
      status_id,
      name,
      tags,
      recursive,
      page,
      per_page,
    }) => {
      const result = await client.listCases(project_id, {
        page,
        per_page,
        folder_id,
        state_id,
        status_id,
        name,
        tags,
        recursive,
      });
      return json(result);
    }
  )
);

server.registerTool(
  "get_case_names",
  {
    title: "Get Case Names",
    description: "Get a lightweight list of case IDs, names, and folder IDs for a project.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      per_page: z
        .number()
        .int()
        .min(100)
        .max(1000)
        .optional()
        .describe("Results per page (100-1000)"),
    },
  },
  withErrorRecovery("get_case_names", async ({ project_id, per_page }) => {
    const result = await client.getCaseNames(project_id, { per_page });
    return json(result);
  })
);

server.registerTool(
  "get_case_result_history",
  {
    title: "Get Case Result History",
    description: "Get the historical test result records for a specific test case.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      case_id: z.number().int().positive().describe("Test case ID"),
    },
  },
  withErrorRecovery("get_case_result_history", async ({ project_id, case_id }) => {
    const result = await client.getCaseResultHistory(project_id, case_id);
    return json(result);
  })
);

server.registerTool(
  "create_case",
  {
    title: "Create Case",
    description: "Create a new test case in a Testmo project.",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      name: z.string().min(1).describe("Test case name/title"),
      folder_id: z.number().int().positive().optional().describe("Folder ID"),
      template_id: z.number().int().positive().optional().describe("Template ID"),
      state_id: z.number().int().positive().optional().describe("State ID"),
      estimate: z.number().int().nonnegative().optional().describe("Time estimate in seconds"),
      tags: z.array(z.string()).optional().describe("Tags"),
      issues: z.array(z.number().int().positive()).optional().describe("Linked issue IDs"),
      automation_links: z
        .array(z.number().int().positive())
        .optional()
        .describe("Automation case IDs to link"),
      preconditions: z.string().optional().describe("Preconditions (plain field, per API spec)"),
      steps: z.string().optional().describe("Steps as plain text (plain field, per API spec)"),
      expected_result: z
        .string()
        .optional()
        .describe("Expected result (plain field, per API spec)"),
      custom_priority: z
        .number()
        .int()
        .min(1)
        .max(4)
        .optional()
        .describe("Priority (1=critical, 2=high, 3=medium, 4=low)"),
      custom_description: z.string().optional().describe("Test case description"),
      custom_preconditions: z.string().optional().describe("Preconditions (custom field)"),
      custom_expected: z.string().optional().describe("Expected result (custom field)"),
      custom_steps: z
        .array(
          z.object({
            text1: z.string().describe("Step description"),
            text3: z.string().optional().describe("Expected result for this step"),
          })
        )
        .optional()
        .describe("Test steps (custom field, structured)"),
    },
  },
  withErrorRecovery("create_case", async ({ project_id, ...fields }) => {
    const result = await client.createCase(project_id, fields);
    return json(result);
  })
);

server.registerTool(
  "update_cases",
  {
    title: "Update Cases",
    description:
      "Update one or more test cases in bulk — same values applied to all specified case IDs (up to 100).",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      ids: z.array(z.number().int().positive()).min(1).max(100).describe("Case IDs to update"),
      name: z.string().min(1).optional().describe("New title"),
      folder_id: z.number().int().positive().optional().describe("New folder ID"),
      state_id: z.number().int().positive().optional().describe("New state ID"),
      status_id: z.number().int().positive().optional().describe("New status ID"),
      estimate: z.number().int().nonnegative().optional().describe("Time estimate in seconds"),
      tags: z.array(z.string()).optional().describe("Tags (replaces existing)"),
      issues: z.array(z.number().int().positive()).optional().describe("Linked issue IDs"),
      automation_links: z
        .array(z.number().int().positive())
        .optional()
        .describe("Automation case IDs to link"),
      custom_priority: z
        .number()
        .int()
        .min(1)
        .max(4)
        .optional()
        .describe("Priority (1=critical, 2=high, 3=medium, 4=low)"),
      custom_description: z.string().optional().describe("Test case description"),
      custom_preconditions: z.string().optional().describe("Preconditions"),
      custom_expected: z.string().optional().describe("Expected result"),
      custom_steps: z
        .array(
          z.object({
            text1: z.string().describe("Step description"),
            text3: z.string().optional().describe("Expected result for this step"),
          })
        )
        .optional()
        .describe("Test steps (replaces existing)"),
    },
  },
  withErrorRecovery("update_cases", async ({ project_id, ...fields }) => {
    const result = await client.updateCases(project_id, fields);
    return json(result);
  })
);

server.registerTool(
  "delete_cases",
  {
    title: "Delete Cases",
    description: "Delete one or more test cases in bulk (up to 100).",
    annotations: { destructiveHint: true },
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      case_ids: z.array(z.number().int().positive()).min(1).max(100).describe("Case IDs to delete"),
    },
  },
  withErrorRecovery("delete_cases", async ({ project_id, case_ids }) => {
    await client.deleteCases(project_id, case_ids);
    return { content: [{ type: "text", text: `Deleted ${case_ids.length} case(s).` }] };
  })
);

// ── Attachments ───────────────────────────────────────────────────────────────

server.registerTool(
  "list_attachments",
  {
    title: "List Attachments",
    description: "List attachments for a test case.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      case_id: z.number().int().positive().describe("Test case ID"),
    },
  },
  withErrorRecovery("list_attachments", async ({ case_id }) => {
    const result = await client.listAttachments(case_id);
    return json(result);
  })
);

server.registerTool(
  "create_attachments",
  {
    title: "Create Attachments",
    description: "Upload one or more local files as attachments to a test case (up to 20).",
    inputSchema: {
      case_id: z.number().int().positive().describe("Test case ID"),
      file_paths: z
        .array(z.string().min(1))
        .min(1)
        .max(20)
        .describe("Absolute paths of local files to upload"),
    },
  },
  withErrorRecovery("create_attachments", async ({ case_id, file_paths }) => {
    const result = await client.createAttachments(case_id, file_paths);
    return json(result);
  })
);

server.registerTool(
  "create_attachment_single",
  {
    title: "Create Single Attachment",
    description: "Upload a single local file as an attachment to a test case.",
    inputSchema: {
      case_id: z.number().int().positive().describe("Test case ID"),
      file_path: z.string().min(1).describe("Absolute path of the local file to upload"),
    },
  },
  withErrorRecovery("create_attachment_single", async ({ case_id, file_path }) => {
    const result = await client.createAttachmentSingle(case_id, file_path);
    return json(result);
  })
);

server.registerTool(
  "delete_attachments",
  {
    title: "Delete Attachments",
    description: "Delete one or more attachments from a test case (up to 100).",
    annotations: { destructiveHint: true },
    inputSchema: {
      case_id: z.number().int().positive().describe("Test case ID"),
      attachment_ids: z
        .array(z.number().int().positive())
        .min(1)
        .max(100)
        .describe("Attachment IDs to delete"),
    },
  },
  withErrorRecovery("delete_attachments", async ({ case_id, attachment_ids }) => {
    await client.deleteAttachments(case_id, attachment_ids);
    return { content: [{ type: "text", text: `Deleted ${attachment_ids.length} attachment(s).` }] };
  })
);

// ── Automation Runs ───────────────────────────────────────────────────────────

server.registerTool(
  "list_runs",
  {
    title: "List Automation Runs",
    description: "List automation runs in a Testmo project.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      status: z
        .number()
        .int()
        .min(0)
        .max(2)
        .optional()
        .describe("Filter by status: 0=open, 1=complete, 2=aborted"),
      source_id: z.number().int().positive().optional().describe("Filter by automation source ID"),
      name: z.string().optional().describe("Filter by run name"),
      ...paginationSchema,
    },
  },
  withErrorRecovery(
    "list_runs",
    async ({ project_id, page, per_page, status, source_id, name }) => {
      const result = await client.listRuns(project_id, { page, per_page, status, source_id, name });
      return json(result);
    }
  )
);

server.registerTool(
  "get_automation_run",
  {
    title: "Get Automation Run",
    description: "Get details of a single automation run by ID.",
    annotations: { readOnlyHint: true },
    inputSchema: { run_id: z.number().int().positive().describe("Automation run ID") },
  },
  withErrorRecovery("get_automation_run", async ({ run_id }) => {
    const result = await client.getAutomationRun(run_id);
    return json(result);
  })
);

server.registerTool(
  "get_automation_run_tests",
  {
    title: "Get Automation Run Tests",
    description: "List all tests recorded in an automation run, optionally filtered by thread.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      run_id: z.number().int().positive().describe("Automation run ID"),
      thread_id: z.number().int().positive().optional().describe("Filter by thread ID"),
      status_id: z.string().optional().describe("Filter by status ID"),
      per_page: z
        .number()
        .int()
        .min(100)
        .max(1000)
        .optional()
        .describe("Results per page (100-1000)"),
    },
  },
  withErrorRecovery(
    "get_automation_run_tests",
    async ({ run_id, thread_id, status_id, per_page }) => {
      const result = await client.getAutomationRunTests(run_id, { per_page, thread_id, status_id });
      return json(result);
    }
  )
);

server.registerTool(
  "create_run",
  {
    title: "Create Run",
    description: "Create a new automation run in a Testmo project.",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      name: z.string().min(1).describe("Run name"),
      source: z.string().min(1).describe("Source identifier (e.g. CI pipeline name)"),
      milestone_id: z.number().int().positive().optional().describe("Milestone ID"),
      config_id: z.number().int().positive().optional().describe("Configuration ID"),
      tags: z.array(z.string()).optional().describe("Tags"),
    },
  },
  withErrorRecovery("create_run", async ({ project_id, ...fields }) => {
    const result = await client.createRun(project_id, fields);
    return json(result);
  })
);

server.registerTool(
  "complete_run",
  {
    title: "Complete Run",
    description: "Mark an automation run as complete.",
    inputSchema: {
      run_id: z.number().int().positive().describe("Run ID to complete"),
      measure_elapsed: z
        .boolean()
        .optional()
        .describe("Whether Testmo should compute elapsed time from thread activity"),
    },
  },
  withErrorRecovery("complete_run", async ({ run_id, measure_elapsed }) => {
    await client.completeRun(run_id, measure_elapsed);
    return { content: [{ type: "text", text: `Run ${run_id} marked as complete.` }] };
  })
);

server.registerTool(
  "create_run_thread",
  {
    title: "Create Run Thread",
    description: "Create a thread inside an automation run.",
    inputSchema: {
      run_id: z.number().int().positive().describe("Automation run ID"),
      elapsed_observed: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe("Observed elapsed time (ms)"),
    },
  },
  withErrorRecovery("create_run_thread", async ({ run_id, elapsed_observed }) => {
    const result = await client.createRunThread(run_id, { elapsed_observed });
    return json(result);
  })
);

server.registerTool(
  "append_to_run",
  {
    title: "Append to Run",
    description: "Append artifacts, links, or custom fields to an automation run.",
    inputSchema: {
      run_id: z.number().int().positive().describe("Run ID"),
      artifacts: z.array(artifactSchema).optional().describe("Artifacts to append"),
      links: z.array(linkSchema).optional().describe("Links to append"),
      fields: z.array(fieldValueSchema).optional().describe("Custom fields to append"),
    },
  },
  withErrorRecovery("append_to_run", async ({ run_id, artifacts, links, fields }) => {
    await client.appendToRun(run_id, { artifacts, links, fields });
    return { content: [{ type: "text", text: `Appended data to run ${run_id}.` }] };
  })
);

server.registerTool(
  "append_to_run_thread",
  {
    title: "Append to Run Thread",
    description: "Append artifacts or custom fields to a specific automation run thread.",
    inputSchema: {
      thread_id: z.number().int().positive().describe("Automation run thread ID"),
      artifacts: z.array(artifactSchema).optional().describe("Artifacts to append"),
      fields: z.array(fieldValueSchema).optional().describe("Custom fields to append"),
      elapsed_observed: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe("Observed elapsed time (ms)"),
    },
  },
  withErrorRecovery(
    "append_to_run_thread",
    async ({ thread_id, artifacts, fields, elapsed_observed }) => {
      await client.appendToRunThread(thread_id, { artifacts, fields, elapsed_observed });
      return { content: [{ type: "text", text: `Appended data to thread ${thread_id}.` }] };
    }
  )
);

server.registerTool(
  "complete_run_thread",
  {
    title: "Complete Run Thread",
    description: "Mark a specific automation run thread as complete.",
    inputSchema: {
      thread_id: z.number().int().positive().describe("Automation run thread ID to complete"),
      elapsed_observed: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe("Observed elapsed time (ms)"),
    },
  },
  withErrorRecovery("complete_run_thread", async ({ thread_id, elapsed_observed }) => {
    await client.completeRunThread(thread_id, { elapsed_observed });
    return { content: [{ type: "text", text: `Thread ${thread_id} marked as complete.` }] };
  })
);

// ── Automation Cases & Links ──────────────────────────────────────────────────

server.registerTool(
  "get_automation_cases",
  {
    title: "Get Automation Cases",
    description: "List automation cases (tests discovered from automation runs) for a project.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      source_id: z.number().int().positive().optional().describe("Filter by automation source ID"),
      status: z.string().optional().describe("Filter by status"),
      name: z.string().optional().describe("Filter by automation case name"),
    },
  },
  withErrorRecovery("get_automation_cases", async ({ project_id, source_id, status, name }) => {
    const result = await client.getAutomationCases(project_id, { source_id, status, name });
    return json(result);
  })
);

server.registerTool(
  "create_automation_link",
  {
    title: "Create Automation Link",
    description: "Link a single automation case to a repository test case.",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      case_id: z.number().int().positive().describe("Repository test case ID"),
      automation_case_id: z.number().int().positive().describe("Automation case ID"),
    },
  },
  withErrorRecovery(
    "create_automation_link",
    async ({ project_id, case_id, automation_case_id }) => {
      await client.createAutomationLink(project_id, case_id, automation_case_id);
      return {
        content: [
          {
            type: "text",
            text: `Linked automation case ${automation_case_id} to case ${case_id}.`,
          },
        ],
      };
    }
  )
);

server.registerTool(
  "create_automation_links_bulk",
  {
    title: "Create Automation Links (Bulk)",
    description: "Link multiple automation cases to repository test cases in one call (up to 500).",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      links: z
        .array(
          z.object({
            case_id: z.number().int().positive().describe("Repository test case ID"),
            automation_case_id: z.number().int().positive().describe("Automation case ID"),
          })
        )
        .min(1)
        .max(500)
        .describe("Links to create"),
    },
  },
  withErrorRecovery("create_automation_links_bulk", async ({ project_id, links }) => {
    await client.createAutomationLinksBulk(project_id, links);
    return { content: [{ type: "text", text: `Created ${links.length} automation link(s).` }] };
  })
);

// ── Manual Test Runs ──────────────────────────────────────────────────────────

server.registerTool(
  "list_test_runs",
  {
    title: "List Test Runs",
    description: "List manual test runs in a Testmo project.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      is_closed: z.boolean().optional().describe("Filter by closed status"),
      milestone_id: z.number().int().positive().optional().describe("Filter by milestone ID"),
      name: z.string().optional().describe("Filter by run name"),
      ...paginationSchema,
    },
  },
  withErrorRecovery(
    "list_test_runs",
    async ({ project_id, is_closed, milestone_id, name, page, per_page }) => {
      const result = await client.listTestRuns(project_id, {
        page,
        per_page,
        is_closed,
        milestone_id,
        name,
      });
      return json(result);
    }
  )
);

server.registerTool(
  "create_test_run",
  {
    title: "Create Test Run",
    description: "Create a new manual test run in a Testmo project.",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      name: z.string().min(1).describe("Run name"),
      milestone_id: z.number().int().positive().optional().describe("Milestone ID"),
      case_ids: z.array(z.number().int().positive()).optional().describe("Case IDs to include"),
      include_all: z.boolean().optional().describe("Include all cases in the project"),
      tags: z.array(z.string()).optional().describe("Tags"),
      assignee_id: z.number().int().positive().optional().describe("Assignee user ID"),
      config_id: z.number().int().positive().optional().describe("Configuration ID"),
    },
  },
  withErrorRecovery("create_test_run", async ({ project_id, ...fields }) => {
    const result = await client.createTestRun(project_id, fields);
    return json(result);
  })
);

server.registerTool(
  "get_test_run",
  {
    title: "Get Test Run",
    description: "Get details of a single manual test run by ID.",
    annotations: { readOnlyHint: true },
    inputSchema: { run_id: z.number().int().positive().describe("Test run ID") },
  },
  withErrorRecovery("get_test_run", async ({ run_id }) => {
    const result = await client.getTestRun(run_id);
    return json(result);
  })
);

server.registerTool(
  "update_test_run",
  {
    title: "Update Test Run",
    description: "Update a manual test run.",
    inputSchema: {
      run_id: z.number().int().positive().describe("Test run ID"),
      name: z.string().min(1).optional().describe("New name"),
      milestone_id: z.number().int().positive().optional().describe("New milestone ID"),
      state_id: z.number().int().positive().optional().describe("New state ID"),
      is_closed: z.boolean().optional().describe("Close or reopen the run"),
      config_id: z.number().int().positive().optional().describe("New configuration ID"),
    },
  },
  withErrorRecovery("update_test_run", async ({ run_id, ...fields }) => {
    const result = await client.updateTestRun(run_id, fields);
    return json(result);
  })
);

server.registerTool(
  "delete_test_run",
  {
    title: "Delete Test Run",
    description: "Delete a manual test run.",
    annotations: { destructiveHint: true },
    inputSchema: { run_id: z.number().int().positive().describe("Test run ID to delete") },
  },
  withErrorRecovery("delete_test_run", async ({ run_id }) => {
    await client.deleteTestRun(run_id);
    return { content: [{ type: "text", text: `Deleted test run ${run_id}.` }] };
  })
);

// ── Run Results (manual test runs) ────────────────────────────────────────────

server.registerTool(
  "get_run_results",
  {
    title: "Get Run Results",
    description: "Get test results for a manual test run.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      run_id: z.number().int().positive().describe("Test run ID"),
      status_id: z.string().optional().describe("Filter by status ID"),
      assignee_id: z.number().int().positive().optional().describe("Filter by assignee user ID"),
      get_latest_result: z.boolean().optional().describe("Only return the latest result per test"),
    },
  },
  withErrorRecovery(
    "get_run_results",
    async ({ run_id, status_id, assignee_id, get_latest_result }) => {
      const result = await client.getRunResults(run_id, {
        status_id,
        assignee_id,
        get_latest_result,
      });
      return json(result);
    }
  )
);

server.registerTool(
  "create_run_result",
  {
    title: "Create Run Result",
    description: "Record a test result for a single test within a manual test run.",
    inputSchema: {
      run_id: z.number().int().positive().describe("Test run ID"),
      test_id: z.number().int().positive().describe("Test ID within the run"),
      status_id: z.number().int().positive().describe("Result status ID"),
      comment: z.string().optional().describe("Comment"),
      elapsed: z.number().int().nonnegative().optional().describe("Elapsed time in seconds"),
      assignee_id: z.number().int().positive().optional().describe("Assignee user ID"),
    },
  },
  withErrorRecovery("create_run_result", async ({ run_id, test_id, ...fields }) => {
    const result = await client.createRunResult(run_id, test_id, fields);
    return json(result);
  })
);

server.registerTool(
  "create_run_results_bulk",
  {
    title: "Create Run Results (Bulk)",
    description:
      "Record test results for multiple tests within a manual test run at once (up to 100).",
    inputSchema: {
      run_id: z.number().int().positive().describe("Test run ID"),
      results: z
        .array(
          z.object({
            test_id: z.number().int().positive().describe("Test ID within the run"),
            status_id: z.number().int().positive().describe("Result status ID"),
            comment: z.string().optional().describe("Comment"),
            elapsed: z.number().int().nonnegative().optional().describe("Elapsed time in seconds"),
            assignee_id: z.number().int().positive().optional().describe("Assignee user ID"),
          })
        )
        .min(1)
        .max(100)
        .describe("Results to create"),
    },
  },
  withErrorRecovery("create_run_results_bulk", async ({ run_id, results }) => {
    const result = await client.createRunResultsBulk(run_id, results);
    return json(result);
  })
);

server.registerTool(
  "update_run_result",
  {
    title: "Update Run Result",
    description: "Update a single existing test result.",
    inputSchema: {
      run_id: z.number().int().positive().describe("Test run ID"),
      result_id: z.number().int().positive().describe("Result ID"),
      status_id: z.number().int().positive().optional().describe("New status ID"),
      comment: z.string().optional().describe("New comment"),
      elapsed: z.number().int().nonnegative().optional().describe("Elapsed time in seconds"),
      assignee_id: z.number().int().positive().optional().describe("New assignee user ID"),
    },
  },
  withErrorRecovery("update_run_result", async ({ run_id, result_id, ...fields }) => {
    const result = await client.updateRunResult(run_id, result_id, fields);
    return json(result);
  })
);

// ── Sessions ──────────────────────────────────────────────────────────────────

server.registerTool(
  "list_sessions",
  {
    title: "List Sessions",
    description: "List exploratory test sessions in a Testmo project.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      is_closed: z.boolean().optional().describe("Filter by closed status"),
      assignee_id: z.number().int().positive().optional().describe("Filter by assignee user ID"),
      name: z.string().optional().describe("Filter by session name"),
      ...paginationSchema,
    },
  },
  withErrorRecovery(
    "list_sessions",
    async ({ project_id, is_closed, assignee_id, name, page, per_page }) => {
      const result = await client.listSessions(project_id, {
        page,
        per_page,
        is_closed,
        assignee_id,
        name,
      });
      return json(result);
    }
  )
);

server.registerTool(
  "get_session",
  {
    title: "Get Session",
    description: "Get details of a single exploratory test session by ID.",
    annotations: { readOnlyHint: true },
    inputSchema: { session_id: z.number().int().positive().describe("Session ID") },
  },
  withErrorRecovery("get_session", async ({ session_id }) => {
    const result = await client.getSession(session_id);
    return json(result);
  })
);

server.registerTool(
  "create_session",
  {
    title: "Create Session",
    description: "Create a new exploratory test session in a Testmo project.",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      name: z.string().min(1).describe("Session name"),
      session_type_id: z.number().int().positive().optional().describe("Session type ID"),
      milestone_id: z.number().int().positive().optional().describe("Milestone ID"),
      assignee_id: z.number().int().positive().optional().describe("Assignee user ID"),
      config_id: z.number().int().positive().optional().describe("Configuration ID"),
      estimate: z.string().optional().describe("Time estimate (e.g. '2h')"),
      tags: z.array(z.string()).optional().describe("Tags"),
    },
  },
  withErrorRecovery("create_session", async ({ project_id, ...fields }) => {
    const result = await client.createSession(project_id, fields);
    return json(result);
  })
);

server.registerTool(
  "update_session",
  {
    title: "Update Session",
    description: "Update an exploratory test session.",
    inputSchema: {
      session_id: z.number().int().positive().describe("Session ID"),
      name: z.string().min(1).optional().describe("New name"),
      session_type_id: z.number().int().positive().optional().describe("New session type ID"),
      milestone_id: z.number().int().positive().optional().describe("New milestone ID"),
      assignee_id: z.number().int().positive().optional().describe("New assignee user ID"),
      config_id: z.number().int().positive().optional().describe("New configuration ID"),
      estimate: z.string().optional().describe("New time estimate"),
      is_closed: z.boolean().optional().describe("Close or reopen the session"),
      tags: z.array(z.string()).optional().describe("Tags (replaces existing)"),
    },
  },
  withErrorRecovery("update_session", async ({ session_id, ...fields }) => {
    const result = await client.updateSession(session_id, fields);
    return json(result);
  })
);

server.registerTool(
  "delete_session",
  {
    title: "Delete Session",
    description: "Delete an exploratory test session.",
    annotations: { destructiveHint: true },
    inputSchema: { session_id: z.number().int().positive().describe("Session ID to delete") },
  },
  withErrorRecovery("delete_session", async ({ session_id }) => {
    await client.deleteSession(session_id);
    return { content: [{ type: "text", text: `Deleted session ${session_id}.` }] };
  })
);

// ── Automation Sources ────────────────────────────────────────────────────────

server.registerTool(
  "list_automation_sources",
  {
    title: "List Automation Sources",
    description: "List automation sources in a Testmo project.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      is_retired: z.boolean().optional().describe("Filter by retired status"),
    },
  },
  withErrorRecovery("list_automation_sources", async ({ project_id, is_retired }) => {
    const result = await client.listAutomationSources(project_id, { is_retired });
    return json(result);
  })
);

server.registerTool(
  "get_automation_source",
  {
    title: "Get Automation Source",
    description: "Get details of a specific automation source.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      id: z.number().int().positive().describe("Automation source ID"),
    },
  },
  withErrorRecovery("get_automation_source", async ({ id }) => {
    const result = await client.getAutomationSource(id);
    return json(result);
  })
);

// ── Milestones ────────────────────────────────────────────────────────────────

server.registerTool(
  "list_milestones",
  {
    title: "List Milestones",
    description: "List milestones in a Testmo project.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      is_completed: z.boolean().optional().describe("Filter by completed status"),
      parent_id: z.number().int().positive().optional().describe("Filter by parent milestone ID"),
      name: z.string().optional().describe("Filter by milestone name"),
      ...paginationSchema,
    },
  },
  withErrorRecovery(
    "list_milestones",
    async ({ project_id, is_completed, parent_id, name, page, per_page }) => {
      const result = await client.listMilestones(project_id, {
        page,
        per_page,
        is_completed,
        parent_id,
        name,
      });
      return json(result);
    }
  )
);

server.registerTool(
  "get_milestone",
  {
    title: "Get Milestone",
    description: "Get details of a specific milestone.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      milestone_id: z.number().int().positive().describe("Milestone ID"),
    },
  },
  withErrorRecovery("get_milestone", async ({ milestone_id }) => {
    const result = await client.getMilestone(milestone_id);
    return json(result);
  })
);

server.registerTool(
  "create_milestone",
  {
    title: "Create Milestone",
    description: "Create a new milestone in a Testmo project.",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      name: z.string().min(1).describe("Milestone name"),
      type_id: z.number().int().positive().optional().describe("Milestone type ID"),
      note: z.string().optional().describe("Note"),
      start_date: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      due_date: z.string().optional().describe("Due date (YYYY-MM-DD)"),
      parent_id: z.number().int().positive().optional().describe("Parent milestone ID"),
    },
  },
  withErrorRecovery("create_milestone", async ({ project_id, ...fields }) => {
    const result = await client.createMilestone(project_id, fields);
    return json(result);
  })
);

server.registerTool(
  "update_milestone",
  {
    title: "Update Milestone",
    description: "Update a milestone.",
    inputSchema: {
      milestone_id: z.number().int().positive().describe("Milestone ID"),
      name: z.string().min(1).optional().describe("New name"),
      type_id: z.number().int().positive().optional().describe("New milestone type ID"),
      note: z.string().optional().describe("New note"),
      start_date: z.string().optional().describe("New start date (YYYY-MM-DD)"),
      due_date: z.string().optional().describe("New due date (YYYY-MM-DD)"),
      is_started: z.boolean().optional().describe("Mark as started/not started"),
      is_completed: z.boolean().optional().describe("Mark as completed/not completed"),
    },
  },
  withErrorRecovery("update_milestone", async ({ milestone_id, ...fields }) => {
    const result = await client.updateMilestone(milestone_id, fields);
    return json(result);
  })
);

server.registerTool(
  "delete_milestone",
  {
    title: "Delete Milestone",
    description: "Delete a milestone.",
    annotations: { destructiveHint: true },
    inputSchema: { milestone_id: z.number().int().positive().describe("Milestone ID to delete") },
  },
  withErrorRecovery("delete_milestone", async ({ milestone_id }) => {
    await client.deleteMilestone(milestone_id);
    return { content: [{ type: "text", text: `Deleted milestone ${milestone_id}.` }] };
  })
);

server.registerTool(
  "get_milestone_types",
  {
    title: "Get Milestone Types",
    description: "List the available milestone types for a project.",
    annotations: { readOnlyHint: true },
    inputSchema: { project_id: z.number().int().positive().describe("Project ID") },
  },
  withErrorRecovery("get_milestone_types", async ({ project_id }) => {
    const result = await client.getMilestoneTypes(project_id);
    return json(result);
  })
);

// ── Project reference data ────────────────────────────────────────────────────

server.registerTool(
  "get_project_configs",
  {
    title: "Get Project Configurations",
    description: "List the configurations (e.g. environments/browsers) defined for a project.",
    annotations: { readOnlyHint: true },
    inputSchema: { project_id: z.number().int().positive().describe("Project ID") },
  },
  withErrorRecovery("get_project_configs", async ({ project_id }) => {
    const result = await client.getProjectConfigs(project_id);
    return json(result);
  })
);

server.registerTool(
  "get_fields",
  {
    title: "Get Fields",
    description: "List custom fields defined for a project, optionally filtered by entity type.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      entity: z
        .enum(["repository_case", "session", "run_result"])
        .optional()
        .describe("Filter by entity type"),
    },
  },
  withErrorRecovery("get_fields", async ({ project_id, entity }) => {
    const result = await client.getFields(project_id, entity);
    return json(result);
  })
);

server.registerTool(
  "get_project_repos",
  {
    title: "Get Project Repositories",
    description: "List the test case repositories for a project.",
    annotations: { readOnlyHint: true },
    inputSchema: { project_id: z.number().int().positive().describe("Project ID") },
  },
  withErrorRecovery("get_project_repos", async ({ project_id }) => {
    const result = await client.getProjectRepos(project_id);
    return json(result);
  })
);

server.registerTool(
  "get_project_states",
  {
    title: "Get Project States",
    description: "List the workflow states (e.g. draft/active/deprecated) defined for a project.",
    annotations: { readOnlyHint: true },
    inputSchema: { project_id: z.number().int().positive().describe("Project ID") },
  },
  withErrorRecovery("get_project_states", async ({ project_id }) => {
    const result = await client.getProjectStates(project_id);
    return json(result);
  })
);

server.registerTool(
  "get_project_statuses",
  {
    title: "Get Project Statuses",
    description:
      "List the test result statuses (e.g. passed/failed/blocked) defined for a project.",
    annotations: { readOnlyHint: true },
    inputSchema: { project_id: z.number().int().positive().describe("Project ID") },
  },
  withErrorRecovery("get_project_statuses", async ({ project_id }) => {
    const result = await client.getProjectStatuses(project_id);
    return json(result);
  })
);

server.registerTool(
  "get_project_tags",
  {
    title: "Get Project Tags",
    description: "List all tags used in a project, with usage counts.",
    annotations: { readOnlyHint: true },
    inputSchema: { project_id: z.number().int().positive().describe("Project ID") },
  },
  withErrorRecovery("get_project_tags", async ({ project_id }) => {
    const result = await client.getProjectTags(project_id);
    return json(result);
  })
);

server.registerTool(
  "get_project_templates",
  {
    title: "Get Project Templates",
    description: "List the test case templates defined for a project.",
    annotations: { readOnlyHint: true },
    inputSchema: { project_id: z.number().int().positive().describe("Project ID") },
  },
  withErrorRecovery("get_project_templates", async ({ project_id }) => {
    const result = await client.getProjectTemplates(project_id);
    return json(result);
  })
);

server.registerTool(
  "get_project_users",
  {
    title: "Get Project Users",
    description: "List the users who are members of a project.",
    annotations: { readOnlyHint: true },
    inputSchema: { project_id: z.number().int().positive().describe("Project ID") },
  },
  withErrorRecovery("get_project_users", async ({ project_id }) => {
    const result = await client.getProjectUsers(project_id);
    return json(result);
  })
);

// ── Issues ────────────────────────────────────────────────────────────────────

server.registerTool(
  "get_issue_connections",
  {
    title: "Get Issue Connections",
    description: "List configured issue-tracker connections (e.g. Jira projects linked to Testmo).",
    annotations: { readOnlyHint: true },
    inputSchema: {
      integration_name: z.string().optional().describe("Filter by integration name (e.g. 'jira')"),
      connection_project_id: z.string().optional().describe("Filter by connected project ID"),
      is_active: z.boolean().optional().describe("Filter by active status"),
    },
  },
  withErrorRecovery(
    "get_issue_connections",
    async ({ integration_name, connection_project_id, is_active }) => {
      const result = await client.getIssueConnections({
        integration_name,
        connection_project_id,
        is_active,
      });
      return json(result);
    }
  )
);

// ── Users ─────────────────────────────────────────────────────────────────────

server.registerTool(
  "get_current_user",
  {
    title: "Get Current User",
    description: "Get the currently authenticated Testmo user.",
    annotations: { readOnlyHint: true },
    inputSchema: {},
  },
  withErrorRecovery("get_current_user", async () => {
    const result = await client.getCurrentUser();
    return json(result);
  })
);

server.registerTool(
  "list_users",
  {
    title: "List Users",
    description: "List all users in the Testmo workspace.",
    annotations: { readOnlyHint: true },
    inputSchema: { ...paginationSchema },
  },
  withErrorRecovery("list_users", async ({ page, per_page }) => {
    const result = await client.listUsers({ page, per_page });
    return json(result);
  })
);

server.registerTool(
  "get_user",
  {
    title: "Get User",
    description: "Get details of a specific Testmo user.",
    annotations: { readOnlyHint: true },
    inputSchema: { id: z.number().int().positive().describe("User ID") },
  },
  withErrorRecovery("get_user", async ({ id }) => {
    const result = await client.getUser(id);
    return json(result);
  })
);

// ── Groups ────────────────────────────────────────────────────────────────────

server.registerTool(
  "list_groups",
  {
    title: "List Groups",
    description: "List all user groups in the Testmo workspace (admin only).",
    annotations: { readOnlyHint: true },
    inputSchema: {},
  },
  withErrorRecovery("list_groups", async () => {
    const result = await client.listGroups();
    return json(result);
  })
);

server.registerTool(
  "get_group",
  {
    title: "Get Group",
    description: "Get details of a specific user group (admin only).",
    annotations: { readOnlyHint: true },
    inputSchema: { id: z.number().int().positive().describe("Group ID") },
  },
  withErrorRecovery("get_group", async ({ id }) => {
    const result = await client.getGroup(id);
    return json(result);
  })
);

// ── Roles ─────────────────────────────────────────────────────────────────────

server.registerTool(
  "list_roles",
  {
    title: "List Roles",
    description: "List all user roles in the Testmo workspace (admin only).",
    annotations: { readOnlyHint: true },
    inputSchema: {},
  },
  withErrorRecovery("list_roles", async () => {
    const result = await client.listRoles();
    return json(result);
  })
);

server.registerTool(
  "get_role",
  {
    title: "Get Role",
    description: "Get details of a specific user role (admin only).",
    annotations: { readOnlyHint: true },
    inputSchema: { id: z.number().int().positive().describe("Role ID") },
  },
  withErrorRecovery("get_role", async ({ id }) => {
    const result = await client.getRole(id);
    return json(result);
  })
);

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
