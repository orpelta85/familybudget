import Link from 'next/link'

export const metadata = {
  title: 'מדיניות פרטיות | Family Plan',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)] py-10 px-5">
      <div className="max-w-3xl mx-auto bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-8">
        <Link
          href="/login"
          className="text-[var(--primary)] text-[13px] mb-4 inline-block"
        >
          חזרה
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mb-2">מדיניות פרטיות</h1>
        <p className="text-[13px] text-[var(--text-secondary)] mb-6">
          עדכון אחרון: 14/05/2026
        </p>

        <div className="space-y-5 text-[14px] leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. מהו המידע שנאסף</h2>
            <p className="mb-2">בעת הרישום והשימוש בשירות, אנו אוספים את המידע הבא:</p>
            <ul className="list-disc pr-5 space-y-1">
              <li>פרטי חשבון: כתובת אימייל, שם תצוגה</li>
              <li>נתונים פיננסיים שאתה מזין: הכנסות, הוצאות, חיסכון, חובות, פנסיה, נכסים</li>
              <li>קבצים שהעלית: דוחות פנסיה (PDF/תמונה), קבצי Excel של הוצאות</li>
              <li>מידע משפחתי: בני משפחה שצירפת לחשבון משותף</li>
              <li>מטא-דאטה טכני: כתובת IP, סוג דפדפן, זמני גישה (לצרכי אבטחה)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. למה אנחנו משתמשים במידע</h2>
            <ul className="list-disc pr-5 space-y-1">
              <li>להציג לך את הנתונים, חישובים, גרפים ותחזיות שלך</li>
              <li>לאפשר שיתוף נתונים במסגרת חשבון משפחתי</li>
              <li>לקטלג הוצאות באופן אוטומטי באמצעות AI</li>
              <li>לקרוא דוחות פנסיה באמצעות AI</li>
              <li>לזהות תקלות ולשפר את השירות</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. שיתוף עם צדדים שלישיים</h2>
            <p className="mb-2">המידע שלך לא נמכר ולא משותף לצורכי שיווק. עם זאת, אנו משתמשים בספקי שירות הבאים:</p>
            <ul className="list-disc pr-5 space-y-1">
              <li>
                <strong>Supabase</strong> - מסד הנתונים שלנו (אחסון בסיסים בסינגפור).
                כל הנתונים נשמרים בצורה מוצפנת.
              </li>
              <li>
                <strong>Vercel</strong> - האירוח של האפליקציה. תעבורת רשת בלבד, ללא אחסון נתונים.
              </li>
              <li>
                <strong>Google Gemini API</strong> - עיבוד AI לקטלוג הוצאות וקריאת דוחות.
                תיאורי הוצאות ותוכן קבצי PDF/תמונה נשלחים זמנית לעיבוד. Google מתחייבת
                לא לאמן את המודלים שלה על נתוני API.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. אבטחת מידע</h2>
            <p>
              אנו נוקטים אמצעי אבטחה סבירים: הצפנה ב-HTTPS, אימות באמצעות JWT, מדיניות
              Row-Level Security במסד הנתונים שמבטיחה שכל משתמש רואה רק את הנתונים שלו.
              עם זאת, אף מערכת אינה חסינה ב-100%. אנא השתמש בסיסמה חזקה ואל תשתף אותה.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. הזכויות שלך</h2>
            <p className="mb-2">בכל עת אתה רשאי:</p>
            <ul className="list-disc pr-5 space-y-1">
              <li><strong>לצפות בנתונים שלך</strong> דרך ממשק המערכת</li>
              <li><strong>לערוך נתונים</strong> דרך הממשק או למחוק רשומות בודדות</li>
              <li><strong>לייצא את כל הנתונים שלך</strong> כקובץ JSON מעמוד ההגדרות</li>
              <li><strong>למחוק את החשבון שלך</strong> לחלוטין מעמוד ההגדרות - מחיקה בלתי הפיכה</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. עוגיות (Cookies)</h2>
            <p>
              אנו משתמשים בעוגיות הכרחיות בלבד - בעיקר לשמירת מצב התחברות (JWT של Supabase).
              איננו משתמשים בעוגיות מעקב לצרכי שיווק או אנליטיקה של צד שלישי.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. שמירת מידע</h2>
            <p>
              נתונים נשמרים כל עוד החשבון שלך פעיל. כאשר אתה מוחק את החשבון, כל הנתונים
              שלך נמחקים תוך זמן סביר (כולל גיבויים). מידע מטא-דאטה אנונימי לצורכי אבטחה
              עשוי להישמר עד 90 יום.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. ילדים</h2>
            <p>
              השירות מיועד לבגירים בלבד (גיל 18+). איננו אוספים ביודעין מידע מילדים מתחת
              לגיל 18. אם נודע לנו שילד מתחת ל-18 נרשם לשירות, נמחק את חשבונו.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. שינויים במדיניות</h2>
            <p>
              אנו רשאים לעדכן מדיניות זו מעת לעת. עדכונים מהותיים יודעו לך באופן מפורש.
              גרסה עדכנית תהיה תמיד זמינה בעמוד זה עם תאריך עדכון.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. יצירת קשר</h2>
            <p>
              לכל שאלה בנושא פרטיות, בקשה לעיון או מחיקת נתונים:
              {' '}
              <a href="mailto:orpelta85@gmail.com" className="text-[var(--primary)] underline">
                orpelta85@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
