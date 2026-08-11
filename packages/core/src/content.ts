/**
 * MOCK CONTENT. FBISE Class 9.
 *
 * Chapter names follow the real FBISE SSC-I scheme so the app looks true to life.
 * Authored study material exists for the demo path (Physics 1–4, Chemistry 2, Biology 4);
 * every other chapter gets plausible generated material so nothing dead-ends.
 * ALL of this is replaced by client-supplied content via the admin CMS (M7).
 */
import {
  Blank,
  Block,
  Chapter,
  ChapterContent,
  Flashcard,
  Mcq,
  PaperSection,
  PastPaper,
  Section,
  ShortQ,
  Subject,
} from './types';

export const SUBJECTS: Subject[] = [
  { id: 'phy', name: 'Physics', icon: 'bolt', compulsory: false, group: 'science', chapterCount: 9 },
  { id: 'chem', name: 'Chemistry', icon: 'flask', compulsory: false, group: 'science', chapterCount: 8 },
  { id: 'bio', name: 'Biology', icon: 'leaf', compulsory: false, group: 'science', chapterCount: 9 },
  { id: 'math', name: 'Mathematics', icon: 'calc', compulsory: true, chapterCount: 17 },
  { id: 'eng', name: 'English', icon: 'book', compulsory: true, chapterCount: 8 },
  { id: 'urd', name: 'Urdu', urduName: 'اردو', icon: 'quill', compulsory: true, chapterCount: 8 },
  { id: 'isl', name: 'Islamiyat', urduName: 'اسلامیات', icon: 'star', compulsory: true, chapterCount: 7 },
  { id: 'pst', name: 'Pakistan Studies', icon: 'globe', compulsory: true, chapterCount: 4 },
  { id: 'cs', name: 'Computer Science', icon: 'book2', compulsory: false, group: 'science', chapterCount: 6 },
];

