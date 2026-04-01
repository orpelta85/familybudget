# Onboarding Wizard - Hebrew Content (All 6 Steps)

Ready for developer implementation. All text is final Hebrew copy.

---

## General UI Texts

### Progress Bar Labels (per step)
| Step | Label |
|------|-------|
| 1 | פרטים אישיים |
| 2 | הגדרת משפחה |
| 3 | הכנסה חודשית |
| 4 | ייבוא הוצאות |
| 5 | מה רלוונטי לך? |
| 6 | סיום |

### Shared Buttons
- **Next:** `המשך`
- **Back:** `חזרה`
- **Skip (all steps):** `אדלג, אגדיר אחר כך`
- **Finish (step 6):** `בואו נתחיל`

---

## Step 1: ברוך הבא + פרטים (mandatory)

**Headline:** `ברוך הבא לניהול הכספים שלך`

**Subtitle:** `כאן תנהל תקציב, תעקוב אחרי הוצאות והכנסות, ותקבל תמונה ברורה של המצב הפיננסי שלך.`

**Form Fields:**

| Field | Label | Placeholder | Required |
|-------|-------|-------------|----------|
| Full name | `שם מלא` | `ישראל ישראלי` | Yes |
| Family status | `מצב משפחתי` | — (radio/select) | Yes |

**Family Status Options:**
- `יחיד/ה` (solo)
- `זוג / משפחה` (couple/family)

**Button:** `המשך`

---

## Step 2: הגדרת משפחה (skippable - shows only if "זוג / משפחה")

**Headline:** `הגדרת המשפחה`

**Explanation:** `מצב משפחה מאפשר לך ולבן/בת הזוג לנהל תקציב משותף - כל אחד מזין את הנתונים שלו, ורואים את התמונה המלאה ביחד.`

**Form Fields:**

| Field | Label | Placeholder | Required |
|-------|-------|-------------|----------|
| Family name | `שם המשפחה` | `משפחת כהן` | Yes |
| Partner email | `אימייל בן/בת הזוג` | `partner@email.com` | No |
| Split % | `חלוקת הוצאות משותפות` | — (slider, default 50/50) | Yes |

**Split Percentage Labels:**
- Left label: `אני`
- Right label: `בן/בת הזוג`
- Default display: `50% / 50%`

**Invite Section (under partner email):**
- Helper text: `נשלח הזמנה להצטרף למשפחה`

**Invite Email:**
- **Subject:** `הצטרף/י לניהול התקציב המשפחתי`
- **Body:**
```
היי,

[USER_NAME] הזמין/ה אותך להצטרף למשפחת [FAMILY_NAME] באפליקציית ניהול התקציב.

ביחד תוכלו לעקוב אחרי הכנסות, הוצאות ותקציב - כל אחד מהחשבון שלו.

להצטרפות: [INVITE_LINK]
```

**Buttons:** `המשך` / `אדלג, אגדיר אחר כך`

---

## Step 3: הכנסה חודשית (skippable)

**Headline:** `ההכנסה החודשית שלך`

**Explanation:** `ההכנסה היא הבסיס לחישוב התקציב, שיעור החיסכון והתחזיות שלך.`

**Form Fields:**

| Field | Label | Placeholder | Required |
|-------|-------|-------------|----------|
| Net salary | `משכורת נטו` | `12,000 ₪` | Yes |
| Monthly bonus | `בונוס / עמלות (חודשי)` | `0 ₪` | No |
| Additional income | `הכנסה נוספת` | `0 ₪` | No |

**Additional Income Helper:** `שכירות, פרילנס, רווחי השקעות וכו׳`

**Summary line (calculated live):**
`סה"כ הכנסה חודשית: [TOTAL] ₪`

**Buttons:** `המשך` / `אדלג, אגדיר אחר כך`

---

## Step 4: ייבוא הוצאות (skippable)

**Headline:** `ייבוא הוצאות מהבנק`

