import { CHAPTER_TITLES_UR, SUBJECT_NAMES_UR } from './i18n/names-ur';
/**
 * MOCK CONTENT. FBISE Class 9.
 *
 * Chapter names follow the real FBISE SSC-I scheme so the app looks true to life.
 * Authored study material exists for the demo path (Physics 1–4, Chemistry 2, Biology 4);
 * every other chapter gets plausible generated material so nothing dead-ends.
 * ALL of this is replaced by client-supplied content via the admin CMS (M7).
 */
import {
  Chapter,
  ChapterContent,
  Mcq,
  PaperSection,
  Section,
  Subject,
} from './types';

export const SUBJECTS: Subject[] = [
  { id: 'phy', name: 'Physics', urduName: SUBJECT_NAMES_UR['phy'], icon: 'bolt', compulsory: false, group: 'science', chapterCount: 9 },
  { id: 'chem', name: 'Chemistry', urduName: SUBJECT_NAMES_UR['chem'], icon: 'flask', compulsory: false, group: 'science', chapterCount: 20 },
  { id: 'bio', name: 'Biology', urduName: SUBJECT_NAMES_UR['bio'], icon: 'leaf', compulsory: false, group: 'science', chapterCount: 10 },
  { id: 'math', name: 'Mathematics', urduName: SUBJECT_NAMES_UR['math'], icon: 'calc', compulsory: true, chapterCount: 17 },
  { id: 'eng', name: 'English', urduName: SUBJECT_NAMES_UR['eng'], icon: 'book', compulsory: true, chapterCount: 4 },
  { id: 'urd', name: 'Urdu', urduName: 'اردو', icon: 'quill', compulsory: true, chapterCount: 5 },
  { id: 'isl', name: 'Islamiyat', urduName: 'اسلامیات', icon: 'star', compulsory: true, chapterCount: 7 },
  { id: 'pst', name: 'Pakistan Studies', urduName: SUBJECT_NAMES_UR['pst'], icon: 'globe', compulsory: true, chapterCount: 8 },
  { id: 'cs', name: 'Computer Science', urduName: SUBJECT_NAMES_UR['cs'], icon: 'book2', compulsory: false, group: 'science', chapterCount: 7 },
];

