export function TosModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div
        className="modal card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Terms of Service"
      >
        <div className="outputHeader">
          <h2 className="h2">Terms of Service</h2>
          <button type="button" className="link" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="tosBody">
          <p className="hint">Last updated: September 12, 2026</p>

          <h3>What this is</h3>
          <p>
            Fluffinator is a personal demo project that uses AI to rewrite short, blunt
            messages into friendlier versions. It is provided “as is” for demonstration
            purposes, without warranties of any kind.
          </p>

          <h3>Data sent to OpenAI</h3>
          <p>
            When you submit a message, its contents are transmitted to OpenAI’s API to
            generate a rewritten version. The site owner has opted in to OpenAI’s
            data-sharing program in exchange for reduced API costs, which means submitted
            content may be used by OpenAI — for example, to evaluate or improve its
            models — under OpenAI’s own data usage policies.
          </p>
          <p>
            Do not submit sensitive, confidential, or personally identifying information.
            Anything you type into the message box may be processed and retained by
            OpenAI.
          </p>

          <h3>Information stored by this site</h3>
          <p>
            Your email address is stored in Amazon Cognito (AWS) and used solely for
            sign-in via one-time codes. A daily count of API requests per account is
            stored in AWS DynamoDB for rate limiting. Your tone preferences are stored
            only in your own browser’s local storage and are never sent to our servers
            except as part of a rewrite request.
          </p>

          <h3>Access and limits</h3>
          <p>
            Access is provided at the owner’s discretion and may be modified or revoked
            at any time. Rate limits apply. The service may be changed or discontinued
            without notice.
          </p>

          <h3>AI output</h3>
          <p>
            AI-generated text may be inaccurate, incomplete, or inappropriate. Review
            every rewrite before sending it. You are responsible for the messages you
            choose to send.
          </p>

          <h3>Liability</h3>
          <p>
            To the maximum extent permitted by law, the owner is not liable for any
            damages arising from use of this service.
          </p>

          <h3>Changes to these terms</h3>
          <p>
            These terms may be updated from time to time. Continued use of the service
            after changes take effect constitutes acceptance of the updated terms.
          </p>
        </div>
      </div>
    </div>
  )
}
