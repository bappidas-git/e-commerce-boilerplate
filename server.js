// =============================================================================
// Development mock backend — JSON Server with a SAFE, non-cascading DELETE
// =============================================================================
//
// This replaces the bare `json-server --watch db.json --port 3001` command.
// Everything json-server normally does (GET/POST/PUT/PATCH, filtering, sorting,
// pagination, relationships, /db, static ./public) is preserved — only the
// DELETE handler is made safe.
//
// WHY THIS EXISTS
// ---------------
// json-server's stock DELETE handler (lib/server/router/plural.js -> destroy)
// runs, in order:
//   1. db.get(name).removeById(id)            // drops the row from MEMORY
//   2. db._.getRemovable(db.getState(), opts) // "dependent" cascade scan
// Step 2 walks EVERY foreign-key field (anything ending in `Id`) across the
// WHOLE database and calls lodash-id.getById(value), which executes
// `value.toString()`. Seed/generated rows legitimately carry NULL foreign keys
// (e.g. refunds.returnId, refunds.paymentId, reviews.userId,
// walletTransactions.refundId), so `null.toString()` throws:
//     TypeError: Cannot read properties of null (reading 'toString')
// -> the DELETE returns HTTP 500.
//
// Worse, because step 1 already removed the row from memory but the thrown
// error short-circuits before json-server's write middleware runs, the
// in-memory store and db.json DESYNC: the row is gone from memory yet still on
// disk. The very next GET/PUT/PATCH for that id then returns HTTP 404. That is
// exactly the "delete -> 500, then edit -> 404" pair seen in the admin
// Categories module (and it affected deletes everywhere, not just categories).
//
// We also never want deleting a category to silently cascade-delete the
// products that reference it — referential integrity is enforced in the API
// layer (block the delete while children/products still point at the category).
//
// FIX
// ---
//   * Override DELETE /:resource/:id with a handler that removes ONLY the
//     addressed row (id matched type-tolerantly by lodash-id) and persists,
//     with no cross-collection cascade.
//   * As defense-in-depth, neutralise getRemovable() so no code path can ever
//     hit the null.toString() crash again.
// =============================================================================

const path = require("path");
const jsonServer = require("json-server");

const DB_FILE = process.env.JSON_SERVER_DB
  ? path.resolve(process.env.JSON_SERVER_DB)
  : path.join(__dirname, "db.json");
const PORT = process.env.JSON_SERVER_PORT || 3001;

const server = jsonServer.create();
const router = jsonServer.router(DB_FILE);
const middlewares = jsonServer.defaults();

// lowdb instance with json-server's lodash-id + helper mixins attached.
const db = router.db;

server.use(middlewares);

// --- Defense in depth: disable json-server's dependent-delete cascade --------
// getRemovable() is the function that crashes on null foreign keys (and would
// otherwise silently delete dependent rows). Our explicit DELETE route below
// fully supersedes it for known collections; this no-op also covers any
// fall-through path (e.g. a DELETE on an unknown collection) so the crash can
// never recur.
if (db && db._ && typeof db._.mixin === "function") {
  db._.mixin({ getRemovable: () => [] }, { chain: false });
}

// --- Safe, non-cascading DELETE /:resource/:id -------------------------------
// Mirrors json-server's own primitives (db.get(name).removeById(id)) but
// WITHOUT the whole-database getRemovable scan, and writes through to db.json
// so memory and disk stay in sync. Unknown collections fall through to
// json-server (which will 404 them).
server.delete("/:resource/:id", (req, res, next) => {
  try {
    const { resource, id } = req.params;

    // Only handle real top-level collections; let json-server deal with the rest.
    if (!Array.isArray(db.get(resource).value())) return next();

    // lodash-id getById/removeById compare ids as strings, so this matches
    // whether the stored id is a number (16) or a string ("16").
    const existing = db.get(resource).getById(id).value();
    if (!existing) return res.status(404).jsonp({});

    db.get(resource).removeById(id).value();
    db.write(); // persist to db.json (synchronous FileSync adapter)

    return res.status(200).jsonp({});
  } catch (err) {
    return next(err);
  }
});

// All other routes keep json-server's default behaviour.
server.use(router);

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`\n  JSON Server (safe-delete) is running on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`  Database: ${DB_FILE}\n`);
});
