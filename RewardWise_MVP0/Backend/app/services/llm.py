import os
import httpx
import json

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY is not set")


async def parse_trip(message: str):

    prompt = f"""
Extract travel details from the message.

Return ONLY valid JSON.

IMPORTANT:
- Use IATA airport codes (e.g., SFO, JFK, LHR, CDG, HND)
- Convert city names to airport codes

Message: "{message}"

JSON format:
{{
  "origin": "IATA code",
  "destination": "IATA code",
  "date": "YYYY-MM-DD",
  "travelers": number,
  "cabin": "economy | business | first"
}}
"""

    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://api.openai.com/v1/responses",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4.1-mini",
                "input": prompt,
                "text": {
                    "format": {
                        "type": "json_object"
                    }
                },
            },
        )

    data = res.json()

    print("ZOE INPUT:", message)
    print("ZOE RAW:", data)

    try:
        # Preferred parsing
        if "output_text" in data:
            result = json.loads(data["output_text"])
        else:
            result = None
            for item in data.get("output", []):
                for c in item.get("content", []):
                    if "text" in c:
                        result = json.loads(c["text"])
                        break

        # basic validation
        if not result or not result.get("destination"):
            return None

        return result

    except Exception as e:
        print("ZOE PARSE ERROR:", e)
        return None