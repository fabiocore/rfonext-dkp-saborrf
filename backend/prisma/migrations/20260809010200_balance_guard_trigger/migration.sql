-- Trava de segurança em nível de banco: nenhuma transação de ledger pode deixar
-- o saldo (SUM(amount)) de um personagem negativo. A aplicação já valida isso
-- antes de inserir, mas esta trigger é o backstop final contra bugs/race conditions.
-- Ver PREMISSAS.md seção 4.

CREATE OR REPLACE FUNCTION check_character_balance_non_negative()
RETURNS TRIGGER AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  SELECT COALESCE(SUM("amount"), 0) INTO current_balance
  FROM "LedgerTransaction"
  WHERE "characterId" = NEW."characterId";

  IF current_balance < 0 THEN
    RAISE EXCEPTION 'Saldo do personagem % ficaria negativo (%) com esta transação', NEW."characterId", current_balance;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_character_balance_non_negative ON "LedgerTransaction";

CREATE TRIGGER trg_check_character_balance_non_negative
AFTER INSERT ON "LedgerTransaction"
FOR EACH ROW
EXECUTE FUNCTION check_character_balance_non_negative();
