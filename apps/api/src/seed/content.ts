import { MISSION_BANK } from '../ai/tasks/mock-bank';

type L = { en: string; ar: string };

export const SUBJECTS = [
  { key: 'math', name: { en: 'Mathematics', ar: 'الرياضيات', fr: 'Mathématiques' }, color: 'violet', icon: 'triangle' },
  { key: 'physics', name: { en: 'Physics', ar: 'الفيزياء', fr: 'Physique' }, color: 'sky', icon: 'zap' },
  { key: 'chemistry', name: { en: 'Chemistry', ar: 'الكيمياء', fr: 'Chimie' }, color: 'mint', icon: 'flask' },
  { key: 'biology', name: { en: 'Biology', ar: 'الأحياء', fr: 'Biologie' }, color: 'green', icon: 'leaf' },
  { key: 'history', name: { en: 'History', ar: 'التاريخ', fr: 'Histoire' }, color: 'coral', icon: 'landmark' },
  { key: 'languages', name: { en: 'Languages', ar: 'اللغات', fr: 'Langues' }, color: 'sunny', icon: 'languages' },
  // taught subjects the school timetable schedules (no seeded classes or topics yet)
  { key: 'arabic', name: { en: 'Arabic', ar: 'اللغة العربية', fr: 'Arabe' }, color: 'coral', icon: 'book' },
  { key: 'french', name: { en: 'French', ar: 'اللغة الفرنسية', fr: 'Français' }, color: 'pink', icon: 'globe' },
  { key: 'english', name: { en: 'English', ar: 'اللغة الإنجليزية', fr: 'Anglais' }, color: 'sky', icon: 'languages' },
  { key: 'sport', name: { en: 'Sport', ar: 'الرياضة البدنية', fr: 'Sport' }, color: 'slate', icon: 'dumbbell' },
];

export const TOPICS = [
  { key: 'geo.area', subject: 'math', icon: 'square', pos: [180, 0], prereqs: [], name: { en: 'Perimeter & area', ar: 'المحيط والمساحة' }, description: { en: 'Measure and compute the surface of real spaces.', ar: 'قياس وحساب مساحة الأماكن الحقيقية.' }, ref: 'LB-M8-G1' },
  { key: 'geo.angles', subject: 'math', icon: 'angle', pos: [0, 170], prereqs: ['geo.area'], name: { en: 'Angles', ar: 'الزوايا' }, description: { en: 'Measure angles and slopes around you.', ar: 'قياس الزوايا والمنحدرات من حولك.' }, ref: 'LB-M8-G2' },
  { key: 'geo.circles', subject: 'math', icon: 'circle', pos: [180, 170], prereqs: ['geo.area'], name: { en: 'Circles & sectors', ar: 'الدوائر والقطاعات' }, description: { en: 'Share circles fairly using angles and areas.', ar: 'تقسيم الدوائر بعدل باستخدام الزوايا والمساحات.' }, ref: 'LB-M8-G4' },
  { key: 'geo.volume', subject: 'math', icon: 'cube', pos: [360, 170], prereqs: ['geo.area'], name: { en: 'Volume', ar: 'الحجم' }, description: { en: 'How much fits inside real containers.', ar: 'كم يتّسع داخل الأوعية الحقيقية.' }, ref: 'LB-M8-G5' },
  { key: 'geo.similar', subject: 'math', icon: 'triangle', pos: [0, 340], prereqs: ['geo.angles'], name: { en: 'Similar triangles', ar: 'المثلثات المتشابهة' }, description: { en: 'Same shape, different size: measure the unmeasurable.', ar: 'الشكل نفسه بحجم مختلف: قِس ما لا يُقاس.' }, ref: 'LB-M8-G3' },
  { key: 'geo.pythagoras', subject: 'math', icon: 'ruler', pos: [0, 510], prereqs: ['geo.similar'], name: { en: 'Pythagoras', ar: 'فيثاغورس' }, description: { en: 'Right triangles hide in every screen, ramp and ladder.', ar: 'المثلثات القائمة مختبئة في كل شاشة ومنحدر.' }, ref: 'LB-M8-G6' },
  { key: 'phy.speed', subject: 'physics', icon: 'gauge', pos: [200, 0], prereqs: [], name: { en: 'Speed', ar: 'السرعة' }, description: { en: 'Distance, time and speed in daily life.', ar: 'المسافة والزمن والسرعة في الحياة اليومية.' }, ref: 'LB-P8-K1' },
  { key: 'chem.kitchen', subject: 'chemistry', icon: 'flask', pos: [200, 0], prereqs: [], name: { en: 'Kitchen mixtures', ar: 'خلائط المطبخ' }, description: { en: 'Solutions and mixtures you can make safely at home.', ar: 'محاليل وخلائط يمكنك تحضيرها بأمان في المنزل.' }, ref: 'LB-C8-1' },
  { key: 'his.oral', subject: 'history', icon: 'mic', pos: [200, 0], prereqs: [], name: { en: 'Oral history', ar: 'التاريخ الشفهي' }, description: { en: 'Collect memories and compare then vs now.', ar: 'جمع الذكريات ومقارنة الماضي بالحاضر.' }, ref: 'LB-H8-1' },
];

