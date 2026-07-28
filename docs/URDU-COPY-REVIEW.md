# Urdu copy review

Every Urdu sentence in MatricMate, in one place, for an Urdu editor to check and correct.
Both the Android app and the website read their copy from the same files, so a correction here
fixes both.

## How to use this document

1. Read the **English** column for what the sentence has to mean, and the **Where** column for
   the screen or the moment it appears in.
2. If the Urdu is fine, leave the last column empty. If it is not, write the correct sentence in
   **Suggested correction**.
3. **Keep anything inside curly braces exactly as it is.** `{n}`, `{chapter}`, `{date}` and the
   rest are filled in by the app at runtime. `{n} din ki streak` becomes `7 din ki streak`. They
   may move within the sentence, but they must not be translated, renamed or dropped.
4. Two different kinds of Urdu are used on purpose, so please keep them apart:
   - **Roman Urdu** (Urdu written in English letters) for the app interface: buttons, labels,
     messages. This is what most Pakistani students read fastest on a phone.
   - **Urdu script (Nastaliq)** for actual study content: subject names, chapter titles, the Urdu
     paper, and notes for Urdu-medium students.
5. The register we are aiming for is polite imperative, the way Pakistani apps write:
   "karein", not "karo". Latin digits (7, not ۷). Everyday English loanwords students actually
   use are kept in English on purpose: account, password, chapter, test, practice, subject,
   flashcards, MCQs.

