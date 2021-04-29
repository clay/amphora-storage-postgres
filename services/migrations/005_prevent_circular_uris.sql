ALTER TABLE uris ADD CONSTRAINT id_ne_data CHECK (id <> data);
