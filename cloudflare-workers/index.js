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
        case '/api/download/dataset.csv':
          return await handleDownloadCsv(request, env);
        case '/api/download/dataset.json':
          return await handleDownloadJson(request, env);
        case '/patterns':
          return await handlePatterns(request, env);
        case '/api/analytics':
          return await handleAnalyticsApi(request, env);
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
  
  try {
    // Fetch current dataset info from GitHub
    const csvUrl = `https://raw.githubusercontent.com/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/main/master_dataset.csv`;
    const csvResponse = await fetch(csvUrl);
    
    let datasetInfo = {
      status: 'active',
      download_links: {
        csv: '/api/download/dataset.csv',
        json: '/api/download/dataset.json'
      }
    };
    
    if (csvResponse.ok) {
      const csvData = await csvResponse.text();
      const lines = csvData.split('\n').filter(line => line.trim());
      const totalSessions = Math.max(0, lines.length - 1); // Subtract header row
      
      // Extract date range from the data
      if (totalSessions > 0) {
        const dataLines = lines.slice(1); // Skip header
        const dates = dataLines
          .map(line => {
            const parts = line.split(',');
            return parts[8]; // date_full column
          })
          .filter(date => date && date.match(/^\d{4}-\d{2}-\d{2}$/))
          .sort();
        
        if (dates.length > 0) {
          datasetInfo.date_range = {
            start: dates[0],
            end: dates[dates.length - 1]
          };
        }
      }
      
      datasetInfo.total_sessions = totalSessions;
      datasetInfo.last_updated = new Date().toISOString();
    } else {
      // Fallback values if GitHub fetch fails
      datasetInfo.total_sessions = 1572;
      datasetInfo.last_updated = '2025-06-23T12:00:00Z';
      datasetInfo.date_range = {
        start: '2024-02-05',
        end: '2025-06-22'
      };
    }
    
    return new Response(JSON.stringify(datasetInfo), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching dataset info:', error);
    
    // Return fallback data
    return new Response(JSON.stringify({
      status: 'active',
      last_updated: '2025-06-23T12:00:00Z',
      total_sessions: 1572,
      date_range: {
        start: '2024-02-05',
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
}

async function handlePatterns(request, env) {
  const authToken = getCookie(request, 'auth_token');
  const email = await validateAuthToken(authToken, env);
  
  if (!email) {
    return Response.redirect(new URL('/', request.url).toString(), 302);
  }
  
  return new Response(getPatternsPage(email), {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handleAnalyticsApi(request, env) {
  const authToken = getCookie(request, 'auth_token');
  const email = await validateAuthToken(authToken, env);
  
  if (!email) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  try {
    // Fetch enhanced JSON dataset with analytics from GitHub
    const jsonUrl = `https://raw.githubusercontent.com/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/main/master_dataset.json`;
    const response = await fetch(jsonUrl);
    
    if (!response.ok) {
      console.error(`Failed to fetch analytics data from GitHub: ${response.status}`);
      return new Response('Analytics data not available', { status: 404 });
    }
    
    const analyticsData = await response.text();
    const parsedData = JSON.parse(analyticsData);
    
    // Extract just the analytics portions for the dashboard
    const dashboardData = {
      metadata: parsedData.metadata,
      precomputed: parsedData.precomputed,
      // Include recent sessions for detailed view (last 30 days)
      recentSessions: getRecentSessions(parsedData.sessions, 30)
    };
    
    return new Response(JSON.stringify(dashboardData), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // 5 minute cache
      }
    });
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    return new Response('Analytics fetch failed', { status: 500 });
  }
}

function getRecentSessions(sessions, days) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffString = cutoffDate.toISOString().split('T')[0];
  
  const recentSessions = [];
  for (const report of sessions) {
    if (report.session_data) {
      const filteredSessions = report.session_data.filter(session => 
        session.date_full >= cutoffString
      );
      if (filteredSessions.length > 0) {
        recentSessions.push({
          ...report,
          session_data: filteredSessions
        });
      }
    }
  }
  
  return recentSessions;
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
    <link rel="icon" href="/favicon.ico" type="image/svg+xml">
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
    <link rel="icon" href="/favicon.ico" type="image/svg+xml">
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
            position: relative;
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
        .info-icon {
            position: absolute;
            top: 8px;
            right: 8px;
            width: 16px;
            height: 16px;
            background: #667eea;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            cursor: help;
            z-index: 10;
        }
        .tooltip {
            visibility: hidden;
            width: 300px;
            background-color: rgba(0,0,0,0.9);
            color: #fff;
            text-align: left;
            border-radius: 6px;
            padding: 12px;
            position: absolute;
            z-index: 1000;
            bottom: 125%;
            right: 0;
            opacity: 0;
            transition: opacity 0.3s;
            font-size: 13px;
            line-height: 1.4;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .tooltip::after {
            content: "";
            position: absolute;
            top: 100%;
            right: 20px;
            margin-left: -5px;
            border-width: 5px;
            border-style: solid;
            border-color: rgba(0,0,0,0.9) transparent transparent transparent;
        }
        .info-icon:hover .tooltip {
            visibility: visible;
            opacity: 1;
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
                <div class="info-icon">
                    i
                    <div class="tooltip">
                        <strong>Data Quality: 89%</strong><br><br>
                        Based on days with complete behavioral data (≥2 sessions per day).<br><br>
                        <strong>Formula:</strong> Complete days ÷ Total days<br>
                        <strong>Current:</strong> 404 complete days out of 455 total days<br><br>
                        There will always be some incomplete days due to alternative entry/exit methods, weather, mood, or other factors. This is a very high confidence score for behavioral analysis!
                    </div>
                </div>
                <div class="stat-number" id="data-quality">98%</div>
                <div class="stat-label">Data Quality</div>
            </div>
        </div>
        
        <div class="card">
            <h3>📊 Behavioral Patterns</h3>
            <p>View Sven's activity rhythms, peak hours, and seasonal patterns with scientific actogram visualization.</p>
            <br>
            <a href="/patterns" class="btn">View Activity Patterns</a>
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
            <a href="/api/download/dataset.csv" class="btn btn-secondary">Download CSV</a>
            <a href="/api/download/dataset.json" class="btn btn-secondary">Download JSON</a>
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
        Promise.all([
            fetch('/api/dataset').then(r => r.json()),
            fetch('/api/analytics').then(r => r.json())
        ])
        .then(([datasetInfo, analyticsData]) => {
            // Update basic stats
            if (datasetInfo.total_sessions) {
                document.getElementById('total-sessions').textContent = datasetInfo.total_sessions.toLocaleString();
            }
            if (datasetInfo.last_updated) {
                const date = new Date(datasetInfo.last_updated);
                document.getElementById('last-update').textContent = date.toLocaleDateString();
            }
            
            // Update data quality with real calculated value
            if (analyticsData.metadata && analyticsData.metadata.dataQuality) {
                const qualityScore = Math.round(analyticsData.metadata.dataQuality.confidenceScore * 100);
                document.getElementById('data-quality').textContent = qualityScore + '%';
            }
        })
        .catch(error => console.error('Error loading dashboard data:', error));
    </script>
</body>
</html>`;
}

function getPatternsPage(email) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cat Flap Stats - Behavioral Patterns</title>
    <link rel="icon" href="/favicon.ico" type="image/svg+xml">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <script src="https://d3js.org/d3.v7.min.js"></script>
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
        .nav-links {
            display: flex;
            gap: 1rem;
            align-items: center;
        }
        .container {
            max-width: 1400px;
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
        .section-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-bottom: 2rem;
        }
        @media (max-width: 768px) {
            .section-grid { grid-template-columns: 1fr; }
        }
        .chart-container {
            width: 100%;
            height: 400px;
            overflow: auto;
        }
        .actogram-container {
            width: 100%;
            height: 600px;
            overflow: auto;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
        }
        .btn {
            padding: 8px 16px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 500;
            display: inline-block;
            transition: background 0.3s;
            font-size: 14px;
        }
        .btn:hover { background: #5a6fd8; }
        .btn-secondary {
            background: #e0e0e0;
            color: #333;
        }
        .btn-secondary:hover { background: #d0d0d0; }
        .loading {
            text-align: center;
            padding: 2rem;
            color: #666;
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
            position: relative;
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
        .info-icon {
            position: absolute;
            top: 8px;
            right: 8px;
            width: 16px;
            height: 16px;
            background: #667eea;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            cursor: help;
            z-index: 10;
        }
        .tooltip {
            visibility: hidden;
            width: 300px;
            background-color: rgba(0,0,0,0.9);
            color: #fff;
            text-align: left;
            border-radius: 6px;
            padding: 12px;
            position: absolute;
            z-index: 1000;
            bottom: 125%;
            right: 0;
            opacity: 0;
            transition: opacity 0.3s;
            font-size: 13px;
            line-height: 1.4;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .tooltip::after {
            content: "";
            position: absolute;
            top: 100%;
            right: 20px;
            margin-left: -5px;
            border-width: 5px;
            border-style: solid;
            border-color: rgba(0,0,0,0.9) transparent transparent transparent;
        }
        .info-icon:hover .tooltip {
            visibility: visible;
            opacity: 1;
        }
        .legend {
            display: flex;
            gap: 1rem;
            margin-bottom: 1rem;
            flex-wrap: wrap;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.9rem;
        }
        .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 2px;
        }
        .tooltip {
            position: absolute;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 8px;
            border-radius: 4px;
            font-size: 12px;
            pointer-events: none;
            z-index: 1000;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">
            <h2>🐱 Cat Flap Stats - Behavioral Patterns</h2>
        </div>
        <div class="nav-links">
            <a href="/dashboard" class="btn btn-secondary">Dashboard</a>
            <span>Welcome, ${email}</span>
            <a href="/logout" class="btn btn-secondary">Logout</a>
        </div>
    </div>
    
    <div class="container">
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number" id="total-days">0</div>
                <div class="stat-label">Days Analyzed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="peak-hour">--:--</div>
                <div class="stat-label">Peak Activity Hour</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="avg-sessions">0</div>
                <div class="stat-label">Avg Daily Sessions</div>
            </div>
            <div class="stat-card">
                <div class="info-icon">
                    i
                    <div class="tooltip">
                        <strong>Data Quality: 89%</strong><br><br>
                        Based on days with complete behavioral data (≥2 sessions per day).<br><br>
                        <strong>Formula:</strong> Complete days ÷ Total days<br>
                        <strong>Current:</strong> 404 complete days out of 455 total days<br><br>
                        There will always be some incomplete days due to alternative entry/exit methods, weather, mood, or other factors. This is a very high confidence score for behavioral analysis!
                    </div>
                </div>
                <div class="stat-number" id="data-quality">0%</div>
                <div class="stat-label">Data Quality</div>
            </div>
        </div>
        
        <div class="card">
            <h3>📈 Peak Sven Hours - Activity Frequency</h3>
            <p>This chart shows when Sven is most active throughout the day, based on all recorded exit and entry times.</p>
            <div class="legend">
                <div class="legend-item">
                    <div class="legend-color" style="background: #667eea;"></div>
                    <span>Exits (going outside)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #42a5f5;"></div>
                    <span>Entries (coming inside)</span>
                </div>
            </div>
            <div class="chart-container" id="peak-hours-chart">
                <div class="loading">Loading peak hours data...</div>
            </div>
        </div>
        
        <div class="section-grid">
            <div class="card">
                <h3>📅 Weekday vs Weekend Patterns</h3>
                <div class="chart-container" id="weekday-patterns-chart">
                    <div class="loading">Loading weekday patterns...</div>
                </div>
            </div>
            
            <div class="card">
                <h3>🌱 Seasonal Activity Patterns</h3>
                <div class="chart-container" id="seasonal-patterns-chart">
                    <div class="loading">Loading seasonal patterns...</div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h3>🕐 Chronobiological Actogram</h3>
            <p>Scientific visualization showing Sven's daily activity patterns over time. Each row represents one day, with time of day on the horizontal axis.</p>
            <div class="legend">
                <div class="legend-item">
                    <div class="legend-color" style="background: #ff6b6b;"></div>
                    <span>Exit events</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #4ecdc4;"></div>
                    <span>Entry events</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #f0f0f0;"></div>
                    <span>Daytime (6AM - 6PM)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #e0e0e0;"></div>
                    <span>Nighttime (6PM - 6AM)</span>
                </div>
            </div>
            <div class="actogram-container" id="actogram">
                <div class="loading">Loading actogram data...</div>
            </div>
        </div>
    </div>
    
    <script>
        // Initialize analytics dashboard
        let analyticsData = null;
        
        // Load analytics data
        fetch('/api/analytics')
            .then(response => response.json())
            .then(data => {
                analyticsData = data;
                updateSummaryStats(data);
                renderPeakHoursChart(data.precomputed.peakHours);
                renderWeekdayPatternsChart(data.precomputed.weekdayPatterns);
                renderSeasonalPatternsChart(data.precomputed.seasonalStats);
                renderActogram(data.precomputed.dailySummaries);
            })
            .catch(error => {
                console.error('Error loading analytics data:', error);
                document.querySelectorAll('.loading').forEach(el => {
                    el.textContent = 'Error loading data. Please try again later.';
                });
            });
        
        function updateSummaryStats(data) {
            document.getElementById('total-days').textContent = data.precomputed.dailySummaries.length;
            document.getElementById('data-quality').textContent = Math.round(data.metadata.dataQuality.confidenceScore * 100) + '%';
            
            // Find peak hour
            const peakHours = data.precomputed.peakHours;
            const maxActivity = Math.max(...peakHours.map(h => h.exitFrequency + h.entryFrequency));
            const peakHour = peakHours.find(h => (h.exitFrequency + h.entryFrequency) === maxActivity);
            if (peakHour) {
                document.getElementById('peak-hour').textContent = peakHour.hour.toString().padStart(2, '0') + ':00';
            }
            
            // Calculate average daily sessions
            const avgSessions = data.precomputed.dailySummaries.reduce((sum, day) => sum + day.sessions, 0) / data.precomputed.dailySummaries.length;
            document.getElementById('avg-sessions').textContent = avgSessions.toFixed(1);
        }
        
        function renderPeakHoursChart(peakHours) {
            const container = document.getElementById('peak-hours-chart');
            container.innerHTML = '';
            
            const margin = { top: 20, right: 30, bottom: 40, left: 50 };
            const width = container.clientWidth - margin.left - margin.right;
            const height = 300 - margin.top - margin.bottom;
            
            const svg = d3.select(container)
                .append('svg')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom);
            
            const g = svg.append('g')
                .attr('transform', \`translate(\${margin.left},\${margin.top})\`);
            
            // Scales
            const xScale = d3.scaleBand()
                .domain(peakHours.map(d => d.hour))
                .range([0, width])
                .padding(0.1);
            
            const yScale = d3.scaleLinear()
                .domain([0, d3.max(peakHours, d => Math.max(d.exitFrequency, d.entryFrequency))])
                .nice()
                .range([height, 0]);
            
            // Bars for exits
            g.selectAll('.bar-exit')
                .data(peakHours)
                .enter().append('rect')
                .attr('class', 'bar-exit')
                .attr('x', d => xScale(d.hour))
                .attr('y', d => yScale(d.exitFrequency))
                .attr('width', xScale.bandwidth() / 2)
                .attr('height', d => height - yScale(d.exitFrequency))
                .attr('fill', '#667eea');
            
            // Bars for entries
            g.selectAll('.bar-entry')
                .data(peakHours)
                .enter().append('rect')
                .attr('class', 'bar-entry')
                .attr('x', d => xScale(d.hour) + xScale.bandwidth() / 2)
                .attr('y', d => yScale(d.entryFrequency))
                .attr('width', xScale.bandwidth() / 2)
                .attr('height', d => height - yScale(d.entryFrequency))
                .attr('fill', '#42a5f5');
            
            // Axes
            g.append('g')
                .attr('transform', \`translate(0,\${height})\`)
                .call(d3.axisBottom(xScale).tickFormat(d => d + ':00'));
            
            g.append('g')
                .call(d3.axisLeft(yScale));
            
            // Labels
            g.append('text')
                .attr('transform', 'rotate(-90)')
                .attr('y', 0 - margin.left)
                .attr('x', 0 - (height / 2))
                .attr('dy', '1em')
                .style('text-anchor', 'middle')
                .text('Events per Day');
            
            g.append('text')
                .attr('transform', \`translate(\${width / 2}, \${height + margin.bottom})\`)
                .style('text-anchor', 'middle')
                .text('Hour of Day');
        }
        
        function renderWeekdayPatternsChart(patterns) {
            const container = document.getElementById('weekday-patterns-chart');
            container.innerHTML = '';
            
            if (!patterns.weekdays || !patterns.weekends) {
                container.innerHTML = '<p style="text-align: center; color: #666;">No weekday pattern data available</p>';
                return;
            }
            
            const data = [
                { type: 'Weekdays', firstExit: patterns.weekdays.avgFirstExit, lastEntry: patterns.weekdays.avgLastEntry },
                { type: 'Weekends', firstExit: patterns.weekends.avgFirstExit, lastEntry: patterns.weekends.avgLastEntry }
            ];
            
            container.innerHTML = \`
                <div style="padding: 1rem;">
                    <div style="margin-bottom: 1rem;">
                        <strong>Weekdays (Mon-Fri):</strong><br>
                        First exit: \${patterns.weekdays.avgFirstExit}<br>
                        Last entry: \${patterns.weekdays.avgLastEntry}
                    </div>
                    <div>
                        <strong>Weekends (Sat-Sun):</strong><br>
                        First exit: \${patterns.weekends.avgFirstExit}<br>
                        Last entry: \${patterns.weekends.avgLastEntry}
                    </div>
                </div>
            \`;
        }
        
        function renderSeasonalPatternsChart(seasonalStats) {
            const container = document.getElementById('seasonal-patterns-chart');
            container.innerHTML = '';
            
            let html = '<div style="padding: 1rem;">';
            for (const [season, stats] of Object.entries(seasonalStats)) {
                const seasonEmoji = {
                    spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️'
                };
                
                html += \`
                    <div style="margin-bottom: 1rem;">
                        <strong>\${seasonEmoji[season] || ''} \${season.charAt(0).toUpperCase() + season.slice(1)}:</strong><br>
                        Avg sessions: \${stats.avgDailySessions}<br>
                        Avg first exit: \${stats.avgFirstExit}
                    </div>
                \`;
            }
            html += '</div>';
            container.innerHTML = html;
        }
        
        function renderActogram(dailySummaries) {
            const container = document.getElementById('actogram');
            container.innerHTML = '';
            
            if (!dailySummaries || dailySummaries.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #666;">No daily summary data available</p>';
                return;
            }
            
            // Take last 60 days for better performance
            const recentDays = dailySummaries.slice(-60);
            
            const margin = { top: 20, right: 30, bottom: 40, left: 100 };
            const width = Math.max(800, container.clientWidth) - margin.left - margin.right;
            const height = recentDays.length * 15; // 15 pixels per day
            
            const svg = d3.select(container)
                .append('svg')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom);
            
            const g = svg.append('g')
                .attr('transform', \`translate(\${margin.left},\${margin.top})\`);
            
            // Scales
            const xScale = d3.scaleLinear()
                .domain([0, 24])
                .range([0, width]);
            
            const yScale = d3.scaleBand()
                .domain(recentDays.map(d => d.date))
                .range([0, height])
                .padding(0.1);
            
            // Background for day/night
            recentDays.forEach((day, i) => {
                // Night background (6PM to 6AM)
                g.append('rect')
                    .attr('x', 0)
                    .attr('y', yScale(day.date))
                    .attr('width', xScale(6))
                    .attr('height', yScale.bandwidth())
                    .attr('fill', '#e8e8e8');
                
                g.append('rect')
                    .attr('x', xScale(18))
                    .attr('y', yScale(day.date))
                    .attr('width', xScale(6))
                    .attr('height', yScale.bandwidth())
                    .attr('fill', '#e8e8e8');
                
                // Day background (6AM to 6PM)
                g.append('rect')
                    .attr('x', xScale(6))
                    .attr('y', yScale(day.date))
                    .attr('width', xScale(12))
                    .attr('height', yScale.bandwidth())
                    .attr('fill', '#f5f5f5');
            });
            
            // Add activity markers
            recentDays.forEach(day => {
                // First exit marker
                if (day.firstExit) {
                    const hour = parseTimeToHour(day.firstExit);
                    if (hour !== null) {
                        g.append('circle')
                            .attr('cx', xScale(hour))
                            .attr('cy', yScale(day.date) + yScale.bandwidth() / 2)
                            .attr('r', 3)
                            .attr('fill', '#ff6b6b')
                            .append('title')
                            .text(\`\${day.date}: First exit at \${day.firstExit}\`);
                    }
                }
                
                // Last entry marker
                if (day.lastEntry) {
                    const hour = parseTimeToHour(day.lastEntry);
                    if (hour !== null) {
                        g.append('circle')
                            .attr('cx', xScale(hour))
                            .attr('cy', yScale(day.date) + yScale.bandwidth() / 2)
                            .attr('r', 3)
                            .attr('fill', '#4ecdc4')
                            .append('title')
                            .text(\`\${day.date}: Last entry at \${day.lastEntry}\`);
                    }
                }
            });
            
            // Axes
            const xAxis = d3.axisBottom(xScale)
                .tickFormat(d => d + ':00')
                .ticks(12);
            
            g.append('g')
                .attr('transform', \`translate(0,\${height})\`)
                .call(xAxis);
            
            const yAxis = d3.axisLeft(yScale)
                .tickFormat(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            
            g.append('g')
                .call(yAxis);
            
            // Labels
            g.append('text')
                .attr('transform', \`translate(\${width / 2}, \${height + 35})\`)
                .style('text-anchor', 'middle')
                .text('Hour of Day');
            
            g.append('text')
                .attr('transform', 'rotate(-90)')
                .attr('y', 0 - margin.left + 20)
                .attr('x', 0 - (height / 2))
                .style('text-anchor', 'middle')
                .text('Date');
        }
        
        function parseTimeToHour(timeStr) {
            if (!timeStr) return null;
            const parts = timeStr.split(':');
            if (parts.length !== 2) return null;
            const hour = parseInt(parts[0]);
            const minute = parseInt(parts[1]);
            return hour + minute / 60;
        }
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
    <link rel="icon" href="/favicon.ico" type="image/svg+xml">
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

// Download handlers
async function handleDownloadCsv(request, env) {
  const authToken = getCookie(request, 'auth_token');
  const email = await validateAuthToken(authToken, env);
  
  if (!email) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  try {
    // Fetch CSV file from GitHub
    const githubUrl = `https://raw.githubusercontent.com/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/main/master_dataset.csv`;
    const response = await fetch(githubUrl);
    
    if (!response.ok) {
      console.error(`Failed to fetch CSV from GitHub: ${response.status}`);
      return new Response('Dataset not available', { status: 404 });
    }
    
    const csvData = await response.text();
    
    return new Response(csvData, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="cat_flap_master_dataset.csv"',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    console.error('Error downloading CSV:', error);
    return new Response('Download failed', { status: 500 });
  }
}

async function handleDownloadJson(request, env) {
  const authToken = getCookie(request, 'auth_token');
  const email = await validateAuthToken(authToken, env);
  
  if (!email) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  try {
    // Fetch JSON file from GitHub
    const githubUrl = `https://raw.githubusercontent.com/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/main/master_dataset.json`;
    const response = await fetch(githubUrl);
    
    if (!response.ok) {
      console.error(`Failed to fetch JSON from GitHub: ${response.status}`);
      return new Response('Dataset not available', { status: 404 });
    }
    
    const jsonData = await response.text();
    
    return new Response(jsonData, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="cat_flap_master_dataset.json"',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    console.error('Error downloading JSON:', error);
    return new Response('Download failed', { status: 500 });
  }
}

// Favicon handlers
async function handleFavicon(request, env) {
  // Create a simple SVG favicon with a cat emoji
  const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <text y=".9em" font-size="90">🐱</text>
  </svg>`;
  
  return new Response(svgFavicon, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400'
    }
  });
}

async function handleFaviconAssets(request, env, path) {
  // For now, redirect all favicon asset requests to the main favicon
  return await handleFavicon(request, env);
}