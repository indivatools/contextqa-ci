/** Lifecycle stage of a run (`StatusConstant` on the server). */
export const RUN_STATUS_COMPLETED = 'STATUS_COMPLETED';

/** Overall verdict of a run or a test case (`ResultConstant` on the server). */
export type ResultValue =
  | 'SUCCESS'
  | 'FAILURE'
  | 'ABORTED'
  | 'NOT_EXECUTED'
  | 'QUEUED'
  | 'STOPPED'
  | 'SKIPPED'
  | 'IN_PROGRESS';

/** `GET /test_plans/build_upload_url` */
export interface UploadPair {
  key: string;
  putUrl: string;
}

/** `GET /test_plans/{id}/execution` */
export interface TriggerResponse {
  id: number;
  url?: string;
}

/** `GET /test_plan_results/{id}/results` (`TestPlanCIResultsApi`) */
export interface RunResults {
  status: string;
  result: string;
  duration?: number | null;
  totalCount: number;
  passedCount: number;
  failedCount: number;
  abortedCount: number;
  stoppedCount: number;
  notExecutedCount: number;
  reportFileUrl?: string | null;
}

/** One row of the run report, reduced to what a CI test tab can show. */
export interface TestCaseOutcome {
  id: number;
  name: string;
  suite: string;
  result: string;
  durationMs: number;
  message: string;
  traceViewerUrl?: string;
}

/** Where a mobile build comes from. */
export type BuildSource =
  | { kind: 'file'; path: string }
  | { kind: 'url'; url: string };

export interface RunOptions {
  /** API base, e.g. `https://server.contextqa.com`. */
  apiUrl: string;
  token: string;
  planId: string;
  /** Overrides the plan's environment for this run only. */
  environment?: string;
  androidBuild?: BuildSource;
  iosBuild?: BuildSource;
  /** Trigger and return without waiting for a verdict. */
  wait: boolean;
  pollIntervalSeconds: number;
  timeoutSeconds: number;
}

export interface RunSummary {
  runId: number;
  reportUrl?: string;
  /** Undefined when the caller did not wait. */
  results?: RunResults;
  /** Undefined when per-test details were not available for this credential. */
  testCases?: TestCaseOutcome[];
  passed: boolean;
}

/** Progress sink, implemented by each wrapper (console, GitHub log, ...). */
export interface Reporter {
  info(message: string): void;
  warn(message: string): void;
}