**Explanation:** `ייבוא קובץ אקסל מהבנק או כרטיס האשראי ימלא את ההוצאות שלך אוטומטית.`

**Supported Banks Section:**
- **Label:** `בנקים וכרטיסים נתמכים:`
- **List:** `לאומי, הפועלים, דיסקונט, מזרחי, פירסט אינטרנשיונל, ישראכרט, כאל, מקס`

**Drag-Drop Zone:**
- **Main text:** `גרור קובץ אקסל לכאן`
- **Or text:** `או`
- **Browse button:** `בחר קובץ`
- **Format hint:** `קבצי Excel בלבד (xlsx, xls)`

**Messages:**

| State | Message |
|-------|---------|
| Uploading | `מעבד את הקובץ...` |
| Success | `יובאו [COUNT] הוצאות בהצלחה` |
| Partial success | `יובאו [COUNT] הוצאות. [SKIPPED] שורות לא זוהו.` |
| Error - wrong format | `פורמט הקובץ לא מוכר. נסה קובץ אקסל ישירות מהבנק.` |
| Error - empty | `הקובץ ריק או לא מכיל נתונים.` |
| Error - general | `שגיאה בעיבוד הקובץ. נסה שוב או דלג.` |

**Buttons:** `המשך` / `אדלג, אגדיר אחר כך`

---

## Step 5: מה עוד רלוונטי לך? (skippable)

**Headline:** `מה עוד רלוונטי לך?`

**Top message:** `אפשר להגדיר עכשיו או בכל שלב מתוך המערכת`

**Explanation:** `סמן את מה שרלוונטי - נפתח לך מיני-טופס קצר להזנת הנתונים הבסיסיים.`

---

### Checklist Item 1: תקציב חודשי
- **Description:** `הגדר יעדים חודשיים לכל קטגוריית הוצאה`
- **Mini-form fields:**

| Field | Label | Placeholder |
|-------|-------|-------------|
| Category name | `קטגוריה` | `מזון, דלק, בילויים...` |
| Monthly target | `יעד חודשי` | `2,000 ₪` |

- **Add button:** `+ הוסף קטגוריה`

---

### Checklist Item 2: קרנות צבירה
- **Description:** `חסכון חודשי ייעודי - חופשה, רכב, חירום`
- **Mini-form fields:**

| Field | Label | Placeholder |
|-------|-------|-------------|
| Fund name | `שם הקרן` | `קרן חירום, חופשה שנתית...` |
| Target amount | `סכום יעד` | `10,000 ₪` |
| Monthly deposit | `הפקדה חודשית` | `500 ₪` |

- **Add button:** `+ הוסף קרן`

---

### Checklist Item 3: פנסיה
- **Description:** `מעקב אחרי הפקדות וצבירת הפנסיה שלך`
- **Mini-form fields:**

| Field | Label | Placeholder |
|-------|-------|-------------|
| Provider | `חברת ביטוח / גוף מנהל` | `מגדל, הראל, כלל...` |
| Total accumulated | `סכום צבור` | `250,000 ₪` |
| Monthly deposit | `הפקדה חודשית (עובד + מעסיק)` | `2,500 ₪` |

- **Add button:** `+ הוסף קופת פנסיה`

---

### Checklist Item 4: משכנתא
- **Description:** `מעקב אחרי מסלולי המשכנתא, יתרות ותשלומים`
- **Mini-form fields:**

| Field | Label | Placeholder |
|-------|-------|-------------|
| Track name | `שם המסלול` | `פריים, קבועה לא צמודה...` |
| Original amount | `סכום מקורי` | `800,000 ₪` |
| Remaining | `יתרה` | `650,000 ₪` |
| Monthly payment | `החזר חודשי` | `3,500 ₪` |
| Interest rate | `ריבית (%)` | `3.5%` |

- **Add button:** `+ הוסף מסלול`

---

### Checklist Item 5: ילדים
- **Description:** `מעקב אחרי הוצאות ילדים - חינוך, חוגים, ביגוד`
- **Mini-form fields:**

