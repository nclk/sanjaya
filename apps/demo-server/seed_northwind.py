#!/usr/bin/env python
"""Seed a Northwind-subset schema into the MSSQL test database.

Creates four tables (customers, products, orders, order_details) and
populates them with ~80 customers, ~77 products, ~800 orders, and
~2 000 order details.  Designed to exercise multi-table JOINs,
filtering, aggregation, and pivot queries.

Usage
-----
    cd apps/demo-server
    uv run python seed_northwind.py          # uses default MSSQL_URL from settings
    SANJAYA_MSSQL_URL="..." uv run python seed_northwind.py   # custom URL

The script is idempotent: it drops and recreates the tables each run.
"""

from __future__ import annotations

import os
import random
import sys
from datetime import date, timedelta

import sqlalchemy as sa

# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------

MSSQL_URL = os.environ.get(
    "SANJAYA_MSSQL_URL",
    "mssql+pyodbc://sa:Sanjaya_Test1@localhost:1433/sanjaya_test"
    "?driver=ODBC+Driver+18+for+SQL+Server"
    "&TrustServerCertificate=yes&Encrypt=no",
)

engine = sa.create_engine(MSSQL_URL, echo=False)
metadata = sa.MetaData()

# ---------------------------------------------------------------------------
# Table definitions
# ---------------------------------------------------------------------------

customers = sa.Table(
    "customers",
    metadata,
    sa.Column("customer_id", sa.Integer, primary_key=True, autoincrement=True),
    sa.Column("company", sa.String(100), nullable=False),
    sa.Column("contact", sa.String(100), nullable=False),
    sa.Column("city", sa.String(60), nullable=False),
    sa.Column("country", sa.String(40), nullable=False),
)

products = sa.Table(
    "products",
    metadata,
    sa.Column("product_id", sa.Integer, primary_key=True, autoincrement=True),
    sa.Column("name", sa.String(100), nullable=False),
    sa.Column("category", sa.String(60), nullable=False),
    sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
    sa.Column("units_in_stock", sa.Integer, nullable=False),
    sa.Column("discontinued", sa.Boolean, nullable=False, server_default="0"),
)

orders = sa.Table(
    "orders",
    metadata,
    sa.Column("order_id", sa.Integer, primary_key=True, autoincrement=True),
    sa.Column(
        "customer_id",
        sa.Integer,
        sa.ForeignKey("customers.customer_id"),
        nullable=False,
    ),
    sa.Column("order_date", sa.Date, nullable=False),
    sa.Column("ship_country", sa.String(40), nullable=False),
    sa.Column("freight", sa.Numeric(10, 2), nullable=False),
)

order_details = sa.Table(
    "order_details",
    metadata,
    sa.Column("detail_id", sa.Integer, primary_key=True, autoincrement=True),
    sa.Column(
        "order_id",
        sa.Integer,
        sa.ForeignKey("orders.order_id"),
        nullable=False,
    ),
    sa.Column(
        "product_id",
        sa.Integer,
        sa.ForeignKey("products.product_id"),
        nullable=False,
    ),
    sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
    sa.Column("quantity", sa.Integer, nullable=False),
    sa.Column("discount", sa.Numeric(4, 2), nullable=False, server_default="0"),
)

# ---------------------------------------------------------------------------
# Seed data — customers
# ---------------------------------------------------------------------------

