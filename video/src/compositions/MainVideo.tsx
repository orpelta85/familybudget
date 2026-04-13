import React from 'react';
import { Sequence, staticFile } from 'remotion';
import {
  LayoutDashboard,
  Users,
  Target,
  Building2,
  Brain,
} from 'lucide-react';

// Core components
import { SceneTitleCard } from '../components/SceneTitleCard';

// Scenes
import { Scene01Intro } from '../scenes/Scene01Intro';
import { Scene02Problem } from '../scenes/Scene02Problem';
import { Scene03Onboarding } from '../scenes/Scene03Onboarding';
import { Scene04Dashboard } from '../scenes/Scene04Dashboard';
import { Scene05Income } from '../scenes/Scene05Income';
import { Scene06Expenses } from '../scenes/Scene06Expenses';
import { Scene07Budget } from '../scenes/Scene07Budget';
import { Scene08PettyCash } from '../scenes/Scene08PettyCash';
import { Scene09Kids } from '../scenes/Scene09Kids';
import { Scene10SharedView } from '../scenes/Scene10SharedView';
import { Scene11SinkingFunds } from '../scenes/Scene11SinkingFunds';
import { Scene12Goals } from '../scenes/Scene12Goals';
import { Scene13Forecast } from '../scenes/Scene13Forecast';
import { Scene14NetWorth } from '../scenes/Scene14NetWorth';
import { Scene15Pension } from '../scenes/Scene15Pension';
import { Scene16Mortgage } from '../scenes/Scene16Mortgage';
import { Scene17Debts } from '../scenes/Scene17Debts';
import { Scene18Insurance } from '../scenes/Scene18Insurance';
import { Scene19Subscriptions } from '../scenes/Scene19Subscriptions';
import { Scene20Analytics } from '../scenes/Scene20Analytics';
import { Scene21AIAdvisor } from '../scenes/Scene21AIAdvisor';
import { Scene22FamilySettings } from '../scenes/Scene22FamilySettings';
import { Scene23CTA } from '../scenes/Scene23CTA';

import { scenes, TOTAL_DURATION_FRAMES } from '../config/scenes';

const TITLE_CARD_DURATION = 45; // 1.5 seconds at 30fps

/**
 * Background music track (ambient/lo-fi).
 *
 * TODO: משתמש צריך להוסיף קובץ ל-public/assets/audio/bg-music.mp3
 *       (כ-4 דקות, קל, אינסטרומנטלי, 60-80 BPM, אמביינט/lo-fi/corporate-calm)
 *       ואז לבטל את ה-comment של ה-<Audio> + ה-import של Audio + ה-<Sequence>
 *       שעוטף את <BackgroundMusic /> ב-return למטה.
 *
 * מקורות חינמיים מומלצים (royalty-free):
 *   - https://pixabay.com/music/search/ambient%20corporate/
 *   - https://uppbeat.io/browse/music/ambient
 *   - https://artlist.io (free tier)
 *
 * כוונון עוצמה: 0.08-0.12 עובד טוב מתחת לקריינות.
 */
// import { Audio } from 'remotion';
// const BackgroundMusic: React.FC = () => (
//   <Audio
//     src={staticFile('assets/audio/bg-music.mp3')}
//     volume={0.1}
//     startFrom={0}
//   />
// );

/**
 * Main video composition - sequences all 23 scenes with title cards between sections.
 *
 * Timeline layout:
 *   Scene 01 (Intro)           180 frames
 *   Scene 02 (Problem)         180 frames
 *   Scene 03 (Onboarding)      390 frames
 *   --- Title Card: ניהול שוטף ---  45 frames
 *   Scene 04 (Dashboard)       450 frames
 *   Scene 05 (Income)          300 frames
 *   Scene 06 (Expenses)        450 frames
 *   Scene 07 (Budget)          300 frames
 *   Scene 08 (Petty Cash)      300 frames
 *   --- Title Card: משפחה ---      45 frames
 *   Scene 09 (Kids)            300 frames
 *   Scene 10 (Shared View)     300 frames
 *   --- Title Card: חיסכון ויעדים --- 45 frames
 *   Scene 11 (Sinking Funds)   300 frames
 *   Scene 12 (Goals)           300 frames
 *   Scene 13 (Forecast)        300 frames
 *   --- Title Card: נכסים והתחייבויות --- 45 frames
 *   Scene 14 (Net Worth)       300 frames
 *   Scene 15 (Pension)         300 frames
 *   Scene 16 (Mortgage)        300 frames
 *   Scene 17 (Debts)           300 frames
 *   Scene 18 (Insurance)       300 frames
 *   --- Title Card: כלים חכמים ---  45 frames
 *   Scene 19 (Subscriptions)   210 frames
 *   Scene 20 (Analytics)       300 frames
 *   Scene 21 (AI Advisor)      390 frames
 *   Scene 22 (Family Settings) 150 frames
 *   Scene 23 (CTA)             300 frames
 */