const CH: Record<string, [string, string, string?][]> = {
  phy: [
    ['Physical Quantities & Measurement', 'Base and derived quantities, SI units, measuring instruments, significant figures.'],
    ['Kinematics', 'Rest and motion, scalars and vectors, distance–time and speed–time graphs, equations of motion.'],
    ['Dynamics', 'Force, inertia, momentum, Newton’s three laws, friction and circular motion.'],
    ['Turning Effect of Forces', 'Torque, parallel forces, centre of mass and gravity, equilibrium.'],
    ['Gravitation', 'Law of gravitation, mass of Earth, satellites, variation of g with altitude.'],
    ['Work and Energy', 'Work, power, kinetic and potential energy, efficiency, energy sources.'],
    ['Properties of Matter', 'Density, pressure, Pascal’s and Archimedes’ principles, elasticity.'],
    ['Thermal Properties of Matter', 'Temperature and heat, specific heat, latent heat, thermal expansion.'],
    ['Transfer of Heat', 'Conduction, convection, radiation and everyday applications.'],
  ],
  chem: [
    ['Fundamentals of Chemistry', 'Branches of chemistry, atom and molecule, mole concept, Avogadro’s number.'],
    ['Structure of Atoms', 'Rutherford and Bohr models, isotopes, electronic configuration.'],
    ['Periodic Table and Periodicity of Properties', 'Mendeleev to modern table, periods and groups, periodic trends.'],
    ['Structure of Molecules', 'Chemical bonds: ionic, covalent, coordinate, metallic; intermolecular forces.'],
    ['Physical States of Matter', 'Gas laws, evaporation, vapour pressure, boiling and melting points.'],
    ['Solutions', 'Solute and solvent, concentration units, colloids and suspensions.'],
    ['Electrochemistry', 'Oxidation and reduction, electrolytic and galvanic cells, corrosion.'],
    ['Chemical Reactivity', 'Metals and non-metals, reactivity series, extraction of metals.'],
  ],
  bio: [
    ['Introduction to Biology', 'Branches of biology, careers, levels of organisation, Muslim scientists.'],
    ['Solving a Biological Problem', 'Scientific method, hypothesis, malaria as a case study, data handling.'],
    ['Biodiversity', 'Classification, five kingdoms, binomial nomenclature, conservation.'],
    ['Cells and Tissues', 'Microscopy, cell organelles, plant and animal tissues, cell membrane transport.'],
    ['Cell Cycle', 'Interphase, mitosis, meiosis, apoptosis and necrosis.'],
    ['Enzymes', 'Characteristics, mechanism, lock-and-key model, factors affecting activity.'],
    ['Bioenergetics', 'Photosynthesis, respiration, ATP as energy currency.'],
    ['Nutrition', 'Nutrients, human digestive system, malnutrition and vitamins.'],
    ['Transport', 'Transport in plants, human heart and blood, circulatory disorders.'],
  ],
  // Seventeen units, not ten. FBISE examines units 1-7, 14, 15 and 17-23 and 29
  // of the IX-X mathematics scheme in Class 9; the gaps are Class 10's. The
  // board's own numbering is kept in data/fbise/math.json, because a student
  // looking for "Unit 22 Pythagoras" needs to recognise it.
  math: [
    ['Matrices and Determinants', 'Types of matrices, addition and multiplication, determinants, inverse.'],
    ['Real and Complex Numbers', 'Number systems, properties, radicals and laws of exponents.'],
    ['Logarithms', 'Scientific notation, common and natural logs, laws of logarithms.'],
    ['Algebraic Expressions and Formulas', 'Rational expressions, surds, useful algebraic identities.'],
    ['Factorization', 'Factorising quadratics, cubes, remainder and factor theorems.'],
    ['Algebraic Manipulation', 'HCF and LCM, square root of an algebraic expression.'],
    ['Linear Equations and Inequalities', 'Solving equations, absolute value, inequality solution sets.'],
    ['Linear Graphs & Their Application', 'Cartesian plane, conversion graphs, simultaneous equations.'],
    ['Introduction to Coordinate Geometry', 'Distance formula, collinear points, midpoint.'],
    ['Congruent Triangles', 'Congruence postulates and theorems with proofs.'],
    ['Parallelograms and Triangles', 'Properties of parallelograms, midpoint theorem and its converse.'],
    ['Line Bisectors and Angle Bisectors', 'Perpendicular bisectors, angle bisectors and their concurrency.'],
    ['Sides and Angles of a Triangle', 'Angle-side inequalities and the triangle inequality.'],
    ['Ratio and Proportion', 'Ratio, proportion and the theorems on parallel lines cutting sides.'],
    ['Pythagoras’ Theorem', 'The theorem, its converse and problems on right-angled triangles.'],
    ['Theorems Related with Area', 'Areas of parallelograms and triangles on the same base.'],
    ['Practical Geometry: Triangles', 'Constructing triangles, and drawing their circles and bisectors.'],
  ],
  eng: [
    ['The Saviour of Mankind', 'Reading comprehension, vocabulary and summary writing.'],
    ['Patriotism', 'Comprehension, parts of speech, paragraph writing.'],
    ['Media and Its Impact', 'Comprehension, active and passive voice.'],
    ['Hazrat Asma (RA)', 'Comprehension, tenses revision, letter writing.'],
    ['Daffodils', 'Poem: theme, figures of speech, appreciation.'],
    ['Fitness First', 'Comprehension, punctuation, dialogue writing.'],
    ['Sultan Ahmad Masjid', 'Comprehension, prepositions, translation.'],
    ['Grammar & Composition', 'Sentence structure, essays, précis and idioms.'],
  ],
  urd: [
    ['نعت', 'نعت کی تشریح، مشکل الفاظ اور معنی', 'Naat: explanation and vocabulary.'],
    ['ہجرتِ نبوی', 'سبق کا خلاصہ اور سوالات', 'Prose lesson with summary.'],
    ['مرزا غالب', 'شخصیت، غزل کی تشریح', 'Ghalib: life and ghazal.'],
    ['نصوح اور سلیم', 'کردار نگاری، سبق کا خلاصہ', 'Character sketch and summary.'],
    ['قومی ترانہ', 'مطالعہ اور تشریح', 'National anthem: study and explanation.'],
    ['گرامر', 'اسم، فعل، حروف، محاورات', 'Grammar: parts of speech and idioms.'],
    ['خط نویسی', 'درخواست اور خط کے نمونے', 'Letter and application writing.'],
    ['مضمون نویسی', 'مضامین کے خاکے اور نمونے', 'Essay writing.'],
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
  // Four chapters, not six. Constitution and Government, Economy of Pakistan
  // and Population and Society are Class 10, and were never on the Class 9
  // paper.
  pst: [
    ['Ideological Basis of Pakistan', 'Two-nation theory, Allama Iqbal and Quaid-e-Azam.'],
    ['Making of Pakistan', 'Key milestones from 1857 to 1947.'],
    ['Land and Environment', 'Physical features, climate and rivers of Pakistan.'],
    ['History of Pakistan', 'Pakistan from independence to the making of the constitution.'],
  ],
  // The previous list here was a different board's syllabus. These six are the
  // FBISE Class 9 units.
  cs: [
    ['Fundamentals of Computer', 'Computer generations, hardware components and Von Neumann architecture.'],
    ['Fundamentals of Operating System', 'What an operating system does, its types and its user interfaces.'],
    ['Office Automation', 'Word processing, spreadsheets and presentation software.'],
    ['Data Communication', 'Transmission media and modes, bandwidth, and communication devices.'],
    ['Computer Networks', 'LAN and WAN, topologies, network devices and protocols.'],
    ['Computer Security and Ethics', 'Malware, authentication, backups, and cyber ethics and law.'],
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
      urduTitle: subjectId === 'urd' || subjectId === 'isl' ? r[0] : undefined,
      blurb: subjectId === 'urd' || subjectId === 'isl' ? r[1] : r[1],
      // Chapter one of every subject is the free sample; everything after it
      // needs a subscription. Was `i >= 6`, which quietly gave away six
      // chapters per subject and contradicted the pricing page.
      premium: i >= 1,
      mcqCount: 24 + ((i * 7) % 19),
      flashcardCount: 12 + ((i * 5) % 14),
      audioMinutes: 11 + ((i * 3) % 9),
      sectionCount: 4 + (i % 3),
    })),
  ])
);

