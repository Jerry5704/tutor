ALTER TABLE "LearningObjective"
ADD COLUMN "title" TEXT,
ADD COLUMN "order" INTEGER,
ADD COLUMN "diagnosticPrompt" TEXT,
ADD COLUMN "transferPrompt" TEXT;

UPDATE "LearningObjective" SET
  "title" = CASE "code"
    WHEN 'natural_selection' THEN 'Dobór naturalny'
    WHEN 'allele_frequency' THEN 'Częstość alleli w populacji'
    WHEN 'genetic_drift' THEN 'Dryf genetyczny'
    WHEN 'founder_effect' THEN 'Efekt założyciela'
    WHEN 'speciation' THEN 'Powstawanie gatunków'
    ELSE "code"
  END,
  "order" = CASE "code"
    WHEN 'natural_selection' THEN 1
    WHEN 'allele_frequency' THEN 2
    WHEN 'genetic_drift' THEN 3
    WHEN 'founder_effect' THEN 4
    WHEN 'speciation' THEN 5
    ELSE 100
  END,
  "diagnosticPrompt" = CASE "code"
    WHEN 'natural_selection' THEN 'Wyjaśnij własnymi słowami, jak dobór naturalny może sprawić, że dziedziczna cecha staje się częstsza w populacji.'
    WHEN 'allele_frequency' THEN 'Co oznacza, że częstość określonego allelu w populacji wzrosła z pokolenia na pokolenie?'
    WHEN 'genetic_drift' THEN 'Dlaczego częstość allelu może zmienić się losowo, szczególnie w małej populacji?'
    WHEN 'founder_effect' THEN 'Niewielka grupa osobników zakłada nową, odizolowaną populację. Jak może to wpłynąć na częstości alleli?'
    WHEN 'speciation' THEN 'Co musi wydarzyć się między dwiema populacjami jednego gatunku, aby z czasem mogły powstać dwa gatunki?'
    ELSE "description"
  END,
  "transferPrompt" = CASE "code"
    WHEN 'natural_selection' THEN 'W populacji bakterii niektóre osobniki mają dziedziczną odporność na antybiotyk. Wyjaśnij mechanizm, przez który odporność może stać się częstsza po wielu pokoleniach.'
    WHEN 'allele_frequency' THEN 'Częstość allelu A wzrosła w populacji z 20% do 35%. Co zmieniło się w populacji, a czego ten wynik nie mówi o pojedynczym osobniku?'
    WHEN 'genetic_drift' THEN 'Przypadkowa powódź zabija połowę małej populacji niezależnie od cech osobników. Wyjaśnij, dlaczego częstości alleli po powodzi mogą być inne.'
    WHEN 'founder_effect' THEN 'Pięć ptaków zasiedla wyspę i tworzy nową populację. Dlaczego jej pula alleli może różnić się od populacji wyjściowej, mimo braku przewagi adaptacyjnej?'
    WHEN 'speciation' THEN 'Rzeka rozdziela jedną populację na dwie. Wyjaśnij, dlaczego samo rozdzielenie nie wystarcza jeszcze do powstania dwóch gatunków i co musi wydarzyć się później.'
    ELSE "description"
  END;

ALTER TABLE "LearningObjective"
ALTER COLUMN "title" SET NOT NULL,
ALTER COLUMN "order" SET NOT NULL,
ALTER COLUMN "diagnosticPrompt" SET NOT NULL,
ALTER COLUMN "transferPrompt" SET NOT NULL;

CREATE UNIQUE INDEX "LearningObjective_topicId_order_key" ON "LearningObjective"("topicId", "order");
