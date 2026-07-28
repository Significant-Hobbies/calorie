## ADDED Requirements

### Requirement: Bounded meal-timing analysis
The system SHALL derive meal-timing insights from timestamped food entries for
the selected 7-day or 30-day trend range and SHALL expose the number of logged
days and entries used.

#### Scenario: Logged range
- **WHEN** at least two local dates contain food entries
- **THEN** the system shows timing insights calculated only from those logged dates

#### Scenario: Unlogged date
- **WHEN** a date in the selected range has no food entries
- **THEN** the system excludes that date from timing averages and does not treat it as zero intake

### Requirement: Transparent eating rhythm
The system SHALL show the typical first food time, typical last food time, and
average eating-window duration using timezone-aware entry grouping.

#### Scenario: Multiple entries per day
- **WHEN** a logged date contains two or more food entries
- **THEN** its first-to-last duration contributes to the average eating window

#### Scenario: Midnight-adjacent clock times
- **WHEN** clock times fall on opposite sides of midnight across logged dates
- **THEN** the system uses a circular clock average rather than a linear noon-biased average

### Requirement: Time-band distribution
The system SHALL describe calorie distribution across visibly named time bands
and SHALL identify the time band containing the largest protein share.

#### Scenario: Food throughout the day
- **WHEN** entries occur before noon, from noon to 5 pm, and after 5 pm
- **THEN** the system shows each band's calorie share and names the leading protein band

### Requirement: Food and routine observations
The system SHALL identify the most frequently logged food and compare the last
food time with the saved sleep routine without presenting medical advice.

#### Scenario: Repeated food
- **WHEN** the same food name or food identifier appears more than once
- **THEN** the system shows its name, entry count, and typical logged time as an observed pattern

#### Scenario: Food near sleep routine
- **WHEN** a logged date's last food falls within two clock hours of the saved sleep routine
- **THEN** the system counts that date neutrally, shows the estimated sleep time and direction of
  the comparison, and does not call the behavior good or bad

### Requirement: Sparse and careful interpretation
The system SHALL provide a helpful sparse-data state below two logged days and
SHALL state that the analysis is observational.

#### Scenario: One logged day
- **WHEN** fewer than two dates contain food entries
- **THEN** the system asks for another logged day instead of presenting a timing pattern

#### Scenario: Full analysis
- **WHEN** timing insights are shown
- **THEN** the system states that missing days are excluded and the patterns do not establish cause and effect
