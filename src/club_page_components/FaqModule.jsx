import React from 'react';
import FaqCards from './FaqCards';
import FaqTable from './FaqTable';
import './FaqModule.css';

/**
 * FAQs module.
 *
 * data shape: { faqs: [{ q, a }] }
 *
 * Viewer mode: flip cards + (for logged-in non-editors) an "ask" card.
 * Edit mode (approved editors): the cards plus the question table, where pending
 * user-submitted questions can be answered/accepted or deleted, and the club's own
 * FAQs edited. Accept/delete are optimistic and committed by the page-level Save
 * (handled by the parent via onAcceptQuestion/onDeleteQuestion + onChange).
 *
 * @param {Object}   club
 * @param {Object}   data
 * @param {boolean}  editing
 * @param {Function} onChange         - (updatedData) => void  (owner FAQ edits)
 * @param {boolean}  canAsk           - logged-in non-editor may submit a question
 * @param {Array}    userQuestions    - pending submissions [{ id, question }] (editor only)
 * @param {Function} onAcceptQuestion - (id, answer) => void
 * @param {Function} onDeleteQuestion - (id) => void
 */
function FaqModule({
  club,
  data,
  editing,
  onChange,
  warning,
  canAsk = false,
  userQuestions = [],
  onAcceptQuestion,
  onDeleteQuestion,
}) {
  const faqs = data?.faqs ?? [];

  return (
    <div className="faq-module">
      <p className="divider-header">FAQs</p>
      {editing && (
          <p className="about-edit-help">
            User questions will appear in the top table. You can "X" to reject them or answer them to add them to your FAQs. In the bottom table, you can manually enter any questions you typically get and answer them.
          </p>
        )}
      {editing && warning && <p className="module-warning">{warning}</p>}

      <FaqCards clubId={club?.id} faqs={faqs} canAsk={canAsk && !editing} />

      {editing && (
        <FaqTable
          faqs={faqs}
          onChange={(nextFaqs) => onChange?.({ ...data, faqs: nextFaqs })}
          userQuestions={userQuestions}
          onAccept={onAcceptQuestion}
          onDelete={onDeleteQuestion}
        />
      )}
    </div>
  );
}

export default React.memo(FaqModule);
