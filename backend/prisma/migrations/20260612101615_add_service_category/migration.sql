-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "durationMin" INTEGER NOT NULL,
    "price" INTEGER NOT NULL
);
INSERT INTO "new_Service" ("durationMin", "id", "name", "price") SELECT "durationMin", "id", "name", "price" FROM "Service";
DROP TABLE "Service";
ALTER TABLE "new_Service" RENAME TO "Service";
CREATE UNIQUE INDEX "Service_name_key" ON "Service"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
