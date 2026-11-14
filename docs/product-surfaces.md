# Website, desktop companion, and downloads

Updated product direction: the user wants **a website and a desktop app**, with a
GitHub downloadable at lower priority. The bridge CLI remains an implementation
layer and a useful developer interface. None of these surfaces is implemented yet.

## Website: shared collaboration home

Own account onboarding, invitation acceptance, spaces, agent grants, subscriptions,
context history, and propagation evidence. Include a download/setup entry point
for the desktop companion when a real artifact exists; until then show honest
availability status. Never display a fake download button or successful setup.

The web dashboard is a core judging surface. It must show real source versions,
deliveries, first retrievals, reports, and test evidence with clear trust labels.

## Desktop app: local connection home

Own sign-in to the same account, local agent discovery/linking, reviewed MCP setup,
space selection, bridge status, last successful sync, and a small inbox/status view.
Link to the website for full history and administration. Closing the browser must
not stop the local bridge while its configured process is running.

Use the shared client and bridge; do not reimplement relay logic. Choose Electron,
Tauri, or another shell in an ADR based on packaging time and team experience.
No framework is selected by the placeholder workspace. Avoid bundling a separate
model or presenting the desktop app as a coding assistant.

Sign-in should open a trusted system-browser flow, with account binding and a
verified callback/device flow. Never put credentials in an unverified custom URL.
Store credentials using OS facilities or a user-only file. Renderer code must not
have unrestricted shell/Node access. Expose a small validated IPC surface.

## Delivery order

1. Working relay, CLI/MCP bridge, Deep Agents investigation, and web evidence.
2. Minimal desktop shell with sign-in/linking, connection status, and an open-web
   action. Verify on one explicitly documented OS before promising others.
3. Installer signing, auto-update, additional OS packaging, and polished onboarding.
4. Low-priority GitHub release downloads: packaged desktop/CLI artifacts and/or a
   self-host bundle, checksum, version, and install instructions.

A public GitHub source repository is distinct from downloadable release assets;
the former remains part of the hackathon submission requirements. The team has
not specified a binary format. Use a releases-based distribution plan for now.
If time runs short, demonstrate the bridge and label desktop UI unfinished rather
than sacrificing the working cross-agent proof or pretending packaging is done.

## Acceptance criteria

Website and desktop display the same account, admitted agents, and spaces. Local
linking preserves existing provider config. Sync failures and expired tokens are
visible and recoverable. No agent is auto-admitted to every space. Both surfaces
respect server-side revocation. Receiving a notification never authorizes code
execution. Download links must point to real versioned artifacts and include their
supported platform; private tokens must never be embedded in a release.
