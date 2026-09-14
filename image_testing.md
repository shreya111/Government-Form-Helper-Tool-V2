# Image attachment rules (Gemini vision via emergentintegrations)

- Accepted MIME: image/jpeg, image/png, image/webp only (transcode others first).
- Animated images (GIF/APNG/animated WEBP): extract frame 1 only.
- Resize before base64 (we thumbnail to 1600px, JPEG q85) to avoid multi-MB payloads.
- Do not send blank/solid-colour images.
- PDFs use FileContentWithMimeType(file_path, "application/pdf") — Gemini only.
- Images use ImageContent(image_base64=...) — works across providers.