export const MainVideo: React.FC = () => {
  let currentFrame = 0;

  const seq = (
    name: string,
    duration: number,
    component: React.ReactNode
  ) => {
    const from = currentFrame;
    currentFrame += duration;
    return (
      <Sequence key={name} name={name} from={from} durationInFrames={duration}>
        {component}
      </Sequence>
    );
  };

  const sequences: React.ReactNode[] = [];

  // Scene 01 - Intro
  sequences.push(seq('01-intro', scenes[0].durationFrames, <Scene01Intro />));

  // Scene 02 - Problem/Solution
  sequences.push(seq('02-problem', scenes[1].durationFrames, <Scene02Problem />));

  // Scene 03 - Onboarding
  sequences.push(seq('03-onboarding', scenes[2].durationFrames, <Scene03Onboarding />));

  // --- Title Card: ניהול שוטף ---
  sequences.push(
    seq(
      'tc-daily',
      TITLE_CARD_DURATION,
      <SceneTitleCard icon={LayoutDashboard} title="ניהול שוטף" />
    )
  );

  // Scene 04 - Dashboard
  sequences.push(seq('04-dashboard', scenes[3].durationFrames, <Scene04Dashboard />));

  // Scene 05 - Income
  sequences.push(seq('05-income', scenes[4].durationFrames, <Scene05Income />));

  // Scene 06 - Expenses
  sequences.push(seq('06-expenses', scenes[5].durationFrames, <Scene06Expenses />));

  // Scene 07 - Budget
  sequences.push(seq('07-budget', scenes[6].durationFrames, <Scene07Budget />));

  // Scene 08 - Petty Cash
  sequences.push(seq('08-petty-cash', scenes[7].durationFrames, <Scene08PettyCash />));

  // --- Title Card: משפחה ---
  sequences.push(
    seq(
      'tc-family',
      TITLE_CARD_DURATION,
      <SceneTitleCard icon={Users} title="משפחה" />
    )
  );

  // Scene 09 - Kids
  sequences.push(seq('09-kids', scenes[8].durationFrames, <Scene09Kids />));

  // Scene 10 - Shared View
  sequences.push(seq('10-shared-view', scenes[9].durationFrames, <Scene10SharedView />));

  // --- Title Card: חיסכון ויעדים ---
  sequences.push(
    seq(
      'tc-savings',
      TITLE_CARD_DURATION,
      <SceneTitleCard icon={Target} title="חיסכון ויעדים" />
    )
  );

  // Scene 11 - Sinking Funds
  sequences.push(seq('11-sinking-funds', scenes[10].durationFrames, <Scene11SinkingFunds />));

  // Scene 12 - Goals
  sequences.push(seq('12-goals', scenes[11].durationFrames, <Scene12Goals />));

  // Scene 13 - Forecast
  sequences.push(seq('13-forecast', scenes[12].durationFrames, <Scene13Forecast />));

  // --- Title Card: נכסים והתחייבויות ---
  sequences.push(
    seq(
      'tc-assets',
      TITLE_CARD_DURATION,
      <SceneTitleCard icon={Building2} title="נכסים והתחייבויות" />
    )
  );

  // Scene 14 - Net Worth
  sequences.push(seq('14-net-worth', scenes[13].durationFrames, <Scene14NetWorth />));

  // Scene 15 - Pension
  sequences.push(seq('15-pension', scenes[14].durationFrames, <Scene15Pension />));

  // Scene 16 - Mortgage
  sequences.push(seq('16-mortgage', scenes[15].durationFrames, <Scene16Mortgage />));

  // Scene 17 - Debts
  sequences.push(seq('17-debts', scenes[16].durationFrames, <Scene17Debts />));

  // Scene 18 - Insurance
  sequences.push(seq('18-insurance', scenes[17].durationFrames, <Scene18Insurance />));

  // --- Title Card: כלים חכמים ---
  sequences.push(
    seq(
      'tc-tools',
      TITLE_CARD_DURATION,
      <SceneTitleCard icon={Brain} title="כלים חכמים" />
    )
  );

  // Scene 19 - Subscriptions
  sequences.push(seq('19-subscriptions', scenes[18].durationFrames, <Scene19Subscriptions />));

  // Scene 20 - Analytics
  sequences.push(seq('20-analytics', scenes[19].durationFrames, <Scene20Analytics />));

  // Scene 21 - AI Advisor
  sequences.push(seq('21-ai-advisor', scenes[20].durationFrames, <Scene21AIAdvisor />));

  // Scene 22 - Family Settings
  sequences.push(seq('22-family-settings', scenes[21].durationFrames, <Scene22FamilySettings />));

  // Scene 23 - CTA
  sequences.push(seq('23-cta', scenes[22].durationFrames, <Scene23CTA />));

  return (
    <>
      {/* TODO: פסקול רקע - לבטל comment אחרי הוספת public/assets/audio/bg-music.mp3:
        <Sequence from={0} durationInFrames={TOTAL_DURATION_FRAMES}>
          <BackgroundMusic />
        </Sequence>
      */}
      {sequences}
    </>
  );
};