const CH: Record<string, [string, string, string?][]> = {
  // The board's own content areas, from the Table of Specification in the SSC-I
  // Assessment Framework, not the 2006 nine-unit scheme that used to be here.
  // The two disagree, and forcing NCP 2022-23 outcomes onto the old units left
  // Transfer of Heat with nothing in it, Gravitation with two outcomes, and all
  // fifteen Electricity and Magnetism outcomes, 16% of the paper, filed under
  // Properties of Matter. Mark weights per chapter live in data/fbise/chapters.json.
  phy: [
    ['Measurements', 'Physical quantities, SI units, prefixes, scientific notation, lab instruments and significant figures.'],
    ['Kinematics', 'Types of motion, distance and displacement, speed, velocity, acceleration, and motion graphs.'],
    ['Dynamics', 'Mass and weight, forces and free body diagrams, Newton’s laws, friction, momentum and equilibrium.'],
    ['Pressure and Deformation in Solids', 'Pressure in solids and fluids, density, Archimedes and Pascal, stress, strain and Hooke’s law.'],
    ['Work and Energy', 'Work, power, kinetic and potential energy, conservation of energy and efficiency.'],
    ['Heat and Thermodynamics', 'Temperature and heat, specific and latent heat, thermal expansion, and heat transfer.'],
    ['Electricity and Magnetism', 'Charge, current, voltage, resistance, circuits, magnetic fields and electromagnetism.'],
    ['Modern Physics', 'Beyond classical physics: the atom, radioactivity and the limits of everyday models.'],
    ['Nature of Science', 'How physics is done: evidence, models, uncertainty, and the place of science in society.'],
  ],
  // Twenty chapters, not eight. Now follows the board's Table of Specification:
  // each chapter is a content area from the SSC-I Assessment Framework, not the
  // old nine-unit scheme. See data/fbise/chapters.json for the mark weights.
  chem: [
    ['Nature of Science in Chemistry', 'What chemistry studies, its many branches, and how science differs from technology and engineering.'],
    ['Matter', 'States of matter, allotropes, mixtures versus pure substances, and how temperature affects solubility.'],
    ['Atomic Structure', 'The nucleus and electron shells, subatomic particles, isotopes, ions, and relative atomic mass.'],
    ['Chemical Bonding', 'Ionic, covalent, coordinate and metallic bonding, and how bond type explains a compound’s properties.'],
    ['Stoichiometry', 'The mole, Avogadro’s number, molar mass calculations, and balancing chemical and ionic equations.'],
    ['Electrochemistry', 'Oxidation and reduction, oxidation numbers, identifying redox agents, and preventing corrosion.'],
    ['Energetics', 'Exothermic and endothermic reactions, enthalpy change, activation energy, and reaction pathway diagrams.'],
    ['Chemical Equilibrium', 'Reversible reactions, how changing conditions shifts them, and what equilibrium means in a closed system.'],
    ['Acids, Bases chemistry and pH', 'Bronsted-Lowry acids and bases, strong versus weak, their reactions with metals and carbonates, acid rain.'],
    ['Periodic Table and Periodicity', 'How the periodic table is arranged, periodic trends, and predicting an element’s properties from its group.'],
    ['Group Properties and Elements', 'Alkali metals, halogens, transition elements and noble gases, and how metals differ from non-metals.'],
    ['Environmental Chemistry-Air', 'Air pollutants, the greenhouse effect, acid rain, and how catalytic converters cut vehicle emissions.'],
    ['Environmental Chemistry-Water', 'Testing and treating water, water-borne disease, and fertilisers as a source of water pollution.'],
    ['Organic Chemistry', 'Structural formulae, homologous series, isomers, functional groups, and saturated versus unsaturated compounds.'],
    ['Hydrocarbons', 'Alkanes as saturated hydrocarbons, their substitution reactions with chlorine, and how alkanes are prepared.'],
    ['Biochemistry', 'Carbohydrates, proteins, lipids and nucleic acids as biomolecules, and the basics of healthy nutrition.'],
    ['Scientific Notation/Standard Form', 'SI units, standard form for very large or small numbers, and choosing the right lab apparatus.'],
    ['Separation Techniques', 'Filtration, crystallisation and distillation, and choosing the right technique to separate a mixture.'],
    ['Qualitative Analysis', 'Tests to identify common gases, and the flame test used to identify metal cations.'],
    ['Chromatography', 'Paper chromatography, locating agents for colourless substances, and calculating the Rf value.'],
  ],
  // Ten chapters, not nine. Now follows the board's Table of Specification:
  // each chapter is a content area from the SSC-I Assessment Framework, not the
  // old scheme. See data/fbise/chapters.json for the mark weights.
  bio: [
    ['The science of biology', 'Biology’s branches and sub-fields, its links to other sciences, and the steps of the scientific method.'],
    ['Biodiversity', 'Why living things are classified, the three domains, taxonomic ranks, and binomial nomenclature.'],
    ['Cell', 'Animal and plant cell structure, organelles, specialised cell types, and what makes a stem cell unspecialised.'],
    ['Cell cycle', 'The cell cycle, the stages of mitosis and meiosis, and why each process matters to the organism.'],
    ['Tissues, organs & organ system', 'How cells build tissues, organs and systems, and how the body maintains homeostasis.'],
    ['Molecular biology', 'DNA, RNA, proteins, lipids and carbohydrates as biomolecules, and how DNA’s code becomes a protein.'],
    ['Metabolism', 'Enzymes and how they work, ATP as the cell’s energy currency, and photosynthesis and respiration.'],
    ['Plant physiology', 'Mineral nutrition, water and salt transport, transpiration, gas exchange and excretion in plants.'],
    ['Plant reproduction', 'Asexual and sexual reproduction in plants, vegetative propagation, artificial propagation, and cloning.'],
    ['Evolution', 'Natural selection, speciation, and the fossil and anatomical evidence for evolution.'],
  ],
  // Seventeen units, not ten. FBISE examines units 1-7, 14, 15 and 17-23 and 29
  // of the IX-X mathematics scheme in Class 9; the gaps are Class 10's. The
  // board's own numbering is kept in data/fbise/math.json for reference.
  // Titles and blurbs below follow what the 2024-25 Assessment Framework
  // (built on NCP 2022-23) actually examines, not the 2006 unit name, where
  // the two disagree: math-2 is sets and rational numbers, not complex
  // numbers; math-8 is relations, not linear graphs; math-14 is statistics
  // and probability, not ratio and proportion; math-15 is trigonometry, not
  // just Pythagoras; math-16 is areas and volumes of similar figures, not
  // area theorems generally. Chapters 1, 10 and 13 (Matrices, Congruent
  // Triangles, Sides and Angles of a Triangle) have no outcomes the board
  // examines in Class 9 under NCP 2022-23; their titles stay so a student
  // with an older textbook can still find them, but the blurb says so.
  math: [
    ['Matrices and Determinants', 'Matrix types, operations and determinants. Older FBISE textbooks include this chapter, but the current Class 9 syllabus does not test it, so there is nothing here to revise for your paper.'],
    ['Sets and Rational Numbers', 'Three-set Venn diagrams and set laws, plus real-life problems using rational numbers.'],
    ['Logarithms', 'Scientific notation, common and natural logs, laws of logarithms.'],
    ['Algebraic Expressions and Formulas', 'Rational expressions, surds, useful algebraic identities.'],
    ['Factorization', 'Factorising quadratics, cubes, remainder and factor theorems.'],
    ['Algebraic Manipulation', 'HCF and LCM, square root of an algebraic expression.'],
    ['Linear Equations and Inequalities', 'Solving equations, absolute value, inequality solution sets.'],
    ['Relations', 'Binary relations and their domain and range, shown as tables, ordered pairs or graphs.'],
    ['Introduction to Coordinate Geometry', 'Distance formula, collinear points, midpoint.'],
    ['Congruent Triangles', 'Congruence postulates and proofs for triangles. Older FBISE textbooks include this chapter, but the current Class 9 syllabus does not test it, so there is nothing here to revise for your paper.'],
    ['Parallelograms and Triangles', 'Properties of parallelograms, midpoint theorem and its converse.'],
    ['Line Bisectors and Angle Bisectors', 'Perpendicular bisectors, angle bisectors and their concurrency.'],
    ['Sides and Angles of a Triangle', 'Angle-side inequalities and the triangle inequality. Older FBISE textbooks include this chapter, but the current Class 9 syllabus does not test it, so there is nothing here to revise for your paper.'],
    ['Statistics and Probability', 'Mean, median, mode and modal class, plus probability and relative frequency.'],
    ['Trigonometry', 'Angles, trig ratios and identities, plus bearings and angles of elevation and depression.'],
    ['Areas and Volumes of Similar Figures', 'How the areas and volumes of similar figures and solids compare by scale factor.'],
    ['Practical Geometry: Triangles', 'Constructing triangles, and drawing their circles and bisectors.'],
  ],
  // Four chapters, not eight. Now follows the board's Table of Specification:
  // each chapter is a content area from the SSC-I Assessment Framework, a skill
  // strand rather than a set of prescribed readings. Oral Communication Skills
  // is taught but, per the framework, not assessed in the annual exam.
  eng: [
    ['Oral Communication Skills', 'Listening and speaking practice through discussion, role play and drama. Not assessed in the annual exam.'],
    ['Reading and Critical Thinking', 'Reading strategies for fiction and non-fiction, the author’s purpose and point of view, and summarising a text.'],
    ['Vocabulary and Grammar', 'Vocabulary in context, idioms, parts of speech, punctuation, tenses, and direct and indirect speech.'],
    ['Writing', 'Editing and proofreading, and writing narrative, descriptive and argumentative essays, letters and book reviews.'],
  ],
  // Five chapters, not eight. The first three follow the board's Table of
  // Specification: پڑھنا، لکھنا اور قواعد, the three domains the SSC-I paper
  // actually examines. سننا and بولنا are appended as chapters 4 and 5, the same
  // way English keeps Oral Communication Skills (eng-1): taught and judged in
  // class, never on the annual paper. Appended, not inserted, so urd-1..3 keep
  // their ids. See data/fbise/chapters.json for weights.
  urd: [
    ['پڑھنا', 'نظم و نثر کو سمجھ کر پڑھنا، اشعار کی تشریح اور رائے دینا، غزل میں مطلع و مقطع کی شناخت، اور متن پر تبصرہ۔', 'Reading.'],
    ['لکھنا', 'املا کی درستی، خط و درخواست، تلخیص و ترجمہ، مضمون و تقریر نویسی، اور نادیدہ اقتباس کا تجزیہ۔', 'Writing.'],
    ['قواعد / زبان شناسی', 'تذکیر و تانیث، اسم و فعل، تراکیب اور محاورات، جملوں کی درستی، اور اصنافِ سخن و علمِ بیان کی بنیادی اصطلاحات۔', 'Grammar and linguistics.'],
    ['سننا', 'واقعات، کہانی، تقریر اور شاعری کو توجہ سے سن کر سمجھنا، اور نشریات پر رائے دینا۔ یہ مہارت صرف جماعت میں جانچی جاتی ہے، سالانہ امتحانی پرچے میں شامل نہیں۔', 'Listening.'],
    ['بولنا', 'روزمرہ گفتگو میں مدلل بات چیت، کسی موضوع پر تقریر، اور اپنے موقف کا واضح اظہار۔ یہ مہارت صرف جماعت میں جانچی جاتی ہے، سالانہ امتحانی پرچے میں شامل نہیں۔', 'Speaking.'],
  ],
  // The board's seven دائرہ ہائے کار (strands), not the six approximations that
  // were here. Note strand 1 covers only the introduction to the Quran and the
  // preservation of hadith: ترجمۂ قرآن مجید is a separate 50 mark paper and is
  // not part of Islamiyat compulsory at all.
  isl: [
    ['قرآن مجید و حدیثِ نبوی ﷺ', 'تعارفِ قرآن مجید، حفاظت و تدوینِ حدیث، بیس احادیثِ مبارکہ اور سینتیس اسمائے حسنیٰ', 'Quran and Hadith.'],
    ['ایمانیات و عبادات', 'توحید، رسالت، ملائکہ، کتبِ سماویہ، آخرت، نماز، روزہ، زکوٰۃ، حج اور قربانی', 'Beliefs and acts of worship.'],
    ['سیرتِ رسول خاتم النبیین ﷺ', 'مدنی دور کے واقعات اور اُسوۂ رسول ﷺ کی روشنی میں عملی زندگی', 'Life of the Prophet ﷺ.'],
    ['اخلاق و آداب', 'شکر و قناعت، امانت و دیانت، اخلاص و تقویٰ، اور بری عادات سے اجتناب', 'Morals and manners.'],
    ['حسنِ معاملات و معاشرت', 'قسم، گواہی، ہمسایوں کے حقوق، سود کی حرمت، اسلامی ریاست اور جہاد', 'Dealings and society.'],
    ['ہدایت کے سرچشمے اور مشاہیرِ اسلام', 'اہلِ بیت، صحابہ کرام، صحابیاتِ کرام، صوفیائے کرام اور علما و مفکرین', 'Sources of guidance and eminent figures.'],
    ['اسلامی تعلیمات اور عصرِ حاضر کے تقاضے', 'خود اعتمادی، صحت و ریاضت، منصوبہ بندی اور اسلامی تہذیب کے امتیازات', 'Islamic teachings today.'],
  ],
  // Eight chapters, not four. Now follows the board's Table of Specification:
  // each chapter is a content area from the SSC-I Assessment Framework. See
  // data/fbise/chapters.json for the mark weights.
  pst: [
    ['Ideological Basis, Struggle, Creation and the Political Developments in Pakistan', 'The two-nation theory, Iqbal and Jinnah’s vision, and the events of 1906 to 1947 that led to Pakistan.'],
    ['Land of Pakistan', 'Pakistan’s location on the world map, its neighbours, and the geography behind its major cities.'],
    ['The Natural Topography and Vegetation of Pakistan', 'Pakistan’s mountains, plateaus, rivers and plains, and how they shape climate, vegetation and ways of life.'],
    ['Climate of Pakistan and Environmental Hazards', 'Pakistan’s climatic zones, monsoons and cyclones, and how seasonal weather affects agriculture and the economy.'],
    ['Water, Mineral and Power Resources', 'Pakistan’s irrigation system, dams and reservoirs, and their role in power generation and flood control.'],
    ['Population Structure, Growth, Employment and Industry', 'Population growth and structure, rural to urban migration, and the challenges of a large youth population.'],
    ['Agriculture, Livestock and Fisheries', 'Pakistan’s major food and cash crops, agriculture’s role in the economy, and the threats facing farmland.'],
    ['Transport, Trade and Telecommunication', 'Pakistan’s transport networks, and how routes like Gwadar Port and CPEC connect it to global trade.'],
  ],
  // The previous list here was a different board's syllabus. Now follows the
  // board's Table of Specification: seven content areas from the SSC-I
  // Assessment Framework. Domain G, Digital Literacy, carries 0 marks and is
  // marked "Not applicable for grade 9" directly in the framework, so it stays
  // out. Domain H, Entrepreneurship in the digital age, is worth 5 marks and
  // was missing here only because its two outcomes are mislabelled in the
  // board's own PDF (see data/fbise/cs.json); appended as chapter 7 so that mark
  // share stops going unrevised. See data/fbise/chapters.json for the weights.
  cs: [
    ['Computer Systems', 'Computer hardware and architecture, system versus application software, and data communication basics.'],
    ['Computational Thinking and Algorithms', 'Breaking problems down and solving them computationally using logical and algorithmic thinking.'],
    ['Programming Fundamentals', 'Building static and dynamic web pages with HTML, CSS and JavaScript, and debugging simple programs.'],
    ['Data and Analysis', 'What data science covers, how data is collected and stored, and how businesses use big data.'],
    ['Applications of Computer Science', 'Where AI and machine learning are used, and the social questions raised by AI making decisions about people.'],
    ['Impacts of Computing', 'Safe and responsible computer use, and the beneficial and harmful effects of computing on society.'],
    ['Entrepreneurship in the Digital Age', 'Using design thinking to turn a real problem into a business idea, and building and evaluating a business plan with digital tools.'],
  ],
};

