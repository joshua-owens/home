# Home Projects & Expenses Tracker

A self-hosted household app for tracking homeowner projects, contractor quotes, expenses, and home inventory for one shared household.

## Language

**Project**:
A discrete piece of homeowner work (e.g. "install mini split in addition") tracked from idea through completion.
_Avoid_: Job, task

**Backlog**:
The independently ranked list of projects with status `idea` or `on_hold`.
_Avoid_: Wishlist, ideas list

**Active**:
The independently ranked list of projects with status `researching`, `quoting`, or `in_progress`. A project moving from Backlog to Active is appended to the bottom of the Active ranking.
_Avoid_: In-flight, live

**Priority rank**:
A project's position within its own list (Backlog or Active). Ranks in the two lists are independent of each other.

**Quote**:
A price offer from a specific company for a specific project, with scope, validity date, and status (pending / accepted / declined). A project may have multiple accepted quotes covering different scopes; expected project cost is the sum of accepted quotes. Declined quotes are hidden from default view but never deleted, and can be returned to pending or accepted later. A quote past its valid-until date is displayed as "expired" (a derived state, not a status).
_Avoid_: Estimate, bid; "rejected" for declined
