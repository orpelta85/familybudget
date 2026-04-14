-- ============================================================
-- AI Insights — תובנות AI שבועיות (Claude Sonnet)
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id uuid REFERENCES families(id) ON DELETE CASCADE,
  insight_text text NOT NULL,
  category text CHECK (category IN ('spending', 'saving', 'alert', 'achievement', 'action')),
  severity text CHECK (severity IN ('info', 'warning', 'positive')),
  is_read boolean DEFAULT false,
  generated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_insights_user_id_idx ON ai_insights(user_id);
CREATE INDEX IF NOT EXISTS ai_insights_generated_at_idx ON ai_insights(generated_at DESC);

-- Row Level Security
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_sees_own_insights" ON ai_insights;
CREATE POLICY "user_sees_own_insights" ON ai_insights FOR ALL
  USING (
    user_id = auth.uid()
    OR family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  );
