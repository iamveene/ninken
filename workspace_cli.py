#!/usr/bin/env python3
"""Google Workspace CLI - Gmail & Drive full access."""

import argparse
import base64
import io
import json
import mimetypes
import os
import sys
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email import encoders
from pathlib import Path

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/drive",
]

BASE_DIR = Path(__file__).parent
CLIENT_SECRET = BASE_DIR / ".secrets" / "client_secret.json"
TOKEN_FILE = BASE_DIR / ".secrets" / "token.json"


def get_credentials():
    creds = None
    if TOKEN_FILE.exists():
        with open(TOKEN_FILE) as f:
            info = json.load(f)
        creds = Credentials(
            token=info.get("token"),
            refresh_token=info["refresh_token"],
            client_id=info["client_id"],
            client_secret=info["client_secret"],
            token_uri=info.get("token_uri", "https://oauth2.googleapis.com/token"),
            scopes=SCOPES,
        )
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not CLIENT_SECRET.exists():
                print(f"Error: {CLIENT_SECRET} not found. See PLAYBOOK.md for setup.")
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRET), SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, "w") as f:
            json.dump({
                "token": creds.token,
                "refresh_token": creds.refresh_token,
                "client_id": creds.client_id,
                "client_secret": creds.client_secret,
                "token_uri": creds.token_uri,
            }, f, indent=2)
    return creds


def gmail_svc():
    return build("gmail", "v1", credentials=get_credentials())


def drive_svc():
    return build("drive", "v3", credentials=get_credentials())


def _get_headers(msg):
    return {h["name"]: h["value"] for h in msg["payload"].get("headers", [])}


def _get_body(payload):
    if payload.get("body", {}).get("data"):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")
    if payload.get("parts"):
        for part in payload["parts"]:
            if part["mimeType"] == "text/plain" and part.get("body", {}).get("data"):
                return base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")
        for part in payload["parts"]:
            result = _get_body(part)
            if result:
                return result
    return None


def _get_attachments(payload, msg_id=None):
    """Recursively find all attachments in a message payload."""
    attachments = []
    if payload.get("parts"):
        for part in payload["parts"]:
            filename = part.get("filename")
            if filename and part.get("body", {}).get("attachmentId"):
                attachments.append({
                    "filename": filename,
                    "mimeType": part.get("mimeType", "application/octet-stream"),
                    "size": part.get("body", {}).get("size", 0),
                    "attachmentId": part["body"]["attachmentId"],
                })
            attachments.extend(_get_attachments(part, msg_id))
    return attachments


def _print_msg_summary(msg_meta, svc):
    msg = svc.users().messages().get(
        userId="me", id=msg_meta["id"], format="metadata",
        metadataHeaders=["From", "To", "Subject", "Date"]
    ).execute()
    headers = {h["name"]: h["value"] for h in msg["payload"]["headers"]}
    labels = ", ".join(msg.get("labelIds", []))
    has_attach = "ATTACHMENT" if any(
        "filename" in str(msg.get("payload", {})) and "attachmentId" in str(msg.get("payload", {}))
        for _ in [1]
    ) else ""
    print(f"[{msg_meta['id']}] {headers.get('Date', 'N/A')}")
    print(f"  From: {headers.get('From', 'N/A')}")
    print(f"  To: {headers.get('To', 'N/A')}")
    print(f"  Subject: {headers.get('Subject', 'N/A')}")
    if has_attach:
        print(f"  [{has_attach}]")
    print()


# ════════════════════════════════════════════════════════════
# GMAIL COMMANDS
# ════════════════════════════════════════════════════════════

def gmail_profile(args):
    svc = gmail_svc()
    profile = svc.users().getProfile(userId="me").execute()
    print(f"Email: {profile['emailAddress']}")
    print(f"Total messages: {profile['messagesTotal']}")
    print(f"Total threads: {profile['threadsTotal']}")


def gmail_labels(args):
    svc = gmail_svc()
    results = svc.users().labels().list(userId="me").execute()
    for label in sorted(results.get("labels", []), key=lambda x: x["name"]):
        ltype = label.get("type", "")
        print(f"  {label['name']:40s} ({label['id']}) [{ltype}]")


