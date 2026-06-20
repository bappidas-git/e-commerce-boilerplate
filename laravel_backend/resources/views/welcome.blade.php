<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Welcome | E-Commerce Boilerplate</title>
    <style>
        :root {
            font-family: Inter, "Segoe UI", Roboto, sans-serif;
            color-scheme: light;
            background: #f5f7fb;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            background:
                radial-gradient(circle at top, rgba(37, 99, 235, 0.08), transparent 18%),
                #f5f7fb;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px 16px;
        }

        .card {
            width: min(1120px, 100%);
            background: #fff;
            border-radius: 18px;
            box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
            overflow: hidden;
            display: grid;
            grid-template-columns: 1.15fr 0.85fr;
        }

        .content {
            padding: 48px;
        }

        .badge {
            display: inline-block;
            margin-bottom: 18px;
            padding: 6px 12px;
            background: #eef4ff;
            color: #1d4ed8;
            font-size: 0.85rem;
            font-weight: 700;
            border-radius: 999px;
        }

        h1 {
            margin: 0 0 12px;
            font-size: 3rem;
            line-height: 1;
            color: #0f172a;
        }

        p {
            margin: 0;
            color: #475569;
            font-size: 1rem;
            line-height: 1.7;
        }

        .intro {
            max-width: 62ch;
        }

        .feature-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
            margin-top: 28px;
        }

        .feature {
            padding: 14px 16px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
        }

        .feature strong {
            display: block;
            color: #0f172a;
            margin-bottom: 6px;
        }

        .actions {
            display: flex;
            gap: 12px;
            margin-top: 24px;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            padding: 12px 18px;
            border-radius: 10px;
            font-weight: 700;
        }

        .btn-primary {
            background: #2563eb;
            color: #fff;
        }

        .btn-secondary {
            background: #eef2ff;
            color: #1e3a8a;
        }

        .panel {
            background: linear-gradient(180deg, #0f172a 0%, #111827 100%);
            color: #fff;
            padding: 48px 32px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 14px;
        }

        .panel h2 {
            margin: 0;
            font-size: 1.5rem;
        }

        .stat {
            padding: 12px 0;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            font-size: 0.95rem;
        }

        @media (max-width: 768px) {
            .card {
                grid-template-columns: 1fr;
            }

            .content {
                padding: 32px 24px;
            }

            h1 {
                font-size: 2.3rem;
            }

            .feature-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <main class="card">
        <section class="content">
            <span class="badge">Laravel + React Commerce Backend</span>
            <h1>E-commerce Boilerplate</h1>
            <p class="intro">
                This project provides a ready-to-extend backend for a full online store experience.
                It is designed to support the storefront, admin dashboard, product browsing, auth,
                checkout, payments, coupons, returns, reviews, and settings flows described in the repo docs.
            </p>

            <div class="feature-grid">
                <div class="feature">
                    <strong>Storefront APIs</strong>
                    Products, categories, search, filters, wishlist, cart, and checkout endpoints.
                </div>
                <div class="feature">
                    <strong>Customer Accounts</strong>
                    Registration, login, profile updates, address management, and order history.
                </div>
                <div class="feature">
                    <strong>Admin Operations</strong>
                    Product, category, order, payment, review, coupon, and user management tools.
                </div>
                <div class="feature">
                    <strong>Business Rules</strong>
                    Secure money handling, stock updates, refunds, wallet activity, and status tracking.
                </div>
            </div>

            <div class="actions">
                <a class="btn btn-primary" href="#overview">Explore Project</a>
                <a class="btn btn-secondary" href="#docs">View Docs</a>
            </div>
        </section>

        <aside class="panel" id="overview">
            <h2>Project highlights</h2>
            <div class="stat">Laravel backend with API-first design</div>
            <div class="stat">React storefront + admin contract</div>
            <div class="stat">JSON mock data for local development</div>
            <div class="stat">Database schema, endpoints, and business logic documented</div>
            <div class="stat" id="docs">Ready for checkout and order lifecycle flows</div>
        </aside>
    </main>
</body>
</html>
