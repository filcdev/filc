# School events

A school event is one row an organizer publishes, one signup form, and a door
that lets the people who signed up in. Chronos owns the event, its questions and
its registrations; Iris owns the organizer's table and the public pages; the
scanner app (`apps/scan`) is what the helper holds at the door. The wire shapes
are in `packages/api/src/domains/events`, the handlers in
`apps/chronos/src/modules/events`, the pages in `apps/iris/src/routes`, and the
ticket mail in `packages/mail/src/templates/event-ticket.tsx` with its copy in
`packages/i18n`.

## 1. What the feature is

| Piece | Where | Who uses it |
| --- | --- | --- |
| Event, questions, banner | `POST /events`, `PUT /events/{id}/fields`, `POST /events/{id}/image` | Organizers (`events:manage`) |
| Public list and detail | `/events`, `/events/{id}` | Everyone, signed in or not |
| Student signup | `POST /events/{id}/registrations` | A signed-in student |
| Helper signup | the same endpoint with `role: helper` | A signed-in student |
| Helper decision | `POST /events/{id}/registrations/{registrationId}/decision` | Organizers (`events:manage`) |
| Withdraw a signup | `DELETE /events/{id}/registrations/{registrationId}` | The student who signed up, or an organizer |
| Guest signup | `/events/{id}/register` → `POST /events/{id}/guests` | A visitor with no account |
| Ticket | `/tickets/{ticketId}` → `GET /tickets/{ticketId}` | The visitor holding the mail |
| Organizer view | `/admin/events`, `/admin/events/{id}` | Organizers |
| Participants, statistics, export | `GET /events/{id}/registrations`, `/stats`, `/export` | Organizers |
| Door check-in | `POST /events/{id}/checkin` | Helpers (`events:checkin`), in `apps/scan` |

Registration lives in `event_registration` with one answer row per question in
`event_registration_answer`, and a guest's ticket in `event_ticket`. Everything
hangs off `event.id`, so deleting an event is what deletes its registrations —
and the delete is refused while any registration exists, because that history is
not a cascade's to decide.

## 2. The organizer flow

1. **Create the event** in `/admin/events` → *Create event*: title, category,
   rich-text description, start and end, capacity, the two grade bounds, the
   classes it is open to, and its two switches. The dialog seeds the switches
   from the category (`categoryDefaults` in `packages/api/src/domains/events/event.ts`);
   that map is a hint, never a rule the backend enforces.
2. **Add questions** in the same dialog: short text, long text, choice, number
   or checkbox, each marked required or not and aimed at any combination of the
   guest, student and helper forms (a new question starts on all three). Saving
   replaces the whole set; a question carried
   with its `id` keeps its row and therefore the answers already attached to
   it, and a question that already has answers cannot be removed — the API
   answers a conflict naming it instead.
3. **Upload a banner** (JPEG, PNG or WebP, up to 8 MiB). The object lives in S3
   and is streamed back through `GET /events/{id}/image`, so a draft's banner
   stays as hidden as the draft. Replacing or removing one leaves the row
   correct even if the object delete fails; the failure is logged, not thrown.
4. **Publish it — or draft it.** A new event is **published** unless the caller
   explicitly passes `status: 'draft'`: `events.create` falls back to
   `published`, and the dialog's own default is the same, so what an organizer
   saves is on the public list immediately. A draft is invisible to everyone
   except an organizer, and its detail read answers 404 to anyone else rather
   than admitting it exists. The `event.status` column still defaults to
   `draft`, but that is the raw-insert safety net only — the handler always
   writes a status.

The API answers the same `eventItemSchema` from every write and every read
(`toEventItem`), with `seats` and the caller's `eligibility`, so the dialog and
the public page never disagree about a row they just changed. A PATCH that only
resends the stored values writes nothing: the row, its `updatedAt` and the
activity log stay untouched.

## 3. Seats, eligibility and capacity

Capacity is event-wide and nullable; `null` means unlimited. What counts as a
seat is one line in `apps/chronos/src/modules/events/utils/seats.ts`:

