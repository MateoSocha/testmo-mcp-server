import type {
  TestmoProject,
  TestmoTestCase,
  TestmoCreateCaseInput,
  TestmoUpdateCasesInput,
  TestmoFolder,
  TestmoAutomationRun,
  TestmoRunThread,
  TestmoRunResult,
  TestmoTestRun,
  TestmoSession,
  TestmoAutomationSource,
  TestmoMilestone,
  TestmoUser,
  TestmoGroup,
  TestmoRole,
  TestmoAttachment,
  TestmoPaginatedResponse,
} from "./types.js";

export class TestmoClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const res = await fetch(url, { ...options, headers: this.headers });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Testmo API ${res.status} ${res.statusText}: ${body}`);
    }

    if (res.status === 204) return {} as T;
    return res.json() as Promise<T>;
  }

  private buildQuery(params: Record<string, string | number | undefined>): string {
    const qs = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined) qs.set(key, String(val));
    }
    return qs.toString() ? `?${qs}` : "";
  }

  // ── Projects ─────────────────────────────────────────────────────────────────

  async listProjects(): Promise<TestmoPaginatedResponse<TestmoProject>> {
    return this.request("/projects");
  }

  async getProject(id: number): Promise<{ data: TestmoProject }> {
    return this.request(`/projects/${id}`);
  }

  // ── Folders ───────────────────────────────────────────────────────────────────

  async listFolders(
    projectId: number,
    params?: { page?: number; limit?: number }
  ): Promise<TestmoPaginatedResponse<TestmoFolder>> {
    const query = this.buildQuery({ page: params?.page, limit: params?.limit });
    return this.request(`/projects/${projectId}/folders${query}`);
  }

  async createFolders(
    projectId: number,
    folders: Array<{ name: string; parent_id?: number }>
  ): Promise<{ data: TestmoFolder[] }> {
    return this.request(`/projects/${projectId}/folders`, {
      method: "POST",
      body: JSON.stringify({ folders }),
    });
  }

  async updateFolders(
    projectId: number,
    folders: Array<{ id: number; name?: string; parent_id?: number }>
  ): Promise<{ data: TestmoFolder[] }> {
    return this.request(`/projects/${projectId}/folders`, {
      method: "PATCH",
      body: JSON.stringify({ folders }),
    });
  }

  async deleteFolders(projectId: number, ids: number[]): Promise<void> {
    await this.request(`/projects/${projectId}/folders`, {
      method: "DELETE",
      body: JSON.stringify({ folder_ids: ids }),
    });
  }

  // ── Test Cases ────────────────────────────────────────────────────────────────

  async listCases(
    projectId: number,
    params?: { page?: number; limit?: number; folder_id?: number }
  ): Promise<TestmoPaginatedResponse<TestmoTestCase>> {
    const query = this.buildQuery({
      page: params?.page,
      limit: params?.limit,
      folder_id: params?.folder_id,
    });
    return this.request(`/projects/${projectId}/cases${query}`);
  }

  async getCase(caseId: number): Promise<{ data: TestmoTestCase }> {
    return this.request(`/cases/${caseId}`);
  }

  async createCase(
    projectId: number,
    input: TestmoCreateCaseInput
  ): Promise<{ data: TestmoTestCase[] }> {
    return this.request(`/projects/${projectId}/cases`, {
      method: "POST",
      body: JSON.stringify({ cases: [input] }),
    });
  }

  async updateCases(
    projectId: number,
    input: TestmoUpdateCasesInput
  ): Promise<{ data: TestmoTestCase[] }> {
    return this.request(`/projects/${projectId}/cases`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async deleteCases(projectId: number, ids: number[]): Promise<void> {
    await this.request(`/projects/${projectId}/cases`, {
      method: "DELETE",
      body: JSON.stringify({ case_ids: ids }),
    });
  }

  // ── Attachments ───────────────────────────────────────────────────────────────

  async listAttachments(caseId: number): Promise<{ data: TestmoAttachment[] }> {
    return this.request(`/cases/${caseId}/attachments`);
  }

  async deleteAttachments(caseId: number, ids: number[]): Promise<void> {
    await this.request(`/cases/${caseId}/attachments`, {
      method: "DELETE",
      body: JSON.stringify({ attachment_ids: ids }),
    });
  }

  // ── Automation Runs ───────────────────────────────────────────────────────────

  async listRuns(
    projectId: number,
    params?: { page?: number; limit?: number; status?: number }
  ): Promise<TestmoPaginatedResponse<TestmoAutomationRun>> {
    const query = this.buildQuery({
      page: params?.page,
      limit: params?.limit,
      status: params?.status,
    });
    return this.request(`/projects/${projectId}/automation/runs${query}`);
  }

  async createRun(
    projectId: number,
    input: { name: string; source?: string }
  ): Promise<{ data: TestmoAutomationRun }> {
    return this.request(`/projects/${projectId}/automation/runs`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async completeRun(projectId: number, runId: number): Promise<void> {
    await this.request(
      `/projects/${projectId}/automation/runs/${runId}/complete`,
      { method: "POST" }
    );
  }

  async createRunThread(
    projectId: number,
    runId: number,
    input: { name: string }
  ): Promise<{ data: TestmoRunThread }> {
    return this.request(
      `/projects/${projectId}/automation/runs/${runId}/threads`,
      { method: "POST", body: JSON.stringify(input) }
    );
  }

  async appendToRun(
    runId: number,
    input: {
      artifacts?: Array<{ name: string; url: string }>;
      links?: Array<{ name: string; url: string }>;
      custom_fields?: Record<string, unknown>;
    }
  ): Promise<void> {
    await this.request(`/automation/runs/${runId}/append`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  // ── Run Results ───────────────────────────────────────────────────────────────

  async getRunResults(
    projectId: number,
    runId: number,
    params?: { page?: number; limit?: number }
  ): Promise<TestmoPaginatedResponse<TestmoRunResult>> {
    const query = this.buildQuery({ page: params?.page, limit: params?.limit });
    return this.request(
      `/projects/${projectId}/automation/runs/${runId}/results${query}`
    );
  }

  // ── Test Runs (manual) ────────────────────────────────────────────────────────

  async listTestRuns(
    projectId: number,
    params?: { page?: number; limit?: number }
  ): Promise<TestmoPaginatedResponse<TestmoTestRun>> {
    const query = this.buildQuery({ page: params?.page, limit: params?.limit });
    return this.request(`/projects/${projectId}/runs${query}`);
  }

  // ── Sessions ──────────────────────────────────────────────────────────────────

  async listSessions(
    projectId: number,
    params?: { page?: number; limit?: number }
  ): Promise<TestmoPaginatedResponse<TestmoSession>> {
    const query = this.buildQuery({ page: params?.page, limit: params?.limit });
    return this.request(`/projects/${projectId}/sessions${query}`);
  }

  // ── Automation Sources ────────────────────────────────────────────────────────

  async listAutomationSources(
    projectId: number
  ): Promise<TestmoPaginatedResponse<TestmoAutomationSource>> {
    return this.request(`/projects/${projectId}/automation/sources`);
  }

  async getAutomationSource(id: number): Promise<{ data: TestmoAutomationSource }> {
    return this.request(`/automation/sources/${id}`);
  }

  // ── Milestones ────────────────────────────────────────────────────────────────

  async listMilestones(
    projectId: number,
    params?: { page?: number; limit?: number }
  ): Promise<TestmoPaginatedResponse<TestmoMilestone>> {
    const query = this.buildQuery({ page: params?.page, limit: params?.limit });
    return this.request(`/projects/${projectId}/milestones${query}`);
  }

  async getMilestone(
    projectId: number,
    milestoneId: number
  ): Promise<{ data: TestmoMilestone }> {
    return this.request(`/projects/${projectId}/milestones/${milestoneId}`);
  }

  // ── Users ─────────────────────────────────────────────────────────────────────

  async getCurrentUser(): Promise<{ data: TestmoUser }> {
    return this.request("/user");
  }

  async listUsers(
    params?: { page?: number; limit?: number }
  ): Promise<TestmoPaginatedResponse<TestmoUser>> {
    const query = this.buildQuery({ page: params?.page, limit: params?.limit });
    return this.request(`/users${query}`);
  }

  async getUser(id: number): Promise<{ data: TestmoUser }> {
    return this.request(`/users/${id}`);
  }

  // ── Groups ────────────────────────────────────────────────────────────────────

  async listGroups(): Promise<TestmoPaginatedResponse<TestmoGroup>> {
    return this.request("/groups");
  }

  async getGroup(id: number): Promise<{ data: TestmoGroup }> {
    return this.request(`/groups/${id}`);
  }

  // ── Roles ─────────────────────────────────────────────────────────────────────

  async listRoles(): Promise<TestmoPaginatedResponse<TestmoRole>> {
    return this.request("/roles");
  }

  async getRole(id: number): Promise<{ data: TestmoRole }> {
    return this.request(`/roles/${id}`);
  }
}
