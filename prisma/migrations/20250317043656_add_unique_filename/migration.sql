/*
  Warnings:

  - A unique constraint covering the columns `[filename]` on the table `Resource` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `Resource_filename_key` ON `Resource`(`filename`);