def gmail_list(args):
    svc = gmail_svc()
    query = args.query or ""
    results = svc.users().messages().list(userId="me", q=query, maxResults=args.limit).execute()
    messages = results.get("messages", [])
    if not messages:
        print("No messages found.")
        return
    for msg_meta in messages:
        _print_msg_summary(msg_meta, svc)


def gmail_read(args):
    svc = gmail_svc()
    msg = svc.users().messages().get(userId="me", id=args.id, format="full").execute()
    headers = _get_headers(msg)
    print(f"From: {headers.get('From', 'N/A')}")
    print(f"To: {headers.get('To', 'N/A')}")
    print(f"Cc: {headers.get('Cc', 'N/A')}")
    print(f"Date: {headers.get('Date', 'N/A')}")
    print(f"Subject: {headers.get('Subject', 'N/A')}")
    print(f"Labels: {', '.join(msg.get('labelIds', []))}")

    attachments = _get_attachments(msg["payload"])
    if attachments:
        print(f"\nAttachments ({len(attachments)}):")
        for att in attachments:
            size_kb = att["size"] / 1024
            print(f"  - {att['filename']} ({size_kb:.1f} KB, {att['mimeType']})")

    print("─" * 60)
    body = _get_body(msg["payload"])
    print(body or "(no text body)")


def gmail_attachments(args):
    """Download all attachments from a message."""
    svc = gmail_svc()
    msg = svc.users().messages().get(userId="me", id=args.id, format="full").execute()
    attachments = _get_attachments(msg["payload"])

    if not attachments:
        print("No attachments found in this message.")
        return

    outdir = Path(args.output_dir)
    outdir.mkdir(parents=True, exist_ok=True)

    for att in attachments:
        data = svc.users().messages().attachments().get(
            userId="me", messageId=args.id, id=att["attachmentId"]
        ).execute()
        file_data = base64.urlsafe_b64decode(data["data"])
        filepath = outdir / att["filename"]
        # Avoid overwriting
        counter = 1
        while filepath.exists():
            stem = Path(att["filename"]).stem
            suffix = Path(att["filename"]).suffix
            filepath = outdir / f"{stem}_{counter}{suffix}"
            counter += 1
        filepath.write_bytes(file_data)
        print(f"  Saved: {filepath} ({len(file_data) / 1024:.1f} KB)")


def gmail_send(args):
    svc = gmail_svc()

    if args.attach:
        msg = MIMEMultipart()
        msg.attach(MIMEText(args.body))
        for filepath in args.attach:
            path = Path(filepath)
            if not path.exists():
                print(f"Error: attachment not found: {filepath}")
                sys.exit(1)
            mime_type = mimetypes.guess_type(filepath)[0] or "application/octet-stream"
            maintype, subtype = mime_type.split("/", 1)
            attachment = MIMEBase(maintype, subtype)
            attachment.set_payload(path.read_bytes())
            encoders.encode_base64(attachment)
            attachment.add_header("Content-Disposition", "attachment", filename=path.name)
            msg.attach(attachment)
    else:
        msg = MIMEText(args.body)

    msg["to"] = args.to
    if args.cc:
        msg["cc"] = args.cc
    if args.bcc:
        msg["bcc"] = args.bcc
    msg["subject"] = args.subject

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    result = svc.users().messages().send(userId="me", body={"raw": raw}).execute()
    print(f"Sent! Message ID: {result['id']}")


def gmail_reply(args):
    svc = gmail_svc()
    original = svc.users().messages().get(userId="me", id=args.id, format="metadata",
                                          metadataHeaders=["From", "Subject", "Message-ID", "References"]).execute()
    headers = {h["name"]: h["value"] for h in original["payload"]["headers"]}

    msg = MIMEText(args.body)
    msg["to"] = headers.get("From", "")
    subject = headers.get("Subject", "")
    if not subject.lower().startswith("re:"):
        subject = f"Re: {subject}"
    msg["subject"] = subject
    msg["In-Reply-To"] = headers.get("Message-ID", "")
    msg["References"] = headers.get("References", "") + " " + headers.get("Message-ID", "")

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    result = svc.users().messages().send(
        userId="me",
        body={"raw": raw, "threadId": original.get("threadId")}
    ).execute()
    print(f"Reply sent! Message ID: {result['id']}")