| Field | Label | Placeholder |
|-------|-------|-------------|
| Child name | `שם הילד/ה` | `נועה` |
| Birth year | `שנת לידה` | `2020` |
| Monthly expenses | `הוצאות חודשיות (הערכה)` | `2,000 ₪` |

- **Add button:** `+ הוסף ילד/ה`

---

### Checklist Item 6: חובות / הלוואות
- **Description:** `מעקב אחרי הלוואות, חובות ולוחות סילוקין`
- **Mini-form fields:**

| Field | Label | Placeholder |
|-------|-------|-------------|
| Debt name | `שם ההלוואה / החוב` | `הלוואה מהבנק, אשראי...` |
| Total amount | `סכום מקורי` | `50,000 ₪` |
| Remaining | `יתרה` | `35,000 ₪` |
| Monthly payment | `החזר חודשי` | `1,200 ₪` |

- **Add button:** `+ הוסף חוב / הלוואה`

---

### Checklist Item 7: ביטוחים
- **Description:** `ריכוז כל הביטוחים - חיים, בריאות, רכב, דירה`
- **Mini-form fields:**

| Field | Label | Placeholder |
|-------|-------|-------------|
| Insurance type | `סוג ביטוח` | `חיים, בריאות, רכב, דירה` |
| Provider | `חברת ביטוח` | `הראל, מגדל, כלל...` |
| Monthly cost | `עלות חודשית` | `350 ₪` |

- **Add button:** `+ הוסף ביטוח`

---

### Checklist Item 8: מנויים
- **Description:** `נטפליקס, ספוטיפיי, חדר כושר - כל המנויים במקום אחד`
- **Mini-form fields:**

| Field | Label | Placeholder |
|-------|-------|-------------|
| Subscription name | `שם המנוי` | `נטפליקס, ספוטיפיי...` |
| Monthly cost | `עלות חודשית` | `50 ₪` |
| Billing day | `יום חיוב` | `15` |

- **Add button:** `+ הוסף מנוי`

---

### Checklist Item 9: יעדים פיננסיים
- **Description:** `הגדר יעדי חיסכון - דירה, רכב, טיול, קרן לימודים`
- **Mini-form fields:**

| Field | Label | Placeholder |
|-------|-------|-------------|
| Goal name | `שם היעד` | `מקדמה לדירה, רכב חדש...` |
| Target amount | `סכום יעד` | `100,000 ₪` |
| Target date | `תאריך יעד` | `12/2027` |
| Current savings | `חיסכון נוכחי` | `25,000 ₪` |

- **Add button:** `+ הוסף יעד`

---

### Checklist Item 10: הוצאות משותפות
- **Description:** `חלוקת הוצאות בין בני הזוג - שכירות, חשבונות, סופר`
- **Mini-form fields:**

| Field | Label | Placeholder |
|-------|-------|-------------|
| Expense name | `שם ההוצאה` | `שכירות, ארנונה, סופר...` |
| Monthly amount | `סכום חודשי` | `4,500 ₪` |
| Split | `חלוקה` | `50% / 50%` |

- **Add button:** `+ הוסף הוצאה משותפת`

**Note for developer:** This item shows only if user chose "זוג / משפחה" in step 1.

---

**Step 5 Buttons:** `המשך` / `אדלג, אגדיר אחר כך`

---

## Step 6: סיום + סיור מהיר (skippable)

**Headline:** `הכל מוכן!`

**Sub-headline:** `הנה סיכום מה שהגדרת:`

**Summary Template (dynamic, shows only items that were set up):**

