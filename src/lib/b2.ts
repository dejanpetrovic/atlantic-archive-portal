import "server-only";

// Backblaze B2 native API. Files are never proxied through the app — we mint
// short-lived download authorizations and the browser fetches from B2.

type B2Auth = {
  accountId: string;
  apiUrl: string;
  downloadUrl: string;
  token: string;
  expiresAt: number;
  bucketIds: Map<string, string>;
};

const globalForB2 = globalThis as unknown as { b2Auth?: B2Auth | null };

async function authorize(force = false): Promise<B2Auth> {
  const cached = globalForB2.b2Auth;
  if (!force && cached && Date.now() < cached.expiresAt) return cached;

  const keyId = process.env.B2_KEY_ID;
  const appKey = process.env.B2_APP_KEY;
  if (!keyId || !appKey) throw new Error("B2_KEY_ID / B2_APP_KEY not set");

  const res = await fetch(
    "https://api.backblazeb2.com/b2api/v3/b2_authorize_account",
    {
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${keyId}:${appKey}`).toString("base64"),
      },
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`b2_authorize_account failed: ${res.status}`);
  const data = (await res.json()) as {
    accountId: string;
    authorizationToken: string;
    apiInfo: { storageApi: { apiUrl: string; downloadUrl: string } };
  };

  const auth: B2Auth = {
    accountId: data.accountId,
    apiUrl: data.apiInfo.storageApi.apiUrl,
    downloadUrl: data.apiInfo.storageApi.downloadUrl,
    token: data.authorizationToken,
    // Tokens last 24h; refresh well before that.
    expiresAt: Date.now() + 20 * 60 * 60 * 1000,
    bucketIds: new Map(),
  };
  globalForB2.b2Auth = auth;
  return auth;
}

async function bucketId(auth: B2Auth, bucketName: string): Promise<string> {
  const known = auth.bucketIds.get(bucketName);
  if (known) return known;

  const res = await fetch(`${auth.apiUrl}/b2api/v3/b2_list_buckets`, {
    method: "POST",
    headers: { Authorization: auth.token, "Content-Type": "application/json" },
    // The accountId comes from the authorize response — env values here have
    // proven error-prone (key ids look like account ids).
    body: JSON.stringify({
      accountId: auth.accountId,
      bucketName,
    }),
    cache: "no-store",
  });
  if (!res.ok)
    throw new Error(
      `b2_list_buckets failed: ${res.status} ${await res.text()}`,
    );
  const data = (await res.json()) as {
    buckets: { bucketId: string; bucketName: string }[];
  };
  const bucket = data.buckets.find((b) => b.bucketName === bucketName);
  if (!bucket) throw new Error(`B2 bucket not found: ${bucketName}`);
  auth.bucketIds.set(bucketName, bucket.bucketId);
  return bucket.bucketId;
}

export type SignedUrlOptions = {
  /** 10–60 minutes per the archive rules; default 10. */
  validSeconds?: number;
  /** e.g. `attachment; filename="x.xml"` — forces a save dialog. */
  contentDisposition?: string;
};

// Time-limited signed URL for one object, served directly by B2.
export async function getSignedDownloadUrl(
  bucketName: string,
  objectKey: string,
  { validSeconds = 600, contentDisposition }: SignedUrlOptions = {},
): Promise<string> {
  let auth = await authorize();

  const mint = async (a: B2Auth) => {
    const body: Record<string, unknown> = {
      bucketId: await bucketId(a, bucketName),
      fileNamePrefix: objectKey,
      validDurationInSeconds: Math.min(Math.max(validSeconds, 60), 3600),
    };
    if (contentDisposition) body.b2ContentDisposition = contentDisposition;
    return fetch(`${a.apiUrl}/b2api/v3/b2_get_download_authorization`, {
      method: "POST",
      headers: { Authorization: a.token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  };

  let res = await mint(auth);
  if (res.status === 401) {
    auth = await authorize(true);
    res = await mint(auth);
  }
  if (!res.ok)
    throw new Error(`b2_get_download_authorization failed: ${res.status}`);
  const data = (await res.json()) as { authorizationToken: string };

  const path = objectKey.split("/").map(encodeURIComponent).join("/");
  const params = new URLSearchParams({ Authorization: data.authorizationToken });
  if (contentDisposition)
    params.set("b2ContentDisposition", contentDisposition);
  return `${auth.downloadUrl}/file/${encodeURIComponent(bucketName)}/${path}?${params}`;
}
