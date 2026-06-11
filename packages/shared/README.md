# Shared Package

Browser and Node.js client SDK used by web, desktop, terminal, and VS Code surfaces.

**Entry:** `packages/shared/src/api.js`

## Usage

```javascript
import { devLogin, createSession, streamSessionEvents } from "@codeforge/shared";

const { access_token } = await devLogin("http://127.0.0.1:8000", "dev-user");
const session = await createSession("http://127.0.0.1:8000", access_token, { title: "My session" });

for await (const event of streamSessionEvents("http://127.0.0.1:8000", access_token, session.session_id)) {
  console.log(event);
}
```

**Auth:** Pass `access_token` as the `token` argument on authenticated helpers. Base URL defaults to `process.env.CODEFORGE_API_BASE_URL` or `http://127.0.0.1:8000`.

**SSE streams:** `streamSessionEvents`, `streamShellCommand`, `streamTeamEvents`, `streamRemoteChannelEvents` are async generators.

## Exported functions by domain

### Auth and sessions

`devLogin`, `listSessions`, `createSession`, `forkSession`, `listMessages`, `sendMessage`, `streamSessionEvents`

### Proposals and files

`listProposals`, `getProposal`, `decideProposal`, `getFilePreview`, `getFileContent`, `applyFile`

### Code mode — git, shell, workflows

`getGitStatus`, `getGitDiff`, `getGitLog`, `stageGitFiles`, `commitGitChanges`, `branchGitRepo`, `listGitWorktrees`, `createGitWorktree`, `getGitMergeAssist`, `getGitConflictGuide`, `applyGitConflictAssist`, `streamShellCommand`, `runAgentLoop`, `compactWorkflow`, `ultrareviewWorkflow`, `createWorkflowPlan`, `executeWorkflowPlan`, `rollbackWorkflowPlan`

### Taste (Phase 7)

`getTasteRules`, `getTasteStats`, `exportTaste`, `importTaste`

### Skills and preferences (Phases 7, 10)

`listSkills`, `getAgentPreferences`, `updateAgentPreferences`

### RTK (Phase 8)

`getRtkStatus` — toggle via `updateAgentPreferences({ rtk_enabled: true })`

### Memory (Phase 8)

`listMemories`, `searchMemory`, `saveMemory`, `exportMemory`, `getSupermemoryStatus`, `searchSupermemory`, `saveSupermemory`

### Cowork (Phases 4, 9)

`createCoworkPlan`, `listCoworkPlans`, `runCoworkPlan`, `listCoworkRuns`, `createCoworkJob`, `listCoworkJobs`, `toggleCoworkJob`, `extractCoworkData`, `scrapeCoworkData`, `listCoworkExtractions`, `getCoworkReliability`, `getCoworkReliabilityHistory`

### Team and orgs

`createTeamWorkspace`, `listTeamWorkspaces`, `addTeamWorkspaceMember`, `createTeamDelegation`, `listTeamDelegations`, `executeTeamDelegation`, `approveTeamDelegationStep`, `listTeamAuditLog`, `createTeamStyleGuide`, `listTeamStyleGuides`, `updateTeamStyleGuide`, `createOrganization`, `listOrganizations`, `addOrganizationMember`, `linkWorkspaceOrg`, `upgradeOrganizationPlan`, `createWorkspaceSessionGrant`, `listWorkspaceSessionGrants`, `createSessionShare`, `resolveSessionShare`, `exportSession`, `streamTeamEvents`

### Projects, context, MCP

`rebuildProjectKnowledge`, `uploadProjectKnowledge`, `getProjectKnowledge`, `queryProjectKnowledge`, `createContextPack`, `listContextPacks`, `attachContextPack`, `getSessionContext`, `createMcpConnector`, `listMcpConnectors`, `toggleMcpConnector`, `invokeMcpConnector`

### Billing and usage

`getUsageSummary`, `listBillingPlans`, `getBillingContext`, `getBillingSubscription`, `createBillingOrder`, `verifyBillingPayment`

### Evals and deploy gates

`getSynthesisRolloutStatus`, `getSynthesisRolloutPlan`, `getSynthesisRolloutValidation`, `getRoutingBenchmark`, `getQualityBenchmark`, `getQualityBenchmarkTrends`, `getRoutingBenchmarkTrends`

### Remote channels and artifacts

`createRemoteChannel`, `listRemoteChannels`, `pairRemoteChannel`, `pushRemoteChannelEvent`, `streamRemoteChannelEvents`, `listSessionArtifacts`, `getSessionArtifact`, `sessionArtifactPreviewUrl`, `createAgentTemplate`, `listAgentTemplates`, `deleteAgentTemplate`, `composeAgentTemplate`

### OIDC

`exchangeOidcToken`, `getOidcConfig`, `getOidcAuthorizeUrl`, `completeOidcCallback`, `getOidcDiscovery`

## Related docs

- [docs/API.md](../../docs/API.md) — full endpoint reference
- [DEPLOYMENT_RUNBOOK.md](../../DEPLOYMENT_RUNBOOK.md) — feature verification
