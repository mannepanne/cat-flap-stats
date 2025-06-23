// ABOUT: CloudFlare Workers main handler for Cat Flap Stats upload interface
// ABOUT: Handles authentication, file uploads, and web interface serving

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Enhanced logging for debugging
    console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname}`);

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route handling
      switch (path) {
        case '/':
          return await handleHome(request, env);
        case '/login':
          return await handleLogin(request, env);
        case '/auth':
          return await handleAuth(request, env);
        case '/logout':
          return await handleLogout(request, env);
        case '/upload':
          return await handleUpload(request, env);
        case '/api/upload':
          return await handleApiUpload(request, env);
        case '/dashboard':
          return await handleDashboard(request, env);
        case '/api/dataset':
          return await handleDatasetApi(request, env);
        case '/favicon.ico':
          return await handleFavicon(request, env);
        case '/favicons/android-chrome-192x192.png':
        case '/favicons/android-chrome-512x512.png':
        case '/favicons/apple-touch-icon.png':
        case '/favicons/favicon-16x16.png':
        case '/favicons/favicon-32x32.png':
        case '/favicons/favicon.ico':
          return await handleFaviconAssets(request, env, path);
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('Request error:', error);
      return new Response('Internal Server Error', { 
        status: 500,
        headers: corsHeaders 
      });
    }
  }
};

// Authentication helpers
const AUTHORIZED_EMAILS = [
  'magnus.hultberg@gmail.com',
  'hellowendy.wong@gmail.com'
];

async function generateAuthToken(email, env) {
  const token = crypto.randomUUID();
  const expires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  
  await env.CAT_FLAP_KV.put(`auth:${token}`, JSON.stringify({
    email,
    expires
  }), { expirationTtl: 86400 }); // 24 hours TTL
  
  return token;
}

async function validateAuthToken(token, env) {
  if (!token) return null;
  
  const authData = await env.CAT_FLAP_KV.get(`auth:${token}`);
  if (!authData) return null;
  
  const { email, expires } = JSON.parse(authData);
  if (Date.now() > expires) {
    await env.CAT_FLAP_KV.delete(`auth:${token}`);
    return null;
  }
  
  return email;
}

async function sendMagicLink(email, token, env) {
  const magicLink = `${env.BASE_URL}/auth?token=${token}`;
  
  // Enhanced logging for visibility
  console.log('=== MAGIC LINK GENERATED ===');
  console.log(`Email: ${email}`);
  console.log(`Token: ${token}`);
  console.log(`Magic Link: ${magicLink}`);
  console.log('============================');
  
  // Send email if Resend API key is configured
  if (env.RESEND_API_KEY) {
    try {
      console.log(`Sending magic link email to ${email}`);
      
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Cat Flap Stats <noreply@echoreflex.me>',
          to: [email],
          subject: 'Your Cat Flap Stats Login Link',
          html: getEmailTemplate(magicLink, email),
          text: `Login to Cat Flap Stats: ${magicLink}\n\nThis link expires in 24 hours.`
        }),
      });
      
      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error('Email sending failed:', errorText);
        throw new Error(`Email API error: ${emailResponse.status}`);
      }
      
      const result = await emailResponse.json();
      console.log('Email sent successfully:', result.id);
      return true;
      
    } catch (error) {
      console.error('Failed to send email:', error);
      console.log('Falling back to console logging only');
      return false;
    }
  } else {
    console.log('No RESEND_API_KEY configured, email not sent');
    return false;
  }
}

// Route handlers
async function handleHome(request, env) {
  const authToken = getCookie(request, 'auth_token');
  console.log(`Home page access - found auth token: ${authToken ? 'yes' : 'no'}`);
  
  if (authToken) {
    const email = await validateAuthToken(authToken, env);
    console.log(`Token validation result: ${email || 'failed'}`);
    
    if (email) {
      console.log(`Redirecting authenticated user ${email} to dashboard`);
      return Response.redirect(new URL('/dashboard', request.url).toString(), 302);
    }
  }
  
  console.log('Showing login page');
  return new Response(getLoginPage(), {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handleLogin(request, env) {
  if (request.method !== 'POST') {
    console.log('Login request not POST, redirecting to home');
    return Response.redirect(new URL('/', request.url).toString(), 302);
  }
  
  const formData = await request.formData();
  const email = formData.get('email')?.toLowerCase();
  
  console.log(`Login attempt for email: ${email}`);
  
  if (!email || !AUTHORIZED_EMAILS.includes(email)) {
    console.log(`Login failed: Invalid email ${email}`);
    return new Response(getLoginPage('Invalid email address'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  console.log(`Generating auth token for authorized email: ${email}`);
  const token = await generateAuthToken(email, env);
  await sendMagicLink(email, token, env);
  
  console.log(`Magic link generated successfully for ${email}`);
  return new Response(getLoginPage(`Magic link sent to ${email}!`), {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handleAuth(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  
  console.log(`Auth attempt with token: ${token}`);
  
  const email = await validateAuthToken(token, env);
  if (!email) {
    console.log('Token validation failed, redirecting to login');
    return Response.redirect(new URL('/', request.url).toString(), 302);
  }
  
  console.log(`Token validated for email: ${email}, setting cookie and redirecting to dashboard`);
  
  // Instead of immediate redirect, show success page with auto-redirect
  // This ensures the cookie gets set properly before the next request
  const successPage = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="1;url=/dashboard">
    <title>Login Successful</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .success { background: white; padding: 30px; border-radius: 8px; display: inline-block; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    </style>
</head>
<body>
    <div class="success">
        <h2>✅ Login Successful!</h2>
        <p>Redirecting to your dashboard...</p>
        <p><a href="/dashboard">Click here if not redirected automatically</a></p>
    </div>
</body>
</html>`;

  return new Response(successPage, {
    headers: {
      'Content-Type': 'text/html',
      'Set-Cookie': `auth_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/`
    }
  });
}

