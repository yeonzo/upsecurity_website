const INBOX = 'subw04@gmail.com';
const MAX_BODY_BYTES = 8192;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function response(statusCode, data) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(data),
  };
}

function inline(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/[\r\n\t\u0000-\u001f]/g, ' ').slice(0, maxLength + 1);
}

function validPhone(value) {
  const digits = value.replace(/\D/g, '');
  return /^\+?[\d\s().-]+$/.test(value) && digits.length >= 9 && digits.length <= 15;
}

function validateLead(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const kind = body.kind;
  const name = inline(body.name, 80);
  if (!['beta', 'contact'].includes(kind) || !name || name.length > 80 || body.agree !== true) return null;

  if (kind === 'beta') {
    const contact = inline(body.contact, 160);
    if (!contact || contact.length > 160 || !(EMAIL.test(contact) || validPhone(contact))) return null;
    return { kind, name, contact };
  }

  const company = inline(body.company, 120);
  const email = inline(body.email, 160);
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!company || company.length > 120 || !email || email.length > 160 || !EMAIL.test(email) || message.length > 2000) return null;
  return { kind, name, company, email, message };
}

let sesClient;
export function buildSesRequest({ from, subject, text, replyTo }) {
  return {
    FromEmailAddress: from,
    Destination: { ToAddresses: [INBOX] },
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Text: { Data: text, Charset: 'UTF-8' } },
      },
    },
    ...(replyTo ? { ReplyToAddresses: [replyTo] } : {}),
  };
}

async function sendWithSes(mail) {
  const { SESv2Client, SendEmailCommand } = await import('@aws-sdk/client-sesv2');
  sesClient ??= new SESv2Client({});
  const result = await sesClient.send(new SendEmailCommand(buildSesRequest(mail)));
  return result.MessageId;
}

// sendEmail is injectable so tests never access AWS or send real mail.
export function createHandler(sendEmail = sendWithSes) {
  return async function handleLead(event) {
    if (event.requestContext?.http?.method !== 'POST') return response(405, { error: '허용되지 않은 요청입니다' });
    const contentType = event.headers?.['content-type'] || event.headers?.['Content-Type'] || '';
    if (!contentType.toLowerCase().includes('application/json')) return response(415, { error: '잘못된 요청 형식입니다' });

    let body;
    try {
      const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '';
      if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return response(413, { error: '입력 내용이 너무 깁니다' });
      body = JSON.parse(raw);
    } catch {
      return response(400, { error: '입력 내용을 확인해 주세요' });
    }

    // Hidden field catches basic automated submissions without sending mail.
    if (body?.website) return response(400, { error: '요청을 처리할 수 없습니다' });
    const lead = validateLead(body);
    if (!lead) return response(400, { error: '필수 정보와 동의 항목을 확인해 주세요' });

    const from = process.env.SENDER_EMAIL;
    if (!from) return response(503, { error: '접수 기능을 준비 중입니다. 잠시 후 다시 시도해 주세요' });

    const isBeta = lead.kind === 'beta';
    const subject = isBeta ? '[Campfire] 베타 사전예약 접수' : '[Campfire] 도입 문의 접수';
    const text = isBeta
      ? `접수 유형: 베타 사전예약\n이름: ${lead.name}\n연락처: ${lead.contact}`
      : `접수 유형: 도입 문의\n회사명: ${lead.company}\n담당자명: ${lead.name}\n업무 이메일: ${lead.email}\n문의 내용:\n${lead.message || '(없음)'}`;
    const replyTo = isBeta ? (EMAIL.test(lead.contact) ? lead.contact : '') : lead.email;

    try {
      const messageId = await sendEmail({ from, subject, text, replyTo });
      if (!messageId) return response(502, { error: '접수 결과를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요' });
      return response(200, { ok: true });
    } catch (error) {
      // Never write submitted personal information to CloudWatch logs.
      console.error('Lead SES send failed:', error?.name || 'unknown');
      return response(502, { error: '메일 전송에 실패했습니다. 잠시 후 다시 시도해 주세요' });
    }
  };
}

export const handler = createHandler();
