# Testmo MCP Server — Test Plan

Manual test plan for validating the testmo MCP server. Each test case includes a ready-to-paste prompt. Run these in a Claude Code session with the testmo MCP active.

---

## Environment Setup

Before running tests, verify the MCP is loaded:

```
/mcp
```

Expected: `testmo` listed as connected with 32 tools.

**Variables used in prompts** — replace with real values from your instance:
- `PROJECT_ID` — use a real project ID (run smoke test TC-001 first to get one)
- `FOLDER_ID` — a folder that exists in your project
- `CASE_ID` — a test case that exists in your project
- `RUN_ID` — an automation run that exists

---

## Model Recommendations

| Model | Suitable for |
|---|---|
| **Haiku** | Smoke tests, single read operations (TC-001–TC-010) |
| **Sonnet** | All functional tests, pagination, filtering |
| **Opus** | Multi-step scenarios, chained operations (Suite 9) |

---

## Suite 1 — Smoke Tests

Quick validation that the MCP connects and core read operations work. Run these first.

---

### TC-001 · List Projects · Smoke · Any model

**Prompt:**
```
Use the testmo MCP to list all available projects. Show me the project IDs and names in a table.
```

**Expected:**
- Returns a list of projects with `id` and `name`
- No error, `isError` not present in response
- stderr shows `[testmo] list_projects called` and `[testmo] list_projects ok (Xms)`

---

### TC-002 · Authenticated User · Smoke · Any model

**Prompt:**
```
Using the testmo MCP, tell me who is currently authenticated — show the user's name, email, and role.
```

**Expected:**
- Returns user object with `name`, `email`
- Confirms the `TESTMO_ACCESS_TOKEN` is valid

---

### TC-003 · List Users · Smoke · Any model

**Prompt:**
```
Use the testmo MCP to list users in the workspace. Show up to 10 results.
```

**Expected:**
- Returns paginated list of users
- `page` and `limit` params respected

---

## Suite 2 — Projects

---

### TC-010 · Get Project by ID · Positive · Haiku

**Prompt:**
```
Using the testmo MCP, get the details of project with ID [PROJECT_ID]. Show all available fields.
```

**Expected:**
- Returns single project object with all metadata fields

---

### TC-011 · Get Non-Existent Project · Negative · Haiku

**Prompt:**
```
Using the testmo MCP, try to get the project with ID 999999999. What happens?
```

**Expected:**
- Tool returns `isError: true`
- Error message contains `404` or `not found`
- Server does NOT crash — `withErrorRecovery` catches the error
- stderr shows `[testmo] get_project error: Testmo API 404...`

---

## Suite 3 — Folders

---

### TC-020 · List Folders · Positive · Haiku

**Prompt:**
```
Use the testmo MCP to list all folders in project [PROJECT_ID]. Show folder IDs, names, and parent IDs.
```

**Expected:**
- Returns list of folders for the project

---

### TC-021 · List Folders with Pagination · Positive · Sonnet

**Prompt:**
```
Use the testmo MCP to list folders in project [PROJECT_ID], but only show 2 results per page. First show page 1, then page 2.
```

**Expected:**
- Two separate tool calls, each returning 2 results
- `page` and `limit` params passed correctly

---

### TC-022 · Create and Delete Folder · Positive + Cleanup · Sonnet

**Prompt:**
```
Using the testmo MCP:
1. Create a folder named "[TEST] Temporary Folder" in project [PROJECT_ID]
2. Confirm it was created by listing folders
3. Delete the folder you just created
4. Confirm it's gone by listing folders again
```

**Expected:**
- Folder created with correct name
- `delete_folders` receives the ID from the create response
- Final list does not contain the test folder

---

### TC-023 · Create Nested Folder · Positive · Sonnet

**Prompt:**
```
Use the testmo MCP to:
1. Create a parent folder named "[TEST] Parent" in project [PROJECT_ID]
2. Create a child folder named "[TEST] Child" inside the parent folder you just created
3. Show both folders with their parent_id relationship
```

**Expected:**
- Child folder has `parent_id` matching the parent folder's `id`

---

### TC-024 · Update Folder Name · Positive · Sonnet

