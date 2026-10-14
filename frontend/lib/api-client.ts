export class ServiceError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
export async function api(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<any> {
  const form = body instanceof FormData;
  const r = await fetch("/api/study/" + path, {
    method,
    credentials: "same-origin",
    headers: {
      ...(method !== "GET" ? { "X-StudyMate-Request": "1" } : {}),
      ...(!form && body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body: body === undefined ? undefined : form ? body : JSON.stringify(body),
  });
  let data: any;
  try {
    data = await r.json();
  } catch {
    throw new Error(
      "The service returned an unreadable response. Please retry.",
    );
  }
  if (r.status === 401 && data.code === "unauthenticated") {
    window.dispatchEvent(new Event("studymate:session-expired"));
  }
  if (!r.ok)
    throw new ServiceError(
      data.error || "Request failed",
      data.code || "error",
      r.status,
    );
  return data;
}
