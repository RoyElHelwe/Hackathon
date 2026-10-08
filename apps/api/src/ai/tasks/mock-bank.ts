import type { AiMission, VisualSpec } from '@tajriba/shared';

export const SHADOW_VISUAL: VisualSpec = {
  caption: 'Same sun angle → similar triangles: h / s = H / S',
  shapes: [
    { kind: 'circle', cx: 94, cy: 10, r: 6, color: 'sunny' },
    { kind: 'rect', x: 52, y: 30, w: 14, h: 50, color: 'violet', label: 'Building H' },
    { kind: 'polygon', points: [[66, 80], [66, 30], [8, 80]], color: 'violet' },
    { kind: 'line', x1: 8, y1: 80, x2: 66, y2: 80, color: 'ink', label: 'Shadow S' },
    { kind: 'rect', x: 89, y: 66, w: 3, h: 14, color: 'mint', label: 'You h' },
    { kind: 'line', x1: 76, y1: 80, x2: 89, y2: 80, color: 'mint', label: 's' },
    { kind: 'line', x1: 94, y1: 10, x2: 8, y2: 80, color: 'sunny', dashed: true },
  ],
};

export const AREA_VISUAL: VisualSpec = {
  caption: 'Area = length × width',
  shapes: [
    { kind: 'rect', x: 15, y: 20, w: 70, h: 50, color: 'mint' },
    { kind: 'line', x1: 15, y1: 75, x2: 85, y2: 75, color: 'ink', label: 'length' },
    { kind: 'line', x1: 90, y1: 20, x2: 90, y2: 70, color: 'ink', label: 'width' },
    { kind: 'text', x: 40, y: 48, text: 'A = L × W' },
  ],
};

export const ANGLE_VISUAL: VisualSpec = {
  caption: 'A safe ramp rises gently: small angle',
  shapes: [
    { kind: 'polygon', points: [[10, 80], [90, 80], [90, 55]], color: 'sky' },
    { kind: 'text', x: 22, y: 76, text: 'θ' },
    { kind: 'line', x1: 92, y1: 55, x2: 92, y2: 80, color: 'ink', label: 'rise' },
    { kind: 'line', x1: 10, y1: 84, x2: 90, y2: 84, color: 'ink', label: 'run' },
  ],
};

export const CIRCLE_VISUAL: VisualSpec = {
  caption: '7 equal slices → each angle = 360° ÷ 7 ≈ 51.4°',
  shapes: [
    { kind: 'circle', cx: 50, cy: 50, r: 35, color: 'sunny' },
    { kind: 'line', x1: 50, y1: 50, x2: 50, y2: 15, color: 'coral' },
    { kind: 'line', x1: 50, y1: 50, x2: 77, y2: 28, color: 'coral' },
    { kind: 'text', x: 55, y: 35, text: '51°' },
  ],
};

export const VOLUME_VISUAL: VisualSpec = {
  caption: 'Cylinder volume = π × r² × h',
  shapes: [
    { kind: 'rect', x: 30, y: 25, w: 40, h: 50, color: 'sky' },
    { kind: 'circle', cx: 50, cy: 25, r: 20, color: 'sky' },
    { kind: 'line', x1: 50, y1: 25, x2: 70, y2: 25, color: 'ink', label: 'r' },
    { kind: 'line', x1: 75, y1: 25, x2: 75, y2: 75, color: 'ink', label: 'h' },
  ],
};

export const SPEED_VISUAL: VisualSpec = {
  caption: 'speed = distance ÷ time',
  shapes: [
    { kind: 'line', x1: 10, y1: 60, x2: 90, y2: 60, color: 'ink', label: 'distance' },
    { kind: 'circle', cx: 15, cy: 50, r: 6, color: 'sky', label: 'home' },
    { kind: 'rect', x: 80, y: 40, w: 12, h: 20, color: 'violet', label: 'school' },
  ],
};

export const HISTORY_VISUAL: VisualSpec = {
  caption: 'A timeline: then → now',
  shapes: [
    { kind: 'line', x1: 10, y1: 50, x2: 90, y2: 50, color: 'coral' },
    { kind: 'circle', cx: 20, cy: 50, r: 4, color: 'coral', label: '1975' },
    { kind: 'circle', cx: 50, cy: 50, r: 4, color: 'coral', label: '2000' },
    { kind: 'circle', cx: 85, cy: 50, r: 4, color: 'coral', label: 'today' },
  ],
};

