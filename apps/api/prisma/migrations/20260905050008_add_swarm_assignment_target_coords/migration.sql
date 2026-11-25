/*
  Warnings:

  - Added the required column `target_lat` to the `swarm_assignments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `target_lng` to the `swarm_assignments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "swarm_assignments" ADD COLUMN     "target_lat" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "target_lng" DOUBLE PRECISION NOT NULL;
