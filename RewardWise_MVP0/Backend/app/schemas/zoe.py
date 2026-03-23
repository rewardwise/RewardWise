from pydantic import BaseModel

class ZoeRequest(BaseModel):
    message: str
    user_id: str