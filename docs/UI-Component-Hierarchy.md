# ReqAI – UI Component Hierarchy & Design System

**Version:** 1.0.0  
**Author:** UI/UX Design  
**Last Updated:** 2025

---

## Design System Tokens

### Color Palette

```
Light Mode:
  Background Primary:   #ffffff
  Background Surface:   #f8f9fa
  Background Elevated:  #f1f3f5
  Border:               #e5e7eb
  Text Primary:         #0d1117
  Text Secondary:       #57606a
  Accent Blue:          #2563eb
  Accent Purple:        #7c3aed
  Success:              #16a34a
  Warning:              #d97706
  Error:                #dc2626
  Info:                 #0891b2

Dark Mode:
  Background Primary:   #0d1117
  Background Surface:   #161b22
  Background Elevated:  #1c2128
  Border:               #30363d
  Text Primary:         #e6edf3
  Text Secondary:       #8b949e
  Accent Blue:          #58a6ff
  Accent Purple:        #a78bfa
  Success:              #3fb950
  Warning:              #d29922
  Error:                #f85149
  Info:                 #39c5cf
```

### Typography Scale

```
Display:    32px / 700 / -0.02em
H1:         24px / 700 / -0.01em
H2:         20px / 600 / -0.01em
H3:         16px / 600 / 0
Body1:      15px / 400 / 0
Body2:      14px / 400 / 0
Caption:    12px / 400 / 0.01em
Label:      11px / 600 / 0.06em / uppercase
```

### Spacing & Shape

```
Spacing Unit:    8px
Border Radius:   sm: 4px | md: 8px | lg: 12px | xl: 16px
Elevation:       none | sm (0 1px 3px) | md (0 4px 12px) | lg (0 8px 24px)
Sidebar Width:   260px (expanded) | 64px (collapsed)
TopBar Height:   64px
```

---

## Page Layout Structure

```
AppShell
├── TopBar (fixed, 64px)
│   ├── HamburgerMenuButton
│   ├── AppLogo
│   ├── GlobalSearch
│   ├── NotificationBell
│   ├── ThemeToggle (Light/Dark)
│   └── UserAvatarMenu
│       ├── UserInfo
│       ├── MenuItem: Profile
│       ├── MenuItem: Settings
│       └── MenuItem: Logout
│
├── Sidebar (fixed left, 260px / collapsible to 64px)
│   ├── NavItem: Dashboard          /dashboard
│   ├── NavItem: Requirement Analyzer /analyzer
│   ├── NavItem: History            /history
│   ├── NavItem: Saved Analysis     /saved
│   ├── Divider
│   ├── NavItem: Settings           /settings
│   └── SidebarFooter (version, collapse button)
│
└── MainContent (scrollable, margin-left: 260px)
    └── <PageComponent />
```

---

## Component Hierarchy — All Pages

---

### 1. LoginPage `/login`

```
LoginPage
└── AuthLayout
    ├── AuthBackground (gradient/pattern)
    └── AuthCard (centered, max-width 440px)
        ├── AppLogo (large, centered)
        ├── WelcomeText
        │   ├── Heading: "Welcome back"
        │   └── Subtext: "Sign in to ReqAI"
        ├── LoginForm
        │   ├── EmailField (AppTextField)
        │   ├── PasswordField (AppTextField + show/hide toggle)
        │   ├── RememberMeCheckbox
        │   ├── ForgotPasswordLink
        │   └── SubmitButton ("Sign In")
        ├── DividerWithText ("or continue with")
        ├── SSOButtonGroup
        │   ├── GoogleSSOButton
        │   └── MicrosoftSSOButton
        └── RegisterLink ("Don't have an account? Sign up")
```

---

### 2. DashboardPage `/dashboard`

