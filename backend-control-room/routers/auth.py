# routers/auth.py
# Login: verifica badge_code + password, rilascia il JWT.
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from database import SystemLog, User
from security import create_access_token, get_db, verify_password

router = APIRouter(tags=["auth"])


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Cerca l'utente usando il badge_code come 'username'
    user = db.query(User).filter(User.badge_code == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):

        # 🚨 FAIL LOG: Someone is trying to force access
        failed_log = SystemLog(
            action_type="SECURITY_ALERT",
            description=f"FAILED login attempt for Operator ID: {form_data.username}"
        )
        db.add(failed_log)
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid badge code or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Se la password è giusta, crea il token
    access_token = create_access_token(data={"sub": user.badge_code, "role": user.role})

    # ✅ SUCCESS LOG: Tracking room entry
    new_log = SystemLog(
        user_id=user.id,
        action_type="USER_LOGIN",
        description=f"Operator {user.full_name} logged in with role: {user.role.upper()}"
    )
    db.add(new_log)
    db.commit()

    return {"access_token": access_token, "token_type": "bearer", "role": user.role}