| Role | Who | Takes a seat |
| --- | --- | --- |
| `participant` | a student who signed themselves up | yes |
| `visitor` | a guest, typically a parent | yes |
| `helper` | staff helping at the event | no |

`taken` counts **confirmed** rows only, so cancelling frees the seat and the row
stays behind with its answers for the record. Registering again reactivates the
same row (and, for a guest, the same ticket) instead of leaving a duplicate.

Eligibility is decided server-side by `judgeRegistration` /
`judgeGuestRegistration` against a closed list of reasons
(`eventEligibilityReasons`), which is also what the page renders. A helper has
its own judge, `judgeHelperRegistration`, described in section 4; for a
participant or a guest the rules are:

- the event must be published, and its `registrationEnabled` switch on;
- a guest also needs the event's own `guestRegistrationEnabled`, off by default;
- the registration window (`registrationOpensAt` / `registrationClosesAt`) must
  be open **now**;
- `cohortIds` is registration scope, not visibility: an empty list means every
  student, and a listed class is the only one whose students may sign up — the
  event itself is still visible to everyone;
- the grade bounds are compared against the grade parsed from the student's
  cohort label.

Anonymous callers always get `sign_in_required`, never `null`, so a client can
turn that one reason into a sign-in button. Capacity is judged under a lock:
`registrations.create` and the guest path both take the event row
(`SELECT … FOR UPDATE`), re-read the count and the rules while holding it, and
answer 409 `full` to the request that lost the race. Two parents racing for the
last seat get one registration and one conflict, never two tickets.

## 4. Helpers: the pending signup

A helper is a student who works the event — check-in, the queue — not a visitor
and not a participant. They sign up through the same
`POST /events/{id}/registrations` with `role: 'helper'` and the same signed-in
form, which shows the questions aimed at students *or* helpers; answers are
validated against that same union of audiences, so a helper-only question is
accepted for a helper and a guest-only one is not. What changes is the rules and
what happens after.

Two switches, both off by default:

- `helperRegistrationEnabled` asks whether the event takes helpers at all; with
  it off a helper signup is refused as `helper_registration_disabled`.
- `helperRegistrationSeparateWindow` chooses the window. When it is on, helpers
  use `helperRegistrationOpensAt` / `helperRegistrationClosesAt`; when it is off
  those two columns are inert and helpers open and close with everyone else.
- `helperMinGrade` / `helperMaxGrade` are the optional helper grade band. When
  either is set it governs helpers (the unset side is simply unbounded); when
  both are null the event's own `minGrade` / `maxGrade` apply to helpers too, so
  an event that is 11+ for participants is 11+ for helpers by default. A band
  with an unreadable grade refuses as `grade_unknown`; participants' bounds are
  unaffected.

`helperRegistrationWindow` (`apps/chronos/src/modules/events/utils/rules.ts`) is
that choice in one place, and `judgeHelperRegistration` judges the result. The
event's master `registrationEnabled` still gates both: turning registration off
closes the helper form too, and a helper window that closes before it opens is a
validation error, not a silent no-op. The detail
read carries `helperEligibility`, computed by the same rules, so the public page
can hide or explain the helper button without guessing; the list does not carry
it.

Helpers are not seats. `SEAT_ROLES` in `.../utils/seats.ts` is `participant` and
`visitor`, so neither a pending nor a confirmed helper changes `seats.taken`,
`remaining` or the full check — a sold-out event still takes helpers. A helper's
row starts `pending`: approving sets `confirmed`, declining sets `cancelled`, and
only the organizer's decision endpoint may do either. The stats
`byStatus.pending` counts those rows, and they are listed and exported with
everything else.

Because a pending helper never held a seat, rejecting one frees nothing:
`seats.taken` is the same before and after. The same is true of cancelling an
application, so neither direction can overbook an event.

