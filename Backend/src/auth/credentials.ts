import bcrypt from "bcrypt";
import { ObjectId } from "mongodb";

// Better Auth is configured to hash with bcrypt; keep hashing and verification
// in one place so the account-deletion check can never drift from sign-in.
const BCRYPT_ROUNDS = 12;

export const hashPassword = (password: string) =>
  bcrypt.hash(password, BCRYPT_ROUNDS);

export const verifyPassword = (hash: string, password: string) =>
  bcrypt.compare(password, hash);

const HEX24 = /^[0-9a-fA-F]{24}$/;

/** Credential (email/password) account linked to a Better Auth user.
 *  Better Auth stores users in `user` and passwords in `account`, related by
 *  `account.userId === user.id`. */
export async function findCredentialAccount(
  authDb: (() => any) | undefined,
  userId: string,
): Promise<any | null> {
  const col = authDb?.()?.collection("account");
  if (!col) return null;

  const lookup = (id: any) =>
    col.findOne({ userId: id, providerId: "credential" }).catch(() => null);

  const byId = await lookup(userId);
  if (byId) return byId;

  // The mongodb adapter keys by `id`, but older/imported documents may store
  // an ObjectId; mirror the fallback used elsewhere in this codebase.
  if (HEX24.test(userId)) {
    const byObjectId = await lookup(new ObjectId(userId));
    if (byObjectId) return byObjectId;
  }
  return null;
}
