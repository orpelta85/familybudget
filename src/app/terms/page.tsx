import Link from 'next/link'

export const metadata = {
  title: 'תנאי שימוש | Family Plan',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)] py-10 px-5">
      <div className="max-w-3xl mx-auto bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-8">
        <Link
          href="/login"
          className="text-[var(--primary)] text-[13px] mb-4 inline-block"
        >
          חזרה
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mb-2">תנאי שימוש</h1>
        <p className="text-[13px] text-[var(--text-secondary)] mb-6">
          עדכון אחרון: 14/05/2026
        </p>

        <div className="space-y-5 text-[14px] leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. כללי</h2>
            <p>
              ברוכים הבאים ל-Family Plan (להלן: &quot;השירות&quot;). השירות הוא כלי לניהול תקציב
              ופיננסים אישיים ומשפחתיים. השימוש בשירות כפוף לתנאים המפורטים להלן.
              שימוש בשירות מהווה הסכמה מלאה לתנאים אלה.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. רישום וחשבון משתמש</h2>
            <p>
              לצורך השימוש בשירות, יש לפתוח חשבון אישי. המשתמש מחויב לספק מידע נכון ומדויק,
              ולשמור על סודיות סיסמתו. אתה אחראי לכל פעילות שמתבצעת תחת חשבונך.
              גיל מינימלי להרשמה - 18 שנה.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. מטרת השירות והגבלות</h2>
            <p>
              השירות מספק כלים לעקיבה, ניתוח ותכנון פיננסי בלבד. <strong>השירות אינו ייעוץ
              פיננסי, השקעות, פנסיה, מס או משפטי</strong>. לפני קבלת החלטות פיננסיות
              משמעותיות, יש להתייעץ עם איש מקצוע מוסמך. אנו לא אחראים על החלטות פיננסיות
              שתקבל על בסיס המידע במערכת.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. תוכן המשתמש</h2>
            <p>
              כל המידע שאתה מזין למערכת (הכנסות, הוצאות, חיסכון, פנסיה וכו&apos;) שייך לך.
              אנו לא משתפים מידע זה עם צד שלישי, למעט במקרים המפורטים במדיניות הפרטיות.
              אתה מאשר לנו לאחסן, לעבד ולהציג מידע זה במסגרת השירות.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. קישור משפחתי</h2>
            <p>
              ניתן להזמין בני משפחה לחשבון משותף באמצעות קוד הזמנה. שיתוף הקוד הוא
              באחריותך - מי שמקבל את הקוד יכול לראות את הנתונים הפיננסיים המשותפים.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. שירותי AI</h2>
            <p>
              השירות משתמש בשירותי בינה מלאכותית (Google Gemini) לקטלוג הוצאות וקריאת
              דוחות פנסיה. הנתונים נשלחים לעיבוד למוצרי Google בהתאם למדיניות הפרטיות שלהם.
              תוצאות ה-AI אינן מדויקות במאה אחוז - בדוק את הנתונים לפני קבלת החלטות.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. הגבלת אחריות</h2>
            <p>
              השירות ניתן &quot;כפי שהוא&quot; (AS IS). איננו מתחייבים שהשירות יהיה זמין באופן
              רציף או נקי מתקלות. איננו אחראים לנזקים ישירים או עקיפים שייגרמו כתוצאה
              משימוש בשירות, כולל אובדן נתונים. מומלץ לגבות את הנתונים מעת לעת באמצעות
              ייצוא הנתונים בעמוד ההגדרות.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. הפסקת שירות</h2>
            <p>
              אנו רשאים להפסיק את השירות, באופן מלא או חלקי, בכל עת ולפי שיקול דעתנו.
              אתה רשאי למחוק את חשבונך בכל עת מעמוד ההגדרות. מחיקת חשבון תמחק את כל
              הנתונים שלך באופן בלתי הפיך.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. שינויים בתנאים</h2>
            <p>
              אנו רשאים לעדכן את תנאי השימוש מעת לעת. עדכונים מהותיים יודעו במייל או
              בהודעה במערכת. המשך השימוש לאחר עדכון מהווה הסכמה לתנאים החדשים.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. דין וסמכות שיפוט</h2>
            <p>
              תנאים אלה כפופים לדין הישראלי. סמכות השיפוט הבלעדית בכל מחלוקת תהיה לבתי
              המשפט המוסמכים בתל אביב-יפו.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">11. יצירת קשר</h2>
            <p>
              לשאלות, בקשות או תלונות ניתן ליצור קשר במייל:
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
