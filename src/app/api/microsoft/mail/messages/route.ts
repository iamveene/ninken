import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, badRequest, serverError } from "@/app/api/_helpers"
import { graphPaginated, graphJson } from "@/lib/microsoft"

export async function GET(request: Request) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const top = Math.min(Number(searchParams.get("top")) || 25, 100)
    const select = searchParams.get("select") || "id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,hasAttachments,flag"
    const pageToken = searchParams.get("pageToken") || undefined

    const result = await graphPaginated(credential, "/me/messages", {
      top,
      select,
      orderby: "receivedDateTime desc",
      pageToken,
    })

    return NextResponse.json({
      messages: result.value,
      nextPageToken: result.nextPageToken,
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}

export async function POST(request: Request) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const body = await request.json()
    const { subject, bodyContent, toRecipients, ccRecipients, bccRecipients } = body

    if (!subject || !toRecipients || !Array.isArray(toRecipients) || toRecipients.length === 0) {
      return badRequest("Missing required fields: subject, toRecipients")
    }

    const formatRecipients = (list: { address: string; name?: string }[]) =>
      list.map((r) => ({
        emailAddress: {
          address: r.address,
          name: r.name || r.address,
        },
      }))

    const payload = {
      message: {
        subject,
        body: {
          contentType: "HTML",
          content: bodyContent || "",
        },
        toRecipients: formatRecipients(toRecipients),
        ...(ccRecipients?.length && { ccRecipients: formatRecipients(ccRecipients) }),
        ...(bccRecipients?.length && { bccRecipients: formatRecipients(bccRecipients) }),
      },
      saveToSentItems: true,
    }

    await graphJson(credential, "/me/sendMail", {
      method: "POST",
      body: JSON.stringify(payload),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