export const CHAPTERS: Record<string, Chapter[]> = Object.fromEntries(
  Object.entries(CH).map(([subjectId, rows]) => [
    subjectId,
    rows.map((r, i) => ({
      id: `${subjectId}-${i + 1}`,
      subjectId,
      number: i + 1,
      title: subjectId === 'urd' || subjectId === 'isl' ? (r[2] as string) : r[0],
      // Urdu and Islamiat carry their Urdu title in the row itself, because
      // that is the name the chapter is actually known by. Everything else
      // looks it up, so one map covers all nine subjects.
      urduTitle: subjectId === 'urd' || subjectId === 'isl' ? r[0] : CHAPTER_TITLES_UR[`${subjectId}-${i + 1}`],
      blurb: subjectId === 'urd' || subjectId === 'isl' ? r[1] : r[1],
      // Paid-only, the client's call after M2: there is no free chapter any
      // more, so the flag no longer varies. It stays because the apps and the
      // chapters table still carry it.
      premium: true,
      // Zero, like audioMinutes below and for the same reason: these were
      // formulas that invented plausible counts, so offline or before the
      // live index primed, screens advertised "31 MCQs" for chapters that
      // might have none. Real counts come from the chapters table.
      mcqCount: 0,
      flashcardCount: 0,
      // Zero, and it stays zero here.
      //
      // This was `11 + ((i * 3) % 9)`, a formula that invented a plausible
      // number of minutes per chapter, so all 94 chapters advertised an audio
      // lesson while `audio_tracks` held nothing at all. A student could tap it.
      // Real durations come from the audio_tracks row when one exists, set by
      // the ingest, so a chapter shows audio only once audio is really there.
      audioMinutes: 0,
      sectionCount: 0,
    })),
  ])
);

export const ALL_CHAPTERS: Chapter[] = Object.values(CHAPTERS).flat();

/* ------------------------------------------------------------ live index */

/**
 * Real chapters and subjects, once anything has fetched them.
 *
 * WHY THIS EXISTS. Dozens of call sites across both apps ask `chapterById` for
 * a title, or read `CHAPTERS[subjectId]` for a list. They are synchronous by
 * nature: a heading cannot await. When content moved to Postgres those call
 * sites kept returning the bundled sample, so screens showed old chapter names
 * and placeholder counts long after the database was correct. Converting every
 * one of them to an async read would be a large refactor and would make every
 * title flicker.
 *
 * So the lookups stay synchronous and the data underneath them gets replaced.
 * `db.ts` calls `primeContent` whenever it successfully reads from the server,
 * and from then on every existing call site returns real data with no change at
 * the call site at all. Before that first fetch, and offline, they fall back to
 * the bundle exactly as before.
 */
let liveChapters: Record<string, Chapter> | null = null;
let liveBySubject: Record<string, Chapter[]> | null = null;
let liveSubjects: Subject[] | null = null;

/** Called by the fetch layer after a successful read. Not for app code. */
export function primeContent(next: { subjects?: Subject[]; chapters?: Chapter[] }): void {
  if (next.subjects?.length) liveSubjects = next.subjects;
  if (next.chapters?.length) {
    liveChapters = { ...(liveChapters ?? {}) };
    const bySubject: Record<string, Chapter[]> = { ...(liveBySubject ?? {}) };
    for (const c of next.chapters) liveChapters[c.id] = c;
    // Group only the subjects in this batch, so priming one subject does not
    // wipe another that was primed earlier.
    for (const subjectId of new Set(next.chapters.map((c) => c.subjectId))) {
      bySubject[subjectId] = next.chapters.filter((c) => c.subjectId === subjectId).sort((a, b) => a.number - b.number);
    }
    liveBySubject = bySubject;
  }
}

/** Live chapters for a subject, or the bundled ones if nothing has loaded. */
export const chaptersFor = (subjectId: string): Chapter[] => liveBySubject?.[subjectId] ?? CHAPTERS[subjectId] ?? [];

export const chapterById = (id: string): Chapter | undefined =>
  liveChapters?.[id] ?? ALL_CHAPTERS.find((c) => c.id === id);

export const subjectById = (id: string): Subject | undefined =>
  liveSubjects?.find((s) => s.id === id) ?? SUBJECTS.find((s) => s.id === id);

/* ------------------------------------------------------- authored content */