```
DashboardPage
├── PageHeader
│   ├── PageTitle: "Dashboard"
│   ├── PageSubtitle: "Good morning, [Name]"
│   └── QuickActionButton: "New Requirement"
│
├── StatsRow (4 StatCards in grid)
│   ├── StatCard: Total Requirements
│   ├── StatCard: Analyzed Today
│   ├── StatCard: Open Risks
│   └── StatCard: Projects Active
│
├── ContentGrid (2-column)
│   ├── RecentRequirementsCard
│   │   ├── CardHeader + "View All" link
│   │   └── RequirementListItem × N
│   │       ├── RequirementTitle
│   │       ├── ProjectBadge
│   │       ├── StatusChip
│   │       └── TimeAgo
│   │
│   └── RightColumn
│       ├── ComplexityDistributionCard
│       │   ├── CardHeader
│       │   └── ComplexityDonutChart
│       │       ├── Legend: Low / Medium / High / Very High
│       │       └── CenterLabel (total analyzed)
│       │
│       └── RecentActivityCard
│           ├── CardHeader
│           └── ActivityFeedItem × N
│               ├── ActivityIcon
│               ├── ActivityDescription
│               └── TimeAgo
│
└── ProjectsOverviewCard
    ├── CardHeader + "View All" link
    └── ProjectRow × N
        ├── ProjectName
        ├── ProgressBar (analyzed / total)
        ├── RiskBadge
        └── LastActivityDate
```

---

### 3. RequirementAnalyzerPage `/analyzer`

```
RequirementAnalyzerPage
├── PageHeader
│   ├── PageTitle: "Requirement Analyzer"
│   └── BreadcrumbNav
│
├── AnalyzerLayout (2-panel, resizable)
│   │
│   ├── LeftPanel: InputPanel (40% width)
│   │   ├── PanelHeader: "Input"
│   │   │
│   │   ├── ProjectSelector (Autocomplete dropdown)
│   │   ├── RequirementTitleField
│   │   ├── RequirementTypeSelector (Functional / NFR / Business / Technical)
│   │   ├── PrioritySelector (Low / Medium / High / Critical)
│   │   │
│   │   ├── InputModeTabs
│   │   │   ├── Tab: "Type / Paste"
│   │   │   └── Tab: "Upload File"
│   │   │
│   │   ├── [Type Mode] RequirementTextArea
│   │   │   ├── TextArea (min 200px, auto-grow)
│   │   │   ├── CharacterCounter
│   │   │   └── ClearButton
│   │   │
│   │   ├── [Upload Mode] FileUploadZone
│   │   │   ├── DropZoneArea (drag & drop)
│   │   │   ├── AcceptedFormats: .txt .md .pdf
│   │   │   └── UploadedFileChip (when file selected)
│   │   │
│   │   ├── TagsInput (multi-chip input)
│   │   │
│   │   └── ActionRow
│   │       ├── SaveDraftButton (secondary)
│   │       └── AnalyzeButton (primary, with AI icon)
│   │
│   └── RightPanel: ResultPanel (60% width)
│       ├── [Empty State] AnalysisEmptyState
│       │   ├── IllustrationIcon
│       │   ├── Heading: "Ready to analyze"
│       │   └── Description
│       │
│       ├── [Loading State] AnalysisLoadingState
│       │   ├── AnimatedAIIcon
│       │   ├── ProgressSteps
│       │   │   ├── Step: "Processing requirement..."
│       │   │   ├── Step: "Generating user stories..."
│       │   │   ├── Step: "Identifying risks..."
│       │   │   └── Step: "Finalizing artifacts..."
│       │   └── CancelButton
│       │
│       └── [Result State] AnalysisResultView
│           ├── ResultHeader
│           │   ├── RequirementTitle
│           │   ├── ComplexityScoreBadge (color-coded)
│           │   ├── AIProviderBadge (model used)
│           │   ├── AnalyzedTimestamp
│           │   └── ExportMenu
│           │       ├── Export as PDF
│           │       ├── Export as Markdown
│           │       └── Export as JSON
│           │
│           └── ArtifactTabs
│               ├── Tab: Summary
│               │   └── SummaryPanel
│               │       ├── ExecutiveSummaryText
│               │       └── KeyPointsList
│               │
│               ├── Tab: User Stories
│               │   └── UserStoriesPanel
│               │       └── UserStoryCard × N
│               │           ├── StoryId
│               │           ├── RoleGoalBenefit
│               │           ├── PriorityBadge
│               │           └── CopyButton
│               │
│               ├── Tab: Acceptance Criteria
│               │   └── AcceptanceCriteriaPanel
│               │       └── CriteriaCard × N
│               │           ├── LinkedStoryId
│               │           ├── GivenWhenThenBlock
│               │           └── CopyButton
│               │
│               ├── Tab: Test Scenarios
│               │   └── TestScenariosPanel
│               │       ├── FilterRow (All / Happy / Unhappy / Edge)
│               │       └── TestScenarioCard × N
│               │           ├── ScenarioTitle
│               │           ├── TypeBadge
│               │           ├── StepsList
│               │           └── ExpectedResult
│               │
│               ├── Tab: NFRs
│               │   └── NFRPanel
│               │       └── NFRGroup × N (by category)
│               │           └── NFRItem
│               │               ├── Category (Performance / Security / Scalability)
│               │               ├── Description
│               │               └── PriorityBadge
│               │
│               ├── Tab: Risks
│               │   └── RisksPanel
│               │       ├── RiskSummaryBar (Critical / High / Medium / Low counts)
│               │       └── RiskCard × N
│               │           ├── RiskTitle
│               │           ├── SeverityBadge (color-coded)
│               │           ├── Description
│               │           └── MitigationText
│               │
│               ├── Tab: Technical Notes
│               │   └── TechnicalNotesPanel
│               │       ├── NotesText
│               │       ├── DependenciesList
│               │       └── ConsiderationsList
│               │
│               └── Tab: Missing Info
│                   └── MissingInfoPanel
│                       └── MissingInfoItem × N
│                           ├── AreaBadge
│                           ├── Question
│                           └── ImpactBadge
```