const stdRubric = (focus: string) => [
  { criterion: 'Measurements', description: 'Clear, realistic measurements with units', weight: 30 },
  { criterion: 'Method', description: `Correct use of ${focus}`, weight: 40 },
  { criterion: 'Explanation', description: 'Explains the reasoning in own words', weight: 30 },
];

type Bank = Record<string, AiMission[]>;

export const MISSION_BANK: Bank = {
  'geo.similar': [
    {
      title: 'Measure your building with shadows',
      story: 'Nobody in your building knows how tall it really is. With just a tape measure and the sun, you can find out — the same trick Thales used to measure the pyramids 2,600 years ago.',
      steps: [
        'On a sunny day, go outside with a parent or friend.',
        'Measure your own height (h) and the length of your shadow (s).',
        "Right away, measure the length of your building's shadow (S).",
        'Take a photo of each shadow measurement.',
        'Use h / s = H / S to calculate the height of the building (H).',
      ],
      miniLesson: {
        text: 'When the sun shines, it hits you and your building at the same angle. So the triangle made by you and your shadow has the same shape as the triangle made by the building and its shadow — they are similar. Similar triangles keep the same ratios: your height divided by your shadow equals the building height divided by its shadow. Measure three things, and the fourth is just a calculation!',
        visualSpec: SHADOW_VISUAL,
      },
      proofSpec: {
        photos: 2,
        photoHint: 'One photo of your shadow being measured, one of the building shadow.',
        explanation: true,
        fields: [
          { key: 'h', label: 'Your height', unit: 'm' },
          { key: 's', label: 'Your shadow', unit: 'm' },
          { key: 'S', label: 'Building shadow', unit: 'm' },
          { key: 'H', label: 'Building height', unit: 'm' },
        ],
      },
      rubric: stdRubric('similar triangles (h/s = H/S)'),
      safetyNotes: 'Stay on the sidewalk or in the courtyard, away from traffic. Never look directly at the sun.',
      difficulty: 'MEDIUM',
      estimatedMin: 30,
    },
    {
      title: 'How tall is the tree in the school yard?',
      story: 'The school wants to put lights in the big tree for the winter festival. How long should the light string be? Use a mirror on the ground and similar triangles to find out.',
      steps: [
        'Place a small mirror flat on the ground a few meters from the tree.',
        'Step back until you see the top of the tree in the mirror.',
        'Measure: your eye height, your distance to the mirror, the mirror distance to the tree.',
        'Calculate the tree height with similar triangles.',
      ],
      miniLesson: {
        text: 'Light bounces off a mirror at the same angle it arrives. That makes two similar triangles: one from your eyes to the mirror, one from the mirror to the tree top. Same angles → same ratios.',
        visualSpec: SHADOW_VISUAL,
      },
      proofSpec: {
        photos: 1,
        photoHint: 'A photo of the mirror on the ground with the tree behind it.',
        explanation: true,
        fields: [
          { key: 'eye', label: 'Eye height', unit: 'm' },
          { key: 'd1', label: 'You → mirror', unit: 'm' },
          { key: 'd2', label: 'Mirror → tree', unit: 'm' },
          { key: 'H', label: 'Tree height', unit: 'm' },
        ],
      },
      rubric: stdRubric('similar triangles with the mirror method'),
      safetyNotes: 'Do it in the school yard during the day with a classmate.',
      difficulty: 'HARD',
      estimatedMin: 35,
    },
    {
      title: 'Shrink your room into a map',
      story: 'You are redesigning your room for 2036. Draw a scale plan where every 1 cm on paper is 50 cm in real life — a similar shape, just smaller.',
      steps: ['Measure the walls of your room.', 'Divide every length by 50.', 'Draw the plan on squared paper.', 'Photograph the plan next to the room.'],
      miniLesson: { text: 'A scale drawing is similar to the real room: all angles stay the same and all lengths are divided by the same number (the scale factor).', visualSpec: AREA_VISUAL },
      proofSpec: { photos: 1, explanation: true, fields: [{ key: 'scale', label: 'Scale factor' }, { key: 'L', label: 'Room length', unit: 'm' }] },
      rubric: stdRubric('scale factor'),
      safetyNotes: 'Indoor activity, no risks.',
      difficulty: 'EASY',
      estimatedMin: 25,
    },
  ],
  'geo.area': [
    {
      title: 'Tile your bedroom',
      story: 'Your family wants new floor tiles. Each box covers 1.5 m². How many boxes should they buy so nothing is wasted?',
      steps: ['Measure the length and width of your bedroom floor.', 'Calculate the area.', 'Divide by 1.5 m² per box and round up.', 'Photograph your measuring.'],
      miniLesson: { text: 'The area of a rectangle is length × width. If the room is not a rectangle, split it into rectangles and add their areas.', visualSpec: AREA_VISUAL },
      proofSpec: { photos: 1, explanation: true, fields: [{ key: 'L', label: 'Length', unit: 'm' }, { key: 'W', label: 'Width', unit: 'm' }, { key: 'boxes', label: 'Boxes needed' }] },
      rubric: stdRubric('area = length × width'),
      safetyNotes: 'Indoor activity, no risks.',
      difficulty: 'EASY',
      estimatedMin: 20,
    },
  ],
  'geo.angles': [
    {
      title: 'Is your staircase ramp-safe?',
      story: 'A neighbour in a wheelchair visits next week. A safe ramp should rise no more than about 5° (1 cm up for every 12 cm forward). Could the entrance steps be replaced by a safe ramp?',
      steps: ['Measure the total height of the entrance steps (rise).', 'Measure the space available in front of them (run).', 'Compute rise ÷ run and compare with 1 ÷ 12.', 'Photograph your measurements.'],
      miniLesson: { text: 'The steepness of a ramp is its angle with the ground. A small angle means a gentle slope. You can compare slopes using rise ÷ run: the smaller, the safer.', visualSpec: ANGLE_VISUAL },
      proofSpec: { photos: 1, explanation: true, fields: [{ key: 'rise', label: 'Rise', unit: 'cm' }, { key: 'run', label: 'Run', unit: 'cm' }] },
      rubric: stdRubric('angles and slope'),
      safetyNotes: 'Stay on the ground; measure the steps from the bottom.',
      difficulty: 'MEDIUM',
      estimatedMin: 25,
    },
    {
      title: 'The angle detective at home',
      story: 'Angles hide everywhere: the open door, the laptop screen, the clock hands at 4:00. Find five and estimate them before you measure.',
      steps: ['Find 5 angles at home.', 'Estimate each one.', 'Measure with a protractor (or a phone app).', 'Compare estimate vs real.'],
      miniLesson: { text: 'Angles are measured in degrees. A right angle is 90°, a straight line 180°. Acute < 90° < obtuse.', visualSpec: ANGLE_VISUAL },
      proofSpec: { photos: 2, explanation: true, fields: [{ key: 'best', label: 'Closest estimate (°)' }] },
      rubric: stdRubric('measuring angles'),
      safetyNotes: 'Indoor activity, no risks.',
      difficulty: 'EASY',
      estimatedMin: 20,
    },
    {
      title: 'Design the perfect slide',
      story: 'The school playground is getting a new slide. Too steep is scary, too flat is boring. Find the angle of a slide in a park or in photos and propose the best one.',
      steps: ['Find a slide (park with an adult, or a photo).', 'Estimate its rise and run.', 'Calculate the angle with a protractor drawing.', 'Propose your perfect angle and explain.'],
      miniLesson: { text: 'On a scale drawing, angles do not change. Draw the slide as a triangle and measure the angle with a protractor.', visualSpec: ANGLE_VISUAL },
      proofSpec: { photos: 1, explanation: true, fields: [{ key: 'angle', label: 'Angle (°)' }] },
      rubric: stdRubric('angles in triangles'),
      safetyNotes: 'Go to the park with an adult.',
      difficulty: 'MEDIUM',
      estimatedMin: 30,
    },
  ],
  'geo.pythagoras': [
    {
      title: 'Is your TV really 55 inches?',
      story: 'TV sizes are measured along the diagonal. Is the TV at home really the size written on the box? Find out without measuring the diagonal at all.',
      steps: ['Measure the width and height of the TV screen (not the frame).', 'Use a² + b² = c² to compute the diagonal.', 'Convert to inches (1 inch = 2.54 cm).', 'Compare with the size on the box or label.'],
      miniLesson: {
        text: 'In a right triangle, the square of the longest side (the hypotenuse) equals the sum of the squares of the two other sides: a² + b² = c². A screen is two right triangles glued along the diagonal!',
        visualSpec: {
          caption: 'a² + b² = c²',
          shapes: [
            { kind: 'rect', x: 15, y: 20, w: 70, h: 45, color: 'sky' },
            { kind: 'line', x1: 15, y1: 65, x2: 85, y2: 20, color: 'coral', label: 'c' },
            { kind: 'line', x1: 15, y1: 70, x2: 85, y2: 70, color: 'ink', label: 'a' },
            { kind: 'line', x1: 90, y1: 20, x2: 90, y2: 65, color: 'ink', label: 'b' },
          ],
        },
      },
      proofSpec: { photos: 1, explanation: true, fields: [{ key: 'a', label: 'Width', unit: 'cm' }, { key: 'b', label: 'Height', unit: 'cm' }, { key: 'c', label: 'Diagonal', unit: 'in' }] },
      rubric: stdRubric('the Pythagorean theorem'),
      safetyNotes: 'Do not move the TV; measure it where it stands.',
      difficulty: 'MEDIUM',
      estimatedMin: 20,
    },
  ],
  'geo.circles': [
    {
      title: 'Fair pizza for 7',
      story: 'Seven friends, one pizza, zero fights. Cutting into 8 is easy — but 7? Work out the exact angle of each slice and the area everyone gets.',
      steps: ['Measure the pizza (or a plate) diameter.', 'Compute 360° ÷ 7.', 'Draw the 7 slices on paper with a protractor.', 'Compute the area of one slice.'],
      miniLesson: { text: 'A full turn is 360°. A sector (slice) with angle a has area (a ÷ 360) × π × r².', visualSpec: CIRCLE_VISUAL },
      proofSpec: { photos: 1, explanation: true, fields: [{ key: 'd', label: 'Diameter', unit: 'cm' }, { key: 'angle', label: 'Slice angle (°)' }] },
      rubric: stdRubric('sectors'),
      safetyNotes: 'Use a plate and paper, or ask an adult to do the cutting.',
      difficulty: 'MEDIUM',
      estimatedMin: 25,
    },
  ],
  'geo.volume': [
    {
      title: 'How much water fits in your roof tank?',
      story: 'In summer, the water tank runs out. How many liters does it really hold, and how many days does your family have?',
      steps: ['With an adult, find the tank dimensions (label or measure from the ground).', 'Compute its volume.', 'Convert to liters (1 m³ = 1000 L).', 'Estimate days of water for your family.'],
      miniLesson: { text: 'A cylinder holds π × r² × h. A box holds length × width × height. 1 m³ = 1000 liters.', visualSpec: VOLUME_VISUAL },
      proofSpec: { photos: 1, explanation: true, fields: [{ key: 'V', label: 'Volume', unit: 'L' }] },
      rubric: stdRubric('volume'),
      safetyNotes: 'Do not go on the roof: read the label or ask an adult for the dimensions.',
      difficulty: 'MEDIUM',
      estimatedMin: 30,
    },
  ],
  'phy.speed': [
    {
      title: 'Your walking speed to school',
      story: 'Are you faster than the school bus in traffic? Measure your real walking speed.',
      steps: ['Measure a 50 m path in the school yard.', 'Time yourself walking it normally.', 'Compute speed = distance ÷ time.', 'Convert to km/h.'],
      miniLesson: { text: 'Speed tells how much distance you cover per unit of time: v = d ÷ t. To convert m/s to km/h, multiply by 3.6.', visualSpec: SPEED_VISUAL },
      proofSpec: { photos: 1, explanation: true, fields: [{ key: 'd', label: 'Distance', unit: 'm' }, { key: 't', label: 'Time', unit: 's' }, { key: 'v', label: 'Speed', unit: 'km/h' }] },
      rubric: stdRubric('v = d / t'),
      safetyNotes: 'Use the school yard, not the street.',
      difficulty: 'EASY',
      estimatedMin: 20,
    },
  ],
  'his.oral': [
    {
      title: 'Interview a grandparent',
      story: 'History is not only in books — it lives in your family. What was school like for your grandparents?',
      steps: ['Prepare 5 questions about school life 50 years ago.', 'Interview a grandparent or older relative.', 'Record or note the answers.', 'Compare with your school today in 5 sentences.'],
      miniLesson: { text: 'Oral history collects memories from people who lived through events. Historians compare several voices and check facts with other sources.', visualSpec: HISTORY_VISUAL },
      proofSpec: { photos: 1, photoHint: 'An old photo or object from that time.', explanation: true, fields: [] },
      rubric: [
        { criterion: 'Questions', description: 'Open, respectful questions', weight: 30 },
        { criterion: 'Comparison', description: 'Clear then-vs-now comparison', weight: 40 },
        { criterion: 'Explanation', description: 'Reflects on what changed and why', weight: 30 },
      ],
      safetyNotes: 'Interview family members only.',
      difficulty: 'EASY',
      estimatedMin: 40,
    },
    {
      title: 'The street names detective',
      story: 'Every street name is a message from the past. Pick three street names in your neighbourhood and find out who or what they remember.',
      steps: ['Note three street names near home (with an adult).', 'Research each one (family, library, internet).', 'Place them on a timeline.', 'Explain why the city chose these names.'],
      miniLesson: { text: 'Names of streets and squares are a form of public memory. They tell us which people and events a city wanted to honour, and when.', visualSpec: HISTORY_VISUAL },
      proofSpec: { photos: 1, explanation: true, fields: [] },
      rubric: [
        { criterion: 'Research', description: 'Correct facts for each name', weight: 40 },
        { criterion: 'Timeline', description: 'Events in the right order', weight: 30 },
        { criterion: 'Explanation', description: 'Why the names matter', weight: 30 },
      ],
      safetyNotes: 'Walk with an adult; take photos from the sidewalk.',
      difficulty: 'MEDIUM',
      estimatedMin: 40,
    },
    {
      title: 'Then and now: one photo, two times',
      story: 'Find an old photo of your town and take a new photo from the same spot. What changed in 50 years?',
      steps: ['Find an old photo (family album or archive).', 'With an adult, find the same place.', 'Take the "now" photo.', 'List 3 changes and 1 thing that stayed.'],
      miniLesson: { text: 'Comparing sources from different times helps us see change and continuity — two key ideas in history.', visualSpec: HISTORY_VISUAL },
      proofSpec: { photos: 2, explanation: true, fields: [] },
      rubric: [
        { criterion: 'Sources', description: 'Old and new photos match the same place', weight: 40 },
        { criterion: 'Change', description: 'Identifies changes and continuity', weight: 40 },
        { criterion: 'Explanation', description: 'Clear writing', weight: 20 },
      ],
      safetyNotes: 'Go with an adult during the day.',
      difficulty: 'EASY',
      estimatedMin: 35,
    },
  ],
};

