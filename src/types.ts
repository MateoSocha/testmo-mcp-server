export interface TestmoProject {
  id: number;
  name: string;
  note?: string;
  is_completed: boolean;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  [key: string]: unknown;
}

export interface TestmoTestCase {
  id: number;
  project_id: number;
  repo_id?: number;
  name: string;
  key?: string;
  folder_id?: number;
  template_id?: number;
  state_id?: number;
  status_id?: number;
  estimate?: number;
  has_automation?: boolean;
  created_by?: number;
  created_at: string;
  updated_at?: string;
  tags?: string[];
  issues?: number[];
  automation_links?: unknown[];
  [key: string]: unknown;
}

export interface TestmoCaseCustomFields {
  custom_priority?: number;
  custom_description?: string;
  custom_expected?: string;
  custom_preconditions?: string;
  custom_bdddescription?: string;
  custom_steps?: Array<{ text1: string; text3?: string }>;
  [key: string]: unknown;
}

export interface TestmoCreateCaseInput extends TestmoCaseCustomFields {
  name: string;
  folder_id?: number;
  template_id?: number;
  state_id?: number;
  estimate?: number;
  tags?: string[];
  issues?: number[];
  automation_links?: number[];
  preconditions?: string;
  steps?: string;
  expected_result?: string;
}

export interface TestmoUpdateCasesInput extends TestmoCaseCustomFields {
  ids: number[];
  name?: string;
  folder_id?: number;
  state_id?: number;
  status_id?: number;
  estimate?: number;
  tags?: string[];
  issues?: number[];
  automation_links?: number[];
}

export interface TestmoFolder {
  id: number;
  project_id: number;
  repo_id?: number;
  name: string;
  parent_id?: number;
  depth?: number;
  docs?: string;
  display_order?: number;
  case_count?: number;
}

export interface TestmoAutomationRun {
  id: number;
  project_id: number;
  source_id?: number;
  name: string;
  status: number;
  config_id?: number;
  milestone_id?: number;
  elapsed?: number;
  is_completed?: boolean;
  tags?: string[];
  created_at?: string;
  [key: string]: unknown;
}

export interface TestmoRunThread {
  id: number;
}

export interface TestmoAutomationTest {
  automation_test_id: number;
  automation_case_id?: number;
  repository_case_id?: number;
  repository_case_ids?: number[];
  key?: string;
  name: string;
  folder?: string;
  status: number;
  elapsed?: number;
  thread_id?: number;
  created_at?: string;
}

export interface TestmoRunResult {
  id: number;
  project_id: number;
  run_id: number;
  test_id?: number;
  case_id?: number;
  status_id: number;
  is_latest?: boolean;
  note?: string;
  elapsed?: number;
  assignee_id?: number;
  issues?: number[];
  created_at: string;
  created_by?: number;
  [key: string]: unknown;
}

export interface TestmoTestRun {
  id: number;
  project_id: number;
  name: string;
  config_id?: number;
  milestone_id?: number;
  state_id?: number;
  is_started?: boolean;
  is_closed?: boolean;
  case_ids?: number[];
  tags?: string[];
  created_at?: string;
  [key: string]: unknown;
}

export interface TestmoSession {
  id: number;
  project_id: number;
  template_id?: number;
  name: string;
  note?: string;
  config_id?: number;
  milestone_id?: number;
  state_id?: number;
  assignee_id?: number;
  estimate?: string;
  is_started?: boolean;
  is_closed?: boolean;
  tags?: string[];
  [key: string]: unknown;
}

export interface TestmoAutomationSource {
  id: number;
  project_id: number;
  name: string;
  status?: number;
  is_retired?: boolean;
  run_count?: number;
  ran_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface TestmoAutomationCase {
  id: number;
  project_id: number;
  source_id: number;
  key?: string;
  name: string;
  folder?: string;
  status?: number;
  test_count?: number;
  success_count?: number;
  failure_count?: number;
  flaky_count?: number;
  flaky_percent?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TestmoMilestone {
  id: number;
  project_id: number;
  root_id?: number;
  parent_id?: number;
  type_id?: number;
  name: string;
  note?: string;
  is_started?: boolean;
  is_completed: boolean;
  start_date?: string;
  due_date?: string;
  automation_tags?: string[];
  started_at?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
}

export interface TestmoMilestoneType {
  id: number;
  name: string;
  is_default?: boolean;
}

export interface TestmoUser {
  id: number;
  name: string;
  email?: string;
  type?: string;
  timezone?: string;
  date_format?: string;
  time_format?: string;
  role_id?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface TestmoCurrentUser {
  id: number;
  name: string;
  timezone?: string;
  date_format?: string;
  time_format?: string;
}

export interface TestmoGroup {
  id: number;
  name: string;
  members?: number[];
  created_at: string;
  created_by?: number;
  updated_at?: string;
  updated_by?: number;
}

export interface TestmoRole {
  id: number;
  name: string;
  permissions?: unknown;
  is_default?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface TestmoAttachment {
  id: number;
  name: string;
  note?: string;
  mime_type?: string;
  size: number;
  created_at: string;
  created_by?: number;
  path?: string;
  path_thumbnail?: string;
  path_preview?: string;
}

export interface TestmoField {
  id: number;
  entity: string;
  type: string;
  name: string;
  system_name?: string;
  column_name?: string;
  note?: string;
  is_active?: boolean;
  is_compact?: boolean;
  is_multi?: boolean;
  include_all?: boolean;
  display_order?: number;
  options?: unknown;
}

export interface TestmoProjectState {
  id: number;
  entity: string;
  name: string;
  is_default?: boolean;
}

export interface TestmoProjectStatus {
  id: number;
  name: string;
  system_name?: string;
  color?: string;
  is_final?: boolean;
  is_untested?: boolean;
  is_passed?: boolean;
  is_failed?: boolean;
  is_active?: boolean;
  aliases?: string[];
}

export interface TestmoProjectTag {
  id: number;
  entity: string;
  name: string;
  usage_count?: number;
}

export interface TestmoProjectTemplate {
  id: number;
  name: string;
  is_default?: boolean;
  fields?: unknown[];
}

export interface TestmoProjectRepo {
  id: number;
  name: string;
  is_default?: boolean;
}

export interface TestmoProjectConfig {
  id: number;
  name: string;
}

export interface TestmoIssueConnection {
  integration_id: number;
  integration_type: string;
  integration_name: string;
  connection_id: number;
  connection_name?: string;
  connection_project_id?: string;
  connection_project_name?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TestmoCaseName {
  id: number;
  name: string;
  folder_id?: number;
}

export interface TestmoCaseResultHistoryEntry {
  id: number;
  project_id: number;
  run_id: number;
  test_id?: number;
  case_id: number;
  status_id: number;
  note?: string;
  elapsed?: number;
  assignee_id?: number;
  created_at: string;
  created_by?: number;
}

export interface TestmoPaginatedResponse<T> {
  page: number | null;
  prev_page: number | null;
  next_page: number | null;
  last_page: number | null;
  per_page: number;
  total: number;
  result: T[];
  expands?: Record<string, unknown>;
}