async function handleLogout(request, env) {
  const authToken = getCookie(request, 'auth_token');
  if (authToken) {
    await env.CAT_FLAP_KV.delete(`auth:${authToken}`);
  }
  
  return new Response('', {
    status: 302,
    headers: {
      'Location': new URL('/', request.url).toString(),
      'Set-Cookie': 'auth_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
    }
  });
}

async function handleDashboard(request, env) {
  const authToken = getCookie(request, 'auth_token');
  const email = await validateAuthToken(authToken, env);
  
  if (!email) {
    return Response.redirect(new URL('/', request.url).toString(), 302);
  }
  
  return new Response(getDashboardPage(email), {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handleUpload(request, env) {
  const authToken = getCookie(request, 'auth_token');
  const email = await validateAuthToken(authToken, env);
  
  if (!email) {
    return Response.redirect(new URL('/', request.url).toString(), 302);
  }
  
  return new Response(getUploadPage(email), {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handleApiUpload(request, env) {
  const authToken = getCookie(request, 'auth_token');
  const email = await validateAuthToken(authToken, env);
  
  if (!email) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  try {
    const formData = await request.formData();
    const file = formData.get('pdf_file');
    
    if (!file || file.type !== 'application/pdf') {
      return new Response(JSON.stringify({ error: 'Invalid PDF file' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Basic file validation
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return new Response(JSON.stringify({ error: 'File too large (max 10MB)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Store file temporarily
    const fileId = crypto.randomUUID();
    const fileKey = `upload:${fileId}`;
    
    const fileData = await file.arrayBuffer();
    await env.CAT_FLAP_KV.put(fileKey, fileData, { 
      expirationTtl: 3600, // 1 hour
      metadata: {
        filename: file.name,
        size: file.size,
        uploaded_by: email,
        uploaded_at: new Date().toISOString()
      }
    });
    
    // Trigger GitHub Actions workflow
    console.log(`File uploaded: ${file.name} (${file.size} bytes) by ${email}`);
    
    try {
      await triggerGitHubProcessing(fileId, file.name, email, env);
      console.log('GitHub Actions workflow triggered successfully');
      
      return new Response(JSON.stringify({ 
        success: true, 
        fileId,
        message: 'File uploaded successfully and processing has started. You will receive an email when processing is complete.'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Failed to trigger GitHub processing:', error);
      
      return new Response(JSON.stringify({ 
        success: true, 
        fileId,
        message: 'File uploaded successfully, but processing could not be started. Please contact support.',
        warning: 'Processing trigger failed'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ error: 'Upload failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleDatasetApi(request, env) {
  const authToken = getCookie(request, 'auth_token');
  const email = await validateAuthToken(authToken, env);
  
  if (!email) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // TODO: Return current dataset status and download links
  return new Response(JSON.stringify({
    status: 'active',
    last_updated: '2025-06-22T12:00:00Z',
    total_sessions: 1250,
    date_range: {
      start: '2024-01-01',
      end: '2025-06-22'
    },
    download_links: {
      csv: '/api/download/dataset.csv',
      json: '/api/download/dataset.json'
    }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// GitHub Actions integration
async function triggerGitHubProcessing(fileId, filename, uploadedBy, env) {
  const githubUrl = `https://api.github.com/repos/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/dispatches`;
  
  const payload = {
    event_type: 'process-pdf',
    client_payload: {
      file_id: fileId,
      filename: filename,
      uploaded_by: uploadedBy,
      uploaded_at: new Date().toISOString()
    }
  };
  
  console.log(`Triggering GitHub Actions: ${githubUrl}`);
  console.log(`Payload:`, JSON.stringify(payload, null, 2));
  
  const response = await fetch(githubUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'CloudFlare-Worker-CatFlapStats'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`GitHub API error: ${response.status} - ${errorText}`);
    throw new Error(`GitHub API returned ${response.status}: ${errorText}`);
  }
  
  console.log('GitHub Actions workflow triggered successfully');
  return true;
}

// Utility functions
function getCookie(request, name) {
  const cookies = request.headers.get('Cookie') || '';
  console.log(`Parsing cookies: ${cookies}`);
  
  // More robust cookie parsing
  const cookiePairs = cookies.split(';').map(c => c.trim());
  for (const pair of cookiePairs) {
    const [key, value] = pair.split('=', 2);
    if (key === name) {
      console.log(`Found cookie ${name}: ${value}`);
      return value;
    }
  }
  
  console.log(`Cookie ${name} not found`);
  return null;
}

function getEmailTemplate(magicLink, email) {
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cat Flap Stats Login</title>
    <style>
        body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 2em; margin-bottom: 10px; }
        .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white !important; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🐱 Cat Flap Stats</div>
            <h2>Login to Your Dashboard</h2>
        </div>
        
        <p>Hello!</p>
        
        <p>Click the button below to securely log into your Cat Flap Stats dashboard:</p>
        
        <div style="text-align: center;">
            <a href="${magicLink}" class="button">Login to Dashboard</a>
        </div>
        
        <p>This link will expire in 24 hours for security purposes.</p>
        
        <p>If you didn't request this login, you can safely ignore this email.</p>
        
        <div class="footer">
            <p>This email was sent to ${email} for Cat Flap Stats access.</p>
            <p>If the button doesn't work, copy and paste this link: ${magicLink}</p>
        </div>
    </div>
</body>
</html>`;
}

// HTML templates (using Material UI inspired design)
function getLoginPage(message = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cat Flap Stats - Login</title>
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16x16.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Roboto', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .login-container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            width: 100%;
            max-width: 400px;
        }
        .logo {
            text-align: center;
            margin-bottom: 2rem;
            color: #333;
        }
        .form-group {
            margin-bottom: 1rem;
        }
        label {
            display: block;
            margin-bottom: 0.5rem;
            color: #555;
            font-weight: 500;
        }
        input[type="email"] {
            width: 100%;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 4px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        input[type="email"]:focus {
            outline: none;
            border-color: #667eea;
        }
        .btn {
            width: 100%;
            padding: 12px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.3s;
        }
        .btn:hover {
            background: #5a6fd8;
        }
        .message {
            margin-top: 1rem;
            padding: 10px;
            border-radius: 4px;
            text-align: center;
        }
        .message.success {
            background: #e8f5e8;
            color: #2e7d32;
            border: 1px solid #c8e6c9;
        }
        .message.error {
            background: #ffebee;
            color: #c62828;
            border: 1px solid #ffcdd2;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">
            <h1>🐱 Cat Flap Stats</h1>
            <p>Data Processing Portal</p>
        </div>
        <form method="POST" action="/login">
            <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" id="email" name="email" required 
                       placeholder="Enter your email address">
            </div>
            <button type="submit" class="btn">Send Magic Link</button>
        </form>
        ${message ? `<div class="message ${message.includes('sent') ? 'success' : 'error'}">${message}</div>` : ''}
    </div>
</body>
</html>`;
}

function getDashboardPage(email) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cat Flap Stats - Dashboard</title>
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16x16.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Roboto', sans-serif;
            background: #f5f5f5;
            min-height: 100vh;
        }
        .header {
            background: white;
            padding: 1rem 2rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .logo { color: #333; }
        .user-info {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        .container {
            max-width: 1200px;
            margin: 2rem auto;
            padding: 0 1rem;
        }
        .card {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 1.5rem;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        .stat-card {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-number {
            font-size: 2rem;
            font-weight: 700;
            color: #667eea;
            margin-bottom: 0.5rem;
        }
        .stat-label {
            color: #666;
            font-weight: 500;
        }
        .btn {
            padding: 10px 20px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 500;
            display: inline-block;
            transition: background 0.3s;
        }
        .btn:hover { background: #5a6fd8; }
        .btn-secondary {
            background: #e0e0e0;
            color: #333;
        }
        .btn-secondary:hover { background: #d0d0d0; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">
            <h2>🐱 Cat Flap Stats</h2>
        </div>
        <div class="user-info">
            <span>Welcome, ${email}</span>
            <a href="/logout" class="btn btn-secondary">Logout</a>
        </div>
    </div>
    
    <div class="container">
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number" id="total-sessions">1,250</div>
                <div class="stat-label">Total Sessions</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="date-range">365</div>
                <div class="stat-label">Days of Data</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="last-update">Today</div>
                <div class="stat-label">Last Updated</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="data-quality">98%</div>
                <div class="stat-label">Data Quality</div>
            </div>
        </div>
        
        <div class="card">
            <h3>Upload New PDF Report</h3>
            <p>Upload your weekly SURE Petcare PDF report to add new data to the dataset.</p>
            <br>
            <a href="/upload" class="btn">Upload PDF File</a>
        </div>
        
        <div class="card">
            <h3>Download Dataset</h3>
            <p>Download the complete dataset in CSV or JSON format for analysis.</p>
            <br>
            <a href="/api/dataset" class="btn btn-secondary">Download CSV</a>
            <a href="/api/dataset" class="btn btn-secondary">Download JSON</a>
        </div>
        
        <div class="card">
            <h3>Processing History</h3>
            <p>Recent file uploads and processing results will appear here.</p>
            <div id="processing-history">
                <p style="color: #666; font-style: italic;">No recent activity</p>
            </div>
        </div>
    </div>
    
    <script>
        // Load dashboard data
        fetch('/api/dataset')
            .then(response => response.json())
            .then(data => {
                if (data.total_sessions) {
                    document.getElementById('total-sessions').textContent = data.total_sessions.toLocaleString();
                }
                if (data.last_updated) {
                    const date = new Date(data.last_updated);
                    document.getElementById('last-update').textContent = date.toLocaleDateString();
                }
            })
            .catch(error => console.error('Error loading dashboard data:', error));
    </script>
</body>
</html>`;
}

function getUploadPage(email) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cat Flap Stats - Upload PDF</title>
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16x16.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Roboto', sans-serif;
            background: #f5f5f5;
            min-height: 100vh;
        }
        .header {
            background: white;
            padding: 1rem 2rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .logo { color: #333; }
        .container {
            max-width: 800px;
            margin: 2rem auto;
            padding: 0 1rem;
        }
        .card {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .upload-area {
            border: 2px dashed #e0e0e0;
            border-radius: 8px;
            padding: 3rem;
            text-align: center;
            margin: 1rem 0;
            transition: border-color 0.3s;
        }
        .upload-area.dragover {
            border-color: #667eea;
            background: #f8f9ff;
        }
        .upload-icon {
            font-size: 3rem;
            color: #ccc;
            margin-bottom: 1rem;
        }
        .btn {
            padding: 12px 24px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 4px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.3s;
        }
        .btn:hover { background: #5a6fd8; }
        .btn-secondary {
            background: #e0e0e0;
            color: #333;
        }
        .btn-secondary:hover { background: #d0d0d0; }
        .progress {
            width: 100%;
            height: 8px;
            background: #e0e0e0;
            border-radius: 4px;
            margin: 1rem 0;
            overflow: hidden;
        }
        .progress-bar {
            height: 100%;
            background: #667eea;
            width: 0%;
            transition: width 0.3s;
        }
        .message {
            padding: 12px;
            border-radius: 4px;
            margin: 1rem 0;
        }
        .message.success {
            background: #e8f5e8;
            color: #2e7d32;
            border: 1px solid #c8e6c9;
        }
        .message.error {
            background: #ffebee;
            color: #c62828;
            border: 1px solid #ffcdd2;
        }
        .hidden { display: none; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">
            <h2>🐱 Cat Flap Stats</h2>
        </div>
        <div>
            <a href="/dashboard" class="btn btn-secondary">Back to Dashboard</a>
        </div>
    </div>
    
    <div class="container">
        <div class="card">
            <h2>Upload PDF Report</h2>
            <p>Upload your weekly SURE Petcare PDF report. The file will be processed automatically and added to your dataset.</p>
            
            <form id="upload-form" enctype="multipart/form-data">
                <div class="upload-area" id="upload-area">
                    <div class="upload-icon">📄</div>
                    <h3>Drop your PDF file here</h3>
                    <p>or click to browse files</p>
                    <input type="file" id="pdf-file" name="pdf_file" accept=".pdf" style="display: none;">
                    <br><br>
                    <button type="button" onclick="document.getElementById('pdf-file').click()" class="btn">
                        Choose PDF File
                    </button>
                </div>
                
                <div id="file-info" class="hidden">
                    <h4>Selected File:</h4>
                    <p id="file-name"></p>
                    <p id="file-size"></p>
                </div>
                
                <div id="progress-container" class="hidden">
                    <div class="progress">
                        <div class="progress-bar" id="progress-bar"></div>
                    </div>
                    <p id="progress-text">Uploading...</p>
                </div>
                
                <div id="message-container"></div>
                
                <button type="submit" id="upload-btn" class="btn" disabled>
                    Upload and Process
                </button>
            </form>
        </div>
    </div>
    
    <script>
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('pdf-file');
        const uploadForm = document.getElementById('upload-form');
        const uploadBtn = document.getElementById('upload-btn');
        const fileInfo = document.getElementById('file-info');
        const progressContainer = document.getElementById('progress-container');
        const messageContainer = document.getElementById('message-container');
        
        // Drag and drop handling
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type === 'application/pdf') {
                fileInput.files = files;
                handleFileSelect();
            }
        });
        
        fileInput.addEventListener('change', handleFileSelect);
        
        function handleFileSelect() {
            const file = fileInput.files[0];
            if (file) {
                document.getElementById('file-name').textContent = file.name;
                document.getElementById('file-size').textContent = formatFileSize(file.size);
                fileInfo.classList.remove('hidden');
                uploadBtn.disabled = false;
            }
        }
        
        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const file = fileInput.files[0];
            if (!file) return;
            
            const formData = new FormData();
            formData.append('pdf_file', file);
            
            progressContainer.classList.remove('hidden');
            uploadBtn.disabled = true;
            
            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showMessage(result.message, 'success');
                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 2000);
                } else {
                    showMessage(result.error || 'Upload failed', 'error');
                }
            } catch (error) {
                showMessage('Upload failed: ' + error.message, 'error');
            } finally {
                progressContainer.classList.add('hidden');
                uploadBtn.disabled = false;
            }
        });
        
        function showMessage(text, type) {
            messageContainer.innerHTML = \`<div class="message \${type}">\${text}</div>\`;
        }
    </script>
</body>
</html>`;
}

// Favicon handlers
async function handleFavicon(request, env) {
  // Return a simple redirect to the main favicon
  return Response.redirect('https://raw.githubusercontent.com/mannepanne/cat-flap-stats/main/favicon.ico', 302);
}

async function handleFaviconAssets(request, env, path) {
  // Extract filename from path
  const filename = path.split('/').pop();
  
  // Return redirect to GitHub raw content
  const githubUrl = `https://raw.githubusercontent.com/mannepanne/cat-flap-stats/main/favicons/${filename}`;
  return Response.redirect(githubUrl, 302);
}