export const ALL_CHAPTERS: Chapter[] = Object.values(CHAPTERS).flat();
export const chapterById = (id: string) => ALL_CHAPTERS.find((c) => c.id === id);
export const subjectById = (id: string) => SUBJECTS.find((s) => s.id === id);

/* ------------------------------------------------------- authored content */

/**
 * Which chapters have a real recording, and under what name.
 *
 * Only the identifier lives here, each app resolves it to an actual file,
 * because the platforms load media differently (Metro `require` on Android, a
 * public URL on the web). One chapter is recorded in both mediums so the client
 * can hear how an audio lesson behaves; the rest wait on their own recordings.
 */
export const AUDIO_TRACKS: Record<string, { en?: string; ur?: string }> = {
  'phy-3': { en: 'dynamics-en', ur: 'dynamics-ur' },
};

export const hasAudio = (chapterId: string) => !!AUDIO_TRACKS[chapterId];

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
  'chem-2': {
    audioTitle: 'Structure of Atoms, full chapter',
    sections: [
      {
        id: 'chem-2-s1',
        title: 'Rutherford’s atomic model',
        blocks: [
          { kind: 'h', text: 'The gold-foil experiment' },
          { kind: 'p', text: 'Rutherford bombarded a thin gold foil with alpha particles. Most passed straight through, a few deflected, and about one in 20,000 bounced back, showing the atom is mostly empty space with a tiny, dense, positively charged nucleus.' },
          { kind: 'def', term: 'Nucleus', text: 'The small, dense, positively charged centre of an atom containing protons and neutrons.' },
          { kind: 'list', items: ['Atom is mostly empty space.', 'All positive charge and nearly all mass sit in the nucleus.', 'Electrons revolve around the nucleus.'] },
        ],
      },
      {
        id: 'chem-2-s2',
        title: 'Bohr’s model and electronic configuration',
        blocks: [
          { kind: 'p', text: 'Bohr proposed that electrons revolve in fixed circular orbits (shells) of definite energy, and that energy is absorbed or emitted only when an electron jumps between shells.' },
          { kind: 'formula', text: '2n²', caption: 'maximum electrons in the nth shell' },
          { kind: 'example', text: 'Sodium (Z = 11) has the configuration K=2, L=8, M=1, so one valence electron, which is why it loses an electron easily.' },
        ],
      },
      {
        id: 'chem-2-s3',
        title: 'Isotopes',
        blocks: [
          { kind: 'def', term: 'Isotopes', text: 'Atoms of the same element with the same atomic number but different mass numbers: same protons, different neutrons.' },
          { kind: 'p', text: 'Hydrogen has three isotopes: protium, deuterium and tritium. Isotopes have identical chemical properties but differ in physical properties such as density.' },
        ],
      },
    ],
    mcqs: [
      { id: 'chem2-m1', chapterId: 'chem-2', topic: 'Atomic models', q: 'Rutherford’s gold-foil experiment proved the existence of the…', options: ['electron', 'nucleus', 'neutron', 'orbital'], answer: 1, explanation: 'The rebounding of a few alpha particles showed a tiny, dense, positively charged nucleus.', difficulty: 'easy' },
      { id: 'chem2-m2', chapterId: 'chem-2', topic: 'Electronic configuration', q: 'The maximum number of electrons in the L shell is…', options: ['2', '8', '18', '32'], answer: 1, explanation: 'Using 2n² with n = 2 gives 8 electrons.', difficulty: 'easy' },
      { id: 'chem2-m3', chapterId: 'chem-2', topic: 'Isotopes', q: 'Isotopes of an element differ in the number of…', options: ['protons', 'electrons', 'neutrons', 'shells'], answer: 2, explanation: 'Same atomic number (protons) but different mass number means a different neutron count.', difficulty: 'easy' },
      { id: 'chem2-m4', chapterId: 'chem-2', topic: 'Atomic structure', q: 'Which particle has approximately the same mass as a proton?', options: ['electron', 'neutron', 'positron', 'photon'], answer: 1, explanation: 'Protons and neutrons both have mass close to 1 amu; the electron is about 1836 times lighter.', difficulty: 'medium' },
      { id: 'chem2-m5', chapterId: 'chem-2', topic: 'Isotopes', q: 'The number of isotopes of hydrogen is…', options: ['1', '2', '3', '4'], answer: 2, explanation: 'Protium, deuterium and tritium.', difficulty: 'easy' },
    ],
    flashcards: [
      { id: 'chem2-f1', chapterId: 'chem-2', front: 'Isotopes', back: 'Atoms of the same element with the same atomic number but different mass numbers.' },
      { id: 'chem2-f2', chapterId: 'chem-2', front: 'Max electrons in a shell', back: '2n², where n is the shell number: K=2, L=8, M=18, N=32.' },
      { id: 'chem2-f3', chapterId: 'chem-2', front: 'Atomic number (Z)', back: 'The number of protons in the nucleus, which identifies the element.' },
      { id: 'chem2-f4', chapterId: 'chem-2', front: 'Mass number (A)', back: 'Total number of protons and neutrons in the nucleus.' },
    ],
    shortQs: [
      { id: 'chem2-q1', chapterId: 'chem-2', marks: 2, q: 'State two conclusions of Rutherford’s atomic model.', answer: 'The atom is mostly empty space, and all the positive charge with nearly all the mass is concentrated in a tiny nucleus at the centre.', points: ['mostly empty space (1)', 'dense positive nucleus (1)'] },
      { id: 'chem2-q2', chapterId: 'chem-2', marks: 2, q: 'Why do isotopes of an element have identical chemical properties?', answer: 'Chemical properties depend on the number and arrangement of electrons, which is the same for all isotopes of an element; only the neutron count differs.', points: ['same electronic configuration (1)', 'only neutrons differ (1)'] },
    ],
    blanks: [
      { id: 'chem2-b1', chapterId: 'chem-2', sentence: ['The maximum number of electrons in the M shell is ', '.'], answer: '18', options: ['8', '18', '32', '2'] },
      { id: 'chem2-b2', chapterId: 'chem-2', sentence: ['Atoms with the same atomic number but different mass numbers are called ', '.'], answer: 'isotopes', options: ['isotopes', 'isobars', 'ions', 'isomers'] },
    ],
  },
  'bio-4': {
    audioTitle: 'Cells and Tissues, full chapter',
    sections: [
      {
        id: 'bio-4-s1',
        title: 'The cell and microscopy',
        blocks: [
          { kind: 'h', text: 'Discovery of the cell' },
          { kind: 'p', text: 'Robert Hooke observed cork under a microscope in 1665 and named the compartments “cells”. The cell theory states that all organisms are made of cells, the cell is the basic unit of structure and function, and all cells come from pre-existing cells.' },
          { kind: 'def', term: 'Resolution', text: 'The smallest distance between two points at which they can still be seen as separate. Light microscopes resolve about 0.2 µm.' },
        ],
      },
      {
        id: 'bio-4-s2',
        title: 'Cell organelles',
        blocks: [
          { kind: 'list', items: ['Nucleus: contains DNA and controls cell activities.', 'Mitochondria: site of aerobic respiration, the “power house”.', 'Chloroplast: photosynthesis in plant cells.', 'Ribosomes: protein synthesis.', 'Vacuole: storage, large and central in plant cells.'] },
          { kind: 'p', text: 'Plant cells have a cellulose cell wall, chloroplasts and a large central vacuole; animal cells have centrioles and lack a cell wall.' },
        ],
      },
      {
        id: 'bio-4-s3',
        title: 'Transport across the membrane',
        blocks: [
          { kind: 'def', term: 'Diffusion', text: 'Movement of molecules from a region of higher concentration to lower concentration.' },
          { kind: 'def', term: 'Osmosis', text: 'Diffusion of water through a selectively permeable membrane from a dilute to a concentrated solution.' },
          { kind: 'p', text: 'Active transport moves substances against the concentration gradient and requires energy from ATP.' },
        ],
      },
    ],
    mcqs: [
      { id: 'bio4-m1', chapterId: 'bio-4', topic: 'Organelles', q: 'The “power house” of the cell is the…', options: ['nucleus', 'mitochondrion', 'ribosome', 'vacuole'], answer: 1, explanation: 'Mitochondria carry out aerobic respiration, producing most of the cell’s ATP.', difficulty: 'easy' },
      { id: 'bio4-m2', chapterId: 'bio-4', topic: 'Cell structure', q: 'Which structure is present in a plant cell but absent in an animal cell?', options: ['ribosome', 'chloroplast', 'nucleus', 'mitochondrion'], answer: 1, explanation: 'Chloroplasts (and a cellulose cell wall) are plant-specific.', difficulty: 'easy' },
      { id: 'bio4-m3', chapterId: 'bio-4', topic: 'Transport', q: 'Movement of water through a selectively permeable membrane is called…', options: ['diffusion', 'osmosis', 'active transport', 'plasmolysis'], answer: 1, explanation: 'Osmosis is specifically the diffusion of water across a selectively permeable membrane.', difficulty: 'easy' },
      { id: 'bio4-m4', chapterId: 'bio-4', topic: 'Transport', q: 'Active transport differs from diffusion because it…', options: ['needs no energy', 'requires ATP', 'only moves water', 'is always faster'], answer: 1, explanation: 'Active transport moves substances against the gradient and consumes ATP.', difficulty: 'medium' },
      { id: 'bio4-m5', chapterId: 'bio-4', topic: 'Microscopy', q: 'Who first observed and named cells?', options: ['Robert Brown', 'Robert Hooke', 'Louis Pasteur', 'Rudolf Virchow'], answer: 1, explanation: 'Robert Hooke described “cells” in cork in 1665.', difficulty: 'easy' },
    ],
    flashcards: [
      { id: 'bio4-f1', chapterId: 'bio-4', front: 'Osmosis', back: 'Diffusion of water through a selectively permeable membrane from dilute to concentrated solution.' },
      { id: 'bio4-f2', chapterId: 'bio-4', front: 'Mitochondrion', back: 'Site of aerobic respiration, produces ATP. Has its own DNA and a folded inner membrane (cristae).' },
      { id: 'bio4-f3', chapterId: 'bio-4', front: 'Cell theory', back: 'All organisms are made of cells; the cell is the basic unit of structure and function; all cells arise from pre-existing cells.' },
      { id: 'bio4-f4', chapterId: 'bio-4', front: 'Plant vs animal cell', back: 'Plant: cell wall, chloroplasts, large central vacuole. Animal: centrioles, no cell wall, small vacuoles.' },
    ],
    shortQs: [
      { id: 'bio4-q1', chapterId: 'bio-4', marks: 3, q: 'Differentiate between diffusion and osmosis.', answer: 'Diffusion is the movement of any molecules from higher to lower concentration; osmosis is specifically the movement of water molecules from a dilute to a concentrated solution through a selectively permeable membrane. Neither requires energy.', points: ['diffusion = any molecule down gradient (1)', 'osmosis = water through membrane (1)', 'both passive (1)'] },
      { id: 'bio4-q2', chapterId: 'bio-4', marks: 2, q: 'Give two differences between plant and animal cells.', answer: 'Plant cells have a cellulose cell wall and chloroplasts; animal cells have neither and instead contain centrioles.', points: ['cell wall / chloroplast in plants (1)', 'centrioles / no wall in animals (1)'] },
    ],
    blanks: [
      { id: 'bio4-b1', chapterId: 'bio-4', sentence: ['Protein synthesis takes place on the ', '.'], answer: 'ribosomes', options: ['ribosomes', 'lysosomes', 'chloroplasts', 'centrioles'] },
      { id: 'bio4-b2', chapterId: 'bio-4', sentence: ['Movement of substances against a concentration gradient needs ', '.'], answer: 'energy', options: ['water', 'energy', 'enzymes', 'light'] },
    ],
  },
};

