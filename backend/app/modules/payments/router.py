import hashlib,json
from uuid import UUID
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel,Field,ConfigDict,model_validator
from fastapi import APIRouter,Depends,HTTPException,Header
from fastapi.security import HTTPAuthorizationCredentials
from ...auth import bearer,current_user
from ...database import Database,get_database
from ..cart.router import Item,quote_items
from ..users.account import Address
from .gateway import MercadoPago,privileged_rpc,apply_payment,payment_details

router=APIRouter(prefix='/checkout',tags=['checkout'])
class Customer(BaseModel):
    model_config=ConfigDict(extra='forbid')
    name:str=Field(min_length=2,max_length=120)
    email:str=Field(pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$',max_length=254)
    cpf:str=Field(pattern=r'^\d{11}$')
    phone:str=Field(min_length=10,max_length=20)
    address:Address
class Checkout(BaseModel):
    model_config=ConfigDict(extra='forbid')
    customer:Customer
    items:list[Item]=Field(min_length=1,max_length=100)
    method:Literal['pix','cartao','boleto']
    payment_method_id:str=Field(default='pix',pattern=r'^[a-zA-Z0-9_]{1,40}$')
    token:str|None=Field(default=None,max_length=512)
    installments:int=Field(default=1,ge=1,le=12)
    issuer_id:str|None=Field(default=None,max_length=30,pattern=r'^\d+$')
    @model_validator(mode='after')
    def card_token(self):
        if self.method=='cartao' and not self.token:raise ValueError('Token do cartão necessário.')
        if any(i.quantity<1 for i in self.items):raise ValueError('Carrinho inválido.')
        return self

def ready(settings):
    return bool(settings.supabase_service_role_key.get_secret_value() and settings.mercadopago_access_token.get_secret_value() and settings.mercadopago_webhook_secret.get_secret_value() and settings.public_base_url.startswith('https://'))

@router.get('/config')
async def config(db:Database=Depends(get_database)):
    methods=await MercadoPago(db.client,db.settings).available_methods() if ready(db.settings) else []
    return {'available':bool(methods),'methods':methods,'public_key':db.settings.mercadopago_public_key,'shipping':str(db.settings.shipping_flat_brl)}

@router.post('')
async def checkout(body:Checkout,idempotency_key:UUID=Header(),checkout_token:str=Header(min_length=32,max_length=128),credentials:HTTPAuthorizationCredentials|None=Depends(bearer),db:Database=Depends(get_database)):
    if not ready(db.settings):raise HTTPException(503,'O checkout está sendo preparado. Seus itens continuam salvos no carrinho.')
    if body.method not in await MercadoPago(db.client,db.settings).available_methods():
        raise HTTPException(422,'Esta forma de pagamento não está disponível agora.')
    user=await current_user(credentials,db) if credentials else None
    # O servidor nunca recebe preço nem status calculado pelo navegador.
    await quote_items(body.items,db)
    customer=body.customer.model_dump(mode='json')
    fingerprint=hashlib.sha256(json.dumps({'customer':customer,'items':[i.model_dump(mode='json') for i in body.items],
        'method':body.method,'payment_method_id':body.payment_method_id if body.method=='cartao' else body.method,
        'installments':body.installments if body.method=='cartao' else 1,
        'issuer_id':body.issuer_id if body.method=='cartao' else None,
        'user':user.id if user else None},sort_keys=True).encode()).hexdigest()
    guest_hash=hashlib.sha256(checkout_token.encode()).hexdigest()
    order=await privileged_rpc(db,'horizon_create_order',{'p_user':user.id if user else None,'p_customer':customer,'p_items':[i.model_dump(mode='json') for i in body.items],'p_key':str(idempotency_key),'p_hash':fingerprint,'p_guest_hash':guest_hash,'p_method':body.method,'p_shipping':str(db.settings.shipping_flat_brl)})
    names=customer['name'].split(maxsplit=1)
    payer={'email':customer['email'],'first_name':names[0],'last_name':names[1] if len(names)>1 else names[0],'identification':{'type':'CPF','number':customer['cpf']}}
    method={'pix':'pix','boleto':'bolbradesco'}.get(body.method,body.payment_method_id)
    payment={'transaction_amount':float(Decimal(str(order['total']))),'description':'Horizon Wear '+str(order['codigo']),'payment_method_id':method,'payer':payer,'external_reference':order['id'],'notification_url':db.settings.public_base_url.rstrip('/')+'/api/webhooks/mercadopago'}
    if body.method=='cartao':
        payment.update(token=body.token,installments=body.installments)
        if body.issuer_id:payment['issuer_id']=body.issuer_id
    if body.method=='boleto':
        a=customer['address'];payer['address']={'zip_code':a['cep'],'street_name':a['rua'],'street_number':a['numero'],'neighborhood':a['bairro'],'city':a['cidade'],'federal_unit':a['estado']}
    result=await MercadoPago(db.client,db.settings).request('/v1/payments',body=payment,key=idempotency_key)
    await apply_payment(db,result)
    saved=await privileged_rpc(db,'horizon_get_checkout',{'p_order':order['id'],'p_guest_hash':guest_hash})
    return {'order_id':order['id'],'code':order['codigo'],'total':order['total'],'status':result['status'],
            'review_required':saved['review_required'],**payment_details(result)}

@router.get('/{order_id}')
async def status(order_id:UUID,checkout_token:str=Header(min_length=32,max_length=128),db:Database=Depends(get_database)):
    order=await privileged_rpc(db,'horizon_get_checkout',{'p_order':str(order_id),'p_guest_hash':hashlib.sha256(checkout_token.encode()).hexdigest()})
    if not order:raise HTTPException(404,'Pedido não encontrado.')
    if order['payment_id']:
        payment=await MercadoPago(db.client,db.settings).request('/v1/payments/'+str(order['payment_id']))
        await apply_payment(db,payment)
        saved=await privileged_rpc(db,'horizon_get_checkout',{'p_order':str(order_id),'p_guest_hash':hashlib.sha256(checkout_token.encode()).hexdigest()})
        return {'code':order['codigo'],'payment_status':payment['status'],'total':order['total'],
                'review_required':saved['review_required'],**payment_details(payment)}
    return {'code':order['codigo'],'payment_status':'pending','total':order['total'],
            'review_required':order['review_required']}