export function mockMissions(topicKey: string, topicName: string, count: number): AiMission[] {
  const bank = MISSION_BANK[topicKey] ?? [];
  const generic: AiMission = {
    title: `${topicName} in real life`,
    story: `Where do you meet "${topicName}" in your daily life? Find one real example around you and investigate it like a scientist.`,
    steps: ['Find a real example at home or at school.', 'Measure or observe it carefully.', 'Explain the idea behind it.', 'Take a photo of your example.'],
    miniLesson: { text: `${topicName}: look for the pattern, measure it, and explain it in your own words.`, visualSpec: AREA_VISUAL },
    proofSpec: { photos: 1, explanation: true, fields: [] },
    rubric: stdRubric(topicName),
    safetyNotes: 'Stay at home or at school with an adult nearby.',
    difficulty: 'EASY',
    estimatedMin: 20,
  };
  const out: AiMission[] = [];
  for (let i = 0; i < count; i++) out.push(bank[i] ?? { ...generic, title: i === 0 ? generic.title : `${generic.title} #${i + 1}` });
  return out;
}

export const FOLLOW_UPS: Record<string, { en: string; ar: string }> = {
  'geo.similar': {
    en: 'If you measured an hour later, both shadows would be longer. Would your answer for the building height change? Why?',
    ar: 'لو قستَ بعد ساعة، سيصبح الظلّان أطول. هل سيتغيّر جوابك عن ارتفاع المبنى؟ لماذا؟',
  },
  'geo.area': { en: 'Why do you round the number of boxes up and not down?', ar: 'لماذا نقرّب عدد العلب إلى الأعلى وليس إلى الأسفل؟' },
  'geo.angles': { en: 'If the run were twice as long, what would happen to the angle?', ar: 'لو كان الطول الأفقي ضعف ما هو، ماذا يحدث للزاوية؟' },
  'geo.circles': { en: 'If the pizza were twice as wide, how much bigger would each slice be?', ar: 'لو كانت البيتزا أعرض بمرتين، كم تكبر كل قطعة؟' },
  'geo.volume': { en: 'If the tank were twice as tall, how many more liters would it hold?', ar: 'لو كان الخزان أطول بمرتين، كم لتراً إضافياً يتسع؟' },
};
