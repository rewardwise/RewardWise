This zip restores ONLY the missing PR #49 / PR #54 work found when comparing the current branch upload against PRs #49-#54.

Included:
- PR49 home row layout fix for one-way searches.
- PR54 day-pass Stripe routes, pricing cards, paywall/entitlement helpers, user-safe messages, Zoe warm endpoint, middleware/profile/subscribe/auth updates.
- Merged home/page.tsx keeps your SearchLoadingExperience loading UI while adding PR54 day-pass logic.
- VerdictCard.tsx keeps your current PM redesign, only adding the PR54 feedback-message cleanup.
- ZoeChat.tsx keeps your current Zoe UI, only adding PR54 warm/error/message cleanup where safe.

After copying into the repo, run:
cd RewardWise_MVP0/Frontend
npm run lint
npm run build