def gmail_forward(args):
    svc = gmail_svc()
    original = svc.users().messages().get(userId="me", id=args.id, format="full").execute()
    orig_headers = _get_headers(original)
    orig_body = _get_body(original["payload"]) or ""

    fwd_body = f"{args.body}\n\n---------- Forwarded message ----------\n"
    fwd_body += f"From: {orig_headers.get('From', '')}\n"
    fwd_body += f"Date: {orig_headers.get('Date', '')}\n"
    fwd_body += f"Subject: {orig_headers.get('Subject', '')}\n"
    fwd_body += f"To: {orig_headers.get('To', '')}\n\n"
    fwd_body += orig_body

    # Include original attachments
    attachments = _get_attachments(original["payload"])
    if attachments:
        msg = MIMEMultipart()
        msg.attach(MIMEText(fwd_body))
        for att in attachments:
            data = svc.users().messages().attachments().get(
                userId="me", messageId=args.id, id=att["attachmentId"]
            ).execute()
            file_data = base64.urlsafe_b64decode(data["data"])
            maintype, subtype = att["mimeType"].split("/", 1)
            attachment = MIMEBase(maintype, subtype)
            attachment.set_payload(file_data)
            encoders.encode_base64(attachment)
            attachment.add_header("Content-Disposition", "attachment", filename=att["filename"])
            msg.attach(attachment)
    else:
        msg = MIMEText(fwd_body)

    msg["to"] = args.to
    subject = orig_headers.get("Subject", "")
    if not subject.lower().startswith("fwd:"):
        subject = f"Fwd: {subject}"
    msg["subject"] = subject

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    result = svc.users().messages().send(userId="me", body={"raw": raw}).execute()
    print(f"Forwarded! Message ID: {result['id']}")


def gmail_trash(args):
    svc = gmail_svc()
    svc.users().messages().trash(userId="me", id=args.id).execute()
    print(f"Trashed: {args.id}")


def gmail_untrash(args):
    svc = gmail_svc()
    svc.users().messages().untrash(userId="me", id=args.id).execute()
    print(f"Restored: {args.id}")


def gmail_mark_read(args):
    svc = gmail_svc()
    svc.users().messages().modify(
        userId="me", id=args.id, body={"removeLabelIds": ["UNREAD"]}
    ).execute()
    print(f"Marked as read: {args.id}")


def gmail_mark_unread(args):
    svc = gmail_svc()
    svc.users().messages().modify(
        userId="me", id=args.id, body={"addLabelIds": ["UNREAD"]}
    ).execute()
    print(f"Marked as unread: {args.id}")


def gmail_modify_labels(args):
    svc = gmail_svc()
    body = {}
    if args.add:
        body["addLabelIds"] = args.add
    if args.remove:
        body["removeLabelIds"] = args.remove
    svc.users().messages().modify(userId="me", id=args.id, body=body).execute()
    print(f"Labels updated for: {args.id}")


def gmail_thread(args):
    svc = gmail_svc()
    thread = svc.users().threads().get(userId="me", id=args.id, format="metadata",
                                       metadataHeaders=["From", "Subject", "Date"]).execute()
    print(f"Thread: {args.id} ({len(thread['messages'])} messages)")
    print("─" * 60)
    for msg in thread["messages"]:
        headers = {h["name"]: h["value"] for h in msg["payload"]["headers"]}
        print(f"[{msg['id']}] {headers.get('Date', 'N/A')}")
        print(f"  From: {headers.get('From', 'N/A')}")
        print(f"  Subject: {headers.get('Subject', 'N/A')}")
        print()


def gmail_draft_create(args):
    svc = gmail_svc()
    msg = MIMEText(args.body)
    msg["to"] = args.to
    msg["subject"] = args.subject
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    result = svc.users().drafts().create(
        userId="me", body={"message": {"raw": raw}}
    ).execute()
    print(f"Draft created! ID: {result['id']}")


def gmail_draft_list(args):
    svc = gmail_svc()
    results = svc.users().drafts().list(userId="me", maxResults=args.limit).execute()
    drafts = results.get("drafts", [])
    if not drafts:
        print("No drafts.")
        return
    for draft in drafts:
        msg = svc.users().drafts().get(userId="me", id=draft["id"], format="metadata",
                                       metadataHeaders=["To", "Subject"]).execute()
        headers = {h["name"]: h["value"] for h in msg["message"]["payload"]["headers"]}
        print(f"[{draft['id']}] To: {headers.get('To', 'N/A')} | Subject: {headers.get('Subject', 'N/A')}")