CUSTOMERS = [
    # (company, contact, city, country)
    ("Alfreds Futterkiste", "Maria Anders", "Berlin", "Germany"),
    ("Ana Trujillo Emparedados", "Ana Trujillo", "México D.F.", "Mexico"),
    ("Antonio Moreno Taquería", "Antonio Moreno", "México D.F.", "Mexico"),
    ("Around the Horn", "Thomas Hardy", "London", "UK"),
    ("Berglunds snabbköp", "Christina Berglund", "Luleå", "Sweden"),
    ("Blauer See Delikatessen", "Hanna Moos", "Mannheim", "Germany"),
    ("Blondesddsl père et fils", "Frédérique Citeaux", "Strasbourg", "France"),
    ("Bólido Comidas preparadas", "Martín Sommer", "Madrid", "Spain"),
    ("Bon app'", "Laurence Lebihans", "Marseille", "France"),
    ("Bottom-Dollar Marketse", "Elizabeth Lincoln", "Tsawwassen", "Canada"),
    ("B's Beverages", "Victoria Ashworth", "London", "UK"),
    ("Cactus Comidas para llevar", "Patricio Simpson", "Buenos Aires", "Argentina"),
    ("Centro comercial Moctezuma", "Francisco Chang", "México D.F.", "Mexico"),
    ("Chop-suey Chinese", "Yang Wang", "Bern", "Switzerland"),
    ("Comércio Mineiro", "Pedro Afonso", "São Paulo", "Brazil"),
    ("Consolidated Holdings", "Elizabeth Brown", "London", "UK"),
    ("Drachenblut Delikatessen", "Sven Ottlieb", "Aachen", "Germany"),
    ("Du monde entier", "Janine Labrune", "Nantes", "France"),
    ("Eastern Connection", "Ann Devon", "London", "UK"),
    ("Ernst Handel", "Roland Mendel", "Graz", "Austria"),
    ("Familia Arquibaldo", "Aria Cruz", "São Paulo", "Brazil"),
    ("FISSA Fabrica Inter.", "Diego Roel", "Madrid", "Spain"),
    ("Folies gourmandes", "Martine Rancé", "Lille", "France"),
    ("Folk och fä HB", "Maria Larsson", "Bräcke", "Sweden"),
    ("Frankenversand", "Peter Franken", "München", "Germany"),
    ("France restauration", "Carine Schmitt", "Nantes", "France"),
    ("Franchi S.p.A.", "Paolo Accorti", "Torino", "Italy"),
    ("Furia Bacalhau e Frutos do Mar", "Lino Rodriguez", "Lisboa", "Portugal"),
    ("Galería del gastrónomo", "Eduardo Saavedra", "Barcelona", "Spain"),
    ("Godos Cocina Típica", "José Pedro Freyre", "Sevilla", "Spain"),
    ("Gourmet Lanchonetes", "André Fonseca", "Campinas", "Brazil"),
    ("Great Lakes Food Market", "Howard Snyder", "Eugene", "USA"),
    ("GROSELLA-Restaurante", "Manuel Pereira", "Caracas", "Venezuela"),
    ("Hanari Carnes", "Mario Pontes", "Rio de Janeiro", "Brazil"),
    ("HILARIÓN-Abastos", "Carlos Hernández", "San Cristóbal", "Venezuela"),
    ("Hungry Coyote Import Store", "Yoshi Latimer", "Elgin", "USA"),
    ("Hungry Owl All-Night Grocers", "Patricia McKenna", "Cork", "Ireland"),
    ("Island Trading", "Helen Bennett", "Cowes", "UK"),
    ("Königlich Essen", "Philip Cramer", "Brandenburg", "Germany"),
    ("La corne d'abondance", "Daniel Tonini", "Versailles", "France"),
    ("La maison d'Asie", "Annette Roulet", "Toulouse", "France"),
    ("Laughing Bacchus Wine Cellars", "Yoshi Tannamuri", "Vancouver", "Canada"),
    ("Lazy K Kountry Store", "John Steel", "Walla Walla", "USA"),
    ("Lehmanns Marktstand", "Renate Messner", "Frankfurt a.M.", "Germany"),
    ("Let's Stop N Shop", "Jaime Yorres", "San Francisco", "USA"),
    ("LILA-Supermercado", "Carlos González", "Barquisimeto", "Venezuela"),
    ("LINO-Delicateses", "Felipe Izquierdo", "I. de Margarita", "Venezuela"),
    ("Lonesome Pine Restaurant", "Fran Wilson", "Portland", "USA"),
    ("Magazzini Alimentari Riuniti", "Giovanni Rovelli", "Bergamo", "Italy"),
    ("Maison Dewey", "Catherine Dewey", "Bruxelles", "Belgium"),
    ("Mère Paillarde", "Jean Fresnière", "Montréal", "Canada"),
    ("Morgenstern Gesundkost", "Alexander Feuer", "Leipzig", "Germany"),
    ("North/South", "Simon Crowther", "London", "UK"),
    ("Océano Atlántico Ltda.", "Yvonne Moncada", "Buenos Aires", "Argentina"),
    ("Old World Delicatessen", "Rene Phillips", "Anchorage", "USA"),
    ("Ottilies Käseladen", "Henriette Pfalzheim", "Köln", "Germany"),
    ("Paris spécialités", "Marie Bertrand", "Paris", "France"),
    ("Pericles Comidas clásicas", "Guillermo Fernández", "México D.F.", "Mexico"),
    ("Piccolo und mehr", "Georg Pipps", "Salzburg", "Austria"),
    ("Princesa Isabel Vinheria", "Isabel de Castro", "Lisboa", "Portugal"),
    ("Que Delícia", "Bernardo Batista", "Rio de Janeiro", "Brazil"),
    ("Queen Cozinha", "Lúcia Carvalho", "São Paulo", "Brazil"),
    ("QUICK-Stop", "Horst Kloss", "Cunewalde", "Germany"),
    ("Rancho grande", "Sergio Gutiérrez", "Buenos Aires", "Argentina"),
    ("Rattlesnake Canyon Grocery", "Paula Wilson", "Albuquerque", "USA"),
    ("Reggiani Caseifici", "Maurizio Moroni", "Reggio Emilia", "Italy"),
    ("Ricardo Adocicados", "Janete Limeira", "Rio de Janeiro", "Brazil"),
    ("Richter Supermarkt", "Michael Holz", "Genève", "Switzerland"),
    ("Romero y tomillo", "Alejandra Camino", "Madrid", "Spain"),
    ("Santé Gourmet", "Jonas Bergulfsen", "Stavern", "Norway"),
    ("Save-a-lot Markets", "Jose Pavarotti", "Boise", "USA"),
    ("Seven Seas Imports", "Hari Kumar", "London", "UK"),
    ("Simons bistro", "Jytte Petersen", "København", "Denmark"),
    ("Spécialités du monde", "Dominique Perrier", "Paris", "France"),
    ("Split Rail Beer & Ale", "Art Braunschweiger", "Lander", "USA"),
    ("Suprêmes délices", "Pascale Cartrain", "Charleroi", "Belgium"),
    ("The Big Cheese", "Liz Nixon", "Portland", "USA"),
    ("The Cracker Box", "Liu Wong", "Butte", "USA"),
    ("Toms Spezialitäten", "Karin Josephs", "Münster", "Germany"),
    ("Tortuga Restaurante", "Miguel Angel Paolino", "México D.F.", "Mexico"),
    ("Vaffeljernet", "Palle Ibsen", "Århus", "Denmark"),
    ("Victuailles en stock", "Mary Saveley", "Lyon", "France"),
    ("Vins et alcools Chevalier", "Paul Henriot", "Reims", "France"),
    ("Die Wandernde Kuh", "Rita Müller", "Stuttgart", "Germany"),
    ("Wartian Herkku", "Pirkko Koskitalo", "Oulu", "Finland"),
    ("Wellington Importadora", "Paula Parente", "Resende", "Brazil"),
    ("White Clover Markets", "Karl Jablonski", "Seattle", "USA"),
    ("Wilman Kala", "Matti Karttunen", "Helsinki", "Finland"),
    ("Wolski", "Zbyszek", "Walla", "Poland"),
]