/*
 * The AUDIO_TRACKS map and hasAudio() used to live here, naming two demo files
 * bundled into each app. Audio now comes from the audio_tracks table via
 * api.getAudioTracks(), so a chapter has a lesson when one has really been
 * recorded and published, not when it appears in a list in this file.
 */

const dynamicsSections: Section[] = [
  {
    id: 'phy-3-s1',
    title: 'Force and inertia',
    blocks: [
      { kind: 'h', text: 'What is a force?' },
      {
        kind: 'p',
        text: 'A force is an agent that moves or tends to move a body, stops or tends to stop a moving body, and can change the direction or shape of a body. Force is a vector quantity: it has both magnitude and direction, and its SI unit is the newton (N).',
      },
      { kind: 'def', term: 'Inertia', text: 'The property of a body that resists any change in its state of rest or of uniform motion. The greater the mass, the greater the inertia.' },
      { kind: 'ur', text: 'جسم کی وہ خاصیت جو اپنی حالتِ سکون یا یکساں حرکت میں تبدیلی کی مزاحمت کرتی ہے، اسے جڑت (inertia) کہتے ہیں۔' },
      {
        kind: 'example',
        text: 'A bus starts suddenly and passengers jerk backwards: the lower body moves with the bus while the upper body, due to inertia, stays at rest for a moment.',
      },
    ],
  },
  {
    id: 'phy-3-s2',
    title: 'Newton’s first law of motion',
    blocks: [
      { kind: 'h', text: 'The law of inertia' },
      {
        kind: 'p',
        text: 'A body continues in its state of rest or of uniform motion in a straight line unless acted upon by a net external force. This is why the law is also called the law of inertia.',
      },
      { kind: 'list', items: ['A book on a table stays at rest until pushed.', 'A ball rolling on a smooth floor keeps moving until friction stops it.', 'Seat belts protect passengers when a car brakes suddenly.'] },
    ],
  },
  {
    id: 'phy-3-s3',
    title: 'Newton’s second law of motion',
    blocks: [
      { kind: 'h', text: 'Force, mass and acceleration' },
      {
        kind: 'p',
        text: 'When a net force acts on a body it produces acceleration in the direction of the force. The acceleration is directly proportional to the force and inversely proportional to the mass of the body.',
      },
      { kind: 'formula', text: 'F = m a', caption: 'force = mass × acceleration' },
      { kind: 'def', term: 'Newton (N)', text: 'The force that produces an acceleration of 1 m/s² in a body of mass 1 kg.' },
      { kind: 'example', text: 'A 1,200 kg car accelerating at 2 m/s² needs a net force of 2,400 N. Double the mass and the same force gives half the acceleration.' },
      { kind: 'ur', text: 'جب کسی جسم پر خالص قوت عمل کرتی ہے تو وہ قوت کی سمت میں اسراع پیدا کرتی ہے۔' },
    ],
  },
  {
    id: 'phy-3-s4',
    title: 'Newton’s third law and momentum',
    blocks: [
      { kind: 'h', text: 'Action and reaction' },
      { kind: 'p', text: 'To every action there is always an equal but opposite reaction. Action and reaction act on two different bodies, so they never cancel each other.' },
      { kind: 'def', term: 'Momentum', text: 'The quantity of motion of a body, equal to the product of its mass and velocity. Its SI unit is kg·m/s.' },
      { kind: 'formula', text: 'p = m v', caption: 'momentum = mass × velocity' },
      { kind: 'p', text: 'Newton’s second law can also be stated as: the rate of change of momentum of a body equals the net force acting on it.' },
    ],
  },
  {
    id: 'phy-3-s5',
    title: 'Friction',
    blocks: [
      { kind: 'h', text: 'The force that opposes motion' },
      { kind: 'p', text: 'Friction is the force that opposes the relative motion of two surfaces in contact. It depends on the nature of the surfaces and on the normal reaction, not on the area of contact.' },
      { kind: 'list', items: ['Rolling friction is much less than sliding friction.', 'Lubricants and ball bearings reduce friction.', 'Friction lets us walk, and lets brakes and tyres work.'] },
    ],
  },
  {
    id: 'phy-3-s6',
    title: 'Uniform circular motion',
    blocks: [
      { kind: 'h', text: 'Motion in a circle' },
      { kind: 'p', text: 'In uniform circular motion the speed stays constant but the direction of velocity changes at every point. A changing velocity means the body is accelerating, and that acceleration is directed towards the centre.' },
      { kind: 'def', term: 'Centripetal force', text: 'The force that keeps a body moving along a circular path, always directed towards the centre of the circle.' },
      { kind: 'formula', text: 'F_c = m v² / r', caption: 'centripetal force' },
    ],
  },
];

const dynamicsMcqs: Omit<Mcq, 'chapterId'>[] = [
  { id: 'phy3-m1', topic: 'Circular motion', q: 'A body has constant speed but its velocity keeps changing. The body is moving…', options: ['in a straight line', 'in a circle', 'with zero acceleration', 'under no force'], answer: 1, explanation: 'In circular motion the direction of velocity changes at every point even when speed is constant, so velocity changes and there is centripetal acceleration.', difficulty: 'medium' },
  { id: 'phy3-m2', topic: 'Force', q: 'The SI unit of force is the…', options: ['joule', 'newton', 'pascal', 'watt'], answer: 1, explanation: 'One newton is the force that gives a 1 kg mass an acceleration of 1 m/s².', difficulty: 'easy' },
  { id: 'phy3-m3', topic: 'Momentum', q: 'The rate of change of momentum of a body is equal to the…', options: ['work done on it', 'net force acting on it', 'power delivered to it', 'its kinetic energy'], answer: 1, explanation: 'This is the momentum form of Newton’s second law: F = Δp / Δt.', difficulty: 'medium' },
  { id: 'phy3-m4', topic: 'Momentum', q: 'The SI unit of momentum is…', options: ['N', 'kg·m/s', 'J·s', 'm/s²'], answer: 1, explanation: 'Momentum p = mv, so its unit is kilogram-metre per second (equivalently N·s).', difficulty: 'easy' },
  { id: 'phy3-m5', topic: 'Newton’s laws', q: 'Newton’s first law of motion is also known as the law of…', options: ['momentum', 'inertia', 'gravitation', 'action and reaction'], answer: 1, explanation: 'It describes how bodies resist changes in their state of motion, a property called inertia.', difficulty: 'easy' },
  { id: 'phy3-m6', topic: 'Inertia', q: 'Inertia of a body depends on its…', options: ['speed', 'mass', 'volume', 'shape'], answer: 1, explanation: 'Mass is the measure of inertia, so heavier bodies resist changes in motion more.', difficulty: 'easy' },
  { id: 'phy3-m7', topic: 'Newton’s laws', q: 'A 5 kg block is pushed with a net force of 20 N. Its acceleration is…', options: ['0.25 m/s²', '4 m/s²', '25 m/s²', '100 m/s²'], answer: 1, explanation: 'a = F/m = 20/5 = 4 m/s².', difficulty: 'medium' },
  { id: 'phy3-m8', topic: 'Friction', q: 'Force of friction between two surfaces does NOT depend on…', options: ['nature of the surfaces', 'normal reaction', 'area of contact', 'whether motion is sliding or rolling'], answer: 2, explanation: 'For solid surfaces friction is independent of the apparent area of contact; it depends on surface nature and normal reaction.', difficulty: 'hard' },
  { id: 'phy3-m9', topic: 'Newton’s laws', q: 'Action and reaction forces…', options: ['act on the same body', 'act on two different bodies', 'always cancel out', 'are unequal in magnitude'], answer: 1, explanation: 'They act on different bodies, which is exactly why they do not cancel each other.', difficulty: 'medium' },
  { id: 'phy3-m10', topic: 'Circular motion', q: 'The centripetal force on a body moving in a circle is directed…', options: ['along the tangent', 'towards the centre', 'away from the centre', 'opposite to motion'], answer: 1, explanation: 'Centripetal means “centre-seeking”, and the force always points to the centre of the circular path.', difficulty: 'easy' },
  { id: 'phy3-m11', topic: 'Friction', q: 'Rolling friction is generally…', options: ['greater than sliding friction', 'less than sliding friction', 'equal to sliding friction', 'zero'], answer: 1, explanation: 'That is why wheels and ball bearings are used to reduce resistance.', difficulty: 'easy' },
  { id: 'phy3-m12', topic: 'Force', q: 'Which of these is a vector quantity?', options: ['mass', 'time', 'force', 'temperature'], answer: 2, explanation: 'Force has both magnitude and direction, so it is a vector.', difficulty: 'easy' },
];

