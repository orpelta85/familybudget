/**
 * Scene configuration derived from script.json
 * FPS: 30, Total: ~7125 frames (including title cards)
 */

export interface SceneConfig {
  id: string;
  name: string;
  durationSeconds: number;
  durationFrames: number;
  narration: string;
  overlayText: string;
  screenshot?: string;
  audioFile?: string;
}

export interface TitleCardConfig {
  id: string;
  title: string;
  icon: string;
  durationFrames: number;
}

const FPS = 30;

export const scenes: SceneConfig[] = [
  {
    id: '01-intro',
    name: 'פתיחה',
    durationSeconds: 6,
    durationFrames: 6 * FPS,
    narration: 'נעים להכיר, זאת Family Plan - הדרך הפשוטה לנהל את כלכלת המשפחה. כלי שעושה סדר בכסף שלכם, בצורה נוחה וברורה.',
    overlayText: 'Family Plan',
    audioFile: 'assets/audio/narration/01-intro.mp3',
  },
  {
    id: '02-problem-solution',
    name: 'בעיה ופתרון',
    durationSeconds: 6,
    durationFrames: 6 * FPS,
    narration: 'במקום לעבוד עם אקסלים מסורבלים ולנסות לחשב הכל בראש בסוף החודש, Family Plan מרכזת לכם את הכל במקום אחד. פשוט ונוח.',
    overlayText: 'הכל במקום אחד',
    audioFile: 'assets/audio/narration/02-problem-solution.mp3',
  },
  {
    id: '03-onboarding',
    name: 'הרשמה',
    durationSeconds: 13,
    durationFrames: 13 * FPS,
    narration: 'ההרשמה למערכת קצרה מאוד. בוחרים שם, מגדירים את המשפחה ומייבאים קובץ נתונים ראשוני מהבנק בקליק אחד. בוחרים איזה מסכים רלוונטיים אליכם, ואתם בפנים.',
    overlayText: 'הרשמה ב-60 שניות',
    audioFile: 'assets/audio/narration/03-onboarding.mp3',
  },
  {
    id: '04-dashboard',
    name: 'דשבורד',
    durationSeconds: 15,
    durationFrames: 15 * FPS,
    narration: 'זה הדשבורד. כאן המשתמש מקבל את התמונה המלאה במבט אחד. כמה נכנס, כמה יצא, ולאן הכסף הולך. הגרפים מראים את המגמות, כדי שתדעו מיד איפה אתם עומדים החודש.',
    overlayText: '',
    screenshot: 'assets/screenshots/demo-dashboard-full.png',
    audioFile: 'assets/audio/narration/04-dashboard.mp3',
  },
  {
    id: '05-income',
    name: 'הכנסות',
    durationSeconds: 10,
    durationFrames: 10 * FPS,
    narration: 'בעמוד ההכנסות רואים בדיוק מה נכנס. משכורות, בונוסים, עבודות פרילנס או שכר דירה. הכל מסודר לפי חודשים עם סיכום שנתי ברור שנותן פרספקטיבה נכונה.',
    overlayText: 'הכנסות',
    screenshot: 'assets/screenshots/income.png',
    audioFile: 'assets/audio/narration/05-income.mp3',
  },
  {
    id: '06-expenses',
    name: 'הוצאות',
    durationSeconds: 15,
    durationFrames: 15 * FPS,
    narration: 'ניהול ההוצאות הוא הלב של המערכת. פשוט מייבאים קובץ מהבנק או מחברת האשראי, והמערכת מזהה וממיינת אוטומטית לפי קטגוריות - סופר, דלק, חינוך. הכל מסודר בלי צורך להקליד נתונים ידנית.',
    overlayText: 'ייבוא אוטומטי מהבנק',
    screenshot: 'assets/screenshots/demo-add-expense.png',
    audioFile: 'assets/audio/narration/06-expenses.mp3',
  },
  {
    id: '07-budget',
    name: 'תקציב',
    durationSeconds: 10,
    durationFrames: 10 * FPS,
    narration: 'כאן קובעים תקציב חודשי לכל קטגוריה, ורואים בזמן אמת מה המצב. הצבעים עוזרים להבין מיד מתי אנחנו בתקציב ומתי כדאי לעצור. פשוט מחזיר את השליטה לידיים שלכם.',
    overlayText: '',
    screenshot: 'assets/screenshots/demo-budget-progress.png',
    audioFile: 'assets/audio/narration/07-budget.mp3',
  },
  {
    id: '08-petty-cash',
    name: 'קופה קטנה',
    durationSeconds: 10,
    durationFrames: 10 * FPS,
    narration: 'יש גם קופה משותפת לכל ההוצאות הקטנות במזומן - הקפה בבוקר או המונית. כל שקל מתועד בקלות, כדי שהתמונה שלכם תישאר מלאה ומדויקת.',
    overlayText: 'קופה קטנה',
    screenshot: 'assets/screenshots/joint.png',
    audioFile: 'assets/audio/narration/08-petty-cash.mp3',
  },
  {
    id: '09-kids',
    name: 'ילדים',
    durationSeconds: 10,
    durationFrames: 10 * FPS,
    narration: 'לכל ילד במשפחה יש כרטיס נפרד. חוגים, ביגוד, חינוך ובריאות. ככה רואים בצורה ברורה את ההוצאות על כל ילד, ויכולים לתכנן את התקציב טוב יותר.',
    overlayText: 'מעקב ילדים',
    screenshot: 'assets/screenshots/kids.png',
    audioFile: 'assets/audio/narration/09-kids.mp3',
  },
  {
    id: '10-shared-view',
    name: 'תצוגה משותפת',
    durationSeconds: 10,
    durationFrames: 10 * FPS,
    narration: 'כל עמוד במערכת עובד בשני מצבים. בלחיצה אחת מקבלים את התמונה המלאה של כל המשפחה, ובלחיצה נוספת רואים רק את הנתונים האישיים שלכם. חכם ושקוף.',
    overlayText: 'אישי / משפחתי',
    screenshot: 'assets/screenshots/demo-family-toggle.png',
    audioFile: 'assets/audio/narration/10-shared-view.mp3',
  },
  {
    id: '11-sinking-funds',
    name: 'קופות חיסכון',
    durationSeconds: 10,
    durationFrames: 10 * FPS,
    narration: 'מתכננים חופשה או שיפוץ? אפשר לפתוח קופות חיסכון ייעודיות. מגדירים כמה להפריש כל חודש, ורואים בצורה ברורה כמה נשאר עד שמגיעים ליעד.',
    overlayText: '',
    screenshot: 'assets/screenshots/demo-sinking-funds-progress.png',
    audioFile: 'assets/audio/narration/11-sinking-funds.mp3',
  },
  {
    id: '12-financial-goals',
    name: 'יעדים פיננסיים',
    durationSeconds: 10,
    durationFrames: 10 * FPS,
    narration: 'יעדים לטווח ארוך, כמו לסגור את המינוס או לחסוך למקדמה, מנוהלים כאן. המערכת מציגה לכם את קצב ההתקדמות כדי שתישארו ממוקדים במטרה.',
    overlayText: 'יעדים פיננסיים',
    screenshot: 'assets/screenshots/goals.png',
    audioFile: 'assets/audio/narration/12-financial-goals.mp3',
  },
  {
    id: '13-cashflow-forecast',
    name: 'תחזית תזרים',
    durationSeconds: 10,
    durationFrames: 10 * FPS,
    narration: 'בעזרת תחזית תזרים המזומנים, אפשר לראות קדימה לחודש, חודשיים או שלושה. אם יש חריגה באופק, אתם יודעים עליה מראש ויכולים להיערך בהתאם.',
    overlayText: 'תחזית תזרים',
    screenshot: 'assets/screenshots/forecast.png',
    audioFile: 'assets/audio/narration/13-cashflow-forecast.mp3',
  },
  {
    id: '14-net-worth',
    name: 'שווי נקי',
    durationSeconds: 10,
    durationFrames: 10 * FPS,
    narration: 'עמוד השווי הנקי מציג את כל הנכסים שלכם מול כל ההתחייבויות. שורה תחתונה אחת שמסכמת את המצב הכלכלי של המשפחה, הכל במקום אחד.',
    overlayText: 'שווי נקי',
    screenshot: 'assets/screenshots/net-worth.png',
    audioFile: 'assets/audio/narration/14-net-worth.mp3',
  },
  {
    id: '15-pension',
    name: 'פנסיה',
    durationSeconds: 10,
    durationFrames: 10 * FPS,
    narration: 'באזור הפנסיה עוקבים אחרי העתיד. כמה נצבר, כמה מופרש כל חודש, ומה התחזית לגיל הפרישה. הכל מוצג בצורה פשוטה כדי שתוכלו לקבל החלטות נכונות.',
    overlayText: '',
    screenshot: 'assets/screenshots/pension.png',
    audioFile: 'assets/audio/narration/15-pension.mp3',
  },
  {
    id: '16-mortgage',
    name: 'משכנתא',
    durationSeconds: 10,
    durationFrames: 10 * FPS,
    narration: 'את המשכנתא מנהלים כאן לפי מסלולים - פריים, קבועה או משתנה. המערכת מראה בדיוק כמה כבר שילמתם, כמה נשאר, ומתי מסתיים כל מסלול. עושה סדר בנתונים.',
    overlayText: 'משכנתא',
    screenshot: 'assets/screenshots/mortgage.png',
    audioFile: 'assets/audio/narration/16-mortgage.mp3',
  },
  {
    id: '17-debts',
    name: 'חובות',
    durationSeconds: 10,
    durationFrames: 10 * FPS,
    narration: 'כל ההלוואות מרוכזות במקום אחד. תאריכי תשלום, ריביות ויתרות. ככה לא מפספסים תשלומים, ותמיד יודעים בדיוק מה סטטוס ההתחייבויות שלכם.',
    overlayText: '',
    screenshot: 'assets/screenshots/debts.png',
    audioFile: 'assets/audio/narration/17-debts.mp3',
  },
  {
    id: '18-insurance',
    name: 'ביטוחים',
    durationSeconds: 10,
    durationFrames: 10 * FPS,
    narration: 'תיק הביטוח המשפחתי - בריאות, רכב, דירה וחיים. כל הפוליסות, תאריכי החידוש והעלויות מרוכזות במסך אחד. ככה יודעים תמיד על מה משלמים ואם אתם מכוסים כמו שצריך.',
    overlayText: 'ביטוחים',
    screenshot: 'assets/screenshots/insurance.png',
    audioFile: 'assets/audio/narration/18-insurance.mp3',
  },
  {
    id: '19-subscriptions',
    name: 'מנויים',
    durationSeconds: 7,
    durationFrames: 7 * FPS,
    narration: 'עמוד המנויים עושה סדר בתשלומים הקבועים - נטפליקס, אפליקציות או חדר כושר. כשרואים כמה הכל עולה ביחד, קל יותר להחליט על מה אפשר לוותר ולחסוך.',
    overlayText: 'מנויים',
    screenshot: 'assets/screenshots/subscriptions.png',
    audioFile: 'assets/audio/narration/19-subscriptions.mp3',
  },
  {
    id: '20-annual-analytics',
    name: 'ניתוח שנתי',
    durationSeconds: 10,
    durationFrames: 10 * FPS,
    narration: 'הניתוח השנתי מראה לכם את התמונה הרחבה. איפה התחלתם בינואר ואיפה אתם היום. המערכת מזהה מגמות ומציגה את הסיפור הכלכלי של השנה בתצוגה אחת.',
    overlayText: 'ניתוח שנתי',
    screenshot: 'assets/screenshots/analytics.png',
    audioFile: 'assets/audio/narration/20-annual-analytics.mp3',
  },
  {
    id: '21-ai-advisor',
    name: 'יועץ AI',
    durationSeconds: 13,
    durationFrames: 13 * FPS,
    narration: 'זה אורן, יועץ ה-AI הפיננסי של המערכת. אפשר להתייעץ איתו בשפה חופשית - איך לסגור את המינוס, איפה כדאי לחסוך או שאלות על הפנסיה. בגלל שהוא מחובר לנתונים שלכם, הוא נותן תשובות מעשיות שמבוססות על המצב האמיתי שלכם. יועץ אישי שזמין לכם תמיד מתוך האפליקציה, וזה כלי עזר מאוד שימושי.',
    overlayText: 'אורן - יועץ פיננסי AI',
    screenshot: 'assets/screenshots/demo-advisor-chat.png',
    audioFile: 'assets/audio/narration/21-ai-advisor.mp3',
  },
  {
    id: '22-family-settings',
    name: 'הגדרות משפחה',
    durationSeconds: 8,
    durationFrames: 8 * FPS,
    narration: 'ניהול משפחתי עובד הכי טוב ביחד. בקליק אחד מזמינים את בן או בת הזוג למערכת. מנהלים את התקציב בשקיפות, כשהכל נגיש ונוח לשני הצדדים.',
    overlayText: '',
    screenshot: 'assets/screenshots/family.png',
    audioFile: 'assets/audio/narration/22-family-settings.mp3',
  },
  {
    id: '23-cta',
    name: 'קריאה לפעולה',
    durationSeconds: 10,
    durationFrames: 10 * FPS,
    narration: 'לנהל את הכסף לא חייב להיות מסובך. עם Family Plan, הכל נמצא במקום אחד והשליטה חוזרת אליכם. אתם מוזמנים להתחיל עכשיו, בחינם.',
    overlayText: 'התחילו בחינם',
    audioFile: 'assets/audio/narration/23-cta.mp3',
  },
];

export const titleCards: TitleCardConfig[] = [
  { id: 'tc-daily', title: 'ניהול שוטף', icon: 'LayoutDashboard', durationFrames: 45 },
  { id: 'tc-family', title: 'משפחה', icon: 'Users', durationFrames: 45 },
  { id: 'tc-savings', title: 'חיסכון ויעדים', icon: 'Target', durationFrames: 45 },
  { id: 'tc-assets', title: 'נכסים והתחייבויות', icon: 'Building2', durationFrames: 45 },
  { id: 'tc-tools', title: 'כלים חכמים', icon: 'Brain', durationFrames: 45 },
];

/** Total frames = sum of all scene durations + 5 title cards * 45 frames */
export const TOTAL_DURATION_FRAMES =
  scenes.reduce((sum, s) => sum + s.durationFrames, 0) +
  titleCards.length * 45;

export const FPS_CONST = 30;