**Prompt:**
```
Use the testmo MCP to:
1. Create a folder named "[TEST] Old Name" in project [PROJECT_ID]
2. Rename it to "[TEST] New Name" using update_folders
3. Fetch the folder list to confirm the rename
4. Clean up by deleting the folder
```

**Expected:**
- `update_folders` returns updated folder with new name
- Cleanup succeeds

---

### TC-025 · Delete Non-Existent Folder · Negative · Haiku

**Prompt:**
```
Use the testmo MCP to delete folder with ID 999999999 from project [PROJECT_ID]. What error do you get?
```

**Expected:**
- Returns `isError: true`
- Error message contains HTTP status code
- No crash

---

## Suite 4 — Test Cases

---

### TC-030 · List Cases in Project · Positive · Haiku

**Prompt:**
```
Use the testmo MCP to list test cases in project [PROJECT_ID]. Show me the first 5 cases with their IDs and names.
```

**Expected:**
- Returns list of test cases
- `limit: 5` respected

---

### TC-031 · List Cases Filtered by Folder · Positive · Sonnet

**Prompt:**
```
Use the testmo MCP to list only the test cases that are in folder [FOLDER_ID] of project [PROJECT_ID].
```

**Expected:**
- All returned cases belong to the specified folder
- `folder_id` param passed correctly

---

### TC-032 · Get Single Case · Positive · Haiku

**Prompt:**
```
Use the testmo MCP to get the full details of test case [CASE_ID]. Show all fields including custom fields and steps.
```

**Expected:**
- Returns complete test case object with `custom_steps`, `custom_description`, etc.

---

### TC-033 · Create Minimal Test Case · Positive · Sonnet

**Prompt:**
```
Use the testmo MCP to create a test case in project [PROJECT_ID] with just the name "[TEST] Minimal Case — auto created". Then show me its ID.
```

**Expected:**
- Case created with only `name` required
- Returns new case with `id`

---

### TC-034 · Create Full Test Case · Positive · Sonnet

**Prompt:**
```
Use the testmo MCP to create a detailed test case in project [PROJECT_ID] with:
- name: "[TEST] Full Case — login flow"
- folder_id: [FOLDER_ID]
- custom_priority: 2 (high)
- custom_description: "Verify user can log in with valid credentials"
- custom_preconditions: "User account exists and is active"
- custom_expected: "User is redirected to dashboard"
- custom_steps: 
  Step 1: "Navigate to login page" → expected: "Login form is displayed"
  Step 2: "Enter valid credentials and click Login" → expected: "User is authenticated and redirected"

Then show the created case.
```

**Expected:**
- All fields persisted correctly
- Steps have `text1` and `text3` populated

---

### TC-035 · Bulk Update Cases Priority · Positive · Sonnet

**Prompt:**
```
Use the testmo MCP to:
1. Create 2 test cases in project [PROJECT_ID]: "[TEST] Case A" and "[TEST] Case B"
2. Get their IDs
3. Update both cases at once to set priority to 1 (critical) using update_cases
4. Verify the update by fetching each case
5. Delete both cases to clean up
```

**Expected:**
- Both cases updated in single `update_cases` call
- `custom_priority: 1` on both cases after update

---

### TC-036 · Create Case with Invalid Priority · Negative · Haiku

**Prompt:**
```
Use the testmo MCP to create a test case in project [PROJECT_ID] with name "[TEST] Invalid Priority" and custom_priority set to 0. What happens?
```

**Expected:**
- Zod validation rejects the input before any API call
- Error message says the priority must be a positive option ID
- Tool returns error, does NOT create the case

---

### TC-037 · Bulk Delete Cases · Positive · Sonnet

**Prompt:**
```
Use the testmo MCP to:
1. Create 3 test cases named "[TEST] Delete Me 1", "[TEST] Delete Me 2", "[TEST] Delete Me 3" in project [PROJECT_ID]
2. Delete all 3 in a single delete_cases call
3. Confirm they are gone
```

**Expected:**
- Single `delete_cases` call with array of 3 IDs
- Confirmation message: `Deleted 3 case(s).`

---

## Suite 5 — Attachments

---

### TC-040 · List Attachments · Positive · Haiku