# ---------------------------------------------------------------------------
# Seed data — products
# ---------------------------------------------------------------------------

CATEGORIES = [
    "Beverages",
    "Condiments",
    "Confections",
    "Dairy Products",
    "Grains/Cereals",
    "Meat/Poultry",
    "Produce",
    "Seafood",
]

PRODUCTS = [
    # (name, category, unit_price, units_in_stock, discontinued)
    ("Chai", "Beverages", 18.00, 39, False),
    ("Chang", "Beverages", 19.00, 17, False),
    ("Aniseed Syrup", "Condiments", 10.00, 13, False),
    ("Chef Anton's Cajun Seasoning", "Condiments", 22.00, 53, False),
    ("Chef Anton's Gumbo Mix", "Condiments", 21.35, 0, True),
    ("Grandma's Boysenberry Spread", "Condiments", 25.00, 120, False),
    ("Uncle Bob's Organic Dried Pears", "Produce", 30.00, 15, False),
    ("Northwoods Cranberry Sauce", "Condiments", 40.00, 6, False),
    ("Mishi Kobe Niku", "Meat/Poultry", 97.00, 29, True),
    ("Ikura", "Seafood", 31.00, 31, False),
    ("Queso Cabrales", "Dairy Products", 21.00, 22, False),
    ("Queso Manchego La Pastora", "Dairy Products", 38.00, 86, False),
    ("Konbu", "Seafood", 6.00, 24, False),
    ("Tofu", "Produce", 23.25, 35, False),
    ("Genen Shouyu", "Condiments", 15.50, 39, False),
    ("Pavlova", "Confections", 17.45, 29, False),
    ("Alice Mutton", "Meat/Poultry", 39.00, 0, True),
    ("Carnarvon Tigers", "Seafood", 62.50, 42, False),
    ("Teatime Chocolate Biscuits", "Confections", 9.20, 25, False),
    ("Sir Rodney's Marmalade", "Confections", 81.00, 40, False),
    ("Sir Rodney's Scones", "Confections", 10.00, 3, False),
    ("Gustaf's Knäckebröd", "Grains/Cereals", 21.00, 104, False),
    ("Tunnbröd", "Grains/Cereals", 9.00, 61, False),
    ("Guaraná Fantástica", "Beverages", 4.50, 20, False),
    ("NuNuCa Nuß-Nougat-Creme", "Confections", 14.00, 76, False),
    ("Gumbär Gummibärchen", "Confections", 31.23, 15, False),
    ("Schoggi Schokolade", "Confections", 43.90, 49, False),
    ("Rössle Sauerkraut", "Produce", 45.60, 26, False),
    ("Thüringer Rostbratwurst", "Meat/Poultry", 123.79, 0, True),
    ("Nord-Ost Matjeshering", "Seafood", 25.89, 10, False),
    ("Gorgonzola Telino", "Dairy Products", 12.50, 0, False),
    ("Mascarpone Fabioli", "Dairy Products", 32.00, 9, False),
    ("Geitost", "Dairy Products", 2.50, 112, False),
    ("Sasquatch Ale", "Beverages", 14.00, 111, False),
    ("Steeleye Stout", "Beverages", 18.00, 20, False),
    ("Inlagd Sill", "Seafood", 19.00, 112, False),
    ("Gravad lax", "Seafood", 26.00, 11, False),
    ("Côte de Blaye", "Beverages", 263.50, 17, False),
    ("Chartreuse verte", "Beverages", 18.00, 69, False),
    ("Boston Crab Meat", "Seafood", 18.40, 123, False),
    ("Jack's New England Clam Chowder", "Seafood", 9.65, 85, False),
    ("Singaporean Hokkien Fried Mee", "Grains/Cereals", 14.00, 26, False),
    ("Ipoh Coffee", "Beverages", 46.00, 17, False),
    ("Gula Malacca", "Condiments", 19.45, 27, False),
    ("Rogede sild", "Seafood", 9.50, 5, False),
    ("Spegesild", "Seafood", 12.00, 95, False),
    ("Zaanse koeken", "Confections", 9.50, 36, False),
    ("Chocolade", "Confections", 12.75, 15, False),
    ("Maxilaku", "Confections", 20.00, 10, False),
    ("Valkoinen suklaa", "Confections", 16.25, 65, False),
    ("Manjimup Dried Apples", "Produce", 53.00, 20, False),
    ("Filo Mix", "Grains/Cereals", 7.00, 38, False),
    ("Perth Pasties", "Meat/Poultry", 32.80, 0, False),
    ("Tourtière", "Meat/Poultry", 7.45, 21, False),
    ("Pâté chinois", "Meat/Poultry", 24.00, 115, False),
    ("Gnocchi di nonna Alice", "Grains/Cereals", 38.00, 21, False),
    ("Ravioli Angelo", "Grains/Cereals", 19.50, 36, False),
    ("Escargots de Bourgogne", "Seafood", 13.25, 62, False),
    ("Raclette Courdavault", "Dairy Products", 55.00, 79, False),
    ("Camembert Pierrot", "Dairy Products", 34.00, 19, False),
    ("Sirop d'érable", "Condiments", 28.50, 113, False),
    ("Tarte au sucre", "Confections", 49.30, 17, False),
    ("Vegie-spread", "Condiments", 43.90, 24, False),
    ("Wimmers gute Semmelknödel", "Grains/Cereals", 33.25, 22, False),
    ("Louisiana Fiery Hot Pepper Sauce", "Condiments", 21.05, 76, False),
    ("Louisiana Hot Spiced Okra", "Condiments", 17.00, 4, False),
    ("Laughing Lumberjack Lager", "Beverages", 14.00, 52, False),
    ("Scottish Longbreads", "Confections", 12.50, 6, False),
    ("Gudbrandsdalsost", "Dairy Products", 36.00, 26, False),
    ("Outback Lager", "Beverages", 15.00, 15, False),
    ("Flotemysost", "Dairy Products", 21.50, 26, False),
    ("Mozzarella di Giovanni", "Dairy Products", 34.80, 14, False),
    ("Röd Kaviar", "Seafood", 15.00, 101, False),
    ("Longlife Tofu", "Produce", 10.00, 4, False),
    ("Rhönbräu Klosterbier", "Beverages", 7.75, 125, False),
    ("Lakkalikööri", "Beverages", 18.00, 57, False),
    ("Original Frankfurter grüne Soße", "Condiments", 13.00, 32, False),
]

