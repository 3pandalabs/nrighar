import { ApplicationFailure } from "@temporalio/common";
import { mailerConfigured, sendMail } from "../../lib/mailer.js";
import { buildContactMessageEmail } from "../../lib/emails/contactMessage.js";

// Contact-form submissions are relayed straight to the support inbox and not
// persisted. Nothing else in the product reads them, and a table of
// unauthenticated free text would be one more store to secure and purge for no
// gain — the mail is the record.
//
// Unlike the password-reset path, an unconfigured mailer is NOT swallowed here:
// there, the reset row was already written and the caller must learn nothing
// about the outcome; here, the message would simply vanish, and telling the
// visitor "sent" when nobody will ever see it is the worse failure.
export async function sendContactMessageActivity(input: {
  name: string;
  email: string;
  message: string;
}) {
  if (!mailerConfigured()) {
    throw ApplicationFailure.create({ type: "mailer_unavailable", nonRetryable: true });
  }

  const result = await sendMail([buildContactMessageEmail(input)], (msg) =>
    console.log(`sendContactMessage: ${msg}`),
  );

  if (result.delivered === 0) {
    throw ApplicationFailure.create({ type: "mailer_unavailable", nonRetryable: true });
  }
}
