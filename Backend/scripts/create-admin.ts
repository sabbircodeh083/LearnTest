import {
  connectDatabase,
  closeDatabase,
  getMongoDb,
} from "../src/config/database.js";
import { Profile } from "../src/models/index.js";
// One-time admin bootstrap. Usage: ADMIN_EMAIL=you@example.com npx tsx scripts/create-admin.ts
// The user must already exist (signed up + verified). There is intentionally NO public endpoint for this.
async function main() {
  const email = process.env.ADMIN_EMAIL;
  if (!email)
    throw new Error("Set ADMIN_EMAIL to an existing verified user's email");
  await connectDatabase();
  // Role lives only in the `user` collection; the profile keeps no role.
  const profile = await Profile.findOneAndUpdate(
    { email },
    { $set: { roleSelected: true }, $unset: { role: "" } },
    { returnDocument: "after" },
  );
  if (!profile)
    throw new Error(
      "No profile for that email — sign up and verify first, then re-run",
    );
  await getMongoDb()
    .collection("user")
    .updateOne({ email }, { $set: { role: "admin", roleSelected: true } });
  console.log(
    `Admin granted to ${email} (profile ${profile.userId}). Audit this action externally.`,
  );
  await closeDatabase();
}
main().catch(async (e) => {
  console.error((e as Error).message);
  await closeDatabase();
  process.exit(1);
});
