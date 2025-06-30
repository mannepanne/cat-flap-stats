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
        case '/circadian':
          return await handleCircadian(request, env);
        case '/seasonal':
          return await handleSeasonal(request, env);
        case '/health':
          return await handleHealth(request, env);
        case '/quality':
          return await handleDataQuality(request, env);
        case '/annotations':
          return await handleAnnotations(request, env);
        case '/api/annotations':
          return await handleAnnotationsApi(request, env);
        case '/api/analytics':
          return await handleAnalyticsApi(request, env);
        case '/api/circadian':
          return await handleCircadianApi(request, env);
        case '/api/processing-metrics':
          return await handleProcessingMetricsApi(request, env);
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

// Shared CSS function for consistent styling across all pages
function getSharedCSS() {
  return `
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
        .user-info, .nav-links {
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
            top: 125%;
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
            bottom: 100%;
            right: 20px;
            margin-left: -5px;
            border-width: 5px;
            border-style: solid;
            border-color: transparent transparent rgba(0,0,0,0.9) transparent;
        }
        .info-icon:hover .tooltip {
            visibility: visible;
            opacity: 1;
        }
        .btn {
            padding: 8px 16px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 500;
            font-size: 14px;
            display: inline-block;
            transition: background 0.3s;
        }
        .btn:hover { background: #5a6fd8; }
        .btn-secondary {
            background: #e0e0e0;
            color: #333;
        }
        .btn-secondary:hover { background: #d0d0d0; }
  `;
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
      // Include recent sessions for detailed view (last 30 days) - handle both formats
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

async function handleProcessingMetricsApi(request, env) {
  const authToken = getCookie(request, 'auth_token');
  const email = await validateAuthToken(authToken, env);
  
  if (!email) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  try {
    // Fetch processing metrics from GitHub
    const metricsUrl = `https://raw.githubusercontent.com/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/main/processing_metrics.json`;
    const response = await fetch(metricsUrl);
    
    if (!response.ok) {
      console.error(`Failed to fetch processing metrics from GitHub: ${response.status}`);
      return new Response('Processing metrics not available', { status: 404 });
    }
    
    const metricsData = await response.text();
    
    return new Response(metricsData, {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // 5 minute cache
      }
    });
  } catch (error) {
    console.error('Error fetching processing metrics:', error);
    return new Response('Processing metrics fetch failed', { status: 500 });
  }
}

function getRecentSessions(sessions, days) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffString = cutoffDate.toISOString().split('T')[0];
  
  // Handle both old format (array of reports) and new format (dict or other)
  if (!sessions) {
    return [];
  }
  
  // If sessions is an array (old format), process as before
  if (Array.isArray(sessions)) {
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
  
  // For new format (dict or other), return empty for now
  // The seasonal page doesn't need recent sessions data
  return [];
}

