"use client"

import { useState, useEffect } from "react"
import { useAwsLambdaFunctions } from "@/hooks/use-aws"
import { ExportButton } from "@/components/layout/export-button"
import { ServiceError } from "@/components/ui/service-error"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ExternalLink, Zap, AlertTriangle, CheckCircle2, Shield } from "lucide-react"

type LambdaUrlConfig = {
  functionName: string
  functionArn: string
  urlConfig: {
    functionUrl?: string
    authType?: string
    cors?: unknown
  } | null
  loading: boolean
  error: string | null
}

export default function AwsLambdaUrlsPage() {
  const { functions, loading, error, refetch } = useAwsLambdaFunctions()
  const [urlConfigs, setUrlConfigs] = useState<Record<string, LambdaUrlConfig>>({})
  const [scanning, setScanning] = useState(false)

  // Auto-scan function URL configs
  useEffect(() => {
    if (functions.length === 0 || scanning) return
    if (Object.keys(urlConfigs).length > 0) return

    setScanning(true)
    const scanUrls = async () => {
      for (const fn of functions) {
        setUrlConfigs((prev) => ({
          ...prev,
          [fn.functionName]: {
            functionName: fn.functionName,
            functionArn: fn.functionArn,
            urlConfig: null,
            loading: true,
            error: null,
          },
        }))

        try {
          const res = await fetch(
            `/api/aws/lambda/functions?functionName=${encodeURIComponent(fn.functionName)}&urlConfig=true`,
          )
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()

          setUrlConfigs((prev) => ({
            ...prev,
            [fn.functionName]: {
              functionName: fn.functionName,
              functionArn: fn.functionArn,
              urlConfig: data.urlConfig ?? null,
              loading: false,
              error: null,
            },
          }))
        } catch (e) {
          setUrlConfigs((prev) => ({
            ...prev,
            [fn.functionName]: {
              functionName: fn.functionName,
              functionArn: fn.functionArn,
              urlConfig: null,
              loading: false,
              error: e instanceof Error ? e.message : "Scan failed",
            },
          }))
        }
      }
      setScanning(false)
    }

    scanUrls()
  }, [functions, scanning, urlConfigs])

  const functionsWithUrls = Object.values(urlConfigs).filter((c) => c.urlConfig)
  const noAuthFunctions = functionsWithUrls.filter(
    (c) => c.urlConfig?.authType === "NONE",
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Lambda Function URLs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lambda function URL configurations with auth type analysis
          </p>
        </div>
        <ExportButton
          data={functionsWithUrls as unknown as Record<string, unknown>[]}
          filename="aws-audit-lambda-urls"
        />
      </div>

      {error && <ServiceError error={error} onRetry={refetch} />}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{functions.length}</p>
            <p className="text-[10px] text-muted-foreground">Total Functions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{functionsWithUrls.length}</p>
            <p className="text-[10px] text-muted-foreground">With URL Config</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${noAuthFunctions.length > 0 ? "text-red-400" : "text-emerald-400"}`}>
              {noAuthFunctions.length}
            </p>
            <p className="text-[10px] text-muted-foreground">No Auth (NONE)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">
              {functionsWithUrls.length - noAuthFunctions.length}
            </p>
            <p className="text-[10px] text-muted-foreground">IAM Auth</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Function</TableHead>
              <TableHead className="text-xs">URL</TableHead>
              <TableHead className="text-xs">Auth Type</TableHead>
              <TableHead className="text-xs">Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((__, j) => (
                    <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : functionsWithUrls.length === 0 && !scanning ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                  {functions.length === 0
                    ? "No Lambda functions found"
                    : "No functions with URL configurations found"}
                </TableCell>
              </TableRow>
            ) : (
              [...functionsWithUrls]
                .sort((a, b) => {
                  // NONE auth first
                  if (a.urlConfig?.authType === "NONE" && b.urlConfig?.authType !== "NONE") return -1
                  if (a.urlConfig?.authType !== "NONE" && b.urlConfig?.authType === "NONE") return 1
                  return 0
                })
                .map((config) => (
                  <TableRow key={config.functionName}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-medium">{config.functionName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {config.urlConfig?.functionUrl ?? "-"}
                    </TableCell>
                    <TableCell>
                      {config.urlConfig?.authType === "NONE" ? (
                        <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> NONE
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
                          <Shield className="h-2.5 w-2.5 mr-0.5" /> {config.urlConfig?.authType ?? "AWS_IAM"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {config.urlConfig?.authType === "NONE" ? (
                        <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Critical
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> OK
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
            )}
            {scanning && functionsWithUrls.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                  Scanning {functions.length} functions for URL configurations...
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
