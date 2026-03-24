import { NextResponse } from "next/server"
import {
  LambdaClient,
  ListFunctionsCommand,
  GetFunctionUrlConfigCommand,
  type FunctionConfiguration,
} from "@aws-sdk/client-lambda"
import { getAwsCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { createAwsClient, awsPaginateAll } from "@/lib/aws"

export const dynamic = "force-dynamic"

/**
 * GET /api/aws/lambda/functions?region=X
 * Lists all Lambda functions in the specified region.
 */
export async function GET(request: Request) {
  const credential = await getAwsCredential()
  if (!credential) return unauthorized()

  const { searchParams } = new URL(request.url)
  const region = searchParams.get("region") || undefined
  const functionName = searchParams.get("functionName")
  const urlConfig = searchParams.get("urlConfig") === "true"

  try {
    const lambda = createAwsClient(credential, LambdaClient, region)

    // Single-function URL config lookup
    if (urlConfig && functionName) {
      try {
        const res = await lambda.send(
          new GetFunctionUrlConfigCommand({ FunctionName: functionName }),
        )
        return NextResponse.json({
          urlConfig: {
            functionUrl: res.FunctionUrl ?? null,
            authType: res.AuthType ?? null,
            cors: res.Cors ?? null,
          },
        })
      } catch (err: unknown) {
        // ResourceNotFoundException means no URL config — not an error
        if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "ResourceNotFoundException") {
          return NextResponse.json({ urlConfig: null })
        }
        throw err
      }
    }

    // Default: list all functions
    const functions = await awsPaginateAll(
      (marker) => lambda.send(new ListFunctionsCommand({ Marker: marker, MaxItems: 50 })),
      (res) => res.Functions as FunctionConfiguration[],
      (res) => res.NextMarker,
      10,
    )

    const mapped = functions.map((fn) => ({
      functionName: fn.FunctionName ?? "",
      functionArn: fn.FunctionArn ?? "",
      runtime: fn.Runtime ?? null,
      handler: fn.Handler ?? null,
      codeSize: fn.CodeSize ?? 0,
      description: fn.Description ?? null,
      timeout: fn.Timeout ?? null,
      memorySize: fn.MemorySize ?? null,
      lastModified: fn.LastModified ?? null,
      role: fn.Role ?? "",
    }))

    return NextResponse.json({
      functions: mapped,
      totalCount: mapped.length,
    })
  } catch (error) {
    return serverError(error, "aws")
  }
}
