import { connectDatabase, closeDatabase } from "../src/config/database.js";
import { Video, Exam } from "../src/models/index.js";
// Dev-only seed with clearly fake data. No real users/passwords. Content is owned by placeholder dev IDs.
async function main() {
  await connectDatabase();
  const ownerId = "dev-teacher-placeholder";
  await Video.updateOne(
    { title: "Dev Seed: Intro Video" },
    {
      $setOnInsert: {
        ownerId,
        title: "Dev Seed: Intro Video",
        description: "Seed data",
        sourceType: "youtube",
        youtubeId: "dQw4w9WgXcQ",
        status: "published",
        visibility: "public",
        price: 0,
        currency: "USD",
        tags: ["seed"],
      },
    },
    { upsert: true },
  );
  await Exam.updateOne(
    { title: "Dev Seed: Sample Exam" },
    {
      $setOnInsert: {
        ownerId,
        title: "Dev Seed: Sample Exam",
        status: "published",
        visibility: "public",
        durationMinutes: 30,
        price: 500,
        currency: "USD",
        questionIds: [],
      },
    },
    { upsert: true },
  );
  console.log("Seed complete (fake dev content only)");
  await closeDatabase();
}
main().catch(async (e) => {
  console.error(e.message);
  await closeDatabase();
  process.exit(1);
});
