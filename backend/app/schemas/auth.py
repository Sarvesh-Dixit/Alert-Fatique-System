from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """Sign-up: creates a user and their first organization together."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)
    organization_name: str = Field(min_length=1, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: str

    class Config:
        from_attributes = True


class OrganizationResponse(BaseModel):
    id: str
    name: str
    slug: str
    role: str | None = None

    class Config:
        from_attributes = True


class MeResponse(BaseModel):
    user: UserResponse
    organizations: list[OrganizationResponse]
