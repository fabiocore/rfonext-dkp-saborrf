-- RenameEnum
ALTER TYPE "ActivityEmissionMode" RENAME TO "ActivityRecurrencePeriod";

-- RenameEnumValue (RISING_EDGE existentes viram WEEKLY, comportamento preservado)
ALTER TYPE "ActivityRecurrencePeriod" RENAME VALUE 'RISING_EDGE' TO 'WEEKLY';

-- AddEnumValue
ALTER TYPE "ActivityRecurrencePeriod" ADD VALUE 'MONTHLY';

-- RenameColumn
ALTER TABLE "Activity" RENAME COLUMN "emissionMode" TO "recurrencePeriod";

-- AddColumn
ALTER TABLE "Activity" ADD COLUMN     "maxOccurrencesPerPeriod" INTEGER NOT NULL DEFAULT 1;
