# Submission checklist

The authoritative list of everything the platform and the rules require. **P** = Padmanabhan (solo, the
Representative). Rules and sources: [../hackathon.md](../hackathon.md). Dates: [../timeline.md](../timeline.md).

**Deadline: Thu Nov 12, 2026, 12:00 PST = Fri Nov 13, 2026, 01:30 IST. Our target: Wed Nov 11, 21:00 IST.**

## Team and accounts

- [ ] **P** — registered for the hackathon on Devpost ("Join hackathon").
- [ ] **P** — PayPal developer login works; **US** sandbox business and personal accounts exist; a sandbox app's
      client ID and secret are in `.env` (never committed).
- [ ] **P** — a dedicated **judge sandbox buyer account** (US personal) created for the testing instructions.
- [ ] **P** — own parser-model key, server-side, with a hard spend cap at the provider.
- [ ] **P** — ElevenLabs agent (Scale plan, active until January 2027): `max_duration_seconds`, daily limit,
      concurrency limit set; bursting off.
- [ ] **P** — Twilio account **upgraded**, US local number imported into ElevenLabs, auto-recharge off, balance
      enough to Dec 15.
- [ ] **P** — open "Enter a submission", save a draft, copy every custom question (including the APIMatic plug-in
      question) into [story.md](story.md). By Fri Nov 6.
- [ ] Team members: n/a (solo).

## Required by the rules

- [ ] **P** — **Project** uses the PayPal developer platform (sandbox) **centrally** + an AI tool (§4; Stage One
      pass/fail checks both).
- [ ] **P** — **Repository** (§4):
  - [ ] All source, assets and instructions needed to run it; runnable from the README alone.
  - [ ] An open-source licence file that GitHub detects and shows in the About sidebar (`LICENSE`, MIT).
  - [ ] Public on GitHub, **after** a full-history secrets scan and **with the user's OK** (private until then, the
        user's decision of 2026-10-17).
  - [ ] No secret anywhere in history; `.env` ignored; the PayPal secret only on the server.
- [ ] **P** — **Text description** of features and functionality; every number traced in [claims.md](claims.md).
- [ ] **P** — **Tools**: each model and AI service named, and how it is used (overview "What to Submit").
- [ ] **P** — **Functional demo** (§4): a hosted URL that works with no keys from the judge, **or** complete setup
      instructions. Not a mockup or a static prototype.
- [ ] **P** — **Video** (§4):
  - [ ] Under 3:00, measured with `ffprobe` (target 2:30–2:45).
  - [ ] Shows the project functioning on the device it was built for.
  - [ ] Uploaded to **YouTube**, **public**, link on the form, opened logged out.
  - [ ] No third-party trademarks, copyrighted music or other material without permission.
  - [ ] English, or English subtitles.
- [ ] **P** — **Testing access** (§4 Testing):
  - [ ] Free and unrestricted for the Sponsor, Devpost and judges **until Tue Dec 15, 2026, 21:30 IST**.
  - [ ] Login credentials in the testing instructions if anything is private (the judge sandbox buyer login).
  - [ ] Demo mode works if the model cap is hit.
- [ ] **P** — **Testing instructions** pasted into the form (under ten lines): browser call, phone number, "skip the
      call" replay, judge sandbox buyer login.
- [ ] **P** — a person outside the project ran the README from a fresh clone, and two people tried the hosted demo
      (quotes used only with their permission) ([../judges-talk.md](../judges-talk.md#what-this-changes-for-us)).
- [ ] **P** — **English** for every material (§4 Language).
- [ ] **P** — screenshots in the image gallery (judges may score from text, images and video alone).
- [ ] **P** — sponsor tools used are named, and each sponsor's bar is met if we want its prize (only one sponsor
      prize can be won).
- [ ] **P** — **Submit**, then reopen the page and confirm it shows as submitted.

## Straight after submitting

- [ ] Tag the submitted commit: `git tag submission && git push origin submission`.
- [ ] Freeze `main` until winners are announced; later work on a branch.
- [ ] Keep the demo, hosting, DB, phone number, voice agent, keys and caps alive until Dec 15, 21:30 IST; check
      daily from Dec 2.
- [ ] If we win: winner affidavit and W-8BEN within 10 business days of receiving them (§8.2–8.4).

## Optional: bonus programmes

- [ ] **APIMatic, 1 month of Basic** (only if we use the PayPal context plugin):
  - [ ] Repo or submission shows the context plugin in use.
  - [ ] "Plug-in question" on the submission form answered.
  - [ ] Claim form on [/details/apimatic](https://paypalaihackathon.devpost.com/details/apimatic) submitted.
- No social-sharing bonus exists in this event.
