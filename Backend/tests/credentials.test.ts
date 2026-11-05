import { describe, it, expect, vi } from "vitest";
import { ObjectId } from "mongodb";
import {
  findCredentialAccount,
  hashPassword,
  verifyPassword,
} from "../src/auth/credentials.js";

function fakeDb(findOne: (query: any) => any) {
  return () => ({
    collection: (name: string) => {
      if (name !== "account") throw new Error(`unexpected collection ${name}`);
      return { findOne: (query: any) => Promise.resolve(findOne(query)) };
    },
  });
}

describe("credential password helpers", () => {
  it("hashes with bcrypt and verifies correct/incorrect passwords", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct horse battery staple");
    expect(hash.startsWith("$2")).toBe(true);
    await expect(verifyPassword(hash, "correct horse battery staple")).resolves.toBe(true);
    await expect(verifyPassword(hash, "wrong password")).resolves.toBe(false);
  });
});

describe("findCredentialAccount", () => {
  it("looks up the credential account by userId", async () => {
    const doc = { userId: "u1", providerId: "credential", password: "hash" };
    const findOne = vi.fn((query: any) =>
      query.userId === "u1" && query.providerId === "credential" ? doc : null,
    );
    await expect(findCredentialAccount(fakeDb(findOne), "u1")).resolves.toBe(doc);
    expect(findOne).toHaveBeenCalledWith({ userId: "u1", providerId: "credential" });
  });

  it("falls back to an ObjectId userId for legacy documents", async () => {
    const id = "0123456789abcdef01234567";
    const doc = { userId: new ObjectId(id), providerId: "credential", password: "hash" };
    const findOne = vi.fn((query: any) =>
      query.userId instanceof ObjectId && query.userId.toHexString() === id ? doc : null,
    );
    await expect(findCredentialAccount(fakeDb(findOne), id)).resolves.toBe(doc);
    expect(findOne).toHaveBeenCalledTimes(2);
  });

  it("returns null when there is no credential account", async () => {
    await expect(
      findCredentialAccount(fakeDb(() => null), "u1"),
    ).resolves.toBeNull();
  });

  it("returns null when the auth database is unavailable", async () => {
    await expect(findCredentialAccount(undefined, "u1")).resolves.toBeNull();
  });
});
