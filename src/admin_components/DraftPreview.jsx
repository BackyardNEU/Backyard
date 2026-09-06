import BasicInfoModule from '../club_page_components/BasicInfoModule';
import JoinModule from '../club_page_components/JoinModule';
import StatsModule from '../club_page_components/StatsModule';
import FaqModule from '../club_page_components/FaqModule';
import MemberRosterModule from '../club_page_components/MemberRosterModule';
import ClubMediaModule from '../club_page_components/ClubMediaModule';
import { sanitizeModules } from '../../shared/sanitizeModules.js';

/**
 * Renders a submitted draft with the real club page components.
 *
 * A field-by-field summary tells a reviewer what a club typed. It does not tell them
 * whether the page reads well, whether the logo is the wrong shape, or whether a
 * description runs three lines longer than it should. Approving is a judgement about how
 * the page looks, so the review screen has to show the page.
 *
 * Same components the university page uses, in display mode, so what appears here is what
 * students will get. Nothing is written; this reads the draft straight out of
 * club_onboarding.
 *
 * Calendar and comments are left out on purpose. They render live rows that do not exist
 * yet, since events are only created at approval, so they would show an empty state that
 * says nothing about the submission.
 */
export default function DraftPreview({ record }) {
    const draft = record?.draft ?? {};
    // Run through the same pass approve does, so this shows what will actually be
    // published rather than the raw draft. It also backfills link defaults for anything
    // submitted before those were being set, which is why old drafts preview correctly
    // without needing a save first.
    const modules = [...sanitizeModules(draft.modules ?? [])]
        .filter((m) => m?.isDisplayed !== false)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const basic = modules.find((m) => m.type === 'basic_info')?.data ?? {};
    const source = record?.demo_club_data ?? {};

    // The draft's name and logo win over the stored row: the point is to see the club as
    // it will be after approval, not as the scraper left it.
    const club = {
        ...source,
        id: record.club_id,
        club_name: basic.club_name || source.club_name || '',
        image_url: basic.logo_url || source.image_url || '',
    };

    if (modules.length === 0) {
        return <p style={{ color: '#555' }}>This draft has no page content yet.</p>;
    }

    return (
        <div className="draft-preview">
            {modules.map((module, i) => {
                const key = `${module.type}-${i}`;

                switch (module.type) {
                    case 'basic_info':
                        return (
                            <BasicInfoModule
                                key={key}
                                club={club}
                                data={module.data}
                                editing={false}
                                part="full"
                                linksDisplayed
                                currentUserId={null}
                            />
                        );
                    case 'join':
                        return <JoinModule key={key} club={club} data={module.data} editing={false} />;
                    case 'stats':
                        return <StatsModule key={key} data={module.data} editing={false} />;
                    case 'club_media':
                        return <ClubMediaModule key={key} data={module.data} editing={false} />;
                    case 'faqs':
                        return (
                            <FaqModule
                                key={key}
                                club={club}
                                data={module.data}
                                editing={false}
                                canAsk={false}
                                userQuestions={[]}
                            />
                        );
                    case 'member_roster':
                        return <MemberRosterModule key={key} club={club} data={module.data} editing={false} />;
                    default:
                        // links renders inside basic_info's action row; calendar and
                        // comments need live rows that do not exist before approval.
                        return null;
                }
            })}
        </div>
    );
}
