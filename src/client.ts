import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type {
  TestmoProject,
  TestmoTestCase,
  TestmoCreateCaseInput,
  TestmoUpdateCasesInput,
  TestmoFolder,
  TestmoAutomationRun,
  TestmoAutomationTest,
  TestmoRunResult,
  TestmoTestRun,
  TestmoSession,
  TestmoAutomationSource,
  TestmoAutomationCase,
  TestmoMilestone,
  TestmoMilestoneType,
  TestmoUser,
  TestmoCurrentUser,
  TestmoGroup,
  TestmoRole,
  TestmoAttachment,
  TestmoField,
  TestmoProjectState,
  TestmoProjectStatus,
  TestmoProjectTag,
  TestmoProjectTemplate,
  TestmoProjectRepo,
  TestmoProjectConfig,
  TestmoIssueConnection,
  TestmoCaseName,
  TestmoCaseResultHistoryEntry,
  TestmoPaginatedResponse,
} from "./types.js";

export class TestmoClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(baseUrl: string, token: string, version: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": `testmo-mcp-server/${version} Node/${process.version}`,
    };
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const res = await fetch(url, {
      ...options,
      headers: this.headers,
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Testmo API ${res.status} ${res.statusText}: ${body}`);
    }

    if (res.status === 204) return {} as T;
    const ct = res.headers.get("content-type") ?? "";
    return (ct.includes("application/json") ? res.json() : res.text()) as Promise<T>;
  }

  /** Same as request(), but omits Content-Type so fetch/FormData sets the multipart boundary itself. */
  private async requestMultipart<T>(path: string, formData: FormData): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const multipartHeaders = Object.fromEntries(
      Object.entries(this.headers).filter(([key]) => key !== "Content-Type")
    );
    const res = await fetch(url, {
      method: "POST",
      headers: multipartHeaders,
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Testmo API ${res.status} ${res.statusText}: ${body}`);
    }

    const ct = res.headers.get("content-type") ?? "";
    return (ct.includes("application/json") ? res.json() : res.text()) as Promise<T>;
  }

  private async fileToBlob(filePath: string): Promise<{ blob: Blob; name: string }> {
    const buf = await readFile(filePath);
    return { blob: new Blob([buf]), name: basename(filePath) };
  }

  private buildQuery(params: Record<string, string | number | boolean | undefined>): string {
    const qs = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined) qs.set(key, String(val));
    }
    return qs.toString() ? `?${qs}` : "";
  }

  // ── Projects ─────────────────────────────────────────────────────────────────

  async listProjects(params?: {
    is_completed?: boolean;
  }): Promise<TestmoPaginatedResponse<TestmoProject>> {
    const query = this.buildQuery({ is_completed: params?.is_completed });
    return this.request(`/projects${query}`);
  }

  async getProject(id: number): Promise<{ result: TestmoProject }> {
    return this.request(`/projects/${id}`);
  }

  // ── Folders ───────────────────────────────────────────────────────────────────

  async listFolders(
    projectId: number,
    params?: { page?: number; per_page?: number; parent_id?: number; name?: string }
  ): Promise<TestmoPaginatedResponse<TestmoFolder>> {
    const query = this.buildQuery({
      page: params?.page,
      per_page: params?.per_page,
      parent_id: params?.parent_id,
      name: params?.name,
    });
    return this.request(`/projects/${projectId}/folders${query}`);
  }

  async getFolder(folderId: number): Promise<{ result: TestmoFolder }> {
    return this.request(`/folders/${folderId}`);
  }

  async createFolders(
    projectId: number,
    folders: Array<{ name: string; parent_id?: number; docs?: string; display_order?: number }>
  ): Promise<{ result: TestmoFolder[] }> {
    return this.request(`/projects/${projectId}/folders`, {
      method: "POST",
      body: JSON.stringify({ folders }),
    });
  }

  async updateFolders(
    projectId: number,
    folders: Array<{ id: number; name?: string; parent_id?: number; docs?: string }>
  ): Promise<{ result: TestmoFolder[] }> {
    // The Testmo API updates one folder's fields per call but accepts a batch of ids
    // sharing the same field values; this repo calls it once per distinct id set.
    const results: TestmoFolder[] = [];
    for (const folder of folders) {
      const { id, ...fields } = folder;
      const res = await this.request<{ result: TestmoFolder[] }>(`/projects/${projectId}/folders`, {
        method: "PATCH",
        body: JSON.stringify({ ids: [id], ...fields }),
      });
      results.push(...res.result);
    }
    return { result: results };
  }

  async deleteFolders(projectId: number, ids: number[]): Promise<void> {
    await this.request(`/projects/${projectId}/folders`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
  }

  // ── Test Cases ────────────────────────────────────────────────────────────────

  async listCases(
    projectId: number,
    params?: {
      page?: number;
      per_page?: number;
      folder_id?: number;
      state_id?: number;
      status_id?: number;
      name?: string;
      tags?: string;
      recursive?: boolean;
    }
  ): Promise<TestmoPaginatedResponse<TestmoTestCase>> {
    const query = this.buildQuery({
      page: params?.page,
      per_page: params?.per_page,
      folder_id: params?.folder_id,
      state_id: params?.state_id,
      status_id: params?.status_id,
      name: params?.name,
      tags: params?.tags,
      recursive: params?.recursive,
    });
    return this.request(`/projects/${projectId}/cases${query}`);
  }

  async getCaseNames(
    projectId: number,
    params?: { per_page?: number }
  ): Promise<TestmoPaginatedResponse<TestmoCaseName>> {
    const query = this.buildQuery({ per_page: params?.per_page });
    return this.request(`/projects/${projectId}/cases/names${query}`);
  }

  async getCaseResultHistory(
    projectId: number,
    caseId: number
  ): Promise<TestmoPaginatedResponse<TestmoCaseResultHistoryEntry>> {
    return this.request(`/projects/${projectId}/cases/${caseId}/result-history`);
  }

  async createCase(
    projectId: number,
    input: TestmoCreateCaseInput
  ): Promise<{ result: TestmoTestCase[] }> {
    return this.request(`/projects/${projectId}/cases`, {
      method: "POST",
      body: JSON.stringify({ cases: [input] }),
    });
  }

  async updateCases(
    projectId: number,
    input: TestmoUpdateCasesInput
  ): Promise<{ result: TestmoTestCase[] }> {
    return this.request(`/projects/${projectId}/cases`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async deleteCases(projectId: number, ids: number[]): Promise<void> {
    await this.request(`/projects/${projectId}/cases`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
  }

  // ── Attachments ───────────────────────────────────────────────────────────────

  async listAttachments(caseId: number): Promise<TestmoPaginatedResponse<TestmoAttachment>> {
    return this.request(`/cases/${caseId}/attachments`);
  }

  async deleteAttachments(caseId: number, ids: number[]): Promise<void> {
    await this.request(`/cases/${caseId}/attachments`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
  }

  async createAttachments(
    caseId: number,
    filePaths: string[]
  ): Promise<{ result: TestmoAttachment[] }> {
    const form = new FormData();
    for (const filePath of filePaths) {
      const { blob, name } = await this.fileToBlob(filePath);
      form.append("files[]", blob, name);
    }
    return this.requestMultipart(`/cases/${caseId}/attachments`, form);
  }

  async createAttachmentSingle(
    caseId: number,
    filePath: string
  ): Promise<{ result: TestmoAttachment[] }> {
    const form = new FormData();
    const { blob, name } = await this.fileToBlob(filePath);
    form.append("file", blob, name);
    return this.requestMultipart(`/cases/${caseId}/attachments/single`, form);
  }

  // ── Automation Runs ───────────────────────────────────────────────────────────

  async listRuns(
    projectId: number,
    params?: { page?: number; per_page?: number; status?: number; source_id?: number; name?: string }
  ): Promise<TestmoPaginatedResponse<TestmoAutomationRun>> {
    const query = this.buildQuery({
      page: params?.page,
      per_page: params?.per_page,
      status: params?.status,
      source_id: params?.source_id,
      name: params?.name,
    });
    return this.request(`/projects/${projectId}/automation/runs${query}`);
  }

  async getAutomationRun(id: number): Promise<{ result: TestmoAutomationRun }> {
    return this.request(`/automation/runs/${id}`);
  }

  async createRun(
    projectId: number,
    input: { name: string; source: string; milestone_id?: number; config_id?: number; tags?: string[] }
  ): Promise<{ id: number }> {
    return this.request(`/projects/${projectId}/automation/runs`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async completeRun(runId: number, measureElapsed?: boolean): Promise<void> {
    await this.request(`/automation/runs/${runId}/complete`, {
      method: "POST",
      body: JSON.stringify({ measure_elapsed: measureElapsed }),
    });
  }

  async getAutomationRunTests(
    runId: number,
    params?: { per_page?: number; thread_id?: number; status_id?: string }
  ): Promise<TestmoPaginatedResponse<TestmoAutomationTest>> {
    const query = this.buildQuery({
      per_page: params?.per_page,
      thread_id: params?.thread_id,
      status_id: params?.status_id,
    });
    return this.request(`/automation/runs/${runId}/tests${query}`);
  }

  async createRunThread(runId: number, input: { elapsed_observed?: number }): Promise<{ id: number }> {
    return this.request(`/automation/runs/${runId}/threads`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async appendToRun(
    runId: number,
    input: {
      artifacts?: Array<{ name: string; url: string; note?: string; mime_type?: string; size?: number }>;
      links?: Array<{ name: string; url: string; note?: string }>;
      fields?: Array<{ type: string; name: string; value?: unknown }>;
    }
  ): Promise<void> {
    await this.request(`/automation/runs/${runId}/append`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async appendToRunThread(
    threadId: number,
    input: {
      artifacts?: Array<{ name: string; url: string; note?: string; mime_type?: string; size?: number }>;
      fields?: Array<{ type: string; name: string; value?: unknown }>;
      elapsed_observed?: number;
    }
  ): Promise<void> {
    await this.request(`/automation/runs/threads/${threadId}/append`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async completeRunThread(threadId: number, measureElapsed?: { elapsed_observed?: number }): Promise<void> {
    await this.request(`/automation/runs/threads/${threadId}/complete`, {
      method: "POST",
      body: JSON.stringify(measureElapsed ?? {}),
    });
  }

  // ── Automation Cases & Links ──────────────────────────────────────────────────

  async getAutomationCases(
    projectId: number,
    params?: { source_id?: number; status?: string; name?: string }
  ): Promise<TestmoPaginatedResponse<TestmoAutomationCase>> {
    const query = this.buildQuery({
      source_id: params?.source_id,
      status: params?.status,
      name: params?.name,
    });
    return this.request(`/projects/${projectId}/automation/cases${query}`);
  }

  async createAutomationLink(
    projectId: number,
    caseId: number,
    automationCaseId: number
  ): Promise<void> {
    await this.request(`/projects/${projectId}/automation-links`, {
      method: "POST",
      body: JSON.stringify({ case_id: caseId, automation_case_id: automationCaseId }),
    });
  }

  async createAutomationLinksBulk(
    projectId: number,
    links: Array<{ case_id: number; automation_case_id: number }>
  ): Promise<void> {
    await this.request(`/projects/${projectId}/automation-links/bulk`, {
      method: "POST",
      body: JSON.stringify({ links }),
    });
  }

  // ── Manual Test Runs ──────────────────────────────────────────────────────────

  async listTestRuns(
    projectId: number,
    params?: { page?: number; per_page?: number; is_closed?: boolean; milestone_id?: number; name?: string }
  ): Promise<TestmoPaginatedResponse<TestmoTestRun>> {
    const query = this.buildQuery({
      page: params?.page,
      per_page: params?.per_page,
      is_closed: params?.is_closed,
      milestone_id: params?.milestone_id,
      name: params?.name,
    });
    return this.request(`/projects/${projectId}/runs${query}`);
  }

  async createTestRun(
    projectId: number,
    input: {
      name: string;
      milestone_id?: number;
      case_ids?: number[];
      include_all?: boolean;
      tags?: string[];
      assignee_id?: number;
      config_id?: number;
    }
  ): Promise<{ result: TestmoTestRun }> {
    return this.request(`/projects/${projectId}/runs`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async getTestRun(runId: number): Promise<{ result: TestmoTestRun }> {
    return this.request(`/runs/${runId}`);
  }

  async updateTestRun(
    runId: number,
    input: { name?: string; milestone_id?: number; state_id?: number; is_closed?: boolean; config_id?: number }
  ): Promise<{ result: TestmoTestRun }> {
    return this.request(`/runs/${runId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async deleteTestRun(runId: number): Promise<void> {
    await this.request(`/runs/${runId}`, { method: "DELETE" });
  }

  // ── Run Results (manual test runs) ────────────────────────────────────────────

  async getRunResults(
    runId: number,
    params?: { status_id?: string; assignee_id?: number; get_latest_result?: boolean }
  ): Promise<TestmoPaginatedResponse<TestmoRunResult>> {
    const query = this.buildQuery({
      status_id: params?.status_id,
      assignee_id: params?.assignee_id,
      get_latest_result: params?.get_latest_result,
    });
    return this.request(`/runs/${runId}/results${query}`);
  }

  async createRunResult(
    runId: number,
    testId: number,
    input: { status_id: number; comment?: string; elapsed?: number; assignee_id?: number }
  ): Promise<{ result: TestmoRunResult }> {
    return this.request(`/runs/${runId}/tests/${testId}/results`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async createRunResultsBulk(
    runId: number,
    results: Array<{
      test_id: number;
      status_id: number;
      comment?: string;
      elapsed?: number;
      assignee_id?: number;
    }>
  ): Promise<TestmoRunResult[]> {
    return this.request(`/runs/${runId}/tests/results/bulk`, {
      method: "POST",
      body: JSON.stringify({ results }),
    });
  }

  async updateRunResult(
    runId: number,
    resultId: number,
    input: { status_id?: number; comment?: string; elapsed?: number; assignee_id?: number }
  ): Promise<{ result: TestmoRunResult }> {
    return this.request(`/runs/${runId}/results/${resultId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  // ── Sessions ──────────────────────────────────────────────────────────────────

  async listSessions(
    projectId: number,
    params?: { page?: number; per_page?: number; is_closed?: boolean; assignee_id?: number; name?: string }
  ): Promise<TestmoPaginatedResponse<TestmoSession>> {
    const query = this.buildQuery({
      page: params?.page,
      per_page: params?.per_page,
      is_closed: params?.is_closed,
      assignee_id: params?.assignee_id,
      name: params?.name,
    });
    return this.request(`/projects/${projectId}/sessions${query}`);
  }

  async getSession(sessionId: number): Promise<{ result: TestmoSession }> {
    return this.request(`/sessions/${sessionId}`);
  }

  async createSession(
    projectId: number,
    input: {
      name: string;
      session_type_id?: number;
      milestone_id?: number;
      assignee_id?: number;
      config_id?: number;
      estimate?: string;
      tags?: string[];
    }
  ): Promise<{ result: TestmoSession }> {
    return this.request(`/projects/${projectId}/sessions`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async updateSession(
    sessionId: number,
    input: {
      name?: string;
      session_type_id?: number;
      milestone_id?: number;
      assignee_id?: number;
      config_id?: number;
      estimate?: string;
      is_closed?: boolean;
      tags?: string[];
    }
  ): Promise<{ result: TestmoSession }> {
    return this.request(`/sessions/${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async deleteSession(sessionId: number): Promise<void> {
    await this.request(`/sessions/${sessionId}`, { method: "DELETE" });
  }

  // ── Automation Sources ────────────────────────────────────────────────────────

  async listAutomationSources(
    projectId: number,
    params?: { is_retired?: boolean }
  ): Promise<TestmoPaginatedResponse<TestmoAutomationSource>> {
    const query = this.buildQuery({ is_retired: params?.is_retired });
    return this.request(`/projects/${projectId}/automation/sources${query}`);
  }

  async getAutomationSource(id: number): Promise<{ result: TestmoAutomationSource }> {
    return this.request(`/automation/sources/${id}`);
  }

  // ── Milestones ────────────────────────────────────────────────────────────────

  async listMilestones(
    projectId: number,
    params?: { page?: number; per_page?: number; is_completed?: boolean; parent_id?: number; name?: string }
  ): Promise<TestmoPaginatedResponse<TestmoMilestone>> {
    const query = this.buildQuery({
      page: params?.page,
      per_page: params?.per_page,
      is_completed: params?.is_completed,
      parent_id: params?.parent_id,
      name: params?.name,
    });
    return this.request(`/projects/${projectId}/milestones${query}`);
  }

  async getMilestone(milestoneId: number): Promise<{ result: TestmoMilestone }> {
    return this.request(`/milestones/${milestoneId}`);
  }

  async createMilestone(
    projectId: number,
    input: {
      name: string;
      type_id?: number;
      note?: string;
      start_date?: string;
      due_date?: string;
      parent_id?: number;
    }
  ): Promise<{ result: TestmoMilestone }> {
    return this.request(`/projects/${projectId}/milestones`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async updateMilestone(
    milestoneId: number,
    input: {
      name?: string;
      type_id?: number;
      note?: string;
      start_date?: string;
      due_date?: string;
      is_started?: boolean;
      is_completed?: boolean;
    }
  ): Promise<{ result: TestmoMilestone }> {
    return this.request(`/milestones/${milestoneId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async deleteMilestone(milestoneId: number): Promise<void> {
    await this.request(`/milestones/${milestoneId}`, { method: "DELETE" });
  }

  async getMilestoneTypes(projectId: number): Promise<{ result: TestmoMilestoneType[] }> {
    return this.request(`/projects/${projectId}/milestone-types`);
  }

  // ── Project reference data ────────────────────────────────────────────────────

  async getProjectConfigs(projectId: number): Promise<{ result: TestmoProjectConfig[] }> {
    return this.request(`/projects/${projectId}/configs`);
  }

  async getFields(
    projectId: number,
    entity?: "repository_case" | "session" | "run_result"
  ): Promise<TestmoPaginatedResponse<TestmoField>> {
    const query = this.buildQuery({ entity });
    return this.request(`/projects/${projectId}/fields${query}`);
  }

  async getProjectRepos(projectId: number): Promise<{ result: TestmoProjectRepo[] }> {
    return this.request(`/projects/${projectId}/repos`);
  }

  async getProjectStates(projectId: number): Promise<{ result: TestmoProjectState[] }> {
    return this.request(`/projects/${projectId}/states`);
  }

  async getProjectStatuses(projectId: number): Promise<{ result: TestmoProjectStatus[] }> {
    return this.request(`/projects/${projectId}/statuses`);
  }

  async getProjectTags(projectId: number): Promise<{ result: TestmoProjectTag[] }> {
    return this.request(`/projects/${projectId}/tags`);
  }

  async getProjectTemplates(projectId: number): Promise<{ result: TestmoProjectTemplate[] }> {
    return this.request(`/projects/${projectId}/templates`);
  }

  async getProjectUsers(projectId: number): Promise<TestmoPaginatedResponse<{ id: number; name: string }>> {
    return this.request(`/projects/${projectId}/users`);
  }

  // ── Issues ────────────────────────────────────────────────────────────────────

  async getIssueConnections(params?: {
    integration_name?: string;
    connection_project_id?: string;
    is_active?: boolean;
  }): Promise<TestmoPaginatedResponse<TestmoIssueConnection>> {
    const query = this.buildQuery({
      integration_name: params?.integration_name,
      connection_project_id: params?.connection_project_id,
      is_active: params?.is_active,
    });
    return this.request(`/issues/connections${query}`);
  }

  // ── Users ─────────────────────────────────────────────────────────────────────

  async getCurrentUser(): Promise<TestmoCurrentUser> {
    return this.request("/user");
  }

  async listUsers(params?: {
    page?: number;
    per_page?: number;
  }): Promise<TestmoPaginatedResponse<TestmoUser>> {
    const query = this.buildQuery({ page: params?.page, per_page: params?.per_page });
    return this.request(`/users${query}`);
  }

  async getUser(id: number): Promise<{ result: TestmoUser }> {
    return this.request(`/users/${id}`);
  }

  // ── Groups ────────────────────────────────────────────────────────────────────

  async listGroups(): Promise<TestmoPaginatedResponse<TestmoGroup>> {
    return this.request("/groups");
  }

  async getGroup(id: number): Promise<{ result: TestmoGroup }> {
    return this.request(`/groups/${id}`);
  }

  // ── Roles ─────────────────────────────────────────────────────────────────────

  async listRoles(): Promise<TestmoPaginatedResponse<TestmoRole>> {
    return this.request("/roles");
  }

  async getRole(id: number): Promise<{ result: TestmoRole }> {
    return this.request(`/roles/${id}`);
  }
}
