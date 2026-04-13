"""
Generate SSML-enhanced narration for all 23 scenes using Edge TTS.
Adds emphasis, breaks, and prosody for natural-sounding Hebrew voiceover.
"""

import subprocess
import os

AUDIO_DIR = os.path.join(os.path.dirname(__file__), "public", "assets", "audio", "narration")
SSML_DIR = os.path.join(os.path.dirname(__file__), "ssml")
os.makedirs(SSML_DIR, exist_ok=True)

VOICE = "he-IL-AvriNeural"

def ssml_wrap(content: str) -> str:
    return f"""<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="he-IL">
<prosody rate="+10%" pitch="+5Hz">
{content}
</prosody>
</speak>"""


scenes_ssml = {
    "01-intro": ssml_wrap(
        'תקשיבו, גיליתי משהו מטורף - '
        '<emphasis level="strong">Family Plan</emphasis>.'
        '<break time="300ms"/>'
        'כלי שמסדר לכם את כל הכסף של המשפחה.'
        '<break time="200ms"/>'
        'פשוט, חכם, ומרגיש כאילו בנו אותו בדיוק בשבילכם.'
    ),
    "02-problem-solution": ssml_wrap(
        'מכירים את הסיוט הזה?'
        '<break time="300ms"/>'
        'אקסלים מבולגנים, חישובים בראש, וכל סוף חודש - לחץ!'
        '<break time="400ms"/>'
        'אז <emphasis level="strong">Family Plan</emphasis> מעיפה את כל זה.'
        '<break time="200ms"/>'
        'הכל במקום אחד, אוטומטי.'
        '<break time="200ms"/>'
        '<emphasis level="moderate">איזו הקלה!</emphasis>'
    ),
    "03-onboarding": ssml_wrap(
        'ותקשיבו טוב - ההרשמה לוקחת <emphasis level="strong">דקה</emphasis>.'
        '<break time="300ms"/>'
        'אתם קולטים? דקה!'
        '<break time="300ms"/>'
        'בוחרים שם, מגדירים משפחה, מכניסים הכנסות, מייבאים קובץ מהבנק - הכל בכמה קליקים.'
        '<break time="200ms"/>'
        'בוחרים מודולים שמתאימים לכם, וזהו.'
        '<break time="200ms"/>'
        '<emphasis level="moderate">אתם בפנים!</emphasis>'
    ),
    "04-dashboard": ssml_wrap(
        'הדשבורד שלהם? <emphasis level="moderate">וואו</emphasis>.'
        '<break time="300ms"/>'
        'מקבלים את כל התמונה במבט אחד.'
        '<break time="200ms"/>'
        'כמה נכנס, כמה יצא, ובעיקר - לאן הכסף הולך!'
        '<break time="300ms"/>'
        'הגרף מראה לכם את המגמות, אתם ישר רואים אם החודש הזה טוב יותר.'
        '<break time="200ms"/>'
        '<emphasis level="moderate">איזו שליטה!</emphasis>'
    ),
    "05-income": ssml_wrap(
        'עמוד ההכנסות - שם רואים כל שקל שנכנס.'
        '<break time="200ms"/>'
        'משכורת, בונוסים, פרילנס, השכרה.'
        '<break time="200ms"/>'
        'הכל מסודר יפה לפי חודשים, עם סיכום שנתי.'
        '<break time="200ms"/>'
        '<emphasis level="moderate">כיף לראות את זה שחור על לבן.</emphasis>'
    ),
    "06-expenses": ssml_wrap(
        'אבל ההוצאות - זה <emphasis level="strong">הלב של הכל</emphasis>!'
        '<break time="300ms"/>'
        'מייבאים קובץ מהבנק או האשראי, והמערכת מזהה אוטומטית -'
        '<break time="200ms"/>'
        'סופר, דלק, חינוך, בילויים.'
        '<break time="200ms"/>'
        'בלי להקליד שום דבר.'
        '<break time="300ms"/>'
        'תהיו בשוק מאיך שזה עובד.'
        '<break time="200ms"/>'
        '<emphasis level="moderate">איזה חיסכון בזמן!</emphasis>'
    ),
    "07-budget": ssml_wrap(
        'קובעים תקציב חודשי לכל קטגוריה, ורואים בזמן אמת איפה עומדים.'
        '<break time="300ms"/>'
        'ירוק? אלופים!'
        '<break time="200ms"/>'
        'אדום? רגע, אולי כדאי לעצור.'
        '<break time="300ms"/>'
        'פתאום יש <emphasis level="strong">שליטה</emphasis>.'
        '<break time="200ms"/>'
        'תמיד יודעים בדיוק איפה נמצאים.'
    ),
    "08-petty-cash": ssml_wrap(
        'מכירים את הקטנות האלה? חלב, ארוחת צהריים, מונית?'
        '<break time="300ms"/>'
        'עכשיו יש קופה משותפת למשפחה לכל המזומן הזה.'
        '<break time="200ms"/>'
        'כל שקל מתועד.'
        '<break time="200ms"/>'
        '<emphasis level="moderate">נגמרו הלאן הכסף נעלם.</emphasis>'
    ),
    "09-kids": ssml_wrap(
        'ולילדים - לכל ילד כרטיס נפרד!'
        '<break time="200ms"/>'
        'חוגים, בגדים, חינוך, רופא.'
        '<break time="300ms"/>'
        'פתאום רואים בדיוק כמה עולה כל ילד, ומה אפשר לייעל.'
        '<break time="200ms"/>'
        'תאמינו לי, <emphasis level="moderate">איזה שקט נפשי!</emphasis>'
    ),
    "10-shared-view": ssml_wrap(
        'והקטע המגניב?'
        '<break time="300ms"/>'
        'כל עמוד עובד בשני מצבים - <emphasis level="strong">אישי ומשפחתי</emphasis>.'
        '<break time="200ms"/>'
        'לחיצה אחת, ורואים את התמונה המלאה של כל המשפחה.'
        '<break time="200ms"/>'
        'לחיצה נוספת - רק את שלכם.'
        '<break time="200ms"/>'
        'חכם ושקוף.'
    ),
    "11-sinking-funds": ssml_wrap(
        'חופשה? שיפוץ? קרן חירום?'
        '<break time="300ms"/>'
        'יש <emphasis level="strong">קופות חיסכון ייעודיות</emphasis>!'
        '<break time="200ms"/>'
        'מפרישים כל חודש ורואים כמה נשאר עד היעד.'
        '<break time="200ms"/>'
        '<emphasis level="moderate">כיף לראות את זה גדל</emphasis>, והחלומות פתאום מרגישים קרובים.'
    ),
    "12-financial-goals": ssml_wrap(
        'יעדים לטווח ארוך -'
        '<break time="200ms"/>'
        'לצאת מהמינוס, לחסוך למקדמה על דירה, להגיע ל-<emphasis level="strong">100,000 ₪</emphasis> חיסכון.'
        '<break time="300ms"/>'
        'המערכת מראה לכם את הדרך ואת הקצב.'
        '<break time="200ms"/>'
        '<emphasis level="moderate">הרגשה מטורפת של שליטה על העתיד!</emphasis>'
    ),
    "13-cashflow-forecast": ssml_wrap(
        'תחזית תזרים מזומנים - רואים לאן הולכים.'
        '<break time="200ms"/>'
        'חודש קדימה, חודשיים, שלושה.'
        '<break time="300ms"/>'
        'אם יש בעיה באופק? יודעים מראש.'
        '<break time="200ms"/>'
        '<emphasis level="moderate">כמה כאב ראש זה חוסך</emphasis>, אי אפשר לתאר.'
    ),
    "14-net-worth": ssml_wrap(
        'שווי נקי - כל מה שיש לכם מול כל מה שאתם חייבים.'
        '<break time="300ms"/>'
        '<emphasis level="strong">שורה תחתונה אחת</emphasis> שמסכמת את המצב של המשפחה.'
        '<break time="200ms"/>'
        'פתאום יש תמונה אמיתית.'
        '<break time="200ms"/>'
        'זה ממש משנה את הפרספקטיבה.'
    ),
    "15-pension": ssml_wrap(
        'מעקב פנסיה - זה <emphasis level="strong">העתיד שלכם</emphasis>!'
        '<break time="200ms"/>'
        'כמה נצבר, כמה מפרישים כל חודש, תחזית לגיל הפרישה.'
        '<break time="300ms"/>'
        'רואים את הכסף גדל לאורך זמן.'
        '<break time="200ms"/>'
        '<emphasis level="moderate">כיף לדעת שהעתיד מסודר</emphasis>, לא?'
    ),
    "16-mortgage": ssml_wrap(
        'משכנתא?'
        '<break time="200ms"/>'
        'רואים הכל לפי מסלולים - פריים, קבועה, משתנה.'
        '<break time="200ms"/>'
        'כמה שילמתם, כמה נשאר, ומתי נגמר הסיפור.'
        '<break time="300ms"/>'
        '<emphasis level="moderate">אתם רואים את הסוף!</emphasis>'
        '<break time="200ms"/>'
        'איזו הקלה.'
    ),
    "17-debts": ssml_wrap(
        'כל ההלוואות שלכם? הכל במקום אחד.'
        '<break time="200ms"/>'
        'תאריכי תשלום, ריביות, יתרות.'
        '<break time="300ms"/>'
        'ככה אף פעם לא שוכחים תשלום, ותמיד יודעים מה המצב.'
        '<break time="200ms"/>'
        '<emphasis level="moderate">סוף סוף שקט נפשי.</emphasis>'
    ),
    "18-insurance": ssml_wrap(
        'תיק ביטוח משפחתי - בריאות, רכב, דירה, חיים.'
        '<break time="200ms"/>'
        'כל הפוליסות, תאריכי חידוש, עלויות חודשיות - הכל מול העיניים!'
        '<break time="300ms"/>'
        'לא מפספסים כלום, ותמיד יודעים <emphasis level="moderate">שאתם מכוסים</emphasis>.'
    ),
    "19-subscriptions": ssml_wrap(
        'כל המנויים האלה!'
        '<break time="200ms"/>'
        'נטפליקס, ספוטיפיי, חדר כושר, אפליקציות.'
        '<break time="300ms"/>'
        'רואים כמה זה עולה ביחד, ופתאום קולטים איפה אפשר לחסוך.'
        '<break time="200ms"/>'
        '<emphasis level="moderate">פתאום יש בחירה!</emphasis>'
    ),
    "20-annual-analytics": ssml_wrap(
        'ניתוח שנתי - איפה הייתם בינואר, ואיפה אתם עכשיו.'
        '<break time="200ms"/>'
        'מגמות, חריגות, שיפורים.'
        '<break time="300ms"/>'
        'כל הסיפור הכלכלי של השנה בתצוגה אחת.'
        '<break time="200ms"/>'
        '<emphasis level="moderate">איזה סיפוק לראות את ההתקדמות!</emphasis>'
    ),
    "21-ai-advisor": ssml_wrap(
        'ועכשיו - תקשיבו טוב, זה <emphasis level="strong">הכוכב</emphasis>!'
        '<break time="300ms"/>'
        'קוראים לו אורן, והוא היועץ הפיננסי החכם שלכם.'
        '<break time="200ms"/>'
        'שואלים אותו כל שאלה - איך לחסוך, לסגור את המינוס, מה עם הפנסיה.'
        '<break time="300ms"/>'
        'הוא מכיר את הנתונים שלכם ונותן תשובות <emphasis level="strong">אישיות</emphasis>.'
        '<break time="200ms"/>'
        'כמו יועץ פרטי, אבל זמין 24/7.'
        '<break time="200ms"/>'
        '<emphasis level="moderate">לא ייאמן כמה זה עוזר!</emphasis>'
    ),
    "22-family-settings": ssml_wrap(
        'בן או בת הזוג? מזמינים בלחיצה אחת.'
        '<break time="300ms"/>'
        'ניהול משותף, שקוף, בלי סודות.'
        '<break time="200ms"/>'
        '<emphasis level="moderate">פתאום יש ביטחון ושקט ביחד.</emphasis>'
    ),
    "23-cta": ssml_wrap(
        'בקיצור - <emphasis level="strong">Family Plan</emphasis>.'
        '<break time="300ms"/>'
        'הכלכלה של המשפחה, סוף סוף בשליטה.'
        '<break time="200ms"/>'
        'די לבלגן.'
        '<break time="400ms"/>'
        'אז למה אתם מחכים?'
        '<break time="300ms"/>'
        'התחילו עכשיו, <emphasis level="strong">בחינם</emphasis>.'
        '<break time="200ms"/>'
        '<emphasis level="moderate">באמת שווה!</emphasis>'
    ),
}


def main():
    for scene_id, ssml_content in scenes_ssml.items():
        ssml_file = os.path.join(SSML_DIR, f"{scene_id}.ssml")
        mp3_file = os.path.join(AUDIO_DIR, f"{scene_id}.mp3")

        # Write SSML file
        with open(ssml_file, "w", encoding="utf-8") as f:
            f.write(ssml_content)

        print(f"Generating {scene_id}...")
        result = subprocess.run(
            [
                "edge-tts",
                "--voice", VOICE,
                "-f", ssml_file,
                "--write-media", mp3_file,
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(f"  ERROR: {result.stderr}")
        else:
            print(f"  OK: {mp3_file}")

    print("\nDone! All 23 narrations regenerated with SSML prosody.")


if __name__ == "__main__":
    main()
