This zip restores the files that were missing/stale in RewardWise-zoe compared with the earlier FlightAPI/mock work and latest frontend patches.

Includes:
- Search loading experience + map data/types + home page wiring
- Frontend package dependency updates for the route map
- PM-style VerdictCard redesign
- Backend FlightAPI/SerpAPI mock-data switch files
- FlightAPI + SerpAPI mock JSON fixtures
- Related backend tests

Important:
- This zip intentionally includes complete replacement files for page.tsx, package.json, package-lock.json, VerdictCard.tsx, and pricing_service.py. Review `git diff` before committing.
- Keep your local backend env as mock if testing locally:
  CASH_PRICE_MODE=mock
  MOCK_CASH_PRICE_PROVIDER=flightapi
- Keep production Render env live SerpAPI if testers are using it:
  CASH_PRICE_MODE=live
  CASH_PRICE_PROVIDER=serpapi