/**
 * The same chapter in Urdu medium. Written out in full for one chapter so the
 * client can see how Urdu-medium content reads in the app (Nastaliq, RTL).
 */
const dynamicsSectionsUr: Section[] = [
  {
    id: 'phy-3-s1-ur',
    title: 'قوت اور جڑت',
    blocks: [
      { kind: 'h', text: 'قوت کیا ہے؟' },
      {
        kind: 'ur',
        text: 'قوت وہ عامل ہے جو کسی جسم کو حرکت دیتی ہے یا حرکت دینے کی کوشش کرتی ہے، چلتے ہوئے جسم کو روکتی ہے یا روکنے کی کوشش کرتی ہے، اور کسی جسم کی سمت یا شکل تبدیل کر سکتی ہے۔ قوت ایک سمتی مقدار ہے یعنی اس کی مقدار بھی ہوتی ہے اور سمت بھی۔ اس کا بین الاقوامی یونٹ نیوٹن ہے۔',
      },
      { kind: 'def', term: 'جڑت (Inertia)', text: 'جسم کی وہ خاصیت جو اس کی حالتِ سکون یا یکساں حرکت میں تبدیلی کی مزاحمت کرتی ہے۔ کمیت جتنی زیادہ، جڑت اتنی ہی زیادہ۔' },
      {
        kind: 'example',
        text: 'بس اچانک چلے تو مسافر پیچھے کی طرف جھٹکا کھاتے ہیں: نچلا دھڑ بس کے ساتھ چل پڑتا ہے جبکہ اوپر کا دھڑ جڑت کی وجہ سے لمحہ بھر ساکن رہتا ہے۔',
      },
    ],
  },
  {
    id: 'phy-3-s2-ur',
    title: 'نیوٹن کا پہلا قانونِ حرکت',
    blocks: [
      { kind: 'h', text: 'جڑت کا قانون' },
      {
        kind: 'ur',
        text: 'ہر جسم اپنی حالتِ سکون یا سیدھی لکیر میں یکساں حرکت کی حالت برقرار رکھتا ہے جب تک اس پر کوئی خالص بیرونی قوت عمل نہ کرے۔ اسی لیے اسے جڑت کا قانون بھی کہا جاتا ہے۔',
      },
      {
        kind: 'list',
        items: [
          'میز پر رکھی کتاب اُس وقت تک ساکن رہتی ہے جب تک اسے دھکا نہ دیا جائے۔',
          'ہموار فرش پر لڑھکتی گیند رگڑ کی وجہ سے رُکتی ہے۔',
          'گاڑی کی اچانک بریک پر سیٹ بیلٹ مسافر کو محفوظ رکھتی ہے۔',
        ],
      },
    ],
  },
  {
    id: 'phy-3-s3-ur',
    title: 'نیوٹن کا دوسرا قانونِ حرکت',
    blocks: [
      { kind: 'h', text: 'قوت، کمیت اور اسراع' },
      {
        kind: 'ur',
        text: 'جب کسی جسم پر خالص قوت عمل کرتی ہے تو وہ قوت کی سمت میں اسراع پیدا کرتی ہے۔ اسراع قوت کے راست متناسب اور جسم کی کمیت کے بالعکس متناسب ہوتا ہے۔',
      },
      { kind: 'formula', text: 'F = m a', caption: 'قوت = کمیت × اسراع' },
      { kind: 'def', term: 'نیوٹن (N)', text: 'وہ قوت جو 1 کلوگرام کمیت میں 1 میٹر فی سیکنڈ مربع اسراع پیدا کرے۔' },
      {
        kind: 'example',
        text: '1,200 کلوگرام کی گاڑی کو 2 میٹر فی سیکنڈ مربع اسراع دینے کے لیے 2,400 نیوٹن خالص قوت درکار ہو گی۔',
      },
    ],
  },
  {
    id: 'phy-3-s4-ur',
    title: 'تیسرا قانون اور معیارِ حرکت',
    blocks: [
      { kind: 'h', text: 'عمل اور ردِعمل' },
      {
        kind: 'ur',
        text: 'ہر عمل کا برابر اور مخالف ردِعمل ہوتا ہے۔ عمل اور ردِعمل دو مختلف اجسام پر عمل کرتے ہیں، اسی لیے وہ ایک دوسرے کو ختم نہیں کرتے۔',
      },
      { kind: 'def', term: 'معیارِ حرکت (Momentum)', text: 'جسم کی حرکت کی مقدار، جو کمیت اور رفتار کے حاصل ضرب کے برابر ہے۔ یونٹ: kg·m/s' },
      { kind: 'formula', text: 'p = m v', caption: 'معیارِ حرکت = کمیت × رفتار' },
    ],
  },
];

/**
 * Hand-written sample lessons, keyed by chapter id.
 *
 * The ids are positional (`${subjectId}-${number}`), so renumbering a subject
 * moves the ground under this map. That happened when chemistry and biology
 * moved to the board's Table of Specification structure: the atoms lesson was
 * sitting under chem-2, which is now "Matter", and the cells lesson under
 * bio-4, which is now "Cell cycle". Both are retargeted below to the chapter
 * whose title they actually match. If you renumber a subject again, check here.
 */
