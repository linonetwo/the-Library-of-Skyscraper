export interface RuleSourceProject {
  files: Record<string, string>;
  entry?: string;
}

export interface RuleDiagnostic {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
  code: number | string;
}

export interface RuleBundle {
  sourceHash: string;
  code: string;
  sourceMap: string;
  entry: string;
}

export interface CompileResult {
  diagnostics: RuleDiagnostic[];
  bundle?: RuleBundle;
}

export function compileRule(project: RuleSourceProject): Promise<CompileResult>;