---

### 4. HistoryPage `/history`

```
HistoryPage
├── PageHeader
│   ├── PageTitle: "Analysis History"
│   └── ExportAllButton
│
├── FilterBar
│   ├── SearchInput (by requirement title)
│   ├── ProjectFilter (multi-select)
│   ├── DateRangePicker
│   ├── StatusFilter (Analyzed / Queued / Failed)
│   └── ClearFiltersButton
│
├── HistoryTable
│   ├── TableHeader
│   │   ├── Col: Requirement Title (sortable)
│   │   ├── Col: Project
│   │   ├── Col: Complexity
│   │   ├── Col: Risks Found
│   │   ├── Col: Analyzed By
│   │   ├── Col: Date (sortable)
│   │   └── Col: Actions
│   │
│   └── HistoryTableRow × N
│       ├── RequirementTitleLink
│       ├── ProjectBadge
│       ├── ComplexityChip (color-coded)
│       ├── RiskCountBadge
│       ├── UserAvatar + Name
│       ├── DateTimeLabel
│       └── RowActions
│           ├── ViewAnalysisButton
│           ├── ReAnalyzeButton
│           └── SaveButton (save to Saved Analysis)
│
└── TablePagination
    ├── RowsPerPageSelector
    └── PageNavigator
```

---

### 5. SavedAnalysisPage `/saved`

```
SavedAnalysisPage
├── PageHeader
│   ├── PageTitle: "Saved Analysis"
│   └── HeaderActions
│       ├── ViewToggle (Grid / List)
│       └── SortSelector
│
├── FilterBar
│   ├── SearchInput
│   ├── ProjectFilter
│   ├── TagFilter
│   └── ComplexityFilter
│
├── [Grid View] SavedAnalysisGrid
│   └── SavedAnalysisCard × N
│       ├── CardHeader
│       │   ├── RequirementTitle
│       │   └── BookmarkIcon (filled)
│       ├── ProjectBadge
│       ├── ComplexityBadge
│       ├── RiskSummaryChips (Critical N / High N)
│       ├── ArtifactCountRow
│       │   ├── StoriesCount
│       │   ├── TestsCount
│       │   └── NFRsCount
│       ├── SavedDate
│       └── CardActions
│           ├── ViewButton
│           ├── ExportButton
│           └── RemoveButton
│
└── [List View] SavedAnalysisList
    └── SavedAnalysisListRow × N
        ├── RequirementTitle
        ├── ProjectBadge
        ├── ComplexityChip
        ├── SavedDate
        └── RowActions (View / Export / Remove)
```

---

### 6. SettingsPage `/settings`