const AUTHORED: Record<string, ChapterContent> = {
  'phy-3': {
    audioTitle: 'Dynamics, full chapter',
    sections: dynamicsSections,
    sectionsUr: dynamicsSectionsUr,
    mcqs: dynamicsMcqs.map((m) => ({ ...m, chapterId: 'phy-3' })),
    flashcards: [
      { id: 'phy3-f1', chapterId: 'phy-3', front: 'Inertia', back: 'The property of a body to resist any change in its state of rest or of uniform motion.', urduBack: 'جسم کی وہ خاصیت جو حالت میں تبدیلی کی مزاحمت کرے' },
      { id: 'phy3-f2', chapterId: 'phy-3', front: 'Newton’s second law', back: 'Net force equals mass times acceleration: F = ma. Acceleration is along the direction of the net force.' },
      { id: 'phy3-f3', chapterId: 'phy-3', front: 'Momentum', back: 'p = mv, the quantity of motion of a body. Unit: kg·m/s.' },
      { id: 'phy3-f4', chapterId: 'phy-3', front: '1 newton', back: 'The force that produces an acceleration of 1 m/s² in a mass of 1 kg.' },
      { id: 'phy3-f5', chapterId: 'phy-3', front: 'Centripetal force', back: 'F = mv²/r, always directed towards the centre of the circular path.' },
      { id: 'phy3-f6', chapterId: 'phy-3', front: 'Friction', back: 'The force opposing relative motion of two contacting surfaces. Depends on surface nature and normal reaction.' },
      { id: 'phy3-f7', chapterId: 'phy-3', front: 'Newton’s third law', back: 'To every action there is an equal but opposite reaction, acting on a different body.' },
    ],
    shortQs: [
      { id: 'phy3-q1', chapterId: 'phy-3', marks: 2, q: 'Why does a passenger fall forward when a moving bus stops suddenly?', answer: 'The lower body stops with the bus, but due to inertia the upper body keeps moving forward, so the passenger falls forward.', points: ['names inertia (1 mark)', 'explains upper vs lower body (1 mark)'] },
      { id: 'phy3-q2', chapterId: 'phy-3', marks: 2, q: 'Define momentum and give its SI unit.', answer: 'Momentum is the quantity of motion of a body, equal to the product of mass and velocity (p = mv). Its SI unit is kg·m/s.', points: ['correct definition or formula (1 mark)', 'correct unit kg·m/s (1 mark)'] },
      { id: 'phy3-q3', chapterId: 'phy-3', marks: 3, q: 'Why do action and reaction not cancel each other?', answer: 'Action and reaction are equal and opposite but act on two different bodies. Forces cancel only when they act on the same body, so these do not cancel.', points: ['equal and opposite (1)', 'act on different bodies (1)', 'cancellation needs same body (1)'] },
      { id: 'phy3-q4', chapterId: 'phy-3', marks: 2, q: 'How is circular motion possible at constant speed?', answer: 'Speed is a scalar and stays constant, but the direction of velocity changes continuously, so the velocity changes and a centripetal force acts towards the centre.', points: ['direction of velocity changes (1)', 'centripetal force towards centre (1)'] },
    ],
    blanks: [
      { id: 'phy3-b1', chapterId: 'phy-3', sentence: ['The SI unit of momentum is ', '.'], answer: 'kg·m/s', options: ['newton', 'kg·m/s', 'joule', 'm/s²'] },
      { id: 'phy3-b2', chapterId: 'phy-3', sentence: ['A body continues in uniform motion unless acted upon by a net external ', '.'], answer: 'force', options: ['force', 'energy', 'momentum', 'torque'] },
      { id: 'phy3-b3', chapterId: 'phy-3', sentence: ['Friction between rolling surfaces is ', ' than sliding friction.'], answer: 'less', options: ['more', 'less', 'equal', 'double'] },
      { id: 'phy3-b4', chapterId: 'phy-3', sentence: ['The force keeping a body on a circular path is called ', ' force.'], answer: 'centripetal', options: ['centrifugal', 'centripetal', 'frictional', 'normal'] },
    ],
  },
  'chem-3': {
    audioTitle: 'Structure of Atoms, full chapter',
    sections: [
      {
        id: 'chem-3-s1',
        title: 'Rutherford’s atomic model',
        blocks: [
          { kind: 'h', text: 'The gold-foil experiment' },
          { kind: 'p', text: 'Rutherford bombarded a thin gold foil with alpha particles. Most passed straight through, a few deflected, and about one in 20,000 bounced back, showing the atom is mostly empty space with a tiny, dense, positively charged nucleus.' },
          { kind: 'def', term: 'Nucleus', text: 'The small, dense, positively charged centre of an atom containing protons and neutrons.' },
          { kind: 'list', items: ['Atom is mostly empty space.', 'All positive charge and nearly all mass sit in the nucleus.', 'Electrons revolve around the nucleus.'] },
        ],
      },
      {
        id: 'chem-3-s2',
        title: 'Bohr’s model and electronic configuration',
        blocks: [
          { kind: 'p', text: 'Bohr proposed that electrons revolve in fixed circular orbits (shells) of definite energy, and that energy is absorbed or emitted only when an electron jumps between shells.' },
          { kind: 'formula', text: '2n²', caption: 'maximum electrons in the nth shell' },
          { kind: 'example', text: 'Sodium (Z = 11) has the configuration K=2, L=8, M=1, so one valence electron, which is why it loses an electron easily.' },
        ],
      },
      {
        id: 'chem-3-s3',
        title: 'Isotopes',
        blocks: [
          { kind: 'def', term: 'Isotopes', text: 'Atoms of the same element with the same atomic number but different mass numbers: same protons, different neutrons.' },
          { kind: 'p', text: 'Hydrogen has three isotopes: protium, deuterium and tritium. Isotopes have identical chemical properties but differ in physical properties such as density.' },
        ],
      },
    ],
    mcqs: [
      { id: 'chem3-m1', chapterId: 'chem-3', topic: 'Atomic models', q: 'Rutherford’s gold-foil experiment proved the existence of the…', options: ['electron', 'nucleus', 'neutron', 'orbital'], answer: 1, explanation: 'The rebounding of a few alpha particles showed a tiny, dense, positively charged nucleus.', difficulty: 'easy' },
      { id: 'chem3-m2', chapterId: 'chem-3', topic: 'Electronic configuration', q: 'The maximum number of electrons in the L shell is…', options: ['2', '8', '18', '32'], answer: 1, explanation: 'Using 2n² with n = 2 gives 8 electrons.', difficulty: 'easy' },
      { id: 'chem3-m3', chapterId: 'chem-3', topic: 'Isotopes', q: 'Isotopes of an element differ in the number of…', options: ['protons', 'electrons', 'neutrons', 'shells'], answer: 2, explanation: 'Same atomic number (protons) but different mass number means a different neutron count.', difficulty: 'easy' },
      { id: 'chem3-m4', chapterId: 'chem-3', topic: 'Atomic structure', q: 'Which particle has approximately the same mass as a proton?', options: ['electron', 'neutron', 'positron', 'photon'], answer: 1, explanation: 'Protons and neutrons both have mass close to 1 amu; the electron is about 1836 times lighter.', difficulty: 'medium' },
      { id: 'chem3-m5', chapterId: 'chem-3', topic: 'Isotopes', q: 'The number of isotopes of hydrogen is…', options: ['1', '2', '3', '4'], answer: 2, explanation: 'Protium, deuterium and tritium.', difficulty: 'easy' },
    ],
    flashcards: [
      { id: 'chem3-f1', chapterId: 'chem-3', front: 'Isotopes', back: 'Atoms of the same element with the same atomic number but different mass numbers.' },
      { id: 'chem3-f2', chapterId: 'chem-3', front: 'Max electrons in a shell', back: '2n², where n is the shell number: K=2, L=8, M=18, N=32.' },
      { id: 'chem3-f3', chapterId: 'chem-3', front: 'Atomic number (Z)', back: 'The number of protons in the nucleus, which identifies the element.' },
      { id: 'chem3-f4', chapterId: 'chem-3', front: 'Mass number (A)', back: 'Total number of protons and neutrons in the nucleus.' },
    ],
    shortQs: [
      { id: 'chem3-q1', chapterId: 'chem-3', marks: 2, q: 'State two conclusions of Rutherford’s atomic model.', answer: 'The atom is mostly empty space, and all the positive charge with nearly all the mass is concentrated in a tiny nucleus at the centre.', points: ['mostly empty space (1)', 'dense positive nucleus (1)'] },
      { id: 'chem3-q2', chapterId: 'chem-3', marks: 2, q: 'Why do isotopes of an element have identical chemical properties?', answer: 'Chemical properties depend on the number and arrangement of electrons, which is the same for all isotopes of an element; only the neutron count differs.', points: ['same electronic configuration (1)', 'only neutrons differ (1)'] },
    ],
    blanks: [
      { id: 'chem3-b1', chapterId: 'chem-3', sentence: ['The maximum number of electrons in the M shell is ', '.'], answer: '18', options: ['8', '18', '32', '2'] },
      { id: 'chem3-b2', chapterId: 'chem-3', sentence: ['Atoms with the same atomic number but different mass numbers are called ', '.'], answer: 'isotopes', options: ['isotopes', 'isobars', 'ions', 'isomers'] },
    ],
  },
  'bio-3': {
    audioTitle: 'Cells and Tissues, full chapter',
    sections: [
      {
        id: 'bio-3-s1',
        title: 'The cell and microscopy',
        blocks: [
          { kind: 'h', text: 'Discovery of the cell' },
          { kind: 'p', text: 'Robert Hooke observed cork under a microscope in 1665 and named the compartments “cells”. The cell theory states that all organisms are made of cells, the cell is the basic unit of structure and function, and all cells come from pre-existing cells.' },
          { kind: 'def', term: 'Resolution', text: 'The smallest distance between two points at which they can still be seen as separate. Light microscopes resolve about 0.2 µm.' },
        ],
      },
      {
        id: 'bio-3-s2',
        title: 'Cell organelles',
        blocks: [
          { kind: 'list', items: ['Nucleus: contains DNA and controls cell activities.', 'Mitochondria: site of aerobic respiration, the “power house”.', 'Chloroplast: photosynthesis in plant cells.', 'Ribosomes: protein synthesis.', 'Vacuole: storage, large and central in plant cells.'] },
          { kind: 'p', text: 'Plant cells have a cellulose cell wall, chloroplasts and a large central vacuole; animal cells have centrioles and lack a cell wall.' },
        ],
      },
      {
        id: 'bio-3-s3',
        title: 'Transport across the membrane',
        blocks: [
          { kind: 'def', term: 'Diffusion', text: 'Movement of molecules from a region of higher concentration to lower concentration.' },
          { kind: 'def', term: 'Osmosis', text: 'Diffusion of water through a selectively permeable membrane from a dilute to a concentrated solution.' },
          { kind: 'p', text: 'Active transport moves substances against the concentration gradient and requires energy from ATP.' },
        ],
      },
    ],
    mcqs: [
      { id: 'bio3-m1', chapterId: 'bio-3', topic: 'Organelles', q: 'The “power house” of the cell is the…', options: ['nucleus', 'mitochondrion', 'ribosome', 'vacuole'], answer: 1, explanation: 'Mitochondria carry out aerobic respiration, producing most of the cell’s ATP.', difficulty: 'easy' },
      { id: 'bio3-m2', chapterId: 'bio-3', topic: 'Cell structure', q: 'Which structure is present in a plant cell but absent in an animal cell?', options: ['ribosome', 'chloroplast', 'nucleus', 'mitochondrion'], answer: 1, explanation: 'Chloroplasts (and a cellulose cell wall) are plant-specific.', difficulty: 'easy' },
      { id: 'bio3-m3', chapterId: 'bio-3', topic: 'Transport', q: 'Movement of water through a selectively permeable membrane is called…', options: ['diffusion', 'osmosis', 'active transport', 'plasmolysis'], answer: 1, explanation: 'Osmosis is specifically the diffusion of water across a selectively permeable membrane.', difficulty: 'easy' },
      { id: 'bio3-m4', chapterId: 'bio-3', topic: 'Transport', q: 'Active transport differs from diffusion because it…', options: ['needs no energy', 'requires ATP', 'only moves water', 'is always faster'], answer: 1, explanation: 'Active transport moves substances against the gradient and consumes ATP.', difficulty: 'medium' },
      { id: 'bio3-m5', chapterId: 'bio-3', topic: 'Microscopy', q: 'Who first observed and named cells?', options: ['Robert Brown', 'Robert Hooke', 'Louis Pasteur', 'Rudolf Virchow'], answer: 1, explanation: 'Robert Hooke described “cells” in cork in 1665.', difficulty: 'easy' },
    ],
    flashcards: [
      { id: 'bio3-f1', chapterId: 'bio-3', front: 'Osmosis', back: 'Diffusion of water through a selectively permeable membrane from dilute to concentrated solution.' },
      { id: 'bio3-f2', chapterId: 'bio-3', front: 'Mitochondrion', back: 'Site of aerobic respiration, produces ATP. Has its own DNA and a folded inner membrane (cristae).' },
      { id: 'bio3-f3', chapterId: 'bio-3', front: 'Cell theory', back: 'All organisms are made of cells; the cell is the basic unit of structure and function; all cells arise from pre-existing cells.' },
      { id: 'bio3-f4', chapterId: 'bio-3', front: 'Plant vs animal cell', back: 'Plant: cell wall, chloroplasts, large central vacuole. Animal: centrioles, no cell wall, small vacuoles.' },
    ],
    shortQs: [
      { id: 'bio3-q1', chapterId: 'bio-3', marks: 3, q: 'Differentiate between diffusion and osmosis.', answer: 'Diffusion is the movement of any molecules from higher to lower concentration; osmosis is specifically the movement of water molecules from a dilute to a concentrated solution through a selectively permeable membrane. Neither requires energy.', points: ['diffusion = any molecule down gradient (1)', 'osmosis = water through membrane (1)', 'both passive (1)'] },
      { id: 'bio3-q2', chapterId: 'bio-3', marks: 2, q: 'Give two differences between plant and animal cells.', answer: 'Plant cells have a cellulose cell wall and chloroplasts; animal cells have neither and instead contain centrioles.', points: ['cell wall / chloroplast in plants (1)', 'centrioles / no wall in animals (1)'] },
    ],
    blanks: [
      { id: 'bio3-b1', chapterId: 'bio-3', sentence: ['Protein synthesis takes place on the ', '.'], answer: 'ribosomes', options: ['ribosomes', 'lysosomes', 'chloroplasts', 'centrioles'] },
      { id: 'bio3-b2', chapterId: 'bio-3', sentence: ['Movement of substances against a concentration gradient needs ', '.'], answer: 'energy', options: ['water', 'energy', 'enzymes', 'light'] },
    ],
  },
};

