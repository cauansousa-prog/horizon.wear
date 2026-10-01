import hashlib,hmac
from decimal import Decimal
from fastapi import HTTPException
import httpx

def verify_signature(secret,signature,request_id,data_id):
    try:
        parts=dict(piece.strip().split('=',1) for piece in signature.split(','))
        ts=parts['ts']; supplied=parts['v1']
        if not ts.isdigit() or not request_id or not data_id.isdigit():return False
        manifest=f'id:{data_id};request-id:{request_id};ts:{ts};'
        return hmac.compare_digest(hmac.new(secret.encode(),manifest.encode(),hashlib.sha256).hexdigest(),supplied)
    except (ValueError,KeyError):return False

class MercadoPago:
    def __init__(self,client,settings):self.client=client;self.settings=settings
    async def request(self,path,*,body=None,key=None):
        token=self.settings.mercadopago_access_token.get_secret_value()
        if not token:raise HTTPException(503,'Pagamentos ainda não estão disponíveis. Tente novamente mais tarde.')
        headers={'Authorization':'Bearer '+token}
        if key:headers['X-Idempotency-Key']=str(key)
        try:r=await self.client.request('POST' if body is not None else 'GET','https://api.mercadopago.com'+path,headers=headers,json=body,timeout=25)
        except httpx.RequestError:raise HTTPException(503,'Não foi possível confirmar o pagamento. Tente novamente com a mesma solicitação.') from None
        if r.is_error:
            detail='O Mercado Pago não concluiu o pagamento.'
            try:
                payload=r.json()
            except ValueError:
                payload={}
            message=str(payload.get('message') or '').lower()
            causes=payload.get('cause') if isinstance(payload,dict) else []
            if not isinstance(causes,list):causes=[]
            cause_codes={str(c.get('code')) for c in causes if isinstance(c,dict)}
            cause_text=' '.join(str(c.get('description') or c.get('data') or '') for c in causes if isinstance(c,dict)).lower()
            combined=(message+' '+cause_text).strip()
            if r.status_code==401:
                detail='As credenciais do Mercado Pago não foram aceitas. Revise o Access Token configurado no servidor.'
            elif 'collector' in combined or 'payer' in combined and 'same' in combined or '145' in cause_codes:
                detail='O Mercado Pago recusou a operação entre as contas usadas. Em testes, use uma conta Comprador diferente da conta Vendedor.'
            elif 'regulation' in combined or 'compliance' in combined or '160' in cause_codes:
                detail='A conta vendedora do Mercado Pago ainda não está habilitada para processar este pagamento.'
            elif 'identification' in combined or 'cpf' in combined:
                detail='O Mercado Pago recusou os dados de identificação do comprador. Confira o CPF e tente novamente.'
            elif 'payment_method' in combined or '204' in cause_codes:
                detail='Esse meio de pagamento não está disponível para esta conta no Mercado Pago.'
            elif r.status_code==429:
                detail='O Mercado Pago recebeu muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente.'
            raise HTTPException(502,detail)
        try:return r.json()
        except ValueError:raise HTTPException(502,'Resposta inválida do provedor de pagamento.') from None

    async def available_methods(self):
        methods=await self.request('/v1/payment_methods')
        if not isinstance(methods,list):raise HTTPException(502,'Não foi possível consultar os meios de pagamento.')
        ids={item.get('id') for item in methods if isinstance(item,dict)}
        result=[]
        if 'pix' in ids:result.append('pix')
        if self.settings.mercadopago_public_key and any(item.get('payment_type_id')=='credit_card' for item in methods if isinstance(item,dict)):
            result.append('cartao')
        if 'bolbradesco' in ids:result.append('boleto')
        return result

async def privileged_rpc(db,name,body):
    key=db.settings.supabase_service_role_key.get_secret_value()
    if not key:raise HTTPException(503,'Checkout temporariamente indisponível.')
    try:r=await db.client.post(db.settings.supabase_url+'/rest/v1/rpc/'+name,headers={'apikey':key,'Authorization':'Bearer '+key},json=body)
    except httpx.RequestError:raise HTTPException(503,'Não foi possível confirmar o pedido. Tente novamente.') from None
    if r.is_error:raise HTTPException(409,'Não foi possível confirmar o pedido. Confira estoque e dados; se houve cobrança, procure o atendimento.')
    return r.json() if r.content else None

def payment_details(payment):
    interaction=payment.get('point_of_interaction') or {}
    tx=interaction.get('transaction_data') or {}
    details=payment.get('transaction_details') or {}
    barcode=payment.get('barcode') or {}
    if not isinstance(barcode,dict):barcode={}
    return {'qr_code':tx.get('qr_code'),'qr_code_base64':tx.get('qr_code_base64'),
            'linha_digitavel':barcode.get('content') or payment.get('barcode_content'),
            'boleto_url':details.get('external_resource_url'),
            'parcelas':payment.get('installments') or 1,
            'expires_at':payment.get('date_of_expiration')}

async def apply_payment(db,payment):
    from uuid import UUID
    try:order=str(UUID(payment['external_reference']))
    except (KeyError,ValueError,TypeError):raise HTTPException(422,'Referência de pagamento inválida.') from None
    if payment.get('currency_id')!='BRL':raise HTTPException(409,'Moeda do pagamento divergente.')
    if not str(payment.get('id','')).isdigit() or payment.get('status') not in {'pending','in_process','authorized','approved','rejected','cancelled','refunded','charged_back'}:
        raise HTTPException(502,'Resposta inválida do provedor de pagamento.')
    await privileged_rpc(db,'horizon_apply_payment',{'p_order':order,'p_payment_id':str(payment['id']),'p_status':payment['status'],'p_amount':str(Decimal(str(payment['transaction_amount']))),'p_details':payment_details(payment)})