```
SettingsPage
├── PageHeader
│   └── PageTitle: "Settings"
│
├── SettingsLayout (sidebar nav + content)
│   ├── SettingsNav (left, 220px)
│   │   ├── NavItem: Profile
│   │   ├── NavItem: AI Configuration
│   │   ├── NavItem: Notifications
│   │   ├── NavItem: Appearance
│   │   ├── NavItem: Security
│   │   └── NavItem: Team (Admin only)
│   │
│   └── SettingsContent (right, flex-1)
│       │
│       ├── [Profile] ProfileSettings
│       │   ├── AvatarUpload
│       │   ├── FirstNameField
│       │   ├── LastNameField
│       │   ├── EmailField (read-only)
│       │   ├── RoleBadge (read-only)
│       │   └── SaveButton
│       │
│       ├── [AI Config] AIConfigSettings
│       │   ├── ProviderSelector (OpenAI / Azure / Anthropic / Watsonx)
│       │   ├── APIKeyField (masked)
│       │   ├── ModelSelector
│       │   ├── TemperatureSlider
│       │   ├── MaxTokensField
│       │   ├── TestConnectionButton
│       │   └── SaveButton
│       │
│       ├── [Notifications] NotificationSettings
│       │   ├── ToggleRow: Analysis complete (in-app)
│       │   ├── ToggleRow: Analysis complete (email)
│       │   ├── ToggleRow: High risk detected
│       │   └── SaveButton
│       │
│       ├── [Appearance] AppearanceSettings
│       │   ├── ThemeModeSelector (Light / Dark / System)
│       │   ├── AccentColorPicker
│       │   └── FontSizeSelector
│       │
│       ├── [Security] SecuritySettings
│       │   ├── ChangePasswordForm
│       │   ├── ActiveSessionsTable
│       │   └── RevokeAllSessionsButton
│       │
│       └── [Team] TeamSettings (Admin only)
│           ├── InviteUserForm
│           └── TeamMembersTable
│               └── MemberRow × N
│                   ├── Avatar + Name + Email
│                   ├── RoleSelector
│                   └── RemoveButton
```

---

## Shared Component Library

### Atoms (Primitive Components)

```
components/common/
├── AppButton          — variant: contained|outlined|text; size: sm|md|lg; loading state
├── AppTextField       — label, error, helper, prefix/suffix, character count
├── AppSelect          — single/multi select with search
├── AppChip            — variant: filled|outlined; color semantic mapping
├── AppBadge           — numeric badge, dot indicator
├── AppAvatar          — initials fallback, size variants
├── AppTooltip         — placement variants, rich content
├── AppDivider         — horizontal/vertical, with label
├── AppSwitch          — controlled toggle
├── AppCheckbox        — indeterminate state
└── AppSkeleton        — shape: text|rect|circle; animation: pulse|wave
```

### Molecules (Composite Components)

```
├── StatusChip         — maps RequirementStatus enum → color + label
├── ComplexityBadge    — Low/Medium/High/Very High → color scale
├── SeverityBadge      — Low/Medium/High/Critical → traffic-light colors
├── UserAvatarLabel    — avatar + name + optional role
├── SearchBar          — debounced, with clear button
├── FilterChipGroup    — multi-select chip group
├── EmptyState         — icon + heading + description + optional CTA
├── ErrorState         — icon + message + retry button
├── LoadingSpinner     — centered, with optional label
├── PageHeader         — title + subtitle + action slot
├── BreadcrumbNav      — route-based auto breadcrumb
├── ConfirmDialog      — title + message + confirm/cancel
├── NotificationItem   — icon + text + time + read state
└── CopyButton         — icon button with success feedback
```

### Organisms (Feature Components)

```
├── AppLayout          — TopBar + Sidebar + MainContent shell
├── TopBar             — search + notifications + user menu
├── Sidebar            — nav items + collapse + active state
├── ArtifactTabs       — tabbed panel for 8 artifact types
├── UserStoryCard      — story display + copy action
├── RiskCard           — risk display with severity coloring
├── TestScenarioCard   — scenario steps + expected result
├── NFRCard            — NFR by category
├── ComplexityScoreCard — visual score with reasoning
├── FileUploadZone     — drag-and-drop + click-to-upload
├── RequirementForm    — full create/edit form
├── AnalysisLoadingState — animated steps progress
├── ExportMenu         — PDF/MD/JSON export actions
└── StatCard           — metric display with trend indicator
```

---

## Responsive Breakpoints

```
xs:  0px    — 599px    (mobile)
sm:  600px  — 899px    (tablet portrait)
md:  900px  — 1199px   (tablet landscape / small desktop)
lg:  1200px — 1535px   (desktop)
xl:  1536px+           (large desktop)

Responsive Behaviour:
  Sidebar: Desktop: fixed visible | Tablet: overlay drawer | Mobile: bottom sheet
  TopBar:  Desktop: full | Mobile: logo + hamburger only
  Grid:    4 cols → 2 cols → 1 col
  Analyzer: 2-panel side-by-side → stacked tabs on mobile
```
