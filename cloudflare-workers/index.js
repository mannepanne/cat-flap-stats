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
        case '/annotations':
          return await handleAnnotations(request, env);
        case '/api/annotations':
          return await handleAnnotationsApi(request, env);
        case '/api/analytics':
          return await handleAnalyticsApi(request, env);
        case '/api/circadian':
          return await handleCircadianApi(request, env);
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

// Advanced circadian rhythm analysis
async function generateCircadianAnalysis(data) {
  console.log('Generating circadian analysis, data keys:', Object.keys(data));
  const sessions = [];
  
  // Flatten all sessions with timestamps
  // Check both possible data structures
  const sessionsSource = data.sessions || data;
  console.log('Sessions source type:', typeof sessionsSource, 'length:', sessionsSource?.length);
  
  for (const report of sessionsSource || []) {
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
            font-size: 14px;
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
                        renderActogram(data.precomputed.dailySummaries, annotations);
                    })
                    .catch(error => {
                        console.warn('Error loading annotations, rendering actogram without annotations:', error);
                        renderActogram(data.precomputed.dailySummaries, []);
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
        
        function renderActogram(dailySummaries, annotations = []) {
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
                        
                        // Add interactive hover tooltip
                        marker.on('mouseenter', function(event) {
                            const tooltip = d3.select('body').append('div')
                                .attr('class', 'd3-tooltip')
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
                        })
                        .on('mouseleave', function(event) {
                            // Add small delay to allow clicking edit buttons
                            setTimeout(() => {
                                if (!event.relatedTarget || !event.relatedTarget.closest('.d3-tooltip')) {
                                    d3.selectAll('.d3-tooltip').remove();
                                }
                            }, 100);
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
            height: 500px;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            position: relative;
            background: #f8f9fa;
        }
        .overlay-actogram-container {
            width: 100%;
            height: 600px;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            overflow: auto;
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
        <h1>🐾 Cat Flap Stats - Seasonal Pattern Analysis</h1>
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
                    <h3>📈 Overlay Actogram Comparison</h3>
                    <div class="overlay-actogram-container" id="overlay-actogram">
                        <!-- D3.js overlay actogram will be rendered here -->
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
                if (!data || data.data_quality.confidence_level === 'no_data') {
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
                
                const confidenceClass = \`confidence-\${data.data_quality.confidence_level}\`;
                return \`
                    <div class="stat-card \${confidenceClass}">
                        <h3 style="color: \${seasonColors[season]}">
                            \${season.charAt(0).toUpperCase() + season.slice(1)}
                        </h3>
                        <div class="metric-value">\${data.duration_metrics.avg_daily_duration_minutes.toFixed(1)} min</div>
                        <div class="metric-label">Avg Daily Outdoor Time</div>
                        <div class="metric-sublabel">\${data.frequency_metrics.avg_daily_sessions.toFixed(1)} sessions/day</div>
                        <div class="metric-sublabel">\${data.data_quality.completeness_percent}% data completeness</div>
                        <div class="metric-sublabel confidence-\${data.data_quality.confidence_level}">
                            \${data.data_quality.confidence_level.replace('_', ' ')} confidence
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
            // For now, show a placeholder - we'll implement actual heatmap later
            const container = document.getElementById('seasonal-heatmap');
            container.innerHTML = \`
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column; gap: 1rem;">
                    <div style="font-size: 4rem;">📊</div>
                    <div style="text-align: center;">
                        <h4>Seasonal Activity Heatmap</h4>
                        <p>Visual representation of activity patterns by month and week</p>
                        <p style="color: #666; font-size: 0.9rem;">Implementation in progress</p>
                    </div>
                </div>
            \`;
        }

        function renderOverlayActogram(dailySummaries) {
            // For now, show a placeholder - we'll implement actual overlay actogram later
            const container = document.getElementById('overlay-actogram');
            container.innerHTML = \`
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column; gap: 1rem;">
                    <div style="font-size: 4rem;">📈</div>
                    <div style="text-align: center;">
                        <h4>Overlay Actogram Comparison</h4>
                        <p>Multi-season timeline overlay for direct pattern comparison</p>
                        <p style="color: #666; font-size: 0.9rem;">Implementation in progress</p>
                    </div>
                </div>
            \`;
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
            <h2>🐱 Cat Flap Stats</h2>
        </div>
        <div class="user-info">
            <a href="/dashboard" class="btn btn-secondary">Dashboard</a>
            <a href="/patterns" class="btn btn-secondary">Patterns</a>
            <a href="/circadian" class="btn btn-secondary">Circadian</a>
            <a href="/seasonal" class="btn btn-secondary">Seasonal</a>
            <span>Welcome, ${email.split('@')[0]}</span>
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