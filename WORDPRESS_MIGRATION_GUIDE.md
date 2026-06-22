# WordPress Site Migration Guide

This document explains how to deploy an existing WordPress website on a **new server**
using two artifacts that have already been provided to you:

1. **`public_html/`** — a full copy of the WordPress files (WordPress core, themes, plugins, and `wp-content/uploads`).
2. **A database dump** — a `.sql` (or `.sql.gz` / `.zip`) file containing the entire site database.

Follow the steps in order. Where you must substitute a real value, it is written like `<this>`.

---

## 0. Before you start — what you'll need

Make sure the destination server has:

- **PHP** (8.0+ recommended; match the version the site originally ran on if known)
- **MySQL 5.7+ or MariaDB 10.3+**
- A **web server** (Apache or Nginx)
- **WP-CLI** installed (optional but strongly recommended): https://wp-cli.org
- Shell/SSH access and the ability to create a database + user
- The site's intended **domain name** (or a temporary one for testing)

Collect these details and keep them handy:

| Item | Value |
|------|-------|
| New domain / URL | `https://<new-domain>` |
| Old domain / URL | `https://<old-domain>` |
| Web root path | e.g. `/var/www/html` |
| DB name | `<db_name>` |
| DB user | `<db_user>` |
| DB password | `<db_password>` |
| DB host | usually `localhost` |

---

## 1. Upload the WordPress files

1. Copy the contents of the provided `public_html/` folder into the new server's web root.

   ```bash
   # Example: upload an archive, then extract into the web root
   scp public_html.tar.gz user@<server>:/tmp/
   ssh user@<server>
   sudo tar -xzf /tmp/public_html.tar.gz -C /var/www/html --strip-components=1
   ```

   > Make sure files land **directly** in the web root (you should see `wp-config.php`,
   > `wp-content/`, `wp-admin/`, `wp-includes/` at the top level — not nested inside an
   > extra `public_html/` directory).

2. Set correct ownership and permissions (adjust the web user — `www-data` on Debian/Ubuntu, `apache`/`nginx` on RHEL):

   ```bash
   sudo chown -R www-data:www-data /var/www/html
   sudo find /var/www/html -type d -exec chmod 755 {} \;
   sudo find /var/www/html -type f -exec chmod 644 {} \;
   ```

---

## 2. Create the database and import the dump

1. Log in to MySQL/MariaDB and create a fresh database + user:

   ```sql
   CREATE DATABASE <db_name> CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER '<db_user>'@'localhost' IDENTIFIED BY '<db_password>';
   GRANT ALL PRIVILEGES ON <db_name>.* TO '<db_user>'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```

2. Import the provided dump file:

   ```bash
   # If it's a plain .sql file:
   mysql -u <db_user> -p <db_name> < database-dump.sql

   # If it's gzipped (.sql.gz):
   gunzip < database-dump.sql.gz | mysql -u <db_user> -p <db_name>
   ```

   > If the import fails on character set or `DEFINER` errors, open the `.sql` file and
   > remove/replace any `DEFINER=...` clauses, or import via phpMyAdmin instead.

---

## 3. Update `wp-config.php`

Edit `wp-config.php` in the web root and make sure the database settings match what you
created in Step 2:

```php
define( 'DB_NAME',     '<db_name>' );
define( 'DB_USER',     '<db_user>' );
define( 'DB_PASSWORD', '<db_password>' );
define( 'DB_HOST',     'localhost' );
```

Also note the **table prefix** near the bottom of the file — leave it as-is, it must match
the imported database:

```php
$table_prefix = 'wp_';   // (may differ — do NOT change it to match the dump)
```

**Security recommendation:** regenerate the authentication salts/keys using
https://api.wordpress.org/secret-key/1.1/salt/ and paste them over the existing
`AUTH_KEY` … `NONCE_SALT` block. (This logs everyone out but is safer on a new server.)

---

## 4. Update the site URL (handle the domain change)

The database stores the old domain in many places. You must update it to the new domain,
including inside serialized data (which a plain find/replace will corrupt). **Use WP-CLI**
— it handles serialized data safely:

```bash
cd /var/www/html

wp search-replace 'https://<old-domain>' 'https://<new-domain>' --all-tables --skip-columns=guid

# Verify the two core options were updated:
wp option get siteurl
wp option get home
```

