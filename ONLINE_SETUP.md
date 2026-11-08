# Connect the online duel

The configured project is `xsikgagwivfhmzlymdyd`. Its game tables, ranking view and active `fw-duel` function were verified at release. For this project, proceed to **Play a two-account match** below. The installation steps are provided for rebuilding the backend or using a new project.

1. Open the project's **SQL Editor**, start a new query, paste the entire contents of **`supabase/setup.sql`**, and run it. The script runs in a transaction and can be rerun.
2. Enable **Email** as an authentication provider. If email confirmation is enabled, set the Auth Site URL to the HTTPS address where you host the game. Players confirm the email, return to the game, and sign in with their password.
3. Deploy the included Edge Function named **`fw-duel`**. With the Supabase CLI installed, run the commands below from the extracted `function-wars` directory. The shared engine bundle is already included.

```sh
supabase login
supabase link --project-ref xsikgagwivfhmzlymdyd
supabase functions deploy fw-duel --project-ref xsikgagwivfhmzlymdyd --no-verify-jwt
```

The function checks each bearer token with Supabase Auth's user endpoint itself; an unauthenticated request returns 401. It reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the hosted function environment. Keep the service role key in the function environment. The frontend uses only the publishable key.

| Database object | Contents and access |
| --- | --- |
| `fw_profiles` | Pilot UUID, name and match totals. Signed-in players can read profiles and edit their own name. |
| `fw_arsenals` | One JSON backup per player. Row policies restrict access to its owner. |
| `fw_rooms` | Invite code, participants, selected rules, current match, version and retry IDs. Only the server can access this table. |
| `fw_ladder` | World ranking view over completed matches. Three points per win, one per draw; wins break points ties. Players with matching records share a rank. |

## Play a two-account match

1. Open the hosted game in two browsers or browser profiles. Choose **Duel Arena → Online room** in both. Create or sign in to separate accounts, choose each pilot's name, then **Save profile**.
2. On the host device, choose terrain, refill interval and weapon restrictions. Click **Create room**. Give the twelve-character room code to the second pilot.
3. On the second device, enter the code and click **Join / reconnect**. Both pilots choose their own chassis before joining. The clock begins when the guest joins. Each account controls only its own tank. If a tab reloads, sign in to the same account and enter the same room code. **Last room code** fills it on the same browser.
4. Finish the match or concede. Open **World ranking** on the account panel. A database trigger updates the result once, in the same transaction as match completion.
5. Use **Weapon Library → Cloud arsenal** to back up local weapons or restore them. Backup replaces that account's cloud snapshot. Restore merges by weapon ID and keeps the newest modification. Imported expressions are revalidated on restore.

## Hosting and operation

- Serve the contents of `dist/` over HTTPS for shared online play. Use `PLAY.html` for standalone local play.
- The server compiles each shot, checks the caller, charges energy, enforces bans, resolves collisions and serializes simultaneous updates with a version check. Clients poll snapshots about every 0.7 seconds plus request latency, and animate flight between snapshots. Polling uses Edge Function invocations while rooms are open. Short animations can finish between online snapshots.
- Match time advances from the server clock. Refreshing or hiding a tab does not pause the duel. If both pilots disconnect, the next authenticated room request settles elapsed events and the deadline.
- The ladder ranks completed invite-room games. It does not implement public matchmaking or prevent two accounts from arranging repeated wins.
- **Room creation fails:** save a pilot profile first. A missing-table error means the SQL script has not been installed; a missing-function error means the Edge Function has not been deployed. For confirmation emails pointing to the wrong page, check the Auth Site URL.
- After editing `src/combat/live.ts` or its dependencies, run `npm run build:edge`, then redeploy `fw-duel`. Run `npm run test:online` to exercise the real SQL and Edge handler locally against two simulated signed-in accounts. Live deployment requires project-owner access.