# ---------------------------------------------------------------------------
# Ship countries — mapped from customer country (simplification)
# ---------------------------------------------------------------------------

SHIP_COUNTRIES = [
    "Germany", "Mexico", "UK", "Sweden", "France", "Spain", "Canada",
    "Argentina", "Switzerland", "Brazil", "Austria", "Italy", "Portugal",
    "USA", "Ireland", "Venezuela", "Belgium", "Denmark", "Norway",
    "Finland", "Poland",
]

# ---------------------------------------------------------------------------
# Seeding logic
# ---------------------------------------------------------------------------

SEED = 42  # reproducible data


def seed() -> None:
    """Drop and recreate all tables, then populate with seed data."""
    rng = random.Random(SEED)

    print("Dropping existing tables…")
    metadata.drop_all(engine, checkfirst=True)

    print("Creating tables…")
    metadata.create_all(engine)

    with engine.begin() as conn:
        # ── Customers ────────────────────────────────────────────
        print(f"Inserting {len(CUSTOMERS)} customers…")
        conn.execute(
            customers.insert(),
            [
                {
                    "company": c[0],
                    "contact": c[1],
                    "city": c[2],
                    "country": c[3],
                }
                for c in CUSTOMERS
            ],
        )

        # ── Products ─────────────────────────────────────────────
        print(f"Inserting {len(PRODUCTS)} products…")
        conn.execute(
            products.insert(),
            [
                {
                    "name": p[0],
                    "category": p[1],
                    "unit_price": p[2],
                    "units_in_stock": p[3],
                    "discontinued": p[4],
                }
                for p in PRODUCTS
            ],
        )

        # ── Orders ───────────────────────────────────────────────
        num_customers = len(CUSTOMERS)
        num_products = len(PRODUCTS)

        # Generate ~830 orders across 2 years
        start_date = date(2023, 1, 1)
        end_date = date(2024, 12, 31)
        date_range = (end_date - start_date).days

        order_rows: list[dict] = []
        for _ in range(830):
            cust_idx = rng.randint(1, num_customers)
            cust_country = CUSTOMERS[cust_idx - 1][3]
            order_date = start_date + timedelta(days=rng.randint(0, date_range))
            # Most orders ship to the customer's country; ~10% ship elsewhere
            if rng.random() < 0.9:
                ship_country = cust_country
            else:
                ship_country = rng.choice(SHIP_COUNTRIES)
            freight = round(rng.uniform(1.0, 200.0), 2)
            order_rows.append(
                {
                    "customer_id": cust_idx,
                    "order_date": order_date,
                    "ship_country": ship_country,
                    "freight": freight,
                }
            )

        print(f"Inserting {len(order_rows)} orders…")
        conn.execute(orders.insert(), order_rows)

        # ── Order details ────────────────────────────────────────
        detail_rows: list[dict] = []
        discount_options = [0.0, 0.0, 0.0, 0.05, 0.10, 0.15, 0.20, 0.25]

        for order_id in range(1, len(order_rows) + 1):
            # Each order has 1–5 line items
            num_items = rng.randint(1, 5)
            chosen_products = rng.sample(
                range(1, num_products + 1), min(num_items, num_products)
            )
            for prod_id in chosen_products:
                prod_price = PRODUCTS[prod_id - 1][2]
                # Slight price variation (±5%)
                actual_price = round(prod_price * rng.uniform(0.95, 1.05), 2)
                quantity = rng.randint(1, 50)
                discount = rng.choice(discount_options)
                detail_rows.append(
                    {
                        "order_id": order_id,
                        "product_id": prod_id,
                        "unit_price": actual_price,
                        "quantity": quantity,
                        "discount": discount,
                    }
                )

        print(f"Inserting {len(detail_rows)} order details…")
        # Insert in batches to avoid parameter limits on MSSQL
        batch_size = 500
        for i in range(0, len(detail_rows), batch_size):
            conn.execute(
                order_details.insert(), detail_rows[i : i + batch_size]
            )

    print(
        f"\nDone! Seeded:\n"
        f"  • {len(CUSTOMERS)} customers\n"
        f"  • {len(PRODUCTS)} products\n"
        f"  • {len(order_rows)} orders\n"
        f"  • {len(detail_rows)} order details\n"
    )


if __name__ == "__main__":
    try:
        seed()
    except Exception as exc:
        print(f"\nError: {exc}", file=sys.stderr)
        print(
            "\nMake sure the MSSQL container is running: make mssql-up",
            file=sys.stderr,
        )
        sys.exit(1)
