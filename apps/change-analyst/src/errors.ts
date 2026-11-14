// Only fixed, application-authored messages are safe to print; provider errors can contain secrets.
export class AnalystError extends Error {}
