import assert from "node:assert/strict";
import test from "node:test";

import { builderApi } from "../../../src/shared/api/builderApi";
import { http } from "../../../src/shared/api/http";
import type {
  DownloadUrlResponse,
  EvidenceArtifactDto,
} from "../../../src/shared/types";

test("builderApi.listEvidenceArtifacts consulta el endpoint de evidencias", async () => {
  const artifact: EvidenceArtifactDto = {
    id: "artifact-1",
    type: "BUILD_LOG",
    contentType: "text/plain",
    sizeBytes: 128,
    createdAt: "2026-05-08T18:00:00.000Z",
  };
  const calls: string[] = [];
  const originalGet = http.get;

  http.get = (async (url: string) => {
    calls.push(url);
    return { data: [artifact] };
  }) as typeof http.get;

  try {
    const result = await builderApi.listEvidenceArtifacts("run-1");
    assert.deepEqual(result, [artifact]);
    assert.deepEqual(calls, ["/builder/runs/run-1/evidence"]);
  } finally {
    http.get = originalGet;
  }
});

test("builderApi.getEvidenceDownloadUrl consulta la URL firmada del artefacto", async () => {
  const response: DownloadUrlResponse = {
    downloadUrl: "https://example.test/download",
    expiresAt: "2026-05-08T19:00:00.000Z",
  };
  const calls: string[] = [];
  const originalGet = http.get;

  http.get = (async (url: string) => {
    calls.push(url);
    return { data: response };
  }) as typeof http.get;

  try {
    const result = await builderApi.getEvidenceDownloadUrl("run-1", "artifact-9");
    assert.deepEqual(result, response);
    assert.deepEqual(calls, [
      "/builder/runs/run-1/evidence/artifact-9/download-url",
    ]);
  } finally {
    http.get = originalGet;
  }
});