/* ------------------------------------------------- generated fallback */

export const isAuthored = (chapterId: string) => !!AUTHORED[chapterId];




/**
 * Generated content is deterministic per chapter, so it is built once and kept.
 * Without this cache every progress sweep (chapterPct, subjectPct, getMcqs)
 * re-ran generate() per unauthored chapter, ~0.2ms a call, which added up to
 * 40-90ms per render on a phone once a screen swept all seven subjects.
 */
const EMPTY_CONTENT: ChapterContent = { sections: [], mcqs: [], flashcards: [], shortQs: [], blanks: [], audioTitle: '' };

/**
 * Bundled content for a chapter, or nothing.
 *
 * THIS NO LONGER INVENTS ANYTHING, AND THAT IS THE POINT.
 *
 * It used to call `generate(ch)` for any chapter it did not have, producing
 * cards that read "Studied in Chapter 5, Speaking. The full definition comes
 * with the client's notes." That was reasonable when the app was a demo with no
 * real content behind it. It is now actively harmful, because the fetch layer
 * falls back here whenever the database returns nothing, and a chapter can
 * legitimately have nothing: the board does not examine Urdu speaking or
 * listening, and it dropped three Maths chapters from Class 9 entirely. Those
 * chapters have an honest blurb saying so, and then this function undid it by
 * fabricating a flashcard.
 *
 * Real content lives in Postgres, downloads keep a copy on the device, and the
 * fetch layer caches the last good answer. If all three miss, an empty state is
 * the truth and a screen can say so. Filler that claims content is coming is
 * worse than a blank page, because a student cannot tell it apart from the real
 * thing.
 */
export function contentFor(chapterId: string): ChapterContent {
  return AUTHORED[chapterId] ?? EMPTY_CONTENT;
}

