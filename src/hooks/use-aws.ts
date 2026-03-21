"use client"

import { useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST } from "@/lib/cache"

// ── Types ────────────────────────────────────────────────────────────

export type AwsIdentityInfo = {
  accountId: string
  arn: string
  userId: string
  region: string
}

export type AwsS3Bucket = {
  name: string
  creationDate: string | null
}

export type AwsS3Object = {
  key: string
  lastModified: string | null
  size: number
  storageClass: string | null
  isPrefix: boolean
}

export type AwsIamUser = {
  userName: string
  userId: string
  arn: string
  createDate: string
  passwordLastUsed: string | null
  accessKeys: { accessKeyId: string; status: string; createDate: string }[]
}

export type AwsIamRole = {
  roleName: string
  roleId: string
  arn: string
  createDate: string
  description: string | null
  maxSessionDuration: number
  assumeRolePolicyDocument: string | null
}

export type AwsIamPolicy = {
  policyName: string
  policyId: string
  arn: string
  createDate: string
  updateDate: string
  attachmentCount: number
  isAttachable: boolean
  description: string | null
}

export type AwsIamGroup = {
  groupName: string
  groupId: string
  arn: string
  createDate: string
}

export type AwsLambdaFunction = {
  functionName: string
  functionArn: string
  runtime: string | null
  handler: string | null
  codeSize: number
  description: string | null
  timeout: number | null
  memorySize: number | null
  lastModified: string | null
  role: string
}

export type AwsEc2Instance = {
  instanceId: string
  instanceType: string
  state: string
  publicIp: string | null
  privateIp: string | null
  launchTime: string | null
  vpcId: string | null
  subnetId: string | null
  name: string | null
  platform: string | null
}

export type AwsSecurityGroup = {
  groupId: string
  groupName: string
  description: string | null
  vpcId: string | null
  inboundRules: { protocol: string; fromPort: number | null; toPort: number | null; source: string }[]
  outboundRules: { protocol: string; fromPort: number | null; toPort: number | null; destination: string }[]
}

export type AwsCloudTrailEvent = {
  eventId: string
  eventName: string
  eventTime: string
  eventSource: string
  username: string | null
  sourceIp: string | null
  resources: { resourceType: string; resourceName: string }[]
  readOnly: boolean | null
}

export type AwsCloudTrailTrail = {
  name: string
  s3BucketName: string | null
  isMultiRegionTrail: boolean
  homeRegion: string | null
  isLogging: boolean | null
}

export type AwsSecret = {
  name: string
  arn: string
  description: string | null
  lastChangedDate: string | null
  lastRotatedDate: string | null
  rotationEnabled: boolean
  tags: { key: string; value: string }[]
}

// ── Hooks ────────────────────────────────────────────────────────────

export function useAwsIdentity() {
  const cacheKey = "aws:me"

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/aws/me")
    if (!res.ok) throw new Error("Failed to fetch AWS identity")
    return (await res.json()) as AwsIdentityInfo
  }, [])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return { identity: data, loading, error, refetch }
}

export function useAwsS3Buckets() {
  const cacheKey = "aws:s3:buckets"

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/aws/s3/buckets")
    if (!res.ok) throw new Error("Failed to fetch S3 buckets")
    const json = await res.json()
    return {
      buckets: (json.buckets ?? []) as AwsS3Bucket[],
      totalCount: (json.totalCount ?? 0) as number,
    }
  }, [])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    buckets: data?.buckets ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
  }
}

export function useAwsS3Objects(bucket?: string, prefix?: string, region?: string) {
  const cacheKey = bucket ? `aws:s3:objects:${bucket}:${prefix ?? ""}:${region ?? ""}` : null

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (bucket) params.set("bucket", bucket)
    if (prefix) params.set("prefix", prefix)
    if (region) params.set("region", region)
    const res = await fetch(`/api/aws/s3/objects?${params}`)
    if (!res.ok) throw new Error("Failed to fetch S3 objects")
    const json = await res.json()
    return {
      objects: (json.objects ?? []) as AwsS3Object[],
      prefixes: (json.prefixes ?? []) as string[],
      totalCount: (json.totalCount ?? 0) as number,
    }
  }, [bucket, prefix, region])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    objects: data?.objects ?? [],
    prefixes: data?.prefixes ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
  }
}

export function useAwsIamUsers() {
  const cacheKey = "aws:iam:users"

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/aws/iam/users")
    if (!res.ok) throw new Error("Failed to fetch IAM users")
    const json = await res.json()
    return {
      users: (json.users ?? []) as AwsIamUser[],
      totalCount: (json.totalCount ?? 0) as number,
    }
  }, [])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    users: data?.users ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
  }
}