A student withdraws their own row with `DELETE
/events/{id}/registrations/{registrationId}` whether it is `confirmed` (a
participant's place) or `pending` (a helper application). A cancelled row is not
touchable again — the same call answers 404 — and anyone else's row answers 404
too, because it is scoped by event, registration and caller. An organizer's
cancel stays the participant table's confirmed-only action; a pending
application is declined through the decision endpoint.

One row per student per event: `event_registration` is unique on
`(event_id, user_id)`, and that is the whole "no double signup" rule. A confirmed
participant cannot also be a helper (`already_registered`), a pending helper
cannot sign up again as anything (`pending_approval`), and a cancelled row is
reactivated in place with the role the new signup asks for rather than
duplicated — so a helper who was declined can come back as a participant and
keeps one row, and the other way round.

The organizer answers with `POST
/events/{id}/registrations/{registrationId}/decision` and
`{ "decision": "approve" }` or `"decline"`, gated by `events:manage`. It locks
the row and refuses with 409 anything that is not `pending`, a double-click
included, so an approval cannot be flipped by a second request.

## 5. The guest flow and the ticket

A visitor needs no account:

1. The detail page shows the guest card only while `guestRegistrationEnabled` is
   on. The form asks name and email, plus the questions whose `audiences`
   include `guest`.
2. `POST /events/{id}/guests` judges the same window and seat rules as a
   student's signup, checks the answers, writes the registration and issues the
   `event_ticket` in one transaction.
3. The ticket is mailed **after** the commit, through `sendRawEmail` and the
   `eventTicket` template, and a failed send never undoes the registration: it
   is logged and reported to Sentry, and the organizer can re-send the same code
   from the participant table (`POST …/registrations/{registrationId}/ticket`).
4. The mail carries an inline QR, the ticket link and the bare code. The QR
   payload is the ticket id and nothing else; the link is
   `${CHRONOS_BASE_URL}/tickets/{ticketId}`.
5. `/tickets/{id}` is public and answers exactly
   `{checkedInAt, code, endsAt, eventId, eventTitle, startsAt, visitorName}` — no
   email and no answers, because anyone holding the link can read it. A ticket of
   a draft event answers 404.

One address per event, enforced by a partial unique index on
`(event_id, lower(guest_email))` that is deliberately **not** scoped by status: a
cancelled guest who signs up again gets their old row and their old ticket back,
and a second address is a second visitor.

## 6. The door: check-in runbook

1. **Grant the permission.** `events:checkin` is a canonical permission in
   `packages/api/src/permissions.ts`; add it to the helper's role in
   `/admin/roles`. It is what `requireAuthorization` registers, so the roles UI
   lists it without a code change.
2. **Open the scanner.** `apps/scan` signs the helper in with the same Microsoft
   account, lists published events and takes over the camera. It serves on port
   **3003** and proxies `/api` to Chronos on 3001, so the session cookie and the
   RPC calls stay same-origin in development. Point it at the event of the day
   before the doors open.
3. **Scan**, or type the code into the manual field when the camera or the
   visitor's screen does not cooperate — the typed path is the same request as
   the scan.
4. **Read the answer.** `POST /events/{id}/checkin` answers a state, never an
   error, so a red banner always means "read this", not "the app broke":

| Status | Meaning | What the helper does |
| --- | --- | --- |
| `admitted` | first scan; `checked_in_at` is now set | let them in |
| `already_checked_in` | the code was scanned before, with the first time and who scanned it | check the name, let them in |
| `invalid` | the ticket is real but its registration is cancelled | the guest is not on the list |
| `not_found` | unknown code, malformed code, or a ticket of another event | check the event picker, then the office |

A ticket of another event answers exactly like an unknown code, so the endpoint
never confirms that a foreign ticket exists. Only the first scan writes:
`checked_in_at` and `checked_in_by` are set once, so a repeat scan is idempotent
— it changes nothing and reports the stored state.

**What the scanner reveals is an event setting.** `event.checkinDisplay` is
`minimal`, `name` (the default) or `full`. The check-in handler shapes every
outcome from it, not only an admission: `minimal` carries no name or address at
all, `name` the visitor's or registrant's name, `full` both name and email. The
API never sends a field the mode forbids, so a client cannot widen the answer,
and a cancelled ticket (`invalid`) is reduced by the same rule. The permission
is not an exemption either: an organizer holding `events:checkin` sees exactly
what a helper sees, because the setting describes the screen at the door, not
the caller.

**The answers the door shows are a second, independent setting.**
`event.checkinFields` is an ordered list of the event's question ids. A check-in
answer carries `answers: [{ fieldId, label, value }]` for exactly those
questions, taken from the registration's stored answers; a configured question
the registration left unanswered is omitted rather than printed empty, and an
answer-less registration gets `[]`. The list is validated on write (every id
must be a question of this event; unknown ids are a readable 400) and pruned in
the same transaction when `fields.replace` removes a question. Display and
fields combine freely: `minimal` with configured questions shows answers and no
identity, which is the privacy-safe configuration.

The QR payload is a credential, so the check-in path logs `eventId`,
`registrationId`, `requestId` and the outcome — never the scanned code, the
visitor's name or their email. The same rule covers the ticket mail and the
ticket read: the transport logs the subject, not the recipient.

## 7. Export

`GET /events/{id}/export` answers a CSV with one row per registration, newest
first: seven fixed columns (`name`, `email`, `class`, `role`, `status`,
`registered_at`, `checked_in_at`) and one column per custom question in the
event's position order. The header cells are those stable keys, not localized
labels — the client localizes what it shows in the spreadsheet, and the file
stays the same whatever language the organizer's browser is in.

A question labelled like a fixed column would overwrite its cell, so
`eventQuestionColumnHeaders` (`packages/api/src/domains/events/export.ts`)
suffixes the collision with ` (question)`; that function feeds both the CSV and
the Iris XLSX, so the two files keep the same columns.

`csvFile` (`apps/chronos/src/utils/csv.ts`) writes a UTF-8 BOM before the text so
Windows Excel decodes Hungarian names correctly, and RFC 4180 quoting otherwise.
The *Export* button on the event page downloads that CSV and builds the XLSX in
the browser from the same response, so the two files cannot disagree.

## 8. Known limits

- **Everything is per-event.** One row is one event; there is no series, no
  occurrence and no recurrence rule. A three-day festival is three rows or one
  row that carries the range.
- **No rooms.** `event_room` was dropped on purpose: the venue belongs in the
  description and capacity is event-wide. The URL does not accept a room and the
  dialog does not offer one.
- **Helpers are students, not a second roster.** A helper needs an account and
  leaves through the same registration row as a participant; there is no
  separate helper list, no guest helper and no helper-specific questions. An
  outside volunteer has to sign in with a school account or come in as a guest
  visitor.
- **Cohort targeting is registration scope, not visibility.** Every published
  event is listed for every visitor, anonymous included; `cohortIds` only
  decides who may sign up. That is a product decision, not an oversight.
- **Grade bounds exclude the eight bilingual cohorts.** Grade comes from the
  cohort label — the first one or two digits of `short`, then `name` — and the
  bilingual labels (`1/13.RS`, `2/14.VL`, …) name a year *and* a grade, so they
  parse as `null` and any grade bound keeps them out with `grade_unknown`. An
  event that must include them is better targeted by class.
- **Event times are naive timestamps.** `event.starts_at` / `ends_at` are
  `timestamp` without a zone, and the API carries plain `Date`s: the wall clock
  the organizer picks is stored and read back as the same wall clock, which is
  right for one school in one zone and wrong the moment a second zone is
  involved. Statistics bucket days in the school's zone
  (`CHRONOS_TIME_ZONE`), so the *counts* are zone-aware even though the *times*
  are not.
- **The events migration is one regenerated `0031`.** The feature was developed
  as an `0031`–`0034` series and squashed into a single
  `0031_fat_chat.sql` (five tables, the helper columns and grades, the door's
  display and answer settings, audience arrays and the `pending` status) before
  merge. A database that applied the earlier series already
  records index 31 as applied, so it skips the squashed `0031` and keeps the old
  tables. The local fix is to drop the stale event tables, delete their
  `drizzle.__drizzle_migrations` rows and run
  `bun run --cwd apps/chronos db:migrate` — or start from a clean dev database
  (`pg-dispo wipe`) and migrate, which is simpler.
