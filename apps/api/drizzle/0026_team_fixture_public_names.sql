-- Team accounts need the public identity of their match opponent, but must not
-- gain direct access to another delegation's private registration row.
GRANT SELECT ON "v_public_nation" TO gameday_app;
