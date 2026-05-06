import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { TestmoClient } from "./client.js";

const baseUrl = process.env.TESTMO_BASE_URL;
const token = process.env.TESTMO_ACCESS_TOKEN;

if (!baseUrl || !token) {
  process.stderr.write(
    "Error: TESTMO_BASE_URL and TESTMO_ACCESS_TOKEN environment variables are required.\n"
  );
  process.exit(1);
}

const client = new TestmoClient(baseUrl, token);
const server = new McpServer({ name: "testmo", version: "2.0.0" });

const paginationSchema = {
  page: z.number().int().positive().optional().describe("Page number"),
  limit: z.number().int().positive().max(100).optional().describe("Results per page (max 100)"),
};

// ── Projects ──────────────────────────────────────────────────────────────────

server.registerTool(
  "list_projects",
  { description: "List all projects in Testmo.", inputSchema: {} },
  async () => {
    const result = await client.listProjects();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "get_project",
  {
    description: "Get details of a Testmo project by ID.",
    inputSchema: { id: z.number().int().positive().describe("Project ID") },
  },
  async ({ id }) => {
    const result = await client.getProject(id);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Folders ───────────────────────────────────────────────────────────────────

server.registerTool(
  "list_folders",
  {
    description: "List folders in a Testmo project.",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      ...paginationSchema,
    },
  },
  async ({ project_id, page, limit }) => {
    const result = await client.listFolders(project_id, { page, limit });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "create_folders",
  {
    description: "Create one or more folders in a Testmo project (up to 100).",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      folders: z.array(z.object({
        name: z.string().min(1).describe("Folder name"),
        parent_id: z.number().int().positive().optional().describe("Parent folder ID"),
      })).min(1).max(100).describe("Folders to create"),
    },
  },
  async ({ project_id, folders }) => {
    const result = await client.createFolders(project_id, folders);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "update_folders",
  {
    description: "Update one or more folders in bulk (up to 100).",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      folders: z.array(z.object({
        id: z.number().int().positive().describe("Folder ID"),
        name: z.string().min(1).optional().describe("New folder name"),
        parent_id: z.number().int().positive().optional().describe("New parent folder ID"),
      })).min(1).max(100).describe("Folders to update"),
    },
  },
  async ({ project_id, folders }) => {
    const result = await client.updateFolders(project_id, folders);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "delete_folders",
  {
    description: "Delete one or more folders in bulk (up to 100).",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      folder_ids: z.array(z.number().int().positive()).min(1).max(100).describe("Folder IDs to delete"),
    },
  },
  async ({ project_id, folder_ids }) => {
    await client.deleteFolders(project_id, folder_ids);
    return { content: [{ type: "text", text: `Deleted ${folder_ids.length} folder(s).` }] };
  }
);

// ── Test Cases ────────────────────────────────────────────────────────────────

server.registerTool(
  "list_cases",
  {
    description: "List test cases in a Testmo project.",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      folder_id: z.number().int().positive().optional().describe("Filter by folder ID"),
      ...paginationSchema,
    },
  },
  async ({ project_id, page, limit, folder_id }) => {
    const result = await client.listCases(project_id, { page, limit, folder_id });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "get_case",
  {
    description: "Get details of a specific test case.",
    inputSchema: {
      case_id: z.number().int().positive().describe("Test case ID"),
    },
  },
  async ({ case_id }) => {
    const result = await client.getCase(case_id);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "create_case",
  {
    description: "Create a new test case in a Testmo project.",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      name: z.string().min(1).describe("Test case name/title"),
      folder_id: z.number().int().positive().optional().describe("Folder ID"),
      state_id: z.number().int().positive().optional().describe("State ID"),
      estimate: z.number().int().nonnegative().optional().describe("Time estimate in seconds"),
      tags: z.array(z.string()).optional().describe("Tags"),
      issues: z.array(z.number().int().positive()).optional().describe("Linked issue IDs"),
      custom_priority: z.number().int().min(1).max(4).optional().describe("Priority (1=critical, 2=high, 3=medium, 4=low)"),
      custom_description: z.string().optional().describe("Test case description"),
      custom_preconditions: z.string().optional().describe("Preconditions"),
      custom_expected: z.string().optional().describe("Expected result"),
      custom_steps: z.array(z.object({
        text1: z.string().describe("Step description"),
        text3: z.string().optional().describe("Expected result for this step"),
      })).optional().describe("Test steps"),
    },
  },
  async ({ project_id, ...fields }) => {
    const result = await client.createCase(project_id, fields);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "update_cases",
  {
    description: "Update one or more test cases in bulk — same values applied to all specified case IDs (up to 100).",
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
      custom_priority: z.number().int().min(1).max(4).optional().describe("Priority (1=critical, 2=high, 3=medium, 4=low)"),
      custom_description: z.string().optional().describe("Test case description"),
      custom_preconditions: z.string().optional().describe("Preconditions"),
      custom_expected: z.string().optional().describe("Expected result"),
      custom_steps: z.array(z.object({
        text1: z.string().describe("Step description"),
        text3: z.string().optional().describe("Expected result for this step"),
      })).optional().describe("Test steps (replaces existing)"),
    },
  },
  async ({ project_id, ...fields }) => {
    const result = await client.updateCases(project_id, fields);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "delete_cases",
  {
    description: "Delete one or more test cases in bulk (up to 100).",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      case_ids: z.array(z.number().int().positive()).min(1).max(100).describe("Case IDs to delete"),
    },
  },
  async ({ project_id, case_ids }) => {
    await client.deleteCases(project_id, case_ids);
    return { content: [{ type: "text", text: `Deleted ${case_ids.length} case(s).` }] };
  }
);

// ── Attachments ───────────────────────────────────────────────────────────────

server.registerTool(
  "list_attachments",
  {
    description: "List attachments for a test case.",
    inputSchema: {
      case_id: z.number().int().positive().describe("Test case ID"),
    },
  },
  async ({ case_id }) => {
    const result = await client.listAttachments(case_id);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "delete_attachments",
  {
    description: "Delete one or more attachments from a test case (up to 100).",
    inputSchema: {
      case_id: z.number().int().positive().describe("Test case ID"),
      attachment_ids: z.array(z.number().int().positive()).min(1).max(100).describe("Attachment IDs to delete"),
    },
  },
  async ({ case_id, attachment_ids }) => {
    await client.deleteAttachments(case_id, attachment_ids);
    return { content: [{ type: "text", text: `Deleted ${attachment_ids.length} attachment(s).` }] };
  }
);

// ── Automation Runs ───────────────────────────────────────────────────────────

server.registerTool(
  "list_runs",
  {
    description: "List automation runs in a Testmo project.",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      status: z.number().int().min(0).max(2).optional().describe("Filter by status: 0=open, 1=complete, 2=aborted"),
      ...paginationSchema,
    },
  },
  async ({ project_id, page, limit, status }) => {
    const result = await client.listRuns(project_id, { page, limit, status });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "create_run",
  {
    description: "Create a new automation run in a Testmo project.",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      name: z.string().min(1).describe("Run name"),
      source: z.string().optional().describe("Source identifier (e.g. CI pipeline name)"),
    },
  },
  async ({ project_id, name, source }) => {
    const result = await client.createRun(project_id, { name, source });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "complete_run",
  {
    description: "Mark an automation run as complete.",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      run_id: z.number().int().positive().describe("Run ID to complete"),
    },
  },
  async ({ project_id, run_id }) => {
    await client.completeRun(project_id, run_id);
    return { content: [{ type: "text", text: `Run ${run_id} marked as complete.` }] };
  }
);

server.registerTool(
  "create_run_thread",
  {
    description: "Create a thread inside an automation run.",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      run_id: z.number().int().positive().describe("Run ID"),
      name: z.string().min(1).describe("Thread name"),
    },
  },
  async ({ project_id, run_id, name }) => {
    const result = await client.createRunThread(project_id, run_id, { name });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "append_to_run",
  {
    description: "Append artifacts, links, or custom fields to an automation run.",
    inputSchema: {
      run_id: z.number().int().positive().describe("Run ID"),
      artifacts: z.array(z.object({
        name: z.string().describe("Artifact name"),
        url: z.string().url().describe("Artifact URL"),
      })).optional().describe("Artifacts to append"),
      links: z.array(z.object({
        name: z.string().describe("Link name"),
        url: z.string().url().describe("Link URL"),
      })).optional().describe("Links to append"),
    },
  },
  async ({ run_id, artifacts, links }) => {
    await client.appendToRun(run_id, { artifacts, links });
    return { content: [{ type: "text", text: `Appended data to run ${run_id}.` }] };
  }
);

// ── Run Results ───────────────────────────────────────────────────────────────

server.registerTool(
  "get_run_results",
  {
    description: "Get test results for a specific automation run.",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      run_id: z.number().int().positive().describe("Run ID"),
      ...paginationSchema,
    },
  },
  async ({ project_id, run_id, page, limit }) => {
    const result = await client.getRunResults(project_id, run_id, { page, limit });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Test Runs (manual) ────────────────────────────────────────────────────────

server.registerTool(
  "list_test_runs",
  {
    description: "List manual test runs in a Testmo project.",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      ...paginationSchema,
    },
  },
  async ({ project_id, page, limit }) => {
    const result = await client.listTestRuns(project_id, { page, limit });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Sessions ──────────────────────────────────────────────────────────────────

server.registerTool(
  "list_sessions",
  {
    description: "List exploratory test sessions in a Testmo project.",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      ...paginationSchema,
    },
  },
  async ({ project_id, page, limit }) => {
    const result = await client.listSessions(project_id, { page, limit });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Automation Sources ────────────────────────────────────────────────────────

server.registerTool(
  "list_automation_sources",
  {
    description: "List automation sources in a Testmo project.",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
    },
  },
  async ({ project_id }) => {
    const result = await client.listAutomationSources(project_id);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "get_automation_source",
  {
    description: "Get details of a specific automation source.",
    inputSchema: {
      id: z.number().int().positive().describe("Automation source ID"),
    },
  },
  async ({ id }) => {
    const result = await client.getAutomationSource(id);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Milestones ────────────────────────────────────────────────────────────────

server.registerTool(
  "list_milestones",
  {
    description: "List milestones in a Testmo project.",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      ...paginationSchema,
    },
  },
  async ({ project_id, page, limit }) => {
    const result = await client.listMilestones(project_id, { page, limit });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "get_milestone",
  {
    description: "Get details of a specific milestone.",
    inputSchema: {
      project_id: z.number().int().positive().describe("Project ID"),
      milestone_id: z.number().int().positive().describe("Milestone ID"),
    },
  },
  async ({ project_id, milestone_id }) => {
    const result = await client.getMilestone(project_id, milestone_id);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Users ─────────────────────────────────────────────────────────────────────

server.registerTool(
  "get_current_user",
  { description: "Get the currently authenticated Testmo user.", inputSchema: {} },
  async () => {
    const result = await client.getCurrentUser();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "list_users",
  {
    description: "List all users in the Testmo workspace.",
    inputSchema: { ...paginationSchema },
  },
  async ({ page, limit }) => {
    const result = await client.listUsers({ page, limit });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "get_user",
  {
    description: "Get details of a specific Testmo user.",
    inputSchema: { id: z.number().int().positive().describe("User ID") },
  },
  async ({ id }) => {
    const result = await client.getUser(id);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Groups ────────────────────────────────────────────────────────────────────

server.registerTool(
  "list_groups",
  { description: "List all user groups in the Testmo workspace (admin only).", inputSchema: {} },
  async () => {
    const result = await client.listGroups();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "get_group",
  {
    description: "Get details of a specific user group (admin only).",
    inputSchema: { id: z.number().int().positive().describe("Group ID") },
  },
  async ({ id }) => {
    const result = await client.getGroup(id);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Roles ─────────────────────────────────────────────────────────────────────

server.registerTool(
  "list_roles",
  { description: "List all user roles in the Testmo workspace (admin only).", inputSchema: {} },
  async () => {
    const result = await client.listRoles();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "get_role",
  {
    description: "Get details of a specific user role (admin only).",
    inputSchema: { id: z.number().int().positive().describe("Role ID") },
  },
  async ({ id }) => {
    const result = await client.getRole(id);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
