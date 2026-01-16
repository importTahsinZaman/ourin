// OpenTelemetry auto-instrumentation disabled - we use direct Langfuse SDK
// in the chat route for accurate token counts (AI SDK telemetry underreports)
export function register() {
  // intentionally empty - manual tracing via langfuse SDK in route handlers
}