const bank = (topic: string, i = 0) => MISSION_BANK[topic][i];

function mission(topic: string, idx: number, ar: { title: string; story: string; steps?: string[]; lesson?: string; safety?: string; fields?: string[]; photoHint?: string }) {
  const m = bank(topic, idx);
  return {
    title: { en: m.title, ar: ar.title },
    story: { en: m.story, ar: ar.story },
    steps: { en: m.steps, ar: ar.steps ?? m.steps },
    miniLesson: { text: { en: m.miniLesson.text, ar: ar.lesson ?? m.miniLesson.text }, visualSpec: m.miniLesson.visualSpec },
    proofSpec: {
      ...m.proofSpec,
      photoHint: m.proofSpec.photoHint ? { en: m.proofSpec.photoHint, ar: ar.photoHint ?? m.proofSpec.photoHint } : undefined,
      fields: m.proofSpec.fields.map((f, i) => ({ ...f, label: { en: f.label, ar: ar.fields?.[i] ?? f.label } })),
    },
    rubric: m.rubric,
    safetyNotes: { en: m.safetyNotes, ar: ar.safety ?? m.safetyNotes },
    difficulty: m.difficulty,
    estimatedMin: m.estimatedMin,
  };
}

export const MISSIONS = [
  {
    key: 'm.area.tile',
    topic: 'geo.area',
    audience: 'STUDENT' as const,
    ...mission('geo.area', 0, {
      title: 'بلّط غرفة نومك',
      story: 'عائلتك تريد بلاطاً جديداً. كل علبة تغطي 1.5 م². كم علبة يجب أن تشتري حتى لا يضيع شيء؟',
      steps: ['قِس طول وعرض أرضية غرفتك.', 'احسب المساحة.', 'اقسم على 1.5 م² للعلبة وقرّب إلى الأعلى.', 'صوّر قياساتك.'],
      lesson: 'مساحة المستطيل = الطول × العرض. إذا لم تكن الغرفة مستطيلة، قسّمها إلى مستطيلات واجمع مساحاتها.',
      fields: ['الطول', 'العرض', 'عدد العلب'],
    }),
  },
  {
    key: 'm.angles.ramp',
    topic: 'geo.angles',
    audience: 'STUDENT' as const,
    ...mission('geo.angles', 0, {
      title: 'هل درجك آمن كمنحدر؟',
      story: 'جار على كرسي متحرك سيزوركم الأسبوع المقبل. المنحدر الآمن يرتفع 1 سم فقط لكل 12 سم. هل يمكن استبدال درجات المدخل بمنحدر آمن؟',
      steps: ['قِس الارتفاع الكلي لدرجات المدخل.', 'قِس المسافة المتاحة أمامها.', 'احسب الارتفاع ÷ الطول وقارنه بـ 1 ÷ 12.', 'صوّر قياساتك.'],
      lesson: 'انحدار المنحدر هو زاويته مع الأرض. زاوية صغيرة تعني منحدراً لطيفاً. قارن بين المنحدرات بحساب الارتفاع ÷ الطول: كلما صغر كان أكثر أماناً.',
      fields: ['الارتفاع', 'الطول الأفقي'],
    }),
  },
  {
    key: 'm.similar.shadows',
    topic: 'geo.similar',
    audience: 'STUDENT' as const,
    classroomCourseWorkId: 'fake-cw-shadows',
    ...mission('geo.similar', 0, {
      title: 'قِس ارتفاع مبناك بالظلال',
      story: 'لا أحد في مبناك يعرف كم هو مرتفع فعلاً. بشريط قياس والشمس فقط، يمكنك أن تكتشف ذلك — الحيلة نفسها التي استخدمها طاليس لقياس الأهرامات قبل 2600 سنة.',
      steps: [
        'في يوم مشمس، اخرج مع أحد والديك أو صديق.',
        'قِس طولك (h) وطول ظلّك (s).',
        'فوراً، قِس طول ظل المبنى (S).',
        'التقط صورة لكل قياس.',
        'استخدم h / s = H / S لحساب ارتفاع المبنى (H).',
      ],
      lesson: 'عندما تشرق الشمس، تسقط أشعتها عليك وعلى المبنى بالزاوية نفسها. لذلك المثلث الذي تصنعه أنت وظلّك له شكل المثلث الذي يصنعه المبنى وظلّه نفسه — إنهما متشابهان. المثلثات المتشابهة تحافظ على النسب نفسها: طولك ÷ ظلّك = ارتفاع المبنى ÷ ظلّه. قِس ثلاثة أشياء، والرابع مجرد حساب!',
      safety: 'ابقَ على الرصيف أو في الباحة بعيداً عن السيارات. لا تنظر مباشرة إلى الشمس.',
      fields: ['طولك', 'ظلّك', 'ظل المبنى', 'ارتفاع المبنى'],
      photoHint: 'صورة لقياس ظلّك، وصورة لظل المبنى.',
    }),
  },
  {
    key: 'm.pythagoras.tv',
    topic: 'geo.pythagoras',
    audience: 'STUDENT' as const,
    ...mission('geo.pythagoras', 0, { title: 'هل شاشتك فعلاً 55 إنشاً؟', story: 'تُقاس الشاشات على القطر. هل التلفاز في بيتك فعلاً بالحجم المكتوب على العلبة؟ اكتشف ذلك من دون قياس القطر أبداً.' }),
  },
  {
    key: 'm.circles.pizza',
    topic: 'geo.circles',
    audience: 'STUDENT' as const,
    ...mission('geo.circles', 0, { title: 'بيتزا عادلة لسبعة', story: 'سبعة أصدقاء، بيتزا واحدة، ولا خلاف. التقسيم إلى 8 سهل — لكن إلى 7؟ احسب زاوية كل قطعة والمساحة التي يحصل عليها كل واحد.' }),
  },
  {
    key: 'm.volume.tank',
    topic: 'geo.volume',
    audience: 'STUDENT' as const,
    ...mission('geo.volume', 0, { title: 'كم ليتراً يتّسع خزان السطح؟', story: 'في الصيف، ينفد الماء من الخزان. كم ليتراً يتّسع فعلاً، وكم يوماً يكفي عائلتك؟' }),
  },
  {
    key: 'm.speed.walk',
    topic: 'phy.speed',
    audience: 'STUDENT' as const,
    ...mission('phy.speed', 0, { title: 'سرعة مشيك إلى المدرسة', story: 'هل أنت أسرع من باص المدرسة في زحمة السير؟ قِس سرعة مشيك الحقيقية.' }),
  },
  {
    key: 'm.history.grandparent',
    topic: 'his.oral',
    audience: 'STUDENT' as const,
    ...mission('his.oral', 0, { title: 'قابِل جدّك أو جدّتك', story: 'التاريخ ليس في الكتب فقط — إنه يعيش في عائلتك. كيف كانت المدرسة في زمن أجدادك؟' }),
  },
  {
    key: 'm.family.balcony',
    topic: 'geo.area',
    audience: 'FAMILY' as const,
    title: { en: 'Tile the balcony together', ar: 'بلّطوا الشرفة معاً' },
    story: {
      en: 'Your family is dreaming of a new balcony floor. Together, measure it and plan the tiles — who guesses closest to the real number of tiles?',
      ar: 'عائلتك تحلم بأرضية جديدة للشرفة. قيسوها معاً وخطّطوا للبلاط — من يخمّن العدد الأقرب للحقيقة؟',
    },
    steps: {
      en: ['Each family member guesses how many 30 × 30 cm tiles are needed.', 'Measure the balcony length and width together.', 'Compute the area and the number of tiles.', 'Take a family photo of the measuring (faces optional!).'],
      ar: ['كل فرد من العائلة يخمّن عدد البلاطات 30 × 30 سم اللازمة.', 'قيسوا طول الشرفة وعرضها معاً.', 'احسبوا المساحة وعدد البلاطات.', 'التقطوا صورة عائلية للقياس (الوجوه اختيارية!).'],
    },
    miniLesson: { text: { en: 'Area = length × width. One tile of 30 cm × 30 cm covers 0.09 m².', ar: 'المساحة = الطول × العرض. بلاطة 30 × 30 سم تغطي 0.09 م².' }, visualSpec: MISSION_BANK['geo.area'][0].miniLesson.visualSpec },
    proofSpec: { photos: 1, explanation: true, fields: [{ key: 'area', label: { en: 'Area', ar: 'المساحة' }, unit: 'm²' }, { key: 'tiles', label: { en: 'Tiles', ar: 'البلاطات' } }] },
    rubric: [
      { criterion: 'Measurements', description: 'Length and width measured together', weight: 40 },
      { criterion: 'Method', description: 'Area and tile count computed', weight: 40 },
      { criterion: 'Explanation', description: 'Explains who guessed closest and why', weight: 20 },
    ],
    safetyNotes: { en: 'Stay away from the balcony railing; measure the floor only.', ar: 'ابتعدوا عن درابزين الشرفة؛ قيسوا الأرضية فقط.' },
    difficulty: 'EASY' as const,
    estimatedMin: 25,
  },
];

