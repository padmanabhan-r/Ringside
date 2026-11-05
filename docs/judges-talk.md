# "How to win a hackathon": the PayPal Developers X Space

An 81-minute X Space hosted by **Eddie Jaoude** (PayPal Developers), with developer-relations people from other
companies, recorded during Halloween week (the file is dated 2026-10-28; on air they say "Happy Halloween Friday").
Eddie is one of the named judges ([hackathon.md](hackathon.md)); **none of the other speakers is on the judging
panel**. AG Grid's judge is Sylwia Vargas, not James. So treat Eddie's remarks as a judge's view, and the rest as
experienced judges' and organisers' advice from other events.

Transcribed locally with Whisper large-v3-turbo (MLX) on 2026-11-03, at no cost. The transcript has no speaker
labels: who said what comes from the host's hand-offs. Names and company names may be misheard (for example
"AppRite" is Appwrite and "Vappy" is Vapi). The audio file is local only and not in git.

## Who spoke

| Speaker | Role, as said on air | Judge here? |
|---|---|---|
| Eddie | Developer advocate, PayPal Developers; host | **Yes** |
| Andrew | Developer educator, Twilio | No |
| Colleen | Developer advocate, GitLab; ex-Particle, Topcoder; got her first tech job from a hackathon | No |
| Francesco | Content creator and speaker; judged an AWS hackathon in Berlin this year | No |
| Amanda | Developer advocate (her hackathon is at the Vapi office) | No |
| Aditya | Leads DevRel at Appwrite; won the MLH hackathon at RenderATL | No |
| Claudia | Senior community specialist, Zapier; not a coder | No |
| James | Heads DevRel at AG Grid (a sponsor) | No |
| Jason | No affiliation given | No |
| Ashwin | Leads developer community at Gradium (voice AI); ex-hackathon platform | No |

## What Eddie said (the judge)

- **Real user feedback in the demo** "is amazing and mind-blowing. It makes it look more like a real project": teams
  that collect questionnaire answers from other people and show them in the presentation [0:50:34].
- **Presentation polish counts more than build completeness.** His taxi analogy: a new car that is filthy against a
  ten-year-old car in pristine condition. He has seen projects that "hadn't fully been built" win on delivery
  [0:22:22].
- **The README has to work.** "Run through your presentation but run through your README… get your friend who isn't
  even participating… to just run through it… make it as easy as possible for the judges" [1:11:33].
- **Don't fake history.** Rewriting commits or re-initialising git "can easily be checked against stuff on GitHub"
  with AI [0:35:48].
- **Ask what they are looking for, not "what do I build to win"** [0:32:45].
- Plan before you code; he uses a GitHub project board [0:19:04]. The PayPal Discord is open for questions, and on
  air he said "there's two weeks left" [0:55:54].