/* ------------------------------------------------- generated fallback */

export const isAuthored = (chapterId: string) => !!AUTHORED[chapterId];

/** The topics a chapter covers, taken from its blurb. */
const termsOf = (ch: Chapter) =>
  ch.blurb
    .replace(/\.$/, '')
    .split(/,|;| and /)
    .map((t) => t.trim().replace(/^[a-z]/, (m) => m))
    .filter((t) => t.length > 3);

/** Terms from other chapters of the same subject, used as plausible distractors. */
function otherTerms(ch: Chapter, n: number): string[] {
  const pool = (CHAPTERS[ch.subjectId] ?? [])
    .filter((c) => c.id !== ch.id)
    .flatMap(termsOf)
    .filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < pool.length && out.length < n; i++) {
    const pick = pool[(i * 7 + ch.number * 3) % pool.length];
    if (!out.includes(pick)) out.push(pick);
  }
  while (out.length < n) out.push('none of these');
  return out;
}

/**
 * Readable placeholder content for chapters the client hasn't supplied yet.
 * Questions are built from the real chapter/topic names so the app never shows
 * "option A / option B" filler, while staying obviously provisional.
 */
function generate(ch: Chapter): ChapterContent {
  const topic = ch.title;
  const terms = termsOf(ch);
  const sections: Section[] = Array.from({ length: Math.min(4, ch.sectionCount) }, (_, i) => ({
    id: `${ch.id}-gs${i + 1}`,
    title: i === 0 ? `What this chapter covers` : terms[i - 1] ? `${terms[i - 1]}` : `${topic}, part ${i}`,
    blocks: [
      { kind: 'h', text: i === 0 ? `${topic} at a glance` : terms[i - 1] ?? `${topic}, part ${i}` },
      { kind: 'p', text: ch.blurb },
      ...(i === 0 && terms.length
        ? ([{ kind: 'list', items: terms }] as Block[])
        : ([
            {
              kind: 'p',
              text: `Detailed notes, worked examples and figures for ${terms[i - 1] ?? topic} come from the client’s own material and are loaded through the admin panel.`,
            },
          ] as Block[])),
      { kind: 'def', term: terms[i] ?? topic, text: `Part of ${topic} in the FBISE Class 9 scheme of study.` },
    ],
  }));

  const mcqs: Mcq[] = terms.slice(0, 6).flatMap((term, i) => {
    const distractors = otherTerms(ch, 3);
    const options = [distractors[0], term, distractors[1], distractors[2]];
    const q1: Mcq = {
      id: `${ch.id}-gm${i + 1}`,
      chapterId: ch.id,
      topic,
      q: `Which of these is studied in “${topic}”?`,
      options,
      answer: 1,
      explanation: `“${term}” is part of ${topic}. The others belong to different chapters of ${subjectById(ch.subjectId)?.name}.`,
      difficulty: i % 3 === 0 ? 'easy' : i % 3 === 1 ? 'medium' : 'hard',
    };
    const chapterOptions = (CHAPTERS[ch.subjectId] ?? [])
      .filter((c) => c.id !== ch.id)
      .slice(0, 3)
      .map((c) => c.title);
    const q2: Mcq = {
      id: `${ch.id}-gm${i + 1}b`,
      chapterId: ch.id,
      topic,
      q: `“${term}” belongs to which chapter?`,
      options: [chapterOptions[0] ?? 'Another chapter', topic, chapterOptions[1] ?? 'Another chapter', chapterOptions[2] ?? 'Another chapter'],
      answer: 1,
      explanation: `${term} is covered in Chapter ${ch.number}, ${topic}.`,
      difficulty: 'easy',
    };
    return [q1, q2];
  });

  const flashcards: Flashcard[] = terms.slice(0, 6).map((term, i) => ({
    id: `${ch.id}-gf${i + 1}`,
    chapterId: ch.id,
    front: term,
    back: `Studied in Chapter ${ch.number}, ${topic}. The full definition comes with the client’s notes.`,
  }));

  const shortQs: ShortQ[] = terms.slice(0, 3).map((term, i) => ({
    id: `${ch.id}-gq${i + 1}`,
    chapterId: ch.id,
    marks: 2,
    q: `Briefly explain ${term}.`,
    answer: `${term} is part of ${topic} (Chapter ${ch.number}). The marked model answer is supplied with the client’s content.`,
    points: [`defines ${term} (1 mark)`, 'gives an example or application (1 mark)'],
  }));

  const blanks: Blank[] = terms.slice(0, 3).map((term, i) => ({
    id: `${ch.id}-gb${i + 1}`,
    chapterId: ch.id,
    sentence: [`In Chapter ${ch.number}, `, ` is one of the main topics.`],
    answer: term,
    options: [term, ...otherTerms(ch, 3)],
  }));

  return { sections, mcqs, flashcards, shortQs, blanks, audioTitle: `${topic}, full chapter` };
}