def gmail_draft_send(args):
    svc = gmail_svc()
    result = svc.users().drafts().send(userId="me", body={"id": args.id}).execute()
    print(f"Draft sent! Message ID: {result['id']}")


def gmail_draft_delete(args):
    svc = gmail_svc()
    svc.users().drafts().delete(userId="me", id=args.id).execute()
    print(f"Draft deleted: {args.id}")


# ════════════════════════════════════════════════════════════
# DRIVE COMMANDS
# ════════════════════════════════════════════════════════════

def drive_list(args):
    svc = drive_svc()
    query = args.query or None
    params = {
        "pageSize": args.limit,
        "fields": "files(id,name,mimeType,modifiedTime,size,parents,shared)",
        "orderBy": "modifiedTime desc",
    }
    if query:
        params["q"] = query
    if args.folder:
        params["q"] = f"'{args.folder}' in parents"
    results = svc.files().list(**params).execute()
    files = results.get("files", [])
    if not files:
        print("No files found.")
        return
    for f in files:
        size = f.get("size", "-")
        shared = " [shared]" if f.get("shared") else ""
        print(f"[{f['id']}] {f['name']}{shared}")
        print(f"  Type: {f['mimeType']}  Modified: {f['modifiedTime']}  Size: {size}")
        print()


def drive_info(args):
    svc = drive_svc()
    f = svc.files().get(
        fileId=args.id,
        fields="id,name,mimeType,modifiedTime,createdTime,size,parents,shared,owners,webViewLink,description"
    ).execute()
    print(f"Name: {f['name']}")
    print(f"ID: {f['id']}")
    print(f"Type: {f['mimeType']}")
    print(f"Size: {f.get('size', 'N/A')}")
    print(f"Created: {f.get('createdTime', 'N/A')}")
    print(f"Modified: {f.get('modifiedTime', 'N/A')}")
    print(f"Shared: {f.get('shared', False)}")
    if f.get("owners"):
        print(f"Owner: {f['owners'][0].get('emailAddress', 'N/A')}")
    if f.get("parents"):
        print(f"Parent folder: {f['parents'][0]}")
    if f.get("webViewLink"):
        print(f"Link: {f['webViewLink']}")
    if f.get("description"):
        print(f"Description: {f['description']}")


def drive_download(args):
    svc = drive_svc()
    meta = svc.files().get(fileId=args.id, fields="name,mimeType").execute()
    filename = args.output or meta["name"]

    export_map = {
        "application/vnd.google-apps.document": ("application/pdf", ".pdf"),
        "application/vnd.google-apps.spreadsheet": ("text/csv", ".csv"),
        "application/vnd.google-apps.presentation": ("application/pdf", ".pdf"),
        "application/vnd.google-apps.drawing": ("image/png", ".png"),
    }

    if args.format and meta["mimeType"] in export_map:
        format_map = {
            "pdf": "application/pdf",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "csv": "text/csv",
            "txt": "text/plain",
            "png": "image/png",
            "jpg": "image/jpeg",
        }
        mime = format_map.get(args.format)
        if not mime:
            print(f"Unknown format: {args.format}. Available: {', '.join(format_map.keys())}")
            sys.exit(1)
        if not args.output:
            filename = f"{meta['name']}.{args.format}"
        request = svc.files().export_media(fileId=args.id, mimeType=mime)
    elif meta["mimeType"] in export_map:
        mime, ext = export_map[meta["mimeType"]]
        if not args.output:
            filename = meta["name"] + ext
        request = svc.files().export_media(fileId=args.id, mimeType=mime)
    else:
        request = svc.files().get_media(fileId=args.id)

    fh = io.FileIO(filename, "wb")
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
        if status:
            print(f"Download {int(status.progress() * 100)}%")
    print(f"Downloaded: {filename}")


def drive_upload(args):
    svc = drive_svc()
    mime_type = mimetypes.guess_type(args.file)[0] or "application/octet-stream"
    name = args.name or os.path.basename(args.file)
    metadata = {"name": name}
    if args.folder:
        metadata["parents"] = [args.folder]
    if args.description:
        metadata["description"] = args.description
    media = MediaFileUpload(args.file, mimetype=mime_type, resumable=True)
    result = svc.files().create(body=metadata, media_body=media, fields="id,name,webViewLink").execute()
    print(f"Uploaded: {result['name']} (ID: {result['id']})")
    if result.get("webViewLink"):
        print(f"Link: {result['webViewLink']}")