- He has spoken elsewhere about testing unhappy paths ([playbook.md](playbook.md#the-judges)); that did not come up
  here.

## What the panel agreed on

### The idea
- **Built for this hackathon, on point.** Nothing worse for a judge than a project "already submitted somewhere" and
  re-tuned (Francesco) [0:17:01].
- **Work backwards from what the sponsor wants.** "In a hackathon… your first real customer is the judge" (James)
  [0:28:38].
- **First principles; avoid what the tools invite everyone to build.** "If you're coming to… a voice AI hackathon,
  everybody is building a dictation tool… how is that standing out?" (Ashwin) [1:04:20]. Spend the time saved by
  agents on the idea.
- **A problem you have yourself.** Winners are "actively passionate about" a problem of their own (Andrew)
  [0:21:19]. Colleen keeps a running list of things that annoy her [0:27:37].
- **The bar has moved.** A full-stack site with a nice front end no longer impresses; "the overall expectation… is so,
  so different than it was six months ago" (Ashwin) [0:49:32]. "Shallow projects are just a commodity… in the world of
  AI" (James) [1:09:30].
- **Load the sponsor's context into your agent:** their MCP servers and published skills, so it builds correctly
  (Amanda) [0:19:04].

### The demo and the story
- **Judges barely read code:** "no judge is spending more than 30 seconds looking at your code." They are tired after
  "the 45th app in a row that does a kind of similar thing and listening to a very obviously LLM script. Make them
  care. Write something that you would want to listen to" (Colleen) [0:26:34].
- **Colleen's structure:** a hook (a small joke) → a statistic that proves the point → the actual problem → "so we
  built this", about four sentences over the demo → a memorable close on why the problem matters [0:26:34].
- **Spend 20–30 seconds on the why.** Teams assume the judge infers the problem; most demos cover what and how, not
  why it is needed (Aditya) [0:54:52]. Tell a story, stay out of the technical weeds (Amanda) [0:56:56].
- **A process that works end to end**, even if simple; half-baked MVPs that stop mid-flow lose (Claudia) [0:23:23].
- **Judges search breadth-first.** Catch them fast with an elevator pitch and video, serving people who watch,
  listen or read; then make the deep dive frictionless: easy to clone and run, keys and env vars explained
  (James) [1:10:32].
- **Start the presentation early**, not ten minutes before the deadline (Andrew) [0:21:19].
- **Say what failed and what you'd do next.** It shows growth mindset and "is as valuable as having a really cool
  demo" (Andrew) [1:02:14].

### Rules and scope
- **Read the rules.** Jason saw teams disqualified for reusing old repositories, found by checking first-commit dates
  [0:34:47]. Francesco's closing line: "Please read the rules before submitting" [1:14:37].
- **One project, all in.** Unanimous: "quality over quantity" (James); "projects are investments of your time and not
  bets" (Aditya) [0:53:49].
- **Pivot only early**, with a cut-off time; late ideas can wait for after the hackathon (Colleen, Aditya, Francesco).
- **Feedback from outside**, but "make sure you're not making major product decisions via focus group" (Colleen)
  [1:00:02]. The judges are happy to give early feedback (James) [1:10:32].

### Solo or team
Mostly pro-team, but solo is fine online when focus is the point (Aditya, James) [0:41:04]. Even solo: talk to other
hackers, praise their projects, make friends (Colleen) [0:44:11].

## What this changes for us

1. **The video script is written by hand, in my own words**, on Colleen's structure: hook → one sourced number → the
   moment the problem bites → "so I built this" over the demo → close on why it matters. A script that sounds
   LLM-written is the failure named most often. Apply the same to the write-up and README.
   ([video-plan.md](submission/video-plan.md), [story.md](submission/story.md))
2. **Collect real user feedback and show it**: a few people outside the project (Discord, people in the target role)
   try the hosted demo; quote them, with permission, in the video and write-up. Eddie singled this out.
   No real people's data goes into the sandbox.
3. **A fresh person runs the README** before submission: clone, env vars, demo mode, sandbox buyer login. Add it to
   [checklist.md](submission/checklist.md).
4. **A "what didn't work and what's next" section** in the write-up.
5. **Lead with the problem and the PayPal flow, not the AI**. Ashwin's dictation example warns against the obvious
   build: if the product is voice-led, voice is the way in, not the pitch.
6. **Ask for early feedback in the PayPal Discord** once a demo exists; both Eddie and James invited it.
7. **Agent context**: keep PayPal's MCP server and agent toolkit docs loaded while building
   ([paypal-api-reference.md](paypal-api-reference.md)).
8. Already covered in [playbook.md](playbook.md): one product, a hosted demo with no keys needed, a new repo with honest
   history, the 15-second who-and-when opening.

## The organisers' tips on X

A series of "what actually wins" tips posted on X during the hackathon, pasted by the owner on 2026-11-05 (account
and exact dates not recorded; "10 days to go" puts the first post around Nov 2, "8 days remaining" around Nov 4).
They condense the X Space above.

1. **Build for THIS hackathon.** "Judges can tell when a project was recycled from somewhere else. Start from the
   theme, read the judging criteria, and talk to the mentors before you write any code."
2. **Solve a problem you actually have.** "Keep a running list of things that annoy you… Passion shows in the demo."
3. **Give your agent context first.** "Check if the sponsors have MCP servers, skills or up-to-date docs your agent
   can use. You'll build faster and fix less." → applied: the "Agent context" section of [../CLAUDE.md](../CLAUDE.md).
4. **Keep your team to 4 people max**, and "let one person own the presentation from day one". Solo: the
   presentation is mine from day one, so the video script starts before feature freeze.

## Transcript

The full 81-minute transcript is kept in the brainstorm repository (`padmanabhan-r/PayPal-AI-Hackathon`,
`docs/judges-talk.md`), not here: it is other people's words, and this repository goes public at submission.
