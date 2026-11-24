/** The latest review error as an alert, otherwise the current status or blocker. */
export function ReviewStatusMessage({
  error,
  message,
}: {
  error: string | null
  message: string
}) {
  return error ? (
    <p className="ml-auto text-[9px] text-destructive" role="alert">
      {error}
    </p>
  ) : (
    <p className="ml-auto text-[9px] text-muted-foreground" role="status">
      {message}
    </p>
  )
}