/**
 * Generated content is deterministic per chapter, so it is built once and kept.
 * Without this cache every progress sweep (chapterPct, subjectPct, getMcqs)
 * re-ran generate() per unauthored chapter, ~0.2ms a call, which added up to
 * 40-90ms per render on a phone once a screen swept all seven subjects.
 */
const GENERATED = new Map<string, ChapterContent>();
const EMPTY_CONTENT: ChapterContent = { sections: [], mcqs: [], flashcards: [], shortQs: [], blanks: [], audioTitle: '' };

export function contentFor(chapterId: string): ChapterContent {
  if (AUTHORED[chapterId]) return AUTHORED[chapterId];
  const hit = GENERATED.get(chapterId);
  if (hit) return hit;
  const ch = chapterById(chapterId);
  if (!ch) return EMPTY_CONTENT;
  const built = generate(ch);
  GENERATED.set(chapterId, built);
  return built;
}

export const PAST_PAPERS: PastPaper[] = [
  { id: 'pp1', subjectId: 'phy', year: 2025, session: 'Annual', marks: 65, minutes: 150, downloaded: true },
  { id: 'pp-urd', subjectId: 'urd', year: 2025, session: 'Annual', marks: 75, minutes: 180, downloaded: false },
  { id: 'pp2', subjectId: 'phy', year: 2024, session: 'Annual', marks: 65, minutes: 150, downloaded: true },
  { id: 'pp3', subjectId: 'phy', year: 2024, session: 'Supplementary', marks: 65, minutes: 150, downloaded: false },
  { id: 'pp4', subjectId: 'phy', year: 2023, session: 'Annual', marks: 65, minutes: 150, downloaded: false },
  { id: 'pp5', subjectId: 'chem', year: 2025, session: 'Annual', marks: 65, minutes: 150, downloaded: false },
  { id: 'pp6', subjectId: 'chem', year: 2024, session: 'Annual', marks: 65, minutes: 150, downloaded: false },
  { id: 'pp7', subjectId: 'bio', year: 2025, session: 'Annual', marks: 65, minutes: 150, downloaded: false },
  { id: 'pp8', subjectId: 'math', year: 2025, session: 'Annual', marks: 75, minutes: 180, downloaded: false },
];

/**
 * Two papers written out in full, one English-medium Physics paper and one Urdu
 * paper, so the client can see a complete paper in the viewer. The rest are
 * listed but carry the shared sample body until the real papers arrive.
 */
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

/** Fallback body for papers the client hasn't supplied yet. */
export const PAPER_BODY: PaperSection[] = [
  {
    heading: 'SECTION A · Objective',
    marks: '12 marks',
    lines: ['Q1. Circle the correct option.', 'The full paper for this year loads here once the client supplies it.'],
  },
  {
    heading: 'SECTION B · Short answer questions',
    marks: '33 marks',
    lines: ['Q2. Attempt any eleven parts.'],
  },
  {
    heading: 'SECTION C · Detailed answer questions',
    marks: '20 marks',
    lines: ['Q3. Attempt all questions.'],
  },
];

export const paperContent = (id: string): PaperSection[] => PAPER_CONTENT[id] ?? PAPER_BODY;