export const BADGES: { key: string; icon: string; name: L; criteria: string }[] = [
  { key: 'first_mission', icon: '🚀', name: { en: 'First mission', ar: 'المهمّة الأولى' }, criteria: 'Validate your first mission' },
  { key: 'shadow_hunter', icon: '🌓', name: { en: 'Shadow hunter', ar: 'صائد الظلال' }, criteria: 'Measure a building with shadows' },
  { key: 'architect', icon: '🏗️', name: { en: 'Architect', ar: 'المهندس' }, criteria: '3 area or volume missions' },
  { key: 'pizza_master', icon: '🍕', name: { en: 'Pizza master', ar: 'سيّد البيتزا' }, criteria: 'Validate a circles mission' },
  { key: 'peer_hero', icon: '🦸', name: { en: 'Peer hero', ar: 'بطل الزملاء' }, criteria: 'Complete 5 peer evaluations' },
  { key: 'kind_reviewer', icon: '💜', name: { en: 'Kind reviewer', ar: 'المقيّم اللطيف' }, criteria: 'Get 3 helpful ratings' },
  { key: 'streak_7', icon: '🔥', name: { en: '7-day streak', ar: 'سلسلة 7 أيام' }, criteria: 'Learn 7 days in a row' },
  { key: 'family_team', icon: '👨‍👩‍👧', name: { en: 'Family team', ar: 'فريق العائلة' }, criteria: '2 family missions' },
  { key: 'kitchen_chemist', icon: '🧪', name: { en: 'Kitchen chemist', ar: 'كيميائي المطبخ' }, criteria: 'Validate a chemistry mission' },
  { key: 'time_traveler', icon: '⏳', name: { en: 'Time traveler', ar: 'المسافر عبر الزمن' }, criteria: 'Validate a history mission' },
];
