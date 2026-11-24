/**
 * Error thrown for invalid configurations, missing dependencies and template problems.
 * `problems` contains one human readable entry per detected issue.
 */
export class SimpleFormError extends Error {
  constructor(message, problems = []) {
    super(problems.length ? `${message}\n - ${problems.join('\n - ')}` : message);
    this.name = 'SimpleFormError';
    this.problems = problems;
  }
}
