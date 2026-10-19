-- Global, non-cycling sequence for newly issued CLEAR official receipt numbers.
-- Historical Collection.orNumber values remain unchanged.
-- PostgreSQL sequences intentionally do not roll back consumed values.
CREATE SEQUENCE IF NOT EXISTS clear_receipt_sequence
  AS bigint
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;