def drive_search(args):
    svc = drive_svc()
    q = f"fullText contains '{args.term}'"
    if args.type:
        type_map = {
            "doc": "application/vnd.google-apps.document",
            "sheet": "application/vnd.google-apps.spreadsheet",
            "slide": "application/vnd.google-apps.presentation",
            "folder": "application/vnd.google-apps.folder",
            "pdf": "application/pdf",
            "image": "application/vnd.google-apps.photo",
        }
        mime = type_map.get(args.type, args.type)
        q += f" and mimeType='{mime}'"
    results = svc.files().list(
        q=q, pageSize=args.limit,
        fields="files(id,name,mimeType,modifiedTime,size)"
    ).execute()
    files = results.get("files", [])
    if not files:
        print("No files found.")
        return
    for f in files:
        size = f.get("size", "-")
        print(f"[{f['id']}] {f['name']}")
        print(f"  Type: {f['mimeType']}  Modified: {f['modifiedTime']}  Size: {size}")


def drive_mkdir(args):
    svc = drive_svc()
    metadata = {
        "name": args.name,
        "mimeType": "application/vnd.google-apps.folder",
    }
    if args.parent:
        metadata["parents"] = [args.parent]
    result = svc.files().create(body=metadata, fields="id,name").execute()
    print(f"Created folder: {result['name']} (ID: {result['id']})")


def drive_move(args):
    svc = drive_svc()
    f = svc.files().get(fileId=args.id, fields="parents").execute()
    previous_parents = ",".join(f.get("parents", []))
    result = svc.files().update(
        fileId=args.id,
        addParents=args.folder,
        removeParents=previous_parents,
        fields="id,name,parents"
    ).execute()
    print(f"Moved: {result['name']} -> folder {args.folder}")


def drive_copy(args):
    svc = drive_svc()
    body = {}
    if args.name:
        body["name"] = args.name
    if args.folder:
        body["parents"] = [args.folder]
    result = svc.files().copy(fileId=args.id, body=body, fields="id,name").execute()
    print(f"Copied: {result['name']} (ID: {result['id']})")


def drive_rename(args):
    svc = drive_svc()
    result = svc.files().update(
        fileId=args.id, body={"name": args.name}, fields="id,name"
    ).execute()
    print(f"Renamed to: {result['name']}")


def drive_trash(args):
    svc = drive_svc()
    svc.files().update(fileId=args.id, body={"trashed": True}).execute()
    print(f"Trashed: {args.id}")


def drive_untrash(args):
    svc = drive_svc()
    svc.files().update(fileId=args.id, body={"trashed": False}).execute()
    print(f"Restored: {args.id}")


def drive_delete(args):
    svc = drive_svc()
    if not args.yes:
        confirm = input(f"Permanently delete {args.id}? (y/N): ")
        if confirm.lower() != "y":
            print("Cancelled.")
            return
    svc.files().delete(fileId=args.id).execute()
    print(f"Permanently deleted: {args.id}")


def drive_share(args):
    svc = drive_svc()
    permission = {"type": args.type, "role": args.role}
    if args.type == "user" or args.type == "group":
        if not args.email:
            print("Error: --email required for user/group sharing")
            sys.exit(1)
        permission["emailAddress"] = args.email
    if args.type == "domain":
        if not args.domain:
            print("Error: --domain required for domain sharing")
            sys.exit(1)
        permission["domain"] = args.domain
    result = svc.permissions().create(
        fileId=args.id, body=permission, fields="id,role,type",
        sendNotificationEmail=not args.no_notify
    ).execute()
    print(f"Shared! Permission ID: {result['id']} (role: {result['role']})")


def drive_permissions(args):
    svc = drive_svc()
    results = svc.permissions().list(
        fileId=args.id, fields="permissions(id,role,type,emailAddress,domain,displayName)"
    ).execute()
    perms = results.get("permissions", [])
    if not perms:
        print("No permissions found.")
        return
    for p in perms:
        who = p.get("emailAddress") or p.get("domain") or p.get("displayName") or p["type"]
        print(f"  [{p['id']}] {who} - {p['role']} ({p['type']})")


def drive_unshare(args):
    svc = drive_svc()
    svc.permissions().delete(fileId=args.id, permissionId=args.permission_id).execute()
    print(f"Removed permission: {args.permission_id}")