Anything in the **Where** column that names a situation ("Answer is wrong", "Daily AI limit
reached") only appears in that situation. Everything else is on screen all the time.

| | Count |
| :-- | --: |
| Part 1 · Interface sentences in Roman Urdu | 518 |
| Part 2 · Study content in Urdu script | 85 |
| Part 3 · Roman Urdu outside the interface files | 19 |

---

# Part 1 · App interface, Roman Urdu

These appear when the student sets **Settings → Language → Urdu**. The English column is the
exact sentence shown in English mode, so the two should say the same thing.

## Common buttons and labels

Buttons, toasts and short labels reused on every screen.

| # | Key | Where / when it shows | English | Roman Urdu (current) | Suggested correction |
| --: | :-- | :-- | :-- | :-- | :-- |
| 1 | `common.continue` |  | Continue | Aagey barhein | |
| 2 | `common.next` |  | Next | Agla | |
| 3 | `common.back` |  | Back | Wapas | |
| 4 | `common.done` |  | Done | Ho gaya | |
| 5 | `common.cancel` |  | Cancel | Cancel karein | |
| 6 | `common.save` |  | Save changes | Save karein | |
| 7 | `common.saved` |  | Saved | Save ho gaya | |
| 8 | `common.retry` |  | Try again | Dobara koshish karein | |
| 9 | `common.close` |  | Close | Band karein | |
| 10 | `common.search` |  | Search | Talash karein | |
| 11 | `common.loading` |  | Loading… | Load ho raha hai… | |
| 12 | `common.seeAll` |  | See all | Sab dekhein | |
| 13 | `common.details` |  | Details | Tafseel | |
| 14 | `common.minutes` |  | min | min | |
| 15 | `common.questions` |  | questions | sawal | |
| 16 | `common.cards` |  | cards | cards | |
| 17 | `common.of` |  | of | mein se | |
| 18 | `common.demoNote` |  | Demo build · sample FBISE Class 9 content | Demo build · sample FBISE Class 9 content | |

## Language setting

Settings → Language. The hint under the toggle changes with the choice.

| # | Key | Where / when it shows | English | Roman Urdu (current) | Suggested correction |
| --: | :-- | :-- | :-- | :-- | :-- |
| 19 | `lang.label` |  | Language | Zubaan | |
| 20 | `lang.english` |  | English | English | |
| 21 | `lang.urdu` |  | Urdu | Urdu | |
| 22 | `lang.englishHint` |  | Use the app in English | App English mein istemal karein | |
| 23 | `lang.urduHint` |  | App Roman Urdu mein, jaise “Aaj ka plan” | App Roman Urdu mein, jaise “Aaj ka plan” | |

## Welcome carousel

First launch, three slides before sign-up.

| # | Key | Where / when it shows | English | Roman Urdu (current) | Suggested correction |
| --: | :-- | :-- | :-- | :-- | :-- |
| 24 | `welcome.slide1Title` |  | Everything in one app | Sab kuch aik app mein | |
| 25 | `welcome.slide1Body` |  | Chapter-wise notes, audio lessons and examples for FBISE Class 9. | FBISE Class 9 ke har chapter ke notes, audio lessons aur examples. | |
| 26 | `welcome.slide2Title` |  | Practice until it sticks | Practice karein, yaad ho jaye ga | |
| 27 | `welcome.slide2Body` |  | MCQs, flashcards, past papers and timed tests, with instant explanations. | MCQs, flashcards, past papers aur timed tests, foran explanation ke saath. | |
| 28 | `welcome.slide3Title` |  | Your AI tutor, any time | Aap ka AI tutor, har waqt | |
| 29 | `welcome.slide3Body` |  | Stuck at 1 AM? Ask your question and get step-by-step help. | Raat ko sawal atak gaya? Poochein aur step-by-step samjhein. | |
| 30 | `welcome.getStarted` |  | Get started | Shuru karein | |
| 31 | `welcome.haveAccount` |  | I already have an account | Mera account pehle se hai | |

## Onboarding

Four steps: class, board, medium, subjects.

| # | Key | Where / when it shows | English | Roman Urdu (current) | Suggested correction |
| --: | :-- | :-- | :-- | :-- | :-- |
| 32 | `onboarding.classTitle` |  | Which class are you in? | Aap kis class mein hain? | |
| 33 | `onboarding.classSub` |  | We’ll load your exact syllabus | Hum aap ka syllabus load kar dein ge | |
| 34 | `onboarding.class9` |  | Class 9 | Class 9 | |
| 35 | `onboarding.class9Sub` |  | Matric part one | Matric part one | |
| 36 | `onboarding.class10` |  | Class 10 | Class 10 | |
| 37 | `onboarding.class10Sub` |  | Matric part two | Matric part two | |
| 38 | `onboarding.comingSoon` |  | Coming soon | Jald aa raha hai | |
| 39 | `onboarding.class10Toast` | Tapping the disabled Class 10 option | Class 10 comes after the Class 9 launch. | Class 10 Class 9 ke launch ke baad aaye gi. | |
| 40 | `onboarding.boardTitle` |  | Which board? | Aap ka board kaunsa hai? | |
| 41 | `onboarding.boardSub` |  | Syllabus and past papers follow your board | Syllabus aur past papers aap ke board ke mutabiq hon ge | |
| 42 | `onboarding.fbise` |  | FBISE | FBISE | |
| 43 | `onboarding.fbiseSub` |  | Federal Board, Islamabad | Federal Board, Islamabad | |
| 44 | `onboarding.punjab` |  | Punjab Board | Punjab Board | |
| 45 | `onboarding.punjabSub` |  | BISE Lahore, Rawalpindi and others | BISE Lahore, Rawalpindi aur deegar | |
| 46 | `onboarding.mediumTitle` |  | Which medium do you study in? | Aap kis medium mein parhte hain? | |
| 47 | `onboarding.mediumSub` |  | Your notes and questions come in this language | Notes aur sawal isi zubaan mein aayein ge | |
| 48 | `onboarding.mediumEn` |  | English medium | English medium | |
| 49 | `onboarding.mediumEnSub` |  | Notes and questions in English | Notes aur sawal English mein | |
| 50 | `onboarding.mediumUr` |  | Urdu medium | Urdu medium | |
| 51 | `onboarding.mediumUrSub` |  | Notes and questions in Urdu | Notes aur sawal Urdu mein | |
| 52 | `onboarding.mediumFootnote` |  | This is about your textbooks, not the app. You can change it later in Settings. | Yeh aap ki kitabon ke baare mein hai, app ki zubaan alag hai. Settings se badal sakte hain. | |
| 53 | `onboarding.subjectsTitle` |  | Pick your subjects | Apne subjects chunein | |
| 54 | `onboarding.subjectsSub` |  | Compulsory ones are already added | Compulsory subjects pehle se shamil hain | |
| 55 | `onboarding.compulsory` |  | Compulsory | Compulsory | |
| 56 | `onboarding.compulsorySub` |  | Everyone studies this | Yeh sab parhte hain | |
| 57 | `onboarding.electives` |  | Electives | Electives | |
| 58 | `onboarding.electivesHint` |  | Choose at least 2 | Kam az kam 2 chunein | |
| 59 | `onboarding.picked` | keeps {n} | {n} picked | {n} chune gaye | |
| 60 | `onboarding.scienceGroup` |  | Science | Science | |
| 61 | `onboarding.artsGroup` |  | Arts | Arts | |
| 62 | `onboarding.continueWith` | keeps {n} | Continue with {n} subjects | {n} subjects ke saath aagey barhein | |
| 63 | `onboarding.pickTwo` | Fewer than 2 electives chosen | Pick at least 2 electives | Kam az kam 2 electives chunein | |
| 64 | `onboarding.subjectAdded` | A subject is added · keeps {name} | {name} added | {name} shamil ho gaya | |
| 65 | `onboarding.subjectsFootnote` |  | Final subject list will match the client’s content. | Subjects ki final list client ke content ke mutabiq ho gi. | |

## Sign up, log in, reset password

Includes the log-out confirmation dialog.

| # | Key | Where / when it shows | English | Roman Urdu (current) | Suggested correction |
| --: | :-- | :-- | :-- | :-- | :-- |
| 66 | `auth.signUpTitle` |  | Create your account | Apna account banayein | |
| 67 | `auth.signUpSub` |  | Two minutes, then straight to your plan | Do minute, phir seedha aap ke plan par | |
| 68 | `auth.fullName` |  | Full name | Poora naam | |
| 69 | `auth.namePlaceholder` |  | Ahmed Raza | Ahmed Raza | |
| 70 | `auth.contact` |  | Email or mobile number | Email ya mobile number | |
| 71 | `auth.contactPlaceholder` |  | ahmed@gmail.com or 03001234567 | ahmed@gmail.com ya 03001234567 | |
| 72 | `auth.password` |  | Password | Password | |
| 73 | `auth.passwordPlaceholder` |  | At least 6 characters | Kam az kam 6 characters | |
| 74 | `auth.terms` |  | By continuing you agree to the Terms and Privacy Policy. | Aagey barh kar aap Terms aur Privacy Policy se ittefaq karte hain. | |
| 75 | `auth.createAccount` |  | Create account | Account banayein | |
| 76 | `auth.loginTitle` |  | Welcome back | Khush aamdeed | |
| 77 | `auth.loginSub` |  | Log in to continue | Jari rakhne ke liye login karein | |
| 78 | `auth.logIn` |  | Log in | Login karein | |
| 79 | `auth.forgotPassword` |  | Forgot password? | Password bhool gaye? | |
| 80 | `auth.demoHint` | Wrong password in the demo build | Demo build: any email with a 6-character password works. | Demo build: koi bhi email aur 6 characters ka password chal jaye ga. | |
| 81 | `auth.resetTitle` |  | Reset password | Password reset karein | |
| 82 | `auth.resetSub` |  | We’ll send you a reset link | Hum aap ko reset link bhej dein ge | |
| 83 | `auth.sendReset` |  | Send reset link | Reset link bhejein | |
| 84 | `auth.resetSent` | After the reset link is sent · keeps {contact} | Reset link sent to {contact}. Check your inbox or SMS. | Reset link {contact} par bhej diya. Inbox ya SMS check karein. | |
| 85 | `auth.backToLogin` |  | Back to log in | Wapas login par | |
| 86 | `auth.resetFootnote` |  | We show the same message whether or not the account exists. | Account ho ya na ho, hum yehi message dikhate hain, aap ki hifazat ke liye. | |
| 87 | `auth.logOut` |  | Log out | Logout karein | |
| 88 | `auth.logOutConfirm` | Log-out confirmation dialog | Log out? | Logout karna hai? | |
| 89 | `auth.logOutBody` | Log-out confirmation dialog | Your progress stays saved on this device. | Aap ki progress isi phone par save rahe gi. | |
| 90 | `auth.stayLoggedIn` |  | Stay logged in | Login rehne dein | |

## Plan and Premium

Locked-chapter notices and the Premium feature list.

| # | Key | Where / when it shows | English | Roman Urdu (current) | Suggested correction |
| --: | :-- | :-- | :-- | :-- | :-- |
| 91 | `billing.premium` |  | Premium | Premium | |
| 92 | `billing.freeBody` | Free plan | You’re on the free plan: one full chapter per subject, 5 MCQs and 5 AI questions a day. | Aap free plan par hain: har subject ka aik poora chapter, rozana 5 MCQs aur 5 AI sawal. | |
| 93 | `billing.lockedBody` | A Premium chapter is opened | This chapter is part of Premium, so it isn’t included in your plan yet. | Yeh chapter Premium ka hissa hai, is liye abhi aap ke plan mein shamil nahi. | |
| 94 | `billing.expiredBody` | The plan has ended | Your plan has ended, so Premium chapters are locked. | Aap ka plan khatam ho gaya hai, is liye Premium chapters lock hain. | |
| 95 | `billing.manageNote` | keeps {site} | Subscriptions are managed on our website, {site}. | Subscription hamari website {site} par manage hoti hai. | |
| 96 | `billing.statusFree` |  | Free plan | Free plan | |
| 97 | `billing.statusActive` |  | Premium | Premium | |
| 98 | `billing.statusExpired` |  | Plan ended | Plan khatam | |
| 99 | `billing.activeTill` | Premium is active · keeps {date} | Included until {date} | {date} tak shamil | |
| 100 | `billing.whatsIncluded` |  | What Premium includes | Premium mein kya shamil hai | |
| 101 | `billing.perk1` |  | Every chapter, note and audio lesson | Har chapter, notes aur audio lesson | |
| 102 | `billing.perk2` |  | Unlimited MCQs, tests and past papers | Unlimited MCQs, tests aur past papers | |
| 103 | `billing.perk3` |  | AI tutor: 20 questions a day | AI tutor: rozana 20 sawal | |
| 104 | `billing.perk4` |  | Weak topics and monthly report card | Weak topics aur mahana report card | |
| 105 | `billing.perk5` |  | Offline downloads | Offline downloads | |

## Bottom tab bar

Five labels, always visible.

| # | Key | Where / when it shows | English | Roman Urdu (current) | Suggested correction |
| --: | :-- | :-- | :-- | :-- | :-- |
| 106 | `tabs.home` |  | Home | Home | |
| 107 | `tabs.study` |  | Study | Parhai | |
| 108 | `tabs.practice` |  | Practice | Practice | |
| 109 | `tabs.tutor` |  | AI Tutor | AI Tutor | |
| 110 | `tabs.progress` |  | Progress | Progress | |

## Home screen

Greeting, today’s plan, quick actions, weekly stats.

| # | Key | Where / when it shows | English | Roman Urdu (current) | Suggested correction |
| --: | :-- | :-- | :-- | :-- | :-- |
| 111 | `dash.greeting` | keeps {name} | Hi, {name} | Salam, {name} | |
| 112 | `dash.todayPlan` |  | Today’s plan | Aaj ka plan | |
| 113 | `dash.doneCount` | keeps {a} {b} | {a}/{b} done | {a}/{b} mukammal | |
| 114 | `dash.taskRead` | keeps {chapter} | Read {chapter} · 15 min | {chapter} parhein · 15 min | |
| 115 | `dash.taskMcq` | keeps {chapter} | 10 MCQs on {chapter} | {chapter} ke 10 MCQs | |
| 116 | `dash.taskCards` |  | Flashcards · 10 cards | Flashcards · 10 cards | |
| 117 | `dash.taskWeak` | keeps {topic} {n} | Revise {topic} · {n}% so far | {topic} dohrayein · abhi tak {n}% | |
| 118 | `dash.continueLearning` |  | Continue learning | Parhai jari rakhein | |
| 119 | `dash.sectionOf` | keeps {a} {b} | Section {a} of {b} | Section {a} / {b} | |
| 120 | `dash.quickActions` |  | Quick actions | Foran shuru karein | |
| 121 | `dash.quickMcq` |  | 10 MCQs | 10 MCQs | |
| 122 | `dash.quickCards` |  | Flashcards | Flashcards | |
| 123 | `dash.quickAi` |  | Ask AI | AI se poochein | |
| 124 | `dash.quickPapers` |  | Past papers | Past papers | |
| 125 | `dash.thisWeek` |  | This week | Is hafte | |
| 126 | `dash.accuracy` |  | accuracy | accuracy | |
| 127 | `dash.questions` |  | questions | sawal | |
| 128 | `dash.studyTime` |  | study time | parhai ka waqt | |

## Notifications screen

Includes the empty state.

| # | Key | Where / when it shows | English | Roman Urdu (current) | Suggested correction |
| --: | :-- | :-- | :-- | :-- | :-- |
| 129 | `notifications.title` |  | Notifications | Notifications | |
| 130 | `notifications.today` |  | Today | Aaj | |
| 131 | `notifications.earlier` |  | Earlier | Pehle | |
| 132 | `notifications.emptyTitle` |  | No notifications yet | Abhi koi notification nahi | |
| 133 | `notifications.emptyBody` |  | We’ll remind you about your plan, streaks and report card. | Hum aap ko plan, streak aur report card ke baare mein yaad dilayein ge. | |

## Study, subjects and chapters

Subject list, chapter list and the chapter hub.

| # | Key | Where / when it shows | English | Roman Urdu (current) | Suggested correction |
| --: | :-- | :-- | :-- | :-- | :-- |
| 134 | `study.title` |  | Study | Parhai | |
| 135 | `study.searchPlaceholder` |  | Search subject or chapter | Subject ya chapter dhoondein | |
| 136 | `study.setupLine` | keeps {class} {board} {medium} | Class {class} · {board} · {medium} medium | Class {class} · {board} · {medium} medium | |
| 137 | `study.chapterCount` | keeps {n} | {n} chapters | {n} chapters | |
| 138 | `study.percentComplete` | keeps {n} | {n}% complete | {n}% mukammal | |
| 139 | `study.continueChapter` | keeps {chapter} | Continue: {chapter} | Jari rakhein: {chapter} | |
| 140 | `study.noMatchTitle` | Search finds nothing | Nothing matched | Kuch nahi mila | |
| 141 | `study.noMatchBody` | Search finds nothing · keeps {q} | No subject or chapter for “{q}”. | “{q}” ke liye koi subject ya chapter nahi mila. | |
| 142 | `study.chapterTest` |  | Chapter test | Chapter test | |
| 143 | `study.premiumChapter` |  | Premium | Premium | |
| 144 | `study.premiumNote` |  | Chapters 7 and up are Premium in this demo, to show how locking works. | Is demo mein chapter 7 se aagey Premium hain, taake locking dikh sake. | |
| 145 | `study.sections` |  | What’s inside | Is chapter mein kya hai | |
| 146 | `study.notes` |  | Notes and examples | Notes aur examples | |
| 147 | `study.notesSub` | keeps {n} {read} | {n} sections · {read} read | {n} sections · {read} parh liye | |
| 148 | `study.audio` |  | Audio lesson | Audio lesson | |
| 149 | `study.audioSub` | keeps {n} | {n} min · Urdu narration | {n} min · Urdu mein | |
| 150 | `study.flashcards` |  | Flashcards | Flashcards | |
| 151 | `study.flashcardsSub` | keeps {n} {known} | {n} cards · {known} known | {n} cards · {known} yaad | |
| 152 | `study.mcqs` |  | Practice MCQs | MCQs ki practice | |
| 153 | `study.mcqsSub` | keeps {n} | {n} questions | {n} sawal | |
| 154 | `study.mcqsBest` | keeps {n} {score} | {n} questions · best {score} | {n} sawal · best {score} | |
| 155 | `study.shortQ` |  | Short questions | Short questions | |
| 156 | `study.shortQSub` | keeps {n} | {n} with model answers | {n} model answers ke saath | |
| 157 | `study.blanks` |  | Fill in the blanks | Khali jagah pur karein | |
| 158 | `study.blanksSub` | keeps {n} | {n} items | {n} sawal | |
| 159 | `study.startReading` |  | Start reading | Parhna shuru karein | |
| 160 | `study.continueReading` |  | Continue reading | Parhna jari rakhein | |
| 161 | `study.savedOffline` | Chapter saved for offline | Saved for offline | Offline save ho gaya | |
| 162 | `study.notDownloaded` |  | Not downloaded | Download nahi hua | |
| 163 | `study.saveOffline` |  | Saved for offline | Offline save ho gaya | |
| 164 | `study.removedOffline` | Chapter removed from downloads | Removed from downloads | Downloads se hata diya | |

## Chapter reader

Notes screen, text-size toast and the "Ask AI" sheet.

| # | Key | Where / when it shows | English | Roman Urdu (current) | Suggested correction |
| --: | :-- | :-- | :-- | :-- | :-- |
| 165 | `reader.section` | keeps {a} {b} | Section {a} of {b} | Section {a} / {b} | |
| 166 | `reader.definition` |  | Definition | Tareef | |
| 167 | `reader.example` |  | Example | Misaal | |
| 168 | `reader.askAi` |  | Ask AI | AI se poochein | |
| 169 | `reader.askAiTitle` |  | Ask about this section | Is section ke baare mein poochein | |
| 170 | `reader.finish` |  | Finish | Mukammal | |
| 171 | `reader.progressSaved` | Finishing the last section | Progress saved | Progress save ho gayi | |
| 172 | `reader.textSize` | Text size button pressed · keeps {size} | Text size: {size} | Text size: {size} | |
| 173 | `reader.small` |  | small | chota | |
| 174 | `reader.medium` |  | medium | darmiyana | |
| 175 | `reader.large` |  | large | bara | |
| 176 | `reader.urduMediumNote` | Urdu-medium student on a chapter with no Urdu notes yet | You study in Urdu medium, so the client’s Urdu notes load here in the live app. | Aap Urdu medium mein parhte hain, is liye live app mein yahan client ke Urdu notes aayein ge. | |
| 177 | `reader.suggest1` |  | Explain simply | Asaan lafzon mein samjhayein | |
| 178 | `reader.suggest2` |  | Give an example | Aik misaal dein | |
| 179 | `reader.suggest3` |  | Explain in Urdu | Urdu mein samjhayein | |
| 180 | `reader.openChat` |  | Open full chat | Poori chat kholein | |

## Audio lesson

Player screen and the notes under it.

| # | Key | Where / when it shows | English | Roman Urdu (current) | Suggested correction |
| --: | :-- | :-- | :-- | :-- | :-- |
| 181 | `audio.title` |  | Audio lesson | Audio lesson | |
| 182 | `audio.speed` | keeps {n} | {n}× speed | {n}× speed | |
| 183 | `audio.offline` |  | Offline | Offline | |
| 184 | `audio.stream` |  | Streaming | Streaming | |
| 185 | `audio.narrationEn` |  | English narration | English narration | |
| 186 | `audio.narrationUr` |  | Urdu narration | Urdu narration | |
| 187 | `audio.sampleNote` | A chapter that has a real recording | This chapter has a real sample recording in both mediums. Switch Study medium in Settings to hear the other one. Remaining chapters use the client’s own recordings. | Is chapter ki asli sample recording dono mediums mein maujood hai. Settings se Study medium badal kar doosri sunein. Baqi chapters client ki apni recordings se aayein ge. | |
| 188 | `audio.noTrackNote` | A chapter with no recording yet | No recording for this chapter yet. The client’s audio loads here. | Is chapter ki recording abhi nahi. Client ki audio yahan aaye gi. | |
| 189 | `audio.needsNewBuild` | Old Android build without audio support | This copy of the app was built before audio support was added, so the transport below is a preview. Install the latest build to hear the recording. | Yeh app audio support se pehle bani thi, is liye neeche sirf preview chal raha hai. Asli recording sunne ke liye nayi build install karein. | |
| 190 | `audio.demoNote` |  | Demo build: playback is simulated. Real audio ships with the client’s recordings. | Demo build: playback abhi simulate ho raha hai. Asli audio client ki recordings ke saath aaye gi. | |
| 191 | `audio.upNext` |  | Up next | Agla | |
| 192 | `audio.nextChapter` |  | Next chapter audio | Agle chapter ka audio | |

## Downloads

Offline chapter list and its empty state.

| # | Key | Where / when it shows | English | Roman Urdu (current) | Suggested correction |
| --: | :-- | :-- | :-- | :-- | :-- |
| 193 | `downloads.title` |  | Downloads | Downloads | |
| 194 | `downloads.sub` |  | Available without internet | Bina internet ke bhi chalte hain | |
| 195 | `downloads.used` | keeps {n} | {n} MB used | {n} MB istemal | |
| 196 | `downloads.cap` | keeps {n} | of {n} MB | {n} MB mein se | |
| 197 | `downloads.emptyTitle` | Nothing downloaded | No downloads yet | Abhi koi download nahi | |
| 198 | `downloads.emptyBody` | Nothing downloaded | Save a chapter and study without internet. Useful when data runs out. | Chapter save karein aur bina internet parhein. Jab data khatam ho, tab kaam aata hai. | |
| 199 | `downloads.browse` |  | Browse subjects | Subjects dekhein | |
| 200 | `downloads.perChapter` | keeps {n} | {n} MB · notes, audio, MCQs | {n} MB · notes, audio, MCQs | |
| 201 | `downloads.footnote` |  | Downloads use Wi-Fi by default. Answers given offline sync when you reconnect. | Downloads Wi-Fi par hote hain. Offline diye gaye jawab internet aate hi sync ho jate hain. | |

## Practice home

The six practice modes and recent sessions.

| # | Key | Where / when it shows | English | Roman Urdu (current) | Suggested correction |
| --: | :-- | :-- | :-- | :-- | :-- |
| 202 | `practice.title` |  | Practice | Practice | |
| 203 | `practice.sub` |  | Every question type in one place | Har tarah ke sawal, aik jagah | |
| 204 | `practice.mcqs` |  | MCQs | MCQs | |
| 205 | `practice.mcqsSub` |  | Topic-wise and mixed | Topic-wise aur mixed | |
| 206 | `practice.flashcards` |  | Flashcards | Flashcards | |
| 207 | `practice.flashcardsSub` |  | Active recall | Yaad karne ke liye | |
| 208 | `practice.blanks` |  | Fill in the blanks | Khali jagah pur karein | |
| 209 | `practice.blanksSub` |  | Test your recall | Yaad-dasht check karein | |
| 210 | `practice.shortQ` |  | Short questions | Short questions | |
| 211 | `practice.shortQSub` |  | With model answers | Model answers ke saath | |
| 212 | `practice.papers` |  | Past papers | Past papers | |
| 213 | `practice.papersSub` |  | FBISE 2019–2025 | FBISE 2019–2025 | |
| 214 | `practice.exam` |  | Timed test | Timed test | |
| 215 | `practice.examSub` |  | Double XP | Double XP | |
| 216 | `practice.aiTest` |  | AI test from my weak topics | AI test mere weak topics se | |
| 217 | `practice.aiTestSub` |  | A personalised paper in seconds | Chand second mein apna paper | |
| 218 | `practice.recent` |  | Recent sessions | Pichli sessions | |
| 219 | `practice.noneTitle` | No practice sessions yet | No sessions yet | Abhi koi session nahi | |
| 220 | `practice.noneBody` | No practice sessions yet | Start with 10 MCQs, about five minutes. | 10 MCQs se shuru karein, takreeban paanch minute. | |
| 221 | `practice.answered` | keeps {n} | {n} questions answered | {n} sawal hal kiye | |

## Questions, tests, results and review

The largest section: MCQs, the confidence prompt, feedback after each answer, timed tests, results, flashcards, blanks, short questions and past papers.

| # | Key | Where / when it shows | English | Roman Urdu (current) | Suggested correction |
| --: | :-- | :-- | :-- | :-- | :-- |
| 222 | `session.setupTitle` |  | New MCQ session | Nayi MCQ session | |
| 223 | `session.setupSub` |  | Pick what you want to practise | Chunein aap kya practice karna chahte hain | |
| 224 | `session.subject` |  | Subject | Subject | |
| 225 | `session.chapters` |  | Chapters | Chapters | |
| 226 | `session.mixed` |  | Mixed, all chapters | Mixed, sab chapters | |
| 227 | `session.mixedSub` |  | Questions from everything you’ve studied | Jo kuch aap ne parha, us mein se sawal | |
| 228 | `session.selected` | keeps {n} | {n} selected | {n} chune gaye | |
| 229 | `session.allChapters` |  | all chapters | sab chapters | |
| 230 | `session.howMany` |  | How many questions? | Kitne sawal? | |
| 231 | `session.start` | keeps {n} | Start {n} questions | {n} sawal shuru karein | |
| 232 | `session.noQuestions` | No questions match the selection | No questions for that selection yet | Is selection ke liye abhi sawal nahi hain | |
| 233 | `session.premiumNote` | Free plan | Free mode: 5 questions a day. Premium unlocks unlimited practice. | Free mode: rozana 5 sawal. Premium mein unlimited practice. | |
| 234 | `session.premiumActive` | Premium plan | Premium: unlimited practice. | Premium: unlimited practice. | |
| 235 | `session.questionOf` | keeps {a} {b} | Question {a} of {b} | Sawal {a} / {b} | |
| 236 | `session.howSure` |  | How sure are you? | Aap kitne pakke hain? | |
| 237 | `session.conf0` |  | Guess | Tukka | |
| 238 | `session.conf1` |  | Fairly sure | Thora pakka | |
| 239 | `session.conf2` |  | Certain | Pakka | |
| 240 | `session.confHintSure` | Student picks “Pakka” · keeps {xp} | A confident answer earns {xp} XP, and we track how often you’re right. | Pakka jawab {xp} XP deta hai, aur hum dekhte hain aap kitni baar sahi hote hain. | |
| 241 | `session.confHintGuess` | Student picks “Tukka” | An honest guess earns less, but keeps your stats real. | Tukke ke XP kam hain, lekin aap ke stats sachche rehte hain. | |
| 242 | `session.confHintMid` | Student picks “Thora pakka” · keeps {xp} | Worth {xp} XP. | {xp} XP milein ge. | |
| 243 | `session.check` |  | Check answer | Jawab check karein | |
| 244 | `session.correct` | Answer is right · keeps {xp} | Correct! +{xp} XP | Sahi jawab! +{xp} XP | |
| 245 | `session.wrong` | Answer is wrong | Not quite. Here’s why | Ghalat. Wajah dekhein | |
| 246 | `session.confidentWrong` | Wrong answer after saying “Pakka” | You were certain about this one. Worth another look. | Aap ne “Pakka” kaha tha. Is concept ko dobara dekh lein. | |
| 247 | `session.luckyGuess` | Right answer after saying “Tukka” | Lucky guess. Revise it so next time you’re sure. | Tukka lag gaya. Aik baar dohra lein taake agli baar pakka ho. | |
| 248 | `session.why` |  | Why | Wajah | |
| 249 | `session.readInChapter` |  | Read this in the chapter | Chapter mein parhein | |
| 250 | `session.askAi` |  | Ask AI | AI se poochein | |
| 251 | `session.nextQuestion` |  | Next question | Agla sawal | |
| 252 | `session.seeResult` |  | See result | Result dekhein | |
| 253 | `session.noSession` | Session screen opened with no active session | No active session | Koi session nahi chal rahi | |
| 254 | `session.noSessionBody` | Session screen opened with no active session | Start a practice session to see questions here. | Sawal dekhne ke liye practice session shuru karein. | |
| 255 | `session.setUpSession` |  | Set up a session | Session banayein | |
| 256 | `session.examTitle` |  | Timed test | Timed test | |
| 257 | `session.examRules` | keeps {n} {min} | {n} questions · {min} minutes | {n} sawal · {min} minute | |
| 258 | `session.examRulesSub` |  | No answers until you submit · XP counts double | Submit karne tak jawab nahi dikhein ge · XP double | |
| 259 | `session.best` | A previous timed test exists · keeps {n} | Best: {n}% | Best: {n}% | |
| 260 | `session.firstAttempt` | No previous timed test | First attempt | Pehli koshish | |
| 261 | `session.pauseOnce` |  | Leaving pauses once | App chhorne par aik baar pause | |
| 262 | `session.aiGenerated` |  | AI-generated | AI ne banaya | |
| 263 | `session.beforeStart` |  | Before you start | Shuru karne se pehle | |
| 264 | `session.beforeStart1` | keeps {min} | Put your phone on silent for {min} minutes of focus. | Phone silent kar lein, {min} minute ka focus. | |
| 265 | `session.beforeStart2` |  | You can flag questions and come back to them. | Sawal flag kar ke baad mein wapas aa sakte hain. | |
| 266 | `session.beforeStart3` |  | The timer keeps running if you leave the app (one pause allowed). | App chhorne par timer chalta rehta hai (aik pause ki ijazat hai). | |
| 267 | `session.startExam` |  | Start test | Test shuru karein | |
| 268 | `session.flagged` | Question flagged during a test | Flagged for review | Baad mein dekhne ke liye flag kar diya | |
| 269 | `session.flagRemoved` | Flag removed during a test | Flag removed | Flag hata diya | |
| 270 | `session.submit` |  | Submit | Submit karein | |
| 271 | `session.submitTitle` |  | Submit your test? | Test submit karna hai? | |
| 272 | `session.unanswered` | Submitting with questions left blank · keeps {n} | {n} questions are still unanswered. | {n} sawal abhi khali hain. | |
| 273 | `session.allAnswered` | Submitting with everything answered | All questions answered. | Sab sawal hal ho gaye. | |
| 274 | `session.noChangeAfter` |  | You can’t change answers after submitting. | Submit ke baad jawab nahi badal sakte. | |
| 275 | `session.submitNow` |  | Submit now | Ab submit karein | |
| 276 | `session.keepWorking` |  | Keep working | Karte rehna hai | |
| 277 | `session.jumpHint` |  | Tap a number to jump · star flags a question | Number dabayein to us sawal par jayein · star flag karta hai | |
| 278 | `session.lastQuestion` |  | Last question | Aakhri sawal | |
| 279 | `session.resultGood` | Score is 70% or above · keeps {name} | Well done, {name}! | Shabash, {name}! | |
| 280 | `session.resultTry` | Score is below 70% | Keep practising | Thori aur practice karein | |
| 281 | `session.grade` | keeps {g} | Grade {g} | Grade {g} | |
| 282 | `session.xpEarned` | keeps {n} | +{n} XP | +{n} XP | |
| 283 | `session.xpDoubled` | Timed test (XP counts double) · keeps {n} | +{n} XP (×2) | +{n} XP (×2) | |
| 284 | `session.vsAverage` | keeps {n} | {n}% vs your average | aap ke average se {n}% | |
| 285 | `session.weakSpot` | Most wrong answers came from one topic · keeps {topic} | Weak spot: {topic} | Kamzor topic: {topic} | |
| 286 | `session.weakSpotSub` |  | Most of your wrong answers came from this topic. | Zyada tar ghalat jawab isi topic se aaye. | |
| 287 | `session.studyNow` |  | Study it now | Abhi parhein | |
| 288 | `session.reviewAnswers` |  | Review answers | Jawab dekhein | |
| 289 | `session.resultFootnote` |  | Every answer and how sure you were is saved. See the pattern in Progress. | Har jawab aur aap ka confidence save hota hai. Pattern Progress mein dekhein. | |
| 290 | `session.reviewTitle` |  | Review | Jawab dekhein | |
| 291 | `session.all` |  | All | Sab | |
| 292 | `session.wrongOnly` |  | Wrong | Ghalat | |
| 293 | `session.flaggedOnly` |  | Flagged | Flag kiye | |
| 294 | `session.yourAnswer` | keeps {a} | You: {a} | Aap: {a} | |
| 295 | `session.correctAnswer` | keeps {a} | Correct: {a} | Sahi: {a} | |
| 296 | `session.notAnswered` |  | Not answered | Jawab nahi diya | |
| 297 | `session.tapForWhy` |  | Tap to see the explanation | Wajah dekhne ke liye dabayein | |
| 298 | `session.allCorrect` | Review filtered to wrong answers, none found | No mistakes, everything correct! | Koi ghalti nahi, sab sahi! | |
| 299 | `session.nothingFlagged` | Review filtered to flagged, none found | Nothing flagged in this session. | Is session mein kuch flag nahi kiya. | |
| 300 | `session.cardTerm` |  | TERM | LAFZ | |
| 301 | `session.cardDefinition` |  | DEFINITION | TAREEF | |
| 302 | `session.tapToFlip` |  | Tap to flip | Palatne ke liye dabayein | |
| 303 | `session.cardOf` | keeps {a} {b} | Card {a} of {b} | Card {a} / {b} | |
| 304 | `session.repeat` |  | Repeat | Dobara | |
| 305 | `session.known` |  | I know it | Yaad hai | |
| 306 | `session.knownCount` | keeps {n} | {n} known | {n} yaad | |
| 307 | `session.repeatCount` | keeps {n} | {n} to repeat | {n} dobara | |
| 308 | `session.cardsDone` | keeps {known} {repeat} | {known} known, {repeat} to repeat | {known} yaad, {repeat} dobara | |
| 309 | `session.cardsDoneSub` |  | Repeats come back first next time. That’s how they stick. | Dobara wale cards agli baar pehle aayein ge. Isi tarah yaad hote hain. | |
| 310 | `session.reviewRepeats` | keeps {n} | Review {n} repeats | {n} dobara dekhein | |
| 311 | `session.backToChapter` |  | Back to chapter | Chapter par wapas | |
| 312 | `session.blanksItem` | keeps {a} {b} | Item {a} of {b} | Sawal {a} / {b} | |
| 313 | `session.blanksCheck` |  | Check | Check karein | |
| 314 | `session.blanksCorrect` |  | Correct! +8 XP | Sahi! +8 XP | |
| 315 | `session.blanksWrong` | keeps {a} | Correct answer: {a} | Sahi jawab: {a} | |
| 316 | `session.blanksDone` | keeps {a} {b} | {a} / {b} correct | {a} / {b} sahi | |
| 317 | `session.blanksDoneSub` |  | Recall practice counts towards your chapter progress. | Yeh practice bhi aap ki chapter progress mein shamil hoti hai. | |
| 318 | `session.shortQOf` | keeps {a} {b} | {a} of {b} | {a} / {b} | |
| 319 | `session.marks` | keeps {n} | {n} marks | {n} marks | |
| 320 | `session.thinkFirst` |  | Think through your answer first. Writing it out works best. | Pehle khud jawab sochein. Likh kar dekhna sab se behtar hai. | |
| 321 | `session.revealAnswer` |  | Reveal model answer | Model answer dikhayein | |
| 322 | `session.modelAnswer` |  | Model answer | Model answer | |
| 323 | `session.markingPoints` |  | Marking points | Marking points | |
| 324 | `session.howDidYouDo` |  | How did you do? | Aap ka jawab kaisa tha? | |
| 325 | `session.gotIt` |  | Got it | Sahi tha | |
| 326 | `session.partially` |  | Partly | Thora sa | |
| 327 | `session.missed` |  | Missed | Nahi aaya | |
| 328 | `session.beHonest` |  | Be honest. This is what makes your weak-topic list useful. | Sach batayein. Isi se aap ki weak topics ki list sahi banti hai. | |
| 329 | `session.shortQDone` | keeps {total} {n} | {n} of {total} confident | {total} mein se {n} sahi | |
| 330 | `session.shortQDoneSub` |  | Anything you marked partly or missed feeds your weak topics. | Jo “thora sa” ya “nahi aaya” hain, woh weak topics mein chale jate hain. | |
| 331 | `session.papersTitle` |  | Past papers | Past papers | |
| 332 | `session.papersSub` |  | FBISE · Class 9 | FBISE · Class 9 | |
| 333 | `session.paperMeta` | keeps {marks} {h} {m} | {marks} marks · {h}h {m}m | {marks} marks · {h} ghante {m} min | |
| 334 | `session.viewPaper` |  | View paper | Paper dekhein | |
| 335 | `session.practiceAsExam` |  | Practise as test | Test ki tarah karein | |
| 336 | `session.papersFootnote` |  | Sample papers. The client supplies the real FBISE papers. | Yeh sample papers hain. Asli FBISE papers client dein ge. | |
| 337 | `session.practiceThisPaper` |  | Practise this paper | Yeh paper karein | |
| 338 | `session.fullPaper` |  | Full paper | Poora paper | |
| 339 | `session.realPaperNote` |  | A complete sample paper, laid out the way the board prints it. The client’s real papers load the same way. | Yeh mukammal sample paper hai, bilkul usi tarah jaise board chhapta hai. Client ke asli papers isi tarah load hon ge. | |
| 340 | `session.paperViewerNote` |  | In the live app this shows the client’s paper, with zoom and offline download. | Live app mein yahan client ka asli paper hoga, zoom aur offline download ke saath. | |

## AI tutor

Entry cards, chat, daily limit and the AI test builder.

| # | Key | Where / when it shows | English | Roman Urdu (current) | Suggested correction |
| --: | :-- | :-- | :-- | :-- | :-- |
| 341 | `tutor.title` |  | AI Tutor | AI Tutor | |
| 342 | `tutor.sub` |  | Ask anything, any time | Jo samajh na aaye, poochein | |
| 343 | `tutor.askDoubt` |  | Ask a question | Sawal poochein | |
| 344 | `tutor.askDoubtSub` |  | Type what’s confusing you | Jo samajh nahi aa raha likhein | |
| 345 | `tutor.explainTopic` |  | Explain a topic | Topic samjhayein | |
| 346 | `tutor.explainTopicSub` |  | From your chapters | Aap ke chapters se | |
| 347 | `tutor.solveQuestion` |  | Solve a question | Sawal hal karein | |
| 348 | `tutor.solveQuestionSub` |  | Step by step | Step by step | |
| 349 | `tutor.conceptClarity` |  | Make it simple | Asaan karein | |
| 350 | `tutor.conceptClaritySub` |  | Plain words and an example | Simple lafz aur aik misaal | |
| 351 | `tutor.makeTest` |  | Make me a test | Mera test banayein | |
| 352 | `tutor.makeTestSub` |  | AI picks questions from your weak topics | AI aap ke weak topics se sawal chunta hai | |
| 353 | `tutor.recentChats` |  | Recent questions | Pichle sawal | |
| 354 | `tutor.noChatsTitle` | No AI questions asked yet | No questions yet | Abhi koi sawal nahi | |
| 355 | `tutor.noChatsBody` | No AI questions asked yet | Ask your first question. It’s the fastest way to get unstuck. | Pehla sawal poochein. Atakne ka sab se tez hal yehi hai. | |
| 356 | `tutor.limitTitle` | Daily AI limit reached | Daily limit reached | Aaj ki limit khatam | |
| 357 | `tutor.limitBody` | Daily AI limit reached · keeps {n} | Your {n} questions reset at midnight. | Aap ke {n} sawal raat 12 baje reset ho jayein ge. | |
| 358 | `tutor.limitPremium` | Daily AI limit reached on the free plan | Premium gets 20 a day. | Premium mein rozana 20 milte hain. | |
| 359 | `tutor.limitToast` | Asking after the daily limit | Daily limit reached, resets at midnight | Aaj ki limit khatam, raat 12 baje reset | |
| 360 | `tutor.context` | keeps {label} | About: {label} | Baare mein: {label} | |
| 361 | `tutor.disclaimer` |  | AI can make mistakes, so check with your book. | AI se ghalti ho sakti hai, kitab se bhi check karein. | |
| 362 | `tutor.leftToday` | keeps {n} | {n} left today | Aaj {n} baqi | |
| 363 | `tutor.placeholder` |  | Ask anything… | Kuch bhi poochein… | |
| 364 | `tutor.thinking` |  | Thinking… | Soch raha hoon… | |
| 365 | `tutor.starter` |  | Ask anything: a concept, a question, or “explain this simply”. | Kuch bhi poochein: koi concept, sawal, ya “asaan lafzon mein samjhayein”. | |
| 366 | `tutor.inUrdu` |  | In Urdu | Urdu mein | |
| 367 | `tutor.helpful` | Thumbs up on an AI answer | Thanks, noted | Shukriya, note kar liya | |
| 368 | `tutor.notHelpful` | Thumbs down on an AI answer | Noted, we’ll improve this answer | Note kar liya, jawab behtar karein ge | |
| 369 | `tutor.photoSoon` |  | Photo questions arrive with the live tutor | Tasveer se sawal live tutor ke saath aayega | |
| 370 | `tutor.reExplainUrdu` |  | Explain this again in simple Urdu | Yehi baat asaan Urdu mein samjhayein | |
| 371 | `tutor.aiTestTitle` |  | AI test | AI test | |
| 372 | `tutor.aiTestSub` |  | Built from your weak topics | Aap ke weak topics se bana | |
| 373 | `tutor.focusOn` |  | Focus on | Kis par focus karein | |
| 374 | `tutor.difficulty` |  | Difficulty | Mushkil | |
| 375 | `tutor.easyStart` |  | Easy start | Asaan | |
| 376 | `tutor.boardLevel` |  | Board level | Board level | |
| 377 | `tutor.challenge` |  | Challenge | Mushkil | |
| 378 | `tutor.generate` |  | Make my test | Mera test banayein | |
| 379 | `tutor.notEnoughTitle` | Not enough answers to build an AI test | Not enough data yet | Abhi kaafi data nahi | |
| 380 | `tutor.notEnoughBody` | Not enough answers to build an AI test | Answer a few questions first, then the AI knows what to drill you on. | Pehle kuch sawal hal karein, phir AI ko pata chale ga kis par practice karani hai. | |
| 381 | `tutor.practiceTen` |  | Practise 10 MCQs | 10 MCQs karein | |
| 382 | `tutor.aiTestNote` |  | In the live app the AI writes fresh questions from your chapters, and an admin approves them before students see them. | Live app mein AI aap ke chapters se naye sawal banata hai, aur admin unhein approve karta hai. | |
| 383 | `tutor.accuracyOver` | keeps {total} {n} | {n}% accuracy over {total} questions | {total} sawalon mein {n}% accuracy | |
| 384 | `tutor.add` |  | Add | Shamil karein | |

## Progress and insights

Overview, performance charts, weak topics and the report card.

| # | Key | Where / when it shows | English | Roman Urdu (current) | Suggested correction |
| --: | :-- | :-- | :-- | :-- | :-- |
| 385 | `progress.title` |  | Progress | Progress | |
| 386 | `progress.sub` |  | See how far you’ve come | Dekhein aap kitna aagey aaye | |
| 387 | `progress.syllabusCovered` |  | Syllabus covered | Syllabus mukammal | |
| 388 | `progress.streakAlive` | A streak is running · keeps {n} | {n}-day streak. Keep it going. | {n} din ki streak. Jari rakhein. | |
| 389 | `progress.noStreak` | No streak | Study today to start a streak. | Aaj parhein aur streak shuru karein. | |
| 390 | `progress.tests` |  | tests | tests | |
| 391 | `progress.bySubject` |  | By subject | Subject ke hisaab se | |
| 392 | `progress.weakTopics` |  | Weak topics | Weak topics | |
| 393 | `progress.weakEmpty` | Not enough data for weak topics | Practise a bit more and we’ll point out weak spots once there’s enough data. | Thori aur practice karein, phir hum aap ke kamzor topics bata dein ge. | |
| 394 | `progress.reportCard` | keeps {month} | {month} report card | {month} ka report card | |
| 395 | `progress.reportCardSub` | keeps {grade} | Overall {grade} · share with your parents | Overall {grade} · walidain ke saath share karein | |
| 396 | `progress.open` |  | Open | Kholein | |
| 397 | `progress.perfTitle` |  | Performance | Performance | |
| 398 | `progress.perfSub` | keeps {n} | {n} questions in this range | Is arse mein {n} sawal | |
| 399 | `progress.week` |  | Week | Hafta | |
| 400 | `progress.month` |  | Month | Mahana | |
| 401 | `progress.allTime` |  | All time | Sab | |
| 402 | `progress.accuracyTrend` |  | Accuracy trend | Accuracy ka trend | |
| 403 | `progress.questionsPerDay` |  | Questions per day | Rozana sawal | |
| 404 | `progress.notEnoughData` | Chart range has no answers | Not enough data in this range yet. | Is arse ka abhi kaafi data nahi. | |
| 405 | `progress.daysAgo` | keeps {n} | {n} days ago | {n} din pehle | |
| 406 | `progress.today` | keeps {n} | today · {n}% | aaj · {n}% | |
| 407 | `progress.confidenceTitle` |  | How sure vs how right | Kitne pakke vs kitne sahi | |
| 408 | `progress.saidTimes` | keeps {n} {times} | {n}% right · {times}× | {n}% sahi · {times} baar | |
| 409 | `progress.notUsed` | A confidence level never used | not used yet | abhi istemal nahi hua | |
| 410 | `progress.testsTitle` |  | Tests | Tests | |
| 411 | `progress.noTests` | No timed tests taken | No tests yet. Try a timed test to see how you do under pressure. | Abhi koi test nahi. Timed test se andaza hoga ke pressure mein kaisa karte hain. | |
| 412 | `progress.weakTitle` |  | Weak topics | Weak topics | |
| 413 | `progress.weakSub` |  | Spotted from your own answers | Aap ke apne jawabon se nikale gaye | |
| 414 | `progress.weakNoneTitle` | Not enough data for weak topics | Nothing flagged yet | Abhi kuch nahi | |
| 415 | `progress.weakNoneBody` | Not enough data for weak topics | Practise a bit first. We look for topics where you drop below 75%. | Pehle thori practice karein. Hum wo topics dhoondte hain jahan 75% se neeche aate hain. | |
| 416 | `progress.rightOutOf` | keeps {total} {right} | {right} right out of {total} | {total} mein se {right} sahi | |
| 417 | `progress.studyBtn` |  | Study | Parhein | |
| 418 | `progress.practiceTen` |  | Practise 10 | 10 sawal karein | |
| 419 | `progress.weakFootnote` |  | A topic appears here after at least 3 answers below 75% accuracy. | Koi topic tab aata hai jab kam az kam 3 jawab 75% se neeche hon. | |
| 420 | `progress.reportTitle` |  | Report card | Report card | |
| 421 | `progress.monthlyReport` | keeps {month} | Monthly report · {month} | Mahana report · {month} | |
| 422 | `progress.activeDays` | keeps {n} | {n} active days | {n} din parha | |
| 423 | `progress.share` |  | Share | Share karein | |
| 424 | `progress.savePdf` |  | Save PDF | PDF save karein | |
| 425 | `progress.reportFootnote` |  | Grades come from your accuracy this month. Parents can view a shared card without an account. | Grades is mahine ki accuracy se bante hain. Walidain bina account ke share kiya card dekh sakte hain. | |
| 426 | `progress.shareToast` |  | Share sheet sends the card as an image | Share sheet card ko tasveer ki soorat mein bhejti hai | |
| 427 | `progress.pdfToast` |  | PDF export arrives with the reports milestone | PDF export reports milestone ke saath aaye ga | |

## Profile, subscription, settings and help

Everything under the profile tab, including the FAQ answers.

| # | Key | Where / when it shows | English | Roman Urdu (current) | Suggested correction |
| --: | :-- | :-- | :-- | :-- | :-- |
| 428 | `account.title` |  | Profile | Profile | |
| 429 | `account.classLine` | keeps {class} {board} {medium} | Class {class} · {board} · {medium} medium | Class {class} · {board} · {medium} medium | |
| 430 | `account.premiumActive` | Premium is active | Premium active | Premium active hai | |
| 431 | `account.premiumTill` | Premium is active · keeps {date} | Till {date} · renews manually | {date} tak · khud renew karna hota hai | |
| 432 | `account.freeMode` | Free plan | Free mode | Free mode | |
| 433 | `account.freeModeSub` | Free plan | 5 MCQs and 5 AI questions a day | Rozana 5 MCQs aur 5 AI sawal | |
| 434 | `account.upgrade` |  | Upgrade | Upgrade karein | |
| 435 | `account.levelLine` | keeps {xp} {level} | {xp} XP · Level {level} | {xp} XP · Level {level} | |
| 436 | `account.toNextLevel` | keeps {n} | {n} to go | {n} baqi | |
| 437 | `account.accountSection` |  | Account | Account | |
| 438 | `account.paymentHistory` |  | Payment history | Payment history | |
| 439 | `account.downloads` |  | Downloads | Downloads | |
| 440 | `account.downloadsSub` | keeps {n} | {n} chapters offline | {n} chapters offline | |
| 441 | `account.notifications` |  | Notifications | Notifications | |
| 442 | `account.settings` |  | Settings | Settings | |
| 443 | `account.help` |  | Help and support | Madad aur support | |
| 444 | `account.version` | keeps {v} | MatricMate demo · v{v} | MatricMate demo · v{v} | |
| 445 | `account.editTitle` |  | Edit profile | Profile edit karein | |
| 446 | `account.avatar` |  | Avatar | Avatar | |
| 447 | `account.studySetup` |  | Study setup | Parhai ki settings | |
| 448 | `account.classAndBoard` |  | Class and board | Class aur board | |
| 449 | `account.medium` |  | Medium | Medium | |
| 450 | `account.mySubjects` |  | My subjects | Mere subjects | |
| 451 | `account.subjectsCount` | keeps {n} | {n} selected | {n} chune gaye | |
| 452 | `account.editFootnote` |  | Changing class or board reloads your syllabus. Your old progress is kept. | Class ya board badalne par syllabus dobara load hoga. Purani progress mehfooz rahe gi. | |
| 453 | `account.profileSaved` | Profile saved | Profile saved | Profile save ho gayi | |
| 454 | `account.subscriptionTitle` |  | Subscription | Subscription | |
| 455 | `account.planLine` |  | Premium · Rs 1,000/month | Premium · Rs 1,000/mahana | |
| 456 | `account.activeTill` | keeps {date} | Active till {date} | {date} tak active | |
| 457 | `account.limitedAccess` |  | Limited practice and AI questions | Mehdood practice aur AI sawal | |
| 458 | `account.active` |  | Active | Active | |
| 459 | `account.inactive` |  | Inactive | Band | |
| 460 | `account.paymentMethod` |  | Payment method | Payment ka tareeqa | |
| 461 | `account.lastReceipt` | keeps {ref} | Last receipt {ref} | Aakhri receipt {ref} | |
| 462 | `account.renewNow` |  | Renew now · Rs 1,000 | Ab renew karein · Rs 1,000 | |
| 463 | `account.cancelSub` |  | Cancel subscription | Subscription band karein | |
| 464 | `account.noAutoCharge` |  | No automatic charge. We remind you two days before it ends and you renew yourself. | Khud-ba-khud paise nahi katte. Khatam hone se do din pehle hum yaad dilate hain aur aap renew karte hain. | |
| 465 | `account.cancelTitle` | Cancel-subscription dialog | Cancel Premium? | Premium band karna hai? | |
| 466 | `account.cancelBody` | Cancel-subscription dialog | You keep access until the date you’ve already paid for. Downloads stay on your phone. | Jis tareekh tak paise diye hain, tab tak chalta rahe ga. Downloads phone par rahein ge. | |
| 467 | `account.keepPremium` |  | Keep Premium | Premium rakhein | |
| 468 | `account.cancelled` | Subscription cancelled | Premium cancelled | Premium band kar diya | |
| 469 | `account.paymentsTitle` |  | Payment history | Payment history | |
| 470 | `account.noPaymentsTitle` | No payments yet | No payments yet | Abhi koi payment nahi | |
| 471 | `account.noPaymentsBody` | No payments yet | Receipts appear here after your first Premium payment. | Pehli Premium payment ke baad receipts yahan aayein gi. | |
| 472 | `account.paidLabel` |  | Paid | Ada shuda | |
| 473 | `account.receiptLine` | keeps {amount} | Rs {amount} · Premium | Rs {amount} · Premium | |
| 474 | `account.paymentsFootnote` |  | Every receipt carries a Safepay reference you can quote to support. | Har receipt par Safepay reference hota hai jo support ko bata sakte hain. | |
| 475 | `account.settingsTitle` |  | Settings | Settings | |
| 476 | `account.appearance` |  | Appearance | Shakal o soorat | |
| 477 | `account.darkMode` |  | Dark mode | Dark mode | |
| 478 | `account.darkModeSub` |  | Arrives with the polish milestone | Polish milestone ke saath aaye ga | |
| 479 | `account.darkToast` |  | Dark mode lands in the polish milestone | Dark mode polish milestone mein aaye ga | |
| 480 | `account.content` |  | Content | Content | |
| 481 | `account.contentMedium` |  | Study medium | Parhai ka medium | |
| 482 | `account.contentMediumSub` |  | Your notes and questions come in this language | Notes aur sawal isi zubaan mein aate hain | |
| 483 | `account.readingSize` |  | Reading text size | Parhne ka text size | |
| 484 | `account.notificationsSection` |  | Notifications | Notifications | |
| 485 | `account.studyReminder` |  | Study reminder | Parhai ka reminder | |
| 486 | `account.studyReminderSub` | keeps {time} | Daily · {time} | Rozana · {time} | |
| 487 | `account.streakAlerts` |  | Streak alerts | Streak alerts | |
| 488 | `account.streakAlertsSub` |  | Remind me before I break a streak | Streak tootne se pehle yaad dilayein | |
| 489 | `account.storage` |  | Storage | Storage | |
| 490 | `account.manageDownloads` |  | Manage downloads | Downloads manage karein | |
| 491 | `account.chaptersCount` | keeps {n} | {n} chapters | {n} chapters | |
| 492 | `account.resetDemo` |  | Reset demo data | Demo data reset karein | |
| 493 | `account.resetDemoSub` |  | Clears progress, answers and receipts | Progress, jawab aur receipts saaf ho jayein ge | |
| 494 | `account.resetDone` | Demo data cleared | Demo data cleared | Demo data saaf ho gaya | |
| 495 | `account.about` |  | About | App ke baare mein | |
| 496 | `account.terms` |  | Terms and privacy | Terms aur privacy | |
| 497 | `account.termsToast` |  | Legal pages ship with the landing page | Legal pages landing page ke saath aayein ge | |
| 498 | `account.helpTitle` |  | Help and support | Madad aur support | |
| 499 | `account.whatsapp` |  | Chat on WhatsApp · 10am–10pm | WhatsApp par baat karein · 10am–10pm | |
| 500 | `account.whatsappToast` |  | Opens WhatsApp with the support number in the live app | Live app mein WhatsApp support number ke saath khulta hai | |
| 501 | `account.commonQuestions` |  | Common questions | Aam sawal | |
| 502 | `account.faq1Q` |  | How do I renew Premium? | Premium kaise renew karoon? | |
| 503 | `account.faq1A` |  | Profile → Subscription → Renew now. JazzCash, EasyPaisa or card. Rs 1,000 for a month. | Profile → Subscription → Ab renew karein. JazzCash, EasyPaisa ya card. Rs 1,000 aik mahine ke liye. | |
| 504 | `account.faq2Q` |  | Does it work without internet? | Kya bina internet chalta hai? | |
| 505 | `account.faq2A` |  | Downloaded chapters, audio and MCQs work offline. The AI tutor and timed tests need a connection. | Download kiye chapters, audio aur MCQs offline chalte hain. AI tutor aur timed test ke liye internet chahiye. | |
| 506 | `account.faq3Q` |  | Why is the AI limited each day? | AI ki rozana limit kyun hai? | |
| 507 | `account.faq3A` |  | Daily limits keep MatricMate affordable. Premium gets 20 questions a day, free mode gets 5. | Limit se app sab ke liye sasti rehti hai. Premium mein rozana 20 sawal, free mode mein 5. | |
| 508 | `account.faq4Q` |  | Can my parents see my progress? | Kya walidain meri progress dekh sakte hain? | |
| 509 | `account.faq4A` |  | Yes. Share your monthly report card from Progress. They don’t need an account. | Ji haan. Progress se mahana report card share karein. Unhein account ki zarurat nahi. | |
| 510 | `account.stillStuck` |  | Still stuck? | Phir bhi masla hai? | |
| 511 | `account.reportProblem` |  | Report a problem | Masla report karein | |
| 512 | `account.reportToast` |  | Problem report form ships with the polish milestone | Report form polish milestone ke saath aaye ga | |
| 513 | `account.replyTime` |  | Typical reply time in the live app: under two hours during support hours. | Live app mein jawab aam tor par do ghante ke andar milta hai. | |

## Status messages

Offline, error and locked states.

| # | Key | Where / when it shows | English | Roman Urdu (current) | Suggested correction |
| --: | :-- | :-- | :-- | :-- | :-- |
| 514 | `states.offline` | Device is offline | You’re offline. Downloaded content still works. | Internet nahi hai. Download kiya hua content phir bhi chalta hai. | |
| 515 | `states.errorTitle` | Content failed to load | Couldn’t load this | Load nahi ho saka | |
| 516 | `states.errorBody` | Content failed to load | Check your connection and try again. | Apna internet check karein aur dobara koshish karein. | |
| 517 | `states.premiumLocked` | A Premium chapter is opened | This chapter is Premium | Yeh chapter Premium hai | |
| 518 | `states.unlock` |  | Unlock | Unlock karein | |

---

# Part 2 · Study content in Urdu script

Nastaliq text: subject and chapter names, the Urdu past paper, Urdu notes and flashcard
translations. Some of this is placeholder content that the client will replace with their own
material, but it is all currently visible in the prototype.

| # | Urdu (current) | What it is | Where in the code | Suggested correction |
| --: | :-- | :-- | :-- | :-- |
| 1 | اردو | Landing page, trust strip | `apps/web/app/page.tsx:130`<br>`apps/web/components/landing/AudioSample.tsx:68`<br>`apps/web/components/screens/SettingsView.tsx:68`<br>`apps/mobile/src/components/LanguageToggle.tsx:14`<br>`apps/mobile/app/account/settings.tsx:63`<br>`packages/core/src/content.ts:29` | |
| 2 | اردو میڈیم | Onboarding, medium choice | `apps/web/components/onboarding/ChooseMedium.tsx:40`<br>`apps/mobile/app/onboarding/medium.tsx:38` | |
| 3 | منتخب آیات، ترجمہ اور تشریح | Study content | `packages/core/src/content.ts:101` | |
| 4 | قرآن مجید | Study content | `packages/core/src/content.ts:101` | |
| 5 | احادیث کا مفہوم اور اطلاق | Study content | `packages/core/src/content.ts:102` | |
| 6 | حدیثِ نبوی | Study content | `packages/core/src/content.ts:102` | |
| 7 | توحید و رسالت | Study content | `packages/core/src/content.ts:103` | |
| 8 | بنیادی عقائد | Study content | `packages/core/src/content.ts:103` | |
| 9 | نماز، روزہ، زکوٰۃ، حج | Study content | `packages/core/src/content.ts:104` | |
| 10 | عبادات | Study content | `packages/core/src/content.ts:104` | |
| 11 | Life of the Prophet ﷺ. | Study content | `packages/core/src/content.ts:105` | |
| 12 | مکی و مدنی دور | Study content | `packages/core/src/content.ts:105` | |
| 13 | سیرتِ طیبہ | Study content | `packages/core/src/content.ts:105` | |
| 14 | حقوق العباد اور معاشرتی اخلاق | Study content | `packages/core/src/content.ts:106` | |
| 15 | اخلاقیات | Study content | `packages/core/src/content.ts:106` | |
| 16 | جسم کی وہ خاصیت جو اپنی حالتِ سکون یا یکساں حرکت میں تبدیلی کی مزاحمت کرتی ہے، اسے جڑت (inertia) کہتے ہیں۔ | Study content | `packages/core/src/content.ts:175` | |
| 17 | جب کسی جسم پر خالص قوت عمل کرتی ہے تو وہ قوت کی سمت میں اسراع پیدا کرتی ہے۔ | Study content | `packages/core/src/content.ts:206` | |
| 18 | قوت اور جڑت | Study content | `packages/core/src/content.ts:263` | |
| 19 | قوت کیا ہے؟ | Study content | `packages/core/src/content.ts:265` | |
| 20 | قوت وہ عامل ہے جو کسی جسم کو حرکت دیتی ہے یا حرکت دینے کی کوشش کرتی ہے، چلتے ہوئے جسم کو روکتی ہے یا روکنے کی کوشش کرتی ہے، اور کسی جسم کی سمت یا شکل تبدیل کر سکتی ہے۔ قوت ایک سمتی مقدار ہے یعنی اس کی مقدار بھی ہوتی ہے اور سمت بھی۔ اس کا بین الاقوامی یونٹ نیوٹن ہے۔ | Study content | `packages/core/src/content.ts:268` | |
| 21 | جسم کی وہ خاصیت جو اس کی حالتِ سکون یا یکساں حرکت میں تبدیلی کی مزاحمت کرتی ہے۔ کمیت جتنی زیادہ، جڑت اتنی ہی زیادہ۔ | Study content | `packages/core/src/content.ts:270` | |
| 22 | جڑت (Inertia) | Study content | `packages/core/src/content.ts:270` | |
| 23 | بس اچانک چلے تو مسافر پیچھے کی طرف جھٹکا کھاتے ہیں: نچلا دھڑ بس کے ساتھ چل پڑتا ہے جبکہ اوپر کا دھڑ جڑت کی وجہ سے لمحہ بھر ساکن رہتا ہے۔ | Study content | `packages/core/src/content.ts:273` | |
| 24 | نیوٹن کا پہلا قانونِ حرکت | Study content | `packages/core/src/content.ts:279` | |
| 25 | جڑت کا قانون | Study content | `packages/core/src/content.ts:281` | |
| 26 | ہر جسم اپنی حالتِ سکون یا سیدھی لکیر میں یکساں حرکت کی حالت برقرار رکھتا ہے جب تک اس پر کوئی خالص بیرونی قوت عمل نہ کرے۔ اسی لیے اسے جڑت کا قانون بھی کہا جاتا ہے۔ | Study content | `packages/core/src/content.ts:284` | |
| 27 | میز پر رکھی کتاب اُس وقت تک ساکن رہتی ہے جب تک اسے دھکا نہ دیا جائے۔ | Study content | `packages/core/src/content.ts:289` | |
| 28 | ہموار فرش پر لڑھکتی گیند رگڑ کی وجہ سے رُکتی ہے۔ | Study content | `packages/core/src/content.ts:290` | |
| 29 | گاڑی کی اچانک بریک پر سیٹ بیلٹ مسافر کو محفوظ رکھتی ہے۔ | Study content | `packages/core/src/content.ts:291` | |
| 30 | نیوٹن کا دوسرا قانونِ حرکت | Study content | `packages/core/src/content.ts:298` | |
| 31 | اسلامیات | Study content | `packages/core/src/content.ts:30` | |
| 32 | قوت، کمیت اور اسراع | Study content | `packages/core/src/content.ts:300` | |
| 33 | جب کسی جسم پر خالص قوت عمل کرتی ہے تو وہ قوت کی سمت میں اسراع پیدا کرتی ہے۔ اسراع قوت کے راست متناسب اور جسم کی کمیت کے بالعکس متناسب ہوتا ہے۔ | Study content | `packages/core/src/content.ts:303` | |
| 34 | قوت = کمیت × اسراع | Study content | `packages/core/src/content.ts:305` | |
| 35 | وہ قوت جو 1 کلوگرام کمیت میں 1 میٹر فی سیکنڈ مربع اسراع پیدا کرے۔ | Study content | `packages/core/src/content.ts:306` | |
| 36 | نیوٹن (N) | Study content | `packages/core/src/content.ts:306` | |
| 37 | 1,200 کلوگرام کی گاڑی کو 2 میٹر فی سیکنڈ مربع اسراع دینے کے لیے 2,400 نیوٹن خالص قوت درکار ہو گی۔ | Study content | `packages/core/src/content.ts:309` | |
| 38 | تیسرا قانون اور معیارِ حرکت | Study content | `packages/core/src/content.ts:315` | |
| 39 | عمل اور ردِعمل | Study content | `packages/core/src/content.ts:317` | |
| 40 | ہر عمل کا برابر اور مخالف ردِعمل ہوتا ہے۔ عمل اور ردِعمل دو مختلف اجسام پر عمل کرتے ہیں، اسی لیے وہ ایک دوسرے کو ختم نہیں کرتے۔ | Study content | `packages/core/src/content.ts:320` | |
| 41 | جسم کی حرکت کی مقدار، جو کمیت اور رفتار کے حاصل ضرب کے برابر ہے۔ یونٹ: kg·m/s | Study content | `packages/core/src/content.ts:322` | |
| 42 | معیارِ حرکت (Momentum) | Study content | `packages/core/src/content.ts:322` | |
| 43 | معیارِ حرکت = کمیت × رفتار | Study content | `packages/core/src/content.ts:323` | |
| 44 | جسم کی وہ خاصیت جو حالت میں تبدیلی کی مزاحمت کرے | Study content | `packages/core/src/content.ts:335` | |
| 45 | حصہ اول · معروضی | Study content | `packages/core/src/content.ts:645` | |
| 46 | 15 نمبر · 20 منٹ | Study content | `packages/core/src/content.ts:646` | |
| 47 | سوال نمبر ۱: درست جواب پر دائرہ لگائیں۔ ہر جز کا ایک نمبر ہے۔ | Study content | `packages/core/src/content.ts:649` | |
| 48 | (i) "نصوح" کس افسانے کا کردار ہے؟  (الف) توبۃ النصوح  (ب) امراؤ جان ادا  (ج) گئودان  (د) آگ کا دریا | Study content | `packages/core/src/content.ts:650` | |
| 49 | (ii) غالبؔ کا اصل نام کیا تھا؟  (الف) اسد اللہ خان  (ب) نظام الدین  (ج) میر تقی  (د) الطاف حسین | Study content | `packages/core/src/content.ts:651` | |
| 50 | (iii) "قومی ترانہ" کے شاعر کون ہیں؟  (الف) حفیظ جالندھری  (ب) علامہ اقبال  (ج) فیض احمد فیض  (د) احمد ندیم قاسمی | Study content | `packages/core/src/content.ts:652` | |
| 51 | (iv) اسم کی کتنی اقسام ہیں؟  (الف) دو  (ب) تین  (ج) چار  (د) پانچ | Study content | `packages/core/src/content.ts:653` | |
| 52 | (v) "دل" کا مترادف لفظ ہے:  (الف) قلب  (ب) جگر  (ج) نظر  (د) سماعت | Study content | `packages/core/src/content.ts:654` | |
| 53 | حصہ دوم · مختصر سوالات | Study content | `packages/core/src/content.ts:658` | |
| 54 | 36 نمبر | Study content | `packages/core/src/content.ts:659` | |
| 55 | سوال نمبر ۲: کوئی سے بارہ اجزا کے مختصر جواب لکھیں۔ ہر جز کے تین نمبر ہیں۔ | Study content | `packages/core/src/content.ts:662` | |
| 56 | (i) سبق "توبۃ النصوح" کا مرکزی خیال بیان کریں۔ | Study content | `packages/core/src/content.ts:663` | |
| 57 | (ii) نصوح کے کردار کی تین نمایاں خصوصیات لکھیں۔ | Study content | `packages/core/src/content.ts:664` | |
| 58 | (iii) سلیم کے کردار پر مختصر نوٹ لکھیں۔ | Study content | `packages/core/src/content.ts:665` | |
| 59 | (iv) درج ذیل الفاظ کے معنی لکھیں: نصیحت، ندامت، اصلاح۔ | Study content | `packages/core/src/content.ts:666` | |
| 60 | (v) محاورے کو جملوں میں استعمال کریں: آنکھیں کھلنا، ہاتھ بٹانا۔ | Study content | `packages/core/src/content.ts:667` | |
| 61 | (vi) اسم اور فعل کی تعریف مثال کے ساتھ لکھیں۔ | Study content | `packages/core/src/content.ts:668` | |
| 62 | (vii) واحد جمع بنائیں: کتاب، قلم، شہر۔ | Study content | `packages/core/src/content.ts:669` | |
| 63 | (viii) نعت کی تعریف کریں اور اس کی خصوصیات لکھیں۔ | Study content | `packages/core/src/content.ts:670` | |
| 64 | حصہ سوم · تفصیلی سوالات | Study content | `packages/core/src/content.ts:674` | |
| 65 | 24 نمبر | Study content | `packages/core/src/content.ts:675` | |
| 66 | نوٹ: تمام سوالات حل کریں۔ | Study content | `packages/core/src/content.ts:678` | |
| 67 | سوال نمبر ۳: درج ذیل اشعار کی تشریح کریں۔ (۸ نمبر) | Study content | `packages/core/src/content.ts:679` | |
| 68 | سوال نمبر ۴: "علم کی اہمیت" کے موضوع پر مضمون تحریر کریں۔ (۱۰ نمبر) | Study content | `packages/core/src/content.ts:680` | |
| 69 | سوال نمبر ۵: اپنے ہیڈ ماسٹر کے نام فیس معافی کی درخواست لکھیں۔ (۶ نمبر) | Study content | `packages/core/src/content.ts:681` | |
| 70 | نعت کی تشریح، مشکل الفاظ اور معنی | Study content | `packages/core/src/content.ts:91` | |
| 71 | نعت | Study content | `packages/core/src/content.ts:91` | |
| 72 | سبق کا خلاصہ اور سوالات | Study content | `packages/core/src/content.ts:92` | |
| 73 | ہجرتِ نبوی | Study content | `packages/core/src/content.ts:92` | |
| 74 | شخصیت، غزل کی تشریح | Study content | `packages/core/src/content.ts:93` | |
| 75 | مرزا غالب | Study content | `packages/core/src/content.ts:93` | |
| 76 | کردار نگاری، سبق کا خلاصہ | Study content | `packages/core/src/content.ts:94` | |
| 77 | نصوح اور سلیم | Study content | `packages/core/src/content.ts:94` | |
| 78 | مطالعہ اور تشریح | Study content | `packages/core/src/content.ts:95` | |
| 79 | قومی ترانہ | Study content | `packages/core/src/content.ts:95` | |
| 80 | اسم، فعل، حروف، محاورات | Study content | `packages/core/src/content.ts:96` | |
| 81 | گرامر | Study content | `packages/core/src/content.ts:96` | |
| 82 | درخواست اور خط کے نمونے | Study content | `packages/core/src/content.ts:97` | |
| 83 | خط نویسی | Study content | `packages/core/src/content.ts:97` | |
| 84 | مضامین کے خاکے اور نمونے | Study content | `packages/core/src/content.ts:98` | |
| 85 | مضمون نویسی | Study content | `packages/core/src/content.ts:98` | |

---

# Part 3 · Roman Urdu outside the interface files

Sentences written directly into a screen or into the mock AI tutor, rather than into the
language files. These appear in **both** language modes, so they need to read well next to
English.

| # | Current text | What it is | Where in the code | Suggested correction |
| --: | :-- | :-- | :-- | :-- |
| 1 | Speed = only how fast (magnitude). 60 km/h, bas. | AI tutor answer about speed vs velocity | `packages/core/src/api.ts`:133 | |
| 2 | Direction badle to velocity badal jati hai, even at constant speed. That’s why circular motion has acceleration! | AI tutor answer about speed vs velocity | `packages/core/src/api.ts`:135 | |
| 3 | Inertia, asaan alfaaz mein: | AI tutor answer about inertia | `packages/core/src/api.ts`:149 | |
| 4 | Bus achanak ruke to aap aage gir jate hain, kyunke upper body inertia ki wajah se chalta rehta hai. | AI tutor answer about inertia | `packages/core/src/api.ts`:153 | |
| 5 | Pehle yeh dekho ke question kis concept ka hai, phir usko naam do. | AI tutor fallback answer, step 1 | `packages/core/src/api.ts`:159 | |
| 6 | Us concept ki definition aur formula likho, phir given values daalo. | AI tutor fallback answer, step 2 | `packages/core/src/api.ts`:160 | |
| 7 | Answer ko unit ke saath likho aur ek line mein reason batao. | AI tutor fallback answer, step 3 | `packages/core/src/api.ts`:161 | |
| 8 | Pakka ✓ / Thora sure / Tukka 🎲 | Confidence labels in the analytics breakdown. Note the middle one mixes Urdu and English | `packages/core/src/domain.ts`:67 | |
| 9 | Jab tum Pakka kehte ho, {accuracy}% sahi hota hai, trust yourself. | Coaching line, shown when confident answers are usually right | `packages/core/src/domain.ts`:80 | |
| 10 | Pakka wale jawab sirf {accuracy}% sahi hain. Un topics ko dobara dekho, confidence dhoka de raha hai. | Coaching line, shown when confident answers are often wrong | `packages/core/src/domain.ts`:82 | |
| 11 | Tukka answers {accuracy}% sahi hain vs Pakka {accuracy}%. Guessing kam karne ke liye practice barhao. | Coaching line, shown when guessing is close to certainty | `packages/core/src/domain.ts`:84 | |
| 12 | Thora aur practice karo, phir confidence ka pattern saaf nazar aayega. | Coaching line, shown when there is not enough data | `packages/core/src/domain.ts`:85 | |
| 13 | Parh liya, phir bhool gaya | Landing page, first problem card | `apps/web/app/page.tsx`:19 | |
| 14 | Raat ko koi poochne wala nahi | Landing page, second problem card | `apps/web/app/page.tsx`:24 | |
| 15 | Pata hi nahi kya kamzor hai | Landing page, third problem card | `apps/web/app/page.tsx`:29 | |
| 16 | Poori tayyari, aik hi jagah. | Landing page, tagline under the headline | `apps/web/app/page.tsx`:101 | |
| 17 | Jab kisi jism par net force lagti hai to us force ki simt mein acceleration paida hoti hai. | Landing page, Urdu gloss under the sample chapter note | `apps/web/app/page.tsx`:213 | |
| 18 | Tukka / Thora pakka / Pakka | Confidence labels defined for the hero demo | `apps/web/components/landing/HeroDemo.tsx`:15-17 | |
| 19 | Streak alive, shabash! | Sample notification title. Same text in `apps/mobile/src/store/app.tsx:187` | `apps/web/lib/seed.ts`:56 | |

---

## Notes for whoever applies the corrections

- Part 1 lives in `packages/core/src/i18n/strings.ts`, in the `ur` object. The key column is the
  path inside it, so `session.confHintSure` is `ur.session.confHintSure`.
- `ur` is typed against `en`, so a missing or misspelt key is a build error, not a silent bug.
- Part 2 and Part 3 give the file and line directly.
- Do not use an em dash (`—`) in any replacement text. Use a full stop, a comma, a colon, or a
  middot (`·`) for a label separator.
