import test from "node:test";
import assert from "node:assert/strict";
import {
  mayReadMedia,
  cardMediaReference,
  responseMediaReference,
} from "../src/lib/media-access-policy.js";
import {
  redactPrivateCardPreview,
  redactPrivateResponsePreview,
} from "../src/lib/admin-private-preview.js";

const card = { ownerId: "owner", isPrivate: false, isBlocked: false, needsReview: false };

test("public, private, blocked and pending card media follow content visibility", () => {
  assert.equal(mayReadMedia([cardMediaReference(card)]), true);
  for (const flag of ["isPrivate", "isBlocked", "needsReview"]) {
    const refs = [cardMediaReference({ ...card, [flag]: true })];
    assert.equal(mayReadMedia(refs), false);
    assert.equal(mayReadMedia(refs, "stranger"), false);
    assert.equal(mayReadMedia(refs, "owner"), true);
  }
  assert.equal(mayReadMedia([]), false);
});

test("adding a public reference cannot expose a private shared file", () => {
  const refs = [
    cardMediaReference(card),
    cardMediaReference({ ...card, ownerId: "other", isPrivate: true }),
  ];
  assert.equal(mayReadMedia(refs), false);
  assert.equal(mayReadMedia(refs, "owner"), false);
});

test("response audio requires approved content, approved voice and visible parent", () => {
  const response = {
    homeCard: card,
    responderId: "speaker",
    isBlocked: false,
    moderationStatus: "APPROVED",
    voiceModerationStatus: "APPROVED",
  };
  assert.equal(mayReadMedia([responseMediaReference(response)]), true);
  for (const change of [
    { homeCard: { ...card, isPrivate: true } },
    { isBlocked: true },
    { moderationStatus: "PENDING" },
    { voiceModerationStatus: "REJECTED" },
    { homeCard: null },
  ]) {
    assert.equal(mayReadMedia([responseMediaReference({ ...response, ...change })]), false);
  }
});

test("private previews omit content and identifiers rather than hiding them with CSS", () => {
  const secret = "PRIVATE-CONTENT-MARKER";
  const preview = redactPrivateCardPreview({
    ...card,
    id: 1,
    isPrivate: true,
    description: secret,
    title: secret,
    image: secret,
    meta: [secret],
    owner: { email: secret },
    ipHash: secret,
  });
  assert.equal(JSON.stringify(preview).includes(secret), false);
  const response = redactPrivateResponsePreview({
    id: "r",
    message: secret,
    voiceUrl: secret,
    responder: { email: secret },
    homeCard: { id: 1, isPrivate: true, title: secret },
  });
  assert.equal(JSON.stringify(response).includes(secret), false);
});
