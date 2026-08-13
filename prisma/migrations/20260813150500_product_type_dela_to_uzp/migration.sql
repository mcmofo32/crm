-- Producttype "Dela" bestaat niet meer (Dela is de maatschappij, geen
-- product) en is vervangen door "NZP" en "UZP". Bestaande klanten met het
-- Dela-product worden overgezet naar UZP.
UPDATE "LeadProduct" SET "type" = 'UZP' WHERE "type" = 'DELA';
