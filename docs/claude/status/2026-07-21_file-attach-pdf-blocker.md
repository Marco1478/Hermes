# Blocker — PDF / document attachments

## What works now

Chat file attachments were broadened for real:

- **Text/code files** (unchanged): read client-side, appended to the prompt as
  context. Already worked.
- **Images** (new, verified live): read as a base64 data URL, sent as a real
  multimodal `image_url` content part on the Runs API's `input` array — the
  same content-part vocabulary the gateway's OpenAI-compatible endpoint
  accepts (confirmed against `gateway/platforms/api_server.py`). Verified
  end-to-end by attaching a real PNG and asking Hermes to describe it — its
  reply correctly described the actual image content, not a hallucination.

## What's blocked: PDF / Word / other documents

`gateway/platforms/api_server.py` explicitly rejects `file`/`input_file`
content-part types:

```
_FILE_PART_TYPES = frozenset({"file", "input_file"})
...
# part_type in _FILE_PART_TYPES → "unsupported_content_type" error
```

There is no real backend path today for sending a PDF or document as a
first-class attachment (as an image, as extracted text via a real
extraction endpoint, or any other form) — the gateway will reject it at
the content-parts layer before it reaches the agent.

## What would unblock it

One of:

1. A real text-extraction endpoint (PDF/doc → plain text) added to the
   gateway or dashboard, so the UI can extract-then-inject the same way it
   already does for `.txt`/`.md`/code files, **or**
2. The gateway accepting `file`/`input_file` content parts and passing them
   to a document-capable model.

Neither exists on the current build. The UI's file picker intentionally
does not offer PDF/doc types rather than accept them and silently produce
garbled text or a rejected request.