# ════════════════════════════════════════════════════════════
# ARGUMENT PARSER
# ════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Google Workspace CLI - Gmail & Drive",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Run '<service> <action> -h' for help on a specific command."
    )
    sub = parser.add_subparsers(dest="service", required=True)

    # ── Gmail ───────────────────────────────────────────────
    gmail = sub.add_parser("gmail", help="Gmail operations")
    gs = gmail.add_subparsers(dest="action", required=True)

    gs.add_parser("profile", help="Show account profile")
    gs.add_parser("labels", help="List all labels")

    p = gs.add_parser("list", help="List messages")
    p.add_argument("-q", "--query", help="Gmail search query (e.g. 'is:unread', 'from:user@example.com', 'has:attachment')")
    p.add_argument("-n", "--limit", type=int, default=10, help="Max results (default: 10)")

    p = gs.add_parser("read", help="Read a message (shows attachments)")
    p.add_argument("id", help="Message ID")

    p = gs.add_parser("attachments", help="Download all attachments from a message")
    p.add_argument("id", help="Message ID")
    p.add_argument("-o", "--output-dir", default=".", help="Output directory (default: current)")

    p = gs.add_parser("send", help="Send an email (with optional attachments)")
    p.add_argument("--to", required=True, help="Recipient(s), comma-separated")
    p.add_argument("--cc", help="CC recipients, comma-separated")
    p.add_argument("--bcc", help="BCC recipients, comma-separated")
    p.add_argument("--subject", required=True, help="Subject line")
    p.add_argument("--body", required=True, help="Body text")
    p.add_argument("--attach", nargs="+", help="File paths to attach")

    p = gs.add_parser("reply", help="Reply to a message")
    p.add_argument("id", help="Message ID to reply to")
    p.add_argument("--body", required=True, help="Reply body text")

    p = gs.add_parser("forward", help="Forward a message (includes attachments)")
    p.add_argument("id", help="Message ID to forward")
    p.add_argument("--to", required=True, help="Forward to")
    p.add_argument("--body", default="", help="Additional message")

    p = gs.add_parser("trash", help="Move message to trash")
    p.add_argument("id", help="Message ID")

    p = gs.add_parser("untrash", help="Restore message from trash")
    p.add_argument("id", help="Message ID")

    p = gs.add_parser("mark-read", help="Mark message as read")
    p.add_argument("id", help="Message ID")

    p = gs.add_parser("mark-unread", help="Mark message as unread")
    p.add_argument("id", help="Message ID")

    p = gs.add_parser("modify-labels", help="Add/remove labels from a message")
    p.add_argument("id", help="Message ID")
    p.add_argument("--add", nargs="+", help="Label IDs to add")
    p.add_argument("--remove", nargs="+", help="Label IDs to remove")

    p = gs.add_parser("thread", help="View all messages in a thread")
    p.add_argument("id", help="Thread ID")

    # Drafts
    p = gs.add_parser("draft-create", help="Create a draft")
    p.add_argument("--to", required=True, help="Recipient")
    p.add_argument("--subject", required=True, help="Subject")
    p.add_argument("--body", required=True, help="Body text")

    p = gs.add_parser("draft-list", help="List drafts")
    p.add_argument("-n", "--limit", type=int, default=10, help="Max results")

    p = gs.add_parser("draft-send", help="Send a draft")
    p.add_argument("id", help="Draft ID")

    p = gs.add_parser("draft-delete", help="Delete a draft")
    p.add_argument("id", help="Draft ID")

    # ── Drive ───────────────────────────────────────────────
    drive = sub.add_parser("drive", help="Drive operations")
    ds = drive.add_subparsers(dest="action", required=True)

    p = ds.add_parser("list", help="List files")
    p.add_argument("-q", "--query", help="Drive query filter")
    p.add_argument("-n", "--limit", type=int, default=20, help="Max results")
    p.add_argument("--folder", help="List contents of a specific folder ID")

    p = ds.add_parser("info", help="Show file details")
    p.add_argument("id", help="File ID")

    p = ds.add_parser("download", help="Download a file")
    p.add_argument("id", help="File ID")
    p.add_argument("-o", "--output", help="Output filename")
    p.add_argument("-f", "--format", help="Export format for Google Docs (pdf, docx, xlsx, pptx, csv, txt, png, jpg)")

    p = ds.add_parser("upload", help="Upload a file")
    p.add_argument("file", help="Local file to upload")
    p.add_argument("--name", help="Name in Drive (default: local filename)")
    p.add_argument("--folder", help="Parent folder ID")
    p.add_argument("--description", help="File description")

    p = ds.add_parser("search", help="Search files by content")
    p.add_argument("term", help="Search term")
    p.add_argument("-n", "--limit", type=int, default=10, help="Max results")
    p.add_argument("-t", "--type", help="Filter by type: doc, sheet, slide, folder, pdf, image")

    p = ds.add_parser("mkdir", help="Create a folder")
    p.add_argument("name", help="Folder name")
    p.add_argument("--parent", help="Parent folder ID")

    p = ds.add_parser("move", help="Move a file to another folder")
    p.add_argument("id", help="File ID")
    p.add_argument("--folder", required=True, help="Destination folder ID")

    p = ds.add_parser("copy", help="Copy a file")
    p.add_argument("id", help="File ID")
    p.add_argument("--name", help="New name")
    p.add_argument("--folder", help="Destination folder ID")

    p = ds.add_parser("rename", help="Rename a file")
    p.add_argument("id", help="File ID")
    p.add_argument("--name", required=True, help="New name")

    p = ds.add_parser("trash", help="Move file to trash")
    p.add_argument("id", help="File ID")

    p = ds.add_parser("untrash", help="Restore file from trash")
    p.add_argument("id", help="File ID")

    p = ds.add_parser("delete", help="Permanently delete a file")
    p.add_argument("id", help="File ID")
    p.add_argument("-y", "--yes", action="store_true", help="Skip confirmation")

    p = ds.add_parser("share", help="Share a file")
    p.add_argument("id", help="File ID")
    p.add_argument("--type", required=True, choices=["user", "group", "domain", "anyone"], help="Permission type")
    p.add_argument("--role", required=True, choices=["reader", "writer", "commenter", "organizer", "owner"], help="Permission role")
    p.add_argument("--email", help="Email (for user/group type)")
    p.add_argument("--domain", help="Domain (for domain type)")
    p.add_argument("--no-notify", action="store_true", help="Don't send notification email")

    p = ds.add_parser("permissions", help="List file permissions")
    p.add_argument("id", help="File ID")

    p = ds.add_parser("unshare", help="Remove a permission from a file")
    p.add_argument("id", help="File ID")
    p.add_argument("--permission-id", required=True, help="Permission ID to remove (from 'permissions' command)")

    args = parser.parse_args()

    actions = {
        ("gmail", "profile"): gmail_profile,
        ("gmail", "labels"): gmail_labels,
        ("gmail", "list"): gmail_list,
        ("gmail", "read"): gmail_read,
        ("gmail", "attachments"): gmail_attachments,
        ("gmail", "send"): gmail_send,
        ("gmail", "reply"): gmail_reply,
        ("gmail", "forward"): gmail_forward,
        ("gmail", "trash"): gmail_trash,
        ("gmail", "untrash"): gmail_untrash,
        ("gmail", "mark-read"): gmail_mark_read,
        ("gmail", "mark-unread"): gmail_mark_unread,
        ("gmail", "modify-labels"): gmail_modify_labels,
        ("gmail", "thread"): gmail_thread,
        ("gmail", "draft-create"): gmail_draft_create,
        ("gmail", "draft-list"): gmail_draft_list,
        ("gmail", "draft-send"): gmail_draft_send,
        ("gmail", "draft-delete"): gmail_draft_delete,
        ("drive", "list"): drive_list,
        ("drive", "info"): drive_info,
        ("drive", "download"): drive_download,
        ("drive", "upload"): drive_upload,
        ("drive", "search"): drive_search,
        ("drive", "mkdir"): drive_mkdir,
        ("drive", "move"): drive_move,
        ("drive", "copy"): drive_copy,
        ("drive", "rename"): drive_rename,
        ("drive", "trash"): drive_trash,
        ("drive", "untrash"): drive_untrash,
        ("drive", "delete"): drive_delete,
        ("drive", "share"): drive_share,
        ("drive", "permissions"): drive_permissions,
        ("drive", "unshare"): drive_unshare,
    }

    handler = actions.get((args.service, args.action))
    if handler:
        handler(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