async function handleCircadian(request, env) {
  const authToken = getCookie(request, 'auth_token');
  const email = await validateAuthToken(authToken, env);
  
  if (!email) {
    return Response.redirect(new URL('/', request.url).toString(), 302);
  }
  
  return new Response(getCircadianPage(email), {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handleCircadianApi(request, env) {
  const authToken = getCookie(request, 'auth_token');
  const email = await validateAuthToken(authToken, env);
  
  if (!email) {
    console.log('Circadian API: Unauthorized access attempt');
    return new Response('Unauthorized', { status: 401 });
  }
  
  try {
    console.log('Circadian API: Fetching analytics data from GitHub...');
    // Fetch enhanced JSON dataset with analytics from GitHub (same as analytics API)
    const jsonUrl = `https://raw.githubusercontent.com/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/main/master_dataset.json`;
    const response = await fetch(jsonUrl);
    
    if (!response.ok) {
      console.error(`Circadian API: Failed to fetch analytics data from GitHub: ${response.status}`);
      return new Response(JSON.stringify({ 
        error: 'Analytics data not available',
        debug: `GitHub fetch failed with status ${response.status}`
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const analyticsData = await response.text();
    console.log('Circadian API: Analytics data found, length:', analyticsData.length);
    const parsedData = JSON.parse(analyticsData);
    console.log('Circadian API: Data parsed successfully, keys:', Object.keys(parsedData));
    
    // Generate advanced circadian analytics
    const circadianData = await generateCircadianAnalysis(parsedData);
    
    if (circadianData.error) {
      console.log('Circadian API: Analysis returned error:', circadianData.error);
      return new Response(JSON.stringify(circadianData), {
        headers: { 
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    
    console.log('Circadian API: Analysis completed successfully');
    return new Response(JSON.stringify(circadianData), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // 5 minute cache
      }
    });
  } catch (error) {
    console.error('Circadian API: Error details:', error.message, error.stack);
    return new Response(JSON.stringify({
      error: 'Circadian analysis failed',
      details: error.message
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleSeasonal(request, env) {
  const authToken = getCookie(request, 'auth_token');
  const email = await validateAuthToken(authToken, env);
  
  if (!email) {
    return Response.redirect(new URL('/', request.url).toString(), 302);
  }
  
  return new Response(getSeasonalPage(email), {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handleHealth(request, env) {
  const authToken = getCookie(request, 'auth_token');
  const email = await validateAuthToken(authToken, env);
  
  if (!email) {
    return Response.redirect(new URL('/', request.url).toString(), 302);
  }
  
  return new Response(getHealthPage(email), {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handleDataQuality(request, env) {
  const authToken = getCookie(request, 'auth_token');
  const email = await validateAuthToken(authToken, env);
  
  if (!email) {
    return Response.redirect(new URL('/', request.url).toString(), 302);
  }
  
  return new Response(getDataQualityPage(email), {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Advanced circadian rhythm analysis
async function generateCircadianAnalysis(data) {
  console.log('Generating circadian analysis, data keys:', Object.keys(data));
  const sessions = [];
  
  // Handle enhanced format with precomputed data
  if (data.precomputed && data.precomputed.dailySummaries) {
    console.log('Using precomputed daily summaries for circadian analysis');
    // Convert daily summaries to session-like format for existing analysis
    for (const summary of data.precomputed.dailySummaries) {
      if (summary.firstExit && summary.lastEntry) {
        sessions.push({
          date: summary.date,
          exitTime: summary.firstExit,
          entryTime: summary.lastEntry,
          duration: summary.totalOutdoorTime
        });
      }
    }
    console.log('Converted', sessions.length, 'daily summaries to session format');
  } else {
    // Fallback to old format processing
    const sessionsSource = data.sessions || data;
    console.log('Sessions source type:', typeof sessionsSource, 'length:', sessionsSource?.length);
    
    // Only process if sessionsSource is an array (old format)
    if (Array.isArray(sessionsSource)) {
      for (const report of sessionsSource) {
        if (report.session_data) {
          console.log('Processing report with', report.session_data.length, 'sessions');
          for (const session of report.session_data) {
            // More flexible field name checking
            const exitTime = session.exit_time || session.Exit_Time || session.exitTime;
            const entryTime = session.entry_time || session.Entry_Time || session.entryTime;
            const dateField = session.date_full || session.date || session.Date;
            
            if (exitTime && entryTime && dateField) {
              sessions.push({
                date: dateField,
                exitTime: exitTime,
                entryTime: entryTime,
                duration: session.duration || session.Duration
              });
            } else {
              console.log('Skipping session missing fields:', {
                hasExit: !!exitTime,
                hasEntry: !!entryTime,
                hasDate: !!dateField,
                sessionKeys: Object.keys(session)
              });
            }
          }
        } else {
          console.log('Report missing session_data:', Object.keys(report));
        }
      }
    } else {
      console.log('Sessions source is not an array, enhanced format expected');
    }
  }
  
  console.log('Extracted', sessions.length, 'valid sessions for circadian analysis');
  
  if (sessions.length === 0) {
    return { 
      error: 'No session data available for circadian analysis',
      debug: {
        dataKeys: Object.keys(data),
        sessionsSourceType: typeof sessionsSource,
        sessionsSourceLength: sessionsSource?.length
      }
    };
  }
  
  // Calculate circadian metrics
  const polarClockData = calculatePolarClock(sessions);
  const circadianStrength = calculateCircadianStrength(sessions);
  const seasonalPhases = calculateSeasonalPhases(sessions);
  const activityEntropy = calculateActivityEntropy(sessions);
  const zeitgeberAnalysis = calculateZeitgeberInfluence(sessions);
  
  return {
    metadata: {
      analysisType: 'circadian_rhythm',
      sessionCount: sessions.length,
      dateRange: data.metadata?.dateRange || 'Unknown',
      generated: new Date().toISOString()
    },
    polarClock: polarClockData,
    circadianMetrics: {
      strength: circadianStrength,
      entropy: activityEntropy,
      zeitgeberInfluence: zeitgeberAnalysis
    },
    seasonalAnalysis: seasonalPhases,
    insights: generateCircadianInsights(circadianStrength, activityEntropy, seasonalPhases)
  };
}

function calculatePolarClock(sessions) {
  const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    exits: 0,
    entries: 0,
    totalActivity: 0,
    seasonalVariation: { spring: 0, summer: 0, autumn: 0, winter: 0 }
  }));
  
  sessions.forEach(session => {
    const date = new Date(session.date);
    const season = getSeason(date);
    const exitHour = parseInt(session.exitTime.split(':')[0]);
    const entryHour = parseInt(session.entryTime.split(':')[0]);
    
    hourlyData[exitHour].exits++;
    hourlyData[exitHour].totalActivity++;
    hourlyData[exitHour].seasonalVariation[season]++;
    
    hourlyData[entryHour].entries++;
    hourlyData[entryHour].totalActivity++;
    hourlyData[entryHour].seasonalVariation[season]++;
  });
  
  return hourlyData;
}

function calculateCircadianStrength(sessions) {
  // Calculate how consistently activity occurs at the same times
  const hourlyActivity = new Array(24).fill(0);
  
  sessions.forEach(session => {
    const exitHour = parseInt(session.exitTime.split(':')[0]);
    const entryHour = parseInt(session.entryTime.split(':')[0]);
    hourlyActivity[exitHour]++;
    hourlyActivity[entryHour]++;
  });
  
  // Calculate amplitude and phase coherence
  const maxActivity = Math.max(...hourlyActivity);
  const avgActivity = hourlyActivity.reduce((a, b) => a + b, 0) / 24;
  const amplitude = (maxActivity - avgActivity) / avgActivity;
  
  // Calculate rhythm regularity (lower standard deviation = more regular)
  const variance = hourlyActivity.reduce((sum, activity) => 
    sum + Math.pow(activity - avgActivity, 2), 0) / 24;
  const regularity = 1 / (1 + Math.sqrt(variance) / avgActivity);
  
  return {
    amplitude: Math.round(amplitude * 100) / 100,
    regularity: Math.round(regularity * 100) / 100,
    strength: Math.round((amplitude * regularity) * 100) / 100,
    peakHour: hourlyActivity.indexOf(maxActivity),
    classification: amplitude > 1.5 ? 'Strong' : amplitude > 0.8 ? 'Moderate' : 'Weak'
  };
}

function calculateSeasonalPhases(sessions) {
  const seasons = { spring: [], summer: [], autumn: [], winter: [] };
  
  sessions.forEach(session => {
    const date = new Date(session.date);
    const season = getSeason(date);
    const exitHour = parseInt(session.exitTime.split(':')[0]);
    seasons[season].push(exitHour);
  });
  
  const seasonalPhases = {};
  Object.entries(seasons).forEach(([season, hours]) => {
    if (hours.length > 0) {
      const avgHour = hours.reduce((a, b) => a + b, 0) / hours.length;
      const variance = hours.reduce((sum, hour) => sum + Math.pow(hour - avgHour, 2), 0) / hours.length;
      
      seasonalPhases[season] = {
        averagePhase: Math.round(avgHour * 100) / 100,
        consistency: Math.round((1 / (1 + Math.sqrt(variance))) * 100) / 100,
        sessionCount: hours.length
      };
    }
  });
  
  return seasonalPhases;
}

function calculateActivityEntropy(sessions) {
  // Measure predictability vs chaos in activity patterns
  const hourlyDistribution = new Array(24).fill(0);
  
  sessions.forEach(session => {
    const exitHour = parseInt(session.exitTime.split(':')[0]);
    hourlyDistribution[exitHour]++;
  });
  
  const total = hourlyDistribution.reduce((a, b) => a + b, 0);
  const probabilities = hourlyDistribution.map(count => count / total);
  
  // Shannon entropy calculation
  const entropy = -probabilities.reduce((sum, p) => {
    return p > 0 ? sum + p * Math.log2(p) : sum;
  }, 0);
  
  const maxEntropy = Math.log2(24); // Maximum possible entropy for 24 hours
  const normalizedEntropy = entropy / maxEntropy;
  
  return {
    entropy: Math.round(entropy * 100) / 100,
    normalized: Math.round(normalizedEntropy * 100) / 100,
    predictability: Math.round((1 - normalizedEntropy) * 100) / 100,
    classification: normalizedEntropy < 0.5 ? 'Highly Predictable' : 
                   normalizedEntropy < 0.8 ? 'Moderately Predictable' : 'Chaotic'
  };
}

function calculateZeitgeberInfluence(sessions) {
  // Analyze how external time cues (sunrise/sunset) influence behavior
  const morningActivity = sessions.filter(s => {
    const hour = parseInt(s.exitTime.split(':')[0]);
    return hour >= 5 && hour <= 10;
  }).length;
  
  const eveningActivity = sessions.filter(s => {
    const hour = parseInt(s.exitTime.split(':')[0]);
    return hour >= 17 && hour <= 22;
  }).length;
  
  const totalActivity = sessions.length;
  const crepuscularIndex = (morningActivity + eveningActivity) / totalActivity;
  
  return {
    morningActivity: Math.round((morningActivity / totalActivity) * 100),
    eveningActivity: Math.round((eveningActivity / totalActivity) * 100),
    crepuscularIndex: Math.round(crepuscularIndex * 100) / 100,
    classification: crepuscularIndex > 0.6 ? 'Strongly Crepuscular' :
                   crepuscularIndex > 0.4 ? 'Moderately Crepuscular' : 'Not Crepuscular'
  };
}

function getSeason(date) {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

function generateCircadianInsights(strength, entropy, seasonal) {
  const insights = [];
  
  if (strength.strength > 0.8) {
    insights.push(`Sven shows ${strength.classification.toLowerCase()} circadian rhythms with peak activity at ${strength.peakHour}:00.`);
  }
  
  if (entropy.predictability > 0.7) {
    insights.push(`Highly predictable behavior patterns - you can likely anticipate when Sven will be active!`);
  } else if (entropy.predictability < 0.3) {
    insights.push(`Sven's activity patterns are quite variable - he's full of surprises!`);
  }
  
  const seasonalVariation = Object.values(seasonal).map(s => s?.averagePhase || 0);
  const maxPhase = Math.max(...seasonalVariation);
  const minPhase = Math.min(...seasonalVariation);
  if (maxPhase - minPhase > 2) {
    insights.push(`Significant seasonal adaptation detected - Sven adjusts his schedule by ${Math.round(maxPhase - minPhase)} hours between seasons.`);
  }
  
  return insights;
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
        ${getSharedCSS()}
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
                <div class="info-icon">
                    i
                    <div class="tooltip" id="days-data-tooltip">
                        <strong>Days of Data: 455</strong><br><br>
                        Total calendar days from first to last recorded session.<br><br>
                        <strong>Date Range:</strong> <span id="tooltip-date-range">Loading...</span><br>
                        <strong>Calculation:</strong> End date - Start date + 1<br><br>
                        This represents the complete timespan covered by the dataset, including days with no activity.
                    </div>
                </div>
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
            <h3>🌍 Circadian Rhythm Analysis</h3>
            <p>Advanced chronobiological analysis of Sven's internal clock, including polar activity visualization, behavioral predictability metrics, and seasonal adaptation patterns.</p>
            <br>
            <a href="/circadian" class="btn">Analyze Circadian Rhythms</a>
        </div>
        
        <div class="card">
            <h3>🔬 Seasonal Pattern Detection</h3>
            <p>Statistical analysis of seasonal behavioral differences with UK meteorological seasons, hypothesis testing, and comprehensive duration vs frequency comparisons.</p>
            <br>
            <a href="/seasonal" class="btn">Analyze Seasonal Patterns</a>
        </div>
        
        <div class="card">
            <h3>Upload New PDF Report</h3>
            <p>Upload your weekly SURE Petcare PDF report to add new data to the dataset.</p>
            <br>
            <a href="/upload" class="btn">Upload PDF File</a>
        </div>
        
        <div class="card">
            <h3>📝 Behavioral Annotations</h3>
            <p>Add, view, and manage behavioral annotations to track contextual events that might influence Sven's behavior patterns.</p>
            <br>
            <a href="/annotations" class="btn">Manage Annotations</a>
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
            
            // Calculate and update days of data from date range
            if (analyticsData.metadata && analyticsData.metadata.dateRange) {
                const dateRange = analyticsData.metadata.dateRange;
                if (dateRange.includes(' to ')) {
                    const [startDate, endDate] = dateRange.split(' to ');
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    const timeDiff = end - start;
                    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end day
                    document.getElementById('date-range').textContent = daysDiff.toLocaleString();
                    
                    // Update tooltip with real data
                    const formattedStart = start.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                    const formattedEnd = end.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                    const tooltipElement = document.getElementById('days-data-tooltip');
                    if (tooltipElement) {
                        tooltipElement.innerHTML = 
                            '<strong>Days of Data: ' + daysDiff.toLocaleString() + '</strong><br><br>' +
                            'Total calendar days from first to last recorded session.<br><br>' +
                            '<strong>Date Range:</strong> ' + formattedStart + ' to ' + formattedEnd + '<br>' +
                            '<strong>Calculation:</strong> End date - Start date + 1<br><br>' +
                            'This represents the complete timespan covered by the dataset, including days with no activity.';
                    }
                }
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
        ${getSharedCSS()}
        
        /* Patterns page specific styles */
        .container {
            max-width: 1400px;
            margin: 2rem auto;
            padding: 0 1rem;
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
        .loading {
            text-align: center;
            padding: 2rem;
            color: #666;
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
        /* D3.js chart tooltip - different from info tooltip */
        .d3-tooltip {
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
            <a href="/circadian" class="btn btn-secondary">Circadian</a>
            <a href="/seasonal" class="btn btn-secondary">Seasonal</a>
            <a href="/annotations" class="btn btn-secondary">Annotations</a>
            <span>Welcome, ${email}</span>
            <a href="/logout" class="btn btn-secondary">Logout</a>
        </div>
    </div>
    
    <div class="container">
        <div class="stats-grid">
            <div class="stat-card">
                <div class="info-icon">
                    i
                    <div class="tooltip" id="days-analyzed-tooltip">
                        <strong>Days Analyzed: 404</strong><br><br>
                        Days with actual cat flap activity recorded (≥1 session).<br><br>
                        <strong>Difference from "Days of Data":</strong><br>
                        • Days of Data: 455 (total calendar span)<br>
                        • Days Analyzed: 404 (days with activity)<br>
                        • Gap: 51 days with no recorded sessions<br><br>
                        Days without activity occur due to weather, illness, alternative exits, or Sven staying indoors.
                    </div>
                </div>
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
                <div class="legend-item">
                    <span style="margin-right: 0.5rem;">💬</span>
                    <span>Behavioral annotations</span>
                </div>
                <div class="legend-item">
                    <span style="margin-right: 0.5rem;">⚕️</span>
                    <span>Health anomalies</span>
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
        let annotationsData = [];
        
        // Global click handler to close tooltips when clicking outside
        document.addEventListener('click', function(event) {
            // Don't close if clicking on markers or inside tooltips
            if (event.target.textContent === '⚕️' || 
                event.target.textContent === '💬' || 
                event.target.closest('.d3-tooltip')) {
                return;
            }
            // Close all tooltips
            d3.selectAll('.health-tooltip').remove();
            d3.selectAll('.annotation-tooltip').remove();
        });
        
        // Load analytics data first (critical)
        console.log('Starting to load analytics data...');
        fetch('/api/analytics')
            .then(response => {
                console.log('Analytics response received:', response.status);
                if (!response.ok) {
                    throw new Error('Analytics API returned ' + response.status);
                }
                return response.json();
            })
            .then(data => {
                console.log('Analytics data parsed successfully:', data);
                analyticsData = data;
                updateSummaryStats(data);
                renderPeakHoursChart(data.precomputed.peakHours);
                renderWeekdayPatternsChart(data.precomputed.weekdayPatterns);
                renderSeasonalPatternsChart(data.precomputed.seasonalStats);
                
                // Load annotations separately (optional)
                console.log('Loading annotations...');
                fetch('/api/annotations')
                    .then(response => {
                        console.log('Annotations response received:', response.status);
                        return response.json();
                    })
                    .then(annotations => {
                        console.log('Annotations loaded:', annotations.length, 'annotations');
                        annotationsData = annotations;
                        const healthAnomalies = data.precomputed.durationAnomalies ? data.precomputed.durationAnomalies.anomalies : [];
                        renderActogram(data.precomputed.dailySummaries, annotations, healthAnomalies);
                    })
                    .catch(error => {
                        console.warn('Error loading annotations, rendering actogram without annotations:', error);
                        const healthAnomalies = data.precomputed.durationAnomalies ? data.precomputed.durationAnomalies.anomalies : [];
                        renderActogram(data.precomputed.dailySummaries, [], healthAnomalies);
                    });
            })
            .catch(error => {
                console.error('Error loading analytics data:', error);
                document.querySelectorAll('.loading').forEach(el => {
                    el.textContent = 'Error loading data. Please try again later.';
                });
            });
        
        function updateSummaryStats(data) {
            const totalDaysAnalyzed = data.precomputed.dailySummaries.length;
            document.getElementById('total-days').textContent = totalDaysAnalyzed;
            document.getElementById('data-quality').textContent = Math.round(data.metadata.dataQuality.confidenceScore * 100) + '%';
            
            // Update Days Analyzed tooltip with real data
            if (data.metadata && data.metadata.dateRange) {
                const dateRange = data.metadata.dateRange;
                let totalDaysInRange = 0;
                if (dateRange.includes(' to ')) {
                    const [startDate, endDate] = dateRange.split(' to ');
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    const timeDiff = end - start;
                    totalDaysInRange = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;
                }
                
                const daysWithoutActivity = totalDaysInRange - totalDaysAnalyzed;
                const tooltipElement = document.getElementById('days-analyzed-tooltip');
                if (tooltipElement) {
                    tooltipElement.innerHTML = 
                        '<strong>Days Analyzed: ' + totalDaysAnalyzed.toLocaleString() + '</strong><br><br>' +
                        'Days with actual cat flap activity recorded (≥1 session).<br><br>' +
                        '<strong>Difference from "Days of Data":</strong><br>' +
                        '• Days of Data: ' + totalDaysInRange.toLocaleString() + ' (total calendar span)<br>' +
                        '• Days Analyzed: ' + totalDaysAnalyzed.toLocaleString() + ' (days with activity)<br>' +
                        '• Gap: ' + daysWithoutActivity.toLocaleString() + ' days with no recorded sessions<br><br>' +
                        'Days without activity occur due to weather, illness, alternative exits, or Sven staying indoors.';
                }
            }
            
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
                
                // Handle both old and new seasonal data formats
                const avgSessions = stats.frequency_metrics?.avg_daily_sessions || stats.avgDailySessions || 'N/A';
                const avgFirstExit = stats.timing_metrics?.avg_first_exit || stats.avgFirstExit || 'N/A';
                
                html += \`
                    <div style="margin-bottom: 1rem;">
                        <strong>\${seasonEmoji[season] || ''} \${season.charAt(0).toUpperCase() + season.slice(1)}:</strong><br>
                        Avg sessions: \${typeof avgSessions === 'number' ? avgSessions.toFixed(1) : avgSessions}<br>
                        Avg first exit: \${avgFirstExit}
                    </div>
                \`;
            }
            html += '</div>';
            container.innerHTML = html;
        }
        
        function renderActogram(dailySummaries, annotations = [], healthAnomalies = []) {
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
            
            // Add annotation markers
            if (annotations && annotations.length > 0) {
                // Group annotations by start date
                const annotationsByDate = {};
                annotations.forEach(annotation => {
                    const startDate = annotation.startDate;
                    if (!annotationsByDate[startDate]) {
                        annotationsByDate[startDate] = [];
                    }
                    annotationsByDate[startDate].push(annotation);
                });
                
                // Add markers for dates that have annotations and are visible in the actogram
                const visibleDates = recentDays.map(d => d.date);
                Object.keys(annotationsByDate).forEach(date => {
                    if (visibleDates.includes(date)) {
                        const dayAnnotations = annotationsByDate[date];
                        
                        // Create annotation marker (speech bubble icon)
                        const marker = g.append('text')
                            .attr('x', xScale(1)) // Position at 1:00 AM to avoid crowding
                            .attr('y', yScale(date) + yScale.bandwidth() / 2)
                            .attr('text-anchor', 'middle')
                            .attr('dominant-baseline', 'middle')
                            .style('font-size', '12px')
                            .style('cursor', 'pointer')
                            .style('fill', '#666')
                            .text('💬');
                        
                        // Add interactive hover tooltip with improved handling
                        marker.on('mouseenter', function(event) {
                            // Clear any existing annotation tooltips first
                            d3.selectAll('.annotation-tooltip').remove();
                            
                            const tooltip = d3.select('body').append('div')
                                .attr('class', 'd3-tooltip annotation-tooltip')
                                .style('left', (event.pageX + 10) + 'px')
                                .style('top', (event.pageY - 10) + 'px')
                                .style('max-width', '400px')
                                .style('padding', '12px')
                                .style('pointer-events', 'auto'); // Allow interactions within tooltip
                            
                            let tooltipContent = '<strong>Annotations on ' + new Date(date).toLocaleDateString() + ':</strong><br><br>';
                            dayAnnotations.forEach(annotation => {
                                const endDate = annotation.endDate !== annotation.startDate ? 
                                    ' to ' + new Date(annotation.endDate).toLocaleDateString() : '';
                                const createdBy = annotation.createdBy.includes('magnus') ? 'Magnus' : 'Wendy';
                                
                                tooltipContent += '<div style="background: rgba(255,255,255,0.1); padding: 8px; margin-bottom: 8px; border-radius: 4px;">';
                                tooltipContent += '<div style="display: flex; justify-content: space-between; align-items: flex-start;">';
                                tooltipContent += '<div style="flex: 1;">';
                                // Escape HTML content to prevent syntax errors
                                const escapeHtml = (text) => text.replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                                
                                tooltipContent += '<strong>' + escapeHtml(annotation.title) + '</strong><br>';
                                tooltipContent += '<span style="font-size: 11px; opacity: 0.8;">Category: ' + escapeHtml(annotation.category) + '</span><br>';
                                tooltipContent += '<span style="font-size: 11px; opacity: 0.8;">Date: ' + new Date(annotation.startDate).toLocaleDateString() + endDate + '</span><br>';
                                if (annotation.description) {
                                    const shortDesc = annotation.description.length > 50 ? 
                                        annotation.description.substring(0, 50) + '...' : annotation.description;
                                    tooltipContent += '<span style="font-size: 11px; opacity: 0.8;">' + escapeHtml(shortDesc) + '</span><br>';
                                }
                                tooltipContent += '<span style="font-size: 10px; opacity: 0.6;">Added by: ' + escapeHtml(createdBy) + '</span>';
                                tooltipContent += '</div>';
                                tooltipContent += '<button onclick="editAnnotationFromTooltip(\\'' + annotation.id + '\\')" style="background: #2e7d32; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 10px; cursor: pointer; margin-left: 8px;">Edit</button>';
                                tooltipContent += '</div></div>';
                            });
                            
                            tooltip.html(tooltipContent);
                            
                            // Add mouseleave handler to tooltip itself
                            tooltip.on('mouseleave', function(tooltipEvent) {
                                setTimeout(() => {
                                    // Check if mouse moved back to an annotation marker
                                    const hoveredElement = document.elementFromPoint(tooltipEvent.clientX, tooltipEvent.clientY);
                                    if (!hoveredElement || hoveredElement.textContent !== '💬') {
                                        d3.selectAll('.annotation-tooltip').remove();
                                    }
                                }, 100);
                            });
                        })
                        .on('mouseleave', function(event) {
                            // Improved debouncing: only remove tooltip if moving to non-annotation elements
                            setTimeout(() => {
                                const relatedTarget = event.relatedTarget;
                                
                                // Don't remove if moving to tooltip itself or another annotation marker
                                if (relatedTarget && (
                                    relatedTarget.closest('.d3-tooltip') || 
                                    relatedTarget.closest('.annotation-tooltip') ||
                                    (relatedTarget.textContent === '💬')
                                )) {
                                    return;
                                }
                                
                                // Remove only annotation tooltips to avoid conflicts with health tooltips
                                d3.selectAll('.annotation-tooltip').remove();
                            }, 150);
                        });
                    }
                });
            }
            
            // Add health anomaly markers (⚕️)
            if (healthAnomalies && healthAnomalies.length > 0) {
                // Group anomalies by date
                const anomaliesByDate = {};
                healthAnomalies.forEach(anomaly => {
                    const anomalyDate = anomaly.date;
                    if (!anomaliesByDate[anomalyDate]) {
                        anomaliesByDate[anomalyDate] = [];
                    }
                    anomaliesByDate[anomalyDate].push(anomaly);
                });
                
                // Add markers for dates that have anomalies and are visible in the actogram
                const visibleDates = recentDays.map(d => d.date);
                Object.keys(anomaliesByDate).forEach(date => {
                    if (visibleDates.includes(date)) {
                        const dayAnomalies = anomaliesByDate[date];
                        
                        // Determine marker color based on highest severity
                        const severities = dayAnomalies.map(a => a.severity);
                        let markerColor = '#4caf50'; // Default green for mild
                        if (severities.includes('high')) {
                            markerColor = '#f44336'; // Red for significant
                        } else if (severities.includes('medium')) {
                            markerColor = '#ff9800'; // Orange for moderate
                        }
                        
                        // Create health anomaly marker (medical icon)
                        const marker = g.append('text')
                            .attr('x', xScale(23)) // Position at 11:00 PM to avoid crowding with annotations
                            .attr('y', yScale(date) + yScale.bandwidth() / 2)
                            .attr('text-anchor', 'middle')
                            .attr('dominant-baseline', 'middle')
                            .style('font-size', '12px')
                            .style('cursor', 'pointer')
                            .style('fill', markerColor)
                            .text('⚕️');
                        
                        // Add interactive hover tooltip with improved handling
                        marker.on('mouseenter', function(event) {
                            // Clear any existing tooltips first
                            d3.selectAll('.d3-tooltip').remove();
                            
                            const tooltip = d3.select('body').append('div')
                                .attr('class', 'd3-tooltip health-tooltip')
                                .style('left', (event.pageX + 10) + 'px')
                                .style('top', (event.pageY - 10) + 'px')
                                .style('max-width', '400px')
                                .style('padding', '12px')
                                .style('pointer-events', 'auto');
                            
                            let tooltipContent = '<strong>Health Anomalies on ' + new Date(date).toLocaleDateString() + ':</strong><br><br>';
                            dayAnomalies.forEach(anomaly => {
                                const severityColor = {
                                    'high': '#c62828',
                                    'medium': '#ef6c00', 
                                    'low': '#f57f17'
                                }[anomaly.severity] || '#666';
                                
                                const severityText = {
                                    'high': 'SIGNIFICANT',
                                    'medium': 'MODERATE',
                                    'low': 'MILD'
                                }[anomaly.severity] || anomaly.anomaly_type;
                                
                                tooltipContent += '<div style="background: rgba(255,255,255,0.1); padding: 8px; margin-bottom: 8px; border-radius: 4px; border-left: 3px solid ' + severityColor + ';">';
                                tooltipContent += '<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">';
                                tooltipContent += '<strong style="color: ' + severityColor + ';">' + severityText + '</strong>';
                                tooltipContent += '<span style="font-size: 10px; opacity: 0.8;">' + anomaly.exit_time + ' - ' + anomaly.entry_time + '</span>';
                                tooltipContent += '</div>';
                                tooltipContent += '<div style="font-size: 11px; margin-bottom: 2px;">' + anomaly.description + '</div>';
                                tooltipContent += '<div style="font-size: 10px; opacity: 0.6;">z-score: ' + anomaly.z_score + ' | Season: ' + anomaly.season + '</div>';
                                tooltipContent += '</div>';
                            });
                            
                            tooltipContent += '<div style="font-size: 10px; opacity: 0.7; margin-top: 8px; font-style: italic;">Click to view detailed health analysis</div>';
                            
                            tooltip.html(tooltipContent);
                            
                            // Add mouseleave handler to tooltip itself
                            tooltip.on('mouseleave', function(tooltipEvent) {
                                setTimeout(() => {
                                    // Check if mouse moved back to a health marker
                                    const hoveredElement = document.elementFromPoint(tooltipEvent.clientX, tooltipEvent.clientY);
                                    if (!hoveredElement || hoveredElement.textContent !== '⚕️') {
                                        d3.selectAll('.health-tooltip').remove();
                                    }
                                }, 100);
                            });
                        })
                        .on('mouseleave', function(event) {
                            // Improved debouncing: only remove tooltip if moving to non-health elements
                            setTimeout(() => {
                                const relatedTarget = event.relatedTarget;
                                
                                // Don't remove if moving to tooltip itself or another health marker
                                if (relatedTarget && (
                                    relatedTarget.closest('.d3-tooltip') || 
                                    relatedTarget.closest('.health-tooltip') ||
                                    (relatedTarget.textContent === '⚕️')
                                )) {
                                    return;
                                }
                                
                                // Remove only health tooltips to avoid conflicts with annotation tooltips
                                d3.selectAll('.health-tooltip').remove();
                            }, 150);
                        })
                        .on('click', function() {
                            // Navigate to health page for detailed analysis
                            window.location.href = '/health';
                        });
                    }
                });
            }
            
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
        
        // Global function for editing annotations from tooltip
        window.editAnnotationFromTooltip = function(annotationId) {
            window.location.href = '/annotations?edit=' + annotationId;
        };
    </script>
</body>
</html>`;
}

function getCircadianPage(email) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cat Flap Stats - Circadian Rhythm Analysis</title>
    <link rel="icon" href="/favicon.ico" type="image/svg+xml">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        ${getSharedCSS()}
        
        /* Circadian page specific styles */
        .container {
            max-width: 1400px;
            margin: 2rem auto;
            padding: 0 1rem;
        }
        .circadian-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-bottom: 2rem;
        }
        @media (max-width: 768px) {
            .circadian-grid { grid-template-columns: 1fr; }
        }
        .polar-clock-container {
            width: 100%;
            height: 500px;
            position: relative;
            background: radial-gradient(circle, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 50%;
            margin: 1rem auto;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        .metric-sublabel {
            color: #999;
            font-size: 0.8rem;
            margin-top: 0.25rem;
        }
        .insights-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            border-radius: 12px;
            margin-bottom: 2rem;
        }
        .insights-card h3 {
            margin-bottom: 1rem;
            font-size: 1.5rem;
        }
        .insight-item {
            background: rgba(255,255,255,0.1);
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 0.5rem;
            backdrop-filter: blur(10px);
        }
        .seasonal-analysis {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
        }
        .season-card {
            background: white;
            padding: 1rem;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .season-icon {
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }
        .loading {
            text-align: center;
            padding: 3rem;
            color: #666;
            font-size: 1.2rem;
        }
        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .polar-axis {
            stroke: #999;
            stroke-width: 1;
            fill: none;
        }
        .polar-grid {
            stroke: #ddd;
            stroke-width: 0.5;
            fill: none;
        }
        .hour-label {
            font-size: 12px;
            font-weight: 500;
            fill: #666;
            text-anchor: middle;
        }
        .activity-arc {
            stroke-width: 8;
            fill: none;
            opacity: 0.8;
        }
        .exit-arc { stroke: #ff6b6b; }
        .entry-arc { stroke: #4ecdc4; }
        .legend-circadian {
            display: flex;
            justify-content: center;
            gap: 2rem;
            margin-bottom: 1rem;
        }
        .legend-item-circadian {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.9rem;
        }
        .legend-color-circadian {
            width: 20px;
            height: 4px;
            border-radius: 2px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">
            <h2>🌍 Cat Flap Stats - Circadian Rhythm Analysis</h2>
        </div>
        <div class="nav-links">
            <a href="/dashboard" class="btn btn-secondary">Dashboard</a>
            <a href="/patterns" class="btn btn-secondary">Patterns</a>
            <a href="/seasonal" class="btn btn-secondary">Seasonal</a>
            <a href="/annotations" class="btn btn-secondary">Annotations</a>
            <span>Welcome, ${email}</span>
            <a href="/logout" class="btn btn-secondary">Logout</a>
        </div>
    </div>
    
    <div class="container">
        <div class="loading" id="loading">
            <div class="loading-spinner"></div>
            Analyzing Sven's circadian rhythms...
        </div>
        
        <div id="circadian-content" style="display: none;">
            <!-- Key Metrics -->
            <div class="stats-grid" id="circadian-metrics">
                <div class="stat-card">
                    <div class="info-icon">
                        i
                        <div class="tooltip" id="circadian-strength-tooltip">
                            <strong>Circadian Strength: 1.2</strong><br><br>
                            Measures how well-defined Sven's internal clock is.<br><br>
                            <strong>Calculation:</strong> Amplitude × Regularity<br>
                            • Amplitude: Peak activity vs average activity<br>
                            • Regularity: Consistency of timing day-to-day<br><br>
                            <strong>Scale:</strong> 0.0 (chaotic) to 2.0+ (very strong)<br>
                            Higher values indicate a cat with predictable daily rhythms, like wild animals.
                        </div>
                    </div>
                    <div class="stat-number" id="circadian-strength">0.0</div>
                    <div class="stat-label">Circadian Strength</div>
                    <div class="metric-sublabel" id="strength-classification">Calculating...</div>
                </div>
                <div class="stat-card">
                    <div class="info-icon">
                        i
                        <div class="tooltip" id="peak-activity-tooltip">
                            <strong>Peak Activity Hour: 14:00</strong><br><br>
                            The hour when Sven is most active throughout the day.<br><br>
                            <strong>Calculation:</strong> Hour with highest combined exit + entry frequency<br>
                            • Counts all exits and entries across entire dataset<br>
                            • Averaged per day to find consistent peak<br><br>
                            <strong>Interesting fact:</strong> Wild cats are typically most active at dawn (06:00) and dusk (18:00). Sven's pattern shows how domestication affects natural rhythms!
                        </div>
                    </div>
                    <div class="stat-number" id="peak-activity-hour">00:00</div>
                    <div class="stat-label">Peak Activity Hour</div>
                    <div class="metric-sublabel">Highest activity period</div>
                </div>
                <div class="stat-card">
                    <div class="info-icon">
                        i
                        <div class="tooltip" id="predictability-tooltip">
                            <strong>Behavioral Predictability: 75%</strong><br><br>
                            How predictable Sven's daily routine is, based on information theory.<br><br>
                            <strong>Calculation:</strong> 1 - (Shannon Entropy ÷ Maximum Entropy)<br>
                            • Shannon entropy measures randomness in hourly activity<br>
                            • Higher predictability = more routine behavior<br><br>
                            <strong>Scale:</strong> 0% (completely random) to 100% (perfectly routine)<br>
                            High predictability means you can anticipate when Sven will be active!
                        </div>
                    </div>
                    <div class="stat-number" id="predictability">0%</div>
                    <div class="stat-label">Behavioral Predictability</div>
                    <div class="metric-sublabel" id="entropy-classification">Calculating...</div>
                </div>
                <div class="stat-card">
                    <div class="info-icon">
                        i
                        <div class="tooltip" id="crepuscular-tooltip">
                            <strong>Crepuscular Index: 45%</strong><br><br>
                            Measures if Sven follows the natural "crepuscular" pattern of being active at dawn and dusk.<br><br>
                            <strong>Calculation:</strong> (Morning + Evening activity) ÷ Total activity<br>
                            • Morning: 05:00-10:00 activity<br>
                            • Evening: 17:00-22:00 activity<br><br>
                            <strong>Wild cats:</strong> 60%+ (strongly crepuscular)<br>
                            <strong>House cats:</strong> Often 30-50% (human-influenced)<br>
                            Shows how much Sven retains his wild instincts!
                        </div>
                    </div>
                    <div class="stat-number" id="crepuscular-index">0%</div>
                    <div class="stat-label">Crepuscular Index</div>
                    <div class="metric-sublabel" id="zeitgeber-classification">Calculating...</div>
                </div>
            </div>
            
            <!-- Main Visualization -->
            <div class="circadian-grid">
                <div class="card">
                    <h3>🕐 24-Hour Polar Activity Clock</h3>
                    <div class="legend-circadian">
                        <div class="legend-item-circadian">
                            <div class="legend-color-circadian" style="background: #ff6b6b;"></div>
                            <span>Exits</span>
                        </div>
                        <div class="legend-item-circadian">
                            <div class="legend-color-circadian" style="background: #4ecdc4;"></div>
                            <span>Entries</span>
                        </div>
                    </div>
                    <div class="polar-clock-container" id="polar-clock"></div>
                </div>
                
                <div class="card">
                    <h3>🌿 Seasonal Phase Analysis</h3>
                    <div class="seasonal-analysis" id="seasonal-grid">
                        <div class="season-card">
                            <div class="season-icon">🌸</div>
                            <h4>Spring</h4>
                            <div class="stat-number" style="font-size: 1.5rem;" id="spring-phase">--:--</div>
                            <div class="metric-sublabel" id="spring-consistency">--% consistent</div>
                        </div>
                        <div class="season-card">
                            <div class="season-icon">☀️</div>
                            <h4>Summer</h4>
                            <div class="stat-number" style="font-size: 1.5rem;" id="summer-phase">--:--</div>
                            <div class="metric-sublabel" id="summer-consistency">--% consistent</div>
                        </div>
                        <div class="season-card">
                            <div class="season-icon">🍂</div>
                            <h4>Autumn</h4>
                            <div class="stat-number" style="font-size: 1.5rem;" id="autumn-phase">--:--</div>
                            <div class="metric-sublabel" id="autumn-consistency">--% consistent</div>
                        </div>
                        <div class="season-card">
                            <div class="season-icon">❄️</div>
                            <h4>Winter</h4>
                            <div class="stat-number" style="font-size: 1.5rem;" id="winter-phase">--:--</div>
                            <div class="metric-sublabel" id="winter-consistency">--% consistent</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Insights -->
            <div class="insights-card" id="insights-section">
                <h3>🧠 Circadian Insights</h3>
                <div id="insights-content">
                    <div class="insight-item">Analyzing behavioral patterns...</div>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        // Load circadian data on page load
        document.addEventListener('DOMContentLoaded', function() {
            loadCircadianData();
        });
        
        async function loadCircadianData() {
            try {
                const response = await fetch('/api/circadian');
                const data = await response.json();
                
                if (data.error) {
                    document.getElementById('loading').innerHTML = 
                        '<div style="color: #e74c3c;">⚠️ ' + data.error + '</div>';
                    return;
                }
                
                // Hide loading and show content
                document.getElementById('loading').style.display = 'none';
                document.getElementById('circadian-content').style.display = 'block';
                
                // Update metrics
                updateCircadianMetrics(data);
                
                // Create polar clock visualization
                createPolarClock(data.polarClock);
                
                // Update seasonal analysis
                updateSeasonalAnalysis(data.seasonalAnalysis);
                
                // Display insights
                displayInsights(data.insights);
                
            } catch (error) {
                console.error('Error loading circadian data:', error);
                document.getElementById('loading').innerHTML = 
                    '<div style="color: #e74c3c;">⚠️ Failed to load circadian analysis. Please try again later.</div>';
            }
        }
        
        function updateCircadianMetrics(data) {
            const strength = data.circadianMetrics.strength;
            const entropy = data.circadianMetrics.entropy;
            const zeitgeber = data.circadianMetrics.zeitgeberInfluence;
            
            document.getElementById('circadian-strength').textContent = strength.strength;
            document.getElementById('strength-classification').textContent = strength.classification;
            
            const peakHourFormatted = strength.peakHour.toString().padStart(2, '0') + ':00';
            document.getElementById('peak-activity-hour').textContent = peakHourFormatted;
            
            document.getElementById('predictability').textContent = entropy.predictability + '%';
            document.getElementById('entropy-classification').textContent = entropy.classification;
            
            const crepuscularPercentage = Math.round(zeitgeber.crepuscularIndex * 100);
            document.getElementById('crepuscular-index').textContent = crepuscularPercentage + '%';
            document.getElementById('zeitgeber-classification').textContent = zeitgeber.classification;
            
            // Update tooltips with real data
            const strengthTooltip = document.getElementById('circadian-strength-tooltip');
            if (strengthTooltip) {
                strengthTooltip.innerHTML = 
                    '<strong>Circadian Strength: ' + strength.strength + '</strong><br><br>' +
                    'Measures how well-defined Sven\\'s internal clock is.<br><br>' +
                    '<strong>Calculation:</strong> Amplitude × Regularity<br>' +
                    '• Amplitude: ' + strength.amplitude + ' (peak vs average activity)<br>' +
                    '• Regularity: ' + strength.regularity + ' (day-to-day consistency)<br><br>' +
                    '<strong>Scale:</strong> 0.0 (chaotic) to 2.0+ (very strong)<br>' +
                    '<strong>Classification:</strong> ' + strength.classification + '<br><br>' +
                    'Higher values indicate a cat with predictable daily rhythms, like wild animals.';
            }
            
            const peakTooltip = document.getElementById('peak-activity-tooltip');
            if (peakTooltip) {
                const wildComparison = strength.peakHour >= 5 && strength.peakHour <= 10 ? 
                    'This aligns with natural dawn activity!' :
                    strength.peakHour >= 17 && strength.peakHour <= 22 ?
                    'This aligns with natural dusk activity!' :
                    'This shows adaptation to human schedules rather than wild patterns.';
                    
                peakTooltip.innerHTML = 
                    '<strong>Peak Activity Hour: ' + peakHourFormatted + '</strong><br><br>' +
                    'The hour when Sven is most active throughout the day.<br><br>' +
                    '<strong>Calculation:</strong> Hour with highest combined exit + entry frequency<br>' +
                    '• Counts all exits and entries across entire dataset<br>' +
                    '• Averaged per day to find consistent peak<br><br>' +
                    '<strong>Comparison:</strong> ' + wildComparison + '<br>' +
                    '<strong>Wild cats:</strong> Most active at dawn (06:00) and dusk (18:00)';
            }
            
            const predictabilityTooltip = document.getElementById('predictability-tooltip');
            if (predictabilityTooltip) {
                predictabilityTooltip.innerHTML = 
                    '<strong>Behavioral Predictability: ' + entropy.predictability + '%</strong><br><br>' +
                    'How predictable Sven\\'s daily routine is, based on information theory.<br><br>' +
                    '<strong>Calculation:</strong> 1 - (Shannon Entropy ÷ Maximum Entropy)<br>' +
                    '• Shannon entropy: ' + entropy.entropy + ' bits<br>' +
                    '• Normalized entropy: ' + (entropy.normalized * 100) + '%<br><br>' +
                    '<strong>Scale:</strong> 0% (completely random) to 100% (perfectly routine)<br>' +
                    '<strong>Classification:</strong> ' + entropy.classification + '<br><br>' +
                    'High predictability means you can anticipate when Sven will be active!';
            }
            
            const crepuscularTooltip = document.getElementById('crepuscular-tooltip');
            if (crepuscularTooltip) {
                crepuscularTooltip.innerHTML = 
                    '<strong>Crepuscular Index: ' + crepuscularPercentage + '%</strong><br><br>' +
                    'Measures if Sven follows the natural "crepuscular" pattern of being active at dawn and dusk.<br><br>' +
                    '<strong>Breakdown:</strong><br>' +
                    '• Morning activity (05:00-10:00): ' + zeitgeber.morningActivity + '%<br>' +
                    '• Evening activity (17:00-22:00): ' + zeitgeber.eveningActivity + '%<br>' +
                    '• Combined crepuscular: ' + crepuscularPercentage + '%<br><br>' +
                    '<strong>Classification:</strong> ' + zeitgeber.classification + '<br>' +
                    '<strong>Wild cats:</strong> 60%+ | <strong>House cats:</strong> 30-50%<br>' +
                    'Shows how much Sven retains his wild instincts!';
            }
        }
        
        function createPolarClock(polarData) {
            const container = document.getElementById('polar-clock');
            container.innerHTML = ''; // Clear any existing content
            
            const size = 400;
            const radius = size / 2 - 40;
            const center = size / 2;
            
            const svg = d3.select(container)
                .append('svg')
                .attr('width', size)
                .attr('height', size);
            
            const g = svg.append('g')
                .attr('transform', 'translate(' + center + ',' + center + ')');
            
            // Draw hour grid lines
            for (let hour = 0; hour < 24; hour++) {
                const angle = (hour * 15 - 90) * (Math.PI / 180);
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                
                g.append('line')
                    .attr('class', 'polar-grid')
                    .attr('x1', 0)
                    .attr('y1', 0)
                    .attr('x2', x)
                    .attr('y2', y);
            }
            
            // Draw concentric circles
            const maxActivity = Math.max(...polarData.map(d => d.totalActivity));
            for (let i = 1; i <= 4; i++) {
                g.append('circle')
                    .attr('class', 'polar-grid')
                    .attr('r', (radius / 4) * i)
                    .attr('fill', 'none');
            }
            
            // Draw hour labels
            for (let hour = 0; hour < 24; hour += 3) {
                const angle = (hour * 15 - 90) * (Math.PI / 180);
                const labelRadius = radius + 20;
                const x = Math.cos(angle) * labelRadius;
                const y = Math.sin(angle) * labelRadius;
                
                g.append('text')
                    .attr('class', 'hour-label')
                    .attr('x', x)
                    .attr('y', y + 4)
                    .text(hour.toString().padStart(2, '0') + ':00');
            }
            
            // Draw activity arcs
            const angleScale = d3.scaleLinear()
                .domain([0, 24])
                .range([0, 2 * Math.PI]);
            
            const radiusScale = d3.scaleLinear()
                .domain([0, maxActivity])
                .range([20, radius - 20]);
            
            // Create arcs for exits and entries
            polarData.forEach((d, i) => {
                if (d.exits > 0) {
                    const exitRadius = radiusScale(d.exits);
                    const angle = angleScale(d.hour) - Math.PI/2;
                    
                    g.append('circle')
                        .attr('cx', Math.cos(angle) * exitRadius)
                        .attr('cy', Math.sin(angle) * exitRadius)
                        .attr('r', 4)
                        .attr('fill', '#ff6b6b')
                        .attr('opacity', 0.8);
                }
                
                if (d.entries > 0) {
                    const entryRadius = radiusScale(d.entries);
                    const angle = angleScale(d.hour) - Math.PI/2;
                    
                    g.append('circle')
                        .attr('cx', Math.cos(angle) * entryRadius)
                        .attr('cy', Math.sin(angle) * entryRadius)
                        .attr('r', 4)
                        .attr('fill', '#4ecdc4')
                        .attr('opacity', 0.8);
                }
            });
        }
        
        function updateSeasonalAnalysis(seasonalData) {
            Object.entries(seasonalData).forEach(([season, data]) => {
                if (data) {
                    const phaseElement = document.getElementById(season + '-phase');
                    const consistencyElement = document.getElementById(season + '-consistency');
                    
                    if (phaseElement) {
                        phaseElement.textContent = Math.floor(data.averagePhase).toString().padStart(2, '0') + ':00';
                    }
                    if (consistencyElement) {
                        consistencyElement.textContent = Math.round(data.consistency * 100) + '% consistent';
                    }
                }
            });
        }
        
        function displayInsights(insights) {
            const container = document.getElementById('insights-content');
            container.innerHTML = '';
            
            if (insights && insights.length > 0) {
                insights.forEach(insight => {
                    const item = document.createElement('div');
                    item.className = 'insight-item';
                    item.textContent = insight;
                    container.appendChild(item);
                });
            } else {
                container.innerHTML = '<div class="insight-item">🔍 Gathering insights from Sven\\'s behavioral patterns...</div>';
            }
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

// Annotation system handlers
async function handleAnnotations(request, env) {
  const authToken = getCookie(request, 'auth_token');
  const email = await validateAuthToken(authToken, env);
  
  if (!email) {
    return new Response(getLoginPage(), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  return new Response(getAnnotationsPage(email), {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handleAnnotationsApi(request, env) {
  const authToken = getCookie(request, 'auth_token');
  const email = await validateAuthToken(authToken, env);
  
  if (!email) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (request.method === 'GET') {
    return await getAnnotations(env);
  } else if (request.method === 'POST') {
    return await createAnnotation(request, env, email);
  } else if (request.method === 'PUT') {
    return await updateAnnotation(request, env, email);
  } else if (request.method === 'DELETE') {
    return await deleteAnnotation(request, env);
  }
  
  return new Response('Method not allowed', { status: 405 });
}

async function getAnnotations(env) {
  try {
    // First try KV storage for most recent data
    const kvAnnotations = await env.CAT_FLAP_KV.get('annotations');
    if (kvAnnotations) {
      return new Response(kvAnnotations, {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Fallback to GitHub if KV is empty
    const githubUrl = `https://raw.githubusercontent.com/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/main/annotations.json`;
    const response = await fetch(githubUrl);
    
    if (response.ok) {
      const annotations = await response.json();
      // Store in KV for future requests
      await env.CAT_FLAP_KV.put('annotations', JSON.stringify(annotations));
      return new Response(JSON.stringify(annotations), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Return empty array if file doesn't exist yet
      return new Response('[]', {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Error fetching annotations:', error);
    return new Response('[]', {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function createAnnotation(request, env, email) {
  try {
    const formData = await request.formData();
    const annotation = {
      id: crypto.randomUUID(),
      startDate: formData.get('startDate'),
      endDate: formData.get('endDate'),
      category: formData.get('category'),
      title: formData.get('title'),
      description: formData.get('description'),
      createdBy: email,
      createdAt: new Date().toISOString(),
      color: getCategoryColor(formData.get('category'))
    };

    // Validation
    if (!annotation.startDate || !annotation.endDate || !annotation.category || !annotation.title) {
      return new Response('Missing required fields', { status: 400 });
    }

    if (new Date(annotation.startDate) > new Date(annotation.endDate)) {
      return new Response('Start date must be before or equal to end date', { status: 400 });
    }

    // Get existing annotations
    const existingResponse = await getAnnotations(env);
    const existingAnnotations = await existingResponse.json();
    
    // Add new annotation
    existingAnnotations.unshift(annotation); // Add to beginning for newest-first order

    // Save back to GitHub via webhook
    await triggerAnnotationUpdate(env, existingAnnotations);

    return new Response(JSON.stringify(annotation), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating annotation:', error);
    return new Response('Error creating annotation', { status: 500 });
  }
}

async function updateAnnotation(request, env, email) {
  try {
    const formData = await request.formData();
    const annotationId = formData.get('id');
    
    if (!annotationId) {
      return new Response('Missing annotation ID', { status: 400 });
    }

    // Get existing annotations
    const existingResponse = await getAnnotations(env);
    const existingAnnotations = await existingResponse.json();
    
    // Find and update annotation
    const index = existingAnnotations.findIndex(a => a.id === annotationId);
    if (index === -1) {
      return new Response('Annotation not found', { status: 404 });
    }

    const updatedAnnotation = {
      ...existingAnnotations[index],
      startDate: formData.get('startDate'),
      endDate: formData.get('endDate'),
      category: formData.get('category'),
      title: formData.get('title'),
      description: formData.get('description'),
      color: getCategoryColor(formData.get('category')),
      updatedAt: new Date().toISOString(),
      updatedBy: email
    };

    // Validation
    if (new Date(updatedAnnotation.startDate) > new Date(updatedAnnotation.endDate)) {
      return new Response('Start date must be before or equal to end date', { status: 400 });
    }

    existingAnnotations[index] = updatedAnnotation;

    // Save back to GitHub
    await triggerAnnotationUpdate(env, existingAnnotations);

    return new Response(JSON.stringify(updatedAnnotation), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating annotation:', error);
    return new Response('Error updating annotation', { status: 500 });
  }
}

async function deleteAnnotation(request, env) {
  try {
    const url = new URL(request.url);
    const annotationId = url.searchParams.get('id');
    
    if (!annotationId) {
      return new Response('Missing annotation ID', { status: 400 });
    }

    // Get existing annotations
    const existingResponse = await getAnnotations(env);
    const existingAnnotations = await existingResponse.json();
    
    // Filter out the annotation to delete
    const filteredAnnotations = existingAnnotations.filter(a => a.id !== annotationId);
    
    if (filteredAnnotations.length === existingAnnotations.length) {
      return new Response('Annotation not found', { status: 404 });
    }

    // Save back to GitHub
    await triggerAnnotationUpdate(env, filteredAnnotations);

    return new Response('Annotation deleted', { status: 200 });
  } catch (error) {
    console.error('Error deleting annotation:', error);
    return new Response('Error deleting annotation', { status: 500 });
  }
}

function getCategoryColor(category) {
  const colorMap = {
    'health': '#f44336',      // Red
    'environment': '#4caf50', // Green
    'travel': '#2196f3',      // Blue
    'food': '#ff9800',        // Orange
    'other': '#9e9e9e'        // Grey
  };
  return colorMap[category.toLowerCase()] || colorMap['other'];
}

async function triggerAnnotationUpdate(env, annotations) {
  // Store in KV for immediate access
  await env.CAT_FLAP_KV.put('annotations', JSON.stringify(annotations));
  
  // Trigger GitHub Actions workflow via repository dispatch
  const payload = {
    event_type: 'annotation_update',
    client_payload: {
      annotations: annotations,
      timestamp: new Date().toISOString()
    }
  };

  try {
    // Use GitHub's repository dispatch API
    const githubApiUrl = `https://api.github.com/repos/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/dispatches`;
    
    const webhookResponse = await fetch(githubApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'CloudFlare-Worker'
        // Note: This would need a GitHub token for authentication in production
        // For now, KV storage will work for immediate UI updates
      },
      body: JSON.stringify(payload)
    });

    if (!webhookResponse.ok) {
      console.log('GitHub dispatch not configured, using KV only:', webhookResponse.status);
    }
  } catch (error) {
    console.log('GitHub dispatch not available, using KV storage only:', error.message);
  }
}

function getSeasonalPage(email) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cat Flap Stats - Seasonal Pattern Analysis</title>
    <link rel="icon" href="/favicon.ico" type="image/svg+xml">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
${getSharedCSS()}
        
        /* Seasonal page specific styles */
        .container {
            max-width: 1400px;
            margin: 2rem auto;
            padding: 0 1rem;
        }
        .seasonal-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-bottom: 2rem;
        }
        @media (max-width: 768px) {
            .seasonal-grid { grid-template-columns: 1fr; }
        }
        .heatmap-container {
            width: 100%;
            height: 450px;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            position: relative;
            background: #f8f9fa;
            overflow: visible;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .heatmap-container svg {
            max-width: 100%;
            height: auto;
        }
        @media (max-width: 768px) {
            .heatmap-container {
                height: 400px;
            }
        }
        .season-tabs {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1rem;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 0.5rem;
        }
        .season-tab {
            padding: 0.5rem 1rem;
            border: 1px solid #e0e0e0;
            border-radius: 4px 4px 0 0;
            background: #f5f5f5;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .season-tab.active {
            background: #2196f3;
            color: white;
            border-color: #2196f3;
        }
        .season-tab:hover:not(.active) {
            background: #e3f2fd;
        }
        .comparison-controls {
            display: flex;
            gap: 1rem;
            margin-bottom: 1rem;
            align-items: center;
            flex-wrap: wrap;
        }
        .comparison-mode {
            display: flex;
            gap: 0.5rem;
            align-items: center;
        }
        .comparison-mode input[type="radio"] {
            margin-right: 0.25rem;
        }
        .comparison-mode label {
            font-size: 14px;
            cursor: pointer;
        }
        .overlay-actogram-container {
            width: 100%;
            height: 500px;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            overflow: auto;
            background: #f8f9fa;
        }
        .season-legend {
            display: flex;
            justify-content: center;
            gap: 2rem;
            margin: 1rem 0;
            flex-wrap: wrap;
        }
        .season-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .season-color {
            width: 16px;
            height: 16px;
            border-radius: 3px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        .hypothesis-card {
            background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
            border-left: 4px solid #2196f3;
        }
        .significance-badge {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 500;
            margin-left: 0.5rem;
        }
        .significant {
            background: #c8e6c9;
            color: #2e7d32;
        }
        .not-significant {
            background: #ffcdd2;
            color: #c62828;
        }
        .confidence-high { border-left-color: #4caf50; }
        .confidence-medium { border-left-color: #ff9800; }
        .confidence-low { border-left-color: #f44336; }
        .confidence-very_low { border-left-color: #9e9e9e; }
        .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 200px;
            flex-direction: column;
            gap: 1rem;
        }
        .loading-spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #2196f3;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .error {
            background: #ffebee;
            border: 1px solid #f44336;
            color: #c62828;
            padding: 1rem;
            border-radius: 4px;
            margin: 1rem 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">
            <h2>🐾 Cat Flap Stats - Seasonal Pattern Analysis</h2>
        </div>
        <div class="nav-links">
            <a href="/dashboard" class="btn btn-secondary">Dashboard</a>
            <a href="/patterns" class="btn btn-secondary">Patterns</a>
            <a href="/circadian" class="btn btn-secondary">Circadian</a>
            <a href="/annotations" class="btn btn-secondary">Annotations</a>
            <span>Welcome, ${email}</span>
            <a href="/logout" class="btn btn-secondary">Logout</a>
        </div>
    </div>
    
    <div class="container">
        <div class="loading" id="loading">
            <div class="loading-spinner"></div>
            <p>Loading seasonal analysis...</p>
        </div>
        
        <div id="error" class="error" style="display: none;"></div>
        
        <div id="content" style="display: none;">
            <!-- Seasonal Statistics Overview -->
            <div class="stats-grid" id="seasonal-stats">
                <!-- Populated by JavaScript -->
            </div>
            
            <!-- Primary Hypothesis Testing -->
            <div class="stat-card hypothesis-card">
                <h3>🧪 Hypothesis Testing</h3>
                <div id="hypothesis-results">
                    <!-- Populated by JavaScript -->
                </div>
            </div>
            
            <!-- Season Legend -->
            <div class="season-legend">
                <div class="season-item">
                    <div class="season-color" style="background: #81c784;"></div>
                    <span>Spring (Mar-May)</span>
                </div>
                <div class="season-item">
                    <div class="season-color" style="background: #ffb74d;"></div>
                    <span>Summer (Jun-Aug)</span>
                </div>
                <div class="season-item">
                    <div class="season-color" style="background: #ff8a65;"></div>
                    <span>Autumn (Sep-Nov)</span>
                </div>
                <div class="season-item">
                    <div class="season-color" style="background: #64b5f6;"></div>
                    <span>Winter (Dec-Feb)</span>
                </div>
            </div>
            
            <!-- Main Visualizations -->
            <div class="seasonal-grid">
                <div class="stat-card">
                    <h3>📊 Seasonal Activity Heatmap</h3>
                    <div class="heatmap-container" id="seasonal-heatmap">
                        <!-- D3.js heatmap will be rendered here -->
                    </div>
                </div>
                
                <div class="stat-card">
                    <h3>📈 Seasonal Activity Comparison</h3>
                    <div class="season-tabs" id="season-tabs">
                        <!-- Season selection tabs will be rendered here -->
                    </div>
                    <div class="comparison-controls" id="comparison-controls">
                        <!-- Comparison mode controls will be rendered here -->
                    </div>
                    <div class="overlay-actogram-container" id="overlay-actogram">
                        <!-- D3.js seasonal actogram will be rendered here -->
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Seasonal colors for consistent theming
        const seasonColors = {
            spring: '#81c784',
            summer: '#ffb74d', 
            autumn: '#ff8a65',
            winter: '#64b5f6'
        };

        // Load seasonal analysis data and render visualizations
        async function loadSeasonalData() {
            try {
                const response = await fetch('/api/analytics');
                if (!response.ok) {
                    throw new Error(\`HTTP error! status: \${response.status}\`);
                }
                const data = await response.json();
                
                // Check if seasonal stats are available
                if (!data.precomputed || !data.precomputed.seasonalStats) {
                    throw new Error('Seasonal analysis data not available');
                }
                
                const seasonalStats = data.precomputed.seasonalStats;
                
                // Render all components
                renderSeasonalStats(seasonalStats);
                renderHypothesisResults(seasonalStats);
                renderSeasonalHeatmap(seasonalStats);
                renderOverlayActogram(data.precomputed.dailySummaries);
                
                // Hide loading, show content
                document.getElementById('loading').style.display = 'none';
                document.getElementById('content').style.display = 'block';
                
            } catch (error) {
                console.error('Error loading seasonal data:', error);
                document.getElementById('loading').style.display = 'none';
                document.getElementById('error').style.display = 'block';
                document.getElementById('error').textContent = \`Failed to load seasonal analysis: \${error.message}\`;
            }
        }

        function renderSeasonalStats(seasonalStats) {
            const container = document.getElementById('seasonal-stats');
            const seasons = ['spring', 'summer', 'autumn', 'winter'];
            
            container.innerHTML = seasons.map(season => {
                const data = seasonalStats[season];
                if (!data || !data.data_quality || data.data_quality.confidence_level === 'no_data') {
                    return \`
                        <div class="stat-card">
                            <h3 style="color: \${seasonColors[season]}">
                                \${season.charAt(0).toUpperCase() + season.slice(1)}
                            </h3>
                            <div class="metric-value">No Data</div>
                            <div class="metric-label">Insufficient data for analysis</div>
                        </div>
                    \`;
                }
                
                const confidenceClass = \`confidence-\${data.data_quality?.confidence_level || 'unknown'}\`;
                const avgDuration = data.duration_metrics?.avg_daily_duration_minutes || 0;
                const avgSessions = data.frequency_metrics?.avg_daily_sessions || 0;
                const completeness = data.data_quality?.completeness_percent || 0;
                const confidence = data.data_quality?.confidence_level || 'unknown';
                
                return \`
                    <div class="stat-card \${confidenceClass}">
                        <h3 style="color: \${seasonColors[season]}">
                            \${season.charAt(0).toUpperCase() + season.slice(1)}
                        </h3>
                        <div class="metric-value">\${avgDuration.toFixed(1)} min</div>
                        <div class="metric-label">Avg Daily Outdoor Time</div>
                        <div class="metric-sublabel">\${avgSessions.toFixed(1)} sessions/day</div>
                        <div class="metric-sublabel">\${completeness}% data completeness</div>
                        <div class="metric-sublabel confidence-\${confidence}">
                            \${confidence.replace('_', ' ')} confidence
                        </div>
                    </div>
                \`;
            }).join('');
        }

        function renderHypothesisResults(seasonalStats) {
            const container = document.getElementById('hypothesis-results');
            const comparisons = seasonalStats.comparisons;
            
            if (!comparisons || comparisons.note) {
                container.innerHTML = '<p>Statistical comparisons require scipy package for full analysis.</p>';
                return;
            }
            
            let html = '';
            
            // Summer vs Winter duration comparison
            if (comparisons.summer_winter_duration) {
                const result = comparisons.summer_winter_duration;
                const significanceBadge = result.significant ? 
                    '<span class="significance-badge significant">Significant</span>' :
                    '<span class="significance-badge not-significant">Not Significant</span>';
                    
                const summerAvg = seasonalStats.summer?.duration_metrics?.avg_daily_duration_minutes || 0;
                const winterAvg = seasonalStats.winter?.duration_metrics?.avg_daily_duration_minutes || 0;
                const difference = summerAvg - winterAvg;
                
                html += \`
                    <div class="hypothesis-test">
                        <h4>\${result.hypothesis}</h4>
                        <p><strong>Result:</strong> Summer \${difference > 0 ? 'longer' : 'shorter'} by \${Math.abs(difference).toFixed(1)} minutes/day \${significanceBadge}</p>
                        <p><strong>p-value:</strong> \${result.p_value.toFixed(6)}</p>
                        <p><strong>Effect size:</strong> \${result.effect_size.toFixed(3)}</p>
                    </div>
                \`;
            }
            
            // Overall duration analysis
            if (comparisons.duration_analysis && !comparisons.duration_analysis.error) {
                const analysis = comparisons.duration_analysis;
                const significanceBadge = analysis.significant ? 
                    '<span class="significance-badge significant">Significant</span>' :
                    '<span class="significance-badge not-significant">Not Significant</span>';
                    
                html += \`
                    <div class="hypothesis-test">
                        <h4>Overall Seasonal Duration Differences</h4>
                        <p><strong>ANOVA Result:</strong> \${analysis.interpretation} \${significanceBadge}</p>
                        <p><strong>F-statistic:</strong> \${analysis.f_statistic}</p>
                        <p><strong>p-value:</strong> \${analysis.p_value}</p>
                        <p><strong>Seasons compared:</strong> \${analysis.seasons_compared.join(', ')}</p>
                    </div>
                \`;
            }
            
            container.innerHTML = html || '<p>No statistical comparisons available.</p>';
        }

        function renderSeasonalHeatmap(seasonalStats) {
            const container = document.getElementById('seasonal-heatmap');
            container.innerHTML = '';
            
            // Check if we have seasonal data
            if (!seasonalStats || Object.keys(seasonalStats).length === 0) {
                container.innerHTML = \`
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column; gap: 1rem;">
                        <div style="font-size: 2rem;">📊</div>
                        <p>No seasonal data available</p>
                    </div>
                \`;
                return;
            }
            
            // Prepare data for heatmap - create a matrix by season and metric
            const seasons = ['spring', 'summer', 'autumn', 'winter'];
            const metrics = [
                { key: 'avg_daily_duration_minutes', label: 'Avg Duration (min)', type: 'duration' },
                { key: 'avg_daily_sessions', label: 'Avg Sessions/day', type: 'frequency' },
                { key: 'total_days', label: 'Days with Data', type: 'coverage' }
            ];
            
            // Create data matrix
            const data = [];
            seasons.forEach((season, seasonIndex) => {
                const seasonData = seasonalStats[season];
                metrics.forEach((metric, metricIndex) => {
                    let value = 0;
                    let confidence = 'no_data';
                    
                    if (seasonData && seasonData.data_quality?.confidence_level !== 'no_data') {
                        if (metric.type === 'duration') {
                            value = seasonData.duration_metrics?.[metric.key] || 0;
                        } else if (metric.type === 'frequency') {
                            value = seasonData.frequency_metrics?.[metric.key] || 0;
                        } else if (metric.type === 'coverage') {
                            value = seasonData.data_quality?.[metric.key] || 0;
                        }
                        confidence = seasonData.data_quality?.confidence_level || 'low';
                    }
                    
                    data.push({
                        season: season,
                        seasonIndex: seasonIndex,
                        metric: metric.label,
                        metricIndex: metricIndex,
                        value: value,
                        confidence: confidence,
                        metricType: metric.type
                    });
                });
            });
            
            // SVG dimensions - make it fill the container properly
            const containerWidth = container.clientWidth || 500;
            const containerHeight = container.clientHeight || 400;
            const isMobile = containerWidth < 768;
            
            const margin = { 
                top: isMobile ? 70 : 90, 
                right: isMobile ? 30 : 50, 
                bottom: isMobile ? 50 : 70, 
                left: isMobile ? 100 : 140 
            };
            
            // Calculate cell sizes to fill the available space
            const availableWidth = containerWidth - margin.left - margin.right;
            const availableHeight = containerHeight - margin.top - margin.bottom;
            
            const cellWidth = Math.max(availableWidth / seasons.length, isMobile ? 80 : 100);
            const cellHeight = Math.max(availableHeight / metrics.length, isMobile ? 60 : 80);
            
            const width = seasons.length * cellWidth;
            const height = metrics.length * cellHeight;
            
            const svg = d3.select(container)
                .append('svg')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom);
            
            const g = svg.append('g')
                .attr('transform', \`translate(\${margin.left},\${margin.top})\`);
            
            // Color scales for different metric types
            const colorScales = {
                duration: d3.scaleSequential(d3.interpolateOranges)
                    .domain([0, d3.max(data.filter(d => d.metricType === 'duration'), d => d.value) || 100]),
                frequency: d3.scaleSequential(d3.interpolateBlues)
                    .domain([0, d3.max(data.filter(d => d.metricType === 'frequency'), d => d.value) || 10]),
                coverage: d3.scaleSequential(d3.interpolateGreens)
                    .domain([0, d3.max(data.filter(d => d.metricType === 'coverage'), d => d.value) || 100])
            };
            
            // Draw heatmap cells
            const cells = g.selectAll('.heatmap-cell')
                .data(data)
                .enter()
                .append('g')
                .attr('class', 'heatmap-cell')
                .attr('transform', d => \`translate(\${d.seasonIndex * cellWidth},\${d.metricIndex * cellHeight})\`);
            
            // Cell rectangles
            cells.append('rect')
                .attr('width', cellWidth - 2)
                .attr('height', cellHeight - 2)
                .attr('x', 1)
                .attr('y', 1)
                .attr('fill', d => {
                    if (d.confidence === 'no_data') return '#f5f5f5';
                    return colorScales[d.metricType](d.value);
                })
                .attr('stroke', d => {
                    // Border color based on confidence
                    switch(d.confidence) {
                        case 'high': return '#4caf50';
                        case 'medium': return '#ff9800';
                        case 'low': return '#f44336';
                        case 'very_low': return '#9e9e9e';
                        default: return '#e0e0e0';
                    }
                })
                .attr('stroke-width', 2)
                .attr('opacity', d => d.confidence === 'no_data' ? 0.3 : 0.8);
            
            // Cell text values
            cells.append('text')
                .attr('x', cellWidth / 2)
                .attr('y', cellHeight / 2 - 5)
                .attr('text-anchor', 'middle')
                .attr('dy', '0.35em')
                .style('font-size', isMobile ? '12px' : '14px')
                .style('font-weight', 'bold')
                .style('fill', d => {
                    if (d.confidence === 'no_data') return '#999';
                    // Use contrasting text color
                    const bgColor = colorScales[d.metricType](d.value);
                    return d3.hsl(bgColor).l > 0.5 ? '#333' : '#fff';
                })
                .text(d => {
                    if (d.confidence === 'no_data') return 'N/A';
                    if (d.metricType === 'duration') return d.value.toFixed(0);
                    if (d.metricType === 'frequency') return d.value.toFixed(1);
                    return d.value.toFixed(0);
                });
            
            // Confidence indicator
            cells.append('text')
                .attr('x', cellWidth / 2)
                .attr('y', cellHeight / 2 + 12)
                .attr('text-anchor', 'middle')
                .style('font-size', '10px')
                .style('fill', '#666')
                .text(d => {
                    if (d.confidence === 'no_data') return '';
                    return d.confidence.replace('_', ' ');
                });
            
            // Season labels (top)
            g.selectAll('.season-label')
                .data(seasons)
                .enter()
                .append('text')
                .attr('class', 'season-label')
                .attr('x', (d, i) => i * cellWidth + cellWidth / 2)
                .attr('y', -20)
                .attr('text-anchor', 'middle')
                .style('font-size', isMobile ? '12px' : '14px')
                .style('font-weight', 'bold')
                .style('fill', d => seasonColors[d])
                .text(d => d.charAt(0).toUpperCase() + d.slice(1));
            
            // Season emojis (top)
            const seasonEmojis = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };
            g.selectAll('.season-emoji')
                .data(seasons)
                .enter()
                .append('text')
                .attr('class', 'season-emoji')
                .attr('x', (d, i) => i * cellWidth + cellWidth / 2)
                .attr('y', -40)
                .attr('text-anchor', 'middle')
                .style('font-size', '20px')
                .text(d => seasonEmojis[d]);
            
            // Metric labels (left)
            g.selectAll('.metric-label')
                .data(metrics)
                .enter()
                .append('text')
                .attr('class', 'metric-label')
                .attr('x', -10)
                .attr('y', (d, i) => i * cellHeight + cellHeight / 2)
                .attr('text-anchor', 'end')
                .attr('dy', '0.35em')
                .style('font-size', '12px')
                .style('font-weight', '500')
                .text(d => d.label);
            
            // Add title
            svg.append('text')
                .attr('x', (width + margin.left + margin.right) / 2)
                .attr('y', 25)
                .attr('text-anchor', 'middle')
                .style('font-size', '16px')
                .style('font-weight', 'bold')
                .text('Seasonal Activity Patterns');
            
            // Add legend for confidence levels
            const legendData = [
                { confidence: 'high', color: '#4caf50', label: 'High Confidence' },
                { confidence: 'medium', color: '#ff9800', label: 'Medium Confidence' },
                { confidence: 'low', color: '#f44336', label: 'Low Confidence' },
                { confidence: 'very_low', color: '#9e9e9e', label: 'Very Low Confidence' }
            ];
            
            const legend = svg.append('g')
                .attr('transform', \`translate(\${margin.left}, \${height + margin.top + 20})\`);
            
            const legendItems = legend.selectAll('.legend-item')
                .data(legendData)
                .enter()
                .append('g')
                .attr('class', 'legend-item')
                .attr('transform', (d, i) => \`translate(\${i * 120}, 0)\`);
            
            legendItems.append('rect')
                .attr('width', 12)
                .attr('height', 12)
                .attr('fill', 'none')
                .attr('stroke', d => d.color)
                .attr('stroke-width', 2);
            
            legendItems.append('text')
                .attr('x', 18)
                .attr('y', 6)
                .attr('dy', '0.35em')
                .style('font-size', '11px')
                .text(d => d.label);
        }

        function renderOverlayActogram(dailySummaries) {
            if (!dailySummaries || dailySummaries.length === 0) {
                document.getElementById('overlay-actogram').innerHTML = \`
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column; gap: 1rem;">
                        <div style="font-size: 2rem;">📈</div>
                        <p>No daily summary data available</p>
                    </div>
                \`;
                return;
            }
            
            // Group data by season
            const seasonalData = {};
            const seasons = ['spring', 'summer', 'autumn', 'winter'];
            
            // Define seasons by month (UK South meteorological seasons)
            const seasonMonths = {
                spring: [3, 4, 5],    // Mar, Apr, May
                summer: [6, 7, 8],    // Jun, Jul, Aug
                autumn: [9, 10, 11],  // Sep, Oct, Nov
                winter: [12, 1, 2]    // Dec, Jan, Feb
            };
            
            dailySummaries.forEach(day => {
                const date = new Date(day.date);
                const month = date.getMonth() + 1; // getMonth() returns 0-11
                
                // Find which season this day belongs to
                for (const [seasonName, months] of Object.entries(seasonMonths)) {
                    if (months.includes(month)) {
                        if (!seasonalData[seasonName]) {
                            seasonalData[seasonName] = [];
                        }
                        seasonalData[seasonName].push(day);
                        break;
                    }
                }
            });
            
            // Sample data for better performance (up to 40 days per season)
            const maxDaysPerSeason = 40;
            Object.keys(seasonalData).forEach(season => {
                if (seasonalData[season].length > maxDaysPerSeason) {
                    const interval = Math.floor(seasonalData[season].length / maxDaysPerSeason);
                    seasonalData[season] = seasonalData[season].filter((_, i) => i % interval === 0);
                }
            });
            
            // Store data globally for tab switching
            window.seasonalActogramData = seasonalData;
            window.currentComparisonMode = 'single';
            window.selectedSeasons = ['spring']; // Default to spring
            
            // Render tabs and controls
            renderSeasonTabs(seasonalData);
            renderComparisonControls();
            
            // Render initial actogram
            renderSeasonActogram();
        }
        
        function renderSeasonTabs(seasonalData) {
            const tabsContainer = document.getElementById('season-tabs');
            const seasons = ['spring', 'summer', 'autumn', 'winter'];
            const seasonEmojis = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };
            
            const availableSeasons = seasons.filter(season => 
                seasonalData[season] && seasonalData[season].length > 0
            );
            
            if (availableSeasons.length === 0) {
                tabsContainer.innerHTML = '<p>No seasonal data available</p>';
                return;
            }
            
            tabsContainer.innerHTML = availableSeasons.map(season => \`
                <div class="season-tab \${window.selectedSeasons.includes(season) ? 'active' : ''}" 
                     data-season="\${season}" 
                     onclick="toggleSeasonSelection('\${season}')">
                    <span>\${seasonEmojis[season]}</span>
                    <span>\${season.charAt(0).toUpperCase() + season.slice(1)}</span>
                    <span style="font-size: 12px; opacity: 0.8;">(\${seasonalData[season].length})</span>
                </div>
            \`).join('');
        }
        
        function renderComparisonControls() {
            const controlsContainer = document.getElementById('comparison-controls');
            controlsContainer.innerHTML = \`
                <div class="comparison-mode">
                    <input type="radio" id="single-mode" name="comparison" value="single" 
                           \${window.currentComparisonMode === 'single' ? 'checked' : ''} 
                           onchange="changeComparisonMode('single')">
                    <label for="single-mode">Single Season</label>
                </div>
                <div class="comparison-mode">
                    <input type="radio" id="overlay-mode" name="comparison" value="overlay" 
                           \${window.currentComparisonMode === 'overlay' ? 'checked' : ''} 
                           onchange="changeComparisonMode('overlay')">
                    <label for="overlay-mode">Overlay Comparison</label>
                </div>
                <div style="font-size: 12px; color: #666; margin-left: 1rem;">
                    \${window.currentComparisonMode === 'single' ? 'Click tabs to switch seasons' : 'Click tabs to select seasons for overlay'}
                </div>
            \`;
        }
        
        function toggleSeasonSelection(season) {
            if (window.currentComparisonMode === 'single') {
                window.selectedSeasons = [season];
            } else {
                // Overlay mode - toggle selection
                if (window.selectedSeasons.includes(season)) {
                    window.selectedSeasons = window.selectedSeasons.filter(s => s !== season);
                } else {
                    window.selectedSeasons.push(season);
                }
                // Ensure at least one season is selected
                if (window.selectedSeasons.length === 0) {
                    window.selectedSeasons = [season];
                }
            }
            
            // Update tab appearance
            document.querySelectorAll('.season-tab').forEach(tab => {
                const tabSeason = tab.dataset.season;
                tab.classList.toggle('active', window.selectedSeasons.includes(tabSeason));
            });
            
            renderSeasonActogram();
        }
        
        function changeComparisonMode(mode) {
            window.currentComparisonMode = mode;
            if (mode === 'single' && window.selectedSeasons.length > 1) {
                window.selectedSeasons = [window.selectedSeasons[0]];
            }
            
            renderComparisonControls();
            renderSeasonTabs(window.seasonalActogramData);
            renderSeasonActogram();
        }
        
        function renderSeasonActogram() {
            const container = document.getElementById('overlay-actogram');
            container.innerHTML = '';
            
            if (!window.seasonalActogramData || window.selectedSeasons.length === 0) {
                container.innerHTML = \`
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column; gap: 1rem;">
                        <div style="font-size: 2rem;">📈</div>
                        <p>No season selected</p>
                    </div>
                \`;
                return;
            }
            
            // Get data for selected seasons
            const selectedData = [];
            window.selectedSeasons.forEach(season => {
                if (window.seasonalActogramData[season]) {
                    window.seasonalActogramData[season].forEach(day => {
                        selectedData.push({ ...day, season: season });
                    });
                }
            });
            
            if (selectedData.length === 0) {
                container.innerHTML = \`
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column; gap: 1rem;">
                        <div style="font-size: 2rem;">📈</div>
                        <p>No data for selected seasons</p>
                    </div>
                \`;
                return;
            }
            
            // Sort data by date for better visualization
            selectedData.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // SVG dimensions
            const containerWidth = container.clientWidth || 600;
            const margin = { top: 60, right: 40, bottom: 60, left: 100 };
            const width = containerWidth - margin.left - margin.right;
            const rowHeight = window.currentComparisonMode === 'overlay' ? 16 : 14;
            const height = Math.min(selectedData.length * rowHeight + 100, 400);
            
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
                .domain(selectedData.map((d, i) => i))
                .range([0, selectedData.length * rowHeight])
                .padding(0.1);
            
            // Background day/night for each row
            selectedData.forEach((day, i) => {
                const y = i * rowHeight;
                
                // Night background (6PM to 6AM)
                g.append('rect')
                    .attr('x', 0)
                    .attr('y', y)
                    .attr('width', xScale(6))
                    .attr('height', rowHeight - 1)
                    .attr('fill', '#f0f0f0')
                    .attr('opacity', 0.4);
                
                g.append('rect')
                    .attr('x', xScale(18))
                    .attr('y', y)
                    .attr('width', xScale(6))
                    .attr('height', rowHeight - 1)
                    .attr('fill', '#f0f0f0')
                    .attr('opacity', 0.4);
            });
            
            // Activity bars
            selectedData.forEach((day, i) => {
                const y = i * rowHeight;
                
                if (day.firstExit && day.lastEntry) {
                    const firstExit = parseTime(day.firstExit);
                    const lastEntry = parseTime(day.lastEntry);
                    
                    if (firstExit !== null && lastEntry !== null) {
                        let startHour = firstExit;
                        let endHour = lastEntry;
                        
                        // Handle overnight activities
                        if (lastEntry < firstExit) {
                            endHour = lastEntry + 24;
                        }
                        
                        const barWidth = xScale(endHour - startHour);
                        const barX = xScale(startHour);
                        
                        g.append('rect')
                            .attr('x', barX)
                            .attr('y', y + 1)
                            .attr('width', Math.max(barWidth, 2))
                            .attr('height', rowHeight - 3)
                            .attr('fill', seasonColors[day.season])
                            .attr('opacity', 0.8)
                            .attr('stroke', seasonColors[day.season])
                            .attr('stroke-width', 0.5);
                        
                        // Session count
                        if (day.sessions && day.sessions > 1) {
                            g.append('text')
                                .attr('x', barX + barWidth/2)
                                .attr('y', y + rowHeight/2)
                                .attr('text-anchor', 'middle')
                                .attr('dy', '0.35em')
                                .style('font-size', '8px')
                                .style('fill', '#333')
                                .style('font-weight', 'bold')
                                .text(day.sessions);
                        }
                    }
                }
            });
            
            // X-axis
            const xAxis = d3.axisBottom(xScale)
                .tickFormat(d => \`\${Math.floor(d)}:00\`)
                .ticks(12);
            
            g.append('g')
                .attr('class', 'x-axis')
                .attr('transform', \`translate(0, \${selectedData.length * rowHeight})\`)
                .call(xAxis)
                .selectAll('text')
                .style('font-size', '11px');
            
            // Y-axis labels (dates) - show every 5th for readability
            selectedData.forEach((day, i) => {
                if (i % 5 === 0 || selectedData.length < 20) {
                    g.append('text')
                        .attr('x', -10)
                        .attr('y', i * rowHeight + rowHeight/2)
                        .attr('text-anchor', 'end')
                        .attr('dy', '0.35em')
                        .style('font-size', '9px')
                        .style('fill', seasonColors[day.season])
                        .style('font-weight', 'bold')
                        .text(day.date.substring(5)); // Show MM-DD
                }
            });
            
            // Title
            const title = window.currentComparisonMode === 'single' 
                ? \`\${window.selectedSeasons[0].charAt(0).toUpperCase() + window.selectedSeasons[0].slice(1)} Activity Pattern\`
                : \`Seasonal Comparison (\${window.selectedSeasons.join(', ')})\`;
            
            svg.append('text')
                .attr('x', (width + margin.left + margin.right) / 2)
                .attr('y', 25)
                .attr('text-anchor', 'middle')
                .style('font-size', '14px')
                .style('font-weight', 'bold')
                .text(title);
            
            // Legend for overlay mode
            if (window.currentComparisonMode === 'overlay' && window.selectedSeasons.length > 1) {
                const legend = svg.append('g')
                    .attr('transform', \`translate(\${margin.left}, \${height + margin.top - 25})\`);
                
                window.selectedSeasons.forEach((season, i) => {
                    const legendItem = legend.append('g')
                        .attr('transform', \`translate(\${i * 100}, 0)\`);
                    
                    legendItem.append('rect')
                        .attr('width', 12)
                        .attr('height', 8)
                        .attr('fill', seasonColors[season])
                        .attr('opacity', 0.8);
                    
                    legendItem.append('text')
                        .attr('x', 18)
                        .attr('y', 4)
                        .attr('dy', '0.35em')
                        .style('font-size', '11px')
                        .text(season.charAt(0).toUpperCase() + season.slice(1));
                });
            }
        }
        
        // Helper function to parse time strings like "06:30" to decimal hours
        function parseTime(timeStr) {
            if (!timeStr || timeStr === 'N/A') return null;
            const parts = timeStr.split(':');
            if (parts.length !== 2) return null;
            const hours = parseInt(parts[0]);
            const minutes = parseInt(parts[1]);
            if (isNaN(hours) || isNaN(minutes)) return null;
            return hours + minutes / 60;
        }

        // Initialize page
        document.addEventListener('DOMContentLoaded', loadSeasonalData);
    </script>
</body>
</html>`;
}

function getAnnotationsPage(email) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Behavioral Annotations - Cat Flap Stats</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.ico">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        ${getSharedCSS()}
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">
            <h2>🐱 Cat Flap Stats - Behavioral Annotations</h2>
        </div>
        <div class="nav-links">
            <a href="/dashboard" class="btn btn-secondary">Dashboard</a>
            <a href="/patterns" class="btn btn-secondary">Patterns</a>
            <a href="/circadian" class="btn btn-secondary">Circadian</a>
            <a href="/seasonal" class="btn btn-secondary">Seasonal</a>
            <span>Welcome, ${email}</span>
            <a href="/logout" class="btn btn-secondary">Logout</a>
        </div>
    </div>
    
    <div class="container">
        <div class="card">
            <h3>📝 Add New Annotation</h3>
            <p>Track contextual events that might influence Sven's behavior patterns.</p>
            
            <div id="messageContainer"></div>
            
            <form id="annotationForm" style="margin-top: 1.5rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div>
                        <label for="startDate" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Start Date *</label>
                        <input type="date" id="startDate" name="startDate" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div>
                        <label for="endDate" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">End Date *</label>
                        <input type="date" id="endDate" name="endDate" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div>
                        <label for="category" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Category *</label>
                        <select id="category" name="category" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="">Select category...</option>
                            <option value="health">🏥 Health</option>
                            <option value="environment">🌱 Environment</option>
                            <option value="travel">✈️ Travel</option>
                            <option value="food">🍽️ Food</option>
                            <option value="other">📝 Other</option>
                        </select>
                    </div>
                    <div>
                        <label for="title" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Title *</label>
                        <input type="text" id="title" name="title" placeholder="Brief description..." required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <label for="description" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Description</label>
                    <textarea id="description" name="description" rows="3" placeholder="Detailed notes about this event..." style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"></textarea>
                </div>
                
                <button type="submit" class="btn">Save Annotation</button>
                <button type="button" class="btn btn-secondary" id="cancelEdit" style="display: none; margin-left: 10px;">Cancel Edit</button>
            </form>
        </div>
        
        <div class="card">
            <h3>📋 Existing Annotations</h3>
            <div id="annotationsContainer" style="margin-top: 1.5rem;">Loading annotations...</div>
            <div id="pagination" style="text-align: center; margin-top: 1.5rem;"></div>
        </div>
    </div>

    <script>
        let annotations = [];
        let editingId = null;
        let currentPage = 1;
        const pageSize = 10;

        // Load annotations on page load
        document.addEventListener('DOMContentLoaded', function() {
            loadAnnotations();
            
            // Check for edit parameter in URL
            const urlParams = new URLSearchParams(window.location.search);
            const editId = urlParams.get('edit');
            if (editId) {
                // Wait for annotations to load, then auto-populate form
                setTimeout(() => {
                    const annotation = annotations.find(a => a.id === editId);
                    if (annotation) {
                        populateFormForEdit(annotation);
                    }
                }, 500);
            }
            
            // Set default end date to start date when start date changes
            document.getElementById('startDate').addEventListener('change', function() {
                const endDate = document.getElementById('endDate');
                if (!endDate.value || endDate.value < this.value) {
                    endDate.value = this.value;
                }
            });
        });

        // Form submission
        document.getElementById('annotationForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            if (editingId) {
                formData.append('id', editingId);
            }
            
            try {
                const method = editingId ? 'PUT' : 'POST';
                const response = await fetch('/api/annotations', {
                    method: method,
                    body: formData
                });
                
                if (response.ok) {
                    showMessage(editingId ? 'Annotation updated successfully!' : 'Annotation added successfully!', 'success');
                    this.reset();
                    editingId = null;
                    document.getElementById('cancelEdit').style.display = 'none';
                    loadAnnotations();
                } else {
                    const error = await response.text();
                    showMessage('Error: ' + error, 'error');
                }
            } catch (error) {
                showMessage('Error: ' + error.message, 'error');
            }
        });

        // Cancel edit
        document.getElementById('cancelEdit').addEventListener('click', function() {
            document.getElementById('annotationForm').reset();
            editingId = null;
            this.style.display = 'none';
        });

        async function loadAnnotations() {
            try {
                const response = await fetch('/api/annotations');
                annotations = await response.json();
                renderAnnotations();
            } catch (error) {
                document.getElementById('annotationsContainer').innerHTML = 
                    '<div class="message error">Error loading annotations: ' + error.message + '</div>';
            }
        }

        function renderAnnotations() {
            const container = document.getElementById('annotationsContainer');
            const paginationContainer = document.getElementById('pagination');
            
            if (annotations.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">No annotations yet. Add your first annotation above!</p>';
                paginationContainer.innerHTML = '';
                return;
            }

            // Calculate pagination
            const totalPages = Math.ceil(annotations.length / pageSize);
            const startIndex = (currentPage - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const pageAnnotations = annotations.slice(startIndex, endIndex);

            // Render annotations
            let html = '';
            pageAnnotations.forEach(annotation => {
                const categoryColors = {
                    'health': '#f44336',
                    'environment': '#4caf50', 
                    'travel': '#2196f3',
                    'food': '#ff9800',
                    'other': '#9e9e9e'
                };
                
                const categoryIcons = {
                    'health': '🏥',
                    'environment': '🌱', 
                    'travel': '✈️',
                    'food': '🍽️',
                    'other': '📝'
                };
                
                const createdBy = annotation.createdBy.includes('magnus') ? 'Magnus' : 'Wendy';
                const startDate = new Date(annotation.startDate).toLocaleDateString();
                const endDate = new Date(annotation.endDate).toLocaleDateString();
                
                html += \`
                    <div style="background: white; border: 1px solid #eee; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div>
                                <span style="display: inline-block; padding: 4px 12px; background-color: \${categoryColors[annotation.category] || categoryColors.other}; color: white; border-radius: 12px; font-size: 12px; font-weight: 500; text-transform: uppercase; margin-bottom: 0.5rem;">
                                    \${categoryIcons[annotation.category] || categoryIcons.other} \${annotation.category}
                                </span>
                                <h4 style="margin: 0; color: #333;">\${annotation.title}</h4>
                            </div>
                            <div>
                                <button onclick="editAnnotation('\${annotation.id}')" style="background: #2e7d32; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; margin-right: 8px;">Edit</button>
                                <button onclick="deleteAnnotation('\${annotation.id}')" style="background: #f44336; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">Delete</button>
                            </div>
                        </div>
                        <div style="color: #666; margin-bottom: 0.5rem; font-size: 14px;">
                            📅 \${startDate} - \${endDate}
                        </div>
                        <p style="margin: 0.5rem 0; color: #333; line-height: 1.5;">\${annotation.description || 'No additional details provided.'}</p>
                        <div style="font-size: 12px; color: #999; margin-top: 1rem; border-top: 1px solid #eee; padding-top: 0.5rem;">
                            Added by \${createdBy} on \${new Date(annotation.createdAt).toLocaleDateString()}
                            \${annotation.updatedAt ? \` • Last updated \${new Date(annotation.updatedAt).toLocaleDateString()}\` : ''}
                        </div>
                    </div>
                \`;
            });
            
            container.innerHTML = html;

            // Render pagination
            if (totalPages > 1) {
                let paginationHtml = '';
                
                // Previous button
                paginationHtml += \`<button \${currentPage === 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} onclick="changePage(\${currentPage - 1})" style="margin: 0 5px; padding: 8px 16px; border: 1px solid #ddd; background: white; cursor: pointer; border-radius: 4px;">Previous</button>\`;
                
                // Page numbers
                for (let i = 1; i <= totalPages; i++) {
                    const isActive = i === currentPage;
                    paginationHtml += \`<button onclick="changePage(\${i})" style="margin: 0 5px; padding: 8px 16px; border: 1px solid \${isActive ? '#667eea' : '#ddd'}; background: \${isActive ? '#667eea' : 'white'}; color: \${isActive ? 'white' : '#333'}; cursor: pointer; border-radius: 4px;">\${i}</button>\`;
                }
                
                // Next button
                paginationHtml += \`<button \${currentPage === totalPages ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} onclick="changePage(\${currentPage + 1})" style="margin: 0 5px; padding: 8px 16px; border: 1px solid #ddd; background: white; cursor: pointer; border-radius: 4px;">Next</button>\`;
                
                paginationContainer.innerHTML = paginationHtml;
            } else {
                paginationContainer.innerHTML = '';
            }
        }

        function changePage(page) {
            currentPage = page;
            renderAnnotations();
        }

        function populateFormForEdit(annotation) {
            // Populate form
            document.getElementById('startDate').value = annotation.startDate;
            document.getElementById('endDate').value = annotation.endDate;
            document.getElementById('category').value = annotation.category;
            document.getElementById('title').value = annotation.title;
            document.getElementById('description').value = annotation.description || '';
            
            editingId = annotation.id;
            document.getElementById('cancelEdit').style.display = 'inline-block';
            
            // Scroll to form and clear URL parameter
            document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
            
            // Clear the edit parameter from URL without page reload
            const url = new URL(window.location);
            url.searchParams.delete('edit');
            window.history.replaceState({}, '', url);
        }

        function editAnnotation(id) {
            const annotation = annotations.find(a => a.id === id);
            if (!annotation) return;
            
            populateFormForEdit(annotation);
        }

        async function deleteAnnotation(id) {
            if (!confirm('Are you sure you want to delete this annotation? This action cannot be undone.')) {
                return;
            }
            
            try {
                const response = await fetch('/api/annotations?id=' + id, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    showMessage('Annotation deleted successfully!', 'success');
                    loadAnnotations();
                } else {
                    const error = await response.text();
                    showMessage('Error: ' + error, 'error');
                }
            } catch (error) {
                showMessage('Error: ' + error.message, 'error');
            }
        }

        function showMessage(text, type) {
            const container = document.getElementById('messageContainer');
            const bgColor = type === 'success' ? '#d4edda' : '#f8d7da';
            const textColor = type === 'success' ? '#155724' : '#721c24';
            const borderColor = type === 'success' ? '#c3e6cb' : '#f5c6cb';
            
            container.innerHTML = \`<div style="background: \${bgColor}; color: \${textColor}; border: 1px solid \${borderColor}; padding: 12px; border-radius: 4px; margin-bottom: 1rem;">\${text}</div>\`;
            
            // Auto-hide success messages
            if (type === 'success') {
                setTimeout(() => {
                    container.innerHTML = '';
                }, 5000);
            }
        }
    </script>
</body>
</html>`;
}

function getHealthPage(email) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cat Flap Stats - Health Monitoring</title>
    <link rel="icon" href="/favicon.ico" type="image/svg+xml">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
${getSharedCSS()}
        
        /* Health page specific styles */
        .container {
            max-width: 1400px;
            margin: 2rem auto;
            padding: 0 1rem;
        }
        .health-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-bottom: 2rem;
        }
        @media (max-width: 768px) {
            .health-grid { grid-template-columns: 1fr; }
        }
        .anomaly-item {
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 0.5rem;
            border-left: 4px solid #ddd;
            transition: all 0.2s ease;
        }
        .anomaly-item:hover {
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .anomaly-item.severity-high {
            border-left-color: #f44336;
            background: #ffebee;
        }
        .anomaly-item.severity-medium {
            border-left-color: #ff9800;
            background: #fff3e0;
        }
        .anomaly-item.severity-low {
            border-left-color: #ffeb3b;
            background: #fffde7;
        }
        .anomaly-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
        }
        .anomaly-date {
            font-weight: 500;
            color: #333;
        }
        .anomaly-severity {
            font-size: 0.8rem;
            padding: 0.2rem 0.5rem;
            border-radius: 12px;
            font-weight: 500;
            text-transform: uppercase;
        }
        .severity-high { background: #ffcdd2; color: #c62828; }
        .severity-medium { background: #ffe0b2; color: #ef6c00; }
        .severity-low { background: #fff9c4; color: #f57f17; }
        .anomaly-description {
            color: #666;
            font-size: 0.9rem;
            margin: 0.25rem 0;
        }
        .anomaly-timing {
            font-size: 0.8rem;
            color: #888;
        }
        .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        .baseline-info {
            background: linear-gradient(135deg, #e8f5e8 0%, #f0f8ff 100%);
            border-left: 4px solid #4caf50;
        }
        .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 200px;
            flex-direction: column;
            gap: 1rem;
        }
        .loading-spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #2196f3;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .error {
            background: #ffebee;
            border: 1px solid #f44336;
            color: #c62828;
            padding: 1rem;
            border-radius: 4px;
            margin: 1rem 0;
        }
        .empty-state {
            text-align: center;
            padding: 3rem;
            color: #666;
        }
        .health-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
            display: block;
        }
        .pagination {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 0.5rem;
            margin: 1rem 0;
            flex-wrap: wrap;
        }
        .pagination button {
            padding: 0.5rem 1rem;
            border: 1px solid #ddd;
            background: white;
            color: #333;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s ease;
        }
        .pagination button:hover:not(:disabled) {
            background: #f5f5f5;
            border-color: #2196f3;
        }
        .pagination button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .pagination button.active {
            background: #2196f3;
            color: white;
            border-color: #2196f3;
        }
        .pagination-info {
            font-size: 14px;
            color: #666;
            margin: 0 1rem;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">
            <h2>⚕️ Cat Flap Stats - Health Monitoring</h2>
        </div>
        <div class="nav-links">
            <a href="/dashboard" class="btn btn-secondary">Dashboard</a>
            <a href="/patterns" class="btn btn-secondary">Patterns</a>
            <a href="/circadian" class="btn btn-secondary">Circadian</a>
            <a href="/seasonal" class="btn btn-secondary">Seasonal</a>
            <a href="/annotations" class="btn btn-secondary">Annotations</a>
            <span>Welcome, ${email}</span>
            <a href="/logout" class="btn btn-secondary">Logout</a>
        </div>
    </div>
    
    <div class="container">
        <div class="loading" id="loading">
            <div class="loading-spinner"></div>
            <p>Loading health analysis...</p>
        </div>
        
        <div id="error" class="error" style="display: none;"></div>
        
        <div id="content" style="display: none;">
            <!-- Health Summary Statistics -->
            <div class="summary-stats" id="health-summary">
                <!-- Populated by JavaScript -->
            </div>
            
            <!-- Duration Baselines -->
            <div class="stat-card baseline-info">
                <h3>🎯 Duration Baselines</h3>
                <div id="baseline-info">
                    <!-- Populated by JavaScript -->
                </div>
            </div>
            
            <!-- Health Grid -->
            <div class="health-grid">
                <!-- Recent Anomalies -->
                <div class="stat-card">
                    <h3>🚨 Recent Anomalies</h3>
                    <div id="recent-anomalies">
                        <!-- Populated by JavaScript -->
                    </div>
                </div>
                
                <!-- Timeline Markers Info -->
                <div class="stat-card">
                    <h3>📍 Timeline Integration</h3>
                    <p>Health anomalies are marked with ⚕️ icons on all timeline visualizations:</p>
                    <ul style="margin: 1rem 0; padding-left: 2rem;">
                        <li><strong>Patterns page:</strong> Actogram timeline markers</li>
                        <li><strong>Circadian page:</strong> Daily rhythm overlays</li>
                        <li><strong>Seasonal page:</strong> Seasonal comparison charts</li>
                    </ul>
                    <p><small>Click any ⚕️ marker to see detailed anomaly information and correlate with behavioral annotations.</small></p>
                </div>
            </div>
            
            <!-- All Anomalies -->
            <div class="stat-card">
                <h3>📋 All Duration Anomalies</h3>
                <div id="all-anomalies">
                    <!-- Populated by JavaScript -->
                </div>
                <div id="anomalies-pagination" class="pagination" style="display: none;">
                    <!-- Pagination controls populated by JavaScript -->
                </div>
            </div>
        </div>
    </div>

    <script>
        // Pagination state for all anomalies
        let allAnomaliesData = [];
        let currentPage = 1;
        const itemsPerPage = 10;
        
        // Load health monitoring data on page load
        document.addEventListener('DOMContentLoaded', () => {
            loadHealthData();
        });

        async function loadHealthData() {
            const loadingEl = document.getElementById('loading');
            const errorEl = document.getElementById('error');
            const contentEl = document.getElementById('content');
            
            try {
                console.log('Loading analytics data for health monitoring...');
                
                const response = await fetch('/api/analytics');
                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }
                
                const data = await response.json();
                console.log('Analytics data loaded:', data);
                
                if (data && data.precomputed && data.precomputed.durationAnomalies) {
                    displayHealthData(data.precomputed.durationAnomalies);
                    loadingEl.style.display = 'none';
                    contentEl.style.display = 'block';
                } else {
                    throw new Error('Duration anomalies data not available in analytics');
                }
                
            } catch (error) {
                console.error('Error loading health data:', error);
                loadingEl.style.display = 'none';
                errorEl.textContent = \`Error loading health monitoring data: \${error.message}\`;
                errorEl.style.display = 'block';
            }
        }

        function displayHealthData(healthData) {
            console.log('Displaying health data:', healthData);
            
            // Display summary statistics
            displayHealthSummary(healthData.summary);
            
            // Display baseline information
            displayBaselineInfo(healthData.baselines);
            
            // Display recent anomalies (last 5)
            displayRecentAnomalies(healthData.anomalies.slice(0, 5));
            
            // Store and display all anomalies with pagination
            allAnomaliesData = healthData.anomalies;
            currentPage = 1;
            displayAllAnomalies();
        }
        
        function displayHealthSummary(summary) {
            const container = document.getElementById('health-summary');
            
            container.innerHTML = \`
                <div class="stat-card">
                    <h3>📊 Anomaly Summary</h3>
                    <p><strong>\${summary.total_anomalies}</strong> total anomalies detected</p>
                </div>
                <div class="stat-card severity-high">
                    <h3>🔴 Significant</h3>
                    <p><strong>\${summary.significant_anomalies}</strong> anomalies</p>
                    <small>±3+ standard deviations</small>
                </div>
                <div class="stat-card severity-medium">
                    <h3>🟡 Moderate</h3>
                    <p><strong>\${summary.moderate_anomalies}</strong> anomalies</p>
                    <small>±2-3 standard deviations</small>
                </div>
                <div class="stat-card severity-low">
                    <h3>🟢 Mild</h3>
                    <p><strong>\${summary.mild_anomalies}</strong> anomalies</p>
                    <small>±1-2 standard deviations</small>
                </div>
            \`;
        }
        
        function displayBaselineInfo(baselines) {
            const container = document.getElementById('baseline-info');
            
            const globalInfo = \`
                <h4>Global Baseline</h4>
                <p><strong>Average Duration:</strong> \${formatDuration(baselines.global.mean)}</p>
                <p><strong>Standard Deviation:</strong> \${formatDuration(baselines.global.std)}</p>
            \`;
            
            let seasonalInfo = '<h4>Seasonal Baselines</h4>';
            for (const [season, baseline] of Object.entries(baselines.seasonal)) {
                seasonalInfo += \`
                    <p><strong>\${season.charAt(0).toUpperCase() + season.slice(1)}:</strong> 
                    \${formatDuration(baseline.mean)} (±\${formatDuration(baseline.std)})</p>
                \`;
            }
            
            container.innerHTML = globalInfo + seasonalInfo;
        }
        
        function displayRecentAnomalies(anomalies) {
            const container = document.getElementById('recent-anomalies');
            
            if (anomalies.length === 0) {
                container.innerHTML = \`
                    <div class="empty-state">
                        <span class="health-icon">🎉</span>
                        <p>No recent anomalies detected!</p>
                        <small>All recent sessions are within normal duration ranges.</small>
                    </div>
                \`;
                return;
            }
            
            container.innerHTML = anomalies.map(anomaly => \`
                <div class="anomaly-item severity-\${anomaly.severity}">
                    <div class="anomaly-header">
                        <span class="anomaly-date">\${anomaly.date}</span>
                        <span class="anomaly-severity severity-\${anomaly.severity}">\${anomaly.anomaly_type}</span>
                    </div>
                    <div class="anomaly-description">\${anomaly.description}</div>
                    <div class="anomaly-timing">
                        \${anomaly.exit_time} - \${anomaly.entry_time} | z-score: \${anomaly.z_score}
                    </div>
                </div>
            \`).join('');
        }
        
        function displayAllAnomalies() {
            const container = document.getElementById('all-anomalies');
            const paginationContainer = document.getElementById('anomalies-pagination');
            
            if (allAnomaliesData.length === 0) {
                container.innerHTML = \`
                    <div class="empty-state">
                        <span class="health-icon">✅</span>
                        <p>No anomalies detected in your data!</p>
                        <small>All sessions are within normal statistical ranges.</small>
                    </div>
                \`;
                paginationContainer.style.display = 'none';
                return;
            }
            
            // Calculate pagination
            const totalPages = Math.ceil(allAnomaliesData.length / itemsPerPage);
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const currentPageData = allAnomaliesData.slice(startIndex, endIndex);
            
            // Display current page of anomalies
            container.innerHTML = currentPageData.map(anomaly => \`
                <div class="anomaly-item severity-\${anomaly.severity}">
                    <div class="anomaly-header">
                        <span class="anomaly-date">\${anomaly.date}</span>
                        <span class="anomaly-severity severity-\${anomaly.severity}">\${anomaly.anomaly_type}</span>
                    </div>
                    <div class="anomaly-description">\${anomaly.description}</div>
                    <div class="anomaly-timing">
                        \${anomaly.exit_time} - \${anomaly.entry_time} | Season: \${anomaly.season} | z-score: \${anomaly.z_score}
                    </div>
                </div>
            \`).join('');
            
            // Display pagination controls if more than one page
            if (totalPages > 1) {
                paginationContainer.innerHTML = createPaginationControls(currentPage, totalPages, allAnomaliesData.length);
                paginationContainer.style.display = 'flex';
            } else {
                paginationContainer.style.display = 'none';
            }
        }
        
        function createPaginationControls(page, totalPages, totalItems) {
            const startItem = (page - 1) * itemsPerPage + 1;
            const endItem = Math.min(page * itemsPerPage, totalItems);
            
            let controls = \`
                <button onclick="goToPage(\${page - 1})" \${page === 1 ? 'disabled' : ''}>
                    ← Previous
                </button>
                <span class="pagination-info">
                    \${startItem}-\${endItem} of \${totalItems} anomalies
                </span>
            \`;
            
            // Add page numbers (show up to 5 pages around current page)
            const startPage = Math.max(1, page - 2);
            const endPage = Math.min(totalPages, page + 2);
            
            if (startPage > 1) {
                controls += \`<button onclick="goToPage(1)">1</button>\`;
                if (startPage > 2) {
                    controls += \`<span>...</span>\`;
                }
            }
            
            for (let i = startPage; i <= endPage; i++) {
                controls += \`
                    <button onclick="goToPage(\${i})" \${i === page ? 'class="active"' : ''}>
                        \${i}
                    </button>
                \`;
            }
            
            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    controls += \`<span>...</span>\`;
                }
                controls += \`<button onclick="goToPage(\${totalPages})">\${totalPages}</button>\`;
            }
            
            controls += \`
                <button onclick="goToPage(\${page + 1})" \${page === totalPages ? 'disabled' : ''}>
                    Next →
                </button>
            \`;
            
            return controls;
        }
        
        function goToPage(page) {
            if (page < 1 || page > Math.ceil(allAnomaliesData.length / itemsPerPage)) {
                return;
            }
            
            currentPage = page;
            displayAllAnomalies();
            
            // Scroll to top of anomalies section
            document.getElementById('all-anomalies').scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }
        
        function formatDuration(minutes) {
            if (minutes >= 60) {
                const hours = Math.floor(minutes / 60);
                const mins = Math.round(minutes % 60);
                return \`\${hours}h \${mins}m\`;
            } else {
                return \`\${Math.round(minutes)}m\`;
            }
        }
    </script>
</body>
</html>`;
}

function getDataQualityPage(email) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cat Flap Stats - Data Quality</title>
    <link rel="icon" href="/favicon.ico" type="image/svg+xml">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
${getSharedCSS()}
        
        /* Data Quality page specific styles */
        .container {
            max-width: 1400px;
            margin: 2rem auto;
            padding: 0 1rem;
        }
        .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 200px;
            flex-direction: column;
            gap: 1rem;
        }
        .loading-spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #2196f3;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .quality-metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 0;
            border-bottom: 1px solid #eee;
        }
        .quality-metric:last-child {
            border-bottom: none;
        }
        .metric-label {
            font-weight: 500;
            color: #333;
        }
        .metric-value {
            font-weight: 600;
            color: #2196f3;
        }
        .metric-impact {
            color: #ff9800;
            font-size: 0.9rem;
        }
        .day-analysis {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr;
            gap: 1rem;
            margin: 1rem 0;
            padding: 0.5rem;
            background: #f8f9fa;
            border-radius: 4px;
        }
        .day-name { font-weight: 500; }
        .sessions-count { text-align: center; }
        .entry-only { text-align: center; color: #ff5722; }
        .impact-high { color: #f44336; font-weight: 600; }
        .confidence-level {
            display: inline-block;
            padding: 0.2rem 0.6rem;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
        }
        .confidence-high { 
            background: #e8f5e8; 
            color: #2e7d32; 
            border: 1px solid #c8e6c9;
        }
        .confidence-medium { 
            background: #fff3e0; 
            color: #ef6c00; 
            border: 1px solid #ffcc02;
        }
        .confidence-low { 
            background: #ffebee; 
            color: #c62828; 
            border: 1px solid #ffcdd2;
        }
        .confidence-stats {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 1rem;
            margin: 1rem 0;
        }
        .confidence-card {
            text-align: center;
            padding: 1rem;
            border-radius: 8px;
            border: 1px solid #e0e0e0;
        }
        .confidence-percentage {
            font-size: 1.5rem;
            font-weight: 600;
            margin: 0.5rem 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">
            <h2>📊 Cat Flap Stats - Data Quality</h2>
        </div>
        <div class="nav-links">
            <a href="/dashboard" class="btn btn-secondary">Dashboard</a>
            <a href="/patterns" class="btn btn-secondary">Patterns</a>
            <a href="/circadian" class="btn btn-secondary">Circadian</a>
            <a href="/seasonal" class="btn btn-secondary">Seasonal</a>
            <a href="/health" class="btn btn-secondary">Health</a>
            <a href="/annotations" class="btn btn-secondary">Annotations</a>
            <span>Welcome, ${email}</span>
            <a href="/logout" class="btn btn-secondary">Logout</a>
        </div>
    </div>
    
    <div class="container">
        <div class="card">
            <h1>📊 Data Quality Dashboard</h1>
            <p class="subtitle">Comprehensive analysis of data completeness and reliability</p>
        </div>
        
        <div class="card">
            <h2>📋 Processing Report Trends</h2>
            <div class="loading" id="processing-loading">
                <div class="loading-spinner"></div>
                <p>Loading processing validation metrics...</p>
            </div>
            <div id="processing-trends-container" style="display: none;">
                <!-- Processing metrics content will be inserted here -->
            </div>
        </div>
        
        <div class="card">
            <h2>🎯 Single Timestamp Confidence</h2>
            <div id="confidence-analysis">
                <div class="loading">
                    <div class="loading-spinner"></div>
                    <p>Calculating timestamp confidence scores...</p>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>📅 Sunday Truncation Impact</h2>
            <div id="sunday-analysis">
                <div class="loading">
                    <div class="loading-spinner"></div>
                    <p>Analyzing Sunday data truncation effects...</p>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>📊 Historical Missing Data</h2>
            <div class="loading" id="missing-data-loading">
                <div class="loading-spinner"></div>
                <p>Loading missing report weeks analysis...</p>
            </div>
            <div id="missing-data-container" style="display: none;">
                <!-- Missing data content will be inserted here -->
            </div>
        </div>
    </div>

    <script>
        console.log('Data Quality Dashboard loaded');
        
        // Load Sunday truncation analysis
        async function loadSundayAnalysis() {
            try {
                const response = await fetch('/api/download/dataset.json');
                const data = await response.json();
                
                console.log('Sunday analysis: Dataset loaded successfully');
                
                // Analyze Sunday truncation from dataset
                const analysis = analyzeSundayTruncation(data);
                displaySundayAnalysis(analysis);
            } catch (error) {
                console.error('Error loading Sunday analysis:', error);
                document.getElementById('sunday-analysis').innerHTML = '<p>Error loading Sunday analysis</p>';
            }
        }
        
        function analyzeSundayTruncation(data) {
            // Process the dataset to analyze Sunday truncation
            const sessions = [];
            
            // Process session data for Sunday truncation analysis
            
            // Handle both old and new data formats
            if (data.sessions && data.sessions.sessions) {
                // New format with nested sessions array
                for (const report of data.sessions.sessions) {
                    if (report.session_data) {
                        sessions.push(...report.session_data);
                    }
                }
            } else if (data.sessions && Array.isArray(data.sessions)) {
                // Direct sessions array format
                for (const report of data.sessions) {
                    if (report.session_data) {
                        sessions.push(...report.session_data);
                    }
                }
            } else if (Array.isArray(data)) {
                // Old format - array of reports
                for (const report of data) {
                    if (report.session_data) {
                        sessions.push(...report.session_data);
                    }
                }
            }
            
            // Analyze by day of week
            const dayStats = {};
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            
            // Initialize stats
            dayNames.forEach(day => {
                dayStats[day] = { total: 0, entryOnly: 0 };
            });
            
            sessions.forEach(session => {
                const date = new Date(session.date_full || session.Date);
                const dayName = dayNames[date.getDay()];
                
                dayStats[dayName].total++;
                
                // Check for entry-only sessions (missing exit_time)
                const exitTime = session.exit_time || session.Exit_Time;
                if (!exitTime || exitTime === '' || exitTime === 'nan') {
                    dayStats[dayName].entryOnly++;
                }
            });
            
            // Calculate percentages and impact
            const results = {};
            dayNames.forEach(day => {
                const stats = dayStats[day];
                results[day] = {
                    total: stats.total,
                    entryOnly: stats.entryOnly,
                    percentage: stats.total > 0 ? (stats.entryOnly / stats.total * 100) : 0
                };
            });
            
            // Calculate Sunday impact
            const sundayPct = results.Sunday.percentage;
            const otherDaysAvg = dayNames
                .filter(day => day !== 'Sunday')
                .reduce((sum, day) => sum + results[day].percentage, 0) / 6;
            
            return {
                dayStats: results,
                sundayImpact: sundayPct - otherDaysAvg,
                totalAffected: results.Sunday.entryOnly
            };
        }
        
        function displaySundayAnalysis(analysis) {
            const container = document.getElementById('sunday-analysis');
            
            const html = \`
                <div class="quality-metric">
                    <span class="metric-label">Sunday Entry-Only Sessions</span>
                    <span class="metric-value">\${analysis.dayStats.Sunday.percentage.toFixed(1)}%</span>
                </div>
                <div class="quality-metric">
                    <span class="metric-label">Other Days Average</span>
                    <span class="metric-value">\${(Object.keys(analysis.dayStats)
                        .filter(day => day !== 'Sunday')
                        .reduce((sum, day) => sum + analysis.dayStats[day].percentage, 0) / 6).toFixed(1)}%</span>
                </div>
                <div class="quality-metric">
                    <span class="metric-label">Sunday Impact</span>
                    <span class="metric-impact \${analysis.sundayImpact > 5 ? 'impact-high' : ''}">
                        +\${analysis.sundayImpact.toFixed(1)} percentage points
                    </span>
                </div>
                <div class="quality-metric">
                    <span class="metric-label">Total Affected Sunday Sessions</span>
                    <span class="metric-value">\${analysis.totalAffected}</span>
                </div>
                
                <h4 style="margin: 1rem 0 0.5rem 0;">Daily Breakdown:</h4>
                \${Object.keys(analysis.dayStats).map(day => {
                    const stats = analysis.dayStats[day];
                    const pct = stats.percentage;
                    const isHigh = pct > 10;
                    return \`
                        <div class="day-analysis">
                            <div class="day-name">\${day}</div>
                            <div class="sessions-count">\${stats.total} sessions</div>
                            <div class="entry-only \${isHigh ? 'impact-high' : ''}">\${stats.entryOnly} entry-only (\${pct.toFixed(1)}%)</div>
                        </div>
                    \`;
                }).join('')}
            \`;
            
            container.innerHTML = html;
        }
        
        // Load analysis on page load
        loadSundayAnalysis();
        loadConfidenceAnalysis();
        loadProcessingTrends();
        loadMissingDataAnalysis();
        
        // Load confidence analysis
        async function loadConfidenceAnalysis() {
            try {
                const response = await fetch('/api/download/dataset.json');
                const data = await response.json();
                
                console.log('Confidence analysis: Dataset loaded successfully');
                
                const analysis = analyzeTimestampConfidence(data);
                displayConfidenceAnalysis(analysis);
            } catch (error) {
                console.error('Error loading confidence analysis:', error);
                document.getElementById('confidence-analysis').innerHTML = '<p>Error loading confidence analysis</p>';
            }
        }
        
        function analyzeTimestampConfidence(data) {
            const sessions = [];
            
            // Extract sessions (same logic as Sunday analysis)
            if (data.sessions && data.sessions.sessions) {
                for (const report of data.sessions.sessions) {
                    if (report.session_data) {
                        sessions.push(...report.session_data);
                    }
                }
            } else if (data.sessions && Array.isArray(data.sessions)) {
                for (const report of data.sessions) {
                    if (report.session_data) {
                        sessions.push(...report.session_data);
                    }
                }
            } else if (Array.isArray(data)) {
                for (const report of data) {
                    if (report.session_data) {
                        sessions.push(...report.session_data);
                    }
                }
            }
            
            // Sort sessions by date for cross-midnight analysis
            sessions.sort((a, b) => {
                const dateA = new Date(a.date_full || a.Date);
                const dateB = new Date(b.date_full || b.Date);
                return dateA - dateB;
            });
            
            // Analyze timestamp completeness with cross-midnight detection
            let completeTimestamps = 0;
            let crossMidnightPairs = 0;
            let trueEntryOnly = 0;
            let trueExitOnly = 0;
            let invalidSessions = 0;
            const pairedSessions = new Set();
            
            // First pass: identify cross-midnight pairs
            for (let i = 0; i < sessions.length - 1; i++) {
                if (pairedSessions.has(i)) continue;
                
                const current = sessions[i];
                const next = sessions[i + 1];
                
                const currentDate = new Date(current.date_full || current.Date);
                const nextDate = new Date(next.date_full || next.Date);
                const daysDiff = (nextDate - currentDate) / (1000 * 60 * 60 * 24);
                
                // Check if current session is exit-only and next is entry-only on consecutive day
                const currentHasExit = current.exit_time && current.exit_time !== '' && current.exit_time !== 'nan';
                const currentHasEntry = current.entry_time && current.entry_time !== '' && current.entry_time !== 'nan';
                const nextHasExit = next.exit_time && next.exit_time !== '' && next.exit_time !== 'nan';
                const nextHasEntry = next.entry_time && next.entry_time !== '' && next.entry_time !== 'nan';
                
                // Cross-midnight pair: exit-only followed by entry-only on next day
                if (daysDiff === 1 && 
                    currentHasExit && !currentHasEntry && 
                    !nextHasExit && nextHasEntry) {
                    
                    // Validate timing: exit should be evening, entry should be early morning
                    const exitTime = current.exit_time;
                    const entryTime = next.entry_time;
                    
                    if (isLateEvening(exitTime) && isEarlyMorning(entryTime)) {
                        crossMidnightPairs++;
                        pairedSessions.add(i);
                        pairedSessions.add(i + 1);
                    }
                }
            }
            
            // Second pass: categorize remaining sessions
            sessions.forEach((session, index) => {
                if (pairedSessions.has(index)) {
                    return; // Already counted as cross-midnight pair
                }
                
                const hasExit = session.exit_time && session.exit_time !== '' && session.exit_time !== 'nan';
                const hasEntry = session.entry_time && session.entry_time !== '' && session.entry_time !== 'nan';
                
                if (hasExit && hasEntry) {
                    completeTimestamps++;
                } else if (!hasExit && hasEntry) {
                    trueEntryOnly++;
                } else if (hasExit && !hasEntry) {
                    trueExitOnly++;
                } else {
                    invalidSessions++;
                }
            });
            
            const total = sessions.length;
            const completeSessions = completeTimestamps + (crossMidnightPairs * 2); // Each pair represents one complete session across 2 records
            const trueSingleTimestamp = trueEntryOnly + trueExitOnly;
            
            return {
                total,
                complete: completeTimestamps,
                crossMidnightPairs,
                completeSessions,
                trueEntryOnly,
                trueExitOnly,
                trueSingleTimestamp,
                invalid: invalidSessions,
                confidence: {
                    high: (completeSessions / total * 100),
                    medium: (trueSingleTimestamp / total * 100),
                    low: (invalidSessions / total * 100)
                }
            };
        }
        
        function isLateEvening(timeStr) {
            if (!timeStr) return false;
            const hour = parseInt(timeStr.split(':')[0]);
            return hour >= 20 || hour <= 2; // 8 PM to 2 AM
        }
        
        function isEarlyMorning(timeStr) {
            if (!timeStr) return false;
            const hour = parseInt(timeStr.split(':')[0]);
            return hour >= 0 && hour <= 8; // Midnight to 8 AM
        }
        
        function displayConfidenceAnalysis(analysis) {
            const container = document.getElementById('confidence-analysis');
            
            const html = \`
                <div class="confidence-stats">
                    <div class="confidence-card">
                        <div class="confidence-level confidence-high">High Confidence</div>
                        <div class="confidence-percentage">\${analysis.confidence.high.toFixed(1)}%</div>
                        <div>Complete sessions</div>
                        <div style="color: #666; font-size: 0.9rem;">\${analysis.completeSessions} sessions</div>
                    </div>
                    <div class="confidence-card">
                        <div class="confidence-level confidence-medium">Medium Confidence</div>
                        <div class="confidence-percentage">\${analysis.confidence.medium.toFixed(1)}%</div>
                        <div>True single timestamp</div>
                        <div style="color: #666; font-size: 0.9rem;">\${analysis.trueSingleTimestamp} sessions</div>
                    </div>
                    <div class="confidence-card">
                        <div class="confidence-level confidence-low">Low Confidence</div>
                        <div class="confidence-percentage">\${analysis.confidence.low.toFixed(1)}%</div>
                        <div>Missing/invalid data</div>
                        <div style="color: #666; font-size: 0.9rem;">\${analysis.invalid} sessions</div>
                    </div>
                </div>
                
                <div class="quality-metric">
                    <span class="metric-label">Same-Day Complete Sessions</span>
                    <span class="metric-value">\${analysis.complete} sessions (\${(analysis.complete/analysis.total*100).toFixed(1)}%)</span>
                </div>
                <div class="quality-metric">
                    <span class="metric-label">Cross-Midnight Pairs</span>
                    <span class="metric-value">\${analysis.crossMidnightPairs} pairs (\${(analysis.crossMidnightPairs*2/analysis.total*100).toFixed(1)}% of records)</span>
                </div>
                <div class="quality-metric">
                    <span class="metric-label">True Entry-Only Sessions</span>
                    <span class="metric-value">\${analysis.trueEntryOnly} sessions (\${(analysis.trueEntryOnly/analysis.total*100).toFixed(1)}%)</span>
                </div>
                <div class="quality-metric">
                    <span class="metric-label">True Exit-Only Sessions</span>
                    <span class="metric-value">\${analysis.trueExitOnly} sessions (\${(analysis.trueExitOnly/analysis.total*100).toFixed(1)}%)</span>
                </div>
                <div class="quality-metric">
                    <span class="metric-label">Data Quality Score</span>
                    <span class="metric-value \${analysis.confidence.high > 75 ? 'confidence-high' : analysis.confidence.high > 50 ? 'confidence-medium' : 'confidence-low'}">
                        \${analysis.confidence.high.toFixed(1)}% Complete
                    </span>
                </div>
            \`;
            
            container.innerHTML = html;
        }
        
        // Load processing trends analysis
        async function loadProcessingTrends() {
            try {
                const response = await fetch('/api/processing-metrics');
                const data = await response.json();
                
                const analysis = analyzeProcessingTrends(data);
                displayProcessingTrends(analysis);
                
                // Hide loading and show content
                document.getElementById('processing-loading').style.display = 'none';
                document.getElementById('processing-trends-container').style.display = 'block';
            } catch (error) {
                console.error('Error loading processing trends:', error);
                const container = document.getElementById('processing-trends-container');
                container.innerHTML = '<div class="error">Failed to load processing trends data</div>';
                document.getElementById('processing-loading').style.display = 'none';
                container.style.display = 'block';
            }
        }
        
        function analyzeProcessingTrends(data) {
            const metrics = data.metrics || [];
            const trends = data.trends || {};
            
            // Separate processing metrics from historical analysis
            const processingMetrics = metrics.filter(m => m.type !== 'historical_analysis');
            const historicalGaps = metrics.filter(m => m.type === 'historical_analysis');
            
            // Calculate trend statistics
            const totalProcessingRuns = processingMetrics.length;
            const successfulRuns = processingMetrics.filter(m => m.processing_status === 'success').length;
            const successRate = totalProcessingRuns > 0 ? (successfulRuns / totalProcessingRuns * 100) : 0;
            
            // Calculate duplicate rates over time
            const duplicateRates = processingMetrics.map(m => m.duplicate_rate_percent || 0);
            const avgDuplicateRate = duplicateRates.length > 0 ? duplicateRates.reduce((a, b) => a + b) / duplicateRates.length : 0;
            
            // Calculate new sessions over time
            const newSessionCounts = processingMetrics.map(m => m.unique_new_sessions_added || 0);
            const totalNewSessions = newSessionCounts.reduce((a, b) => a + b, 0);
            const avgNewSessions = newSessionCounts.length > 0 ? totalNewSessions / newSessionCounts.length : 0;
            
            // Dataset growth tracking
            const datasetSizes = processingMetrics.map(m => ({
                timestamp: m.timestamp,
                csvSize: m.dataset_growth?.csv_size_mb || 0,
                jsonSize: m.dataset_growth?.json_size_mb || 0,
                totalSessions: m.total_sessions_in_dataset || 0
            }));
            
            const currentSize = datasetSizes.length > 0 ? datasetSizes[datasetSizes.length - 1] : null;
            
            // Missing weeks analysis
            const totalMissingWeeks = historicalGaps.reduce((total, gap) => {
                return total + (gap.gap_details?.weeks_missing || 0);
            }, 0);
            
            return {
                summary: {
                    totalProcessingRuns,
                    successRate,
                    avgDuplicateRate,
                    avgNewSessions,
                    totalNewSessions,
                    totalMissingWeeks,
                    currentSize
                },
                processingMetrics,
                historicalGaps,
                datasetSizes,
                trends
            };
        }
        
        function displayProcessingTrends(analysis) {
            const container = document.getElementById('processing-trends-container');
            const { summary, historicalGaps, processingMetrics } = analysis;
            
            
            let recentUploadsHtml = '';
            if (processingMetrics.length > 0) {
                const recentUploads = processingMetrics.slice(-5).reverse(); // Last 5 uploads
                recentUploadsHtml = \`
                    <div class="recent-uploads">
                        <h4>🔄 Recent Processing Activity</h4>
                        <div class="uploads-list">
                            \${recentUploads.map(metric => {
                                const date = new Date(metric.timestamp).toLocaleDateString();
                                const status = metric.processing_status === 'success' ? '✅' : '❌';
                                const duplicateRate = metric.duplicate_rate_percent || 0;
                                const newSessions = metric.unique_new_sessions_added || 0;
                                
                                return \`
                                    <div class="upload-item">
                                        <div class="upload-header">
                                            <span class="upload-status">\${status}</span>
                                            <span class="upload-date">\${date}</span>
                                            <span class="upload-user">\${metric.uploader}</span>
                                        </div>
                                        <div class="upload-stats">
                                            <span class="stat">\${newSessions} new sessions</span>
                                            <span class="stat">\${duplicateRate.toFixed(1)}% duplicates</span>
                                        </div>
                                    </div>
                                \`;
                            }).join('')}
                        </div>
                    </div>
                \`;
            }
            
            const html = \`
                <div class="processing-trends-content">
                    <div class="metrics-grid">
                        <div class="metric-item">
                            <span class="metric-label">Processing Success Rate</span>
                            <span class="metric-value \${summary.successRate === 100 ? 'success' : summary.successRate > 80 ? 'warning' : 'error'}">
                                \${summary.successRate.toFixed(1)}%
                            </span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Average Duplicate Rate</span>
                            <span class="metric-value">
                                \${summary.avgDuplicateRate.toFixed(1)}%
                            </span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">New Sessions per Upload</span>
                            <span class="metric-value">
                                \${summary.avgNewSessions.toFixed(1)}
                            </span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Dataset Size</span>
                            <span class="metric-value">
                                \${summary.currentSize ? summary.currentSize.jsonSize.toFixed(1) + ' MB' : 'N/A'}
                            </span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Total Sessions</span>
                            <span class="metric-value">
                                \${summary.currentSize ? summary.currentSize.totalSessions.toLocaleString() : 'N/A'}
                            </span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Missing Weeks</span>
                            <span class="metric-value \${summary.totalMissingWeeks > 0 ? 'warning' : 'success'}">
                                \${summary.totalMissingWeeks.toFixed(1)} weeks
                            </span>
                        </div>
                    </div>
                    
                    \${recentUploadsHtml}
                </div>
                
                <style>
                .processing-trends-content {
                    margin-top: 20px;
                }
                
                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-bottom: 25px;
                }
                
                .metric-item {
                    display: flex;
                    flex-direction: column;
                    padding: 15px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border-left: 4px solid #007bff;
                }
                
                .metric-label {
                    font-size: 0.9em;
                    color: #666;
                    margin-bottom: 5px;
                }
                
                .metric-value {
                    font-size: 1.3em;
                    font-weight: bold;
                    color: #333;
                }
                
                .metric-value.success { color: #28a745; }
                .metric-value.warning { color: #ffc107; }
                .metric-value.error { color: #dc3545; }
                
                .gaps-section, .recent-uploads {
                    margin: 20px 0;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 8px;
                }
                
                .gaps-section h4, .recent-uploads h4 {
                    margin: 0 0 15px 0;
                    color: #333;
                }
                
                .gap-item, .upload-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px;
                    margin: 5px 0;
                    background: white;
                    border-radius: 5px;
                    border-left: 3px solid #ffc107;
                }
                
                .upload-item {
                    flex-direction: column;
                    align-items: stretch;
                    border-left-color: #28a745;
                }
                
                .upload-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 5px;
                }
                
                .upload-stats {
                    display: flex;
                    gap: 15px;
                    font-size: 0.9em;
                    color: #666;
                }
                
                .gap-duration {
                    font-weight: bold;
                    color: #dc3545;
                }
                
                .upload-status {
                    font-size: 1.2em;
                }
                
                .upload-user {
                    font-size: 0.9em;
                    color: #666;
                }
                
                @media (max-width: 768px) {
                    .metrics-grid {
                        grid-template-columns: 1fr 1fr;
                    }
                    
                    .gap-item {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                    
                    .upload-header {
                        flex-wrap: wrap;
                        gap: 10px;
                    }
                }
                </style>
            \`;
            
            container.innerHTML = html;
        }
        
        // Load missing data analysis
        async function loadMissingDataAnalysis() {
            try {
                const response = await fetch('/api/processing-metrics');
                const data = await response.json();
                
                console.log('Missing data analysis: Processing metrics loaded successfully');
                
                // Extract historical gaps from the data
                const analysis = analyzeProcessingTrends(data);
                displayMissingDataAnalysis(analysis.historicalGaps);
                
                // Hide loading spinner
                document.getElementById('missing-data-loading').style.display = 'none';
                document.getElementById('missing-data-container').style.display = 'block';
            } catch (error) {
                console.error('Error loading missing data analysis:', error);
                document.getElementById('missing-data-loading').innerHTML = '<p>Error loading missing data analysis</p>';
            }
        }
        
        async function calculateMissingDays() {
            try {
                // Fetch the full dataset with precomputed analytics
                const response = await fetch('/api/download/dataset.json');
                const data = await response.json();
                
                console.log('Dataset structure:', data);
                
                if (!data.precomputed || !data.precomputed.dailySummaries) {
                    console.log('No precomputed dailySummaries found');
                    return { totalMissingDays: 0, explanation: 'Dataset not available' };
                }
                
                const dailySummaries = data.precomputed.dailySummaries;
                console.log('Daily summaries count:', dailySummaries.length);
                
                if (dailySummaries.length === 0) {
                    return { totalMissingDays: 0, explanation: 'No data available' };
                }
                
                // Get date range from daily summaries
                const dates = dailySummaries.map(d => new Date(d.date)).sort((a, b) => a - b);
                const startDate = dates[0];
                const endDate = dates[dates.length - 1];
                
                console.log('Date range:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);
                
                // Calculate total days in range
                const totalDaysInRange = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
                
                // Count days with data (including days with 0 sessions)
                const daysWithData = dailySummaries.length;
                
                // Missing days = days not represented in dataset at all
                const missingDays = totalDaysInRange - daysWithData;
                
                // Count days with no activity (sessions = 0)
                const daysWithNoActivity = dailySummaries.filter(d => d.sessions === 0).length;
                
                // Total missing days = days not in dataset + days with no cat flap activity
                const totalMissingDays = missingDays + daysWithNoActivity;
                
                console.log('Missing days calculation:', {
                    totalDaysInRange,
                    daysWithData,
                    missingDays,
                    daysWithNoActivity,
                    totalMissingDays
                });
                
                return {
                    totalMissingDays: totalMissingDays,
                    missingFromDataset: missingDays,
                    daysWithNoActivity: daysWithNoActivity,
                    totalDaysInRange: totalDaysInRange,
                    daysWithData: daysWithData
                };
                
            } catch (error) {
                console.error('Error calculating missing days:', error);
                return { totalMissingDays: 0, explanation: 'Error calculating missing days' };
            }
        }
        
        async function displayMissingDataAnalysis(historicalGaps) {
            const container = document.getElementById('missing-data-container');
            
            // Calculate missing days from dataset
            const missingDaysData = await calculateMissingDays();
            
            let html = '';
            if (historicalGaps.length > 0) {
                html = \`
                    <div class="missing-data-content">
                        <h4>📅 Missing Report Weeks</h4>
                        <div class="missing-data-summary">
                            <p><strong>Total missing weeks:</strong> \${historicalGaps.reduce((total, gap) => total + gap.gap_details.weeks_missing, 0).toFixed(1)} weeks</p>
                            <p><strong>Impact:</strong> These gaps represent periods where no weekly activity reports were uploaded to the system.</p>
                        </div>
                        <div class="gaps-list">
                            \${historicalGaps.map(gap => {
                                const details = gap.gap_details;
                                return \`
                                    <div class="gap-item">
                                        <span class="gap-duration">\${details.weeks_missing} weeks</span>
                                        <span class="gap-range">\${details.gap_start_date} to \${details.gap_end_date}</span>
                                        <span class="gap-days">(\${details.days_missing} days)</span>
                                    </div>
                                \`;
                            }).join('')}
                        </div>
                        
                        <h4 style="margin-top: 30px;">📊 Missing Report Days</h4>
                        <div class="missing-data-summary">
                            <p><strong>Total missing days:</strong> \${missingDaysData.totalMissingDays} days</p>
                            <p><strong>Impact:</strong> These gaps represent days where the cat flap was not used, or activity reports were downloaded late.</p>
                        </div>
                    </div>
                    
                    <style>
                    .missing-data-content {
                        margin-top: 20px;
                    }
                    
                    .gaps-list {
                        margin: 15px 0;
                    }
                    
                    .gap-item {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 10px 15px;
                        margin: 8px 0;
                        background: #fff3cd;
                        border: 1px solid #ffeaa7;
                        border-radius: 6px;
                        border-left: 4px solid #f39c12;
                    }
                    
                    .gap-duration {
                        font-weight: bold;
                        color: #e67e22;
                        min-width: 80px;
                    }
                    
                    .gap-range {
                        flex: 1;
                        text-align: center;
                        font-family: monospace;
                        color: #333;
                    }
                    
                    .gap-days {
                        color: #666;
                        font-size: 0.9em;
                        min-width: 80px;
                        text-align: right;
                    }
                    
                    .missing-data-summary {
                        margin-top: 20px;
                        padding: 15px;
                        background: #f8f9fa;
                        border-radius: 6px;
                        border-left: 4px solid #007bff;
                    }
                    
                    .missing-data-summary p {
                        margin: 8px 0;
                        color: #333;
                    }
                    </style>
                \`;
            } else {
                html = \`
                    <div class="missing-data-content">
                        <div class="no-gaps">
                            <h4>✅ Complete Report Week Coverage</h4>
                            <p>No missing report weeks detected. All expected weekly PDF reports have been successfully uploaded and processed.</p>
                        </div>
                        
                        <h4 style="margin-top: 30px;">📊 Missing Report Days</h4>
                        <div class="missing-data-summary">
                            <p><strong>Total missing days:</strong> \${missingDaysData.totalMissingDays} days</p>
                            <p><strong>Impact:</strong> These gaps represent days where the cat flap was not used, or activity reports were downloaded late.</p>
                        </div>
                    </div>
                    
                    <style>
                    .missing-data-content {
                        margin-top: 20px;
                    }
                    
                    .no-gaps {
                        text-align: center;
                        padding: 30px;
                        background: #d4edda;
                        border: 1px solid #c3e6cb;
                        border-radius: 6px;
                        color: #155724;
                    }
                    
                    .missing-data-summary {
                        margin-top: 20px;
                        padding: 15px;
                        background: #f8f9fa;
                        border-radius: 6px;
                        border-left: 4px solid #007bff;
                    }
                    
                    .missing-data-summary p {
                        margin: 8px 0;
                        color: #333;
                    }
                    </style>
                \`;
            }
            
            container.innerHTML = html;
        }
    </script>
</body>
</html>`;
}