# Cat Flap Stats - CloudFlare Workers Interface

A simple web interface for uploading and processing cat flap PDF reports using CloudFlare Workers and KV storage.

## Features

- **Simple Authentication**: Magic link login for authorized users only
- **PDF Upload Interface**: Drag-and-drop file upload with validation
- **Dashboard**: View dataset status and download links
- **Material UI Design**: Clean, responsive interface
- **CloudFlare KV Storage**: Temporary file storage and session management

## Setup

### 1. Install Dependencies
```bash
cd cloudflare-workers
npm install
```

### 2. Create KV Namespace
```bash
npm run kv:create
```

### 3. Configure wrangler.toml
Update the following values in `wrangler.toml`:
- `zone_id`: Your CloudFlare zone ID
- `route`: Your domain route (e.g., catflapstats.yourdomain.com/*)
- KV namespace IDs from step 2
- `BASE_URL`: Your production URL
- GitHub repository details for webhook integration

### 4. Deploy
```bash
# Development
npm run dev

# Staging
npm run deploy:staging

# Production  
npm run deploy:production
```

## Authentication

The system uses a simple magic link authentication:
- Only `magnus.hultberg@gmail.com` and `hellowendy.wong@gmail.com` are authorized
- Users enter their email and receive a magic link
- Links expire after 24 hours
- Sessions are stored in CloudFlare KV

## File Upload Process

1. User uploads PDF file via web interface
2. Basic validation (file type, size limit)
3. File stored temporarily in KV storage (1 hour TTL)
4. GitHub Actions workflow triggered via webhook
5. Processing results displayed to user

## API Endpoints

- `GET /` - Login page (redirects to dashboard if authenticated)
- `POST /login` - Send magic link email
- `GET /auth?token=...` - Magic link authentication
- `GET /dashboard` - Main dashboard interface
- `GET /upload` - File upload interface
- `POST /api/upload` - File upload API
- `GET /api/dataset` - Dataset status and download links
- `GET /logout` - Logout and clear session

## KV Storage Structure

```
auth:{token} -> { email, expires }
upload:{fileId} -> binary PDF data + metadata
dataset:current -> latest dataset status
processing:{jobId} -> processing status and logs
```

## Security Features

- HTTPS-only with secure cookies
- Email-based authentication (no passwords)
- File type and size validation
- Session expiration
- CORS headers for API protection

## Next Steps

1. Set up email service for magic links (SendGrid/etc.)
2. Configure GitHub Actions webhook integration
3. Add dataset download functionality
4. Implement processing history tracking