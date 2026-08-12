// Netlify event function: runs on every verified form submission.
// Newsletter signups get added to the Resend audience so the email list
// stays in sync automatically. Booking-form submissions are left alone —
// they didn't consent to marketing email.
//
// Env vars: RESEND_API_KEY, RESEND_AUDIENCE_ID

export const handler = async (event) => {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESEND_AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID;
  if (!RESEND_API_KEY || !RESEND_AUDIENCE_ID) {
    console.log('submission-created: Resend not configured, skipping');
    return { statusCode: 200, body: 'skipped' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body).payload;
  } catch {
    return { statusCode: 400, body: 'bad payload' };
  }

  const formName = payload.form_name || (payload.data && payload.data['form-name']);
  if (formName !== 'newsletter') {
    return { statusCode: 200, body: 'not the newsletter form' };
  }
  const email = (payload.email || (payload.data && payload.data.email) || '').trim();
  if (!email) return { statusCode: 200, body: 'no email in submission' };

  const res = await fetch(
    `https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, unsubscribed: false }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    // 409/validation = already subscribed etc. — log it, don't fail the event
    console.log('submission-created: Resend responded', res.status, JSON.stringify(data).slice(0, 200));
    return { statusCode: 200, body: 'resend error logged' };
  }
  console.log(`submission-created: added ${email} to audience (contact ${data.id})`);
  return { statusCode: 200, body: 'subscribed' };
};
