## Purpose

Define how an active Cut, Gain, or Recomposition cycle controls transparent, editable daily nutrition guidance.

## ADDED Requirements

### Requirement: Three top-level cycles
The system SHALL present Cut, Gain, and Recomposition as the three top-level cycle choices and SHALL persist the active choice for the current user.

#### Scenario: Switch active cycle
- **WHEN** the user changes from one cycle to another and saves the change
- **THEN** future daily guidance and cycle labels use the newly selected cycle

#### Scenario: Choose cut intensity
- **WHEN** the user selects Cut
- **THEN** the system allows the user to choose the existing gentle or steady cut intensity without presenting either intensity as a fourth cycle

### Requirement: Cycle-specific transparent guidance
The system SHALL recalculate automatic calorie and protein guidance from the active cycle and SHALL show the maintenance-relative rule used to produce the calorie range.

#### Scenario: Preview a cycle change
- **WHEN** the user selects a different cycle before saving
- **THEN** the displayed calorie range, protein range, and explanation update immediately

#### Scenario: Manual calorie override remains visible
- **WHEN** a profile has a manual calorie range and the user changes cycle
- **THEN** the manual calorie range remains in effect and the system clearly distinguishes it from automatic cycle guidance

#### Scenario: Recomposition guidance
- **WHEN** Recomposition is active and the inputs needed for an automatic estimate are available
- **THEN** the system shows maintenance-relative calorie guidance and the corresponding protein range without implying guaranteed body-composition change

### Requirement: Backward-compatible goal mapping
The system MUST interpret every previously stored loss, maintenance, and gain goal as a valid Cut, Recomposition, or Gain selection without preventing the journal from loading.

#### Scenario: Open a legacy profile
- **WHEN** an existing profile contains a supported pre-cycle goal value
- **THEN** the system opens it under the corresponding cycle and preserves its prior calculation behavior until the user changes it

### Requirement: Cycle-aware progress summary
The system SHALL summarize bounded logged history with neutral cycle context, including logged-day coverage, average calories, protein, fibre, and water, plus measured weight change when at least two check-ins exist.

#### Scenario: Review a populated trend window
- **WHEN** the user opens a 7-day or 30-day Trends view with logged food history
- **THEN** the summary identifies the active cycle and shows averages calculated from food-logged days rather than treating missing days as zero

#### Scenario: Review weight change
- **WHEN** at least two weight check-ins exist in the selected window
- **THEN** the summary reports the signed measured change in the user’s preferred unit without calling it good or bad

#### Scenario: Review sparse history
- **WHEN** fewer than two days contain food entries or fewer than two weights exist
- **THEN** the summary states the available sample and omits unsupported comparisons