export function useAwsIamRoles() {
  const cacheKey = "aws:iam:roles"

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/aws/iam/roles")
    if (!res.ok) throw new Error("Failed to fetch IAM roles")
    const json = await res.json()
    return {
      roles: (json.roles ?? []) as AwsIamRole[],
      totalCount: (json.totalCount ?? 0) as number,
    }
  }, [])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    roles: data?.roles ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
  }
}

export function useAwsIamPolicies() {
  const cacheKey = "aws:iam:policies"

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/aws/iam/policies")
    if (!res.ok) throw new Error("Failed to fetch IAM policies")
    const json = await res.json()
    return {
      policies: (json.policies ?? []) as AwsIamPolicy[],
      totalCount: (json.totalCount ?? 0) as number,
    }
  }, [])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    policies: data?.policies ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
  }
}

export function useAwsIamGroups() {
  const cacheKey = "aws:iam:groups"

  const fetcher = useCallback(async () => {
    const res = await fetch("/api/aws/iam/groups")
    if (!res.ok) throw new Error("Failed to fetch IAM groups")
    const json = await res.json()
    return {
      groups: (json.groups ?? []) as AwsIamGroup[],
      totalCount: (json.totalCount ?? 0) as number,
    }
  }, [])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    groups: data?.groups ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
  }
}

export function useAwsLambdaFunctions(region?: string) {
  const cacheKey = `aws:lambda:functions:${region ?? "default"}`

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (region) params.set("region", region)
    const res = await fetch(`/api/aws/lambda/functions?${params}`)
    if (!res.ok) throw new Error("Failed to fetch Lambda functions")
    const json = await res.json()
    return {
      functions: (json.functions ?? []) as AwsLambdaFunction[],
      totalCount: (json.totalCount ?? 0) as number,
    }
  }, [region])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    functions: data?.functions ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
  }
}

export function useAwsEc2Instances(region?: string) {
  const cacheKey = `aws:ec2:instances:${region ?? "default"}`

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (region) params.set("region", region)
    const res = await fetch(`/api/aws/ec2/instances?${params}`)
    if (!res.ok) throw new Error("Failed to fetch EC2 instances")
    const json = await res.json()
    return {
      instances: (json.instances ?? []) as AwsEc2Instance[],
      totalCount: (json.totalCount ?? 0) as number,
    }
  }, [region])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    instances: data?.instances ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
  }
}

export function useAwsSecurityGroups(region?: string) {
  const cacheKey = `aws:ec2:sgs:${region ?? "default"}`

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (region) params.set("region", region)
    const res = await fetch(`/api/aws/ec2/security-groups?${params}`)
    if (!res.ok) throw new Error("Failed to fetch security groups")
    const json = await res.json()
    return {
      securityGroups: (json.securityGroups ?? []) as AwsSecurityGroup[],
      totalCount: (json.totalCount ?? 0) as number,
    }
  }, [region])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    securityGroups: data?.securityGroups ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
  }
}

export function useAwsCloudTrailEvents(region?: string, startTime?: string, endTime?: string) {
  const cacheKey = `aws:cloudtrail:events:${region ?? "default"}:${startTime ?? ""}:${endTime ?? ""}`

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (region) params.set("region", region)
    if (startTime) params.set("startTime", startTime)
    if (endTime) params.set("endTime", endTime)
    const res = await fetch(`/api/aws/cloudtrail/events?${params}`)
    if (!res.ok) throw new Error("Failed to fetch CloudTrail events")
    const json = await res.json()
    return {
      events: (json.events ?? []) as AwsCloudTrailEvent[],
      totalCount: (json.totalCount ?? 0) as number,
    }
  }, [region, startTime, endTime])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    events: data?.events ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
  }
}

export function useAwsCloudTrailTrails(region?: string) {
  const cacheKey = `aws:cloudtrail:trails:${region ?? "default"}`

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (region) params.set("region", region)
    const res = await fetch(`/api/aws/cloudtrail/trails?${params}`)
    if (!res.ok) throw new Error("Failed to fetch CloudTrail trails")
    const json = await res.json()
    return {
      trails: (json.trails ?? []) as AwsCloudTrailTrail[],
      totalCount: (json.totalCount ?? 0) as number,
    }
  }, [region])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    trails: data?.trails ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
  }
}

export function useAwsSecrets(region?: string) {
  const cacheKey = `aws:secrets:list:${region ?? "default"}`

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (region) params.set("region", region)
    const res = await fetch(`/api/aws/secrets/list?${params}`)
    if (!res.ok) throw new Error("Failed to fetch secrets")
    const json = await res.json()
    return {
      secrets: (json.secrets ?? []) as AwsSecret[],
      totalCount: (json.totalCount ?? 0) as number,
    }
  }, [region])

  const { data, loading, error, refetch } = useCachedQuery(cacheKey, fetcher, {
    ttlMs: CACHE_TTL_LIST,
  })

  return {
    secrets: data?.secrets ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
  }
}
