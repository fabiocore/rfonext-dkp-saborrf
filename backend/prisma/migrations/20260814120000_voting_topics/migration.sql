-- CreateEnum
CREATE TYPE "VotingSelectionType" AS ENUM ('SINGLE', 'MULTIPLE');

-- CreateEnum
CREATE TYPE "VotingTopicStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "VotingTopic" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "selectionType" "VotingSelectionType" NOT NULL,
    "status" "VotingTopicStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledEndAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closeReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VotingTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VotingOption" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VotingOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "message" TEXT,
    "messageHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoteSelection" (
    "id" TEXT NOT NULL,
    "voteId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "VoteSelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vote_topicId_characterId_key" ON "Vote"("topicId", "characterId");

-- CreateIndex
CREATE UNIQUE INDEX "VoteSelection_voteId_optionId_key" ON "VoteSelection"("voteId", "optionId");

-- AddForeignKey
ALTER TABLE "VotingOption" ADD CONSTRAINT "VotingOption_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "VotingTopic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "VotingTopic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteSelection" ADD CONSTRAINT "VoteSelection_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "Vote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteSelection" ADD CONSTRAINT "VoteSelection_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "VotingOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

