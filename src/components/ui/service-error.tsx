import { AlertCircle } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type ServiceErrorProps = {
  error: string | null
  onRetry?: () => void
  className?: string
}

function isPermissionError(err: string): boolean {
  const lower = err.toLowerCase()
  return (
    lower.includes("403") ||
    lower.includes("forbidden") ||
    lower.includes("insufficient") ||
    lower.includes("scope") ||
    lower.includes("disabled") ||
    lower.includes("enable it") ||
    lower.includes("not been used in project") ||
    lower.includes("access denied") ||
    lower.includes("permission") ||
    lower.includes("not authorized")
  )
}

function isApiNotEnabled(err: string): boolean {
  return (
    err.includes("has not been used in project") ||
    err.includes("it is disabled") ||
    err.includes("Enable it by visiting")
  )
}

function getErrorInfo(err: string): { title: string; description: string } {
  if (isApiNotEnabled(err)) {
    return {
      title: "API not enabled",
      description: "This Google API is not enabled in your Cloud project. Enable it in the Google Cloud Console and try again.",
    }
  }
  if (isPermissionError(err)) {
    return {
      title: "Access denied",
      description: "Your account does not have permission for this service. Check that the required scopes are granted and the API is enabled.",
    }
  }
  return {
    title: "Failed to load",
    description: err,
  }
}

export function ServiceError({ error, onRetry, className }: ServiceErrorProps) {
  if (!error) return null

  const { title, description } = getErrorInfo(error)

  return (
    <div className={className ?? "py-8 flex justify-center px-4 w-full"}>
      <Card className="max-w-md w-full border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
          {onRetry && (
            <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={onRetry}>
              Try again
            </Button>
          )}
        </CardHeader>
      </Card>
    </div>
  )
}
