# testmo-mcp-server

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-purple)](https://modelcontextprotocol.io)

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that exposes the [Testmo REST API](https://support.testmo.com/hc/en-us/categories/37813841496333-REST-API) as tools for Claude Code and Cursor.

> **Disclaimer:** This is an unofficial community project and is not affiliated with or endorsed by Testmo.

## Requirements

- Node.js 18+
- A Testmo account with API access enabled

## Installation

```bash
git clone https://github.com/MateoSocha/testmo-mcp-server
cd testmo-mcp-server
npm install
npm run build
```

## Configuration

### 1. Get a Testmo API token

1. Log in to your Testmo instance
2. Go to **User Profile → API access**
3. Generate a new API key and copy it — it is shown only once

### 2. Register with Claude Code

The fastest way is to copy `.mcp.json` from this repo into your project root — Claude Code picks it up automatically:

```json
{
  "mcpServers": {
    "testmo": {
      "command": "node",
      "args": ["/absolute/path/to/testmo-mcp-server/dist/server.js"],
      "env": {
        "TESTMO_BASE_URL": "https://<your-instance>.testmo.net",
        "TESTMO_ACCESS_TOKEN": "<your-api-token>"
      }
    }
  }
}
```

Alternatively, add the `testmo` block to `~/.claude/settings.json` under `mcpServers` for a global registration (available in every project).

Replace `/absolute/path/to/testmo-mcp-server` with the actual path where you cloned this repo.

Restart Claude Code — the server will appear as `testmo • connected` in `/mcp`.

### 3. Register with Cursor

Cursor reads MCP configuration from `~/.cursor/mcp.json` (global, available in all projects) or `.cursor/mcp.json` in the root of a specific project.

Create or edit the file and add the `testmo` entry:

```json
{
  "mcpServers": {
    "testmo": {
      "command": "node",
      "args": ["/absolute/path/to/testmo-mcp-server/dist/server.js"],
      "env": {
        "TESTMO_BASE_URL": "https://<your-instance>.testmo.net",
        "TESTMO_ACCESS_TOKEN": "<your-api-token>"
      }
    }
  }
}
```

Then in Cursor: open **Settings → MCP** and verify the server shows a green status indicator. If it does not appear, click **Refresh** or restart Cursor.

> If you use the project-level `.cursor/mcp.json`, add `.cursor/mcp.json` to your `.gitignore` to avoid committing tokens.

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TESTMO_BASE_URL` | Yes | Base URL of your Testmo instance, e.g. `https://mycompany.testmo.net` |
| `TESTMO_ACCESS_TOKEN` | Yes | Bearer token from your Testmo user profile |

> **Never commit your API token.** Pass it only through `env` in the MCP config or a local `.env` file (which is git-ignored).

## Available tools

### Projects
| Tool | Description |
|------|-------------|
| `list_projects` | List all projects |
| `get_project` | Get project details by ID |

### Folders
| Tool | Description |
|------|-------------|
| `list_folders` | List folders in a project |
| `create_folders` | Create one or more folders (up to 100) |
| `update_folders` | Update folders in bulk (up to 100) |
| `delete_folders` | Delete folders in bulk (up to 100) |

### Test Cases
| Tool | Description |
|------|-------------|
| `list_cases` | List test cases (supports pagination and folder filtering); each row is a full case object |
| `get_case_names` | Lightweight id/name/folder_id listing (no full case detail) |
| `get_case_result_history` | Get the historical result records for a specific test case |
| `create_case` | Create a new test case with full field support (see below) |
| `update_cases` | Update test cases in bulk — same values applied to all specified IDs (see below) |
| `delete_cases` | Delete test cases in bulk (up to 100) |

> **No `get_case` tool.** The Testmo REST API has no "get one case by ID" endpoint — full case
> detail is only returned by the case listing endpoint, so use `list_cases` (optionally filtered
> by `folder_id`/`name`) to fetch a case's full fields.

#### `create_case` fields

| Field | Type | Description |
|-------|------|-------------|
| `project_id` | number | **Required.** Project ID |
| `name` | string | **Required.** Test case title |
| `folder_id` | number | Folder ID |
| `state_id` | number | State ID |
| `estimate` | number | Time estimate in seconds |
| `tags` | string[] | Tags |
| `issues` | number[] | Linked issue IDs |
| `custom_priority` | 1–4 | Priority: 1=critical, 2=high, 3=medium, 4=low |
| `custom_description` | string | Test case description |
| `custom_preconditions` | string | Preconditions |
| `custom_expected` | string | Expected result |
| `custom_steps` | array | Steps: `[{ text1: "step", text3: "expected" }]` |

#### `update_cases` fields

All fields (except `ids`) are optional and applied to **all** specified case IDs.

| Field | Type | Description |
|-------|------|-------------|
| `project_id` | number | **Required.** Project ID |
| `ids` | number[] | **Required.** Case IDs to update (up to 100) |
| `name` | string | New title |
| `folder_id` | number | New folder ID |
| `state_id` | number | New state ID |
| `status_id` | number | New status ID |
| `estimate` | number | Time estimate in seconds |
| `tags` | string[] | Tags (replaces existing) |
| `issues` | number[] | Linked issue IDs |
| `custom_priority` | 1–4 | Priority: 1=critical, 2=high, 3=medium, 4=low |
| `custom_description` | string | Test case description |
| `custom_preconditions` | string | Preconditions |
| `custom_expected` | string | Expected result |
| `custom_steps` | array | Steps: `[{ text1: "step", text3: "expected" }]` (replaces existing) |

### Attachments
| Tool | Description |
|------|-------------|
| `list_attachments` | List attachments for a test case |
| `create_attachments` | Upload one or more local files as attachments (up to 20) |
| `create_attachment_single` | Upload a single local file as an attachment |
| `delete_attachments` | Delete attachments in bulk (up to 100) |

### Automation Runs
| Tool | Description |
|------|-------------|
| `list_runs` | List automation runs (supports status/source/name filters) |
| `get_automation_run` | Get details of a single automation run |
| `get_automation_run_tests` | List all tests recorded in an automation run |
| `create_run` | Create a new automation run |
| `complete_run` | Mark a run as complete |
| `create_run_thread` | Create a thread inside a run |
| `append_to_run` | Append artifacts, links, or fields to a run |
| `append_to_run_thread` | Append artifacts or fields to a specific run thread |
| `complete_run_thread` | Mark a specific run thread as complete |

### Automation Cases & Links
| Tool | Description |
|------|-------------|
| `get_automation_cases` | List automation cases (tests discovered from automation runs) |
| `create_automation_link` | Link one automation case to a repository test case |
| `create_automation_links_bulk` | Link multiple automation cases to repository test cases (up to 500) |

### Manual Test Runs
| Tool | Description |
|------|-------------|
| `list_test_runs` | List manual test runs in a project |
| `create_test_run` | Create a new manual test run |
| `get_test_run` | Get details of a single manual test run |
| `update_test_run` | Update a manual test run |
| `delete_test_run` | Delete a manual test run |

### Run Results *(manual test runs)*
| Tool | Description |
|------|-------------|
| `get_run_results` | Get test results for a manual test run |
| `create_run_result` | Record a result for a single test within a run |
| `create_run_results_bulk` | Record results for multiple tests at once (up to 100) |
| `update_run_result` | Update an existing test result |

### Sessions
| Tool | Description |
|------|-------------|
| `list_sessions` | List exploratory test sessions in a project |
| `get_session` | Get details of a single session |
| `create_session` | Create a new exploratory test session |
| `update_session` | Update a session |
| `delete_session` | Delete a session |

### Automation Sources
| Tool | Description |
|------|-------------|
| `list_automation_sources` | List automation sources in a project |
| `get_automation_source` | Get details of a specific automation source |

### Milestones
| Tool | Description |
|------|-------------|
| `list_milestones` | List milestones in a project |
| `get_milestone` | Get details of a specific milestone |
| `create_milestone` | Create a new milestone |
| `update_milestone` | Update a milestone |
| `delete_milestone` | Delete a milestone |
| `get_milestone_types` | List the milestone types available for a project |

### Folders (single lookup)
| Tool | Description |
|------|-------------|
| `get_folder` | Get details of a single repository folder by ID |

### Project Reference Data
| Tool | Description |
|------|-------------|
| `get_project_configs` | List configurations (e.g. environments/browsers) |
| `get_fields` | List custom fields, optionally filtered by entity type |
| `get_project_repos` | List the test case repositories for a project |
| `get_project_states` | List workflow states (e.g. draft/active/deprecated) |
| `get_project_statuses` | List test result statuses (e.g. passed/failed/blocked) |
| `get_project_tags` | List all tags used in a project, with usage counts |
| `get_project_templates` | List the test case templates defined for a project |
| `get_project_users` | List the users who are members of a project |

### Issues
| Tool | Description |
|------|-------------|
| `get_issue_connections` | List configured issue-tracker connections (e.g. linked Jira projects) |

### Users
| Tool | Description |
|------|-------------|
| `get_current_user` | Get the currently authenticated user |
| `list_users` | List all workspace users |
| `get_user` | Get details of a specific user |

### Groups *(admin only)*
| Tool | Description |
|------|-------------|
| `list_groups` | List all user groups |
| `get_group` | Get details of a specific group |

### Roles *(admin only)*
| Tool | Description |
|------|-------------|
| `list_roles` | List all user roles |
| `get_role` | Get details of a specific role |

### Pagination

Most `list_*` tools accept `page` and `per_page` (not `limit`) — these match the Testmo REST
API's actual query parameter names and response envelope (`page`, `prev_page`, `next_page`,
`last_page`, `per_page`, `total`).

## Example prompts

Once connected, you can ask Claude things like:

### Explore your workspace

```
List all Testmo projects and show me their IDs and names.
```
```
Who am I logged in as? Show my name and role.
```
```
List all folders in project 3, including their IDs and parent folders.
```
```
How many test cases are in project 3? Break the count down by folder.
```

### Work with test cases

```
Show me the 10 most recently updated test cases in project 3.
```
```
Find test case 1234 in project 3 (list its folder and show all steps and custom fields).
```
```
Create a test case in project 3 called "Verify checkout with a promo code" with:
- priority: high
- folder: 42
- preconditions: User has an active cart with at least one item
- steps:
    1. Apply a valid promo code → discount is shown in the order summary
    2. Click Place Order → order confirmation page is displayed
```
```
Move all test cases with IDs 101, 102, 103 to folder 55 in project 3.
```
```
Update test cases 201 and 202 to set priority to critical and add the tag "regression".
```
```
Delete test cases 301, 302, and 303 from project 3.
```

### Manage folders

```
Create a folder structure in project 3:
- "API Tests" as a top-level folder
  - "Auth" as a subfolder
  - "Orders" as a subfolder
  - "Users" as a subfolder
```
```
Rename folder 15 to "E2E Tests" in project 3.
```

### Automation runs

```
List the last 10 automation runs in project 3 and show their status (open / complete / aborted).
```
```
Create a new automation run called "Nightly CI — 2026-05-18" in project 3, then mark it as complete.
```
```
Show me the test results for automation run 77 in project 3.
```

### Multi-step workflows

```
In project 3, create 5 test cases for the user registration flow.
Each case should have a descriptive name, 2–3 steps, and be placed in folder 12.
Use high priority for the happy path and medium for edge cases.
```
```
Find all automation runs in project 3 that are still open and complete them.
```
```
Show me a summary of project 3: number of folders, total test cases, open runs, and active milestones.
```

## Project structure

```
src/
├── server.ts   — MCP server entry point, tool registration
├── client.ts   — HTTP wrapper for the Testmo REST API
├── env.ts      — Environment variable validation (Zod)
└── types.ts    — TypeScript interfaces for API responses
tests/
└── manual/
    └── test-plan.md  — Manual test cases with ready-to-use prompts
```

## Development

```bash
# Watch mode — recompiles on every file save
npm run dev

# One-off build
npm run build

# Verify the server starts correctly
TESTMO_BASE_URL=https://your-instance.testmo.net \
TESTMO_ACCESS_TOKEN=your-token \
node dist/server.js
# Server waits silently on stdin — that is expected (STDIO transport)
# Press Ctrl+C to exit
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first.

## Troubleshooting

**Tools not visible in Claude Code** — restart Claude Code after editing `~/.claude.json`; MCP servers are loaded at startup. Run `/mcp` to see connection status.

**Tools not visible in Cursor** — open **Settings → MCP**, click **Refresh**. If the server shows red, check the path in `mcp.json` and verify `node dist/server.js` runs without errors manually.

**401 Unauthorized** — check that `TESTMO_ACCESS_TOKEN` is correct and has not been revoked.

**Connection errors** — verify `TESTMO_BASE_URL` matches your instance URL (no trailing slash needed).

## License

[MIT](LICENSE)
