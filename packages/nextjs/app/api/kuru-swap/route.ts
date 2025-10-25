import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log("🔍 Kuru request body:", JSON.stringify(body, null, 2));
    
    // Forward the request to Kuru RPC with proper headers
    const response = await fetch("https://rpc.kuru.io/swap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Origin": "https://kuru.io",
        "Referer": "https://kuru.io/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site",
      },
      body: JSON.stringify(body),
    });

    console.log("🔍 Kuru response status:", response.status);
    console.log("🔍 Kuru response headers:", Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error("🔍 Kuru error response:", errorText);
      throw new Error(`Kuru API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("🔍 Kuru success response:", JSON.stringify(data, null, 2));
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Kuru proxy error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "Failed to get swap quote from Kuru" 
      },
      { status: 500 }
    );
  }
}
