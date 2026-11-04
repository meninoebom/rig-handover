export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  rows: DigestRow[];
  badLines: number;
  counts: Record<RunStatus, number>;
};

export type ReadNight = (runsDir: string, night: string) => Night | null;