If WP-CLI is **not** available, use the
[Better Search Replace](https://wordpress.org/plugins/better-search-replace/) plugin after
you can log in, or temporarily set the URLs by adding these lines to `wp-config.php`:

```php
define( 'WP_HOME',    'https://<new-domain>' );
define( 'WP_SITEURL', 'https://<new-domain>' );
```

> Don't forget protocol differences: if the old site was `http://` and the new one is
> `https://`, run the replace for that variant too.

---

## 5. Configure the web server

### Apache
Ensure `mod_rewrite` is enabled and `AllowOverride All` is set for the web root so the
existing `.htaccess` (permalinks) works:

```bash
sudo a2enmod rewrite
sudo systemctl restart apache2
```

### Nginx
There is no `.htaccess`; add a permalink rewrite block to your server config:

```nginx
location / {
    try_files $uri $uri/ /index.php?$args;
}

location ~ \.php$ {
    include snippets/fastcgi-php.conf;
    fastcgi_pass unix:/run/php/php8.2-fpm.sock;  # match your PHP-FPM socket
}
```

Reload after editing: `sudo systemctl reload nginx`.

---

## 6. SSL / HTTPS

Issue a certificate for the new domain (free via Let's Encrypt):

```bash
sudo certbot --apache    # or: sudo certbot --nginx
```

If you are serving the site over HTTPS, make sure the site URLs in Step 4 use `https://`.

---

## 7. Verify the site

Work through this checklist:

- [ ] Home page loads at `https://<new-domain>` with correct styling (CSS/images load).
- [ ] You can log in at `https://<new-domain>/wp-admin`.
- [ ] Go to **Settings → Permalinks** and click **Save** once (rebuilds rewrite rules).
- [ ] Internal links, menus, and images point to the new domain.
- [ ] If it's an e-commerce site, test product pages, cart, and checkout in test mode.
- [ ] Check **Tools → Site Health** for warnings (PHP version, missing extensions, etc.).

---

## 8. Post-migration cleanup

- Update payment gateways, SMTP/email, and any API keys that were tied to the old domain.
- Update DNS to point the new domain to this server (A/AAAA record → server IP).
- Re-test from an incognito window after DNS propagates.
- Flush caches (server cache, any caching plugin like WP Super Cache / W3 Total Cache /
  LiteSpeed) and your CDN if one is used.
- Set up backups (files + database) on the new server.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| **White screen / 500 error** | PHP version mismatch or missing PHP extensions. Enable error display temporarily: `define('WP_DEBUG', true);` in `wp-config.php`. Check the web server error log. |
| **"Error establishing a database connection"** | Wrong DB credentials/host in `wp-config.php`, or DB not imported. Re-check Step 2 & 3. |
| **Site loads but no styling / broken links** | Old domain still in the database. Re-run the search-replace in Step 4. |
| **Redirect loop** | Mismatch between `siteurl`/`home` and actual protocol, or a caching plugin. Clear cache; verify HTTPS settings. |
| **Login redirects back to login** | Stale cookies/salts. Regenerate salts (Step 3) and clear browser cookies. |
| **Permalinks give 404** | `mod_rewrite`/`.htaccess` not active (Apache) or rewrite block missing (Nginx). See Step 5, then re-save Permalinks. |
| **Images missing** | `wp-content/uploads` wasn't included in the file copy, or wrong permissions. |

---

## Quick reference — full sequence

```bash
# 1. Files
sudo tar -xzf public_html.tar.gz -C /var/www/html --strip-components=1
sudo chown -R www-data:www-data /var/www/html

# 2. Database
mysql -u root -p -e "CREATE DATABASE <db_name> CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u <db_user> -p <db_name> < database-dump.sql

# 3. Edit wp-config.php with DB_NAME / DB_USER / DB_PASSWORD / DB_HOST

# 4. Fix URLs
cd /var/www/html
wp search-replace 'https://<old-domain>' 'https://<new-domain>' --all-tables --skip-columns=guid

# 5. Restart web server, then visit the site and re-save Permalinks.
```

---

*Hand this file, the `public_html` backup, and the database dump to the developer together.
Replace every `<placeholder>` with the real values for the destination environment.*
