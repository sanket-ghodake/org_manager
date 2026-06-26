# Graph Report - sg-dashboard  (2026-06-26)

## Corpus Check
- 22 files · ~38,342 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 227 nodes · 332 edges · 20 communities (16 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b2f8267c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]

## God Nodes (most connected - your core abstractions)
1. `changeActiveEmployeeContext()` - 19 edges
2. `switchTab()` - 12 edges
3. `loadMyDashboard()` - 11 edges
4. `loadSubmissions()` - 11 edges
5. `db` - 6 edges
6. `loadTeamView()` - 6 edges
7. `initializeApplication()` - 6 edges
8. `loadTrashHistory()` - 6 edges
9. `getWorkingPortalUrl()` - 5 edges
10. `saveDashboardSettings()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `initDb()` --calls--> `seedDummyData()`  [EXTRACTED]
  backend/db/client.ts → test/seed-dummy-data.ts
- `checkUplineManager()` --calls--> `getWorkingPortalUrl()`  [EXTRACTED]
  backend/utils/hierarchy.ts → backend/utils/portal.ts

## Import Cycles
- None detected.

## Communities (20 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (9): createGenericElement(), createTrainingPlanElement(), getGenericBadgeStyle(), getQuarterOptions(), isQuarterPassed(), setTheme(), suggestionCache, themeObserver (+1 more)

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (9): fastify, db, initDb(), FastifyInstance, registerAuthMiddleware(), seedDummyData(), checkUplineManager(), candidates (+1 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (4): cachedUsers, lastActivityTime, openSideReviewPanel(), openSideReviewPanelById()

### Community 4 - "Community 4"
Cohesion: 0.18
Nodes (17): changeActiveEmployeeContext(), closeSideReviewPanel(), deleteDashboardPermanentAction(), deleteDeletedDashboardVersion(), focusOnEmployee(), loadDashboard(), loadTrashHistory(), openReviewModal() (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (13): dependencies, fastify, @fastify/jwt, @fastify/static, @libsql/client, description, devDependencies, @types/node (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.24
Nodes (11): closeReviewModal(), closeTimelineModal(), freezeSubmission(), loadSubmissions(), loadTeamView(), submitDashboard(), submitDirectDashboard(), submitReviewAction() (+3 more)

### Community 7 - "Community 7"
Cohesion: 0.20
Nodes (9): 1. Federated SSO Handshake, 1. System Topology, 1. Volume-Isolated Database, 2. Authentication & Data Flow, 2. User Directory Caching & Instant Search, 2. Write-Ahead Logging (WAL) Mode, 3. Resource & RAM Constraints (< 1GB RAM), 3. Storage and Scaling Strategy (+1 more)

### Community 8 - "Community 8"
Cohesion: 0.25
Nodes (8): cycleGapSeverity(), cyclePlanBadgeType(), deleteItem(), loadMyDashboard(), updateItemLinks(), updatePlanCompletedQuarter(), updatePlanStatus(), updatePlanTargetQuarter()

### Community 9 - "Community 9"
Cohesion: 0.33
Nodes (7): adjustFontScaling(), exchangeCodeForToken(), initializeApplication(), initSession(), initSideReviewResize(), redirectToSSO(), startBackgroundSync()

### Community 10 - "Community 10"
Cohesion: 0.40
Nodes (5): addQuickItem(), performBackgroundSync(), refreshActiveDashboardSilently(), updateAllSuggestions(), updateSyncStatusUI()

### Community 11 - "Community 11"
Cohesion: 0.50
Nodes (4): addToSearchHistory(), getSearchHistory(), handleHeaderSearch(), renderSearchResults()

### Community 12 - "Community 12"
Cohesion: 0.50
Nodes (4): deleteVersionAction(), loadHistoryAndVersions(), openVersionsDrawer(), saveCurrentVersion()

### Community 13 - "Community 13"
Cohesion: 0.50
Nodes (4): loadHierarchyRoot(), loadOrgExplorer(), setDirectoryCache(), toggleTeamViewMode()

### Community 14 - "Community 14"
Cohesion: 0.50
Nodes (4): saveDashboardSettings(), saveObjectiveEdit(), updateDashboardNotes(), updateProgramSetting()

### Community 15 - "Community 15"
Cohesion: 0.50
Nodes (3): Directory Structure, Setup & Running, TRR Strategy SG_Dashboard App

## Knowledge Gaps
- **29 isolated node(s):** `FastifyInstance`, `fastify`, `candidates`, `pathParts`, `cachedUsers` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `changeActiveEmployeeContext()` connect `Community 4` to `Community 3`, `Community 6`, `Community 9`, `Community 10`, `Community 11`, `Community 13`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **What connects `FastifyInstance`, `fastify`, `candidates` to the rest of the system?**
  _29 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05832147937411095 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.14039408866995073 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._