// The board's own past papers and topper scripts (as listed to students in
// both apps) live in ./papers, backed by data/fbise/papers.json. See
// fbisePastPapers() / fbiseToppersFor() there.
//
// PAPER_CONTENT below is different: two papers transcribed in full, kept only
// so the marketing site's hero demo (apps/web/app/page.tsx) can show what a
// full paper looks like inline. Nothing in either app's session flow reads it.
export const PAPER_CONTENT: Record<string, PaperSection[]> = {
  pp1: [
    {
      heading: 'SECTION A · Objective',
      marks: '12 marks · 20 minutes',
      lines: [
        'Q1. Circle the correct option. Each part carries one mark.',
        'i. The SI unit of force is:  (a) joule  (b) newton  (c) pascal  (d) watt',
        'ii. The rate of change of momentum of a body is equal to:  (a) work done  (b) net force  (c) power  (d) kinetic energy',
        'iii. Rolling friction compared with sliding friction is:  (a) greater  (b) less  (c) equal  (d) zero',
        'iv. A body moving with constant speed in a circle has:  (a) zero acceleration  (b) acceleration towards the centre  (c) constant velocity  (d) no net force',
        'v. The SI unit of momentum is:  (a) N  (b) kg·m/s  (c) J·s  (d) m/s²',
        'vi. Inertia of a body depends upon its:  (a) speed  (b) mass  (c) volume  (d) shape',
      ],
    },
    {
      heading: 'SECTION B · Short answer questions',
      marks: '33 marks',
      lines: [
        'Q2. Attempt any ELEVEN parts. Each part carries three marks.',
        'i. Define inertia and give one everyday example.',
        'ii. State Newton’s first law of motion. Why is it called the law of inertia?',
        'iii. Differentiate between mass and weight.',
        'iv. Why do action and reaction forces not cancel each other?',
        'v. A body of mass 4 kg is acted upon by a force of 12 N. Calculate its acceleration.',
        'vi. Define momentum and write its SI unit.',
        'vii. Explain why a passenger falls forward when a moving bus stops suddenly.',
        'viii. What is friction? Write two methods of reducing it.',
        'ix. Define centripetal force and write its formula.',
        'x. Why is it dangerous to take a sharp turn at high speed?',
        'xi. State the law of conservation of momentum.',
        'xii. A force of 20 N acts on a 5 kg body for 3 s. Find the change in momentum.',
        'xiii. Distinguish between sliding friction and rolling friction.',
      ],
    },
    {
      heading: 'SECTION C · Detailed answer questions',
      marks: '20 marks',
      lines: [
        'Note: Attempt ALL questions. Each question carries ten marks.',
        'Q3. (a) State and explain Newton’s second law of motion and derive F = ma.',
        '     (b) A car of mass 1,200 kg accelerates from rest to 20 m/s in 8 s. Find the net force acting on it.',
        'Q4. (a) What is friction? Explain its causes and describe three ways of reducing friction in machines.',
        '     (b) A block of mass 10 kg is pulled along a horizontal surface by a force of 50 N. If the force of friction is 20 N, find the acceleration of the block.',
      ],
    },
  ],
  'pp-urd': [
    {
      heading: 'حصہ اول · معروضی',
      marks: '15 نمبر · 20 منٹ',
      urdu: true,
      lines: [
        'سوال نمبر ۱: درست جواب پر دائرہ لگائیں۔ ہر جز کا ایک نمبر ہے۔',
        '(i) "نصوح" کس افسانے کا کردار ہے؟  (الف) توبۃ النصوح  (ب) امراؤ جان ادا  (ج) گئودان  (د) آگ کا دریا',
        '(ii) غالبؔ کا اصل نام کیا تھا؟  (الف) اسد اللہ خان  (ب) نظام الدین  (ج) میر تقی  (د) الطاف حسین',
        '(iii) "قومی ترانہ" کے شاعر کون ہیں؟  (الف) حفیظ جالندھری  (ب) علامہ اقبال  (ج) فیض احمد فیض  (د) احمد ندیم قاسمی',
        '(iv) اسم کی کتنی اقسام ہیں؟  (الف) دو  (ب) تین  (ج) چار  (د) پانچ',
        '(v) "دل" کا مترادف لفظ ہے:  (الف) قلب  (ب) جگر  (ج) نظر  (د) سماعت',
      ],
    },
    {
      heading: 'حصہ دوم · مختصر سوالات',
      marks: '36 نمبر',
      urdu: true,
      lines: [
        'سوال نمبر ۲: کوئی سے بارہ اجزا کے مختصر جواب لکھیں۔ ہر جز کے تین نمبر ہیں۔',
        '(i) سبق "توبۃ النصوح" کا مرکزی خیال بیان کریں۔',
        '(ii) نصوح کے کردار کی تین نمایاں خصوصیات لکھیں۔',
        '(iii) سلیم کے کردار پر مختصر نوٹ لکھیں۔',
        '(iv) درج ذیل الفاظ کے معنی لکھیں: نصیحت، ندامت، اصلاح۔',
        '(v) محاورے کو جملوں میں استعمال کریں: آنکھیں کھلنا، ہاتھ بٹانا۔',
        '(vi) اسم اور فعل کی تعریف مثال کے ساتھ لکھیں۔',
        '(vii) واحد جمع بنائیں: کتاب، قلم، شہر۔',
        '(viii) نعت کی تعریف کریں اور اس کی خصوصیات لکھیں۔',
      ],
    },
    {
      heading: 'حصہ سوم · تفصیلی سوالات',
      marks: '24 نمبر',
      urdu: true,
      lines: [
        'نوٹ: تمام سوالات حل کریں۔',
        'سوال نمبر ۳: درج ذیل اشعار کی تشریح کریں۔ (۸ نمبر)',
        'سوال نمبر ۴: "علم کی اہمیت" کے موضوع پر مضمون تحریر کریں۔ (۱۰ نمبر)',
        'سوال نمبر ۵: اپنے ہیڈ ماسٹر کے نام فیس معافی کی درخواست لکھیں۔ (۶ نمبر)',
      ],
    },
  ],
};

/**
 * Every chapter a student is actually studying, flattened, for pointing the
 * tutor at one.
 *
 * The tutor tab used to offer "Explain a topic · From your chapters" and then
 * send a hardcoded question about Newton's second law, whoever you were and
 * whatever you were studying. That spent one of the student's fifty daily
 * questions on a question they had not asked. The list below is what that
 * promise needs: their own subjects, their own class, named so they can pick.
 *
 * Search is on the chapter title, the Urdu title and the subject name, so an
 * Urdu-medium student typing in Nastaliq finds the same chapter an
 * English-medium student finds by typing "motion".
 */
export type ChapterChoice = { id: string; title: string; urduTitle?: string; subjectId: string; subjectName: string; number: number };

export function chapterChoices(subjectIds: string[]): ChapterChoice[] {
  const out: ChapterChoice[] = [];
  for (const sid of subjectIds) {
    const subject = subjectById(sid);
    if (!subject) continue;
    for (const c of chaptersFor(sid)) {
      out.push({ id: c.id, title: c.title, urduTitle: c.urduTitle, subjectId: sid, subjectName: subject.name, number: c.number });
    }
  }
  return out;
}

/** Chapters matching what has been typed after an `@`. Empty query returns the
 *  first few of each subject rather than nothing, so the list is never blank. */
export function matchChapters(choices: ChapterChoice[], query: string, limit = 8): ChapterChoice[] {
  const q = query.trim().toLowerCase();
  if (!q) return choices.slice(0, limit);
  const hits = choices.filter(
    (c) =>
      c.title.toLowerCase().includes(q) ||
      c.subjectName.toLowerCase().includes(q) ||
      (c.urduTitle ?? '').includes(query.trim()),
  );
  return hits.slice(0, limit);
}
