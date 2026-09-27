from fastapi import APIRouter,Depends,HTTPException,Request
from ...database import Database,get_database
from ..payments.gateway import MercadoPago,verify_signature,apply_payment
router=APIRouter(prefix='/webhooks',tags=['webhooks'])
@router.post('/mercadopago')
async def mercadopago(request:Request,db:Database=Depends(get_database)):
    secret=db.settings.mercadopago_webhook_secret.get_secret_value()
    if not secret:raise HTTPException(503,'Webhook não configurado.')
    if request.query_params.get('type',request.query_params.get('topic','payment'))!='payment':
        return {'received':True}
    payment_id=request.query_params.get('data.id','')
    if not verify_signature(secret,request.headers.get('x-signature',''),request.headers.get('x-request-id',''),payment_id):raise HTTPException(401,'Notificação inválida.')
    payment=await MercadoPago(db.client,db.settings).request('/v1/payments/'+payment_id)
    await apply_payment(db,payment)
    return {'received':True}
