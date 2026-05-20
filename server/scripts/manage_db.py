import argparse
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.core.database import SessionLocal
from app.core.database import create_db_tables, drop_db_tables, load_model_modules, reset_db_tables


def run_seed() -> None:
    load_model_modules()
    from app.core.seed import seed_demo_data

    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Manage server database lifecycle.")
    parser.add_argument(
        "command",
        choices=("create", "drop", "reset", "seed"),
        help="Database management action to run.",
    )
    args = parser.parse_args()

    if args.command == "create":
        create_db_tables()
        return

    if args.command == "drop":
        drop_db_tables()
        return

    if args.command == "reset":
        reset_db_tables()
        return

    run_seed()


if __name__ == "__main__":
    main()