**Prompt:**
```
Use the testmo MCP to list all attachments for test case [CASE_ID].
```

**Expected:**
- Returns list of attachments (may be empty — that's fine)
- No error

---

## Suite 6 — Automation Runs

---

### TC-050 · List Runs · Positive · Haiku

**Prompt:**
```
Use the testmo MCP to list automation runs in project [PROJECT_ID]. Show their status (0=open, 1=complete, 2=aborted) and names.
```

**Expected:**
- Returns paginated list of runs with status codes

---

### TC-051 · List Runs Filtered by Status · Positive · Sonnet

**Prompt:**
```
Use the testmo MCP to list only COMPLETED automation runs (status=1) in project [PROJECT_ID].
```

**Expected:**
- All returned runs have `status: 1`

---

### TC-052 · Create and Complete a Run · Positive · Sonnet

**Prompt:**
```
Use the testmo MCP to:
1. Create an automation run named "[TEST] CI Pipeline Run" in project [PROJECT_ID]
2. Add a thread named "Unit Tests" to the run
3. Append a link: name="GitHub Actions", url="https://github.com"
4. Mark the run as complete
5. Verify the run status is 1 (complete) by listing runs
```

**Expected:**
- Run created, thread created, link appended, run completed
- Final list shows the run with status 1

---

### TC-053 · Get Run Results · Positive · Sonnet

**Prompt:**
```
Use the testmo MCP to get the test results for automation run [RUN_ID] in project [PROJECT_ID]. Show the first 10 results with their status.
```

**Expected:**
- Returns paginated run results

---

## Suite 7 — Test Runs & Sessions

---

### TC-060 · List Manual Test Runs · Positive · Haiku

**Prompt:**
```
Use the testmo MCP to list manual test runs in project [PROJECT_ID]. Show their names and IDs.
```

**Expected:**
- Returns list of manual test runs

---

### TC-061 · List Sessions · Positive · Haiku

**Prompt:**
```
Use the testmo MCP to list exploratory test sessions in project [PROJECT_ID].
```

**Expected:**
- Returns list of sessions (may be empty)

---

## Suite 8 — Users, Groups, Roles

---

### TC-070 · Get User by ID · Positive · Haiku

**Prompt:**
```
Use the testmo MCP to get the current user, then fetch their full profile by ID.
```

**Expected:**
- Two tool calls: `get_current_user` then `get_user` with the returned ID
- Both return consistent user data

---

### TC-071 · List Groups and Roles · Positive · Haiku

**Prompt:**
```
Use the testmo MCP to list all user groups and all user roles in the workspace. Present them in two separate tables.
```

**Expected:**
- `list_groups` and `list_roles` called
- Results presented in readable format

---

## Suite 9 — Error Handling & Edge Cases

---

### TC-080 · Error Recovery — Invalid Token · Negative · Any model

> **Setup:** Temporarily set `TESTMO_ACCESS_TOKEN=invalid` in Claude settings and restart.

**Prompt:**
```
Use the testmo MCP to list projects.
```

**Expected:**
- Env validation catches invalid token (length < 10) and server refuses to start
- OR if token passes length check: API returns 401, `withErrorRecovery` returns `isError: true`

---

### TC-081 · Error Recovery — Network Timeout · Negative · Any model

> **This test is conceptual** — trigger by pointing `TESTMO_BASE_URL` at a non-responding host.

**Prompt:**
```
Use the testmo MCP to list all projects.
```

**Expected:**
- After 30 seconds, `AbortSignal.timeout` fires
- `withErrorRecovery` catches the `TimeoutError`
- Returns `isError: true` with message about timeout
- Server remains running — other tools still work after

---

### TC-082 · Pagination Boundary · Edge · Sonnet

**Prompt:**
```
Use the testmo MCP to list test cases in project [PROJECT_ID] with limit=1, page=1. Then page=2. Then page=9999. What does the last page return?
```

**Expected:**
- Pages 1 and 2 return results (if enough cases exist)
- Page 9999 returns empty data array — NOT an error
- Server handles empty response gracefully

---

### TC-083 · Bulk Operation at Limit · Edge · Sonnet

**Prompt:**
```
Ask the testmo MCP to delete 101 case IDs at once (use IDs 1 through 101). What happens?
```

**Expected:**
- Zod validation rejects the input: `case_ids` array exceeds `max(100)`
- Error returned before any API call

---

### TC-084 · Empty inputSchema Tools · Positive · Haiku

**Prompt:**
```
Using the testmo MCP, call list_projects, list_groups, and list_roles — all three in a single response without me asking separately.
```

**Expected:**
- Model calls all three tools that have empty `inputSchema: {}`
- No TypeScript errors from the `withErrorRecovery` generic wrapper
- All three return results

---

### TC-085 · Concurrent Tool Calls · Positive · Sonnet

**Prompt:**
```
Use the testmo MCP to simultaneously fetch: the current user, the list of projects, and the list of roles. Run all three in parallel and combine the results into a summary.
```

**Expected:**
- Model makes 3 parallel tool calls in one turn
- All three return results
- No race conditions or shared-state errors

---

## Suite 10 — Multi-Step Scenarios (Opus / Sonnet)

End-to-end workflows that simulate real QA usage.

---

### TC-090 · Full Test Case Lifecycle · E2E · Opus

**Prompt:**
```
Using the testmo MCP, walk me through a complete test case lifecycle in project [PROJECT_ID]:

1. Create a folder named "[TEST SUITE] Login Feature"
2. Create 3 test cases in that folder:
   - "Verify login with valid credentials" (priority: 2, steps: navigate → enter creds → verify dashboard)
   - "Verify login with wrong password" (priority: 1, steps: navigate → enter wrong creds → verify error message)
   - "Verify login form validation" (priority: 3, steps: submit empty form → verify field errors)
3. Update all 3 cases to add custom_preconditions: "Application is deployed and accessible"
4. Show a summary table of the created cases
5. Clean up: delete all 3 cases and the folder
```

**Expected:**
- All operations succeed in sequence
- Model correctly chains IDs from create responses into subsequent calls
- Final cleanup leaves no test data

---

### TC-091 · CI Run Simulation · E2E · Sonnet

**Prompt:**
```
Simulate a CI test run using the testmo MCP for project [PROJECT_ID]:

1. Create a new automation run named "[TEST] Simulated CI — $(today's date)"
2. Create a thread named "API Tests"
3. Append an artifact: name="test-report.html", url="https://example.com/report"
4. Append a link: name="Pull Request", url="https://github.com"
5. Complete the run
6. Immediately fetch the run results (expect empty for a fresh run — that's fine)
7. Show a summary of what was created
```

**Expected:**
- Realistic CI workflow modeled correctly
- `append_to_run` handles both artifacts and links in one call
- Completed run visible in `list_runs` with status 1

---

### TC-092 · Cross-Resource Query · E2E · Sonnet

**Prompt:**
```
Using the testmo MCP, answer these questions about project [PROJECT_ID]:
1. How many test cases are there in total? (use pagination if needed)
2. How many are in the top-level folders vs. nested folders?
3. Who are the workspace members? (list users)
4. Are there any open automation runs?

Present the findings as a structured report.
```

**Expected:**
- Model correctly uses `list_cases`, `list_folders`, `list_users`, `list_runs` with filters
- Understands pagination — fetches multiple pages if total > limit
- Synthesizes data from multiple tools into a coherent report

---

## Checklist — Post-Deployment Regression

Run after any change to `src/`:

- [ ] TC-001 (list_projects) — basic connectivity
- [ ] TC-002 (get_current_user) — auth works
- [ ] TC-011 (get non-existent project) — `withErrorRecovery` active
- [ ] TC-033 (create minimal case) + delete — write path works
- [ ] TC-022 (create + delete folder) — destructive tool works
- [ ] TC-083 (bulk limit validation) — Zod schemas enforced
- [ ] TC-052 (create + complete run) — automation run flow works

---

## Notes

- All `[TEST]` prefixed resources created during testing should be deleted in the same session.
- If a test fails midway and leaves orphaned data, search by name prefix `[TEST]` in the Testmo UI.
- stderr output from `withErrorRecovery` is visible in the Claude Code MCP log — check it when a tool behaves unexpectedly.
- The `delete_*` tools carry `destructiveHint: true` — Claude may ask for confirmation before executing them.
