# Timeline

All times **IST**. **Deadline: Thu Nov 12, 2026, 12:00 PST = Fri Nov 13, 2026, 01:30 IST. Target: submit Wed Nov
11, 21:00 IST.** Owner: **P** = Padmanabhan (solo, Representative). The build plan is from [brief.md](brief.md) §10,
moved by one day for the gates, which were not run on Wed Nov 4.

From setup (Thu Nov 5, 06:00) to the deadline is about 7.8 days. US daylight saving ended Sun Nov 1, so 12:00 PT is
01:30 IST the next day.

| Date (IST) | Build | Owner | Done when |
|---|---|---|---|
| **Thu Nov 5, morning** | **Gates** ([brief.md](brief.md#2-status-and-open-gates)) | P | PayPal developer login works; **US** business + personal sandbox accounts and an app exist; Twilio account upgraded; number imported into ElevenLabs; one throwaway agent answers a call to it. Results in [field-notes.md](field-notes.md) |
| Thu Nov 5 | Gate scripts + app skeleton, DB schema, PayPal client, webhook handler | P | `scripts/sandbox/` runs hold → change → capture end to end (both `CHANGE_ORDER_MODE`s, plus over-capture, partial `final_capture`, void) and `events` fills; results logged; CI runs typecheck, lint, tests |
| Thu Nov 5 | Deploy skeleton on Render (paid web + paid Postgres) | P | Public HTTPS URL; sandbox webhook reaches it (or polling chosen) |
| Fri Nov 6 | Voice agent + server tools, rate card, `/call`, `/pay` | P | A **phone** call and a **browser** call each end with a booked job and an approved hold |
| Sat Nov 7 | `/onsite`, change-order parser, customer approval | P | A spoken change becomes an approved overage |
| Sun Nov 8 | Final capture, balance invoice, timeline | P | One job runs first ring → final capture with no manual steps |
| Mon Nov 9 | Bryntum board, demo mode ("skip the call" replay), caps, reset | P | A fresh visitor completes the demo on the hosted URL in a private window |
| **Mon Nov 9, evening** | **Feature freeze** + `hackathon-critic` | P | Review done, fix list agreed |
| Tue Nov 10 | Fixes, edge cases, screenshots, demo video (`video-edit`) | P | Video under 3:00, public on YouTube, opened logged out; screenshots in the repo; two outside people tried the demo ([judges-talk.md](judges-talk.md#what-this-changes-for-us)) |
| Wed Nov 11 | House-style README (`readme`), Devpost write-up, testing instructions; a fresh person runs the README | P | Every form field filled from [submission/story.md](submission/story.md) |
| Wed Nov 11 | Repo public (**ask the user first**) | P | Full-history secrets scan clean; licence shows in the About sidebar |
| **Wed Nov 11, by 21:00** | **Submit** | P | Page shows "Submitted"; tag `submission` pushed |
| Thu Nov 12 → Fri Nov 13, 01:30 | Buffer | P | Only fixes to the submission itself |
| Fri Nov 13 → Tue Dec 15, 21:30 | Freeze | P | No changes to `main`; demo, number, agent, DB and keys live |
| Wed Dec 2, 03:30 → Tue Dec 15, 21:30 | Judging: daily check | P | Widget and phone answer; a hold → capture completes; webhook or poll works; ElevenLabs minutes, Twilio balance and LLM spend under cap; ElevenLabs Scale plan still active (ends January) |
| ~Mon Dec 21, 22:30 or Tue Dec 22, 03:30 | Winners announced | — | Two published times ([hackathon.md](hackathon.md#discrepancies)) |

If time slips, cut in this order: Bryntum → balance invoice → refund path → phone line (keep the widget). Never cut
the change order.
