import { RtcTokenBuilder, RtcRole, RtmTokenBuilder, RtmRole } from 'agora-access-token';

export function generateRtcToken(channelName: string, uid: number = 0): string {
  const appId = process.env.AGORA_APP_ID;
  const appCert = process.env.AGORA_APP_CERTIFICATE;

  if (!appId || !appCert) {
    throw new Error('AGORA_APP_ID and AGORA_APP_CERT must be set in environment variables');
  }

  const role = RtcRole.PUBLISHER;
  // Extend RTC token lifetime to avoid mid-call drops (default 2h)
  const expirationSeconds = 2 * 60 * 60;
  const current = Math.floor(Date.now() / 1000);

  return RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCert,
    channelName,
    uid,
    role,
    current + expirationSeconds
  );
}

export function generateRtmToken(userId: string): string {
  const appId = process.env.AGORA_APP_ID;
  const appCert = process.env.AGORA_APP_CERTIFICATE;

  if (!appId || !appCert) {
    throw new Error('AGORA_APP_ID and AGORA_APP_CERT must be set in environment variables');
  }

  const expirationSeconds = 3600; // 1 hour
  const current = Math.floor(Date.now() / 1000);

  return RtmTokenBuilder.buildToken(
    appId,
    appCert,
    userId,
    RtmRole.Rtm_User,
    current + expirationSeconds
  );
}
