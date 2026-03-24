"use client"

import { useState, useEffect } from "react"
import { Eye, EyeOff, CheckCircle, XCircle, Loader2 } from "lucide-react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useSettings } from "@/hooks/use-settings"
import {
  PROVIDER_MODELS,
  LLM_PROVIDER_LABELS,
  getRecommendedModel,
  type LLMProviderId,
} from "@/lib/llm/types"

export function AISection() {
  const { settings, loading, saving, save, testConnection, testResult, testLoading } =
    useSettings()

  const [provider, setProvider] = useState<LLMProviderId>("anthropic")
  const [model, setModel] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [endpoint, setEndpoint] = useState("http://localhost:11434")
  const [customModel, setCustomModel] = useState("")
  const [showKey, setShowKey] = useState(false)

  // Load settings on mount
  useEffect(() => {
    if (settings) {
      setProvider(settings.ai.provider)
      setModel(settings.ai.model)
      setApiKey(settings.ai.apiKey)
      setEndpoint(settings.ai.endpoint || "http://localhost:11434")
      setCustomModel(settings.ai.customModel || "")
    }
  }, [settings])

  const handleProviderChange = (newProvider: LLMProviderId | null) => {
    if (!newProvider) return
    setProvider(newProvider)
    setModel(getRecommendedModel(newProvider))
  }

  const handleSave = () => {
    save({
      ai: {
        provider,
        model,
        apiKey,
        ...(provider === "ollama" ? { endpoint, customModel } : {}),
      },
    })
  }

  const handleTest = () => {
    testConnection({
      provider,
      model,
      apiKey,
      ...(provider === "ollama" ? { endpoint, customModel } : {}),
    })
  }

  if (loading) {
    return (
      <Card className="mt-4">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  const models = PROVIDER_MODELS[provider]

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>AI Provider</CardTitle>
        <CardDescription>
          Configure the LLM provider for the AI Partner assistant
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider selector */}
        <div className="space-y-2">
          <Label>Provider</Label>
          <Select
            value={provider}
            onValueChange={(v) => handleProviderChange(v as LLMProviderId)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(LLM_PROVIDER_LABELS) as LLMProviderId[]).map((p) => (
                <SelectItem key={p} value={p}>
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        p === "anthropic"
                          ? "bg-amber-500"
                          : p === "openai"
                            ? "bg-green-500"
                            : p === "gemini"
                              ? "bg-blue-500"
                              : p === "openrouter"
                                ? "bg-purple-500"
                                : "bg-gray-500"
                      }`}
                    />
                    {LLM_PROVIDER_LABELS[p]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Model selector */}
        <div className="space-y-2">
          <Label>Model</Label>
          <Select
            value={model}
            onValueChange={(v) => {
              if (v) setModel(v)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="flex items-center gap-2">
                    {m.name}
                    {m.recommended && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1 py-0"
                      >
                        recommended
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* API Key (hidden for Ollama) */}
        {provider !== "ollama" && (
          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`Enter your ${LLM_PROVIDER_LABELS[provider]} API key`}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Endpoint URL (Ollama only) */}
        {provider === "ollama" && (
          <div className="space-y-2">
            <Label>Endpoint URL</Label>
            <Input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="http://localhost:11434"
            />
          </div>
        )}

        {/* Custom model override (Ollama only) */}
        {provider === "ollama" && (
          <div className="space-y-2">
            <Label>Custom Model (optional)</Label>
            <Input
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="e.g. llama3.3:70b-instruct-q4_K_M"
            />
            <p className="text-xs text-muted-foreground">
              Override the model selection with a custom Ollama model tag
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save"
          )}
        </Button>
        <Button variant="outline" onClick={handleTest} disabled={testLoading}>
          {testLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            "Test Connection"
          )}
        </Button>
        {testResult && (
          <span className="flex items-center gap-1.5 text-sm">
            {testResult.success ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            <span
              className={
                testResult.success ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              }
            >
              {testResult.message}
            </span>
          </span>
        )}
      </CardFooter>
    </Card>
  )
}
