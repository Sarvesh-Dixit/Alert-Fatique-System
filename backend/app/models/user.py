from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.ids import new_id
from app.database import Base
from app.models._mixins import TimestampMixin


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: new_id("usr")
    )
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    memberships = relationship(
        "OrganizationMember", back_populates="user", cascade="all, delete-orphan"
    )
