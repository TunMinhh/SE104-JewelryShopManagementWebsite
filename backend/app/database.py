from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

#DATABASE_URL = "postgresql://postgres:Toiyeucnpm%402005@db.hyfrpvhuqhvdbrwgbsmp.supabase.co:5432/postgres"
DATABASE_URL = "postgresql://postgres:Toiyeucnpm%402005@db.vlumlsmetsjvslzaamav.supabase.co:5432/postgres"

# Fail fast when DB is unreachable so API requests don't appear to hang.
engine = create_engine(DATABASE_URL, connect_args={"connect_timeout": 8})

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()