| Condition | Summary Line |
|-----------|-------------|
| Name set | `שם: [NAME]` |
| Family set | `משפחה: [FAMILY_NAME] (עם [PARTNER_EMAIL])` |
| Income set | `הכנסה חודשית: [TOTAL] ₪` |
| Expenses imported | `יובאו [COUNT] הוצאות` |
| Budget set | `[COUNT] קטגוריות תקציב` |
| Sinking funds set | `[COUNT] קרנות צבירה` |
| Pension set | `פנסיה - מעקב פעיל` |
| Mortgage set | `[COUNT] מסלולי משכנתא` |
| Kids set | `[COUNT] ילדים` |
| Debts set | `[COUNT] חובות / הלוואות` |
| Insurance set | `[COUNT] פוליסות ביטוח` |
| Subscriptions set | `[COUNT] מנויים` |
| Goals set | `[COUNT] יעדים פיננסיים` |
| Joint expenses set | `[COUNT] הוצאות משותפות` |

**Empty state (user skipped everything):**
`דילגת על רוב השלבים - אין בעיה! אפשר להגדיר הכל מתוך המערכת בכל שלב.`

---

### Quick Tour Tooltips

The tour highlights 4 UI elements with tooltip bubbles. Each tooltip has a title and a short body.

**Tooltip 1 - Sidebar Navigation:**
- **Title:** `תפריט הניווט`
- **Body:** `כאן תמצא את כל הדפים - הוצאות, הכנסות, תקציב ועוד. הכל נגיש בלחיצה אחת.`

**Tooltip 2 - Period Selector:**
- **Title:** `בורר תקופה`
- **Body:** `כאן בוחרים את החודש. כל הנתונים בדפים מתעדכנים לפי התקופה שנבחרה.`

**Tooltip 3 - Personal/Family Toggle:**
- **Title:** `מצב אישי / משפחתי`
- **Body:** `מעבר בין התצוגה האישית שלך לבין התמונה המשפחתית המשותפת.`

**Tooltip 4 - Info Button (i):**
- **Title:** `כפתור מידע`
- **Body:** `לחיצה על (i) בכל כרטיס מציגה הסבר קצר על מה שאתה רואה.`

**Tour Navigation:**
- **Next tooltip:** `הבא`
- **Previous tooltip:** `הקודם`
- **Skip tour:** `דלג על הסיור`
- **Finish tour:** `סיימתי, בואו נתחיל`

---

**Final CTA Button:** `בואו נתחיל`

---

## Dashboard "Setup Checklist" Widget

A small widget on the dashboard that shows onboarding progress and remaining items.

**Widget Title:** `השלמת הגדרות`

**Progress text:** `[DONE] מתוך [TOTAL] הושלמו`

**Checklist Items (with check/uncheck state):**

| Item | Done Text | Not Done Text |
|------|-----------|---------------|
| Profile | `פרטים אישיים` | `פרטים אישיים` |
| Family | `הגדרת משפחה` | `הגדרת משפחה` |
| Income | `הכנסה חודשית` | `הכנסה חודשית` |
| Expenses | `ייבוא הוצאות` | `ייבוא הוצאות` |
| Budget | `תקציב חודשי` | `תקציב חודשי` |
| Sinking | `קרנות צבירה` | `קרנות צבירה` |
| Pension | `פנסיה` | `פנסיה` |
| Mortgage | `משכנתא` | `משכנתא` |

**CTA button (when items remain):** `המשך הגדרה`

**Completion message (all done):** `כל ההגדרות הושלמו - יופי!`

**Dismiss button:** `הסתר`

---

## Notes for Developer

1. Step 2 (family) and checklist item 10 (joint expenses) show only when user chose "זוג / משפחה" in step 1.
2. The skip button text is identical across all skippable steps: `אדלג, אגדיר אחר כך`
3. Step 5 checklist items should be collapsible - clicking an item opens the mini-form below it.
4. Tour tooltip for "Personal/Family Toggle" (tooltip 3) shows only for users who set up a family.
5. All currency inputs should auto-format with thousands separator and ₪ symbol.
6. The dashboard checklist widget should be dismissible and only show until all items are completed (or user hides it).
7. Progress bar should show completed steps with a checkmark, current step highlighted, and future steps grayed out.
