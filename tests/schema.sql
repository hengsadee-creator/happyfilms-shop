CREATE TABLE hf_ai_usage (day TEXT PRIMARY KEY,calls INTEGER NOT NULL DEFAULT 0);

CREATE TABLE hf_auto_audit (id INTEGER PRIMARY KEY, action TEXT NOT NULL, order_id TEXT, created INTEGER NOT NULL);

CREATE TABLE hf_auto_metrics (day TEXT NOT NULL,event TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,event));

CREATE TABLE hf_auto_ops (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated INTEGER NOT NULL);

CREATE TABLE hf_auto_orders (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, request_key TEXT NOT NULL UNIQUE,
 product_id TEXT NOT NULL, variant_id TEXT NOT NULL, name TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 10), amount INTEGER NOT NULL CHECK(amount>0),
 status TEXT NOT NULL DEFAULT 'pending', created INTEGER NOT NULL, expires INTEGER NOT NULL,
 method TEXT, charge_id TEXT UNIQUE, checkout TEXT, error TEXT
);

CREATE TABLE hf_auto_payments (
 provider TEXT NOT NULL, reference TEXT NOT NULL, order_id TEXT NOT NULL UNIQUE REFERENCES hf_auto_orders(id), amount INTEGER NOT NULL,
 PRIMARY KEY(provider,reference)
);

CREATE TABLE hf_auto_rate (key TEXT NOT NULL, window INTEGER NOT NULL, attempts INTEGER NOT NULL, PRIMARY KEY(key,window));

CREATE TABLE hf_auto_stock (
 id TEXT PRIMARY KEY, product_id TEXT NOT NULL, variant_id TEXT NOT NULL,
 ciphertext TEXT NOT NULL, fingerprint TEXT NOT NULL UNIQUE, order_id TEXT REFERENCES hf_auto_orders(id), created INTEGER NOT NULL
);

CREATE TABLE kv (store TEXT NOT NULL, key TEXT NOT NULL, value TEXT, blob BLOB, content_type TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(store,key));

CREATE TRIGGER hf_auto_payment_deliver AFTER INSERT ON hf_auto_payments BEGIN
 UPDATE hf_auto_orders SET status='paid',error=NULL WHERE id=NEW.order_id;
 INSERT INTO hf_auto_audit(action,order_id,created) VALUES('payment_verified',NEW.order_id,unixepoch()*1000);
END;

CREATE TRIGGER hf_auto_payment_validate BEFORE INSERT ON hf_auto_payments BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM hf_auto_orders WHERE id=NEW.order_id AND amount=NEW.amount AND status='pending') THEN RAISE(ABORT,'INVALID_PAYMENT') END;
 SELECT CASE WHEN (SELECT COUNT(*) FROM hf_auto_stock WHERE order_id=NEW.order_id) != (SELECT quantity FROM hf_auto_orders WHERE id=NEW.order_id) THEN RAISE(ABORT,'STOCK_MISMATCH') END;
END;

CREATE TRIGGER hf_auto_reserve AFTER INSERT ON hf_auto_orders BEGIN
 SELECT CASE WHEN (SELECT COUNT(*) FROM hf_auto_stock WHERE product_id=NEW.product_id AND variant_id=NEW.variant_id AND order_id IS NULL)<NEW.quantity THEN RAISE(ABORT,'OUT_OF_STOCK') END;
 UPDATE hf_auto_stock SET order_id=NEW.id WHERE id IN (SELECT id FROM hf_auto_stock WHERE product_id=NEW.product_id AND variant_id=NEW.variant_id AND order_id IS NULL LIMIT NEW.quantity);
END;
